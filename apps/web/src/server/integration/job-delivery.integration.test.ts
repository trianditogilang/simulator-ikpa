import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDbClient } from "@simulator-ikpa/db";
import {
	fiscalYears,
	notificationDeliveries,
	reminderPolicies,
	ruleSets,
} from "@simulator-ikpa/db/schema";
import { and, eq, lte } from "drizzle-orm";

// F13-03 delivery probe on the ADR-008 stack: the scheduler's HTTP call
// (Bearer JOB_SECRET) sends one due delivery over SMTP to the local mail
// catcher, and a replay sends nothing. Run via scripts/run-f13-03-provider-integration.mjs.
const shouldRun = process.env.F13_03_REAL_PROVIDER_TEST === "1";
const baseUrl = process.env.F13_03_HTTP_URL;
const testDatabaseUrl = process.env.DATABASE_URL;
const mailpitUrl = process.env.MAILPIT_URL || "http://127.0.0.1:8025";

let db: ReturnType<typeof createDbClient> | undefined;
let deliveryId = "";
const recipient = "f13-03-" + randomUUID() + "@example.test";

const providerDescribe = shouldRun ? describe : describe.skip;

providerDescribe("F13-03 job endpoint delivery over SMTP", () => {
	function send(secret = process.env.JOB_SECRET ?? "") {
		return fetch(baseUrl + "/api/jobs/reminders/send", {
			method: "POST",
			headers: { authorization: "Bearer " + secret },
		});
	}

	async function readDelivery() {
		if (!db) throw new Error("Provider database was not initialized.");
		const [row] = await db
			.select({
				status: notificationDeliveries.status,
				attemptCount: notificationDeliveries.attemptCount,
				errorMessage: notificationDeliveries.errorMessage,
			})
			.from(notificationDeliveries)
			.where(eq(notificationDeliveries.id, deliveryId))
			.limit(1);
		return row;
	}

	beforeAll(async () => {
		if (!baseUrl || !testDatabaseUrl || !process.env.JOB_SECRET) {
			throw new Error(
				"F13-03 delivery integration requires the isolated database, HTTP URL, and JOB_SECRET.",
			);
		}
		db = createDbClient(testDatabaseUrl);

		const [seed] = await db
			.select({
				orgId: fiscalYears.orgId,
				policyId: reminderPolicies.id,
				ruleSetVersion: ruleSets.version,
			})
			.from(fiscalYears)
			.innerJoin(
				reminderPolicies,
				and(
					eq(reminderPolicies.isActive, true),
					eq(reminderPolicies.ruleSetId, fiscalYears.activeRuleSetId),
				),
			)
			.innerJoin(ruleSets, eq(ruleSets.id, reminderPolicies.ruleSetId))
			.where(eq(fiscalYears.year, 2026))
			.limit(1);
		if (!seed) throw new Error("F13-03 provider fixture seed is missing.");

		const [delivery] = await db
			.insert(notificationDeliveries)
			.values({
				orgId: seed.orgId,
				reminderPolicyId: seed.policyId,
				ruleSetVersion: seed.ruleSetVersion,
				entityType: "f13_03_provider_probe",
				scheduledFor: new Date(Date.now() - 60_000),
				status: "scheduled",
				idempotencyKey: "f13-03-provider-" + randomUUID(),
				payloadJson: {
					recipient,
					subject: "IKPA provider integration check",
					text: "Provider integration check.",
				},
			} as never)
			.returning({ id: notificationDeliveries.id });
		deliveryId = delivery.id;

		const due = await db
			.select({ id: notificationDeliveries.id })
			.from(notificationDeliveries)
			.where(
				and(
					eq(notificationDeliveries.status, "scheduled"),
					lte(notificationDeliveries.scheduledFor, new Date()),
				),
			)
			.limit(2);
		if (due.length !== 1 || due[0]?.id !== deliveryId) {
			throw new Error(
				"F13-03 provider fixture is not isolated from other due deliveries.",
			);
		}
	});

	afterAll(async () => {
		if (db && deliveryId) {
			await db
				.delete(notificationDeliveries)
				.where(eq(notificationDeliveries.id, deliveryId));
		}
	});

	it("rejects a scheduler call without the job secret", async () => {
		const response = await send("wrong-secret");
		expect(response.status).toBe(401);
		expect(await readDelivery()).toMatchObject({
			status: "scheduled",
			attemptCount: 0,
		});
	});

	it("sends one due delivery over SMTP and keeps replay idempotent", async () => {
		const first = await send();
		expect(first.status).toBe(200);
		const firstResult = (await first.json()) as { sent?: number; failed?: number };
		const afterFirst = await readDelivery();
		if (firstResult.sent !== 1 || firstResult.failed !== 0) {
			throw new Error(
				"Delivery did not send: status=" +
					(afterFirst?.status ?? "missing") +
					" code=" +
					(afterFirst?.errorMessage ?? "none"),
			);
		}
		expect(afterFirst).toMatchObject({ status: "sent", attemptCount: 1 });

		const query = encodeURIComponent('to:"' + recipient + '"');
		const inbox = (await fetch(
			mailpitUrl + "/api/v1/search?query=" + query,
		).then((response) => response.json())) as { messages_count?: number };
		expect(inbox.messages_count).toBe(1);

		const replay = await send();
		expect(replay.status).toBe(200);
		const replayResult = (await replay.json()) as { sent?: number; failed?: number };
		expect(replayResult).toMatchObject({ sent: 0, failed: 0 });
		expect(await readDelivery()).toMatchObject({ status: "sent", attemptCount: 1 });
	});
});

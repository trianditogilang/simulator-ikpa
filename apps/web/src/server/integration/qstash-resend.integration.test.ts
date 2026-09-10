import { createHash, createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDbClient } from "@simulator-ikpa/db";
import {
	fiscalYears,
	notificationDeliveries,
	reminderPolicies,
	ruleSets,
} from "@simulator-ikpa/db/schema";
import { and, eq, lte } from "drizzle-orm";

const shouldRun = process.env.F13_03_REAL_PROVIDER_TEST === "1";
const baseUrl = process.env.F13_03_HTTP_URL;
const testDatabaseUrl = process.env.DATABASE_URL;

let db: ReturnType<typeof createDbClient> | undefined;
let deliveryId = "";
let signingKey = "";
let endpointUrl = "";

function createQStashSignature(key: string, url: string, body: string): string {
	const encode = (value: unknown) =>
		Buffer.from(JSON.stringify(value)).toString("base64url");
	const now = Math.floor(Date.now() / 1000);
	const header = encode({ alg: "HS256", typ: "JWT" });
	const claims = encode({
		iss: "Upstash",
		sub: url,
		exp: now + 120,
		nbf: now - 1,
		body: createHash("sha256").update(body).digest("base64url"),
	});
	const input = header + "." + claims;
	return (
		input +
		"." +
		createHmac("sha256", key).update(input).digest("base64url")
	);
}

const providerDescribe = shouldRun ? describe : describe.skip;

providerDescribe("F13-03 real QStash/Resend provider integration", () => {
	async function waitForTerminalStatus() {
		if (!db) throw new Error("Provider database was not initialized.");
		for (let attempt = 0; attempt < 20; attempt++) {
			const [state] = await db
				.select({ status: notificationDeliveries.status })
				.from(notificationDeliveries)
				.where(eq(notificationDeliveries.id, deliveryId))
				.limit(1);
			if (state?.status !== "scheduled") return state?.status ?? "missing";
			await new Promise((resolvePromise) =>
				setTimeout(resolvePromise, 1000),
			);
		}
		return "scheduled";
	}

	async function dispatch(body: string) {
		if (process.env.F13_03_USE_QSTASH === "1") {
			const token = process.env.QSTASH_TOKEN;
			if (!token) throw new Error("QStash publish token is not configured.");
			const response = await fetch(
				"https://qstash.upstash.io/v2/publish/" + endpointUrl,
				{
					method: "POST",
					headers: {
						Authorization: "Bearer " + token,
						"content-type": "application/json",
					},
					body,
				},
			);
			if (!response.ok) {
				throw new Error(
					"QStash publish returned status " + response.status + ".",
				);
			}
			return null;
		}
		return fetch(endpointUrl, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"upstash-signature": createQStashSignature(
					signingKey,
					endpointUrl,
					body,
				),
			},
			body,
		});
	}

	beforeAll(async () => {
		if (!baseUrl || !testDatabaseUrl) {
			throw new Error(
				"F13-03 provider integration requires the isolated database and HTTP URL.",
			);
		}
		signingKey = process.env.QSTASH_CURRENT_SIGNING_KEY ?? "";
		if (!signingKey) {
			throw new Error("F13-03 provider integration requires QStash signing keys.");
		}
		db = createDbClient(testDatabaseUrl);
		endpointUrl = baseUrl + "/api/qstash/send";

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
					recipient: "delivered@resend.dev",
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

	it("sends one due delivery through Resend and keeps replay idempotent", async () => {
		if (!db || !endpointUrl) throw new Error("Provider fixture was not initialized.");
		const body = "{}";
		const first = await dispatch(body);
		if (first && !first.ok) {
			throw new Error(
				"Provider HTTP boundary returned status " + first.status + ".",
			);
		}
		if (process.env.F13_03_USE_QSTASH === "1") {
			await waitForTerminalStatus();
		} else {
			const firstResult = (await first?.json()) as {
				sent?: number;
				failed?: number;
			};
			if (firstResult.sent !== 1 || firstResult.failed !== 0) {
				const [state] = await db
					.select({
						status: notificationDeliveries.status,
						errorMessage: notificationDeliveries.errorMessage,
					})
					.from(notificationDeliveries)
					.where(eq(notificationDeliveries.id, deliveryId))
					.limit(1);
				throw new Error(
					"Provider delivery did not send: status=" +
						(state?.status ?? "missing") +
						" code=" +
						(state?.errorMessage ?? "none"),
				);
			}
		}
		const [sent] = await db
			.select({
				status: notificationDeliveries.status,
				attemptCount: notificationDeliveries.attemptCount,
			})
			.from(notificationDeliveries)
			.where(eq(notificationDeliveries.id, deliveryId))
			.limit(1);
		if (sent?.status !== "sent") {
			const [state] = await db
				.select({
					status: notificationDeliveries.status,
					errorMessage: notificationDeliveries.errorMessage,
				})
				.from(notificationDeliveries)
				.where(eq(notificationDeliveries.id, deliveryId))
				.limit(1);
			throw new Error(
				"Provider delivery did not send: status=" +
					(state?.status ?? "missing") +
					" code=" +
					(state?.errorMessage ?? "none"),
			);
		}
		expect(sent).toEqual({ status: "sent", attemptCount: 1 });

		const replay = await dispatch(body);
		if (replay) {
			expect(replay.ok).toBe(true);
			const replayResult = (await replay.json()) as {
				sent?: number;
				failed?: number;
			};
			expect(replayResult.sent).toBe(0);
			expect(replayResult.failed).toBe(0);
		} else {
			await new Promise((resolvePromise) =>
				setTimeout(resolvePromise, 1500),
			);
			const [replayed] = await db
				.select({
					status: notificationDeliveries.status,
					attemptCount: notificationDeliveries.attemptCount,
				})
				.from(notificationDeliveries)
				.where(eq(notificationDeliveries.id, deliveryId))
				.limit(1);
			expect(replayed).toEqual({ status: "sent", attemptCount: 1 });
		}
	});
});

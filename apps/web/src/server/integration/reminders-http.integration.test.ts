import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { toJSONAsync } from "seroval";
import { createDbClient } from "@simulator-ikpa/db";
import {
	fiscalYears,
	kppnScopes,
	notificationDeliveries,
	orgReminderConfigs,
	organizations,
	reminderPolicies,
	userAccesses,
	users,
} from "@simulator-ikpa/db/schema";
import { and, eq } from "drizzle-orm";

const baseUrl = process.env.F13_02_HTTP_URL;
const testDatabaseUrl = process.env.DATABASE_URL;
const configuredClerkUserId = process.env.F13_02_CLERK_OPERATOR_USER_ID;
const sessionToken = process.env.F13_02_CLERK_SESSION_TOKEN;
if (!baseUrl || !testDatabaseUrl || !configuredClerkUserId || !sessionToken) {
	throw new Error(
		"F13-02 reminders HTTP integration requires the isolated database and short-lived Clerk session.",
	);
}

const db = createDbClient(testDatabaseUrl);
const fixtureTag = randomUUID().replaceAll("-", "").slice(0, 12);
const peerScopeCode = `F13-02-REM-SCOPE-${fixtureTag}`;
const peerOrgCode = `F13-02-REM-ORG-${fixtureTag}`;
const peerOrgName = `F13-02 reminders peer ${fixtureTag}`;
const peerKppnName = `F13-02 reminders peer KPPN ${fixtureTag}`;
const peerRecipient = `peer-reminder-${fixtureTag}@example.invalid`;
const peerCustomMessage = `peer-reminder-message-${fixtureTag}`;
const peerDeliveryMarker = `peer-delivery-marker-${fixtureTag}`;
const peerDeliveryEntity = `peer-reminder-entity-${fixtureTag}`;
const peerDeliveryIdempotency = `f13-02-reminder-${fixtureTag}`;
const peerDeliveryError = `peer-delivery-error-${fixtureTag}`;
const attemptedPeerMessage = `attempted-peer-reminder-${fixtureTag}`;
const deniedPattern = /ditolak|wewenang|unauthorized|forbidden|tidak ditemukan|tidak valid|di luar scope|config/i;

let operatorUserId = "";
let orgId = "";
let ownOrgCode = "";
let ownOrgName = "";
let fiscalYearId = "";
let activeRuleSetId = "";
let ownConfigId = "";
let reminderPolicyId = "";
let peerScopeId = "";
let peerOrgId = "";
let peerFiscalYearId = "";
let peerConfigId = "";
let peerDeliveryId = "";

async function findServerFnId(exportName: string): Promise<string> {
	const sourcePath = "/src/server/reminders.ts";
	const response = await fetch(`${baseUrl}${sourcePath}`);
	if (!response.ok) throw new Error(`Cannot load ${sourcePath}: HTTP ${response.status}`);
	const source = await response.text();
	const start = source.indexOf(`export const ${exportName} =`);
	if (start < 0) throw new Error(`Cannot find ${exportName} in ${sourcePath}`);
	const nextExport = source.indexOf("\nexport const ", start + 1);
	const match = source
		.slice(start, nextExport < 0 ? undefined : nextExport)
		.match(/createClientRpc\("([^"]+)"\)/);
	if (!match?.[1]) throw new Error(`Cannot resolve server function metadata for ${exportName}`);
	return match[1];
}

async function callServerFn(args: {
	id: string;
	method: "GET" | "POST";
	data: unknown;
}): Promise<{ status: number; body: string }> {
	const payload = JSON.stringify(await toJSONAsync({ data: args.data }));
	const headers = new Headers({
		"x-tsr-serverFn": "true",
		accept: "application/json",
		authorization: `Bearer ${sessionToken}`,
	});
	const init: RequestInit = { method: args.method, headers };
	let url = `${baseUrl}/_serverFn/${encodeURIComponent(args.id)}`;
	if (args.method === "GET") {
		url += `?payload=${encodeURIComponent(payload)}`;
	} else {
		headers.set("content-type", "application/json");
		init.body = payload;
	}
	const response = await fetch(url, init);
	return { status: response.status, body: await response.text() };
}

function expectDenied(result: { status: number; body: string }) {
	expect(result.status).toBe(200);
	expect(deniedPattern.test(result.body)).toBe(true);
	for (const value of [
		peerOrgId,
		peerFiscalYearId,
		peerOrgCode,
		peerOrgName,
		peerConfigId,
		peerDeliveryId,
		peerRecipient,
		peerCustomMessage,
		peerDeliveryMarker,
		peerDeliveryEntity,
		peerDeliveryIdempotency,
		peerDeliveryError,
		attemptedPeerMessage,
	]) {
		expect(result.body.includes(value)).toBe(false);
	}
}

async function expectPeerUnchanged() {
	const [peerConfig] = await db
		.select({
			id: orgReminderConfigs.id,
			orgId: orgReminderConfigs.orgId,
			fiscalYearId: orgReminderConfigs.fiscalYearId,
			reminderPolicyId: orgReminderConfigs.reminderPolicyId,
			enabled: orgReminderConfigs.enabled,
			scheduleJson: orgReminderConfigs.scheduleJson,
			additionalRecipientsJson: orgReminderConfigs.additionalRecipientsJson,
			customMessage: orgReminderConfigs.customMessage,
			timezone: orgReminderConfigs.timezone,
		})
		.from(orgReminderConfigs)
		.where(eq(orgReminderConfigs.id, peerConfigId))
		.limit(1);
	expect(peerConfig).toEqual({
		id: peerConfigId,
		orgId: peerOrgId,
		fiscalYearId: peerFiscalYearId,
		reminderPolicyId,
		enabled: true,
		scheduleJson: { leadDays: [2], sendHour: 8 },
		additionalRecipientsJson: [peerRecipient],
		customMessage: peerCustomMessage,
		timezone: "Asia/Jakarta",
	});

	const [peerDelivery] = await db
		.select({
			id: notificationDeliveries.id,
			orgId: notificationDeliveries.orgId,
			reminderPolicyId: notificationDeliveries.reminderPolicyId,
			ruleSetVersion: notificationDeliveries.ruleSetVersion,
			entityType: notificationDeliveries.entityType,
			idempotencyKey: notificationDeliveries.idempotencyKey,
			payloadJson: notificationDeliveries.payloadJson,
			status: notificationDeliveries.status,
			attemptCount: notificationDeliveries.attemptCount,
			errorMessage: notificationDeliveries.errorMessage,
		})
		.from(notificationDeliveries)
		.where(eq(notificationDeliveries.id, peerDeliveryId))
		.limit(1);
	expect(peerDelivery).toEqual({
		id: peerDeliveryId,
		orgId: peerOrgId,
		reminderPolicyId,
		ruleSetVersion: "2026.1",
		entityType: peerDeliveryEntity,
		idempotencyKey: peerDeliveryIdempotency,
		payloadJson: { marker: peerDeliveryMarker, recipient: peerRecipient },
		status: "failed",
		attemptCount: 0,
		errorMessage: peerDeliveryError,
	});
}

beforeAll(async () => {
	const [operator] = await db
		.select({ id: users.id, orgId: userAccesses.orgId })
		.from(users)
		.innerJoin(userAccesses, eq(userAccesses.userId, users.id))
		.where(
			and(
				eq(userAccesses.accessType, "operator_satker"),
				eq(users.clerkUserId, configuredClerkUserId),
			),
		)
		.limit(1);
	if (!operator?.orgId) {
		throw new Error("Configured Clerk operator is not mapped to an organization.");
	}
	operatorUserId = operator.id;
	orgId = operator.orgId;

	const [ownOrg] = await db
		.select({ kodeSatker: organizations.kodeSatker, name: organizations.name })
		.from(organizations)
		.where(eq(organizations.id, orgId))
		.limit(1);
	if (!ownOrg) throw new Error("Seeded operator organization is missing.");
	ownOrgCode = ownOrg.kodeSatker;
	ownOrgName = ownOrg.name;

	const [fy] = await db
		.select({ id: fiscalYears.id, activeRuleSetId: fiscalYears.activeRuleSetId })
		.from(fiscalYears)
		.where(and(eq(fiscalYears.orgId, orgId), eq(fiscalYears.year, 2026)))
		.limit(1);
	if (!fy) throw new Error("Seeded operator fiscal year is missing.");
	fiscalYearId = fy.id;
	activeRuleSetId = fy.activeRuleSetId;

	const [ownConfig] = await db
		.select({ id: orgReminderConfigs.id, reminderPolicyId: orgReminderConfigs.reminderPolicyId })
		.from(orgReminderConfigs)
		.where(eq(orgReminderConfigs.fiscalYearId, fiscalYearId))
		.limit(1);
	if (!ownConfig) throw new Error("Seeded operator reminder config is missing.");
	ownConfigId = ownConfig.id;
	reminderPolicyId = ownConfig.reminderPolicyId;

	const [policy] = await db
		.select({ id: reminderPolicies.id })
		.from(reminderPolicies)
		.where(and(eq(reminderPolicies.id, reminderPolicyId), eq(reminderPolicies.isActive, true)))
		.limit(1);
	if (!policy) throw new Error("Seeded active reminder policy is missing.");

	const [scope] = await db
		.insert(kppnScopes)
		.values({ code: peerScopeCode, name: peerKppnName })
		.returning({ id: kppnScopes.id });
	peerScopeId = scope.id;
	const [peerOrg] = await db
		.insert(organizations)
		.values({
			kppnScopeId: peerScopeId,
			kodeSatker: peerOrgCode,
			name: peerOrgName,
			kppnName: peerKppnName,
			isBlu: false,
			timezone: "Asia/Jakarta",
		})
		.returning({ id: organizations.id });
	peerOrgId = peerOrg.id;
	const [peerFy] = await db
		.insert(fiscalYears)
		.values({ orgId: peerOrgId, year: 2026, activeRuleSetId })
		.returning({ id: fiscalYears.id });
	peerFiscalYearId = peerFy.id;

	const [peerConfig] = await db
		.insert(orgReminderConfigs)
		.values({
			orgId: peerOrgId,
			fiscalYearId: peerFiscalYearId,
			reminderPolicyId: policy.id,
			enabled: true,
			scheduleJson: { leadDays: [2], sendHour: 8 },
			additionalRecipientsJson: [peerRecipient],
			customMessage: peerCustomMessage,
			timezone: "Asia/Jakarta",
			updatedBy: operatorUserId,
		})
		.returning({ id: orgReminderConfigs.id });
	peerConfigId = peerConfig.id;
	const [peerDelivery] = await db
		.insert(notificationDeliveries)
		.values({
			orgId: peerOrgId,
			reminderPolicyId: policy.id,
			ruleSetVersion: "2026.1",
			entityType: peerDeliveryEntity,
			scheduledFor: new Date("2026-09-01T08:00:00.000Z"),
			status: "failed",
			attemptCount: 0,
			idempotencyKey: peerDeliveryIdempotency,
			payloadJson: { marker: peerDeliveryMarker, recipient: peerRecipient },
			errorMessage: peerDeliveryError,
		})
		.returning({ id: notificationDeliveries.id });
	peerDeliveryId = peerDelivery.id;
});

afterAll(async () => {
	if (peerDeliveryId) await db.delete(notificationDeliveries).where(eq(notificationDeliveries.id, peerDeliveryId));
	if (peerConfigId) await db.delete(orgReminderConfigs).where(eq(orgReminderConfigs.id, peerConfigId));
	if (peerFiscalYearId) await db.delete(fiscalYears).where(eq(fiscalYears.id, peerFiscalYearId));
	if (peerOrgId) await db.delete(organizations).where(eq(organizations.id, peerOrgId));
	if (peerScopeId) await db.delete(kppnScopes).where(eq(kppnScopes.id, peerScopeId));
});

describe("F13-02 reminders authenticated HTTP boundary", () => {
	it("listOperatorRemindersFn reads own reminder data and rejects peer data without leakage", async () => {
		const id = await findServerFnId("listOperatorRemindersFn");
		const own = await callServerFn({ id, method: "GET", data: { orgId } });
		expect(own.status).toBe(200);
		expect(own.body.includes(fiscalYearId)).toBe(true);
		expect(own.body.includes(ownOrgCode)).toBe(true);
		expect(own.body.includes(ownOrgName)).toBe(true);
		expect(own.body.includes(ownConfigId)).toBe(true);
		expect(own.body.includes(peerOrgId)).toBe(false);
		expect(own.body.includes(peerOrgCode)).toBe(false);
		expect(own.body.includes(peerOrgName)).toBe(false);
		expect(own.body.includes(peerConfigId)).toBe(false);
		expect(own.body.includes(peerDeliveryId)).toBe(false);
		expect(own.body.includes(peerCustomMessage)).toBe(false);
		expect(own.body.includes(peerRecipient)).toBe(false);
		expect(own.body.includes(peerDeliveryMarker)).toBe(false);

		const peer = await callServerFn({ id, method: "GET", data: { orgId: peerOrgId } });
		expectDenied(peer);
	});

	it("updateOperatorReminderConfigFn rejects peer mutation and preserves the peer config", async () => {
		const id = await findServerFnId("updateOperatorReminderConfigFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: {
				orgId: peerOrgId,
				reminderPolicyId,
				enabled: true,
				leadDays: [1],
				additionalRecipients: [peerRecipient],
				customMessage: attemptedPeerMessage,
			},
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("resetOperatorReminderConfigFn rejects an own-org request carrying a peer config ID", async () => {
		const id = await findServerFnId("resetOperatorReminderConfigFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: { orgId, configId: peerConfigId },
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});
});

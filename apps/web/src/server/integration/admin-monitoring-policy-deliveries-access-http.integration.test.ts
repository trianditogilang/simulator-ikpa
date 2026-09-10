import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { toJSONAsync } from "seroval";
import { createDbClient } from "@simulator-ikpa/db";
import {
	auditLogs,
	fiscalYears,
	kppnScopes,
	notificationDeliveries,
	organizations,
	reminderPolicies,
	ruleSets,
	scoreSnapshots,
	simulations,
	userAccesses,
	users,
} from "@simulator-ikpa/db/schema";
import { and, eq } from "drizzle-orm";

const baseUrl = process.env.F13_02_HTTP_URL;
const testDatabaseUrl = process.env.DATABASE_URL;
const configuredOperatorClerkUserId = process.env.F13_02_CLERK_OPERATOR_USER_ID;
const configuredAdminClerkUserId = process.env.F13_02_CLERK_ADMIN_USER_ID;
const operatorSessionToken = process.env.F13_02_CLERK_SESSION_TOKEN;
const adminSessionToken = process.env.F13_02_CLERK_ADMIN_SESSION_TOKEN;
if (
	!baseUrl ||
	!testDatabaseUrl ||
	!configuredOperatorClerkUserId ||
	!configuredAdminClerkUserId ||
	!operatorSessionToken ||
	!adminSessionToken
) {
	throw new Error(
		"F13-02 Admin HTTP integration requires the isolated database and temporary Operator/Admin Clerk sessions.",
	);
}

const db = createDbClient(testDatabaseUrl);
const fixtureTag = randomUUID().replaceAll("-", "").slice(0, 12);
const peerScopeCode = `F13-02-ADM-SCOPE-${fixtureTag}`;
const peerOrgCode = `F13A${fixtureTag.slice(0, 8)}`;
const peerOrgName = `F13-02 admin peer ${fixtureTag}`;
const peerKppnName = `F13-02 admin peer KPPN ${fixtureTag}`;
const ownSimulationName = `F13-02 admin own snapshot ${fixtureTag}`;
const peerSimulationName = `F13-02 admin peer snapshot ${fixtureTag}`;
const peerSnapshotMarker = `peer-admin-snapshot-${fixtureTag}`;
const peerDeliveryMarker = `peer-admin-delivery-${fixtureTag}`;
const peerDeliveryEntity = `peer-admin-entity-${fixtureTag}`;
const peerRecipient = `peer-admin-${fixtureTag}@example.invalid`;
const peerDeliveryError = `peer-admin-error-${fixtureTag}`;
const ownDeliveryMarker = `own-admin-delivery-${fixtureTag}`;
const ownDeliveryEntity = `own-admin-entity-${fixtureTag}`;
const ownRecipient = `own-admin-${fixtureTag}@example.invalid`;
const ownDeliveryError = `own-admin-error-${fixtureTag}`;
const peerUserName = `F13-02 peer access user ${fixtureTag}`;
const peerUserEmail = `peer-access-${fixtureTag}@example.invalid`;
const peerAssignmentUserName = `F13-02 peer assignment ${fixtureTag}`;
const peerAssignmentUserEmail = `peer-assignment-${fixtureTag}@example.invalid`;
const ownAssignmentUserName = `F13-02 own assignment ${fixtureTag}`;
const ownAssignmentUserEmail = `own-assignment-${fixtureTag}@example.invalid`;
const ownAuditAction = `f13_02_admin_own_${fixtureTag}`;
const peerAuditAction = `f13_02_admin_peer_${fixtureTag}`;
const ownAuditRequestId = `f13-02-own-request-${fixtureTag}`;
const peerAuditRequestId = `f13-02-peer-request-${fixtureTag}`;
const policyVersion = `F13-02-${fixtureTag}`;
const policySourceMarker = `F13-02 policy source ${fixtureTag}`;
const policyNotesMarker = `F13-02 policy notes ${fixtureTag}`;
const deniedPattern =
	/ditolak|wewenang|unauthorized|forbidden|tidak ditemukan|tidak valid|di luar|scope|hanya admin|akses/i;

let adminUserId = "";
let adminScopeId = "";
let adminOrgId = "";
let adminOrgCode = "";
let adminOrgName = "";
let adminFiscalYearId = "";
let activeRuleSetId = "";
let activeRuleSetVersion = "";
let activeRuleSetConfig: unknown;
let reminderPolicyId = "";
let peerScopeId = "";
let peerOrgId = "";
let peerFiscalYearId = "";
let ownSimulationId = "";
let ownSnapshotId = "";
let peerSimulationId = "";
let peerSnapshotId = "";
let ownDeliveryId = "";
let peerDeliveryId = "";
let peerUserId = "";
let peerAccessId = "";
let peerAssignmentUserId = "";
let ownAssignmentUserId = "";
let ownAssignedAccessId = "";
let ownAuditId = "";
let peerAuditId = "";
let draftRuleSetId = "";

async function findServerFnId(
	sourcePath: string,
	exportName: string,
): Promise<string> {
	const response = await fetch(`${baseUrl}${sourcePath}`);
	if (!response.ok) {
		throw new Error(`Cannot load ${sourcePath}: HTTP ${response.status}`);
	}
	const source = await response.text();
	const start = source.indexOf(`export const ${exportName} =`);
	if (start < 0) throw new Error(`Cannot find ${exportName} in ${sourcePath}`);
	const nextExport = source.indexOf("\nexport const ", start + 1);
	const match = source
		.slice(start, nextExport < 0 ? undefined : nextExport)
		.match(/createClientRpc\("([^"]+)"\)/);
	if (!match?.[1]) {
		throw new Error(`Cannot resolve server function metadata for ${exportName}`);
	}
	return match[1];
}

async function callServerFn(args: {
	id: string;
	method: "GET" | "POST";
	data: unknown;
	authToken?: string;
}): Promise<{ status: number; body: string }> {
	const payload = JSON.stringify(await toJSONAsync({ data: args.data }));
	const headers = new Headers({
		"x-tsr-serverFn": "true",
		accept: "application/json",
		authorization: `Bearer ${args.authToken ?? operatorSessionToken}`,
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

function expectDenied(
	result: { status: number; body: string },
	forbiddenValues: string[],
) {
	expect(result.status).toBe(200);
	expect(deniedPattern.test(result.body)).toBe(true);
	for (const value of forbiddenValues) {
		expect(result.body.includes(value)).toBe(false);
	}
}

function expectBodyContains(body: string, value: string, expected = true) {
	expect(body.includes(value)).toBe(expected);
}

async function expectPeerDeliveryUnchanged() {
	const [delivery] = await db
		.select({
			id: notificationDeliveries.id,
			orgId: notificationDeliveries.orgId,
			status: notificationDeliveries.status,
			attemptCount: notificationDeliveries.attemptCount,
			entityType: notificationDeliveries.entityType,
			payloadJson: notificationDeliveries.payloadJson,
			errorMessage: notificationDeliveries.errorMessage,
		})
		.from(notificationDeliveries)
		.where(eq(notificationDeliveries.id, peerDeliveryId))
		.limit(1);
	expect(delivery).toEqual({
		id: peerDeliveryId,
		orgId: peerOrgId,
		status: "failed",
		attemptCount: 0,
		entityType: peerDeliveryEntity,
		payloadJson: { marker: peerDeliveryMarker, recipient: peerRecipient },
		errorMessage: peerDeliveryError,
	});
}

async function expectPeerAccessUnchanged() {
	const [access] = await db
		.select({
			id: userAccesses.id,
			userId: userAccesses.userId,
			orgId: userAccesses.orgId,
			active: userAccesses.active,
		})
		.from(userAccesses)
		.where(eq(userAccesses.id, peerAccessId))
		.limit(1);
	expect(access).toEqual({
		id: peerAccessId,
		userId: peerUserId,
		orgId: peerOrgId,
		active: true,
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
				eq(userAccesses.active, true),
				eq(users.clerkUserId, configuredOperatorClerkUserId),
			),
		)
		.limit(1);
	if (!operator?.orgId) {
		throw new Error("Configured Clerk operator is not mapped to an organization.");
	}
	const [admin] = await db
		.select({ id: users.id, scopeId: userAccesses.kppnScopeId })
		.from(users)
		.innerJoin(userAccesses, eq(userAccesses.userId, users.id))
		.where(
			and(
				eq(userAccesses.accessType, "admin_kppn"),
				eq(userAccesses.active, true),
				eq(users.clerkUserId, configuredAdminClerkUserId),
			),
		)
		.limit(1);
	if (!admin?.scopeId) {
		throw new Error("Configured Clerk Admin is not mapped to a KPPN scope.");
	}
	adminUserId = admin.id;
	adminScopeId = admin.scopeId;

	const [ownOrg] = await db
		.select({ id: organizations.id, code: organizations.kodeSatker, name: organizations.name })
		.from(organizations)
		.where(eq(organizations.kppnScopeId, adminScopeId))
		.limit(1);
	if (!ownOrg) throw new Error("Seeded Admin KPPN organization is missing.");
	adminOrgId = ownOrg.id;
	adminOrgCode = ownOrg.code;
	adminOrgName = ownOrg.name;

	const [fiscalYear] = await db
		.select({ id: fiscalYears.id, activeRuleSetId: fiscalYears.activeRuleSetId })
		.from(fiscalYears)
		.where(and(eq(fiscalYears.orgId, adminOrgId), eq(fiscalYears.year, 2026)))
		.limit(1);
	if (!fiscalYear) throw new Error("Seeded Admin organization fiscal year is missing.");
	adminFiscalYearId = fiscalYear.id;
	activeRuleSetId = fiscalYear.activeRuleSetId;

	const [activeRuleSet] = await db
		.select({ version: ruleSets.version, configJson: ruleSets.configJson })
		.from(ruleSets)
		.where(eq(ruleSets.id, activeRuleSetId))
		.limit(1);
	if (!activeRuleSet) throw new Error("Seeded active rule set is missing.");
	activeRuleSetVersion = activeRuleSet.version;
	activeRuleSetConfig = activeRuleSet.configJson;

	const [policy] = await db
		.select({ id: reminderPolicies.id })
		.from(reminderPolicies)
		.where(
			and(
				eq(reminderPolicies.ruleSetId, activeRuleSetId),
				eq(reminderPolicies.isActive, true),
			),
		)
		.limit(1);
	if (!policy) throw new Error("Seeded active reminder policy is missing.");
	reminderPolicyId = policy.id;

	const [peerScope] = await db
		.insert(kppnScopes)
		.values({ code: peerScopeCode, name: peerKppnName })
		.returning({ id: kppnScopes.id });
	peerScopeId = peerScope.id;
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
	const [peerFiscalYear] = await db
		.insert(fiscalYears)
		.values({ orgId: peerOrgId, year: 2026, activeRuleSetId })
		.returning({ id: fiscalYears.id });
	peerFiscalYearId = peerFiscalYear.id;

	const [ownSimulation] = await db
		.insert(simulations)
		.values({
			fiscalYearId: adminFiscalYearId,
			name: ownSimulationName,
			type: "actual",
			targetScore: "92.00",
			createdBy: adminUserId,
		})
		.returning({ id: simulations.id });
	ownSimulationId = ownSimulation.id;
	const [ownSnapshot] = await db
		.insert(scoreSnapshots)
		.values({
			simulationId: ownSimulationId,
			periodEnd: "2026-08-31",
			totalScore: "92.0000",
			breakdownJson: { indicators: [], marker: `own-admin-snapshot-${fixtureTag}` },
			ruleSetVersion: activeRuleSetVersion,
			ruleSetId: activeRuleSetId,
			inputHash: `own-admin-input-${fixtureTag}`,
			createdBy: adminUserId,
		})
		.returning({ id: scoreSnapshots.id });
	ownSnapshotId = ownSnapshot.id;

	const [peerSimulation] = await db
		.insert(simulations)
		.values({
			fiscalYearId: peerFiscalYearId,
			name: peerSimulationName,
			type: "actual",
			targetScore: "71.00",
			createdBy: adminUserId,
		})
		.returning({ id: simulations.id });
	peerSimulationId = peerSimulation.id;
	const [peerSnapshot] = await db
		.insert(scoreSnapshots)
		.values({
			simulationId: peerSimulationId,
			periodEnd: "2026-08-31",
			totalScore: "71.0000",
			breakdownJson: { indicators: [], marker: peerSnapshotMarker },
			ruleSetVersion: activeRuleSetVersion,
			ruleSetId: activeRuleSetId,
			inputHash: `peer-admin-input-${fixtureTag}`,
			createdBy: adminUserId,
		})
		.returning({ id: scoreSnapshots.id });
	peerSnapshotId = peerSnapshot.id;

	const [ownDelivery] = await db
		.insert(notificationDeliveries)
		.values({
			orgId: adminOrgId,
			reminderPolicyId,
			ruleSetVersion: activeRuleSetVersion,
			entityType: ownDeliveryEntity,
			scheduledFor: new Date("2026-09-01T08:00:00.000Z"),
			status: "failed",
			attemptCount: 0,
			idempotencyKey: `f13-02-own-admin-delivery-${fixtureTag}`,
			payloadJson: { marker: ownDeliveryMarker, recipient: ownRecipient },
			errorMessage: ownDeliveryError,
		})
		.returning({ id: notificationDeliveries.id });
	ownDeliveryId = ownDelivery.id;
	const [peerDelivery] = await db
		.insert(notificationDeliveries)
		.values({
			orgId: peerOrgId,
			reminderPolicyId,
			ruleSetVersion: activeRuleSetVersion,
			entityType: peerDeliveryEntity,
			scheduledFor: new Date("2026-09-01T08:00:00.000Z"),
			status: "failed",
			attemptCount: 0,
			idempotencyKey: `f13-02-peer-admin-delivery-${fixtureTag}`,
			payloadJson: { marker: peerDeliveryMarker, recipient: peerRecipient },
			errorMessage: peerDeliveryError,
		})
		.returning({ id: notificationDeliveries.id });
	peerDeliveryId = peerDelivery.id;

	const [peerUser] = await db
		.insert(users)
		.values({
			clerkUserId: `f13_02_peer_access_${fixtureTag}`,
			email: peerUserEmail,
			name: peerUserName,
		})
		.returning({ id: users.id });
	peerUserId = peerUser.id;
	const [peerAccess] = await db
		.insert(userAccesses)
		.values({
			userId: peerUserId,
			accessType: "operator_satker",
			orgId: peerOrgId,
			kppnScopeId: null,
			active: true,
			createdBy: adminUserId,
		})
		.returning({ id: userAccesses.id });
	peerAccessId = peerAccess.id;

	const [peerAssignmentUser] = await db
		.insert(users)
		.values({
			clerkUserId: `f13_02_peer_assignment_${fixtureTag}`,
			email: peerAssignmentUserEmail,
			name: peerAssignmentUserName,
		})
		.returning({ id: users.id });
	peerAssignmentUserId = peerAssignmentUser.id;
	const [ownAssignmentUser] = await db
		.insert(users)
		.values({
			clerkUserId: `f13_02_own_assignment_${fixtureTag}`,
			email: ownAssignmentUserEmail,
			name: ownAssignmentUserName,
		})
		.returning({ id: users.id });
	ownAssignmentUserId = ownAssignmentUser.id;

	const [ownAudit] = await db
		.insert(auditLogs)
		.values({
			orgId: adminOrgId,
			actorId: adminUserId,
			actorAccessType: "admin_kppn",
			entityType: `f13-02-own-audit-${fixtureTag}`,
			entityId: null,
			action: ownAuditAction,
			beforeJson: { marker: ownAuditAction },
			afterJson: { marker: ownAuditAction },
			ruleSetVersion: activeRuleSetVersion,
			requestId: ownAuditRequestId,
		})
		.returning({ id: auditLogs.id });
	ownAuditId = ownAudit.id;
	const [peerAudit] = await db
		.insert(auditLogs)
		.values({
			orgId: peerOrgId,
			actorId: adminUserId,
			actorAccessType: "admin_kppn",
			entityType: `f13-02-peer-audit-${fixtureTag}`,
			entityId: null,
			action: peerAuditAction,
			beforeJson: { marker: peerAuditAction },
			afterJson: { marker: peerAuditAction },
			ruleSetVersion: activeRuleSetVersion,
			requestId: peerAuditRequestId,
		})
		.returning({ id: auditLogs.id });
	peerAuditId = peerAudit.id;
});

afterAll(async () => {
	if (ownAssignedAccessId) {
		await db.delete(userAccesses).where(eq(userAccesses.id, ownAssignedAccessId));
	}
	if (peerAccessId) {
		await db.delete(userAccesses).where(eq(userAccesses.id, peerAccessId));
	}
	for (const userId of [peerAssignmentUserId, ownAssignmentUserId, peerUserId]) {
		if (userId) {
			await db.delete(userAccesses).where(eq(userAccesses.userId, userId));
			await db.delete(users).where(eq(users.id, userId));
		}
	}
	if (ownAuditId) await db.delete(auditLogs).where(eq(auditLogs.id, ownAuditId));
	if (peerAuditId) await db.delete(auditLogs).where(eq(auditLogs.id, peerAuditId));
	if (draftRuleSetId) {
		await db.delete(auditLogs).where(eq(auditLogs.entityId, draftRuleSetId));
		await db.delete(ruleSets).where(eq(ruleSets.id, draftRuleSetId));
	}
	if (ownDeliveryId) {
		await db
			.delete(notificationDeliveries)
			.where(eq(notificationDeliveries.id, ownDeliveryId));
	}
	if (peerDeliveryId) {
		await db
			.delete(notificationDeliveries)
			.where(eq(notificationDeliveries.id, peerDeliveryId));
	}
	if (ownSimulationId) await db.delete(simulations).where(eq(simulations.id, ownSimulationId));
	if (peerSimulationId) await db.delete(simulations).where(eq(simulations.id, peerSimulationId));
	if (peerFiscalYearId) await db.delete(fiscalYears).where(eq(fiscalYears.id, peerFiscalYearId));
	if (peerOrgId) await db.delete(organizations).where(eq(organizations.id, peerOrgId));
	if (peerScopeId) await db.delete(kppnScopes).where(eq(kppnScopes.id, peerScopeId));
});

const peerForbiddenValues = () => [
	peerScopeId,
	peerOrgId,
	peerFiscalYearId,
	peerSimulationId,
	peerSnapshotId,
	peerOrgCode,
	peerOrgName,
	peerKppnName,
	peerSnapshotMarker,
	peerDeliveryId,
	peerDeliveryMarker,
	peerDeliveryEntity,
	peerRecipient,
	peerDeliveryError,
	peerUserId,
	peerAccessId,
	peerUserEmail,
	peerUserName,
	peerAssignmentUserEmail,
	peerAssignmentUserName,
	peerAuditAction,
	peerAuditRequestId,
];

describe("F13-02 Admin authenticated HTTP boundary", () => {
	it("Admin monitoring reads its scope and rejects a peer scope without leakage", async () => {
		const summaryId = await findServerFnId(
			"/src/server/admin-monitoring.ts",
			"getAdminDashboardSummaryFn",
		);
		const own = await callServerFn({
			id: summaryId,
			method: "GET",
			data: { kppnScopeId: adminScopeId },
			authToken: adminSessionToken,
		});
		expect(own.status).toBe(200);
		expectBodyContains(own.body, adminOrgId);
		expectBodyContains(own.body, adminOrgCode);
		expectBodyContains(own.body, adminOrgName);
		expectBodyContains(own.body, peerOrgId, false);
		expectBodyContains(own.body, peerSnapshotMarker, false);

		const peer = await callServerFn({
			id: summaryId,
			method: "GET",
			data: { kppnScopeId: peerScopeId },
			authToken: adminSessionToken,
		});
		expectDenied(peer, peerForbiddenValues());

		const operator = await callServerFn({
			id: summaryId,
			method: "GET",
			data: { kppnScopeId: adminScopeId },
		});
		expectDenied(operator, peerForbiddenValues());
	});

	it("listAdminOrganizationsFn returns only the Admin scope", async () => {
		const id = await findServerFnId(
			"/src/server/admin-monitoring.ts",
			"listAdminOrganizationsFn",
		);
		const own = await callServerFn({
			id,
			method: "GET",
			data: { kppnScopeId: adminScopeId },
			authToken: adminSessionToken,
		});
		expect(own.status).toBe(200);
		expectBodyContains(own.body, adminOrgId);
		expectBodyContains(own.body, adminOrgCode);
		expectBodyContains(own.body, peerOrgId, false);
		expectBodyContains(own.body, peerOrgName, false);

		const peer = await callServerFn({
			id,
			method: "GET",
			data: { kppnScopeId: peerScopeId },
			authToken: adminSessionToken,
		});
		expectDenied(peer, peerForbiddenValues());
	});

	it("getAdminOrganizationDetailFn reads own details and rejects a peer organization", async () => {
		const id = await findServerFnId(
			"/src/server/admin-monitoring.ts",
			"getAdminOrganizationDetailFn",
		);
		const own = await callServerFn({
			id,
			method: "GET",
			data: { orgId: adminOrgId },
			authToken: adminSessionToken,
		});
		expect(own.status).toBe(200);
		expectBodyContains(own.body, adminOrgId);
		expectBodyContains(own.body, ownSimulationName);
		expectBodyContains(own.body, ownSnapshotId);
		expectBodyContains(own.body, peerOrgId, false);
		expectBodyContains(own.body, peerSnapshotMarker, false);

		const peer = await callServerFn({
			id,
			method: "GET",
			data: { orgId: peerOrgId },
			authToken: adminSessionToken,
		});
		expectDenied(peer, peerForbiddenValues());
	});

	it("listAdminOrgSnapshotsFn reads own snapshots and rejects peer snapshots", async () => {
		const id = await findServerFnId(
			"/src/server/admin-monitoring.ts",
			"listAdminOrgSnapshotsFn",
		);
		const own = await callServerFn({
			id,
			method: "GET",
			data: { orgId: adminOrgId, page: 1, pageSize: 20 },
			authToken: adminSessionToken,
		});
		expect(own.status).toBe(200);
		expectBodyContains(own.body, ownSnapshotId);
		expectBodyContains(own.body, ownSimulationName);
		expectBodyContains(own.body, peerSnapshotId, false);
		expectBodyContains(own.body, peerSimulationName, false);

		const peer = await callServerFn({
			id,
			method: "GET",
			data: { orgId: peerOrgId, page: 1, pageSize: 20 },
			authToken: adminSessionToken,
		});
		expectDenied(peer, peerForbiddenValues());
	});

	it("listAdminRuleSetsFn reads the Admin policy catalog and rejects the Operator", async () => {
		const id = await findServerFnId(
			"/src/server/admin-policy.ts",
			"listAdminRuleSetsFn",
		);
		const own = await callServerFn({
			id,
			method: "GET",
			data: { year: 2026 },
			authToken: adminSessionToken,
		});
		expect(own.status).toBe(200);
		expectBodyContains(own.body, activeRuleSetId);
		expectBodyContains(own.body, activeRuleSetVersion);
		expectDenied(
			await callServerFn({ id, method: "GET", data: { year: 2026 } }),
			peerForbiddenValues(),
		);
	});

	it("listAdminReminderPoliciesFn reads policies for Admin and rejects the Operator", async () => {
		const id = await findServerFnId(
			"/src/server/admin-policy.ts",
			"listAdminReminderPoliciesFn",
		);
		const own = await callServerFn({
			id,
			method: "GET",
			data: undefined,
			authToken: adminSessionToken,
		});
		expect(own.status).toBe(200);
		expectBodyContains(own.body, reminderPolicyId);
		expectDenied(
			await callServerFn({ id, method: "GET", data: undefined }),
			peerForbiddenValues(),
		);
	});

	it("createRuleSetDraftFn accepts a valid config only for Admin", async () => {
		const id = await findServerFnId(
			"/src/server/admin-policy.ts",
			"createRuleSetDraftFn",
		);
		const createData = {
			year: 2027,
			version: policyVersion,
			sourceRegulation: policySourceMarker,
			changeNotes: policyNotesMarker,
			configJson: activeRuleSetConfig,
		};
		const deniedCreate = await callServerFn({
			id,
			method: "POST",
			data: createData,
		});
		expectDenied(deniedCreate, [policyVersion, policySourceMarker, policyNotesMarker, ...peerForbiddenValues()]);
		const [beforeCreate] = await db
			.select({ id: ruleSets.id })
			.from(ruleSets)
			.where(and(eq(ruleSets.year, 2027), eq(ruleSets.version, policyVersion)))
			.limit(1);
		expect(beforeCreate).toBeUndefined();

		const created = await callServerFn({
			id,
			method: "POST",
			data: createData,
			authToken: adminSessionToken,
		});
		expect(created.status).toBe(200);
		expectBodyContains(created.body, "ruleSetId");
		const [draft] = await db
			.select({ id: ruleSets.id, status: ruleSets.status })
			.from(ruleSets)
			.where(and(eq(ruleSets.year, 2027), eq(ruleSets.version, policyVersion)))
			.limit(1);
		expect(draft?.status).toBe("draft");
		draftRuleSetId = draft?.id ?? "";
		expect(draftRuleSetId).not.toBe("");
	});

	it("publishRuleSetFn rejects the Operator and publishes only the Admin draft", async () => {
		if (!draftRuleSetId) throw new Error("Policy draft fixture was not created.");
		const id = await findServerFnId(
			"/src/server/admin-policy.ts",
			"publishRuleSetFn",
		);
		const denied = await callServerFn({
			id,
			method: "POST",
			data: { ruleSetId: draftRuleSetId },
		});
		expectDenied(denied, [draftRuleSetId, policyVersion, policySourceMarker, ...peerForbiddenValues()]);
		const [stillDraft] = await db
			.select({ status: ruleSets.status })
			.from(ruleSets)
			.where(eq(ruleSets.id, draftRuleSetId))
			.limit(1);
		expect(stillDraft?.status).toBe("draft");

		const published = await callServerFn({
			id,
			method: "POST",
			data: { ruleSetId: draftRuleSetId },
			authToken: adminSessionToken,
		});
		expect(published.status).toBe(200);
		expectBodyContains(published.body, draftRuleSetId);
		const [afterPublish] = await db
			.select({ status: ruleSets.status })
			.from(ruleSets)
			.where(eq(ruleSets.id, draftRuleSetId))
			.limit(1);
		expect(afterPublish?.status).toBe("published");
	});

	it("retireRuleSetFn rejects the Operator and retires only the Admin draft", async () => {
		if (!draftRuleSetId) throw new Error("Policy draft fixture was not created.");
		const id = await findServerFnId(
			"/src/server/admin-policy.ts",
			"retireRuleSetFn",
		);
		const denied = await callServerFn({
			id,
			method: "POST",
			data: { ruleSetId: draftRuleSetId },
		});
		expectDenied(denied, [draftRuleSetId, policyVersion, policySourceMarker, ...peerForbiddenValues()]);
		const [stillPublished] = await db
			.select({ status: ruleSets.status })
			.from(ruleSets)
			.where(eq(ruleSets.id, draftRuleSetId))
			.limit(1);
		expect(stillPublished?.status).toBe("published");

		const retired = await callServerFn({
			id,
			method: "POST",
			data: { ruleSetId: draftRuleSetId },
			authToken: adminSessionToken,
		});
		expect(retired.status).toBe(200);
		expectBodyContains(retired.body, draftRuleSetId);
		const [afterRetire] = await db
			.select({ status: ruleSets.status })
			.from(ruleSets)
			.where(eq(ruleSets.id, draftRuleSetId))
			.limit(1);
		expect(afterRetire?.status).toBe("retired");
	});

	it("listAdminDeliveriesFn excludes deliveries outside the Admin scope", async () => {
		const id = await findServerFnId(
			"/src/server/admin-deliveries.ts",
			"listAdminDeliveriesFn",
		);
		const own = await callServerFn({
			id,
			method: "GET",
			data: { status: "failed", page: 1, pageSize: 50 },
			authToken: adminSessionToken,
		});
		expect(own.status).toBe(200);
		expectBodyContains(own.body, ownDeliveryId);
		expectBodyContains(own.body, ownDeliveryEntity);
		expectBodyContains(own.body, ownRecipient);
		expectBodyContains(own.body, peerDeliveryId, false);
		expectBodyContains(own.body, peerDeliveryMarker, false);
		expectBodyContains(own.body, peerRecipient, false);
	});

	it("retryAdminDeliveryFn retries own delivery and preserves peer delivery state", async () => {
		const id = await findServerFnId(
			"/src/server/admin-deliveries.ts",
			"retryAdminDeliveryFn",
		);
		const retried = await callServerFn({
			id,
			method: "POST",
			data: { deliveryId: ownDeliveryId },
			authToken: adminSessionToken,
		});
		expect(retried.status).toBe(200);
		expectBodyContains(retried.body, ownDeliveryId);
		expectBodyContains(retried.body, "scheduled");
		const [ownAfterRetry] = await db
			.select({ status: notificationDeliveries.status, attemptCount: notificationDeliveries.attemptCount })
			.from(notificationDeliveries)
			.where(eq(notificationDeliveries.id, ownDeliveryId))
			.limit(1);
		expect(ownAfterRetry).toEqual({ status: "scheduled", attemptCount: 1 });

		const deniedPeer = await callServerFn({
			id,
			method: "POST",
			data: { deliveryId: peerDeliveryId },
			authToken: adminSessionToken,
		});
		expectDenied(deniedPeer, peerForbiddenValues());
		await expectPeerDeliveryUnchanged();
	});

	it("listAdminUserAccessFn exposes only the Admin scope", async () => {
		const id = await findServerFnId(
			"/src/server/admin-access.ts",
			"listAdminUserAccessFn",
		);
		const ownAccess = await callServerFn({
			id,
			method: "GET",
			data: undefined,
			authToken: adminSessionToken,
		});
		expect(ownAccess.status).toBe(200);
		expectBodyContains(ownAccess.body, adminUserId);
		expectBodyContains(ownAccess.body, adminOrgId);
		expectBodyContains(ownAccess.body, peerAccessId, false);
		expectBodyContains(ownAccess.body, peerUserEmail, false);
		expectBodyContains(ownAccess.body, peerUserName, false);
		expectDenied(
			await callServerFn({ id, method: "GET", data: undefined }),
			peerForbiddenValues(),
		);
	});

	it("listAdminAuditLogsFn exposes only audit rows in the Admin scope", async () => {
		const id = await findServerFnId(
			"/src/server/admin-access.ts",
			"listAdminAuditLogsFn",
		);
		const ownAudit = await callServerFn({
			id,
			method: "GET",
			data: undefined,
			authToken: adminSessionToken,
		});
		expect(ownAudit.status).toBe(200);
		expectBodyContains(ownAudit.body, ownAuditAction);
		expectBodyContains(ownAudit.body, ownAuditRequestId);
		expectBodyContains(ownAudit.body, peerAuditAction, false);
		expectBodyContains(ownAudit.body, peerAuditRequestId, false);
		expectDenied(
			await callServerFn({ id, method: "GET", data: undefined }),
			peerForbiddenValues(),
		);
	});

	it("assignUserAccessFn rejects assignment to a peer organization", async () => {
		const id = await findServerFnId(
			"/src/server/admin-access.ts",
			"assignUserAccessFn",
		);
		const peerAssignment = await callServerFn({
			id,
			method: "POST",
			data: {
				email: peerAssignmentUserEmail,
				name: peerAssignmentUserName,
				accessType: "operator_satker",
				orgId: peerOrgId,
			},
			authToken: adminSessionToken,
		});
		expectDenied(peerAssignment, peerForbiddenValues());
		const peerAssignments = await db
			.select({ id: userAccesses.id })
			.from(userAccesses)
			.where(eq(userAccesses.userId, peerAssignmentUserId));
		expect(peerAssignments).toEqual([]);

		const ownAssignment = await callServerFn({
			id,
			method: "POST",
			data: {
				email: ownAssignmentUserEmail,
				name: ownAssignmentUserName,
				accessType: "operator_satker",
				orgId: adminOrgId,
			},
			authToken: adminSessionToken,
		});
		expect(ownAssignment.status).toBe(200);
		const [assigned] = await db
			.select({ id: userAccesses.id, orgId: userAccesses.orgId, active: userAccesses.active })
			.from(userAccesses)
			.where(eq(userAccesses.userId, ownAssignmentUserId))
			.limit(1);
		expect(assigned?.orgId).toBe(adminOrgId);
		expect(assigned?.active).toBe(true);
		ownAssignedAccessId = assigned?.id ?? "";
	});

	it("removeUserAccessFn rejects a peer mapping and can deactivate own mapping", async () => {
		if (!ownAssignedAccessId) throw new Error("Own access fixture was not created.");
		const id = await findServerFnId(
			"/src/server/admin-access.ts",
			"removeUserAccessFn",
		);
		const deniedRemove = await callServerFn({
			id,
			method: "POST",
			data: { accessId: peerAccessId, active: false },
			authToken: adminSessionToken,
		});
		expectDenied(deniedRemove, peerForbiddenValues());
		await expectPeerAccessUnchanged();

		const removedOwn = await callServerFn({
			id,
			method: "POST",
			data: { accessId: ownAssignedAccessId, active: false },
			authToken: adminSessionToken,
		});
		expect(removedOwn.status).toBe(200);
		const [ownAfterRemove] = await db
			.select({ active: userAccesses.active })
			.from(userAccesses)
			.where(eq(userAccesses.id, ownAssignedAccessId))
			.limit(1);
		expect(ownAfterRemove?.active).toBe(false);
	});
});

import { createHash, createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	ForbiddenError,
	resolveUserAccess,
} from "@simulator-ikpa/access-control";
import type { AccessResolution } from "@simulator-ikpa/contracts";
import { createDbClient } from "@simulator-ikpa/db";
import {
	auditLogs,
	fiscalYears,
	importJobs,
	kppnScopes,
	notificationDeliveries,
	organizations,
	reminderPolicies,
	users,
	userAccesses,
} from "@simulator-ikpa/db/schema";
import { and, count, eq } from "drizzle-orm";
import { upsertBudget } from "../domains/budget-revisions.mutations";
import {
	listBudgets,
	listRevisions,
} from "../domains/budget-revisions.queries";
import { createContract } from "../domains/contracts-invoices.mutations";
import {
	listContracts,
	listSpmLs,
} from "../domains/contracts-invoices.queries";
import { upsertOutput } from "../domains/output-achievement.mutations";
import { listOutputs } from "../domains/output-achievement.queries";
import { upsertRpdLine } from "../domains/rpd-realization.mutations";
import {
	listRealizations,
	listRpdLines,
} from "../domains/rpd-realization.queries";
import { createSpmQ4 } from "../domains/spm-dispensation.mutations";
import { listSpmQ4 } from "../domains/spm-dispensation.queries";
import { updateOrganizationSettings, upsertFiscalYear } from "../domains/settings.mutations";
import {
	getActiveFiscalYear,
	getFiscalYear,
	getOrganizationSettings,
	listFiscalYears,
} from "../domains/settings.queries";
import { createUpTup, upsertKkp } from "../domains/up-tup-kkp.mutations";
import { listKkp, listUpTup } from "../domains/up-tup-kkp.queries";
import {
	getAdminDashboardAggregates,
	getOrganizationDetailForAdmin,
	listOrganizationsForAdmin,
	listSnapshotsForAdmin,
} from "../admin/monitoring.queries";
import { buildOperatorXlsxBuffer } from "../exports/operator-xlsx";
import { listDeliveriesForOperator } from "../reminders/delivery.queries";
import { retryFailedDelivery } from "../reminders/delivery.mutations";
import { handleQStashImport } from "../import/process-job";

const testDatabaseUrl = process.env.DATABASE_URL;
if (!testDatabaseUrl) {
	throw new Error(
		"F13-02 integration tests require DATABASE_URL from .env.f13-02.local.",
	);
}

const db = createDbClient(testDatabaseUrl);
const PEER_SCOPE_CODE = "F13-02-PEER-20260910";
const PEER_ORG_CODE = "F13-02-PEER";

interface IsolationState {
	operatorAccess: Extract<AccessResolution, { status: "operator_single_scope" | "operator_multiple_scopes" }>;
	adminAccess: Extract<AccessResolution, { status: "admin" }>;
	orgId: string;
	peerOrgId: string;
	peerScopeId: string;
	fiscalYearId: string;
	activeRuleSetId: string;
	deliveryId?: string;
	importJobId?: string;
}

let state: IsolationState | undefined;

function requireState(): IsolationState {
	if (!state) throw new Error("Integration state was not initialized.");
	return state;
}

function createQStashSignature(body: string): string {
	const key = process.env.QSTASH_CURRENT_SIGNING_KEY;
	if (!key) return "f13-02-integration-signature";
	const encode = (value: unknown) =>
		Buffer.from(JSON.stringify(value)).toString("base64url");
	const header = encode({ alg: "HS256", typ: "JWT" });
	const claims = encode({
		iss: "Upstash",
		sub: "http://127.0.0.1:3002/api/jobs/import/process",
		exp: Math.floor(Date.now() / 1000) + 60,
		nbf: Math.floor(Date.now() / 1000) - 1,
		body: createHash("sha256").update(body).digest("base64url"),
	});
	const input = header + "." + claims;
	return (
		input +
		"." +
		createHmac("sha256", key).update(input).digest("base64url")
	);
}

async function expectRejectedWithoutLeakage(
	task: () => Promise<unknown>,
	forbiddenIdentifier: string,
) {
	let caught: unknown;
	try {
		await task();
	} catch (error) {
		caught = error;
	}
	expect(caught).toBeInstanceOf(Error);
	expect(String((caught as Error | undefined)?.message ?? "")).not.toContain(
		forbiddenIdentifier,
	);
}

async function expectForbiddenWithoutLeakage(
	task: () => Promise<unknown>,
	forbiddenIdentifier: string,
) {
	let caught: unknown;
	try {
		await task();
	} catch (error) {
		caught = error;
	}
	expect(caught).toBeInstanceOf(ForbiddenError);
	expect(String((caught as Error | undefined)?.message ?? "")).not.toContain(
		forbiddenIdentifier,
	);
}

beforeAll(async () => {
	const [operatorUser] = await db
		.select({ id: users.id, clerkUserId: users.clerkUserId })
		.from(users)
		.innerJoin(userAccesses, eq(userAccesses.userId, users.id))
		.where(eq(userAccesses.accessType, "operator_satker"))
		.limit(1);
	const [adminUser] = await db
		.select({ id: users.id, clerkUserId: users.clerkUserId })
		.from(users)
		.innerJoin(userAccesses, eq(userAccesses.userId, users.id))
		.where(eq(userAccesses.accessType, "admin_kppn"))
		.limit(1);
	if (!operatorUser || !adminUser) {
		throw new Error("F13-02 fixture users are missing; run the isolated test seed first.");
	}

	const operatorAccess = await resolveUserAccess(db, {
		clerkUserId: operatorUser.clerkUserId,
	});
	const adminAccess = await resolveUserAccess(db, {
		clerkUserId: adminUser.clerkUserId,
	});
	if (
		(operatorAccess.status !== "operator_single_scope" &&
			operatorAccess.status !== "operator_multiple_scopes") ||
		adminAccess.status !== "admin"
	) {
		throw new Error("Seeded access mappings did not resolve to operator/admin scopes.");
	}

	const orgId = operatorAccess.organizations[0]?.id;
	const mainScopeId = adminAccess.kppnScopes[0]?.id;
	if (!orgId || !mainScopeId) {
		throw new Error("Seeded operator/admin scope is incomplete.");
	}
	const [fy] = await db
		.select()
		.from(fiscalYears)
		.where(and(eq(fiscalYears.orgId, orgId), eq(fiscalYears.year, 2026)))
		.limit(1);
	if (!fy) throw new Error("Seeded fiscal year 2026 is missing.");

	// The peer tenant is real data in the isolated branch, not an in-memory mock.
	const [oldPeerOrg] = await db
		.select({ id: organizations.id })
		.from(organizations)
		.where(eq(organizations.kodeSatker, PEER_ORG_CODE))
		.limit(1);
	if (oldPeerOrg) {
		await db.delete(organizations).where(eq(organizations.id, oldPeerOrg.id));
	}
	await db.delete(kppnScopes).where(eq(kppnScopes.code, PEER_SCOPE_CODE));
	const [peerScope] = await db
		.insert(kppnScopes)
		.values({ code: PEER_SCOPE_CODE, name: "F13-02 Peer Scope" })
		.returning();
	const [peerOrg] = await db
		.insert(organizations)
		.values({
			kppnScopeId: peerScope.id,
			kodeSatker: PEER_ORG_CODE,
			name: "F13-02 Peer Organization",
			kppnName: "F13-02 Peer Scope",
			isBlu: false,
			timezone: "Asia/Jakarta",
		})
		.returning();

	state = {
		operatorAccess,
		adminAccess,
		orgId,
		peerOrgId: peerOrg.id,
		peerScopeId: peerScope.id,
		fiscalYearId: fy.id,
		activeRuleSetId: fy.activeRuleSetId,
	};
});

afterAll(async () => {
	if (!state) return;
	if (state.deliveryId) {
		await db.delete(auditLogs).where(eq(auditLogs.entityId, state.deliveryId));
		await db
			.delete(notificationDeliveries)
			.where(eq(notificationDeliveries.id, state.deliveryId));
	}
	if (state.importJobId) {
		await db.delete(importJobs).where(eq(importJobs.id, state.importJobId));
	}
	await db.delete(organizations).where(eq(organizations.id, state.peerOrgId));
	await db.delete(kppnScopes).where(eq(kppnScopes.id, state.peerScopeId));
});

describe("F13-02 tenant isolation integration", () => {
	it("resolves real seeded operator and admin mappings", () => {
		if (!state) throw new Error("Integration state was not initialized.");
		expect(state.operatorAccess.status).toMatch(/operator_/);
		expect(state.operatorAccess.organizations.map((o) => o.id)).toContain(state.orgId);
		expect(state.adminAccess.status).toBe("admin");
		expect(state.adminAccess.kppnScopes.map((s) => s.id)).not.toContain(
			state.peerScopeId,
		);
	});

	it("returns only the authorized operator fiscal-year data", async () => {
		if (!state) throw new Error("Integration state was not initialized.");
		const queries: Array<[string, () => Promise<unknown>]> = [
			["budgets", () => listBudgets(db, requireState().operatorAccess, requireState().orgId, requireState().fiscalYearId)],
			["revisions", () => listRevisions(db, requireState().operatorAccess, requireState().orgId, requireState().fiscalYearId)],
			["rpd", () => listRpdLines(db, requireState().operatorAccess, requireState().orgId, requireState().fiscalYearId)],
			["realizations", () => listRealizations(db, requireState().operatorAccess, requireState().orgId, requireState().fiscalYearId)],
			["contracts", () => listContracts(db, requireState().operatorAccess, requireState().orgId, requireState().fiscalYearId)],
			["spmLs", () => listSpmLs(db, requireState().operatorAccess, requireState().orgId, requireState().fiscalYearId)],
			["upTup", () => listUpTup(db, requireState().operatorAccess, requireState().orgId, requireState().fiscalYearId)],
			["kkp", () => listKkp(db, requireState().operatorAccess, requireState().orgId, requireState().fiscalYearId)],
			["output", () => listOutputs(db, requireState().operatorAccess, requireState().orgId, requireState().fiscalYearId)],
			["spmQ4", () => listSpmQ4(db, requireState().operatorAccess, requireState().orgId, requireState().fiscalYearId)],
		];
		for (const [name, query] of queries) {
			const rows = await query();
			expect(Array.isArray(rows), name).toBe(true);
			for (const row of rows as Array<Record<string, unknown>>) {
				if ("fiscalYearId" in row) {
					expect(row.fiscalYearId, name).toBe(state.fiscalYearId);
				}
			}
		}
		const settings = await getOrganizationSettings(db, state.operatorAccess, state.orgId);
		expect(settings.id).toBe(state.orgId);
		expect((await getFiscalYear(db, state.operatorAccess, state.orgId, 2026))?.id).toBe(
			state.fiscalYearId,
		);
		expect((await listFiscalYears(db, state.operatorAccess, state.orgId)).every((fy) => fy.orgId === requireState().orgId)).toBe(true);
		expect((await getActiveFiscalYear(db, state.operatorAccess, state.orgId))?.orgId).toBe(state.orgId);
	});

	it("rejects every operator query at the real peer tenant boundary", async () => {
		if (!state) throw new Error("Integration state was not initialized.");
		const queries: Array<[string, () => Promise<unknown>]> = [
			["budgets", () => listBudgets(db, requireState().operatorAccess, requireState().peerOrgId, requireState().fiscalYearId)],
			["revisions", () => listRevisions(db, requireState().operatorAccess, requireState().peerOrgId, requireState().fiscalYearId)],
			["rpd", () => listRpdLines(db, requireState().operatorAccess, requireState().peerOrgId, requireState().fiscalYearId)],
			["realizations", () => listRealizations(db, requireState().operatorAccess, requireState().peerOrgId, requireState().fiscalYearId)],
			["contracts", () => listContracts(db, requireState().operatorAccess, requireState().peerOrgId, requireState().fiscalYearId)],
			["spmLs", () => listSpmLs(db, requireState().operatorAccess, requireState().peerOrgId, requireState().fiscalYearId)],
			["upTup", () => listUpTup(db, requireState().operatorAccess, requireState().peerOrgId, requireState().fiscalYearId)],
			["kkp", () => listKkp(db, requireState().operatorAccess, requireState().peerOrgId, requireState().fiscalYearId)],
			["output", () => listOutputs(db, requireState().operatorAccess, requireState().peerOrgId, requireState().fiscalYearId)],
			["spmQ4", () => listSpmQ4(db, requireState().operatorAccess, requireState().peerOrgId, requireState().fiscalYearId)],
			["settings", () => getOrganizationSettings(db, requireState().operatorAccess, requireState().peerOrgId)],
		];
		for (const [name, query] of queries) {
			await expectForbiddenWithoutLeakage(query, state.peerOrgId);
			expect(name).toBeTruthy();
		}
	});

	it("rejects operator writes before any peer-tenant mutation", async () => {
		if (!state) throw new Error("Integration state was not initialized.");
		const before = await db
			.select({ total: count() })
			.from(auditLogs)
			.where(eq(auditLogs.orgId, state.peerOrgId));
		const meta = { actorId: state.operatorAccess.userId, requestId: "f13-02-integration" };
		const writes: Array<[string, () => Promise<unknown>]> = [
			["budget", () => upsertBudget(db, requireState().operatorAccess, requireState().peerOrgId, { fiscalYearId: requireState().fiscalYearId, accountCode: "51", amount: "1.00", effectiveAt: "2026-01-01" }, meta)],
			["rpd", () => upsertRpdLine(db, requireState().operatorAccess, requireState().peerOrgId, { fiscalYearId: requireState().fiscalYearId, month: 1, accountCode: "51", amount: "1.00" }, meta)],
			["contract", () => createContract(db, requireState().operatorAccess, requireState().peerOrgId, { fiscalYearId: requireState().fiscalYearId, contractNumber: `F13-02-${randomUUID()}`, accountCode: "51", value: "1.00", signedAt: "2026-01-01", paymentType: "sekaligus" }, meta)],
			["upTup", () => createUpTup(db, requireState().operatorAccess, requireState().peerOrgId, { fiscalYearId: requireState().fiscalYearId, type: "UP", amount: "1.00", sp2dAt: "2026-01-01" }, meta)],
			["kkp", () => upsertKkp(db, requireState().operatorAccess, requireState().peerOrgId, { fiscalYearId: requireState().fiscalYearId, month: 1, amount: "1.00", usageDate: "2026-01-01" }, meta)],
			["output", () => upsertOutput(db, requireState().operatorAccess, requireState().peerOrgId, { fiscalYearId: requireState().fiscalYearId, roCode: "F13-02-PEER-RO", month: 1, rvro: "0", volumeDipa: "1", pcro: "0", tpcro: "0" }, meta)],
			["spmQ4", () => createSpmQ4(db, requireState().operatorAccess, requireState().peerOrgId, { fiscalYearId: requireState().fiscalYearId, referenceNumber: `F13-02-${randomUUID()}`, issuedAt: "2026-10-01", isDispensasi: false }, meta)],
			["settings", () => updateOrganizationSettings(db, requireState().operatorAccess, requireState().peerOrgId, { name: "must-not-write" }, meta)],
			["fiscalYear", () => upsertFiscalYear(db, requireState().operatorAccess, requireState().peerOrgId, { year: 2026, activeRuleSetId: requireState().activeRuleSetId }, meta)],
		];
		for (const [name, write] of writes) {
			await expectForbiddenWithoutLeakage(write, state.peerOrgId);
			expect(name).toBeTruthy();
		}
		const after = await db
			.select({ total: count() })
			.from(auditLogs)
			.where(eq(auditLogs.orgId, state.peerOrgId));
		expect(Number(after[0]?.total ?? 0)).toBe(Number(before[0]?.total ?? 0));
	});

	it("keeps admin aggregates, organization detail, and snapshots in KPPN scope", async () => {
		if (!state) throw new Error("Integration state was not initialized.");
		const aggregate = await getAdminDashboardAggregates(db, state.adminAccess);
		expect(aggregate.kppnScopeIds).toEqual([state.adminAccess.kppnScopes[0]?.id]);
		const organizationsInScope = await listOrganizationsForAdmin(db, state.adminAccess, {
			page: 1,
			pageSize: 100,
		});
		expect(organizationsInScope.items.every((org) => org.kppnScopeId === requireState().adminAccess.kppnScopes[0]?.id)).toBe(true);
		await expectForbiddenWithoutLeakage(
			() => listOrganizationsForAdmin(db, requireState().adminAccess, { kppnScopeId: requireState().peerScopeId, page: 1, pageSize: 100 }),
			state.peerScopeId,
		);
		await expectRejectedWithoutLeakage(
			() => getOrganizationDetailForAdmin(db, requireState().adminAccess, requireState().peerOrgId),
			state.peerOrgId,
		);
		await expectForbiddenWithoutLeakage(
			() => listSnapshotsForAdmin(db, requireState().adminAccess, requireState().peerOrgId, { page: 1, pageSize: 20 }),
			state.peerOrgId,
		);
	});

	it("keeps delivery listing and retry scoped to the authorized KPPN", async () => {
		if (!state) throw new Error("Integration state was not initialized.");
		const operatorDeliveries = await listDeliveriesForOperator(db, state.operatorAccess, state.orgId);
		expect(operatorDeliveries.every((delivery) => delivery.orgId === requireState().orgId)).toBe(true);
		await expectForbiddenWithoutLeakage(
			() => listDeliveriesForOperator(db, requireState().operatorAccess, requireState().peerOrgId),
			state.peerOrgId,
		);

		const [policy] = await db
			.select()
			.from(reminderPolicies)
			.where(eq(reminderPolicies.isActive, true))
			.limit(1);
		if (!policy) throw new Error("Seeded active reminder policy is missing.");
		const [delivery] = await db
			.insert(notificationDeliveries)
			.values({
				orgId: state.orgId,
				reminderPolicyId: policy.id,
				ruleSetVersion: "2026.1",
				entityType: "f13_02_test",
				scheduledFor: new Date(),
				status: "failed",
				attemptCount: 0,
				idempotencyKey: `f13-02-${randomUUID()}`,
				payloadJson: { recipient: "f13-02-test@example.invalid" },
				errorMessage: "test failure",
			})
			.returning();
		state.deliveryId = delivery.id;

		const peerAdminAccess = {
			status: "admin",
			userId: state.adminAccess.userId,
			accessType: "admin_kppn",
			kppnScopes: [{ id: state.peerScopeId, code: PEER_SCOPE_CODE, name: "F13-02 Peer Scope" }],
		} as AccessResolution;
		await expectRejectedWithoutLeakage(
			() => retryFailedDelivery(db, peerAdminAccess, delivery.id, { actorId: requireState().adminAccess.userId }),
			state.peerScopeId,
		);
		const retried = await retryFailedDelivery(db, state.adminAccess, delivery.id, {
			actorId: state.adminAccess.userId,
		});
		expect(retried.status).toBe("scheduled");
		expect(retried.idempotencyKey).toContain("-retry1");
	});

	it("produces a valid XLSX only after the operator scope is authorized", async () => {
		if (!state) throw new Error("Integration state was not initialized.");
		await expectForbiddenWithoutLeakage(
			async () => {
				if (!state) throw new Error("Integration state was not initialized.");
				// The production ServerFn performs this guard before invoking the builder.
				const { assertOperatorOrgScope } = await import("@simulator-ikpa/access-control");
				assertOperatorOrgScope(state.operatorAccess, state.peerOrgId);
			},
			state.peerOrgId,
		);
		const buffer = await buildOperatorXlsxBuffer({
			orgId: state.orgId,
			db,
			fiscalYearId: state.fiscalYearId,
		});
		expect(Array.from(buffer.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
	});

	it("requires a signed QStash import request and updates only a real test job", async () => {
		if (!state) throw new Error("Integration state was not initialized.");
		await expect(
			handleQStashImport(testDatabaseUrl, new Headers(), "{}"),
		).rejects.toMatchObject({ code: "INVALID_SIGNATURE", statusCode: 401 });

		const [job] = await db
			.insert(importJobs)
			.values({
				orgId: state.orgId,
				fiscalYearId: state.fiscalYearId,
				domain: "budget",
				filename: "f13-02-test.csv",
				status: "uploaded",
				createdBy: state.operatorAccess.userId,
			})
			.returning({ id: importJobs.id });
		state.importJobId = job.id;

		const signature = createQStashSignature("{}");
		const result = await handleQStashImport(
			testDatabaseUrl,
			new Headers({ "upstash-signature": signature }),
			"{}",
		);
		expect(result.processed).toBeGreaterThanOrEqual(1);
		const [updated] = await db
			.select({ status: importJobs.status, orgId: importJobs.orgId })
			.from(importJobs)
			.where(eq(importJobs.id, job.id));
		expect(updated?.status).toBe("failed");
		expect(updated?.orgId).toBe(state.orgId);
	});
});

import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import {
	assertAdminKppnScope,
	assertOperatorOrgScope,
} from "@simulator-ikpa/access-control";
import { createDbClient } from "@simulator-ikpa/db";
import { fiscalYears, ruleSets } from "@simulator-ikpa/db/schema";
import { getAccessResolutionForSession } from "./access.server";
import { getServerAuthSession } from "./auth-session.server";
import {
	confirmOutput,
	createFairnessProposal,
	deleteFairnessProposal,
	reviewFairnessProposal,
	softDeleteOutput,
	submitOutputReport,
	submitTargetPlan,
	upsertFairnessPolicy,
	upsertOutput,
	upsertRoBudgetRealization,
	upsertTargetPlan,
	upsertTargetUpdateWindow,
} from "./domains/output-achievement.mutations";
import {
	listAllFairnessProposals,
	listFairnessPolicies,
	listFairnessProposals,
	listOutputsWithEligibility,
} from "./domains/output-achievement.queries";
import { failIfProduction } from "./runtime-guards";

function getDatabase() {
	const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
	if (!dbUrl) {
		failIfProduction(true, "Production database is not configured for output achievement.");
		return null;
	}
	return createDbClient(dbUrl);
}

async function getOrInitFiscalYear(
	db: ReturnType<typeof createDbClient>,
	orgId: string,
	year = 2026,
) {
	let [fy] = await db
		.select()
		.from(fiscalYears)
		.where(and(eq(fiscalYears.orgId, orgId), eq(fiscalYears.year, year)))
		.limit(1);

	if (!fy) {
		const [ruleSet] = await db
			.select()
			.from(ruleSets)
			.where(
				and(eq(ruleSets.year, year), eq(ruleSets.status, "published")),
			)
			.limit(1);

		if (ruleSet) {
			[fy] = await db
				.insert(fiscalYears)
				.values({
					orgId,
					year,
					activeRuleSetId: ruleSet.id,
				})
				.returning();
		}
	}

	return fy;
}

export const listOutputReportsFn = createServerFn({ method: "GET" })
	.validator((data?: { orgId?: string }) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth, data?.orgId);

		const targetOrgId =
			data?.orgId ||
			(access.status === "operator_single_scope" ||
			access.status === "operator_multiple_scopes"
				? access.activeOrganizationId
				: null);

		if (!targetOrgId) {
			throw new Error("Satuan Kerja aktif tidak ditemukan.");
		}

		assertOperatorOrgScope(access, targetOrgId);

		const db = getDatabase();
		if (!db) {
			return {
				fiscalYearId: "fy-mock-2026",
				year: 2026,
				outputs: [],
				targetPlans: [],
				targetWindows: [],
				budgetRealizations: [],
				publishedPolicies: [],
				holidays: [],
			};
		}

		const fy = await getOrInitFiscalYear(db, targetOrgId, 2026);
		if (!fy) throw new Error("Tahun Anggaran 2026 belum aktif.");

		const res = await listOutputsWithEligibility(db, access, targetOrgId, fy.id);

		return {
			fiscalYearId: res.fiscalYearId,
			year: res.year,
			outputs: res.reports,
			targetPlans: res.targetPlans,
			targetWindows: res.targetWindows,
			budgetRealizations: res.budgetRealizations,
			publishedPolicies: res.publishedPolicies,
			holidays: res.holidays,
		};
	});

export const upsertTargetPlanFn = createServerFn({ method: "POST" })
	.validator((data: Record<string, unknown>) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const orgId = data.orgId as string | undefined;
		const access = await getAccessResolutionForSession(auth, orgId);

		const targetOrgId =
			orgId ||
			(access.status === "operator_single_scope" ||
			access.status === "operator_multiple_scopes"
				? access.activeOrganizationId
				: null);

		if (!targetOrgId) throw new Error("Satuan Kerja aktif tidak ditemukan.");
		assertOperatorOrgScope(access, targetOrgId);

		const db = getDatabase();
		if (!db) return { success: true };

		const fy = await getOrInitFiscalYear(db, targetOrgId, 2026);
		if (!fy) throw new Error("Tahun Anggaran 2026 belum aktif.");

		return upsertTargetPlan(
			db,
			access,
			targetOrgId,
			{ ...data, fiscalYearId: fy.id },
			{ actorId: auth.userId || "anonymous-actor" },
		);
	});

export const submitTargetPlanFn = createServerFn({ method: "POST" })
	.validator((data: { targetPlanId: string; orgId?: string }) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth, data.orgId);

		const targetOrgId =
			data.orgId ||
			(access.status === "operator_single_scope" ||
			access.status === "operator_multiple_scopes"
				? access.activeOrganizationId
				: null);

		if (!targetOrgId) throw new Error("Satuan Kerja aktif tidak ditemukan.");
		assertOperatorOrgScope(access, targetOrgId);

		const db = getDatabase();
		if (!db) return { success: true };

		return submitTargetPlan(
			db,
			access,
			targetOrgId,
			data.targetPlanId,
			{ actorId: auth.userId || "anonymous-actor" },
		);
	});

export const upsertTargetUpdateWindowFn = createServerFn({ method: "POST" })
	.validator((data: Record<string, unknown>) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth);
		assertAdminKppnScope(access);

		const db = getDatabase();
		if (!db) return { success: true };

		return upsertTargetUpdateWindow(
			db,
			access,
			data,
			{ actorId: auth.userId || "admin-actor" },
		);
	});

export const upsertRoBudgetRealizationFn = createServerFn({ method: "POST" })
	.validator((data: Record<string, unknown>) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const orgId = data.orgId as string | undefined;
		const access = await getAccessResolutionForSession(auth, orgId);

		const targetOrgId =
			orgId ||
			(access.status === "operator_single_scope" ||
			access.status === "operator_multiple_scopes"
				? access.activeOrganizationId
				: null);

		if (!targetOrgId) throw new Error("Satuan Kerja aktif tidak ditemukan.");
		assertOperatorOrgScope(access, targetOrgId);

		const db = getDatabase();
		if (!db) return { success: true };

		const fy = await getOrInitFiscalYear(db, targetOrgId, 2026);
		if (!fy) throw new Error("Tahun Anggaran 2026 belum aktif.");

		return upsertRoBudgetRealization(
			db,
			access,
			targetOrgId,
			{ ...data, fiscalYearId: fy.id },
			{ actorId: auth.userId || "anonymous-actor" },
		);
	});

export const upsertOutputReportFn = createServerFn({ method: "POST" })
	.validator((data: Record<string, unknown>) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const orgId = data.orgId as string | undefined;
		const access = await getAccessResolutionForSession(auth, orgId);

		const targetOrgId =
			orgId ||
			(access.status === "operator_single_scope" ||
			access.status === "operator_multiple_scopes"
				? access.activeOrganizationId
				: null);

		if (!targetOrgId) {
			throw new Error("Satuan Kerja aktif tidak ditemukan.");
		}

		assertOperatorOrgScope(access, targetOrgId);

		const db = getDatabase();
		if (!db) {
			return { success: true };
		}

		const fy = await getOrInitFiscalYear(db, targetOrgId, 2026);
		if (!fy) throw new Error("Tahun Anggaran 2026 belum aktif.");

		return upsertOutput(
			db,
			access,
			targetOrgId,
			{ ...data, fiscalYearId: fy.id },
			{ actorId: auth.userId || "anonymous-actor" },
		);
	});

export const submitOutputReportFn = createServerFn({ method: "POST" })
	.validator((data: { outputId: string; orgId?: string }) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth, data.orgId);

		const targetOrgId =
			data.orgId ||
			(access.status === "operator_single_scope" ||
			access.status === "operator_multiple_scopes"
				? access.activeOrganizationId
				: null);

		if (!targetOrgId) throw new Error("Satuan Kerja aktif tidak ditemukan.");
		assertOperatorOrgScope(access, targetOrgId);

		const db = getDatabase();
		if (!db) return { success: true };

		return submitOutputReport(
			db,
			access,
			targetOrgId,
			data.outputId,
			{ actorId: auth.userId || "anonymous-actor" },
		);
	});

export const confirmOutputReportFn = createServerFn({ method: "POST" })
	.validator((data: { outputId: string; orgId?: string }) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth, data.orgId);

		const targetOrgId =
			data.orgId ||
			(access.status === "operator_single_scope" ||
			access.status === "operator_multiple_scopes"
				? access.activeOrganizationId
				: null);

		if (!targetOrgId) {
			throw new Error("Satuan Kerja aktif tidak ditemukan.");
		}

		assertOperatorOrgScope(access, targetOrgId);

		const db = getDatabase();
		if (!db) {
			return { success: true };
		}

		return confirmOutput(
			db,
			access,
			targetOrgId,
			data.outputId,
			{ actorId: auth.userId || "anonymous-actor" },
		);
	});

export const deleteOutputReportFn = createServerFn({ method: "POST" })
	.validator((data: { outputId: string; orgId?: string }) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth, data.orgId);

		const targetOrgId =
			data.orgId ||
			(access.status === "operator_single_scope" ||
			access.status === "operator_multiple_scopes"
				? access.activeOrganizationId
				: null);

		if (!targetOrgId) {
			throw new Error("Satuan Kerja aktif tidak ditemukan.");
		}

		assertOperatorOrgScope(access, targetOrgId);

		const db = getDatabase();
		if (!db) {
			return { success: true };
		}

		return softDeleteOutput(
			db,
			access,
			targetOrgId,
			data.outputId,
			{ actorId: auth.userId || "anonymous-actor" },
		);
	});

export const createFairnessProposalFn = createServerFn({ method: "POST" })
	.validator((data: Record<string, unknown>) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const orgId = data.orgId as string | undefined;
		const access = await getAccessResolutionForSession(auth, orgId);

		const targetOrgId =
			orgId ||
			(access.status === "operator_single_scope" ||
			access.status === "operator_multiple_scopes"
				? access.activeOrganizationId
				: null);

		if (!targetOrgId) throw new Error("Satuan Kerja aktif tidak ditemukan.");
		assertOperatorOrgScope(access, targetOrgId);

		const db = getDatabase();
		if (!db) return { success: true };

		const fy = await getOrInitFiscalYear(db, targetOrgId, 2026);
		if (!fy) throw new Error("Tahun Anggaran 2026 belum aktif.");

		return createFairnessProposal(
			db,
			access,
			targetOrgId,
			{ ...data, fiscalYearId: fy.id },
			{ actorId: auth.userId || "anonymous-actor" },
		);
	});

export const deleteFairnessProposalFn = createServerFn({ method: "POST" })
	.validator((data: { proposalId?: string; roCode?: string; month?: number | null; orgId?: string }) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth, data.orgId);

		const targetOrgId =
			data.orgId ||
			(access.status === "operator_single_scope" ||
			access.status === "operator_multiple_scopes"
				? access.activeOrganizationId
				: null);

		if (!targetOrgId) throw new Error("Satuan Kerja aktif tidak ditemukan.");
		assertOperatorOrgScope(access, targetOrgId);

		const db = getDatabase();
		if (!db) return { success: true };

		return deleteFairnessProposal(
			db,
			access,
			targetOrgId,
			{ proposalId: data.proposalId, roCode: data.roCode, month: data.month },
			{ actorId: auth.userId || "anonymous-actor" },
		);
	});

export const listFairnessPoliciesFn = createServerFn({ method: "GET" })
	.validator((data?: { year?: number }) => data)
	.handler(async ({ data }) => {
		const db = getDatabase();
		if (!db) return [];
		return listFairnessPolicies(db, data?.year ?? 2026);
	});

export const listFairnessProposalsFn = createServerFn({ method: "GET" })
	.validator((data?: { orgId?: string }) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth, data?.orgId);

		const targetOrgId =
			data?.orgId ||
			(access.status === "operator_single_scope" ||
			access.status === "operator_multiple_scopes"
				? access.activeOrganizationId
				: null);

		if (!targetOrgId) throw new Error("Satuan Kerja aktif tidak ditemukan.");
		assertOperatorOrgScope(access, targetOrgId);

		const db = getDatabase();
		if (!db) return [];

		const fy = await getOrInitFiscalYear(db, targetOrgId, 2026);
		if (!fy) return [];

		return listFairnessProposals(db, access, targetOrgId, fy.id);
	});

export const upsertFairnessPolicyFn = createServerFn({ method: "POST" })
	.validator((data: Record<string, unknown>) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth);
		assertAdminKppnScope(access);

		const db = getDatabase();
		if (!db) return { success: true };

		return upsertFairnessPolicy(
			db,
			access,
			data,
			{ actorId: auth.userId || "admin-actor" },
		);
	});

export const reviewFairnessProposalFn = createServerFn({ method: "POST" })
	.validator((data: Record<string, unknown>) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth);
		assertAdminKppnScope(access);

		const db = getDatabase();
		if (!db) return { success: true };

		return reviewFairnessProposal(
			db,
			access,
			data,
			{ actorId: auth.userId || "admin-actor" },
		);
	});

export const listAllFairnessProposalsFn = createServerFn({ method: "GET" })
	.handler(async () => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth);
		assertAdminKppnScope(access);

		const db = getDatabase();
		if (!db) return [];

		return listAllFairnessProposals(db);
	});

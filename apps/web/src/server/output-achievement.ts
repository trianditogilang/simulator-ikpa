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
	upsertFairnessPolicy,
	upsertOutput,
} from "./domains/output-achievement.mutations";
import {
	listAllFairnessProposals,
	listFairnessPolicies,
	listFairnessProposals,
	listOutputsWithEligibility,
} from "./domains/output-achievement.queries";

function getDatabase() {
	const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
	if (!dbUrl) {
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
				publishedPolicies: [],
				holidays: [],
			};
		}

		const fy = await getOrInitFiscalYear(db, targetOrgId, 2026);
		if (!fy) {
			throw new Error("Tahun anggaran 2026 tidak ditemukan.");
		}

		const result = await listOutputsWithEligibility(
			db,
			access,
			targetOrgId,
			fy.id,
		);

		return {
			fiscalYearId: fy.id,
			year: fy.year,
			outputs: result.reports,
			publishedPolicies: result.publishedPolicies,
			proposals: result.proposals,
			holidays: result.holidays,
		};
	});

export const upsertOutputReportFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			orgId?: string;
			roCode: string;
			roName?: string | null;
			month: number;
			rvro: string;
			volumeDipa: string;
			pcro: string;
			tpcro: string;
			reportedAt?: string | null;
			confirmed?: boolean;
		}) => data,
	)
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

		const fy = await getOrInitFiscalYear(db, targetOrgId, 2026);
		if (!fy) {
			throw new Error("Tahun anggaran 2026 tidak ditemukan.");
		}

		const result = await upsertOutput(
			db,
			access,
			targetOrgId,
			{
				fiscalYearId: fy.id,
				roCode: data.roCode,
				roName: data.roName,
				month: data.month,
				rvro: data.rvro,
				volumeDipa: data.volumeDipa,
				pcro: data.pcro,
				tpcro: data.tpcro,
				reportedAt: data.reportedAt,
				confirmed: data.confirmed,
			},
			{
				actorId:
					access.status === "operator_single_scope" ||
					access.status === "operator_multiple_scopes"
						? access.userId
						: targetOrgId,
			},
		);

		return { success: true, output: result };
	});

export const confirmOutputReportFn = createServerFn({ method: "POST" })
	.validator((data: { orgId?: string; outputId: string }) => data)
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

		const result = await confirmOutput(
			db,
			access,
			targetOrgId,
			data.outputId,
			{
				actorId:
					access.status === "operator_single_scope" ||
					access.status === "operator_multiple_scopes"
						? access.userId
						: targetOrgId,
			},
		);

		return { success: true, confirmed: result };
	});

export const deleteOutputReportFn = createServerFn({ method: "POST" })
	.validator((data: { orgId?: string; outputId: string }) => data)
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

		const result = await softDeleteOutput(
			db,
			access,
			targetOrgId,
			data.outputId,
			{
				actorId:
					access.status === "operator_single_scope" ||
					access.status === "operator_multiple_scopes"
						? access.userId
						: targetOrgId,
			},
		);

		return { success: true, deleted: result };
	});

export const createFairnessProposalFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			orgId?: string;
			roCode: string;
			month?: number | null;
			category?: string;
			basisReference: string;
			operatorNote?: string | null;
			attachmentRef?: string | null;
		}) => data,
	)
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

		const fy = await getOrInitFiscalYear(db, targetOrgId, 2026);
		if (!fy) {
			throw new Error("Tahun anggaran 2026 tidak ditemukan.");
		}

		const result = await createFairnessProposal(
			db,
			access,
			targetOrgId,
			{
				fiscalYearId: fy.id,
				roCode: data.roCode,
				month: data.month,
				category: data.category ?? "ro_khusus",
				basisReference: data.basisReference,
				operatorNote: data.operatorNote,
				attachmentRef: data.attachmentRef,
			},
			{
				actorId:
					access.status === "operator_single_scope" ||
					access.status === "operator_multiple_scopes"
						? access.userId
						: targetOrgId,
			},
		);

		return { success: true, proposal: result };
	});

export const deleteFairnessProposalFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			orgId?: string;
			proposalId?: string;
			roCode?: string;
			month?: number | null;
		}) => data,
	)
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

		const fy = await getOrInitFiscalYear(db, targetOrgId, 2026);
		if (!fy) {
			throw new Error("Tahun anggaran 2026 tidak ditemukan.");
		}

		const result = await deleteFairnessProposal(
			db,
			access,
			targetOrgId,
			{
				proposalId: data.proposalId,
				roCode: data.roCode,
				month: data.month,
				fiscalYearId: fy.id,
			},
			{
				actorId:
					access.status === "operator_single_scope" ||
					access.status === "operator_multiple_scopes"
						? access.userId
						: targetOrgId,
			},
		);

		return { success: true, deleted: result };
	});

export const listFairnessPoliciesFn = createServerFn({ method: "GET" })
	.validator((data?: { year?: number }) => data)
	.handler(async ({ data }) => {
		const db = getDatabase();
		if (!db) {
			return [];
		}
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

		if (!targetOrgId) {
			throw new Error("Satuan Kerja aktif tidak ditemukan.");
		}

		assertOperatorOrgScope(access, targetOrgId);

		const db = getDatabase();
		if (!db) {
			return [];
		}

		const fy = await getOrInitFiscalYear(db, targetOrgId, 2026);
		if (!fy) {
			return [];
		}

		return listFairnessProposals(db, access, targetOrgId, fy.id);
	});

export const upsertFairnessPolicyFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			id?: string;
			name: string;
			indicatorKey?: string;
			action?: string;
			category?: string;
			matchType: "exact" | "list" | "prefix" | "regex";
			roMatchValue: string | string[];
			scopeType?: "national" | "kppn" | "organization";
			scopeId?: string | null;
			year?: number;
			effectiveMonthStart?: number;
			effectiveMonthEnd?: number;
			basisReference: string;
			displayReason: string;
			internalNote?: string | null;
			allowOperatorProposal?: boolean;
			status?: "draft" | "published" | "retired" | "expired";
		}) => data,
	)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth);
		const adminCtx = assertAdminKppnScope(access);

		const db = getDatabase();
		if (!db) {
			return { success: true };
		}

		const result = await upsertFairnessPolicy(
			db,
			access,
			data,
			{ actorId: adminCtx.userId },
		);

		return { success: true, policy: result };
	});

export const reviewFairnessProposalFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			proposalId: string;
			status: "approved" | "rejected";
			reviewNote?: string;
			resolvedPolicyId?: string;
		}) => data,
	)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth);
		const adminCtx = assertAdminKppnScope(access);

		const db = getDatabase();
		if (!db) {
			return { success: true };
		}

		const result = await reviewFairnessProposal(
			db,
			access,
			data,
			{ actorId: adminCtx.userId },
		);

		return { success: true, proposal: result };
	});


export const listAllFairnessProposalsFn = createServerFn({ method: "GET" })
	.handler(async () => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth);
		assertAdminKppnScope(access);

		const db = getDatabase();
		if (!db) {
			return [];
		}

		return listAllFairnessProposals(db);
	});


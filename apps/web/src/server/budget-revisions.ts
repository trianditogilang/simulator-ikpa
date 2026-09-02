import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";
import { createDbClient } from "@simulator-ikpa/db";
import { fiscalYears, ruleSets } from "@simulator-ikpa/db/schema";
import { getAccessResolutionForSession } from "./access.server";
import { getServerAuthSession } from "./auth-session.server";
import {
	createRevision,
	softDeleteBudget,
	softDeleteRevision,
	upsertBudget,
} from "./domains/budget-revisions.mutations";
import {
	listBudgets,
	listRevisions,
} from "./domains/budget-revisions.queries";

const decimal18_2 = z
	.string()
	.regex(/^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/, "Format desimal tidak valid (contoh: 500000000.00)");

export const upsertBudgetInputSchema = z.strictObject({
	accountCode: z.enum(["51", "52", "53", "57"]),
	amount: decimal18_2,
	effectiveAt: z.iso.date(),
});

export const createRevisionInputSchema = z.strictObject({
	revisionDate: z.iso.date(),
	revisionCode: z.string().min(1).max(32),
	paguBefore: decimal18_2,
	paguAfter: decimal18_2,
	notes: z.string().max(500).optional(),
});

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

export const listBudgetsAndRevisionsFn = createServerFn({ method: "GET" })
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
				budgets: [
					{
						id: "b1",
						accountCode: "51",
						amount: "1500000000.00",
						effectiveAt: "2026-01-01",
					},
					{
						id: "b2",
						accountCode: "52",
						amount: "2500000000.00",
						effectiveAt: "2026-01-01",
					},
					{
						id: "b3",
						accountCode: "53",
						amount: "1500000000.00",
						effectiveAt: "2026-01-01",
					},
				],
				revisions: [
					{
						id: "r1",
						revisionDate: "2026-01-02",
						revisionCode: "DIPA-AWAL",
						paguBefore: "5500000000.00",
						paguAfter: "5500000000.00",
						notes: "DIPA Petikan Awal TA 2026",
					},
				],
			};
		}

		const fy = await getOrInitFiscalYear(db, targetOrgId, 2026);
		if (!fy) {
			throw new Error("Tahun anggaran 2026 belum diinisialisasi.");
		}

		const budgetRows = await listBudgets(db, access, targetOrgId, fy.id);
		const revisionRows = await listRevisions(db, access, targetOrgId, fy.id);

		return {
			fiscalYearId: fy.id,
			year: fy.year,
			budgets: budgetRows,
			revisions: revisionRows,
		};
	});

export const upsertBudgetFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			orgId?: string;
			accountCode: "51" | "52" | "53" | "57";
			amount: string;
			effectiveAt: string;
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

		const result = await upsertBudget(
			db,
			access,
			targetOrgId,
			{
				fiscalYearId: fy.id,
				accountCode: data.accountCode,
				amount: data.amount,
				effectiveAt: data.effectiveAt,
			},
			{
				actorId:
					access.status === "operator_single_scope" ||
					access.status === "operator_multiple_scopes"
						? access.userId
						: targetOrgId,
			},
		);

		return { success: true, budget: result };
	});

export const createRevisionFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			orgId?: string;
			revisionDate: string;
			revisionCode: string;
			paguBefore: string;
			paguAfter: string;
			notes?: string;
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

		const result = await createRevision(
			db,
			access,
			targetOrgId,
			{
				fiscalYearId: fy.id,
				revisionDate: data.revisionDate,
				revisionCode: data.revisionCode,
				paguBefore: data.paguBefore,
				paguAfter: data.paguAfter,
				notes: data.notes,
			},
			{
				actorId:
					access.status === "operator_single_scope" ||
					access.status === "operator_multiple_scopes"
						? access.userId
						: targetOrgId,
			},
		);

		return { success: true, revision: result };
	});

export const deleteRevisionFn = createServerFn({ method: "POST" })
	.validator((data: { orgId?: string; revisionId: string }) => data)
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

		const result = await softDeleteRevision(
			db,
			access,
			targetOrgId,
			data.revisionId,
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

export const deleteBudgetFn = createServerFn({ method: "POST" })
	.validator((data: { orgId?: string; budgetId: string }) => data)
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

		const result = await softDeleteBudget(
			db,
			access,
			targetOrgId,
			data.budgetId,
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

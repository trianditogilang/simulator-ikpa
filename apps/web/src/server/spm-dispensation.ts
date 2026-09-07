import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";
import { createDbClient } from "@simulator-ikpa/db";
import { fiscalYears, ruleSets } from "@simulator-ikpa/db/schema";
import {
	calculateSpmDispensation,
	default2026RuleSet,
	parseRuleSet,
} from "@simulator-ikpa/ikpa-engine";
import { getAccessResolutionForSession } from "./access.server";
import { getServerAuthSession } from "./auth-session.server";
import {
	createSpmQ4,
	softDeleteSpmQ4,
	updateSpmQ4,
} from "./domains/spm-dispensation.mutations";
import { listSpmQ4 } from "./domains/spm-dispensation.queries";

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

export const listSpmDispensationsFn = createServerFn({ method: "GET" })
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
			const fallbackCalc = calculateSpmDispensation(
				{ dispensationCount: 0, totalSpmQ4: 0 },
				default2026RuleSet,
			);
			return {
				fiscalYearId: "fy-mock-2026",
				year: 2026,
				spmQ4List: [],
				calculation: {
					ratio: fallbackCalc.ratio,
					category: fallbackCalc.category,
					deduction: fallbackCalc.deduction,
					formulaTrace: fallbackCalc.formulaTrace,
					warnings: fallbackCalc.warnings,
				},
			};
		}

		const fy = await getOrInitFiscalYear(db, targetOrgId, 2026);
		if (!fy) {
			throw new Error("Tahun anggaran tidak ditemukan.");
		}

		let ruleSetConfig = default2026RuleSet;
		if (fy.activeRuleSetId) {
			const [ruleSetRow] = await db
				.select()
				.from(ruleSets)
				.where(eq(ruleSets.id, fy.activeRuleSetId))
				.limit(1);
			if (ruleSetRow) {
				try {
					ruleSetConfig = parseRuleSet(ruleSetRow.configJson);
				} catch {
					ruleSetConfig = default2026RuleSet;
				}
			}
		}

		const rows = await listSpmQ4(db, access, targetOrgId, fy.id);

		const totalSpmQ4 = rows.length;
		const dispensationCount = rows.filter((r) => r.isDispensasi).length;

		const calc = calculateSpmDispensation(
			{ dispensationCount, totalSpmQ4 },
			ruleSetConfig,
		);

		return {
			fiscalYearId: fy.id,
			year: fy.year,
			spmQ4List: rows.map((r) => ({
				id: r.id,
				referenceNumber: r.referenceNumber,
				issuedAt: r.issuedAt as string,
				isDispensasi: Boolean(r.isDispensasi),
			})),
			calculation: {
				ratio: calc.ratio,
				category: calc.category,
				deduction: calc.deduction,
				formulaTrace: calc.formulaTrace,
				warnings: calc.warnings,
			},
		};
	});

export const createSpmDispensasiFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			orgId?: string;
			referenceNumber: string;
			issuedAt: string;
			isDispensasi?: boolean;
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
			throw new Error("Tahun anggaran tidak ditemukan.");
		}

		const result = await createSpmQ4(
			db,
			access,
			targetOrgId,
			{
				fiscalYearId: fy.id,
				referenceNumber: data.referenceNumber,
				issuedAt: data.issuedAt,
				isDispensasi: data.isDispensasi ?? false,
			},
			{
				actorId:
					access.status === "operator_single_scope" ||
					access.status === "operator_multiple_scopes"
						? access.userId
						: targetOrgId,
			},
		);

		return { success: true, spm: result };
	});

export const updateSpmDispensasiFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			orgId?: string;
			spmId: string;
			referenceNumber?: string;
			issuedAt?: string;
			isDispensasi?: boolean;
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

		const result = await updateSpmQ4(
			db,
			access,
			targetOrgId,
			data.spmId,
			{
				referenceNumber: data.referenceNumber,
				issuedAt: data.issuedAt,
				isDispensasi: data.isDispensasi,
			},
			{
				actorId:
					access.status === "operator_single_scope" ||
					access.status === "operator_multiple_scopes"
						? access.userId
						: targetOrgId,
			},
		);

		return { success: true, spm: result };
	});

export const deleteSpmDispensasiFn = createServerFn({ method: "POST" })
	.validator((data: { orgId?: string; spmId: string }) => data)
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

		const result = await softDeleteSpmQ4(
			db,
			access,
			targetOrgId,
			data.spmId,
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

import { assertAdminKppnScope } from "@simulator-ikpa/access-control";
import type { AccessResolution } from "@simulator-ikpa/contracts";
import type { DbClient } from "@simulator-ikpa/db";
import {
	fiscalYears,
	organizations,
	scoreSnapshots,
	simulations,
} from "@simulator-ikpa/db/schema";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";

export interface Pagination {
	page: number;
	pageSize: number;
}
export interface OrgListFilter {
	search?: string;
	kppnScopeId?: string;
}

export async function getAdminDashboardAggregates(
	db: DbClient,
	access: AccessResolution,
) {
	const { allowedKppnScopeIds } = assertAdminKppnScope(access);
	// total satker in scope
	const [totalOrgs] = await db
		.select({ total: count() })
		.from(organizations)
		.where(inArray(organizations.kppnScopeId, allowedKppnScopeIds));
	// total simulations/snapshots in scope (via join fiscalYears -> organizations)
	const orgs = await db
		.select({ id: organizations.id })
		.from(organizations)
		.where(inArray(organizations.kppnScopeId, allowedKppnScopeIds));
	const orgIds = orgs.map((o) => o.id);
	let snapshotCount = 0;
	let avgScore: string | null = null;
	if (orgIds.length > 0) {
		const fYs = await db
			.select({ id: fiscalYears.id })
			.from(fiscalYears)
			.where(inArray(fiscalYears.orgId, orgIds));
		const fyIds = fYs.map((f) => f.id);
		if (fyIds.length > 0) {
			const sims = await db
				.select({ id: simulations.id })
				.from(simulations)
				.where(inArray(simulations.fiscalYearId, fyIds));
			const simIds = sims.map((s) => s.id);
			if (simIds.length > 0) {
				const [sc] = await db
					.select({ total: count() })
					.from(scoreSnapshots)
					.where(inArray(scoreSnapshots.simulationId, simIds));
				snapshotCount = Number(sc?.total ?? 0);
				const avgRows = await db
					.select({
						avg: sql<string>`avg(${scoreSnapshots.totalScore}::numeric)`,
					})
					.from(scoreSnapshots)
					.where(inArray(scoreSnapshots.simulationId, simIds));
				avgScore = avgRows[0]?.avg ?? null;
			}
		}
	}
	return {
		totalOrganizations: Number(totalOrgs?.total ?? 0),
		totalSnapshots: snapshotCount,
		avgScore,
		kppnScopeIds: allowedKppnScopeIds,
	};
}

export async function listOrganizationsForAdmin(
	db: DbClient,
	access: AccessResolution,
	filter: OrgListFilter & Pagination,
) {
	const { allowedKppnScopeIds } = assertAdminKppnScope(
		access,
		filter.kppnScopeId ?? undefined,
	);
	const scopeIds = filter.kppnScopeId
		? [filter.kppnScopeId]
		: allowedKppnScopeIds;
	const whereClauses = [inArray(organizations.kppnScopeId, scopeIds)];
	if (filter.search) {
		// ponytail: search kodeSatker or name ilike
		whereClauses.push(
			sql`(${organizations.kodeSatker} ILIKE ${`%${filter.search}%`} OR ${organizations.name} ILIKE ${`%${filter.search}%`})`,
		);
	}
	const where =
		whereClauses.length === 1 ? whereClauses[0] : and(...whereClauses);
	const offset = (filter.page - 1) * filter.pageSize;
	const items = await db
		.select()
		.from(organizations)
		.where(where)
		.limit(filter.pageSize)
		.offset(offset)
		.orderBy(organizations.kodeSatker);
	const [totalRow] = await db
		.select({ total: count() })
		.from(organizations)
		.where(where);
	return {
		items,
		totalItems: Number(totalRow?.total ?? 0),
		page: filter.page,
		pageSize: filter.pageSize,
		totalPages: Math.ceil(Number(totalRow?.total ?? 0) / filter.pageSize),
	};
}

export async function getOrganizationDetailForAdmin(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
) {
	const adminCtx = assertAdminKppnScope(access);
	const [org] = await db
		.select()
		.from(organizations)
		.where(eq(organizations.id, orgId))
		.limit(1);
	if (!org) throw new Error("Satker tidak ditemukan.");
	if (!adminCtx.allowedKppnScopeIds.includes(org.kppnScopeId))
		throw new Error("Scope KPPN di luar wewenang admin.");

	const fYs = await db
		.select()
		.from(fiscalYears)
		.where(eq(fiscalYears.orgId, orgId));
	// latest snapshot per fiscal year (if any)
	let latestSnapshot: typeof scoreSnapshots.$inferSelect | null = null;
	if (fYs.length > 0) {
		const sims = await db
			.select()
			.from(simulations)
			.where(
				inArray(
					simulations.fiscalYearId,
					fYs.map((f) => f.id),
				),
			)
			.orderBy(desc(simulations.createdAt))
			.limit(5);
		if (sims.length > 0) {
			const snaps = await db
				.select()
				.from(scoreSnapshots)
				.where(
					inArray(
						scoreSnapshots.simulationId,
						sims.map((s) => s.id),
					),
				)
				.orderBy(desc(scoreSnapshots.createdAt))
				.limit(1);
			latestSnapshot = snaps[0] ?? null;
		}
	}

	// completeness: count non-null budgets vs expected 4 accounts etc. Simplified: check if has budgets
	const hasData = fYs.length > 0;

	return {
		organization: org,
		fiscalYears: fYs,
		latestSnapshot,
		completeness: hasData ? "partial" : "empty",
		// read-only guarantee: no mutation fields returned
	};
}

export async function listSnapshotsForAdmin(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	pagination: Pagination,
) {
	assertAdminKppnScope(access);
	// verify org in scope
	const [org] = await db
		.select()
		.from(organizations)
		.where(eq(organizations.id, orgId))
		.limit(1);
	if (!org) throw new Error("Satker tidak ditemukan.");
	assertAdminKppnScope(access, org.kppnScopeId);
	// scope already verified

	const fYs = await db
		.select({ id: fiscalYears.id })
		.from(fiscalYears)
		.where(eq(fiscalYears.orgId, orgId));
	if (fYs.length === 0)
		return {
			items: [],
			totalItems: 0,
			page: pagination.page,
			pageSize: pagination.pageSize,
			totalPages: 0,
		};
	const sims = await db
		.select({ id: simulations.id })
		.from(simulations)
		.where(
			inArray(
				simulations.fiscalYearId,
				fYs.map((f) => f.id),
			),
		);
	if (sims.length === 0)
		return {
			items: [],
			totalItems: 0,
			page: pagination.page,
			pageSize: pagination.pageSize,
			totalPages: 0,
		};
	const offset = (pagination.page - 1) * pagination.pageSize;
	const items = await db
		.select()
		.from(scoreSnapshots)
		.where(
			inArray(
				scoreSnapshots.simulationId,
				sims.map((s) => s.id),
			),
		)
		.limit(pagination.pageSize)
		.offset(offset)
		.orderBy(desc(scoreSnapshots.createdAt));
	const [totalRow] = await db
		.select({ total: count() })
		.from(scoreSnapshots)
		.where(
			inArray(
				scoreSnapshots.simulationId,
				sims.map((s) => s.id),
			),
		);
	return {
		items,
		totalItems: Number(totalRow?.total ?? 0),
		page: pagination.page,
		pageSize: pagination.pageSize,
		totalPages: Math.ceil(Number(totalRow?.total ?? 0) / pagination.pageSize),
	};
}

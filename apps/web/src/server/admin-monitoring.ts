import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, inArray } from "drizzle-orm";
import { assertAdminKppnScope } from "@simulator-ikpa/access-control";
import { createDbClient } from "@simulator-ikpa/db";
import {
	fiscalYears,
	organizations,
	scoreSnapshots,
	simulations,
} from "@simulator-ikpa/db/schema";
import { getAccessResolutionForSession } from "./access.server";
import { getServerAuthSession } from "./auth-session.server";
import {
	getOrganizationDetailForAdmin,
	listSnapshotsForAdmin,
} from "./admin/monitoring.queries";

function getDatabase() {
	const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
	if (!dbUrl) {
		return null;
	}
	return createDbClient(dbUrl);
}

const INDICATOR_ORDER = [
	"dipa_revision",
	"rpd_deviation",
	"budget_absorption",
	"contractual",
	"invoice_timeliness",
	"up_tup",
	"output_achievement",
	"spm_dispensasi",
] as const;

function parseIndicatorScores(breakdownJson: unknown): Record<string, number> {
	const out: Record<string, number> = {};
	if (!breakdownJson || typeof breakdownJson !== "object") return out;
	const b = breakdownJson as {
		indicators?: Array<{ key: string; score?: string | null }>;
		dispensationDeduction?: string | null;
	};
	if (Array.isArray(b.indicators)) {
		for (const ind of b.indicators) {
			const v = ind.score !== null && ind.score !== undefined ? parseFloat(ind.score) : NaN;
			if (ind.key && Number.isFinite(v)) out[ind.key] = v;
		}
	}
	if (b.dispensationDeduction !== undefined && b.dispensationDeduction !== null) {
		const v = parseFloat(b.dispensationDeduction);
		if (Number.isFinite(v)) out["spm_dispensasi"] = v;
	}
	return out;
}

export const getAdminDashboardSummaryFn = createServerFn({ method: "GET" })
	.validator((data?: { kppnScopeId?: string }) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth);

		const { allowedKppnScopeIds } = assertAdminKppnScope(
			access,
			data?.kppnScopeId ?? undefined,
		);

		const db = getDatabase();
		if (!db) {
			return {
				totalSatkers: 48,
				averageScore: 94.25,
				riskySatkersCount: 3,
				safeSatkersCount: 41,
				warningSatkersCount: 4,
				deliveryFailedCount: 0,
				satkerSummaries: [],
				indicatorAverages: [],
			};
		}

		// Get all organizations under KPPN (strict scope: allowed scopes only)
		const scopeIds = data?.kppnScopeId
			? [data.kppnScopeId]
			: allowedKppnScopeIds;
		const orgRows = await db
			.select()
			.from(organizations)
			.where(inArray(organizations.kppnScopeId, scopeIds));

		// Get latest snapshots for each org
		const sums: Record<string, number> = {};
		const counts: Record<string, number> = {};
		const satkerSummaries = await Promise.all(
			orgRows.map(async (org) => {
				const [fy] = await db
					.select()
					.from(fiscalYears)
					.where(
						and(eq(fiscalYears.orgId, org.id), eq(fiscalYears.year, 2026)),
					)
					.limit(1);

				let latestScore = "95.00";
				let status: "safe" | "warning" | "danger" = "safe";
				let indicators: Record<string, number> = {};
				let dataKind: "aktual" | "proyeksi" | "kosong" = "kosong";

				if (fy) {
					const [snap] = await db
						.select({
							totalScore: scoreSnapshots.totalScore,
							breakdownJson: scoreSnapshots.breakdownJson,
							simType: simulations.type,
						})
						.from(scoreSnapshots)
						.innerJoin(
							simulations,
							eq(scoreSnapshots.simulationId, simulations.id),
						)
						.where(eq(simulations.fiscalYearId, fy.id))
						.orderBy(desc(scoreSnapshots.createdAt))
						.limit(1);

					if (snap?.totalScore) {
						latestScore = snap.totalScore;
						dataKind = snap.simType === "actual" ? "aktual" : "proyeksi";
						indicators = parseIndicatorScores(snap.breakdownJson);
						for (const key of INDICATOR_ORDER) {
							const v = indicators[key];
							if (v !== undefined && Number.isFinite(v)) {
								sums[key] = (sums[key] ?? 0) + v;
								counts[key] = (counts[key] ?? 0) + 1;
							}
						}
					}
				}

				const numScore = parseFloat(latestScore);
				if (numScore < 75) status = "danger";
				else if (numScore < 90) status = "warning";

				return {
					id: org.id,
					code: org.kodeSatker,
					name: org.name,
					score: numScore,
					gap: Math.round((100 - numScore) * 100) / 100,
					status,
					dataKind,
					indicators,
					mainRisk:
						status === "danger"
							? "Deviasi RPD Halaman III > 15%"
							: status === "warning"
								? "Revolving UP terlambat"
								: "Optimal",
					lastUpdated: org.updatedAt.toISOString().slice(0, 10),
					isBlu: org.isBlu,
				};
			}),
		);

		const total = satkerSummaries.length || 1;
		const sumScore = satkerSummaries.reduce((s, o) => s + o.score, 0);
		const avg = (sumScore / total) || 95.0;

		const dangerCount = satkerSummaries.filter(
			(s) => s.status === "danger",
		).length;
		const warningCount = satkerSummaries.filter(
			(s) => s.status === "warning",
		).length;
		const safeCount = satkerSummaries.filter(
			(s) => s.status === "safe",
		).length;

		return {
			totalSatkers: satkerSummaries.length,
			averageScore: avg,
			riskySatkersCount: dangerCount,
			warningSatkersCount: warningCount,
			safeSatkersCount: safeCount,
			deliveryFailedCount: 0,
			satkerSummaries,
			indicatorAverages: INDICATOR_ORDER.map((key) => ({
				key,
				avgScore:
					counts[key] && counts[key] > 0
						? Math.round(((sums[key] ?? 0) / counts[key]) * 100) / 100
						: null,
				satkerCount: counts[key] ?? 0,
			})),
		};
	});

export const listAdminOrganizationsFn = createServerFn({ method: "GET" })
	.validator((data?: { kppnScopeId?: string }) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth);

		const { allowedKppnScopeIds } = assertAdminKppnScope(
			access,
			data?.kppnScopeId ?? undefined,
		);

		const db = getDatabase();
		if (!db) {
			return { organizations: [] };
		}

		const scopeIds = data?.kppnScopeId
			? [data.kppnScopeId]
			: allowedKppnScopeIds;
		const orgRows = await db
			.select()
			.from(organizations)
			.where(inArray(organizations.kppnScopeId, scopeIds));

		return {
			organizations: orgRows.map((o) => ({
				id: o.id,
				kodeSatker: o.kodeSatker,
				name: o.name,
				kppnName: o.kppnName,
				isBlu: o.isBlu,
				timezone: o.timezone,
				createdAt: o.createdAt.toISOString(),
			})),
		};
	});

function parseIndicatorRows(breakdownJson: unknown): Array<{
	key: string;
	rawScore: number | null;
	contrib: number | null;
}> {
	if (!breakdownJson || typeof breakdownJson !== "object") return [];
	const b = breakdownJson as {
		indicators?: Array<{
			key: string;
			score?: string | null;
			weightedContribution?: string | null;
		}>;
		dispensationDeduction?: string | null;
	};
	const rows: Array<{ key: string; rawScore: number | null; contrib: number | null }> = [];
	if (Array.isArray(b.indicators)) {
		for (const ind of b.indicators) {
			if (!ind.key) continue;
			const raw =
				ind.score !== null && ind.score !== undefined
					? parseFloat(ind.score)
					: NaN;
			const contrib =
				ind.weightedContribution !== null &&
				ind.weightedContribution !== undefined
					? parseFloat(ind.weightedContribution)
					: NaN;
			rows.push({
				key: ind.key,
				rawScore: Number.isFinite(raw) ? raw : null,
				contrib: Number.isFinite(contrib) ? contrib : null,
			});
		}
	}
	if (b.dispensationDeduction !== undefined && b.dispensationDeduction !== null) {
		const v = parseFloat(b.dispensationDeduction);
		rows.push({
			key: "spm_dispensasi",
			rawScore: Number.isFinite(v) ? v : null,
			contrib: Number.isFinite(v) ? -v : null,
		});
	}
	return rows;
}

export const getAdminOrganizationDetailFn = createServerFn({ method: "GET" })
	.validator((data: { orgId: string }) => data as { orgId: string })
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth);

		const db = getDatabase();
		if (!db) {
			return { organization: null };
		}
		const detail = await getOrganizationDetailForAdmin(db, access, data.orgId);
		const snap = detail.latestSnapshot;
		return {
			organization: {
				id: detail.organization.id,
				kodeSatker: detail.organization.kodeSatker,
				name: detail.organization.name,
				kppnName: detail.organization.kppnName,
				kppnScopeId: detail.organization.kppnScopeId,
				isBlu: detail.organization.isBlu,
				fiscalYears: detail.fiscalYears.map((f) => ({
					id: f.id,
					year: f.year,
				})),
				completeness: detail.completeness,
				latestSnapshot: snap
					? {
							id: snap.id,
							totalScore: snap.totalScore,
							ruleSetVersion: snap.ruleSetVersion,
							periodEnd: snap.periodEnd,
							simName: snap.simName,
							simType: snap.simType,
							targetScore: snap.targetScore,
							createdAt:
								snap.createdAt instanceof Date
									? snap.createdAt.toISOString()
									: String(snap.createdAt ?? ""),
							indicators: parseIndicatorRows(snap.breakdownJson),
						}
					: null,
			},
		};
	});

export const listAdminOrgSnapshotsFn = createServerFn({ method: "GET" })
	.validator(
		(data: { orgId: string; page?: number; pageSize?: number }) =>
			data as { orgId: string; page?: number; pageSize?: number },
	)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth);

		const db = getDatabase();
		if (!db) {
			return { items: [], totalItems: 0, page: 1, pageSize: 10, totalPages: 0 };
		}
		const result = await listSnapshotsForAdmin(db, access, data.orgId, {
			page: data.page ?? 1,
			pageSize: data.pageSize ?? 10,
		});
		return {
			...result,
			items: result.items.map((r) => ({
				id: r.snapshot.id,
				totalScore: r.snapshot.totalScore,
				ruleSetVersion: r.snapshot.ruleSetVersion,
				periodEnd: r.snapshot.periodEnd,
				simName: r.simName,
				simType: r.simType,
				targetScore: r.targetScore,
				createdAt:
					r.snapshot.createdAt instanceof Date
						? r.snapshot.createdAt.toISOString()
						: String(r.snapshot.createdAt ?? ""),
			})),
		};
	});

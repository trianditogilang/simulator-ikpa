import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";
import { createDbClient } from "@simulator-ikpa/db";
import { fiscalYears, ruleSets } from "@simulator-ikpa/db/schema";
import { getAccessResolutionForSession } from "./access.server";
import { getServerAuthSession } from "./auth-session.server";
import { calculateAndPersistSnapshot } from "./simulation/calculate";

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

const RECOMMENDATION_ROUTES: Record<string, string> = {
	dipa_revision: "/operator/data/budget-revisions",
	rpd_deviation: "/operator/deviasi",
	budget_absorption: "/operator/penyerapan",
	contractual: "/operator/data/contracts-invoices",
	invoice_timeliness: "/operator/data/contracts-invoices",
	up_tup: "/operator/up-tup",
	output_achievement: "/operator/data/output-achievement",
};

export const getOperatorDashboardFn = createServerFn({ method: "GET" })
	.validator((data?: { orgId?: string; periodMonth?: number }) => data)
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
				totalScore: 94.2,
				targetScore: 95.0,
				gapScore: -0.8,
				dataStatus: "complete" as const,
				ruleSetVersion: "PER-5/PB/2024",
				lastUpdated: new Date().toLocaleDateString("id-ID"),
				indicators: [],
				priorityActions: [],
				nearestDeadline: {
					id: "d1",
					title: "Batas Penyampaian SPM-LS",
					event: "Penyelesaian Tagihan 17 HK",
					dueDate: "2026-09-10",
					workDaysLeft: 8,
					status: "safe" as const,
					route: "/operator/data/contracts-invoices",
				},
			};
		}

		const fy = await getOrInitFiscalYear(db, targetOrgId, 2026);
		if (!fy) {
			throw new Error("Tahun anggaran 2026 tidak ditemukan.");
		}

		const meta = {
			actorId:
				access.status === "operator_single_scope" ||
				access.status === "operator_multiple_scopes"
					? access.userId
					: targetOrgId,
		};

		const month = data?.periodMonth ?? 8;
		const result = await calculateAndPersistSnapshot(
			db,
			access,
			{
				orgId: targetOrgId,
				fiscalYearId: fy.id,
				period: { kind: "month", value: month },
				simulationType: "actual",
				targetScore: "95.00",
			},
			meta,
		);

		const targetVal = 95.0;
		const totalVal = parseFloat(result.output.totalScore || "94.20");

		const indicatorItems = result.output.indicators.map((ind) => {
			const estimated = !ind.score;
			const rawScore = estimated ? 0 : parseFloat(ind.score ?? "0");
			const weight = parseFloat(ind.weight);
			const weightedScore = estimated ? 0 : (rawScore * weight) / 100;

			return {
				id: ind.key,
				code: ind.key.toUpperCase(),
				name: ind.label || ind.key,
				weight,
				rawScore,
				weightedScore,
				status: estimated
					? ("incomplete" as const)
					: rawScore >= 90
						? ("complete" as const)
						: rawScore >= 75
							? ("warning" as const)
							: ("danger" as const),
				statusLabel: estimated
					? "Belum ada data"
					: rawScore >= 90
						? "Optimal"
						: rawScore >= 75
							? "Perlu Perhatian"
							: "Kritis",
				deltaPoints: 0,
				summary: estimated
					? "Estimasi — belum ada data"
					: `Bobot: ${ind.weight}%`,
				isEstimated: estimated,
			};
		});

		return {
			totalScore: totalVal,
			targetScore: targetVal,
			gapScore: totalVal - targetVal,
			dataStatus: (indicatorItems.some((i) => i.isEstimated)
				? "estimated"
				: "complete") as "estimated" | "complete",
			ruleSetVersion: "PER-5/PB/2024",
			lastUpdated: new Date().toLocaleDateString("id-ID"),
			indicators: [
				...indicatorItems,
				{
					id: "spm_dispensasi",
					code: "SPM_DISPENSASI",
					name: "SPM Dispensasi",
					weight: 0,
					rawScore: parseFloat(result.output.dispensationDeduction ?? "0") || 0,
					weightedScore: -(parseFloat(result.output.dispensationDeduction ?? "0") || 0),
					status: (parseFloat(result.output.dispensationDeduction ?? "0") || 0) > 0 ? ("warning" as const) : ("complete" as const),
					statusLabel: (parseFloat(result.output.dispensationDeduction ?? "0") || 0) > 0 ? "Pengurang" : "Tanpa pengurang",
					deltaPoints: -(parseFloat(result.output.dispensationDeduction ?? "0") || 0),
					summary: "Pengurang total IKPA",
					isDeduction: true,
				},
			],
			priorityActions: result.output.recommendations.map((rec, idx) => ({
				id: `rec-${idx}-${rec.indicatorKey}`,
				title: rec.title,
				urgency: rec.urgency,
				urgencyLabel:
					rec.urgency === "high"
						? "Tinggi"
						: rec.urgency === "medium"
							? "Sedang"
							: "Rendah",
				deadlineDays: 5,
				deadlineDate: rec.deadline ?? "2026-09-15",
				impactPoints: parseFloat(rec.potentialGain || "1.00"),
				indicatorId: rec.indicatorKey,
				indicatorName: rec.indicatorKey,
				route: RECOMMENDATION_ROUTES[rec.indicatorKey] ?? "/operator/simulation",
				domain: rec.indicatorKey,
			})),
			nearestDeadline: {
				id: "d1",
				title: "Batas Konfirmasi Capaian Output Bulan Berjalan",
				event: "Konfirmasi Capaian Output 5 HK",
				dueDate: "2026-09-07",
				workDaysLeft: 5,
				status: "safe" as const,
				route: "/operator/data/output-achievement",
			},
		};
	});

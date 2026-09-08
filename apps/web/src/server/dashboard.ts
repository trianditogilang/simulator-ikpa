import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";
import { createDbClient } from "@simulator-ikpa/db";
import { fiscalYears, organizations, ruleSets } from "@simulator-ikpa/db/schema";
import { resolveIndicatorRoute } from "@/lib/indicator-routes";
import type {
	CompletenessItem,
	IndicatorScoreItem,
	NearestDeadlineItem,
	PriorityActionItem,
} from "@/mocks/operator-dashboard";
import { getAccessResolutionForSession } from "./access.server";
import { getServerAuthSession } from "./auth-session.server";
import { getActiveReminderEvents } from "./reminders/active-events.queries";
import { calculateAndPersistSnapshot } from "./simulation/calculate";

function getDatabase() {
	const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
	if (!dbUrl) {
		return null;
	}
	return createDbClient(dbUrl);
}

const MONTH_SHORT_NAMES = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"Mei",
	"Jun",
	"Jul",
	"Agu",
	"Sep",
	"Okt",
	"Nov",
	"Des",
];

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

interface DashboardCacheEntry {
	data: any;
	expiresAt: number;
}

const dashboardMemoryCache = new Map<string, DashboardCacheEntry>();

export const getOperatorDashboardFn = createServerFn({ method: "GET" })
	.validator(
		(data?: {
			orgId?: string;
			periodMonth?: number;
			fiscalYearId?: string;
			year?: number;
		}) => data,
	)
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

		const targetYear = data?.year ?? 2026;
		const month = data?.periodMonth ?? 8;
		const cacheKey = `${targetOrgId}-${targetYear}-${month}`;

		// Check server in-memory cache (TTL 2 minutes)
		const cached = dashboardMemoryCache.get(cacheKey);
		if (cached && Date.now() < cached.expiresAt) {
			return cached.data;
		}

		const db = getDatabase();

		if (!db) {
			if (process.env.NODE_ENV === "production") {
				throw new Error("Koneksi database tidak tersedia.");
			}
			// Safe non-production mock fallback
			return {
				totalScore: 91.25,
				targetScore: 95.0,
				gapScore: -3.75,
				deltaFromPreviousPeriod: 0.85,
				previousPeriodLabel: "Jul",
				dataStatus: "complete" as const,
				ruleSetVersion: "PER-5/PB/2024",
				lastUpdated: new Date().toLocaleDateString("id-ID", {
					day: "numeric",
					month: "short",
					year: "numeric",
				}),
				activePeriodMonth: month,
				activeYear: targetYear,
				indicators: [],
				priorityActions: [],
				nearestDeadline: null,
				otherDeadlinesCount: 0,
				completeness: [],
				firstIncompleteRoute: null,
				scoreHistory: [],
			};
		}

		// 1. Fetch organization & fiscal year
		const [org] = await db
			.select()
			.from(organizations)
			.where(eq(organizations.id, targetOrgId))
			.limit(1);

		if (!org) {
			throw new Error("Satker tidak ditemukan.");
		}

		const fy = await getOrInitFiscalYear(db, targetOrgId, targetYear);
		if (!fy) {
			throw new Error(`Tahun anggaran ${targetYear} tidak ditemukan.`);
		}

		const [ruleSetRow] = await db
			.select()
			.from(ruleSets)
			.where(eq(ruleSets.id, fy.activeRuleSetId))
			.limit(1);

		const meta = {
			actorId:
				access.status === "operator_single_scope" ||
				access.status === "operator_multiple_scopes"
					? access.userId
					: targetOrgId,
		};

		const targetVal = 95.0;
		const prevMonth = month > 1 ? month - 1 : null;
		const prevMonthLabel = prevMonth ? MONTH_SHORT_NAMES[prevMonth - 1] : null;

		// 2. Concurrently calculate live IKPA snapshot for current month and previous month, and retrieve active reminder events
		const [result, prevResult, activeEventsRaw] = await Promise.all([
			calculateAndPersistSnapshot(
				db,
				access,
				{
					orgId: targetOrgId,
					fiscalYearId: fy.id,
					period: { kind: "month", value: month },
					simulationType: "actual",
					targetScore: targetVal.toFixed(2),
				},
				meta,
			),
			prevMonth
				? calculateAndPersistSnapshot(
						db,
						access,
						{
							orgId: targetOrgId,
							fiscalYearId: fy.id,
							period: { kind: "month", value: prevMonth },
							simulationType: "actual",
							targetScore: targetVal.toFixed(2),
						},
						meta,
					).catch(() => null)
				: Promise.resolve(null),
			getActiveReminderEvents(db, targetOrgId, fy.id).catch(() => []),
		]);

		const totalVal =
			result.output.totalScore !== null
				? parseFloat(result.output.totalScore)
				: null;

		// 3. Process previous period actual snapshot to compute real delta
		const prevSnapshotScore =
			prevResult?.output?.totalScore !== null &&
			prevResult?.output?.totalScore !== undefined
				? parseFloat(prevResult.output.totalScore)
				: null;

		const prevBreakdown = prevResult?.output ?? null;

		const totalDelta =
			totalVal !== null && prevSnapshotScore !== null
				? totalVal - prevSnapshotScore
				: null;

		// 4. Determine Rank 1 priority action to badge the indicator
		const rank1Key =
			result.output.recommendations.length > 0
				? result.output.recommendations[0].indicatorKey
				: null;

		// 5. Map indicators breakdown
		const indicatorItems: IndicatorScoreItem[] = result.output.indicators.map(
			(ind) => {
				const rawScore =
					ind.score !== null && ind.score !== undefined
						? Math.min(100, Math.max(0, parseFloat(ind.score)))
						: null;
				const estimated = rawScore === null || (ind.status === "incomplete" && rawScore === null);
				const weight = parseFloat(ind.weight);
				const weightedScore = estimated
					? 0
					: Math.min(
							weight,
							Math.max(
								0,
								parseFloat(ind.weightedContribution ?? "0") ||
									(rawScore !== null ? (rawScore * weight) / 100 : 0),
							),
						);

				// Find prev score for this indicator
				const prevInd = prevBreakdown?.indicators?.find(
					(pi: { key: string }) => pi.key === ind.key,
				);
				const prevIndScore =
					prevInd?.score !== null && prevInd?.score !== undefined
						? parseFloat(prevInd.score)
						: null;
				const indDelta =
					rawScore !== null && prevIndScore !== null
						? rawScore - prevIndScore
						: null;

				let deltaDesc = "Belum ada pembanding";
				if (indDelta !== null) {
					deltaDesc =
						indDelta === 0
							? `Tetap vs ${prevMonthLabel}`
							: `${indDelta > 0 ? "+" : ""}${indDelta.toFixed(2)} vs ${prevMonthLabel}`;
				} else if (prevMonthLabel) {
					deltaDesc = `Belum ada data ${prevMonthLabel}`;
				}

				const routeInfo = resolveIndicatorRoute(ind.key);

				return {
					id: ind.key,
					code: ind.key.toUpperCase(),
					name: ind.label || routeInfo?.label || ind.key,
					weight,
					rawScore,
					weightedScore,
					status: estimated
						? ("incomplete" as const)
						: rawScore !== null && rawScore >= 90
							? ("complete" as const)
							: rawScore !== null && rawScore >= 75
								? ("warning" as const)
								: ("danger" as const),
					statusLabel: estimated
						? "Belum ada data"
						: rawScore !== null && rawScore >= 90
							? "Optimal"
							: rawScore !== null && rawScore >= 75
								? "Perlu Perhatian"
								: "Kritis",
					deltaPoints: indDelta,
					deltaDescription: deltaDesc,
					summary: estimated
						? "Estimasi — belum ada data"
						: `Nilai: ${rawScore !== null ? rawScore.toFixed(2) : "—"}`,
					isEstimated: estimated,
					isPriority1: rank1Key === ind.key,
					route: routeInfo?.route ?? "/operator/dashboard",
				};
			},
		);

		// Add SPM Dispensasi
		const dispDeduction = parseFloat(
			result.output.dispensationDeduction ?? "0",
		);
		const prevDispDeduction = prevBreakdown?.dispensationDeduction
			? parseFloat(prevBreakdown.dispensationDeduction)
			: null;
		const dispDelta =
			prevDispDeduction !== null ? -(dispDeduction - prevDispDeduction) : null;

		indicatorItems.push({
			id: "spm_dispensasi",
			code: "SPM_DISPENSASI",
			name: "Dispensasi SPM",
			weight: 0,
			rawScore: dispDeduction,
			weightedScore: -dispDeduction,
			status: dispDeduction > 0 ? ("warning" as const) : ("complete" as const),
			statusLabel: dispDeduction > 0 ? "Pengurang" : "Tanpa pengurang",
			deltaPoints: dispDelta,
			deltaDescription:
				dispDelta !== null
					? `${dispDelta >= 0 ? "+" : ""}${dispDelta.toFixed(2)} vs ${prevMonthLabel}`
					: "Tanpa pengurang",
			summary:
				dispDeduction > 0
					? `Pengurang ${dispDeduction.toFixed(2)} poin dari total`
					: "Pengurang total IKPA",
			isDeduction: true,
			route: "/operator/data/spm-dispensation",
		});

		// 6. Completeness checks across 8 domains (reusing loaded domain counts)
		const counts = result.domainCounts || {
			dipa: 0,
			rpd: 0,
			real: 0,
			contract: 0,
			spmLs: 0,
			upTup: 0,
			output: 0,
			spmQ4: 0,
		};

		const completenessList: CompletenessItem[] = [
			{
				id: "c-dipa",
				domain: "Pagu & Revisi DIPA",
				isComplete: counts.dipa > 0,
				label: counts.dipa > 0 ? "Lengkap" : "Belum ada data revisi",
				route: "/operator/data/budget-revisions",
			},
			{
				id: "c-rpd",
				domain: "RPD & Realisasi",
				isComplete: counts.rpd > 0 && counts.real > 0,
				label:
					counts.rpd > 0 && counts.real > 0
						? "Lengkap"
						: "RPD / Realisasi belum terisi",
				route: "/operator/deviasi",
			},
			{
				id: "c-contracts",
				domain: "Belanja Kontraktual",
				isComplete: counts.contract > 0,
				label: counts.contract > 0 ? "Lengkap" : "Belum ada kontrak",
				route: "/operator/data/contracts-invoices?tab=contracts",
			},
			{
				id: "c-invoices",
				domain: "Penyelesaian Tagihan",
				isComplete: counts.spmLs > 0,
				label: counts.spmLs > 0 ? "Lengkap" : "Belum ada SPM-LS",
				route: "/operator/data/contracts-invoices?tab=invoices",
			},
			{
				id: "c-uptup",
				domain: "UP/TUP & KKP",
				isComplete: counts.upTup > 0,
				label: counts.upTup > 0 ? "Lengkap" : "Belum ada transaksi UP",
				route: "/operator/up-tup",
			},
			{
				id: "c-output",
				domain: "Capaian Output",
				isComplete: counts.output > 0,
				label: counts.output > 0 ? "Lengkap" : "Pelaporan belum lengkap",
				route: "/operator/data/output-achievement",
			},
			{
				id: "c-dispensation",
				domain: "Dispensasi SPM",
				isComplete: counts.spmQ4 >= 0,
				label: "Lengkap",
				route: "/operator/data/spm-dispensation",
			},
		];

		const firstIncomplete = completenessList.find((c) => !c.isComplete);
		const firstIncompleteRoute = firstIncomplete ? firstIncomplete.route : null;

		// 7. Nearest Deadline from policy reminder engine
		let nearestDeadline: NearestDeadlineItem | null = null;
		let otherDeadlinesCount = 0;

		try {
			const typedEvents: any[] = activeEventsRaw ?? [];
			const upcomingEvents = typedEvents
				.filter(
					(e: any) =>
						e.status !== "completed" &&
						e.daysRemaining !== undefined &&
						e.daysRemaining >= 0,
				)
				.sort((a: any, b: any) => (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0));

			if (upcomingEvents.length > 0) {
				const firstEvt = upcomingEvents[0];
				const routeInfo = resolveIndicatorRoute(firstEvt.indicatorKey);

				nearestDeadline = {
					id: firstEvt.id,
					title: firstEvt.eventTitle,
					event: `${firstEvt.entityNumber}${firstEvt.entityDetail ? ` · ${firstEvt.entityDetail}` : ""}`,
					dueDate: firstEvt.deadlineDate,
					workDaysLeft: firstEvt.daysRemaining,
					status:
						firstEvt.status === "urgent" || firstEvt.status === "overdue"
							? "danger"
							: firstEvt.status === "warning"
								? "warning"
								: "safe",
					route: routeInfo?.route ?? firstEvt.actionUrl,
					indicatorLabel: routeInfo?.label ?? firstEvt.indicatorLabel,
					otherDeadlinesCount: Math.max(0, upcomingEvents.length - 1),
				};
				otherDeadlinesCount = Math.max(0, upcomingEvents.length - 1);
			}
		} catch {
			nearestDeadline = null;
			otherDeadlinesCount = 0;
		}

		// 8. Priority Actions from engine recommendations (max 5, canonical routing)
		const priorityActions: PriorityActionItem[] = result.output.recommendations
			.slice(0, 5)
			.map((rec, idx) => {
				const routeInfo = resolveIndicatorRoute(rec.indicatorKey);
				return {
					id: `rec-${idx}-${rec.indicatorKey}`,
					indicatorId: rec.indicatorKey,
					indicatorName: routeInfo?.label ?? rec.indicatorKey,
					title: rec.title,
					urgency: rec.urgency,
					urgencyLabel:
						rec.urgency === "high"
							? "Tinggi"
							: rec.urgency === "medium"
								? "Sedang"
								: "Rendah",
					deadlineDays: null,
					deadlineDate: rec.deadline ?? null,
					impactPoints: parseFloat(rec.potentialGain || "0.00"),
					route: routeInfo?.route ?? "/operator/dashboard",
					domain: routeInfo?.label ?? "Indikator",
					domainLabel: routeInfo?.label ?? "Indikator",
				};
			});

		const hasIncomplete = indicatorItems.some((i) => i.isEstimated);

		const responseData = {
			totalScore: hasIncomplete && totalVal === null ? null : totalVal,
			targetScore: targetVal,
			gapScore: totalVal !== null ? totalVal - targetVal : null,
			deltaFromPreviousPeriod: totalDelta,
			previousPeriodLabel: prevMonthLabel,
			dataStatus: (hasIncomplete ? "incomplete" : "complete") as
				| "complete"
				| "incomplete"
				| "estimated",
			ruleSetVersion: ruleSetRow?.version || "PER-5/PB/2024",
			lastUpdated: result.snapshot.createdAt
				? new Date(result.snapshot.createdAt).toLocaleDateString("id-ID", {
						day: "numeric",
						month: "short",
						year: "numeric",
						hour: "2-digit",
						minute: "2-digit",
					})
				: new Date().toLocaleDateString("id-ID"),
			indicators: indicatorItems,
			priorityActions,
			nearestDeadline,
			otherDeadlinesCount,
			completeness: completenessList,
			firstIncompleteRoute,
			scoreHistory: [],
			activePeriodMonth: month,
			activeYear: targetYear,
		};

		if (dashboardMemoryCache.size > 100) {
			dashboardMemoryCache.clear();
		}
		dashboardMemoryCache.set(cacheKey, {
			data: responseData,
			expiresAt: Date.now() + 120_000,
		});

		return responseData;
	});

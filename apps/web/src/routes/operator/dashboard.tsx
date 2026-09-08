import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Calendar, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useActiveContext } from "@/components/layout/active-context";
import { OperatorShell } from "@/components/layout/operator-shell";
import { DataCompletenessBanner } from "@/components/operator/data-completeness-banner";
import { DeadlinePanel } from "@/components/operator/deadline-panel";
import { IndicatorCard } from "@/components/operator/indicator-card";
import { RecommendationList } from "@/components/operator/recommendation-list";
import { ScoreCard } from "@/components/operator/score-card";
import {
	type DashboardResponseData,
	fetchOperatorDashboard,
} from "@/services/dashboard-service";

export const Route = createFileRoute("/operator/dashboard")({
	loader: async ({ context }) => {
		const activeOrgId =
			context.auth?.isAuthenticated &&
			(context.access?.status === "operator_single_scope" ||
				context.access?.status === "operator_multiple_scopes")
				? (context.access.activeOrganizationId ?? undefined)
				: undefined;

		return {
			initialData: await fetchOperatorDashboard(activeOrgId),
			activeOrgId,
		};
	},
	component: OperatorDashboardPage,
});

const MONTH_LONG_NAMES = [
	"Januari",
	"Februari",
	"Maret",
	"April",
	"Mei",
	"Juni",
	"Juli",
	"Agustus",
	"September",
	"Oktober",
	"November",
	"Desember",
];

function OperatorDashboardPage() {
	const { initialData, activeOrgId } = Route.useLoaderData();
	const navigate = useNavigate();
	const activeContext = useActiveContext();

	const contextMonth =
		activeContext?.context.period.kind === "month"
			? activeContext.context.period.value
			: initialData.activePeriodMonth ?? 8;

	const [selectedMonth, setSelectedMonth] = useState<number>(contextMonth);
	const [data, setData] = useState<DashboardResponseData>(initialData);
	const [isLoadingMonth, setIsLoadingMonth] = useState(false);

	// Client-side memory cache for visited months
	const cacheRef = useRef<Record<number, DashboardResponseData>>({
		[initialData.activePeriodMonth ?? 8]: initialData,
	});

	// Sync when context month changes
	useEffect(() => {
		if (contextMonth !== selectedMonth) {
			setSelectedMonth(contextMonth);
			if (cacheRef.current[contextMonth]) {
				setData(cacheRef.current[contextMonth]);
			} else {
				setIsLoadingMonth(true);
				fetchOperatorDashboard(activeOrgId, contextMonth)
					.then((res) => {
						cacheRef.current[contextMonth] = res;
						setData(res);
					})
					.catch(() => {})
					.finally(() => setIsLoadingMonth(false));
			}
		}
	}, [contextMonth, activeOrgId, selectedMonth]);

	const handleMonthChange = (newMonth: number) => {
		setSelectedMonth(newMonth);
		activeContext?.setPeriod({ kind: "month", value: newMonth });

		if (cacheRef.current[newMonth]) {
			setData(cacheRef.current[newMonth]);
			return;
		}

		setIsLoadingMonth(true);
		fetchOperatorDashboard(activeOrgId, newMonth)
			.then((res) => {
				cacheRef.current[newMonth] = res;
				setData(res);
			})
			.catch(() => {})
			.finally(() => setIsLoadingMonth(false));
	};

	const activeMonth = selectedMonth;
	const fyContext = activeContext?.context.fiscalYear;
	const activeYear: number =
		typeof fyContext === "number"
			? fyContext
			: fyContext && typeof fyContext === "object" && "year" in (fyContext as any)
				? Number((fyContext as any).year)
				: Number(data.activeYear ?? 2026);
	const activePeriodLabel = `${MONTH_LONG_NAMES[activeMonth - 1] || `Bulan ${activeMonth}`} ${activeYear}`;

	const topActions = data.priorityActions.slice(0, 5);

	// Contextual button label & route
	const contextActionRoute =
		data.firstIncompleteRoute ||
		(topActions.length > 0 ? topActions[0].route : "/operator/data/budget-revisions");

	const contextActionLabel = data.firstIncompleteRoute
		? "Lengkapi Data"
		: topActions.length > 0
			? `Buka ${topActions[0].domainLabel || topActions[0].indicatorName}`
			: "Buka Revisi DIPA";

	const handleNavigate = (route: string) => {
		if (route.startsWith("http")) {
			window.location.href = route;
			return;
		}
		navigate({ to: route as never });
	};

	return (
		<OperatorShell currentPath="/operator/dashboard">
			<div className="space-y-6">
				<h1 className="sr-only">Dashboard IKPA Operator Satker</h1>

				{/* Top Bar: Active Period Selector */}
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface/60 px-4 py-3 shadow-2xs backdrop-blur-xs">
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
							<Calendar className="h-4 w-4" />
						</div>
						<div>
							<div className="flex items-center gap-2">
								<span className="text-xs font-semibold text-foreground">
									Periode Evaluasi Kumulatif
								</span>
								<span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
									YTD
								</span>
							</div>
							<p className="text-[11px] text-muted-foreground">
								Menampilkan akumulasi data realisasi &amp; proyeksi s.d. akhir {activePeriodLabel}
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						{isLoadingMonth && (
							<Loader2 className="h-4 w-4 animate-spin text-primary" />
						)}
						<label
							htmlFor="dashboard-month-select"
							className="text-xs font-medium text-muted-foreground"
						>
							Pilih Bulan:
						</label>
						<select
							id="dashboard-month-select"
							value={activeMonth}
							disabled={isLoadingMonth}
							onChange={(e) => handleMonthChange(Number(e.target.value))}
							className="h-9 cursor-pointer rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground shadow-2xs transition focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-60"
						>
							{MONTH_LONG_NAMES.map((name, idx) => (
								<option key={name} value={idx + 1}>
									Bulan {idx + 1} — {name} {activeYear}
								</option>
							))}
						</select>
					</div>
				</div>

				{/* Top Grid: KPI Score Card & Nearest Deadline */}
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
					<div className="lg:col-span-8">
						<ScoreCard
							totalScore={data.totalScore}
							targetScore={data.targetScore}
							gapScore={data.gapScore}
							deltaFromPreviousPeriod={data.deltaFromPreviousPeriod}
							previousPeriodLabel={data.previousPeriodLabel}
							dataStatus={data.dataStatus}
							ruleSetVersion={data.ruleSetVersion}
							lastUpdated={data.lastUpdated}
							contextActionLabel={contextActionLabel}
							onContextActionClick={() => handleNavigate(contextActionRoute)}
							onHistoryClick={() => handleNavigate("/operator/history")}
						/>
					</div>

					<div className="lg:col-span-4">
						<DeadlinePanel
							deadline={data.nearestDeadline}
							otherDeadlinesCount={data.otherDeadlinesCount}
							onActionClick={handleNavigate}
							onViewAllDeadlinesClick={() => handleNavigate("/operator/reminders")}
						/>
					</div>
				</div>

				{/* Data Completeness Banner (if incomplete) */}
				<DataCompletenessBanner
					completeness={data.completeness}
					activePeriodLabel={activePeriodLabel}
					onFixDataClick={handleNavigate}
				/>

				{/* 8 Indicators Grid */}
				<div>
					<div className="mb-4 flex items-center justify-between">
						<div>
							<h2 className="text-base font-bold text-foreground sm:text-lg">
								8 Indikator IKPA
							</h2>
							<p className="text-xs text-muted-foreground">
								7 berbobot (100%) + SPM Dispensasi sebagai pengurang total
							</p>
						</div>
						<span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
							Tahun Anggaran {activeYear}
						</span>
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{data.indicators.map((ind) => (
							<IndicatorCard
								key={ind.id}
								indicator={ind}
								onDetailClick={handleNavigate}
							/>
						))}
					</div>
				</div>

				{/* Priority Actions & Recommendations */}
				<RecommendationList
					actions={topActions}
					totalCount={data.priorityActions.length}
					onActionClick={handleNavigate}
				/>
			</div>
		</OperatorShell>
	);
}

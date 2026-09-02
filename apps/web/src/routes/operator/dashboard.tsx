import { createFileRoute } from "@tanstack/react-router";
import { OperatorShell } from "@/components/layout/operator-shell";
import { DeadlinePanel } from "@/components/operator/deadline-panel";
import { IndicatorCard } from "@/components/operator/indicator-card";
import { RecommendationList } from "@/components/operator/recommendation-list";
import { ScoreCard } from "@/components/operator/score-card";
import { fetchOperatorDashboard } from "@/services/dashboard-service";

export const Route = createFileRoute("/operator/dashboard")({
	loader: async ({ context }) => {
		const activeOrgId =
			context.auth?.isAuthenticated &&
			(context.access?.status === "operator_single_scope" ||
				context.access?.status === "operator_multiple_scopes")
				? (context.access.activeOrganizationId ?? undefined)
				: undefined;

		return fetchOperatorDashboard(activeOrgId);
	},
	component: OperatorDashboardPage,
});

const INDICATOR_ROUTES: Record<string, string> = {
	REVISI_DIPA: "/operator/data/budget-revisions",
	DEV_HAL_III: "/operator/data/rpd-realization",
	PENYERAPAN: "/operator/data/rpd-realization",
	BELANJA_KONTRAKTUAL: "/operator/data/contracts-invoices",
	TAGIHAN: "/operator/data/contracts-invoices",
	UP_TUP: "/operator/data/up-tup-kkp",
	CAPAIAN_OUTPUT: "/operator/data/output-achievement",
	SPM_DISPENSASI: "/operator/data/spm-dispensation",
};

function OperatorDashboardPage() {
	const data = Route.useLoaderData();

	return (
		<OperatorShell currentPath="/operator/dashboard">
			<div className="space-y-6">
				<h1 className="sr-only">Dashboard IKPA Operator Satker</h1>

				{/* Top Grid: KPI Score Card & Nearest Deadline */}
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
					<div className="lg:col-span-8">
						<ScoreCard
							totalScore={data.totalScore}
							targetScore={data.targetScore}
							gapScore={data.gapScore}
							dataStatus={data.dataStatus}
							ruleSetVersion={data.ruleSetVersion}
							lastUpdated={data.lastUpdated}
							onSimulateClick={() => {
								window.location.href = "/operator/simulation";
							}}
							onInputClick={() => {
								window.location.href = "/operator/data/budget-revisions";
							}}
						/>
					</div>

					<div className="lg:col-span-4">
						<DeadlinePanel
							deadline={data.nearestDeadline}
							onActionClick={(route) => {
								window.location.href = route;
							}}
						/>
					</div>
				</div>

				{/* 7 Indicators Grid */}
				<div>
					<div className="mb-4 flex items-center justify-between">
						<div>
							<h2 className="text-base font-bold text-foreground sm:text-lg">
								7 Indikator Penilaian Kinerja Anggaran
							</h2>
							<p className="text-xs text-muted-foreground">
								Berdasarkan formulasi regulasi IKPA PER-5/PB/2024
							</p>
						</div>
						<span className="text-xs font-semibold text-primary">
							Tahun Anggaran 2026
						</span>
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{data.indicators.map((ind) => (
							<IndicatorCard
								key={ind.id}
								indicator={ind}
								onClick={() => {
									const route =
										INDICATOR_ROUTES[ind.code] || "/operator/simulation";
									window.location.href = route;
								}}
							/>
						))}
					</div>
				</div>

				{/* Recommendations & Action Plan */}
				<RecommendationList
					actions={data.priorityActions}
					onActionClick={(route) => {
						window.location.href = route;
					}}
				/>
			</div>
		</OperatorShell>
	);
}

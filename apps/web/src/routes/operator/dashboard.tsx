import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OperatorShell } from "@/components/layout/operator-shell";
import { DeadlinePanel } from "@/components/operator/deadline-panel";
import { IndicatorCard } from "@/components/operator/indicator-card";
import { RecommendationList } from "@/components/operator/recommendation-list";
import { ScoreCard } from "@/components/operator/score-card";
import { fetchOperatorDashboard } from "@/services/dashboard-service";
import { executeSimulation } from "@/services/simulation-service";

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
	DEV_HAL_III: "/operator/deviasi",
	PENYERAPAN: "/operator/penyerapan",
	BELANJA_KONTRAKTUAL: "/operator/data/contracts-invoices",
	TAGIHAN: "/operator/data/contracts-invoices",
	UP_TUP: "/operator/up-tup",
	CAPAIAN_OUTPUT: "/operator/data/output-achievement",
	SPM_DISPENSASI: "/operator/data/spm-dispensation",
};

function OperatorDashboardPage() {
	const data = Route.useLoaderData();
	const [isSaving, setIsSaving] = useState(false);
	const [saveMessage, setSaveMessage] = useState<string | null>(null);
	const [saveError, setSaveError] = useState<string | null>(null);

	const topActions = data.priorityActions.slice(0, 5);

	const handleSaveScenario = async () => {
		setIsSaving(true);
		setSaveMessage(null);
		setSaveError(null);
		try {
			await executeSimulation({
				simulationType: "scenario",
				period: { kind: "month", value: new Date().getMonth() + 1 },
				simulationName: `Skenario IKPA Dashboard - ${new Date().toLocaleDateString("id-ID")}`,
			});
			setSaveMessage(
				"Skenario IKPA (8 indikator + rekomendasi) berhasil disimpan. Lihat di Riwayat & perbandingan.",
			);
		} catch (err: unknown) {
			setSaveError(
				err instanceof Error ? err.message : "Gagal menyimpan skenario IKPA.",
			);
		} finally {
			setIsSaving(false);
		}
	};

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
							onSaveScenarioClick={handleSaveScenario}
							isSavingScenario={isSaving}
						/>
						{saveMessage ? (
							<p className="mt-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-xs text-success">
								{saveMessage}{" "}
								<a href="/operator/history" className="font-semibold underline underline-offset-4">
									Buka Riwayat
								</a>
							</p>
						) : null}
						{saveError ? (
							<p className="mt-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
								{saveError}
							</p>
						) : null}
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

				{/* 8 Indicators Grid */}
				<div>
					<div className="mb-4 flex items-center justify-between">
						<div>
							<h2 className="text-base font-bold text-foreground sm:text-lg">
								8 Indikator IKPA
							</h2>
							<p className="text-xs text-muted-foreground">
								7 berbobot + SPM Dispensasi sebagai pengurang
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
					actions={topActions}
					totalCount={data.priorityActions.length}
					onSeeAllClick={() => {
						window.location.href = "/operator/analysis";
					}}
					onActionClick={(route) => {
						window.location.href = route;
					}}
				/>
			</div>
		</OperatorShell>
	);
}

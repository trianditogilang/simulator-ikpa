import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OperatorShell } from "@/components/layout/operator-shell";
import { ScoreCard } from "@/components/operator/score-card";
import { IndicatorCard } from "@/components/operator/indicator-card";
import { DeadlinePanel } from "@/components/operator/deadline-panel";
import { RecommendationList } from "@/components/operator/recommendation-list";
import { getMockOperatorDashboard } from "@/mocks/operator-dashboard";

export const Route = createFileRoute("/operator/dashboard")({
	component: OperatorDashboardPage,
});

function OperatorDashboardPage() {
	const [scenario, setScenario] = useState<"normal" | "risky" | "incomplete">(
		"normal",
	);
	const data = getMockOperatorDashboard(scenario);

	return (
		<OperatorShell currentPath="/operator/dashboard">
			<div className="space-y-6">
				<h1 className="sr-only">Dashboard IKPA Operator Satker</h1>
				{/* Scenario Switcher for Demo / Mock Evaluation */}
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface p-3.5">
					<div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
						<span className="text-xs font-semibold text-muted-foreground">
							Skenario Data:
						</span>
						<fieldset className="flex flex-wrap items-center gap-1 border-0 p-0 m-0">
							<legend className="sr-only">Pilih skenario data</legend>
							<button
								aria-pressed={scenario === "normal"}
								type="button"
								onClick={() => setScenario("normal")}
								className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
									scenario === "normal"
										? "bg-primary text-primary-foreground shadow-xs"
										: "bg-background text-foreground hover:bg-surface-muted"
								}`}
							>
								Normal (94,20)
							</button>
							<button
								aria-pressed={scenario === "risky"}
								type="button"
								onClick={() => setScenario("risky")}
								className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
									scenario === "risky"
										? "bg-primary text-primary-foreground shadow-xs"
										: "bg-background text-foreground hover:bg-surface-muted"
								}`}
							>
								Berisiko (86,85)
							</button>
							<button
								aria-pressed={scenario === "incomplete"}
								type="button"
								onClick={() => setScenario("incomplete")}
								className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
									scenario === "incomplete"
										? "bg-primary text-primary-foreground shadow-xs"
										: "bg-background text-foreground hover:bg-surface-muted"
								}`}
							>
								Incomplete (Estimasi)
							</button>
						</fieldset>
					</div>
					<span className="text-[11px] text-muted-foreground">
						Status: {scenario.toUpperCase()}
					</span>
				</div>

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

				{/* Indicator Cards Grid */}
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<h2 className="text-sm font-semibold text-foreground sm:text-base">
							8 Indikator Kinerja Pelaksanaan Anggaran
						</h2>
						<span className="text-xs text-muted-foreground">
							Bobot Total: 100%
						</span>
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{data.indicators.map((ind) => (
							<IndicatorCard
								key={ind.id}
								indicator={ind}
								onDetailClick={() => {
									window.location.href = "/operator/simulation";
								}}
							/>
						))}
					</div>
				</div>

				{/* Bottom Grid: Priority Actions & Completeness Summary */}
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
					<div className="lg:col-span-8">
						<RecommendationList
							actions={data.priorityActions}
							onActionClick={(route) => {
								window.location.href = route;
							}}
						/>
					</div>

					<div className="lg:col-span-4">
						<div className="rounded-2xl border border-border bg-background p-5 shadow-xs sm:p-6">
							<h3 className="text-sm font-semibold text-foreground">
								Kelengkapan Data Satker
							</h3>
							<p className="mt-1 text-xs text-muted-foreground">
								Status rekonsiliasi input data per domain.
							</p>

							<div className="mt-4 space-y-2">
								{data.completeness.map((comp) => (
									<a
										key={comp.id}
										href={comp.route}
										className="flex items-center justify-between rounded-lg border border-border/70 p-2.5 text-xs transition hover:bg-surface-muted"
									>
										<span className="font-medium text-foreground">
											{comp.domain}
										</span>
										<span
											className={`font-semibold ${
												comp.isComplete ? "text-success" : "text-warning"
											}`}
										>
											{comp.label}
										</span>
									</a>
								))}
							</div>
						</div>
					</div>
				</div>
			</div>
		</OperatorShell>
	);
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OperatorShell } from "@/components/layout/operator-shell";
import {
	SimulationModeTabs,
	type SimulationMode,
} from "@/components/operator/simulation-mode-tabs";
import { SimulationContextForm } from "@/components/operator/simulation-context-form";
import { SimulationResult } from "@/components/operator/simulation-result";
import { FormulaTrace } from "@/components/operator/formula-trace";
import { getMockOperatorContext } from "@/mocks/operator-context";
import { getMockOperatorDashboard } from "@/mocks/operator-dashboard";

export const Route = createFileRoute("/operator/simulation")({
	component: OperatorSimulationPage,
});

function OperatorSimulationPage() {
	const context = getMockOperatorContext();
	const [mode, setMode] = useState<SimulationMode>("actual");
	const [targetScore, setTargetScore] = useState(95.0);
	const [periodMonth, setPeriodMonth] = useState(8);
	const [isBlu, setIsBlu] = useState(false);
	const [selectedIndicator, setSelectedIndicator] = useState<string | null>(
		"tagihan",
	);

	const dashboardData = getMockOperatorDashboard("normal");

	// Nilai kalkulasi dinamis menurut mode
	const scoreBonus = mode === "scenario" ? 1.55 : mode === "forecast" ? 0.8 : 0;
	const currentTotalScore = Math.min(
		100,
		dashboardData.totalScore + scoreBonus,
	);
	const currentGap = currentTotalScore - targetScore;

	return (
		<OperatorShell currentPath="/operator/simulation">
			<div className="space-y-6">
				{/* Top Controls: Mode Tabs */}
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-xl font-bold text-foreground sm:text-2xl">
							Simulasi & Analisis Nilai IKPA
						</h1>
						<p className="text-xs text-muted-foreground sm:text-sm">
							Lakukan perhitungan skenario, periksa histori formula, dan
							simulasikan target nilai satker.
						</p>
					</div>
					<div className="w-full sm:w-80">
						<SimulationModeTabs activeMode={mode} onModeChange={setMode} />
					</div>
				</div>

				<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
					{/* Left Panel: Inputs & Parameter Overrides */}
					<div className="space-y-4 lg:col-span-7">
						<SimulationContextForm
							targetScore={targetScore}
							fiscalYear={context.fiscalYear.year}
							periodMonth={periodMonth}
							isBlu={isBlu}
							hasUnsavedChanges={mode !== "actual"}
							onTargetChange={setTargetScore}
							onPeriodChange={setPeriodMonth}
							onBluChange={setIsBlu}
							onReset={() => {
								setTargetScore(95.0);
								setPeriodMonth(8);
								setIsBlu(false);
								setMode("actual");
							}}
						/>

						{/* Indicator Simulation Cards List */}
						<div className="space-y-3 rounded-2xl border border-border bg-background p-4 shadow-xs sm:p-5">
							<h3 className="text-sm font-semibold text-foreground">
								Override Variabel per Indikator
							</h3>
							<p className="text-xs text-muted-foreground">
								Pilih indikator untuk melihat rincian formula atau melakukan
								simulasi angka.
							</p>

							<div className="space-y-2 pt-2">
								{dashboardData.indicators.map((ind) => (
									<button
										key={ind.id}
										type="button"
										onClick={() => setSelectedIndicator(ind.code)}
										className={`flex w-full items-center justify-between rounded-xl border p-3 text-left text-xs transition ${
											selectedIndicator === ind.code
												? "border-primary bg-primary/5 ring-1 ring-primary"
												: "border-border hover:bg-surface-muted"
										}`}
									>
										<div>
											<span className="font-semibold text-foreground">
												{ind.name}
											</span>
											<p className="text-[11px] text-muted-foreground">
												{ind.summary}
											</p>
										</div>
										<div className="text-right">
											<span className="font-semibold text-foreground">
												{ind.weightedScore} Poin
											</span>
											<span className="block text-[10px] text-muted-foreground">
												Bobot: {ind.weight}%
											</span>
										</div>
									</button>
								))}
							</div>
						</div>

						{/* Formula Trace Drawer/Box */}
						{selectedIndicator === "tagihan" && (
							<FormulaTrace
								indicatorName="Penyelesaian Tagihan (SPM-LS)"
								formulaFormula="(Jumlah SPM Tepat Waktu / Total SPM Terbit) × 100"
								ruleSetVersion={dashboardData.ruleSetVersion}
								inputValues={[
									{
										label: "SPM Tepat Waktu",
										value: mode === "scenario" ? 15 : 13,
									},
									{ label: "Total SPM", value: 15 },
									{ label: "Batas Kebijakan", value: "17 Hari Kerja" },
								]}
							/>
						)}
					</div>

					{/* Right Panel: Sticky Simulation Results */}
					<div className="lg:sticky lg:top-6 lg:col-span-5">
						<SimulationResult
							totalScore={currentTotalScore}
							targetScore={targetScore}
							gapScore={currentGap}
							deltaFromActual={mode !== "actual" ? scoreBonus : undefined}
							indicators={dashboardData.indicators}
							onSaveSnapshot={() => {
								alert("Snapshot nilai berhasil disimpan.");
							}}
							onSaveScenario={() => {
								alert("Skenario simulasi berhasil disimpan.");
							}}
							onCompareClick={() => {
								window.location.href = "/operator/history";
							}}
						/>
					</div>
				</div>
			</div>
		</OperatorShell>
	);
}

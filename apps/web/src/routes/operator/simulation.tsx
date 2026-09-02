import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
	AlertCircle,
	CheckCircle2,
	History,
	Sparkles,
} from "lucide-react";
import { useState } from "react";
import { OperatorShell } from "@/components/layout/operator-shell";
import { FormulaTrace } from "@/components/operator/formula-trace";
import { SimulationContextForm } from "@/components/operator/simulation-context-form";
import {
	type SimulationMode,
	SimulationModeTabs,
} from "@/components/operator/simulation-mode-tabs";
import { SimulationResult } from "@/components/operator/simulation-result";
import type { IndicatorScoreItem } from "@/mocks/operator-dashboard";
import {
	executeSimulation,
	fetchSnapshots,
} from "@/services/simulation-service";

export const Route = createFileRoute("/operator/simulation")({
	loader: async ({ context }) => {
		const activeOrgId =
			context.auth?.isAuthenticated &&
			(context.access?.status === "operator_single_scope" ||
				context.access?.status === "operator_multiple_scopes")
				? (context.access.activeOrganizationId ?? undefined)
				: undefined;

		const [simResult, snapshotData] = await Promise.all([
			executeSimulation({
				orgId: activeOrgId,
				simulationType: "actual",
				period: { kind: "month", value: 8 },
			}),
			fetchSnapshots(activeOrgId),
		]);

		return {
			simulation: simResult,
			snapshots: snapshotData.snapshots,
		};
	},
	component: OperatorSimulationPage,
});

const FORMULA_EXPLANATIONS: Record<
	string,
	{ name: string; formula: string; logic: string }
> = {
	REVISI_DIPA: {
		name: "Revisi DIPA",
		formula: "100 - (Jumlah Revisi per Semester × Pinalti)",
		logic: "Maksimal 1 kali revisi per semester yang diperhitungkan.",
	},
	DEV_HAL_III: {
		name: "Deviasi Halaman III DIPA",
		formula: "100 - (|Realisasi - RPD| / RPD) × 100",
		logic: "Dihitung per jenis belanja (51, 52, 53, 57) dengan toleransi 5%.",
	},
	PENYERAPAN: {
		name: "Penyerapan Anggaran",
		formula: "(Realisasi Kumulatif / Pagu DIPA) × 100",
		logic: "Target triwulanan (Q1 20%, Q2 50%, Q3 75%, Q4 95%).",
	},
	BELANJA_KONTRAKTUAL: {
		name: "Belanja Kontraktual",
		formula: "(Kontrak Tepat Waktu 3 HK / Total Kontrak) × 100",
		logic: "Penyampaian data kontrak maksimal 3 hari kerja ke KPPN.",
	},
	UP_TUP: {
		name: "Pengelolaan UP dan TUP",
		formula: "(GUP Tepat Waktu 1 Bulan / Total GUP) × 100",
		logic: "Revolving minimal 1 kali sebulan dan porsi penggunaan KKP.",
	},
	TAGIHAN: {
		name: "Penyelesaian Tagihan (SPM-LS)",
		formula: "(SPM-LS Tepat Waktu 17 HK / Total SPM-LS) × 100",
		logic: "Penerbitan SPM-LS maksimal 17 hari kerja setelah BAST.",
	},
	CAPAIAN_OUTPUT: {
		name: "Capaian Output",
		formula: "(PCRO × 0.7) + (RVRO × 0.3)",
		logic: "Pelaporan dan konfirmasi sebelum batas 5 hari kerja awal bulan.",
	},
};

function OperatorSimulationPage() {
	const router = useRouter();
	const loaderData = Route.useLoaderData();

	const [mode, setMode] = useState<SimulationMode>("actual");
	const [targetScore, setTargetScore] = useState(95.0);
	const [periodMonth, setPeriodMonth] = useState(8);
	const [isBlu, setIsBlu] = useState(false);
	const [selectedIndicator, setSelectedIndicator] = useState<string>("TAGIHAN");
	const [actionMessage, setActionMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	// Simulation current data
	const simOutput = loaderData.simulation.output as any;
	const totalScoreVal = Number.parseFloat(
		loaderData.simulation.totalScore || "95.00",
	);

	// Map indicators to UI format
	const rawIndicators = (simOutput?.indicators ?? []) as any[];
	const indicatorList: IndicatorScoreItem[] =
		rawIndicators.length > 0
			? rawIndicators.map((ind: any) => {
					const rawVal = Number.parseFloat(ind.score ?? "100") || 0;
					const weightVal = Number.parseFloat(ind.weight ?? "10") || 0;
					const weightedVal =
						Number.parseFloat(ind.weightedScore ?? "10") || 0;
					const status =
						rawVal >= 90
							? ("complete" as const)
							: rawVal >= 75
								? ("warning" as const)
								: ("danger" as const);
					const statusLabel =
						rawVal >= 90
							? "Optimal"
							: rawVal >= 75
								? "Perlu Perhatian"
								: "Kritis";

					const codeKey = (ind.key || ind.code || "").toUpperCase();
					return {
						id: ind.key || ind.code || "ind",
						code: codeKey,
						name:
							FORMULA_EXPLANATIONS[codeKey]?.name ||
							ind.name ||
							ind.key,
						weight: weightVal,
						rawScore: rawVal,
						weightedScore: weightedVal,
						status,
						statusLabel,
						deltaPoints: 0,
						summary:
							FORMULA_EXPLANATIONS[codeKey]?.logic ||
							"Penilaian indikator IKPA",
					};
				})
			: [
					{
						id: "1",
						code: "REVISI_DIPA",
						name: "Revisi DIPA",
						weight: 10,
						rawScore: 100,
						weightedScore: 10,
						status: "complete" as const,
						statusLabel: "Optimal",
						deltaPoints: 0,
						summary: "Maksimal 1 kali revisi per semester",
					},
					{
						id: "2",
						code: "DEV_HAL_III",
						name: "Deviasi Halaman III DIPA",
						weight: 15,
						rawScore: 92.5,
						weightedScore: 13.88,
						status: "complete" as const,
						statusLabel: "Optimal",
						deltaPoints: 0,
						summary: "Deviasi RPD rata-rata di bawah 5%",
					},
					{
						id: "3",
						code: "PENYERAPAN",
						name: "Penyerapan Anggaran",
						weight: 20,
						rawScore: 95.0,
						weightedScore: 19.0,
						status: "complete" as const,
						statusLabel: "Optimal",
						deltaPoints: 0,
						summary: "Realisasi sesuai target triwulanan",
					},
					{
						id: "4",
						code: "BELANJA_KONTRAKTUAL",
						name: "Belanja Kontraktual",
						weight: 10,
						rawScore: 90.0,
						weightedScore: 9.0,
						status: "complete" as const,
						statusLabel: "Optimal",
						deltaPoints: 0,
						summary: "Kepatuhan pendaftaran kontrak 3 HK",
					},
					{
						id: "5",
						code: "UP_TUP",
						name: "Pengelolaan UP dan TUP",
						weight: 10,
						rawScore: 98.0,
						weightedScore: 9.8,
						status: "complete" as const,
						statusLabel: "Optimal",
						deltaPoints: 0,
						summary: "Revolving GUP tepat waktu & pemanfaatan KKP",
					},
					{
						id: "6",
						code: "TAGIHAN",
						name: "Penyelesaian Tagihan",
						weight: 10,
						rawScore: 96.0,
						weightedScore: 9.6,
						status: "complete" as const,
						statusLabel: "Optimal",
						deltaPoints: 0,
						summary: "Penerbitan SPM-LS sebelum 17 HK",
					},
					{
						id: "7",
						code: "CAPAIAN_OUTPUT",
						name: "Capaian Output",
						weight: 25,
						rawScore: 94.0,
						weightedScore: 23.5,
						status: "complete" as const,
						statusLabel: "Optimal",
						deltaPoints: 0,
						summary: "Progres fisik PCRO dan volume RVRO",
					},
				];

	const handleSaveSnapshot = async (scenarioName?: string) => {
		setActionMessage(null);
		setErrorMessage(null);
		try {
			await executeSimulation({
				simulationType: mode,
				targetScore: targetScore.toFixed(2),
				period: { kind: "month", value: periodMonth },
				simulationName:
					scenarioName ||
					`Simulasi ${mode.toUpperCase()} Bulan ${periodMonth} - ${new Date().toLocaleTimeString("id-ID")}`,
			});

			setActionMessage("Snapshot hasil simulasi berhasil disimpan permanen ke database.");
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal menyimpan snapshot simulasi.",
			);
		}
	};

	const currentGap = totalScoreVal - targetScore;

	return (
		<OperatorShell currentPath="/operator/simulation">
			<div className="space-y-6">
				{/* Top Controls: Mode Tabs */}
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-3">
						<div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<Sparkles className="size-5" />
						</div>
						<div>
							<h1 className="text-xl font-bold text-foreground sm:text-2xl">
								Simulasi &amp; Engine Kalkulasi Nilai IKPA
							</h1>
							<p className="text-xs text-muted-foreground sm:text-sm">
								Lakukan kalkulasi skenario real-time, pantau rumus formula tiap
								indikator, dan simulasikan proyeksi target nilai satker.
							</p>
						</div>
					</div>
					<div className="w-full sm:w-80">
						<SimulationModeTabs activeMode={mode} onModeChange={setMode} />
					</div>
				</div>

				{/* Feedback status */}
				{actionMessage && (
					<output className="flex items-center gap-2.5 rounded-xl border border-success/30 bg-success/10 p-4 text-xs font-semibold text-success shadow-xs">
						<CheckCircle2 className="size-4 shrink-0" />
						<p>{actionMessage}</p>
					</output>
				)}

				{errorMessage && (
					<div
						role="alert"
						className="flex items-center gap-2.5 rounded-xl border border-danger/30 bg-danger/10 p-4 text-xs font-semibold text-danger shadow-xs"
					>
						<AlertCircle className="size-4 shrink-0" />
						<p>{errorMessage}</p>
					</div>
				)}

				<div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
					{/* Left Panel: Inputs & Parameter Overrides */}
					<div className="space-y-4 lg:col-span-7">
						<SimulationContextForm
							targetScore={targetScore}
							fiscalYear={2026}
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
							<div className="flex items-center justify-between">
								<h3 className="text-sm font-semibold text-foreground">
									Rincian 7 Indikator Penilaian IKPA
								</h3>
								<span className="text-[11px] text-muted-foreground">
									Klik untuk melihat formula
								</span>
							</div>

							<div className="space-y-2 pt-1">
								{indicatorList.map((ind) => {
									const isSelected =
										selectedIndicator.toLowerCase() ===
										ind.code.toLowerCase();
									return (
										<button
											key={ind.id}
											type="button"
											onClick={() => setSelectedIndicator(ind.code)}
											className={`flex w-full items-center justify-between rounded-xl border p-3 text-left text-xs transition ${
												isSelected
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
												<span className="font-bold text-foreground">
													{ind.weightedScore.toFixed(2)} Poin
												</span>
												<span className="block text-[10px] text-muted-foreground">
													Nilai: {ind.rawScore.toFixed(2)} | Bobot: {ind.weight}%
												</span>
											</div>
										</button>
									);
								})}
							</div>
						</div>

						{/* Formula Trace Box */}
						{selectedIndicator && FORMULA_EXPLANATIONS[selectedIndicator.toUpperCase()] && (
							<FormulaTrace
								indicatorName={
									FORMULA_EXPLANATIONS[selectedIndicator.toUpperCase()]
										?.name || selectedIndicator
								}
								formulaFormula={
									FORMULA_EXPLANATIONS[selectedIndicator.toUpperCase()]
										?.formula || "Nilai Indikator × Bobot %"
								}
								ruleSetVersion="2026.1"
								inputValues={[
									{
										label: "Status Kepatuhan",
										value: "Sesuai Regulasi PER-5/PB/2024",
									},
									{
										label: "Metode Penilaian",
										value:
											FORMULA_EXPLANATIONS[
												selectedIndicator.toUpperCase()
											]?.logic || "Standar",
									},
									{
										label: "Bobot Indikator",
										value: `${
											indicatorList.find(
												(i) =>
													i.code.toUpperCase() ===
													selectedIndicator.toUpperCase(),
											)?.weight || 10
										}%`,
									},
								]}
							/>
						)}
					</div>

					{/* Right Panel: Sticky Simulation Results */}
					<div className="lg:sticky lg:top-6 lg:col-span-5 space-y-4">
						<SimulationResult
							totalScore={totalScoreVal}
							targetScore={targetScore}
							gapScore={currentGap}
							deltaFromActual={mode !== "actual" ? 1.5 : undefined}
							indicators={indicatorList}
							onSaveSnapshot={() => handleSaveSnapshot()}
							onSaveScenario={() =>
								handleSaveSnapshot(`Skenario Optimalisasi IKPA - ${new Date().toLocaleDateString("id-ID")}`)
							}
							onCompareClick={() => {
								window.location.href = "/operator/history";
							}}
						/>

						{/* Saved Snapshots Mini-List */}
						{loaderData.snapshots && loaderData.snapshots.length > 0 && (
							<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-3">
								<div className="flex items-center justify-between text-xs">
									<span className="font-semibold text-foreground flex items-center gap-1.5">
										<History className="size-3.5 text-primary" />
										<span>Histori Snapshot Tersimpan</span>
									</span>
									<span className="text-[11px] text-muted-foreground">
										{loaderData.snapshots.length} Data
									</span>
								</div>

								<div className="space-y-2 max-h-48 overflow-y-auto pr-1">
									{loaderData.snapshots.slice(0, 5).map((snap) => (
										<div
											key={snap.id}
											className="flex items-center justify-between rounded-lg border border-border/80 bg-surface p-2.5 text-xs"
										>
											<div>
												<p className="font-semibold text-foreground truncate max-w-[180px]">
													{snap.simulationName}
												</p>
												<span className="text-[10px] text-muted-foreground">
													{new Date(snap.createdAt).toLocaleDateString("id-ID", {
														day: "numeric",
														month: "short",
														hour: "2-digit",
														minute: "2-digit",
													})}
												</span>
											</div>
											<span className="font-bold text-primary">
												{Number.parseFloat(snap.totalScore ?? "0").toFixed(2)}
											</span>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</OperatorShell>
	);
}

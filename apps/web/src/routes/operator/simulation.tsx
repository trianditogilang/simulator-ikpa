import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
	AlertCircle,
	CheckCircle2,
	Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { default2026RuleSet } from "@simulator-ikpa/ikpa-engine";
import { calculateUpTup } from "@simulator-ikpa/ikpa-engine";
import { OperatorShell } from "@/components/layout/operator-shell";
import { SimulationContextForm } from "@/components/operator/simulation-context-form";
import {
	type SimulationMode,
	SimulationModeTabs,
} from "@/components/operator/simulation-mode-tabs";
import { SimulationResult } from "@/components/operator/simulation-result";
import { DispensasiAssumptionPanel } from "@/components/operator/dispensasi-assumption-panel";
import { UpTupAssumptionPanel } from "@/components/operator/up-tup-assumption-panel";
import type { IndicatorScoreItem } from "@/mocks/operator-dashboard";
import { calcDispensasiPreview, DEFAULT_DISPENSASI_ASSUMPTIONS } from "@/lib/simulation/dispensasi-assumptions";
import {
	buildUpTupEngineInput,
	DEFAULT_UP_TUP_ASSUMPTIONS,
	EMPTY_SIMULATION_ASSUMPTIONS,
	hasSimulationChanges,
	TOTAL_IKPA_FORMULA,
	type SimulationAssumptions,
} from "@/lib/simulation/up-tup-assumptions";
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

const INDICATOR_NAMES: Record<string, string> = {
	REVISI_DIPA: "Revisi DIPA",
	DEV_HAL_III: "Deviasi Halaman III DIPA",
	PENYERAPAN: "Penyerapan Anggaran",
	BELANJA_KONTRAKTUAL: "Belanja Kontraktual",
	UP_TUP: "Pengelolaan UP dan TUP",
	TAGIHAN: "Penyelesaian Tagihan",
	CAPAIAN_OUTPUT: "Capaian Output",
	SPM_DISPENSASI: "SPM Dispensasi",
};

const ENGINE_KEY_TO_CODE: Record<string, string> = {
	dipa_revision: "REVISI_DIPA",
	rpd_deviation: "DEV_HAL_III",
	budget_absorption: "PENYERAPAN",
	contractual: "BELANJA_KONTRAKTUAL",
	invoice_timeliness: "TAGIHAN",
	up_tup: "UP_TUP",
	output_achievement: "CAPAIAN_OUTPUT",
};

function toDisplayList(
	rawIndicators: any[],
	deductionRaw: string | number | null | undefined,
): { list: IndicatorScoreItem[]; deduction: number } {
	const list: IndicatorScoreItem[] = (rawIndicators ?? []).map((ind: any) => {
		const rawVal = Number.parseFloat(ind.score ?? ind.rawScore ?? "100") || 0;
		const weightVal =
			Number.parseFloat(ind.weight ?? "10") || 0;
		const weightedVal =
			Number.parseFloat(
				ind.weightedScore ?? ind.weightedContribution ?? "0",
			) || 0;
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
		const codeKey = (
			ind.code ??
			ENGINE_KEY_TO_CODE[ind.key] ??
			ind.key ??
			"ind"
		)
			.toString()
			.toUpperCase();
		return {
			id: ind.key ?? ind.code ?? codeKey,
			code: codeKey,
			name: INDICATOR_NAMES[codeKey] ?? ind.name ?? ind.key,
			weight: weightVal,
			rawScore: rawVal,
			weightedScore: weightedVal,
			status,
			statusLabel,
			deltaPoints: 0,
			summary: ind.isDeduction ? "Pengurang total" : `Bobot ${weightVal}%`,
		};
	});

	const deduction = deductionRaw === null || deductionRaw === undefined
		? 0
		: Number(deductionRaw) || 0;

	list.push({
		id: "spm_dispensasi",
		code: "SPM_DISPENSASI",
		name: "SPM Dispensasi",
		weight: 0,
		rawScore: deduction,
		weightedScore: -deduction,
		status: deduction > 0 ? ("warning" as const) : ("complete" as const),
		statusLabel: deduction > 0 ? "Pengurang" : "Tanpa pengurang",
		deltaPoints: -deduction,
		summary:
			deduction > 0
				? `Pengurang ${deduction.toFixed(2)} poin dari total`
				: "Tidak ada SPM dispensasi Q4",
		isDeduction: true,
	});

	return { list, deduction };
}

function OperatorSimulationPage() {
	const router = useRouter();
	const loaderData = Route.useLoaderData();

	const [mode, setMode] = useState<SimulationMode>("actual");
	const [targetScore, setTargetScore] = useState(95.0);
	const [periodMonth, setPeriodMonth] = useState(8);
	const [isBlu, setIsBlu] = useState(false);
	const [actionMessage, setActionMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [assumptions, setAssumptions] = useState<SimulationAssumptions>(
		EMPTY_SIMULATION_ASSUMPTIONS,
	);

	const simOutput = (loaderData.simulation as any)?.output ?? loaderData.simulation;
	const rawIndicators = (simOutput?.indicators ?? []) as any[];
	const deductionRaw =
		(simOutput?.dispensationDeduction ??
			(simOutput as any)?.deduction ??
			(loaderData.simulation as any)?.deductions?.[0]?.deduction ??
			0) as string | number;

	const actual = useMemo(
		() => toDisplayList(rawIndicators, deductionRaw),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[JSON.stringify(rawIndicators), String(deductionRaw)],
	);
	const actualTotal =
		Number.parseFloat(
			(simOutput?.totalScore as string) ??
				(loaderData.simulation as any)?.totalScore ??
				"0",
		) || 0;

	const scenarioUpTup = useMemo(() => {
		if (!assumptions.upTup) return null;
		try {
			const input = buildUpTupEngineInput(assumptions.upTup);
			const res = calculateUpTup(
				{
					transactions: input.transactions as never,
					kkpTransactions: input.kkpTransactions as never,
				},
				{ kind: "month", value: periodMonth } as never,
				default2026RuleSet,
			);
			return res;
		} catch {
			return null;
		}
	}, [assumptions.upTup, periodMonth]);

	const displayed = useMemo(() => {
		const isActualMode = mode === "actual";
		const scenUpTupScore = scenarioUpTup?.score ? Number(scenarioUpTup.score) : null;
		const scenUpTupContrib = scenarioUpTup?.weightedContribution
			? Number(scenarioUpTup.weightedContribution)
			: null;
		const dispPreview = assumptions.dispensasi
			? calcDispensasiPreview(assumptions.dispensasi)
			: null;
		const useUpTup = !isActualMode && assumptions.upTup && scenUpTupScore !== null && scenUpTupContrib !== null;
		const useDisp = !isActualMode && assumptions.dispensasi && dispPreview?.isValid;
		if (!useUpTup && !useDisp) {
			return {
				list: actual.list,
				total: actualTotal,
				deduction: actual.deduction,
				isPreview: false,
			};
		}
		const list = actual.list.map((ind) => {
			if (ind.code === "UP_TUP" && useUpTup && scenUpTupScore !== null && scenUpTupContrib !== null) {
				return {
					...ind,
					rawScore: scenUpTupScore,
					weightedScore: scenUpTupContrib,
					status: scenUpTupScore >= 90 ? ("complete" as const) : scenUpTupScore >= 75 ? ("warning" as const) : ("danger" as const),
					statusLabel: "Skenario",
					summary: "Hasil asumsi UP/TUP",
				};
			}
			if (ind.code === "SPM_DISPENSASI" && useDisp && dispPreview) {
				return {
					...ind,
					rawScore: dispPreview.deduction,
					weightedScore: -dispPreview.deduction,
					status: dispPreview.deduction > 0 ? ("warning" as const) : ("complete" as const),
					statusLabel: dispPreview.deduction > 0 ? "Pengurang" : "Tanpa pengurang",
					deltaPoints: -dispPreview.deduction,
					summary: `Rasio ${dispPreview.ratio.toFixed(3)}‰`,
					isDeduction: true,
				};
			}
			return ind;
		});
		const total = list
			.filter((i) => !i.isDeduction)
			.reduce((s, i) => s + i.weightedScore, 0) -
			(list.find((i) => i.isDeduction)?.rawScore ?? 0);
		return { list, total, deduction: list.find((i) => i.isDeduction)?.rawScore ?? 0, isPreview: true };
	}, [mode, assumptions.upTup, assumptions.dispensasi, scenarioUpTup, actual, actualTotal]);

	const hasChanges = hasSimulationChanges(assumptions);
	const showPreview = displayed.isPreview;
	const deltaFromActual = showPreview ? displayed.total - actualTotal : 0;
	const currentGap = displayed.total - targetScore;

	const handleSaveSnapshot = async (scenarioName?: string) => {
		setActionMessage(null);
		setErrorMessage(null);
		try {
			const isScenarioSave = Boolean(scenarioName);
			if (isScenarioSave && !hasChanges) {
				setErrorMessage(
					"Simpan Skenario membutuhkan perubahan asumsi.",
				);
				return;
			}
			await executeSimulation({
				simulationType: isScenarioSave ? "scenario" : mode,
				targetScore: targetScore.toFixed(2),
				period: { kind: "month", value: periodMonth },
				assumptions: showPreview
					? {
							upTup: assumptions.upTup,
							dispensasi: assumptions.dispensasi,
						}
					: undefined,
				simulationName:
					scenarioName ??
					`Hasil ${mode.toUpperCase()} Bulan ${periodMonth} - ${new Date().toLocaleTimeString("id-ID")}`,
			});

			setActionMessage(
				isScenarioSave
					? "Skenario (dengan perubahan asumsi) berhasil disimpan. Data aktual tidak berubah."
					: "Hasil yang sedang tampil berhasil diarsipkan. Data aktual tidak berubah.",
			);
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal menyimpan snapshot simulasi.",
			);
		}
	};

	return (
		<OperatorShell currentPath="/operator/simulation">
			<div className="space-y-6">
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
								Aktual dari data tersimpan · Proyeksi/Skenario dari asumsi
								operasional · Target hanya pembanding gap.
							</p>
						</div>
					</div>
					<div className="w-full sm:w-80">
						<SimulationModeTabs activeMode={mode} onModeChange={setMode} />
					</div>
				</div>

				<p className="rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[11px] text-muted-foreground">
					{TOTAL_IKPA_FORMULA}
				</p>

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
					<div className="space-y-4 lg:col-span-7">
						<SimulationContextForm
							targetScore={targetScore}
							fiscalYear={2026}
							periodMonth={periodMonth}
							isBlu={isBlu}
							hasUnsavedChanges={mode !== "actual" || hasChanges}
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
						<p className="px-1 text-[10px] text-muted-foreground">
							Target hanya pembanding (gap = tampil − target).
						</p>

						{assumptions.upTup ? (
							<UpTupAssumptionPanel
								value={assumptions.upTup}
								actualUpTupContrib={actual.list.find((i) => i.code === "UP_TUP")?.weightedScore ?? null}
								onChange={(next) =>
									setAssumptions((s) => ({ ...s, upTup: next }))
								}
								onReset={() =>
									setAssumptions((s) => ({
										...s,
										upTup: { ...DEFAULT_UP_TUP_ASSUMPTIONS },
									}))
								}
							/>
						) : (
							<div className="space-y-2 rounded-2xl border border-dashed border-border bg-background p-4 text-xs sm:p-5">
								<h3 className="text-sm font-semibold text-foreground">
									Atur Asumsi UP/TUP
								</h3>
								<button
									type="button"
									onClick={() =>
										setAssumptions((s) => ({
											...s,
											upTup: { ...DEFAULT_UP_TUP_ASSUMPTIONS },
										}))
									}
									className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover"
								>
									Aktifkan asumsi UP/TUP
								</button>
							</div>
						)}
						{assumptions.upTup && (
							<button
								type="button"
								onClick={() =>
									setAssumptions((s) => ({ ...s, upTup: null }))
								}
								className="px-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:underline"
							>
								Nonaktifkan asumsi
							</button>
						)}

						{assumptions.dispensasi ? (
							<DispensasiAssumptionPanel
								value={assumptions.dispensasi}
								actualDeduction={actual.deduction}
								onChange={(next) => setAssumptions((s) => ({ ...s, dispensasi: next }))}
								onReset={() => setAssumptions((s) => ({ ...s, dispensasi: { ...DEFAULT_DISPENSASI_ASSUMPTIONS } }))}
							/>
						) : (
							<div className="space-y-2 rounded-2xl border border-dashed border-border bg-background p-4 text-xs sm:p-5">
								<h3 className="text-sm font-semibold text-foreground">
									Atur Asumsi SPM Dispensasi
								</h3>
								<button
									type="button"
									onClick={() => setAssumptions((s) => ({ ...s, dispensasi: { ...DEFAULT_DISPENSASI_ASSUMPTIONS } }))}
									className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover"
								>
									Aktifkan asumsi dispensasi
								</button>
							</div>
						)}
						{assumptions.dispensasi && (
							<button
								type="button"
								onClick={() => setAssumptions((s) => ({ ...s, dispensasi: null }))}
								className="px-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:underline"
							>
								Nonaktifkan asumsi
							</button>
						)}

						<div className="space-y-3 rounded-2xl border border-border bg-background p-4 shadow-xs sm:p-5">
							<h3 className="text-sm font-semibold text-foreground">
								Rincian 8 Indikator
								{showPreview && (
									<span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
										pratinjau {mode}
									</span>
								)}
							</h3>

							<div className="space-y-2 pt-1">
								{displayed.list.map((ind) => (
									<div
										key={ind.id}
										className="flex w-full items-center justify-between rounded-xl border border-border p-3 text-left text-xs"
									>
										<div>
											<span className="font-semibold text-foreground">
												{ind.name}
												{ind.isDeduction && (
													<span className="ml-1.5 rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-semibold text-danger">
														pengurang
													</span>
												)}
											</span>
											<p className="text-[11px] text-muted-foreground">
												{ind.summary}
											</p>
										</div>
										<div className="text-right">
											<span className="font-bold text-foreground">
												{`${ind.weightedScore.toFixed(2)} Poin`}
											</span>
											<span className="block text-[10px] text-muted-foreground">
												{ind.isDeduction
													? `Pengurang: ${ind.rawScore.toFixed(2)}`
													: `Nilai: ${ind.rawScore.toFixed(2)} | Bobot: ${ind.weight}%`}
											</span>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>

					<div className="lg:sticky lg:top-6 lg:col-span-5 space-y-4">
						<SimulationResult
							totalScore={displayed.total}
							targetScore={targetScore}
							gapScore={currentGap}
							deltaFromActual={showPreview ? deltaFromActual : undefined}
							indicators={displayed.list}
							deductionInfo={{
								deduction: displayed.deduction,
							}}
							totalFormulaNote={TOTAL_IKPA_FORMULA}
							onSaveSnapshot={() => handleSaveSnapshot()}
							onSaveScenario={() =>
								handleSaveSnapshot(`Skenario ${mode.toUpperCase()} - ${new Date().toLocaleDateString("id-ID")}`)
							}
							saveScenarioDisabled={!hasChanges}
							saveScenarioHint={
								hasChanges
									? "Skenario tersimpan memakai asumsi; aktual tidak berubah."
									: "Simpan Skenario aktif setelah ada perubahan asumsi."
							}
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

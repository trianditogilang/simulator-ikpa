import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";
import { formatNumber, formatPointDelta } from "@/lib/format";
import type { IndicatorScoreItem } from "@/mocks/operator-dashboard";

export interface SimulationResultProps extends ComponentProps<"div"> {
	totalScore: number;
	targetScore: number;
	gapScore: number;
	deltaFromActual?: number;
	indicators: IndicatorScoreItem[];
	deductionInfo?: { deduction: number; ratioLabel?: string } | null;
	totalFormulaNote?: string;
	onSaveSnapshot?: () => void;
	onSaveScenario?: () => void;
	saveScenarioDisabled?: boolean;
	saveScenarioHint?: string;
	onCompareClick?: () => void;
}

export function SimulationResult({
	totalScore,
	targetScore,
	gapScore,
	deltaFromActual,
	indicators,
	deductionInfo,
	totalFormulaNote,
	onSaveSnapshot,
	onSaveScenario,
	saveScenarioDisabled,
	saveScenarioHint,
	onCompareClick,
	className,
	...props
}: SimulationResultProps) {
	const isGapNegative = gapScore < 0;

	return (
		<div
			{...props}
			className={twMerge(
				"flex flex-col justify-between rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6",
				className,
			)}
			data-slot="simulation-result"
		>
			<div className="space-y-4">
				<div className="flex items-center justify-between border-b border-border/80 pb-3">
					<h3 className="text-sm font-semibold text-foreground sm:text-base">
						Hasil Perhitungan Simulasi
					</h3>
					{deltaFromActual !== undefined && deltaFromActual !== 0 && (
						<span
							className={twMerge(
								"rounded-md px-2 py-0.5 text-xs font-semibold",
								deltaFromActual > 0
									? "bg-success/10 text-success"
									: "bg-danger/10 text-danger",
							)}
						>
							{formatPointDelta(deltaFromActual)} vs Actual
						</span>
					)}
				</div>

				<div className="rounded-xl bg-surface p-4">
					<div className="flex items-baseline justify-between">
						<div>
							<span className="text-xs text-muted-foreground">
								Nilai Simulasi
							</span>
							<p className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
								{formatNumber(totalScore)}
							</p>
						</div>
						<div className="text-right">
							<span className="text-xs text-muted-foreground">
								Target: {formatNumber(targetScore)}
							</span>
							<p
								className={twMerge(
									"text-xs font-semibold",
									isGapNegative ? "text-danger" : "text-success",
								)}
							>
								Gap: {formatPointDelta(gapScore)}
							</p>
						</div>
					</div>
				</div>

				<div className="space-y-2">
					<h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
						Rincian 8 Indikator (7 berbobot + SPM Dispensasi pengurang)
					</h4>
					{totalFormulaNote && (
						<p className="text-[10px] leading-relaxed text-muted-foreground">
							{totalFormulaNote}
						</p>
					)}
					<div className="divide-y divide-border/60 rounded-xl border border-border/70 bg-surface/50 p-2 text-xs">
						{indicators.map((ind) => (
							<div
								key={ind.id}
								className="flex items-center justify-between py-1.5 px-2"
							>
								<span className="text-foreground">
									{ind.name}
									{ind.isDeduction && (
										<span className="ml-1.5 rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-semibold text-danger">
											pengurang
										</span>
									)}
								</span>
								<span className="font-semibold text-foreground">
									{ind.isDeduction
										? formatPointDelta(ind.weightedScore)
										: formatNumber(ind.weightedScore)}
								</span>
							</div>
						))}
					</div>
					{deductionInfo && (
						<p className="text-[10px] leading-relaxed text-muted-foreground">
							SPM Dispensasi: pengurang {formatPointDelta(-deductionInfo.deduction)}
							{deductionInfo.ratioLabel ? ` · ${deductionInfo.ratioLabel}` : ""}.
							Total = Σ 7 kontribusi − pengurang.
						</p>
					)}
				</div>
			</div>

			<div className="mt-5 space-y-2 border-t border-border/80 pt-4">
				<div className="grid grid-cols-2 gap-2">
					{onSaveSnapshot && (
						<button
							type="button"
							onClick={onSaveSnapshot}
							title="Mengarsipkan hasil yang sedang tampil (aktual/proyeksi/skenario)"
							className="rounded-lg border border-border bg-background py-2 text-xs font-semibold text-foreground transition hover:bg-surface-muted"
						>
							Simpan Hasil Saat Ini
						</button>
					)}
					{onSaveScenario && (
						<button
							type="button"
							onClick={onSaveScenario}
							disabled={saveScenarioDisabled}
							title={
								saveScenarioHint ??
								"Hanya aktif bila ada perubahan asumsi (skenario benar-benar berubah)"
							}
							className="rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
						>
							Simpan Skenario
						</button>
					)}
				</div>
				{saveScenarioDisabled && saveScenarioHint && (
					<p className="text-[10px] leading-relaxed text-muted-foreground">
						{saveScenarioHint}
					</p>
				)}
				{onCompareClick && (
					<button
						type="button"
						onClick={onCompareClick}
						className="w-full rounded-lg bg-surface py-1.5 text-center text-xs font-semibold text-primary transition hover:bg-surface-muted"
					>
						Bandingkan Skenario
					</button>
				)}
			</div>
		</div>
	);
}

import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";
import { formatNumber, formatPointDelta } from "@/lib/format";

export interface ScoreCardProps extends ComponentProps<"div"> {
	totalScore: number | null;
	targetScore: number;
	gapScore: number | null;
	deltaFromPreviousPeriod?: number | null;
	previousPeriodLabel?: string | null;
	dataStatus: "complete" | "estimated" | "incomplete";
	ruleSetVersion: string;
	lastUpdated?: string;
	onHistoryClick?: () => void;
	contextActionLabel?: string;
	onContextActionClick?: () => void;
}

export function ScoreCard({
	totalScore,
	targetScore,
	gapScore,
	deltaFromPreviousPeriod,
	previousPeriodLabel,
	dataStatus,
	ruleSetVersion,
	lastUpdated,
	onHistoryClick,
	contextActionLabel = "Lengkapi Data",
	onContextActionClick,
	className,
	...props
}: ScoreCardProps) {
	const isGapNegative = gapScore !== null && gapScore < 0;
	const isScoreUnavailable = dataStatus === "incomplete" || totalScore === null;

	return (
		<div
			{...props}
			className={twMerge(
				"relative flex flex-col justify-between rounded-2xl border border-border bg-background p-5 shadow-xs sm:p-6",
				className,
			)}
			data-slot="score-card"
		>
			<div>
				<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 pb-3">
					<div>
						<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							Proyeksi Nilai IKPA Satker
						</span>
						{lastUpdated && (
							<p className="text-[11px] text-muted-foreground">
								Diperbarui: {lastUpdated}
							</p>
						)}
					</div>
					<div className="flex items-center gap-1.5">
						<span className="rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-semibold text-primary">
							Rule Set {ruleSetVersion}
						</span>
						<span
							className={twMerge(
								"rounded-md px-2 py-0.5 text-xs font-semibold",
								dataStatus === "complete" && "bg-success/10 text-success",
								dataStatus === "estimated" && "bg-warning/10 text-warning",
								dataStatus === "incomplete" && "bg-danger/10 text-danger",
							)}
						>
							{dataStatus === "complete" && "Data Lengkap"}
							{dataStatus === "estimated" && "Data Estimasi"}
							{dataStatus === "incomplete" && "Data Belum Lengkap"}
						</span>
					</div>
				</div>

				<div className="my-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div className="rounded-xl bg-surface p-4">
						<div className="flex items-center justify-between">
							<span className="text-xs font-medium text-muted-foreground">
								Nilai Total IKPA
							</span>
							{deltaFromPreviousPeriod !== undefined &&
							deltaFromPreviousPeriod !== null ? (
								<span
									className={twMerge(
										"text-[11px] font-semibold",
										deltaFromPreviousPeriod > 0
											? "text-success"
											: deltaFromPreviousPeriod < 0
												? "text-danger"
												: "text-muted-foreground",
									)}
								>
									{deltaFromPreviousPeriod > 0 ? "↑ +" : deltaFromPreviousPeriod < 0 ? "↓ " : ""}
									{deltaFromPreviousPeriod === 0
										? `Tetap vs ${previousPeriodLabel || "periode lalu"}`
										: `${deltaFromPreviousPeriod.toFixed(2)} vs ${previousPeriodLabel || "periode lalu"}`}
								</span>
							) : (
								<span className="text-[10px] text-muted-foreground">
									Belum ada pembanding
								</span>
							)}
						</div>
						<div className="mt-1 flex items-baseline gap-2">
							<span className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
								{isScoreUnavailable ? "—" : formatNumber(totalScore)}
							</span>
							<span className="text-xs text-muted-foreground">/ 100</span>
						</div>
					</div>

					<div className="flex flex-col justify-center rounded-xl bg-surface p-4">
						<div className="flex items-center justify-between text-xs">
							<span className="text-muted-foreground">Target KPPN:</span>
							<span className="font-semibold text-foreground">
								{formatNumber(targetScore)}
							</span>
						</div>
						<div className="mt-2 flex items-center justify-between text-xs">
							<span className="text-muted-foreground">
								Deviasi Target (Gap):
							</span>
							<span
								className={twMerge(
									"font-semibold",
									isGapNegative ? "text-danger" : "text-success",
								)}
							>
								{isScoreUnavailable || gapScore === null
									? "—"
									: formatPointDelta(gapScore)}
							</span>
						</div>
					</div>
				</div>
			</div>

			<div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/80 pt-4">
				<p className="text-[11px] text-muted-foreground sm:max-w-md">
					*Hasil perhitungan merupakan rangkuman langsung 8 indikator IKPA,
					bukan nilai resmi OMSPAN/KPPN.
				</p>
				<div className="flex flex-wrap items-center gap-2">
					{onContextActionClick && (
						<button
							type="button"
							onClick={onContextActionClick}
							className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition hover:border-primary/50 hover:bg-primary/10"
							title="Indikator prioritas rekomendasi sistem untuk dioptimasi"
						>
							<span className="text-[10px] font-bold uppercase tracking-wider text-primary/70">
								Prioritas:
							</span>
							{contextActionLabel}
							<span aria-hidden="true">&rarr;</span>
						</button>
					)}
					{onHistoryClick && (
						<button
							type="button"
							onClick={onHistoryClick}
							className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-2xs transition hover:border-border-strong hover:bg-surface-muted"
						>
							Buka Riwayat &amp; Skenario
						</button>
					)}
				</div>
			</div>
		</div>
	);
}

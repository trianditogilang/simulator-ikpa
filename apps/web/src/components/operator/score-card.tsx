import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";
import { formatNumber, formatPointDelta } from "@/lib/format";

export interface ScoreCardProps extends ComponentProps<"div"> {
	totalScore: number;
	targetScore: number;
	gapScore: number;
	dataStatus: "complete" | "estimated" | "incomplete";
	ruleSetVersion: string;
	lastUpdated?: string;
	onSimulateClick?: () => void;
	onInputClick?: () => void;
}

export function ScoreCard({
	totalScore,
	targetScore,
	gapScore,
	dataStatus,
	ruleSetVersion,
	lastUpdated,
	onSimulateClick,
	onInputClick,
	className,
	...props
}: ScoreCardProps) {
	const isGapNegative = gapScore < 0;

	return (
		<div
			{...props}
			className={twMerge(
				"relative flex flex-col justify-between rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6",
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
						<span className="text-xs font-medium text-muted-foreground">
							Nilai Simulasi IKPA
						</span>
						<div className="mt-1 flex items-baseline gap-2">
							<span className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
								{dataStatus === "incomplete" ? "—" : formatNumber(totalScore)}
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
							<span className="text-muted-foreground">Deviasi Target (Gap):</span>
							<span
								className={twMerge(
									"font-semibold",
									isGapNegative ? "text-danger" : "text-success",
								)}
							>
								{dataStatus === "incomplete"
									? "—"
									: formatPointDelta(gapScore)}
							</span>
						</div>
					</div>
				</div>
			</div>

			<div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/80 pt-4">
				<p className="text-[11px] text-muted-foreground sm:max-w-md">
					*Hasil perhitungan merupakan simulasi internal Satker, bukan nilai resmi
					OMSPAN/KPPN.
				</p>
				<div className="flex items-center gap-2">
					{onInputClick && (
						<button
							type="button"
							onClick={onInputClick}
							className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-surface-muted"
						>
							Input Data
						</button>
					)}
					{onSimulateClick && (
						<button
							type="button"
							onClick={onSimulateClick}
							className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary-hover"
						>
							Buka Simulasi
						</button>
					)}
				</div>
			</div>
		</div>
	);
}

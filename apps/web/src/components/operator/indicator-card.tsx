import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";
import { formatNumber, formatPointDelta } from "@/lib/format";
import type { IndicatorScoreItem } from "@/mocks/operator-dashboard";

export interface IndicatorCardProps extends ComponentProps<"div"> {
	indicator: IndicatorScoreItem;
	onDetailClick?: (indicatorId: string) => void;
}

export function IndicatorCard({
	indicator,
	onDetailClick,
	className,
	...props
}: IndicatorCardProps) {
	const isDeduction = indicator.isDeduction;

	return (
		<div
			{...props}
			className={twMerge(
				"group flex flex-col justify-between rounded-2xl border bg-background p-4 shadow-xs transition hover:shadow-sm sm:p-5",
				isDeduction
					? "border-danger/30 bg-danger/[0.02]"
					: "border-border hover:border-primary/40",
				className,
			)}
			data-slot="indicator-card"
		>
			<div>
				<div className="flex items-center justify-between">
					<span
						className={twMerge(
							"rounded-md px-2 py-0.5 text-xs font-semibold",
							isDeduction
								? "bg-danger/10 text-danger"
								: "bg-surface-muted text-foreground",
						)}
					>
						{isDeduction ? "Faktor Pengurang" : `Bobot ${indicator.weight}%`}
					</span>

					<span
						className={twMerge(
							"text-[11px] font-semibold",
							indicator.status === "complete" && "text-success",
							indicator.status === "warning" && "text-warning",
							indicator.status === "danger" && "text-danger",
							indicator.status === "incomplete" && "text-muted-foreground",
						)}
					>
						{indicator.statusLabel}
					</span>
				</div>

				<div className="mt-3">
					<h3 className="text-sm font-semibold text-foreground">
						{indicator.name}
					</h3>
					<p className="mt-1 text-xs text-muted-foreground line-clamp-1">
						{indicator.summary}
					</p>
				</div>
			</div>

			<div className="mt-4 border-t border-border/60 pt-3">
				<div className="flex items-baseline justify-between">
					<div>
						<span className="text-[11px] text-muted-foreground">
							{isDeduction ? "Pengurang" : "Skor Terbobot"}
						</span>
						<p className="text-lg font-bold text-foreground">
							{isDeduction
								? formatPointDelta(indicator.weightedScore)
								: formatNumber(indicator.weightedScore)}
						</p>
					</div>

					{!isDeduction && (
						<div className="text-right">
							<span className="text-[11px] text-muted-foreground">
								Nilai Asli
							</span>
							<p className="text-xs font-semibold text-foreground">
								{formatNumber(indicator.rawScore)}
							</p>
						</div>
					)}
				</div>

				{onDetailClick && (
					<button
						type="button"
						onClick={() => onDetailClick(indicator.id)}
						className="mt-2 w-full rounded-lg bg-surface py-1 text-center text-[11px] font-semibold text-primary transition hover:bg-surface-muted group-hover:bg-primary/5"
					>
						Buka Detail
					</button>
				)}
			</div>
		</div>
	);
}

import { ArrowRight } from "lucide-react";
import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";
import { formatNumber, formatPointDelta } from "@/lib/format";
import type { IndicatorScoreItem } from "@/mocks/operator-dashboard";

export interface IndicatorCardProps extends ComponentProps<"div"> {
	indicator: IndicatorScoreItem;
	onDetailClick?: (route: string) => void;
}

export function IndicatorCard({
	indicator,
	onDetailClick,
	className,
	...props
}: IndicatorCardProps) {
	const isDeduction = indicator.isDeduction;
	const isScoreUnavailable =
		indicator.status === "incomplete" || indicator.rawScore === null;
	const route = indicator.route || "/operator/dashboard";

	const handleClick = () => {
		if (onDetailClick) {
			onDetailClick(route);
		}
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: the card contains a nested link and must remain a div while exposing keyboard activation.
		<div
			{...props}
			onClick={(e) => {
				if ((e.target as HTMLElement).closest("a, button")) return;
				handleClick();
			}}
			role="button"
			tabIndex={0}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					handleClick();
				}
			}}
			className={twMerge(
				"group relative flex cursor-pointer flex-col justify-between rounded-2xl border bg-background p-4 shadow-xs transition duration-200 hover:shadow-sm sm:p-5",
				isDeduction
					? "border-danger/30 bg-danger/[0.02]"
					: "border-border hover:border-primary/40",
				className,
			)}
			data-slot="indicator-card"
		>
			<div>
				<div className="flex flex-wrap items-center justify-between gap-1.5">
					<div className="flex items-center gap-1.5">
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
					</div>

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
					<a
						href={route}
						onClick={(e) => {
							if (onDetailClick) {
								e.preventDefault();
								handleClick();
							}
						}}
						className="group/title flex items-center justify-between text-sm font-bold text-foreground transition group-hover:text-primary"
					>
						<span className="line-clamp-1">{indicator.name}</span>
						<ArrowRight className="size-4 shrink-0 opacity-0 -translate-x-1 transition duration-200 group-hover:opacity-100 group-hover:translate-x-0" />
					</a>
					<p className="mt-1 text-xs text-muted-foreground line-clamp-1">
						{indicator.deltaDescription || indicator.summary}
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
								: isScoreUnavailable
									? "—"
									: formatNumber(indicator.weightedScore)}
						</p>
					</div>

					{!isDeduction && (
						<div className="text-right">
							<span className="text-[11px] text-muted-foreground">
								Nilai Asli
							</span>
							<p className="text-xs font-semibold text-foreground">
								{isScoreUnavailable
									? "—"
									: formatNumber(indicator.rawScore ?? 0)}
							</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

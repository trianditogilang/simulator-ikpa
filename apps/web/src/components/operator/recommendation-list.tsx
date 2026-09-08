import { ArrowRight } from "lucide-react";
import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";
import { formatNumber } from "@/lib/format";
import type { PriorityActionItem } from "@/mocks/operator-dashboard";

export interface RecommendationListProps extends ComponentProps<"div"> {
	actions: PriorityActionItem[];
	onActionClick?: (route: string) => void;
	totalCount?: number;
	onSeeAllClick?: () => void;
}

export function RecommendationList({
	actions,
	onActionClick,
	totalCount,
	onSeeAllClick,
	className,
	...props
}: RecommendationListProps) {
	if (!actions.length) {
		return (
			<div
				{...props}
				className={twMerge(
					"rounded-2xl border border-border bg-background p-5 text-center sm:p-6",
					className,
				)}
				data-slot="recommendation-list"
			>
				<p className="text-xs font-semibold text-success">
					Tidak Ada Tindakan Kritis Saat Ini
				</p>
				<p className="mt-1 text-xs text-muted-foreground">
					Kinerja pelaksanaan anggaran berjalan optimal sesuai target IKPA.
				</p>
			</div>
		);
	}

	const displayActions = actions.slice(0, 5);

	return (
		<div
			{...props}
			className={twMerge("space-y-3", className)}
			data-slot="recommendation-list"
		>
			<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h3 className="text-sm font-bold text-foreground sm:text-base">
						Tindakan Prioritas untuk Satker
					</h3>
					<p className="text-[11px] text-muted-foreground">
						Ruang perbaikan adalah estimasi maksimum bila gap indikator ditutup; hasil aktual bergantung pada kelengkapan dan validitas data.
					</p>
				</div>
				{totalCount !== undefined && onSeeAllClick && totalCount > displayActions.length ? (
					<button
						type="button"
						onClick={onSeeAllClick}
						className="shrink-0 text-xs font-semibold text-primary underline-offset-4 hover:underline"
					>
						Lihat semua ({totalCount})
					</button>
				) : (
					<span className="shrink-0 text-xs text-muted-foreground">
						{displayActions.length} Prioritas
					</span>
				)}
			</div>

			<div className="space-y-2.5">
				{displayActions.map((act, index) => {
					const isHigh = act.urgency === "high";
					const targetRoute = act.route || "/operator/dashboard";
					const buttonLabel = `Buka ${act.domainLabel || act.indicatorName || "Indikator"}`;

					return (
						<div
							key={act.id}
							className={twMerge(
								"flex flex-col justify-between gap-3 rounded-xl border bg-background p-3.5 shadow-xs transition hover:shadow-sm sm:flex-row sm:items-center",
								isHigh
									? "border-warning/40 bg-warning/[0.02]"
									: "border-border",
							)}
						>
							<div className="flex items-start gap-3">
								<span
									className={twMerge(
										"flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
										isHigh
											? "bg-warning/20 text-warning"
											: "bg-surface-muted text-foreground",
									)}
								>
									{index + 1}
								</span>
								<div>
									<h4 className="text-xs font-semibold text-foreground sm:text-sm">
										{act.title}
									</h4>
									<div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
										<span className="font-semibold text-primary">
											{act.indicatorName}
										</span>
										<span>·</span>
										<span>Urgensi {act.urgencyLabel}</span>
										<span>·</span>
										<span className="font-semibold text-success">
											Ruang perbaikan: hingga +{formatNumber(act.impactPoints)} poin
										</span>
										{act.deadlineDate ? (
											<>
												<span>·</span>
												<span>Batas: {act.deadlineDate}</span>
											</>
										) : null}
									</div>
								</div>
							</div>

							<div className="shrink-0 self-end sm:self-center">
								{onActionClick ? (
									<button
										type="button"
										onClick={() => onActionClick(targetRoute)}
										title={buttonLabel}
										aria-label={buttonLabel}
										className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground transition hover:border-primary/40 hover:bg-surface-muted hover:text-primary"
									>
										<ArrowRight className="size-4" />
									</button>
								) : (
									<a
										href={targetRoute}
										title={buttonLabel}
										aria-label={buttonLabel}
										className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground transition hover:border-primary/40 hover:bg-surface-muted hover:text-primary"
									>
										<ArrowRight className="size-4" />
									</a>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

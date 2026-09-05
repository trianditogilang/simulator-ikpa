import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";
import { formatPointDelta } from "@/lib/format";
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
					Kinerja pelaksanaan anggaran berjalan sesuai target.
				</p>
			</div>
		);
	}

	return (
		<div
			{...props}
			className={twMerge("space-y-3", className)}
			data-slot="recommendation-list"
		>
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-semibold text-foreground">
					Tindakan Prioritas untuk Satker
				</h3>
				{totalCount !== undefined && onSeeAllClick && totalCount > actions.length ? (
					<button
						type="button"
						onClick={onSeeAllClick}
						className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
					>
						Lihat semua ({totalCount})
					</button>
				) : (
					<span className="text-xs text-muted-foreground">
						{actions.length} Rekomendasi
					</span>
				)}
			</div>

			<div className="space-y-2.5">
				{actions.map((act, index) => {
					const isHigh = act.urgency === "high";

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
										<span className="font-medium text-primary">
											{act.indicatorName}
										</span>
										<span>·</span>
										<span>{act.urgencyLabel}</span>
										<span>·</span>
										<span className="font-semibold text-success">
											Potensi Dampak: {formatPointDelta(act.impactPoints)}
										</span>
									</div>
								</div>
							</div>

							<div className="shrink-0">
								{onActionClick ? (
									<button
										type="button"
										onClick={() => onActionClick(act.route)}
										className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:bg-surface-muted hover:text-primary"
									>
										Buka {act.domain}
									</button>
								) : (
									<a
										href={act.route}
										className="inline-block rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:bg-surface-muted hover:text-primary"
									>
										Buka {act.domain}
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

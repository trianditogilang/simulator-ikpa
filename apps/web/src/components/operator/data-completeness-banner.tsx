import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";
import type { CompletenessItem } from "@/mocks/operator-dashboard";

export interface DataCompletenessBannerProps extends ComponentProps<"div"> {
	completeness: CompletenessItem[];
	activePeriodLabel?: string;
	onFixDataClick?: (route: string) => void;
}

export function DataCompletenessBanner({
	completeness,
	activePeriodLabel = "Bulan Berjalan",
	onFixDataClick,
	className,
	...props
}: DataCompletenessBannerProps) {
	if (!completeness || completeness.length === 0) return null;

	const completedCount = completeness.filter((c) => c.isComplete).length;
	const totalCount = completeness.length;
	const allComplete = completedCount === totalCount;
	const incompleteItems = completeness.filter((c) => !c.isComplete);
	const firstIncomplete = incompleteItems[0];

	if (allComplete) {
		return null; // When all complete, the main card badge is sufficient
	}

	return (
		<div
			{...props}
			className={twMerge(
				"rounded-2xl border border-warning/40 bg-warning/[0.03] p-4 sm:p-5 shadow-xs transition",
				className,
			)}
			data-slot="data-completeness-banner"
		>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-warning/20 pb-3">
				<div className="flex items-center gap-2.5">
					<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning">
						<AlertCircle className="size-4" />
					</div>
					<div>
						<h4 className="text-xs font-bold text-foreground sm:text-sm">
							Kelengkapan Data Periode {activePeriodLabel}
						</h4>
						<p className="text-[11px] text-muted-foreground">
							{completedCount} dari {totalCount} modul data lengkap dan siap dihitung.
						</p>
					</div>
				</div>

				{firstIncomplete && (
					<button
						type="button"
						onClick={() => onFixDataClick?.(firstIncomplete.route)}
						className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg bg-warning/20 px-3 py-1.5 text-xs font-bold text-warning-foreground hover:bg-warning/30 transition"
					>
						<span>Lengkapi {incompleteItems.length} Data</span>
						<ArrowRight className="size-3.5" />
					</button>
				)}
			</div>

			<div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
				{completeness.map((item) => (
					<a
						key={item.id}
						href={item.route}
						onClick={(e) => {
							if (onFixDataClick) {
								e.preventDefault();
								onFixDataClick(item.route);
							}
						}}
						className={twMerge(
							"flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition hover:border-primary/40",
							item.isComplete
								? "border-border/60 bg-background/50 text-foreground"
								: "border-warning/30 bg-warning/10 text-warning font-semibold",
						)}
					>
						{item.isComplete ? (
							<CheckCircle2 className="size-3.5 shrink-0 text-success" />
						) : (
							<AlertCircle className="size-3.5 shrink-0 text-warning" />
						)}
						<span className="truncate">{item.domain}</span>
					</a>
				))}
			</div>
		</div>
	);
}

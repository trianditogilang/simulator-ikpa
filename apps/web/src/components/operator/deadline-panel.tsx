import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";
import type { NearestDeadlineItem } from "@/mocks/operator-dashboard";

export interface DeadlinePanelProps extends ComponentProps<"div"> {
	deadline: NearestDeadlineItem | null;
	onActionClick?: (route: string) => void;
}

export function DeadlinePanel({
	deadline,
	onActionClick,
	className,
	...props
}: DeadlinePanelProps) {
	if (!deadline) {
		return (
			<div
				{...props}
				className={twMerge(
					"flex h-full flex-col items-center justify-center rounded-2xl border border-border bg-background p-5 text-center shadow-xs sm:p-6",
					className,
				)}
				data-slot="deadline-panel"
			>
				<span className="text-xs font-semibold text-success">
					Tidak Ada Deadline Mendekat
				</span>
				<p className="mt-1 text-xs text-muted-foreground">
					Semua tagihan dan kewajiban pelaporan dalam status aman.
				</p>
			</div>
		);
	}

	const isUrgent = deadline.status === "danger" || deadline.workDaysLeft <= 2;

	return (
		<div
			{...props}
			className={twMerge(
				"flex flex-col justify-between rounded-2xl border bg-background p-5 shadow-xs sm:p-6",
				isUrgent ? "border-warning/50 bg-warning/[0.02]" : "border-border",
				className,
			)}
			data-slot="deadline-panel"
		>
			<div>
				<div className="flex items-center justify-between">
					<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
						Tenggat Waktu Terdekat
					</span>
					<span
						className={twMerge(
							"rounded-md px-2 py-0.5 text-xs font-semibold",
							deadline.status === "danger" && "bg-danger/10 text-danger",
							deadline.status === "warning" && "bg-warning/10 text-warning",
							deadline.status === "safe" && "bg-success/10 text-success",
						)}
					>
						{deadline.workDaysLeft === 0
							? "Hari Ini!"
							: `${deadline.workDaysLeft} Hari Kerja Lagi`}
					</span>
				</div>

				<div className="mt-3">
					<h3 className="text-base font-semibold text-foreground">
						{deadline.title}
					</h3>
					<p className="mt-1 text-xs text-muted-foreground">
						{deadline.event} · Jatuh Tempo: {deadline.dueDate}
					</p>
				</div>
			</div>

			<div className="mt-4 border-t border-border/60 pt-3">
				{onActionClick ? (
					<button
						type="button"
						onClick={() => onActionClick(deadline.route)}
						className="w-full rounded-xl bg-primary py-2 text-center text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary-hover"
					>
						Buka Data Tagihan
					</button>
				) : (
					<a
						href={deadline.route}
						className="block w-full rounded-xl bg-primary py-2 text-center text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary-hover"
					>
						Buka Data Tagihan
					</a>
				)}
			</div>
		</div>
	);
}

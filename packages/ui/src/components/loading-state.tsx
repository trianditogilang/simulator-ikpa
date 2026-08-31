import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

export type LoadingStateProps = Omit<ComponentProps<"output">, "children"> & {
	label?: string;
	rows?: number;
};

function clampRows(rows: number): number {
	if (!Number.isFinite(rows)) {
		return 3;
	}

	return Math.min(8, Math.max(1, Math.floor(rows)));
}

export function LoadingState({
	label = "Memuat data",
	rows = 3,
	className,
	...props
}: LoadingStateProps) {
	const rowCount = clampRows(rows);

	return (
		<output
			{...props}
			aria-busy="true"
			aria-label={label}
			aria-live="polite"
			data-slot="loading-state"
			className={twMerge("w-full", className)}
		>
			<span className="sr-only">{label}</span>
			<div aria-hidden="true" className="space-y-6">
				<div className="space-y-2">
					<div className="h-7 w-2/5 animate-pulse rounded-md bg-surface-muted" />
					<div className="h-4 w-3/5 animate-pulse rounded-md bg-surface-muted" />
				</div>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 3 }, (_, index) => (
						<div
							className="h-28 animate-pulse rounded-lg border border-border bg-surface"
							key={`card-${index}`}
						/>
					))}
				</div>
				<div className="space-y-4 rounded-lg border border-border bg-surface p-4 shadow-card sm:p-6">
					<div className="h-5 w-1/3 animate-pulse rounded-md bg-surface-muted" />
					<div className="space-y-3">
						{Array.from({ length: rowCount }, (_, index) => (
							<div
								className="h-4 animate-pulse rounded-md bg-surface-muted"
								key={`row-${index}`}
							/>
						))}
					</div>
				</div>
			</div>
		</output>
	);
}

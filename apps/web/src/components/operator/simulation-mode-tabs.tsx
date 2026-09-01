import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

export type SimulationMode = "actual" | "forecast" | "scenario";

export interface SimulationModeTabsProps extends ComponentProps<"div"> {
	activeMode: SimulationMode;
	onModeChange: (mode: SimulationMode) => void;
}

export function SimulationModeTabs({
	activeMode,
	onModeChange,
	className,
	...props
}: SimulationModeTabsProps) {
	return (
		<div
			{...props}
			className={twMerge("flex rounded-xl bg-surface-muted p-1", className)}
			data-slot="simulation-mode-tabs"
		>
			<button
				type="button"
				onClick={() => onModeChange("actual")}
				className={twMerge(
					"flex-1 rounded-lg py-2 text-xs font-semibold transition sm:text-sm",
					activeMode === "actual"
						? "bg-background text-foreground shadow-xs"
						: "text-muted-foreground hover:text-foreground",
				)}
			>
				Aktual
			</button>
			<button
				type="button"
				onClick={() => onModeChange("forecast")}
				className={twMerge(
					"flex-1 rounded-lg py-2 text-xs font-semibold transition sm:text-sm",
					activeMode === "forecast"
						? "bg-background text-foreground shadow-xs"
						: "text-muted-foreground hover:text-foreground",
				)}
			>
				Proyeksi
			</button>
			<button
				type="button"
				onClick={() => onModeChange("scenario")}
				className={twMerge(
					"flex-1 rounded-lg py-2 text-xs font-semibold transition sm:text-sm",
					activeMode === "scenario"
						? "bg-background text-foreground shadow-xs"
						: "text-muted-foreground hover:text-foreground",
				)}
			>
				Skenario
			</button>
		</div>
	);
}

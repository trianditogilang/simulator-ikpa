import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

export interface FormulaTraceProps extends ComponentProps<"div"> {
	indicatorName: string;
	formulaFormula: string;
	inputValues: { label: string; value: string | number }[];
	ruleSetVersion: string;
}

export function FormulaTrace({
	indicatorName,
	formulaFormula,
	inputValues,
	ruleSetVersion,
	className,
	...props
}: FormulaTraceProps) {
	return (
		<div
			{...props}
			className={twMerge(
				"rounded-xl border border-border/80 bg-surface p-4 text-xs",
				className,
			)}
			data-slot="formula-trace"
		>
			<div className="flex items-center justify-between border-b border-border/60 pb-2">
				<span className="font-semibold text-foreground">
					Histori Formula: {indicatorName}
				</span>
				<span className="text-[11px] text-muted-foreground">
					Rule Set {ruleSetVersion}
				</span>
			</div>

			<div className="mt-3 space-y-2">
				<div>
					<span className="text-[11px] text-muted-foreground">Rumus Regulasi:</span>
					<p className="font-mono text-xs font-semibold text-primary">
						{formulaFormula}
					</p>
				</div>

				<div>
					<span className="text-[11px] text-muted-foreground">Variabel Masukan:</span>
					<div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
						{inputValues.map((val) => (
							<div
								key={val.label}
								className="rounded-md border border-border/60 bg-background p-2"
							>
								<span className="text-[10px] text-muted-foreground">
									{val.label}
								</span>
								<p className="font-semibold text-foreground">{val.value}</p>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

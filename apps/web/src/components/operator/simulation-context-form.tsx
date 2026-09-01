import type { ComponentProps } from "react";
import { twMerge } from "tailwind-merge";

export interface SimulationContextFormProps extends ComponentProps<"div"> {
	targetScore: number;
	fiscalYear: number;
	periodMonth: number;
	isBlu: boolean;
	hasUnsavedChanges: boolean;
	onTargetChange: (target: number) => void;
	onPeriodChange: (month: number) => void;
	onBluChange: (isBlu: boolean) => void;
	onReset: () => void;
}

export function SimulationContextForm({
	targetScore,
	fiscalYear,
	periodMonth,
	isBlu,
	hasUnsavedChanges,
	onTargetChange,
	onPeriodChange,
	onBluChange,
	onReset,
	className,
	...props
}: SimulationContextFormProps) {
	return (
		<div
			{...props}
			className={twMerge(
				"space-y-4 rounded-2xl border border-border bg-background p-4 shadow-xs sm:p-5",
				className,
			)}
			data-slot="simulation-context-form"
		>
			<div className="flex items-center justify-between border-b border-border/70 pb-3">
				<div>
					<h3 className="text-sm font-semibold text-foreground">
						Parameter Konteks Simulasi
					</h3>
					<p className="text-[11px] text-muted-foreground">
						Tahun Anggaran {fiscalYear}
					</p>
				</div>
				{hasUnsavedChanges && (
					<span className="rounded-md bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">
						Ada Perubahan
					</span>
				)}
			</div>

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<div className="space-y-1">
					<label
						htmlFor="targetScore"
						className="block text-[11px] font-semibold text-foreground"
					>
						Target Nilai IKPA
					</label>
					<input
						id="targetScore"
						type="number"
						step="0.1"
						min="0"
						max="100"
						value={targetScore}
						onChange={(e) => onTargetChange(Number.parseFloat(e.target.value) || 0)}
						className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
					/>
				</div>

				<div className="space-y-1">
					<label
						htmlFor="periodMonth"
						className="block text-[11px] font-semibold text-foreground"
					>
						Periode Bulan
					</label>
					<select
						id="periodMonth"
						value={periodMonth}
						onChange={(e) => onPeriodChange(Number.parseInt(e.target.value, 10))}
						className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
					>
						<option value={1}>Januari</option>
						<option value={2}>Februari</option>
						<option value={3}>Maret (Q1)</option>
						<option value={4}>April</option>
						<option value={5}>Mei</option>
						<option value={6}>Juni (Q2)</option>
						<option value={7}>Juli</option>
						<option value={8}>Agustus</option>
						<option value={9}>September (Q3)</option>
						<option value={10}>Oktober</option>
						<option value={11}>November</option>
						<option value={12}>Desember (Q4)</option>
					</select>
				</div>

				<div className="space-y-1">
					<span className="block text-[11px] font-semibold text-foreground">
						Status Satker BLU
					</span>
					<label className="flex min-h-[30px] items-center gap-2 text-xs font-medium text-foreground">
						<input
							type="checkbox"
							checked={isBlu}
							onChange={(e) => onBluChange(e.target.checked)}
							className="size-4 rounded border-border text-primary focus:ring-primary"
						/>
						<span>Satker BLU</span>
					</label>
				</div>
			</div>

			{hasUnsavedChanges && (
				<div className="flex items-center justify-end pt-1">
					<button
						type="button"
						onClick={onReset}
						className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
					>
						Reset ke Nilai Asli
					</button>
				</div>
			)}
		</div>
	);
}

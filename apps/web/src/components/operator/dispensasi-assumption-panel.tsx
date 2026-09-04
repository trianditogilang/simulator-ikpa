import { useMemo } from "react";
import { formatNumber } from "@/lib/format";
import {
	calcDispensasiPreview,
	type DispensasiAssumptions,
} from "@/lib/simulation/dispensasi-assumptions";

interface Props {
	value: DispensasiAssumptions;
	actualDeduction: number;
	onChange: (next: DispensasiAssumptions) => void;
	onReset: () => void;
}

export function DispensasiAssumptionPanel({ value, actualDeduction, onChange, onReset }: Props) {
	const preview = useMemo(() => calcDispensasiPreview(value), [value]);
	const delta = preview.isValid ? -(preview.deduction - actualDeduction) : null;

	return (
		<section aria-label="Atur Asumsi SPM Dispensasi" className="space-y-3 rounded-2xl border border-border bg-background p-4 shadow-xs sm:p-5">
			<div className="flex items-start justify-between gap-3">
				<h3 className="text-sm font-semibold text-foreground">Atur Asumsi SPM Dispensasi</h3>
				<button
					type="button"
					onClick={onReset}
					className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
				>
					Reset
				</button>
			</div>

			<div className="grid grid-cols-2 gap-3">
				<div className="space-y-1">
					<label htmlFor="disp-count" className="block text-[11px] font-semibold text-foreground">
						SPM dispensasi
					</label>
					<input
						id="disp-count"
						type="number"
						min="0"
						value={value.dispensationCount}
						onChange={(e) => onChange({ ...value, dispensationCount: Number(e.target.value) || 0 })}
						className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
					/>
				</div>
				<div className="space-y-1">
					<label htmlFor="disp-total" className="block text-[11px] font-semibold text-foreground">
						Total SPM Q4
					</label>
					<input
						id="disp-total"
						type="number"
						min="0"
						value={value.totalSpmQ4}
						onChange={(e) => onChange({ ...value, totalSpmQ4: Number(e.target.value) || 0 })}
						className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
					/>
				</div>
			</div>

			{preview.message && (
				<p role="alert" className="text-[11px] font-medium text-danger">{preview.message}</p>
			)}

			<div aria-live="polite" className="grid grid-cols-3 gap-2 rounded-xl bg-surface p-3 text-xs">
				<div>
					<p className="text-[10px] text-muted-foreground">Rasio</p>
					<p className="font-bold text-foreground">{preview.ratio.toFixed(3)}‰</p>
				</div>
				<div>
					<p className="text-[10px] text-muted-foreground">Pengurang</p>
					<p className="font-bold text-foreground">−{formatNumber(preview.deduction)}</p>
				</div>
				<div>
					<p className="text-[10px] text-muted-foreground">Dampak total</p>
					<p className="font-bold text-primary">
						{delta !== null ? `${delta >= 0 ? "+" : ""}${formatNumber(delta)}` : "—"}
					</p>
				</div>
			</div>
		</section>
	);
}

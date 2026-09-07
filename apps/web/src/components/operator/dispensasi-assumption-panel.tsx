import { useMemo } from "react";
import { FormattedNumberInput } from "@/components/data/formatted-number-input";
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

export function DispensasiAssumptionPanel({
	value,
	actualDeduction,
	onChange,
	onReset,
}: Props) {
	const preview = useMemo(() => calcDispensasiPreview(value), [value]);
	const delta = preview.isValid ? -(preview.deduction - actualDeduction) : null;

	return (
		<section
			aria-label="Atur Asumsi SPM Dispensasi"
			className="space-y-3 rounded-2xl border border-border bg-background p-4 shadow-xs sm:p-5"
		>
			<div className="flex items-start justify-between gap-3">
				<div>
					<h3 className="text-sm font-semibold text-foreground">
						Atur Asumsi SPM Dispensasi
					</h3>
					<p className="text-[11px] text-muted-foreground">
						Pengurang nilai IKPA · Triwulan IV (Okt–Des)
					</p>
				</div>
				<button
					type="button"
					onClick={onReset}
					className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition hover:text-foreground hover:bg-surface-muted"
				>
					Reset
				</button>
			</div>

			<div className="grid grid-cols-2 gap-3">
				<div className="space-y-1">
					<label
						htmlFor="disp-count"
						className="block text-[11px] font-semibold text-foreground"
					>
						Jumlah SPM Dispensasi
					</label>
					<FormattedNumberInput
						id="disp-count"
						value={value.dispensationCount}
						onChange={(raw) =>
							onChange({ ...value, dispensationCount: Number(raw) || 0 })
						}
						className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
					/>
					<p className="text-[10px] text-muted-foreground">
						Pembilang (lembar SPM)
					</p>
				</div>
				<div className="space-y-1">
					<label
						htmlFor="disp-total"
						className="block text-[11px] font-semibold text-foreground"
					>
						Total SPM Triwulan IV
					</label>
					<FormattedNumberInput
						id="disp-total"
						value={value.totalSpmQ4}
						onChange={(raw) =>
							onChange({ ...value, totalSpmQ4: Number(raw) || 0 })
						}
						className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
					/>
					<p className="text-[10px] text-muted-foreground">
						Penyebut (lembar SPM Q4)
					</p>
				</div>
			</div>

			{preview.message && (
				<p
					role="alert"
					className="rounded-lg bg-danger/10 p-2 text-[11px] font-medium text-danger border border-danger/20"
				>
					{preview.message}
				</p>
			)}

			<div className="rounded-xl bg-surface border border-border/50 p-3 space-y-2">
				<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
					Pratinjau Pengurang (Bukan Bobot)
				</p>
				<div
					aria-live="polite"
					className="grid grid-cols-4 gap-2 text-xs"
				>
					<div>
						<p className="text-[10px] text-muted-foreground">Rasio</p>
						<p className="font-bold text-foreground">
							{preview.ratioFormatted}‰
						</p>
					</div>
					<div>
						<p className="text-[10px] text-muted-foreground">Kategori</p>
						<p className="font-bold text-foreground">
							Kat. {preview.category}
						</p>
					</div>
					<div>
						<p className="text-[10px] text-muted-foreground">Pengurang</p>
						<p className="font-bold text-danger">
							−{formatNumber(preview.deduction)} poin
						</p>
					</div>
					<div>
						<p className="text-[10px] text-muted-foreground">Dampak IKPA</p>
						<p className="font-bold text-primary">
							{delta !== null
								? `${delta >= 0 ? "+" : ""}${formatNumber(delta)}`
								: "—"}
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}

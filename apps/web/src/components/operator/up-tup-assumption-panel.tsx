import { useMemo } from "react";
import { default2026RuleSet } from "@simulator-ikpa/ikpa-engine";
import { calculateUpTup } from "@simulator-ikpa/ikpa-engine";
import { formatNumber, formatPercent, formatRupiah } from "@/lib/format";
import { FormattedNumberInput } from "@/components/data/formatted-number-input";
import {
	buildUpTupEngineInput,
	calcGupPreview,
	UP_TUP_WEIGHT,
	type UpTupAssumptions,
} from "@/lib/simulation/up-tup-assumptions";

interface Props {
	value: UpTupAssumptions;
	actualUpTupContrib: number | null;
	onChange: (next: UpTupAssumptions) => void;
	onReset: () => void;
}

/** Tabel acuan persis gambar Excel "Simulasi Setiap GUP" (statis, bukan hitungan). */
const GUP_ACUAN_TABLE: Array<{
	pct: number;
	hari: [number, number, number];
	nilai: [number, number, number];
}> = [
	{ pct: 50, hari: [14, 15, 15], nilai: [100, 100, 100] },
	{ pct: 55, hari: [15, 16, 17], nilai: [103, 103, 100] },
	{ pct: 60, hari: [16, 17, 18], nilai: [105, 106, 103] },
	{ pct: 65, hari: [18, 19, 20], nilai: [101, 103, 101] },
	{ pct: 70, hari: [18, 21, 21], nilai: [103, 100, 103] },
	{ pct: 75, hari: [21, 22, 23], nilai: [100, 102, 101] },
	{ pct: 80, hari: [22, 24, 24], nilai: [102, 100, 103] },
	{ pct: 85, hari: [23, 25, 26], nilai: [103, 102, 101] },
	{ pct: 90, hari: [25, 27, 27], nilai: [101, 100, 103] },
	{ pct: 95, hari: [26, 28, 29], nilai: [102, 102, 102] },
	{ pct: 100, hari: [28, 30, 31], nilai: [100, 100, 100] },
];

function num(v: string): number {
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
}

export function UpTupAssumptionPanel({
	value,
	actualUpTupContrib,
	onChange,
	onReset,
}: Props) {
	const preview = useMemo(() => calcGupPreview(value), [value]);

	const engine = useMemo(() => {
		try {
			const input = buildUpTupEngineInput(value);
			const month = Number(value.tanggalRencanaGUP.slice(5, 7)) || 5;
			return calculateUpTup(
				{ transactions: input.transactions as never, kkpTransactions: input.kkpTransactions as never },
				{ kind: "month", value: Math.min(Math.max(month, 1), 12) } as never,
				default2026RuleSet,
			);
		} catch {
			return null;
		}
	}, [value]);

	const engineScore = engine?.score ? Number(engine.score) : null;
	const engineContrib = engine?.weightedContribution
		? Number(engine.weightedContribution)
		: null;
	const delta =
		engineContrib !== null && actualUpTupContrib !== null
			? engineContrib - actualUpTupContrib
			: null;

	const set = (patch: Partial<UpTupAssumptions>) =>
		onChange({ ...value, ...patch });

	return (
		<section
			aria-label="Atur Asumsi UP/TUP"
			className="space-y-3 rounded-2xl border border-border bg-background p-4 shadow-xs sm:p-5"
		>
			<div className="flex items-start justify-between gap-3">
				<h3 className="text-sm font-semibold text-foreground">
					Atur Asumsi UP/TUP
				</h3>
				<button
					type="button"
					onClick={onReset}
					className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
				>
					Reset
				</button>
			</div>

			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div className="space-y-1">
					<label htmlFor="uptup-nilai-up" className="block text-[11px] font-semibold text-foreground">
						Nilai UP (Rp)
					</label>
					<FormattedNumberInput
						id="uptup-nilai-up"
						value={value.nilaiUP}
						onChange={(raw) => set({ nilaiUP: raw })}
						className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
					/>
					<p className="text-[10px] text-muted-foreground">{formatRupiah(num(value.nilaiUP))}</p>
				</div>
				<div className="space-y-1">
					<label htmlFor="uptup-nilai-gup" className="block text-[11px] font-semibold text-foreground">
						Nilai Rencana GUP (Rp)
					</label>
					<FormattedNumberInput
						id="uptup-nilai-gup"
						value={value.nilaiRencanaGUP}
						onChange={(raw) => set({ nilaiRencanaGUP: raw })}
						className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
					/>
					<p className="text-[10px] text-muted-foreground">
						{preview.isValid ? formatPercent(preview.persentaseGUP * 100) : "—"} dari UP
					</p>
				</div>
				<div className="space-y-1">
					<label htmlFor="uptup-tgl-prev" className="block text-[11px] font-semibold text-foreground">
						Tanggal GUP Sebelumnya
					</label>
					<input
						id="uptup-tgl-prev"
						type="date"
						value={value.tanggalGUPSebelumnya}
						onChange={(e) => set({ tanggalGUPSebelumnya: e.target.value })}
						className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
					/>
				</div>
				<div className="space-y-1">
					<label htmlFor="uptup-tgl-rencana" className="block text-[11px] font-semibold text-foreground">
						Tanggal Rencana GUP (SP2D)
					</label>
					<input
						id="uptup-tgl-rencana"
						type="date"
						value={value.tanggalRencanaGUP}
						onChange={(e) => set({ tanggalRencanaGUP: e.target.value })}
						className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground"
					/>
				</div>
			</div>

			<div aria-live="polite" className="rounded-xl border border-border/70 bg-surface p-3 text-xs">
				<p className="font-semibold text-foreground">Nilai IKPA Kualitas GUP</p>
				{preview.isValid ? (
					<>
						<p className="mt-1 text-foreground">
							Persentase GUP{" "}
							<strong>{formatPercent(preview.persentaseGUP * 100)}</strong>
							{" · "}maks. {preview.tanggalMaksimal} ({preview.hariDisebulankan}{" "}
							hari disebulankan){" · "}SP2D {preview.hariSP2D} hari
						</p>
						<p className={`mt-1 text-lg font-bold ${preview.isCapped ? "text-success" : "text-danger"}`}>
							{formatPercent(preview.nilaiCapped)}
							{preview.isCapped ? (
								<span className="text-[10px] font-semibold text-muted-foreground"> (cap 100)</span>
							) : null}
						</p>
						<p className={preview.isCapped ? "font-semibold text-success" : "font-semibold text-danger"}>
							{preview.saran}
						</p>
						{preview.status === "Tepat Waktu" ? (
							<p className="mt-1 text-[11px] text-muted-foreground">
								Margin {preview.hariDisebulankan - preview.hariSP2D} hari
								kalender — hitungan hari kalender, waspadai libur
								bersama/cuti nasional di tanggal tersebut.
							</p>
						) : null}
					</>
				) : (
					<p className="mt-1 text-danger">{preview.validationMessage}</p>
				)}
			</div>

			<details className="rounded-xl border border-border/70 p-3 text-xs">
				<summary className="cursor-pointer font-semibold text-foreground">
					Tabel Simulasi GUP dengan 28, 30, dan 31 hari yang disebulankan
				</summary>
				<div className="mt-2 overflow-x-auto">
					<table className="w-full min-w-[520px] border-collapse text-center">
						<thead>
							<tr className="bg-[#244061] text-white">
								<th rowSpan={2} className="border border-[#244061] px-2 py-1 text-left">
									<span className="block text-[10px] font-normal">Hari yg disebulankan</span>
									<span className="block font-semibold">% GUP</span>
								</th>
								<th colSpan={3} className="border border-[#244061] px-2 py-1 font-semibold">
									Hari SP2D GUP maksimal (hari ke–)
								</th>
								<th colSpan={3} className="border border-[#244061] px-2 py-1 font-semibold">
									Nilai IKPA maksimal 100
								</th>
							</tr>
							<tr className="bg-[#244061] text-white">
								{[28, 30, 31, 28, 30, 31].map((d, i) => (
									<th key={i} className="border border-[#244061] px-2 py-1 font-semibold">
										{d}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{GUP_ACUAN_TABLE.map((row) => (
								<tr
									key={row.pct}
									className="text-foreground odd:bg-surface-muted/60"
								>
										<td className="border border-border/60 bg-[#244061] px-2 py-1 text-left font-semibold text-white">
											{row.pct}%
										</td>
										{row.hari.map((h, i) => (
											<td key={i} className="border border-border/60 px-2 py-1">
												{h} hari
											</td>
										))}
										{row.nilai.map((n, i) => (
											<td key={i} className="border border-border/60 px-2 py-1">
												{n}%
											</td>
										))}
									</tr>
							))}
						</tbody>
					</table>
				</div>
			</details>

			<details className="rounded-xl border border-border/70 p-3 text-xs">
				<summary className="cursor-pointer font-semibold text-foreground">
					TUP / PTUP / GUP Nihil / Setoran / KKP (opsional)
				</summary>
				<div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
					{(
						[
							["uptup-tup-tepat", "TUP tepat", value.tupTepat, (v: number) => set({ tupTepat: v })],
							["uptup-tup-lambat", "TUP terlambat", value.tupTerlambat, (v: number) => set({ tupTerlambat: v })],
							["uptup-ptup", "PTUP tepat", value.ptupTepat, (v: number) => set({ ptupTepat: v })],
							["uptup-nihil", "GUP Nihil", value.gupNihilCount, (v: number) => set({ gupNihilCount: v })],
							["uptup-setoran", "Setoran tepat", value.setoranTepat, (v: number) => set({ setoranTepat: v })],
						] as const
					).map(([id, label, val, fn]) => (
						<div key={id} className="space-y-1">
							<label htmlFor={id} className="block text-[11px] font-semibold text-foreground">
								{label}
							</label>
							<FormattedNumberInput
								id={id}
								value={val}
								onChange={(raw) => fn(Number(raw) || 0)}
								className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
							/>
						</div>
					))}
					<div className="space-y-1">
						<label htmlFor="uptup-kkp" className="block text-[11px] font-semibold text-foreground">
							KKP (Rp)
						</label>
						<FormattedNumberInput
							id="uptup-kkp"
							value={value.kkpNominal}
							onChange={(raw) => set({ kkpNominal: raw })}
							className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
						/>
					</div>
				</div>
			</details>

			<div aria-live="polite" className="grid grid-cols-3 gap-2 rounded-xl bg-surface p-3 text-xs">
				<div>
					<p className="text-[10px] text-muted-foreground">Status</p>
					<p className={preview.status === "Tepat Waktu" ? "font-semibold text-success" : "font-semibold text-danger"}>
						{preview.status}
					</p>
					<p className="text-[10px] text-muted-foreground">Maks. {preview.tanggalMaksimal}</p>
				</div>
				<div>
					<p className="text-[10px] text-muted-foreground">Nilai UP/TUP</p>
					<p className="font-bold text-foreground">
						{engineScore !== null ? formatNumber(engineScore) : "—"}
					</p>
					<p className="text-[10px] text-muted-foreground">Bobot {UP_TUP_WEIGHT}%</p>
				</div>
				<div>
					<p className="text-[10px] text-muted-foreground">Dampak total</p>
					<p className="font-bold text-primary">
						{delta !== null ? `${delta >= 0 ? "+" : ""}${formatNumber(delta)}` : "—"}
					</p>
					<p className="text-[10px] text-muted-foreground">poin vs aktual</p>
				</div>
			</div>
			<div className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-xs">
				<p className="font-semibold text-foreground">Catatan :</p>
				<ol className="mt-1 list-decimal space-y-0.5 pl-5 text-foreground">
					<li>Jika ingin menggunakan TUP harus sesuai antara permintaan dan pertanggungjawaban, hindari adanya SSBP</li>
					<li>Perhatikan GUP terakhir, jangan sampai terlambat</li>
					<li>Hati2 untuk keterlambatan GUP di tanggal jika ada libur bersama</li>
				</ol>
			</div>
		</section>
	);
}

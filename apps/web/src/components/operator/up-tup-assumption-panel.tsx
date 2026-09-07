import { useMemo } from "react";
import {
	AlertCircle,
	AlertTriangle,
	CheckCircle2,
	Info,
	Lightbulb,
} from "lucide-react";
import { default2026RuleSet } from "@simulator-ikpa/ikpa-engine";
import { calculateUpTup } from "@simulator-ikpa/ikpa-engine";
import { formatNumber, formatPercent, formatRupiah } from "@/lib/format";
import { FormattedNumberInput } from "@/components/data/formatted-number-input";
import {
	buildUpTupEngineInput,
	calcGupPreview,
	formatDateIndonesian,
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
	const analysis = preview.analysis;

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

			{/* Card Nilai IKPA Kualitas GUP */}
			<div aria-live="polite" className="rounded-xl border border-border/70 bg-surface p-3.5 text-xs space-y-1.5">
				<div className="flex items-center justify-between">
					<p className="font-bold text-foreground">Nilai IKPA Kualitas GUP</p>
					{preview.isValid && analysis ? (
						<span
							className={`rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
								analysis.ikpaQualityStatus === "OPTIMAL"
									? "bg-success/10 text-success border-success/30"
									: analysis.ikpaQualityStatus === "BELOW_OPTIMAL"
										? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
										: "bg-danger/10 text-danger border-danger/30"
							}`}
						>
							{analysis.ikpaQualityLabel}
						</span>
					) : null}
				</div>

				{preview.isValid && analysis ? (
					<>
						<p className="text-muted-foreground text-[11px] leading-relaxed">
							Persentase GUP: <strong className="text-foreground">{formatPercent(analysis.rawGupPercent)}</strong>
							{" · "}Batas tepat waktu: <strong className="text-foreground">{formatDateIndonesian(analysis.latestOnTimeDate)}</strong>
							{" "}({analysis.referenceMonthDays} hari disebulankan)
							{" · "}Interval antar-SP2D: <strong className="text-foreground">{analysis.intervalDays} hari kalender</strong>
						</p>
						<p className={`text-xl font-bold tracking-tight ${analysis.isProportional && analysis.isOnTime ? "text-success" : "text-amber-600 dark:text-amber-400"}`}>
							{formatPercent(preview.nilaiCapped)}
							{preview.isCapped ? (
								<span className="text-xs font-semibold text-muted-foreground"> (cap 100)</span>
							) : null}
						</p>
						<p className={`font-semibold ${
							analysis.ikpaQualityStatus === "OPTIMAL"
								? "text-success"
								: analysis.isOnTime
									? "text-amber-600 dark:text-amber-400"
									: "text-danger"
						}`}>
							{analysis.ikpaQualityStatus === "OPTIMAL"
								? "Rencana memenuhi target kualitas GUP."
								: analysis.isOnTime
									? "Nilai GUP perlu ditambah atau tanggal SP2D perlu dimajukan."
									: "Rencana SP2D melewati batas satu bulan; kualitas GUP tidak optimal."}
						</p>
						<p className="text-[11px] text-muted-foreground">
							{analysis.isOnTime
								? `Sisa waktu menuju batas: ${analysis.marginDays} hari kalender — hitungan hari kalender, waspadai libur bersama/cuti nasional di tanggal tersebut.`
								: `Melewati batas: ${analysis.lateDays} hari kalender — pengajuan melewati 1 bulan kalender.`}
						</p>
					</>
				) : (
					<p className="mt-1 text-danger font-semibold">{preview.validationMessage}</p>
				)}
			</div>

			{/* Card Hasil Analisis GUP */}
			{preview.isValid && analysis ? (
				<div className="rounded-xl border border-border/80 bg-surface p-3.5 sm:p-4 text-xs space-y-3 shadow-2xs">
					{/* Header Title with Severity Icon */}
					<div className="flex items-start gap-2.5">
						<div className="mt-0.5 shrink-0">
							{analysis.submissionSeverity === "success" ? (
								<CheckCircle2 className="size-4 text-success" />
							) : analysis.submissionSeverity === "warning" ? (
								<AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
							) : analysis.submissionSeverity === "danger" ? (
								<AlertCircle className="size-4 text-danger" />
							) : (
								<Info className="size-4 text-muted-foreground" />
							)}
						</div>
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2">
								<span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
									Hasil Analisis GUP
								</span>
							</div>
							<h4 className="text-xs sm:text-sm font-bold text-foreground">
								{analysis.title}
							</h4>
						</div>
					</div>

					{/* 3-metric summary bar */}
					<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
						<div className="rounded-lg border border-border/70 bg-background/70 p-2.5 space-y-1">
							<span className="block text-[10px] font-semibold text-muted-foreground uppercase">
								Status Rencana
							</span>
							<span
								className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold border ${
									analysis.submissionSeverity === "success"
										? "bg-success/10 text-success border-success/30"
										: analysis.submissionSeverity === "warning"
											? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
											: "bg-danger/10 text-danger border-danger/30"
								}`}
							>
								{analysis.submissionStatusLabel}
							</span>
						</div>
						<div className="rounded-lg border border-border/70 bg-background/70 p-2.5 space-y-1">
							<span className="block text-[10px] font-semibold text-muted-foreground uppercase">
								Ketepatan Waktu
							</span>
							<p
								className={`text-xs font-bold ${
									analysis.isOnTime ? "text-success" : "text-danger"
								}`}
							>
								{analysis.isOnTime
									? "Tepat Waktu"
									: `Terlambat (${analysis.lateDays} hari)`}
							</p>
							<p className="text-[10px] text-muted-foreground">
								Batas: {formatDateIndonesian(analysis.latestOnTimeDate)}
							</p>
						</div>
						<div className="rounded-lg border border-border/70 bg-background/70 p-2.5 space-y-1">
							<span className="block text-[10px] font-semibold text-muted-foreground uppercase">
								GUP Disebulankan
							</span>
							<p
								className={`text-xs font-bold ${
									analysis.isProportional ? "text-success" : "text-amber-600 dark:text-amber-400"
								}`}
							>
								{formatPercent(analysis.annualizedGupPercent)}
								<span className="text-[10px] font-normal text-muted-foreground"> / target 100%</span>
							</p>
							<p className="text-[10px] text-muted-foreground">
								{analysis.isProportional ? "Memenuhi target optimal" : "Belum mencapai 100%"}
							</p>
						</div>
					</div>

					{/* Explanation */}
					<p className="text-xs text-foreground leading-relaxed">
						{analysis.summaryExplanation}
					</p>

					{/* Actionable Recommendations */}
					{analysis.actions.length > 0 ? (
						<div className="space-y-2 pt-1">
							<div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
								<Lightbulb className="size-3.5 text-amber-500 shrink-0" />
								<span>Saran Tindakan:</span>
							</div>
							<div className="space-y-1.5">
								{analysis.actions.map((action, idx) => (
									<div
										key={idx}
										className="rounded-lg border border-border/70 bg-background/80 p-2.5 text-xs space-y-0.5"
									>
										<p className="font-semibold text-foreground">
											{idx + 1}. {action.label}
										</p>
										<p className="text-[11px] text-muted-foreground leading-relaxed">
											{action.description}
										</p>
									</div>
								))}
							</div>
						</div>
					) : null}

					{/* Notes / Disclaimer */}
					{analysis.notes.length > 0 ? (
						<div className="rounded-lg border border-border/60 bg-surface-muted/50 p-2.5 text-[11px] text-muted-foreground space-y-1">
							{analysis.notes.map((note, idx) => (
								<p key={idx} className="leading-relaxed">
									• {note}
								</p>
							))}
						</div>
					) : null}

					{/* Dasar Perhitungan Collapsible */}
					<details className="group rounded-lg border border-border/60 bg-background/50 p-2.5 text-xs">
						<summary className="cursor-pointer font-semibold text-foreground list-none flex items-center justify-between hover:text-primary transition">
							<span>Dasar Perhitungan</span>
							<span className="text-[10px] font-normal text-muted-foreground group-open:rotate-180 transition-transform">
								▾
							</span>
						</summary>
						<div className="mt-2.5 pt-2 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
							<div>
								<span className="text-muted-foreground">Nilai UP: </span>
								<strong className="text-foreground">{formatRupiah(analysis.upAmount)}</strong>
							</div>
							<div>
								<span className="text-muted-foreground">Nilai Rencana GUP: </span>
								<strong className="text-foreground">
									{formatRupiah(analysis.plannedGupAmount)} ({formatPercent(analysis.rawGupPercent)} UP)
								</strong>
							</div>
							<div>
								<span className="text-muted-foreground">SP2D Sebelumnya: </span>
								<strong className="text-foreground">{formatDateIndonesian(analysis.previousSp2dDate)}</strong>
							</div>
							<div>
								<span className="text-muted-foreground">Rencana SP2D: </span>
								<strong className="text-foreground">{formatDateIndonesian(analysis.plannedSp2dDate)}</strong>
							</div>
							<div>
								<span className="text-muted-foreground">Interval Antar-SP2D: </span>
								<strong className="text-foreground">{analysis.intervalDays} hari kalender</strong>
							</div>
							<div>
								<span className="text-muted-foreground">Hari Bulan Referensi: </span>
								<strong className="text-foreground">
									{analysis.referenceMonthDays} hari ({analysis.referenceMonthName})
								</strong>
							</div>
							<div className="sm:col-span-2">
								<span className="text-muted-foreground">Perhitungan Disebulankan: </span>
								<code className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-mono text-foreground">
									{analysis.rawGupPercent.toFixed(2)}% × ({analysis.referenceMonthDays} / {analysis.intervalDays}) = {analysis.annualizedGupPercent.toFixed(2)}%
								</code>
							</div>
							<div>
								<span className="text-muted-foreground">Batas Waktu 1 Bulan: </span>
								<strong className="text-foreground">{formatDateIndonesian(analysis.latestOnTimeDate)}</strong>
							</div>
							<div>
								<span className="text-muted-foreground">Batas Minimum GUP: </span>
								<strong className="text-foreground">
									{analysis.minGupRatioPercent}% UP = {formatRupiah(analysis.minGupAmount)}
								</strong>
							</div>
						</div>
					</details>
				</div>
			) : null}

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
					<li>Jika ingin menggunakan TUP harus sesuai antara permintaan dan pertanggungjawaban, hindari adanya setoran TUP</li>
					<li>Perhatikan GUP terakhir, jangan sampai terlambat</li>
					<li>Hati2 untuk keterlambatan GUP di tanggal jika ada libur bersama</li>
				</ol>
			</div>
		</section>
	);
}

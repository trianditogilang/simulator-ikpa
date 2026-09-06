
import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
	AlertCircle,
	AlertTriangle,
	Calendar,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	Coins,
	HelpCircle,
	Info,
	Percent,
	ShieldCheck,
	Sparkles,
	Target,
	TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
	type ColumnDef,
	DomainDataTable,
} from "@/components/data/domain-data-table";
import { DomainFormDrawer } from "@/components/data/domain-form-drawer";
import { FormattedNumberInput } from "@/components/data/formatted-number-input";
import { useActiveContext } from "@/components/layout/active-context";
import { OperatorShell } from "@/components/layout/operator-shell";
import { formatPercent, formatRupiah } from "@/lib/format";
import {
	DEVIASI_ACCOUNTS,
	buildDeviationInput,
	calcDeviasiScore,
	calcMonthDeviation,
	calcNextMonthTarget,
	calculateHistoricalTrail,
	deviationOf,
	getQuarterlyRpdReminders,
	paguWeights,
	type DeviasiAccount,
	type MonthlyAmounts,
	type PaguMap,
} from "@/lib/simulation/deviasi-workspace";
import { fetchBudgetAndRevisions } from "@/services/budget-revisions-service";
import {
	fetchRpdAndRealizations,
	saveRealization,
	saveRpdLine,
} from "@/services/rpd-realization-service";

export const Route = createFileRoute("/operator/data/rpd-realization")({
	loader: async ({ context }) => {
		const activeOrgId =
			context.auth?.isAuthenticated &&
			(context.access?.status === "operator_single_scope" ||
				context.access?.status === "operator_multiple_scopes")
				? (context.access.activeOrganizationId ?? undefined)
				: undefined;

		const [rpdData, budgetData] = await Promise.all([
			fetchRpdAndRealizations(activeOrgId),
			fetchBudgetAndRevisions(activeOrgId),
		]);
		return { rpdData, budgetData };
	},
	component: RpdRealizationPage,
});

const MONTH_NAMES = [
	"Januari",
	"Februari",
	"Maret",
	"April",
	"Mei",
	"Juni",
	"Juli",
	"Agustus",
	"September",
	"Oktober",
	"November",
	"Desember",
];

const ACCOUNT_LABELS: Record<DeviasiAccount, string> = {
	"51": "Belanja Pegawai (51)",
	"52": "Belanja Barang (52)",
	"53": "Belanja Modal (53)",
	"57": "Belanja Bantuan Sosial (57)",
};

interface MonthlyAccountSummary {
	id: string;
	accountCode: DeviasiAccount;
	accountName: string;
	month: number;
	rpdAmount: number;
	realizationAmount: number;
	deviationPercent: number;
	weightPercent: number;
	weightedDevPercent: number;
	absorptionPercent: number;
	status: "safe" | "warning" | "danger";
}

function parseNumber(val: string | undefined): number {
	const n = Number(val);
	return Number.isFinite(n) ? n : 0;
}

function RpdRealizationPage() {
	const router = useRouter();
	const { rpdData, budgetData } = Route.useLoaderData();

	const activeContext = useActiveContext();
	const selectedMonth =
		activeContext?.context.period.kind === "month"
			? activeContext.context.period.value
			: new Date().getMonth() + 1;
	const setSelectedMonth = (month: number) =>
		activeContext?.setPeriod({ kind: "month", value: month });

	const [isRpdDrawerOpen, setIsRpdDrawerOpen] = useState(false);
	const [isRealDrawerOpen, setIsRealDrawerOpen] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isTraceOpen, setIsTraceOpen] = useState(false);
	const [actionMessage, setActionMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	// Drawer form states
	const [formAccount, setFormAccount] = useState<DeviasiAccount>("51");
	const [formMonth, setFormMonth] = useState<number>(selectedMonth);
	const [formAmount, setFormAmount] = useState<string>("");

	// Build Pagu Map
	const pagu: PaguMap = useMemo(() => {
		const map: PaguMap = {};
		for (const b of budgetData.budgets) {
			const code = b.accountCode as DeviasiAccount;
			if (DEVIASI_ACCOUNTS.includes(code)) {
				map[code] = parseNumber(b.amount);
			}
		}
		return map;
	}, [budgetData]);

	const weights = useMemo(() => paguWeights(pagu), [pagu]);
	const hasPagu = DEVIASI_ACCOUNTS.some((a) => (pagu[a] ?? 0) > 0);

	// Build RPD & Realization maps
	const rpdMap: MonthlyAmounts = useMemo(() => {
		const map: MonthlyAmounts = {};
		for (const r of rpdData.rpdLines) {
			const code = r.accountCode as DeviasiAccount;
			if (!DEVIASI_ACCOUNTS.includes(code)) continue;
			if (r.month < 1 || r.month > 12) continue;
			const slot = map[r.month] ?? {};
			slot[code] = parseNumber(r.amount);
			map[r.month] = slot;
		}
		return map;
	}, [rpdData]);

	const realMap: MonthlyAmounts = useMemo(() => {
		const map: MonthlyAmounts = {};
		for (const r of rpdData.realizations) {
			const code = r.accountCode as DeviasiAccount;
			if (!DEVIASI_ACCOUNTS.includes(code)) continue;
			if (r.month < 1 || r.month > 12) continue;
			const slot = map[r.month] ?? {};
			slot[code] = parseNumber(r.amount);
			map[r.month] = slot;
		}
		return map;
	}, [rpdData]);

	// Indicator score s.d. bulan terpilih (Jan–Nov, max 11)
	const evalMonth = Math.min(Math.max(selectedMonth, 1), 11);
	const scoreObj = useMemo(
		() =>
			calcDeviasiScore(
				buildDeviationInput(pagu, rpdMap, realMap, {}, {}, evalMonth),
			),
		[pagu, rpdMap, realMap, evalMonth],
	);

	// Selected month summary & rows
	const monthDevDetail = useMemo(
		() =>
			calcMonthDeviation(
				rpdMap[selectedMonth] ?? {},
				realMap[selectedMonth] ?? {},
				pagu,
			),
		[rpdMap, realMap, pagu, selectedMonth],
	);

	const monthlyData: MonthlyAccountSummary[] = useMemo(() => {
		return DEVIASI_ACCOUNTS.map((code) => {
			const rpdVal = rpdMap[selectedMonth]?.[code] ?? 0;
			const realVal = realMap[selectedMonth]?.[code] ?? 0;
			const devPercent = deviationOf(rpdVal, realVal);
			const weightPercent = (weights[code] ?? 0) * 100;
			const weightedDevPercent = devPercent * (weights[code] ?? 0);
			const absPercent = rpdVal > 0 ? (realVal / rpdVal) * 100 : 0;

			let status: "safe" | "warning" | "danger" = "safe";
			if (devPercent > 10) status = "danger";
			else if (devPercent > 5) status = "warning";

			return {
				id: `${code}-${selectedMonth}`,
				accountCode: code,
				accountName: ACCOUNT_LABELS[code],
				month: selectedMonth,
				rpdAmount: rpdVal,
				realizationAmount: realVal,
				deviationPercent: devPercent,
				weightPercent,
				weightedDevPercent,
				absorptionPercent: absPercent,
				status,
			};
		});
	}, [rpdMap, realMap, selectedMonth, weights]);

	// History Trace s.d. bulan terpilih
	const historicalTrail = useMemo(
		() => calculateHistoricalTrail(pagu, rpdMap, realMap, evalMonth),
		[pagu, rpdMap, realMap, evalMonth],
	);

	// Target Analysis & Quarterly Reminder
	const targetAnalysis = useMemo(
		() =>
			calcNextMonthTarget(
				scoreObj.avgDeviation ?? 0,
				scoreObj.monthsCount,
				evalMonth < 11 ? evalMonth + 1 : 11,
			),
		[scoreObj, evalMonth],
	);

	const quarterlyReminders = useMemo(
		() => getQuarterlyRpdReminders(selectedMonth),
		[selectedMonth],
	);

	// Drawer Live Preview calculation
	const drawerPreview = useMemo(() => {
		const rawNum = Number(formAmount);
		const isNegative = Number.isFinite(rawNum) && rawNum < 0;
		const isValidNum = Number.isFinite(rawNum) && !isNegative;
		const newAmount = isValidNum ? rawNum : 0;

		const isRpd = isRpdDrawerOpen;
		const simRpd: MonthlyAmounts = JSON.parse(JSON.stringify(rpdMap));
		const simReal: MonthlyAmounts = JSON.parse(JSON.stringify(realMap));

		const m = Math.min(Math.max(formMonth, 1), 11);
		if (isRpd) {
			const s = simRpd[m] ?? {};
			s[formAccount] = newAmount;
			simRpd[m] = s;
		} else {
			const s = simReal[m] ?? {};
			s[formAccount] = newAmount;
			simReal[m] = s;
		}

		const planned = simRpd[m]?.[formAccount] ?? 0;
		const realized = simReal[m]?.[formAccount] ?? 0;
		const accDev = deviationOf(planned, realized);
		const accWeighted = accDev * (weights[formAccount] ?? 0);

		const monthDetail = calcMonthDeviation(
			simRpd[m] ?? {},
			simReal[m] ?? {},
			pagu,
		);
		const newScoreObj = calcDeviasiScore(
			buildDeviationInput(pagu, simRpd, simReal, {}, {}, m),
		);

		return {
			isNegative,
			isValid: isValidNum,
			accDev,
			accWeighted,
			monthWeightedDev: monthDetail.monthWeightedDeviation,
			newScore: newScoreObj.score,
			newContribution: newScoreObj.contribution,
			newAvg: newScoreObj.avgDeviation,
			monthsCount: newScoreObj.monthsCount,
		};
	}, [
		isRpdDrawerOpen,
		formAmount,
		formMonth,
		formAccount,
		rpdMap,
		realMap,
		weights,
		pagu,
	]);

	const handleSaveRpd = async () => {
		setActionMessage(null);
		setErrorMessage(null);
		const val = Number.parseFloat(formAmount);

		if (Number.isNaN(val) || val < 0) {
			setErrorMessage("Nominal RPD harus berupa angka positif atau nol (tidak boleh negatif).");
			return;
		}

		setIsSubmitting(true);
		try {
			await saveRpdLine({
				month: formMonth,
				accountCode: formAccount,
				amount: val.toFixed(2),
			});
			setActionMessage(
				`Target RPD ${ACCOUNT_LABELS[formAccount]} bulan ${MONTH_NAMES[formMonth - 1]} berhasil diperbarui.`,
			);
			setIsRpdDrawerOpen(false);
			setFormAmount("");
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal menyimpan target RPD.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSaveRealization = async () => {
		setActionMessage(null);
		setErrorMessage(null);
		const val = Number.parseFloat(formAmount);

		if (Number.isNaN(val) || val < 0) {
			setErrorMessage("Nominal Realisasi harus berupa angka positif atau nol (tidak boleh negatif).");
			return;
		}

		setIsSubmitting(true);
		try {
			await saveRealization({
				month: formMonth,
				accountCode: formAccount,
				amount: val.toFixed(2),
			});
			setActionMessage(
				`Realisasi ${ACCOUNT_LABELS[formAccount]} bulan ${MONTH_NAMES[formMonth - 1]} berhasil diperbarui.`,
			);
			setIsRealDrawerOpen(false);
			setFormAmount("");
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal menyimpan realisasi.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const columns: ColumnDef<MonthlyAccountSummary>[] = [
		{
			key: "account",
			header: "Jenis Belanja",
			render: (item) => (
				<div>
					<span className="font-semibold text-foreground">
						Akun {item.accountCode}
					</span>
					<p className="text-[11px] text-muted-foreground">
						{item.accountName}
					</p>
				</div>
			),
		},
		{
			key: "rpd",
			header: "Target RPD (Hal III DIPA)",
			render: (item) => (
				<div className="flex items-center justify-between gap-2">
					<span className="font-medium text-foreground">
						{formatRupiah(item.rpdAmount)}
					</span>
					<button
						type="button"
						onClick={() => {
							setFormAccount(item.accountCode);
							setFormMonth(selectedMonth);
							setFormAmount(
								item.rpdAmount > 0 ? item.rpdAmount.toString() : "",
							);
							setIsRpdDrawerOpen(true);
						}}
						className="text-[11px] font-semibold text-primary hover:underline"
					>
						Ubah
					</button>
				</div>
			),
		},
		{
			key: "realization",
			header: "Realisasi SP2D",
			render: (item) => (
				<div className="flex items-center justify-between gap-2">
					<span className="font-semibold text-foreground">
						{formatRupiah(item.realizationAmount)}
					</span>
					<button
						type="button"
						onClick={() => {
							setFormAccount(item.accountCode);
							setFormMonth(selectedMonth);
							setFormAmount(
								item.realizationAmount > 0
									? item.realizationAmount.toString()
									: "",
							);
							setIsRealDrawerOpen(true);
						}}
						className="text-[11px] font-semibold text-primary hover:underline"
					>
						Ubah
					</button>
				</div>
			),
		},
		{
			key: "deviation",
			header: "Deviasi (%)",
			render: (item) => (
				<span
					className={`font-semibold ${
						item.status === "danger"
							? "text-danger"
							: item.status === "warning"
								? "text-warning"
								: "text-success"
					}`}
				>
					{formatPercent(item.deviationPercent)}
				</span>
			),
		},
		{
			key: "weight",
			header: "Bobot Pagu (%)",
			render: (item) => (
				<span className="text-xs text-muted-foreground">
					{formatPercent(item.weightPercent)}
				</span>
			),
		},
		{
			key: "weightedDev",
			header: "Deviasi Tertimbang (%)",
			render: (item) => (
				<span className="font-semibold text-foreground">
					{formatPercent(item.weightedDevPercent)}
				</span>
			),
		},
		{
			key: "status",
			header: "Status Kepatuhan",
			render: (item) => {
				const badgeStyle =
					item.status === "safe"
						? "bg-success/10 text-success border border-success/20"
						: item.status === "warning"
							? "bg-warning/10 text-warning border border-warning/20"
							: "bg-danger/10 text-danger border border-danger/20";

				const label =
					item.status === "safe"
						? "Aman (nilai 100 jika avg ≤5%)"
						: item.status === "warning"
							? "Perhatian (>5% s.d. 10%)"
							: "Menggerus nilai (>10%)";

				return (
					<span
						className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${badgeStyle}`}
					>
						{label}
					</span>
				);
			},
		},
	];

	return (
		<OperatorShell currentPath="/operator/data/rpd-realization">
			<div className="space-y-6">
				{/* Top Header Banner & Operator Guide */}
				<div className="rounded-2xl border border-border bg-surface p-5 shadow-xs space-y-4">
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div className="flex items-start gap-3 max-w-3xl">
							<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
								<TrendingUp className="size-5" />
							</div>
							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<h1 className="text-lg font-bold text-foreground sm:text-xl">
										RPD &amp; Realisasi Anggaran (Deviasi Hal III DIPA)
									</h1>
									<span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
										Bobot 15%
									</span>
								</div>
								<p className="text-xs text-muted-foreground leading-relaxed">
									Indikator ini mengukur apakah realisasi bulanan sesuai RPD Halaman III DIPA. Dihitung <strong className="text-foreground">per jenis belanja</strong> (51, 52, 53, 57), lalu <strong className="text-foreground">ditimbang</strong> dengan proporsi pagu. Periode <strong className="text-foreground">Januari–November</strong>. Desember <strong className="text-foreground">tidak</strong> masuk skor. Rata-rata deviasi <strong className="text-foreground">0–5% = nilai 100</strong>. Di atas 5% = <strong className="text-foreground">100 − rata-rata</strong> (contoh 6% → 94). Deviasi tiap akun dibatasi <strong className="text-foreground">100%</strong>.
								</p>
							</div>
						</div>

						<div className="flex flex-col items-end gap-2">
							<div className="flex items-center gap-2">
								<a
									href="/operator/deviasi"
									className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition"
								>
									Lihat Simulasi Skor Deviasi →
								</a>
							</div>
							<a
								href="/operator/data/budget-revisions"
								className="text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:underline"
							>
								Atur Pagu &amp; Revisi DIPA →
							</a>
						</div>
					</div>

					{/* 3 Langkah Operator */}
					<div className="grid grid-cols-1 gap-2 border-t border-border/60 pt-3 sm:grid-cols-3">
						<div className="flex items-start gap-2 text-xs text-muted-foreground">
							<span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
								1
							</span>
							<span>
								Isi <strong>pagu</strong> per jenis belanja (sumber bobot pembagi).
							</span>
						</div>
						<div className="flex items-start gap-2 text-xs text-muted-foreground">
							<span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
								2
							</span>
							<span>
								Isi <strong>RPD</strong> dan <strong>realisasi</strong> per bulan per akun belanja.
							</span>
						</div>
						<div className="flex items-start gap-2 text-xs text-muted-foreground">
							<span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
								3
							</span>
							<span>
								Pantau objek bulan <strong>(n)</strong>, rata-rata tertimbang, &amp; nilai IKPA seketika.
							</span>
						</div>
					</div>
				</div>

				{/* Pagu 0 Warning */}
				{!hasPagu && (
					<div className="flex items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-xs font-medium text-warning shadow-xs">
						<div className="flex items-center gap-2.5">
							<AlertTriangle className="size-4 shrink-0" />
							<p>
								<strong>Pagu jenis belanja belum diisi.</strong> Bobot proporsi pagu (51, 52, 53, 57) belum bisa dihitung.
							</p>
						</div>
						<a
							href="/operator/data/budget-revisions"
							className="shrink-0 font-bold underline underline-offset-2 hover:text-foreground"
						>
							Isi Pagu DIPA Sekarang →
						</a>
					</div>
				)}

				{/* Month Selector Pills & December Notice */}
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background p-3 shadow-xs">
					<div className="flex items-center gap-2">
						<Calendar className="size-4 text-muted-foreground ml-1" />
						<span className="text-xs font-semibold text-foreground">
							Pilih Bulan Data:
						</span>
					</div>

					<div className="flex flex-wrap items-center gap-1">
						{MONTH_NAMES.map((name, idx) => {
							const m = idx + 1;
							const isSelected = m === selectedMonth;
							const isDes = m === 12;

							return (
								<button
									key={name}
									type="button"
									onClick={() => setSelectedMonth(m)}
									title={isDes ? "Desember tidak masuk skor Deviasi Hal III (hanya untuk Penyerapan)" : `Bulan ${name}`}
									className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
										isSelected
											? isDes
												? "bg-muted text-foreground border border-border shadow-xs"
												: "bg-primary text-primary-foreground shadow-xs"
											: isDes
												? "text-muted-foreground/70 hover:text-foreground border border-dashed border-border"
												: "text-muted-foreground hover:text-foreground hover:bg-surface-muted"
									}`}
								>
									{isDes ? "Des (Penyerapan)" : name.slice(0, 3)}
								</button>
							);
						})}
					</div>
				</div>

				{/* December excluded banner */}
				{selectedMonth === 12 && (
					<div className="flex items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs font-medium text-foreground shadow-xs">
						<Info className="size-4 text-primary shrink-0" />
						<p>
							<strong>Catatan:</strong> Bulan <strong>Desember</strong> tidak masuk perhitungan skor Deviasi Halaman III DIPA (evaluasi penilaian IKPA resmi berjalan Januari–November). Data Desember digunakan untuk indikator Penyerapan Anggaran.
						</p>
					</div>
				)}

				{/* Feedback status */}
				{actionMessage && (
					<output className="flex items-center gap-2.5 rounded-xl border border-success/30 bg-success/10 p-4 text-xs font-semibold text-success shadow-xs">
						<CheckCircle2 className="size-4 shrink-0" />
						<p>{actionMessage}</p>
					</output>
				)}

				{errorMessage && (
					<div
						role="alert"
						className="flex items-center gap-2.5 rounded-xl border border-danger/30 bg-danger/10 p-4 text-xs font-semibold text-danger shadow-xs"
					>
						<AlertCircle className="size-4 shrink-0" />
						<p>{errorMessage}</p>
					</div>
				)}

				{/* Zona B: 5 Sticky/Top Score Cards */}
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
					{/* Card 1: Nilai Indikator */}
					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold">Nilai Indikator</span>
							<ShieldCheck className="size-4 text-primary" />
						</div>
						<p className="text-2xl font-bold text-foreground">
							{scoreObj.score !== null ? formatPercent(scoreObj.score) : "—"}
						</p>
						<p className="text-[11px] text-muted-foreground">
							{scoreObj.avgDeviation !== null && scoreObj.avgDeviation <= 5
								? "Rata-rata ≤ 5% → Nilai 100"
								: scoreObj.avgDeviation !== null
									? "Rumus: 100 − Rata-rata"
									: "Belum terhitung"}
						</p>
					</div>

					{/* Card 2: Rata-rata Deviasi (with divisor n) */}
					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold">Rata-rata Deviasi</span>
							<Percent
								className={`size-4 ${
									scoreObj.avgDeviation !== null && scoreObj.avgDeviation > 10
										? "text-danger"
										: scoreObj.avgDeviation !== null && scoreObj.avgDeviation > 5
											? "text-warning"
											: "text-success"
								}`}
							/>
						</div>
						<p
							className={`text-2xl font-bold ${
								scoreObj.avgDeviation !== null && scoreObj.avgDeviation > 10
									? "text-danger"
									: scoreObj.avgDeviation !== null && scoreObj.avgDeviation > 5
										? "text-warning"
										: "text-foreground"
							}`}
						>
							{scoreObj.avgDeviation !== null
								? formatPercent(scoreObj.avgDeviation)
								: "—"}
						</p>
						<p className="text-[11px] text-muted-foreground">
							Objek: <strong>n = {scoreObj.monthsCount} bulan</strong> (Jan–{MONTH_NAMES[evalMonth - 1]})
						</p>
					</div>

					{/* Card 3: Deviasi Bulan Terpilih */}
					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold">
								Deviasi {MONTH_NAMES[selectedMonth - 1]}
							</span>
							<Target className="size-4 text-primary" />
						</div>
						<p className="text-2xl font-bold text-foreground">
							{formatPercent(monthDevDetail.monthWeightedDeviation)}
						</p>
						<p className="text-[11px] text-muted-foreground">
							Jumlah tertimbang 51+52+53+57
						</p>
					</div>

					{/* Card 4: Sisa Ruang ke 5% */}
					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold">Sisa Toleransi 5%</span>
							<Coins className="size-4 text-primary" />
						</div>
						<p className="text-lg font-bold text-foreground sm:text-xl">
							{scoreObj.avgDeviation !== null ? (
								scoreObj.avgDeviation <= 5 ? (
									<span className="text-success">
										+{(5 - scoreObj.avgDeviation).toFixed(2)}%
									</span>
								) : (
									<span className="text-danger">
										-{(scoreObj.avgDeviation - 5).toFixed(2)}%
									</span>
								)
							) : (
								"—"
							)}
						</p>
						<p className="text-[11px] text-muted-foreground">
							{scoreObj.avgDeviation !== null && scoreObj.avgDeviation <= 5
								? "Boleh naik sebelum nilai berkurang"
								: "Melewati batas toleransi"}
						</p>
					</div>

					{/* Card 5: Kontribusi IKPA */}
					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold">Kontribusi IKPA</span>
							<Sparkles className="size-4 text-primary" />
						</div>
						<p className="text-2xl font-bold text-foreground">
							{scoreObj.contribution !== null
								? `${scoreObj.contribution.toFixed(2)} poin`
								: "—"}
						</p>
						<p className="text-[11px] text-muted-foreground">
							Nilai × 15% bobot IKPA
						</p>
					</div>
				</div>

				{/* Quarterly RPD Update Reminder Strip (DH-10) */}
				<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-3">
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-2">
							<Calendar className="size-4 text-primary" />
							<h2 className="text-xs font-bold text-foreground uppercase tracking-wide">
								Jadwal Pemutakhiran RPD Triwulanan (PER-5/PB/2024)
							</h2>
						</div>
						<span className="text-[11px] text-muted-foreground">
							Kunci RPD sebelum batas waktu
						</span>
					</div>

					<div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
						{quarterlyReminders.map((q) => (
							<div
								key={q.quarter}
								className={`rounded-xl border p-3 text-xs transition ${
									q.isCurrentQuarter
										? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/20"
										: "border-border bg-surface text-muted-foreground"
								}`}
							>
								<div className="flex items-center justify-between">
									<span className="font-bold text-foreground">{q.label}</span>
									{q.isCurrentQuarter && (
										<span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
											Triwulan Aktif
										</span>
									)}
								</div>
								<p className="mt-1 text-[11px] font-semibold text-primary">
									Tenggat: {q.deadlineNotice}
								</p>
								<p className="mt-1 text-[11px] text-muted-foreground">
									{q.recommendedAction}
								</p>
								<div className="mt-2 flex items-center gap-1">
									{q.months.map((m) => (
										<button
											key={m}
											type="button"
											onClick={() => setSelectedMonth(m)}
											className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${
												m === selectedMonth
													? "bg-primary text-primary-foreground"
													: "bg-surface-muted text-foreground hover:bg-border"
											}`}
										>
											{MONTH_NAMES[m - 1].slice(0, 3)}
										</button>
									))}
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Zona A: Data Table for Selected Month */}
				<DomainDataTable
					title={`Data RPD & Realisasi Bulan ${MONTH_NAMES[selectedMonth - 1]} 2026`}
					data={monthlyData}
					columns={columns}
					onAddClick={() => {
						setFormMonth(selectedMonth);
						setFormAccount("51");
						setFormAmount("");
						setIsRpdDrawerOpen(true);
					}}
					totalCount={monthlyData.length}
				/>

				{/* Accordion / Trail "Cara Angka Ini Dihitung" (DH-08) */}
				<div className="rounded-2xl border border-border bg-background shadow-xs overflow-hidden">
					<button
						type="button"
						onClick={() => setIsTraceOpen(!isTraceOpen)}
						className="flex w-full items-center justify-between p-4 text-left transition hover:bg-surface-muted"
					>
						<div className="flex items-center gap-2">
							<HelpCircle className="size-4 text-primary" />
							<span className="text-xs font-bold text-foreground uppercase tracking-wide">
								Cara Angka Ini Dihitung (Jejak Perhitungan Kumulatif Jan–{MONTH_NAMES[evalMonth - 1]})
							</span>
						</div>
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							<span>{isTraceOpen ? "Sembunyikan" : "Tampilkan Rincian"}</span>
							{isTraceOpen ? (
								<ChevronUp className="size-4" />
							) : (
								<ChevronDown className="size-4" />
							)}
						</div>
					</button>

					{isTraceOpen && (
						<div className="border-t border-border p-4 space-y-4">
							<p className="text-xs text-muted-foreground">
								Tabel jejak di bawah memperlihatkan bagaimana nilai deviasi bulanan dihitung dari deviasi per jenis belanja dan proporsi pagunya, lalu dirata-ratakan dengan pembagi <strong>n = bulan berjalan</strong>:
							</p>

							<div className="overflow-x-auto">
								<table className="w-full min-w-[720px] text-left text-xs">
									<thead>
										<tr className="border-b border-border text-muted-foreground font-semibold">
											<th className="px-2 py-2">Bulan</th>
											<th className="px-2 py-2 text-right">RPD (51+52+53+57)</th>
											<th className="px-2 py-2 text-right">Realisasi SP2D</th>
											<th className="px-2 py-2 text-right">Deviasi Bulan</th>
											<th className="px-2 py-2 text-right">Objek (n)</th>
											<th className="px-2 py-2 text-right">Rata-rata Kumulatif</th>
											<th className="px-2 py-2 text-right">Nilai IKPA</th>
											<th className="px-2 py-2 text-center">Status</th>
										</tr>
									</thead>
									<tbody>
										{historicalTrail.map((row) => (
											<tr
												key={row.month}
												className={`border-b border-border/60 ${
													row.month === selectedMonth ? "bg-primary/5" : ""
												}`}
											>
												<td className="px-2 py-2 font-bold text-foreground">
													{MONTH_NAMES[row.month - 1]}
												</td>
												<td className="px-2 py-2 text-right font-medium text-foreground">
													{formatRupiah(
														(row.rpd["51"] ?? 0) +
															(row.rpd["52"] ?? 0) +
															(row.rpd["53"] ?? 0) +
															(row.rpd["57"] ?? 0),
													)}
												</td>
												<td className="px-2 py-2 text-right font-medium text-foreground">
													{formatRupiah(
														(row.realized["51"] ?? 0) +
															(row.realized["52"] ?? 0) +
															(row.realized["53"] ?? 0) +
															(row.realized["57"] ?? 0),
													)}
												</td>
												<td className="px-2 py-2 text-right font-semibold text-foreground">
													{formatPercent(row.monthWeightedDev)}
												</td>
												<td className="px-2 py-2 text-right text-muted-foreground font-semibold">
													n = {row.month}
												</td>
												<td className="px-2 py-2 text-right font-bold text-foreground">
													{formatPercent(row.cumulativeAvg)}
												</td>
												<td className="px-2 py-2 text-right font-bold text-primary">
													{row.cumulativeScore.toFixed(2)}
												</td>
												<td className="px-2 py-2 text-center">
													<span
														className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${
															row.status === "safe"
																? "bg-success/10 text-success"
																: row.status === "warning"
																	? "bg-warning/10 text-warning"
																	: "bg-danger/10 text-danger"
														}`}
													>
														{row.status === "safe"
															? "100 (Aman)"
															: row.status === "warning"
																? "Turun"
																: "Menggerus"}
													</span>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					)}
				</div>

				{/* Panel Strategi Satker & Target Bulan Depan (DH-11) */}
				<div className="rounded-2xl border border-border bg-background p-5 shadow-xs space-y-4">
					<div className="flex items-center gap-2">
						<Target className="size-5 text-primary" />
						<h2 className="text-sm font-bold text-foreground uppercase tracking-wide">
							Strategi Satker: Cara Jaga Nilai 100 &amp; Target Bulan Depan
						</h2>
					</div>

					<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
						{/* Strategi 4 Poin */}
						<div className="space-y-2.5 text-xs text-muted-foreground">
							<div className="flex items-start gap-2">
								<span className="font-bold text-primary">1.</span>
								<p>
									<strong>Alat Kendali KPA:</strong> Halaman III DIPA adalah alat kendali eksekusi anggaran. Pastikan jadwal kegiatan unit selalu selaras dengan RPD.
								</p>
							</div>
							<div className="flex items-start gap-2">
								<span className="font-bold text-primary">2.</span>
								<p>
									<strong>Manfaatkan Pemutakhiran Triwulanan:</strong> Ajukan revisi RPD pada bulan Feb, Apr, Jul, dan Okt sebelum batas kunci DIPA.
								</p>
							</div>
							<div className="flex items-start gap-2">
								<span className="font-bold text-primary">3.</span>
								<p>
									<strong>Jaga Rata-rata Kumulatif ≤ 5%:</strong> Jika satu bulan memiliki deviasi tinggi, bulan berikutnya harus ditekan serendah mungkin untuk menurunkan rata-rata.
								</p>
							</div>
							<div className="flex items-start gap-2">
								<span className="font-bold text-primary">4.</span>
								<p>
									<strong>Cap 100% Tiap Akun:</strong> Realisasi tanpa RPD otomatis dikenakan penalti deviasi 100%. Jangan pernah mencairkan belanja pada akun yang RPD-nya 0.
								</p>
							</div>
						</div>

						{/* Dynamic Target Projection Box */}
						<div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2.5">
							<div className="flex items-center justify-between">
								<span className="text-xs font-bold text-foreground">
									Target Proyeksi Deviasi Bulan Depan
								</span>
								<span className="text-[11px] font-semibold text-primary">
									n = {targetAnalysis.targetMonth}
								</span>
							</div>
							<p className="text-xs text-foreground leading-relaxed">
								{targetAnalysis.message}
							</p>
							<div className="border-t border-primary/10 pt-2 flex items-center justify-between text-[11px] text-muted-foreground">
								<span>Rata-rata saat ini: <strong>{formatPercent(scoreObj.avgDeviation ?? 0)}</strong></span>
								<span>Skor saat ini: <strong>{scoreObj.score?.toFixed(2) ?? "100.00"}</strong></span>
							</div>
						</div>
					</div>
				</div>

				{/* Drawer 1: Form Input RPD with Real-time Preview */}
				<DomainFormDrawer
					isOpen={isRpdDrawerOpen}
					title="Atur Target RPD (Hal III DIPA)"
					description="Masukkan rencana penarikan dana per jenis belanja untuk bulan terpilih."
					onClose={() => setIsRpdDrawerOpen(false)}
					onSubmit={handleSaveRpd}
					isSubmitting={isSubmitting}
				>
					<div className="space-y-4">
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<label
									htmlFor="rpd-month"
									className="block text-xs font-semibold text-foreground"
								>
									Bulan
								</label>
								<select
									id="rpd-month"
									value={formMonth}
									onChange={(e) => setFormMonth(Number(e.target.value))}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								>
									{MONTH_NAMES.map((n, idx) => (
										<option key={n} value={idx + 1}>
											{n} {idx === 11 ? "(tidak masuk skor)" : ""}
										</option>
									))}
								</select>
							</div>

							<div className="space-y-1.5">
								<label
									htmlFor="rpd-account"
									className="block text-xs font-semibold text-foreground"
								>
									Jenis Belanja
								</label>
								<select
									id="rpd-account"
									value={formAccount}
									onChange={(e) =>
										setFormAccount(
											e.target.value as DeviasiAccount,
										)
									}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								>
									<option value="51">Belanja Pegawai (51)</option>
									<option value="52">Belanja Barang (52)</option>
									<option value="53">Belanja Modal (53)</option>
									<option value="57">Belanja Bansos (57)</option>
								</select>
							</div>
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="rpd-amount"
								className="block text-xs font-semibold text-foreground"
							>
								Nominal Target RPD (Rp)
							</label>
							<FormattedNumberInput
								id="rpd-amount"
								required
								placeholder="Contoh: 250.000.000"
								value={formAmount}
								onChange={setFormAmount}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							/>
							{drawerPreview.isNegative && (
								<p className="text-[11px] font-semibold text-danger">
									Nominal tidak boleh negatif.
								</p>
							)}
						</div>

						{/* Real-time Preview Box */}
						{formAmount !== "" && !drawerPreview.isNegative && (
							<div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2 text-xs">
								<div className="flex items-center justify-between font-bold text-foreground">
									<span>Pratinjau Dampak Simulasi</span>
									<span className="text-[11px] text-primary">
										Bulan {MONTH_NAMES[formMonth - 1]}
									</span>
								</div>
								<div className="grid grid-cols-2 gap-2 text-[11px]">
									<div>
										<span className="text-muted-foreground">Deviasi Akun {formAccount}:</span>
										<p className="font-bold text-foreground">
											{formatPercent(drawerPreview.accDev)}
										</p>
									</div>
									<div>
										<span className="text-muted-foreground">Tertimbang Akun:</span>
										<p className="font-bold text-foreground">
											{formatPercent(drawerPreview.accWeighted)}
										</p>
									</div>
									<div>
										<span className="text-muted-foreground">Deviasi Bulan Ini:</span>
										<p className="font-bold text-foreground">
											{formatPercent(drawerPreview.monthWeightedDev)}
										</p>
									</div>
									<div>
										<span className="text-muted-foreground">Rata-rata n={drawerPreview.monthsCount}:</span>
										<p className="font-bold text-foreground">
											{scoreObj.avgDeviation?.toFixed(2) ?? "0.00"}% → {drawerPreview.newAvg?.toFixed(2) ?? "0.00"}%
										</p>
									</div>
								</div>
								<div className="border-t border-primary/10 pt-1.5 flex items-center justify-between text-xs font-bold text-primary">
									<span>Proyeksi Nilai IKPA:</span>
									<span>
										{scoreObj.score?.toFixed(2) ?? "100.00"} → {drawerPreview.newScore?.toFixed(2) ?? "100.00"}
									</span>
								</div>
							</div>
						)}
					</div>
				</DomainFormDrawer>

				{/* Drawer 2: Form Input Realisasi with Real-time Preview */}
				<DomainFormDrawer
					isOpen={isRealDrawerOpen}
					title="Atur Realisasi SP2D"
					description="Masukkan realisasi belanja aktual SP2D untuk bulan terpilih."
					onClose={() => setIsRealDrawerOpen(false)}
					onSubmit={handleSaveRealization}
					isSubmitting={isSubmitting}
				>
					<div className="space-y-4">
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<label
									htmlFor="real-month"
									className="block text-xs font-semibold text-foreground"
								>
									Bulan
								</label>
								<select
									id="real-month"
									value={formMonth}
									onChange={(e) => setFormMonth(Number(e.target.value))}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								>
									{MONTH_NAMES.map((n, idx) => (
										<option key={n} value={idx + 1}>
											{n} {idx === 11 ? "(tidak masuk skor)" : ""}
										</option>
									))}
								</select>
							</div>

							<div className="space-y-1.5">
								<label
									htmlFor="real-account"
									className="block text-xs font-semibold text-foreground"
								>
									Jenis Belanja
								</label>
								<select
									id="real-account"
									value={formAccount}
									onChange={(e) =>
										setFormAccount(
											e.target.value as DeviasiAccount,
										)
									}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								>
									<option value="51">Belanja Pegawai (51)</option>
									<option value="52">Belanja Barang (52)</option>
									<option value="53">Belanja Modal (53)</option>
									<option value="57">Belanja Bansos (57)</option>
								</select>
							</div>
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="real-amount"
								className="block text-xs font-semibold text-foreground"
							>
								Nominal Realisasi Aktual (Rp)
							</label>
							<FormattedNumberInput
								id="real-amount"
								required
								placeholder="Contoh: 245.000.000"
								value={formAmount}
								onChange={setFormAmount}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							/>
							{drawerPreview.isNegative && (
								<p className="text-[11px] font-semibold text-danger">
									Nominal tidak boleh negatif.
								</p>
							)}
						</div>

						{/* Real-time Preview Box */}
						{formAmount !== "" && !drawerPreview.isNegative && (
							<div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2 text-xs">
								<div className="flex items-center justify-between font-bold text-foreground">
									<span>Pratinjau Dampak Simulasi</span>
									<span className="text-[11px] text-primary">
										Bulan {MONTH_NAMES[formMonth - 1]}
									</span>
								</div>
								<div className="grid grid-cols-2 gap-2 text-[11px]">
									<div>
										<span className="text-muted-foreground">Deviasi Akun {formAccount}:</span>
										<p className="font-bold text-foreground">
											{formatPercent(drawerPreview.accDev)}
										</p>
									</div>
									<div>
										<span className="text-muted-foreground">Tertimbang Akun:</span>
										<p className="font-bold text-foreground">
											{formatPercent(drawerPreview.accWeighted)}
										</p>
									</div>
									<div>
										<span className="text-muted-foreground">Deviasi Bulan Ini:</span>
										<p className="font-bold text-foreground">
											{formatPercent(drawerPreview.monthWeightedDev)}
										</p>
									</div>
									<div>
										<span className="text-muted-foreground">Rata-rata n={drawerPreview.monthsCount}:</span>
										<p className="font-bold text-foreground">
											{scoreObj.avgDeviation?.toFixed(2) ?? "0.00"}% → {drawerPreview.newAvg?.toFixed(2) ?? "0.00"}%
										</p>
									</div>
								</div>
								<div className="border-t border-primary/10 pt-1.5 flex items-center justify-between text-xs font-bold text-primary">
									<span>Proyeksi Nilai IKPA:</span>
									<span>
										{scoreObj.score?.toFixed(2) ?? "100.00"} → {drawerPreview.newScore?.toFixed(2) ?? "100.00"}
									</span>
								</div>
							</div>
						)}
					</div>
				</DomainFormDrawer>
			</div>
		</OperatorShell>
	);
}


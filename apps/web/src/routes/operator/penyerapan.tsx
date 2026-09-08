import { createFileRoute } from "@tanstack/react-router";
import { default2026RuleSet } from "@simulator-ikpa/ikpa-engine";
import { ShieldCheck, Sparkles, Target } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useMemo, useState } from "react";
import { FormattedNumberInput } from "@/components/data/formatted-number-input";
import { useActiveContext } from "@/components/layout/active-context";
import { OperatorShell } from "@/components/layout/operator-shell";
import { formatPercent, formatRupiah } from "@/lib/format";
import {
	PENYERAPAN_ACCOUNTS,
	calcPenyerapanScore,
	calcQuarterDetails,
	buildAbsorptionQuarters,
	quarterOfMonth,
	resolveQuarterlyPaguMap,
	type MonthlyAmounts,
	type PaguMap,
	type PenyerapanAccount,
	type QuarterPaguMap,
} from "@/lib/simulation/penyerapan-workspace";
import { fetchBudgetAndRevisions } from "@/services/budget-revisions-service";
import { fetchRpdAndRealizations } from "@/services/rpd-realization-service";
import { fetchSatkerSettings } from "@/services/settings-service";
import { executeSimulation } from "@/services/simulation-service";

export const Route = createFileRoute("/operator/penyerapan")({
	loader: async ({ context }) => {
		const activeOrgId =
			context.auth?.isAuthenticated &&
			(context.access?.status === "operator_single_scope" ||
				context.access?.status === "operator_multiple_scopes")
				? (context.access.activeOrganizationId ?? undefined)
				: undefined;

		const [budgetData, rpdData] = await Promise.all([
			fetchBudgetAndRevisions(activeOrgId),
			fetchRpdAndRealizations(activeOrgId),
		]);
		let isBlu = false;
		try {
			const settings = await fetchSatkerSettings(activeOrgId);
			isBlu = settings.isBlu;
		} catch {
			isBlu = false;
		}
		return { budgetData, rpdData, isBlu, activeOrgId };
	},
	component: PenyerapanPage,
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

const QUARTER_LABELS: Record<1 | 2 | 3 | 4, { title: string; period: string; endMonth: string }> = {
	1: { title: "Triwulan 1", period: "Januari – Maret", endMonth: "Maret" },
	2: { title: "Triwulan 2", period: "Januari – Juni", endMonth: "Juni" },
	3: { title: "Triwulan 3", period: "Januari – September", endMonth: "September" },
	4: { title: "Triwulan 4", period: "Januari – Desember", endMonth: "Desember" },
};

const ACCOUNT_LABELS: Record<PenyerapanAccount, { code: string; name: string; full: string }> = {
	"51": { code: "51", name: "Belanja Pegawai", full: "Belanja Pegawai (51)" },
	"52": { code: "52", name: "Belanja Barang", full: "Belanja Barang (52)" },
	"53": { code: "53", name: "Belanja Modal", full: "Belanja Modal (53)" },
	"57": { code: "57", name: "Bantuan Sosial", full: "Bantuan Sosial (57)" },
};

function parseAmount(value: string | undefined): number {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
}

function PenyerapanPage() {
	const { budgetData, rpdData, isBlu, activeOrgId } = Route.useLoaderData();
	const activeContext = useActiveContext();
	const currentMonth =
		activeContext?.context.period.kind === "month"
			? activeContext.context.period.value
			: new Date().getMonth() + 1;
	const currentQuarter = quarterOfMonth(currentMonth);

	const [selectedQuarter, setSelectedQuarter] = useState<1 | 2 | 3 | 4>(currentQuarter);
	const [plan, setPlan] = useState<Record<string, string>>({});
	const [isHelpOpen, setIsHelpOpen] = useState(false);
	const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

	const handleSelectQuarter = (q: 1 | 2 | 3 | 4) => {
		setSelectedQuarter(q);
		const endMonth = (q * 3) as 3 | 6 | 9 | 12;
		if (activeContext?.setPeriod && currentMonth !== endMonth) {
			activeContext.setPeriod({ kind: "month", value: endMonth });
		}
	};

	// Sync selected quarter when currentMonth changes
	useEffect(() => {
		setSelectedQuarter(currentQuarter);
	}, [currentQuarter]);

	// Load stored plan from localStorage on mount if available
	useEffect(() => {
		const storageKey = `sim_penyerapan_plan_${activeOrgId || "default"}`;
		try {
			const saved = localStorage.getItem(storageKey);
			if (saved) {
				const parsed = JSON.parse(saved);
				if (typeof parsed === "object" && parsed !== null) {
					setPlan(parsed);
				}
			}
		} catch {
			// ignore storage errors
		}
	}, [activeOrgId]);

	// Resolved quarterly cut-off pagu
	const quarterlyPagu: QuarterPaguMap = useMemo(() => {
		return resolveQuarterlyPaguMap(budgetData.budgets, budgetData.year || 2026);
	}, [budgetData]);

	// Flat latest pagu for fallbacks
	const flatPagu: PaguMap = useMemo(() => {
		const map: PaguMap = {};
		for (const b of budgetData.budgets) {
			const code = b.accountCode as PenyerapanAccount;
			if (PENYERAPAN_ACCOUNTS.includes(code)) {
				map[code] = parseAmount(b.amount);
			}
		}
		return map;
	}, [budgetData]);

	const actual: MonthlyAmounts = useMemo(() => {
		const map: MonthlyAmounts = {};
		for (const r of rpdData.realizations) {
			const code = r.accountCode as PenyerapanAccount;
			if (!PENYERAPAN_ACCOUNTS.includes(code)) continue;
			if (r.month < 1 || r.month > 12) continue;
			const slot = map[r.month] ?? {};
			if (slot[code] === undefined) slot[code] = parseAmount(r.amount);
			map[r.month] = slot;
		}
		return map;
	}, [rpdData]);

	const planAmounts: MonthlyAmounts = useMemo(() => {
		const map: MonthlyAmounts = {};
		for (const key of Object.keys(plan)) {
			const sep = key.indexOf(":");
			const month = Number(key.slice(0, sep));
			const code = key.slice(sep + 1) as PenyerapanAccount;
			if (!PENYERAPAN_ACCOUNTS.includes(code)) continue;
			if (!Number.isInteger(month) || month < 1 || month > 12) continue;
			const raw = Number(plan[key]);
			const slot = map[month] ?? {};
			slot[code] = Number.isFinite(raw) && raw > 0 ? raw : 0;
			map[month] = slot;
		}
		return map;
	}, [plan]);

	const planMonths = useMemo(() => {
		const months: number[] = [];
		for (let m = currentMonth + 1; m <= 12; m++) months.push(m);
		return months;
	}, [currentMonth]);

	// Simulated quarters (includes user plan if present)
	const simQuarters = useMemo(
		() => buildAbsorptionQuarters(quarterlyPagu, actual, planAmounts, currentMonth),
		[quarterlyPagu, actual, planAmounts, currentMonth],
	);

	// Actual quarters (only locked database data up to current evaluation quarter)
	const actualQuarters = useMemo(
		() => buildAbsorptionQuarters(quarterlyPagu, actual, {}, currentMonth, currentQuarter),
		[quarterlyPagu, actual, currentMonth, currentQuarter],
	);

	const score = useMemo(() => calcPenyerapanScore(simQuarters, isBlu), [simQuarters, isBlu]);
	const actualScore = useMemo(() => calcPenyerapanScore(actualQuarters, isBlu), [actualQuarters, isBlu]);

	const planDelta =
		score.score !== null && actualScore.score !== null
			? score.score - actualScore.score
			: null;
	const gap = score.score !== null ? Math.max(0, 100 - score.score) : null;

	// Calculation breakdown for the selected quarter
	const selectedQuarterDetails = useMemo(() => {
		return calcQuarterDetails(
			selectedQuarter,
			quarterlyPagu,
			actual,
			planAmounts,
			currentMonth,
			default2026RuleSet,
		);
	}, [selectedQuarter, quarterlyPagu, actual, planAmounts, currentMonth]);

	// Calculation breakdown for current evaluation quarter (for Strategy panel)
	const currentQuarterDetails = useMemo(() => {
		return calcQuarterDetails(
			currentQuarter,
			quarterlyPagu,
			actual,
			{},
			currentMonth,
			default2026RuleSet,
		);
	}, [currentQuarter, quarterlyPagu, actual, currentMonth]);

	const hasPagu = Object.values(flatPagu).some((v) => typeof v === "number" && v > 0);
	const hasPlan = Object.keys(plan).some((k) => {
		const v = Number(plan[k]);
		return Number.isFinite(v) && v > 0;
	});

	const hasRealization = Object.keys(actual).length > 0;
	const evaluatedQuartersCount = actualQuarters.length || 1;

	const setPlanValue = (month: number, acc: PenyerapanAccount, raw: string) => {
		const key = `${month}:${acc}`;
		setPlan((prev) => {
			const next = { ...prev };
			if (raw === "" || raw === "0") {
				delete next[key];
			} else {
				next[key] = raw;
			}
			return next;
		});
		setSaveStatus("idle");
	};

	const handleResetPlan = () => {
		setPlan({});
		const storageKey = `sim_penyerapan_plan_${activeOrgId || "default"}`;
		try {
			localStorage.removeItem(storageKey);
		} catch {
			// ignore
		}
		setSaveStatus("idle");
	};

	const handleSaveScenario = async () => {
		setSaveStatus("saving");
		try {
			const storageKey = `sim_penyerapan_plan_${activeOrgId || "default"}`;
			localStorage.setItem(storageKey, JSON.stringify(plan));

			await executeSimulation({
				orgId: activeOrgId,
				period: { kind: "month", value: currentMonth },
				simulationType: "scenario",
				simulationName: `Skenario Penyerapan Bulan ${MONTH_NAMES[currentMonth - 1]}`,
			});
			setSaveStatus("saved");
			setTimeout(() => {
				setSaveStatus("idle");
			}, 4000);
		} catch {
			setSaveStatus("error");
		}
	};

	return (
		<OperatorShell currentPath="/operator/penyerapan">
			<div className="space-y-6 max-w-7xl mx-auto pb-12">
				{/* Page Header */}
				<div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-border/60 pb-5">
					<div>
						<div className="flex items-center gap-2.5">
							<h1 className="text-2xl font-bold tracking-tight text-foreground">
								Penyerapan Anggaran
							</h1>
							<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
								Bobot 20%
							</span>
							{isBlu ? (
								<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
									Dikecualikan (BLU)
								</span>
							) : null}
						</div>
						<p className="mt-1.5 text-sm text-muted-foreground">
							Aktual s.d. {MONTH_NAMES[currentMonth - 1]} terkunci · Rencana sisa tahun dapat disimulasikan · Skor terhitung otomatis
						</p>
					</div>

					<div className="flex items-center gap-2 shrink-0">
						<Dialog.Root open={isHelpOpen} onOpenChange={setIsHelpOpen}>
							<Dialog.Trigger asChild>
								<button
									type="button"
									aria-label="Lihat panduan dan rumus Penyerapan Anggaran"
									className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-background text-xs font-medium text-foreground hover:bg-surface-muted shadow-sm transition-colors"
								>
									<span className="flex size-4 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-[10px]">
										?
									</span>
									<span>Panduan & Rumus</span>
								</button>
							</Dialog.Trigger>
							<Dialog.Portal>
								<Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-in fade-in" />
								<Dialog.Content className="fixed inset-x-4 top-[8%] z-50 mx-auto max-w-2xl rounded-2xl border border-border bg-background p-6 shadow-2xl outline-none max-h-[85vh] overflow-y-auto">
									<div className="flex items-center justify-between gap-4 border-b border-border pb-4">
										<Dialog.Title className="text-lg font-bold text-foreground">
											Panduan & Rumus Penyerapan Anggaran (Bobot 20%)
										</Dialog.Title>
										<Dialog.Close asChild>
											<button
												type="button"
												className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground"
											>
												Tutup
											</button>
										</Dialog.Close>
									</div>

									<div className="mt-4 space-y-4 text-sm text-foreground">
										<div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs leading-relaxed text-foreground">
											<p className="font-semibold text-primary mb-1">
												Ketentuan Penilaian IKPA Penyerapan:
											</p>
											Skor dihitung <strong>per triwulan</strong>, dari realisasi <strong>Januari sampai akhir triwulan</strong> (akumulatif). Target sudah ditentukan secara regulasi per jenis belanja dan tidak bisa diubah. Nilai triwulan = rata-rata tertimbang pagu. Nilai indikator = rata-rata triwulan yang sudah dinilai (TW1 s.d. triwulan berjalan).
										</div>

										<div>
											<h4 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-2">
												Matriks Target Akumulatif 2026 (% dari Pagu)
											</h4>
											<div className="overflow-x-auto rounded-xl border border-border">
												<table className="w-full text-xs text-left">
													<thead className="bg-surface-muted text-muted-foreground font-semibold">
														<tr>
															<th className="px-3 py-2">Jenis Belanja</th>
															<th className="px-3 py-2">Akun</th>
															<th className="px-3 py-2 text-right">Triwulan 1</th>
															<th className="px-3 py-2 text-right">Triwulan 2</th>
															<th className="px-3 py-2 text-right">Triwulan 3</th>
															<th className="px-3 py-2 text-right">Triwulan 4</th>
														</tr>
													</thead>
													<tbody className="divide-y divide-border">
														<tr>
															<td className="px-3 py-2 font-medium">Belanja Pegawai</td>
															<td className="px-3 py-2 font-mono">51</td>
															<td className="px-3 py-2 text-right">20%</td>
															<td className="px-3 py-2 text-right">50%</td>
															<td className="px-3 py-2 text-right">75%</td>
															<td className="px-3 py-2 text-right">95%</td>
														</tr>
														<tr>
															<td className="px-3 py-2 font-medium">Belanja Barang</td>
															<td className="px-3 py-2 font-mono">52</td>
															<td className="px-3 py-2 text-right">15%</td>
															<td className="px-3 py-2 text-right">50%</td>
															<td className="px-3 py-2 text-right">70%</td>
															<td className="px-3 py-2 text-right">90%</td>
														</tr>
														<tr>
															<td className="px-3 py-2 font-medium">Belanja Modal</td>
															<td className="px-3 py-2 font-mono">53</td>
															<td className="px-3 py-2 text-right">10%</td>
															<td className="px-3 py-2 text-right">40%</td>
															<td className="px-3 py-2 text-right">70%</td>
															<td className="px-3 py-2 text-right">90%</td>
														</tr>
														<tr>
															<td className="px-3 py-2 font-medium">Bantuan Sosial</td>
															<td className="px-3 py-2 font-mono">57</td>
															<td className="px-3 py-2 text-right">25%</td>
															<td className="px-3 py-2 text-right">50%</td>
															<td className="px-3 py-2 text-right">75%</td>
															<td className="px-3 py-2 text-right">95%</td>
														</tr>
													</tbody>
												</table>
											</div>
											<p className="mt-1.5 text-[11px] text-muted-foreground italic">
												*Target ini sudah ditentukan secara regulasi dan tidak dapat diubah.
											</p>
										</div>

										<div className="space-y-2 text-xs">
											<h4 className="font-semibold text-foreground text-xs uppercase tracking-wider">
												Tahapan Perhitungan:
											</h4>
											<ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
												<li>
													<strong>Target Nominal (Rp)</strong> = Pagu Triwulan × (Target % ÷ 100)
												</li>
												<li>
													<strong>Penyerapan vs Target</strong> = (Realisasi Akumulatif ÷ Target Rp) × 100 (maksimal 100, kelebihan hangus).
												</li>
												<li>
													<strong>Proporsi Pagu</strong> = Pagu Jenis Belanja ÷ Total Pagu yang Dinilai.
												</li>
												<li>
													<strong>Nilai Tertimbang</strong> = Penyerapan vs Target × Proporsi Pagu.
												</li>
												<li>
													<strong>Nilai Kinerja Triwulan</strong> = Jumlah Nilai Tertimbang seluruh jenis belanja.
												</li>
												<li>
													<strong>Nilai IKPA Penyerapan</strong> = Rata-rata nilai kinerja triwulan 1 sampai dengan triwulan penilaian berjalan (bukan dibagi 4 di tengah tahun).
												</li>
											</ol>
										</div>
									</div>
								</Dialog.Content>
							</Dialog.Portal>
						</Dialog.Root>
					</div>
				</div>

				{/* Banners & Status Messages */}
				{isBlu ? (
					<div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-sm text-blue-900 flex items-start gap-3">
						<span className="text-base">ℹ️</span>
						<div>
							<p className="font-semibold">Satker BLU Dikecualikan</p>
							<p className="text-xs text-blue-800 mt-0.5">
								Satker BLU tidak termasuk objek penilaian penyerapan anggaran pada baseline PER-5/PB/2024. Status indikator: <strong>Dikecualikan</strong>.
							</p>
						</div>
					</div>
				) : null}

				{!hasPagu ? (
					<div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 flex items-start justify-between gap-3">
						<div className="flex items-start gap-3">
							<span className="text-base">⚠️</span>
							<div>
								<p className="font-semibold">Belum Ada Pagu DIPA Tahun Berjalan</p>
								<p className="text-xs text-amber-800 mt-0.5">
									Isi pagu DIPA terlebih dahulu agar skor penyerapan anggaran dapat dihitung secara akurat.
								</p>
							</div>
						</div>
						<a
							href="/operator/data/budget-revisions"
							className="shrink-0 inline-flex items-center px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs transition-colors"
						>
							Buka Pagu & Revisi
						</a>
					</div>
				) : null}

				{!hasRealization && hasPagu ? (
					<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800 flex items-start justify-between gap-3">
						<div className="flex items-start gap-3">
							<span className="text-base">📝</span>
							<div>
								<p className="font-semibold">Data Realisasi Belum Ada</p>
								<p className="text-xs text-slate-600 mt-0.5">
									Belum ditemukan transaksi realisasi. Silakan input realisasi pada menu data.
								</p>
							</div>
						</div>
						<a
							href="/operator/data/rpd-realization"
							className="shrink-0 inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs transition-colors"
						>
							Input Realisasi
						</a>
					</div>
				) : null}

				{/* 5 Key Metric Cards in Balanced Horizontal Grid */}
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
					{/* Card 1: Skor Aktual Terkunci */}
					<div className="rounded-xl border border-border bg-background p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold">Skor Aktual</span>
							<span className="text-emerald-700 bg-emerald-50 font-semibold px-1.5 py-0.5 rounded-md text-[10px]">
								Terkunci 🔒
							</span>
						</div>
						<div className="space-y-0.5">
							<p className="text-2xl font-bold text-foreground sm:text-3xl">
								{actualScore.score !== null
									? Math.min(
											100,
											Math.max(0, actualScore.score),
										).toFixed(2)
									: "—"}
							</p>
							<p className="text-[11px] text-muted-foreground">
								Realisasi s.d. {MONTH_NAMES[currentMonth - 1]}
							</p>
						</div>
					</div>

					{/* Card 2: Dampak Rencana */}
					<div className="rounded-xl border border-border bg-background p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold">Dampak Rencana</span>
							{hasPlan ? (
								<span className="text-amber-800 bg-amber-50 font-semibold px-1.5 py-0.5 rounded-md text-[10px]">
									Simulasi Aktif
								</span>
							) : (
								<span className="text-muted-foreground text-[10px]">Belum ada rencana</span>
							)}
						</div>
						<div className="space-y-0.5">
							<p
								className={`text-2xl font-bold sm:text-3xl ${
									planDelta !== null && planDelta > 0
										? "text-emerald-600"
										: planDelta !== null && planDelta < 0
											? "text-rose-600"
											: "text-foreground"
								}`}
							>
								{planDelta !== null
									? `${planDelta > 0 ? "+" : ""}${planDelta.toFixed(2)}`
									: "—"}
							</p>
							<p className="text-[11px] text-muted-foreground">
								Selisih terhadap nilai akhir
							</p>
						</div>
					</div>

					{/* Card 3: Target Jarak ke 100 */}
					<div className="rounded-xl border border-border bg-background p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold">Jarak ke 100</span>
							<Target className="size-4 text-primary" />
						</div>
						<div className="space-y-0.5">
							<p className="text-2xl font-bold text-foreground sm:text-3xl">
								{gap !== null ? gap.toFixed(2) : "—"}
							</p>
							<p className="text-[11px] text-muted-foreground">
								Kebutuhan menuju nilai optimal
							</p>
						</div>
					</div>

					{/* Card 4: Nilai IKPA Penyerapan (2nd from right) */}
					<div className="rounded-xl border border-primary/20 bg-background p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold">
								Nilai IKPA Penyerapan
							</span>
							<ShieldCheck className="size-4 text-primary" />
						</div>
						<div className="space-y-0.5">
							<p className="text-2xl font-extrabold text-primary sm:text-3xl">
								{score.score !== null
									? Math.min(100, Math.max(0, score.score)).toFixed(2)
									: isBlu
										? "Dikecualikan"
										: "—"}
							</p>
							<p className="text-[11px] text-muted-foreground">
								{isBlu
									? "Satker BLU (Dikecualikan)"
									: `Rata-rata s.d. Triwulan ${evaluatedQuartersCount} dari 4`}
							</p>
						</div>
					</div>

					{/* Card 5: Nilai Akhir IKPA (Rightmost) */}
					<div className="rounded-xl border border-success/20 bg-success/5 p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold">
								Nilai Akhir (20%)
							</span>
							<Sparkles className="size-4 text-success" />
						</div>
						<div className="space-y-0.5">
							<p className="text-2xl font-extrabold text-success sm:text-3xl">
								{score.score !== null && !isBlu
									? `${((Math.min(100, Math.max(0, score.score)) * 20) / 100).toFixed(2)} pts`
									: isBlu
										? "0.00 pts"
										: "—"}
							</p>
							<p className="text-[11px] text-muted-foreground">
								Bobot 20% terhadap total IKPA
							</p>
						</div>
					</div>
				</div>

				{/* Triwulan Segmented Selector */}
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-muted/60 p-2 rounded-2xl border border-border">
					<div className="flex items-center gap-1.5 overflow-x-auto">
						{([1, 2, 3, 4] as const).map((q) => {
							const isSelected = selectedQuarter === q;
							const isCurrent = currentQuarter === q;
							return (
								<button
									key={q}
									type="button"
									onClick={() => handleSelectQuarter(q)}
									className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
										isSelected
											? "bg-background text-foreground shadow-sm border border-border/80"
											: "text-muted-foreground hover:text-foreground hover:bg-background/50"
									}`}
								>
									<span>{QUARTER_LABELS[q].title}</span>
									<span className="text-[10px] font-normal text-muted-foreground">
										({QUARTER_LABELS[q].period})
									</span>
									{isCurrent ? (
										<span className="size-1.5 rounded-full bg-primary" title="Triwulan Berjalan" />
									) : null}
								</button>
							);
						})}
					</div>

					<div className="text-xs text-muted-foreground px-2">
						Rincian: <strong className="text-foreground">{QUARTER_LABELS[selectedQuarter].title}</strong> (Akumulatif s.d. {QUARTER_LABELS[selectedQuarter].endMonth})
					</div>
				</div>

				{/* Table 1: Locked Actual Data Table */}
				<section
					aria-label={`Rincian Perhitungan ${QUARTER_LABELS[selectedQuarter].title}`}
					className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
				>
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 border-b border-border/60">
						<div>
							<h2 className="text-base font-bold text-foreground flex items-center gap-2">
								<span>Rincian Perhitungan {QUARTER_LABELS[selectedQuarter].title}</span>
								<span className="text-xs font-normal text-muted-foreground">
									(Akumulatif s.d. {QUARTER_LABELS[selectedQuarter].endMonth})
								</span>
							</h2>
							<p className="mt-0.5 text-xs text-muted-foreground">
								Pagu mengikuti cut-off DIPA · Realisasi dihitung secara akumulatif dari Januari
							</p>
						</div>

						<a
							href="/operator/data/rpd-realization"
							className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-semibold text-primary hover:bg-surface-muted transition-colors"
						>
							<span>Ubah Data Realisasi</span>
							<span className="text-xs">↗</span>
						</a>
					</div>

					<div className="overflow-x-auto">
						<table className="w-full min-w-[700px] text-left text-xs">
							<thead>
								<tr className="bg-surface-muted/60 text-muted-foreground font-semibold border-b border-border">
									<th className="px-4 py-3">Jenis Belanja</th>
									<th className="px-4 py-3 text-right">Pagu Triwulan (Rp)</th>
									<th className="px-4 py-3 text-right">Realisasi Akumulatif (Rp)</th>
									<th className="px-4 py-3 text-right">Target (%)</th>
									<th className="px-4 py-3 text-right">Target Nominal (Rp)</th>
									<th className="px-4 py-3 text-right">Penyerapan vs Target</th>
									<th className="px-4 py-3 text-right">Proporsi Pagu</th>
									<th className="px-4 py-3 text-right">Nilai Tertimbang</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border/60">
								{selectedQuarterDetails.rows.map((r) => {
									const isExempt = r.pagu <= 0;
									return (
										<tr key={r.acc} className="hover:bg-surface-muted/30 transition-colors">
											<td className="px-4 py-3 font-semibold text-foreground">
												<div>
													<span>{ACCOUNT_LABELS[r.acc].name}</span>
													<span className="ml-1.5 font-mono text-[11px] text-muted-foreground font-normal">
														({ACCOUNT_LABELS[r.acc].code})
													</span>
												</div>
											</td>
											<td className="px-4 py-3 text-right text-foreground font-mono">
												{formatRupiah(r.pagu)}
											</td>
											<td className="px-4 py-3 text-right font-mono">
												<span className="inline-flex items-center gap-1.5 rounded-md bg-surface-muted px-2 py-0.5 text-foreground">
													{formatRupiah(r.realizedCumulative)}
													<span
														aria-label="Terkunci"
														title="Aktual dari database, terkunci"
														className="text-[10px] text-muted-foreground"
													>
														🔒
													</span>
												</span>
											</td>
											<td className="px-4 py-3 text-right font-mono text-muted-foreground">
												{formatPercent(r.targetPercent)}
											</td>
											<td className="px-4 py-3 text-right font-mono text-muted-foreground">
												{formatRupiah(r.targetRp)}
											</td>
											<td className="px-4 py-3 text-right font-semibold font-mono">
												{isExempt ? (
													<span className="text-muted-foreground italic font-normal text-[11px]">
														Dilewati
													</span>
												) : (
													<span
														className={
															r.penyerapanVsTarget >= 100
																? "text-emerald-600 font-bold"
																: r.penyerapanVsTarget >= 80
																	? "text-foreground"
																	: "text-amber-600 font-bold"
														}
													>
														{formatPercent(r.penyerapanVsTarget)}
													</span>
												)}
											</td>
											<td className="px-4 py-3 text-right font-mono text-muted-foreground">
												{isExempt ? "0,00%" : formatPercent(r.proporsiPagu * 100)}
											</td>
											<td className="px-4 py-3 text-right font-bold text-foreground font-mono">
												{isExempt ? "—" : formatPercent(r.nilaiTertimbang)}
											</td>
										</tr>
									);
								})}
							</tbody>
							<tfoot className="bg-surface-muted/80 font-bold text-foreground border-t-2 border-border">
								<tr>
									<td className="px-4 py-3">Total / Nilai Kinerja {QUARTER_LABELS[selectedQuarter].title}</td>
									<td className="px-4 py-3 text-right font-mono">
										{formatRupiah(selectedQuarterDetails.totalPagu)}
									</td>
									<td className="px-4 py-3 text-right font-mono">
										{formatRupiah(selectedQuarterDetails.totalRealized)}
									</td>
									<td className="px-4 py-3 text-right text-muted-foreground">—</td>
									<td className="px-4 py-3 text-right font-mono text-muted-foreground">
										{formatRupiah(selectedQuarterDetails.totalTargetRp)}
									</td>
									<td className="px-4 py-3 text-right text-muted-foreground">—</td>
									<td className="px-4 py-3 text-right font-mono">100,00%</td>
									<td className="px-4 py-3 text-right font-mono text-primary text-sm">
										{formatPercent(selectedQuarterDetails.nilaiKinerjaQuarter)}
									</td>
								</tr>
							</tfoot>
						</table>
					</div>

					<div className="p-4 bg-surface-muted/30 border-t border-border/60 text-[11px] text-muted-foreground leading-relaxed">
						Realisasi dihitung secara akumulatif dari Januari sampai bulan ini. Target bersifat akumulatif terhadap pagu jenis belanja. Nilai penyerapan di atas 100 dihitung 100 (kelebihan tidak menambah skor). Pagu triwulan ini mengikuti DIPA cut-off.
					</div>
				</section>

				{/* Table 2: Yellow Editable Future Plan Section (Simulasi Rencana Pencairan) */}
				<section
					aria-label="Rencana pencairan sisa tahun"
					className="rounded-2xl border border-amber-200 bg-amber-50/30 p-4 sm:p-5 shadow-sm space-y-4"
				>
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
						<div>
							<h2 className="text-base font-bold text-foreground flex items-center gap-2">
								<span className="size-2.5 rounded-full bg-amber-400" />
								<span>Rencana Pencairan Sisa Tahun (Simulasi)</span>
							</h2>
							<p className="mt-0.5 text-xs text-muted-foreground">
								Sel kuning dapat diubah untuk mensimulasikan pencapaian target di masa depan
							</p>
						</div>

						<div className="flex items-center gap-2">
							{saveStatus === "saved" ? (
								<span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 animate-in fade-in">
									✓ Skenario tersimpan
								</span>
							) : null}

							{hasPlan ? (
								<>
									<button
										type="button"
										onClick={handleResetPlan}
										className="px-3 py-1.5 rounded-xl border border-border bg-background text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
									>
										Reset Rencana
									</button>
									<button
										type="button"
										onClick={handleSaveScenario}
										disabled={saveStatus === "saving"}
										className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
									>
										{saveStatus === "saving" ? "Menyimpan..." : "Simpan Skenario"}
									</button>
								</>
							) : (
								<button
									type="button"
									onClick={handleSaveScenario}
									className="px-3.5 py-1.5 rounded-xl bg-amber-600/90 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm transition-colors"
								>
									Simpan Skenario
								</button>
							)}
						</div>
					</div>

					{planMonths.length === 0 ? (
						<div className="rounded-xl border border-border bg-background p-4 text-xs text-muted-foreground text-center">
							Sudah Desember — seluruh periode tahun berjalan telah terealisasi, tidak ada sisa bulan untuk direncanakan.
						</div>
					) : (
						<div className="overflow-x-auto rounded-xl border border-amber-200/80 bg-background">
							<table className="w-full min-w-[650px] text-left text-xs">
								<thead>
									<tr className="bg-amber-100/50 text-amber-950 font-semibold border-b border-amber-200">
										<th className="px-4 py-2.5">Bulan Sisa Tahun</th>
										{PENYERAPAN_ACCOUNTS.map((acc) => (
											<th key={acc} className="px-3 py-2.5 text-right font-semibold">
												{ACCOUNT_LABELS[acc].name} ({acc})
											</th>
										))}
									</tr>
								</thead>
								<tbody className="divide-y divide-amber-100">
									{planMonths.map((m) => (
										<tr key={m} className="hover:bg-amber-50/50 transition-colors">
											<td className="px-4 py-2 font-semibold text-foreground">
												<span>{MONTH_NAMES[m - 1]}</span>
												<span className="ml-1.5 text-[10px] text-muted-foreground font-normal">
													(TW {quarterOfMonth(m)})
												</span>
											</td>
											{PENYERAPAN_ACCOUNTS.map((acc) => {
												const key = `${m}:${acc}`;
												return (
													<td key={key} className="px-2 py-1.5">
														<label htmlFor={`rencana-${key}`} className="sr-only">
															Rencana {ACCOUNT_LABELS[acc].name} bulan {MONTH_NAMES[m - 1]} (Rp)
														</label>
														<FormattedNumberInput
															id={`rencana-${key}`}
															value={plan[key] ?? ""}
															placeholder="0"
															onChange={(raw) => setPlanValue(m, acc, raw)}
															className="w-full rounded-lg border border-amber-300 bg-amber-50/70 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 px-2.5 py-1 text-right text-xs font-mono text-amber-950 placeholder:text-amber-300 transition-all"
														/>
													</td>
												);
											})}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}

					<p className="text-[11px] text-muted-foreground leading-relaxed">
						Sel kuning = simulasi perencanaan (pola Excel). Rencana hanya memengaruhi skor simulasi di halaman ini dan tidak menimpa data aktual di database.
					</p>
				</section>

				{/* Strategy Assistance Panel */}
				<section
					aria-label="Strategi Optimalisasi Nilai IKPA - Penyerapan Anggaran"
					className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4"
				>
					<div>
						<h2 className="text-base font-bold text-foreground">
							Strategi Optimalisasi Nilai IKPA - Penyerapan Anggaran
						</h2>
						<p className="mt-0.5 text-xs text-muted-foreground">
							Rekomendasi taktis untuk mengoptimalkan nilai IKPA Penyerapan Anggaran
						</p>
					</div>

					{/* Kebutuhan Target Triwulan Berjalan */}
					<div className="rounded-xl border border-border bg-surface-muted/40 p-4 space-y-2.5">
						<h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
							Kebutuhan Target {QUARTER_LABELS[currentQuarter].title} (Bulan Berjalan: {MONTH_NAMES[currentMonth - 1]})
						</h3>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
							{currentQuarterDetails.rows.map((r) => {
								if (r.pagu <= 0) return null;
								const isMet = r.penyerapanVsTarget >= 100;
								return (
									<div
										key={r.acc}
										className={`p-3 rounded-lg border text-xs leading-relaxed ${
											isMet
												? "border-emerald-200 bg-emerald-50/60 text-emerald-900"
												: "border-amber-200 bg-amber-50/60 text-amber-900"
										}`}
									>
										<div className="flex items-center justify-between font-semibold mb-1">
											<span>{ACCOUNT_LABELS[r.acc].name}</span>
											<span>{isMet ? "✓ Target Tercapai" : `Kurang ${formatRupiah(r.sisaKebutuhan)}`}</span>
										</div>
										<p className="text-[11px] opacity-90">
											Realisasi akumulatif {formatRupiah(r.realizedCumulative)} dari target {formatRupiah(r.targetRp)} ({formatPercent(r.targetPercent)}).
										</p>
									</div>
								);
							})}
						</div>
					</div>

					{/* 3 Key Strategies */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
						<div className="p-4 rounded-xl border border-border bg-background space-y-1.5">
							<span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
								1
							</span>
							<h4 className="font-bold text-foreground">
								Hindari Penumpukan di Akhir Tahun
							</h4>
							<p className="text-muted-foreground leading-relaxed text-[11px]">
								Triwulan 2 dan 3 membutuhkan akselerasi tinggi, terutama untuk Belanja Pegawai (50%) dan Belanja Barang (50%). Jangan menumpuk pencairan di Triwulan 4.
							</p>
						</div>

						<div className="p-4 rounded-xl border border-border bg-background space-y-1.5">
							<span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
								2
							</span>
							<h4 className="font-bold text-foreground">
								Percepat Belanja Barang & Modal
							</h4>
							<p className="text-muted-foreground leading-relaxed text-[11px]">
								Lakukan proses pengadaan barang/jasa dan penandatanganan kontrak sedini mungkin sejak awal tahun anggaran agar realisasi belanja modal dapat tercapai.
							</p>
						</div>

						<div className="p-4 rounded-xl border border-border bg-background space-y-1.5">
							<span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
								3
							</span>
							<h4 className="font-bold text-foreground">
								Cairkan Proporsional Tiap Bulan
							</h4>
							<p className="text-muted-foreground leading-relaxed text-[11px]">
								Sesuaikan jadwal kegiatan dengan rencana penarikan dana (RPD) untuk menghindari deviasi bulanan yang berpotensi menurunkan skor Deviasi Halaman III DIPA.
							</p>
						</div>
					</div>
				</section>
			</div>
		</OperatorShell>
	);
}


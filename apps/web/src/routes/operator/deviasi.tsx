import { createFileRoute } from "@tanstack/react-router";
import {
	AlertCircle,
	AlertTriangle,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	HelpCircle,
	Info,
	Lock,
	Percent,
	Save,
	ShieldCheck,
	Target,
	TrendingUp,
} from "lucide-react";
import { Dialog } from "radix-ui";
import { useMemo, useState } from "react";
import { FormattedNumberInput } from "@/components/data/formatted-number-input";
import { useActiveContext } from "@/components/layout/active-context";
import { OperatorShell } from "@/components/layout/operator-shell";
import { formatPercent, formatRupiah } from "@/lib/format";
import {
	DEVIASI_ACCOUNTS,
	buildDeviationInput,
	calcDeviasiScore,
	calcNextMonthTarget,
	calculateHistoricalTrail,
	deviationOf,
	paguWeights,
	type DeviasiAccount,
	type MonthlyAmounts,
	type PaguMap,
} from "@/lib/simulation/deviasi-workspace";
import { fetchBudgetAndRevisions } from "@/services/budget-revisions-service";
import { fetchRpdAndRealizations } from "@/services/rpd-realization-service";
import { executeSimulation } from "@/services/simulation-service";

export const Route = createFileRoute("/operator/deviasi")({
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
		return { budgetData, rpdData };
	},
	component: DeviasiPage,
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
	"57": "Bansos (57)",
};

function parseAmount(value: string | undefined): number {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
}

function toMonthly(
	rows: Array<{ month: number; accountCode: string; amount: string }>,
): MonthlyAmounts {
	const map: MonthlyAmounts = {};
	for (const r of rows) {
		const code = r.accountCode as DeviasiAccount;
		if (!DEVIASI_ACCOUNTS.includes(code)) continue;
		if (r.month < 1 || r.month > 12) continue;
		const slot = map[r.month] ?? {};
		if (slot[code] === undefined) slot[code] = parseAmount(r.amount);
		map[r.month] = slot;
	}
	return map;
}

function DeviasiPage() {
	const { budgetData, rpdData } = Route.useLoaderData();
	const activeContext = useActiveContext();
	const currentMonth =
		activeContext?.context.period.kind === "month"
			? activeContext.context.period.value
			: new Date().getMonth() + 1;

	const [planRpd, setPlanRpd] = useState<Record<string, string>>({});
	const [planReal, setPlanReal] = useState<Record<string, string>>({});
	const [isHelpOpen, setIsHelpOpen] = useState(false);
	const [isTraceOpen, setIsTraceOpen] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [saveMessage, setSaveMessage] = useState<string | null>(null);
	const [saveError, setSaveError] = useState<string | null>(null);

	const pagu: PaguMap = useMemo(() => {
		const map: PaguMap = {};
		for (const b of budgetData.budgets) {
			const code = b.accountCode as DeviasiAccount;
			if (DEVIASI_ACCOUNTS.includes(code)) map[code] = parseAmount(b.amount);
		}
		return map;
	}, [budgetData]);

	const rpd: MonthlyAmounts = useMemo(
		() => toMonthly(rpdData.rpdLines),
		[rpdData],
	);
	const actual: MonthlyAmounts = useMemo(
		() => toMonthly(rpdData.realizations),
		[rpdData],
	);

	const planRpdAmounts: MonthlyAmounts = useMemo(() => {
		const map: MonthlyAmounts = {};
		for (const key of Object.keys(planRpd)) {
			const sep = key.indexOf(":");
			const month = Number(key.slice(0, sep));
			const code = key.slice(sep + 1) as DeviasiAccount;
			if (!DEVIASI_ACCOUNTS.includes(code)) continue;
			if (!Number.isInteger(month) || month < 1 || month > 11) continue;
			const raw = Number(planRpd[key]);
			const slot = map[month] ?? {};
			slot[code] = Number.isFinite(raw) && raw > 0 ? raw : 0;
			map[month] = slot;
		}
		return map;
	}, [planRpd]);

	const planRealAmounts: MonthlyAmounts = useMemo(() => {
		const map: MonthlyAmounts = {};
		for (const key of Object.keys(planReal)) {
			const sep = key.indexOf(":");
			const month = Number(key.slice(0, sep));
			const code = key.slice(sep + 1) as DeviasiAccount;
			if (!DEVIASI_ACCOUNTS.includes(code)) continue;
			if (!Number.isInteger(month) || month < 1 || month > 11) continue;
			const raw = Number(planReal[key]);
			const slot = map[month] ?? {};
			slot[code] = Number.isFinite(raw) && raw > 0 ? raw : 0;
			map[month] = slot;
		}
		return map;
	}, [planReal]);

	const evalActualMonth = Math.min(Math.max(currentMonth, 1), 11);

	const planMonths = useMemo(() => {
		const months: number[] = [];
		for (let m = currentMonth + 1; m <= 11; m++) months.push(m);
		return months;
	}, [currentMonth]);

	const actualMonths = useMemo(() => {
		const months: number[] = [];
		for (let m = 1; m <= evalActualMonth; m++) months.push(m);
		return months;
	}, [evalActualMonth]);

	// Score with plan included (divisor n based on plan extent, max 11)
	const score = useMemo(
		() =>
			calcDeviasiScore(
				buildDeviationInput(
					pagu,
					rpd,
					actual,
					planRpdAmounts,
					planRealAmounts,
					evalActualMonth,
				),
			),
		[pagu, rpd, actual, planRpdAmounts, planRealAmounts, evalActualMonth],
	);

	// Actual score only (divisor n = current month)
	const actualScore = useMemo(
		() =>
			calcDeviasiScore(
				buildDeviationInput(pagu, rpd, actual, {}, {}, evalActualMonth),
			),
		[pagu, rpd, actual, evalActualMonth],
	);

	const planDelta =
		score.score !== null && actualScore.score !== null
			? score.score - actualScore.score
			: null;

	const weights = useMemo(() => paguWeights(pagu), [pagu]);
	const hasPagu = DEVIASI_ACCOUNTS.some((a) => (pagu[a] ?? 0) > 0);
	const hasPlan = Object.keys(planRpd).length + Object.keys(planReal).length > 0;

	// Month rows for actual table
	const monthRows = useMemo(() => {
		return actualMonths.map((m) => {
			let weighted = 0;
			const perAcc = DEVIASI_ACCOUNTS.map((acc) => {
				const planned = rpd[m]?.[acc] ?? 0;
				const realized = actual[m]?.[acc] ?? 0;
				const dev = deviationOf(planned, realized);
				weighted += dev * (weights[acc] ?? 0);
				return { acc, planned, realized, dev };
			});
			return { month: m, perAcc, weighted };
		});
	}, [actualMonths, rpd, actual, weights]);

	// Historical trace up to simulation scope
	const trail = useMemo(() => {
		const mergedRpd: MonthlyAmounts = JSON.parse(JSON.stringify(rpd));
		const mergedReal: MonthlyAmounts = JSON.parse(JSON.stringify(actual));
		for (let m = evalActualMonth + 1; m <= score.monthsCount; m++) {
			mergedRpd[m] = planRpdAmounts[m] ?? {};
			mergedReal[m] = planRealAmounts[m] ?? {};
		}
		return calculateHistoricalTrail(pagu, mergedRpd, mergedReal, score.monthsCount);
	}, [pagu, rpd, actual, planRpdAmounts, planRealAmounts, evalActualMonth, score.monthsCount]);

	// Target projection
	const targetAnalysis = useMemo(
		() =>
			calcNextMonthTarget(
				actualScore.avgDeviation ?? 0,
				actualScore.monthsCount,
				evalActualMonth < 11 ? evalActualMonth + 1 : 11,
			),
		[actualScore, evalActualMonth],
	);

	const setRpdValue = (month: number, acc: DeviasiAccount, raw: string) => {
		const key = `${month}:${acc}`;
		setPlanRpd((prev) => {
			const next = { ...prev };
			if (raw === "") delete next[key];
			else next[key] = raw;
			return next;
		});
	};

	const setRealValue = (month: number, acc: DeviasiAccount, raw: string) => {
		const key = `${month}:${acc}`;
		setPlanReal((prev) => {
			const next = { ...prev };
			if (raw === "") delete next[key];
			else next[key] = raw;
			return next;
		});
	};

	const handleSaveScenario = async () => {
		setIsSaving(true);
		setSaveMessage(null);
		setSaveError(null);

		try {
			const scoreValue = score.score !== null ? score.score.toFixed(2) : "100.00";
			await executeSimulation({
				period: { kind: "month", value: evalActualMonth },
				simulationType: "scenario",
				simulationName: `Skenario Deviasi Hal III s.d. ${MONTH_NAMES[evalActualMonth - 1]} (${scoreValue})`,
				overrides: {
					rpd_deviation: scoreValue,
				},
			});

			setSaveMessage(
				`Skenario simulasi Deviasi Hal III berhasil disimpan ke Riwayat Snapshot IKPA (Nilai ${scoreValue}).`,
			);
			setTimeout(() => setSaveMessage(null), 5000);
		} catch (err: unknown) {
			setSaveError(
				err instanceof Error ? err.message : "Gagal menyimpan skenario simulasi.",
			);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<OperatorShell currentPath="/operator/deviasi">
			<div className="space-y-6">
				{/* Header with non-technical copy & Help dialog */}
				<div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div className="flex items-start gap-3 max-w-3xl">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<TrendingUp className="size-5" />
						</div>
						<div className="space-y-1">
							<div className="flex items-center gap-2">
								<h1 className="text-xl font-bold text-foreground">
									Workspace Simulasi Deviasi Halaman III DIPA
								</h1>
								<span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
									Bobot 15%
								</span>
							</div>
							<p className="text-xs text-muted-foreground leading-relaxed">
								Aktual s.d. <strong className="text-foreground">{MONTH_NAMES[evalActualMonth - 1]} terkunci 🔒</strong> · Rencana sisa tahun (Jan–Nov) dapat disimulasikan di sel kuning · Nilai IKPA terhitung otomatis berdasarkan proporsi pagu dan pembagi n bulan berjalan.
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<a
							href="/operator/data/rpd-realization"
							className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
						>
							Input Data RPD &amp; Realisasi →
						</a>

						<Dialog.Root open={isHelpOpen} onOpenChange={setIsHelpOpen}>
							<Dialog.Trigger asChild>
								<button
									type="button"
									aria-label="Lihat rumus singkat Deviasi Halaman III"
									className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-sm font-bold text-muted-foreground hover:bg-surface-muted hover:text-foreground transition"
								>
									?
								</button>
							</Dialog.Trigger>
							<Dialog.Portal>
								<Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-xs" />
								<Dialog.Content className="fixed inset-x-4 top-[10%] z-50 mx-auto max-w-lg rounded-2xl border border-border bg-background p-6 shadow-xl outline-none space-y-4">
									<div className="flex items-center justify-between gap-4">
										<Dialog.Title className="text-base font-bold text-foreground">
											Rumus &amp; Ketentuan Deviasi Halaman III (2026)
										</Dialog.Title>
										<Dialog.Close asChild>
											<button
												type="button"
												className="rounded-lg p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
											>
												✕
											</button>
										</Dialog.Close>
									</div>
									<Dialog.Description className="text-xs text-muted-foreground">
										Sesuai PER-5/PB/2024 dan aturan penilaian IKPA 2026:
									</Dialog.Description>

									<ul className="list-disc space-y-2 pl-5 text-xs text-foreground">
										<li>
											<strong>Deviasi Akun:</strong> min(100, |Realisasi − RPD| ÷ RPD × 100). Cap maksimal 100% per akun.
										</li>
										<li>
											<strong>Kasus Khusus:</strong> RPD=0 dan Realisasi=0 → <strong>0%</strong>; RPD=0 dan Realisasi&gt;0 → <strong>100%</strong> (belanja tanpa rencana).
										</li>
										<li>
											<strong>Deviasi Tertimbang:</strong> Deviasi Akun × (Pagu Akun ÷ Total Pagu 51+52+53+57).
										</li>
										<li>
											<strong>Rata-rata Kumulatif:</strong> Jumlah Deviasi Bulanan dibagi <strong>n bulan berjalan</strong> (Jan s.d. bulan berjalan, maks 11).
										</li>
										<li>
											<strong>Kriteria Nilai:</strong> Rata-rata 0–5% = <strong>100</strong>; Rata-rata &gt;5% = <strong>100 − rata-rata</strong> (contoh 6% → 94).
										</li>
										<li>
											<strong>Periode:</strong> Januari–November. Desember tidak masuk skor Deviasi.
										</li>
									</ul>
								</Dialog.Content>
							</Dialog.Portal>
						</Dialog.Root>
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

				{/* Save Scenario Feedback */}
				{saveMessage && (
					<output className="flex items-center justify-between gap-2.5 rounded-xl border border-success/30 bg-success/10 p-4 text-xs font-semibold text-success shadow-xs">
						<div className="flex items-center gap-2">
							<CheckCircle2 className="size-4 shrink-0" />
							<p>{saveMessage}</p>
						</div>
						<a
							href="/operator/history"
							className="underline underline-offset-2 hover:text-foreground"
						>
							Buka Riwayat Snapshot →
						</a>
					</output>
				)}

				{saveError && (
					<div
						role="alert"
						className="flex items-center gap-2.5 rounded-xl border border-danger/30 bg-danger/10 p-4 text-xs font-semibold text-danger shadow-xs"
					>
						<AlertCircle className="size-4 shrink-0" />
						<p>{saveError}</p>
					</div>
				)}

				{/* 4 Score Cards (Simulasi vs Aktual vs Dampak vs Rata-rata) */}
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{/* Card 1: Skor Simulasi */}
					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold">Skor Simulasi</span>
							<ShieldCheck className="size-4 text-primary" />
						</div>
						<p className="text-2xl font-bold text-foreground">
							{score.score !== null ? formatPercent(score.score) : "—"}
						</p>
						<p className="text-[11px] text-muted-foreground">
							Kontribusi{" "}
							{score.contribution !== null
								? formatPercent(score.contribution)
								: "—"}{" "}
							· n = {score.monthsCount} bulan
						</p>
					</div>

					{/* Card 2: Skor Aktual Terkunci */}
					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold">Skor Aktual DB</span>
							<Lock className="size-4 text-muted-foreground" />
						</div>
						<p className="text-2xl font-bold text-foreground">
							{actualScore.score !== null
								? formatPercent(actualScore.score)
								: "—"}
						</p>
						<p className="text-[11px] text-muted-foreground">
							Terkunci s.d. {MONTH_NAMES[evalActualMonth - 1]} · n = {actualScore.monthsCount}
						</p>
					</div>

					{/* Card 3: Dampak Rencana */}
					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold">Dampak Rencana</span>
							<Target className="size-4 text-primary" />
						</div>
						<p
							className={`text-2xl font-bold ${
								planDelta !== null && planDelta > 0
									? "text-success"
									: planDelta !== null && planDelta < 0
										? "text-danger"
										: "text-foreground"
							}`}
						>
							{planDelta !== null
								? `${planDelta >= 0 ? "+" : ""}${formatPercent(planDelta)}`
								: "—"}
						</p>
						<p className="text-[11px] text-muted-foreground">
							{planDelta !== null && planDelta > 0
								? "Meningkatkan nilai"
								: planDelta !== null && planDelta < 0
									? "Menurunkan nilai"
									: "Belum ada rencana baru"}
						</p>
					</div>

					{/* Card 4: Rata-rata Deviasi */}
					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold">Rata-rata Deviasi</span>
							<Percent className="size-4 text-primary" />
						</div>
						<p
							className={`text-2xl font-bold ${
								score.avgDeviation !== null && score.avgDeviation > 10
									? "text-danger"
									: score.avgDeviation !== null && score.avgDeviation > 5
										? "text-warning"
										: "text-foreground"
							}`}
						>
							{score.avgDeviation !== null
								? formatPercent(score.avgDeviation)
								: "—"}
						</p>
						<p className="text-[11px] text-muted-foreground">
							Ambang batas ≤ 5.00%
						</p>
					</div>
				</div>

				{/* Action Strip: Save Simulation Scenario (DH-12) */}
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-xs">
					<div className="flex items-center gap-2.5">
						<Info className="size-4 text-primary shrink-0" />
						<p className="text-xs text-foreground">
							Rencana sel kuning hanya aktif di simulasi ini dan <strong>tidak tersimpan ke Dashboard</strong> sampai Anda menekan <strong>Simpan Skenario</strong>.
						</p>
					</div>

					<button
						type="button"
						onClick={handleSaveScenario}
						disabled={isSaving}
						className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90 transition disabled:opacity-50"
					>
						<Save className="size-4" />
						<span>{isSaving ? "Menyimpan..." : "Simpan Skenario IKPA"}</span>
					</button>
				</div>

				{/* Table 1: Aktual Tahun Berjalan Terkunci */}
				<section
					aria-label="Aktual tahun berjalan terkunci"
					className="space-y-3 rounded-2xl border border-border bg-background p-5 shadow-xs"
				>
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-2">
							<Lock className="size-4 text-muted-foreground" />
							<h2 className="text-sm font-bold text-foreground">
								Aktual s.d. {MONTH_NAMES[evalActualMonth - 1]} (Terkunci dari Database)
							</h2>
						</div>
						<a
							href="/operator/data/rpd-realization"
							className="shrink-0 text-xs font-semibold text-primary underline-offset-4 hover:underline"
						>
							Ubah Data Aktual di Tabel RPD →
						</a>
					</div>

					<div className="overflow-x-auto">
						<table className="w-full min-w-[640px] text-left text-xs">
							<thead>
								<tr className="border-b border-border text-muted-foreground font-semibold">
									<th className="px-2 py-2">Bulan</th>
									{DEVIASI_ACCOUNTS.map((acc) => (
										<th
											key={acc}
											className="px-2 py-2 text-right font-semibold"
										>
											Dev {acc} ({ACCOUNT_LABELS[acc].split(" ")[1]})
										</th>
									))}
									<th className="px-2 py-2 text-right font-semibold">
										Deviasi Tertimbang
									</th>
								</tr>
							</thead>
							<tbody>
								{monthRows.map((row) => (
									<tr key={row.month} className="border-b border-border/60">
										<td className="px-2 py-2 font-bold text-foreground">
											{MONTH_NAMES[row.month - 1]}
										</td>
										{row.perAcc.map((c) => (
											<td
												key={c.acc}
												className="px-2 py-2 text-right text-foreground"
												title={`${ACCOUNT_LABELS[c.acc]} · RPD ${formatRupiah(c.planned)} · Realisasi ${formatRupiah(c.realized)}`}
											>
												{formatPercent(c.dev)}{" "}
												<span
													aria-label="Terkunci"
													title="Aktual dari database"
													className="text-[10px] text-muted-foreground"
												>
													🔒
												</span>
											</td>
										))}
										<td className="px-2 py-2 text-right font-bold text-foreground">
											{formatPercent(row.weighted)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					<p className="text-[11px] text-muted-foreground">
						Deviasi per akun = |Realisasi − RPD| ÷ RPD (cap 100%). Arahkan kursor untuk melihat nominal detail. Proporsi pagu:{" "}
						{DEVIASI_ACCOUNTS.map(
							(a) => `${a} (${formatPercent((weights[a] ?? 0) * 100)})`,
						).join(" · ")}
					</p>
				</section>

				{/* Table 2: Rencana Sisa Tahun Editable (Jan–Nov) */}
				<section
					aria-label="Rencana sisa tahun"
					className="space-y-4 rounded-2xl border border-border bg-background p-5 shadow-xs"
				>
					<div className="flex items-center justify-between gap-3">
						<div>
							<h2 className="text-sm font-bold text-foreground">
								Rencana Sisa Tahun (Jan–Nov) · Simulasi Mandiri
							</h2>
							<p className="text-xs text-muted-foreground">
								Masukkan rencana target RPD dan estimasi realisasi untuk bulan-bulan mendatang.
							</p>
						</div>

						{hasPlan && (
							<button
								type="button"
								onClick={() => {
									setPlanRpd({});
									setPlanReal({});
								}}
								className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-surface-muted hover:text-foreground transition"
							>
								Reset Rencana
							</button>
						)}
					</div>

					{planMonths.length === 0 ? (
						<p className="rounded-xl border border-border bg-surface p-4 text-xs text-muted-foreground">
							Sudah bulan November/Desember — seluruh periode penilaian (Jan–Nov) telah memiliki data aktual.
						</p>
					) : (
						<div className="space-y-4">
							{planMonths.map((m) => (
								<div key={m} className="rounded-xl border border-border bg-surface/40 p-4 space-y-3">
									<div className="flex items-center justify-between">
										<span className="text-xs font-bold text-foreground">
											Bulan {MONTH_NAMES[m - 1]} 2026
										</span>
										<span className="text-[11px] text-muted-foreground">
											Simulasi sisa tahun
										</span>
									</div>

									<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
										{DEVIASI_ACCOUNTS.map((acc) => (
											<div key={acc} className="space-y-1.5 rounded-lg border border-yellow-200 bg-yellow-50/50 p-2.5">
												<div className="flex items-center justify-between text-[11px] font-bold text-foreground">
													<span>Akun {acc}</span>
													<span className="text-[10px] text-muted-foreground">
														Bobot {formatPercent((weights[acc] ?? 0) * 100)}
													</span>
												</div>

												<div className="space-y-1">
													<label
														htmlFor={`rpd-${m}-${acc}`}
														className="text-[10px] font-semibold text-muted-foreground"
													>
														Rencana RPD
													</label>
													<FormattedNumberInput
														id={`rpd-${m}-${acc}`}
														value={planRpd[`${m}:${acc}`] ?? ""}
														placeholder="Target RPD"
														onChange={(raw) => setRpdValue(m, acc, raw)}
														className="w-full rounded-md border border-yellow-300 bg-white px-2 py-1 text-right text-xs text-foreground focus:border-primary focus:outline-none"
													/>
												</div>

												<div className="space-y-1">
													<label
														htmlFor={`real-${m}-${acc}`}
														className="text-[10px] font-semibold text-muted-foreground"
													>
														Rencana Realisasi
													</label>
													<FormattedNumberInput
														id={`real-${m}-${acc}`}
														value={planReal[`${m}:${acc}`] ?? ""}
														placeholder="Realisasi"
														onChange={(raw) => setRealValue(m, acc, raw)}
														className="w-full rounded-md border border-yellow-300 bg-white px-2 py-1 text-right text-xs text-foreground focus:border-primary focus:outline-none"
													/>
												</div>
											</div>
										))}
									</div>
								</div>
							))}
						</div>
					)}
				</section>

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
								Cara Angka Ini Dihitung (Jejak Simulasi Kumulatif Jan–{MONTH_NAMES[score.monthsCount - 1]})
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
							<div className="overflow-x-auto">
								<table className="w-full min-w-[720px] text-left text-xs">
									<thead>
										<tr className="border-b border-border text-muted-foreground font-semibold">
											<th className="px-2 py-2">Bulan</th>
											<th className="px-2 py-2 text-right">RPD (51+52+53+57)</th>
											<th className="px-2 py-2 text-right">Realisasi</th>
											<th className="px-2 py-2 text-right">Deviasi Bulan</th>
											<th className="px-2 py-2 text-right">Objek (n)</th>
											<th className="px-2 py-2 text-right">Rata-rata Kumulatif</th>
											<th className="px-2 py-2 text-right">Nilai IKPA</th>
											<th className="px-2 py-2 text-center">Tipe</th>
										</tr>
									</thead>
									<tbody>
										{trail.map((row) => (
											<tr key={row.month} className="border-b border-border/60">
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
															row.month <= evalActualMonth
																? "bg-muted text-foreground"
																: "bg-yellow-100 text-yellow-800"
														}`}
													>
														{row.month <= evalActualMonth ? "Aktual 🔒" : "Rencana ✏️"}
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
							Strategi Kendali Deviasi &amp; Proyeksi Target
						</h2>
					</div>

					<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
						<div className="space-y-2.5 text-xs text-muted-foreground">
							<div className="flex items-start gap-2">
								<span className="font-bold text-primary">1.</span>
								<p>
									<strong>Sinkronisasi RPD vs Kalender Kerja:</strong> Pastikan jadwal penarikan dana bulanan merefleksikan tanggal riil penyelesaian termin dan pengajuan SPM.
								</p>
							</div>
							<div className="flex items-start gap-2">
								<span className="font-bold text-primary">2.</span>
								<p>
									<strong>Koreksi Triwulanan:</strong> Manfaatkan periode pemutakhiran triwulan (Feb/Apr/Jul/Okt) sebelum batas kunci DIPA berakhir.
								</p>
							</div>
							<div className="flex items-start gap-2">
								<span className="font-bold text-primary">3.</span>
								<p>
									<strong>Komposisi Pagu Terbesar:</strong> Akun dengan bobot pagu terbesar (misal Belanja Barang / Modal) paling sensitif terhadap nilai deviasi tertimbang.
								</p>
							</div>
						</div>

						<div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2.5">
							<div className="flex items-center justify-between">
								<span className="text-xs font-bold text-foreground">
									Target Proyeksi Pemulihan Nilai 100
								</span>
								<span className="text-[11px] font-semibold text-primary">
									n = {targetAnalysis.targetMonth}
								</span>
							</div>
							<p className="text-xs text-foreground leading-relaxed">
								{targetAnalysis.message}
							</p>
							<div className="border-t border-primary/10 pt-2 flex items-center justify-between text-[11px] text-muted-foreground">
								<span>Rata-rata aktual: <strong>{formatPercent(actualScore.avgDeviation ?? 0)}</strong></span>
								<span>Skor aktual: <strong>{actualScore.score?.toFixed(2) ?? "100.00"}</strong></span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</OperatorShell>
	);
}


import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
	AlertCircle,
	AlertTriangle,
	Calendar,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	Coins,
	FlaskConical,
	HelpCircle,
	Info,
	Layers,
	Lock,
	Percent,
	Save,
	ShieldCheck,
	SlidersHorizontal,
	Sparkles,
	Target,
	TrendingUp,
} from "lucide-react";
import { Dialog } from "radix-ui";
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
import { executeSimulation } from "@/services/simulation-service";

export const Route = createFileRoute("/operator/deviasi")({
	validateSearch: (search: Record<string, unknown>) => ({
		tab:
			search.tab === "simulation"
				? ("simulation" as const)
				: ("data" as const),
		org: typeof search.org === "string" ? search.org : undefined,
	}),
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
	"57": "Belanja Bansos (57)",
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

function toMonthly(
	rows: Array<{ month: number; accountCode: string; amount: string }>,
): MonthlyAmounts {
	const map: MonthlyAmounts = {};
	for (const r of rows) {
		const code = r.accountCode as DeviasiAccount;
		if (!DEVIASI_ACCOUNTS.includes(code)) continue;
		if (r.month < 1 || r.month > 12) continue;
		const slot = map[r.month] ?? {};
		if (slot[code] === undefined) slot[code] = parseNumber(r.amount);
		map[r.month] = slot;
	}
	return map;
}

function DeviasiPage() {
	const router = useRouter();
	const { tab } = Route.useSearch();
	const navigate = Route.useNavigate();
	const { budgetData, rpdData } = Route.useLoaderData();

	const activeTab = tab ?? "data";
	const setActiveTab = (newTab: "data" | "simulation") => {
		navigate({
			search: (prev) => ({
				tab: newTab,
				org: prev.org,
			}),
		});
	};

	const activeContext = useActiveContext();
	const selectedMonth =
		activeContext?.context.period.kind === "month"
			? activeContext.context.period.value
			: new Date().getMonth() + 1;
	const setSelectedMonth = (month: number) =>
		activeContext?.setPeriod({ kind: "month", value: month });

	const [actionMessage, setActionMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const [isHelpOpen, setIsHelpOpen] = useState(false);
	const [isTraceOpen, setIsTraceOpen] = useState(false);
	const [isRpdDrawerOpen, setIsRpdDrawerOpen] = useState(false);
	const [isRealDrawerOpen, setIsRealDrawerOpen] = useState(false);

	const [formAccount, setFormAccount] = useState<DeviasiAccount>("51");
	const [formMonth, setFormMonth] = useState<number>(selectedMonth);
	const [formAmount, setFormAmount] = useState<string>("");

	const [planRpd, setPlanRpd] = useState<Record<string, string>>({});
	const [planReal, setPlanReal] = useState<Record<string, string>>({});
	const [isSavingScenario, setIsSavingScenario] = useState(false);
	const [scenarioMessage, setScenarioMessage] = useState<string | null>(null);
	const [scenarioError, setScenarioError] = useState<string | null>(null);

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
	const totalPaguTerkini = useMemo(() => {
		return DEVIASI_ACCOUNTS.reduce((sum, acc) => sum + (pagu[acc] ?? 0), 0);
	}, [pagu]);
	const hasPagu = totalPaguTerkini > 0;

	const rpdMap: MonthlyAmounts = useMemo(
		() => toMonthly(rpdData.rpdLines),
		[rpdData],
	);
	const realMap: MonthlyAmounts = useMemo(
		() => toMonthly(rpdData.realizations),
		[rpdData],
	);

	const evalMonth = Math.min(Math.max(selectedMonth, 1), 11);

	const actualScoreObj = useMemo(
		() =>
			calcDeviasiScore(
				buildDeviationInput(pagu, rpdMap, realMap, {}, {}, evalMonth),
			),
		[pagu, rpdMap, realMap, evalMonth],
	);

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

	const historicalTrail = useMemo(
		() => calculateHistoricalTrail(pagu, rpdMap, realMap, evalMonth),
		[pagu, rpdMap, realMap, evalMonth],
	);

	const totalPlannedTrail = useMemo(() => {
		return historicalTrail.reduce(
			(sum, row) =>
				sum +
				(row.rpd["51"] ?? 0) +
				(row.rpd["52"] ?? 0) +
				(row.rpd["53"] ?? 0) +
				(row.rpd["57"] ?? 0),
			0,
		);
	}, [historicalTrail]);

	const totalRealizedTrail = useMemo(() => {
		return historicalTrail.reduce(
			(sum, row) =>
				sum +
				(row.realized["51"] ?? 0) +
				(row.realized["52"] ?? 0) +
				(row.realized["53"] ?? 0) +
				(row.realized["57"] ?? 0),
			0,
		);
	}, [historicalTrail]);

	const targetAnalysis = useMemo(
		() =>
			calcNextMonthTarget(
				actualScoreObj.avgDeviation ?? 0,
				actualScoreObj.monthsCount,
				evalMonth < 11 ? evalMonth + 1 : 11,
			),
		[actualScoreObj, evalMonth],
	);

	const quarterlyReminders = useMemo(
		() => getQuarterlyRpdReminders(selectedMonth),
		[selectedMonth],
	);

	const activeQuarterReminder = useMemo(() => {
		return (
			quarterlyReminders.find((q) => q.isCurrentQuarter) ??
			quarterlyReminders[0]
		);
	}, [quarterlyReminders]);

	const planRpdAmounts: MonthlyAmounts = useMemo(() => {
		const map: MonthlyAmounts = {};
		for (const key of Object.keys(planRpd)) {
			const sep = key.indexOf(":");
			const month = Number(key.slice(0, sep));
			const code = key.slice(sep + 1) as DeviasiAccount;
			if (!DEVIASI_ACCOUNTS.includes(code)) continue;
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
			const raw = Number(planReal[key]);
			const slot = map[month] ?? {};
			slot[code] = Number.isFinite(raw) && raw > 0 ? raw : 0;
			map[month] = slot;
		}
		return map;
	}, [planReal]);

	const simMonths = useMemo(() => {
		const months: number[] = [];
		for (let m = evalMonth + 1; m <= 11; m++) months.push(m);
		return months;
	}, [evalMonth]);

	const actualMonths = useMemo(() => {
		const months: number[] = [];
		for (let m = 1; m <= evalMonth; m++) months.push(m);
		return months;
	}, [evalMonth]);

	const simScore = useMemo(
		() =>
			calcDeviasiScore(
				buildDeviationInput(
					pagu,
					rpdMap,
					realMap,
					planRpdAmounts,
					planRealAmounts,
					evalMonth,
				),
			),
		[pagu, rpdMap, realMap, planRpdAmounts, planRealAmounts, evalMonth],
	);

	const simDelta =
		simScore.score !== null && actualScoreObj.score !== null
			? simScore.score - actualScoreObj.score
			: null;

	const hasPlan =
		Object.keys(planRpd).length + Object.keys(planReal).length > 0;

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
		setIsSavingScenario(true);
		setScenarioMessage(null);
		setScenarioError(null);

		try {
			const scoreValue =
				simScore.score !== null ? simScore.score.toFixed(2) : "100.00";
			await executeSimulation({
				period: { kind: "month", value: evalMonth },
				simulationType: "scenario",
				simulationName: `Skenario Deviasi Hal III s.d. ${MONTH_NAMES[evalMonth - 1]} (${scoreValue})`,
				overrides: {
					rpd_deviation: scoreValue,
				},
			});

			setScenarioMessage(
				`Skenario simulasi Deviasi Hal III berhasil disimpan ke Riwayat Snapshot IKPA (Nilai ${scoreValue}).`,
			);
			setTimeout(() => setScenarioMessage(null), 5000);
		} catch (err: unknown) {
			setScenarioError(
				err instanceof Error
					? err.message
					: "Gagal menyimpan skenario simulasi.",
			);
		} finally {
			setIsSavingScenario(false);
		}
	};

	const handleSaveRpd = async () => {
		setActionMessage(null);
		setErrorMessage(null);
		const val = Number.parseFloat(formAmount);

		if (Number.isNaN(val) || val < 0) {
			setErrorMessage(
				"Nominal RPD harus berupa angka positif atau nol (tidak boleh negatif).",
			);
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
			setErrorMessage(
				"Nominal Realisasi harus berupa angka positif atau nol (tidak boleh negatif).",
			);
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
			header: "Deviasi Akun (%)",
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
			header: "Bobot Pagu Terkini (%)",
			render: (item) => (
				<span
					title={`Pagu Akun ${item.accountCode}: ${formatRupiah(pagu[item.accountCode] ?? 0)} / Total Pagu: ${formatRupiah(totalPaguTerkini)}`}
					className="text-xs font-medium text-muted-foreground"
				>
					{formatPercent(item.weightPercent)}
				</span>
			),
		},
		{
			key: "weightedDev",
			header: "Deviasi Tertimbang (%)",
			render: (item) => (
				<span
					title={`${formatPercent(item.deviationPercent)} × ${formatPercent(item.weightPercent)}`}
					className="font-bold text-foreground"
				>
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
		<OperatorShell currentPath="/operator/deviasi">
			<div className="space-y-6">
				<div className="rounded-2xl border border-border bg-surface p-5 shadow-xs space-y-4">
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div className="flex items-start gap-3.5 max-w-3xl">
							<div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
								<TrendingUp className="size-5" />
							</div>
							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<h1 className="text-lg font-bold text-foreground sm:text-xl">
										Deviasi Halaman III DIPA
									</h1>
									<span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
										Bobot 15% · Aturan 2026
									</span>
								</div>
								<p className="text-xs text-muted-foreground leading-relaxed">
									Menilai kesesuaian realisasi bulanan terhadap RPD Halaman III DIPA per jenis belanja (51, 52, 53, 57) dengan penimbang proporsi <strong className="text-foreground">pagu belanja aktif terkini</strong>. Periode evaluasi <strong className="text-foreground">Januari–November</strong> (Desember dikecualikan).
								</p>
							</div>
						</div>

						<div className="flex items-center gap-2">
							<div className="inline-flex rounded-xl border border-border bg-background p-1 shadow-2xs">
								<button
									type="button"
									onClick={() => setActiveTab("data")}
									className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
										activeTab === "data"
											? "bg-primary text-primary-foreground shadow-xs"
											: "text-muted-foreground hover:text-foreground hover:bg-surface-muted"
									}`}
								>
									<Layers className="size-3.5" />
									<span>Data &amp; Perhitungan</span>
								</button>
								<button
									type="button"
									onClick={() => setActiveTab("simulation")}
									className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
										activeTab === "simulation"
											? "bg-primary text-primary-foreground shadow-xs"
											: "text-muted-foreground hover:text-foreground hover:bg-surface-muted"
									}`}
								>
									<FlaskConical className="size-3.5" />
									<span>Simulasi What-If</span>
								</button>
							</div>

							<Dialog.Root open={isHelpOpen} onOpenChange={setIsHelpOpen}>
								<Dialog.Trigger asChild>
									<button
										type="button"
										aria-label="Lihat rumus singkat Deviasi Halaman III"
										className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-sm font-bold text-muted-foreground hover:bg-surface-muted hover:text-foreground transition shadow-2xs"
									>
										<HelpCircle className="size-4" />
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
											Sesuai PER-5/PB/2024 dan regulasi penilaian IKPA 2026:
										</Dialog.Description>

										<ul className="list-disc space-y-2 pl-5 text-xs text-foreground">
											<li>
												<strong>Deviasi Akun:</strong> min(100, |Realisasi − RPD| ÷ RPD × 100). Cap maksimal 100% per akun.
											</li>
											<li>
												<strong>Kasus Khusus:</strong> RPD=0 dan Realisasi=0 → <strong>0%</strong>; RPD=0 dan Realisasi&gt;0 → <strong>100%</strong> (belanja tanpa rencana).
											</li>
											<li>
												<strong>Deviasi Tertimbang:</strong> Deviasi Akun × (Pagu Terkini Akun ÷ Total Pagu Terkini 51+52+53+57).
											</li>
											<li>
												<strong>Rata-rata Kumulatif:</strong> Jumlah Deviasi Bulanan dibagi <strong>n bulan berjalan</strong> (Jan s.d. bulan berjalan, maks 11).
											</li>
											<li>
												<strong>Kriteria Nilai:</strong> Rata-rata 0–5% = <strong>100</strong>; Rata-rata &gt;5% = <strong>100 − rata-rata</strong> (contoh 6% → 94).
											</li>
											<li>
												<strong>Pengecualian Desember:</strong> RPD &amp; Realisasi Desember tidak diperhitungkan dalam nilai Deviasi Halaman III.
											</li>
										</ul>
									</Dialog.Content>
								</Dialog.Portal>
							</Dialog.Root>
						</div>
					</div>

					<div className="grid grid-cols-1 gap-2 border-t border-border/60 pt-3 sm:grid-cols-3">
						<div className="flex items-start gap-2 text-xs text-muted-foreground">
							<span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
								1
							</span>
							<span>
								Pagu dihitung dari <strong>pagu aktif terkini</strong> (Pagu Awal / Revisi DIPA).
							</span>
						</div>
						<div className="flex items-start gap-2 text-xs text-muted-foreground">
							<span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
								2
							</span>
							<span>
								Isi <strong>RPD</strong> dan <strong>realisasi</strong> bulanan untuk memantau deviasi.
							</span>
						</div>
						<div className="flex items-start gap-2 text-xs text-muted-foreground">
							<span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
								3
							</span>
							<span>
								Gunakan <strong>Simulasi What-If</strong> untuk memproyeksikan target sisa tahun.
							</span>
						</div>
					</div>
				</div>

				{!hasPagu && (
					<div className="flex items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-xs font-medium text-warning shadow-xs">
						<div className="flex items-center gap-2.5">
							<AlertTriangle className="size-4 shrink-0" />
							<p>
								<strong>Pagu belanja belum dikonfigurasi.</strong> Proporsi bobot penimbang deviasi tidak dapat dihitung.
							</p>
						</div>
						<a
							href="/operator/data/budget-revisions"
							className="shrink-0 font-bold underline underline-offset-2 hover:text-foreground"
						>
							Atur Pagu Awal DIPA Sekarang →
						</a>
					</div>
				)}

				{/* Box Status Penilaian Deviasi Hal III (Top Overview Banner) */}
				<div className="rounded-2xl border border-border bg-surface p-4 shadow-xs space-y-3.5 sm:p-5">
					<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
						<div className="flex items-center gap-2">
							<ShieldCheck className="size-4 text-primary" />
							<h2 className="text-xs font-bold text-foreground sm:text-sm">
								Status Penilaian Deviasi Hal III
							</h2>
						</div>
						<span className="rounded-md bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
							Evaluasi s.d. {MONTH_NAMES[evalMonth - 1]} (n = {actualScoreObj.monthsCount} Bulan)
						</span>
					</div>

					{/* 5 Score Cards in Balanced Horizontal Grid */}
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
						{/* Card 1: Total RPD vs Realisasi Kumulatif */}
						<div className="rounded-xl border border-border bg-background p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-semibold">
									Total s.d. {MONTH_NAMES[evalMonth - 1]}
								</span>
								<Coins className="size-4 text-primary" />
							</div>
							<div className="space-y-0.5 text-xs font-semibold text-foreground">
								<p>
									Real: <span className="font-bold">{formatRupiah(totalRealizedTrail)}</span>
								</p>
								<p className="text-muted-foreground text-[11px]">
									RPD: {formatRupiah(totalPlannedTrail)}
								</p>
							</div>
						</div>

						{/* Card 2: Rata-rata Deviasi Kumulatif */}
						<div className="rounded-xl border border-border bg-background p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-semibold">
									Rata-rata Deviasi
								</span>
								<Percent
									className={`size-4 ${
										actualScoreObj.avgDeviation !== null &&
										actualScoreObj.avgDeviation > 10
											? "text-danger"
											: actualScoreObj.avgDeviation !== null &&
												  actualScoreObj.avgDeviation > 5
												? "text-warning"
												: "text-success"
									}`}
								/>
							</div>
							<div className="space-y-0.5">
								<p
									className={`text-2xl font-bold sm:text-3xl ${
										actualScoreObj.avgDeviation !== null &&
										actualScoreObj.avgDeviation > 10
											? "text-danger"
											: actualScoreObj.avgDeviation !== null &&
												  actualScoreObj.avgDeviation > 5
												? "text-warning"
												: "text-foreground"
									}`}
								>
									{actualScoreObj.avgDeviation !== null
										? formatPercent(actualScoreObj.avgDeviation)
										: "—"}
								</p>
								<p className="text-[11px] text-muted-foreground">
									Ambang batas: ≤ 5.00%
								</p>
							</div>
						</div>

						{/* Card 3: Pembagi n Bulan Berjalan */}
						<div className="rounded-xl border border-border bg-background p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-semibold">
									Objek Penilaian (n)
								</span>
								<Calendar className="size-4 text-primary" />
							</div>
							<div className="space-y-0.5">
								<p className="text-2xl font-bold text-foreground sm:text-3xl">
									n = {actualScoreObj.monthsCount} Bulan
								</p>
								<p className="text-[11px] text-muted-foreground">
									Januari s.d. {MONTH_NAMES[evalMonth - 1]}
								</p>
							</div>
						</div>

						{/* Card 4: Nilai IKPA Deviasi (2nd from right) */}
						<div className="rounded-xl border border-primary/20 bg-background p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-semibold">
									Nilai IKPA Deviasi Hal III
								</span>
								<ShieldCheck className="size-4 text-primary" />
							</div>
							<div className="space-y-0.5">
								<p className="text-2xl font-extrabold text-primary sm:text-3xl">
									{actualScoreObj.score !== null
										? Math.min(
												100,
												Math.max(0, actualScoreObj.score),
											).toFixed(2)
										: "—"}
								</p>
								<p className="text-[11px] text-muted-foreground">
									{actualScoreObj.avgDeviation !== null &&
									actualScoreObj.avgDeviation <= 5
										? "Maksimal (Rata-rata ≤ 5%)"
										: "100 − Rata-rata Deviasi"}
								</p>
							</div>
						</div>

						{/* Card 5: Nilai Akhir IKPA (Rightmost) */}
						<div className="rounded-xl border border-success/20 bg-success/5 p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-semibold">
									Nilai Akhir (15%)
								</span>
								<Sparkles className="size-4 text-success" />
							</div>
							<div className="space-y-0.5">
								<p className="text-2xl font-extrabold text-success sm:text-3xl">
									{actualScoreObj.contribution !== null
										? `${Math.min(
												15,
												Math.max(0, actualScoreObj.contribution),
											).toFixed(2)} pts`
										: "—"}
								</p>
								<p className="text-[11px] text-muted-foreground">
									Bobot 15% terhadap total IKPA
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* Box Pagu Belanja Aktif Terkini & Bobot Proporsi Penimbang */}
				<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-3">
					<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-2.5">
						<div className="flex items-center gap-2">
							<Coins className="size-4 text-primary" />
							<h2 className="text-xs font-bold text-foreground sm:text-sm">
								Pagu Belanja Aktif Terkini &amp; Bobot Proporsi Penimbang
							</h2>
						</div>
						<a
							href="/operator/data/budget-revisions"
							className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
						>
							<SlidersHorizontal className="size-3" />
							<span>Kelola Pagu / Revisi DIPA →</span>
						</a>
					</div>

					<div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
						<div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-1">
							<span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
								Total Pagu Terkini
							</span>
							<p className="text-sm font-bold text-primary sm:text-base">
								{formatRupiah(totalPaguTerkini)}
							</p>
							<span className="text-[10px] font-medium text-primary block">
								100% Total Belanja
							</span>
						</div>

						{DEVIASI_ACCOUNTS.map((acc) => {
							const amount = pagu[acc] ?? 0;
							const weightPct = (weights[acc] ?? 0) * 100;
							return (
								<div
									key={acc}
									className="rounded-xl border border-border bg-surface/50 p-3 space-y-1"
								>
									<div className="flex items-center justify-between">
										<span className="text-[10px] font-bold text-foreground">
											Akun {acc}
										</span>
										<span className="rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-bold text-foreground">
											{formatPercent(weightPct)}
										</span>
									</div>
									<p className="text-xs font-semibold text-foreground truncate">
										{formatRupiah(amount)}
									</p>
									<span className="text-[10px] text-muted-foreground block truncate">
										{ACCOUNT_LABELS[acc]}
									</span>
								</div>
							);
						})}
					</div>
				</div>

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

				{/* ========================================================================= */}
				{/* TAB 1: DATA & PERHITUNGAN RIIL DEVIASI HALAMAN III (DEFAULT VIEW)         */}
				{/* ========================================================================= */}
				{activeTab === "data" && (
					<div className="space-y-6">
						{/* Month Selector Pills */}
						<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background p-3 shadow-xs">
							<div className="flex items-center gap-2">
								<Calendar className="size-4 text-muted-foreground ml-1" />
								<span className="text-xs font-semibold text-foreground">
									Pilih Bulan Evaluasi:
								</span>
							</div>

							<div className="flex flex-wrap gap-1">
								{MONTH_NAMES.map((name, idx) => {
									const m = idx + 1;
									const isSelected = selectedMonth === m;
									const isDecember = m === 12;

									return (
										<button
											key={name}
											type="button"
											onClick={() => setSelectedMonth(m)}
											className={`relative inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
												isSelected
													? "bg-primary text-primary-foreground shadow-xs"
													: "border border-border bg-surface text-muted-foreground hover:bg-surface-muted hover:text-foreground"
											}`}
										>
											<span>{name.slice(0, 3)}</span>
											{isDecember && (
												<span
													title="Desember dikecualikan dari penilaian Deviasi Hal III"
													className="text-[9px] opacity-75"
												>
													*
												</span>
											)}
										</button>
									);
								})}
							</div>
						</div>

						{/* Card Ringkasan Bulan Terpilih */}
						<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-3">
							<div className="flex items-center justify-between">
								<h2 className="text-sm font-bold text-foreground">
									Data RPD vs Realisasi Bulan {MONTH_NAMES[selectedMonth - 1]}
								</h2>
								{selectedMonth === 12 && (
									<span className="rounded-md bg-warning/10 px-2 py-0.5 text-[10px] font-bold text-warning">
										Desember Dikecualikan dari Penilaian
									</span>
								)}
							</div>

							<div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
								<div className="rounded-xl bg-surface p-3 space-y-1 border border-border/50">
									<span className="text-[11px] text-muted-foreground block">
										Total RPD Bulan Ini
									</span>
									<span className="text-base font-bold text-foreground block truncate">
										{formatRupiah(monthDevDetail.totalRpd)}
									</span>
								</div>
								<div className="rounded-xl bg-surface p-3 space-y-1 border border-border/50">
									<span className="text-[11px] text-muted-foreground block">
										Total Realisasi Bulan Ini
									</span>
									<span className="text-base font-bold text-foreground block truncate">
										{formatRupiah(monthDevDetail.totalReal)}
									</span>
								</div>
								<div className="rounded-xl bg-surface p-3 space-y-1 border border-border/50">
									<span className="text-[11px] text-muted-foreground block">
										Deviasi Tertimbang Bulan Ini
									</span>
									<span
										className={`text-base font-extrabold block truncate ${
											monthDevDetail.monthWeightedDeviation > 10
												? "text-danger"
												: monthDevDetail.monthWeightedDeviation > 5
													? "text-warning"
													: "text-success"
										}`}
									>
										{formatPercent(monthDevDetail.monthWeightedDeviation)}
									</span>
								</div>
							</div>
						</div>

						{/* Tabel 4 Akun Bulan Terpilih (Full Width - Spacious & Clear!) */}
						<div className="rounded-2xl border border-border bg-surface p-4 shadow-xs space-y-4 sm:p-5">
							<DomainDataTable
								title={`Rincian 4 Jenis Belanja — ${MONTH_NAMES[selectedMonth - 1]}`}
								data={monthlyData}
								columns={columns}
								totalCount={monthlyData.length}
							/>
						</div>

						{/* Strip Pengingat H+10 Revisi RPD Triwulanan (Full Width) */}
						<div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-xs space-y-2 text-xs">
							<div className="flex items-center justify-between">
								<p className="font-bold text-foreground flex items-center gap-1.5">
									<Sparkles className="size-4 text-primary" />
									<span>
										Jadwal Pengajuan Revisi RPD Halaman III {activeQuarterReminder.label}
									</span>
								</p>
								<span className="text-[11px] font-semibold text-primary">
									Batas: {activeQuarterReminder.deadlineNotice}
								</span>
							</div>
							<p className="text-muted-foreground leading-relaxed">
								{activeQuarterReminder.recommendedAction}
							</p>
						</div>

						{/* Accordion: Cara Angka Ini Dihitung (Step-by-Step Trace) */}
						<div className="rounded-2xl border border-border bg-surface p-4 shadow-xs space-y-3">
							<button
								type="button"
								onClick={() => setIsTraceOpen(!isTraceOpen)}
								className="flex w-full items-center justify-between text-left"
							>
								<div className="flex items-center gap-2">
									<Info className="size-4 text-primary" />
									<h2 className="text-xs font-bold text-foreground sm:text-sm">
										Cara Angka Ini Dihitung (Step-by-Step Trace s.d. {MONTH_NAMES[evalMonth - 1]})
									</h2>
								</div>
								{isTraceOpen ? (
									<ChevronUp className="size-4 text-muted-foreground" />
								) : (
									<ChevronDown className="size-4 text-muted-foreground" />
								)}
							</button>

							{isTraceOpen && (
								<div className="border-t border-border/80 pt-3 space-y-3 text-xs">
									<div className="overflow-x-auto rounded-xl border border-border bg-background">
										<table className="w-full text-left text-xs">
											<thead className="border-b border-border bg-surface/70 font-semibold text-muted-foreground">
												<tr>
													<th className="p-2.5">Bulan</th>
													<th className="p-2.5">Deviasi Tertimbang</th>
													<th className="p-2.5">RPD Total</th>
													<th className="p-2.5">Realisasi Total</th>
													<th className="p-2.5 text-right">Rata-rata Kumulatif</th>
													<th className="p-2.5 text-right">Skor Kumulatif</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-border">
												{historicalTrail.map((m) => {
													const rpdTot =
														(m.rpd["51"] ?? 0) +
														(m.rpd["52"] ?? 0) +
														(m.rpd["53"] ?? 0) +
														(m.rpd["57"] ?? 0);
													const realTot =
														(m.realized["51"] ?? 0) +
														(m.realized["52"] ?? 0) +
														(m.realized["53"] ?? 0) +
														(m.realized["57"] ?? 0);
													return (
														<tr key={m.month}>
															<td className="p-2.5 font-medium text-foreground">
																{MONTH_NAMES[m.month - 1]}
															</td>
															<td className="p-2.5 font-bold text-foreground">
																{formatPercent(m.monthWeightedDev)}
															</td>
															<td className="p-2.5 text-muted-foreground">
																{formatRupiah(rpdTot)}
															</td>
															<td className="p-2.5 text-muted-foreground">
																{formatRupiah(realTot)}
															</td>
															<td className="p-2.5 text-right font-semibold text-foreground">
																{formatPercent(m.cumulativeAvg)}
															</td>
															<td className="p-2.5 text-right font-bold text-primary">
																{m.cumulativeScore.toFixed(2)}
															</td>
														</tr>
													);
												})}
											</tbody>
										</table>
									</div>

									<div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-1 text-xs">
										<p className="font-semibold text-foreground">
											Formula Kumulatif:
										</p>
										<p className="text-muted-foreground">
											Rata-rata = (Jumlah Deviasi Tertimbang 1 s.d. {evalMonth}) ÷ {actualScoreObj.monthsCount} = <strong>{actualScoreObj.avgDeviation !== null ? formatPercent(actualScoreObj.avgDeviation) : "—"}</strong>
										</p>
										<p className="text-muted-foreground">
											Nilai Akhir = {actualScoreObj.avgDeviation !== null && actualScoreObj.avgDeviation <= 5 ? "100.00 (Rata-rata ≤ 5%)" : `100 − ${actualScoreObj.avgDeviation?.toFixed(2)} = ${actualScoreObj.score?.toFixed(2)}`}
										</p>
									</div>
								</div>
							)}
						</div>

						{/* Panel Strategi & Proyeksi Target Bulan Berikutnya */}
						<div className="rounded-2xl border border-border bg-background p-5 shadow-xs space-y-3">
							<div className="flex items-center gap-2">
								<Target className="size-4 text-primary" />
								<h2 className="text-xs font-bold text-foreground sm:text-sm">
									Proyeksi Target Deviasi Bulan Berikutnya ({MONTH_NAMES[evalMonth < 11 ? evalMonth : 10]})
								</h2>
							</div>

							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
								<div className="rounded-xl border border-border bg-surface p-3.5 space-y-1">
									<span className="text-[11px] font-semibold text-muted-foreground block">
										Batas Maksimal Deviasi Bulan Depan agar Nilai Tetap 100
									</span>
									<p className="text-lg font-bold text-success">
										{targetAnalysis.isReachable
											? formatPercent(Math.max(0, targetAnalysis.targetPerMonth))
											: "Batas terlampaui"}
									</p>
									<p className="text-[10px] text-muted-foreground">
										{targetAnalysis.isReachable
											? `Agar rata-rata kumulatif tetap ≤ 5.00% pada bulan ${MONTH_NAMES[evalMonth < 11 ? evalMonth : 10]}.`
											: `Proyeksi skor tertinggi yang dapat dicapai: ${targetAnalysis.bestPossibleScore.toFixed(2)}.`}
									</p>
								</div>

								<div className="rounded-xl border border-border bg-surface p-3.5 space-y-1">
									<span className="text-[11px] font-semibold text-muted-foreground block">
										Rekomendasi Tindakan Operator
									</span>
									<p className="text-xs font-medium text-foreground leading-relaxed">
										{targetAnalysis.message}
									</p>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* ========================================================================= */}
				{/* TAB 2: SIMULASI & SKENARIO WHAT-IF (OPSI TAMBAHAN)                        */}
				{/* ========================================================================= */}
				{activeTab === "simulation" && (
					<div className="space-y-6">
						{/* Simulation Banner */}
						<div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-xs space-y-2">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div className="flex items-center gap-2">
									<FlaskConical className="size-4 text-primary" />
									<h2 className="text-sm font-bold text-foreground">
										Workspace Simulasi Rencana Penarikan Sisa Tahun
									</h2>
								</div>
								<span className="text-xs text-muted-foreground">
									Aktual s.d. <strong>{MONTH_NAMES[evalMonth - 1]}</strong> terkunci 🔒
								</span>
							</div>
							<p className="text-xs text-muted-foreground leading-relaxed">
								Masukkan rencana target RPD dan estimasi realisasi untuk bulan-bulan mendatang pada sel kuning di bawah. Sistem akan seketika menghitung dampak perubahan terhadap nilai akhir IKPA Deviasi Halaman III.
							</p>
						</div>

						{/* Save Scenario Feedback */}
						{scenarioMessage && (
							<output className="flex items-center justify-between gap-2.5 rounded-xl border border-success/30 bg-success/10 p-4 text-xs font-semibold text-success shadow-xs">
								<div className="flex items-center gap-2">
									<CheckCircle2 className="size-4 shrink-0" />
									<p>{scenarioMessage}</p>
								</div>
								<a
									href="/operator/history"
									className="underline underline-offset-2 hover:text-foreground font-bold"
								>
									Buka Riwayat Snapshot →
								</a>
							</output>
						)}

						{scenarioError && (
							<div
								role="alert"
								className="flex items-center gap-2.5 rounded-xl border border-danger/30 bg-danger/10 p-4 text-xs font-semibold text-danger shadow-xs"
							>
								<AlertCircle className="size-4 shrink-0" />
								<p>{scenarioError}</p>
							</div>
						)}

						{/* 4 Score Cards (Simulasi vs Aktual vs Dampak vs Rata-rata) */}
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
							{/* Card 1: Skor Simulasi */}
							<div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-xs space-y-1">
								<div className="flex items-center justify-between text-muted-foreground">
									<span className="text-xs font-semibold text-foreground">
										Skor Simulasi
									</span>
									<ShieldCheck className="size-4 text-primary" />
								</div>
								<p className="text-2xl font-extrabold text-primary">
									{simScore.score !== null ? formatPercent(simScore.score) : "—"}
								</p>
								<p className="text-[11px] text-muted-foreground">
									Kontribusi{" "}
									{simScore.contribution !== null
										? formatPercent(simScore.contribution)
										: "—"}{" "}
									· n = {simScore.monthsCount} bulan
								</p>
							</div>

							{/* Card 2: Aktual Terkunci */}
							<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
								<div className="flex items-center justify-between text-muted-foreground">
									<span className="text-xs font-semibold">Aktual Terkunci</span>
									<Lock className="size-4 text-muted-foreground" />
								</div>
								<p className="text-2xl font-bold text-foreground">
									{actualScoreObj.score !== null
										? formatPercent(actualScoreObj.score)
										: "—"}
								</p>
								<p className="text-[11px] text-muted-foreground">
									s.d. {MONTH_NAMES[evalMonth - 1]} · n = {actualScoreObj.monthsCount} bulan
								</p>
							</div>

							{/* Card 3: Dampak Skenario (Delta) */}
							<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
								<div className="flex items-center justify-between text-muted-foreground">
									<span className="text-xs font-semibold">Dampak Rencana (Δ)</span>
									<Target className="size-4 text-muted-foreground" />
								</div>
								<p
									className={`text-2xl font-bold ${
										simDelta === null || simDelta === 0
											? "text-muted-foreground"
											: simDelta > 0
												? "text-success"
												: "text-danger"
									}`}
								>
									{simDelta !== null
										? `${simDelta > 0 ? "+" : ""}${formatPercent(simDelta)}`
										: "—"}
								</p>
								<p className="text-[11px] text-muted-foreground">
									{simDelta !== null && simDelta > 0
										? "Meningkatkan nilai akhir"
										: simDelta !== null && simDelta < 0
											? "Menurunkan nilai akhir"
											: "Belum ada perubahan simulasi"}
								</p>
							</div>

							{/* Card 4: Rata-rata Deviasi Simulasi */}
							<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
								<div className="flex items-center justify-between text-muted-foreground">
									<span className="text-xs font-semibold">Rata-rata Deviasi</span>
									<Percent className="size-4 text-muted-foreground" />
								</div>
								<p className="text-2xl font-bold text-foreground">
									{simScore.avgDeviation !== null
										? formatPercent(simScore.avgDeviation)
										: "—"}
								</p>
								<p className="text-[11px] text-muted-foreground">
									Target ambang batas: <strong>≤ 5.00%</strong>
								</p>
							</div>
						</div>

						{/* Simulation Action Strip */}
						<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-xs">
							<div className="flex items-center gap-2">
								<Sparkles className="size-4 text-primary" />
								<span className="text-xs font-semibold text-foreground">
									Simpan Skenario Simulasi ke Riwayat Snapshot
								</span>
							</div>

							<button
								type="button"
								disabled={isSavingScenario || !hasPlan}
								onClick={handleSaveScenario}
								className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90 disabled:opacity-50"
							>
								<Save className="size-3.5" />
								<span>
									{isSavingScenario ? "Menyimpan Skenario..." : "Simpan Skenario IKPA"}
								</span>
							</button>
						</div>

						{/* Simulation What-If Table for Future Months */}
						<div className="rounded-2xl border border-border bg-background p-5 shadow-xs space-y-4">
							<div>
								<h3 className="text-sm font-bold text-foreground">
									Tabel Rencana RPD &amp; Realisasi Sisa Tahun (Sel Kuning = Simulasi)
								</h3>
								<p className="text-xs text-muted-foreground">
									Bulan Januari s.d. {MONTH_NAMES[evalMonth - 1]} terkunci sesuai data aktual. Bulan mendatang dapat diubah bebas untuk what-if analysis.
								</p>
							</div>

							<div className="overflow-x-auto">
								<table className="w-full text-left text-xs border-collapse">
									<thead>
										<tr className="border-b border-border bg-surface/70 font-semibold text-muted-foreground">
											<th className="p-3">Bulan</th>
											{DEVIASI_ACCOUNTS.map((acc) => (
												<th key={acc} className="p-3 text-center">
													{ACCOUNT_LABELS[acc]}
												</th>
											))}
											<th className="p-3 text-right">Deviasi Tertimbang</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border">
										{/* 1. Actual Months Locked */}
										{actualMonths.map((m) => {
											const monthDev = calcMonthDeviation(
												rpdMap[m] ?? {},
												realMap[m] ?? {},
												pagu,
											);
											return (
												<tr key={m} className="bg-surface/20">
													<td className="p-3 font-semibold text-foreground whitespace-nowrap">
														<div className="flex items-center gap-1.5">
															<Lock className="size-3 text-muted-foreground" />
															<span>{MONTH_NAMES[m - 1]}</span>
														</div>
													</td>
													{DEVIASI_ACCOUNTS.map((acc) => {
														const rpdVal = rpdMap[m]?.[acc] ?? 0;
														const realVal = realMap[m]?.[acc] ?? 0;
														return (
															<td key={acc} className="p-2.5 text-center">
																<div className="text-[11px] text-muted-foreground space-y-0.5">
																	<div>RPD: {formatRupiah(rpdVal)}</div>
																	<div>Real: {formatRupiah(realVal)}</div>
																</div>
															</td>
														);
													})}
													<td className="p-3 text-right font-bold text-foreground">
														{formatPercent(monthDev.monthWeightedDeviation)}
													</td>
												</tr>
											);
										})}

										{/* 2. Simulation Future Months */}
										{simMonths.map((m) => {
											const mergedRpd = {
												...(rpdMap[m] ?? {}),
												...(planRpdAmounts[m] ?? {}),
											};
											const mergedReal = {
												...(realMap[m] ?? {}),
												...(planRealAmounts[m] ?? {}),
											};
											const monthDev = calcMonthDeviation(
												mergedRpd,
												mergedReal,
												pagu,
											);

											return (
												<tr key={m} className="bg-warning/5">
													<td className="p-3 font-semibold text-foreground whitespace-nowrap">
														<div className="flex items-center gap-1.5">
															<Sparkles className="size-3 text-warning" />
															<span>{MONTH_NAMES[m - 1]} (Rencana)</span>
														</div>
													</td>
													{DEVIASI_ACCOUNTS.map((acc) => {
														const currentRpd = planRpd[`${m}:${acc}`] ?? "";
														const currentReal = planReal[`${m}:${acc}`] ?? "";

														return (
															<td key={acc} className="p-2.5">
																<div className="space-y-1.5 min-w-[130px]">
																	<FormattedNumberInput
																		placeholder="RPD (Rp)"
																		value={currentRpd}
																		onChange={(val) => setRpdValue(m, acc, val)}
																		className="min-h-8 w-full rounded-lg border border-warning/40 bg-warning/10 px-2 text-[11px] text-foreground focus:border-primary focus:outline-none"
																	/>
																	<FormattedNumberInput
																		placeholder="Realisasi (Rp)"
																		value={currentReal}
																		onChange={(val) => setRealValue(m, acc, val)}
																		className="min-h-8 w-full rounded-lg border border-warning/40 bg-warning/10 px-2 text-[11px] text-foreground focus:border-primary focus:outline-none"
																	/>
																</div>
															</td>
														);
													})}
													<td className="p-3 text-right font-extrabold text-foreground">
														{formatPercent(monthDev.monthWeightedDeviation)}
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				)}

				{/* Strategy Assistance Panel */}
				<section
					aria-label="Strategi Optimalisasi Nilai IKPA - Deviasi Halaman III DIPA"
					className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4"
				>
					<div className="flex items-center gap-2.5">
						<div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
							<TrendingUp className="size-4" />
						</div>
						<div>
							<h2 className="text-base font-bold text-foreground">
								Strategi Optimalisasi Nilai IKPA - Deviasi Halaman III DIPA
							</h2>
							<p className="text-xs text-muted-foreground">
								Langkah strategis pengendalian rencana penarikan dana bulanan satker agar deviasi tetap di bawah batas maksimal 5% (Bobot 10%).
							</p>
						</div>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
						<div className="p-4 rounded-xl border border-border bg-background space-y-2 flex flex-col justify-between">
							<div className="space-y-1.5">
								<span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
									1
								</span>
								<h3 className="font-bold text-foreground">
									Halaman III DIPA sebagai Alat Kendali KPA
								</h3>
								<p className="text-muted-foreground leading-relaxed text-[11px]">
									Memastikan Halaman III DIPA menjadi alat kendali bagi KPA dalam pencapaian kinerja, output, serta sasaran program/kegiatan satker/K/L.
								</p>
							</div>
						</div>

						<div className="p-4 rounded-xl border border-border bg-background space-y-2 flex flex-col justify-between">
							<div className="space-y-1.5">
								<span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
									2
								</span>
								<h3 className="font-bold text-foreground">
									Disiplin Eksekusi Sesuai Rencana RPD
								</h3>
								<p className="text-muted-foreground leading-relaxed text-[11px]">
									Memastikan seluruh unit kerja satker/K/L melaksanakan kegiatan sesuai dengan yang direncanakan sebagaimana tercantum dalam Halaman III DIPA melalui koordinasi dan sinergi yang kuat.
								</p>
							</div>
						</div>

						<div className="p-4 rounded-xl border border-border bg-background space-y-2 flex flex-col justify-between">
							<div className="space-y-1.5">
								<span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
									3
								</span>
								<h3 className="font-bold text-foreground">
									Pemutakhiran RPD Hal. III Setiap Triwulan
								</h3>
								<p className="text-muted-foreground leading-relaxed text-[11px]">
									Memanfaatkan kesempatan pemutakhiran data RPD Halaman III DIPA pada setiap triwulan (open period) untuk memutakhirkan rencana penarikan dana sesuai kebutuhan operasional.
								</p>
							</div>
						</div>

						<div className="p-4 rounded-xl border border-border bg-background space-y-2 flex flex-col justify-between">
							<div className="space-y-1.5">
								<span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
									4
								</span>
								<h3 className="font-bold text-foreground">
									Pengendalian Deviasi Realisasi ≤ 5%
								</h3>
								<p className="text-muted-foreground leading-relaxed text-[11px]">
									Memastikan deviasi antara pelaksanaan dengan rencana yang tercantum pada Halaman III DIPA tidak melebihi 5% (lima persen) guna memperoleh nilai IKPA maksimal 100%.
								</p>
							</div>
						</div>
					</div>
				</section>

				{/* Drawer RPD Line */}
				<DomainFormDrawer
					isOpen={isRpdDrawerOpen}
					title={`Ubah Target RPD — ${ACCOUNT_LABELS[formAccount]} (${MONTH_NAMES[formMonth - 1]})`}
					description="Rencana Penarikan Dana (RPD) pada Halaman III DIPA."
					onClose={() => setIsRpdDrawerOpen(false)}
					onSubmit={handleSaveRpd}
					isSubmitting={isSubmitting}
				>
					<div className="space-y-4">
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
								placeholder="0"
								value={formAmount}
								onChange={setFormAmount}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							/>
						</div>

						{/* Live Impact Preview */}
						<div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2 text-xs">
							<p className="font-semibold text-foreground flex items-center gap-1.5">
								<Info className="size-3.5 text-primary" />
								<span>Live Preview Dampak Deviasi</span>
							</p>
							<div className="grid grid-cols-2 gap-2 text-[11px]">
								<div>
									<span className="text-muted-foreground block">Deviasi Akun:</span>
									<span className="font-bold text-foreground">
										{formatPercent(drawerPreview.accDev)}
									</span>
								</div>
								<div>
									<span className="text-muted-foreground block">Deviasi Tertimbang Bulan Ini:</span>
									<span className="font-bold text-foreground">
										{formatPercent(drawerPreview.monthWeightedDev)}
									</span>
								</div>
							</div>
						</div>
					</div>
				</DomainFormDrawer>

				{/* Drawer Realisasi Line */}
				<DomainFormDrawer
					isOpen={isRealDrawerOpen}
					title={`Ubah Realisasi SP2D — ${ACCOUNT_LABELS[formAccount]} (${MONTH_NAMES[formMonth - 1]})`}
					description="Realisasi belanja yang telah diterbitkan SP2D."
					onClose={() => setIsRealDrawerOpen(false)}
					onSubmit={handleSaveRealization}
					isSubmitting={isSubmitting}
				>
					<div className="space-y-4">
						<div className="space-y-1.5">
							<label
								htmlFor="real-amount"
								className="block text-xs font-semibold text-foreground"
							>
								Nominal Realisasi SP2D (Rp)
							</label>
							<FormattedNumberInput
								id="real-amount"
								required
								placeholder="0"
								value={formAmount}
								onChange={setFormAmount}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							/>
						</div>

						{/* Live Impact Preview */}
						<div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2 text-xs">
							<p className="font-semibold text-foreground flex items-center gap-1.5">
								<Info className="size-3.5 text-primary" />
								<span>Live Preview Dampak Deviasi</span>
							</p>
							<div className="grid grid-cols-2 gap-2 text-[11px]">
								<div>
									<span className="text-muted-foreground block">Deviasi Akun:</span>
									<span className="font-bold text-foreground">
										{formatPercent(drawerPreview.accDev)}
									</span>
								</div>
								<div>
									<span className="text-muted-foreground block">Deviasi Tertimbang Bulan Ini:</span>
									<span className="font-bold text-foreground">
										{formatPercent(drawerPreview.monthWeightedDev)}
									</span>
								</div>
							</div>
						</div>
					</div>
				</DomainFormDrawer>
			</div>
		</OperatorShell>
	);
}


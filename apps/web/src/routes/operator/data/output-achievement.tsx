import { createFileRoute } from "@tanstack/react-router";
import {
	AlertCircle,
	AlertTriangle,
	Bell,
	BookOpen,
	Calendar,
	Check,
	CheckCircle2,
	ChevronDown,
	Clock,
	Edit,
	FileCheck,
	FlaskConical,
	Info,
	Percent,
	Plus,
	RotateCcw,
	Scale,
	Save,
	ShieldAlert,
	ShieldCheck,
	Sparkles,
	Target,
	Trash2,
	TrendingUp,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	type ColumnDef,
	DomainDataTable,
} from "@/components/data/domain-data-table";
import { DomainFormDrawer } from "@/components/data/domain-form-drawer";
import { FormattedNumberInput } from "@/components/data/formatted-number-input";
import { OperatorShell } from "@/components/layout/operator-shell";
import {
	formatDateDDMMYYYY,
	formatDynamicNumber,
	formatDynamicPercent,
	formatRupiah,
} from "@/lib/format";
import {
	calculateOutputReportDeadline,
	calculateOutputAchievement,
	default2026RuleSet,
	validateOutputRecord,
} from "@simulator-ikpa/ikpa-engine";

import {
	fetchFairnessProposals,
	fetchOutputReports,
	type FairnessProposal,
	type MonthlyTargetItem,
	type OutputAchievementData,
	type OutputReportRecord,
	type OutputTargetPlanRecord,
} from "@/services/output-achievement-service";

export const Route = createFileRoute("/operator/data/output-achievement")({
	loader: async ({ context }) => {
		const activeOrgId =
			context.auth?.isAuthenticated &&
			(context.access?.status === "operator_single_scope" ||
				context.access?.status === "operator_multiple_scopes")
				? (context.access.activeOrganizationId ?? undefined)
				: undefined;

		const [data, proposals] = await Promise.all([
			fetchOutputReports(activeOrgId),
			fetchFairnessProposals(activeOrgId),
		]);

		return { ...data, proposals };
	},
	component: OutputAchievementPage,
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

const QUARTER_NAMES = [
	"Triwulan I (Jan–Mar)",
	"Triwulan II (Apr–Jun)",
	"Triwulan III (Jul–Sep)",
	"Triwulan IV (Okt–Des)",
];

const STORAGE_KEY_MACRO_CO = "ikpa_co_macro_override_2026";

interface MacroCOData {
	source: "myintress_actual" | "simulation_override";
	nkkw: number;
	nkcro: number;
	roEligible?: number;
}

function stripTrailingDecimals(
	val: string | number | null | undefined,
): string {
	if (val === null || val === undefined || val === "") return "";
	const trimmed = String(val).trim();
	if (trimmed === "") return "";
	const num = Number(trimmed);
	if (!Number.isFinite(num)) return trimmed;
	if (Number.isInteger(num)) return num.toString();
	return String(num);
}

function OutputAchievementPage() {
	const initialData = Route.useLoaderData() as OutputAchievementData & {
		proposals: FairnessProposal[];
	};

	// Restructured Tabs: Tab 1 (Jadwal & Kepatuhan), Tab 2 (Panduan PER-5), Tab 3 (Fitur Simulasi - Preview)
	const [mainTab, setMainTab] = useState<"jadwal" | "panduan" | "simulasi">(
		"jadwal",
	);
	const [simSubTab, setSimSubTab] = useState<
		"target" | "realisasi" | "fairness"
	>("target");
	const [isSimDropdownOpen, setIsSimDropdownOpen] = useState(false);

	const [selectedMonth, setSelectedMonth] = useState<number>(
		new Date().getMonth() + 1,
	);
	const [search, setSearch] = useState("");
	const [activeTabFilter, setActiveTabFilter] = useState<
		"all" | "valid" | "action_needed" | "confirmed" | "excluded"
	>("all");

	const [actionMessage, setActionMessage] = useState<string | null>(null);

	const [isTargetDrawerOpen, setIsTargetDrawerOpen] = useState(false);
	const [isRealisasiDrawerOpen, setIsRealisasiDrawerOpen] = useState(false);
	const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);

	// Dual-Source Macro Input State (Mode A: MyIntress & Mode B: Quick What-If)
	const [isMacroModalOpen, setIsMacroModalOpen] = useState(false);
	const [macroMode, setMacroMode] = useState<
		"myintress_actual" | "simulation_override"
	>("myintress_actual");
	const [macroNkkw, setMacroNkkw] = useState("100.00");
	const [macroNkcro, setMacroNkcro] = useState("95.00");
	const [macroRoEligible, setMacroRoEligible] = useState("");
	const [macroSavedData, setMacroSavedData] = useState<MacroCOData | null>(null);

	// In-memory Sandbox Simulation State
	const [simOutputs, setSimOutputs] = useState<OutputReportRecord[]>(
		initialData.outputs || [],
	);
	const [simTargetPlans, setSimTargetPlans] = useState<
		OutputTargetPlanRecord[]
	>(initialData.targetPlans || []);
	const [simProposals, setSimProposals] = useState<FairnessProposal[]>(
		initialData.proposals || [],
	);

	useEffect(() => {
		try {
			const raw = localStorage.getItem(STORAGE_KEY_MACRO_CO);
			if (raw) {
				const parsed = JSON.parse(raw) as MacroCOData;
				if (parsed && typeof parsed.nkkw === "number") {
					setMacroSavedData(parsed);
					setMacroMode(parsed.source || "myintress_actual");
					setMacroNkkw(parsed.nkkw.toString());
					setMacroNkcro(parsed.nkcro.toString());
					if (parsed.roEligible) {
						setMacroRoEligible(parsed.roEligible.toString());
					}
				}
			}
		} catch {
			// ignore local storage errors
		}
	}, []);

	// Target Plan Form State
	const [targetRoCode, setTargetRoCode] = useState("");
	const [targetRoName, setTargetRoName] = useState("");
	const [targetVolumeDipa, setTargetVolumeDipa] = useState("12");
	const [targetUnit, setTargetUnit] = useState("Layanan");
	const [targetIsInteger, setTargetIsInteger] = useState(true);
	const [targetIsPn, setTargetIsPn] = useState(false);
	const [targetQuarter, setTargetQuarter] = useState(1);
	const [targetUpdateType, setTargetUpdateType] = useState<
		"regular" | "dipa_revision" | "ppa_adjustment" | "special_condition"
	>("regular");
	const [targetChangeReason, setTargetChangeReason] = useState("");
	const [targetMonthlyValues, setTargetMonthlyValues] = useState<
		{ month: number; targetRvro: string; targetPcro: string }[]
	>(
		Array.from({ length: 12 }, (_, i) => ({
			month: i + 1,
			targetRvro: "1",
			targetPcro: "8.33",
		})),
	);

	// Realisasi Form State (with Embedded Validation & PPK Confirmation)
	const [editingReport, setEditingReport] = useState<OutputReportRecord | null>(
		null,
	);
	const [formRoCode, setFormRoCode] = useState("");
	const [formRoName, setFormRoName] = useState("");
	const [formMonth, setFormMonth] = useState<number>(selectedMonth);
	const [formRvroIncremental, setFormRvroIncremental] = useState("");
	const [formPcroIncremental, setFormPcroIncremental] = useState("");
	const [formRvroCumulative, setFormRvroCumulative] = useState("");
	const [formPcroCumulative, setFormPcroCumulative] = useState("");
	const [formVolumeDipa, setFormVolumeDipa] = useState("12");
	const [formTpcro, setFormTpcro] = useState("25");
	const [formEvidenceUrl, setFormEvidenceUrl] = useState("");
	const [formAchievementRef, setFormAchievementRef] = useState("");
	const [formOperatorNote, setFormOperatorNote] = useState("");
	const [formPpkValidationNote, setFormPpkValidationNote] = useState("");
	const [formConfirmed, setFormConfirmed] = useState(false);

	// Fairness Proposal Modal State
	const [proposalRoCode, setProposalRoCode] = useState("");
	const [proposalMonth, setProposalMonth] = useState<number | null>(null);
	const [proposalIsExcluded, setProposalIsExcluded] = useState(true);
	const [proposalCategory, setProposalCategory] = useState("ro_khusus");
	const [proposalBasis, setProposalBasis] = useState(
		"Fairness treatment IKPA TA 2026",
	);
	const [proposalNote, setProposalNote] = useState("");

	// Open Period Realisasi Kinerja State
	const [isOpenPeriodMatrixOpen, setIsOpenPeriodMatrixOpen] = useState(false);
	const [isRequestingAdditionalOpen, setIsRequestingAdditionalOpen] =
		useState(false);
	const [additionalRequestReason, setAdditionalRequestReason] = useState(
		"Kendala Teknis Aplikasi OM-SPAN / SAKTI",
	);
	const [additionalRequestDocNumber, setAdditionalRequestDocNumber] =
		useState("");
	const [additionalRequestNote, setAdditionalRequestNote] = useState("");
	const [additionalSubmittedMonths, setAdditionalSubmittedMonths] = useState<
		number[]
	>([]);

	const calendarWorkdayInput = useMemo(
		() => ({ holidays: initialData.holidays || [], workdays: [] }),
		[initialData.holidays],
	);

	const canonicalDeadline = useMemo(() => {
		return calculateOutputReportDeadline(
			initialData.year,
			selectedMonth,
			calendarWorkdayInput,
		);
	}, [initialData.year, selectedMonth, calendarWorkdayInput]);

	const realizationOpenPeriodsList = useMemo(() => {
		return [
			{
				month: 1,
				name: "Januari 2026",
				monthLabel: "Januari",
				openRange: "1 Jan 2026 – 30 Apr 2026",
				regulerDeadline: "2026-04-30",
				additionalDeadline: "2026-04-30",
				status: "closed" as "open_auto" | "open_additional" | "closed" | "scheduled",
				notes: "Relaksasi pelaporan awal tahun s.d. 30 April 2026",
			},
			{
				month: 2,
				name: "Februari 2026",
				monthLabel: "Februari",
				openRange: "1 Feb 2026 – 30 Apr 2026",
				regulerDeadline: "2026-04-30",
				additionalDeadline: "2026-04-30",
				status: "closed" as "open_auto" | "open_additional" | "closed" | "scheduled",
				notes: "Relaksasi pelaporan awal tahun s.d. 30 April 2026",
			},
			{
				month: 3,
				name: "Maret 2026",
				monthLabel: "Maret",
				openRange: "1 Mar 2026 – 30 Apr 2026",
				regulerDeadline: "2026-04-30",
				additionalDeadline: "2026-04-30",
				status: "closed" as "open_auto" | "open_additional" | "closed" | "scheduled",
				notes: "Relaksasi pelaporan awal tahun s.d. 30 April 2026",
			},
			{
				month: 4,
				name: "April 2026",
				monthLabel: "April",
				openRange: "1 Mei 2026 – 12 Mei 2026",
				regulerDeadline: "2026-05-12",
				additionalDeadline: "2026-05-31",
				status: "closed" as "open_auto" | "open_additional" | "closed" | "scheduled",
				notes: "Sistem Terbuka Otomatis mulai HK-1 Mei (1 Mei) s.d. HK-7 Mei (12 Mei 2026)",
			},
			{
				month: 5,
				name: "Mei 2026",
				monthLabel: "Mei",
				openRange: "1 Jun 2026 – 10 Jun 2026",
				regulerDeadline: "2026-06-10",
				additionalDeadline: "2026-06-30",
				status: "closed" as "open_auto" | "open_additional" | "closed" | "scheduled",
				notes: "Sistem Terbuka Otomatis mulai HK-1 Juni (1 Jun) s.d. HK-7 Juni (10 Juni 2026)",
			},
			{
				month: 6,
				name: "Juni 2026",
				monthLabel: "Juni",
				openRange: "1 Jul 2026 – 9 Jul 2026",
				regulerDeadline: "2026-07-09",
				additionalDeadline: "2026-07-31",
				status: "closed" as "open_auto" | "open_additional" | "closed" | "scheduled",
				notes: "Sistem Terbuka Otomatis mulai HK-1 Juli (1 Jul) s.d. HK-7 Juli (9 Juli 2026)",
			},
			{
				month: 7,
				name: "Juli 2026",
				monthLabel: "Juli",
				openRange: "1 Ags 2026 – 11 Ags 2026",
				regulerDeadline: "2026-08-11",
				additionalDeadline: "2026-08-31",
				status: "closed" as "open_auto" | "open_additional" | "closed" | "scheduled",
				notes: "Sistem Terbuka Otomatis mulai HK-1 Agustus (1 Ags) s.d. HK-7 Agustus (11 Agustus 2026)",
			},
			{
				month: 8,
				name: "Agustus 2026",
				monthLabel: "Agustus",
				openRange: "1 Sep 2026 – 9 Sep 2026",
				regulerDeadline: "2026-09-09",
				additionalDeadline: "2026-09-30",
				status: "open_auto" as "open_auto" | "open_additional" | "closed" | "scheduled",
				notes: "Sistem Terbuka Otomatis mulai HK-1 September (1 Sep) s.d. HK-7 September (9 September 2026)",
			},
			{
				month: 9,
				name: "September 2026",
				monthLabel: "September",
				openRange: "1 Okt 2026 – 9 Okt 2026",
				regulerDeadline: "2026-10-09",
				additionalDeadline: "2026-10-31",
				status: "scheduled" as "open_auto" | "open_additional" | "closed" | "scheduled",
				notes: "Sistem Terbuka Otomatis mulai HK-1 Oktober (1 Okt) s.d. HK-7 Oktober (9 Oktober 2026)",
			},
			{
				month: 10,
				name: "Oktober 2026",
				monthLabel: "Oktober",
				openRange: "1 Nov 2026 – 10 Nov 2026",
				regulerDeadline: "2026-11-10",
				additionalDeadline: "2026-11-30",
				status: "scheduled" as "open_auto" | "open_additional" | "closed" | "scheduled",
				notes: "Sistem Terbuka Otomatis mulai HK-1 November (1 Nov) s.d. HK-7 November (10 November 2026)",
			},
			{
				month: 11,
				name: "November 2026",
				monthLabel: "November",
				openRange: "1 Des 2026 – 9 Des 2026",
				regulerDeadline: "2026-12-09",
				additionalDeadline: "2026-12-31",
				status: "scheduled" as "open_auto" | "open_additional" | "closed" | "scheduled",
				notes: "Sistem Terbuka Otomatis mulai HK-1 Desember (1 Des) s.d. HK-7 Desember (9 Desember 2026)",
			},
			{
				month: 12,
				name: "Desember 2026",
				monthLabel: "Desember",
				openRange: "1 Jan 2027 – 13 Jan 2027",
				regulerDeadline: "2027-01-13",
				additionalDeadline: "2027-01-31",
				status: "scheduled" as "open_auto" | "open_additional" | "closed" | "scheduled",
				notes: "Sistem Terbuka Otomatis mulai HK-1 Januari 2027 (1 Jan) s.d. HK-7 Januari 2027 (13 Januari 2027)",
			},
		];
	}, []);

	const currentMonthOpenPeriod = useMemo(() => {
		return (
			realizationOpenPeriodsList.find((p) => p.month === selectedMonth) ||
			realizationOpenPeriodsList[0]
		);
	}, [realizationOpenPeriodsList, selectedMonth]);

	const targetWindowsList = useMemo(() => {
		const raw = initialData.targetWindows || [];
		const baseSchedule = [
			{
				quarter: 1,
				name: "Triwulan I Tahun 2026",
				label: "Triwulan I",
				periodText: "s.d. 30 April 2026",
				opensAt: "2026-01-01",
				closesAt: "2026-04-30",
				status: "closed" as "scheduled" | "open" | "closed",
				notes: "Relaksasi periode pengisian awal tahun TA 2026",
			},
			{
				quarter: 2,
				name: "Triwulan II Tahun 2026",
				label: "Triwulan II",
				periodText: "s.d. 30 April 2026",
				opensAt: "2026-04-01",
				closesAt: "2026-04-30",
				status: "closed" as "scheduled" | "open" | "closed",
				notes: "Batas akhir pemutakhiran target triwulan II",
			},
			{
				quarter: 3,
				name: "Triwulan III Tahun 2026",
				label: "Triwulan III",
				periodText: "s.d. 14 Juli 2026",
				opensAt: "2026-07-01",
				closesAt: "2026-07-14",
				status: "closed" as "scheduled" | "open" | "closed",
				notes: "10 hari kerja di awal triwulan III - Juli",
			},
			{
				quarter: 4,
				name: "Triwulan IV Tahun 2026",
				label: "Triwulan IV",
				periodText: "s.d. 14 Oktober 2026",
				opensAt: "2026-10-01",
				closesAt: "2026-10-14",
				status: "scheduled" as "scheduled" | "open" | "closed",
				notes: "10 hari kerja di awal triwulan IV - Oktober",
			},
		];

		return baseSchedule.map((b) => {
			const found = raw.find((w) => w.quarter === b.quarter);
			if (!found) return b;
			return {
				...b,
				status: (found.status ?? b.status) as "scheduled" | "open" | "closed",
				opensAt: found.opensAt ? String(found.opensAt) : b.opensAt,
				closesAt: found.closesAt ? String(found.closesAt) : b.closesAt,
			};
		});
	}, [initialData.targetWindows]);

	const selectedQuarter = useMemo(() => {
		return Math.ceil(selectedMonth / 3);
	}, [selectedMonth]);

	const currentQuarterWindow = useMemo(() => {
		return (
			targetWindowsList.find((w) => w.quarter === selectedQuarter) ||
			targetWindowsList[0]
		);
	}, [targetWindowsList, selectedQuarter]);

	const upcomingScheduledWindow = useMemo(() => {
		return (
			targetWindowsList.find((w) => w.status === "open") ||
			targetWindowsList.find((w) => w.status === "scheduled") ||
			null
		);
	}, [targetWindowsList]);

	const monthData = useMemo(() => {
		return simOutputs.filter((item) => item.month === selectedMonth);
	}, [simOutputs, selectedMonth]);

	const filteredData = useMemo(() => {
		return monthData.filter((item) => {
			const matchesSearch =
				item.roCode.toLowerCase().includes(search.toLowerCase()) ||
				(item.roName &&
					item.roName.toLowerCase().includes(search.toLowerCase()));

			if (!matchesSearch) return false;

			const isExcluded = item.eligibility?.assessmentStatus === "excluded";
			const isValid =
				!item.validationResults ||
				item.validationResults.length === 0 ||
				item.validationResults.every((r) => r.status === "valid");
			const isActionNeeded =
				item.status === "draft" ||
				!item.confirmed ||
				(item.validationResults &&
					item.validationResults.some(
						(v) =>
							v.status === "blocking" || v.status === "confirmation_required",
					));
			const isConfirmed = item.confirmed || item.status === "confirmed";

			if (activeTabFilter === "valid") return isValid && !isExcluded;
			if (activeTabFilter === "action_needed") return isActionNeeded;
			if (activeTabFilter === "confirmed") return isConfirmed;
			if (activeTabFilter === "excluded") return isExcluded;
			return true;
		});
	}, [monthData, search, activeTabFilter]);

	const engineResult = useMemo(() => {
		const engineInputReports = monthData.map((o) => ({
			id: o.id,
			roCode: o.roCode,
			period: o.month,
			month: o.month,
			rvro: o.rvro,
			volumeDipa: o.volumeDipa,
			pcro: o.pcro,
			tpcro: o.tpcro,
			reportedDate: o.reportedAt
				? new Date(o.reportedAt).toISOString().slice(0, 10)
				: null,
			deadlineDate: o.deadlineDate || canonicalDeadline,
			confirmed: o.confirmed,
			isExcluded: o.eligibility?.assessmentStatus === "excluded",
			exclusionReason: o.eligibility?.exclusionReason ?? undefined,
		}));

		return calculateOutputAchievement(
			{ reports: engineInputReports, evalPeriod: selectedMonth },
			default2026RuleSet,
		);
	}, [monthData, selectedMonth, canonicalDeadline]);

	const totalRoMonth = monthData.length;
	const excludedCount = monthData.filter(
		(i) => i.eligibility?.assessmentStatus === "excluded",
	).length;
	const evaluatedCount = totalRoMonth - excludedCount;

	const timelyCount = monthData.filter((i) => {
		if (i.eligibility?.assessmentStatus === "excluded") return false;
		if (!i.reportedAt) return false;
		const rDate = new Date(i.reportedAt).toISOString().slice(0, 10);
		const dDate = i.deadlineDate || canonicalDeadline;
		return rDate <= dDate;
	}).length;

	const lateCount = monthData.filter((i) => {
		if (i.eligibility?.assessmentStatus === "excluded") return false;
		if (!i.reportedAt) return false;
		const rDate = new Date(i.reportedAt).toISOString().slice(0, 10);
		const dDate = i.deadlineDate || canonicalDeadline;
		return rDate > dDate;
	}).length;

	const pendingTimelinessCount = evaluatedCount - timelyCount - lateCount;

	const avgPcro =
		evaluatedCount > 0
			? monthData
					.filter((i) => i.eligibility?.assessmentStatus !== "excluded")
					.reduce((s, i) => s + (Number.parseFloat(i.pcro) || 0), 0) /
				evaluatedCount
			: 0;

	// Calculation for 4 Top Score Cards (Supporting Dual-Source Macro Override Mode A & Mode B)
	const displayedScores = useMemo(() => {
		if (macroSavedData) {
			const nkkw = Math.min(100, Math.max(0, macroSavedData.nkkw));
			const nkcro = Math.min(100, Math.max(0, macroSavedData.nkcro));
			const totalScore = Math.round((nkkw * 0.3 + nkcro * 0.7) * 100) / 100;
			const weighted = Math.round(totalScore * 0.25 * 100) / 100;

			return {
				isManual: true,
				source: macroSavedData.source,
				roLabel: macroSavedData.roEligible
					? `${macroSavedData.roEligible} / ${macroSavedData.roEligible} RO`
					: `${evaluatedCount} / ${totalRoMonth} RO`,
				roSub:
					macroSavedData.source === "myintress_actual"
						? "Data Riil MyIntress Terinput"
						: "Skenario Simulasi What-If",
				nkkw: nkkw.toFixed(2),
				nkkwSub: "Bobot 30% Terpenuhi",
				nkcro: nkcro.toFixed(2),
				nkcroSub: "Bobot 70% Terpenuhi",
				finalScore: totalScore.toFixed(2),
				weightedContribution: weighted.toFixed(2),
			};
		}

		// Fallback to system engine calculation
		const rawNkkw =
			engineResult.subComponents?.find((s) => s.key === "timeliness")?.score;
		const formattedNkkw =
			typeof rawNkkw === "number"
				? Math.min(100, Math.max(0, rawNkkw)).toFixed(2)
				: "—";
		const rawNkcro =
			engineResult.subComponents?.find((s) => s.key === "achievement")?.score;
		const formattedNkcro =
			typeof rawNkcro === "number"
				? Math.min(100, Math.max(0, rawNkcro)).toFixed(2)
				: "—";
		const rawFinal = engineResult.score;
		const formattedFinal =
			typeof rawFinal === "number"
				? Math.min(100, Math.max(0, rawFinal)).toFixed(2)
				: "—";
		const rawWeighted =
			typeof rawFinal === "number"
				? Math.min(25, Math.max(0, rawFinal * 0.25)).toFixed(2)
				: typeof engineResult.weightedContribution === "number"
					? Math.min(25, Math.max(0, engineResult.weightedContribution)).toFixed(2)
					: "—";

		return {
			isManual: false,
			source: "system_calculated" as const,
			roLabel: `${evaluatedCount} / ${totalRoMonth} RO`,
			roSub:
				excludedCount > 0
					? `${excludedCount} RO Dikecualikan`
					: "100% RO Eligible Dinilai",
			nkkw: formattedNkkw,
			nkkwSub: `${timelyCount} Tepat · ${lateCount} Terlambat · ${pendingTimelinessCount} Belum`,
			nkcro: formattedNkcro,
			nkcroSub: `Rata-rata PCRO: ${formatDynamicPercent(avgPcro)}`,
			finalScore: formattedFinal,
			weightedContribution: rawWeighted,
		};
	}, [
		macroSavedData,
		engineResult,
		evaluatedCount,
		totalRoMonth,
		excludedCount,
		timelyCount,
		lateCount,
		pendingTimelinessCount,
		avgPcro,
	]);

	// Validation metrics for current month
	const monthValidCount = monthData.filter((i) => {
		if (i.eligibility?.assessmentStatus === "excluded") return false;
		const res = i.validationResults || [];
		return res.length === 0 || res.every((r) => r.status === "valid");
	}).length;

	const monthBlockingCount = monthData.filter((i) => {
		const res = i.validationResults || [];
		return res.some((r) => r.status === "blocking");
	}).length;

	const monthConfirmationCount = monthData.filter((i) => {
		const res = i.validationResults || [];
		return res.some((r) => r.status === "confirmation_required");
	}).length;

	const monthActionNeededCount = monthData.filter(
		(i) =>
			i.status === "draft" ||
			!i.confirmed ||
			(i.validationResults &&
				i.validationResults.some(
					(v) =>
						v.status === "blocking" || v.status === "confirmation_required",
				)),
	).length;

	const monthConfirmedPpkCount = monthData.filter(
		(i) => i.confirmed || i.status === "confirmed",
	).length;

	const targetFormValidation = useMemo(() => {
		const volDipa = Number.parseFloat(targetVolumeDipa) || 0;
		const sumRvro = targetMonthlyValues.reduce(
			(acc, v) => acc + (Number.parseFloat(v.targetRvro) || 0),
			0,
		);
		const sumPcro = targetMonthlyValues.reduce(
			(acc, v) => acc + (Number.parseFloat(v.targetPcro) || 0),
			0,
		);
		const isRvroEqual = Math.abs(sumRvro - volDipa) < 0.001;
		const isPcro100 = Math.abs(sumPcro - 100) < 0.01;
		const integerCheck = targetIsInteger
			? targetMonthlyValues.every((v) =>
					Number.isInteger(Number.parseFloat(v.targetRvro) || 0),
				)
			: true;

		return {
			volDipa,
			sumRvro,
			sumPcro,
			isRvroEqual,
			isPcro100,
			integerCheck,
			isValid:
				isRvroEqual && isPcro100 && integerCheck && !!targetRoCode.trim(),
		};
	}, [targetVolumeDipa, targetMonthlyValues, targetIsInteger, targetRoCode]);

	const activeRoBudgetRealization = useMemo(() => {
		if (!formRoCode.trim()) return null;
		const brs = initialData.budgetRealizations || [];
		return (
			brs.find(
				(b) =>
					b.roCode.toUpperCase() === formRoCode.trim().toUpperCase() &&
					b.month === formMonth,
			) || null
		);
	}, [formRoCode, formMonth, initialData.budgetRealizations]);

	const liveDrawerPreview = useMemo(() => {
		const parsedRv = Number.parseFloat(formRvroCumulative) || 0;
		const parsedVol = Number.parseFloat(formVolumeDipa) || 0;
		const parsedPc = Number.parseFloat(formPcroCumulative) || 0;
		const parsedTpc = Number.parseFloat(formTpcro) || 0;

		const uCode = formRoCode.trim().toUpperCase();
		const isExcluded =
			uCode === "FAN.ZZ1" ||
			uCode.includes("FAN.ZZ1") ||
			(initialData.publishedPolicies || []).some(
				(p) =>
					p.status === "published" &&
					p.roMatchValue &&
					String(p.roMatchValue).toUpperCase().includes(uCode),
			);

		if (isExcluded) {
			return {
				formulaType: "EXCLUDED",
				badge: "Dikecualikan (Fairness)",
				score: "—",
				description:
					"RO Khusus ini tidak menjadi objek penilaian (dikeluarkan dari pembilang & penyebut).",
				calculationStep: "Dikecualikan dari penilaian Capaian Output TA 2026",
			};
		}

		if (parsedPc === 0) {
			return {
				formulaType: "ZERO_PCRO",
				badge: "0 (PCRO = 0%)",
				score: "0.00",
				description: "Progres fisik (PCRO) 0% menghasilkan nilai 0.",
				calculationStep: "Aturan Khusus: PCRO = 0% -> Nilai = 0.00",
			};
		}

		if (formMonth === 12 || parsedPc >= 100) {
			const ratio = parsedVol > 0 ? (parsedRv / parsedVol) * 100 : 0;
			const capped = Math.min(ratio, 100);
			return {
				formulaType: "FORMULA_2",
				badge: "Formula 2 (Realisasi Volume)",
				score: capped.toFixed(2),
				description:
					formMonth === 12
						? "Periode Desember: Menggunakan Formula 2 (RVRO / Target Volume RO DIPA)."
						: "PCRO mencapai 100%: Menggunakan Formula 2 (RVRO / Target Volume RO DIPA).",
				calculationStep: `min((${formatDynamicNumber(parsedRv, 0)} / ${formatDynamicNumber(parsedVol, 0)}) × 100, 100) = ${capped.toFixed(2)}`,
			};
		}

		const ratio = parsedTpc > 0 ? (parsedPc / parsedTpc) * 100 : 0;
		const capped = Math.min(ratio, 100);
		return {
			formulaType: "FORMULA_1",
			badge: "Formula 1 (PCRO / TPCRO)",
			score: capped.toFixed(2),
			description:
				"Januari–November dengan PCRO < 100%: Menggunakan Formula 1 (PCRO / Target TPCRO).",
			calculationStep: `min((${formatDynamicNumber(parsedPc, 2)}% / ${formatDynamicNumber(parsedTpc, 2)}%) × 100, 100) = ${capped.toFixed(2)}`,
		};
	}, [
		formRoCode,
		formMonth,
		formRvroCumulative,
		formVolumeDipa,
		formPcroCumulative,
		formTpcro,
		initialData.publishedPolicies,
	]);

	// Live Validation Engine (Rules 00–08) Execution on Drawer Inputs
	const liveValidationResults = useMemo(() => {
		const parsedRv = Number.parseFloat(formRvroCumulative) || 0;
		const parsedVol = Number.parseFloat(formVolumeDipa) || 0;
		const parsedPc = Number.parseFloat(formPcroCumulative) || 0;
		const parsedTpc = Number.parseFloat(formTpcro) || 0;
		const ppaVal = activeRoBudgetRealization
			? Number(
					activeRoBudgetRealization.cumulativePpaPercentage ||
						activeRoBudgetRealization.ppaPercentage,
				)
			: null;

		return validateOutputRecord({
			roCode: formRoCode || "RO",
			month: formMonth,
			volumeDipa: parsedVol,
			pcroCumulative: parsedPc,
			tpcroCumulative: parsedTpc,
			rvroCumulative: parsedRv,
			ppaCumulative: ppaVal,
			hasPpaData: activeRoBudgetRealization !== null,
			confirmed: formConfirmed,
			evidenceStatus: !!formEvidenceUrl.trim(),
		});
	}, [
		formRoCode,
		formMonth,
		formVolumeDipa,
		formPcroCumulative,
		formTpcro,
		formRvroCumulative,
		activeRoBudgetRealization,
		formConfirmed,
		formEvidenceUrl,
	]);

	const liveBlockingErrors = useMemo(
		() =>
			liveValidationResults.filter(
				(r) => r.status === "failed" && r.severity === "blocking",
			),
		[liveValidationResults],
	);

	const liveConfirmationRequired = useMemo(
		() =>
			liveValidationResults.filter(
				(r) => r.status === "failed" && r.severity === "confirmation_required",
			),
		[liveValidationResults],
	);

	const handleAutoDistributeTargets = () => {
		const vol = Number.parseFloat(targetVolumeDipa) || 0;
		if (vol <= 0) return;
		const baseMonthly = Math.floor(vol / 12);
		const remainder = vol - baseMonthly * 12;

		const basePcro = Math.floor((100 / 12) * 100) / 100; // 8.33
		const remainderPcro = Math.round((100 - basePcro * 12) * 100) / 100;

		const updated = Array.from({ length: 12 }, (_, idx) => {
			const mVol = idx === 11 ? baseMonthly + remainder : baseMonthly;
			const mPcro = idx === 11 ? basePcro + remainderPcro : basePcro;
			return {
				month: idx + 1,
				targetRvro: String(mVol),
				targetPcro: String(mPcro),
			};
		});

		setTargetMonthlyValues(updated);
	};

	const handleOpenCreateTarget = (plan?: OutputTargetPlanRecord) => {
		if (plan) {
			setTargetRoCode(plan.roCode);
			setTargetRoName(plan.roName || "");
			setTargetVolumeDipa(stripTrailingDecimals(plan.volumeDipa));
			setTargetUnit(plan.unit || "Layanan");
			setTargetIsInteger(plan.isIntegerUnit ?? true);
			setTargetIsPn(plan.isPriorityNational ?? false);
			setTargetQuarter(plan.quarter || 1);
			setTargetUpdateType("regular");
			const planWithReason = plan as { changeReason?: string };
			setTargetChangeReason(planWithReason.changeReason || "");
			if (plan.monthlyTargets && plan.monthlyTargets.length === 12) {
				setTargetMonthlyValues(
					plan.monthlyTargets.map((m) => ({
						month: m.month,
						targetRvro: String(m.targetRvro),
						targetPcro: String(m.targetPcro),
					})),
				);
			}
		} else {
			setTargetRoCode("");
			setTargetRoName("");
			setTargetVolumeDipa("12");
			setTargetUnit("Layanan");
			setTargetIsInteger(true);
			setTargetIsPn(false);
			setTargetQuarter(1);
			setTargetUpdateType("regular");
			setTargetChangeReason("");
			setTargetMonthlyValues(
				Array.from({ length: 12 }, (_, i) => ({
					month: i + 1,
					targetRvro: "1",
					targetPcro: "8.33",
				})),
			);
		}
		setIsTargetDrawerOpen(true);
	};

	// Sandbox Mode Save Handlers (Local Simulation in Memory Only)
	const handleSaveTargetSandbox = () => {
		if (!targetFormValidation.isValid) return;

		let cumRv = 0;
		let cumPc = 0;
		const monthlyItems: MonthlyTargetItem[] = targetMonthlyValues.map((v) => {
			const rVal = Number.parseFloat(v.targetRvro) || 0;
			const pVal = Number.parseFloat(v.targetPcro) || 0;
			cumRv += rVal;
			cumPc += pVal;
			return {
				month: v.month,
				targetRvro: rVal,
				targetPcro: pVal,
				cumulativeTargetRvro: cumRv,
				cumulativeTargetPcro: Math.min(100, Math.round(cumPc * 100) / 100),
			};
		});

		const newPlan: OutputTargetPlanRecord = {
			id: `sim-plan-${Date.now()}`,
			orgId: "org-sim",
			fiscalYearId: "fy-2026",
			roCode: targetRoCode.trim().toUpperCase(),
			roName: targetRoName.trim() || undefined,
			volumeDipa: String(targetFormValidation.volDipa),
			unit: targetUnit.trim() || "Layanan",
			isIntegerUnit: targetIsInteger,
			isPriorityNational: targetIsPn,
			quarter: targetQuarter,
			version: 1,
			status: "active",
			monthlyTargets: monthlyItems,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		setSimTargetPlans((prev) => [
			newPlan,
			...prev.filter(
				(p) => p.roCode.toUpperCase() !== targetRoCode.trim().toUpperCase(),
			),
		]);

		setActionMessage(
			`[🧪 Sandbox Preview] Target Kinerja RO ${targetRoCode.trim().toUpperCase()} berhasil disimulasikan di layar.`,
		);
		setIsTargetDrawerOpen(false);
		setTimeout(() => setActionMessage(null), 4000);
	};

	const handleOpenCreateRealisasi = (report?: OutputReportRecord) => {
		if (report) {
			setEditingReport(report);
			setFormRoCode(report.roCode);
			setFormRoName(report.roName || "");
			setFormMonth(report.month);
			setFormVolumeDipa(stripTrailingDecimals(report.volumeDipa));
			setFormRvroCumulative(stripTrailingDecimals(report.rvro));
			setFormPcroCumulative(stripTrailingDecimals(report.pcro));
			setFormTpcro(stripTrailingDecimals(report.tpcro));
			setFormRvroIncremental(
				stripTrailingDecimals(report.rvroIncremental || report.rvro),
			);
			setFormPcroIncremental(
				stripTrailingDecimals(report.pcroIncremental || report.pcro),
			);
			setFormEvidenceUrl(report.evidenceDocumentUrl || "");
			setFormAchievementRef(report.achievementReference || "");
			setFormOperatorNote(report.operatorNote || "");
			setFormPpkValidationNote(report.ppkValidationNote || "");
			setFormConfirmed(report.confirmed || report.status === "confirmed");
		} else {
			setEditingReport(null);
			setFormRoCode("");
			setFormRoName("");
			setFormMonth(selectedMonth);
			setFormVolumeDipa("12");
			setFormRvroCumulative("");
			setFormPcroCumulative("");
			setFormTpcro("25");
			setFormRvroIncremental("");
			setFormPcroIncremental("");
			setFormEvidenceUrl("");
			setFormAchievementRef("");
			setFormOperatorNote("");
			setFormPpkValidationNote("");
			setFormConfirmed(false);
		}
		setIsRealisasiDrawerOpen(true);
	};

	const handleIncrementalRvroChange = (val: string) => {
		setFormRvroIncremental(val);
		const inc = Number.parseFloat(val) || 0;
		const prevReport = simOutputs.find(
			(o) =>
				o.roCode.toUpperCase() === formRoCode.toUpperCase() &&
				o.month === formMonth - 1,
		);
		const prevCum = prevReport ? Number.parseFloat(prevReport.rvro) || 0 : 0;
		setFormRvroCumulative(String(prevCum + inc));
	};

	const handleIncrementalPcroChange = (val: string) => {
		setFormPcroIncremental(val);
		const inc = Number.parseFloat(val) || 0;
		const prevReport = simOutputs.find(
			(o) =>
				o.roCode.toUpperCase() === formRoCode.toUpperCase() &&
				o.month === formMonth - 1,
		);
		const prevCum = prevReport ? Number.parseFloat(prevReport.pcro) || 0 : 0;
		setFormPcroCumulative(
			String(Math.min(100, Math.round((prevCum + inc) * 100) / 100)),
		);
	};

	const handleSaveRealisasiSandbox = (
		status: "draft" | "submitted" | "confirmed" = "draft",
	) => {
		if (!formRoCode.trim()) return;

		const updatedReport: OutputReportRecord = {
			id: editingReport?.id || `sim-report-${Date.now()}`,
			roCode: formRoCode.trim().toUpperCase(),
			roName: formRoName.trim() || undefined,
			month: formMonth,
			volumeDipa: stripTrailingDecimals(formVolumeDipa) || "12",
			rvro: stripTrailingDecimals(formRvroCumulative) || "0",
			pcro: stripTrailingDecimals(formPcroCumulative) || "0",
			tpcro: stripTrailingDecimals(formTpcro) || "0",
			rvroIncremental: stripTrailingDecimals(formRvroIncremental) || undefined,
			pcroIncremental: stripTrailingDecimals(formPcroIncremental) || undefined,
			status: formConfirmed ? "confirmed" : status,
			confirmed: formConfirmed || status === "confirmed",
			reportedAt: new Date().toISOString(),
			evidenceDocumentUrl: formEvidenceUrl.trim() || undefined,
			achievementReference: formAchievementRef.trim() || undefined,
			operatorNote: formOperatorNote.trim() || undefined,
			ppkValidationNote: formPpkValidationNote.trim() || undefined,
			validationResults: liveValidationResults.map((r) => ({
				ruleCode: r.code,
				ruleName: r.title,
				category: "consistency",
				status: (r.status === "passed" ? "valid" : r.severity) as
					| "valid"
					| "blocking"
					| "confirmation_required"
					| "correctable"
					| "not_evaluable",
				message: r.message,
			})),
			eligibility: {
				assessmentStatus: "included",
				resolverVersion: "2026.1",
			},
		};

		setSimOutputs((prev) => [
			updatedReport,
			...prev.filter(
				(o) =>
					!(
						o.roCode.toUpperCase() === formRoCode.trim().toUpperCase() &&
						o.month === formMonth
					),
			),
		]);

		setActionMessage(
			`[🧪 Sandbox Preview] Realisasi RO ${formRoCode.trim().toUpperCase()} Bulan ${MONTH_NAMES[formMonth - 1]} berhasil disimulasikan di layar.`,
		);
		setIsRealisasiDrawerOpen(false);
		setTimeout(() => setActionMessage(null), 4000);
	};

	const handleOpenFairnessModal = (item?: OutputReportRecord | string) => {
		if (item && typeof item === "object") {
			const uCode = item.roCode.trim().toUpperCase();
			setProposalRoCode(uCode);
			setProposalMonth(item.month);
			const isCurrentlyExcluded =
				item.eligibility?.assessmentStatus === "excluded";
			setProposalIsExcluded(isCurrentlyExcluded);
			setProposalCategory(item.eligibility?.exclusionCategory || "ro_khusus");
			setProposalBasis(
				item.eligibility?.policyReference || "Fairness treatment IKPA TA 2026",
			);
			setProposalNote(item.eligibility?.exclusionReason || "");
		} else if (typeof item === "string") {
			setProposalRoCode(item.trim().toUpperCase());
			setProposalMonth(selectedMonth);
			setProposalIsExcluded(true);
			setProposalCategory("ro_khusus");
			setProposalBasis("Fairness treatment IKPA TA 2026");
			setProposalNote("");
		} else {
			setProposalRoCode("");
			setProposalMonth(selectedMonth);
			setProposalIsExcluded(true);
			setProposalCategory("ro_khusus");
			setProposalBasis("Fairness treatment IKPA TA 2026");
			setProposalNote("");
		}
		setIsProposalModalOpen(true);
	};

	const handleSubmitProposalSandbox = () => {
		if (!proposalRoCode.trim()) return;

		const code = proposalRoCode.trim().toUpperCase();
		if (proposalIsExcluded) {
			const newProp: FairnessProposal = {
				id: `sim-prop-${Date.now()}`,
				organizationId: "org-sim",
				fiscalYearId: "fy-2026",
				indicatorKey: "output_achievement",
				roCode: code,
				month: proposalMonth,
				category: proposalCategory,
				basisReference: proposalBasis.trim(),
				operatorNote: proposalNote.trim() || undefined,
				status: "approved",
				createdAt: new Date().toISOString(),
			};

			setSimProposals((prev) => [
				newProp,
				...prev.filter((p) => p.roCode.toUpperCase() !== code),
			]);

			setSimOutputs((prev) =>
				prev.map((o) => {
					if (o.roCode.toUpperCase() === code) {
						return {
							...o,
							eligibility: {
								assessmentStatus: "excluded",
								exclusionCategory: proposalCategory,
								exclusionReason: proposalNote || "Pengecualian RO Khusus",
								policyReference: proposalBasis,
								resolverVersion: "2026.1",
							},
						};
					}
					return o;
				}),
			);

			setActionMessage(
				`[🧪 Sandbox Preview] Pengecualian Fairness RO ${code} berhasil diterapkan pada simulasi.`,
			);
		} else {
			setSimProposals((prev) =>
				prev.filter((p) => p.roCode.toUpperCase() !== code),
			);
			setSimOutputs((prev) =>
				prev.map((o) => {
					if (o.roCode.toUpperCase() === code) {
						return {
							...o,
							eligibility: {
								assessmentStatus: "included",
								resolverVersion: "2026.1",
							},
						};
					}
					return o;
				}),
			);
			setActionMessage(
				`[🧪 Sandbox Preview] Pengecualian Fairness RO ${code} dinonaktifkan pada simulasi.`,
			);
		}

		setIsProposalModalOpen(false);
		setTimeout(() => setActionMessage(null), 4000);
	};

	// Macro Scoring Handlers (Mode A & Mode B)
	const handleSaveMacroScore = () => {
		const parsedNkkw = Number.parseFloat(macroNkkw) || 0;
		const parsedNkcro = Number.parseFloat(macroNkcro) || 0;
		const parsedEligible = macroRoEligible
			? Number.parseInt(macroRoEligible, 10)
			: undefined;

		const dataToSave: MacroCOData = {
			source: macroMode,
			nkkw: Math.min(100, Math.max(0, parsedNkkw)),
			nkcro: Math.min(100, Math.max(0, parsedNkcro)),
			roEligible: parsedEligible,
		};

		setMacroSavedData(dataToSave);
		try {
			localStorage.setItem(STORAGE_KEY_MACRO_CO, JSON.stringify(dataToSave));
		} catch {
			// ignore storage errors
		}

		setIsMacroModalOpen(false);
		setActionMessage(
			macroMode === "myintress_actual"
				? "Data riil capaian output berhasil disimpan. Skor IKPA Dashboard diperbarui."
				: "Skenario What-If berhasil diaktifkan pada perhitungan skor IKPA.",
		);
		setTimeout(() => setActionMessage(null), 4000);
	};

	const handleResetMacroScore = () => {
		setMacroSavedData(null);
		try {
			localStorage.removeItem(STORAGE_KEY_MACRO_CO);
		} catch {
			// ignore storage errors
		}
		setActionMessage("Pengaturan skor dikembalikan ke kalkulasi data sistem.");
		setTimeout(() => setActionMessage(null), 4000);
	};

	const realisasiColumns: ColumnDef<OutputReportRecord>[] = [
		{
			key: "ro",
			header: "Kode & Nama Rincian Output",
			render: (item) => {
				const isPn = item.anomalyResult?.isPriorityNational;
				return (
					<div>
						<div className="flex items-center gap-1.5">
							<span className="font-mono font-bold text-slate-900 dark:text-slate-100">
								{item.roCode}
							</span>
							{isPn && (
								<span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-900 dark:text-amber-200 uppercase border border-amber-500/30">
									PN
								</span>
							)}
						</div>
						<p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-1 font-medium">
							{item.roName ||
								`Rincian Output Bulan ${MONTH_NAMES[item.month - 1]}`}
						</p>
					</div>
				);
			},
		},
		{
			key: "assessmentStatus",
			header: "Objek Penilaian",
			render: (item) => {
				const isExcluded = item.eligibility?.assessmentStatus === "excluded";
				if (isExcluded) {
					return (
						<div className="flex flex-col items-start gap-0.5">
							<span className="inline-flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold text-purple-900 dark:text-purple-200 uppercase">
								<ShieldAlert className="size-3" />
								<span>Dikecualikan</span>
							</span>
							<span className="text-[10px] text-purple-800 dark:text-purple-300 font-semibold">
								RO Khusus
							</span>
						</div>
					);
				}
				return (
					<span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-900 dark:text-emerald-200 uppercase">
						<ShieldCheck className="size-3" />
						<span>Dinilai</span>
					</span>
				);
			},
		},
		{
			key: "targetVsRealisasi",
			header: "Volume (RVRO / Target)",
			render: (item) => (
				<div>
					<span className="font-semibold text-slate-900 dark:text-slate-100">
						{formatDynamicNumber(item.rvro, 0)} /{" "}
						{formatDynamicNumber(item.volumeDipa, 0)}
					</span>
					{item.rvroIncremental && (
						<span className="text-[10px] text-slate-600 dark:text-slate-400 block font-medium">
							+ {item.rvroIncremental} bln ini
						</span>
					)}
				</div>
			),
		},
		{
			key: "pcroVsTpcro",
			header: "Progres Fisik (PCRO / Target)",
			render: (item) => (
				<div>
					<span className="font-semibold text-slate-900 dark:text-slate-100">
						{formatDynamicPercent(item.pcro)}
					</span>
					<span className="text-[10px] text-slate-600 dark:text-slate-400 block font-medium">
						Target: {formatDynamicPercent(item.tpcro)}
					</span>
				</div>
			),
		},
		{
			key: "ppa",
			header: "PPA Realisasi Anggaran",
			render: (item) => {
				const ppaVal = item.ppaMonthly ?? 0;
				const hasAnomaly = item.anomalyResult?.hasAnomaly;
				return (
					<div>
						<span className="font-semibold text-slate-900 dark:text-slate-100">
							{formatDynamicPercent(ppaVal)}
						</span>
						{hasAnomaly && (
							<div
								className="flex items-center gap-1 text-[10px] font-bold text-rose-800 dark:text-rose-300 mt-0.5"
								title={item.anomalyResult?.message}
							>
								<AlertTriangle className="size-3 shrink-0" />
								<span>Gap {item.anomalyResult?.gap.toFixed(1)}%</span>
							</div>
						)}
					</div>
				);
			},
		},
		{
			key: "validationStatus",
			header: "Validasi Engine (Rules 00–08)",
			render: (item) => {
				const results = item.validationResults || [];
				const blocking = results.find((r) => r.status === "blocking");
				const confirmReq = results.find(
					(r) => r.status === "confirmation_required",
				);
				const correctable = results.find((r) => r.status === "correctable");

				if (blocking) {
					return (
						<span
							className="inline-flex items-center gap-1 rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-900 dark:text-rose-200 border border-rose-500/30"
							title={blocking.message}
						>
							<AlertCircle className="size-3" />
							<span>{blocking.ruleCode} (Blocking)</span>
						</span>
					);
				}
				if (confirmReq) {
					return (
						<span
							className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 dark:text-amber-200 border border-amber-500/30"
							title={confirmReq.message}
						>
							<AlertTriangle className="size-3" />
							<span>{confirmReq.ruleCode} (Konfirmasi)</span>
						</span>
					);
				}
				if (correctable) {
					return (
						<span
							className="inline-flex items-center gap-1 rounded bg-slate-500/15 px-1.5 py-0.5 text-[10px] font-bold text-slate-900 dark:text-slate-200 border border-slate-500/30"
							title={correctable.message}
						>
							<Info className="size-3" />
							<span>{correctable.ruleCode} (Koreksi)</span>
						</span>
					);
				}
				return (
					<span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-900 dark:text-emerald-200 border border-emerald-500/30">
						<CheckCircle2 className="size-3" />
						<span>Valid</span>
					</span>
				);
			},
		},
		{
			key: "timeliness",
			header: "Ketepatan Waktu",
			render: (item) => {
				const isExcluded = item.eligibility?.assessmentStatus === "excluded";
				if (isExcluded)
					return (
						<span className="text-slate-500 dark:text-slate-400 font-mono">
							—
						</span>
					);
				if (!item.reportedAt) {
					return (
						<span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:text-amber-200 border border-amber-500/25">
							Belum Lapor
						</span>
					);
				}
				const rDate = new Date(item.reportedAt).toISOString().slice(0, 10);
				const dDate = item.deadlineDate || canonicalDeadline;
				const isTimely = rDate <= dDate;
				return (
					<div>
						<span
							className={`rounded px-1.5 py-0.5 text-[10px] font-bold border ${
								isTimely
									? "bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 border-emerald-500/30"
									: "bg-rose-500/15 text-rose-900 dark:text-rose-200 border-rose-500/30"
							}`}
						>
							{isTimely ? "Tepat (100)" : "Terlambat (0)"}
						</span>
						<p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
							{formatDateDDMMYYYY(item.reportedAt)}
						</p>
					</div>
				);
			},
		},
		{
			key: "status",
			header: "Status Siklus",
			render: (item) => {
				const isConfirmed = item.confirmed || item.status === "confirmed";
				const isSubmitted = item.status === "submitted";
				return (
					<span
						className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
							isConfirmed
								? "bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 border border-emerald-500/30"
								: isSubmitted
									? "bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-slate-100 border border-slate-400"
									: "bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-500/30"
						}`}
					>
						{isConfirmed
							? "Terkonfirmasi PPK"
							: isSubmitted
								? "Terkirim"
								: "Draft"}
					</span>
				);
			},
		},
		{
			key: "actions",
			header: "Aksi (Simulasi)",
			render: (item) => (
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={() => handleOpenCreateRealisasi(item)}
						className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-bold text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
					>
						<Edit className="size-3 text-slate-700 dark:text-slate-300" />
						<span>Edit</span>
					</button>
					<button
						type="button"
						onClick={() => handleOpenFairnessModal(item)}
						className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
						title="Simulasikan Pengecualian Fairness"
					>
						<Scale className="size-3 text-purple-700 dark:text-purple-300" />
					</button>
					<button
						type="button"
						onClick={() => {
							setSimOutputs((prev) => prev.filter((o) => o.id !== item.id));
							setActionMessage(
								`[🧪 Sandbox] RO ${item.roCode} dihapus dari simulasi lokal.`,
							);
							setTimeout(() => setActionMessage(null), 3000);
						}}
						className="inline-flex items-center rounded-lg p-1 text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 transition"
						title="Hapus dari simulasi lokal"
					>
						<Trash2 className="size-3.5" />
					</button>
				</div>
			),
		},
	];

	const targetColumns: ColumnDef<OutputTargetPlanRecord>[] = [
		{
			key: "ro",
			header: "Kode RO",
			render: (plan) => (
				<div>
					<div className="flex items-center gap-1.5">
						<span className="font-mono font-bold text-slate-950 dark:text-slate-50">
							{plan.roCode}
						</span>
						{plan.isPriorityNational && (
							<span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-950 dark:text-amber-100 uppercase border border-amber-500/30">
								PN
							</span>
						)}
					</div>
					<p className="text-[11px] text-slate-800 dark:text-slate-200 line-clamp-1 font-semibold">
						{plan.roName || "—"}
					</p>
				</div>
			),
		},
		{
			key: "volume",
			header: "Volume DIPA & Satuan",
			render: (plan) => (
				<span className="font-bold text-slate-950 dark:text-slate-50">
					{formatDynamicNumber(plan.volumeDipa, 0)} {plan.unit || "Layanan"}
				</span>
			),
		},
		{
			key: "version",
			header: "Versi",
			render: (plan) => (
				<div>
					<span className="font-bold text-slate-950 dark:text-slate-50">
						Versi {plan.version}
					</span>
					<span className="text-[10px] text-slate-800 dark:text-slate-200 block font-semibold">
						{plan.quarter ? `TW ${plan.quarter}` : "Awal Tahun"}
					</span>
				</div>
			),
		},
		{
			key: "status",
			header: "Status Rencana",
			render: (plan) => (
				<span
					className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
						plan.status === "active"
							? "bg-emerald-500/20 text-emerald-950 dark:text-emerald-100 border border-emerald-500/40"
							: "bg-slate-300 dark:bg-slate-700 text-slate-950 dark:text-slate-50 border border-slate-400 font-bold"
					}`}
				>
					{plan.status === "active" ? "Aktif" : "Draft"}
				</span>
			),
		},
		{
			key: "actions",
			header: "Aksi (Simulasi)",
			render: (plan) => (
				<div className="flex items-center gap-1.5">
					<button
						type="button"
						onClick={() => handleOpenCreateTarget(plan)}
						className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] font-bold text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
					>
						<Edit className="size-3 text-slate-700 dark:text-slate-300" />
						<span>Mutakhirkan</span>
					</button>
				</div>
			),
		},
	];

	return (
		<OperatorShell currentPath="/operator/data/output-achievement">
			<div className="space-y-6">
				{/* Top Summary Banner */}
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div className="flex items-center gap-3.5">
						<div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
							<Target className="size-6" />
						</div>
						<div>
							<div className="flex items-center gap-2">
								<h1 className="text-lg font-bold text-foreground sm:text-xl">
									Capaian Output Satker (Bobot IKPA 25%)
								</h1>
								<span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
									25 Poin
								</span>
							</div>
							<p className="text-xs text-muted-foreground mt-0.5">
								Formula Resmi PER-5:{" "}
								<strong className="text-foreground">
									IKPA-CO = (NK-ROKW × 30%) + (NK-CRO × 70%)
								</strong>
								. Fokus Kepatuhan Batas Waktu Pelaporan (HK-7), Dispensasi KPPN,
								dan Edukasi Regulasi.
							</p>
						</div>
					</div>
				</div>

				{/* 3 Refactored Navigation Tabs */}
				<div className="flex flex-wrap items-center gap-2 border-b border-border pb-2 text-xs relative">
					{/* Tab 1: Jadwal & Kepatuhan */}
					<button
						type="button"
						onClick={() => {
							setMainTab("jadwal");
							setIsSimDropdownOpen(false);
						}}
						className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-semibold transition ${
							mainTab === "jadwal"
								? "bg-primary text-primary-foreground shadow-xs"
								: "text-muted-foreground hover:text-foreground hover:bg-surface-muted"
						}`}
					>
						<Calendar className="size-3.5" />
						<span>Jadwal & Kepatuhan</span>
					</button>

					{/* Tab 2: Panduan PER-5 */}
					<button
						type="button"
						onClick={() => {
							setMainTab("panduan");
							setIsSimDropdownOpen(false);
						}}
						className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-semibold transition ${
							mainTab === "panduan"
								? "bg-primary text-primary-foreground shadow-xs"
								: "text-muted-foreground hover:text-foreground hover:bg-surface-muted"
						}`}
					>
						<BookOpen className="size-3.5" />
						<span>Panduan PER-5</span>
					</button>

					{/* Tab 3: Fitur Simulasi Dropdown (Preview Group) */}
					<div className="relative">
						<button
							type="button"
							onClick={() => setIsSimDropdownOpen((prev) => !prev)}
							className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-semibold transition ${
								mainTab === "simulasi"
									? "bg-slate-800 text-slate-100 dark:bg-slate-700 dark:text-white shadow-xs border border-slate-600"
									: "text-muted-foreground hover:text-foreground hover:bg-surface-muted border border-transparent"
							}`}
						>
							<FlaskConical className="size-3.5 text-slate-400" />
							<span>Fitur Simulasi (Preview)</span>
							<ChevronDown className="size-3.5 ml-0.5 text-slate-400" />
						</button>

						{isSimDropdownOpen && (
							<div className="absolute left-0 top-full mt-1.5 z-40 w-64 rounded-xl border border-border bg-surface p-1.5 shadow-xl space-y-1">
								<button
									type="button"
									onClick={() => {
										setMainTab("simulasi");
										setSimSubTab("target");
										setIsSimDropdownOpen(false);
									}}
									className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition text-left ${
										mainTab === "simulasi" && simSubTab === "target"
											? "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
											: "text-foreground hover:bg-surface-muted"
									}`}
								>
									<div className="flex items-center gap-2">
										<Target className="size-3.5 text-slate-600 dark:text-slate-400" />
										<span>Simulasi Target 12 Bulan</span>
									</div>
									<span className="rounded bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 text-[9px] font-bold text-slate-700 dark:text-slate-300">
										Preview
									</span>
								</button>

								<button
									type="button"
									onClick={() => {
										setMainTab("simulasi");
										setSimSubTab("realisasi");
										setIsSimDropdownOpen(false);
									}}
									className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition text-left ${
										mainTab === "simulasi" && simSubTab === "realisasi"
											? "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
											: "text-foreground hover:bg-surface-muted"
									}`}
								>
									<div className="flex items-center gap-2">
										<TrendingUp className="size-3.5 text-slate-600 dark:text-slate-400" />
										<span>Simulasi Realisasi Bulanan</span>
									</div>
									<span className="rounded bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 text-[9px] font-bold text-slate-700 dark:text-slate-300">
										Preview
									</span>
								</button>

								<button
									type="button"
									onClick={() => {
										setMainTab("simulasi");
										setSimSubTab("fairness");
										setIsSimDropdownOpen(false);
									}}
									className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition text-left ${
										mainTab === "simulasi" && simSubTab === "fairness"
											? "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
											: "text-foreground hover:bg-surface-muted"
									}`}
								>
									<div className="flex items-center gap-2">
										<Scale className="size-3.5 text-slate-600 dark:text-slate-400" />
										<span>Simulasi Fairness Treatment</span>
									</div>
									<span className="rounded bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 text-[9px] font-bold text-slate-700 dark:text-slate-300">
										Preview
									</span>
								</button>
							</div>
						)}
					</div>
				</div>

				{actionMessage && (
					<div className="flex items-center gap-2.5 rounded-xl border border-success/30 bg-success/10 p-4 text-xs font-semibold text-success shadow-xs">
						<CheckCircle2 className="size-4 shrink-0" />
						<p>{actionMessage}</p>
					</div>
				)}

				{/* TAB 1: JADWAL & KEPATUHAN (ACTIVE / DEFAULT) */}
				{mainTab === "jadwal" && (
					<div className="space-y-6">
						{/* Month Selector Bar */}
						<div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-background p-2 text-xs">
							<div className="flex flex-wrap items-center gap-1">
								{MONTH_NAMES.map((name, idx) => (
									<button
										key={name}
										type="button"
										onClick={() => setSelectedMonth(idx + 1)}
										className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
											idx + 1 === selectedMonth
												? "bg-primary text-primary-foreground shadow-xs"
												: "text-muted-foreground hover:text-foreground hover:bg-surface-muted"
										}`}
									>
										{name}
									</button>
								))}
							</div>
							<div className="text-[11px] text-muted-foreground px-2">
								Tahun Anggaran <strong className="text-foreground">2026</strong>
							</div>
						</div>

						{/* 4 Cards Header Controls (Dual-Source Input Action Bar) */}
						<div className="flex flex-wrap items-center justify-between gap-2">
							<div className="flex items-center gap-2">
								<span className="text-xs font-bold text-foreground">
									Status Penilaian Capaian Output
								</span>
								{displayedScores.isManual ? (
									<span
										className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
											displayedScores.source === "myintress_actual"
												? "bg-primary/10 text-primary border border-primary/20"
												: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
										}`}
									>
										<Sparkles className="size-3" />
										<span>
											{displayedScores.source === "myintress_actual"
												? "Data Aktual MyIntress"
												: "Simulasi What-If"}
										</span>
									</span>
								) : (
									<span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground border border-border">
										Data Terkalkulasi Sistem
									</span>
								)}
							</div>

							<div className="flex items-center gap-2">
								{displayedScores.isManual && (
									<button
										type="button"
										onClick={handleResetMacroScore}
										className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface-muted transition"
										title="Reset ke data database sistem"
									>
										<RotateCcw className="size-3" />
										<span>Reset</span>
									</button>
								)}
								<button
									type="button"
									onClick={() => {
										if (macroSavedData) {
											setMacroMode(macroSavedData.source);
											setMacroNkkw(macroSavedData.nkkw.toString());
											setMacroNkcro(macroSavedData.nkcro.toString());
											if (macroSavedData.roEligible) {
												setMacroRoEligible(
													macroSavedData.roEligible.toString(),
												);
											}
										}
										setIsMacroModalOpen(true);
									}}
									className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition shadow-xs"
								>
									<Edit className="size-3.5" />
									<span>Input Capaian Terakhir</span>
								</button>
							</div>
						</div>

						{/* 5 Cards Scoring Strip */}
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
							{/* Card 1: RO Objek Penilaian */}
							<div className="rounded-xl border border-border bg-background p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
								<div className="flex items-center justify-between text-muted-foreground">
									<span className="text-xs font-semibold">
										RO Objek Penilaian
									</span>
									<Target className="size-4 text-primary" />
								</div>
								<div className="space-y-0.5">
									<p className="text-2xl font-bold text-foreground sm:text-3xl">
										{displayedScores.roLabel}
									</p>
									<p className="text-[11px] text-muted-foreground">
										{displayedScores.roSub}
									</p>
								</div>
							</div>

							{/* Card 2: Ketepatan Waktu (NK-ROKW 30%) */}
							<div className="rounded-xl border border-border bg-background p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
								<div className="flex items-center justify-between text-muted-foreground">
									<span className="text-xs font-semibold">
										Ketepatan Waktu (30%)
									</span>
									<Clock className="size-4 text-warning" />
								</div>
								<div className="space-y-0.5">
									<div className="flex items-baseline gap-1">
										<p className="text-2xl font-bold text-foreground sm:text-3xl">
											{displayedScores.nkkw}
										</p>
										<span className="text-xs text-muted-foreground">/ 100</span>
									</div>
									<p className="text-[11px] text-muted-foreground">
										{displayedScores.nkkwSub}
									</p>
								</div>
							</div>

							{/* Card 3: Capaian RO (NK-CRO 70%) */}
							<div className="rounded-xl border border-border bg-background p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
								<div className="flex items-center justify-between text-muted-foreground">
									<span className="text-xs font-semibold">
										Capaian RO (70%)
									</span>
									<Percent className="size-4 text-success" />
								</div>
								<div className="space-y-0.5">
									<div className="flex items-baseline gap-1">
										<p className="text-2xl font-bold text-foreground sm:text-3xl">
											{displayedScores.nkcro}
										</p>
										<span className="text-xs text-muted-foreground">/ 100</span>
									</div>
									<p className="text-[11px] text-muted-foreground">
										{displayedScores.nkcroSub}
									</p>
								</div>
							</div>

							{/* Card 4 (2 paling kanan): Nilai IKPA Capaian Output */}
							<div className="rounded-xl border border-primary/20 bg-background p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
								<div className="flex items-center justify-between text-muted-foreground">
									<span className="text-xs font-semibold">
										Nilai IKPA Capaian Output
									</span>
									<ShieldCheck className="size-4 text-primary" />
								</div>
								<div className="space-y-0.5">
									<p className="text-2xl font-extrabold text-primary sm:text-3xl">
										{displayedScores.finalScore !== "—"
											? Math.min(
													100,
													Math.max(0, Number(displayedScores.finalScore)),
												).toFixed(2)
											: "—"}
									</p>
									<p className="text-[11px] text-muted-foreground">
										(30% × NK-ROKW) + (70% × NK-CRO)
									</p>
								</div>
							</div>

							{/* Card 5 (paling kanan): Nilai Akhir (25%) */}
							<div className="rounded-xl border border-success/20 bg-success/5 p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
								<div className="flex items-center justify-between text-muted-foreground">
									<span className="text-xs font-semibold">
										Nilai Akhir (25%)
									</span>
									<Sparkles className="size-4 text-success" />
								</div>
								<div className="space-y-0.5">
									<p className="text-2xl font-extrabold text-success sm:text-3xl">
										{displayedScores.finalScore !== "—"
											? `${(Math.min(100, Math.max(0, Number(displayedScores.finalScore))) * 0.25).toFixed(2)} pts`
											: displayedScores.weightedContribution !== "—"
												? `${Math.min(25, Math.max(0, Number(displayedScores.weightedContribution))).toFixed(2)} pts`
												: "—"}
									</p>
									<p className="text-[11px] text-muted-foreground">
										Bobot 25% terhadap total IKPA
									</p>
								</div>
							</div>
						</div>

						{/* Open Periode Reminder & Guidance Banner */}
						<div className="rounded-2xl border border-border bg-background p-4 sm:p-5 shadow-xs space-y-3">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div className="flex items-center gap-3">
									<div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
										<Clock className="size-5" />
									</div>
									<div>
										<div className="flex items-center gap-2">
											<p className="text-xs sm:text-sm font-bold text-foreground">
												Open Periode Realisasi Bulan{" "}
												{MONTH_NAMES[selectedMonth - 1]}:{" "}
												<span className="text-primary underline">
													{formatDateDDMMYYYY(canonicalDeadline)}
												</span>{" "}
												<span className="text-xs font-semibold text-muted-foreground">
													({selectedMonth <= 3
														? "Relaksasi s.d. 30 April"
														: "Hari Kerja ke-7 M+1"})
												</span>
											</p>
											<span
												className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
													currentMonthOpenPeriod.status === "open_auto"
														? "bg-success/10 text-success border border-success/20"
														: currentMonthOpenPeriod.status ===
																  "open_additional"
															? "bg-warning/10 text-warning border border-warning/20"
															: currentMonthOpenPeriod.status === "scheduled"
																? "bg-primary/10 text-primary border border-primary/20"
																: "bg-surface-muted text-muted-foreground border border-border"
												}`}
											>
												{currentMonthOpenPeriod.status === "open_auto"
													? "🟢 Sistem Terbuka Otomatis"
													: currentMonthOpenPeriod.status === "open_additional"
														? "🟡 Periode Tambahan KPPN"
														: currentMonthOpenPeriod.status === "scheduled"
															? "⚪ Terjadwal (Buka HK-1 M+1)"
															: "🔴 Ditutup (Lewat HK-7)"}
											</span>
										</div>
										<p className="text-[11px] text-muted-foreground pt-0.5">
											{currentMonthOpenPeriod.notes} • Periode Tambahan KPPN s.d.{" "}
											<strong className="text-foreground">
												{formatDateDDMMYYYY(
													currentMonthOpenPeriod.additionalDeadline,
												)}
											</strong>
										</p>
									</div>
								</div>

								<div className="flex flex-wrap items-center gap-2">
									<button
										type="button"
										onClick={() => setIsOpenPeriodMatrixOpen((prev) => !prev)}
										className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-surface-muted shadow-xs"
									>
										<Calendar className="size-3.5 text-primary" />
										<span>
											{isOpenPeriodMatrixOpen
												? "Tutup Jadwal 12 Bulan"
												: "Jadwal 12 Bulan Open Periode"}
										</span>
									</button>
								</div>
							</div>

							{/* Period Rules 2-Box */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-border/60 text-xs">
								<div className="rounded-xl border border-success/20 bg-success/5 p-3 space-y-1.5 flex flex-col justify-between">
									<div className="space-y-1">
										<p className="font-bold text-success flex items-center gap-1.5">
											<span className="flex size-4 items-center justify-center rounded-full bg-success text-success-foreground text-[10px] font-bold">
												a
											</span>
											Open Periode Reguler (Sistem Terbuka Otomatis)
										</p>
										<p className="text-[11px] text-muted-foreground leading-relaxed">
											Sistem Terbuka Otomatis untuk <strong>Pengisian Realisasi Kinerja Capaian Output</strong> mulai Hari Kerja pertama (HK-1) awal bulan berikutnya s.d.{" "}
											<strong>Hari Kerja ke-7 (HK-7)</strong> bulan berikutnya (M+1). Seluruh satker dapat mengisi dan melaporkan data realisasi tanpa syarat dispensasi.
										</p>
									</div>
									<p className="text-[10px] text-muted-foreground pt-1">
										Jadwal Pelaporan Bulan {MONTH_NAMES[selectedMonth - 1]}:{" "}
										<strong className="text-foreground">
											{formatDateDDMMYYYY(canonicalDeadline)}
										</strong>
									</p>
								</div>
								<div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-1.5 flex flex-col justify-between">
									<div className="space-y-1">
										<div className="flex items-center justify-between">
											<p className="font-bold text-primary flex items-center gap-1.5">
												Pemutakhiran Target Triwulanan (10 HK Awal TW)
											</p>
											<span
												className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
													currentQuarterWindow?.status === "open"
														? "bg-success/10 text-success border border-success/20"
														: currentQuarterWindow?.status === "scheduled"
															? "bg-primary/10 text-primary border border-primary/20"
															: "bg-surface-muted text-muted-foreground border border-border"
												}`}
											>
												{currentQuarterWindow?.status === "open"
													? "Terbuka"
													: currentQuarterWindow?.status === "scheduled"
														? "Terjadwal"
														: "Ditutup"}
											</span>
										</div>
										<p className="text-[11px] text-muted-foreground leading-relaxed">
											{currentQuarterWindow
												? `${currentQuarterWindow.name}: ${currentQuarterWindow.periodText} (${currentQuarterWindow.notes})`
												: "Pemutakhiran target proyeksi 12 bulan dilakukan 10 hari kerja di awal triwulan."}
										</p>
									</div>
									<div className="flex flex-wrap items-center justify-between gap-1 pt-1 text-[10px] text-muted-foreground">
										<span>
											Jadwal Terkini TA {initialData.year}:{" "}
											<strong className="text-foreground">
												{upcomingScheduledWindow
													? `${upcomingScheduledWindow.label} (${upcomingScheduledWindow.periodText})`
													: "Selesai"}
											</strong>
										</span>
										<a
											href="/operator/reminders"
											className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-semibold"
										>
											<Bell className="size-3" />
											<span>Reminder Center</span>
										</a>
									</div>
								</div>
							</div>

							{/* Status counters */}
							<div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
								<div className="flex items-center gap-2">
									<span className="rounded-full bg-success/10 px-2.5 py-0.5 font-semibold text-success">
										{timelyCount} RO Tepat Waktu
									</span>
									{lateCount > 0 && (
										<span className="rounded-full bg-danger/10 px-2.5 py-0.5 font-semibold text-danger">
											{lateCount} RO Terlambat
										</span>
									)}
									{pendingTimelinessCount > 0 && (
										<span className="rounded-full bg-warning/10 px-2.5 py-0.5 font-semibold text-warning">
											{pendingTimelinessCount} RO Belum Dilaporkan
										</span>
									)}
								</div>
								{additionalSubmittedMonths.includes(selectedMonth) && (
									<span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
										<CheckCircle2 className="size-3" />
										Permohonan Periode Tambahan Bulan{" "}
										{MONTH_NAMES[selectedMonth - 1]} Telah Terkirim ke KPPN
									</span>
								)}
							</div>
						</div>

						{/* 12-Month Open Periode Matrix Dropdown Panel */}
						{isOpenPeriodMatrixOpen && (
							<div className="rounded-2xl border border-primary/20 bg-surface p-4 shadow-sm space-y-3">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<Calendar className="size-4.5 text-primary" />
										<h4 className="text-xs sm:text-sm font-bold text-foreground">
											Jadwal Batas Akhir Periode Pengisian Realisasi Kinerja (TA {initialData.year})
										</h4>
									</div>
									<button
										type="button"
										onClick={() => setIsOpenPeriodMatrixOpen(false)}
										className="rounded-lg p-1 text-muted-foreground hover:bg-surface-muted text-xs"
									>
										<X className="size-4" />
									</button>
								</div>

								<div className="overflow-x-auto rounded-xl border border-border">
									<table className="w-full text-left text-xs">
										<thead>
											<tr className="border-b border-border bg-surface-muted/60 font-semibold text-muted-foreground">
												<th className="py-2.5 pl-3 pr-2 w-10 text-center">
													No.
												</th>
												<th className="px-3 py-2.5 font-bold text-foreground">
													Periode Pelaporan Data Realisasi
												</th>
												<th className="px-3 py-2.5">
													Batas Akhir Open Periode
												</th>
												<th className="px-3 py-2.5 text-center">
													Status Akses
												</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-border/60">
											{realizationOpenPeriodsList.map((item, idx) => (
												<tr
													key={item.month}
													className={`transition hover:bg-surface-muted/50 ${
														item.month === selectedMonth
															? "bg-primary/5 font-medium"
															: ""
													}`}
												>
													<td className="py-2.5 pl-3 pr-2 text-center text-muted-foreground">
														{idx + 1}
													</td>
													<td className="px-3 py-2.5">
														<span className="font-bold text-foreground">
															{item.name}
														</span>
														{item.month === selectedMonth && (
															<span className="ml-2 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
																Bulan Aktif
															</span>
														)}
													</td>
													<td className="px-3 py-2.5 font-semibold text-primary">
														{formatDateDDMMYYYY(item.regulerDeadline)}
														<span className="text-[10px] text-muted-foreground block font-normal">
															{item.openRange}
														</span>
													</td>
													<td className="px-3 py-2.5 text-center">
														<span
															className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
																item.status === "open_auto"
																	? "bg-success/10 text-success border border-success/20"
																	: item.status === "open_additional"
																		? "bg-warning/10 text-warning border border-warning/20"
																		: item.status === "scheduled"
																			? "bg-primary/10 text-primary border border-primary/20"
																			: "bg-surface-muted text-muted-foreground border border-border"
															}`}
														>
															{item.status === "open_auto"
																? "🟢 Sistem Terbuka Otomatis"
																: item.status === "open_additional"
																	? "🟡 Periode Tambahan KPPN"
																	: item.status === "scheduled"
																		? "⚪ Terjadwal (Buka HK-1 M+1)"
																		: "🔴 Ditutup (Lewat HK-7)"}
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
				)}

				{/* TAB 2: PANDUAN PER-5 (ACTIVE DEDICATED VIEW) */}
				{mainTab === "panduan" && (
					<div className="space-y-6">
						<div className="rounded-2xl border border-border bg-background p-5 shadow-xs space-y-4">
							<div className="flex items-center gap-3 border-b border-border pb-3">
								<div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
									<BookOpen className="size-5" />
								</div>
								<div>
									<h2 className="text-base font-bold text-foreground">
										Panduan Resmi Regulasi Capaian Output (PER-5/PB/2024)
									</h2>
									<p className="text-xs text-muted-foreground">
										Tata cara penilaian, periodisasi pelaporan, formula
										matematis, dan 8 kriteria validasi kualitas data.
									</p>
								</div>
							</div>

							<div className="space-y-4 text-xs">
								{/* Section 1 */}
								<div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-1.5">
									<p className="font-bold text-primary text-sm">
										1. Bobot IKPA 25% dan Formula Akhir
									</p>
									<p className="text-foreground leading-relaxed">
										Indikator Capaian Output memiliki bobot 25% dalam evaluasi
										IKPA TA 2026. Nilai akhir dihitung secara proporsional dari
										dua sub-komponen:
									</p>
									<code className="block rounded-lg bg-background p-3 font-mono font-bold text-primary text-center text-sm border border-primary/20">
										IKPA-CO = (NK-ROKW × 30%) + (NK-CRO × 70%)
									</code>
									<p className="text-[11px] text-muted-foreground">
										• <strong>NK-ROKW (30%)</strong>: Nilai Kinerja Ketepatan
										Waktu Pelaporan RO (100 jika lapor tepat waktu, 0 jika
										terlambat).
										<br />• <strong>NK-CRO (70%)</strong>: Nilai Kinerja Capaian
										Rincian Output berdasarkan perbandingan realisasi volume
										atau progres fisik.
									</p>
								</div>

								{/* Section 2 */}
								<div className="rounded-xl border border-border bg-surface p-4 space-y-1.5">
									<p className="font-bold text-foreground text-sm">
										2. Periodisasi Pengisian Data (Open Period)
									</p>
									<ul className="list-disc pl-4 space-y-1.5 text-muted-foreground leading-relaxed">
										<li>
											<strong className="text-foreground">
												Open Period Reguler:
											</strong>{" "}
											Sejak awal bulan berikutnya sampai dengan{" "}
											<strong>Hari Kerja ke-7 (HK-7)</strong> bulan berikutnya.
											Sistem terbuka secara otomatis tanpa dispensasi.
										</li>
										<li>
											<strong className="text-foreground">
												Periode Pelaporan Tambahan KPPN:
											</strong>{" "}
											Setelah HK-7 sampai dengan{" "}
											<strong>akhir bulan berikutnya</strong> sepanjang telah
											dibuka periode tambahan oleh Admin KPPN pada kejadian
											khusus.
										</li>
										<li>
											<strong className="text-foreground">
												Relaksasi TW I 2026:
											</strong>{" "}
											Pelaporan periode Januari, Februari, dan Maret dibuka
											sampai dengan <strong>30 April 2026</strong>.
										</li>
									</ul>
								</div>

								{/* Section 3 */}
								<div className="rounded-xl border border-border bg-surface p-4 space-y-1.5">
									<p className="font-bold text-foreground text-sm">
										3. Formula Perhitungan NK-CRO (Formula 1 vs Formula 2)
									</p>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
										<div className="rounded-lg border border-border bg-background p-3 space-y-1.5">
											<span className="font-bold text-foreground">
												Formula 1 (Jan–Nov & PCRO &lt; 100%)
											</span>
											<code className="block rounded bg-surface p-2 font-mono text-primary font-bold text-center">
												(PCRO/ TPCRO) x 100%
											</code>
											<div className="text-[11px] text-muted-foreground space-y-1 pt-1 leading-relaxed">
												<p>
													• <strong>TPCRO (Target Progres Capaian Rincian Output)</strong>: Target persentase kemajuan pelaksanaan suatu RO yang diproyeksikan tercapai setiap bulannya.
												</p>
												<p>
													• <strong>TRVRO (Target Realisasi Volume Rincian Output)</strong>: Target jumlah atau volume fisik dari suatu RO yang direncanakan akan direalisasikan pada bulan tertentu.
												</p>
											</div>
										</div>
										<div className="rounded-lg border border-border bg-background p-3 space-y-1.5">
											<span className="font-bold text-foreground">
												Formula 2 (Desember atau PCRO = 100%)
											</span>
											<code className="block rounded bg-surface p-2 font-mono text-primary font-bold text-center">
												(RVRO/ TRVRO) x 100%
											</code>
											<div className="text-[11px] text-muted-foreground space-y-1 pt-1 leading-relaxed">
												<p>
													• <strong>PCRO (Progres Capaian Rincian Output)</strong>: Persentase yang menunjukkan tingkat penyelesaian dari aktivitas RO yang sedang berjalan.
												</p>
												<p>
													• <strong>RVRO (Realisasi Volume Rincian Output)</strong>: Jumlah atau volume fisik dari RO yang telah tercapai dalam periode pelaporan.
												</p>
											</div>
										</div>
									</div>
								</div>

								{/* Section 4: 8 Rules */}
								<div className="rounded-xl border border-border bg-surface p-4 space-y-2.5">
									<div className="flex items-center justify-between">
										<p className="font-bold text-foreground text-sm">
											4. 8 Variabel Kualitas Validasi Data
										</p>
										<span className="text-[10px] font-medium text-muted-foreground bg-surface-muted px-2 py-0.5 rounded-md border border-border">
											Engine Rules 01–08
										</span>
									</div>
									<p className="text-[11px] text-muted-foreground">
										Mesin validasi otomatis mendeteksi anomali pengisian data
										capaian output berdasarkan kriteria kepatuhan dan kewajaran:
									</p>
									<div className="space-y-1.5 pt-1">
										{[
											{
												code: "01",
												rule: "% Realisasi Anggaran > 0% namun PCRO 0%",
												status: "Wajib Diperbaiki",
												type: "danger",
											},
											{
												code: "02",
												rule: "PCRO < % Realisasi Anggaran",
												status: "Wajib Konfirmasi, Bisa Diperbaiki",
												type: "warning",
											},
											{
												code: "03",
												rule: "PCRO 100% namun RVRO 0",
												status: "Wajib Diperbaiki",
												type: "danger",
											},
											{
												code: "04",
												rule: "PCRO 100% namun RVRO < Target/Volume RO pada DIPA",
												status: "Wajib Diperbaiki",
												type: "danger",
											},
											{
												code: "05",
												rule: "Terdapat RVRO yang dilaporkan namun Realisasi Anggaran masih 0",
												status: "Wajib Konfirmasi, Bisa Diperbaiki",
												type: "warning",
											},
											{
												code: "06",
												rule: "RVRO diisi menggunakan desimal sedangkan Satuan tidak memungkinkan",
												status: "Wajib Diperbaiki",
												type: "danger",
											},
											{
												code: "07",
												rule: "RVRO > Target/Volume RO pada DIPA",
												status: "Wajib Konfirmasi, Bisa Diperbaiki",
												type: "warning",
											},
											{
												code: "08",
												rule: "RVRO >= Target/Volume RO pada DIPA, namun PCRO < 100%",
												status: "Wajib Konfirmasi, Bisa Diperbaiki",
												type: "warning",
											},
										].map((item) => (
											<div
												key={item.code}
												className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-background border border-border/80 text-[11px]"
											>
												<div className="flex items-start gap-2 min-w-0">
													<span className="font-mono font-bold text-primary shrink-0">
														{item.code}
													</span>
													<span className="text-foreground font-medium break-words">
														{item.rule}
													</span>
												</div>
												<span
													className={`self-start sm:self-auto shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-md border whitespace-normal ${
														item.type === "danger"
															? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
															: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
													}`}
												>
													{item.status}
												</span>
											</div>
										))}
									</div>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* TAB 3: FITUR SIMULASI (PREVIEW - GRAYSCALE / SLATE HIGH CONTRAST THEME) */}
				{mainTab === "simulasi" && (
					<div className="space-y-6">
						{/* Preview Mode Alert Banner */}
						<div className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-900/80 p-4 sm:p-5 shadow-xs space-y-3">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div className="flex items-start gap-3">
									<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
										<FlaskConical className="size-5" />
									</div>
									<div className="space-y-1">
										<div className="flex items-center gap-2">
											<h3 className="text-sm sm:text-base font-bold text-slate-950 dark:text-slate-50">
												🧪 Mode Simulasi (Feature Preview) · Sandbox Interaktif
											</h3>
											<span className="rounded-full bg-slate-300 dark:bg-slate-800 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-slate-900 dark:text-slate-100 border border-slate-400 dark:border-slate-600">
												Preview
											</span>
										</div>
										<p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
											Fitur kalkulator dan simulasi per-RO ini berjalan dalam
											mode <strong className="font-bold">sandbox interaktif</strong>.
											Anda dapat melihat, menguji coba kalkulasi rumus, dan
											mengotak-atik parameter secara bebas di layar tanpa
											mengubah data database produksi.
										</p>
									</div>
								</div>

								<div className="flex items-center gap-2">
									<button
										type="button"
										onClick={() => setMainTab("panduan")}
										className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition shadow-2xs"
									>
										<BookOpen className="size-3.5" />
										<span>Panduan PER-5</span>
									</button>
								</div>
							</div>

							{/* Sub-tab Navigation inside Simulation (Grayscale themed) */}
							<div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-300 dark:border-slate-700 text-xs">
								<button
									type="button"
									onClick={() => setSimSubTab("target")}
									className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 font-bold transition ${
										simSubTab === "target"
											? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-xs"
											: "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
									}`}
								>
									<Target className="size-3.5" />
									<span>Simulasi Target 12 Bulan</span>
									<span className="rounded-full bg-slate-400/30 px-1.5 py-0.2 text-[10px]">
										{simTargetPlans.length}
									</span>
								</button>

								<button
									type="button"
									onClick={() => setSimSubTab("realisasi")}
									className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 font-bold transition ${
										simSubTab === "realisasi"
											? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-xs"
											: "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
									}`}
								>
									<TrendingUp className="size-3.5" />
									<span>Simulasi Realisasi Bulanan</span>
									<span className="rounded-full bg-slate-400/30 px-1.5 py-0.2 text-[10px]">
										{monthData.length}
									</span>
								</button>

								<button
									type="button"
									onClick={() => setSimSubTab("fairness")}
									className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 font-bold transition ${
										simSubTab === "fairness"
											? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-xs"
											: "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
									}`}
								>
									<Scale className="size-3.5" />
									<span>Simulasi Fairness Treatment</span>
									<span className="rounded-full bg-slate-400/30 px-1.5 py-0.2 text-[10px]">
										{excludedCount}
									</span>
								</button>
							</div>
						</div>

						{/* SUB-VIEW 1: SIMULASI TARGET KINERJA 12 BULAN */}
						{simSubTab === "target" && (
							<div className="space-y-4 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-4 sm:p-5 shadow-xs">
								{/* 4-Quarter Schedule Cards Grid */}
								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<h3 className="text-sm font-bold text-slate-950 dark:text-slate-50">
											Jadwal Pemutakhiran Target Kinerja Output TA 2026
										</h3>
										<span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
											Aturan: 10 Hari Kerja di Awal Triwulan
										</span>
									</div>

									<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
										{targetWindowsList.map((win) => (
											<div
												key={win.quarter}
												className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5 space-y-2"
											>
												<div className="flex items-center justify-between gap-1.5">
													<span className="text-xs font-bold text-slate-900 dark:text-slate-100">
														{win.name}
													</span>
													<span className="rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600">
														{win.status === "open"
															? "Terbuka"
															: win.status === "scheduled"
																? "Terjadwal"
																: "Ditutup"}
													</span>
												</div>
												<div className="space-y-0.5">
													<p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
														Periode Pelaporan:
													</p>
													<p className="text-xs font-bold text-slate-900 dark:text-slate-100">
														{win.periodText}
													</p>
												</div>
												<p className="text-[10px] text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-1.5 leading-snug">
													{win.notes}
												</p>
											</div>
										))}
									</div>
								</div>

								{/* DIPA Revision Flexibility Note */}
								<div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/90 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
									<div className="flex items-center gap-2">
										<Sparkles className="size-4 text-slate-700 dark:text-slate-300 shrink-0" />
										<span className="text-slate-700 dark:text-slate-300 font-medium">
											<strong className="text-slate-950 dark:text-slate-50">
												Fleksibilitas Revisi DIPA:
											</strong>{" "}
											Apabila terdapat perubahan DIPA yang mempengaruhi volume
											target, satker dapat memutakhirkan target mandiri kapan
											saja dengan memilih opsi Perubahan DIPA.
										</span>
									</div>
									<button
										type="button"
										onClick={() => {
											handleOpenCreateTarget();
											setTargetUpdateType("dipa_revision");
										}}
										className="inline-flex items-center gap-1.5 self-start sm:self-auto shrink-0 rounded-lg bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 px-2.5 py-1 text-xs font-bold hover:bg-slate-700 dark:hover:bg-slate-300 transition"
									>
										<span>+ Pemutakhiran Jalur DIPA</span>
									</button>
								</div>

								<div className="flex flex-wrap items-center justify-between gap-3 pt-2">
									<div>
										<h2 className="text-base font-bold text-slate-950 dark:text-slate-50">
											Target Kinerja Fisik Rincian Output (Jan–Des)
										</h2>
										<p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
											Perencanaan target fisik 12 bulan per RO. Distribusi
											target volume harus sama dengan DIPA dan total PCRO harus
											100%.
										</p>
									</div>
									<button
										type="button"
										onClick={() => handleOpenCreateTarget()}
										className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 px-3.5 py-2 text-xs font-bold hover:bg-slate-700 dark:hover:bg-slate-300 transition shadow-xs"
									>
										<Plus className="size-4" />
										<span>Tambah / Mutakhirkan Target RO</span>
									</button>
								</div>

								<DomainDataTable
									title="Daftar Target Kinerja Rincian Output (Simulasi Preview)"
									data={simTargetPlans}
									columns={targetColumns}
									totalCount={simTargetPlans.length}
								/>
							</div>
						)}

						{/* SUB-VIEW 2: SIMULASI REALISASI BULANAN */}
						{simSubTab === "realisasi" && (
							<div className="space-y-4 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-4 sm:p-5 shadow-xs">
								{/* Month Selector Bar in Slate Theme */}
								<div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-xs">
									<div className="flex flex-wrap items-center gap-1">
										{MONTH_NAMES.map((name, idx) => (
											<button
												key={name}
												type="button"
												onClick={() => setSelectedMonth(idx + 1)}
												className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
													idx + 1 === selectedMonth
														? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-xs"
														: "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
												}`}
											>
												{name}
											</button>
										))}
									</div>
									<div className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold px-2">
										Tenggat 7 HK:{" "}
										<strong className="text-slate-900 dark:text-slate-100">
											{formatDateDDMMYYYY(canonicalDeadline)}
										</strong>
									</div>
								</div>

								{/* Validation & Workflow Status Strip (High Contrast Grayscale) */}
								<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
									<div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 space-y-1">
										<span className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold">
											Total RO Bulan Ini
										</span>
										<p className="text-base font-bold text-slate-950 dark:text-slate-50">
											{totalRoMonth} RO
										</p>
										<p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
											{evaluatedCount} dinilai · {excludedCount} dikecualikan
										</p>
									</div>

									<div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 space-y-1">
										<span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
											<CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
											<span>Valid (Rules 00–08)</span>
										</span>
										<p className="text-base font-bold text-slate-950 dark:text-slate-50">
											{monthValidCount} RO
										</p>
										<p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
											Sesuai aturan konsistensi IKPA
										</p>
									</div>

									<div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 space-y-1">
										<span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
											<AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400" />
											<span>Butuh Aksi / Konfirmasi</span>
										</span>
										<p className="text-base font-bold text-slate-950 dark:text-slate-50">
											{monthActionNeededCount} RO
										</p>
										<p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
											{monthBlockingCount > 0
												? `${monthBlockingCount} blocking · `
												: ""}
											{monthConfirmationCount} konfirmasi PPK
										</p>
									</div>

									<div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 space-y-1">
										<span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
											<FileCheck className="size-3.5 text-slate-700 dark:text-slate-300" />
											<span>Terkonfirmasi PPK</span>
										</span>
										<p className="text-base font-bold text-slate-950 dark:text-slate-50">
											{monthConfirmedPpkCount} RO
										</p>
										<p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
											Disetujui & siap dihitung
										</p>
									</div>
								</div>

								{/* Filters & Actions */}
								<div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 dark:border-slate-700 pb-2">
									<div className="flex flex-wrap items-center gap-1.5 text-xs">
										<button
											type="button"
											onClick={() => setActiveTabFilter("all")}
											className={`rounded-xl px-3 py-1.5 font-bold transition ${
												activeTabFilter === "all"
													? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-xs"
													: "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
											}`}
										>
											Semua ({monthData.length})
										</button>
										<button
											type="button"
											onClick={() => setActiveTabFilter("valid")}
											className={`rounded-xl px-3 py-1.5 font-bold transition ${
												activeTabFilter === "valid"
													? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-xs"
													: "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
											}`}
										>
											Valid ({monthValidCount})
										</button>
										<button
											type="button"
											onClick={() => setActiveTabFilter("action_needed")}
											className={`rounded-xl px-3 py-1.5 font-bold transition ${
												activeTabFilter === "action_needed"
													? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-xs"
													: "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
											}`}
										>
											Butuh Aksi / Konfirmasi ({monthActionNeededCount})
										</button>
										<button
											type="button"
											onClick={() => setActiveTabFilter("confirmed")}
											className={`rounded-xl px-3 py-1.5 font-bold transition ${
												activeTabFilter === "confirmed"
													? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-xs"
													: "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
											}`}
										>
											Terkonfirmasi ({monthConfirmedPpkCount})
										</button>
										<button
											type="button"
											onClick={() => setActiveTabFilter("excluded")}
											className={`rounded-xl px-3 py-1.5 font-bold transition ${
												activeTabFilter === "excluded"
													? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-xs"
													: "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
											}`}
										>
											Dikecualikan ({excludedCount})
										</button>
									</div>

									<button
										type="button"
										onClick={() => handleOpenCreateRealisasi()}
										className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 px-3.5 py-1.5 text-xs font-bold hover:bg-slate-700 dark:hover:bg-slate-300 transition shadow-xs"
									>
										<Plus className="size-4" />
										<span>Input Realisasi Bulan Ini</span>
									</button>
								</div>

								<DomainDataTable
									title={`Realisasi Capaian Output Bulan ${MONTH_NAMES[selectedMonth - 1]} 2026 (Simulasi Preview)`}
									data={filteredData}
									columns={realisasiColumns}
									searchValue={search}
									onSearchChange={setSearch}
									totalCount={filteredData.length}
								/>
							</div>
						)}

						{/* SUB-VIEW 3: SIMULASI FAIRNESS TREATMENT */}
						{simSubTab === "fairness" && (
							<div className="space-y-4 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-4 sm:p-5 shadow-xs">
								<div className="flex flex-wrap items-center justify-between gap-3">
									<div>
										<h2 className="text-base font-bold text-slate-950 dark:text-slate-50">
											Fairness Treatment (Pengecualian RO Khusus & Kahar)
										</h2>
										<p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
											RO yang dikecualikan (contoh: FAN.ZZ1) dikeluarkan dari
											pembilang & penyebut evaluasi sehingga tidak merugikan
											nilai satker.
										</p>
									</div>
									<button
										type="button"
										onClick={() => handleOpenFairnessModal()}
										className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 px-3.5 py-2 text-xs font-bold hover:bg-slate-700 dark:hover:bg-slate-300 transition shadow-xs"
									>
										<Scale className="size-4" />
										<span>Atur Fairness RO</span>
									</button>
								</div>

								<div className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-xs space-y-3">
									<h3 className="text-xs font-bold text-slate-950 dark:text-slate-50 flex items-center gap-1.5">
										<ShieldCheck className="size-4 text-slate-700 dark:text-slate-300" />
										<span>
											Kebijakan Fairness Resmi Terpublikasi (Nasional & KPPN)
										</span>
									</h3>
									<div className="divide-y divide-slate-200 dark:divide-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden text-xs">
										{(initialData.publishedPolicies || []).map((policy) => (
											<div
												key={policy.id}
												className="p-3 bg-slate-50 dark:bg-slate-800/60 flex items-start justify-between gap-4"
											>
												<div>
													<div className="flex items-center gap-2">
														<span className="font-bold text-slate-900 dark:text-slate-100">
															{policy.name}
														</span>
														<span className="rounded bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase border border-slate-300 dark:border-slate-600">
															{policy.category}
														</span>
													</div>
													<p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
														Pencocokan:{" "}
														<strong className="font-mono text-slate-900 dark:text-slate-100">
															{Array.isArray(policy.roMatchValue)
																? policy.roMatchValue.join(", ")
																: policy.roMatchValue}
														</strong>{" "}
														({policy.matchType}) · Dasar:{" "}
														{policy.basisReference}
													</p>
													<p className="text-[11px] text-slate-700 dark:text-slate-300 mt-1 italic">
														"{policy.displayReason}"
													</p>
												</div>
												<span className="rounded-full bg-slate-200 dark:bg-slate-700 px-2.5 py-0.5 text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase border border-slate-300 dark:border-slate-600">
													Aktif
												</span>
											</div>
										))}
									</div>
								</div>

								{/* Sandbox Proposals List */}
								{simProposals.length > 0 && (
									<div className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-xs space-y-3">
										<h3 className="text-xs font-bold text-slate-950 dark:text-slate-50 flex items-center gap-1.5">
											<FlaskConical className="size-4 text-slate-700 dark:text-slate-300" />
											<span>
												Daftar Pengecualian RO Aktif di Sandbox ({simProposals.length} RO)
											</span>
										</h3>
										<div className="divide-y divide-slate-200 dark:divide-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden text-xs">
											{simProposals.map((prop) => (
												<div
													key={prop.id}
													className="p-3 bg-slate-50 dark:bg-slate-800/60 flex items-start justify-between gap-4"
												>
													<div>
														<div className="flex items-center gap-2">
															<span className="font-mono font-bold text-slate-900 dark:text-slate-100">
																RO {prop.roCode}
															</span>
															<span className="rounded bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase border border-slate-300 dark:border-slate-600">
																{prop.category}
															</span>
														</div>
														<p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 font-medium">
															Dasar: {prop.basisReference}
														</p>
														{prop.operatorNote && (
															<p className="text-[11px] text-slate-700 dark:text-slate-300 mt-1 italic">
																"{prop.operatorNote}"
															</p>
														)}
													</div>
													<span className="rounded-full bg-slate-200 dark:bg-slate-700 px-2.5 py-0.5 text-[10px] font-bold text-slate-800 dark:text-slate-200 uppercase border border-slate-300 dark:border-slate-600">
														Sandbox Dikecualikan
													</span>
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				)}

				{/* MODAL: INPUT CAPAIAN TERAKHIR (MODE A & MODE B QUICK SIMULATOR) */}
				{isMacroModalOpen && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
						<div className="w-full max-w-lg rounded-2xl border border-border bg-background p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
							<div className="flex items-start justify-between">
								<div className="flex items-center gap-2.5">
									<div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
										<Edit className="size-5" />
									</div>
									<div>
										<h3 className="text-base font-bold text-foreground">
											Input Capaian Output Satker
										</h3>
										<p className="text-xs text-muted-foreground">
											Sinkronisasi skor IKPA Capaian Output ke Dashboard Utama.
										</p>
									</div>
								</div>
								<button
									type="button"
									onClick={() => setIsMacroModalOpen(false)}
									className="rounded-lg p-1 text-muted-foreground hover:bg-surface-muted"
								>
									<X className="size-4" />
								</button>
							</div>

							{/* Mode Switch Pills */}
							<div className="grid grid-cols-2 gap-2 text-xs">
								<button
									type="button"
									onClick={() => setMacroMode("myintress_actual")}
									className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
										macroMode === "myintress_actual"
											? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
											: "border-border bg-surface text-muted-foreground hover:bg-surface-muted"
									}`}
								>
									<div className="flex items-center gap-1.5 font-bold text-primary">
										<Check className="size-3.5" />
										<span>Mode A: Data Riil MyIntress</span>
									</div>
									<p className="text-[11px] text-muted-foreground">
										Input angka makro dari laporan OM-SPAN / MyIntress resmi.
									</p>
								</button>

								<button
									type="button"
									onClick={() => setMacroMode("simulation_override")}
									className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
										macroMode === "simulation_override"
											? "border-amber-500 bg-amber-500/10 text-foreground ring-1 ring-amber-500"
											: "border-border bg-surface text-muted-foreground hover:bg-surface-muted"
									}`}
								>
									<div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300">
										<Sparkles className="size-3.5" />
										<span>Mode B: Skenario What-If</span>
									</div>
									<p className="text-[11px] text-muted-foreground">
										Uji coba dampak jika skor ketepatan atau capaian RO berubah.
									</p>
								</button>
							</div>

							<div className="space-y-3.5 text-xs">
								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-1">
										<label
											htmlFor="macro-nkkw"
											className="font-semibold text-foreground flex items-center justify-between"
										>
											<span>NK-ROKW (Ketepatan)</span>
											<span className="text-[10px] text-muted-foreground">
												Bobot 30%
											</span>
										</label>
										<FormattedNumberInput
											id="macro-nkkw"
											allowDecimal
											maxDecimals={2}
											max={100}
											placeholder="Contoh: 100.00"
											value={macroNkkw}
											onChange={setMacroNkkw}
											className="min-h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground font-mono font-bold focus:border-primary focus:outline-none"
										/>
									</div>

									<div className="space-y-1">
										<label
											htmlFor="macro-nkcro"
											className="font-semibold text-foreground flex items-center justify-between"
										>
											<span>NK-CRO (Capaian RO)</span>
											<span className="text-[10px] text-muted-foreground">
												Bobot 70%
											</span>
										</label>
										<FormattedNumberInput
											id="macro-nkcro"
											allowDecimal
											maxDecimals={2}
											max={100}
											placeholder="Contoh: 95.50"
											value={macroNkcro}
											onChange={setMacroNkcro}
											className="min-h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground font-mono font-bold focus:border-primary focus:outline-none"
										/>
									</div>
								</div>

								<div className="space-y-1">
									<label
										htmlFor="macro-ro-count"
										className="font-semibold text-foreground"
									>
										Jumlah RO Objek Penilaian (Opsional)
									</label>
									<input
										id="macro-ro-count"
										type="number"
										min="1"
										placeholder="Contoh: 12"
										value={macroRoEligible}
										onChange={(e) => setMacroRoEligible(e.target.value)}
										className="min-h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
									/>
								</div>

								{/* Live Macro Calculation Box */}
								{(() => {
									const kw = Number.parseFloat(macroNkkw) || 0;
									const cro = Number.parseFloat(macroNkcro) || 0;
									const tot = Math.round((kw * 0.3 + cro * 0.7) * 100) / 100;
									const cont = Math.round(tot * 0.25 * 100) / 100;
									return (
										<div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-1.5 text-xs">
											<div className="flex items-center justify-between font-bold text-primary">
												<span>Hasil Perhitungan Otomatis:</span>
												<span className="text-sm">Nilai IKPA-CO: {tot.toFixed(2)}</span>
											</div>
											<div className="rounded-lg bg-background p-2 font-mono text-[11px] text-foreground border border-border/60">
												({kw.toFixed(2)} × 30%) + ({cro.toFixed(2)} × 70%) ={" "}
												{tot.toFixed(2)}
											</div>
											<div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
												<span>Kontribusi Nilai ke Satker (Bobot 25%):</span>
												<strong className="text-foreground">
													+{cont.toFixed(2)} Poin
												</strong>
											</div>
										</div>
									);
								})()}
							</div>

							<div className="flex items-center justify-end gap-2 border-t border-border pt-4">
								<button
									type="button"
									onClick={() => setIsMacroModalOpen(false)}
									className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted"
								>
									Batal
								</button>
								<button
									type="button"
									onClick={handleSaveMacroScore}
									className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover shadow-xs"
								>
									Simpan Nilai Capaian
								</button>
							</div>
						</div>
					</div>
				)}

				{/* DRAWER: TARGET KINERJA 12 BULAN (SANDBOX MODE) */}
				<DomainFormDrawer
					isOpen={isTargetDrawerOpen}
					title="[🧪 Sandbox] Simulasi Target Kinerja 12 Bulan (Jan–Des)"
					description="Tentukan distribusi target fisik RVRO dan persentase PCRO per bulan. Perubahan ini disimulasikan di layar secara real-time."
					onClose={() => setIsTargetDrawerOpen(false)}
					onSubmit={handleSaveTargetSandbox}
					isSubmitting={false}
					isSubmitDisabled={!targetFormValidation.isValid}
				>
					<div className="space-y-4 text-xs">
						<div
							className={`rounded-xl p-3 border space-y-1 ${
								targetFormValidation.isValid
									? "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
									: "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
							}`}
						>
							<div className="flex items-center justify-between font-bold">
								<span>Pemeriksaan Validasi Distribusi:</span>
								<span>
									Total RVRO: {targetFormValidation.sumRvro} /{" "}
									{targetFormValidation.volDipa} · Total PCRO:{" "}
									{targetFormValidation.sumPcro.toFixed(1)}%
								</span>
							</div>
							{!targetFormValidation.isRvroEqual && (
								<p className="text-[11px] text-rose-700 dark:text-rose-400 font-semibold">
									• TAR-01: Jumlah target RVRO Jan–Des (
									{targetFormValidation.sumRvro}) harus sama dengan Volume DIPA
									({targetFormValidation.volDipa}).
								</p>
							)}
							{!targetFormValidation.isPcro100 && (
								<p className="text-[11px] text-rose-700 dark:text-rose-400 font-semibold">
									• TAR-02: Jumlah target PCRO Jan–Des (
									{targetFormValidation.sumPcro.toFixed(1)}%) harus sama dengan
									100.0%.
								</p>
							)}
						</div>

						{/* Jalur Pemutakhiran & Alasan Revisi */}
						<div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-3 space-y-3">
							<div className="space-y-1">
								<label
									htmlFor="tp-update-type"
									className="font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between"
								>
									<span>Jalur / Trigger Pemutakhiran Target:</span>
									{targetUpdateType === "dipa_revision" && (
										<span className="rounded bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-800 dark:text-slate-200">
											Mandiri Pasca Revisi DIPA
										</span>
									)}
								</label>
								<select
									id="tp-update-type"
									value={targetUpdateType}
									onChange={(e) =>
										setTargetUpdateType(
											e.target.value as
												| "regular"
												| "dipa_revision"
												| "ppa_adjustment"
												| "special_condition",
										)
									}
									className="min-h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100 font-semibold focus:border-slate-500 focus:outline-none"
								>
									<option value="regular">
										Pemutakhiran Reguler Triwulanan (10 HK Awal Triwulan)
									</option>
									<option value="dipa_revision">
										Perubahan DIPA (Revisi Target Volume / Pagu RO / Jumlah RO)
									</option>
									<option value="ppa_adjustment">
										Penyesuaian Realisasi Anggaran / PPA
									</option>
									<option value="special_condition">
										Kondisi Khusus / Arahan KPPN
									</option>
								</select>
							</div>

							{(targetUpdateType === "dipa_revision" ||
								targetUpdateType === "special_condition" ||
								targetUpdateType === "ppa_adjustment") && (
								<div className="space-y-1 border-t border-slate-200 dark:border-slate-700 pt-2">
									<label
										htmlFor="tp-change-reason"
										className="font-semibold text-slate-900 dark:text-slate-100 text-xs"
									>
										Nomor Surat Revisi DIPA / Justifikasi Perubahan Target:
									</label>
									<input
										id="tp-change-reason"
										type="text"
										placeholder="Contoh: Revisi DIPA Ke-2 No. DIPA-015.01.2.123456/2026"
										value={targetChangeReason}
										onChange={(e) => setTargetChangeReason(e.target.value)}
										className="min-h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs text-slate-900 dark:text-slate-100 focus:border-slate-500 focus:outline-none"
									/>
								</div>
							)}
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1">
								<label
									htmlFor="tp-ro-code"
									className="font-bold text-slate-900 dark:text-slate-100"
								>
									Kode RO
								</label>
								<input
									id="tp-ro-code"
									type="text"
									required
									placeholder="Contoh: 5241.AAA.001"
									value={targetRoCode}
									onChange={(e) => setTargetRoCode(e.target.value.toUpperCase())}
									className="min-h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-slate-500 focus:outline-none"
								/>
							</div>

							<div className="space-y-1">
								<label
									htmlFor="tp-quarter"
									className="font-bold text-slate-900 dark:text-slate-100"
								>
									Triwulan Target
								</label>
								<select
									id="tp-quarter"
									value={targetQuarter}
									onChange={(e) => setTargetQuarter(Number(e.target.value))}
									className="min-h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100 focus:border-slate-500 focus:outline-none"
								>
									{QUARTER_NAMES.map((q, idx) => (
										<option key={q} value={idx + 1}>
											{q}
										</option>
									))}
								</select>
							</div>
						</div>

						<div className="space-y-1">
							<label
								htmlFor="tp-ro-name"
								className="font-bold text-slate-900 dark:text-slate-100"
							>
								Nama / Uraian Rincian Output
							</label>
							<input
								id="tp-ro-name"
								type="text"
								placeholder="Contoh: Layanan Perkantoran dan Operasional Satker"
								value={targetRoName}
								onChange={(e) => setTargetRoName(e.target.value)}
								className="min-h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100 focus:border-slate-500 focus:outline-none"
							/>
						</div>

						<div className="grid grid-cols-3 gap-3">
							<div className="space-y-1">
								<label
									htmlFor="tp-vol-dipa"
									className="font-bold text-slate-900 dark:text-slate-100"
								>
									Volume DIPA
								</label>
								<FormattedNumberInput
									id="tp-vol-dipa"
									allowDecimal={false}
									required
									placeholder="Contoh: 12"
									value={targetVolumeDipa}
									onChange={setTargetVolumeDipa}
									className="min-h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100 focus:border-slate-500 focus:outline-none"
								/>
							</div>

							<div className="space-y-1">
								<label
									htmlFor="tp-unit"
									className="font-bold text-slate-900 dark:text-slate-100"
								>
									Satuan Unit
								</label>
								<input
									id="tp-unit"
									type="text"
									placeholder="Contoh: Layanan, Gedung"
									value={targetUnit}
									onChange={(e) => setTargetUnit(e.target.value)}
									className="min-h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100 focus:border-slate-500 focus:outline-none"
								/>
							</div>

							<div className="space-y-1 flex flex-col justify-end">
								<label className="flex items-center gap-1.5 cursor-pointer py-2">
									<input
										type="checkbox"
										checked={targetIsPn}
										onChange={(e) => setTargetIsPn(e.target.checked)}
										className="size-4 rounded border-slate-400 text-slate-800"
									/>
									<span className="font-bold text-slate-900 dark:text-slate-100">
										Prioritas Nasional
									</span>
								</label>
							</div>
						</div>

						<div className="border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden mt-3">
							<div className="bg-slate-100 dark:bg-slate-800 p-2.5 font-bold text-slate-900 dark:text-slate-100 border-b border-slate-300 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
								<div className="flex items-center gap-2">
									<span>Distribusi Target Inkremental Per Bulan</span>
									<span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
										(Jan–Des)
									</span>
								</div>
								<button
									type="button"
									onClick={handleAutoDistributeTargets}
									className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-[11px] font-bold text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
								>
									<Sparkles className="size-3" />
									<span>Distribusi Rata Otomatis</span>
								</button>
							</div>
							<div className="max-h-64 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-700">
								{targetMonthlyValues.map((item, idx) => (
									<div
										key={item.month}
										className="p-2 flex items-center justify-between gap-3 bg-white dark:bg-slate-800/60"
									>
										<span className="w-24 font-bold text-slate-900 dark:text-slate-100">
											{MONTH_NAMES[idx]}
										</span>
										<div className="flex items-center gap-2">
											<span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
												RVRO:
											</span>
											<input
												type="number"
												min="0"
												step="any"
												value={item.targetRvro}
												onChange={(e) => {
													const next = [...targetMonthlyValues];
													next[idx].targetRvro = e.target.value;
													setTargetMonthlyValues(next);
												}}
												className="w-20 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-right font-mono text-xs text-slate-900 dark:text-slate-100 focus:border-slate-500 focus:outline-none"
											/>
										</div>
										<div className="flex items-center gap-2">
											<span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
												PCRO (%):
											</span>
											<input
												type="number"
												min="0"
												max="100"
												step="any"
												value={item.targetPcro}
												onChange={(e) => {
													const next = [...targetMonthlyValues];
													next[idx].targetPcro = e.target.value;
													setTargetMonthlyValues(next);
												}}
												className="w-20 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-right font-mono text-xs text-slate-900 dark:text-slate-100 focus:border-slate-500 focus:outline-none"
											/>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				</DomainFormDrawer>

				{/* DRAWER: REALISASI KINERJA (SANDBOX MODE) */}
				<DomainFormDrawer
					isOpen={isRealisasiDrawerOpen}
					title={
						editingReport
							? `[🧪 Sandbox] Edit Realisasi: ${editingReport.roCode}`
							: "[🧪 Sandbox] Input Realisasi Capaian Output"
					}
					description="Uji coba perhitungan realisasi bulanan dan validasi Rules 00–08 secara langsung di layar."
					onClose={() => {
						setIsRealisasiDrawerOpen(false);
						setEditingReport(null);
					}}
					onSubmit={() => handleSaveRealisasiSandbox("draft")}
					isSubmitting={false}
					isSubmitDisabled={
						!formRoCode.trim() || liveBlockingErrors.length > 0
					}
				>
					<div className="space-y-4 text-xs">
						{/* Live Calculation Preview */}
						<div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-3.5 space-y-2 text-xs">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
									<Sparkles className="size-3.5 text-slate-600 dark:text-slate-400" />
									<span>Live Calculation Preview</span>
								</div>
								<span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600">
									{liveDrawerPreview.badge}
								</span>
							</div>
							<div className="rounded-lg bg-white dark:bg-slate-900 p-2.5 font-mono text-[11px] text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700">
								{liveDrawerPreview.calculationStep}
							</div>
							<div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 pt-0.5 font-medium">
								<span>Estimasi Nilai NK-CRO:</span>
								<strong className="text-sm font-bold text-slate-900 dark:text-slate-100">
									{liveDrawerPreview.score}
								</strong>
							</div>
							{activeRoBudgetRealization && (
								<div className="border-t border-slate-200 dark:border-slate-700 pt-1.5 flex items-center justify-between text-[11px]">
									<span>PPA Anggaran RO (Bulan {MONTH_NAMES[formMonth - 1]}):</span>
									<span className="font-bold text-slate-900 dark:text-slate-100">
										{formatDynamicPercent(
											activeRoBudgetRealization.ppaPercentage,
										)}{" "}
										({formatRupiah(activeRoBudgetRealization.realizationAmount)})
									</span>
								</div>
							)}
						</div>

						{/* Live Validation Engine (Rules 00-08) Status Box */}
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
									<ShieldAlert className="size-3.5 text-slate-600 dark:text-slate-400" />
									<span>Pemeriksaan Validasi Engine (Rules 00–08)</span>
								</span>
								<span className="text-[10px] font-mono">
									{liveBlockingErrors.length > 0 ? (
										<span className="text-rose-700 dark:text-rose-400 font-bold">
											{liveBlockingErrors.length} Blocking Error
										</span>
									) : liveConfirmationRequired.length > 0 ? (
										<span className="text-amber-700 dark:text-amber-400 font-bold">
											{liveConfirmationRequired.length} Butuh Konfirmasi
										</span>
									) : (
										<span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
											<CheckCircle2 className="size-3" />
											<span>Semua Rule Valid</span>
										</span>
									)}
								</span>
							</div>

							{liveBlockingErrors.length > 0 && (
								<div className="rounded-xl border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/40 p-3 space-y-1.5 text-xs">
									<div className="flex items-center gap-1.5 font-bold text-rose-900 dark:text-rose-200">
										<AlertCircle className="size-4 shrink-0" />
										<span>Terdeteksi Blocking Issue</span>
									</div>
									<div className="space-y-1">
										{liveBlockingErrors.map((err) => (
											<div
												key={err.code}
												className="text-[11px] text-rose-800 dark:text-rose-300 flex items-start gap-1"
											>
												<span className="font-mono font-bold">
													• [Rule {err.code}]
												</span>
												<span>{err.message}</span>
											</div>
										))}
									</div>
								</div>
							)}

							{liveConfirmationRequired.length > 0 && (
								<div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-1.5 text-xs">
									<div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
										<AlertTriangle className="size-4 shrink-0 text-amber-600" />
										<span>Memerlukan Konfirmasi & Justifikasi PPK</span>
									</div>
									<div className="space-y-1">
										{liveConfirmationRequired.map((w) => (
											<div
												key={w.code}
												className="text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-1"
											>
												<span className="font-mono font-bold">
													• [Rule {w.code}]
												</span>
												<span>{w.message}</span>
											</div>
										))}
									</div>
								</div>
							)}

							{liveBlockingErrors.length === 0 &&
								liveConfirmationRequired.length === 0 && (
									<div className="rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
										<CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
										<span>
											Integritas data konsisten dengan realisasi anggaran dan
											target volume DIPA.
										</span>
									</div>
								)}
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1">
								<label
									htmlFor="rel-ro-code"
									className="font-bold text-slate-900 dark:text-slate-100"
								>
									Kode RO
								</label>
								<input
									id="rel-ro-code"
									type="text"
									required
									placeholder="Contoh: 5241.AAA.001"
									value={formRoCode}
									onChange={(e) => setFormRoCode(e.target.value.toUpperCase())}
									className="min-h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-slate-500 focus:outline-none"
								/>
							</div>

							<div className="space-y-1">
								<label
									htmlFor="rel-month"
									className="font-bold text-slate-900 dark:text-slate-100"
								>
									Bulan Laporan
								</label>
								<select
									id="rel-month"
									value={formMonth}
									onChange={(e) => setFormMonth(Number(e.target.value))}
									className="min-h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100 focus:border-slate-500 focus:outline-none"
								>
									{MONTH_NAMES.map((n, idx) => (
										<option key={n} value={idx + 1}>
											{n}
										</option>
									))}
								</select>
							</div>
						</div>

						<div className="space-y-1">
							<label
								htmlFor="rel-ro-name"
								className="font-bold text-slate-900 dark:text-slate-100"
							>
								Nama / Uraian RO
							</label>
							<input
								id="rel-ro-name"
								type="text"
								placeholder="Contoh: Layanan Perkantoran dan Operasional"
								value={formRoName}
								onChange={(e) => setFormRoName(e.target.value)}
								className="min-h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100 focus:border-slate-500 focus:outline-none"
							/>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1">
								<label
									htmlFor="rel-vol-dipa"
									className="font-bold text-slate-900 dark:text-slate-100"
								>
									Target Volume DIPA
								</label>
								<FormattedNumberInput
									id="rel-vol-dipa"
									allowDecimal={false}
									value={formVolumeDipa}
									onChange={setFormVolumeDipa}
									className="min-h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100 focus:border-slate-500 focus:outline-none"
								/>
							</div>

							<div className="space-y-1">
								<label
									htmlFor="rel-tpcro"
									className="font-bold text-slate-900 dark:text-slate-100"
								>
									Target PCRO Kumulatif (%)
								</label>
								<FormattedNumberInput
									id="rel-tpcro"
									allowDecimal
									maxDecimals={2}
									max={100}
									value={formTpcro}
									onChange={setFormTpcro}
									className="min-h-10 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100 focus:border-slate-500 focus:outline-none"
								/>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-3 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700">
							<div className="space-y-2">
								<span className="font-bold text-slate-900 dark:text-slate-100">
									Realisasi Volume (RVRO)
								</span>
								<div className="space-y-1">
									<label
										htmlFor="rel-rvro-inc"
										className="text-[10px] text-slate-600 dark:text-slate-400 font-medium"
									>
										+ Inkremental Bulan Ini
									</label>
									<input
										id="rel-rvro-inc"
										type="number"
										min="0"
										step="any"
										placeholder="0"
										value={formRvroIncremental}
										onChange={(e) => handleIncrementalRvroChange(e.target.value)}
										className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 font-mono text-xs text-slate-900 dark:text-slate-100 focus:border-slate-500 focus:outline-none"
									/>
								</div>
								<div className="space-y-1">
									<label
										htmlFor="rel-rvro-cum"
										className="text-[10px] text-slate-600 dark:text-slate-400 font-medium"
									>
										= Kumulatif s.d. Bulan Ini
									</label>
									<input
										id="rel-rvro-cum"
										type="number"
										min="0"
										step="any"
										placeholder="0"
										value={formRvroCumulative}
										onChange={(e) => setFormRvroCumulative(e.target.value)}
										className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 font-mono text-xs font-bold text-slate-900 dark:text-slate-100 focus:border-slate-500 focus:outline-none"
									/>
								</div>
							</div>

							<div className="space-y-2">
								<span className="font-bold text-slate-900 dark:text-slate-100">
									Progres Fisik (PCRO %)
								</span>
								<div className="space-y-1">
									<label
										htmlFor="rel-pcro-inc"
										className="text-[10px] text-slate-600 dark:text-slate-400 font-medium"
									>
										+ Inkremental Bulan Ini (%)
									</label>
									<input
										id="rel-pcro-inc"
										type="number"
										min="0"
										max="100"
										step="any"
										placeholder="0"
										value={formPcroIncremental}
										onChange={(e) => handleIncrementalPcroChange(e.target.value)}
										className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 font-mono text-xs text-slate-900 dark:text-slate-100 focus:border-slate-500 focus:outline-none"
									/>
								</div>
								<div className="space-y-1">
									<label
										htmlFor="rel-pcro-cum"
										className="text-[10px] text-slate-600 dark:text-slate-400 font-medium"
									>
										= Kumulatif s.d. Bulan Ini (%)
									</label>
									<input
										id="rel-pcro-cum"
										type="number"
										min="0"
										max="100"
										step="any"
										placeholder="0"
										value={formPcroCumulative}
										onChange={(e) => setFormPcroCumulative(e.target.value)}
										className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-2 font-mono text-xs font-bold text-slate-900 dark:text-slate-100 focus:border-slate-500 focus:outline-none"
									/>
								</div>
							</div>
						</div>

						{/* Panel Review & Konfirmasi PPK */}
						<div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5 space-y-3">
							<div className="flex items-center justify-between">
								<span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
									<FileCheck className="size-4 text-slate-700 dark:text-slate-300" />
									<span>Review & Konfirmasi PPK</span>
								</span>
								<span
									className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
										formConfirmed
											? "bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 border border-emerald-500/30"
											: "bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-500/30"
									}`}
								>
									{formConfirmed ? "Terkonfirmasi PPK" : "Menunggu Konfirmasi"}
								</span>
							</div>

							<label className="flex items-start gap-2 cursor-pointer pt-1">
								<input
									type="checkbox"
									checked={formConfirmed}
									onChange={(e) => setFormConfirmed(e.target.checked)}
									className="mt-0.5 size-4 rounded border-slate-400 text-slate-800"
								/>
								<div className="text-xs">
									<span className="font-bold text-slate-900 dark:text-slate-100 block">
										Konfirmasi Data Capaian Output oleh PPK
									</span>
									<span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
										Centang untuk memvalidasi dan mengesahkan capaian fisik RO
										untuk simulasi IKPA.
									</span>
								</div>
							</label>
						</div>

						{/* Action Buttons */}
						<div className="flex items-center justify-between pt-2 border-t border-slate-300 dark:border-slate-700">
							<span className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
								Mode Sandbox: Perubahan hanya diuji coba lokal di layar.
							</span>
							<div className="flex items-center gap-2">
								<button
									type="button"
									disabled={liveBlockingErrors.length > 0}
									onClick={() => handleSaveRealisasiSandbox("draft")}
									className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition disabled:opacity-50"
								>
									<span>Simulasikan Draft</span>
								</button>
								<button
									type="button"
									disabled={liveBlockingErrors.length > 0}
									onClick={() =>
										handleSaveRealisasiSandbox(
											formConfirmed ? "confirmed" : "submitted",
										)
									}
									className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 px-3.5 py-2 text-xs font-bold hover:bg-slate-700 dark:hover:bg-slate-300 transition disabled:opacity-50"
								>
									<span>Simulasikan Konfirmasi</span>
								</button>
							</div>
						</div>
					</div>
				</DomainFormDrawer>

				{/* MODAL: FAIRNESS PROPOSAL (SANDBOX MODE) */}
				{isProposalModalOpen && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
						<div className="w-full max-w-lg rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
							<div className="flex items-start justify-between">
								<div className="flex items-center gap-2.5">
									<div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-900 dark:text-purple-200">
										<Scale className="size-5" />
									</div>
									<div>
										<h3 className="text-base font-bold text-slate-950 dark:text-slate-50">
											[🧪 Sandbox] Pengaturan Fairness & Pengecualian RO
										</h3>
										<p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
											Simulasikan apakah RO dikecualikan dari penilaian IKPA
											atau dinilai normal.
										</p>
									</div>
								</div>
								<button
									type="button"
									onClick={() => setIsProposalModalOpen(false)}
									className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
								>
									<X className="size-4" />
								</button>
							</div>

							<div className="grid grid-cols-2 gap-2 text-xs">
								<button
									type="button"
									onClick={() => setProposalIsExcluded(true)}
									className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
										proposalIsExcluded
											? "border-purple-600 bg-purple-500/15 text-slate-950 dark:text-slate-50 ring-1 ring-purple-600"
											: "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
									}`}
								>
									<div className="flex items-center gap-1.5 font-bold text-purple-900 dark:text-purple-200">
										<Scale className="size-3.5" />
										<span>Dikecualikan (Fairness)</span>
									</div>
									<p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
										Dikeluarkan dari pembilang & penyebut evaluasi Capaian
										Output.
									</p>
								</button>

								<button
									type="button"
									onClick={() => setProposalIsExcluded(false)}
									className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
										!proposalIsExcluded
											? "border-slate-800 dark:border-slate-200 bg-slate-200 dark:bg-slate-800 text-slate-950 dark:text-slate-50 ring-1 ring-slate-800"
											: "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
									}`}
								>
									<div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
										<CheckCircle2 className="size-3.5" />
										<span>Dinilai (Normal)</span>
									</div>
									<p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
										Dinilai standar berdasarkan progres fisik dan realisasi
										volume.
									</p>
								</button>
							</div>

							<div className="space-y-3.5 text-xs">
								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-1">
										<label
											htmlFor="fair-ro-code"
											className="font-bold text-slate-900 dark:text-slate-100"
										>
											Kode RO
										</label>
										<input
											id="fair-ro-code"
											type="text"
											required
											placeholder="Contoh: FAN.ZZ1"
											value={proposalRoCode}
											onChange={(e) =>
												setProposalRoCode(e.target.value.toUpperCase())
											}
											className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 font-mono font-bold text-slate-900 dark:text-slate-100 focus:border-slate-500 focus:outline-none"
										/>
									</div>

									<div className="space-y-1">
										<label
											htmlFor="fair-month"
											className="font-bold text-slate-900 dark:text-slate-100"
										>
											Periode Bulan
										</label>
										<select
											id="fair-month"
											value={proposalMonth ?? ""}
											onChange={(e) =>
												setProposalMonth(
													e.target.value ? Number(e.target.value) : null,
												)
											}
											className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100 focus:border-slate-500 focus:outline-none"
										>
											<option value="">Semua Bulan (Sepanjang Tahun)</option>
											{MONTH_NAMES.map((n, idx) => (
												<option key={n} value={idx + 1}>
													Bulan {n}
												</option>
											))}
										</select>
									</div>
								</div>

								{proposalIsExcluded ? (
									<>
										<div className="space-y-1">
											<label
												htmlFor="fair-cat"
												className="font-bold text-slate-900 dark:text-slate-100"
											>
												Kategori Pengecualian
											</label>
											<select
												id="fair-cat"
												value={proposalCategory}
												onChange={(e) => setProposalCategory(e.target.value)}
												className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100 focus:border-slate-500 focus:outline-none"
											>
												<option value="ro_khusus">
													RO Khusus (Contoh: FAN.ZZ1 / Penugasan Khusus)
												</option>
												<option value="keadaan_kahar">
													Keadaan Kahar / Force Majeure
												</option>
												<option value="kebijakan_pusat">
													Kebijakan Khusus Kantor Pusat / Kemenkeu
												</option>
											</select>
										</div>

										<div className="space-y-1">
											<label
												htmlFor="fair-basis"
												className="font-bold text-slate-900 dark:text-slate-100"
											>
												Dasar Regulasi
											</label>
											<input
												id="fair-basis"
												type="text"
												required
												placeholder="Contoh: PER-5/PB/2024 atau ND-123/PB/2026"
												value={proposalBasis}
												onChange={(e) => setProposalBasis(e.target.value)}
												className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-slate-900 dark:text-slate-100 focus:border-slate-500 focus:outline-none"
											/>
										</div>

										<div className="space-y-1">
											<label
												htmlFor="fair-note"
												className="font-bold text-slate-900 dark:text-slate-100"
											>
												Catatan / Alasan Operator
											</label>
											<textarea
												id="fair-note"
												rows={3}
												placeholder="Jelaskan alasan mengapa RO ini perlu dikecualikan dari penilaian..."
												value={proposalNote}
												onChange={(e) => setProposalNote(e.target.value)}
												className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-slate-900 dark:text-slate-100 focus:border-slate-500 focus:outline-none"
											/>
										</div>
									</>
								) : (
									<div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-3.5 text-xs text-slate-900 dark:text-slate-100 space-y-1">
										<p className="font-bold text-slate-950 dark:text-slate-50 flex items-center gap-1.5">
											<CheckCircle2 className="size-4 text-emerald-600" />
											<span>Kembali Menjadi Objek Penilaian Normal</span>
										</p>
										<p className="text-slate-600 dark:text-slate-400 font-medium">
											Pengecualian fairness pada RO {proposalRoCode || "ini"}{" "}
											akan dinonaktifkan dalam simulasi.
										</p>
									</div>
								)}
							</div>

							<div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-700 pt-4">
								<button
									type="button"
									onClick={() => setIsProposalModalOpen(false)}
									className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
								>
									Batal
								</button>
								<button
									type="button"
									disabled={
										!proposalRoCode.trim() ||
										(proposalIsExcluded && !proposalBasis.trim())
									}
									onClick={handleSubmitProposalSandbox}
									className="rounded-lg px-4 py-2 text-xs font-bold bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-300 transition shadow-xs disabled:opacity-50"
								>
									Terapkan Simulasi Fairness
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Strategy Assistance Panel */}
				<section
					aria-label="Strategi Optimalisasi Nilai IKPA - Capaian Output"
					className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4"
				>
					<div className="flex items-center gap-2.5">
						<div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
							<TrendingUp className="size-4" />
						</div>
						<div>
							<h2 className="text-base font-bold text-foreground">
								Strategi Optimalisasi Nilai IKPA - Capaian Output
							</h2>
							<p className="text-xs text-muted-foreground">
								Langkah strategis optimalisasi pelaporan kinerja dan kualitas data Capaian Output (Bobot 25%).
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
									Penetapan Target &amp; Metode Perhitungan RO
								</h3>
								<p className="text-muted-foreground leading-relaxed text-[11px]">
									Menetapkan target dan metode perhitungan capaian output untuk setiap RO yang dikelola, khususnya untuk output teknis.
								</p>
							</div>
						</div>

						<div className="p-4 rounded-xl border border-border bg-background space-y-2 flex flex-col justify-between">
							<div className="space-y-1.5">
								<span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
									2
								</span>
								<h3 className="font-bold text-foreground">
									Pemantauan Periodik PCRO &amp; Realisasi Volume
								</h3>
								<p className="text-muted-foreground leading-relaxed text-[11px]">
									Secara periodik menghitung tingkat kemajuan aktivitas (progres/PCRO) dan capaian (Realisasi Volume RO), memperhatikan gap progres capaian output dengan penyerapan anggaran.
								</p>
							</div>
						</div>

						<div className="p-4 rounded-xl border border-border bg-background space-y-2 flex flex-col justify-between">
							<div className="space-y-1.5">
								<span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
									3
								</span>
								<h3 className="font-bold text-foreground">
									Pengisian Data Disiplin sebelum Batas Open Period
								</h3>
								<p className="text-muted-foreground leading-relaxed text-[11px]">
									Melakukan pengisian data capaian output bulanan secara akurat dan disiplin sebelum batas akhir open period reguler (hari kerja ke-7 setelah bulan berakhir).
								</p>
							</div>
						</div>

						<div className="p-4 rounded-xl border border-border bg-background space-y-2 flex flex-col justify-between">
							<div className="space-y-1.5">
								<span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
									4
								</span>
								<h3 className="font-bold text-foreground">
									Monitoring Status Terkonfirmasi OMSPAN
								</h3>
								<p className="text-muted-foreground leading-relaxed text-[11px]">
									Memonitor status data pada aplikasi OMSPAN dan memastikan seluruh status data telah Terkonfirmasi.
								</p>
							</div>
						</div>
					</div>
				</section>

				{/* Modal Pengajuan Pembukaan Periode Tambahan ke KPPN */}
				{isRequestingAdditionalOpen && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
						<div className="w-full max-w-lg rounded-2xl border border-border bg-background p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
							<div className="flex items-start justify-between">
								<div className="flex items-center gap-2.5">
									<div className="flex size-9 items-center justify-center rounded-xl bg-warning/15 text-warning">
										<Clock className="size-5" />
									</div>
									<div>
										<h3 className="text-base font-bold text-foreground">
											Pengajuan Pembukaan Periode Tambahan KPPN
										</h3>
										<p className="text-xs text-muted-foreground">
											Permohonan dispensasi pelaporan data realisasi setelah Hari
											Kerja ke-7.
										</p>
									</div>
								</div>
								<button
									type="button"
									onClick={() => setIsRequestingAdditionalOpen(false)}
									className="rounded-lg p-1 text-muted-foreground hover:bg-surface-muted"
								>
									<X className="size-4" />
								</button>
							</div>

							<div className="rounded-xl border border-warning/20 bg-warning/5 p-3 text-xs space-y-1 text-muted-foreground">
								<p className="font-bold text-foreground">
									Ketentuan Periode Pelaporan Tambahan KPPN:
								</p>
								<p className="text-[11px] leading-relaxed">
									Periode tambahan berlaku setelah Hari Kerja ke-7 bulan M+1
									sampai dengan <strong>akhir bulan M+1</strong> (
									{formatDateDDMMYYYY(
										currentMonthOpenPeriod.additionalDeadline,
									)}
									). Pengajuan ini akan diteruskan ke Admin KPPN untuk verifikasi
									dan pembukaan akses sistem pada Aplikasi MyIntress / Simulator
									IKPA.
								</p>
							</div>

							<div className="space-y-3 text-xs">
								<div>
									<label className="text-muted-foreground block mb-1 font-semibold">
										Bulan Pelaporan yang Dimohonkan:
									</label>
									<input
										type="text"
										readOnly
										value={`Bulan ${MONTH_NAMES[selectedMonth - 1]} ${initialData.year} (Batas Tambahan: ${formatDateDDMMYYYY(currentMonthOpenPeriod.additionalDeadline)})`}
										className="h-9 w-full rounded-lg border border-border bg-surface-muted px-3 font-semibold text-foreground cursor-not-allowed"
									/>
								</div>

								<div>
									<label className="text-muted-foreground block mb-1 font-semibold">
										Penyebab Keterlambatan / Kejadian Khusus:
									</label>
									<select
										value={additionalRequestReason}
										onChange={(e) => setAdditionalRequestReason(e.target.value)}
										className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none font-medium"
									>
										<option value="Kendala Teknis Aplikasi OM-SPAN / SAKTI">
											Kendala Teknis Aplikasi OM-SPAN / SAKTI
										</option>
										<option value="Rekonsiliasi Internal Belum Tuntas">
											Rekonsiliasi Internal / Konfirmasi PPK Belum Tuntas
										</option>
										<option value="Bencana Alam / Keadaan Kahar">
											Bencana Alam / Keadaan Kahar (Force Majeure)
										</option>
										<option value="Pergantian Pejabat Perbendaharaan (PPK/PPSPM)">
											Pergantian Pejabat Perbendaharaan (PPK/PPSPM)
										</option>
										<option value="Penugasan Khusus / Arahan Eselon I">
											Penugasan Khusus / Arahan Eselon I
										</option>
										<option value="Lainnya">
											Lainnya (Tuliskan pada catatan)
										</option>
									</select>
								</div>

								<div>
									<label className="text-muted-foreground block mb-1 font-semibold">
										Nomor Surat / Nota Dinas Permohonan:
									</label>
									<input
										type="text"
										required
										placeholder="Contoh: S-123/WPB.08/KP.01/2026 atau ND-456/2026"
										value={additionalRequestDocNumber}
										onChange={(e) =>
											setAdditionalRequestDocNumber(e.target.value)
										}
										className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
									/>
								</div>

								<div>
									<label className="text-muted-foreground block mb-1 font-semibold">
										Keterangan Tambahan / Penjelasan:
									</label>
									<textarea
										rows={3}
										value={additionalRequestNote}
										onChange={(e) => setAdditionalRequestNote(e.target.value)}
										placeholder="Jelaskan kendala yang dihadapi dan komitmen waktu penyelesaian penginputan data."
										className="w-full rounded-lg border border-border bg-surface p-2.5 text-foreground focus:border-primary focus:outline-none"
									/>
								</div>
							</div>

							<div className="flex items-center justify-end gap-2 border-t border-border pt-4">
								<button
									type="button"
									onClick={() => setIsRequestingAdditionalOpen(false)}
									className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted"
								>
									Batal
								</button>
								<button
									type="button"
									onClick={() => {
										setAdditionalSubmittedMonths((prev) => [
											...prev,
											selectedMonth,
										]);
										setIsRequestingAdditionalOpen(false);
										setActionMessage(
											`Permohonan Pembukaan Periode Tambahan Bulan ${MONTH_NAMES[selectedMonth - 1]} (${additionalRequestDocNumber || "Tanpa No Surat"}) berhasil dikirimkan ke Admin KPPN.`,
										);
										setTimeout(() => setActionMessage(null), 5000);
									}}
									className="inline-flex items-center gap-1.5 rounded-lg bg-warning px-4 py-2 text-xs font-semibold text-warning-foreground hover:bg-warning/90 shadow-xs"
								>
									<Save className="size-3.5" />
									<span>Kirim Permohonan ke KPPN</span>
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		</OperatorShell>
	);
}

export default OutputAchievementPage;

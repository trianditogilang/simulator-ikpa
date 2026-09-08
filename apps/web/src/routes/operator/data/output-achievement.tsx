import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
	AlertCircle,
	AlertTriangle,
	ArrowRight,
	Award,
	Bell,
	BookOpen,
	Calendar,
	CheckCircle2,
	Clock,
	Edit,
	FileCheck,
	Info,
	Percent,
	Plus,
	Scale,
	Send,
	Save,
	ShieldAlert,
	ShieldCheck,
	Sparkles,
	Target,
	Trash2,
	TrendingUp,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
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
	removeFairnessProposal,
	removeOutputReport,
	saveOutputReport,
	saveTargetPlan,
	submitFairnessProposal,
	submitOutputReportRecord,
	submitTargetPlanRecord,
	verifyOutputReport,
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
	const router = useRouter();
	const initialData = Route.useLoaderData() as OutputAchievementData & {
		proposals: FairnessProposal[];
	};

	// 4 Focused Tabs
	const [mainTab, setMainTab] = useState<
		"ringkasan" | "target" | "realisasi" | "fairness"
	>("ringkasan");

	const [selectedMonth, setSelectedMonth] = useState<number>(
		new Date().getMonth() + 1,
	);
	const [search, setSearch] = useState("");
	const [activeTabFilter, setActiveTabFilter] = useState<
		"all" | "valid" | "action_needed" | "confirmed" | "excluded"
	>("all");

	const [actionMessage, setActionMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const [isGuideOpen, setIsGuideOpen] = useState(false);
	const [isTargetDrawerOpen, setIsTargetDrawerOpen] = useState(false);
	const [isRealisasiDrawerOpen, setIsRealisasiDrawerOpen] = useState(false);
	const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);

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
	const [editingReport, setEditingReport] = useState<OutputReportRecord | null>(null);
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
	const [proposalBasis, setProposalBasis] = useState("Fairness treatment IKPA TA 2026");
	const [proposalNote, setProposalNote] = useState("");
	const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);

	// Open Period Realisasi Kinerja State
	const [isOpenPeriodMatrixOpen, setIsOpenPeriodMatrixOpen] = useState(false);
	const [isRequestingAdditionalOpen, setIsRequestingAdditionalOpen] = useState(false);
	const [additionalRequestReason, setAdditionalRequestReason] = useState("Kendala Teknis Aplikasi OM-SPAN / SAKTI");
	const [additionalRequestDocNumber, setAdditionalRequestDocNumber] = useState("");
	const [additionalRequestNote, setAdditionalRequestNote] = useState("");
	const [additionalSubmittedMonths, setAdditionalSubmittedMonths] = useState<number[]>([]);

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
				regulerDeadline: "2026-04-30",
				additionalDeadline: "2026-04-30",
				status: "closed" as "open_auto" | "open_additional" | "closed",
				notes: "Relaksasi pelaporan awal tahun s.d. 30 April 2026",
			},
			{
				month: 2,
				name: "Februari 2026",
				monthLabel: "Februari",
				regulerDeadline: "2026-04-30",
				additionalDeadline: "2026-04-30",
				status: "closed" as "open_auto" | "open_additional" | "closed",
				notes: "Relaksasi pelaporan awal tahun s.d. 30 April 2026",
			},
			{
				month: 3,
				name: "Maret 2026",
				monthLabel: "Maret",
				regulerDeadline: "2026-04-30",
				additionalDeadline: "2026-04-30",
				status: "closed" as "open_auto" | "open_additional" | "closed",
				notes: "Relaksasi pelaporan awal tahun s.d. 30 April 2026",
			},
			{
				month: 4,
				name: "April 2026",
				monthLabel: "April",
				regulerDeadline: "2026-05-12",
				additionalDeadline: "2026-05-31",
				status: "closed" as "open_auto" | "open_additional" | "closed",
				notes: "Buka sistem otomatis s.d. HK-7 Mei 2026 (12 Mei 2026)",
			},
			{
				month: 5,
				name: "Mei 2026",
				monthLabel: "Mei",
				regulerDeadline: "2026-06-10",
				additionalDeadline: "2026-06-30",
				status: "closed" as "open_auto" | "open_additional" | "closed",
				notes: "Buka sistem otomatis s.d. HK-7 Juni 2026 (10 Juni 2026)",
			},
			{
				month: 6,
				name: "Juni 2026",
				monthLabel: "Juni",
				regulerDeadline: "2026-07-09",
				additionalDeadline: "2026-07-31",
				status: "closed" as "open_auto" | "open_additional" | "closed",
				notes: "Buka sistem otomatis s.d. HK-7 Juli 2026 (9 Juli 2026)",
			},
			{
				month: 7,
				name: "Juli 2026",
				monthLabel: "Juli",
				regulerDeadline: "2026-08-11",
				additionalDeadline: "2026-08-31",
				status: "closed" as "open_auto" | "open_additional" | "closed",
				notes: "Buka sistem otomatis s.d. HK-7 Agustus 2026 (11 Agustus 2026)",
			},
			{
				month: 8,
				name: "Agustus 2026",
				monthLabel: "Agustus",
				regulerDeadline: "2026-09-09",
				additionalDeadline: "2026-09-30",
				status: "open_auto" as "open_auto" | "open_additional" | "closed",
				notes: "Buka sistem otomatis s.d. HK-7 September 2026 (9 September 2026)",
			},
			{
				month: 9,
				name: "September 2026",
				monthLabel: "September",
				regulerDeadline: "2026-10-09",
				additionalDeadline: "2026-10-31",
				status: "closed" as "open_auto" | "open_additional" | "closed",
				notes: "Buka sistem otomatis s.d. HK-7 Oktober 2026 (9 Oktober 2026)",
			},
			{
				month: 10,
				name: "Oktober 2026",
				monthLabel: "Oktober",
				regulerDeadline: "2026-11-10",
				additionalDeadline: "2026-11-30",
				status: "closed" as "open_auto" | "open_additional" | "closed",
				notes: "Buka sistem otomatis s.d. HK-7 November 2026 (10 November 2026)",
			},
			{
				month: 11,
				name: "November 2026",
				monthLabel: "November",
				regulerDeadline: "2026-12-09",
				additionalDeadline: "2026-12-31",
				status: "closed" as "open_auto" | "open_additional" | "closed",
				notes: "Buka sistem otomatis s.d. HK-7 Desember 2026 (9 Desember 2026)",
			},
			{
				month: 12,
				name: "Desember 2026",
				monthLabel: "Desember",
				regulerDeadline: "2027-01-13",
				additionalDeadline: "2027-01-31",
				status: "closed" as "open_auto" | "open_additional" | "closed",
				notes: "Buka sistem otomatis s.d. HK-7 Januari 2027 (13 Januari 2027)",
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
				notes: "10 hari kerja di awal triwulan III (Juli)",
			},
			{
				quarter: 4,
				name: "Triwulan IV Tahun 2026",
				label: "Triwulan IV",
				periodText: "s.d. 14 Oktober 2026",
				opensAt: "2026-10-01",
				closesAt: "2026-10-14",
				status: "scheduled" as "scheduled" | "open" | "closed",
				notes: "10 hari kerja di awal triwulan IV (Oktober)",
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

	const activeWindow = useMemo(() => {
		return (
			targetWindowsList.find((w) => w.status === "open") ||
			targetWindowsList.find((w) => w.status === "scheduled") ||
			targetWindowsList[targetWindowsList.length - 1] ||
			null
		);
	}, [targetWindowsList]);

	const monthData = useMemo(() => {
		return initialData.outputs.filter((item) => item.month === selectedMonth);
	}, [initialData.outputs, selectedMonth]);

	const filteredData = useMemo(() => {
		return monthData.filter((item) => {
			const matchesSearch =
				item.roCode.toLowerCase().includes(search.toLowerCase()) ||
				(item.roName && item.roName.toLowerCase().includes(search.toLowerCase()));

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
						(v) => v.status === "blocking" || v.status === "confirmation_required",
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

	const avgTpcro =
		evaluatedCount > 0
			? monthData
					.filter((i) => i.eligibility?.assessmentStatus !== "excluded")
					.reduce((s, i) => s + (Number.parseFloat(i.tpcro) || 0), 0) /
				evaluatedCount
			: 0;

	const nkkwScore =
		engineResult.subComponents?.find((s) => s.key === "timeliness")?.score ?? "—";
	const nkcroScore =
		engineResult.subComponents?.find((s) => s.key === "achievement")?.score ?? "—";
	const finalScore = engineResult.score ?? "—";
	const weightedContribution = engineResult.weightedContribution ?? "—";

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
					(v) => v.status === "blocking" || v.status === "confirmation_required",
				)),
	).length;

	const monthConfirmedPpkCount = monthData.filter(
		(i) => i.confirmed || i.status === "confirmed",
	).length;

	const targetFormValidation = useMemo(() => {
		const volDipa = Number.parseFloat(targetVolumeDipa) || 0;
		const sumRvro = targetMonthlyValues.reduce((acc, v) => acc + (Number.parseFloat(v.targetRvro) || 0), 0);
		const sumPcro = targetMonthlyValues.reduce((acc, v) => acc + (Number.parseFloat(v.targetPcro) || 0), 0);
		const isRvroEqual = Math.abs(sumRvro - volDipa) < 0.001;
		const isPcro100 = Math.abs(sumPcro - 100) < 0.01;
		const integerCheck = targetIsInteger
			? targetMonthlyValues.every((v) => Number.isInteger(Number.parseFloat(v.targetRvro) || 0))
			: true;

		return {
			volDipa,
			sumRvro,
			sumPcro,
			isRvroEqual,
			isPcro100,
			integerCheck,
			isValid: isRvroEqual && isPcro100 && integerCheck && !!targetRoCode.trim(),
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
				description: "RO Khusus ini tidak menjadi objek penilaian (dikeluarkan dari pembilang & penyebut).",
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
			description: "Januari–November dengan PCRO < 100%: Menggunakan Formula 1 (PCRO / Target TPCRO).",
			calculationStep: `min((${formatDynamicNumber(parsedPc, 2)}% / ${formatDynamicNumber(parsedTpc, 2)}%) × 100, 100) = ${capped.toFixed(2)}`,
		};
	}, [formRoCode, formMonth, formRvroCumulative, formVolumeDipa, formPcroCumulative, formTpcro, initialData.publishedPolicies]);

	// Live Validation Engine (Rules 00–08) Execution on Drawer Inputs
	const liveValidationResults = useMemo(() => {
		const parsedRv = Number.parseFloat(formRvroCumulative) || 0;
		const parsedVol = Number.parseFloat(formVolumeDipa) || 0;
		const parsedPc = Number.parseFloat(formPcroCumulative) || 0;
		const parsedTpc = Number.parseFloat(formTpcro) || 0;
		const ppaVal = activeRoBudgetRealization
			? Number(activeRoBudgetRealization.cumulativePpaPercentage || activeRoBudgetRealization.ppaPercentage)
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
		() => liveValidationResults.filter((r) => r.status === "failed" && r.severity === "blocking"),
		[liveValidationResults],
	);

	const liveConfirmationRequired = useMemo(
		() => liveValidationResults.filter((r) => r.status === "failed" && r.severity === "confirmation_required"),
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

	const handleSaveTarget = async () => {
		if (!targetFormValidation.isValid) return;
		setIsSubmitting(true);
		setActionMessage(null);
		setErrorMessage(null);

		try {
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

			await saveTargetPlan({
				roCode: targetRoCode.trim().toUpperCase(),
				roName: targetRoName.trim() || undefined,
				volumeDipa: String(targetFormValidation.volDipa),
				unit: targetUnit.trim() || "Layanan",
				isIntegerUnit: targetIsInteger,
				isPriorityNational: targetIsPn,
				quarter: targetQuarter,
				monthlyTargets: monthlyItems,
			});

			setActionMessage(
				`Target Kinerja 12 Bulan RO ${targetRoCode.trim().toUpperCase()} (${
					targetUpdateType === "dipa_revision"
						? "Jalur Perubahan DIPA"
						: targetUpdateType === "special_condition"
							? "Kondisi Khusus"
							: "Jalur Reguler"
				}${targetChangeReason ? ` - ${targetChangeReason}` : ""}) berhasil disimpan.`,
			);
			setIsTargetDrawerOpen(false);
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(err instanceof Error ? err.message : "Gagal menyimpan target kinerja.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSubmitTargetPlan = async (planId: string, code: string) => {
		try {
			await submitTargetPlanRecord(planId);
			setActionMessage(`Target Kinerja ${code} berhasil diaktifkan.`);
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(err instanceof Error ? err.message : "Gagal mengaktifkan target.");
		}
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
			setFormRvroIncremental(stripTrailingDecimals(report.rvroIncremental || report.rvro));
			setFormPcroIncremental(stripTrailingDecimals(report.pcroIncremental || report.pcro));
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
		const prevReport = initialData.outputs.find(
			(o) => o.roCode.toUpperCase() === formRoCode.toUpperCase() && o.month === formMonth - 1,
		);
		const prevCum = prevReport ? Number.parseFloat(prevReport.rvro) || 0 : 0;
		setFormRvroCumulative(String(prevCum + inc));
	};

	const handleIncrementalPcroChange = (val: string) => {
		setFormPcroIncremental(val);
		const inc = Number.parseFloat(val) || 0;
		const prevReport = initialData.outputs.find(
			(o) => o.roCode.toUpperCase() === formRoCode.toUpperCase() && o.month === formMonth - 1,
		);
		const prevCum = prevReport ? Number.parseFloat(prevReport.pcro) || 0 : 0;
		setFormPcroCumulative(String(Math.min(100, Math.round((prevCum + inc) * 100) / 100)));
	};

	const handleSaveRealisasi = async (
		status: "draft" | "submitted" | "confirmed" = "draft",
	) => {
		if (!formRoCode.trim()) return;
		setIsSubmitting(true);
		setActionMessage(null);
		setErrorMessage(null);

		try {
			await saveOutputReport({
				id: editingReport?.id,
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
				evidenceDocumentUrl: formEvidenceUrl.trim() || undefined,
				achievementReference: formAchievementRef.trim() || undefined,
				operatorNote: formOperatorNote.trim() || undefined,
				ppkValidationNote: formPpkValidationNote.trim() || undefined,
			});

			setActionMessage(
				`Realisasi Capaian Output ${formRoCode.trim().toUpperCase()} Bulan ${MONTH_NAMES[formMonth - 1]} berhasil disimpan.`,
			);
			setIsRealisasiDrawerOpen(false);
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(err instanceof Error ? err.message : "Gagal menyimpan realisasi output.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSubmitReport = async (reportId: string, code: string) => {
		try {
			await submitOutputReportRecord(reportId);
			setActionMessage(`Laporan output ${code} berhasil dikirim ke PPK.`);
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(err instanceof Error ? err.message : "Gagal mengirim laporan.");
		}
	};

	const handleVerifyReport = async (reportId: string, code: string) => {
		try {
			await verifyOutputReport(reportId);
			setActionMessage(`Output ${code} berhasil dikonfirmasi PPK.`);
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(err instanceof Error ? err.message : "Gagal mengonfirmasi laporan.");
		}
	};

	const handleDeleteReport = async (reportId: string) => {
		if (!confirm("Hapus catatan realisasi capaian output ini?")) return;
		try {
			await removeOutputReport(reportId);
			setActionMessage("Catatan output berhasil dihapus.");
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(err instanceof Error ? err.message : "Gagal menghapus data.");
		}
	};

	const handleOpenFairnessModal = (item?: OutputReportRecord | string) => {
		if (item && typeof item === "object") {
			const uCode = item.roCode.trim().toUpperCase();
			setProposalRoCode(uCode);
			setProposalMonth(item.month);
			const isCurrentlyExcluded = item.eligibility?.assessmentStatus === "excluded";
			setProposalIsExcluded(isCurrentlyExcluded);
			setProposalCategory(item.eligibility?.exclusionCategory || "ro_khusus");
			setProposalBasis(item.eligibility?.policyReference || "Fairness treatment IKPA TA 2026");
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

	const handleSubmitProposal = async () => {
		if (!proposalRoCode.trim()) return;
		setIsSubmittingProposal(true);
		try {
			if (proposalIsExcluded) {
				if (!proposalBasis.trim()) return;
				await submitFairnessProposal({
					roCode: proposalRoCode.trim().toUpperCase(),
					month: proposalMonth,
					category: proposalCategory,
					basisReference: proposalBasis.trim(),
					operatorNote: proposalNote.trim() || undefined,
				});
				setActionMessage(`Pengecualian fairness untuk RO ${proposalRoCode.trim().toUpperCase()} berhasil diajukan.`);
			} else {
				await removeFairnessProposal({
					roCode: proposalRoCode.trim().toUpperCase(),
					month: proposalMonth,
				});
				setActionMessage(`Pengecualian fairness RO ${proposalRoCode.trim().toUpperCase()} dinonaktifkan.`);
			}
			setIsProposalModalOpen(false);
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(err instanceof Error ? err.message : "Gagal menyimpan perlakuan fairness.");
		} finally {
			setIsSubmittingProposal(false);
		}
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
							<span className="font-mono font-bold text-foreground">{item.roCode}</span>
							{isPn && (
								<span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-700 uppercase border border-amber-500/20">
									PN
								</span>
							)}
						</div>
						<p className="text-[11px] text-muted-foreground line-clamp-1">{item.roName || `Rincian Output Bulan ${MONTH_NAMES[item.month - 1]}`}</p>
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
							<span className="inline-flex items-center gap-1 rounded-md border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-700 uppercase">
								<ShieldAlert className="size-3" />
								<span>Dikecualikan</span>
							</span>
							<span className="text-[10px] text-purple-600/80 font-medium">RO Khusus</span>
						</div>
					);
				}
				return (
					<span className="inline-flex items-center gap-1 rounded-md border border-success/20 bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success uppercase">
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
					<span className="font-semibold text-foreground">
						{formatDynamicNumber(item.rvro, 0)} / {formatDynamicNumber(item.volumeDipa, 0)}
					</span>
					{item.rvroIncremental && (
						<span className="text-[10px] text-muted-foreground block">+ {item.rvroIncremental} bln ini</span>
					)}
				</div>
			),
		},
		{
			key: "pcroVsTpcro",
			header: "Progres Fisik (PCRO / Target)",
			render: (item) => (
				<div>
					<span className="font-semibold text-foreground">{formatDynamicPercent(item.pcro)}</span>
					<span className="text-[10px] text-muted-foreground block">Target: {formatDynamicPercent(item.tpcro)}</span>
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
						<span className="font-semibold text-foreground">{formatDynamicPercent(ppaVal)}</span>
						{hasAnomaly && (
							<div className="flex items-center gap-1 text-[10px] font-bold text-danger mt-0.5" title={item.anomalyResult?.message}>
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
				const confirmReq = results.find((r) => r.status === "confirmation_required");
				const correctable = results.find((r) => r.status === "correctable");

				if (blocking) {
					return (
						<span className="inline-flex items-center gap-1 rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-bold text-danger border border-danger/20" title={blocking.message}>
							<AlertCircle className="size-3" />
							<span>{blocking.ruleCode} (Blocking)</span>
						</span>
					);
				}
				if (confirmReq) {
					return (
						<span className="inline-flex items-center gap-1 rounded bg-warning/10 px-1.5 py-0.5 text-[10px] font-bold text-warning border border-warning/20" title={confirmReq.message}>
							<AlertTriangle className="size-3" />
							<span>{confirmReq.ruleCode} (Konfirmasi)</span>
						</span>
					);
				}
				if (correctable) {
					return (
						<span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-500/20" title={correctable.message}>
							<Info className="size-3" />
							<span>{correctable.ruleCode} (Koreksi)</span>
						</span>
					);
				}
				return (
					<span className="inline-flex items-center gap-1 rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-bold text-success border border-success/20">
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
				if (isExcluded) return <span className="text-muted-foreground font-mono">—</span>;
				if (!item.reportedAt) {
					return <span className="rounded bg-warning/10 px-2 py-0.5 text-[10px] font-bold text-warning">Belum Lapor</span>;
				}
				const rDate = new Date(item.reportedAt).toISOString().slice(0, 10);
				const dDate = item.deadlineDate || canonicalDeadline;
				const isTimely = rDate <= dDate;
				return (
					<div>
						<span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${isTimely ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
							{isTimely ? "Tepat (100)" : "Terlambat (0)"}
						</span>
						<p className="text-[10px] text-muted-foreground mt-0.5">{formatDateDDMMYYYY(item.reportedAt)}</p>
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
								? "bg-success/10 text-success border border-success/20"
								: isSubmitted
									? "bg-blue-500/10 text-blue-700 border border-blue-500/20"
									: "bg-warning/10 text-warning border border-warning/20"
						}`}
					>
						{isConfirmed ? "Terkonfirmasi PPK" : isSubmitted ? "Terkirim" : "Draft"}
					</span>
				);
			},
		},
		{
			key: "actions",
			header: "Aksi",
			render: (item) => (
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={() => handleOpenCreateRealisasi(item)}
						className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-surface-muted transition"
					>
						<Edit className="size-3 text-primary" />
						<span>Edit</span>
					</button>
					{item.status === "draft" && (
						<button
							type="button"
							onClick={() => handleSubmitReport(item.id, item.roCode)}
							className="inline-flex items-center gap-1 rounded-lg bg-blue-500/10 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-500/20 transition"
						>
							<Send className="size-3" />
							<span>Kirim</span>
						</button>
					)}
					{!item.confirmed && item.status !== "draft" && (
						<button
							type="button"
							onClick={() => handleVerifyReport(item.id, item.roCode)}
							className="inline-flex items-center gap-1 rounded-lg bg-success/10 px-2 py-1 text-[11px] font-semibold text-success hover:bg-success/20 transition"
						>
							<FileCheck className="size-3" />
							<span>Konfirmasi</span>
						</button>
					)}
					<button
						type="button"
						onClick={() => handleOpenFairnessModal(item)}
						className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold border border-border bg-surface text-foreground hover:bg-surface-muted"
					>
						<Scale className="size-3 text-purple-600" />
					</button>
					<button
						type="button"
						onClick={() => handleDeleteReport(item.id)}
						className="inline-flex items-center rounded-lg p-1 text-danger hover:bg-danger/10 transition"
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
			header: "Kode & Uraian RO",
			render: (plan) => (
				<div>
					<div className="flex items-center gap-1.5">
						<span className="font-mono font-bold text-foreground">{plan.roCode}</span>
						{plan.isPriorityNational && (
							<span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-700 uppercase border border-amber-500/20">
								PN
							</span>
						)}
					</div>
					<p className="text-[11px] text-muted-foreground line-clamp-1">{plan.roName || "—"}</p>
				</div>
			),
		},
		{
			key: "volume",
			header: "Volume DIPA & Satuan",
			render: (plan) => (
				<span className="font-semibold text-foreground">
					{formatDynamicNumber(plan.volumeDipa, 0)} {plan.unit || "Layanan"}
				</span>
			),
		},
		{
			key: "version",
			header: "Versi & Triwulan",
			render: (plan) => (
				<div>
					<span className="font-bold text-foreground">Versi {plan.version}</span>
					<span className="text-[10px] text-muted-foreground block">{plan.quarter ? `TW ${plan.quarter}` : "Awal Tahun"}</span>
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
							? "bg-success/10 text-success border border-success/20"
							: plan.status === "submitted"
								? "bg-blue-500/10 text-blue-700 border border-blue-500/20"
								: "bg-warning/10 text-warning border border-warning/20"
					}`}
				>
					{plan.status === "active" ? "Aktif" : plan.status === "submitted" ? "Terkirim" : "Draft"}
				</span>
			),
		},
		{
			key: "actions",
			header: "Aksi",
			render: (plan) => (
				<div className="flex items-center gap-1.5">
					<button
						type="button"
						onClick={() => handleOpenCreateTarget(plan)}
						className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-surface-muted transition"
					>
						<Edit className="size-3 text-primary" />
						<span>Mutakhirkan</span>
					</button>
					{plan.status === "draft" && (
						<button
							type="button"
							onClick={() => handleSubmitTargetPlan(plan.id, plan.roCode)}
							className="inline-flex items-center gap-1 rounded-lg bg-success/10 px-2 py-1 text-[11px] font-semibold text-success hover:bg-success/20 transition"
						>
							<Send className="size-3" />
							<span>Aktifkan</span>
						</button>
					)}
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
								Formula Resmi 2026:{" "}
								<strong className="text-foreground">
									IKPA-CO = (NK-ROKW × 30%) + (NK-CRO × 70%)
								</strong>
								. Target 12 Bulan, Realisasi Bulanan, Validasi Engine 00–08, dan Fairness Treatment.
							</p>
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<button
							type="button"
							onClick={() => setIsGuideOpen(true)}
							className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition shadow-xs"
						>
							<BookOpen className="size-3.5 text-primary" />
							<span>Panduan PER-5</span>
						</button>
					</div>
				</div>

				{/* 4 Focused Navigation Tabs */}
				<div className="flex flex-wrap items-center gap-2 border-b border-border pb-2 text-xs">
					<button
						type="button"
						onClick={() => setMainTab("ringkasan")}
						className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-semibold transition ${
							mainTab === "ringkasan"
								? "bg-primary text-primary-foreground shadow-xs"
								: "text-muted-foreground hover:text-foreground hover:bg-surface-muted"
						}`}
					>
						<Sparkles className="size-3.5" />
						<span>Ringkasan & Anomali</span>
					</button>

					<button
						type="button"
						onClick={() => setMainTab("target")}
						className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-semibold transition ${
							mainTab === "target"
								? "bg-primary text-primary-foreground shadow-xs"
								: "text-muted-foreground hover:text-foreground hover:bg-surface-muted"
						}`}
					>
						<Calendar className="size-3.5" />
						<span>Target Kinerja 12 Bulan</span>
						<span className="rounded-full bg-background/20 px-1.5 py-0.2 text-[10px] font-bold">
							{(initialData.targetPlans || []).length}
						</span>
					</button>

					<button
						type="button"
						onClick={() => setMainTab("realisasi")}
						className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-semibold transition ${
							mainTab === "realisasi"
								? "bg-primary text-primary-foreground shadow-xs"
								: "text-muted-foreground hover:text-foreground hover:bg-surface-muted"
						}`}
					>
						<TrendingUp className="size-3.5" />
						<span>Realisasi Kinerja Bulanan</span>
						<span className="rounded-full bg-background/20 px-1.5 py-0.2 text-[10px] font-bold">
							{monthData.length}
						</span>
						{monthActionNeededCount > 0 && (
							<span className="rounded-full bg-warning/20 text-warning px-1.5 py-0.2 text-[10px] font-bold">
								{monthActionNeededCount}
							</span>
						)}
					</button>

					<button
						type="button"
						onClick={() => setMainTab("fairness")}
						className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-semibold transition ${
							mainTab === "fairness"
								? "bg-purple-600 text-white shadow-xs"
								: "text-muted-foreground hover:text-foreground hover:bg-surface-muted"
						}`}
					>
						<Scale className="size-3.5" />
						<span>Fairness Treatment</span>
						<span className="rounded-full bg-background/20 px-1.5 py-0.2 text-[10px] font-bold">
							{excludedCount}
						</span>
					</button>
				</div>

				{actionMessage && (
					<div className="flex items-center gap-2.5 rounded-xl border border-success/30 bg-success/10 p-4 text-xs font-semibold text-success shadow-xs">
						<CheckCircle2 className="size-4 shrink-0" />
						<p>{actionMessage}</p>
					</div>
				)}
				{errorMessage && (
					<div role="alert" className="flex items-center gap-2.5 rounded-xl border border-danger/30 bg-danger/10 p-4 text-xs font-semibold text-danger shadow-xs">
						<AlertCircle className="size-4 shrink-0" />
						<p>{errorMessage}</p>
					</div>
				)}

				{/* TAB 1: RINGKASAN */}
				{mainTab === "ringkasan" && (
					<div className="space-y-6">
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

						{/* 4 Cards */}
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1.5">
								<div className="flex items-center justify-between text-muted-foreground">
									<span className="text-xs font-semibold">RO Objek Penilaian</span>
									<Target className="size-4 text-primary" />
								</div>
								<p className="text-xl font-bold text-foreground">
									{evaluatedCount} / {totalRoMonth} RO
								</p>
								<p className="text-[11px] text-muted-foreground">
									{excludedCount > 0 ? (
										<span className="text-purple-600 font-medium">{excludedCount} RO Dikecualikan</span>
									) : (
										"100% RO Eligible Dinilai"
									)}
								</p>
							</div>

							<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1.5">
								<div className="flex items-center justify-between text-muted-foreground">
									<span className="text-xs font-semibold">Ketepatan Waktu (NK-ROKW 30%)</span>
									<Clock className="size-4 text-warning" />
								</div>
								<p className="text-xl font-bold text-foreground">
									{nkkwScore} <span className="text-xs font-normal text-muted-foreground">/ 100</span>
								</p>
								<p className="text-[11px] text-muted-foreground">
									{timelyCount} Tepat · {lateCount} Terlambat · {pendingTimelinessCount} Belum
								</p>
							</div>

							<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1.5">
								<div className="flex items-center justify-between text-muted-foreground">
									<span className="text-xs font-semibold">Capaian RO (NK-CRO 70%)</span>
									<Percent className="size-4 text-success" />
								</div>
								<p className="text-xl font-bold text-foreground">
									{nkcroScore} <span className="text-xs font-normal text-muted-foreground">/ 100</span>
								</p>
								<p className="text-[11px] text-muted-foreground">
									Rata-rata PCRO: {formatDynamicPercent(avgPcro)} (TPCRO: {formatDynamicPercent(avgTpcro)})
								</p>
							</div>

							<div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-xs space-y-1.5">
								<div className="flex items-center justify-between text-primary">
									<span className="text-xs font-bold">Nilai IKPA-CO & Kontribusi</span>
									<Award className="size-4 text-primary" />
								</div>
								<p className="text-xl font-extrabold text-primary">
									{finalScore} <span className="text-xs font-normal text-muted-foreground">/ 100</span>
								</p>
								<p className="text-[11px] font-semibold text-foreground">
									Kontribusi: +{weightedContribution} poin ke Satker
								</p>
							</div>
						</div>

						{/* Open Period Reminder & Guidance Banner */}
						<div className="rounded-2xl border border-border bg-background p-4 sm:p-5 shadow-xs space-y-3">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div className="flex items-center gap-3">
									<div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
										<Clock className="size-5" />
									</div>
									<div>
										<div className="flex items-center gap-2">
											<p className="text-xs sm:text-sm font-bold text-foreground">
												Open Period Realisasi Bulan {MONTH_NAMES[selectedMonth - 1]}:{" "}
												<span className="text-primary underline">
													{formatDateDDMMYYYY(canonicalDeadline)}
												</span>{" "}
												<span className="text-xs font-semibold text-muted-foreground">
													({selectedMonth <= 3 ? "Relaksasi s.d. 30 April" : "Hari Kerja ke-7 M+1"})
												</span>
											</p>
											<span
												className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
													currentMonthOpenPeriod.status === "open_auto"
														? "bg-success/10 text-success"
														: currentMonthOpenPeriod.status === "open_additional"
															? "bg-warning/10 text-warning"
															: "bg-surface-muted text-muted-foreground"
												}`}
											>
												{currentMonthOpenPeriod.status === "open_auto"
													? "🟢 Buka Sistem Otomatis"
													: currentMonthOpenPeriod.status === "open_additional"
														? "🟡 Periode Tambahan KPPN"
														: "⚪ Ditutup"}
											</span>
										</div>
										<p className="text-[11px] text-muted-foreground pt-0.5">
											{currentMonthOpenPeriod.notes} • Periode Tambahan s.d.{" "}
											<strong className="text-foreground">{formatDateDDMMYYYY(currentMonthOpenPeriod.additionalDeadline)}</strong>
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
										<span>{isOpenPeriodMatrixOpen ? "Tutup Jadwal 12 Bulan" : "Jadwal 12 Bulan Open Period"}</span>
									</button>
									<button
										type="button"
										onClick={() => {
											setAdditionalRequestDocNumber("");
											setAdditionalRequestNote("");
											setIsRequestingAdditionalOpen(true);
										}}
										className="inline-flex items-center gap-1.5 rounded-lg border border-warning/30 bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning transition hover:bg-warning/20 shadow-xs"
									>
										<Clock className="size-3.5" />
										<span>Ajukan Buka Tambahan ke KPPN</span>
									</button>
								</div>
							</div>

							{/* Period Rules 2-Box */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-border/60 text-xs">
								<div className="rounded-xl border border-success/20 bg-success/5 p-3 space-y-1">
									<p className="font-bold text-success flex items-center gap-1.5">
										<span className="flex size-4 items-center justify-center rounded-full bg-success text-success-foreground text-[10px] font-bold">a</span>
										Open Period Reguler (Buka Sistem Otomatis)
									</p>
									<p className="text-[11px] text-muted-foreground leading-relaxed">
										Awal bulan berikutnya s.d. <strong>Hari Kerja ke-7 (HK-7)</strong> bulan berikutnya. Sistem terbuka otomatis untuk seluruh satker tanpa syarat dispensasi.
									</p>
								</div>
								<div className="rounded-xl border border-warning/20 bg-warning/5 p-3 space-y-1">
									<p className="font-bold text-warning flex items-center gap-1.5">
										<span className="flex size-4 items-center justify-center rounded-full bg-warning text-warning-foreground text-[10px] font-bold">b</span>
										Open Period Tambahan KPPN (Kejadian Khusus)
									</p>
									<p className="text-[11px] text-muted-foreground leading-relaxed">
										Setelah HK-7 s.d. <strong>akhir bulan berikutnya</strong>, sepanjang telah dibuka periode pelaporan tambahan oleh Admin KPPN (Aplikasi MyIntress / Simulator IKPA).
									</p>
								</div>
							</div>

							{/* Status counters */}
							<div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
								<div className="flex items-center gap-2">
									<span className="rounded-full bg-success/10 px-2.5 py-0.5 font-semibold text-success">{timelyCount} RO Tepat Waktu</span>
									{lateCount > 0 && <span className="rounded-full bg-danger/10 px-2.5 py-0.5 font-semibold text-danger">{lateCount} RO Terlambat</span>}
									{pendingTimelinessCount > 0 && <span className="rounded-full bg-warning/10 px-2.5 py-0.5 font-semibold text-warning">{pendingTimelinessCount} RO Belum Dilaporkan</span>}
								</div>
								{additionalSubmittedMonths.includes(selectedMonth) && (
									<span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
										<CheckCircle2 className="size-3" />
										Permohonan Periode Tambahan Bulan {MONTH_NAMES[selectedMonth - 1]} Telah Terkirim ke KPPN
									</span>
								)}
							</div>
						</div>

						{/* 12-Month Open Period Matrix Dropdown Panel */}
						{isOpenPeriodMatrixOpen && (
							<div className="rounded-2xl border border-primary/20 bg-surface p-4 shadow-sm space-y-3">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<Calendar className="size-4.5 text-primary" />
										<h4 className="text-xs sm:text-sm font-bold text-foreground">
											Jadwal Batas Akhir Periode Buka Sistem Pelaporan Nasional (Open Period TA {initialData.year})
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
												<th className="py-2.5 pl-3 pr-2 w-10 text-center">No.</th>
												<th className="px-3 py-2.5 font-bold text-foreground">Periode Pelaporan Data Realisasi</th>
												<th className="px-3 py-2.5">Batas Akhir Open Period Reguler (Buka Sistem Otomatis)</th>
												<th className="px-3 py-2.5">Batas Akhir Periode Tambahan KPPN</th>
												<th className="px-3 py-2.5 text-center">Status Akses</th>
												<th className="py-2.5 pl-2 pr-3 text-right">Aksi</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-border/60">
											{realizationOpenPeriodsList.map((item, idx) => (
												<tr
													key={item.month}
													className={`transition hover:bg-surface-muted/50 ${
														item.month === selectedMonth ? "bg-primary/5 font-medium" : ""
													}`}
												>
													<td className="py-2.5 pl-3 pr-2 text-center text-muted-foreground">
														{idx + 1}
													</td>
													<td className="px-3 py-2.5">
														<span className="font-bold text-foreground">{item.name}</span>
														{item.month === selectedMonth && (
															<span className="ml-2 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
																Bulan Aktif
															</span>
														)}
													</td>
													<td className="px-3 py-2.5 font-semibold text-primary">
														{formatDateDDMMYYYY(item.regulerDeadline)}
													</td>
													<td className="px-3 py-2.5 text-muted-foreground">
														{formatDateDDMMYYYY(item.additionalDeadline)}
													</td>
													<td className="px-3 py-2.5 text-center">
														<span
															className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
																item.status === "open_auto"
																	? "bg-success/10 text-success"
																	: item.status === "open_additional"
																		? "bg-warning/10 text-warning"
																		: "bg-surface-muted text-muted-foreground"
															}`}
														>
															{item.status === "open_auto"
																? "Buka Otomatis"
																: item.status === "open_additional"
																	? "Tambahan KPPN"
																	: "Ditutup"}
														</span>
													</td>
													<td className="py-2.5 pl-2 pr-3 text-right">
														<button
															type="button"
															onClick={() => {
																setSelectedMonth(item.month);
																setIsOpenPeriodMatrixOpen(false);
															}}
															className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold text-primary hover:bg-surface-muted"
														>
															<span>Buka Bulan</span>
															<ArrowRight className="size-3" />
														</button>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						)}

						{/* Quick Banners */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-2">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2 font-bold text-foreground text-xs">
										<Calendar className="size-4 text-primary" />
										<span>Pemutakhiran Target Triwulanan (10 HK Awal TW)</span>
									</div>
									<span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${activeWindow?.status === "open" ? "bg-success/10 text-success" : activeWindow?.status === "scheduled" ? "bg-primary/10 text-primary" : "bg-surface-muted text-muted-foreground"}`}>
										{activeWindow?.status === "open" ? "Terbuka" : activeWindow?.status === "scheduled" ? "Terjadwal" : "Ditutup"}
									</span>
								</div>
								<p className="text-xs text-muted-foreground">
									{activeWindow ? `${activeWindow.name}: ${activeWindow.periodText} (${activeWindow.notes})` : "Pemutakhiran target dilakukan 10 hari kerja di awal triwulan."}
								</p>
								<div className="flex items-center gap-3 pt-1">
									<button type="button" onClick={() => setMainTab("target")} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
										<span>Jadwal & Kelola Target</span>
										<ArrowRight className="size-3" />
									</button>
									<a href="/operator/reminders" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline">
										<Bell className="size-3" />
										<span>Atur Reminder</span>
									</a>
								</div>
							</div>

							<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-2">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2 font-bold text-foreground text-xs">
										<ShieldAlert className="size-4 text-warning" />
										<span>Validasi Engine & Anomali</span>
									</div>
									<span className="text-xs text-muted-foreground font-semibold">{monthBlockingCount + monthConfirmationCount} Catatan Bulan Ini</span>
								</div>
								<p className="text-xs text-muted-foreground">
									{monthBlockingCount} Blocking Issues · {monthConfirmationCount} Butuh Konfirmasi PPK.
								</p>
								<button
									type="button"
									onClick={() => {
										setMainTab("realisasi");
										setActiveTabFilter("action_needed");
									}}
									className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline pt-1"
								>
									<span>Buka Realisasi & Validasi</span>
									<ArrowRight className="size-3" />
								</button>
							</div>
						</div>
					</div>
				)}

				{/* TAB 2: TARGET KINERJA 12 BULAN */}
				{mainTab === "target" && (
					<div className="space-y-4">
						{/* Reminder & Jadwal Pemutakhiran Proyeksi Target Output TA 2026 */}
						<div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-surface-muted p-4 sm:p-5 space-y-4 shadow-xs">
							<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
								<div className="flex items-start sm:items-center gap-3">
									<div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
										<Clock className="size-4.5" />
									</div>
									<div className="space-y-0.5">
										<h3 className="text-sm font-bold text-foreground">
											Reminder & Jadwal Pemutakhiran Target Kinerja Output TA 2026
										</h3>
										<p className="text-xs text-muted-foreground">
											Data proyeksi target capaian output ini dapat dilakukan pemutakhiran sesuai dengan periode yang telah ditentukan yaitu <strong className="text-foreground font-semibold">10 hari kerja di awal triwulan</strong>.
										</p>
									</div>
								</div>
								<a
									href="/operator/reminders"
									className="inline-flex items-center gap-1.5 self-start sm:self-auto shrink-0 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition shadow-2xs"
								>
									<Bell className="size-3.5 text-primary" />
									<span>Kelola Notifikasi Reminder</span>
									<ArrowRight className="size-3 text-muted-foreground" />
								</a>
							</div>

							{/* 4-Quarter Schedule Cards Grid */}
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
								{targetWindowsList.map((win) => (
									<div
										key={win.quarter}
										className={`relative rounded-xl border p-3.5 space-y-2 transition ${
											win.status === "open"
												? "border-success/40 bg-success/5 shadow-xs ring-1 ring-success/20"
												: win.status === "scheduled"
													? "border-primary/40 bg-primary/5 shadow-xs ring-1 ring-primary/20"
													: "border-border bg-background/80"
										}`}
									>
										<div className="flex items-center justify-between gap-1.5">
											<span className="text-xs font-bold text-foreground">
												{win.name}
											</span>
											<span
												className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
													win.status === "open"
														? "bg-success/15 text-success"
														: win.status === "scheduled"
															? "bg-primary/15 text-primary"
															: "bg-surface-muted text-muted-foreground"
												}`}
											>
												{win.status === "open"
													? "Terbuka"
													: win.status === "scheduled"
														? "Terjadwal"
														: "Ditutup"}
											</span>
										</div>
										<div className="space-y-0.5">
											<p className="text-[11px] text-muted-foreground font-medium">
												Periode Pengisian & Pelaporan:
											</p>
											<p className="text-xs font-bold text-foreground">
												{win.periodText}
											</p>
										</div>
										<p className="text-[10px] text-muted-foreground border-t border-border/50 pt-1.5 leading-snug">
											{win.notes}
										</p>
									</div>
								))}
							</div>

							{/* DIPA Revision Flexibility Note */}
							<div className="rounded-xl border border-primary/20 bg-background/90 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
								<div className="flex items-center gap-2">
									<Sparkles className="size-4 text-primary shrink-0" />
									<span className="text-muted-foreground">
										<strong className="text-foreground">Fleksibilitas Revisi DIPA:</strong> Apabila terdapat perubahan DIPA yang mempengaruhi volume target atau jumlah RO, Operator satker dapat memutakhirkan target mandiri kapan saja dengan memilih jalur <em className="text-primary font-semibold">Perubahan DIPA</em>.
									</span>
								</div>
								<button
									type="button"
									onClick={() => {
										handleOpenCreateTarget();
										setTargetUpdateType("dipa_revision");
									}}
									className="inline-flex items-center gap-1.5 self-start sm:self-auto shrink-0 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition"
								>
									<span>+ Pemutakhiran Jalur DIPA</span>
								</button>
							</div>
						</div>

						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<h2 className="text-base font-bold text-foreground">Target Kinerja Fisik Rincian Output (Jan–Des)</h2>
								<p className="text-xs text-muted-foreground">
									Perencanaan target fisik 12 bulan per RO. Distribusi target volume harus sama dengan DIPA dan total PCRO harus 100%.
								</p>
							</div>
							<button
								type="button"
								onClick={() => handleOpenCreateTarget()}
								className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover transition shadow-xs"
							>
								<Plus className="size-4" />
								<span>Tambah / Mutakhirkan Target RO</span>
							</button>
						</div>

						<DomainDataTable
							title="Daftar Target Kinerja Rincian Output TA 2026"
							data={initialData.targetPlans || []}
							columns={targetColumns}
							totalCount={(initialData.targetPlans || []).length}
						/>
					</div>
				)}

				{/* TAB 3: REALISASI KINERJA BULANAN */}
				{mainTab === "realisasi" && (
					<div className="space-y-4">
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
								Tenggat 5 HK: <strong className="text-foreground">{formatDateDDMMYYYY(canonicalDeadline)}</strong>
							</div>
						</div>

						{/* Validation & Workflow Status Strip */}
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
							<div className="rounded-xl border border-border bg-background p-3 space-y-1">
								<span className="text-[11px] text-muted-foreground">Total RO Bulan Ini</span>
								<p className="text-base font-bold text-foreground">{totalRoMonth} RO</p>
								<p className="text-[10px] text-muted-foreground">{evaluatedCount} dinilai · {excludedCount} dikecualikan</p>
							</div>

							<div className="rounded-xl border border-success/30 bg-success/5 p-3 space-y-1">
								<span className="text-[11px] font-semibold text-success flex items-center gap-1">
									<CheckCircle2 className="size-3.5" />
									<span>Valid (Rules 00–08)</span>
								</span>
								<p className="text-base font-bold text-success">{monthValidCount} RO</p>
								<p className="text-[10px] text-muted-foreground">Sesuai aturan konsistensi IKPA</p>
							</div>

							<div className="rounded-xl border border-warning/30 bg-warning/5 p-3 space-y-1">
								<span className="text-[11px] font-semibold text-warning-foreground flex items-center gap-1">
									<AlertTriangle className="size-3.5 text-warning" />
									<span>Butuh Aksi / Konfirmasi</span>
								</span>
								<p className="text-base font-bold text-warning-foreground">{monthActionNeededCount} RO</p>
								<p className="text-[10px] text-muted-foreground">
									{monthBlockingCount > 0 ? `${monthBlockingCount} blocking · ` : ""}
									{monthConfirmationCount} konfirmasi PPK
								</p>
							</div>

							<div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3 space-y-1">
								<span className="text-[11px] font-semibold text-blue-700 flex items-center gap-1">
									<FileCheck className="size-3.5" />
									<span>Terkonfirmasi PPK</span>
								</span>
								<p className="text-base font-bold text-blue-700">{monthConfirmedPpkCount} RO</p>
								<p className="text-[10px] text-muted-foreground">Disetujui & siap dihitung</p>
							</div>
						</div>

						{/* Filters & Actions */}
						<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
							<div className="flex flex-wrap items-center gap-1.5 text-xs">
								<button
									type="button"
									onClick={() => setActiveTabFilter("all")}
									className={`rounded-xl px-3 py-1.5 font-semibold transition ${activeTabFilter === "all" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground hover:bg-surface-muted"}`}
								>
									Semua ({monthData.length})
								</button>
								<button
									type="button"
									onClick={() => setActiveTabFilter("valid")}
									className={`rounded-xl px-3 py-1.5 font-semibold transition ${activeTabFilter === "valid" ? "bg-success text-white shadow-xs" : "text-muted-foreground hover:text-foreground hover:bg-surface-muted"}`}
								>
									Valid ({monthValidCount})
								</button>
								<button
									type="button"
									onClick={() => setActiveTabFilter("action_needed")}
									className={`rounded-xl px-3 py-1.5 font-semibold transition ${activeTabFilter === "action_needed" ? "bg-warning text-white shadow-xs" : "text-muted-foreground hover:text-foreground hover:bg-surface-muted"}`}
								>
									Butuh Aksi / Konfirmasi ({monthActionNeededCount})
								</button>
								<button
									type="button"
									onClick={() => setActiveTabFilter("confirmed")}
									className={`rounded-xl px-3 py-1.5 font-semibold transition ${activeTabFilter === "confirmed" ? "bg-blue-600 text-white shadow-xs" : "text-muted-foreground hover:text-foreground hover:bg-surface-muted"}`}
								>
									Terkonfirmasi ({monthConfirmedPpkCount})
								</button>
								<button
									type="button"
									onClick={() => setActiveTabFilter("excluded")}
									className={`rounded-xl px-3 py-1.5 font-semibold transition ${activeTabFilter === "excluded" ? "bg-purple-600 text-white shadow-xs" : "text-muted-foreground hover:text-foreground hover:bg-surface-muted"}`}
								>
									Dikecualikan ({excludedCount})
								</button>
							</div>

							<button
								type="button"
								onClick={() => handleOpenCreateRealisasi()}
								className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover transition shadow-xs"
							>
								<Plus className="size-4" />
								<span>Input Realisasi Bulan Ini</span>
							</button>
						</div>

						<DomainDataTable
							title={`Realisasi Capaian Output Bulan ${MONTH_NAMES[selectedMonth - 1]} 2026`}
							data={filteredData}
							columns={realisasiColumns}
							searchValue={search}
							onSearchChange={setSearch}
							totalCount={filteredData.length}
						/>
					</div>
				)}

				{/* TAB 4: FAIRNESS TREATMENT */}
				{mainTab === "fairness" && (
					<div className="space-y-4">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<h2 className="text-base font-bold text-foreground">Fairness Treatment (Pengecualian RO Khusus & Kahar)</h2>
								<p className="text-xs text-muted-foreground">
									RO yang dikecualikan (contoh: FAN.ZZ1) dikeluarkan dari pembilang & penyebut evaluasi sehingga tidak merugikan nilai satker.
								</p>
							</div>
							<button
								type="button"
								onClick={() => handleOpenFairnessModal()}
								className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-purple-700 transition shadow-xs"
							>
								<Scale className="size-4" />
								<span>Atur Fairness RO</span>
							</button>
						</div>

						<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-3">
							<h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
								<ShieldCheck className="size-4 text-purple-600" />
								<span>Kebijakan Fairness Resmi Terpublikasi (Nasional & KPPN)</span>
							</h3>
							<div className="divide-y divide-border border rounded-xl overflow-hidden text-xs">
								{(initialData.publishedPolicies || []).map((policy) => (
									<div key={policy.id} className="p-3 bg-surface/40 flex items-start justify-between gap-4">
										<div>
											<div className="flex items-center gap-2">
												<span className="font-bold text-foreground">{policy.name}</span>
												<span className="rounded bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-700 uppercase">
													{policy.category}
												</span>
											</div>
											<p className="text-[11px] text-muted-foreground mt-0.5">
												Pencocokan: <strong className="font-mono text-foreground">{Array.isArray(policy.roMatchValue) ? policy.roMatchValue.join(", ") : policy.roMatchValue}</strong> ({policy.matchType}) · Dasar: {policy.basisReference}
											</p>
											<p className="text-[11px] text-foreground mt-1 italic">"{policy.displayReason}"</p>
										</div>
										<span className="rounded-full bg-success/10 px-2.5 py-0.5 text-[10px] font-bold text-success uppercase">
											Aktif
										</span>
									</div>
								))}
							</div>
						</div>
					</div>
				)}

				{/* DRAWER: TARGET KINERJA 12 BULAN */}
				<DomainFormDrawer
					isOpen={isTargetDrawerOpen}
					title="Perencanaan Target Kinerja 12 Bulan (Jan–Des)"
					description="Tentukan distribusi target fisik RVRO dan persentase PCRO per bulan. Total target RVRO harus sama dengan Volume DIPA dan total PCRO harus 100%."
					onClose={() => setIsTargetDrawerOpen(false)}
					onSubmit={handleSaveTarget}
					isSubmitting={isSubmitting}
					isSubmitDisabled={!targetFormValidation.isValid}
				>
					<div className="space-y-4 text-xs">
						<div
							className={`rounded-xl p-3 border space-y-1 ${
								targetFormValidation.isValid ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning-foreground"
							}`}
						>
							<div className="flex items-center justify-between font-bold">
								<span>Pemeriksaan Validasi Distribusi:</span>
								<span>Total RVRO: {targetFormValidation.sumRvro} / {targetFormValidation.volDipa} · Total PCRO: {targetFormValidation.sumPcro.toFixed(1)}%</span>
							</div>
							{!targetFormValidation.isRvroEqual && (
								<p className="text-[11px] text-danger">• TAR-01: Jumlah target RVRO Jan–Des ({targetFormValidation.sumRvro}) harus sama dengan Volume DIPA ({targetFormValidation.volDipa}).</p>
							)}
							{!targetFormValidation.isPcro100 && (
								<p className="text-[11px] text-danger">• TAR-02: Jumlah target PCRO Jan–Des ({targetFormValidation.sumPcro.toFixed(1)}%) harus sama dengan 100.0%.</p>
							)}
						</div>

						{/* Jalur Pemutakhiran & Alasan Revisi */}
						<div className="rounded-xl border border-border bg-surface p-3 space-y-3">
							<div className="space-y-1">
								<label htmlFor="tp-update-type" className="font-semibold text-foreground flex items-center justify-between">
									<span>Jalur / Trigger Pemutakhiran Target:</span>
									{targetUpdateType === "dipa_revision" && (
										<span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
											Mandiri Pasca Revisi DIPA
										</span>
									)}
								</label>
								<select
									id="tp-update-type"
									value={targetUpdateType}
									onChange={(e) =>
										setTargetUpdateType(
											e.target.value as "regular" | "dipa_revision" | "ppa_adjustment" | "special_condition",
										)
									}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-foreground font-semibold focus:border-primary focus:outline-none"
								>
									<option value="regular">Pemutakhiran Reguler Triwulanan (10 HK Awal Triwulan)</option>
									<option value="dipa_revision">Perubahan DIPA (Revisi Target Volume / Pagu RO / Jumlah RO)</option>
									<option value="ppa_adjustment">Penyesuaian Realisasi Anggaran / PPA</option>
									<option value="special_condition">Kondisi Khusus / Arahan KPPN</option>
								</select>
							</div>

							{(targetUpdateType === "dipa_revision" || targetUpdateType === "special_condition" || targetUpdateType === "ppa_adjustment") && (
								<div className="space-y-1 border-t border-border/60 pt-2">
									<label htmlFor="tp-change-reason" className="font-semibold text-foreground text-xs">
										Nomor Surat Revisi DIPA / Justifikasi Perubahan Target:
									</label>
									<input
										id="tp-change-reason"
										type="text"
										placeholder="Contoh: Revisi DIPA Ke-2 No. DIPA-015.01.2.123456/2026 tanggal 15 Juni 2026"
										value={targetChangeReason}
										onChange={(e) => setTargetChangeReason(e.target.value)}
										className="min-h-9 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
									/>
									<p className="text-[10px] text-muted-foreground">
										Catatan ini akan tersimpan sebagai riwayat audit perubahan target versi RO di KPPN.
									</p>
								</div>
							)}
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1">
								<label htmlFor="tp-ro-code" className="font-semibold text-foreground">Kode RO</label>
								<input
									id="tp-ro-code"
									type="text"
									required
									placeholder="Contoh: 5241.AAA.001"
									value={targetRoCode}
									onChange={(e) => setTargetRoCode(e.target.value.toUpperCase())}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 font-mono font-bold text-foreground focus:border-primary focus:outline-none"
								/>
							</div>

							<div className="space-y-1">
								<label htmlFor="tp-quarter" className="font-semibold text-foreground">Triwulan Target</label>
								<select
									id="tp-quarter"
									value={targetQuarter}
									onChange={(e) => setTargetQuarter(Number(e.target.value))}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-foreground focus:border-primary focus:outline-none"
								>
									{QUARTER_NAMES.map((q, idx) => (
										<option key={q} value={idx + 1}>{q}</option>
									))}
								</select>
							</div>
						</div>

						<div className="space-y-1">
							<label htmlFor="tp-ro-name" className="font-semibold text-foreground">Nama / Uraian Rincian Output</label>
							<input
								id="tp-ro-name"
								type="text"
								placeholder="Contoh: Layanan Perkantoran dan Operasional Satker"
								value={targetRoName}
								onChange={(e) => setTargetRoName(e.target.value)}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-foreground focus:border-primary focus:outline-none"
							/>
						</div>

						<div className="grid grid-cols-3 gap-3">
							<div className="space-y-1">
								<label htmlFor="tp-vol-dipa" className="font-semibold text-foreground">Volume DIPA</label>
								<FormattedNumberInput
									id="tp-vol-dipa"
									allowDecimal={false}
									required
									placeholder="Contoh: 12"
									value={targetVolumeDipa}
									onChange={setTargetVolumeDipa}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-foreground focus:border-primary focus:outline-none"
								/>
							</div>

							<div className="space-y-1">
								<label htmlFor="tp-unit" className="font-semibold text-foreground">Satuan Unit</label>
								<input
									id="tp-unit"
									type="text"
									placeholder="Contoh: Layanan, Gedung"
									value={targetUnit}
									onChange={(e) => setTargetUnit(e.target.value)}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-foreground focus:border-primary focus:outline-none"
								/>
							</div>

							<div className="space-y-1 flex flex-col justify-end">
								<label className="flex items-center gap-1.5 cursor-pointer py-2">
									<input
										type="checkbox"
										checked={targetIsPn}
										onChange={(e) => setTargetIsPn(e.target.checked)}
										className="size-4 rounded border-border text-primary"
									/>
									<span className="font-semibold text-foreground">Prioritas Nasional</span>
								</label>
							</div>
						</div>

						<div className="border rounded-xl overflow-hidden mt-3">
							<div className="bg-surface-muted p-2.5 font-bold text-foreground border-b border-border flex flex-wrap items-center justify-between gap-2">
								<div className="flex items-center gap-2">
									<span>Distribusi Target Inkremental Per Bulan</span>
									<span className="text-[11px] text-muted-foreground font-normal">(Jan–Des)</span>
								</div>
								<button
									type="button"
									onClick={handleAutoDistributeTargets}
									className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition"
								>
									<Sparkles className="size-3" />
									<span>Distribusi Rata Otomatis</span>
								</button>
							</div>
							<div className="max-h-64 overflow-y-auto divide-y divide-border">
								{targetMonthlyValues.map((item, idx) => (
									<div key={item.month} className="p-2 flex items-center justify-between gap-3 bg-surface/30">
										<span className="w-24 font-bold text-foreground">{MONTH_NAMES[idx]}</span>
										<div className="flex items-center gap-2">
											<span className="text-[10px] text-muted-foreground">RVRO:</span>
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
												className="w-20 rounded border border-border bg-background px-2 py-1 text-right font-mono text-xs focus:border-primary focus:outline-none"
											/>
										</div>
										<div className="flex items-center gap-2">
											<span className="text-[10px] text-muted-foreground">PCRO (%):</span>
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
												className="w-20 rounded border border-border bg-background px-2 py-1 text-right font-mono text-xs focus:border-primary focus:outline-none"
											/>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				</DomainFormDrawer>

				{/* DRAWER: REALISASI KINERJA (with Live Validation Rules 00-08 & PPK Confirmation) */}
				<DomainFormDrawer
					isOpen={isRealisasiDrawerOpen}
					title={editingReport ? `Edit Realisasi: ${editingReport.roCode}` : "Input Realisasi Capaian Output"}
					description="Masukkan realisasi fisik bulanan. Sistem akan memverifikasi konsistensi Rules 00–08 dengan target aktif dan realisasi anggaran (PPA Level RO)."
					onClose={() => {
						setIsRealisasiDrawerOpen(false);
						setEditingReport(null);
					}}
					onSubmit={() => handleSaveRealisasi("draft")}
					isSubmitting={isSubmitting}
					isSubmitDisabled={!formRoCode.trim() || liveBlockingErrors.length > 0}
				>
					<div className="space-y-4 text-xs">
						{/* Live Calculation Preview */}
						<div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2 text-xs">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-1.5 font-bold text-primary">
									<Sparkles className="size-3.5" />
									<span>Live Calculation Preview</span>
								</div>
								<span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${liveDrawerPreview.formulaType === "EXCLUDED" ? "bg-purple-500/20 text-purple-700" : liveDrawerPreview.formulaType === "FORMULA_2" ? "bg-blue-500/20 text-blue-700" : "bg-emerald-500/20 text-emerald-700"}`}>
									{liveDrawerPreview.badge}
								</span>
							</div>
							<div className="rounded-lg bg-background p-2.5 font-mono text-[11px] text-foreground border border-border/60">
								{liveDrawerPreview.calculationStep}
							</div>
							<div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
								<span>Estimasi Nilai NK-CRO:</span>
								<strong className="text-sm font-bold text-foreground">{liveDrawerPreview.score}</strong>
							</div>
							{activeRoBudgetRealization && (
								<div className="border-t border-primary/20 pt-1.5 flex items-center justify-between text-[11px]">
									<span>PPA Anggaran RO (Bulan {MONTH_NAMES[formMonth - 1]}):</span>
									<span className="font-bold text-foreground">
										{formatDynamicPercent(activeRoBudgetRealization.ppaPercentage)} ({formatRupiah(activeRoBudgetRealization.realizationAmount)})
									</span>
								</div>
							)}
						</div>

						{/* Live Validation Engine (Rules 00-08) Status Box */}
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<span className="font-bold text-foreground flex items-center gap-1.5">
									<ShieldAlert className="size-3.5 text-primary" />
									<span>Pemeriksaan Validasi Engine (Rules 00–08)</span>
								</span>
								<span className="text-[10px] text-muted-foreground font-mono">
									{liveBlockingErrors.length > 0 ? (
										<span className="text-danger font-bold">{liveBlockingErrors.length} Blocking Error</span>
									) : liveConfirmationRequired.length > 0 ? (
										<span className="text-warning font-bold">{liveConfirmationRequired.length} Butuh Konfirmasi</span>
									) : (
										<span className="text-success font-bold flex items-center gap-1">
											<CheckCircle2 className="size-3" />
											<span>Semua Rule Valid</span>
										</span>
									)}
								</span>
							</div>

							{liveBlockingErrors.length > 0 && (
								<div className="rounded-xl border border-danger/30 bg-danger/5 p-3 space-y-1.5 text-xs">
									<div className="flex items-center gap-1.5 font-bold text-danger">
										<AlertCircle className="size-4 shrink-0" />
										<span>Terdeteksi Blocking Issue (Data Tidak Dapat Disimpan/Dikirim)</span>
									</div>
									<div className="space-y-1">
										{liveBlockingErrors.map((err) => (
											<div key={err.code} className="text-[11px] text-danger/90 flex items-start gap-1">
												<span className="font-mono font-bold">• [Rule {err.code}]</span>
												<span>{err.message}</span>
											</div>
										))}
									</div>
								</div>
							)}

							{liveConfirmationRequired.length > 0 && (
								<div className="rounded-xl border border-warning/30 bg-warning/5 p-3 space-y-1.5 text-xs">
									<div className="flex items-center gap-1.5 font-bold text-warning-foreground">
										<AlertTriangle className="size-4 shrink-0 text-warning" />
										<span>Memerlukan Konfirmasi & Justifikasi PPK</span>
									</div>
									<div className="space-y-1">
										{liveConfirmationRequired.map((w) => (
											<div key={w.code} className="text-[11px] text-foreground/80 flex items-start gap-1">
												<span className="font-mono font-bold text-warning">• [Rule {w.code}]</span>
												<span>{w.message}</span>
											</div>
										))}
									</div>
								</div>
							)}

							{liveBlockingErrors.length === 0 && liveConfirmationRequired.length === 0 && (
								<div className="rounded-xl border border-success/30 bg-success/10 p-2.5 text-xs font-semibold text-success flex items-center gap-2">
									<CheckCircle2 className="size-4 shrink-0" />
									<span>Integritas data konsisten dengan realisasi anggaran dan target volume DIPA.</span>
								</div>
							)}
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1">
								<label htmlFor="rel-ro-code" className="font-semibold text-foreground">Kode RO</label>
								<input
									id="rel-ro-code"
									type="text"
									required
									placeholder="Contoh: 5241.AAA.001"
									value={formRoCode}
									onChange={(e) => setFormRoCode(e.target.value.toUpperCase())}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 font-mono font-bold text-foreground focus:border-primary focus:outline-none"
								/>
							</div>

							<div className="space-y-1">
								<label htmlFor="rel-month" className="font-semibold text-foreground">Bulan Laporan</label>
								<select
									id="rel-month"
									value={formMonth}
									onChange={(e) => setFormMonth(Number(e.target.value))}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-foreground focus:border-primary focus:outline-none"
								>
									{MONTH_NAMES.map((n, idx) => (
										<option key={n} value={idx + 1}>{n}</option>
									))}
								</select>
							</div>
						</div>

						<div className="space-y-1">
							<label htmlFor="rel-ro-name" className="font-semibold text-foreground">Nama / Uraian RO</label>
							<input
								id="rel-ro-name"
								type="text"
								placeholder="Contoh: Layanan Perkantoran dan Operasional"
								value={formRoName}
								onChange={(e) => setFormRoName(e.target.value)}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-foreground focus:border-primary focus:outline-none"
							/>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1">
								<label htmlFor="rel-vol-dipa" className="font-semibold text-foreground">Target Volume DIPA</label>
								<FormattedNumberInput
									id="rel-vol-dipa"
									allowDecimal={false}
									value={formVolumeDipa}
									onChange={setFormVolumeDipa}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-foreground focus:border-primary focus:outline-none"
								/>
							</div>

							<div className="space-y-1">
								<label htmlFor="rel-tpcro" className="font-semibold text-foreground">Target PCRO Kumulatif (%)</label>
								<FormattedNumberInput
									id="rel-tpcro"
									allowDecimal
									maxDecimals={2}
									max={100}
									value={formTpcro}
									onChange={setFormTpcro}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-foreground focus:border-primary focus:outline-none"
								/>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-3 p-3 bg-surface rounded-xl border border-border">
							<div className="space-y-2">
								<span className="font-bold text-foreground">Realisasi Volume (RVRO)</span>
								<div className="space-y-1">
									<label htmlFor="rel-rvro-inc" className="text-[10px] text-muted-foreground">+ Inkremental Bulan Ini</label>
									<input
										id="rel-rvro-inc"
										type="number"
										min="0"
										step="any"
										placeholder="0"
										value={formRvroIncremental}
										onChange={(e) => handleIncrementalRvroChange(e.target.value)}
										className="w-full rounded border border-border bg-background p-2 font-mono text-xs focus:border-primary focus:outline-none"
									/>
								</div>
								<div className="space-y-1">
									<label htmlFor="rel-rvro-cum" className="text-[10px] text-muted-foreground">= Kumulatif s.d. Bulan Ini</label>
									<input
										id="rel-rvro-cum"
										type="number"
										min="0"
										step="any"
										placeholder="0"
										value={formRvroCumulative}
										onChange={(e) => setFormRvroCumulative(e.target.value)}
										className="w-full rounded border border-border bg-background p-2 font-mono text-xs font-bold focus:border-primary focus:outline-none"
									/>
								</div>
							</div>

							<div className="space-y-2">
								<span className="font-bold text-foreground">Progres Fisik (PCRO %)</span>
								<div className="space-y-1">
									<label htmlFor="rel-pcro-inc" className="text-[10px] text-muted-foreground">+ Inkremental Bulan Ini (%)</label>
									<input
										id="rel-pcro-inc"
										type="number"
										min="0"
										max="100"
										step="any"
										placeholder="0"
										value={formPcroIncremental}
										onChange={(e) => handleIncrementalPcroChange(e.target.value)}
										className="w-full rounded border border-border bg-background p-2 font-mono text-xs focus:border-primary focus:outline-none"
									/>
								</div>
								<div className="space-y-1">
									<label htmlFor="rel-pcro-cum" className="text-[10px] text-muted-foreground">= Kumulatif s.d. Bulan Ini (%)</label>
									<input
										id="rel-pcro-cum"
										type="number"
										min="0"
										max="100"
										step="any"
										placeholder="0"
										value={formPcroCumulative}
										onChange={(e) => setFormPcroCumulative(e.target.value)}
										className="w-full rounded border border-border bg-background p-2 font-mono text-xs font-bold focus:border-primary focus:outline-none"
									/>
								</div>
							</div>
						</div>

						<div className="space-y-1">
							<label htmlFor="rel-doc-ref" className="font-semibold text-foreground">Nomor Dokumen Sumber / BAST</label>
							<input
								id="rel-doc-ref"
								type="text"
								placeholder="Contoh: BAST No. 012/BAST/III/2026"
								value={formAchievementRef}
								onChange={(e) => setFormAchievementRef(e.target.value)}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-foreground focus:border-primary focus:outline-none"
							/>
						</div>

						<div className="space-y-1">
							<label htmlFor="rel-operator-note" className="font-semibold text-foreground">Catatan Operator / Keterangan Capaian</label>
							<textarea
								id="rel-operator-note"
								rows={2}
								placeholder="Catatan progres pelaksanaan kegiatan rincian output..."
								value={formOperatorNote}
								onChange={(e) => setFormOperatorNote(e.target.value)}
								className="w-full rounded-lg border border-border bg-background p-2.5 text-foreground focus:border-primary focus:outline-none"
							/>
						</div>

						{/* Panel Review & Konfirmasi PPK */}
						<div className="rounded-xl border border-border bg-surface p-3.5 space-y-3">
							<div className="flex items-center justify-between">
								<span className="font-bold text-foreground flex items-center gap-1.5">
									<FileCheck className="size-4 text-primary" />
									<span>Review & Konfirmasi PPK</span>
								</span>
								<span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
									formConfirmed ? "bg-success/10 text-success border border-success/20" : "bg-warning/10 text-warning border border-warning/20"
								}`}>
									{formConfirmed ? "Terkonfirmasi PPK" : "Menunggu Konfirmasi"}
								</span>
							</div>

							<div className="space-y-1">
								<label htmlFor="rel-ppk-note" className="font-semibold text-foreground text-xs">
									Catatan Review / Justifikasi Validasi PPK
								</label>
								<textarea
									id="rel-ppk-note"
									rows={2}
									placeholder="Catatan verifikasi atau alasan justifikasi deviasi dari PPK..."
									value={formPpkValidationNote}
									onChange={(e) => setFormPpkValidationNote(e.target.value)}
									className="w-full rounded-lg border border-border bg-background p-2.5 text-foreground focus:border-primary focus:outline-none text-xs"
								/>
							</div>

							<label className="flex items-start gap-2 cursor-pointer pt-1">
								<input
									type="checkbox"
									checked={formConfirmed}
									onChange={(e) => setFormConfirmed(e.target.checked)}
									className="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary"
								/>
								<div className="text-xs">
									<span className="font-bold text-foreground block">
										Konfirmasi Data Capaian Output oleh PPK
									</span>
									<span className="text-[11px] text-muted-foreground">
										Centang untuk memvalidasi dan mengesahkan capaian fisik RO untuk evaluasi IKPA resmi.
									</span>
								</div>
							</label>
						</div>

						{/* Action Buttons */}
						<div className="flex items-center justify-between pt-2 border-t border-border">
							<span className="text-[11px] text-muted-foreground">
								Tenggat Lapor 5 HK: <strong>{formatDateDDMMYYYY(canonicalDeadline)}</strong>
							</span>
							<div className="flex items-center gap-2">
								<button
									type="button"
									disabled={isSubmitting || liveBlockingErrors.length > 0}
									onClick={() => handleSaveRealisasi("draft")}
									className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition disabled:opacity-50"
								>
									<span>Simpan Draft</span>
								</button>
								<button
									type="button"
									disabled={isSubmitting || liveBlockingErrors.length > 0}
									onClick={() => handleSaveRealisasi(formConfirmed ? "confirmed" : "submitted")}
									className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-white transition disabled:opacity-50 ${
										formConfirmed ? "bg-success hover:bg-success/90" : "bg-blue-600 hover:bg-blue-700"
									}`}
								>
									{formConfirmed ? <FileCheck className="size-3.5" /> : <Send className="size-3.5" />}
									<span>{formConfirmed ? "Simpan & Konfirmasi" : "Simpan & Kirim"}</span>
								</button>
							</div>
						</div>
					</div>
				</DomainFormDrawer>

				{/* MODAL: FAIRNESS PROPOSAL */}
				{isProposalModalOpen && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
						<div className="w-full max-w-lg rounded-2xl border border-border bg-background p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
							<div className="flex items-start justify-between">
								<div className="flex items-center gap-2.5">
									<div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
										<Scale className="size-5" />
									</div>
									<div>
										<h3 className="text-base font-bold text-foreground">Pengaturan Fairness & Pengecualian RO</h3>
										<p className="text-xs text-muted-foreground">Atur apakah RO dikecualikan dari penilaian IKPA atau dinilai normal.</p>
									</div>
								</div>
								<button type="button" onClick={() => setIsProposalModalOpen(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-surface-muted">
									<X className="size-4" />
								</button>
							</div>

							<div className="grid grid-cols-2 gap-2 text-xs">
								<button
									type="button"
									onClick={() => setProposalIsExcluded(true)}
									className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
										proposalIsExcluded ? "border-purple-600 bg-purple-500/10 text-foreground ring-1 ring-purple-600" : "border-border bg-surface text-muted-foreground hover:bg-surface-muted"
									}`}
								>
									<div className="flex items-center gap-1.5 font-bold text-purple-700">
										<Scale className="size-3.5" />
										<span>Dikecualikan (Fairness)</span>
									</div>
									<p className="text-[11px] text-muted-foreground">Dikeluarkan dari pembilang & penyebut evaluasi Capaian Output.</p>
								</button>

								<button
									type="button"
									onClick={() => setProposalIsExcluded(false)}
									className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
										!proposalIsExcluded ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary" : "border-border bg-surface text-muted-foreground hover:bg-surface-muted"
									}`}
								>
									<div className="flex items-center gap-1.5 font-bold text-primary">
										<CheckCircle2 className="size-3.5" />
										<span>Dinilai (Normal)</span>
									</div>
									<p className="text-[11px] text-muted-foreground">Dinilai secara standar berdasarkan progres fisik dan realisasi volume.</p>
								</button>
							</div>

							<div className="space-y-3.5 text-xs">
								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-1">
										<label htmlFor="fair-ro-code" className="font-semibold text-foreground">Kode RO</label>
										<input
											id="fair-ro-code"
											type="text"
											required
											placeholder="Contoh: FAN.ZZ1"
											value={proposalRoCode}
											onChange={(e) => setProposalRoCode(e.target.value.toUpperCase())}
											className="h-9 w-full rounded-lg border border-border bg-surface px-3 font-mono font-bold text-foreground focus:border-primary focus:outline-none"
										/>
									</div>

									<div className="space-y-1">
										<label htmlFor="fair-month" className="font-semibold text-foreground">Periode Bulan</label>
										<select
											id="fair-month"
											value={proposalMonth ?? ""}
											onChange={(e) => setProposalMonth(e.target.value ? Number(e.target.value) : null)}
											className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
										>
											<option value="">Semua Bulan (Sepanjang Tahun)</option>
											{MONTH_NAMES.map((n, idx) => (
												<option key={n} value={idx + 1}>Bulan {n}</option>
											))}
										</select>
									</div>
								</div>

								{proposalIsExcluded ? (
									<>
										<div className="space-y-1">
											<label htmlFor="fair-cat" className="font-semibold text-foreground">Kategori Pengecualian</label>
											<select
												id="fair-cat"
												value={proposalCategory}
												onChange={(e) => setProposalCategory(e.target.value)}
												className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
											>
												<option value="ro_khusus">RO Khusus (Contoh: FAN.ZZ1 / Penugasan Khusus)</option>
												<option value="keadaan_kahar">Keadaan Kahar / Force Majeure</option>
												<option value="kebijakan_pusat">Kebijakan Khusus Kantor Pusat / Kemenkeu</option>
											</select>
										</div>

										<div className="space-y-1">
											<label htmlFor="fair-basis" className="font-semibold text-foreground">Dasar Regulasi</label>
											<input
												id="fair-basis"
												type="text"
												required
												placeholder="Contoh: PER-5/PB/2024 atau ND-123/PB/2026"
												value={proposalBasis}
												onChange={(e) => setProposalBasis(e.target.value)}
												className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
											/>
										</div>

										<div className="space-y-1">
											<label htmlFor="fair-note" className="font-semibold text-foreground">Catatan / Alasan Operator</label>
											<textarea
												id="fair-note"
												rows={3}
												placeholder="Jelaskan alasan mengapa RO ini perlu dikecualikan dari penilaian..."
												value={proposalNote}
												onChange={(e) => setProposalNote(e.target.value)}
												className="w-full rounded-lg border border-border bg-surface p-2.5 text-foreground focus:border-primary focus:outline-none"
											/>
										</div>
									</>
								) : (
									<div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground space-y-1">
										<p className="font-bold text-primary flex items-center gap-1.5">
											<CheckCircle2 className="size-4" />
											<span>Kembali Menjadi Objek Penilaian Normal</span>
										</p>
										<p className="text-muted-foreground">
											Pengecualian fairness pada RO {proposalRoCode || "ini"} akan dinonaktifkan. Nilai capaian fisik dan volume akan dihitung normal dalam evaluasi IKPA.
										</p>
									</div>
								)}
							</div>

							<div className="flex items-center justify-end gap-2 border-t border-border pt-4">
								<button type="button" onClick={() => setIsProposalModalOpen(false)} className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted">
									Batal
								</button>
								<button
									type="button"
									disabled={isSubmittingProposal || !proposalRoCode.trim() || (proposalIsExcluded && !proposalBasis.trim())}
									onClick={handleSubmitProposal}
									className={`rounded-lg px-4 py-2 text-xs font-semibold text-white transition shadow-xs disabled:opacity-50 ${proposalIsExcluded ? "bg-purple-600 hover:bg-purple-700" : "bg-primary hover:bg-primary-hover"}`}
								>
									{isSubmittingProposal ? "Menyimpan..." : "Simpan Perlakuan"}
								</button>
							</div>
						</div>
					</div>
				)}

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
											Permohonan dispensasi pelaporan data realisasi setelah Hari Kerja ke-7.
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
									Periode tambahan berlaku setelah Hari Kerja ke-7 bulan M+1 sampai dengan <strong>akhir bulan M+1</strong> ({formatDateDDMMYYYY(currentMonthOpenPeriod.additionalDeadline)}). Pengajuan ini akan diteruskan ke Admin KPPN untuk verifikasi dan pembukaan akses sistem pada Aplikasi MyIntress / Simulator IKPA.
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
										<option value="Kendala Teknis Aplikasi OM-SPAN / SAKTI">Kendala Teknis Aplikasi OM-SPAN / SAKTI</option>
										<option value="Rekonsiliasi Internal Belum Tuntas">Rekonsiliasi Internal / Konfirmasi PPK Belum Tuntas</option>
										<option value="Bencana Alam / Keadaan Kahar">Bencana Alam / Keadaan Kahar (Force Majeure)</option>
										<option value="Pergantian Pejabat Perbendaharaan (PPK/PPSPM)">Pergantian Pejabat Perbendaharaan (PPK/PPSPM)</option>
										<option value="Penugasan Khusus / Arahan Eselon I">Penugasan Khusus / Arahan Eselon I</option>
										<option value="Lainnya">Lainnya (Tuliskan pada catatan)</option>
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
										onChange={(e) => setAdditionalRequestDocNumber(e.target.value)}
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
										setAdditionalSubmittedMonths((prev) => [...prev, selectedMonth]);
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

				{/* Modal Pusdiklat Panduan Capaian Output */}
				{isGuideOpen && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
						<div className="w-full max-w-2xl rounded-2xl border border-border bg-background p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
							<div className="flex items-start justify-between">
								<div className="flex items-center gap-2">
									<BookOpen className="size-5 text-primary" />
									<div>
										<h3 className="text-base font-bold text-foreground">Panduan Resmi Capaian Output & Open Period</h3>
										<p className="text-xs text-muted-foreground">Referensi Regulasi PER-5/PB/2024 & Petunjuk Teknis IKPA TA 2026.</p>
									</div>
								</div>
								<button type="button" onClick={() => setIsGuideOpen(false)} className="rounded-lg p-1 text-muted-foreground hover:bg-surface-muted">
									<X className="size-4" />
								</button>
							</div>

							<div className="space-y-4 text-xs">
								<div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-1.5">
									<p className="font-bold text-primary">1. Bobot IKPA 25% dan Formula Akhir</p>
									<p className="text-foreground">Indikator Capaian Output memiliki bobot 25% dalam evaluasi IKPA TA 2026:</p>
									<code className="block rounded-lg bg-background p-2 font-mono font-bold text-primary text-center">
										IKPA-CO = (NK-ROKW × 30%) + (NK-CRO × 70%)
									</code>
								</div>

								<div className="rounded-xl border border-border bg-surface p-4 space-y-1.5">
									<p className="font-bold text-foreground">2. Periodisasi Pengisian Data (Open Period)</p>
									<ul className="list-disc pl-4 space-y-1 text-muted-foreground">
										<li><strong className="text-foreground">Open Period Reguler:</strong> Sejak awal bulan berikutnya s.d. Hari Kerja ke-7 (HK-7) bulan berikutnya (buka sistem otomatis).</li>
										<li><strong className="text-foreground">Periode Pelaporan Tambahan:</strong> Setelah HK-7 s.d. akhir bulan berikutnya apabila dibuka oleh Admin KPPN pada kejadian khusus.</li>
										<li><strong className="text-foreground">Relaksasi TW I 2026:</strong> Periode Januari, Februari, dan Maret dibuka s.d. 30 April 2026.</li>
									</ul>
								</div>

								<div className="rounded-xl border border-border bg-surface p-4 space-y-1.5">
									<p className="font-bold text-foreground">3. Formula NK-CRO (Formula 1 vs Formula 2)</p>
									<ul className="list-disc pl-4 space-y-1 text-muted-foreground">
										<li><strong className="text-foreground">Formula 1 (Jan–Nov saat PCRO &lt; 100%):</strong> <code>min((PCRO / TPCRO) × 100, 100)</code></li>
										<li><strong className="text-foreground">Formula 2 (Desember atau saat PCRO = 100%):</strong> <code>min((RVRO / Target Volume DIPA) × 100, 100)</code></li>
									</ul>
								</div>

								<div className="rounded-xl border border-border bg-surface p-4 space-y-2.5">
									<div className="flex items-center justify-between">
										<p className="font-bold text-foreground">4. 8 Variabel Kualitas Validasi Data</p>
										<span className="text-[10px] font-medium text-muted-foreground bg-surface-muted px-2 py-0.5 rounded-md border border-border">Engine Rules 01–08</span>
									</div>
									<p className="text-[11px] text-muted-foreground">
										Engine validasi otomatis mendeteksi anomali pengisian data capaian output berdasarkan kriteria kepatuhan dan kewajaran:
									</p>
									<div className="space-y-1.5 pt-1">
										<div className="flex items-start justify-between gap-3 p-2 rounded-lg bg-background border border-border/80 text-[11px]">
											<div className="flex items-start gap-2">
												<span className="font-mono font-bold text-primary shrink-0">01</span>
												<span className="text-foreground font-medium">% Realisasi Anggaran &gt; 0% namun PCRO 0%</span>
											</div>
											<span className="shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
												Wajib Diperbaiki
											</span>
										</div>

										<div className="flex items-start justify-between gap-3 p-2 rounded-lg bg-background border border-border/80 text-[11px]">
											<div className="flex items-start gap-2">
												<span className="font-mono font-bold text-primary shrink-0">02</span>
												<span className="text-foreground font-medium">PCRO &lt; % Realisasi Anggaran</span>
											</div>
											<span className="shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
												Wajib Konfirmasi, Bisa Diperbaiki
											</span>
										</div>

										<div className="flex items-start justify-between gap-3 p-2 rounded-lg bg-background border border-border/80 text-[11px]">
											<div className="flex items-start gap-2">
												<span className="font-mono font-bold text-primary shrink-0">03</span>
												<span className="text-foreground font-medium">PCRO 100% namun RVRO 0</span>
											</div>
											<span className="shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
												Wajib Diperbaiki
											</span>
										</div>

										<div className="flex items-start justify-between gap-3 p-2 rounded-lg bg-background border border-border/80 text-[11px]">
											<div className="flex items-start gap-2">
												<span className="font-mono font-bold text-primary shrink-0">04</span>
												<span className="text-foreground font-medium">PCRO 100% namun RVRO &lt; Target/Volume RO pada DIPA</span>
											</div>
											<span className="shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
												Wajib Diperbaiki
											</span>
										</div>

										<div className="flex items-start justify-between gap-3 p-2 rounded-lg bg-background border border-border/80 text-[11px]">
											<div className="flex items-start gap-2">
												<span className="font-mono font-bold text-primary shrink-0">05</span>
												<span className="text-foreground font-medium">Terdapat RVRO yang dilaporkan namun Realisasi Anggaran masih 0</span>
											</div>
											<span className="shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
												Wajib Konfirmasi, Bisa Diperbaiki
											</span>
										</div>

										<div className="flex items-start justify-between gap-3 p-2 rounded-lg bg-background border border-border/80 text-[11px]">
											<div className="flex items-start gap-2">
												<span className="font-mono font-bold text-primary shrink-0">06</span>
												<span className="text-foreground font-medium">RVRO diisi menggunakan desimal sedangkan Satuan tidak memungkinkan</span>
											</div>
											<span className="shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
												Wajib Diperbaiki
											</span>
										</div>

										<div className="flex items-start justify-between gap-3 p-2 rounded-lg bg-background border border-border/80 text-[11px]">
											<div className="flex items-start gap-2">
												<span className="font-mono font-bold text-primary shrink-0">07</span>
												<span className="text-foreground font-medium">RVRO &gt; Target/Volume RO pada DIPA</span>
											</div>
											<span className="shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
												Wajib Konfirmasi, Bisa Diperbaiki
											</span>
										</div>

										<div className="flex items-start justify-between gap-3 p-2 rounded-lg bg-background border border-border/80 text-[11px]">
											<div className="flex items-start gap-2">
												<span className="font-mono font-bold text-primary shrink-0">08</span>
												<span className="text-foreground font-medium">RVRO &gt;= Target/Volume RO pada DIPA, namun PCRO &lt; 100%</span>
											</div>
											<span className="shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
												Wajib Konfirmasi, Bisa Diperbaiki
											</span>
										</div>
									</div>
								</div>
							</div>

							<div className="flex items-center justify-end border-t border-border pt-4">
								<button type="button" onClick={() => setIsGuideOpen(false)} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover">
									Tutup Panduan
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

import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
	AlertCircle,
	Award,
	BookOpen,
	CheckCircle2,
	Clock,
	Edit,
	FileCheck,
	Percent,
	Scale,
	ShieldAlert,
	ShieldCheck,
	Sparkles,
	Target,
	Trash2,
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
} from "@/lib/format";
import {
	calculateFifthWorkingDayOfNextMonth,
	calculateOutputAchievement,
	default2026RuleSet,
} from "@simulator-ikpa/ikpa-engine";

import {
	fetchFairnessProposals,
	fetchOutputReports,
	removeFairnessProposal,
	removeOutputReport,
	saveOutputReport,
	submitFairnessProposal,
	verifyOutputReport,
	type FairnessProposal,
	type OutputReportRecord,
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
	const initialData = Route.useLoaderData();

	const [selectedMonth, setSelectedMonth] = useState<number>(
		new Date().getMonth() + 1,
	);
	const [search, setSearch] = useState("");
	const [activeTabFilter, setActiveTabFilter] = useState<
		"all" | "evaluated" | "excluded" | "action_needed"
	>("all");

	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [editingItem, setEditingItem] = useState<OutputReportRecord | null>(
		null,
	);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [actionMessage, setActionMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	// Fairness Proposal Modal
	const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
	const [proposalRoCode, setProposalRoCode] = useState("");
	const [proposalMonth, setProposalMonth] = useState<number | null>(null);
	const [proposalIsExcluded, setProposalIsExcluded] = useState(true);
	const [proposalCategory, setProposalCategory] = useState("ro_khusus");
	const [proposalBasis, setProposalBasis] = useState(
		"Fairness treatment IKPA TA 2026",
	);
	const [proposalNote, setProposalNote] = useState("");
	const [proposalAttachment, setProposalAttachment] = useState("");
	const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);

	// Formula Guide / Pusdiklat Modal
	const [isGuideOpen, setIsGuideOpen] = useState(false);

	// Form State for Drawer
	const [roCode, setRoCode] = useState("");
	const [roName, setRoName] = useState("");
	const [formMonth, setFormMonth] = useState<number>(selectedMonth);
	const [rvro, setRvro] = useState("");
	const [volumeDipa, setVolumeDipa] = useState("");
	const [pcro, setPcro] = useState("");
	const [tpcro, setTpcro] = useState("");
	const [reportedDate, setReportedDate] = useState<string>("");
	const [isConfirmed, setIsConfirmed] = useState(false);

	// Canonical deadline for current selected month
	const calendarWorkdayInput = useMemo(
		() => ({
			holidays: initialData.holidays || [],
			workdays: [],
		}),
		[initialData.holidays],
	);

	const canonicalDeadline = useMemo(() => {
		return calculateFifthWorkingDayOfNextMonth(
			initialData.year,
			selectedMonth,
			calendarWorkdayInput,
		);
	}, [initialData.year, selectedMonth, calendarWorkdayInput]);

	// Month data
	const monthData = useMemo(() => {
		return initialData.outputs.filter((item) => item.month === selectedMonth);
	}, [initialData.outputs, selectedMonth]);

	// Filter outputs by activeTabFilter & search
	const filteredData = useMemo(() => {
		return monthData.filter((item) => {
			const matchesSearch =
				item.roCode.toLowerCase().includes(search.toLowerCase()) ||
				(item.roName && item.roName.toLowerCase().includes(search.toLowerCase()));

			if (!matchesSearch) return false;

			const isExcluded = item.eligibility?.assessmentStatus === "excluded";
			const isActionNeeded = !item.confirmed || !item.reportedAt;

			if (activeTabFilter === "evaluated") return !isExcluded;
			if (activeTabFilter === "excluded") return isExcluded;
			if (activeTabFilter === "action_needed") return isActionNeeded;
			return true;
		});
	}, [monthData, search, activeTabFilter]);

	// Calculate overall evaluation for the month using authoritative engine
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
			{
				reports: engineInputReports,
				evalPeriod: selectedMonth,
			},
			default2026RuleSet,
		);
	}, [monthData, selectedMonth, canonicalDeadline]);

	// Metric Card Stats
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
		engineResult.subComponents?.find((s) => s.key === "timeliness")?.score ??
		"—";
	const nkcroScore =
		engineResult.subComponents?.find((s) => s.key === "achievement")?.score ??
		"—";
	const finalScore = engineResult.score ?? "—";
	const weightedContribution = engineResult.weightedContribution ?? "—";

	// Live Drawer Formula Evaluation Preview
	const liveDrawerPreview = useMemo(() => {
		const parsedRv = Number.parseFloat(rvro) || 0;
		const parsedVol = Number.parseFloat(volumeDipa) || 0;
		const parsedPc = Number.parseFloat(pcro) || 0;
		const parsedTpc = Number.parseFloat(tpcro) || 0;

		const uCode = roCode.trim().toUpperCase();
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
					"RO Khusus ini tidak menjadi objek penilaian (dikeluarkan dari pembilang & penyebut NK-ROKW dan NK-CRO).",
				calculationStep: "Dikecualikan dari penilaian Capaian Output TA 2026",
			};
		}

		if (!isConfirmed) {
			return {
				formulaType: "UNCONFIRMED",
				badge: "0 (Belum Konfirmasi)",
				score: "0.00",
				description:
					"Laporan berstatus Draft / belum dikonfirmasi. Sesuai regulasi bernilai 0.",
				calculationStep: "Gate Konfirmasi: Belum dikonfirmasi -> Nilai = 0.00",
			};
		}

		if (parsedPc === 0) {
			return {
				formulaType: "ZERO_PCRO",
				badge: "0 (PCRO = 0%)",
				score: "0.00",
				description:
					"Progres fisik (PCRO) 0% menghasilkan nilai 0 tanpa divide-by-zero.",
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
						? "Periode Desember: Wajib menggunakan Formula 2 (RVRO / Target Volume RO DIPA)."
						: "PCRO mencapai 100%: Otomatis berpindah ke Formula 2 (RVRO / Target Volume RO DIPA).",
				calculationStep: `min((${formatDynamicNumber(parsedRv, 0)} / ${formatDynamicNumber(parsedVol, 0)}) × 100, 100) = ${capped.toFixed(2)}`,
			};
		}

		// Formula 1: Jan-Nov with PCRO < 100%
		const ratio = parsedTpc > 0 ? (parsedPc / parsedTpc) * 100 : 0;
		const capped = Math.min(ratio, 100);
		return {
			formulaType: "FORMULA_1",
			badge: "Formula 1 (PCRO / TPCRO)",
			score: capped.toFixed(2),
			description:
				"Periode Januari–November dengan PCRO < 100%: Menggunakan Formula 1 (PCRO / Target TPCRO).",
			calculationStep: `min((${formatDynamicNumber(parsedPc, 2)}% / ${formatDynamicNumber(parsedTpc, 2)}%) × 100, 100) = ${capped.toFixed(2)}`,
		};
	}, [
		roCode,
		formMonth,
		rvro,
		volumeDipa,
		pcro,
		tpcro,
		isConfirmed,
		initialData.publishedPolicies,
	]);

	const handleOpenCreate = () => {
		setEditingItem(null);
		setFormMonth(selectedMonth);
		setRoCode("");
		setRoName("");
		setRvro("");
		setVolumeDipa("100");
		setPcro("");
		setTpcro("80");
		setReportedDate(new Date().toISOString().slice(0, 10));
		setIsConfirmed(false);
		setIsDrawerOpen(true);
	};

	const handleOpenEdit = (item: OutputReportRecord) => {
		setEditingItem(item);
		setFormMonth(item.month);
		setRoCode(item.roCode);
		setRoName(item.roName || "");
		setRvro(stripTrailingDecimals(item.rvro));
		setVolumeDipa(stripTrailingDecimals(item.volumeDipa));
		setPcro(stripTrailingDecimals(item.pcro));
		setTpcro(stripTrailingDecimals(item.tpcro));
		setReportedDate(
			item.reportedAt
				? new Date(item.reportedAt).toISOString().slice(0, 10)
				: "",
		);
		setIsConfirmed(item.confirmed);
		setIsDrawerOpen(true);
	};

	const handleSaveOutput = async () => {
		setActionMessage(null);
		setErrorMessage(null);

		if (!roCode.trim()) {
			return;
		}

		const rvClean = String(Math.round(Number(stripTrailingDecimals(rvro)) || 0));
		const volClean = String(Math.round(Number(stripTrailingDecimals(volumeDipa)) || 0));
		const pcClean = stripTrailingDecimals(pcro) || "0";
		const tpcClean = stripTrailingDecimals(tpcro) || "0";

		setIsSubmitting(true);
		try {
			await saveOutputReport({
				roCode: roCode.trim().toUpperCase(),
				roName: roName.trim() || undefined,
				month: formMonth,
				rvro: rvClean,
				volumeDipa: volClean,
				pcro: pcClean,
				tpcro: tpcClean,
				reportedAt: reportedDate ? `${reportedDate}T09:00:00.000Z` : null,
				confirmed: isConfirmed,
			});

			setActionMessage(
				`Data capaian output ${roCode.trim().toUpperCase()} berhasil disimpan.`,
			);
			setIsDrawerOpen(false);
			setEditingItem(null);
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error
					? err.message
					: "Gagal menyimpan capaian output.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleConfirm = async (id: string, code: string) => {
		try {
			await verifyOutputReport(id);
			setActionMessage(`Output ${code} berhasil dikonfirmasi.`);
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal mengonfirmasi output.",
			);
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Hapus catatan capaian output ini?")) return;
		try {
			await removeOutputReport(id);
			setActionMessage("Catatan output berhasil dihapus.");
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal menghapus data.",
			);
		}
	};

	const handleOpenFairnessModal = (item?: OutputReportRecord | string) => {
		if (item && typeof item === "object") {
			const uCode = item.roCode.trim().toUpperCase();
			setProposalRoCode(uCode);
			setProposalMonth(item.month);

			const existingProp = initialData.proposals?.find(
				(p: FairnessProposal) =>
					p.roCode.trim().toUpperCase() === uCode &&
					(p.month == null || p.month === item.month) &&
					p.status !== "rejected" &&
					p.status !== "cancelled",
			);

			const isCurrentlyExcluded =
				item.eligibility?.assessmentStatus === "excluded" || !!existingProp;

			setProposalIsExcluded(isCurrentlyExcluded);
			if (existingProp) {
				setProposalCategory(existingProp.category || "ro_khusus");
				setProposalBasis(
					existingProp.basisReference || "Fairness treatment IKPA TA 2026",
				);
				setProposalNote(existingProp.operatorNote || "");
				setProposalAttachment(existingProp.attachmentRef || "");
			} else if (item.eligibility?.assessmentStatus === "excluded") {
				setProposalCategory(item.eligibility.exclusionCategory || "ro_khusus");
				setProposalBasis(
					item.eligibility.policyReference || "Fairness treatment IKPA TA 2026",
				);
				setProposalNote(item.eligibility.exclusionReason || "");
				setProposalAttachment("");
			} else {
				setProposalCategory("ro_khusus");
				setProposalBasis("Fairness treatment IKPA TA 2026");
				setProposalNote("");
				setProposalAttachment("");
			}
		} else if (typeof item === "string") {
			setProposalRoCode(item.trim().toUpperCase());
			setProposalMonth(selectedMonth);
			setProposalIsExcluded(true);
			setProposalCategory("ro_khusus");
			setProposalBasis("Fairness treatment IKPA TA 2026");
			setProposalNote("");
			setProposalAttachment("");
		} else {
			setProposalRoCode("");
			setProposalMonth(selectedMonth);
			setProposalIsExcluded(true);
			setProposalCategory("ro_khusus");
			setProposalBasis("Fairness treatment IKPA TA 2026");
			setProposalNote("");
			setProposalAttachment("");
		}
		setIsProposalModalOpen(true);
	};

	const handleSubmitProposal = async () => {
		if (!proposalRoCode.trim()) {
			return;
		}

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
					attachmentRef: proposalAttachment.trim() || undefined,
				});

				setActionMessage(
					`Pengecualian fairness untuk RO ${proposalRoCode.trim().toUpperCase()} berhasil disimpan.`,
				);
			} else {
				await removeFairnessProposal({
					roCode: proposalRoCode.trim().toUpperCase(),
					month: proposalMonth,
				});

				setActionMessage(
					`Pengecualian fairness RO ${proposalRoCode.trim().toUpperCase()} dinonaktifkan. RO kembali dinilai normal.`,
				);
			}

			setIsProposalModalOpen(false);
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal menyimpan perlakuan fairness.",
			);
		} finally {
			setIsSubmittingProposal(false);
		}
	};

	const columns: ColumnDef<OutputReportRecord>[] = [
		{
			key: "ro",
			header: "Kode & Nama Rincian Output",
			render: (item) => (
				<div>
					<span className="font-mono font-bold text-foreground">
						{item.roCode}
					</span>
					<p className="text-[11px] text-muted-foreground line-clamp-1">
						{item.roName || `Rincian Output Bulan ${MONTH_NAMES[item.month - 1]}`}
					</p>
				</div>
			),
		},
		{
			key: "assessmentStatus",
			header: "Objek Penilaian",
			render: (item) => {
				const isExcluded = item.eligibility?.assessmentStatus === "excluded";
				if (isExcluded) {
					return (
						<div className="flex flex-col items-start gap-0.5">
							<span
								className="inline-flex items-center gap-1 rounded-md border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-700 uppercase"
								title={
									item.eligibility?.exclusionReason ||
									"Dikecualikan dari penilaian Capaian Output (Fairness Treatment)"
								}
							>
								<ShieldAlert className="size-3" />
								<span>Dikecualikan</span>
							</span>
							<span className="text-[10px] text-purple-600/80 font-medium">
								RO Khusus
							</span>
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
			key: "formula",
			header: "Formula NK-CRO",
			render: (item) => {
				const isExcluded = item.eligibility?.assessmentStatus === "excluded";
				if (isExcluded) {
					return <span className="text-muted-foreground font-mono">—</span>;
				}
				if (!item.confirmed) {
					return (
						<span
							className="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-bold text-yellow-800"
							title="Laporan belum konfirmasi -> nilai = 0"
						>
							0 (Draft)
						</span>
					);
				}
				const pc = Number.parseFloat(item.pcro) || 0;
				if (pc === 0) {
					return (
						<span
							className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground"
							title="PCRO = 0% -> nilai = 0"
						>
							0 (PCRO 0%)
						</span>
					);
				}
				if (item.month === 12 || pc >= 100) {
					return (
						<span
							className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800"
							title="Formula 2: min((RVRO / Volume DIPA) * 100, 100)"
						>
							Formula 2
						</span>
					);
				}
				return (
					<span
						className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800"
						title="Formula 1: min((PCRO / TPCRO) * 100, 100)"
					>
						Formula 1
					</span>
				);
			},
		},
		{
			key: "pcro",
			header: "PCRO / Target",
			render: (item) => (
				<div>
					<span className="font-semibold text-foreground">
						{formatDynamicPercent(item.pcro)}
					</span>
					<span className="text-[11px] text-muted-foreground block">
						Target: {formatDynamicPercent(item.tpcro)}
					</span>
				</div>
			),
		},
		{
			key: "volume",
			header: "RVRO / Target Vol",
			render: (item) => (
				<span className="font-medium text-foreground">
					{formatDynamicNumber(item.rvro, 0)} /{" "}
					{formatDynamicNumber(item.volumeDipa, 0)}
				</span>
			),
		},
		{
			key: "timeliness",
			header: "Ketepatan Waktu",
			render: (item) => {
				const isExcluded = item.eligibility?.assessmentStatus === "excluded";
				if (isExcluded) {
					return <span className="text-muted-foreground font-mono">—</span>;
				}
				if (!item.reportedAt) {
					return (
						<span className="rounded bg-warning/10 px-2 py-0.5 text-[10px] font-bold text-warning">
							Belum Lapor (—)
						</span>
					);
				}
				const rDate = new Date(item.reportedAt).toISOString().slice(0, 10);
				const dDate = item.deadlineDate || canonicalDeadline;
				const isTimely = rDate <= dDate;
				return (
					<div>
						<span
							className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
								isTimely
									? "bg-success/10 text-success"
									: "bg-danger/10 text-danger"
							}`}
						>
							{isTimely ? "Tepat (100)" : "Terlambat (0)"}
						</span>
						<p className="text-[10px] text-muted-foreground mt-0.5">
							Lapor: {formatDateDDMMYYYY(item.reportedAt)}
						</p>
					</div>
				);
			},
		},
		{
			key: "status",
			header: "Status Konfirmasi",
			render: (item) => (
				<span
					className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
						item.confirmed
							? "bg-success/10 text-success"
							: "bg-warning/10 text-warning"
					}`}
				>
					{item.confirmed ? "Terkonfirmasi" : "Draft (Belum Konfirmasi)"}
				</span>
			),
		},
		{
			key: "actions",
			header: "Aksi",
			render: (item) => (
				<div className="flex items-center gap-1.5">
					<button
						type="button"
						onClick={() => handleOpenEdit(item)}
						className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-surface-muted transition"
						title="Edit Rincian Output"
					>
						<Edit className="size-3 text-primary" />
						<span>Edit</span>
					</button>
					{!item.confirmed && (
						<button
							type="button"
							onClick={() => handleConfirm(item.id, item.roCode)}
							className="inline-flex items-center gap-1 rounded-lg bg-success/10 px-2 py-1 text-[11px] font-semibold text-success hover:bg-success/20 transition"
							title="Konfirmasi Laporan"
						>
							<FileCheck className="size-3" />
							<span>Konfirmasi</span>
						</button>
					)}
					<button
						type="button"
						onClick={() => handleOpenFairnessModal(item)}
						className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
							item.eligibility?.assessmentStatus === "excluded"
								? "bg-purple-500/15 text-purple-700 hover:bg-purple-500/25 border border-purple-500/30 font-bold"
								: "border border-border bg-surface text-foreground hover:bg-surface-muted"
						}`}
						title={
							item.eligibility?.assessmentStatus === "excluded"
								? "Ubah Status Fairness (Sedang Dikecualikan)"
								: "Atur Fairness / Pengecualian RO"
						}
					>
						<Scale className="size-3 text-purple-600" />
						<span>
							{item.eligibility?.assessmentStatus === "excluded"
								? "Fairness (Aktif)"
								: "Fairness"}
						</span>
					</button>
					<button
						type="button"
						onClick={() => handleDelete(item.id)}
						className="inline-flex items-center rounded-lg p-1 text-danger hover:bg-danger/10 transition"
						title="Hapus Output"
					>
						<Trash2 className="size-3.5" />
					</button>
				</div>
			),
		},
	];

	return (
		<OperatorShell currentPath="/operator/data/output-achievement">
			<div className="space-y-6">
				{/* Top Summary Banner with Formula Explanation */}
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div className="flex items-center gap-3">
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
								. Kontribusi Skor = IKPA-CO × 25%.
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
							<span>Panduan Formula (PER-5)</span>
						</button>
						<button
							type="button"
							onClick={() => handleOpenFairnessModal()}
							className="inline-flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-500/20 transition shadow-xs"
						>
							<Scale className="size-3.5" />
							<span>Atur Fairness RO</span>
						</button>
					</div>
				</div>

				{/* Month Selector Pills */}
				<div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-background p-2 text-xs">
					<div className="flex flex-wrap items-center gap-1">
						{MONTH_NAMES.map((name, idx) => {
							const m = idx + 1;
							const isSelected = m === selectedMonth;
							return (
								<button
									key={name}
									type="button"
									onClick={() => setSelectedMonth(m)}
									className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
										isSelected
											? "bg-primary text-primary-foreground shadow-xs"
											: "text-muted-foreground hover:text-foreground hover:bg-surface-muted"
									}`}
								>
									{name}
								</button>
							);
						})}
					</div>
					<div className="text-[11px] text-muted-foreground px-2">
						Tahun Anggaran <strong className="text-foreground">2026</strong>
					</div>
				</div>

				{/* Feedback status */}
				{actionMessage && (
					<div className="flex items-center gap-2.5 rounded-xl border border-success/30 bg-success/10 p-4 text-xs font-semibold text-success shadow-xs">
						<CheckCircle2 className="size-4 shrink-0" />
						<p>{actionMessage}</p>
					</div>
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

				{/* 4 Top Authoritative Summary Metrics Cards */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{/* Card 1: RO Objek Penilaian */}
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
								<span className="text-purple-600 font-medium">
									{excludedCount} RO Dikecualikan (Fairness)
								</span>
							) : (
								"100% RO Eligible Dinilai"
							)}
						</p>
					</div>

					{/* Card 2: NK-ROKW (30%) */}
					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1.5">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold">
								Ketepatan Waktu (NK-ROKW - 30%)
							</span>
							<Clock className="size-4 text-warning" />
						</div>
						<p className="text-xl font-bold text-foreground">
							{nkkwScore}{" "}
							<span className="text-xs font-normal text-muted-foreground">
								/ 100
							</span>
						</p>
						<p className="text-[11px] text-muted-foreground">
							{timelyCount} Tepat · {lateCount} Terlambat ·{" "}
							{pendingTimelinessCount} Belum
						</p>
					</div>

					{/* Card 3: NK-CRO (70%) */}
					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1.5">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold">
								Capaian RO (NK-CRO - 70%)
							</span>
							<Percent className="size-4 text-success" />
						</div>
						<p className="text-xl font-bold text-foreground">
							{nkcroScore}{" "}
							<span className="text-xs font-normal text-muted-foreground">
								/ 100
							</span>
						</p>
						<p className="text-[11px] text-muted-foreground">
							Rata-rata PCRO: {formatDynamicPercent(avgPcro)} (TPCRO:{" "}
							{formatDynamicPercent(avgTpcro)})
						</p>
					</div>

					{/* Card 4: Nilai IKPA-CO & Kontribusi 25% */}
					<div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-xs space-y-1.5">
						<div className="flex items-center justify-between text-primary">
							<span className="text-xs font-bold">
								Nilai IKPA-CO & Kontribusi
							</span>
							<Award className="size-4 text-primary" />
						</div>
						<p className="text-xl font-extrabold text-primary">
							{finalScore}{" "}
							<span className="text-xs font-normal text-muted-foreground">
								/ 100
							</span>
						</p>
						<p className="text-[11px] font-semibold text-foreground">
							Kontribusi: +{weightedContribution} poin ke Satker
						</p>
					</div>
				</div>

				{/* Strip Reminder 5 Hari Kerja Wajib */}
				<section
					aria-label="Reminder batas waktu 5 hari kerja"
					className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background p-4 sm:p-5 shadow-xs"
				>
					<div className="flex items-center gap-3">
						<div className="flex size-9 items-center justify-center rounded-xl bg-warning/10 text-warning">
							<Clock className="size-4.5" />
						</div>
						<div>
							<p className="text-xs font-bold text-foreground">
								Batas Konfirmasi Bulan {MONTH_NAMES[selectedMonth - 1]}:{" "}
								<span className="text-primary underline">
									{formatDateDDMMYYYY(canonicalDeadline)}
								</span>{" "}
								(Hari Kerja ke-5 Bulan M+1)
							</p>
							<p className="text-[11px] text-muted-foreground">
								Perhitungan deadline kanonis resmi melewati akhir pekan dan hari
								libur nasional sesuai kalender KPPN.
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2 text-xs">
						<span className="rounded-full bg-success/10 px-2.5 py-1 font-semibold text-success">
							{timelyCount} Tepat Waktu
						</span>
						{lateCount > 0 && (
							<span className="rounded-full bg-danger/10 px-2.5 py-1 font-semibold text-danger">
								{lateCount} Terlambat
							</span>
						)}
						{pendingTimelinessCount > 0 && (
							<span className="rounded-full bg-warning/10 px-2.5 py-1 font-semibold text-warning">
								{pendingTimelinessCount} Menunggu Konfirmasi
							</span>
						)}
					</div>
				</section>

				{/* Table Filter Tabs & Search */}
				<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
					<div className="flex flex-wrap items-center gap-1.5">
						<button
							type="button"
							onClick={() => setActiveTabFilter("all")}
							className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
								activeTabFilter === "all"
									? "bg-primary text-primary-foreground shadow-xs"
									: "text-muted-foreground hover:text-foreground hover:bg-surface-muted"
							}`}
						>
							Semua ({monthData.length})
						</button>
						<button
							type="button"
							onClick={() => setActiveTabFilter("evaluated")}
							className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
								activeTabFilter === "evaluated"
									? "bg-primary text-primary-foreground shadow-xs"
									: "text-muted-foreground hover:text-foreground hover:bg-surface-muted"
							}`}
						>
							Dinilai ({evaluatedCount})
						</button>
						<button
							type="button"
							onClick={() => setActiveTabFilter("excluded")}
							className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
								activeTabFilter === "excluded"
									? "bg-purple-600 text-white shadow-xs"
									: "text-muted-foreground hover:text-foreground hover:bg-surface-muted"
							}`}
						>
							Dikecualikan (Fairness) ({excludedCount})
						</button>
						<button
							type="button"
							onClick={() => setActiveTabFilter("action_needed")}
							className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
								activeTabFilter === "action_needed"
									? "bg-warning text-warning-foreground shadow-xs"
									: "text-muted-foreground hover:text-foreground hover:bg-surface-muted"
							}`}
						>
							Butuh Tindakan (
							{
								monthData.filter((i) => !i.confirmed || !i.reportedAt)
									.length
							}
							)
						</button>
					</div>
				</div>

				{/* Data Table */}
				<DomainDataTable
					title={`Rincian Output Bulan ${MONTH_NAMES[selectedMonth - 1]} 2026`}
					data={filteredData}
					columns={columns}
					searchValue={search}
					onSearchChange={setSearch}
					onAddClick={handleOpenCreate}
					totalCount={filteredData.length}
				/>

				{/* Drawer Form: Add / Edit RO with Real-Time Formula Preview */}
				<DomainFormDrawer
					isOpen={isDrawerOpen}
					title={
						editingItem
							? `Edit Capaian RO: ${editingItem.roCode}`
							: "Input Capaian Rincian Output (RO)"
					}
					description="Masukkan data capaian fisik (PCRO) dan realisasi volume (RVRO). Sistem akan menghitung preview formula secara otomatis."
					onClose={() => {
						setIsDrawerOpen(false);
						setEditingItem(null);
					}}
					onSubmit={handleSaveOutput}
					isSubmitting={isSubmitting}
					isSubmitDisabled={!roCode.trim()}
				>
					<div className="space-y-4">
						{/* Live Real-Time Formula Preview Card inside Drawer */}
						<div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2 text-xs">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-1.5 font-bold text-primary">
									<Sparkles className="size-3.5" />
									<span>Live Calculation Preview</span>
								</div>
								<span
									className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
										liveDrawerPreview.formulaType === "EXCLUDED"
											? "bg-purple-500/20 text-purple-700"
											: liveDrawerPreview.formulaType === "FORMULA_2"
												? "bg-blue-500/20 text-blue-700"
												: liveDrawerPreview.formulaType === "FORMULA_1"
													? "bg-emerald-500/20 text-emerald-700"
													: "bg-warning/20 text-warning-foreground"
									}`}
								>
									{liveDrawerPreview.badge}
								</span>
							</div>

							<div className="rounded-lg bg-background p-2.5 font-mono text-[11px] text-foreground border border-border/60">
								{liveDrawerPreview.calculationStep}
							</div>

							<div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
								<span>Estimasi Nilai NK-CRO per RO:</span>
								<strong className="text-sm font-bold text-foreground">
									{liveDrawerPreview.score}
								</strong>
							</div>
							<p className="text-[10px] text-muted-foreground italic">
								{liveDrawerPreview.description}
							</p>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<label
									htmlFor="out-ro-code"
									className="block text-xs font-semibold text-foreground"
								>
									Kode Rincian Output (RO)
								</label>
								<input
									id="out-ro-code"
									type="text"
									required
									placeholder="Contoh: 1234.EBA.001"
									value={roCode}
									onChange={(e) => setRoCode(e.target.value.toUpperCase())}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 font-mono font-bold text-xs text-foreground focus:border-primary focus:outline-none"
								/>
							</div>

							<div className="space-y-1.5">
								<label
									htmlFor="out-month"
									className="block text-xs font-semibold text-foreground"
								>
									Bulan Laporan
								</label>
								<select
									id="out-month"
									value={formMonth}
									onChange={(e) => setFormMonth(Number(e.target.value))}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								>
									{MONTH_NAMES.map((n, idx) => (
										<option key={n} value={idx + 1}>
											{n}
										</option>
									))}
								</select>
							</div>
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="out-ro-name"
								className="block text-xs font-semibold text-foreground"
							>
								Nama / Uraian Rincian Output (Opsional)
							</label>
							<input
								id="out-ro-name"
								type="text"
								placeholder="Contoh: Layanan Perkantoran dan Operasional"
								value={roName}
								onChange={(e) => setRoName(e.target.value)}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							/>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<label
									htmlFor="out-vol-dipa"
									className="block text-xs font-semibold text-foreground"
								>
									Target Volume RO DIPA
								</label>
								<FormattedNumberInput
									id="out-vol-dipa"
									allowDecimal={false}
									required
									placeholder="Contoh: 100"
									value={volumeDipa}
									onChange={setVolumeDipa}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
							</div>

							<div className="space-y-1.5">
								<label
									htmlFor="out-rvro"
									className="block text-xs font-semibold text-foreground"
								>
									Realisasi Volume (RVRO)
								</label>
								<FormattedNumberInput
									id="out-rvro"
									allowDecimal={false}
									required
									placeholder="Contoh: 25"
									value={rvro}
									onChange={setRvro}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<label
									htmlFor="out-tpcro"
									className="block text-xs font-semibold text-foreground"
								>
									Target PCRO (TPCRO %)
								</label>
								<FormattedNumberInput
									id="out-tpcro"
									allowDecimal
									maxDecimals={2}
									max={100}
									required
									placeholder="Contoh: 80"
									value={tpcro}
									onChange={setTpcro}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
							</div>

							<div className="space-y-1.5">
								<label
									htmlFor="out-pcro"
									className="block text-xs font-semibold text-foreground"
								>
									Progres Fisik PCRO (%)
								</label>
								<FormattedNumberInput
									id="out-pcro"
									allowDecimal
									maxDecimals={2}
									max={100}
									required
									placeholder="Contoh: 25"
									value={pcro}
									onChange={setPcro}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
							</div>
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="out-reported-date"
								className="block text-xs font-semibold text-foreground"
							>
								Tanggal Pelaporan (OMSPAN)
							</label>
							<div className="flex items-center gap-2">
								<input
									id="out-reported-date"
									type="date"
									value={reportedDate}
									onChange={(e) => setReportedDate(e.target.value)}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
								<button
									type="button"
									onClick={() =>
										setReportedDate(new Date().toISOString().slice(0, 10))
									}
									className="rounded-lg border border-border px-2.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-surface-muted shrink-0"
								>
									Hari Ini
								</button>
							</div>
							<p className="text-[10px] text-muted-foreground">
								Tenggat 5 Hari Kerja: <strong>{formatDateDDMMYYYY(canonicalDeadline)}</strong>
							</p>
						</div>

						<div className="flex items-center gap-2 pt-2 border-t border-border">
							<input
								id="out-is-confirmed"
								type="checkbox"
								checked={isConfirmed}
								onChange={(e) => setIsConfirmed(e.target.checked)}
								disabled={isSubmitting}
								className="size-4 rounded border-border text-primary focus:ring-primary"
							/>
							<label
								htmlFor="out-is-confirmed"
								className="text-xs text-foreground font-semibold cursor-pointer"
							>
								Konfirmasi data pelaporan (Status Terkonfirmasi)
							</label>
						</div>
					</div>
				</DomainFormDrawer>

				{/* Fairness Treatment & Exclusion Setting Modal */}
				{isProposalModalOpen && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
						<div className="w-full max-w-lg rounded-2xl border border-border bg-background p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
							<div className="flex items-start justify-between">
								<div className="flex items-center gap-2.5">
									<div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
										<Scale className="size-5" />
									</div>
									<div>
										<h3 className="text-base font-bold text-foreground">
											Pengaturan Fairness & Pengecualian RO
										</h3>
										<p className="text-xs text-muted-foreground">
											Atur apakah RO dikecualikan dari penilaian (tidak mengurangi nilai satker) atau dinilai normal.
										</p>
									</div>
								</div>
								<button
									type="button"
									onClick={() => setIsProposalModalOpen(false)}
									className="rounded-lg p-1 text-muted-foreground hover:bg-surface-muted"
								>
									<X className="size-4" />
								</button>
							</div>

							{/* Status Mode Selector */}
							<div className="grid grid-cols-2 gap-2 text-xs">
								<button
									type="button"
									onClick={() => setProposalIsExcluded(true)}
									className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
										proposalIsExcluded
											? "border-purple-600 bg-purple-500/10 text-foreground ring-1 ring-purple-600"
											: "border-border bg-surface text-muted-foreground hover:bg-surface-muted"
									}`}
								>
									<div className="flex items-center gap-1.5 font-bold text-purple-700 dark:text-purple-400">
										<Scale className="size-3.5" />
										<span>Dikecualikan (Fairness)</span>
									</div>
									<p className="text-[11px] text-muted-foreground">
										Dikeluarkan dari penilaian IKPA (tidak mengurangi nilai satker).
									</p>
								</button>

								<button
									type="button"
									onClick={() => setProposalIsExcluded(false)}
									className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
										!proposalIsExcluded
											? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
											: "border-border bg-surface text-muted-foreground hover:bg-surface-muted"
									}`}
								>
									<div className="flex items-center gap-1.5 font-bold text-primary">
										<CheckCircle2 className="size-3.5" />
										<span>Dinilai (Normal)</span>
									</div>
									<p className="text-[11px] text-muted-foreground">
										Dinilai secara standar berdasarkan realisasi fisik dan volume.
									</p>
								</button>
							</div>

							<div className="space-y-3.5 text-xs">
								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-1">
										<label className="font-semibold text-foreground">
											Kode RO
										</label>
										<input
											type="text"
											required
											placeholder="Contoh: FAN.ZZ1"
											value={proposalRoCode}
											onChange={(e) =>
												setProposalRoCode(e.target.value.toUpperCase())
											}
											className="h-9 w-full rounded-lg border border-border bg-surface px-3 font-mono font-bold text-foreground focus:border-primary focus:outline-none"
										/>
									</div>

									<div className="space-y-1">
										<label className="font-semibold text-foreground">
											Periode Bulan
										</label>
										<select
											value={proposalMonth ?? ""}
											onChange={(e) =>
												setProposalMonth(
													e.target.value ? Number(e.target.value) : null,
												)
											}
											className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
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
											<label className="font-semibold text-foreground">
												Kategori Pengecualian
											</label>
											<select
												value={proposalCategory}
												onChange={(e) => setProposalCategory(e.target.value)}
												className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
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
											<label className="font-semibold text-foreground">
												Dasar Regulasi / Surat Referensi
											</label>
											<input
												type="text"
												required
												placeholder="Contoh: PER-5/PB/2024 atau ND-123/PB/2026"
												value={proposalBasis}
												onChange={(e) => setProposalBasis(e.target.value)}
												className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
											/>
										</div>

										<div className="space-y-1">
											<label className="font-semibold text-foreground">
												Catatan & Alasan Operator Satker
											</label>
											<textarea
												rows={3}
												placeholder="Jelaskan alasan mengapa RO ini perlu dikecualikan dari penilaian Capaian Output..."
												value={proposalNote}
												onChange={(e) => setProposalNote(e.target.value)}
												className="w-full rounded-lg border border-border bg-surface p-2.5 text-foreground focus:border-primary focus:outline-none"
											/>
										</div>

										<div className="space-y-1">
											<label className="font-semibold text-foreground">
												Referensi Lampiran / Nomor Dokumen (Opsional)
											</label>
											<input
												type="text"
												placeholder="Contoh: S-999/WPB.16/KP.01/2026"
												value={proposalAttachment}
												onChange={(e) => setProposalAttachment(e.target.value)}
												className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
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

							{/* Previous proposals list */}
							{initialData.proposals && initialData.proposals.length > 0 && (
								<div className="border-t border-border pt-3 space-y-2">
									<span className="text-[11px] font-bold text-muted-foreground uppercase">
										Daftar Pengecualian Fairness Satker
									</span>
									<div className="max-h-28 overflow-y-auto space-y-1.5 text-xs">
										{initialData.proposals.map((p: FairnessProposal) => (
											<div
												key={p.id}
												className="flex items-center justify-between rounded-lg border border-border/60 bg-surface p-2"
											>
												<div>
													<span className="font-bold text-foreground">
														{p.roCode}
													</span>
													<span className="text-muted-foreground ml-1.5">
														({p.category})
													</span>
													{p.month && (
														<span className="text-muted-foreground ml-1">
															- Bln {p.month}
														</span>
													)}
												</div>
												<span
													className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-700 uppercase"
												>
													Dikecualikan
												</span>
											</div>
										))}
									</div>
								</div>
							)}

							<div className="flex items-center justify-end gap-2 border-t border-border pt-4">
								<button
									type="button"
									onClick={() => setIsProposalModalOpen(false)}
									className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted"
								>
									Batal
								</button>
								<button
									type="button"
									disabled={
										isSubmittingProposal ||
										!proposalRoCode.trim() ||
										(proposalIsExcluded && !proposalBasis.trim())
									}
									onClick={handleSubmitProposal}
									className={`rounded-lg px-4 py-2 text-xs font-semibold text-white transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed ${
										proposalIsExcluded
											? "bg-purple-600 hover:bg-purple-700"
											: "bg-primary hover:bg-primary-hover"
									}`}
								>
									{isSubmittingProposal ? "Menyimpan..." : "Simpan"}
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Pusdiklat & PER-5 Knowledge Guide Modal */}
				{isGuideOpen && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
						<div className="w-full max-w-2xl rounded-2xl border border-border bg-background p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
							<div className="flex items-start justify-between border-b border-border pb-3">
								<div className="flex items-center gap-2.5">
									<div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
										<BookOpen className="size-5" />
									</div>
									<div>
										<h3 className="text-base font-bold text-foreground">
											Panduan Resmi Capaian Output & Fairness Treatment
										</h3>
										<p className="text-xs text-muted-foreground">
											Referensi Regulasi PER-5/PB/2024 & Petunjuk Teknis IKPA TA
											2026.
										</p>
									</div>
								</div>
								<button
									type="button"
									onClick={() => setIsGuideOpen(false)}
									className="rounded-lg p-1 text-muted-foreground hover:bg-surface-muted"
								>
									<X className="size-4" />
								</button>
							</div>

							<div className="space-y-4 text-xs">
								<div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-1.5">
									<p className="font-bold text-primary">
										1. Bobot IKPA 25% dan Formula Akhir
									</p>
									<p className="text-foreground">
										Indikator Capaian Output memiliki bobot terbesar (25%) dalam
										penilaian IKPA. Nilai akhir dihitung dengan formula:
									</p>
									<div className="rounded-lg bg-background p-2.5 font-mono font-bold text-foreground border border-border/80">
										Nilai IKPA-CO = (NK-ROKW × 30%) + (NK-CRO × 70%)
									</div>
								</div>

								<div className="rounded-xl border border-border bg-surface p-4 space-y-2">
									<p className="font-bold text-foreground">
										2. Ketentuan Formula NK-CRO (Capaian Rincian Output)
									</p>
									<ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
										<li>
											<strong className="text-foreground">
												Gate Konfirmasi:
											</strong>{" "}
											Laporan yang belum dikonfirmasi bernilai 0.
										</li>
										<li>
											<strong className="text-foreground">PCRO = 0%:</strong>{" "}
											Menghasilkan nilai 0 (tidak divide-by-zero).
										</li>
										<li>
											<strong className="text-foreground">Formula 1:</strong>{" "}
											Digunakan pada periode <em>Januari–November</em> saat PCRO
											&lt; 100%:
											<div className="font-mono text-foreground font-semibold mt-0.5">
												Nilai = min((PCRO / Target TPCRO) × 100, 100)
											</div>
										</li>
										<li>
											<strong className="text-foreground">Formula 2:</strong>{" "}
											Digunakan pada periode <em>Desember</em> ATAU saat PCRO
											mencapai 100%:
											<div className="font-mono text-foreground font-semibold mt-0.5">
												Nilai = min((RVRO / Target Volume RO DIPA) × 100, 100)
											</div>
										</li>
									</ul>
								</div>

								<div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-2">
									<p className="font-bold text-purple-700">
										3. Fairness Treatment & Penanganan RO Khusus
									</p>
									<p className="text-muted-foreground">
										RO Khusus (seperti kode FAN.ZZ1 atau RO penugasan khusus)
										berstatus <strong className="text-foreground">dikecualikan</strong>{" "}
										dari objek penilaian. RO ini{" "}
										<strong className="text-foreground">
											dikeluarkan dari pembilang dan penyebut
										</strong>{" "}
										dalam penghitungan NK-ROKW dan NK-CRO tanpa menghapus data
										laporannya.
									</p>
								</div>
							</div>

							<div className="flex justify-end border-t border-border pt-3">
								<button
									type="button"
									onClick={() => setIsGuideOpen(false)}
									className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs"
								>
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

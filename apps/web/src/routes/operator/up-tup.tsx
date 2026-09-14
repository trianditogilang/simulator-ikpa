import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
	AlertCircle,
	AlertTriangle,
	ArrowRight,
	Calendar,
	CheckCircle2,
	Clock,
	Coins,
	CreditCard,
	HelpCircle,
	Info,
	Lightbulb,
	Pencil,
	RotateCw,
	Save,
	Scale,
	ShieldCheck,
	Sparkles,
	Trash2,
	TrendingUp,
} from "lucide-react";
import { Dialog } from "radix-ui";
import { useMemo, useRef, useState } from "react";
import {
	type ColumnDef,
	DomainDataTable,
} from "@/components/data/domain-data-table";
import { DomainFormDrawer } from "@/components/data/domain-form-drawer";
import { FormattedNumberInput } from "@/components/data/formatted-number-input";
import { useActiveContext } from "@/components/layout/active-context";
import { OperatorShell } from "@/components/layout/operator-shell";
import { SaveScenarioDialog } from "@/components/operator/save-scenario-dialog";
import { UpTupAssumptionPanel } from "@/components/operator/up-tup-assumption-panel";
import {
	formatDateDDMMYYYY,
	formatNumber,
	formatRupiah,
} from "@/lib/format";
import {
	DEFAULT_UP_TUP_ASSUMPTIONS,
	type UpTupAssumptions,
	analyzeGupPlan,
	formatDateIndonesian,
} from "@/lib/simulation/up-tup-assumptions";
import {
	buildGupReminders,
	calcUpTupScore,
	isThr2026FairnessApplied,
	mapActualToEngine,
	mergeWithAssumptions,
} from "@/lib/simulation/up-tup-workspace";
import {
	addUpTup,
	editUpTup,
	fetchUpTupAndKkp,
	removeKkpUsage,
	removeUpTup,
	saveKkpUsage,
	type KkpRecord,
	type UpTupRecord,
} from "@/services/up-tup-kkp-service";

export const Route = createFileRoute("/operator/up-tup")({
	loader: async ({ context }) => {
		const activeOrgId =
			context.auth?.isAuthenticated &&
			(context.access?.status === "operator_single_scope" ||
				context.access?.status === "operator_multiple_scopes")
				? (context.access.activeOrganizationId ?? undefined)
				: undefined;

		return fetchUpTupAndKkp(activeOrgId);
	},
	component: UpTupPage,
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

const TYPE_LABELS: Record<string, string> = {
	UP: "Uang Persediaan (UP Awal)",
	TUP: "Tambahan UP (TUP)",
	GUP: "Ganti UP (Revolving GUP)",
	GUP_NIHIL: "GUP Nihil",
	PTUP: "Pertanggungjawaban TUP (PTUP)",
	SETORAN_TUP: "Setoran TUP",
};

const KKP_TARGETS_2026 = [
	{ quarter: "TW I", targetPct: 1.0, monthEnd: 3, label: "Akhir Maret" },
	{ quarter: "TW II", targetPct: 5.0, monthEnd: 6, label: "Akhir Juni" },
	{ quarter: "TW III", targetPct: 9.0, monthEnd: 9, label: "Akhir September" },
	{ quarter: "TW IV", targetPct: 12.5, monthEnd: 12, label: "Akhir Desember" },
];

function UpTupPage() {
	const router = useRouter();
	const data = Route.useLoaderData();
	const activeContext = useActiveContext();
	const currentMonth =
		activeContext?.context.period.kind === "month"
			? activeContext.context.period.value
			: new Date().getMonth() + 1;
	const [assumptions, setAssumptions] = useState<UpTupAssumptions | null>(null);
	const [isHelpOpen, setIsHelpOpen] = useState(false);
	const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
	const [scenarioMessage, setScenarioMessage] = useState<string | null>(null);
	const dataSectionRef = useRef<HTMLDivElement>(null);

	const scrollToData = (tab: "uptup" | "kkp") => {
		setActiveTab(tab);
		requestAnimationFrame(() => {
			dataSectionRef.current?.scrollIntoView({
				behavior: "smooth",
				block: "start",
			});
		});
	};

	// Data Management State (from /operator/data/up-tup-kkp)
	const [activeTab, setActiveTab] = useState<"uptup" | "kkp">("uptup");
	const [search, setSearch] = useState("");
	const [isUpTupDrawerOpen, setIsUpTupDrawerOpen] = useState(false);
	const [editingUpTup, setEditingUpTup] = useState<UpTupRecord | null>(null);
	const [isKkpDrawerOpen, setIsKkpDrawerOpen] = useState(false);
	const [editingKkp, setEditingKkp] = useState<KkpRecord | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [actionMessage, setActionMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	// UP/TUP Form State
	const [txType, setTxType] = useState<
		"UP" | "TUP" | "GUP" | "GUP_NIHIL" | "PTUP" | "SETORAN_TUP"
	>("GUP");
	const [txAmount, setTxAmount] = useState("");
	const [txSp2dDate, setTxSp2dDate] = useState(
		new Date().toISOString().slice(0, 10),
	);
	const [refSp2dDate, setRefSp2dDate] = useState("");

	// Active UP amount from existing UP record
	const activeUpAmount = useMemo(() => {
		const upRecord = data.upTupList.find((r) => r.type === "UP");
		return upRecord && Number(upRecord.amount) > 0 ? Number(upRecord.amount) : 0;
	}, [data.upTupList]);

	// Real-time pre-save GUP analysis on draft modal inputs
	const gupAnalysis = useMemo(() => {
		if (txType !== "GUP") return null;
		if (!activeUpAmount || activeUpAmount <= 0) return null;
		if (!txAmount || Number(txAmount) <= 0 || !refSp2dDate || !txSp2dDate) return null;
		if (txSp2dDate <= refSp2dDate) return null;

		return analyzeGupPlan({
			nilaiUP: String(activeUpAmount),
			nilaiRencanaGUP: txAmount,
			tanggalGUPSebelumnya: refSp2dDate,
			tanggalRencanaGUP: txSp2dDate,
			tupTepat: 0,
			tupTerlambat: 0,
			ptupTepat: 0,
			gupNihilCount: 0,
			setoranTepat: 0,
			kkpNominal: "0",
			kkpTanggal: "",
		});
	}, [txType, activeUpAmount, txAmount, refSp2dDate, txSp2dDate]);

	// Previous UP / GUP records available for reference
	const previousUpGupList = useMemo(() => {
		return data.upTupList
			.filter((u) => {
				if (u.type !== "UP" && u.type !== "GUP" && u.type !== "GUP_NIHIL") return false;
				if (editingUpTup && u.id === editingUpTup.id) return false;
				return Boolean(u.sp2dAt);
			})
			.sort((a, b) => b.sp2dAt.localeCompare(a.sp2dAt));
	}, [data.upTupList, editingUpTup]);

	// Form validation state: all required fields must be filled to enable submit
	const isUpTupSubmitDisabled = useMemo(() => {
		const amountVal = Number(txAmount);
		if (!Number.isFinite(amountVal) || amountVal <= 0) return true;
		if (!txSp2dDate || !txSp2dDate.trim()) return true;
		if (txType === "GUP" && (!refSp2dDate || !refSp2dDate.trim())) return true;
		return false;
	}, [txAmount, txSp2dDate, txType, refSp2dDate]);

	// KKP Form State
	const [kkpMonth, setKkpMonth] = useState<number>(new Date().getMonth() + 1);
	const [kkpAmount, setKkpAmount] = useState("");
	const [kkpUsageDate, setKkpUsageDate] = useState(
		new Date().toISOString().slice(0, 10),
	);

	// Status kepemilikan KKP satker (Default: none / Tidak Memiliki UP KKP)
	const [kkpStatus, setKkpStatus] = useState<"active" | "pending" | "none">(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("ikpa_satker_kkp_status");
			if (saved === "active" || saved === "pending" || saved === "none") {
				return saved;
			}
		}
		return data.kkpList.length > 0 ? "active" : "none";
	});

	const [monthlyKkpCeiling, setMonthlyKkpCeiling] = useState<string>(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("ikpa_satker_kkp_ceiling");
			if (saved !== null) return saved;
		}
		return data.kkpList.length > 0 ? "50000000" : "0";
	});

	const handleKkpStatusChange = (newStatus: "active" | "pending" | "none") => {
		setKkpStatus(newStatus);
		if (typeof window !== "undefined") {
			localStorage.setItem("ikpa_satker_kkp_status", newStatus);
		}
		if (newStatus === "none") {
			setMonthlyKkpCeiling("0");
			if (typeof window !== "undefined") {
				localStorage.setItem("ikpa_satker_kkp_ceiling", "0");
			}
		} else if (newStatus === "active" && (monthlyKkpCeiling === "0" || !monthlyKkpCeiling)) {
			setMonthlyKkpCeiling("50000000");
			if (typeof window !== "undefined") {
				localStorage.setItem("ikpa_satker_kkp_ceiling", "50000000");
			}
		}
	};

	const handleMonthlyCeilingChange = (val: string) => {
		setMonthlyKkpCeiling(val);
		if (typeof window !== "undefined") {
			localStorage.setItem("ikpa_satker_kkp_ceiling", val);
		}
	};

	// Totals
	const totalTupAmount = useMemo(() => {
		return data.upTupList
			.filter((u) => u.type === "TUP")
			.reduce((sum, u) => sum + (Number.parseFloat(u.amount) || 0), 0);
	}, [data.upTupList]);

	const totalSetoranTupAmount = useMemo(() => {
		return data.upTupList
			.filter((u) => u.type === "SETORAN_TUP")
			.reduce((sum, u) => sum + (Number.parseFloat(u.amount) || 0), 0);
	}, [data.upTupList]);

	const pctSetoranTup = useMemo(() => {
		if (totalTupAmount <= 0) return 0;
		return (totalSetoranTupAmount / totalTupAmount) * 100;
	}, [totalTupAmount, totalSetoranTupAmount]);

	const annualKkpCeiling = useMemo(() => {
		const monthly = Number(monthlyKkpCeiling) || 0;
		return monthly * 12;
	}, [monthlyKkpCeiling]);

	const hasKkp = kkpStatus === "active" || data.kkpList.length > 0;

	const actualEngine = useMemo(
		() => mapActualToEngine(data.upTupList, data.kkpList, data.year),
		[data],
	);

	const mergedEngine = useMemo(
		() => mergeWithAssumptions(actualEngine, assumptions),
		[actualEngine, assumptions],
	);

	const score = useMemo(
		() =>
			calcUpTupScore(
				mergedEngine.transactions,
				mergedEngine.kkpTransactions,
				currentMonth,
				undefined,
				hasKkp,
			),
		[mergedEngine, currentMonth, hasKkp],
	);

	const actualScore = useMemo(
		() =>
			calcUpTupScore(
				actualEngine.transactions,
				actualEngine.kkpTransactions,
				currentMonth,
				undefined,
				hasKkp,
			),
		[actualEngine, currentMonth, hasKkp],
	);

	const reminders = useMemo(
		() => buildGupReminders(data.upTupList),
		[data.upTupList],
	);
	const urgentCount = reminders.filter((r) => r.status !== "Tepat Waktu").length;

	// Deteksi transaksi yang memenuhi Fairness THR 2026 (SP2D referensi: 18 Feb - 17 Mar 2026)
	const thrFairnessTxCount = useMemo(() => {
		return data.upTupList.filter((u) =>
			isThr2026FairnessApplied(u.referenceSp2dAt),
		).length;
	}, [data.upTupList]);

	// Rekomendasi dinamis berdasarkan kondisi aktual
	const recommendations = useMemo(() => {
		const list: { title: string; desc: string; type: "good" | "warn" | "info" }[] = [];

		if (urgentCount > 0) {
			list.push({
				title: "Percepat Pengajuan Revolving GUP / PTUP",
				desc: `Terdapat ${urgentCount} transaksi GUP/PTUP yang mendekati atau telah melewati batas waktu 1 bulan. Segera sampaikan SPP/SPM ke KPPN.`,
				type: "warn",
			});
		} else {
			list.push({
				title: "Ketepatan Waktu GUP/PTUP Terkendali",
				desc: "Seluruh transaksi pertanggungjawaban UP/TUP berstatus tepat waktu (≤ 1 bulan dari SP2D referensi).",
				type: "good",
			});
		}

		if (data.kkpList.length === 0) {
			list.push({
				title: "Optimalkan Realisasi Belanja KKP",
				desc: "Belum tercatat transaksi KKP pada tahun anggaran ini. Belanja operasional non-tunai via KKP dapat mendongkrak skor KKP hingga 110.",
				type: "info",
			});
		} else {
			list.push({
				title: "Monitoring Target Kumulatif KKP Triwulanan",
				desc: "Pastikan proporsi akumulatif belanja KKP memenuhi target triwulanan (TW I: 1%, TW II: 5%, TW III: 9%, TW IV: 12,5%) untuk memperoleh nilai maksimal 110.",
				type: "good",
			});
		}

		list.push({
			title: "Perencanaan TUP Tanpa Setoran Kembali",
			desc: "Nilai kinerja setoran TUP maksimal 100 dan berkurang proporsional jika terdapat setoran TUP kembali. Rencanakan kebutuhan TUP secara presisi.",
			type: "info",
		});

		return list;
	}, [urgentCount, data.kkpList.length]);

	// Open UP/TUP Create
	const handleOpenCreateUpTup = () => {
		setEditingUpTup(null);
		setTxType("GUP");
		setTxAmount("");
		setTxSp2dDate(new Date().toISOString().slice(0, 10));
		const latestUpGup = data.upTupList
			.filter((u) => u.type === "UP" || u.type === "GUP" || u.type === "GUP_NIHIL")
			.sort((a, b) => b.sp2dAt.localeCompare(a.sp2dAt))[0];
		setRefSp2dDate(latestUpGup ? latestUpGup.sp2dAt.slice(0, 10) : "");
		setIsUpTupDrawerOpen(true);
	};

	// Open UP/TUP Edit
	const handleOpenEditUpTup = (item: UpTupRecord) => {
		setEditingUpTup(item);
		setTxType(item.type as never);
		setTxAmount(String(Math.round(Number(item.amount) || 0)));
		setTxSp2dDate(item.sp2dAt.slice(0, 10));
		setRefSp2dDate(item.referenceSp2dAt ? item.referenceSp2dAt.slice(0, 10) : "");
		setIsUpTupDrawerOpen(true);
	};

	// Open KKP Create
	const handleOpenCreateKkp = () => {
		setEditingKkp(null);
		setKkpMonth(new Date().getMonth() + 1);
		setKkpAmount("");
		setKkpUsageDate(new Date().toISOString().slice(0, 10));
		setIsKkpDrawerOpen(true);
	};

	// Open KKP Edit
	const handleOpenEditKkp = (item: KkpRecord) => {
		setEditingKkp(item);
		setKkpMonth(item.month);
		setKkpAmount(String(Math.round(Number(item.amount) || 0)));
		setKkpUsageDate(item.usageDate ? item.usageDate.slice(0, 10) : "");
		setIsKkpDrawerOpen(true);
	};

	const handleSaveUpTup = async () => {
		setActionMessage(null);
		setErrorMessage(null);

		const amountVal = Math.round(Number(txAmount) || 0);
		if (amountVal <= 0) {
			setErrorMessage("Nominal transaksi wajib diisi dan harus lebih besar dari Rp0.");
			return;
		}
		if (!txSp2dDate) {
			setErrorMessage("Tanggal rencana SP2D wajib diisi.");
			return;
		}
		if (txType === "GUP" && !refSp2dDate) {
			setErrorMessage("Tanggal SP2D terakhir wajib diisi untuk transaksi GUP.");
			return;
		}

		setIsSubmitting(true);
		try {
			if (editingUpTup) {
				await editUpTup({
					id: editingUpTup.id,
					type: txType,
					amount: String(amountVal),
					sp2dAt: txSp2dDate,
					referenceSp2dAt: txType === "GUP" ? (refSp2dDate || null) : null,
					settlementDate: editingUpTup.settlementDate ?? null,
					isSettled: editingUpTup.isSettled ?? false,
				});
				setActionMessage(`Transaksi ${TYPE_LABELS[txType] ?? txType} berhasil diperbarui.`);
			} else {
				await addUpTup({
					type: txType,
					amount: String(amountVal),
					sp2dAt: txSp2dDate,
					referenceSp2dAt: txType === "GUP" ? (refSp2dDate || null) : null,
					settlementDate: null,
					isSettled: false,
				});
				setActionMessage(`Transaksi ${TYPE_LABELS[txType] ?? txType} berhasil dicatat.`);
			}

			setIsUpTupDrawerOpen(false);
			setEditingUpTup(null);
			setTxAmount("");
			setRefSp2dDate("");
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal menyimpan transaksi UP/TUP.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSaveKkp = async () => {
		setActionMessage(null);
		setErrorMessage(null);

		const amountVal = Math.round(Number(kkpAmount) || 0);
		setIsSubmitting(true);
		try {
			await saveKkpUsage({
				month: kkpMonth,
				amount: String(amountVal),
				usageDate: kkpUsageDate || null,
			});

			setActionMessage(
				`Penggunaan KKP bulan ${MONTH_NAMES[kkpMonth - 1]} berhasil disimpan.`,
			);
			setIsKkpDrawerOpen(false);
			setEditingKkp(null);
			setKkpAmount("");
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal menyimpan penggunaan KKP.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDeleteUpTup = async (id: string) => {
		if (!confirm("Hapus transaksi UP/TUP ini?")) {
			return;
		}
		try {
			await removeUpTup(id);
			setActionMessage("Transaksi UP/TUP berhasil dihapus.");
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal menghapus data.",
			);
		}
	};

	const handleDeleteKkp = async (id: string) => {
		if (!confirm("Hapus data penggunaan KKP ini?")) {
			return;
		}
		try {
			await removeKkpUsage(id);
			setActionMessage("Data KKP berhasil dihapus.");
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal menghapus data KKP.",
			);
		}
	};

	const filteredUpTup = data.upTupList.filter(
		(u) =>
			u.type.toLowerCase().includes(search.toLowerCase()) ||
			(TYPE_LABELS[u.type] &&
				TYPE_LABELS[u.type].toLowerCase().includes(search.toLowerCase())),
	);

	const isThrAppliedInForm = isThr2026FairnessApplied(refSp2dDate);

	const upTupColumns: ColumnDef<UpTupRecord>[] = [
		{
			key: "no",
			header: "No.",
			className: "w-12 text-center",
			render: (_, index) => (
				<span className="font-semibold text-muted-foreground">
					{index + 1}
				</span>
			),
		},
		{
			key: "type",
			header: "Jenis Transaksi",
			render: (item) => (
				<div>
					<span className="font-semibold text-foreground">
						{TYPE_LABELS[item.type] || item.type}
					</span>
					<p className="text-[11px] text-muted-foreground">
						Kode: {item.type}
					</p>
				</div>
			),
		},
		{
			key: "amount",
			header: "Nominal",
			render: (item) => (
				<span className="font-semibold font-mono text-foreground">
					{formatRupiah(Number.parseFloat(item.amount))}
				</span>
			),
		},
		{
			key: "sp2d",
			header: "Tanggal SP2D",
			render: (item) => (
				<span className="inline-flex items-center gap-1.5 text-foreground text-xs">
					<Calendar className="size-3.5 text-muted-foreground" />
					<span>{formatDateDDMMYYYY(item.sp2dAt)}</span>
				</span>
			),
		},
		{
			key: "status",
			header: "Status / Pertanggungjawaban",
			render: (item) => {
				const isFairness = isThr2026FairnessApplied(item.referenceSp2dAt);
				return (
					<div className="space-y-1">
						<span
							className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold ${
								item.isSettled
									? "bg-success/10 text-success"
									: "bg-surface text-muted-foreground border border-border"
							}`}
						>
							{item.isSettled ? "Lunas / Selesai" : "Aktif / Berjalan"}
						</span>
						{isFairness ? (
							<p className="text-[10px] font-bold text-primary">
								Fairness THR 2026 (7 Hari)
							</p>
						) : null}
					</div>
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
						onClick={() => handleOpenEditUpTup(item)}
						className="inline-flex items-center rounded-lg p-1.5 text-primary hover:bg-primary/10 transition"
						title="Ubah Transaksi"
					>
						<Pencil className="size-3.5" />
					</button>
					<button
						type="button"
						onClick={() => handleDeleteUpTup(item.id)}
						className="inline-flex items-center rounded-lg p-1.5 text-danger hover:bg-danger/10 transition"
						title="Hapus Transaksi"
					>
						<Trash2 className="size-3.5" />
					</button>
				</div>
			),
		},
	];

	const kkpColumns: ColumnDef<KkpRecord>[] = [
		{
			key: "no",
			header: "No.",
			className: "w-12 text-center",
			render: (_, index) => (
				<span className="font-semibold text-muted-foreground">
					{index + 1}
				</span>
			),
		},
		{
			key: "month",
			header: "Bulan Penggunaan",
			render: (item) => (
				<div>
					<span className="font-semibold text-foreground">
						{MONTH_NAMES[item.month - 1]}
					</span>
					<p className="text-[11px] text-muted-foreground">
						Triwulan Q{Math.ceil(item.month / 3)}
					</p>
				</div>
			),
		},
		{
			key: "amount",
			header: "Nominal Transaksi KKP",
			render: (item) => (
				<span className="font-bold font-mono text-foreground">
					{formatRupiah(Number.parseFloat(item.amount))}
				</span>
			),
		},
		{
			key: "usageDate",
			header: "Tanggal Transaksi",
			render: (item) => (
				<span className="text-xs text-muted-foreground">
					{item.usageDate ? formatDateDDMMYYYY(item.usageDate) : "Rekap Bulanan"}
				</span>
			),
		},
		{
			key: "actions",
			header: "Aksi",
			render: (item) => (
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={() => handleOpenEditKkp(item)}
						className="inline-flex items-center rounded-lg p-1.5 text-primary hover:bg-primary/10 transition"
						title="Ubah Data KKP"
					>
						<Pencil className="size-3.5" />
					</button>
					<button
						type="button"
						onClick={() => handleDeleteKkp(item.id)}
						className="inline-flex items-center rounded-lg p-1.5 text-danger hover:bg-danger/10 transition"
						title="Hapus Data KKP"
					>
						<Trash2 className="size-3.5" />
					</button>
				</div>
			),
		},
	];

	return (
		<OperatorShell currentPath="/operator/up-tup">
			<div className="space-y-6">
				{/* Top Header Banner */}
				<div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div>
						<div className="flex items-center gap-2">
							<span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
								Bobot 10% IKPA
							</span>
							<span className="text-[11px] font-medium text-muted-foreground">
								PER-5/PB/2024 · TA {data.year}
							</span>
						</div>
						<h1 className="mt-1 text-xl font-bold text-foreground sm:text-2xl">
							Pengelolaan UP / TUP &amp; KKP
						</h1>
						<p className="mt-1 text-xs text-muted-foreground sm:text-sm">
							Aktual s.d. {MONTH_NAMES[currentMonth - 1]} terkunci · Rencana sisa tahun
							dapat disimulasikan · Skor terhitung otomatis secara transparan.
						</p>
					</div>

					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => scrollToData("uptup")}
							className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90"
						>
							<Coins className="size-3.5" />
							<span>Kelola Data UP/TUP</span>
							<ArrowRight className="size-3" />
						</button>

						<Dialog.Root open={isHelpOpen} onOpenChange={setIsHelpOpen}>
							<Dialog.Trigger asChild>
								<button
									type="button"
									aria-label="Lihat rumus singkat UP/TUP & KKP"
									className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs transition hover:bg-surface-muted"
								>
									<HelpCircle className="size-4 text-primary" />
									<span>Panduan Rumus</span>
								</button>
							</Dialog.Trigger>
							<Dialog.Portal>
								<Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-xs" />
								<Dialog.Content className="fixed inset-x-4 top-[8%] z-50 mx-auto max-h-[85vh] max-w-2xl overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-2xl outline-none">
									<div className="flex items-center justify-between gap-4 border-b border-border pb-4">
										<div>
											<Dialog.Title className="text-base font-bold text-foreground sm:text-lg">
												Panduan &amp; Rumus Indikator UP/TUP &amp; KKP
											</Dialog.Title>
											<Dialog.Description className="text-xs text-muted-foreground">
												Regulasi PER-5/PB/2024 &amp; Kebijakan Penyesuaian 2026
											</Dialog.Description>
										</div>
										<Dialog.Close asChild>
											<button
												type="button"
												className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-surface-muted hover:text-foreground"
											>
												Tutup
											</button>
										</Dialog.Close>
									</div>

									<div className="mt-4 space-y-4 text-xs text-foreground">
										<div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
											<p className="font-bold text-primary">
												1. Formula Indikator Utama (Bobot 10% IKPA)
											</p>
											<p className="font-mono text-[11px] text-foreground font-semibold">
												Nilai UP/TUP = (90% × NK Tunai) + (10% × NK KKP)
											</p>
											<p className="text-muted-foreground">
												Kontribusi IKPA = Nilai Akhir Indikator × 10%
											</p>
										</div>

										<div className="rounded-xl border border-border bg-surface p-4 space-y-2.5">
											<p className="font-bold text-foreground">
												2. Komponen UP/TUP Tunai (Bobot 90%)
											</p>
											<p className="font-mono text-[11px] text-primary font-semibold">
												NK Tunai = (50% × NK Ketepatan Waktu) + (25% × %GUP Sebulan) + (25% × NK Setoran TUP)
											</p>
											<ul className="list-disc space-y-1.5 pl-4 text-muted-foreground">
												<li>
													<strong className="text-foreground">Ketepatan Waktu GUP/PTUP (50%):</strong> Nilai 100 jika SP2D GUP/PTUP diterbitkan ≤ 1 bulan dari SP2D sebelumnya. Nilai 0 jika terlambat.
												</li>
												<li>
													<strong className="text-foreground">%GUP Disebulankan (25%):</strong> %GUP × (Jumlah hari kalender / Selisih hari antar SP2D). Maksimal dinilai 100.
												</li>
												<li>
													<strong className="text-foreground">Kinerja Setoran TUP (25%):</strong> 100 − (%Setoran TUP terhadap Total TUP dalam setahun). Atur TUP seperlunya dengan cermat agar meminimalisasi Setoran TUP di kemudian hari.
												</li>
											</ul>
										</div>

										<div className="rounded-xl border border-border bg-surface p-4 space-y-2.5">
											<p className="font-bold text-foreground">
												3. Komponen Penggunaan KKP (Bobot 10%)
											</p>
											<p className="text-muted-foreground">
												Dievaluasi secara kumulatif per triwulan terhadap target tahunan (Plafon Bulanan × 12):
											</p>
											<div className="grid grid-cols-2 gap-2 text-[11px] font-mono sm:grid-cols-4">
												<div className="rounded-lg border border-border bg-background p-2 text-center">
													<p className="font-bold text-primary">TW I</p>
													<p className="text-foreground">1% (Skor 110)</p>
												</div>
												<div className="rounded-lg border border-border bg-background p-2 text-center">
													<p className="font-bold text-primary">TW II</p>
													<p className="text-foreground">5% (Skor 110)</p>
												</div>
												<div className="rounded-lg border border-border bg-background p-2 text-center">
													<p className="font-bold text-primary">TW III</p>
													<p className="text-foreground">9% (Skor 110)</p>
												</div>
												<div className="rounded-lg border border-border bg-background p-2 text-center">
													<p className="font-bold text-primary">TW IV</p>
													<p className="text-foreground">12,5% (Skor 110)</p>
												</div>
											</div>
											<p className="text-[11px] text-muted-foreground">
												* Jika belum ada KKP / belum ada transaksi KKP: diberlakukan konversi 90% Tunai (bukan 100 otomatis).
											</p>
										</div>

										<div className="rounded-xl border border-warning/30 bg-warning/5 p-4 space-y-1.5">
											<div className="flex items-center gap-2 text-warning font-bold">
												<ShieldCheck className="size-4" />
												<span>4. Kebijakan Fairness THR 2026</span>
											</div>
											<p className="text-muted-foreground">
												Untuk transaksi dengan SP2D referensi tanggal <strong className="text-foreground">18 Februari s.d. 17 Maret 2026</strong>, jumlah hari sebulan dihitung menjadi <strong className="text-foreground">7 hari kalender</strong> pada komponen Ketepatan Waktu dan %GUP Disebulankan untuk memberikan fleksibilitas operasional libur nasional/cuti bersama.
											</p>
										</div>
									</div>
								</Dialog.Content>
							</Dialog.Portal>
						</Dialog.Root>
					</div>
				</div>

				{/* Fairness Treatment Banner */}
				<div className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-xs text-foreground shadow-xs">
					<ShieldCheck className="size-4.5 shrink-0 text-primary mt-0.5" />
					<div className="space-y-0.5">
						<p className="font-bold text-primary">
							Kebijakan Penyesuaian Penilaian THR 2026 Aktif
						</p>
						<p className="text-muted-foreground">
							Sesuai ketentuan, transaksi dengan SP2D referensi dalam rentang 18 Februari s.d. 17 Maret 2026 diperlakukan dengan basis 7 hari kalender pada komponen Ketepatan Waktu dan %GUP Disebulankan.
							{thrFairnessTxCount > 0 ? (
								<strong className="ml-1 text-primary">
									({thrFairnessTxCount} transaksi aktual memenuhi kriteria kebijakan).
								</strong>
							) : null}
						</p>
					</div>
				</div>

				{/* Tanpa KKP Notification Banner */}
				{!hasKkp && (
					<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-xs shadow-xs">
						<div className="flex items-start gap-2.5">
							<AlertCircle className="size-4.5 shrink-0 text-warning mt-0.5" />
							<div className="space-y-0.5">
								<p className="font-bold text-foreground">
									Status Konfigurasi Satker: Tidak Memiliki UP KKP (Maks. Nilai 90,00)
								</p>
								<p className="text-muted-foreground">
									Secara default satker tanpa UP KKP hanya dinilai dari 90% komponen Tunai (Maksimal nilai indikator 90,00 / Kontribusi 9,00 pts). Aktifkan status KKP pada menu konfigurasi jika satker memiliki kartu &amp; plafon KKP untuk membuka peluang nilai 100,00.
								</p>
							</div>
						</div>
						<button
							type="button"
							onClick={() => scrollToData("kkp")}
							className="shrink-0 rounded-lg bg-warning/20 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-warning/30 transition"
						>
							Atur Status KKP →
						</button>
					</div>
				)}

				{/* 4 Top Score Cards (Standard Indicator Style) */}
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{/* Card 1: NK Tunai */}
					<div className="rounded-xl border border-border bg-background p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold truncate">NK Tunai (Bobot 90%)</span>
							<Coins className="size-4 text-primary shrink-0" />
						</div>
						<div className="space-y-0.5 mt-auto">
							<div className="flex items-baseline gap-1.5 min-h-[32px] sm:min-h-[36px]">
								<p className="text-2xl font-bold text-foreground sm:text-3xl leading-none">
									{score.tunai !== null ? formatNumber(score.tunai) : "—"}
								</p>
							</div>
							<p className="text-[11px] text-muted-foreground truncate" title="Ketepatan 50% · %GUP 25% · Setoran 25%">
								Ketepatan 50% · %GUP 25% · Setoran 25%
							</p>
						</div>
					</div>

					{/* Card 2: NK KKP */}
					<div className="rounded-xl border border-border bg-background p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold truncate">NK KKP (Bobot 10%)</span>
							<CreditCard className="size-4 text-warning shrink-0" />
						</div>
						<div className="space-y-0.5 mt-auto">
							<div className="flex items-baseline gap-1.5 min-h-[32px] sm:min-h-[36px]">
								<p className="text-2xl font-bold text-foreground sm:text-3xl leading-none">
									{hasKkp
										? score.kkp !== null
											? formatNumber(score.kkp)
											: "—"
										: "0,00"}
								</p>
							</div>
							<p className="text-[11px] text-muted-foreground truncate" title={hasKkp ? "Target Kumulatif Triwulanan" : "Status: Tanpa UP KKP"}>
								{hasKkp ? "Target Kumulatif Triwulanan" : "Status: Tanpa UP KKP"}
							</p>
						</div>
					</div>

					{/* Card 3: Nilai IKPA UP/TUP & KKP (2nd from right) */}
					<div className="rounded-xl border border-primary/20 bg-background p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold truncate">
								Nilai IKPA UP/TUP &amp; KKP
							</span>
							<ShieldCheck className="size-4 text-primary shrink-0" />
						</div>
						<div className="space-y-0.5 mt-auto">
							<div className="flex items-baseline gap-1.5 min-h-[32px] sm:min-h-[36px]">
								<p className="text-2xl font-extrabold text-primary sm:text-3xl leading-none">
									{score.score !== null
										? formatNumber(Math.min(100, Math.max(0, score.score)))
										: "—"}
								</p>
							</div>
							<p className="text-[11px] text-muted-foreground truncate" title={hasKkp ? "90% Tunai + 10% KKP" : "90% Tunai (Tanpa UP KKP)"}>
								{hasKkp ? "90% Tunai + 10% KKP" : "90% Tunai (Tanpa UP KKP)"}
							</p>
						</div>
					</div>

					{/* Card 4: Nilai Akhir (Rightmost) */}
					<div className="rounded-xl border border-success/20 bg-success/5 p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold truncate">
								Nilai Akhir (10%)
							</span>
							<Sparkles className="size-4 text-success shrink-0" />
						</div>
						<div className="space-y-0.5 mt-auto">
							<div className="flex items-baseline gap-1.5 min-h-[32px] sm:min-h-[36px]">
								<p className="text-2xl font-extrabold text-success sm:text-3xl leading-none">
									{score.contribution !== null
										? `${formatNumber(Math.min(10, Math.max(0, score.contribution)))} pts`
										: "—"}
								</p>
							</div>
							<p className="text-[11px] text-muted-foreground truncate" title={hasKkp ? "Bobot 10% terhadap total IKPA" : "Bobot 10% (Maks. 9.00 pts)"}>
								{hasKkp
									? "Bobot 10% terhadap total IKPA"
									: "Bobot 10% (Maks. 9.00 pts)"}
							</p>
						</div>
					</div>
				</div>

				{/* 3 Rincian Komponen Tunai */}
				<div className="rounded-2xl border border-border bg-background p-4 sm:p-5 shadow-xs space-y-4">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-sm font-bold text-foreground sm:text-base">
								Rincian 3 Komponen UP/TUP Tunai
							</h2>
							<p className="text-xs text-muted-foreground">
								Struktur pembentuk Nilai Kinerja Tunai (Bobot 90% dari Indikator UP/TUP)
							</p>
						</div>
						<span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-foreground border border-border">
							Total Tunai: {score.tunai !== null ? formatNumber(score.tunai) : "—"}
						</span>
					</div>

					<div className="grid grid-cols-1 gap-3 md:grid-cols-3">
						{/* Subcard 1: Ketepatan Waktu */}
						<div className="rounded-xl border border-border bg-surface p-3.5 space-y-1.5">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-medium">Ketepatan Waktu (50%)</span>
								<Clock className="size-3.5 text-primary" />
							</div>
							<p className="text-xl font-bold text-foreground">
								{score.timeliness !== null ? formatNumber(score.timeliness) : "—"}
							</p>
							<p className="text-[11px] text-muted-foreground">
								GUP/PTUP diterbitkan ≤ 1 bulan dari SP2D referensi asal.
							</p>
						</div>

						{/* Subcard 2: %GUP Disebulankan */}
						<div className="rounded-xl border border-border bg-surface p-3.5 space-y-1.5">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-medium">%GUP Disebulankan (25%)</span>
								<RotateCw className="size-3.5 text-success" />
							</div>
							<p className="text-xl font-bold text-foreground">
								{score.monthlyGup !== null ? formatNumber(score.monthlyGup) : "—"}
							</p>
							<p className="text-[11px] text-muted-foreground">
								Rasio revolving GUP bulanan berbasis nominal dan interval hari.
							</p>
						</div>

						{/* Subcard 3: Kinerja Setoran TUP */}
						<div className="rounded-xl border border-border bg-surface p-3.5 space-y-1.5">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-medium">Kinerja Setoran TUP (25%)</span>
								<Scale className="size-3.5 text-warning" />
							</div>
							<p className="text-xl font-bold text-foreground">
								{score.tupDeposit !== null ? formatNumber(score.tupDeposit) : "—"}
							</p>
							<p className="text-[11px] text-muted-foreground">
								{totalTupAmount > 0
									? totalSetoranTupAmount > 0
										? `100 − Setoran ${formatNumber(pctSetoranTup)}% (${formatRupiah(totalSetoranTupAmount)} dari ${formatRupiah(totalTupAmount)}).`
										: "100 − 0% (seluruh TUP terserap tanpa setoran sisa)."
									: "100 − % Setoran TUP. Tidak ada transaksi TUP (nilai maksimal 100)."}
							</p>
						</div>
					</div>
				</div>

				{/* Strip Reminder GUP/PTUP Wajib */}
				<section
					aria-label="Reminder GUP dan PTUP wajib"
					className="space-y-3 rounded-2xl border border-border bg-background p-4 sm:p-5 shadow-xs"
				>
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-2">
							<Clock className="size-4 text-primary" />
							<h2 className="text-sm font-bold text-foreground sm:text-base">
								Reminder Jatuh Tempo GUP &amp; PTUP
								{urgentCount > 0 ? (
									<span className="ml-2 rounded-full bg-danger/10 px-2.5 py-0.5 text-[11px] font-semibold text-danger">
										{urgentCount} Perlu Perhatian
									</span>
								) : (
									<span className="ml-2 rounded-full bg-success/10 px-2.5 py-0.5 text-[11px] font-semibold text-success">
										Tepat Waktu
									</span>
								)}
							</h2>
						</div>
						<div className="flex items-center gap-3">
							<a
								href="/operator/reminders"
								className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
							>
								Reminder Center →
							</a>
						</div>
					</div>

					{reminders.length === 0 ? (
						<div className="rounded-xl border border-dashed border-border p-4 text-center">
							<p className="text-xs text-muted-foreground">
								Belum ada transaksi GUP/PTUP. Catat transaksi aktual agar jatuh tempo
								pertanggungjawaban terpantau otomatis.{" "}
								<button
									type="button"
									onClick={handleOpenCreateUpTup}
									className="text-primary font-semibold underline-offset-4 hover:underline"
								>
									Tambah Data UP/TUP
								</button>
							</p>
						</div>
					) : (
						<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
							{reminders.map((r) => (
								<div
									key={r.id}
									className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-surface p-3 text-xs"
								>
									<div className="space-y-0.5">
										<p className="font-semibold text-foreground">
											{TYPE_LABELS[r.type] ?? r.type} · {formatRupiah(r.amount)}
										</p>
										<p className="text-muted-foreground text-[11px]">
											SP2D: {formatDateDDMMYYYY(r.sp2dAt)} · {r.detail}
										</p>
									</div>
									<span
										className={
											r.status === "Tepat Waktu"
												? "shrink-0 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success"
												: r.status === "Terlambat"
													? "shrink-0 rounded-full bg-danger/10 px-2.5 py-1 text-[11px] font-semibold text-danger"
													: "shrink-0 rounded-full bg-yellow-100 dark:bg-yellow-950/40 px-2.5 py-1 text-[11px] font-semibold text-yellow-800 dark:text-yellow-200"
										}
									>
										{r.status}
									</span>
								</div>
							))}
						</div>
					)}
				</section>

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

				{/* 2 Tab Selector */}
				<div ref={dataSectionRef} className="flex items-center gap-2 border-b border-border pb-2 scroll-mt-20">
					<button
						type="button"
						onClick={() => setActiveTab("uptup")}
						className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
							activeTab === "uptup"
								? "bg-primary text-primary-foreground shadow-xs"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						Transaksi UP / TUP / GUP ({data.upTupList.length})
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("kkp")}
						className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
							activeTab === "kkp"
								? "bg-primary text-primary-foreground shadow-xs"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						Penggunaan KKP ({data.kkpList.length})
					</button>
				</div>

				{/* Tab 1: UP/TUP Table */}
				{activeTab === "uptup" && (
					<DomainDataTable
						title="Riwayat Transaksi UP / TUP / Revolving GUP"
						data={filteredUpTup}
						columns={upTupColumns}
						searchValue={search}
						onSearchChange={setSearch}
						onAddClick={handleOpenCreateUpTup}
						totalCount={filteredUpTup.length}
						maxRows={5}
					/>
				)}

				{/* Tab 2: KKP Tab (Plafon Config + Target Matrix + KKP Usage Table) */}
				{activeTab === "kkp" && (
					<div className="space-y-6">
						{/* Card 1: Pengaturan Plafon UP KKP Satker */}
						<div className="rounded-2xl border border-border bg-background p-5 shadow-xs space-y-4">
							<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
								<div>
									<h2 className="text-sm font-bold text-foreground sm:text-base">
										Pengaturan Plafon UP KKP Satker
									</h2>
									<p className="text-xs text-muted-foreground">
										Plafon bulanan yang disetujui KPPN sebagai basis perhitungan target tahunan (12 &times; Plafon Bulanan).
									</p>
								</div>
								<span
									className={
										kkpStatus === "active"
											? "rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success"
											: "rounded-full bg-warning/10 px-3 py-1 text-xs font-bold text-warning"
									}
								>
									Status KKP:{" "}
									{kkpStatus === "active"
										? "Aktif (Peluang Nilai 100%)"
										: kkpStatus === "pending"
											? "Menunggu Penerbitan Bank"
											: "Tidak Memiliki UP KKP (Maks. Nilai 90%)"}
								</span>
							</div>

							{/* Banner Status Konfigurasi KKP */}
							{kkpStatus === "none" ? (
								<div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-xs text-warning space-y-1">
									<div className="flex items-center gap-1.5 font-bold">
										<AlertCircle className="size-4 shrink-0" />
										<span>Default Konfigurasi: Satker Tidak Memiliki UP KKP</span>
									</div>
									<p className="text-[11px] text-muted-foreground leading-relaxed">
										Secara default, satker yang tidak memiliki UP KKP hanya dinilai dari 90% komponen UP/TUP Tunai dengan <strong>maksimal nilai capaian indikator sebesar 90,00</strong>. Jika satker telah memiliki pagu dan kartu KKP, ubah status menjadi <strong>Aktif</strong> untuk membuka peluang meraih nilai maksimal <strong>100,00</strong>.
									</p>
								</div>
							) : (
								<div className="rounded-xl border border-success/30 bg-success/10 p-4 text-xs text-success space-y-1">
									<div className="flex items-center gap-1.5 font-bold">
										<CheckCircle2 className="size-4 shrink-0" />
										<span>Status KKP Satker: Aktif</span>
									</div>
									<p className="text-[11px] text-muted-foreground leading-relaxed">
										Satker berpeluang meraih nilai maksimal hingga 100,00 (atau skor 110 pada komponen KKP 10%) dengan memenuhi target kumulatif belanja KKP triwulanan.
									</p>
								</div>
							)}

							<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
								<div className="space-y-1.5">
									<label htmlFor="kkp-status" className="block text-xs font-semibold text-foreground">
										Status KKP Satker
									</label>
									<select
										id="kkp-status"
										value={kkpStatus}
										onChange={(e) => handleKkpStatusChange(e.target.value as never)}
										className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
									>
										<option value="none">Tidak Memiliki UP KKP (Default - Maks. Nilai 90%)</option>
										<option value="active">Aktif (Memiliki Plafon &amp; Kartu KKP - Peluang Nilai 100%)</option>
										<option value="pending">Menunggu Penerbitan Bank</option>
									</select>
								</div>

								<div className="space-y-1.5">
									<label htmlFor="monthly-kkp-ceiling" className="block text-xs font-semibold text-foreground">
										Plafon Bulanan KKP (Rp)
									</label>
									<FormattedNumberInput
										id="monthly-kkp-ceiling"
										allowDecimal={false}
										value={monthlyKkpCeiling}
										onChange={handleMonthlyCeilingChange}
										placeholder="Contoh: 50.000.000"
										className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none font-mono"
									/>
									{kkpStatus === "none" && (
										<p className="text-[10px] text-muted-foreground">
											Plafon dinonaktifkan (Rp 0) untuk satker tanpa UP KKP.
										</p>
									)}
								</div>

								<div className="space-y-1.5">
									<span className="block text-xs font-semibold text-foreground">
										Plafon KKP Tahunan (x12)
									</span>
									<div className="min-h-10 w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold text-primary font-mono flex items-center">
										{formatRupiah(annualKkpCeiling)}
									</div>
								</div>
							</div>
						</div>

						{/* Card 2: Target Kumulatif KKP 2026 Matrix */}
						<div className="rounded-2xl border border-border bg-surface p-5 shadow-xs space-y-4">
							<div>
								<h3 className="text-sm font-bold text-foreground">
									Matriks Target Triwulanan &amp; Evaluasi Capaian KKP TA {data.year}
								</h3>
								<p className="text-xs text-muted-foreground">
									Target kumulatif dihitung dari persentase terhadap Plafon KKP Tahunan. Nilai 110 diberikan bila realisasi kumulatif &ge; target.
								</p>
							</div>

							<div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
								{KKP_TARGETS_2026.map((tgt) => {
									const targetNominal = (annualKkpCeiling * tgt.targetPct) / 100;
									const cumRealization = data.kkpList
										.filter((k) => k.month <= tgt.monthEnd)
										.reduce((s, k) => s + (Number(k.amount) || 0), 0);
									const isMet = cumRealization >= targetNominal && targetNominal > 0;

									return (
										<div
											key={tgt.quarter}
											className="rounded-xl border border-border bg-background p-4 space-y-2"
										>
											<div className="flex items-center justify-between">
												<span className="font-bold text-primary text-sm">
													{tgt.quarter} ({tgt.targetPct}%)
												</span>
												<span
													className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
														isMet
															? "bg-success/10 text-success"
															: "bg-surface text-muted-foreground border border-border"
													}`}
												>
													{isMet ? "Skor 110" : "Skor 100"}
												</span>
											</div>

											<div className="space-y-1 text-xs font-mono">
												<div className="flex justify-between text-muted-foreground text-[11px]">
													<span>Target:</span>
													<span className="font-semibold text-foreground">
														{formatRupiah(targetNominal)}
													</span>
												</div>
												<div className="flex justify-between text-muted-foreground text-[11px]">
													<span>Realisasi:</span>
													<span className="font-semibold text-foreground">
														{formatRupiah(cumRealization)}
													</span>
												</div>
											</div>

											<div className="pt-1.5 border-t border-border/60 text-[10px] text-muted-foreground flex justify-between">
												<span>Batas: {tgt.label}</span>
												<span className={isMet ? "text-success font-semibold" : ""}>
													{isMet ? "Tercapai ✓" : "Kurang"}
												</span>
											</div>
										</div>
									);
								})}
							</div>
						</div>

						{/* Card 3: Daftar Penggunaan Kartu Kredit Pemerintah (KKP) */}
						<DomainDataTable
							title="Daftar Penggunaan Kartu Kredit Pemerintah (KKP)"
							data={data.kkpList}
							columns={kkpColumns}
							searchValue=""
							onSearchChange={() => {}}
							onAddClick={handleOpenCreateKkp}
							totalCount={data.kkpList.length}
							maxRows={5}
						/>
					</div>
				)}

				{/* Drawer 1: Form Tambah / Ubah UP/TUP/GUP */}
				<DomainFormDrawer
					isOpen={isUpTupDrawerOpen}
					title={editingUpTup ? "Ubah Transaksi UP / TUP / GUP" : "Catat Transaksi UP / TUP / GUP"}
					description="Masukkan data penerbitan SP2D UP, TUP, revolving GUP, atau pertanggungjawaban TUP."
					onClose={() => {
						setIsUpTupDrawerOpen(false);
						setEditingUpTup(null);
					}}
					onSubmit={handleSaveUpTup}
					isSubmitting={isSubmitting}
					isSubmitDisabled={isUpTupSubmitDisabled}
				>
					<div className="space-y-4">
						<div className="space-y-1.5">
							<label
								htmlFor="tx-type"
								className="block text-xs font-semibold text-foreground"
							>
								Jenis Transaksi <span className="text-danger ml-0.5">*</span>
							</label>
							<select
								id="tx-type"
								value={txType}
								onChange={(e) =>
									setTxType(
										e.target.value as
											| "UP"
											| "TUP"
											| "GUP"
											| "GUP_NIHIL"
											| "PTUP"
											| "SETORAN_TUP",
									)
								}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							>
								<option value="GUP">Ganti UP (GUP Revolving)</option>
								<option value="UP">Uang Persediaan (UP Awal)</option>
								<option value="TUP">Tambahan UP (TUP)</option>
								<option value="GUP_NIHIL">GUP Nihil</option>
								<option value="PTUP">Pertanggungjawaban TUP (PTUP)</option>
								<option value="SETORAN_TUP">Setoran TUP</option>
							</select>
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="tx-amount"
								className="block text-xs font-semibold text-foreground"
							>
								Nominal Transaksi (Rp) <span className="text-danger ml-0.5">*</span>
							</label>
							<FormattedNumberInput
								id="tx-amount"
								allowDecimal={false}
								required
								placeholder="Contoh: 50.000.000"
								value={txAmount}
								onChange={setTxAmount}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none font-mono"
							/>
						</div>

						{txType === "GUP" ? (
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<div className="space-y-1.5">
									<label
										htmlFor="ref-sp2d-date"
										className="block text-xs font-semibold text-foreground"
									>
										Tanggal SP2D Terakhir <span className="text-danger ml-0.5">*</span>
									</label>
									<input
										id="ref-sp2d-date"
										type="date"
										required
										value={refSp2dDate}
										onChange={(e) => setRefSp2dDate(e.target.value)}
										disabled={isSubmitting}
										className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
									/>
									{previousUpGupList.length > 0 && (
										<div className="space-y-1 pt-0.5">
											<label
												htmlFor="ref-sp2d-select"
												className="block text-[10px] text-muted-foreground"
											>
												Opsi referensi data UP / GUP sebelumnya:
											</label>
											<select
												id="ref-sp2d-select"
												value={
													previousUpGupList.some(
														(t) => t.sp2dAt.slice(0, 10) === refSp2dDate,
													)
														? refSp2dDate
														: ""
												}
												onChange={(e) => {
													if (e.target.value) {
														setRefSp2dDate(e.target.value);
													}
												}}
												disabled={isSubmitting}
												className="w-full rounded-lg border border-border bg-surface-muted/60 px-2.5 py-1.5 text-[11px] text-foreground focus:border-primary focus:outline-none"
											>
												<option value="">
													-- Pilih data UP / GUP sebelumnya --
												</option>
												{previousUpGupList.map((tx) => (
													<option key={tx.id} value={tx.sp2dAt.slice(0, 10)}>
														{tx.type === "UP"
															? "UP Awal"
															: TYPE_LABELS[tx.type] || tx.type}{" "}
														· {formatDateDDMMYYYY(tx.sp2dAt)} (
														{formatRupiah(Number(tx.amount))})
													</option>
												))}
											</select>
										</div>
									)}
								</div>

								<div className="space-y-1.5">
									<label
										htmlFor="tx-sp2d-date"
										className="block text-xs font-semibold text-foreground"
									>
										Tanggal Rencana SP2D <span className="text-danger ml-0.5">*</span>
									</label>
									<input
										id="tx-sp2d-date"
										type="date"
										required
										value={txSp2dDate}
										onChange={(e) => setTxSp2dDate(e.target.value)}
										disabled={isSubmitting}
										className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
									/>
								</div>
							</div>
						) : (
							<div className="space-y-1.5">
								<label
									htmlFor="tx-sp2d-date"
									className="block text-xs font-semibold text-foreground"
								>
									Tanggal Rencana SP2D <span className="text-danger ml-0.5">*</span>
								</label>
								<input
									id="tx-sp2d-date"
									type="date"
									required
									value={txSp2dDate}
									onChange={(e) => setTxSp2dDate(e.target.value)}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
							</div>
						)}

						{/* Hint & Fairness notification */}
						{isThrAppliedInForm && (
							<div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-[11px] text-primary">
								<ShieldCheck className="size-4 shrink-0 mt-0.5" />
								<span>
									<strong>Fairness THR 2026 Aktif:</strong> SP2D referensi berada dalam rentang 18 Feb - 17 Mar 2026. Perhitungan jumlah hari sebulan diperlakukan 7 hari kalender.
								</span>
							</div>
						)}

						{txType === "GUP" && (
							<div aria-live="polite" className="space-y-3 pt-1">
								{!activeUpAmount || activeUpAmount <= 0 ? (
									<div className="rounded-xl border border-border/80 bg-surface p-3.5 text-xs text-muted-foreground space-y-1.5 shadow-2xs">
										<div className="flex items-center gap-2 font-semibold text-foreground">
											<Info className="size-4 text-primary shrink-0" />
											<span>Informasi &amp; Simulasi GUP</span>
										</div>
										<p className="text-[11px] leading-relaxed">
											Analisis GUP akan tersedia setelah nilai UP aktif untuk periode ini tersedia.
										</p>
									</div>
								) : !txAmount || Number(txAmount) <= 0 || !refSp2dDate || !txSp2dDate ? (
									<div className="rounded-xl border border-border/80 bg-surface p-3.5 text-xs text-muted-foreground space-y-1.5 shadow-2xs">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2 font-semibold text-foreground">
												<Info className="size-4 text-primary shrink-0" />
												<span>Informasi &amp; Simulasi GUP</span>
											</div>
											<span className="text-[10px] font-semibold text-muted-foreground">
												UP aktif: {formatRupiah(activeUpAmount)}
											</span>
										</div>
										<p className="text-[11px] leading-relaxed">
											Masukkan nominal GUP, tanggal SP2D terakhir, dan tanggal rencana SP2D untuk melihat simulasi ketepatan waktu serta GUP disebulankan secara real-time.
										</p>
									</div>
								) : refSp2dDate && txSp2dDate && txSp2dDate <= refSp2dDate ? (
									<div className="rounded-xl border border-danger/30 bg-danger/5 p-3.5 text-xs text-danger space-y-1.5 shadow-2xs">
										<div className="flex items-center gap-2 font-semibold">
											<AlertCircle className="size-4 shrink-0" />
											<span>Tanggal SP2D Tidak Valid</span>
										</div>
										<p className="text-[11px] leading-relaxed">
											Tanggal rencana SP2D harus setelah tanggal SP2D terakhir agar interval GUP dapat dihitung.
										</p>
									</div>
								) : gupAnalysis && gupAnalysis.isValid ? (
									<div className="rounded-xl border border-border/80 bg-surface p-3.5 sm:p-4 text-xs space-y-3 shadow-2xs">
										{/* Header & Context */}
										<div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2.5">
											<div className="flex items-start gap-2">
												<div className="mt-0.5 shrink-0">
													{gupAnalysis.submissionSeverity === "success" ? (
														<CheckCircle2 className="size-4 text-success" />
													) : gupAnalysis.submissionSeverity === "warning" ? (
														<AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
													) : gupAnalysis.submissionSeverity === "danger" ? (
														<AlertCircle className="size-4 text-danger" />
													) : (
														<Info className="size-4 text-muted-foreground" />
													)}
												</div>
												<div>
													<div className="flex items-center gap-2">
														<span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
															Simulasi &amp; Saran GUP Real-Time
														</span>
													</div>
													<h4 className="text-xs font-bold text-foreground sm:text-sm">
														{gupAnalysis.title}
													</h4>
												</div>
											</div>
											<div className="text-right shrink-0">
												<span className="block text-[10px] font-medium text-muted-foreground">
													UP Aktif
												</span>
												<span className="text-[11px] font-bold text-foreground">
													{formatRupiah(gupAnalysis.upAmount)}
												</span>
											</div>
										</div>

										{/* 3 Metric Chips */}
										<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
											{/* Status Nominal */}
											<div className="rounded-lg border border-border/70 bg-background/80 p-2.5 space-y-1">
												<span className="block text-[10px] font-semibold text-muted-foreground uppercase">
													Status Nominal
												</span>
												<span
													className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold border ${
														gupAnalysis.isMinimumAmountMet
															? "bg-success/10 text-success border-success/30"
															: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
													}`}
												>
													{gupAnalysis.isMinimumAmountMet
														? "Memenuhi Minimum"
														: "Di Bawah Minimum"}
												</span>
												<p className="text-[10px] text-muted-foreground">
													{gupAnalysis.rawGupPercent.toFixed(1)}% UP (min.{" "}
													{gupAnalysis.minGupRatioPercent}%)
												</p>
											</div>

											{/* Status Waktu */}
											<div className="rounded-lg border border-border/70 bg-background/80 p-2.5 space-y-1">
												<span className="block text-[10px] font-semibold text-muted-foreground uppercase">
													Status Waktu
												</span>
												<p
													className={`text-xs font-bold ${
														gupAnalysis.isOnTime ? "text-success" : "text-danger"
													}`}
												>
													{gupAnalysis.isOnTime
														? "Tepat Waktu"
														: `Terlambat (${gupAnalysis.lateDays} hari)`}
												</p>
												<p
													className="text-[10px] text-muted-foreground truncate"
													title={formatDateIndonesian(
														gupAnalysis.latestOnTimeDate,
													)}
												>
													Batas: {formatDateIndonesian(gupAnalysis.latestOnTimeDate)}
												</p>
											</div>

											{/* Kualitas GUP Disebulankan */}
											<div className="rounded-lg border border-border/70 bg-background/80 p-2.5 space-y-1">
												<span className="block text-[10px] font-semibold text-muted-foreground uppercase">
													GUP Disebulankan
												</span>
												<p
													className={`text-xs font-bold ${
														gupAnalysis.isProportional
															? "text-success"
															: "text-amber-600 dark:text-amber-400"
													}`}
												>
													{gupAnalysis.annualizedGupPercent.toFixed(1)}%
													<span className="text-[10px] font-normal text-muted-foreground">
														{" "}
														/ 100%
													</span>
												</p>
												<p className="text-[10px] text-muted-foreground">
													{gupAnalysis.isProportional
														? "Memenuhi target optimal"
														: "Belum optimal (100%)"}
												</p>
											</div>
										</div>

										{/* Summary Explanation */}
										<p className="text-xs text-foreground leading-relaxed">
											{gupAnalysis.summaryExplanation}
										</p>

										{/* Actionable Suggestions & Quick Actions */}
										{gupAnalysis.actions.length > 0 && (
											<div className="space-y-2 pt-0.5">
												<div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
													<Lightbulb className="size-3.5 text-amber-500 shrink-0" />
													<span>Saran Tindakan:</span>
												</div>
												<div className="space-y-1.5">
														{gupAnalysis.actions.map((action) => (
															<div
																key={action.label}
															className="rounded-lg border border-border/70 bg-background/90 p-2.5 text-xs space-y-0.5"
														>
															<p className="font-semibold text-foreground">
																• {action.label}
															</p>
															<p className="text-[11px] text-muted-foreground leading-relaxed">
																{action.description}
															</p>
														</div>
													))}
												</div>

												{/* Quick Action Buttons */}
												<div className="flex flex-wrap items-center gap-2 pt-1">
													{!gupAnalysis.isMinimumAmountMet &&
														gupAnalysis.minGupAmount > 0 && (
															<button
																type="button"
																onClick={() =>
																	setTxAmount(String(gupAnalysis.minGupAmount))
																}
																className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition"
															>
																<span>
																	Gunakan Min.{" "}
																	{formatRupiah(gupAnalysis.minGupAmount)}
																</span>
															</button>
														)}

													{gupAnalysis.isMinimumAmountMet &&
														!gupAnalysis.isProportional &&
														gupAnalysis.isOnTime &&
														gupAnalysis.minimumAmountForOptimalAtPlannedDate >
															Number(txAmount) && (
															<button
																type="button"
																onClick={() =>
																	setTxAmount(
																		String(
																			gupAnalysis.minimumAmountForOptimalAtPlannedDate,
																		),
																	)
																}
																className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition"
															>
																<span>
																	Gunakan{" "}
																	{formatRupiah(
																		gupAnalysis.minimumAmountForOptimalAtPlannedDate,
																	)}
																</span>
															</button>
														)}

													{gupAnalysis.isMinimumAmountMet &&
														!gupAnalysis.isProportional &&
														gupAnalysis.latestOptimalDateForCurrentAmount &&
														gupAnalysis.latestOptimalDateForCurrentAmount !==
															txSp2dDate && (
															<button
																type="button"
																onClick={() =>
																	setTxSp2dDate(
																		gupAnalysis.latestOptimalDateForCurrentAmount!,
																	)
																}
																className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-surface-muted transition"
															>
																<span>
																	Pakai Tanggal{" "}
																	{formatDateIndonesian(
																		gupAnalysis.latestOptimalDateForCurrentAmount,
																	)}
																</span>
															</button>
														)}

													{!gupAnalysis.isOnTime &&
														gupAnalysis.latestOnTimeDate &&
														gupAnalysis.latestOnTimeDate !== "—" && (
															<button
																type="button"
																onClick={() =>
																	setTxSp2dDate(gupAnalysis.latestOnTimeDate)
																}
																className="inline-flex items-center gap-1 rounded-lg border border-danger/30 bg-danger/10 px-2.5 py-1 text-[11px] font-semibold text-danger hover:bg-danger/20 transition"
															>
																<span>
																	Pakai Batas{" "}
																	{formatDateIndonesian(
																		gupAnalysis.latestOnTimeDate,
																	)}
																</span>
															</button>
														)}
												</div>
											</div>
										)}

										{/* Notes */}
										{gupAnalysis.notes.length > 0 && (
											<div className="rounded-lg border border-border/60 bg-surface-muted/50 p-2.5 text-[11px] text-muted-foreground space-y-1">
														{gupAnalysis.notes.map((note) => (
															<p key={note} className="leading-relaxed">
														• {note}
													</p>
												))}
											</div>
										)}

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
													<span className="text-muted-foreground">Nilai UP Aktif: </span>
													<strong className="text-foreground">
														{formatRupiah(gupAnalysis.upAmount)}
													</strong>
												</div>
												<div>
													<span className="text-muted-foreground">Nominal GUP: </span>
													<strong className="text-foreground">
														{formatRupiah(gupAnalysis.plannedGupAmount)} (
														{gupAnalysis.rawGupPercent.toFixed(1)}% UP)
													</strong>
												</div>
												<div>
													<span className="text-muted-foreground">SP2D Terakhir: </span>
													<strong className="text-foreground">
														{formatDateIndonesian(gupAnalysis.previousSp2dDate)}
													</strong>
												</div>
												<div>
													<span className="text-muted-foreground">Rencana SP2D: </span>
													<strong className="text-foreground">
														{formatDateIndonesian(gupAnalysis.plannedSp2dDate)}
													</strong>
												</div>
												<div>
													<span className="text-muted-foreground">Interval Antar-SP2D: </span>
													<strong className="text-foreground">
														{gupAnalysis.intervalDays} hari kalender
													</strong>
												</div>
												<div>
													<span className="text-muted-foreground">Hari Bulan Referensi: </span>
													<strong className="text-foreground">
														{gupAnalysis.referenceMonthDays} hari (
														{gupAnalysis.referenceMonthName})
													</strong>
												</div>
												<div className="sm:col-span-2">
													<span className="text-muted-foreground">Rumus GUP Disebulankan: </span>
													<code className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-mono text-foreground">
														{gupAnalysis.rawGupPercent.toFixed(2)}% × (
														{gupAnalysis.referenceMonthDays} / {gupAnalysis.intervalDays}) ={" "}
														{gupAnalysis.annualizedGupPercent.toFixed(2)}%
													</code>
												</div>
											</div>
										</details>
									</div>
								) : null}
							</div>
						)}

						{txType === "SETORAN_TUP" && (
							<div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-[11px] text-warning space-y-1">
								<p className="font-semibold">Perhatian Setoran TUP:</p>
								<p>
									Setoran TUP mengurangi nilai kinerja setoran TUP. Usahakan belanja TUP terserap maksimal sesuai rencana.
								</p>
							</div>
						)}
					</div>
				</DomainFormDrawer>

				{/* Drawer 2: Form Input / Ubah KKP Bulanan */}
				<DomainFormDrawer
					isOpen={isKkpDrawerOpen}
					title={editingKkp ? "Ubah Realisasi KKP Bulanan" : "Atur Realisasi KKP Bulanan"}
					description="Masukkan realisasi transaksi belanja menggunakan Kartu Kredit Pemerintah."
					onClose={() => {
						setIsKkpDrawerOpen(false);
						setEditingKkp(null);
					}}
					onSubmit={handleSaveKkp}
					isSubmitting={isSubmitting}
				>
					<div className="space-y-4">
						<div className="space-y-1.5">
							<label
								htmlFor="kkp-month"
								className="block text-xs font-semibold text-foreground"
							>
								Bulan Penggunaan
							</label>
							<select
								id="kkp-month"
								value={kkpMonth}
								onChange={(e) => setKkpMonth(Number(e.target.value))}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							>
								{MONTH_NAMES.map((n, idx) => (
									<option key={n} value={idx + 1}>
										{n} (Triwulan Q{Math.ceil((idx + 1) / 3)})
									</option>
								))}
							</select>
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="kkp-amount"
								className="block text-xs font-semibold text-foreground"
							>
								Nominal Transaksi KKP (Rp)
							</label>
							<FormattedNumberInput
								id="kkp-amount"
								allowDecimal={false}
								required
								placeholder="Contoh: 15.000.000"
								value={kkpAmount}
								onChange={setKkpAmount}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none font-mono"
							/>
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="kkp-date"
								className="block text-xs font-semibold text-foreground"
							>
								Tanggal Transaksi (Opsional)
							</label>
							<input
								id="kkp-date"
								type="date"
								value={kkpUsageDate}
								onChange={(e) => setKkpUsageDate(e.target.value)}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							/>
						</div>
					</div>
				</DomainFormDrawer>

				{/* Panel Simulasi %GUP Disebulankan */}
				<section
					aria-label="Simulasi %GUP Disebulankan"
					className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/30 p-4 sm:p-5 shadow-xs"
				>
					<div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 pb-3">
						<div>
							<h2 className="text-sm font-bold text-foreground sm:text-base">
								Simulasi %GUP Disebulankan · Interaktif
							</h2>
							<p className="text-xs text-muted-foreground">
								Uji coba skenario pengajuan GUP (nominal, tanggal, frekuensi) tanpa mengubah data aktual DB.
							</p>
						</div>

						{!assumptions ? (
							<button
								type="button"
								onClick={() =>
									setAssumptions({ ...DEFAULT_UP_TUP_ASSUMPTIONS })
								}
								className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-amber-700"
							>
								<Sparkles className="size-3.5" />
								<span>Mulai Simulasi Rencana</span>
							</button>
						) : (
							<button
								type="button"
								onClick={() => setIsSaveDialogOpen(true)}
								title="Simpan ke Skenario A, B, atau C"
								className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-amber-700"
							>
								<Save className="size-3.5" />
								<span>Simpan Skenario (A/B/C)</span>
							</button>
						)}
					</div>

					{scenarioMessage && (
						<output className="flex items-center justify-between gap-2.5 rounded-xl border border-success/30 bg-success/10 p-3 text-xs font-semibold text-success">
							<span>{scenarioMessage}</span>
							<a
								href="/operator/history"
								className="font-bold underline underline-offset-2 hover:text-foreground"
							>
								Buka Riwayat & Skenario →
							</a>
						</output>
					)}

					{assumptions ? (
						<UpTupAssumptionPanel
							value={assumptions}
							actualUpTupContrib={actualScore.contribution}
							onChange={setAssumptions}
							onReset={() => setAssumptions(null)}
						/>
					) : (
						<div className="rounded-xl bg-background/60 p-4 text-xs text-muted-foreground border border-amber-200">
							<p>
								Tekan <strong>Mulai Simulasi Rencana</strong> untuk mengatur asumsi revolving GUP sisa tahun (nominal GUP, selisih hari SP2D, rasio perputaran) serta estimasi tambahan belanja KKP. Hasil nilai akan terproyeksi secara instan di atas data aktual.
							</p>
						</div>
					)}
				</section>

				{/* Tactical Recommendations */}
				<div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-xs space-y-3">
					<div className="flex items-center gap-2">
						<TrendingUp className="size-4 text-primary" />
						<h2 className="text-sm font-bold text-foreground">
							Strategi &amp; Rekomendasi Pengelolaan UP TUP
						</h2>
					</div>

					<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
						{recommendations.map((rec) => (
							<div
								key={rec.title}
								className={`rounded-xl border p-3.5 space-y-1 ${
									rec.type === "warn"
										? "border-danger/30 bg-danger/5 text-danger"
										: rec.type === "good"
											? "border-success/30 bg-success/5 text-success"
											: "border-border bg-background text-foreground"
								}`}
							>
								<div className="flex items-center gap-1.5 font-bold text-xs">
									{rec.type === "warn" ? (
										<AlertCircle className="size-3.5 shrink-0" />
									) : rec.type === "good" ? (
										<CheckCircle2 className="size-3.5 shrink-0" />
									) : (
										<Info className="size-3.5 shrink-0 text-primary" />
									)}
									<span>{rec.title}</span>
								</div>
								<p className="text-[11px] text-muted-foreground leading-relaxed">
									{rec.desc}
								</p>
							</div>
						))}
					</div>
				</div>
				<SaveScenarioDialog
					open={isSaveDialogOpen}
					onOpenChange={setIsSaveDialogOpen}
					indicatorKey="up_tup"
					indicatorName="Pengelolaan UP TUP & KKP"
					activePeriodMonth={currentMonth}
					assumptions={assumptions ? { upTup: assumptions } : undefined}
					overrideSummaries={
						assumptions
							? [
									{
										label: "Rencana GUP",
										originalValue: `UP ${formatRupiah(Number(activeUpAmount) || 0)}`,
										newValue: `GUP ${formatRupiah(Number(assumptions.nilaiRencanaGUP) || 0)} (${formatDateIndonesian(assumptions.tanggalRencanaGUP)})`,
									},
								]
							: []
					}
					onSuccess={() => {
						setScenarioMessage(
							"Skenario what-if UP TUP & KKP tersimpan di slot A/B/C. Buka Riwayat & Skenario untuk membandingkan.",
						);
						setTimeout(() => setScenarioMessage(null), 5000);
					}}
				/>
			</div>
		</OperatorShell>
	);
}


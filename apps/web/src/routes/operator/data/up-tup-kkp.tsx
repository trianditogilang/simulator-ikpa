import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
	AlertCircle,
	AlertTriangle,
	Calendar,
	CheckCircle2,
	Coins,
	CreditCard,
	Info,
	Layers,
	Lightbulb,
	Pencil,
	ShieldCheck,
	Trash2,
	Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
	type ColumnDef,
	DomainDataTable,
} from "@/components/data/domain-data-table";
import { DomainFormDrawer } from "@/components/data/domain-form-drawer";
import { FormattedNumberInput } from "@/components/data/formatted-number-input";
import { OperatorShell } from "@/components/layout/operator-shell";
import { formatDateDDMMYYYY, formatRupiah } from "@/lib/format";
import {
	analyzeGupPlan,
	formatDateIndonesian,
} from "@/lib/simulation/up-tup-assumptions";
import { isThr2026FairnessApplied } from "@/lib/simulation/up-tup-workspace";
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

export const Route = createFileRoute("/operator/data/up-tup-kkp")({
	loader: async ({ context }) => {
		const activeOrgId =
			context.auth?.isAuthenticated &&
			(context.access?.status === "operator_single_scope" ||
				context.access?.status === "operator_multiple_scopes")
				? (context.access.activeOrganizationId ?? undefined)
				: undefined;

		return fetchUpTupAndKkp(activeOrgId);
	},
	component: UpTupKkpPage,
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

function UpTupKkpPage() {
	const router = useRouter();
	const initialData = Route.useLoaderData();

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
		const upRecord = initialData.upTupList.find((r) => r.type === "UP");
		return upRecord && Number(upRecord.amount) > 0 ? Number(upRecord.amount) : 0;
	}, [initialData.upTupList]);

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
		return initialData.upTupList
			.filter((u) => {
				if (u.type !== "UP" && u.type !== "GUP" && u.type !== "GUP_NIHIL") return false;
				if (editingUpTup && u.id === editingUpTup.id) return false;
				return Boolean(u.sp2dAt);
			})
			.sort((a, b) => b.sp2dAt.localeCompare(a.sp2dAt));
	}, [initialData.upTupList, editingUpTup]);

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

	// KKP Config State (Default: Tidak Memiliki UP KKP / none -> Maks Nilai 90%)
	const [kkpStatus, setKkpStatus] = useState<"active" | "pending" | "none">(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("ikpa_satker_kkp_status");
			if (saved === "active" || saved === "pending" || saved === "none") {
				return saved;
			}
		}
		return initialData.kkpList.length > 0 ? "active" : "none";
	});

	const [monthlyKkpCeiling, setMonthlyKkpCeiling] = useState<string>(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("ikpa_satker_kkp_ceiling");
			if (saved !== null) return saved;
		}
		return initialData.kkpList.length > 0 ? "50000000" : "0";
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
	const totalUpAmount = initialData.upTupList
		.filter((u) => u.type === "UP" || u.type === "TUP")
		.reduce((sum, u) => sum + (Number.parseFloat(u.amount) || 0), 0);

	const totalKkpAmount = initialData.kkpList.reduce(
		(sum, k) => sum + (Number.parseFloat(k.amount) || 0),
		0,
	);

	const annualKkpCeiling = useMemo(() => {
		const monthly = Number(monthlyKkpCeiling) || 0;
		return monthly * 12;
	}, [monthlyKkpCeiling]);

	// Open UP/TUP Create
	const handleOpenCreateUpTup = () => {
		setEditingUpTup(null);
		setTxType("GUP");
		setTxAmount("");
		setTxSp2dDate(new Date().toISOString().slice(0, 10));
		const latestUpGup = initialData.upTupList
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

	const filteredUpTup = initialData.upTupList.filter(
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
		<OperatorShell currentPath="/operator/data/up-tup-kkp">
			<div className="space-y-6">
				{/* Top Summary Banner */}
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div className="flex items-center gap-3">
						<div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
							<Wallet className="size-5.5" />
						</div>
						<div>
							<h1 className="text-lg font-bold text-foreground sm:text-xl">
								Pengelolaan UP / TUP &amp; Kartu Kredit Pemerintah (KKP)
							</h1>
							<p className="text-xs text-muted-foreground">
								Kelola penerbitan SP2D UP, TUP, revolving GUP, PTUP, Setoran TUP, serta realisasi KKP bulanan.
							</p>
						</div>
					</div>
				</div>

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

				{/* Summary Metrics (4 Cards) */}
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-medium">Total UP/TUP Terbit</span>
							<Coins className="size-4 text-primary" />
						</div>
						<p className="text-lg font-bold text-foreground sm:text-xl font-mono">
							{formatRupiah(totalUpAmount)}
						</p>
						<p className="text-[11px] text-muted-foreground">
							Dana persediaan aktif
						</p>
					</div>

					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-medium">
								Transaksi Revolving
							</span>
							<Layers className="size-4 text-success" />
						</div>
						<p className="text-lg font-bold text-foreground sm:text-xl">
							{initialData.upTupList.length} Transaksi
						</p>
						<p className="text-[11px] text-muted-foreground">
							UP, GUP, PTUP &amp; Setoran
						</p>
					</div>

					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-medium">Total Belanja KKP</span>
							<CreditCard className="size-4 text-warning" />
						</div>
						<p className="text-lg font-bold text-foreground sm:text-xl font-mono">
							{formatRupiah(totalKkpAmount)}
						</p>
						<p className="text-[11px] text-muted-foreground">
							Realisasi belanja KKP
						</p>
					</div>

					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-medium">Plafon KKP Bulanan</span>
							<ShieldCheck className="size-4 text-primary" />
						</div>
						<p className="text-lg font-bold text-foreground sm:text-xl font-mono">
							{kkpStatus === "none" ? "Rp 0" : formatRupiah(Number(monthlyKkpCeiling) || 0)}
						</p>
						<p className="text-[11px] text-muted-foreground">
							Status:{" "}
							<span
								className={
									kkpStatus === "active"
										? "font-semibold text-success"
										: "font-semibold text-warning"
								}
							>
								{kkpStatus === "active"
									? "Aktif (Maks 100%)"
									: kkpStatus === "pending"
										? "Menunggu Bank"
										: "Tanpa KKP (Maks 90%)"}
							</span>
						</p>
					</div>
				</div>

				{/* 2 Tab Selector */}
				<div className="flex items-center gap-2 border-b border-border pb-2">
					<button
						type="button"
						onClick={() => setActiveTab("uptup")}
						className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
							activeTab === "uptup"
								? "bg-primary text-primary-foreground shadow-xs"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						Transaksi UP / TUP / GUP ({initialData.upTupList.length})
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
						Penggunaan KKP ({initialData.kkpList.length})
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
									<label className="block text-xs font-semibold text-foreground">
										Status KKP Satker
									</label>
									<select
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
									<label className="block text-xs font-semibold text-foreground">
										Plafon Bulanan KKP (Rp)
									</label>
									<FormattedNumberInput
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
									<label className="block text-xs font-semibold text-foreground">
										Plafon KKP Tahunan (x12)
									</label>
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
									Matriks Target Triwulanan &amp; Evaluasi Capaian KKP TA {initialData.year}
								</h3>
								<p className="text-xs text-muted-foreground">
									Target kumulatif dihitung dari persentase terhadap Plafon KKP Tahunan. Nilai 110 diberikan bila realisasi kumulatif &ge; target.
								</p>
							</div>

							<div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
								{KKP_TARGETS_2026.map((tgt) => {
									const targetNominal = (annualKkpCeiling * tgt.targetPct) / 100;
									const cumRealization = initialData.kkpList
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
							data={initialData.kkpList}
							columns={kkpColumns}
							searchValue=""
							onSearchChange={() => {}}
							onAddClick={handleOpenCreateKkp}
							totalCount={initialData.kkpList.length}
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
													{gupAnalysis.actions.map((action, idx) => (
														<div
															key={idx}
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
												{gupAnalysis.notes.map((note, idx) => (
													<p key={idx} className="leading-relaxed">
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
			</div>
		</OperatorShell>
	);
}


import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import {
	AlertCircle,
	ArrowRight,
	Calendar,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	Clock,
	FileSignature,
	FileText,
	HelpCircle,
	Info,
	Pencil,
	Plus,
	Receipt,
	ShieldCheck,
	Sparkles,
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
import { formatRupiah } from "@/lib/format";
import {
	ACCOUNT_LABELS,
	CONTRACT_ACCOUNT_OPTIONS,
	calcKontraktualSummary,
	evaluateSingleContract,
} from "@/lib/simulation/kontraktual-workspace";
import {
	buildSpmReminders,
	tagihanAdvice,
} from "@/lib/simulation/tagihan-output-reminder";
import {
	addContract,
	addSpmLs,
	editContract,
	fetchContractsAndInvoices,
	removeContract,
	removeSpmLs,
	type ContractRecord,
	type SpmLsRecord,
} from "@/services/contracts-invoices-service";

export const Route = createFileRoute("/operator/data/contracts-invoices")({
	validateSearch: (search: Record<string, unknown>) => ({
		tab: search.tab === "spm" ? ("spm" as const) : ("contracts" as const),
		org: typeof search.org === "string" ? search.org : undefined,
	}),
	loaderDeps: ({ search }) => ({ org: search.org }),
	loader: async ({ context, deps }) => {
		const activeOrgId =
			deps.org ||
			(context.auth?.isAuthenticated &&
			(context.access?.status === "operator_single_scope" ||
				context.access?.status === "operator_multiple_scopes")
				? (context.access.activeOrganizationId ?? undefined)
				: undefined);

		return fetchContractsAndInvoices(activeOrgId);
	},
	component: ContractsInvoicesPage,
});

function ContractsInvoicesPage() {
	const router = useRouter();
	const navigate = useNavigate();
	const searchParams = Route.useSearch();
	const initialData = Route.useLoaderData();

	const activeTab = searchParams.tab || "contracts";

	const [search, setSearch] = useState("");
	const [isContractDrawerOpen, setIsContractDrawerOpen] = useState(false);
	const [isSpmDrawerOpen, setIsSpmDrawerOpen] = useState(false);
	const [isGuideOpen, setIsGuideOpen] = useState(false);
	const [isTraceExpanded, setIsTraceExpanded] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [actionMessage, setActionMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	// Contract Form State (Create / Edit)
	const [editingContractId, setEditingContractId] = useState<string | null>(
		null,
	);
	const [contractNum, setContractNum] = useState("");
	const [contractAccount, setContractAccount] = useState<
		"51" | "52" | "53" | "57"
	>("53");
	const [contractValue, setContractValue] = useState("");
	const [signedDate, setSignedDate] = useState(
		new Date().toISOString().slice(0, 10),
	);
	const [paymentType, setPaymentType] = useState<"sekaligus" | "termin">(
		"sekaligus",
	);
	const [sp2dDate, setSp2dDate] = useState("");

	// SPM Form State
	const [selectedContractId, setSelectedContractId] = useState(
		initialData.contracts[0]?.id ?? "",
	);
	const [spmRefNum, setSpmRefNum] = useState("");
	const [bastDate, setBastDate] = useState(
		new Date().toISOString().slice(0, 10),
	);
	const [kppnReceiveDate, setKppnReceiveDate] = useState(
		new Date().toISOString().slice(0, 10),
	);
	const [isPegawai, setIsPegawai] = useState(false);

	// Computed Belanja Kontraktual Summary
	const summary = useMemo(
		() => calcKontraktualSummary(initialData.contracts, initialData.year || 2026),
		[initialData.contracts, initialData.year],
	);

	// Live preview of candidate contract in drawer
	const liveDrawerPreview = useMemo(() => {
		const valNum = parseFloat(contractValue) || 0;
		const candidateRecord: ContractRecord = {
			id: editingContractId || "preview",
			contractNumber: contractNum || "Draft Kontrak",
			accountCode: contractAccount,
			value: valNum.toString(),
			signedAt: signedDate,
			paymentType,
			sp2dAt: sp2dDate || null,
		};
		return evaluateSingleContract(candidateRecord, initialData.year || 2026);
	}, [
		editingContractId,
		contractNum,
		contractAccount,
		contractValue,
		signedDate,
		paymentType,
		sp2dDate,
		initialData.year,
	]);

	// Strip reminder H+17 wajib (for SPM tab)
	const spmReminders = useMemo(
		() => buildSpmReminders(initialData.spmLsList),
		[initialData.spmLsList],
	);
	const spmAdvice = useMemo(() => tagihanAdvice(spmReminders), [spmReminders]);
	const spmLate = spmReminders.filter((r) => r.status === "Terlambat");
	const spmLateCount = spmLate.length;

	const handleTabChange = (newTab: "contracts" | "spm") => {
		navigate({
			to: "/operator/data/contracts-invoices",
			search: (prev) => ({
				tab: newTab,
				org: prev.org,
			}),
		});
	};

	const handleOpenCreateContract = () => {
		setEditingContractId(null);
		setContractNum("");
		setContractAccount("53");
		setContractValue("");
		setSignedDate(new Date().toISOString().slice(0, 10));
		setPaymentType("sekaligus");
		setSp2dDate("");
		setErrorMessage(null);
		setIsContractDrawerOpen(true);
	};

	const handleOpenEditContract = (c: ContractRecord) => {
		setEditingContractId(c.id);
		setContractNum(c.contractNumber);
		setContractAccount((c.accountCode as "51" | "52" | "53" | "57") || "53");
		setContractValue(c.value);
		setSignedDate(c.signedAt);
		setPaymentType((c.paymentType as "sekaligus" | "termin") || "sekaligus");
		setSp2dDate(c.sp2dAt || "");
		setErrorMessage(null);
		setIsContractDrawerOpen(true);
	};

	const handleSaveContract = async () => {
		setActionMessage(null);
		setErrorMessage(null);

		if (!contractNum.trim()) {
			setErrorMessage("Nomor kontrak wajib diisi.");
			return;
		}

		const val = Number.parseFloat(contractValue) || 0;
		if (val <= 0) {
			setErrorMessage("Nilai kontrak harus lebih dari Rp 0.");
			return;
		}

		setIsSubmitting(true);
		try {
			if (editingContractId) {
				await editContract({
					contractId: editingContractId,
					contractNumber: contractNum.trim(),
					accountCode: contractAccount,
					value: val.toFixed(2),
					signedAt: signedDate,
					paymentType,
					sp2dAt: sp2dDate ? sp2dDate : null,
				});
				setActionMessage("Data kontrak berhasil diperbarui.");
			} else {
				await addContract({
					contractNumber: contractNum.trim(),
					accountCode: contractAccount,
					value: val.toFixed(2),
					signedAt: signedDate,
					paymentType,
					sp2dAt: sp2dDate ? sp2dDate : null,
				});
				setActionMessage("Data kontrak baru berhasil ditambahkan.");
			}

			setIsContractDrawerOpen(false);
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal menyimpan data kontrak.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDeleteContract = async (id: string) => {
		if (
			!confirm(
				"Hapus data kontrak ini? Data SPM-LS terkait juga mungkin terpengaruh.",
			)
		) {
			return;
		}
		try {
			await removeContract(id);
			setActionMessage("Data kontrak berhasil dihapus.");
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal menghapus kontrak.",
			);
		}
	};

	const handleCreateSpm = async () => {
		setActionMessage(null);
		setErrorMessage(null);

		if (!selectedContractId) {
			setErrorMessage("Pilih kontrak terkait terlebih dahulu.");
			return;
		}
		if (!spmRefNum.trim()) {
			setErrorMessage("Nomor SPM-LS wajib diisi.");
			return;
		}

		setIsSubmitting(true);
		try {
			await addSpmLs({
				contractId: selectedContractId,
				referenceNumber: spmRefNum.trim(),
				bastBappDate: bastDate,
				receivedAtKppn: kppnReceiveDate,
				isPegawai,
			});

			setActionMessage("Penerbitan SPM-LS berhasil dicatat.");
			setIsSpmDrawerOpen(false);
			setSpmRefNum("");
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal mencatat SPM-LS.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDeleteSpm = async (id: string) => {
		if (!confirm("Hapus data SPM-LS ini?")) {
			return;
		}
		try {
			await removeSpmLs(id);
			setActionMessage("Data SPM-LS berhasil dihapus.");
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal menghapus SPM-LS.",
			);
		}
	};

	const filteredContracts = initialData.contracts.filter(
		(c) =>
			c.contractNumber.toLowerCase().includes(search.toLowerCase()) ||
			c.accountCode.includes(search),
	);

	const filteredSpm = initialData.spmLsList.filter((s) =>
		s.referenceNumber.toLowerCase().includes(search.toLowerCase()),
	);

	const contractColumns: ColumnDef<ContractRecord>[] = [
		{
			key: "number",
			header: "Nomor Kontrak & Akun",
			render: (item) => (
				<div className="space-y-0.5">
					<span className="font-semibold text-foreground">
						{item.contractNumber}
					</span>
					<div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
						<span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground border border-border">
							Akun {item.accountCode}
						</span>
						<span>{ACCOUNT_LABELS[item.accountCode] || ""}</span>
					</div>
				</div>
			),
		},
		{
			key: "value",
			header: "Nilai Kontrak",
			render: (item) => {
				const valNum = parseFloat(item.value) || 0;
				const isElig = valNum >= 50000000;
				return (
					<div className="space-y-0.5">
						<span className="font-semibold text-foreground">
							{formatRupiah(valNum)}
						</span>
						<p
							className={`text-[10px] font-medium ${
								isElig ? "text-success" : "text-muted-foreground"
							}`}
						>
							{isElig ? "Eligible (≥ Rp50 Juta)" : "Di bawah ambang batas (< Rp50 Jt)"}
						</p>
					</div>
				);
			},
		},
		{
			key: "signed",
			header: "Tanggal TTD & KD",
			render: (item) => {
				const ev = evaluateSingleContract(item, initialData.year || 2026);
				return (
					<div className="space-y-1">
						<span className="inline-flex items-center gap-1 text-xs text-foreground font-medium">
							<Calendar className="size-3 text-muted-foreground" />
							<span>{item.signedAt}</span>
						</span>
						<div>
							<span
								className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
									ev.kdBadge.variant === "success"
										? "bg-success/10 text-success border border-success/20"
										: ev.kdBadge.variant === "info"
											? "bg-primary/10 text-primary border border-primary/20"
											: "bg-surface text-muted-foreground border border-border"
								}`}
							>
								{ev.kdBadge.label}
							</span>
						</div>
					</div>
				);
			},
		},
		{
			key: "type",
			header: "Tipe Pembayaran",
			render: (item) => (
				<span className="rounded-md bg-surface border border-border px-2 py-0.5 text-[11px] font-semibold text-foreground">
					{item.paymentType === "sekaligus"
						? "Sekaligus (100%)"
						: "Termin / Bertahap"}
				</span>
			),
		},
		{
			key: "sp2d",
			header: "Tanggal SP2D & AK53",
			render: (item) => {
				const ev = evaluateSingleContract(item, initialData.year || 2026);
				return (
					<div className="space-y-1">
						<span className="text-xs text-foreground font-medium">
							{item.sp2dAt || "Belum Terbit"}
						</span>
						<div>
							<span
								className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
									ev.ak53Badge.variant === "success"
										? "bg-success/10 text-success border border-success/20"
										: ev.ak53Badge.variant === "info"
											? "bg-primary/10 text-primary border border-primary/20"
											: ev.ak53Badge.variant === "warning"
												? "bg-warning/10 text-warning border border-warning/20"
												: "bg-surface text-muted-foreground border border-border"
								}`}
							>
								{ev.ak53Badge.label}
							</span>
						</div>
					</div>
				);
			},
		},
		{
			key: "actions",
			header: "Aksi",
			render: (item) => (
				<div className="flex items-center gap-1.5">
					<button
						type="button"
						onClick={() => handleOpenEditContract(item)}
						className="inline-flex items-center rounded-lg p-1.5 text-primary hover:bg-primary/10 transition"
						title="Ubah Data Kontrak"
					>
						<Pencil className="size-3.5" />
					</button>
					<button
						type="button"
						onClick={() => {
							setSelectedContractId(item.id);
							setIsSpmDrawerOpen(true);
						}}
						className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition"
						title="Catat SPM-LS untuk Kontrak Ini"
					>
						<Plus className="size-3" />
						<span>SPM</span>
					</button>
					<button
						type="button"
						onClick={() => handleDeleteContract(item.id)}
						className="inline-flex items-center rounded-lg p-1.5 text-danger hover:bg-danger/10 transition"
						title="Hapus Kontrak"
					>
						<Trash2 className="size-3.5" />
					</button>
				</div>
			),
		},
	];

	const spmColumns: ColumnDef<SpmLsRecord>[] = [
		{
			key: "ref",
			header: "Nomor SPM-LS",
			render: (item) => (
				<div>
					<span className="font-semibold text-foreground">
						{item.referenceNumber}
					</span>
					<p className="text-[11px] text-muted-foreground">
						{item.isPegawai ? "Kategori Belanja Pegawai" : "Non-Pegawai / Rekanan"}
					</p>
				</div>
			),
		},
		{
			key: "contractId",
			header: "Kontrak Terkait",
			render: (item) => {
				const parentContract = initialData.contracts.find(
					(c) => c.id === item.contractId,
				);
				return (
					<span className="text-xs font-medium text-foreground">
						{parentContract?.contractNumber ||
							"Kontrak ID: " + item.contractId.slice(0, 8)}
					</span>
				);
			},
		},
		{
			key: "bast",
			header: "Tanggal BAST / BAPP",
			render: (item) => (
				<span className="inline-flex items-center gap-1.5 text-foreground">
					<Calendar className="size-3 text-muted-foreground" />
					<span>{item.bastBappDate}</span>
				</span>
			),
		},
		{
			key: "received",
			header: "Diterima di KPPN",
			render: (item) => (
				<span className="inline-flex items-center gap-1.5 text-foreground">
					<Clock className="size-3.5 text-muted-foreground" />
					<span>{item.receivedAtKppn}</span>
				</span>
			),
		},
		{
			key: "actions",
			header: "Aksi",
			render: (item) => (
				<button
					type="button"
					onClick={() => handleDeleteSpm(item.id)}
					className="inline-flex items-center rounded-lg p-1.5 text-danger hover:bg-danger/10 transition"
					title="Hapus SPM-LS"
				>
					<Trash2 className="size-3.5" />
				</button>
			),
		},
	];

	return (
		<OperatorShell
			currentPath={`/operator/data/contracts-invoices?tab=${activeTab}`}
		>
			<div className="space-y-6">
				{/* Top Header Banner */}
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div className="flex items-center gap-3">
						<div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
							{activeTab === "contracts" ? (
								<FileSignature className="size-5" />
							) : (
								<Receipt className="size-5" />
							)}
						</div>
						<div>
							<div className="flex items-center gap-2">
								<h1 className="text-lg font-bold text-foreground sm:text-xl">
									{activeTab === "contracts"
										? "Indikator Belanja Kontraktual"
										: "Penyelesaian Tagihan (SPM-LS)"}
								</h1>
								<span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
									Bobot 10%
								</span>
							</div>
							<p className="text-xs text-muted-foreground">
								{activeTab === "contracts"
									? "Pantau akselerasi kontrak melalui Distribusi (20%), Kontrak Pra-DIPA / Dini (40%), dan Akselerasi Belanja Modal 53 (40%)."
									: "Pantau kepatuhan penyelesaian tagihan SPM-LS maksimal 17 hari kerja setelah tanggal BAST/BAPP."}
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						{activeTab === "contracts" && (
							<>
								<button
									type="button"
									onClick={() => setIsGuideOpen(true)}
									className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground shadow-xs transition hover:bg-surface-muted"
								>
									<HelpCircle className="size-3.5 text-primary" />
									<span>Panduan Rumus</span>
								</button>
								<button
									type="button"
									onClick={handleOpenCreateContract}
									className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90"
								>
									<Plus className="size-3.5" />
									<span>Tambah Kontrak</span>
								</button>
							</>
						)}

						{activeTab === "spm" && (
							<button
								type="button"
								onClick={() => {
									if (initialData.contracts.length === 0) {
										alert("Daftarkan minimal satu kontrak terlebih dahulu.");
										return;
									}
									setSelectedContractId(initialData.contracts[0]?.id ?? "");
									setIsSpmDrawerOpen(true);
								}}
								className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90"
							>
								<Plus className="size-3.5" />
								<span>Catat SPM-LS</span>
							</button>
						)}
					</div>
				</div>

				{/* Feedback status messages */}
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

				{/* Standardized 5-Card Score Grid for Belanja Kontraktual */}
				{activeTab === "contracts" && (
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
						{/* Card 1: Pra DIPA (40%) */}
						<div className="rounded-xl border border-border bg-background p-4 shadow-xs space-y-1">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-semibold truncate" title="Pra DIPA (40%)">
									Pra DIPA (40%)
								</span>
								<Calendar className="size-4 text-primary" />
							</div>
							<div className="flex items-baseline gap-2">
								<p className="text-2xl font-bold text-foreground sm:text-3xl">
									{summary.kd.score ?? "—"}
								</p>
								<span className="text-[11px] font-semibold text-muted-foreground">
									{summary.kd.denominatorCount} Kontrak
								</span>
							</div>
							<p
								className="text-[11px] text-muted-foreground truncate"
								title={`${summary.kd.praDipaCount} Pra-DIPA (120) · ${summary.kd.q1Count} TW I (110)`}
							>
								{summary.kd.praDipaCount} Pra-DIPA (120) · {summary.kd.q1Count} TW I (110)
							</p>
						</div>

						{/* Card 2: Akselerasi 53 (40%) */}
						<div className="rounded-xl border border-border bg-background p-4 shadow-xs space-y-1">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-semibold truncate" title="Akselerasi 53 (40%)">
									Akselerasi 53 (40%)
								</span>
								<Clock className="size-4 text-primary" />
							</div>
							<div className="flex items-baseline gap-2">
								<p className="text-2xl font-bold text-foreground sm:text-3xl">
									{summary.ak53.score ?? "—"}
								</p>
								<span className="text-[11px] font-semibold text-muted-foreground">
									{summary.ak53.completedCount} Selesai
								</span>
							</div>
							<p
								className="text-[11px] text-muted-foreground truncate"
								title={`${summary.ak53.tw1Count} TW I · ${summary.ak53.tw2Count} TW II · ${summary.ak53.tw3Count} TW III`}
							>
								{summary.ak53.tw1Count} TW I · {summary.ak53.tw2Count} TW II · {summary.ak53.tw3Count} TW III
							</p>
						</div>

						{/* Card 3: Distribusi Akselerasi Kontrak (20%) */}
						<div className="rounded-xl border border-border bg-background p-4 shadow-xs space-y-1">
							<div className="flex items-center justify-between text-muted-foreground">
								<span
									className="text-xs font-semibold truncate"
									title="Distribusi Akselerasi Kontrak (20%)"
								>
									Distribusi Akselerasi Kontrak (20%)
								</span>
								<TrendingUp className="size-4 text-primary" />
							</div>
							<div className="flex items-baseline gap-2">
								<p className="text-2xl font-bold text-foreground sm:text-3xl">
									{summary.dak.score ?? "—"}
								</p>
								<span className="text-[11px] font-semibold text-primary">
									Rasio {summary.dak.ratio.toFixed(1)}%
								</span>
							</div>
							<p
								className="text-[11px] text-muted-foreground truncate"
								title={`${summary.dak.countQ2} dari ${summary.dak.totalEligible} kontrak s.d. 30 Juni`}
							>
								{summary.dak.countQ2} dari {summary.dak.totalEligible} kontrak s.d. 30 Juni
							</p>
						</div>

						{/* Card 4 (2 paling kanan): Nilai IKPA Belanja Kontraktual */}
						<div className="rounded-xl border border-primary/20 bg-background p-4 shadow-xs space-y-1">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-semibold text-foreground truncate">
									Nilai IKPA Kontraktual
								</span>
								<ShieldCheck className="size-4 text-primary" />
							</div>
							<div className="flex items-baseline gap-2">
								<p className="text-2xl font-extrabold text-primary sm:text-3xl">
									{summary.final.score ?? "—"}
								</p>
								<span
									className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
										summary.final.status === "complete"
											? "bg-success/10 text-success"
											: "bg-warning/10 text-warning"
									}`}
								>
									{summary.final.statusLabel}
								</span>
							</div>
							<p className="text-[11px] text-muted-foreground truncate">
								Skor komposit 3 subkomponen
							</p>
						</div>

						{/* Card 5 (paling kanan): Kontribusi IKPA (10%) */}
						<div className="rounded-xl border border-success/20 bg-success/5 p-4 shadow-xs space-y-1">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-semibold text-success truncate">
									Kontribusi IKPA (10%)
								</span>
								<Sparkles className="size-4 text-success" />
							</div>
							<p className="text-2xl font-extrabold text-success sm:text-3xl">
								{summary.final.weightedContribution
									? `${summary.final.weightedContribution} pts`
									: "—"}
							</p>
							<p className="text-[11px] text-muted-foreground truncate">
								Maksimal kontribusi: 10.00 poin
							</p>
						</div>
					</div>
				)}

				{/* Accordion: Trace & Detail Perhitungan */}
				{activeTab === "contracts" && (
					<div className="rounded-2xl border border-border bg-background shadow-xs overflow-hidden">
						<button
							type="button"
							onClick={() => setIsTraceExpanded(!isTraceExpanded)}
							className="flex w-full items-center justify-between p-4 text-left hover:bg-surface-muted transition"
						>
							<div className="flex items-center gap-2">
								<Info className="size-4 text-primary" />
								<span className="text-xs font-semibold text-foreground">
									Lihat Rincian Rumus &amp; Jejak Perhitungan Belanja Kontraktual
								</span>
							</div>
							<div className="flex items-center gap-1 text-xs text-primary font-medium">
								<span>{isTraceExpanded ? "Sembunyikan" : "Tampilkan"}</span>
								{isTraceExpanded ? (
									<ChevronUp className="size-4" />
								) : (
									<ChevronDown className="size-4" />
								)}
							</div>
						</button>

						{isTraceExpanded && (
							<div className="border-t border-border p-4 sm:p-5 space-y-4 text-xs bg-surface/30">
								<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
									{/* DAK Step */}
									<div className="rounded-xl border border-border bg-background p-3.5 space-y-2">
										<div className="flex items-center justify-between font-semibold text-foreground">
											<span>1. DAK (Bobot 20%)</span>
											<span className="text-primary font-bold">
												Skor: {summary.dak.score ?? "—"}
											</span>
										</div>
										<p className="text-muted-foreground text-[11px]">
											Rasio = (Kontrak ≥ Rp50jt s.d. 30 Juni) ÷ (Total Kontrak Eligible TA) × 100%
										</p>
										<div className="rounded-lg bg-surface p-2.5 font-mono text-[11px] space-y-1 text-foreground">
											<p>
												Hitungan: ({summary.dak.countQ2} / {summary.dak.totalEligible}) × 100% ={" "}
												<span className="font-bold text-primary">
													{summary.dak.ratio.toFixed(2)}%
												</span>
											</p>
											<p className="text-[10px] text-muted-foreground">
												Bucket:{" "}
												{summary.dak.ratio === 0
													? "0% → 0"
													: summary.dak.ratio <= 25
														? "≤25% → 50"
														: summary.dak.ratio <= 50
															? "≤50% → 60"
															: summary.dak.ratio <= 75
																? "≤75% → 80"
																: ">75% → 100"}
											</p>
										</div>
										<p className="text-[11px] text-muted-foreground">
											Kontribusi = {summary.dak.score ?? 0} × 20% ={" "}
											<span className="font-semibold text-foreground">
												{summary.dak.weightedContribution ?? 0}
											</span>
										</p>
									</div>

									{/* KD Step */}
									<div className="rounded-xl border border-border bg-background p-3.5 space-y-2">
										<div className="flex items-center justify-between font-semibold text-foreground">
											<span>2. KD (Bobot 40%)</span>
											<span className="text-primary font-bold">
												Skor: {summary.kd.score ?? "—"}
											</span>
										</div>
										<p className="text-muted-foreground text-[11px]">
											Rata-rata poin kontrak Pra-DIPA (120) dan 1 Jan–31 Mar (110) per kontrak. Kontrak setelah 31 Mar tidak masuk penyebut.
										</p>
										<div className="rounded-lg bg-surface p-2.5 font-mono text-[11px] space-y-1 text-foreground">
											<p>
												Pra-DIPA: {summary.kd.praDipaCount} × 120 ={" "}
												{summary.kd.praDipaCount * 120}
											</p>
											<p>
												TW I: {summary.kd.q1Count} × 110 ={" "}
												{summary.kd.q1Count * 110}
											</p>
											<p>
												Rata-rata: {summary.kd.totalPoints} ÷ {summary.kd.denominatorCount} ={" "}
												<span className="font-bold text-primary">
													{summary.kd.score ?? "—"}
												</span>
											</p>
										</div>
										<p className="text-[11px] text-muted-foreground">
											Kontribusi = {summary.kd.score ?? 0} × 40% ={" "}
											<span className="font-semibold text-foreground">
												{summary.kd.weightedContribution ?? 0}
											</span>
										</p>
									</div>

									{/* AK53 Step */}
									<div className="rounded-xl border border-border bg-background p-3.5 space-y-2">
										<div className="flex items-center justify-between font-semibold text-foreground">
											<span>3. AK53 (Bobot 40%)</span>
											<span className="text-primary font-bold">
												Skor: {summary.ak53.score ?? "—"}
											</span>
										</div>
										<p className="text-muted-foreground text-[11px]">
											Rata-rata poin kontrak akun 53 (Rp50–200jt, sekaligus) berdasarkan triwulan terbit SP2D (TW I: 100, TW II: 90, TW III: 80, TW IV: 70).
										</p>
										<div className="rounded-lg bg-surface p-2.5 font-mono text-[11px] space-y-1 text-foreground">
											<p>
												Selesai TW I: {summary.ak53.tw1Count} × 100 | TW II: {summary.ak53.tw2Count} × 90
											</p>
											<p>
												Selesai TW III: {summary.ak53.tw3Count} × 80 | TW IV: {summary.ak53.tw4Count} × 70
											</p>
											<p>
												Rata-rata ={" "}
												<span className="font-bold text-primary">
													{summary.ak53.score ?? "—"}
												</span>
											</p>
										</div>
										<p className="text-[11px] text-muted-foreground">
											Kontribusi = {summary.ak53.score ?? 0} × 40% ={" "}
											<span className="font-semibold text-foreground">
												{summary.ak53.weightedContribution ?? 0}
											</span>
										</p>
									</div>
								</div>

								{/* Composite Summary Formula */}
								<div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-wrap items-center justify-between gap-3 text-foreground font-medium">
									<div>
										<p className="font-semibold text-xs text-primary">
											Formula Nilai Akhir Indikator Belanja Kontraktual
										</p>
										<p className="text-[11px] text-muted-foreground mt-0.5">
											Nilai BK = (DAK × 20%) + (KD × 40%) + (AK53 × 40%) = (
											{summary.dak.score ?? 0} × 0.2) + ({summary.kd.score ?? 0} × 0.4) + (
											{summary.ak53.score ?? 0} × 0.4) ={" "}
											<span className="font-bold text-foreground">
												{summary.final.score ?? "Belum Lengkap"}
											</span>
										</p>
									</div>
									<div className="text-right">
										<p className="text-[11px] text-muted-foreground">
											Kontribusi IKPA (Bobot 10%)
										</p>
										<p className="text-base font-bold text-success">
											{summary.final.weightedContribution
												? `${summary.final.weightedContribution} Pts`
												: "—"}
										</p>
									</div>
								</div>
							</div>
						)}
					</div>
				)}

				{/* Contextual Recommendations Panel */}
				{activeTab === "contracts" && summary.recommendations.length > 0 && (
					<div className="rounded-2xl border border-border bg-background p-4 sm:p-5 shadow-xs space-y-3">
						<div className="flex items-center gap-2 text-foreground font-semibold text-xs">
							<Sparkles className="size-4 text-warning" />
							<span>Rekomendasi Strategis Belanja Kontraktual</span>
						</div>
						<ul className="space-y-2">
							{summary.recommendations.map((rec) => (
								<li
									key={rec}
									className="flex items-start gap-2.5 rounded-xl border border-border bg-surface p-3 text-xs text-foreground"
								>
									<ArrowRight className="size-3.5 text-primary shrink-0 mt-0.5" />
									<span>{rec}</span>
								</li>
							))}
						</ul>
						<p className="text-[11px] text-muted-foreground">
							*Rekomendasi dihasilkan otomatis berdasarkan data komitmen kontrak satker untuk optimalisasi capaian IKPA.
						</p>
					</div>
				)}

				{/* Metric Summary for SPM tab */}
				{activeTab === "spm" && (
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-medium">Jumlah Kontrak Terdaftar</span>
								<FileText className="size-4 text-primary" />
							</div>
							<p className="text-lg font-bold text-foreground sm:text-xl">
								{initialData.contracts.length} Kontrak
							</p>
							<p className="text-[11px] text-muted-foreground">
								Total komitmen belanja
							</p>
						</div>

						<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-medium">Jumlah SPM-LS Terbit</span>
								<Receipt className="size-4 text-success" />
							</div>
							<p className="text-lg font-bold text-foreground sm:text-xl">
								{initialData.spmLsList.length} Berkas
							</p>
							<p className="text-[11px] text-muted-foreground">
								Target batas waktu: 17 HK setelah BAST
							</p>
						</div>

						<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-medium">SPM-LS Terlambat</span>
								<Clock className="size-4 text-danger" />
							</div>
							<p className="text-lg font-bold text-danger sm:text-xl">
								{spmLateCount} Berkas
							</p>
							<p className="text-[11px] text-muted-foreground">
								Potensi pengurangan nilai tagihan
							</p>
						</div>
					</div>
				)}

				{/* Strip reminder H+17 (Only for SPM Tab) */}
				{activeTab === "spm" && (
					<section
						aria-label="Reminder penyelesaian tagihan H+17 wajib"
						className="space-y-2 rounded-2xl border border-border bg-background p-4 sm:p-5"
					>
						<div className="flex items-center justify-between gap-3">
							<h2 className="text-sm font-semibold text-foreground">
								Reminder H+17 wajib
								{spmLateCount > 0 ? ` · ${spmLateCount} terlambat` : null}
							</h2>
							<a
								href="/operator/reminders"
								className="shrink-0 text-[11px] font-semibold text-primary underline-offset-4 hover:underline"
							>
								Reminder Center
							</a>
						</div>
						{spmReminders.length === 0 ? (
							<p className="text-body-small text-muted-foreground">{spmAdvice}</p>
						) : (
							<ul className="space-y-1.5">
								{spmLate.slice(0, 5).map((r) => (
									<li
										key={r.id}
										className="flex items-start justify-between gap-3 rounded-lg border border-danger/30 bg-danger/[0.03] px-3 py-2 text-body-small"
									>
										<div>
											<p className="font-semibold text-foreground">
												{r.referenceNumber}
												{r.isPegawai ? " · Pegawai" : null}
											</p>
											<p className="text-muted-foreground">
												BAST {r.bastDate}
												{r.receivedDate
													? ` · diterima ${r.receivedDate}`
													: " · belum diterima"} ·{" "}
												{r.elapsedWorkdays !== null
													? `${r.elapsedWorkdays} hari kerja`
													: "—"}
											</p>
										</div>
										<span className="shrink-0 rounded-full bg-danger/10 px-2.5 py-1 text-[11px] font-semibold text-danger">
											Terlambat
										</span>
									</li>
								))}
								{spmLate.length > 5 ? (
									<li className="px-1 text-[11px] text-muted-foreground">
										+{spmLate.length - 5} berkas terlambat lainnya — lihat di
										tabel Tagihan SPM-LS.
									</li>
								) : null}
							</ul>
						)}
						<p className="text-[11px] text-muted-foreground">{spmAdvice}</p>
						<p className="text-[11px] text-muted-foreground">
							Hitungan estimasi hari kerja Senin–Jumat (tanpa libur nasional);
							penilaian resmi memakai kalender kerja KPPN.
						</p>
					</section>
				)}

				{/* Tabs switch */}
				<div className="flex items-center gap-2 border-b border-border pb-2">
					<button
						type="button"
						onClick={() => handleTabChange("contracts")}
						className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
							activeTab === "contracts"
								? "bg-primary text-primary-foreground shadow-xs"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						Daftar Kontrak ({initialData.contracts.length})
					</button>
					<button
						type="button"
						onClick={() => handleTabChange("spm")}
						className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
							activeTab === "spm"
								? "bg-primary text-primary-foreground shadow-xs"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						Tagihan SPM-LS ({initialData.spmLsList.length})
					</button>
				</div>

				{/* Data Tables */}
				{activeTab === "contracts" ? (
					<DomainDataTable
						title="Daftar Komitmen Data Kontrak"
						data={filteredContracts}
						columns={contractColumns}
						searchValue={search}
						onSearchChange={setSearch}
						onAddClick={handleOpenCreateContract}
						totalCount={filteredContracts.length}
					/>
				) : (
					<DomainDataTable
						title="Daftar Penyelesaian Tagihan SPM-LS"
						data={filteredSpm}
						columns={spmColumns}
						searchValue={search}
						onSearchChange={setSearch}
						onAddClick={() => {
							if (initialData.contracts.length === 0) {
								alert("Daftarkan minimal satu kontrak terlebih dahulu.");
								return;
							}
							setSelectedContractId(initialData.contracts[0]?.id ?? "");
							setIsSpmDrawerOpen(true);
						}}
						totalCount={filteredSpm.length}
					/>
				)}

				{/* Drawer 1: Form Tambah / Ubah Kontrak */}
				<DomainFormDrawer
					isOpen={isContractDrawerOpen}
					title={
						editingContractId ? "Ubah Data Kontrak" : "Tambah Data Kontrak Baru"
					}
					description="Masukkan rincian komitmen kontrak belanja barang / modal / lainnya."
					onClose={() => setIsContractDrawerOpen(false)}
					onSubmit={handleSaveContract}
					isSubmitting={isSubmitting}
				>
					<div className="space-y-4">
						<div className="space-y-1.5">
							<label
								htmlFor="contract-num"
								className="block text-xs font-semibold text-foreground"
							>
								Nomor Kontrak / CAN <span className="text-danger">*</span>
							</label>
							<input
								id="contract-num"
								type="text"
								required
								placeholder="Contoh: KTR-015/SATKER/2026"
								value={contractNum}
								onChange={(e) => setContractNum(e.target.value)}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							/>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<label
									htmlFor="contract-acc"
									className="block text-xs font-semibold text-foreground"
								>
									Akun Belanja <span className="text-danger">*</span>
								</label>
								<select
									id="contract-acc"
									value={contractAccount}
									onChange={(e) =>
										setContractAccount(
											e.target.value as "51" | "52" | "53" | "57",
										)
									}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								>
									{CONTRACT_ACCOUNT_OPTIONS.map((opt) => (
										<option key={opt.code} value={opt.code}>
											{opt.label}
										</option>
									))}
								</select>
							</div>

							<div className="space-y-1.5">
								<label
									htmlFor="contract-val"
									className="block text-xs font-semibold text-foreground"
								>
									Nilai Kontrak (Rp) <span className="text-danger">*</span>
								</label>
								<FormattedNumberInput
									id="contract-val"
									required
									placeholder="Contoh: 150.000.000"
									value={contractValue}
									onChange={setContractValue}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<label
									htmlFor="contract-signed"
									className="block text-xs font-semibold text-foreground"
								>
									Tanggal TTD Kontrak <span className="text-danger">*</span>
								</label>
								<input
									id="contract-signed"
									type="date"
									required
									value={signedDate}
									onChange={(e) => setSignedDate(e.target.value)}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
							</div>

							<div className="space-y-1.5">
								<label
									htmlFor="contract-pay-type"
									className="block text-xs font-semibold text-foreground"
								>
									Tipe Pembayaran <span className="text-danger">*</span>
								</label>
								<select
									id="contract-pay-type"
									value={paymentType}
									onChange={(e) =>
										setPaymentType(
											e.target.value as "sekaligus" | "termin",
										)
									}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								>
									<option value="sekaligus">Sekaligus (100%)</option>
									<option value="termin">Termin / Bertahap</option>
								</select>
							</div>
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="contract-sp2d"
								className="block text-xs font-semibold text-foreground"
							>
								Tanggal SP2D Terbit (Wajib untuk Akselerasi Modal 53)
							</label>
							<input
								id="contract-sp2d"
								type="date"
								value={sp2dDate}
								onChange={(e) => setSp2dDate(e.target.value)}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							/>
						</div>

						{/* Live Preview of Impact in Drawer */}
						<div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2 text-xs">
							<div className="flex items-center gap-1.5 font-semibold text-primary">
								<Sparkles className="size-3.5" />
								<span>Evaluasi Kelayakan Kontrak Ini (Live Preview)</span>
							</div>
							<div className="grid grid-cols-3 gap-2 text-[11px]">
								<div className="rounded-lg bg-background p-2 border border-border">
									<p className="text-muted-foreground text-[10px]">DAK (20%)</p>
									<p className="font-semibold text-foreground mt-0.5">
										{liveDrawerPreview.dakBadge.label}
									</p>
								</div>
								<div className="rounded-lg bg-background p-2 border border-border">
									<p className="text-muted-foreground text-[10px]">KD (40%)</p>
									<p className="font-semibold text-foreground mt-0.5">
										{liveDrawerPreview.kdBadge.label}
									</p>
								</div>
								<div className="rounded-lg bg-background p-2 border border-border">
									<p className="text-muted-foreground text-[10px]">AK53 (40%)</p>
									<p className="font-semibold text-foreground mt-0.5">
										{liveDrawerPreview.ak53Badge.label}
									</p>
								</div>
							</div>
						</div>
					</div>
				</DomainFormDrawer>

				{/* Drawer 2: Form Terbitkan SPM-LS */}
				<DomainFormDrawer
					isOpen={isSpmDrawerOpen}
					title="Catat Penerbitan SPM-LS"
					description="Masukkan data SPM-LS yang diajukan ke KPPN atas penyelesaian BAST."
					onClose={() => setIsSpmDrawerOpen(false)}
					onSubmit={handleCreateSpm}
					isSubmitting={isSubmitting}
				>
					<div className="space-y-4">
						<div className="space-y-1.5">
							<label
								htmlFor="spm-contract-select"
								className="block text-xs font-semibold text-foreground"
							>
								Kontrak Terkait
							</label>
							<select
								id="spm-contract-select"
								value={selectedContractId}
								onChange={(e) => setSelectedContractId(e.target.value)}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							>
								{initialData.contracts.map((c) => (
									<option key={c.id} value={c.id}>
										{c.contractNumber} ({formatRupiah(Number.parseFloat(c.value))})
									</option>
								))}
							</select>
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="spm-ref-num"
								className="block text-xs font-semibold text-foreground"
							>
								Nomor SPM-LS
							</label>
							<input
								id="spm-ref-num"
								type="text"
								required
								placeholder="Contoh: 00012/SPM-LS/411782/2026"
								value={spmRefNum}
								onChange={(e) => setSpmRefNum(e.target.value)}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							/>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<label
									htmlFor="spm-bast-date"
									className="block text-xs font-semibold text-foreground"
								>
									Tanggal BAST / BAPP
								</label>
								<input
									id="spm-bast-date"
									type="date"
									required
									value={bastDate}
									onChange={(e) => setBastDate(e.target.value)}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
							</div>

							<div className="space-y-1.5">
								<label
									htmlFor="spm-kppn-receive"
									className="block text-xs font-semibold text-foreground"
								>
									Diterima di KPPN
								</label>
								<input
									id="spm-kppn-receive"
									type="date"
									required
									value={kppnReceiveDate}
									onChange={(e) => setKppnReceiveDate(e.target.value)}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
							</div>
						</div>

						<div className="flex items-center gap-2 pt-1">
							<input
								id="spm-is-pegawai"
								type="checkbox"
								checked={isPegawai}
								onChange={(e) => setIsPegawai(e.target.checked)}
								disabled={isSubmitting}
								className="size-4 rounded border-border text-primary focus:ring-primary"
							/>
							<label
								htmlFor="spm-is-pegawai"
								className="text-xs text-foreground font-medium cursor-pointer"
							>
								Jenis Belanja Pegawai (Gaji / Tunjangan)
							</label>
						</div>
					</div>
				</DomainFormDrawer>

				{/* Modal: Panduan Rumus Belanja Kontraktual */}
				{isGuideOpen && (
					<div
						className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-xs p-4"
						onClick={() => setIsGuideOpen(false)}
					>
						<div
							className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-xl space-y-4"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="flex items-center justify-between border-b border-border pb-3">
								<div className="flex items-center gap-2">
									<HelpCircle className="size-5 text-primary" />
									<h2 className="text-base font-bold text-foreground">
										Panduan Penilaian Indikator Belanja Kontraktual
									</h2>
								</div>
								<button
									type="button"
									onClick={() => setIsGuideOpen(false)}
									className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground transition"
								>
									<X className="size-4" />
								</button>
							</div>

							<div className="space-y-4 text-xs text-foreground">
								<div className="rounded-xl bg-surface p-3.5 border border-border space-y-1">
									<p className="font-semibold text-primary">
										Dasar Regulasi: PER-5/PB/2024 Pasal 7
									</p>
									<p className="text-muted-foreground text-[11px]">
										Indikator Belanja Kontraktual memiliki bobot 10% terhadap IKPA total, dinilai dari tiga subkomponen:
									</p>
								</div>

								{/* 1. DAK */}
								<div className="rounded-xl border border-border p-3.5 space-y-2">
									<div className="flex items-center justify-between font-bold">
										<span>1. Distribusi Akselerasi Kontrak (DAK) — Bobot 20%</span>
									</div>
									<p className="text-muted-foreground">
										Menilai proporsi jumlah kontrak bernilai ≥ Rp50 juta (semua jenis belanja) yang ditandatangani s.d. 30 Juni (Triwulan II).
									</p>
									<div className="overflow-x-auto">
										<table className="w-full text-[11px] border border-border">
											<thead className="bg-surface">
												<tr>
													<th className="border border-border p-1.5 text-left">
														Rasio DAK
													</th>
													<th className="border border-border p-1.5 text-center">
														Nilai NK-DAK
													</th>
												</tr>
											</thead>
											<tbody>
												<tr>
													<td className="border border-border p-1.5">Rasio = 0%</td>
													<td className="border border-border p-1.5 text-center font-bold">
														0
													</td>
												</tr>
												<tr>
													<td className="border border-border p-1.5">0% &lt; Rasio ≤ 25%</td>
													<td className="border border-border p-1.5 text-center font-bold">
														50
													</td>
												</tr>
												<tr>
													<td className="border border-border p-1.5">25% &lt; Rasio ≤ 50%</td>
													<td className="border border-border p-1.5 text-center font-bold">
														60
													</td>
												</tr>
												<tr>
													<td className="border border-border p-1.5">50% &lt; Rasio ≤ 75%</td>
													<td className="border border-border p-1.5 text-center font-bold">
														80
													</td>
												</tr>
												<tr>
													<td className="border border-border p-1.5">Rasio &gt; 75%</td>
													<td className="border border-border p-1.5 text-center font-bold">
														100
													</td>
												</tr>
											</tbody>
										</table>
									</div>
								</div>

								{/* 2. KD */}
								<div className="rounded-xl border border-border p-3.5 space-y-2">
									<div className="flex items-center justify-between font-bold">
										<span>2. Kontrak Pra-DIPA / Kontrak Dini (KD) — Bobot 40%</span>
									</div>
									<p className="text-muted-foreground">
										Rata-rata poin per kontrak (nilai ≥ Rp50 juta) yang ditandatangani sebelum 1 Jan (120 poin) atau s.d. 31 Maret (110 poin). Kontrak setelah 31 Maret tidak dihitung dalam penyebut rata-rata.
									</p>
								</div>

								{/* 3. AK53 */}
								<div className="rounded-xl border border-border p-3.5 space-y-2">
									<div className="flex items-center justify-between font-bold">
										<span>3. Akselerasi Kontrak 53 (AK53) — Bobot 40%</span>
									</div>
									<p className="text-muted-foreground">
										Hanya menilai kontrak Belanja Modal (Akun 53) bernilai Rp50.000.000 s.d. Rp200.000.000 bertipe pembayaran <strong>sekaligus</strong> (termin dikecualikan), berdasarkan triwulan tanggal SP2D:
									</p>
									<ul className="list-disc list-inside space-y-1 text-muted-foreground text-[11px]">
										<li>Triwulan I (1 Jan–31 Mar): 100 Poin</li>
										<li>Triwulan II (1 Apr–30 Jun): 90 Poin</li>
										<li>Triwulan III (1 Jul–30 Sep): 80 Poin</li>
										<li>Triwulan IV (1 Okt–31 Des): 70 Poin</li>
									</ul>
								</div>
							</div>

							<div className="flex justify-end pt-2 border-t border-border">
								<button
									type="button"
									onClick={() => setIsGuideOpen(false)}
									className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition"
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

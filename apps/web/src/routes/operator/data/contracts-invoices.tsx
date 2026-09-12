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
	FlaskConical,
	HelpCircle,
	Info,
	Pencil,
	Plus,
	Receipt,
	Save,
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
import { useActiveContext } from "@/components/layout/active-context";
import { OperatorShell } from "@/components/layout/operator-shell";
import { SaveScenarioDialog } from "@/components/operator/save-scenario-dialog";
import { WhatIfPanel } from "@/components/operator/what-if-panel";
import { formatRupiah } from "@/lib/format";
import {
	ACCOUNT_LABELS,
	CONTRACT_ACCOUNT_OPTIONS,
	calcKontraktualSummary,
	evaluateSingleContract,
} from "@/lib/simulation/kontraktual-workspace";
import {
	calcTagihanSummary,
	evaluateSingleSpm,
	type SpmEvaluation,
} from "@/lib/simulation/tagihan-workspace";
import {
	addContract,
	addSpmLs,
	editContract,
	editSpmLs,
	fetchContractsAndInvoices,
	removeContract,
	removeSpmLs,
	type ContractRecord,
	type SpmLsRecord,
} from "@/services/contracts-invoices-service";

export const Route = createFileRoute("/operator/data/contracts-invoices")({
	validateSearch: (search: Record<string, unknown>) => ({
		tab:
			search.tab === "invoices" || search.tab === "spm"
				? (search.tab as "invoices" | "spm")
				: ("contracts" as const),
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
	const isTagihanTab = activeTab === "invoices" || activeTab === "spm";

	const [search, setSearch] = useState("");
	const [isContractDrawerOpen, setIsContractDrawerOpen] = useState(false);
	const [isSpmDrawerOpen, setIsSpmDrawerOpen] = useState(false);
	const [isContractGuideOpen, setIsContractGuideOpen] = useState(false);
	const [isTagihanGuideOpen, setIsTagihanGuideOpen] = useState(false);
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

	// SPM Form State (Create / Edit)
	const [editingSpmId, setEditingSpmId] = useState<string | null>(null);
	const [selectedContractId, setSelectedContractId] = useState(
		initialData.contracts[0]?.id ?? "",
	);
	const [spmRefNum, setSpmRefNum] = useState("");
	const [bastDate, setBastDate] = useState(
		new Date().toISOString().slice(0, 10),
	);
	const [kppnReceiveDate, setKppnReceiveDate] = useState("");
	const [isPegawaiSpm, setIsPegawaiSpm] = useState(false);

	// Computed Belanja Kontraktual Summary
	const contractSummary = useMemo(
		() => calcKontraktualSummary(initialData.contracts, initialData.year || 2026),
		[initialData.contracts, initialData.year],
	);

	// Computed Penyelesaian Tagihan Summary
	const tagihanSummary = useMemo(
		() => calcTagihanSummary(initialData.spmLsList, initialData.contracts),
		[initialData.spmLsList, initialData.contracts],
	);

	const activeContext = useActiveContext();
	const activePeriodMonth =
		activeContext?.context.period.kind === "month"
			? activeContext.context.period.value
			: new Date().getMonth() + 1;
	const fiscalYear = initialData.year || 2026;

	// What-If Kontraktual: rencana tambah kontrak (archetype jujur per subkomponen)
	const [simKontrakPraDipa, setSimKontrakPraDipa] = useState("");
	const [simKontrakQ1, setSimKontrakQ1] = useState("");
	const [simKontrakQ2, setSimKontrakQ2] = useState("");
	const [simKontrakH2, setSimKontrakH2] = useState("");
	const [simAk53Tw1, setSimAk53Tw1] = useState("");
	const [simAk53Tw2, setSimAk53Tw2] = useState("");
	const [simAk53Tw3, setSimAk53Tw3] = useState("");
	const [simAk53Tw4, setSimAk53Tw4] = useState("");
	const [isKontrakDialogOpen, setIsKontrakDialogOpen] = useState(false);
	const nPraDipa = Math.max(0, Number.parseInt(simKontrakPraDipa, 10) || 0);
	const nQ1 = Math.max(0, Number.parseInt(simKontrakQ1, 10) || 0);
	const nQ2 = Math.max(0, Number.parseInt(simKontrakQ2, 10) || 0);
	const nH2 = Math.max(0, Number.parseInt(simKontrakH2, 10) || 0);
	const nAk53Tw = [simAk53Tw1, simAk53Tw2, simAk53Tw3, simAk53Tw4].map((v) =>
		Math.max(0, Number.parseInt(v, 10) || 0),
	);
	const hasKontrakPlan =
		nPraDipa + nQ1 + nQ2 + nH2 + nAk53Tw.reduce((a, b) => a + b, 0) > 0;
	const simContracts = useMemo(() => {
		const list = [...initialData.contracts];
		const pushN = (
			n: number,
			rec: Omit<ContractRecord, "id" | "contractNumber">,
			tag: string,
		) => {
			for (let i = 0; i < n; i++) {
				list.push({
					...rec,
					id: `sim-${tag}-${i}`,
					contractNumber: `Rencana ${tag} ${i + 1}`,
				});
			}
		};
		pushN(
			nPraDipa,
			{
				accountCode: "52",
				value: "100000000",
				signedAt: `${fiscalYear - 1}-12-20`,
				paymentType: "sekaligus",
				sp2dAt: null,
			},
			"pra-dipa",
		);
		pushN(
			nQ1,
			{
				accountCode: "52",
				value: "100000000",
				signedAt: `${fiscalYear}-03-10`,
				paymentType: "sekaligus",
				sp2dAt: null,
			},
			"q1",
		);
		pushN(
			nQ2,
			{
				accountCode: "52",
				value: "100000000",
				signedAt: `${fiscalYear}-06-10`,
				paymentType: "sekaligus",
				sp2dAt: null,
			},
			"q2",
		);
		pushN(
			nH2,
			{
				accountCode: "52",
				value: "100000000",
				signedAt: `${fiscalYear}-10-10`,
				paymentType: "sekaligus",
				sp2dAt: null,
			},
			"h2",
		);
		const ak53Sp2d = [
			`${fiscalYear}-02-15`,
			`${fiscalYear}-05-15`,
			`${fiscalYear}-08-15`,
			`${fiscalYear}-11-15`,
		];
		nAk53Tw.forEach((n, idx) => {
			pushN(
				n,
				{
					accountCode: "53",
					value: "100000000",
					signedAt: `${fiscalYear}-01-10`,
					paymentType: "sekaligus",
					sp2dAt: ak53Sp2d[idx] ?? null,
				},
				`ak53-tw${idx + 1}`,
			);
		});
		return list;
	}, [
		initialData.contracts,
		fiscalYear,
		nPraDipa,
		nQ1,
		nQ2,
		nH2,
		nAk53Tw,
	]);
	const simKontrakSummary = useMemo(
		() => calcKontraktualSummary(simContracts, fiscalYear),
		[simContracts, fiscalYear],
	);
	const kontrakSimScore = simKontrakSummary.final.score;
	const kontrakSimDelta =
		hasKontrakPlan &&
		kontrakSimScore !== null &&
		contractSummary.final.score !== null
			? Number(kontrakSimScore) - Number(contractSummary.final.score)
			: null;
	const kontrakSummaries = useMemo(() => {
		const rows = [
			{
				label: "Pra-DIPA (40%)",
				originalValue: contractSummary.kd.score ?? "—",
				newValue: simKontrakSummary.kd.score ?? "—",
			},
			{
				label: "AK53 (40%)",
				originalValue: contractSummary.ak53.score ?? "—",
				newValue: simKontrakSummary.ak53.score ?? "—",
			},
			{
				label: "Distribusi A.K. (20%)",
				originalValue: contractSummary.dak.score ?? "—",
				newValue: simKontrakSummary.dak.score ?? "—",
			},
			{
				label: "Nilai IKPA Kontraktual",
				originalValue: contractSummary.final.score ?? "—",
				newValue: simKontrakSummary.final.score ?? "—",
			},
		];
		return rows;
	}, [contractSummary, simKontrakSummary]);

	// What-If Tagihan: rencana SPM tepat waktu vs terlambat
	const [simTepat, setSimTepat] = useState("");
	const [simTerlambat, setSimTerlambat] = useState("");
	const [isTagihanDialogOpen, setIsTagihanDialogOpen] = useState(false);
	const nTepat = Math.max(0, Number.parseInt(simTepat, 10) || 0);
	const nTerlambat = Math.max(0, Number.parseInt(simTerlambat, 10) || 0);
	const hasTagihanPlan = nTepat + nTerlambat > 0;
	const tagihanSimScore =
		hasTagihanPlan && tagihanSummary.completedCount + nTepat + nTerlambat > 0
			? ((tagihanSummary.onTimeCount + nTepat) /
					(tagihanSummary.completedCount + nTepat + nTerlambat)) *
				100
			: null;
	const tagihanSimDelta =
		tagihanSimScore !== null && tagihanSummary.score !== null
			? tagihanSimScore - Number(tagihanSummary.score)
			: null;
	const tagihanSummaries = useMemo(
		() => [
			{
				label: `SPM tepat waktu (${tagihanSummary.onTimeCount} → ${tagihanSummary.onTimeCount + nTepat})`,
				originalValue: `${tagihanSummary.onTimeCount} berkas`,
				newValue: `${tagihanSummary.onTimeCount + nTepat} berkas`,
			},
			{
				label: "Nilai IKPA Tagihan",
				originalValue: tagihanSummary.score ?? "—",
				newValue:
					tagihanSimScore !== null ? tagihanSimScore.toFixed(2) : "—",
			},
		],
		[tagihanSummary, nTepat, tagihanSimScore],
	);

	// Live preview of candidate contract in drawer
	const liveContractDrawerPreview = useMemo(() => {
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

	// Live preview of candidate SPM in drawer
	const liveSpmDrawerPreview = useMemo(() => {
		const candidateSpm: SpmLsRecord = {
			id: editingSpmId || "preview",
			contractId: selectedContractId,
			referenceNumber: spmRefNum || "Draft SPM-LS",
			bastBappDate: bastDate,
			receivedAtKppn: kppnReceiveDate.trim() ? kppnReceiveDate : null,
			isPegawai: isPegawaiSpm,
		};
		return evaluateSingleSpm(candidateSpm, initialData.contracts);
	}, [
		editingSpmId,
		selectedContractId,
		spmRefNum,
		bastDate,
		kppnReceiveDate,
		isPegawaiSpm,
		initialData.contracts,
	]);

	const handleTabChange = (newTab: "contracts" | "invoices") => {
		navigate({
			to: "/operator/data/contracts-invoices",
			search: (prev) => ({
				tab: newTab,
				org: prev.org,
			}),
		});
	};

	// Contract Handlers
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

	// SPM Handlers
	const handleOpenCreateSpm = () => {
		if (initialData.contracts.length === 0) {
			alert("Daftarkan minimal satu kontrak terlebih dahulu sebelum mencatat SPM-LS.");
			return;
		}
		setEditingSpmId(null);
		setSelectedContractId(initialData.contracts[0]?.id ?? "");
		setSpmRefNum("");
		setBastDate(new Date().toISOString().slice(0, 10));
		setKppnReceiveDate("");
		setIsPegawaiSpm(false);
		setErrorMessage(null);
		setIsSpmDrawerOpen(true);
	};

	const handleOpenEditSpm = (spm: SpmLsRecord) => {
		setEditingSpmId(spm.id);
		setSelectedContractId(spm.contractId);
		setSpmRefNum(spm.referenceNumber);
		setBastDate(spm.bastBappDate);
		setKppnReceiveDate(spm.receivedAtKppn || "");
		setIsPegawaiSpm(spm.isPegawai);
		setErrorMessage(null);
		setIsSpmDrawerOpen(true);
	};

	const handleSaveSpm = async () => {
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
		if (!bastDate) {
			setErrorMessage("Tanggal BAST/BAPP wajib diisi.");
			return;
		}
		if (kppnReceiveDate && kppnReceiveDate < bastDate) {
			setErrorMessage(
				"Tanggal konversi KPPN tidak boleh lebih awal dari tanggal BAST/BAPP.",
			);
			return;
		}

		setIsSubmitting(true);
		try {
			if (editingSpmId) {
				await editSpmLs({
					spmId: editingSpmId,
					contractId: selectedContractId,
					referenceNumber: spmRefNum.trim(),
					bastBappDate: bastDate,
					receivedAtKppn: kppnReceiveDate.trim() ? kppnReceiveDate : null,
					isPegawai: isPegawaiSpm,
				});
				setActionMessage("Data SPM-LS berhasil diperbarui.");
			} else {
				await addSpmLs({
					contractId: selectedContractId,
					referenceNumber: spmRefNum.trim(),
					bastBappDate: bastDate,
					receivedAtKppn: kppnReceiveDate.trim() ? kppnReceiveDate : null,
					isPegawai: isPegawaiSpm,
				});
				setActionMessage("Penerbitan SPM-LS berhasil dicatat.");
			}

			setIsSpmDrawerOpen(false);
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal menyimpan SPM-LS.",
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

	const filteredSpmEvaluations = tagihanSummary.evaluations.filter(
		(e) =>
			e.referenceNumber.toLowerCase().includes(search.toLowerCase()) ||
			e.contractNumber.toLowerCase().includes(search.toLowerCase()),
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
			header: "Tanggal TTD & Pra-DIPA",
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
							setEditingSpmId(null);
							setSpmRefNum("");
							setBastDate(new Date().toISOString().slice(0, 10));
							setKppnReceiveDate("");
							setIsPegawaiSpm(false);
							setErrorMessage(null);
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

	const spmColumns: ColumnDef<SpmEvaluation>[] = [
		{
			key: "ref",
			header: "Nomor SPM-LS & Kategori",
			render: (item) => (
				<div className="space-y-0.5">
					<span className="font-semibold text-foreground">
						{item.referenceNumber}
					</span>
					<div>
						<span
							className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
								item.isPegawai
									? "bg-surface-muted text-muted-foreground border border-border"
									: "bg-primary/10 text-primary border border-primary/20"
							}`}
						>
							{item.isPegawai ? "Belanja Pegawai (Dikecualikan)" : "Non-Pegawai / Rekanan"}
						</span>
					</div>
				</div>
			),
		},
		{
			key: "contract",
			header: "Kontrak Terkait",
			render: (item) => (
				<div className="space-y-0.5">
					<span className="text-xs font-semibold text-foreground">
						{item.contractNumber}
					</span>
					<div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
						<span className="font-mono text-[10px]">Akun {item.accountCode}</span>
						<span>·</span>
						<span>{formatRupiah(Number.parseFloat(item.contractValue))}</span>
					</div>
				</div>
			),
		},
		{
			key: "bast",
			header: "Tanggal BAST/BAPP",
			render: (item) => (
				<span className="inline-flex items-center gap-1.5 text-xs text-foreground font-medium">
					<Calendar className="size-3.5 text-muted-foreground" />
					<span>{item.bastBappDate || "—"}</span>
				</span>
			),
		},
		{
			key: "received",
			header: "Konversi KPPN",
			render: (item) => (
				<div className="space-y-0.5">
					{item.receivedAtKppn ? (
						<span className="inline-flex items-center gap-1.5 text-xs text-foreground font-medium">
							<Clock className="size-3.5 text-muted-foreground" />
							<span>{item.receivedAtKppn}</span>
						</span>
					) : (
						<span className="rounded bg-warning/10 border border-warning/20 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
							Belum Dikonversi
						</span>
					)}
				</div>
			),
		},
		{
			key: "deadline",
			header: "Deadline H+17",
			render: (item) => (
				<div className="space-y-0.5">
					<span className="text-xs font-mono font-medium text-foreground">
						{item.deadlineH17}
					</span>
					<p className="text-[10px] text-muted-foreground">
						{item.workdaysElapsed !== null
							? `${item.workdaysElapsed} HK berlalu`
							: item.daysRemaining !== null
								? item.daysRemaining >= 0
									? `Sisa ${item.daysRemaining} HK`
									: `${Math.abs(item.daysRemaining)} HK lewat`
								: "—"}
					</p>
				</div>
			),
		},
		{
			key: "status",
			header: "Status & Dampak Nilai",
			render: (item) => (
				<div className="space-y-1">
					<span
						className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold ${
							item.badge.variant === "success"
								? "bg-success/10 text-success border border-success/20"
								: item.badge.variant === "warning"
									? "bg-warning/10 text-warning border border-warning/20"
									: item.badge.variant === "danger"
										? "bg-danger/10 text-danger border border-danger/20"
										: item.badge.variant === "info"
											? "bg-primary/10 text-primary border border-primary/20"
											: "bg-surface text-muted-foreground border border-border"
						}`}
					>
						{item.badge.label}
					</span>
					<p className="text-[10px] text-muted-foreground">{item.impact}</p>
				</div>
			),
		},
		{
			key: "actions",
			header: "Aksi",
			render: (item) => {
				const originalRow = initialData.spmLsList.find(
					(s) => s.id === item.spmId,
				);
				return (
					<div className="flex items-center gap-1.5">
						{originalRow && (
							<button
								type="button"
								onClick={() => handleOpenEditSpm(originalRow)}
								className="inline-flex items-center rounded-lg p-1.5 text-primary hover:bg-primary/10 transition"
								title="Ubah Data SPM-LS"
							>
								<Pencil className="size-3.5" />
							</button>
						)}
						<button
							type="button"
							onClick={() => handleDeleteSpm(item.spmId)}
							className="inline-flex items-center rounded-lg p-1.5 text-danger hover:bg-danger/10 transition"
							title="Hapus SPM-LS"
						>
							<Trash2 className="size-3.5" />
						</button>
					</div>
				);
			},
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
							{!isTagihanTab ? (
								<FileSignature className="size-5" />
							) : (
								<Receipt className="size-5" />
							)}
						</div>
						<div>
							<div className="flex items-center gap-2">
								<h1 className="text-lg font-bold text-foreground sm:text-xl">
									{!isTagihanTab
										? "Indikator Belanja Kontraktual"
										: "Indikator Penyelesaian Tagihan (SPM-LS)"}
								</h1>
								<span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
									Bobot 10%
								</span>
							</div>
							<p className="text-xs text-muted-foreground">
								{!isTagihanTab
									? "Pantau akselerasi kontrak melalui Pra-DIPA (40%), Akselerasi Belanja Modal 53 (40%), dan Distribusi A.K. (20%)."
									: "Pantau kepatuhan penyelesaian tagihan SPM-LS maksimal 17 hari kerja sejak tanggal BAST/BAPP hingga konversi KPPN (khusus SPM non-belanja pegawai)."}
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						{!isTagihanTab && (
							<>
								<button
									type="button"
									onClick={handleOpenCreateContract}
									className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90"
								>
									<Plus className="size-3.5" />
									<span>Tambah Kontrak</span>
								</button>
								<button
									type="button"
									onClick={() => setIsContractGuideOpen(true)}
									className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground shadow-xs transition hover:bg-surface-muted"
								>
									<HelpCircle className="size-3.5 text-primary" />
									<span>Panduan Rumus</span>
								</button>
							</>
						)}

						{isTagihanTab && (
							<>
								<button
									type="button"
									onClick={handleOpenCreateSpm}
									className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90"
								>
									<Plus className="size-3.5" />
									<span>Catat SPM-LS</span>
								</button>
								<button
									type="button"
									onClick={() => setIsTagihanGuideOpen(true)}
									className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground shadow-xs transition hover:bg-surface-muted"
								>
									<HelpCircle className="size-3.5 text-primary" />
									<span>Panduan Rumus</span>
								</button>
							</>
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

				{/* 5-Card Score Grid for Belanja Kontraktual */}
				{/* 5-Card Score Grid for Belanja Kontraktual */}
				{!isTagihanTab && (
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
						{/* Card 1: Pra DIPA (40%) */}
						<div className="rounded-xl border border-border bg-background p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-semibold truncate">
									Pra DIPA (40%)
								</span>
								<Calendar className="size-4 text-primary shrink-0" />
							</div>
							<div className="space-y-0.5 mt-auto">
								<div className="flex items-baseline gap-1.5 min-h-[32px] sm:min-h-[36px]">
									<p className="text-2xl font-bold text-foreground sm:text-3xl leading-none">
										{contractSummary.kd.score !== null ? Number(contractSummary.kd.score).toFixed(2) : "—"}
									</p>
									<span className="text-[11px] font-semibold text-muted-foreground truncate">
										{contractSummary.kd.denominatorCount} Kontrak
									</span>
								</div>
								<p className="text-[11px] text-muted-foreground truncate" title={`${contractSummary.kd.praDipaCount} Pra-DIPA · ${contractSummary.kd.q1Count} TW I`}>
									{contractSummary.kd.praDipaCount} Pra-DIPA · {contractSummary.kd.q1Count} TW I
								</p>
							</div>
						</div>

						{/* Card 2: Akselerasi 53 (40%) */}
						<div className="rounded-xl border border-border bg-background p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-semibold truncate">
									Akselerasi 53 (40%)
								</span>
								<Clock className="size-4 text-primary shrink-0" />
							</div>
							<div className="space-y-0.5 mt-auto">
								<div className="flex items-baseline gap-1.5 min-h-[32px] sm:min-h-[36px]">
									<p className="text-2xl font-bold text-foreground sm:text-3xl leading-none">
										{contractSummary.ak53.score !== null ? Number(contractSummary.ak53.score).toFixed(2) : "—"}
									</p>
									<span className="text-[11px] font-semibold text-muted-foreground truncate">
										{contractSummary.ak53.completedCount} Selesai
									</span>
								</div>
								<p className="text-[11px] text-muted-foreground truncate" title={`${contractSummary.ak53.tw1Count} TW I · ${contractSummary.ak53.tw2Count} TW II`}>
									{contractSummary.ak53.tw1Count} TW I · {contractSummary.ak53.tw2Count} TW II
								</p>
							</div>
						</div>

						{/* Card 3: Distribusi A.K. (20%) */}
						<div className="rounded-xl border border-border bg-background p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-semibold truncate">
									Distribusi A.K. (20%)
								</span>
								<TrendingUp className="size-4 text-primary shrink-0" />
							</div>
							<div className="space-y-0.5 mt-auto">
								<div className="flex items-baseline gap-1.5 min-h-[32px] sm:min-h-[36px]">
									<p className="text-2xl font-bold text-foreground sm:text-3xl leading-none">
										{contractSummary.dak.score !== null ? Number(contractSummary.dak.score).toFixed(2) : "—"}
									</p>
									<span className="text-[11px] font-semibold text-primary truncate">
										Rasio {contractSummary.dak.ratio.toFixed(1)}%
									</span>
								</div>
								<p className="text-[11px] text-muted-foreground truncate" title={`${contractSummary.dak.countQ2} dari ${contractSummary.dak.totalEligible} kontrak TW II`}>
									{contractSummary.dak.countQ2} dari {contractSummary.dak.totalEligible} kontrak TW II
								</p>
							</div>
						</div>

						{/* Card 4 (2 paling kanan): Nilai IKPA Belanja Kontraktual */}
						<div className="rounded-xl border border-primary/20 bg-background p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-semibold text-foreground truncate">
									Nilai IKPA Kontraktual
								</span>
								<ShieldCheck className="size-4 text-primary shrink-0" />
							</div>
							<div className="space-y-0.5 mt-auto">
								<div className="flex items-baseline gap-1.5 min-h-[32px] sm:min-h-[36px]">
									<p className="text-2xl font-extrabold text-primary sm:text-3xl leading-none">
										{contractSummary.final.score !== null &&
										contractSummary.final.score !== undefined
											? Math.min(
													100,
													Math.max(0, Number(contractSummary.final.score)),
												).toFixed(2)
											: "—"}
									</p>
								</div>
								<p className="text-[11px] text-muted-foreground truncate" title="Skor komposit 3 subkomponen">
									Skor komposit 3 subkomponen
								</p>
							</div>
						</div>

						{/* Card 5 (paling kanan): Nilai Akhir (10%) */}
						<div className="rounded-xl border border-success/20 bg-success/5 p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-semibold text-success truncate">
									Nilai Akhir (10%)
								</span>
								<Sparkles className="size-4 text-success shrink-0" />
							</div>
							<div className="space-y-0.5 mt-auto">
								<div className="flex items-baseline gap-1.5 min-h-[32px] sm:min-h-[36px]">
									<p className="text-2xl font-extrabold text-success sm:text-3xl leading-none">
										{contractSummary.final.weightedContribution
											? `${Math.min(
													10,
													Math.max(
														0,
														Number(contractSummary.final.weightedContribution),
													),
												).toFixed(2)} pts`
											: "—"}
									</p>
								</div>
								<p className="text-[11px] text-muted-foreground truncate" title="Bobot 10% terhadap total IKPA">
									Bobot 10% terhadap total IKPA
								</p>
							</div>
						</div>
					</div>
				)}

				{/* What-If Simulation: Rencana Tambah Kontrak */}
				{!isTagihanTab && (
					<WhatIfPanel
						storageKey="ikpa-whatif-kontrak"
						title="Simulasi What-If Rencana Kontrak"
						description="Tambah rencana kontrak (≥ Rp50 juta) per pola waktu — skor Pra-DIPA/AK53/Distribusi A.K. dihitung ulang dengan rumus engine resmi, tanpa mengubah data aktual."
						action={
							<button
								type="button"
								disabled={!hasKontrakPlan || kontrakSimScore === null}
								onClick={() => setIsKontrakDialogOpen(true)}
								title={
									!hasKontrakPlan
										? "Isi minimal satu rencana kontrak agar skenario dapat disimpan"
										: kontrakSimScore === null
											? "Rencana belum menghasilkan skor (lengkapi pola kontrak)"
											: "Simpan ke Skenario A, B, atau C"
								}
								className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-amber-700 disabled:opacity-50"
							>
								<Save className="size-3.5" />
								<span>Simpan Skenario (A/B/C)</span>
							</button>
						}
					>

						<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
							{[
								{
									id: "sim-k-pra",
									label: "Pra-DIPA (120 pts)",
									hint: "Distribusi A.K. ✓ · Pra-DIPA 120",
									value: simKontrakPraDipa,
									setter: setSimKontrakPraDipa,
								},
								{
									id: "sim-k-q1",
									label: "Ttd s.d. 31 Mar (110)",
									hint: "Distribusi A.K. ✓ · Pra-DIPA 110",
									value: simKontrakQ1,
									setter: setSimKontrakQ1,
								},
								{
									id: "sim-k-q2",
									label: "Ttd Apr–Jun",
									hint: "Distribusi A.K. ✓ · Pra-DIPA —",
									value: simKontrakQ2,
									setter: setSimKontrakQ2,
								},
								{
									id: "sim-k-h2",
									label: "Ttd Jul–Des",
									hint: "Distribusi A.K. penyebut · Pra-DIPA —",
									value: simKontrakH2,
									setter: setSimKontrakH2,
								},
							].map((f) => (
								<div
									key={f.id}
									className="rounded-xl border border-amber-200/80 bg-background p-3 space-y-1.5"
								>
									<label
										htmlFor={f.id}
										className="block text-xs font-semibold text-foreground"
									>
										{f.label}
									</label>
									<input
										id={f.id}
										type="number"
										min="0"
										value={f.value}
										onChange={(e) => f.setter(e.target.value)}
										placeholder="0"
										className="w-full rounded-lg border border-amber-300 bg-amber-50/70 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 px-2.5 py-1.5 text-xs font-mono text-amber-950 placeholder:text-amber-300 transition-all"
									/>
									<p className="text-[10px] text-muted-foreground">{f.hint}</p>
								</div>
							))}
						</div>

						<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
							{[
								{ id: "sim-ak53-1", label: "53 Selesai TW I (100)", value: simAk53Tw1, setter: setSimAk53Tw1 },
								{ id: "sim-ak53-2", label: "53 Selesai TW II (90)", value: simAk53Tw2, setter: setSimAk53Tw2 },
								{ id: "sim-ak53-3", label: "53 Selesai TW III (80)", value: simAk53Tw3, setter: setSimAk53Tw3 },
								{ id: "sim-ak53-4", label: "53 Selesai TW IV (70)", value: simAk53Tw4, setter: setSimAk53Tw4 },
							].map((f) => (
								<div
									key={f.id}
									className="rounded-xl border border-amber-200/80 bg-background p-3 space-y-1.5"
								>
									<label
										htmlFor={f.id}
										className="block text-xs font-semibold text-foreground"
									>
										{f.label}
									</label>
									<input
										id={f.id}
										type="number"
										min="0"
										value={f.value}
										onChange={(e) => f.setter(e.target.value)}
										placeholder="0"
										className="w-full rounded-lg border border-amber-300 bg-amber-50/70 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 px-2.5 py-1.5 text-xs font-mono text-amber-950 placeholder:text-amber-300 transition-all"
									/>
									<p className="text-[10px] text-muted-foreground">
										Akun 53 · Rp50–200jt · sekaligus · ada SP2D
									</p>
								</div>
							))}
						</div>

						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-1">
								<span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
									<FlaskConical className="size-3.5 text-amber-600" />
									<span>Skor Simulasi Kontraktual</span>
								</span>
								<p className="text-2xl font-extrabold text-amber-700">
									{hasKontrakPlan && kontrakSimScore !== null
										? Number(kontrakSimScore).toFixed(2)
										: "—"}
								</p>
								<p className="text-[11px] text-muted-foreground">
									Pra-DIPA {simKontrakSummary.kd.score ?? "—"} · AK53{" "}
									{simKontrakSummary.ak53.score ?? "—"} · Distribusi A.K.{" "}
									{simKontrakSummary.dak.score ?? "—"} · Aktual{" "}
									{contractSummary.final.score ?? "—"}
								</p>
							</div>
							<div className="rounded-xl border border-border bg-background p-3.5 space-y-1">
								<span className="text-xs font-semibold text-muted-foreground">
									Dampak Rencana (Δ)
								</span>
								<p
									className={`text-2xl font-bold ${
										kontrakSimDelta === null
											? "text-muted-foreground"
											: kontrakSimDelta > 0
												? "text-success"
												: kontrakSimDelta < 0
													? "text-danger"
													: "text-muted-foreground"
									}`}
								>
									{kontrakSimDelta !== null
										? `${kontrakSimDelta > 0 ? "+" : ""}${kontrakSimDelta.toFixed(2)}`
										: "—"}
								</p>
								<p className="text-[11px] text-muted-foreground">
									{kontrakSimDelta === null
										? "Belum ada rencana"
										: "Selisih terhadap nilai akhir aktual"}
								</p>
							</div>
						</div>
					</WhatIfPanel>
				)}

				{/* 5-Card Score Grid for Penyelesaian Tagihan (SPM-LS) */}
				{isTagihanTab && (
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
						{/* Card 1: SPM Tepat Waktu */}
						<div className="rounded-xl border border-border bg-background p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-semibold truncate">
									SPM Tepat Waktu
								</span>
								<CheckCircle2 className="size-4 text-success shrink-0" />
							</div>
							<div className="space-y-0.5 mt-auto">
								<div className="flex items-baseline gap-1.5 min-h-[32px] sm:min-h-[36px]">
									<p className="text-2xl font-bold text-foreground sm:text-3xl leading-none">
										{tagihanSummary.onTimeCount}
									</p>
									<span className="text-[11px] font-semibold text-muted-foreground truncate">
										/ {tagihanSummary.eligibleCount} Eligible
									</span>
								</div>
								<p className="text-[11px] text-muted-foreground truncate" title="Maks. 17 HK sejak BAST/BAPP">
									Maks. 17 HK sejak BAST/BAPP
								</p>
							</div>
						</div>

						{/* Card 2: SPM Terlambat */}
						<div className="rounded-xl border border-border bg-background p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-semibold truncate">
									SPM Terlambat
								</span>
								<Clock className="size-4 text-danger shrink-0" />
							</div>
							<div className="space-y-0.5 mt-auto">
								<div className="flex items-baseline gap-1.5 min-h-[32px] sm:min-h-[36px]">
									<p className="text-2xl font-bold text-danger sm:text-3xl leading-none">
										{tagihanSummary.lateCount}
									</p>
									<span className="text-[11px] font-semibold text-muted-foreground truncate">
										Berkas
									</span>
								</div>
								<p className="text-[11px] text-muted-foreground truncate" title={tagihanSummary.lateCount > 0 ? "Mengurangi persentase skor" : "Nihil berkas terlambat"}>
									{tagihanSummary.lateCount > 0
										? "Mengurangi persentase skor"
										: "Nihil berkas terlambat"}
								</p>
							</div>
						</div>

						{/* Card 3: Menunggu Konversi */}
						<div className="rounded-xl border border-border bg-background p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-semibold truncate">
									Menunggu Konversi
								</span>
								<TrendingUp className="size-4 text-primary shrink-0" />
							</div>
							<div className="space-y-0.5 mt-auto">
								<div className="flex items-baseline gap-1.5 min-h-[32px] sm:min-h-[36px]">
									<p className="text-2xl font-bold text-foreground sm:text-3xl leading-none">
										{tagihanSummary.pendingCount}
									</p>
									<span className="text-[11px] font-semibold text-muted-foreground truncate">
										{tagihanSummary.riskyCount > 0
											? `${tagihanSummary.riskyCount} Berisiko`
											: "Proses"}
									</span>
								</div>
								<p className="text-[11px] text-muted-foreground truncate" title={tagihanSummary.pegawaiCount > 0 ? `+${tagihanSummary.pegawaiCount} Belanja Pegawai (Dikecualikan)` : "Belum masuk penilaian final"}>
									{tagihanSummary.pegawaiCount > 0
										? `+${tagihanSummary.pegawaiCount} Belanja Pegawai (Dikecualikan)`
										: "Belum masuk penilaian final"}
								</p>
							</div>
						</div>

						{/* Card 4 (2 paling kanan): Nilai IKPA Tagihan */}
						<div className="rounded-xl border border-primary/20 bg-background p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-semibold text-foreground truncate">
									Nilai IKPA Tagihan
								</span>
								<ShieldCheck className="size-4 text-primary shrink-0" />
							</div>
							<div className="space-y-0.5 mt-auto">
								<div className="flex items-baseline gap-1.5 min-h-[32px] sm:min-h-[36px]">
									<p className="text-2xl font-extrabold text-primary sm:text-3xl leading-none">
										{tagihanSummary.score !== null &&
										tagihanSummary.score !== undefined
											? Math.min(
													100,
													Math.max(0, Number(tagihanSummary.score)),
												).toFixed(2)
											: "—"}
									</p>
								</div>
								<p className="text-[11px] text-muted-foreground truncate" title="(SPM Tepat Waktu ÷ Total Eligible) × 100">
									(SPM Tepat Waktu ÷ Total Eligible) × 100
								</p>
							</div>
						</div>

						{/* Card 5 (paling kanan): Nilai Akhir (10%) */}
						<div className="rounded-xl border border-success/20 bg-success/5 p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
							<div className="flex items-center justify-between text-muted-foreground">
								<span className="text-xs font-semibold text-success truncate">
									Nilai Akhir (10%)
								</span>
								<Sparkles className="size-4 text-success shrink-0" />
							</div>
							<div className="space-y-0.5 mt-auto">
								<div className="flex items-baseline gap-1.5 min-h-[32px] sm:min-h-[36px]">
									<p className="text-2xl font-extrabold text-success sm:text-3xl leading-none">
										{tagihanSummary.weightedContribution
											? `${Math.min(
													10,
													Math.max(
														0,
														Number(tagihanSummary.weightedContribution),
													),
												).toFixed(2)} pts`
											: "—"}
									</p>
								</div>
								<p className="text-[11px] text-muted-foreground truncate" title="Bobot 10% terhadap total IKPA">
									Bobot 10% terhadap total IKPA
								</p>
							</div>
						</div>
					</div>
				)}

				{/* What-If Simulation: Rencana Penyelesaian SPM-LS */}
				{isTagihanTab && (
					<WhatIfPanel
						storageKey="ikpa-whatif-tagihan"
						title="Simulasi What-If Rencana Tagihan"
						description="Tambah rencana SPM tepat waktu (≤ 17 HK) vs terlambat — tanpa mengubah data aktual."
						action={
							<button
								type="button"
								disabled={!hasTagihanPlan || tagihanSimScore === null}
								onClick={() => setIsTagihanDialogOpen(true)}
								title={
									!hasTagihanPlan
										? "Isi minimal satu rencana SPM agar skenario dapat disimpan"
										: "Simpan ke Skenario A, B, atau C"
								}
								className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-amber-700 disabled:opacity-50"
							>
								<Save className="size-3.5" />
								<span>Simpan Skenario (A/B/C)</span>
							</button>
						}
					>

						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
							<div className="rounded-xl border border-amber-200/80 bg-background p-3.5 space-y-1.5">
								<label
									htmlFor="sim-spm-tepat"
									className="block text-xs font-semibold text-foreground"
								>
									Rencana SPM Tepat Waktu
								</label>
								<input
									id="sim-spm-tepat"
									type="number"
									min="0"
									value={simTepat}
									onChange={(e) => setSimTepat(e.target.value)}
									placeholder="0"
									className="w-full rounded-lg border border-amber-300 bg-amber-50/70 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 px-2.5 py-1.5 text-xs font-mono text-amber-950 placeholder:text-amber-300 transition-all"
								/>
								<p className="text-[11px] text-muted-foreground">
									Aktual tepat: {tagihanSummary.onTimeCount} berkas
								</p>
							</div>
							<div className="rounded-xl border border-amber-200/80 bg-background p-3.5 space-y-1.5">
								<label
									htmlFor="sim-spm-terlambat"
									className="block text-xs font-semibold text-foreground"
								>
									Rencana SPM Terlambat
								</label>
								<input
									id="sim-spm-terlambat"
									type="number"
									min="0"
									value={simTerlambat}
									onChange={(e) => setSimTerlambat(e.target.value)}
									placeholder="0"
									className="w-full rounded-lg border border-amber-300 bg-amber-50/70 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 px-2.5 py-1.5 text-xs font-mono text-amber-950 placeholder:text-amber-300 transition-all"
								/>
								<p className="text-[11px] text-muted-foreground">
									Aktual terlambat: {tagihanSummary.lateCount} berkas
								</p>
							</div>
							<div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-1">
								<span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
									<FlaskConical className="size-3.5 text-amber-600" />
									<span>Skor Simulasi</span>
								</span>
								<p className="text-2xl font-extrabold text-amber-700">
									{tagihanSimScore !== null
										? tagihanSimScore.toFixed(2)
										: "—"}
								</p>
								<p className="text-[11px] text-muted-foreground">
									(Tepat ÷ Eligible) × 100 · Aktual{" "}
									{tagihanSummary.score ?? "—"}
								</p>
							</div>
							<div className="rounded-xl border border-border bg-background p-3.5 space-y-1">
								<span className="text-xs font-semibold text-muted-foreground">
									Dampak Rencana (Δ)
								</span>
								<p
									className={`text-2xl font-bold ${
										tagihanSimDelta === null
											? "text-muted-foreground"
											: tagihanSimDelta > 0
												? "text-success"
												: tagihanSimDelta < 0
													? "text-danger"
													: "text-muted-foreground"
									}`}
								>
									{tagihanSimDelta !== null
										? `${tagihanSimDelta > 0 ? "+" : ""}${tagihanSimDelta.toFixed(2)}`
										: "—"}
								</p>
								<p className="text-[11px] text-muted-foreground">
									{tagihanSimDelta === null
										? "Belum ada rencana"
										: "Selisih terhadap nilai akhir aktual"}
								</p>
							</div>
						</div>
					</WhatIfPanel>
				)}

				{/* Accordion: Trace & Detail Perhitungan Belanja Kontraktual */}
				{!isTagihanTab && (
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
									{/* 1. Pra-DIPA Step */}
									<div className="rounded-xl border border-border bg-background p-3.5 space-y-2">
										<div className="flex items-center justify-between font-semibold text-foreground">
											<span>1. Pra-DIPA (Bobot 40%)</span>
											<span className="text-primary font-bold">
												Skor: {contractSummary.kd.score ?? "—"}
											</span>
										</div>
										<p className="text-muted-foreground text-[11px]">
											Rata-rata poin kontrak Pra-DIPA (120) dan 1 Jan–31 Mar (110) per kontrak. Kontrak setelah 31 Mar tidak masuk penyebut.
										</p>
										<div className="rounded-lg bg-surface p-2.5 font-mono text-[11px] space-y-1 text-foreground">
											<p>
												Pra-DIPA: {contractSummary.kd.praDipaCount} × 120 ={" "}
												{contractSummary.kd.praDipaCount * 120}
											</p>
											<p>
												TW I: {contractSummary.kd.q1Count} × 110 ={" "}
												{contractSummary.kd.q1Count * 110}
											</p>
											<p>
												Rata-rata: {contractSummary.kd.totalPoints} ÷ {contractSummary.kd.denominatorCount} ={" "}
												<span className="font-bold text-primary">
													{contractSummary.kd.score ?? "—"}
												</span>
											</p>
										</div>
										<p className="text-[11px] text-muted-foreground">
											Kontribusi = {contractSummary.kd.score ?? 0} × 40% ={" "}
											<span className="font-semibold text-foreground">
												{contractSummary.kd.weightedContribution ?? 0}
											</span>
										</p>
									</div>

									{/* 2. AK53 Step */}
									<div className="rounded-xl border border-border bg-background p-3.5 space-y-2">
										<div className="flex items-center justify-between font-semibold text-foreground">
											<span>2. AK53 (Bobot 40%)</span>
											<span className="text-primary font-bold">
												Skor: {contractSummary.ak53.score ?? "—"}
											</span>
										</div>
										<p className="text-muted-foreground text-[11px]">
											Rata-rata poin kontrak akun 53 (Rp50–200jt, sekaligus) berdasarkan triwulan terbit SP2D (TW I: 100, TW II: 90, TW III: 80, TW IV: 70).
										</p>
										<div className="rounded-lg bg-surface p-2.5 font-mono text-[11px] space-y-1 text-foreground">
											<p>
												Selesai TW I: {contractSummary.ak53.tw1Count} × 100 | TW II: {contractSummary.ak53.tw2Count} × 90
											</p>
											<p>
												Selesai TW III: {contractSummary.ak53.tw3Count} × 80 | TW IV: {contractSummary.ak53.tw4Count} × 70
											</p>
											<p>
												Rata-rata ={" "}
												<span className="font-bold text-primary">
													{contractSummary.ak53.score ?? "—"}
												</span>
											</p>
										</div>
										<p className="text-[11px] text-muted-foreground">
											Kontribusi = {contractSummary.ak53.score ?? 0} × 40% ={" "}
											<span className="font-semibold text-foreground">
												{contractSummary.ak53.weightedContribution ?? 0}
											</span>
										</p>
									</div>

									{/* 3. Distribusi A.K. Step */}
									<div className="rounded-xl border border-border bg-background p-3.5 space-y-2">
										<div className="flex items-center justify-between font-semibold text-foreground">
											<span>3. Distribusi A.K. (Bobot 20%)</span>
											<span className="text-primary font-bold">
												Skor: {contractSummary.dak.score ?? "—"}
											</span>
										</div>
										<p className="text-muted-foreground text-[11px]">
											Rasio = (Kontrak ≥ Rp50jt s.d. 30 Juni) ÷ (Total Kontrak Eligible TA) × 100%
										</p>
										<div className="rounded-lg bg-surface p-2.5 font-mono text-[11px] space-y-1 text-foreground">
											<p>
												Hitungan: ({contractSummary.dak.countQ2} / {contractSummary.dak.totalEligible}) × 100% ={" "}
												<span className="font-bold text-primary">
													{contractSummary.dak.ratio.toFixed(2)}%
												</span>
											</p>
											<p className="text-[10px] text-muted-foreground">
												Bucket:{" "}
												{contractSummary.dak.ratio === 0
													? "0% → 0"
													: contractSummary.dak.ratio <= 25
														? "≤25% → 50"
														: contractSummary.dak.ratio <= 50
															? "≤50% → 60"
															: contractSummary.dak.ratio <= 75
																? "≤75% → 80"
																: ">75% → 100"}
											</p>
										</div>
										<p className="text-[11px] text-muted-foreground">
											Kontribusi = {contractSummary.dak.score ?? 0} × 20% ={" "}
											<span className="font-semibold text-foreground">
												{contractSummary.dak.weightedContribution ?? 0}
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
											Nilai BK = (Pra-DIPA × 40%) + (AK53 × 40%) + (Distribusi A.K. × 20%) = (
											{contractSummary.kd.score ?? 0} × 0.4) + (
											{contractSummary.ak53.score ?? 0} × 0.4) + ({contractSummary.dak.score ?? 0} × 0.2) ={" "}
											<span className="font-bold text-foreground">
												{contractSummary.final.score ?? "Belum Lengkap"}
											</span>
										</p>
									</div>
									<div className="text-right">
										<p className="text-[11px] text-muted-foreground">
											Kontribusi IKPA (Bobot 10%)
										</p>
										<p className="text-base font-bold text-success">
											{contractSummary.final.weightedContribution
												? `${contractSummary.final.weightedContribution} Pts`
												: "—"}
										</p>
									</div>
								</div>
							</div>
						)}
					</div>
				)}

				{/* Accordion: Trace & Detail Perhitungan Penyelesaian Tagihan */}
				{isTagihanTab && (
					<div className="rounded-2xl border border-border bg-background shadow-xs overflow-hidden">
						<button
							type="button"
							onClick={() => setIsTraceExpanded(!isTraceExpanded)}
							className="flex w-full items-center justify-between p-4 text-left hover:bg-surface-muted transition"
						>
							<div className="flex items-center gap-2">
								<Info className="size-4 text-primary" />
								<span className="text-xs font-semibold text-foreground">
									Lihat Rincian Rumus &amp; Jejak Perhitungan Penyelesaian Tagihan
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
									{/* Step 1: Objek Penilaian & Pengecualian Pegawai */}
									<div className="rounded-xl border border-border bg-background p-3.5 space-y-2">
										<div className="flex items-center justify-between font-semibold text-foreground">
											<span>1. Objek Penilaian Non-Pegawai</span>
											<span className="text-primary font-bold">
												{tagihanSummary.eligibleCount} Eligible
											</span>
										</div>
										<p className="text-muted-foreground text-[11px]">
											Hanya menilai SPM-LS kontraktual non-belanja pegawai yang telah selesai proses konversi di KPPN.
										</p>
										<div className="rounded-lg bg-surface p-2.5 font-mono text-[11px] space-y-1 text-foreground">
											<p>Total Baris SPM: {tagihanSummary.totalSpmCount}</p>
											<p className="text-muted-foreground">
												Belanja Pegawai (Dikecualikan): {tagihanSummary.pegawaiCount}
											</p>
											<p className="text-muted-foreground">
												Menunggu Konversi (Belum Final): {tagihanSummary.pendingCount}
											</p>
											<p className="font-bold text-primary">
												Penyebut Selesai Dinilai: {tagihanSummary.eligibleCount}
											</p>
										</div>
										<p className="text-[11px] text-muted-foreground">
											*SPM Belanja Pegawai dikeluarkan dari pembilang &amp; penyebut.
										</p>
									</div>

									{/* Step 2: Ketepatan Waktu Penerbitan SPM */}
									<div className="rounded-xl border border-border bg-background p-3.5 space-y-2">
										<div className="flex items-center justify-between font-semibold text-foreground">
											<span>2. Ketepatan Waktu (≤ 17 HK)</span>
											<span className="text-primary font-bold">
												Skor: {tagihanSummary.score ?? "—"}
											</span>
										</div>
										<p className="text-muted-foreground text-[11px]">
											SPM tepat waktu jika tanggal diterima KPPN saat konversi ≤ 17 hari kerja sejak tanggal BAST/BAPP.
										</p>
										<div className="rounded-lg bg-surface p-2.5 font-mono text-[11px] space-y-1 text-foreground">
											<p>Tepat Waktu (≤ 17 HK): {tagihanSummary.onTimeCount}</p>
											<p>Terlambat (&gt; 17 HK / Invalid): {tagihanSummary.lateCount}</p>
											<p>
												Rasio: ({tagihanSummary.onTimeCount} ÷ {tagihanSummary.eligibleCount || 1}) × 100 ={" "}
												<span className="font-bold text-primary">
													{tagihanSummary.score ?? "—"}%
												</span>
											</p>
										</div>
										<p className="text-[11px] text-muted-foreground">
											*Hari kerja dihitung Senin–Jumat di luar libur nasional.
										</p>
									</div>

									{/* Step 3: Nilai Tertimbang Kontribusi */}
									<div className="rounded-xl border border-border bg-background p-3.5 space-y-2">
										<div className="flex items-center justify-between font-semibold text-foreground">
											<span>3. Kontribusi IKPA (Bobot 10%)</span>
											<span className="text-success font-bold">
												{tagihanSummary.weightedContribution
													? `${tagihanSummary.weightedContribution} Pts`
													: "—"}
											</span>
										</div>
										<p className="text-muted-foreground text-[11px]">
											Kontribusi = min((Nilai Tagihan × 10%) , 10.00).
										</p>
										<div className="rounded-lg bg-surface p-2.5 font-mono text-[11px] space-y-1 text-foreground">
											<p>Nilai Tagihan: {tagihanSummary.score ?? 0}</p>
											<p>Bobot Indikator: 10%</p>
											<p>
												Tertimbang: {tagihanSummary.score ?? 0} × 10% ={" "}
												<span className="font-bold text-success">
													{tagihanSummary.weightedContribution ?? 0}
												</span>
											</p>
										</div>
										<p className="text-[11px] text-muted-foreground">
											*Maksimal kontribusi adalah 10.00 poin.
										</p>
									</div>
								</div>

								{/* Trace Warnings if any */}
								{tagihanSummary.warnings.length > 0 && (
									<div className="rounded-xl border border-warning/20 bg-warning/5 p-3.5 space-y-1.5 text-foreground">
										<p className="font-semibold text-xs text-warning">
											Catatan &amp; Peringatan Penilaian:
										</p>
										<ul className="list-disc list-inside space-y-0.5 text-[11px] text-muted-foreground">
											{tagihanSummary.warnings.map((w) => (
												<li key={w}>{w}</li>
											))}
										</ul>
									</div>
								)}
							</div>
						)}
					</div>
				)}

				{/* Contextual Recommendations Panel for Belanja Kontraktual */}
				{!isTagihanTab && contractSummary.recommendations.length > 0 && (
					<div className="rounded-2xl border border-border bg-background p-4 sm:p-5 shadow-xs space-y-3">
						<div className="flex items-center gap-2 text-foreground font-semibold text-xs">
							<Sparkles className="size-4 text-warning" />
							<span>Rekomendasi Strategis Belanja Kontraktual</span>
						</div>
						<ul className="space-y-2">
							{contractSummary.recommendations.map((rec) => (
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

				{/* Contextual Recommendations Panel for Penyelesaian Tagihan */}
				{isTagihanTab && tagihanSummary.recommendations.length > 0 && (
					<div className="rounded-2xl border border-border bg-background p-4 sm:p-5 shadow-xs space-y-3">
						<div className="flex items-center gap-2 text-foreground font-semibold text-xs">
							<Sparkles className="size-4 text-warning" />
							<span>Rekomendasi Strategis Penyelesaian Tagihan (SPM-LS)</span>
						</div>
						<ul className="space-y-2">
							{tagihanSummary.recommendations.map((rec) => (
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
							*Rekomendasi dirancang berdasarkan PER-5/PB/2024 guna memastikan tidak ada SPM yang melewati batas H+17 hari kerja.
						</p>
					</div>
				)}

				{/* Actionable Reminder Strip H+17 for SPM tab */}
				{isTagihanTab && (
					<section
						aria-label="Reminder penyelesaian tagihan H+17 wajib"
						className="space-y-2 rounded-2xl border border-border bg-background p-4 sm:p-5"
					>
						<div className="flex items-center justify-between gap-3">
							<h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
								<Clock className="size-4 text-primary" />
								<span>
									Monitoring &amp; Reminder H+17 Hari Kerja
									{tagihanSummary.lateCount > 0
										? ` · ${tagihanSummary.lateCount} Berkas Terlambat`
										: tagihanSummary.riskyCount > 0
											? ` · ${tagihanSummary.riskyCount} Berkas Kritis/Berisiko`
											: null}
								</span>
							</h2>
							<a
								href="/operator/reminders"
								className="shrink-0 text-[11px] font-semibold text-primary underline-offset-4 hover:underline"
							>
								Buka Reminder Center
							</a>
						</div>

						{tagihanSummary.evaluations.filter(
							(e) => !e.isPegawai && (e.status === "late" || e.status === "risky" || e.status === "late_unconverted"),
						).length === 0 ? (
							<p className="text-xs text-muted-foreground">
								Seluruh berkas SPM-LS berjalan berada dalam batas aman kepatuhan (≤ 17 hari kerja dari tanggal BAST/BAPP).
							</p>
						) : (
							<ul className="space-y-1.5">
								{tagihanSummary.evaluations
									.filter(
										(e) =>
											!e.isPegawai &&
											(e.status === "late" ||
												e.status === "risky" ||
												e.status === "late_unconverted"),
									)
									.slice(0, 5)
									.map((r) => (
										<li
											key={r.spmId}
											className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-xs ${
												r.status === "late" || r.status === "late_unconverted"
													? "border-danger/30 bg-danger/[0.03]"
													: "border-warning/30 bg-warning/[0.03]"
											}`}
										>
											<div>
												<p className="font-semibold text-foreground">
													{r.referenceNumber} · {r.contractNumber}
												</p>
												<p className="text-muted-foreground text-[11px] mt-0.5">
													BAST: {r.bastBappDate} · Konversi:{" "}
													{r.receivedAtKppn ? r.receivedAtKppn : "Belum Dikonversi"}{" "}
													· Deadline H+17: {r.deadlineH17} (
													{r.workdaysElapsed !== null
														? `${r.workdaysElapsed} HK berlalu`
														: r.daysRemaining !== null
															? r.daysRemaining >= 0
																? `Sisa ${r.daysRemaining} HK`
																: `${Math.abs(r.daysRemaining)} HK terlambat`
															: "—"}
													)
												</p>
											</div>
											<span
												className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
													r.status === "late" || r.status === "late_unconverted"
														? "bg-danger/10 text-danger"
														: "bg-warning/10 text-warning"
												}`}
											>
												{r.badge.label}
											</span>
										</li>
									))}
							</ul>
						)}
						<p className="text-[11px] text-muted-foreground">
							*Penghitungan hari kerja resmi menggunakan kalender kerja (Senin–Jumat di luar libur nasional dan override kalender).
						</p>
					</section>
				)}

				{/* Tabs switch */}
				<div className="flex items-center gap-2 border-b border-border pb-2">
					<button
						type="button"
						onClick={() => handleTabChange("contracts")}
						className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
							!isTagihanTab
								? "bg-primary text-primary-foreground shadow-xs"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						Daftar Kontrak ({initialData.contracts.length})
					</button>
					<button
						type="button"
						onClick={() => handleTabChange("invoices")}
						className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
							isTagihanTab
								? "bg-primary text-primary-foreground shadow-xs"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						Tagihan SPM-LS ({initialData.spmLsList.length})
					</button>
				</div>

				{/* Data Tables */}
				{!isTagihanTab ? (
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
						data={filteredSpmEvaluations}
						columns={spmColumns}
						searchValue={search}
						onSearchChange={setSearch}
						onAddClick={handleOpenCreateSpm}
						totalCount={filteredSpmEvaluations.length}
					/>
				)}

				{/* Strategy Assistance Panel for Belanja Kontraktual */}
				{!isTagihanTab && (
					<section
						aria-label="Strategi Optimalisasi Nilai IKPA - Belanja Kontraktual"
						className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4"
					>
						<div className="flex items-center gap-2.5">
							<div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
								<TrendingUp className="size-4" />
							</div>
							<div>
								<h2 className="text-base font-bold text-foreground">
									Strategi Optimalisasi Nilai IKPA - Belanja Kontraktual
								</h2>
								<p className="text-xs text-muted-foreground">
									Langkah strategis akselerasi pengelolaan dan pendaftaran komitmen kontrak satker (Bobot 10%).
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
										Pengadaan Dini Sebelum Awal Tahun
									</h3>
									<p className="text-muted-foreground leading-relaxed text-[11px]">
										Mengupayakan proses Pengadaan Barang/Jasa (PBJ) dilaksanakan sebelum tahun anggaran (pra-DIPA), sehingga kontrak dapat ditandatangani dan pekerjaan dapat dilaksanakan di awal tahun anggaran.
									</p>
								</div>
							</div>

							<div className="p-4 rounded-xl border border-border bg-background space-y-2 flex flex-col justify-between">
								<div className="space-y-1.5">
									<span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
										2
									</span>
									<h3 className="font-bold text-foreground">
										Akselerasi Pengadaan ≤ Rp200 Juta (TW I)
									</h3>
									<p className="text-muted-foreground leading-relaxed text-[11px]">
										Memastikan pengadaan barang/jasa yang sifatnya sekaligus dan nilainya sampai dengan Rp200 juta diselesaikan pembayarannya pada Triwulan I.
									</p>
								</div>
							</div>

							<div className="p-4 rounded-xl border border-border bg-background space-y-2 flex flex-col justify-between">
								<div className="space-y-1.5">
									<span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
										3
									</span>
									<h3 className="font-bold text-foreground">
										Penyusunan &amp; Pengumuman RUP Segera
									</h3>
									<p className="text-muted-foreground leading-relaxed text-[11px]">
										Segera menyusun dan mengumumkan RUP di awal tahun sesuai dengan rencana kegiatan yang akan dilaksanakan awal tahun anggaran.
									</p>
								</div>
							</div>

							<div className="p-4 rounded-xl border border-border bg-background space-y-2 flex flex-col justify-between">
								<div className="space-y-1.5">
									<span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
										4
									</span>
									<h3 className="font-bold text-foreground">
										Pendaftaran Kontrak Semester I
									</h3>
									<p className="text-muted-foreground leading-relaxed text-[11px]">
										Memastikan seluruh pengadaan barang dan jasa yang dimungkinkan dapat ditandatangani dan didaftarkan ke KPPN paling lambat Semester I.
									</p>
								</div>
							</div>
						</div>
					</section>
				)}

				{/* Strategy Assistance Panel for Penyelesaian Tagihan */}
				{isTagihanTab && (
					<section
						aria-label="Strategi Optimalisasi Nilai IKPA - Penyelesaian Tagihan"
						className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4"
					>
						<div className="flex items-center gap-2.5">
							<div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
								<TrendingUp className="size-4" />
							</div>
							<div>
								<h2 className="text-base font-bold text-foreground">
									Strategi Optimalisasi Nilai IKPA - Penyelesaian Tagihan
								</h2>
								<p className="text-xs text-muted-foreground">
									Langkah strategis percepatan penyampaian SPM-LS non-pegawai ke KPPN tanpa melewati batas waktu (Bobot 10%).
								</p>
							</div>
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
							<div className="p-4 rounded-xl border border-border bg-background space-y-2 flex flex-col justify-between">
								<div className="space-y-1.5">
									<span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
										1
									</span>
									<h3 className="font-bold text-foreground">
										Segera Selesaikan Pembayaran Pekerjaan Selesai
									</h3>
									<p className="text-muted-foreground leading-relaxed text-[11px]">
										Segera menyelesaikan pembayaran dan tidak menunda proses penyelesaian tagihan yang pekerjaannya telah selesai (termasuk pekerjaan termin/bertahap).
									</p>
								</div>
							</div>

							<div className="p-4 rounded-xl border border-border bg-background space-y-2 flex flex-col justify-between">
								<div className="space-y-1.5">
									<span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
										2
									</span>
									<h3 className="font-bold text-foreground">
										Kepatuhan Batas Waktu 17 Hari Kerja
									</h3>
									<p className="text-muted-foreground leading-relaxed text-[11px]">
										Memperhatikan dan mematuhi ketentuan penyelesaian tagihan dalam 17 hari kerja sejak timbulnya hak tagih (BAST/BAPP) kepada negara.
									</p>
								</div>
							</div>
						</div>
					</section>
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

						{/* Live Preview of Contract in Drawer */}
						<div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2 text-xs">
							<div className="flex items-center gap-1.5 font-semibold text-primary">
								<Sparkles className="size-3.5" />
								<span>Evaluasi Kelayakan Kontrak Ini (Live Preview)</span>
							</div>
							<div className="grid grid-cols-3 gap-2 text-[11px]">
								<div className="rounded-lg bg-background p-2 border border-border">
									<p className="text-muted-foreground text-[10px]">Pra-DIPA (40%)</p>
									<p className="font-semibold text-foreground mt-0.5">
										{liveContractDrawerPreview.kdBadge.label}
									</p>
								</div>
								<div className="rounded-lg bg-background p-2 border border-border">
									<p className="text-muted-foreground text-[10px]">AK53 (40%)</p>
									<p className="font-semibold text-foreground mt-0.5">
										{liveContractDrawerPreview.ak53Badge.label}
									</p>
								</div>
								<div className="rounded-lg bg-background p-2 border border-border">
									<p className="text-muted-foreground text-[10px]">Distribusi A.K. (20%)</p>
									<p className="font-semibold text-foreground mt-0.5">
										{liveContractDrawerPreview.dakBadge.label}
									</p>
								</div>
							</div>
						</div>
					</div>
				</DomainFormDrawer>

				{/* Drawer 2: Form Tambah / Ubah SPM-LS */}
				<DomainFormDrawer
					isOpen={isSpmDrawerOpen}
					title={editingSpmId ? "Ubah Data SPM-LS" : "Catat Penerbitan SPM-LS"}
					description="Masukkan data SPM-LS yang diajukan ke KPPN atas penyelesaian BAST/BAPP."
					onClose={() => setIsSpmDrawerOpen(false)}
					onSubmit={handleSaveSpm}
					isSubmitting={isSubmitting}
				>
					<div className="space-y-4">
						<div className="space-y-1.5">
							<label
								htmlFor="spm-contract-select"
								className="block text-xs font-semibold text-foreground"
							>
								Kontrak Terkait <span className="text-danger">*</span>
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
								Nomor SPM-LS <span className="text-danger">*</span>
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
									Tanggal BAST / BAPP <span className="text-danger">*</span>
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
								<p className="text-[10px] text-muted-foreground">
									Titik awal batas H+17 hari kerja.
								</p>
							</div>

							<div className="space-y-1.5">
								<label
									htmlFor="spm-kppn-receive"
									className="block text-xs font-semibold text-foreground"
								>
									Tanggal Konversi / Diterima KPPN
								</label>
								<input
									id="spm-kppn-receive"
									type="date"
									value={kppnReceiveDate}
									onChange={(e) => setKppnReceiveDate(e.target.value)}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
								<p className="text-[10px] text-muted-foreground">
									Kosongkan bila SPM masih dalam proses berjalan.
								</p>
							</div>
						</div>

						<div className="rounded-xl border border-border bg-surface p-3 space-y-1">
							<div className="flex items-center gap-2">
								<input
									id="spm-is-pegawai"
									type="checkbox"
									checked={isPegawaiSpm}
									onChange={(e) => setIsPegawaiSpm(e.target.checked)}
									disabled={isSubmitting}
									className="size-4 rounded border-border text-primary focus:ring-primary"
								/>
								<label
									htmlFor="spm-is-pegawai"
									className="text-xs text-foreground font-semibold cursor-pointer"
								>
									Jenis Belanja Pegawai (Gaji / Tunjangan)
								</label>
							</div>
							<p className="text-[11px] text-muted-foreground pl-6">
								Centang jika merupakan SPM Belanja Pegawai. Sesuai PER-5/PB/2024, SPM Belanja Pegawai akan secara otomatis dikecualikan dari pembilang dan penyebut indikator.
							</p>
						</div>

						{/* Live Preview of SPM in Drawer */}
						<div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2 text-xs">
							<div className="flex items-center gap-1.5 font-semibold text-primary">
								<Sparkles className="size-3.5" />
								<span>Evaluasi Ketepatan Waktu Berkas Ini (Live Preview)</span>
							</div>
							<div className="grid grid-cols-2 gap-2 text-[11px]">
								<div className="rounded-lg bg-background p-2 border border-border">
									<p className="text-muted-foreground text-[10px]">Deadline H+17 HK</p>
									<p className="font-semibold text-foreground mt-0.5 font-mono">
										{liveSpmDrawerPreview.deadlineH17}
									</p>
								</div>
								<div className="rounded-lg bg-background p-2 border border-border">
									<p className="text-muted-foreground text-[10px]">Status Ketepatan</p>
									<p className="font-semibold text-foreground mt-0.5">
										{liveSpmDrawerPreview.badge.label}
									</p>
								</div>
							</div>
							<p className="text-[10px] text-muted-foreground">
								Dampak ke IKPA: {liveSpmDrawerPreview.impact}
							</p>
						</div>
					</div>
				</DomainFormDrawer>

				{/* Modal: Panduan Rumus Belanja Kontraktual */}
				{isContractGuideOpen && (
					// biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop intentionally handles click-to-dismiss.
					<div
						className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-xs p-4"
						role="presentation"
						onClick={() => setIsContractGuideOpen(false)}
						onKeyDown={(e) => {
							if (e.key === "Escape") setIsContractGuideOpen(false);
						}}
					>
						{/* biome-ignore lint/a11y/noStaticElementInteractions: dialog surface stops backdrop propagation. */}
						<div
							className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-xl space-y-4"
							role="presentation"
							onClick={(e) => e.stopPropagation()}
							onKeyDown={(e) => e.stopPropagation()}
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
									onClick={() => setIsContractGuideOpen(false)}
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

								{/* 1. Pra-DIPA */}
								<div className="rounded-xl border border-border p-3.5 space-y-2">
									<div className="flex items-center justify-between font-bold">
										<span>1. Pra-DIPA — Bobot 40%</span>
									</div>
									<p className="text-muted-foreground">
										Rata-rata poin per kontrak (nilai ≥ Rp50 juta) yang ditandatangani sebelum 1 Jan (120 poin) atau s.d. 31 Maret (110 poin). Kontrak setelah 31 Maret tidak dihitung dalam penyebut rata-rata.
									</p>
								</div>

								{/* 2. AK53 */}
								<div className="rounded-xl border border-border p-3.5 space-y-2">
									<div className="flex items-center justify-between font-bold">
										<span>2. Akselerasi Kontrak 53 (AK53) — Bobot 40%</span>
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

								{/* 3. Distribusi A.K. */}
								<div className="rounded-xl border border-border p-3.5 space-y-2">
									<div className="flex items-center justify-between font-bold">
										<span>3. Distribusi A.K. — Bobot 20%</span>
									</div>
									<p className="text-muted-foreground">
										Menilai proporsi jumlah kontrak bernilai ≥ Rp50 juta (seluruh jenis belanja) yang ditandatangani s.d. 30 Juni (Triwulan II) terhadap seluruh jumlah kontrak dalam satu tahun:
									</p>
									<ul className="list-disc list-inside space-y-1 text-muted-foreground text-[11px]">
										<li>Rasio &gt; 75,00%: 100 Poin</li>
										<li>50,01% &lt; Rasio &le; 75,00%: 80 Poin</li>
										<li>25,01% &lt; Rasio &le; 50,00%: 60 Poin</li>
										<li>0,01% &lt; Rasio &le; 25,00%: 50 Poin</li>
										<li>Rasio = 0%: 0 Poin</li>
									</ul>
								</div>
							</div>

							<div className="flex justify-end pt-2 border-t border-border">
								<button
									type="button"
									onClick={() => setIsContractGuideOpen(false)}
									className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition"
								>
									Tutup Panduan
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Modal: Panduan Rumus Penyelesaian Tagihan */}
				{isTagihanGuideOpen && (
					// biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop intentionally handles click-to-dismiss.
					<div
						className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-xs p-4"
						role="presentation"
						onClick={() => setIsTagihanGuideOpen(false)}
						onKeyDown={(e) => {
							if (e.key === "Escape") setIsTagihanGuideOpen(false);
						}}
					>
						{/* biome-ignore lint/a11y/noStaticElementInteractions: dialog surface stops backdrop propagation. */}
						<div
							className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-xl space-y-4"
							role="presentation"
							onClick={(e) => e.stopPropagation()}
							onKeyDown={(e) => e.stopPropagation()}
						>
							<div className="flex items-center justify-between border-b border-border pb-3">
								<div className="flex items-center gap-2">
									<HelpCircle className="size-5 text-primary" />
									<h2 className="text-base font-bold text-foreground">
										Panduan Indikator Penyelesaian Tagihan (SPM-LS)
									</h2>
								</div>
								<button
									type="button"
									onClick={() => setIsTagihanGuideOpen(false)}
									className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground transition"
								>
									<X className="size-4" />
								</button>
							</div>

							<div className="space-y-4 text-xs text-foreground">
								<div className="rounded-xl bg-surface p-3.5 border border-border space-y-1">
									<p className="font-semibold text-primary">
										Dasar Regulasi: PER-5/PB/2024 Pasal 8 · Bobot 10%
									</p>
									<p className="text-muted-foreground text-[11px]">
										Menilai ketepatan waktu penyelesaian tagihan SPM-LS kontraktual non-belanja pegawai dalam batas maksimal 17 hari kerja sejak tanggal BAST/BAPP hingga diterima KPPN saat konversi.
									</p>
								</div>

								<div className="rounded-xl border border-border p-3.5 space-y-2">
									<p className="font-bold text-foreground">Formula Penilaian</p>
									<div className="rounded-lg bg-surface p-2.5 font-mono text-[11px] text-primary">
										Nilai PT = (Jumlah SPM-LS Tepat Waktu ÷ Total SPM-LS Eligible Non-Pegawai) × 100
									</div>
									<div className="rounded-lg bg-surface p-2.5 font-mono text-[11px] text-success">
										Kontribusi IKPA = Nilai PT × 10% (Maksimal 10.00 Poin)
									</div>
								</div>

								<div className="rounded-xl border border-border p-3.5 space-y-2">
									<p className="font-bold text-foreground">Ketentuan Kritis</p>
									<ul className="list-disc list-inside space-y-1 text-muted-foreground text-[11px]">
										<li>
											<strong>Titik Awal:</strong> Tanggal BAST/BAPP pada Modul Komitmen SAKTI (hari ke-0).
										</li>
										<li>
											<strong>Titik Akhir:</strong> Tanggal SPM diterima KPPN pada saat proses konversi (bukan tanggal cetak SPM).
										</li>
										<li>
											<strong>Batas Waktu:</strong> Maksimal 17 hari kerja (Senin–Jumat di luar libur nasional dan cuti bersama).
										</li>
										<li>
											<strong>Pengecualian Belanja Pegawai:</strong> SPM Belanja Pegawai (gaji, tunjangan, uang makan) secara tegas dikecualikan dari pembilang dan penyebut.
										</li>
										<li>
											<strong>SPM Berjalan:</strong> Berkas yang belum memiliki tanggal konversi KPPN berstatus estimasi dan belum masuk ke pembilang nilai final.
										</li>
									</ul>
								</div>
							</div>

							<div className="flex justify-end pt-2 border-t border-border">
								<button
									type="button"
									onClick={() => setIsTagihanGuideOpen(false)}
									className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition"
								>
									Tutup Panduan
								</button>
							</div>
						</div>
					</div>
				)}
				<SaveScenarioDialog
					open={isKontrakDialogOpen}
					onOpenChange={setIsKontrakDialogOpen}
					indicatorKey="contractual"
					indicatorName="Belanja Kontraktual"
					activePeriodMonth={activePeriodMonth}
					fiscalYear={fiscalYear}
					overrides={
						kontrakSimScore !== null
							? { contractual: Number(kontrakSimScore).toFixed(2) }
							: undefined
					}
					overrideSummaries={kontrakSummaries}
					onSuccess={() => {
						setActionMessage(
							`Skenario what-if Belanja Kontraktual (${kontrakSimScore !== null ? Number(kontrakSimScore).toFixed(2) : "—"}) tersimpan di slot A/B/C. Buka Riwayat & Skenario untuk membandingkan.`,
						);
						setTimeout(() => setActionMessage(null), 5000);
					}}
				/>
				<SaveScenarioDialog
					open={isTagihanDialogOpen}
					onOpenChange={setIsTagihanDialogOpen}
					indicatorKey="invoice_timeliness"
					indicatorName="Penyelesaian Tagihan"
					activePeriodMonth={activePeriodMonth}
					fiscalYear={fiscalYear}
					overrides={
						tagihanSimScore !== null
							? { invoice_timeliness: tagihanSimScore.toFixed(2) }
							: undefined
					}
					overrideSummaries={tagihanSummaries}
					onSuccess={() => {
						setActionMessage(
							`Skenario what-if Penyelesaian Tagihan (${tagihanSimScore !== null ? tagihanSimScore.toFixed(2) : "—"}) tersimpan di slot A/B/C. Buka Riwayat & Skenario untuk membandingkan.`,
						);
						setTimeout(() => setActionMessage(null), 5000);
					}}
				/>
			</div>
		</OperatorShell>
	);
}

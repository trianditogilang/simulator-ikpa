import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Dialog } from "radix-ui";
import {
	AlertCircle,
	AlertTriangle,
	ArrowDown,
	BellRing,
	BookOpen,
	Calendar,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	FileQuestion,
	FileText,
	FlaskConical,
	Info,
	Lightbulb,
	Pencil,
	Plus,
	Save,
	ShieldAlert,
	ShieldCheck,
	Sparkles,
	Trash2,
	TrendingDown,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
	type ColumnDef,
	DomainDataTable,
} from "@/components/data/domain-data-table";
import { DomainFormDrawer } from "@/components/data/domain-form-drawer";
import { OperatorShell } from "@/components/layout/operator-shell";
import { SaveScenarioDialog } from "@/components/operator/save-scenario-dialog";
import { WhatIfPanel } from "@/components/operator/what-if-panel";
import { formatDate, formatNumber } from "@/lib/format";
import {
	calcDispensasiPreview,
	type DispensasiAssumptions,
} from "@/lib/simulation/dispensasi-assumptions";
import {
	addSpmDispensasi,
	editSpmDispensasi,
	fetchSpmDispensations,
	removeSpmDispensasi,
	type SpmQ4Record,
} from "@/services/spm-dispensation-service";

export const Route = createFileRoute("/operator/data/spm-dispensation")({
	loader: async ({ context }) => {
		const activeOrgId =
			context.auth?.isAuthenticated &&
			(context.access?.status === "operator_single_scope" ||
				context.access?.status === "operator_multiple_scopes")
				? (context.access.activeOrganizationId ?? undefined)
				: undefined;

		return fetchSpmDispensations(activeOrgId);
	},
	component: SpmDispensationPage,
});

const BUCKET_TABLE = [
	{
		category: 1,
		rangeLabel: "0,00 (tidak ada dispensasi)",
		deduction: "0,00",
		description: "Tidak ada dispensasi SPM",
	},
	{
		category: 2,
		rangeLabel: "0,01 – 0,09 ‰",
		deduction: "0,25",
		description: "Sangat rendah",
	},
	{
		category: 3,
		rangeLabel: "0,10 – 0,99 ‰",
		deduction: "0,50",
		description: "Rendah",
	},
	{
		category: 4,
		rangeLabel: "1,00 – 4,99 ‰",
		deduction: "0,75",
		description: "Sedang",
	},
	{
		category: 5,
		rangeLabel: "≥ 5,00 ‰",
		deduction: "1,00",
		description: "Tinggi",
	},
];

function SpmDispensationPage() {
	const router = useRouter();
	const initialData = Route.useLoaderData();

	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<"all" | "normal" | "dispensation">("all");
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [actionMessage, setActionMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isExampleOpen, setIsExampleOpen] = useState(false);
	const [isHelpOpen, setIsHelpOpen] = useState(false);

	const activeYear = initialData.year ?? 2026;

	// Form State: default Normal (isDispensasi = false)
	const [refNumber, setRefNumber] = useState("");
	const [issueDate, setIssueDate] = useState(`${activeYear}-10-01`);
	const [isDispensasi, setIsDispensasi] = useState(false);
	const [editingSpmId, setEditingSpmId] = useState<string | null>(null);

	// Engine Authoritative Data
	const calc = initialData.calculation;
	const ratioNum = parseFloat(calc.ratio) || 0;
	const deductionNum = parseFloat(calc.deduction) || 0;
	const totalQ4 = initialData.spmQ4List.length;
	const dispensationCount = initialData.spmQ4List.filter((s) => s.isDispensasi).length;
	const normalCount = totalQ4 - dispensationCount;

	// What-If Simulation: rencana dispensasi & total SPM Q4
	const [dispPlan, setDispPlan] = useState<DispensasiAssumptions>({
		dispensationCount,
		totalSpmQ4: totalQ4,
	});
	const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
	const dispPreview = useMemo(() => calcDispensasiPreview(dispPlan), [dispPlan]);
	const dispSummaries = useMemo(
		() =>
			dispPreview
				? [
						{
							label: `SPM dispensasi (${dispensationCount} → ${Math.floor(dispPlan.dispensationCount)} dari total ${totalQ4} → ${Math.floor(dispPlan.totalSpmQ4)})`,
							originalValue: `−${calc.deduction} pts (Kat. ${calc.category})`,
							newValue: `−${dispPreview.deduction.toFixed(2)} pts (Kat. ${dispPreview.category})`,
						},
					]
				: [],
		[dispPlan, dispPreview, dispensationCount, totalQ4, calc],
	);

	// Filtered items
	const filteredData = useMemo(() => {
		return initialData.spmQ4List.filter((item) => {
			const matchesSearch = item.referenceNumber
				.toLowerCase()
				.includes(search.toLowerCase());
			if (!matchesSearch) return false;

			if (statusFilter === "normal") return !item.isDispensasi;
			if (statusFilter === "dispensation") return item.isDispensasi;
			return true;
		});
	}, [initialData.spmQ4List, search, statusFilter]);

	const handleOpenCreateSpm = () => {
		setEditingSpmId(null);
		setRefNumber("");
		setIssueDate(`${activeYear}-10-01`);
		setIsDispensasi(false);
		setErrorMessage(null);
		setIsDrawerOpen(true);
	};

	const handleOpenEditSpm = (item: SpmQ4Record) => {
		setEditingSpmId(item.id);
		setRefNumber(item.referenceNumber);
		setIssueDate(item.issuedAt.slice(0, 10));
		setIsDispensasi(item.isDispensasi);
		setErrorMessage(null);
		setIsDrawerOpen(true);
	};

	const handleSaveSpm = async () => {
		setActionMessage(null);
		setErrorMessage(null);

		const parts = issueDate.trim().split("-");
		const year = Number(parts[0]);
		const month = Number(parts[1]);

		if (year !== activeYear || month < 10 || month > 12) {
			setErrorMessage(
				`Tanggal harus pada Oktober–Desember ${activeYear}. Penyebut rasio hanya SPM Triwulan IV.`,
			);
			return;
		}

		if (!refNumber.trim()) {
			setErrorMessage("Nomor SPM wajib diisi.");
			return;
		}

		setIsSubmitting(true);
		try {
			if (editingSpmId) {
				await editSpmDispensasi({
					spmId: editingSpmId,
					referenceNumber: refNumber.trim(),
					issuedAt: issueDate,
					isDispensasi,
				});
				setActionMessage(`SPM ${refNumber.trim()} berhasil diperbarui.`);
			} else {
				await addSpmDispensasi({
					referenceNumber: refNumber.trim(),
					issuedAt: issueDate,
					isDispensasi,
				});
				setActionMessage(`SPM ${refNumber.trim()} berhasil disimpan.`);
			}

			setIsDrawerOpen(false);
			setEditingSpmId(null);
			setRefNumber("");
			setIssueDate(`${activeYear}-10-01`);
			setIsDispensasi(false);
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal menyimpan data SPM.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleToggleDispensasi = async (item: SpmQ4Record) => {
		setActionMessage(null);
		setErrorMessage(null);

		if (!item.isDispensasi) {
			const confirmed = window.confirm(
				"Menandai SPM ini sebagai dispensasi akan menaikkan rasio permil dan dapat memotong nilai IKPA. Lanjutkan?",
			);
			if (!confirmed) return;
		}

		try {
			await editSpmDispensasi({
				spmId: item.id,
				isDispensasi: !item.isDispensasi,
			});
			setActionMessage(
				`Status dispensasi SPM ${item.referenceNumber} berhasil diperbarui.`,
			);
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal memperbarui status dispensasi.",
			);
		}
	};

	const handleDelete = async (item: SpmQ4Record) => {
		const confirmed = window.confirm(
			`Hapus SPM ${item.referenceNumber}? Data terhapus dari perhitungan rasio Triwulan IV.`,
		);
		if (!confirmed) return;

		setActionMessage(null);
		setErrorMessage(null);
		try {
			await removeSpmDispensasi(item.id);
			setActionMessage(`SPM ${item.referenceNumber} berhasil dihapus.`);
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal menghapus data SPM.",
			);
		}
	};

	const scrollToStrategy = () => {
		const el = document.getElementById("strategi-pengendalian");
		if (el) {
			el.scrollIntoView({ behavior: "smooth" });
		}
	};

	const columns: ColumnDef<SpmQ4Record>[] = [
		{
			key: "spm",
			header: "Nomor SPM",
			render: (item) => (
				<div>
					<span className="font-semibold text-foreground">
						{item.referenceNumber}
					</span>
					<p className="text-[11px] text-muted-foreground">
						Triwulan IV {activeYear}
					</p>
				</div>
			),
		},
		{
			key: "date",
			header: "Tanggal Terbit",
			render: (item) => (
				<span className="inline-flex items-center gap-1.5 font-medium text-foreground text-xs">
					<Calendar className="size-3.5 text-muted-foreground shrink-0" />
					<span>{formatDate(item.issuedAt)}</span>
				</span>
			),
		},
		{
			key: "status",
			header: "Status Penerbitan",
			render: (item) => (
				<span
					className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold ${
						item.isDispensasi
							? "bg-danger/10 text-danger border border-danger/20"
							: "bg-success/10 text-success border border-success/20"
					}`}
				>
					{item.isDispensasi ? (
						<>
							<AlertTriangle className="size-3" />
							<span>Dispensasi DJPb (Pengurang)</span>
						</>
					) : (
						<>
							<CheckCircle2 className="size-3" />
							<span>Normal (Tepat Waktu)</span>
						</>
					)}
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
						onClick={() => handleToggleDispensasi(item)}
						className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
							item.isDispensasi
								? "border-success/30 bg-success/5 text-success hover:bg-success/10"
								: "border-border bg-background text-foreground hover:bg-surface-muted hover:text-danger"
						}`}
					>
						{item.isDispensasi ? "Set Normal" : "Tandai Dispensasi"}
					</button>
					<button
						type="button"
						onClick={() => handleOpenEditSpm(item)}
						className="inline-flex items-center rounded-lg p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition"
						title="Ubah detail SPM"
						aria-label={`Ubah detail SPM ${item.referenceNumber}`}
					>
						<Pencil className="size-3.5" />
					</button>
					<button
						type="button"
						onClick={() => handleDelete(item)}
						className="inline-flex items-center rounded-lg p-1.5 text-muted-foreground hover:text-danger hover:bg-danger/10 transition"
						title="Hapus SPM"
						aria-label={`Hapus SPM ${item.referenceNumber}`}
					>
						<Trash2 className="size-3.5" />
					</button>
				</div>
			),
		},
	];

	return (
		<OperatorShell currentPath="/operator/data/spm-dispensation">
			<div className="space-y-6">
				{/* Top Header */}
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div>
						<div className="flex items-center gap-2">
							<h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
								SPM Dispensasi
							</h1>
							<span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
								Tahun Anggaran {activeYear}
							</span>
						</div>
						<p className="text-xs text-muted-foreground mt-0.5">
							Pengurang nilai IKPA · bukan indikator berbobot · Triwulan IV {activeYear}
						</p>
					</div>

					<div className="flex items-center gap-2 shrink-0">
						<Dialog.Root open={isHelpOpen} onOpenChange={setIsHelpOpen}>
							<Dialog.Trigger asChild>
								<button
									type="button"
									aria-label="Lihat panduan dan rumus Dispensasi SPM"
									className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface shadow-xs transition-colors"
								>
									<span className="flex size-4 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-[10px]">
										?
									</span>
									<span>Panduan &amp; Rumus</span>
								</button>
							</Dialog.Trigger>
							<Dialog.Portal>
								<Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-in fade-in" />
								<Dialog.Content className="fixed inset-x-4 top-[8%] z-50 mx-auto max-w-2xl rounded-2xl border border-border bg-background p-6 shadow-2xl outline-none max-h-[85vh] overflow-y-auto">
									<div className="flex items-center justify-between gap-4 border-b border-border pb-4">
										<Dialog.Title className="text-lg font-bold text-foreground">
											Panduan &amp; Rumus Dispensasi SPM (Pengurang IKPA)
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
												Ketentuan Penilaian Indikator Dispensasi SPM:
											</p>
											Dispensasi SPM berfungsi sebagai <strong>faktor pengurang (penalti)</strong> langsung terhadap Total Nilai IKPA Satker, bukan indikator penambah berbobot positif. Penilaian dievaluasi secara khusus pada <strong>Triwulan IV (Oktober s.d. Desember)</strong> pada masa Langkah-Langkah Akhir Tahun Anggaran (LLAT).
											<p className="mt-1 text-[11px] text-muted-foreground">
												*Tujuannya mendorong ketertiban dan kedisiplinan satker agar seluruh pengajuan SPM selesai tepat waktu sebelum batas akhir regulasi tanpa surat dispensasi KPPN.
											</p>
										</div>

										<div>
											<h4 className="font-semibold text-foreground text-xs uppercase tracking-wider mb-2">
												Matriks Rasio &amp; Besaran Pengurang Nilai IKPA (PER-5/PB/2024)
											</h4>
											<div className="overflow-x-auto rounded-xl border border-border">
												<table className="w-full text-xs text-left">
													<thead className="bg-surface-muted text-muted-foreground font-semibold">
														<tr>
															<th className="px-3 py-2">Kategori</th>
															<th className="px-3 py-2">Rentang Rasio Dispensasi (‰)</th>
															<th className="px-3 py-2 text-right">Potongan Poin IKPA</th>
															<th className="px-3 py-2">Tingkat Risiko</th>
														</tr>
													</thead>
													<tbody className="divide-y divide-border">
														{BUCKET_TABLE.map((b) => (
															<tr key={b.category}>
																<td className="px-3 py-2 font-medium">Kategori {b.category}</td>
																<td className="px-3 py-2 font-mono">{b.rangeLabel}</td>
																<td className="px-3 py-2 text-right font-bold text-danger">
																	{b.deduction === "0,00" ? "0,00 pts" : `−${b.deduction} pts`}
																</td>
																<td className="px-3 py-2 text-muted-foreground">{b.description}</td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
										</div>

										<div className="space-y-2 text-xs">
											<h4 className="font-semibold text-foreground text-xs uppercase tracking-wider">
												Tahapan &amp; Formula Perhitungan:
											</h4>
											<ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
												<li>
													<strong>Total SPM Q4</strong>: Hitung seluruh SPM yang terbit pada Triwulan IV (Oktober, November, Desember).
												</li>
												<li>
													<strong>SPM Dispensasi</strong>: Hitung jumlah SPM Q4 yang diterbitkan dengan izin/surat dispensasi keterlambatan.
												</li>
												<li>
													<strong>Rasio Dispensasi (Permil)</strong> = (Jumlah SPM Dispensasi ÷ Total SPM Q4) × 1.000‰.
												</li>
												<li>
													<strong>Penetapan Pengurang</strong>: Cocokkan rasio permil dengan tabel matriks 5 kategori di atas.
												</li>
												<li>
													<strong>Dampak Total IKPA</strong>: Total IKPA Akhir = Subtotal 7 Indikator − Pengurang Dispensasi.
												</li>
											</ol>
										</div>

										<div className="rounded-xl border border-border bg-surface-muted/50 p-3.5 text-xs text-muted-foreground">
											<p className="font-semibold text-foreground mb-1">💡 Tips Mitigasi Satker:</p>
											<p>
												Ajukan SPM termin dan kontrak sebelum tanggal cut-off LLAT yang diterbitkan Direktorat Jenderal Perbendaharaan. Hindari menumpuk tagihan SPM-LS dan SPM-GUP di minggu-minggu terakhir bulan Desember.
											</p>
										</div>
									</div>
								</Dialog.Content>
							</Dialog.Portal>
						</Dialog.Root>

						<button
							type="button"
							onClick={handleOpenCreateSpm}
							className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
						>
							<Plus className="size-4" />
							<span>Tambah SPM Q4</span>
						</button>
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

				{/* 5 Top Summary Metric Cards */}
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
					{/* Card 1: Total SPM Q4 */}
					<div className="rounded-xl border border-border bg-background p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold truncate">Total SPM Q4</span>
							<FileText className="size-4 text-muted-foreground shrink-0" />
						</div>
						<div className="space-y-0.5 mt-auto">
							<div className="flex items-baseline gap-1.5 min-h-[32px] sm:min-h-[36px]">
								<p className="text-2xl font-bold text-foreground sm:text-3xl leading-none">
									{totalQ4}
								</p>
							</div>
							<p className="text-[11px] text-muted-foreground truncate" title="Penyebut · seluruh SPM terbit Okt–Des">
								Penyebut · seluruh SPM terbit Okt–Des
							</p>
						</div>
					</div>

					{/* Card 2: SPM Dispensasi */}
					<div className="rounded-xl border border-border bg-background p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold truncate">SPM Dispensasi</span>
							<AlertTriangle
								className={`size-4 shrink-0 ${
									dispensationCount > 0 ? "text-danger" : "text-success"
								}`}
							/>
						</div>
						<div className="space-y-0.5 mt-auto">
							<div className="flex items-baseline gap-1.5 min-h-[32px] sm:min-h-[36px]">
								<p
									className={`text-2xl font-bold sm:text-3xl leading-none ${
										dispensationCount > 0 ? "text-danger" : "text-success"
									}`}
								>
									{dispensationCount}
								</p>
							</div>
							<p className="text-[11px] text-muted-foreground truncate" title="Pembilang · diajukan dispensasi">
								Pembilang · diajukan dispensasi
							</p>
						</div>
					</div>

					{/* Card 3: Rasio Dispensasi */}
					<div className="rounded-xl border border-border bg-background p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold truncate">Rasio Dispensasi</span>
							<TrendingDown className="size-4 text-primary shrink-0" />
						</div>
						<div className="space-y-0.5 mt-auto">
							<div className="flex items-baseline gap-1.5 min-h-[32px] sm:min-h-[36px]">
								<p className="text-2xl font-bold text-foreground sm:text-3xl leading-none">
									{formatNumber(ratioNum)}‰
								</p>
							</div>
							<p className="text-[11px] text-muted-foreground truncate" title={`Kategori ${calc.category} · per 1.000 SPM Q4`}>
								Kategori {calc.category} · per 1.000 SPM Q4
							</p>
						</div>
					</div>

					{/* Card 4 (2 paling kanan): Nilai IKPA Dispensasi SPM */}
					<div className="rounded-xl border border-primary/20 bg-background p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold truncate">
								Nilai IKPA Dispensasi SPM
							</span>
							<ShieldCheck className="size-4 text-primary shrink-0" />
						</div>
						<div className="space-y-0.5 mt-auto">
							<div className="flex items-baseline gap-1.5 min-h-[32px] sm:min-h-[36px]">
								<p className="text-2xl font-extrabold text-primary sm:text-3xl leading-none">
									{deductionNum === 0
										? "100.00"
										: Math.max(0, 100 - deductionNum * 20).toFixed(2)}
								</p>
							</div>
							<p className="text-[11px] text-muted-foreground truncate" title={deductionNum === 0 ? "Nihil dispensasi (Nilai maksimal)" : `Potongan ${calc.deduction} poin IKPA`}>
								{deductionNum === 0
									? "Nihil dispensasi (Nilai maksimal)"
									: `Potongan ${calc.deduction} poin IKPA`}
							</p>
						</div>
					</div>

					{/* Card 5 (paling kanan): Nilai Akhir (Pengurang 5%) */}
					<div className="rounded-xl border border-success/20 bg-success/5 p-4 shadow-xs flex flex-col justify-between min-h-[110px]">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold truncate">
								Nilai Akhir (Pengurang 5%)
							</span>
							<Sparkles className="size-4 text-success shrink-0" />
						</div>
						<div className="space-y-0.5 mt-auto">
							<div className="flex items-baseline gap-1.5 min-h-[32px] sm:min-h-[36px]">
								<p className="text-2xl font-extrabold text-success sm:text-3xl leading-none">
									{deductionNum > 0 ? `−${calc.deduction} pts` : "0.00 pts"}
								</p>
							</div>
							<p className="text-[11px] text-muted-foreground truncate" title="Pengurang Nilai Total IKPA Satker">
								Pengurang Nilai Total IKPA Satker
							</p>
						</div>
					</div>
				</div>

				{/* Authoritative Status Banner (§5.3) */}
				<div
					className={`flex items-center gap-3 rounded-2xl border p-4 text-xs shadow-xs ${
						totalQ4 === 0
							? "border-sky-500/30 bg-sky-500/10 text-blue-950 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100"
							: deductionNum === 0
								? "border-success/30 bg-success/10 text-success dark:text-success"
								: deductionNum <= 0.50
									? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
									: "border-danger/30 bg-danger/10 text-danger dark:text-danger"
					}`}
				>
					{totalQ4 === 0 ? (
						<Info className="size-5 shrink-0 text-sky-600 dark:text-sky-400" />
					) : deductionNum === 0 ? (
						<CheckCircle2 className="size-5 shrink-0 text-success" />
					) : deductionNum <= 0.50 ? (
						<AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
					) : (
						<ShieldAlert className="size-5 shrink-0 text-danger" />
					)}

					<div className="flex-1 font-medium">
						{totalQ4 === 0 && (
							<p className="text-[#0000FF] dark:text-[#60a5fa] font-bold leading-relaxed">
								Belum ada SPM Triwulan IV. Pengurang dihitung 0 sampai data Q4
								diisi.
							</p>
						)}
						{totalQ4 > 0 && deductionNum === 0 && (
							<p>
								Tidak ada dispensasi SPM. Nilai IKPA tidak dipotong dari
								indikator ini.
							</p>
						)}
						{totalQ4 > 0 && deductionNum > 0 && (
							<p>
								Rasio {formatNumber(ratioNum)}‰ · Kategori {calc.category} ·
								Pengurang {calc.deduction} poin.
							</p>
						)}
					</div>
				</div>

				<WhatIfPanel
					storageKey="ikpa-whatif-dispensasi"
					title="Simulasi What-If Rencana Dispensasi"
					description="Uji rencana jumlah dispensasi vs total SPM Q4 — rasio permil & pengurang dihitung dengan bucket resmi, tanpa mengubah data aktual."
					action={
						<button
							type="button"
							disabled={!dispPreview?.isValid}
							onClick={() => setIsSaveDialogOpen(true)}
							title={
								dispPreview?.isValid
									? "Simpan ke Skenario A, B, atau C"
									: (dispPreview?.message ?? "Lengkapi rencana agar skenario dapat disimpan")
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
										htmlFor="sim-disp-count"
										className="block text-xs font-semibold text-foreground"
									>
										Rencana SPM Dispensasi
									</label>
									<input
										id="sim-disp-count"
										type="number"
										min="0"
										value={dispPlan.dispensationCount}
										onChange={(e) =>
											setDispPlan({
												...dispPlan,
												dispensationCount: Math.max(
													0,
													Number.parseInt(e.target.value, 10) || 0,
												),
											})
										}
										placeholder="0"
										className="w-full rounded-lg border border-amber-300 bg-amber-50/70 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 px-2.5 py-1.5 text-xs font-mono text-amber-950 placeholder:text-amber-300 transition-all"
									/>
									<p className="text-[11px] text-muted-foreground">
										Aktual: {dispensationCount} berkas
									</p>
								</div>
								<div className="rounded-xl border border-amber-200/80 bg-background p-3.5 space-y-1.5">
									<label
										htmlFor="sim-disp-total"
										className="block text-xs font-semibold text-foreground"
									>
										Rencana Total SPM Q4
									</label>
									<input
										id="sim-disp-total"
										type="number"
										min="0"
										value={dispPlan.totalSpmQ4}
										onChange={(e) =>
											setDispPlan({
												...dispPlan,
												totalSpmQ4: Math.max(
													0,
													Number.parseInt(e.target.value, 10) || 0,
												),
											})
										}
										placeholder="0"
										className="w-full rounded-lg border border-amber-300 bg-amber-50/70 focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 px-2.5 py-1.5 text-xs font-mono text-amber-950 placeholder:text-amber-300 transition-all"
									/>
									<p className="text-[11px] text-muted-foreground">
										Aktual: {totalQ4} berkas
									</p>
								</div>
								<div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-1">
									<span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
										<FlaskConical className="size-3.5 text-amber-600" />
										<span>Pengurang Simulasi</span>
									</span>
									<p className="text-2xl font-extrabold text-amber-700">
										{dispPreview
											? `−${dispPreview.deduction.toFixed(2)} pts`
											: "—"}
									</p>
									<p className="text-[11px] text-muted-foreground">
										{dispPreview
											? `Rasio ${dispPreview.ratioFormatted}‰ · Kategori ${dispPreview.category}`
											: "—"}{" "}
										· Aktual −{calc.deduction} pts
									</p>
								</div>
								<div className="rounded-xl border border-border bg-background p-3.5 space-y-1">
									<span className="text-xs font-semibold text-muted-foreground">
										Status Rencana
									</span>
									<p
										className={`text-sm font-bold ${
											!dispPreview?.isValid
												? "text-danger"
												: dispPreview.deduction > deductionNum
													? "text-danger"
													: dispPreview.deduction < deductionNum
														? "text-success"
														: "text-muted-foreground"
										}`}
									>
										{!dispPreview?.isValid
											? (dispPreview?.message ?? "Belum valid")
											: dispPreview.deduction > deductionNum
												? "Potongan bertambah"
												: dispPreview.deduction < deductionNum
													? "Potongan berkurang"
													: "Sama dengan aktual"}
									</p>
									<button
										type="button"
										onClick={() =>
											setDispPlan({
												dispensationCount,
												totalSpmQ4: totalQ4,
											})
										}
										className="text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:underline"
									>
										Reset ke aktual
									</button>
								</div>
							</div>
							<p className="text-[11px] text-muted-foreground leading-relaxed">
								Bucket pengurang: 0,00‰ = 0 · 0,01–0,09‰ = 0,25 ·
								0,10–0,99‰ = 0,50 · 1,00–4,99‰ = 0,75 · ≥5,00‰ = 1,00.
							</p>
				</WhatIfPanel>

				{/* Strip Reminder Batas Akhir SPM (§5.4) */}
				<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs shadow-xs">
					<div className="flex items-start gap-3">
						<div className="rounded-xl bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400 shrink-0">
							<BellRing className="size-4" />
						</div>
						<div className="space-y-0.5">
							<h2 className="font-semibold text-foreground">
								Batas akhir SPM tahun anggaran.
							</h2>
							<p className="text-muted-foreground text-[11px] leading-relaxed">
								Petunjuk DJPb biasanya terbit Oktober/November. Selesaikan
								kegiatan dan SPM sebelum batas itu. Dispensasi ke DJPb memotong
								nilai IKPA.
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
						<a
							href="/operator/reminders"
							className="rounded-lg border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-surface-muted transition"
						>
							Lihat reminder
						</a>
						<button
							type="button"
							onClick={scrollToStrategy}
							className="inline-flex items-center gap-1 rounded-lg bg-amber-600/10 px-3 py-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-600/20 transition"
						>
							<span>3 cara hindari potongan</span>
							<ArrowDown className="size-3" />
						</button>
					</div>
				</div>

				{/* Filter & Toolbar */}
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="inline-flex rounded-xl border border-border bg-surface p-1 text-xs">
						<button
							type="button"
							onClick={() => setStatusFilter("all")}
							className={`rounded-lg px-3 py-1 font-semibold transition ${
								statusFilter === "all"
									? "bg-background text-foreground shadow-xs"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							Semua ({totalQ4})
						</button>
						<button
							type="button"
							onClick={() => setStatusFilter("normal")}
							className={`rounded-lg px-3 py-1 font-semibold transition ${
								statusFilter === "normal"
									? "bg-background text-foreground shadow-xs"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							Normal ({normalCount})
						</button>
						<button
							type="button"
							onClick={() => setStatusFilter("dispensation")}
							className={`rounded-lg px-3 py-1 font-semibold transition ${
								statusFilter === "dispensation"
									? "bg-background text-danger shadow-xs"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							Dispensasi ({dispensationCount})
						</button>
					</div>
				</div>

				{/* Data Table */}
				{filteredData.length === 0 ? (
					<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/50 p-10 text-center">
						<div className="rounded-2xl bg-surface p-3 text-muted-foreground shadow-xs mb-3">
							<FileQuestion className="size-8" />
						</div>
						<h2 className="text-sm font-semibold text-foreground">
							{search
								? "SPM tidak ditemukan"
								: "Belum ada SPM Triwulan IV"}
						</h2>
						<p className="mt-1 max-w-md text-xs text-muted-foreground">
							{search
								? `Tidak ada SPM yang sesuai dengan pencarian "${search}".`
								: "Tambahkan setiap SPM yang terbit Oktober–Desember, lalu tandai hanya yang benar-benar diterbitkan dengan dispensasi akhir tahun."}
						</p>
						<p className="mt-2 text-[11px] font-medium text-primary">
							Yang dihitung adalah jumlah lembar SPM, bukan nilai rupiah.
						</p>
					</div>
				) : (
					<DomainDataTable
						title="Daftar Penerbitan SPM Triwulan IV"
						data={filteredData}
						columns={columns}
						searchValue={search}
						onSearchChange={setSearch}
						onAddClick={() => {
							setRefNumber("");
							setIssueDate(`${activeYear}-10-01`);
							setIsDispensasi(false);
							setErrorMessage(null);
							setIsDrawerOpen(true);
						}}
						totalCount={filteredData.length}
					/>
				)}

				{/* 2-Column Bottom Section: Cara Hitung (Kiri) & Strategi Pengendalian (Kanan) */}
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
					{/* Left Panel: Cara Hitung & Tabel Kategori (§5.7) */}
					<div className="rounded-2xl border border-border bg-background p-5 shadow-xs space-y-4">
						<div className="flex items-center gap-2 text-foreground font-bold text-sm">
							<BookOpen className="size-4 text-primary" />
							<h2>Cara Perhitungan Pengurang</h2>
						</div>

						{/* Formula Summary */}
						<div className="rounded-xl bg-surface border border-border/60 p-3 space-y-1.5 text-xs">
							<p className="font-mono text-[11px] text-foreground font-semibold">
								Rasio (‰) = SPM dispensasi ÷ SPM Triwulan IV × 1.000
							</p>
							<p className="font-mono text-[11px] text-muted-foreground">
								Pengurang diambil dari kategori rasio
							</p>
							<p className="font-mono text-[11px] text-primary font-semibold">
								Nilai IKPA akhir = Nilai 7 Indikator − Pengurang
							</p>
						</div>

						<p className="text-xs text-muted-foreground">
							<span className="font-semibold text-foreground">5‰</span> artinya
							5 SPM dispensasi dari 1.000 SPM yang terbit.
						</p>

						{/* Category Table */}
						<div className="overflow-hidden rounded-xl border border-border">
							<table className="w-full text-left text-xs">
								<thead className="bg-surface text-muted-foreground font-semibold">
									<tr>
										<th className="px-3 py-2 text-center w-12">Kat.</th>
										<th className="px-3 py-2">Rasio SPM Dispensasi (‰)</th>
										<th className="px-3 py-2 text-right">Pengurang</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border">
									{BUCKET_TABLE.map((row) => {
										const isCurrent = calc.category === row.category;
										return (
											<tr
												key={row.category}
												className={`transition ${
													isCurrent
														? "bg-primary/10 font-semibold text-primary dark:bg-primary/20"
														: "hover:bg-surface/50 text-foreground"
												}`}
											>
												<td className="px-3 py-2 text-center">
													{row.category}
													{isCurrent && (
														<span className="ml-1 inline-block size-1.5 rounded-full bg-primary" />
													)}
												</td>
												<td className="px-3 py-2">{row.rangeLabel}</td>
												<td className="px-3 py-2 text-right font-mono">
													−{row.deduction}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>

						{/* Official Example Accordion */}
						<div className="rounded-xl border border-border bg-surface/50">
							<button
								type="button"
								onClick={() => setIsExampleOpen((prev) => !prev)}
								className="flex w-full items-center justify-between p-3 text-left text-xs font-semibold text-foreground hover:text-primary transition"
							>
								<span>Lihat Contoh Resmi Pusdiklat</span>
								{isExampleOpen ? (
									<ChevronUp className="size-4" />
								) : (
									<ChevronDown className="size-4" />
								)}
							</button>

							{isExampleOpen && (
								<div className="border-t border-border p-3 text-xs text-muted-foreground space-y-2 bg-background">
									<p>
										<strong className="text-foreground">Satker A:</strong> 24
										SPM dispensasi dari 5.214 total SPM Triwulan IV.
									</p>
									<ul className="list-disc list-inside space-y-1 pl-1 text-[11px]">
										<li>
											Rasio = 24 ÷ 5.214 × 1.000 ={" "}
											<strong className="text-foreground">4,60‰</strong>
										</li>
										<li>
											Masuk <strong className="text-foreground">Kategori 4</strong> (1,00 – 4,99‰) → Pengurang ={" "}
											<strong className="text-danger">0,75 poin</strong>
										</li>
										<li>
											Jika nilai IKPA dari 7 indikator berbobot ={" "}
											<strong className="text-foreground">97,25</strong>,
											maka nilai akhir IKPA = 97,25 − 0,75 ={" "}
											<strong className="text-success">96,50</strong>.
										</li>
									</ul>
								</div>
							)}
						</div>
					</div>

					{/* Right Panel: Strategi Pengendalian Satker (§5.8) */}
					<div
						id="strategi-pengendalian"
						className="rounded-2xl border border-border bg-background p-5 shadow-xs space-y-4"
					>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2 text-foreground font-bold text-sm">
								<Lightbulb className="size-4 text-amber-500" />
								<h2>Strategi Optimalisasi Nilai IKPA - Dispensasi SPM</h2>
							</div>
							<span className="rounded-md bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
								Target: 0,00 Poin
							</span>
						</div>

						{/* Alert if currently deducted */}
						{deductionNum > 0 ? (
							<div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger font-medium">
								Saat ini satker Anda pada Kategori {calc.category} (pengurang{" "}
								{calc.deduction} poin). Turunkan jumlah SPM dispensasi atau
								selesaikan SPM Q4 tanpa dispensasi untuk mengurangi potongan.
							</div>
						) : (
							<div className="rounded-xl border border-success/30 bg-success/10 p-3 text-xs text-success font-medium">
								Satker Anda berada pada Kategori 1 (bebas potongan pengurang).
								Pertahankan penyelesaian SPM tepat waktu s.d. akhir tahun.
							</div>
						)}

						{/* 3 Strategic Actions */}
						<div className="space-y-3 text-xs">
							<div className="flex items-start gap-3 rounded-xl border border-border/70 p-3 bg-surface/30">
								<div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
									1
								</div>
								<div className="space-y-0.5">
									<p className="font-semibold text-foreground">
										Pantau progres kegiatan vs batas akhir SPM.
									</p>
									<p className="text-[11px] text-muted-foreground leading-relaxed">
										Petakan penyelesaian kegiatan ke batas penyampaian SPM
										akhir tahun (biasanya diumumkan Oktober/November). Jangan
										menunggu Desember.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-3 rounded-xl border border-border/70 p-3 bg-surface/30">
								<div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
									2
								</div>
								<div className="space-y-0.5">
									<p className="font-semibold text-foreground">
										Mitigasi risiko pembayaran akhir tahun.
									</p>
									<p className="text-[11px] text-muted-foreground leading-relaxed">
										Identifikasi pekerjaan yang risikonya cair di penghujung
										tahun; siapkan rencana agar tidak perlu mengajukan
										dispensasi ke DJPb.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-3 rounded-xl border border-border/70 p-3 bg-surface/30">
								<div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
									3
								</div>
								<div className="space-y-0.5">
									<p className="font-semibold text-foreground">
										Prognosis belanja, cairkan lebih awal.
									</p>
									<p className="text-[11px] text-muted-foreground leading-relaxed">
										Hitung sisa belanja dan eksekusi di Oktober/November (atau
										sejak awal tahun). Penumpukan pencairan Desember adalah
										penyebab klasik dispensasi.
									</p>
								</div>
							</div>
						</div>

						<p className="text-[11px] text-muted-foreground italic pt-1">
							* Simulasi internal, bukan nilai resmi OMSPAN/KPPN.
						</p>
					</div>
				</div>

				{/* Form Drawer: Tambah/Ubah SPM Q4 */}
				<DomainFormDrawer
					isOpen={isDrawerOpen}
					title={
						editingSpmId
							? "Ubah Data Penerbitan SPM Triwulan IV"
							: "Catat Penerbitan SPM Triwulan IV"
					}
					description={
						editingSpmId
							? `Perbarui nomor dokumen, tanggal terbit, atau status dispensasi SPM Triwulan IV (${activeYear}).`
							: `Masukkan data SPM yang diajukan pada periode akhir tahun (Oktober–Desember ${activeYear}).`
					}
					onClose={() => {
						setIsDrawerOpen(false);
						setEditingSpmId(null);
					}}
					onSubmit={handleSaveSpm}
					isSubmitting={isSubmitting}
				>
					<div className="space-y-4">
						<div className="space-y-1.5">
							<label
								htmlFor="spm-q4-ref"
								className="block text-xs font-semibold text-foreground"
							>
								Nomor SPM <span className="text-danger">*</span>
							</label>
							<input
								id="spm-q4-ref"
								type="text"
								required
								placeholder={`Contoh: 00451/SPM-LS/411782/${activeYear}`}
								value={refNumber}
								onChange={(e) => setRefNumber(e.target.value)}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							/>
							<p className="text-[11px] text-muted-foreground">
								Nomor pada dokumen SPM
							</p>
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="spm-q4-date"
								className="block text-xs font-semibold text-foreground"
							>
								Tanggal Terbit SPM <span className="text-danger">*</span>
							</label>
							<input
								id="spm-q4-date"
								type="date"
								required
								min={`${activeYear}-10-01`}
								max={`${activeYear}-12-31`}
								value={issueDate}
								onChange={(e) => setIssueDate(e.target.value)}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							/>
							<p className="text-[11px] text-muted-foreground">
								Hanya SPM Triwulan IV ({activeYear}-10-01 s.d. {activeYear}-12-31)
								yang dihitung
							</p>
						</div>

						<div className="rounded-xl border border-border bg-surface p-3.5 space-y-2">
							<div className="flex items-start gap-2.5">
								<input
									id="spm-q4-is-disp"
									type="checkbox"
									checked={isDispensasi}
									onChange={(e) => setIsDispensasi(e.target.checked)}
									disabled={isSubmitting}
									className="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary"
								/>
								<label
									htmlFor="spm-q4-is-disp"
									className="text-xs text-foreground font-medium cursor-pointer leading-snug"
								>
									Diterbitkan dengan Surat Dispensasi DJPb / KPPN
								</label>
							</div>
							<p className="text-[11px] text-muted-foreground pl-6.5">
								Centang hanya jika SPM ini diajukan melampaui batas waktu akhir
								tahun dan diterbitkan dengan surat dispensasi.
							</p>
						</div>
					</div>
				</DomainFormDrawer>
				<SaveScenarioDialog
					open={isSaveDialogOpen}
					onOpenChange={setIsSaveDialogOpen}
					indicatorKey="spm_dispensation"
					indicatorName="Dispensasi SPM"
					activePeriodMonth={12}
					fiscalYear={activeYear}
					assumptions={{
						dispensasi: {
							dispensationCount: Math.floor(dispPlan.dispensationCount),
							totalSpmQ4: Math.floor(dispPlan.totalSpmQ4),
						},
					}}
					overrideSummaries={dispSummaries}
					onSuccess={() => {
						setActionMessage(
							`Skenario what-if Dispensasi SPM (pengurang −${dispPreview?.deduction.toFixed(2) ?? "—"} pts) tersimpan di slot A/B/C. Buka Riwayat & Skenario untuk membandingkan.`,
						);
						setTimeout(() => setActionMessage(null), 5000);
					}}
				/>
			</div>
		</OperatorShell>
	);
}

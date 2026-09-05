import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
	AlertCircle,
	Calendar,
	CheckCircle2,
	Clock,
	FileCheck,
	FileText,
	Plus,
	Receipt,
	Trash2,
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
	buildSpmReminders,
	tagihanAdvice,
} from "@/lib/simulation/tagihan-output-reminder";
import {
	addContract,
	addSpmLs,
	fetchContractsAndInvoices,
	removeContract,
	removeSpmLs,
	type ContractRecord,
	type SpmLsRecord,
} from "@/services/contracts-invoices-service";

export const Route = createFileRoute("/operator/data/contracts-invoices")({
	loader: async ({ context }) => {
		const activeOrgId =
			context.auth?.isAuthenticated &&
			(context.access?.status === "operator_single_scope" ||
				context.access?.status === "operator_multiple_scopes")
				? (context.access.activeOrganizationId ?? undefined)
				: undefined;

		return fetchContractsAndInvoices(activeOrgId);
	},
	component: ContractsInvoicesPage,
});

const ACCOUNT_LABELS: Record<string, string> = {
	"51": "Pegawai (51)",
	"52": "Barang (52)",
	"53": "Modal (53)",
};

function ContractsInvoicesPage() {
	const router = useRouter();
	const initialData = Route.useLoaderData();

	const [activeTab, setActiveTab] = useState<"contracts" | "spm">("contracts");
	const [search, setSearch] = useState("");
	const [isContractDrawerOpen, setIsContractDrawerOpen] = useState(false);
	const [isSpmDrawerOpen, setIsSpmDrawerOpen] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [actionMessage, setActionMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	// Contract Form State
	const [contractNum, setContractNum] = useState("");
	const [contractAccount, setContractAccount] = useState<"51" | "52" | "53">(
		"53",
	);
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

	// Totals
	const totalContractValue = initialData.contracts.reduce(
		(sum, c) => sum + (Number.parseFloat(c.value) || 0),
		0,
	);

	// Strip reminder H+17 wajib (estimasi hari kerja Senin–Jumat)
	const spmReminders = useMemo(
		() => buildSpmReminders(initialData.spmLsList),
		[initialData.spmLsList],
	);
	const spmAdvice = useMemo(() => tagihanAdvice(spmReminders), [spmReminders]);
	const spmLate = spmReminders.filter((r) => r.status === "Terlambat");
	const spmLateCount = spmLate.length;

	const handleCreateContract = async () => {
		setActionMessage(null);
		setErrorMessage(null);

		const val = Number.parseFloat(contractValue) || 0;
		setIsSubmitting(true);
		try {
			await addContract({
				contractNumber: contractNum.trim(),
				accountCode: contractAccount,
				value: val.toFixed(2),
				signedAt: signedDate,
				paymentType,
				sp2dAt: sp2dDate ? sp2dDate : null,
			});

			setActionMessage("Data kontrak berhasil ditambahkan.");
			setIsContractDrawerOpen(false);
			setContractNum("");
			setContractValue("");
			setSp2dDate("");
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal menambahkan kontrak.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleCreateSpm = async () => {
		setActionMessage(null);
		setErrorMessage(null);

		if (!selectedContractId) {
			setErrorMessage("Pilih kontrak terkait terlebih dahulu.");
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

	const handleDeleteContract = async (id: string) => {
		if (
			!confirm(
				"Hapus data kontrak ini? SPM terkait juga mungkin terpengaruh.",
			)
		) {
			return;
		}
		try {
			await removeContract(id);
			setActionMessage("Kontrak berhasil dihapus.");
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal menghapus kontrak.",
			);
		}
	};

	const handleDeleteSpm = async (id: string) => {
		if (!confirm("Hapus data SPM-LS ini?")) {
			return;
		}
		try {
			await removeSpmLs(id);
			setActionMessage("SPM-LS berhasil dihapus.");
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal menghapus SPM-LS.",
			);
		}
	};

	const filteredContracts = initialData.contracts.filter((c) =>
		c.contractNumber.toLowerCase().includes(search.toLowerCase()),
	);

	const filteredSpm = initialData.spmLsList.filter((s) =>
		s.referenceNumber.toLowerCase().includes(search.toLowerCase()),
	);

	const contractColumns: ColumnDef<ContractRecord>[] = [
		{
			key: "number",
			header: "Nomor Kontrak (CAN)",
			render: (item) => (
				<div>
					<span className="font-semibold text-foreground">
						{item.contractNumber}
					</span>
					<p className="text-[11px] text-muted-foreground">
						Akun {item.accountCode} - {ACCOUNT_LABELS[item.accountCode] || ""}
					</p>
				</div>
			),
		},
		{
			key: "value",
			header: "Nilai Kontrak",
			render: (item) => (
				<span className="font-semibold text-foreground">
					{formatRupiah(Number.parseFloat(item.value))}
				</span>
			),
		},
		{
			key: "signed",
			header: "Tanggal TTD",
			render: (item) => (
				<span className="inline-flex items-center gap-1.5 text-foreground">
					<Calendar className="size-3.5 text-muted-foreground" />
					<span>{item.signedAt}</span>
				</span>
			),
		},
		{
			key: "type",
			header: "Tipe Pembayaran",
			render: (item) => (
				<span className="rounded-md bg-surface px-2 py-0.5 text-[11px] font-semibold text-foreground">
					{item.paymentType === "sekaligus" ? "Sekaligus (100%)" : "Termin / Bertahap"}
				</span>
			),
		},
		{
			key: "sp2d",
			header: "Tanggal SP2D",
			render: (item) => (
				<span className="text-xs text-muted-foreground">
					{item.sp2dAt || "Belum Terbit"}
				</span>
			),
		},
		{
			key: "actions",
			header: "Aksi",
			render: (item) => (
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => {
							setSelectedContractId(item.id);
							setIsSpmDrawerOpen(true);
						}}
						className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition"
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
						{parentContract?.contractNumber || "Kontrak ID: " + item.contractId.slice(0, 8)}
					</span>
				);
			},
		},
		{
			key: "bast",
			header: "Tanggal BAST / BAPP",
			render: (item) => (
				<span className="inline-flex items-center gap-1.5 text-foreground">
					<Calendar className="size-3.5 text-muted-foreground" />
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
		<OperatorShell currentPath="/operator/data/contracts-invoices">
			<div className="space-y-6">
				{/* Top Summary Banner */}
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div className="flex items-center gap-3">
						<div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<FileCheck className="size-5" />
						</div>
						<div>
							<h1 className="text-lg font-bold text-foreground sm:text-xl">
								Kontrak &amp; Penyelesaian Tagihan (SPM-LS)
							</h1>
							<p className="text-xs text-muted-foreground">
								Pantau kepatuhan penyampaian data kontrak (3 hari kerja) dan
								ketepatan waktu penyelesaian tagihan SPM-LS (17 hari kerja).
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => setIsContractDrawerOpen(true)}
							className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90"
						>
							<Plus className="size-3.5" />
							<span>Tambah Kontrak</span>
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

				{/* Summary Metrics */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-medium">Jumlah Kontrak</span>
							<FileText className="size-4 text-primary" />
						</div>
						<p className="text-lg font-bold text-foreground sm:text-xl">
							{initialData.contracts.length} Kontrak
						</p>
						<p className="text-[11px] text-muted-foreground">
							Tercatat di SPAN/Sakti
						</p>
					</div>

					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-medium">Total Nilai Kontrak</span>
							<Receipt className="size-4 text-success" />
						</div>
						<p className="text-lg font-bold text-foreground sm:text-xl">
							{formatRupiah(totalContractValue)}
						</p>
						<p className="text-[11px] text-muted-foreground">
							Komitmen belanja kontraktual
						</p>
					</div>

					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-medium">Jumlah SPM-LS Terbit</span>
							<Clock className="size-4 text-warning" />
						</div>
						<p className="text-lg font-bold text-foreground sm:text-xl">
							{initialData.spmLsList.length} Berkas
						</p>
						<p className="text-[11px] text-muted-foreground">
							Target batas waktu: 17 HK setelah BAST
						</p>
					</div>
				</div>

				{/* Strip reminder H+17 wajib + rekomendasi kontekstual */}
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
											{r.receivedDate ? ` · diterima ${r.receivedDate}` : " · belum diterima"} ·{" "}
											{r.elapsedWorkdays !== null ? `${r.elapsedWorkdays} hari kerja` : "—"}
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

				{/* Tabs */}
				<div className="flex items-center gap-2 border-b border-border pb-2">
					<button
						type="button"
						onClick={() => setActiveTab("contracts")}
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
						onClick={() => setActiveTab("spm")}
						className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${
							activeTab === "spm"
								? "bg-primary text-primary-foreground shadow-xs"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						Tagihan SPM-LS ({initialData.spmLsList.length})
					</button>
				</div>

				{/* Table Views */}
				{activeTab === "contracts" ? (
					<DomainDataTable
						title="Daftar Komitmen Data Kontrak"
						data={filteredContracts}
						columns={contractColumns}
						searchValue={search}
						onSearchChange={setSearch}
						onAddClick={() => setIsContractDrawerOpen(true)}
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

				{/* Drawer 1: Form Tambah Kontrak */}
				<DomainFormDrawer
					isOpen={isContractDrawerOpen}
					title="Tambah Data Kontrak Baru"
					description="Masukkan rincian komitmen kontrak belanja non-pegawai / modal."
					onClose={() => setIsContractDrawerOpen(false)}
					onSubmit={handleCreateContract}
					isSubmitting={isSubmitting}
				>
					<div className="space-y-4">
						<div className="space-y-1.5">
							<label
								htmlFor="contract-num"
								className="block text-xs font-semibold text-foreground"
							>
								Nomor Kontrak / CAN
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
									Akun Belanja
								</label>
								<select
									id="contract-acc"
									value={contractAccount}
									onChange={(e) =>
										setContractAccount(
											e.target.value as "51" | "52" | "53",
										)
									}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								>
									<option value="53">Belanja Modal (53)</option>
									<option value="52">Belanja Barang (52)</option>
									<option value="51">Belanja Pegawai (51)</option>
								</select>
							</div>

							<div className="space-y-1.5">
								<label
									htmlFor="contract-val"
									className="block text-xs font-semibold text-foreground"
								>
									Nilai Kontrak (Rp)
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
									Tanggal TTD Kontrak
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
									Tipe Pembayaran
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
								Tanggal SP2D Terbit (Opsional jika sudah lunas)
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
			</div>
		</OperatorShell>
	);
}

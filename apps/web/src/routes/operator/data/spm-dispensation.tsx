import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
	AlertCircle,
	AlertTriangle,
	Calendar,
	CheckCircle2,
	Clock,
	FileText,
	Plus,
	ShieldAlert,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import {
	type ColumnDef,
	DomainDataTable,
} from "@/components/data/domain-data-table";
import { DomainFormDrawer } from "@/components/data/domain-form-drawer";
import { OperatorShell } from "@/components/layout/operator-shell";
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

function SpmDispensationPage() {
	const router = useRouter();
	const initialData = Route.useLoaderData();

	const [search, setSearch] = useState("");
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [actionMessage, setActionMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	// Form State
	const [refNumber, setRefNumber] = useState("");
	const [issueDate, setIssueDate] = useState("2026-11-15");
	const [isDispensasi, setIsDispensasi] = useState(true);

	// Calculations
	const totalQ4 = initialData.spmQ4List.length;
	const dispensationCount = initialData.spmQ4List.filter(
		(s) => s.isDispensasi,
	).length;
	const ratioPermil =
		totalQ4 > 0 ? (dispensationCount / totalQ4) * 1000 : 0;

	let estimatedDeduction = 0;
	if (dispensationCount > 0) {
		if (ratioPermil <= 50) estimatedDeduction = 0.5;
		else if (ratioPermil <= 100) estimatedDeduction = 0.75;
		else estimatedDeduction = 1.0;
	}

	const filteredData = initialData.spmQ4List.filter((item) =>
		item.referenceNumber.toLowerCase().includes(search.toLowerCase()),
	);

	const handleCreateSpm = async () => {
		setActionMessage(null);
		setErrorMessage(null);

		const month = new Date(issueDate).getMonth() + 1;
		if (month < 10 || month > 12) {
			setErrorMessage(
				"Tanggal penerbitan SPM Q4 harus berada pada Triwulan IV (Oktober - Desember).",
			);
			return;
		}

		setIsSubmitting(true);
		try {
			await addSpmDispensasi({
				referenceNumber: refNumber.trim(),
				issuedAt: issueDate,
				isDispensasi,
			});

			setActionMessage("Data SPM Triwulan IV berhasil dicatat.");
			setIsDrawerOpen(false);
			setRefNumber("");
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
		try {
			await editSpmDispensasi({
				spmId: item.id,
				isDispensasi: !item.isDispensasi,
			});
			setActionMessage(
				`Status dispensasi SPM ${item.referenceNumber} berhasil diubah.`,
			);
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal memperbarui status.",
			);
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Hapus data SPM Q4 ini?")) {
			return;
		}
		try {
			await removeSpmDispensasi(id);
			setActionMessage("Data SPM berhasil dihapus.");
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal menghapus data.",
			);
		}
	};

	const columns: ColumnDef<SpmQ4Record>[] = [
		{
			key: "spm",
			header: "Nomor SPM Q4",
			render: (item) => (
				<div>
					<span className="font-semibold text-foreground">
						{item.referenceNumber}
					</span>
					<p className="text-[11px] text-muted-foreground">Triwulan IV 2026</p>
				</div>
			),
		},
		{
			key: "date",
			header: "Tanggal Penerbitan",
			render: (item) => (
				<span className="inline-flex items-center gap-1.5 text-foreground font-medium">
					<Calendar className="size-3.5 text-muted-foreground" />
					<span>{item.issuedAt}</span>
				</span>
			),
		},
		{
			key: "status",
			header: "Status Dispensasi",
			render: (item) => (
				<span
					className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
						item.isDispensasi
							? "bg-danger/10 text-danger"
							: "bg-success/10 text-success"
					}`}
				>
					{item.isDispensasi ? "Dispensasi KPPN (Pengurang)" : "Penerbitan Normal"}
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
						onClick={() => handleToggleDispensasi(item)}
						className="inline-flex items-center rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-surface-muted transition"
					>
						{item.isDispensasi ? "Set Normal" : "Set Dispensasi"}
					</button>
					<button
						type="button"
						onClick={() => handleDelete(item.id)}
						className="inline-flex items-center rounded-lg p-1.5 text-danger hover:bg-danger/10 transition"
						title="Hapus SPM"
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
				{/* Top Summary Banner */}
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div className="flex items-center gap-3">
						<div className="flex size-10 items-center justify-center rounded-xl bg-danger/10 text-danger">
							<ShieldAlert className="size-5" />
						</div>
						<div>
							<h1 className="text-lg font-bold text-foreground sm:text-xl">
								Dispensasi Penerbitan SPM Triwulan IV
							</h1>
							<p className="text-xs text-muted-foreground">
								Pantau rasio penerbitan SPM dispensasi pada akhir tahun anggaran
								sebagai faktor pengurang nilai total IKPA.
							</p>
						</div>
					</div>

					<div className="flex items-center gap-3">
						<div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-2 text-right">
							<span className="text-[11px] text-muted-foreground">
								Potensi Pengurang IKPA
							</span>
							<p className="text-base font-bold text-danger">
								−{estimatedDeduction.toFixed(2)} Poin
							</p>
						</div>

						<button
							type="button"
							onClick={() => setIsDrawerOpen(true)}
							className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90"
						>
							<Plus className="size-3.5" />
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

				{/* Summary Metrics */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-medium">Total SPM Q4</span>
							<FileText className="size-4 text-primary" />
						</div>
						<p className="text-lg font-bold text-foreground sm:text-xl">
							{totalQ4} SPM
						</p>
						<p className="text-[11px] text-muted-foreground">
							Penerbitan bulan Oktober - Desember
						</p>
					</div>

					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-medium">SPM Dispensasi</span>
							<AlertTriangle className="size-4 text-danger" />
						</div>
						<p className="text-lg font-bold text-danger sm:text-xl">
							{dispensationCount} SPM
						</p>
						<p className="text-[11px] text-muted-foreground">
							Rasio: {ratioPermil.toFixed(2)} ‰ (Permil)
						</p>
					</div>

					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-medium">Pinalti Nilai</span>
							<Clock className="size-4 text-warning" />
						</div>
						<p className="text-lg font-bold text-foreground sm:text-xl">
							{estimatedDeduction > 0
								? `−${estimatedDeduction.toFixed(2)} Poin`
								: "0 (Nihil)"}
						</p>
						<p className="text-[11px] text-muted-foreground">
							Maksimal pengurangan: −5,00 Poin
						</p>
					</div>
				</div>

				{/* Data Table */}
				<DomainDataTable
					title="Daftar Penerbitan SPM Q4 & Riwayat Dispensasi"
					data={filteredData}
					columns={columns}
					searchValue={search}
					onSearchChange={setSearch}
					onAddClick={() => {
						setRefNumber("");
						setIssueDate("2026-11-15");
						setIsDispensasi(true);
						setIsDrawerOpen(true);
					}}
					onImportClick={() => {
						window.location.href = "/operator/import";
					}}
					totalCount={filteredData.length}
				/>

				{/* Form Drawer: Tambah SPM Q4 */}
				<DomainFormDrawer
					isOpen={isDrawerOpen}
					title="Catat Penerbitan SPM Triwulan IV"
					description="Masukkan data SPM yang diajukan pada periode akhir tahun (Oktober - Desember 2026)."
					onClose={() => setIsDrawerOpen(false)}
					onSubmit={handleCreateSpm}
					isSubmitting={isSubmitting}
				>
					<div className="space-y-4">
						<div className="space-y-1.5">
							<label
								htmlFor="spm-q4-ref"
								className="block text-xs font-semibold text-foreground"
							>
								Nomor SPM
							</label>
							<input
								id="spm-q4-ref"
								type="text"
								required
								placeholder="Contoh: 00451/SPM-LS/411782/2026"
								value={refNumber}
								onChange={(e) => setRefNumber(e.target.value)}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							/>
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="spm-q4-date"
								className="block text-xs font-semibold text-foreground"
							>
								Tanggal Penerbitan SPM (TW IV: Okt-Des)
							</label>
							<input
								id="spm-q4-date"
								type="date"
								required
								min="2026-10-01"
								max="2026-12-31"
								value={issueDate}
								onChange={(e) => setIssueDate(e.target.value)}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							/>
						</div>

						<div className="flex items-center gap-2 pt-1">
							<input
								id="spm-q4-is-disp"
								type="checkbox"
								checked={isDispensasi}
								onChange={(e) => setIsDispensasi(e.target.checked)}
								disabled={isSubmitting}
								className="size-4 rounded border-border text-primary focus:ring-primary"
							/>
							<label
								htmlFor="spm-q4-is-disp"
								className="text-xs text-foreground font-medium cursor-pointer"
							>
								Diterbitkan dengan Surat Dispensasi KPPN
							</label>
						</div>
					</div>
				</DomainFormDrawer>
			</div>
		</OperatorShell>
	);
}

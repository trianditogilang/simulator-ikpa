import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
	AlertCircle,
	Calendar,
	CheckCircle2,
	Coins,
	Plus,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import {
	type ColumnDef,
	DomainDataTable,
} from "@/components/data/domain-data-table";
import { DomainFormDrawer } from "@/components/data/domain-form-drawer";
import { FormattedNumberInput } from "@/components/data/formatted-number-input";
import { OperatorShell } from "@/components/layout/operator-shell";
import { formatRupiah } from "@/lib/format";
import {
	addRevision,
	fetchBudgetAndRevisions,
	removeRevision,
	saveBudget,
	type DipaRevisionRecord,
} from "@/services/budget-revisions-service";

export const Route = createFileRoute("/operator/data/budget-revisions")({
	loader: async ({ context }) => {
		const activeOrgId =
			context.auth?.isAuthenticated &&
			(context.access?.status === "operator_single_scope" ||
				context.access?.status === "operator_multiple_scopes")
				? (context.access.activeOrganizationId ?? undefined)
				: undefined;

		return fetchBudgetAndRevisions(activeOrgId);
	},
	component: BudgetRevisionsPage,
});

const ACCOUNT_LABELS: Record<string, string> = {
	"51": "Belanja Pegawai (51)",
	"52": "Belanja Barang (52)",
	"53": "Belanja Modal (53)",
	"57": "Belanja Bantuan Sosial (57)",
};

function BudgetRevisionsPage() {
	const router = useRouter();
	const initialData = Route.useLoaderData();

	const [isRevisionDrawerOpen, setIsRevisionDrawerOpen] = useState(false);
	const [isBudgetDrawerOpen, setIsBudgetDrawerOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [actionMessage, setActionMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	// Revision Form State
	const [revDate, setRevDate] = useState(
		new Date().toISOString().slice(0, 10),
	);
	const [revCode, setRevCode] = useState("");
	const [paguBefore, setPaguBefore] = useState("");
	const [paguAfter, setPaguAfter] = useState("");
	const [revNotes, setRevNotes] = useState("");

	// Budget Form State
	const [budgetAccount, setBudgetAccount] = useState<
		"51" | "52" | "53" | "57"
	>("51");
	const [budgetAmount, setBudgetAmount] = useState("");
	const [budgetEffectiveDate, setBudgetEffectiveDate] = useState(
		new Date().toISOString().slice(0, 10),
	);

	// Total calculation
	const totalPagu = initialData.budgets.reduce(
		(sum, b) => sum + (Number.parseFloat(b.amount) || 0),
		0,
	);

	const filteredRevisions = initialData.revisions.filter(
		(item) =>
			item.revisionCode.toLowerCase().includes(search.toLowerCase()) ||
			(item.notes &&
				item.notes.toLowerCase().includes(search.toLowerCase())),
	);

	const handleCreateRevision = async () => {
		setActionMessage(null);
		setErrorMessage(null);

		const beforeVal = Number.parseFloat(paguBefore) || 0;
		const afterVal = Number.parseFloat(paguAfter) || 0;

		setIsSubmitting(true);
		try {
			await addRevision({
				revisionDate: revDate,
				revisionCode: revCode.trim(),
				paguBefore: beforeVal.toFixed(2),
				paguAfter: afterVal.toFixed(2),
				notes: revNotes.trim() || undefined,
			});

			setActionMessage("Data revisi DIPA berhasil disimpan.");
			setIsRevisionDrawerOpen(false);
			setRevCode("");
			setPaguBefore("");
			setPaguAfter("");
			setRevNotes("");
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal menyimpan revisi DIPA.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSaveBudget = async () => {
		setActionMessage(null);
		setErrorMessage(null);

		const amountVal = Number.parseFloat(budgetAmount) || 0;

		setIsSubmitting(true);
		try {
			await saveBudget({
				accountCode: budgetAccount,
				amount: amountVal.toFixed(2),
				effectiveAt: budgetEffectiveDate,
			});

			setActionMessage(
				`Alokasi ${ACCOUNT_LABELS[budgetAccount]} berhasil diperbarui.`,
			);
			setIsBudgetDrawerOpen(false);
			setBudgetAmount("");
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error
					? err.message
					: "Gagal menyimpan alokasi pagu.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDeleteRevision = async (id: string) => {
		if (!confirm("Apakah Anda yakin ingin menghapus catatan revisi ini?")) {
			return;
		}

		try {
			await removeRevision(id);
			setActionMessage("Catatan revisi berhasil dihapus.");
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal menghapus revisi.",
			);
		}
	};

	const columns: ColumnDef<DipaRevisionRecord>[] = [
		{
			key: "date",
			header: "Tanggal Pengesahan",
			render: (item) => (
				<span className="inline-flex items-center gap-1.5 font-medium text-foreground">
					<Calendar className="size-3.5 text-muted-foreground" />
					<span>{item.revisionDate}</span>
				</span>
			),
		},
		{
			key: "code",
			header: "Nomor / Kode Revisi",
			render: (item) => (
				<span className="font-semibold text-foreground">
					{item.revisionCode}
				</span>
			),
		},
		{
			key: "paguBefore",
			header: "Pagu Sebelum",
			render: (item) => formatRupiah(Number.parseFloat(item.paguBefore)),
		},
		{
			key: "paguAfter",
			header: "Pagu Sesudah",
			render: (item) => (
				<span className="font-semibold text-foreground">
					{formatRupiah(Number.parseFloat(item.paguAfter))}
				</span>
			),
		},
		{
			key: "delta",
			header: "Perubahan",
			render: (item) => {
				const delta =
					Number.parseFloat(item.paguAfter) -
					Number.parseFloat(item.paguBefore);
				const isPositive = delta > 0;
				const isZero = delta === 0;

				if (isZero) {
					return (
						<span className="text-muted-foreground">Tetap (0)</span>
					);
				}

				return (
					<span
						className={`font-semibold ${
							isPositive ? "text-success" : "text-danger"
						}`}
					>
						{isPositive ? "+" : ""}
						{formatRupiah(delta)}
					</span>
				);
			},
		},
		{
			key: "notes",
			header: "Catatan Perubahan",
			render: (item) => (
				<span className="text-xs text-muted-foreground">
					{item.notes || "-"}
				</span>
			),
		},
		{
			key: "actions",
			header: "Aksi",
			render: (item) => (
				<button
					type="button"
					onClick={() => handleDeleteRevision(item.id)}
					className="inline-flex items-center gap-1 rounded-lg p-1.5 text-danger hover:bg-danger/10 transition"
					title="Hapus Revisi"
				>
					<Trash2 className="size-3.5" />
				</button>
			),
		},
	];

	return (
		<OperatorShell currentPath="/operator/data/budget-revisions">
			<div className="space-y-6">
				{/* Top Summary Banner */}
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div className="flex items-center gap-3">
						<div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<Coins className="size-5" />
						</div>
						<div>
							<h1 className="text-lg font-bold text-foreground sm:text-xl">
								Pagu &amp; Histori Revisi DIPA
							</h1>
							<p className="text-xs text-muted-foreground">
								Kelola alokasi pagu DIPA per jenis belanja dan catat histori
								pengesahan revisi untuk penilaian indikator Revisi DIPA IKPA.
							</p>
						</div>
					</div>

					<div className="flex items-center gap-3">
						<div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 text-right">
							<span className="text-[11px] text-muted-foreground">
								Total Pagu Aktif TA {initialData.year}
							</span>
							<p className="text-base font-bold text-primary">
								{formatRupiah(totalPagu)}
							</p>
						</div>

						<button
							type="button"
							onClick={() => setIsBudgetDrawerOpen(true)}
							className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90"
						>
							<Plus className="size-3.5" />
							<span>Atur Pagu Belanja</span>
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

				{/* Budget Allocation Cards */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{(["51", "52", "53", "57"] as const).map((code) => {
						const budgetItem = initialData.budgets.find(
							(b) => b.accountCode === code,
						);
						const amount = budgetItem
							? Number.parseFloat(budgetItem.amount)
							: 0;

						return (
							<div
								key={code}
								className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-2"
							>
								<div className="flex items-center justify-between">
									<span className="rounded-md bg-surface px-2 py-0.5 text-[11px] font-bold text-foreground">
										Akun {code}
									</span>
									<button
										type="button"
										onClick={() => {
											setBudgetAccount(code);
											setBudgetAmount(amount ? amount.toString() : "");
											setIsBudgetDrawerOpen(true);
										}}
										className="text-[11px] font-semibold text-primary hover:underline"
									>
										Edit
									</button>
								</div>
								<p className="text-xs font-medium text-muted-foreground">
									{ACCOUNT_LABELS[code]}
								</p>
								<p className="text-sm font-bold text-foreground sm:text-base">
									{formatRupiah(amount)}
								</p>
							</div>
						);
					})}
				</div>

				{/* DIPA Revisions Data Table */}
				<DomainDataTable
					title="Daftar Pengesahan &amp; Riwayat Revisi DIPA"
					data={filteredRevisions}
					columns={columns}
					searchValue={search}
					onSearchChange={setSearch}
					onAddClick={() => {
						setPaguBefore(totalPagu > 0 ? totalPagu.toString() : "");
						setPaguAfter(totalPagu > 0 ? totalPagu.toString() : "");
						setIsRevisionDrawerOpen(true);
					}}
					totalCount={filteredRevisions.length}
				/>

				{/* Drawer 1: Form Tambah Revisi DIPA */}
				<DomainFormDrawer
					isOpen={isRevisionDrawerOpen}
					title="Catat Pengesahan Revisi DIPA"
					description="Masukkan data pengesahan revisi DIPA resmi untuk pencatatan frekuensi revisi per semester."
					onClose={() => setIsRevisionDrawerOpen(false)}
					onSubmit={handleCreateRevision}
					isSubmitting={isSubmitting}
				>
					<div className="space-y-4">
						<div className="space-y-1.5">
							<label
								htmlFor="rev-code"
								className="block text-xs font-semibold text-foreground"
							>
								Nomor / Kode Revisi DIPA
							</label>
							<input
								id="rev-code"
								type="text"
								required
								placeholder="Contoh: DIPA-015.08.2.411782/2026 Rev-01"
								value={revCode}
								onChange={(e) => setRevCode(e.target.value)}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							/>
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="rev-date"
								className="block text-xs font-semibold text-foreground"
							>
								Tanggal Pengesahan
							</label>
							<input
								id="rev-date"
								type="date"
								required
								value={revDate}
								onChange={(e) => setRevDate(e.target.value)}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							/>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<label
									htmlFor="pagu-before"
									className="block text-xs font-semibold text-foreground"
								>
									Pagu Sebelum (Rp)
								</label>
								<FormattedNumberInput
									id="pagu-before"
									required
									value={paguBefore}
									onChange={setPaguBefore}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
							</div>

							<div className="space-y-1.5">
								<label
									htmlFor="pagu-after"
									className="block text-xs font-semibold text-foreground"
								>
									Pagu Sesudah (Rp)
								</label>
								<FormattedNumberInput
									id="pagu-after"
									required
									value={paguAfter}
									onChange={setPaguAfter}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
							</div>
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="rev-notes"
								className="block text-xs font-semibold text-foreground"
							>
								Catatan Perubahan
							</label>
							<textarea
								id="rev-notes"
								rows={3}
								maxLength={500}
								placeholder="Deskripsi pergeseran antar akun / revisi kewenangan Kanwil / DJA"
								value={revNotes}
								onChange={(e) => setRevNotes(e.target.value)}
								disabled={isSubmitting}
								className="w-full rounded-lg border border-border bg-background p-3 text-xs text-foreground focus:border-primary focus:outline-none"
							/>
						</div>
					</div>
				</DomainFormDrawer>

				{/* Drawer 2: Form Atur Pagu Belanja */}
				<DomainFormDrawer
					isOpen={isBudgetDrawerOpen}
					title="Atur Alokasi Pagu Belanja"
					description="Tentukan alokasi pagu DIPA aktif per jenis belanja (51, 52, 53, 57)."
					onClose={() => setIsBudgetDrawerOpen(false)}
					onSubmit={handleSaveBudget}
					isSubmitting={isSubmitting}
				>
					<div className="space-y-4">
						<div className="space-y-1.5">
							<label
								htmlFor="budget-acc"
								className="block text-xs font-semibold text-foreground"
							>
								Jenis Belanja
							</label>
							<select
								id="budget-acc"
								value={budgetAccount}
								onChange={(e) =>
									setBudgetAccount(
										e.target.value as "51" | "52" | "53" | "57",
									)
								}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							>
								<option value="51">Belanja Pegawai (51)</option>
								<option value="52">Belanja Barang (52)</option>
								<option value="53">Belanja Modal (53)</option>
								<option value="57">Belanja Bantuan Sosial (57)</option>
							</select>
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="budget-amount"
								className="block text-xs font-semibold text-foreground"
							>
								Alokasi Pagu (Rp)
							</label>
							<FormattedNumberInput
								id="budget-amount"
								required
								placeholder="Contoh: 1.500.000.000"
								value={budgetAmount}
								onChange={setBudgetAmount}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							/>
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="budget-eff-date"
								className="block text-xs font-semibold text-foreground"
							>
								Tanggal Efektif
							</label>
							<input
								id="budget-eff-date"
								type="date"
								required
								value={budgetEffectiveDate}
								onChange={(e) => setBudgetEffectiveDate(e.target.value)}
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

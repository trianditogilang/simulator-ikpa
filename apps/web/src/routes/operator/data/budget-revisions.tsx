import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
	AlertCircle,
	Calendar,
	CheckCircle2,
	Coins,
	Pencil,
	Plus,
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
	calcRevisiScore,
	countObjek,
	MAX_REVISI_JENIS,
	parseRevisionCodes,
	previewRevisi,
	REVISI_JENIS,
	semesterRoman,
	semesterStatus,
} from "@/lib/simulation/revisi-dipa-workspace";
import { default2026RuleSet } from "@simulator-ikpa/ikpa-engine";
import {
	addRevision,
	editRevision,
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
	const [editingRevisionId, setEditingRevisionId] = useState<string | null>(
		null,
	);
	const [isBudgetDrawerOpen, setIsBudgetDrawerOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [semesterFilter, setSemesterFilter] = useState<"all" | "1" | "2">("all");
	const [onlyObjek, setOnlyObjek] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [actionMessage, setActionMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	// Revision Form State
	const [revDate, setRevDate] = useState(
		new Date().toISOString().slice(0, 10),
	);
	const [revCodes, setRevCodes] = useState<string[]>([]);
	const [revJenisSelect, setRevJenisSelect] = useState("");
	const [revCustom, setRevCustom] = useState("");
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

	const eligibleCodes = default2026RuleSet.revisionEligibilityCodes;
	const { s1, s2, classified } = useMemo(
		() =>
			countObjek(
				initialData.revisions.map((r) => ({
					revisionDate: r.revisionDate,
					revisionCode: r.revisionCode,
					paguBefore: r.paguBefore,
					paguAfter: r.paguAfter,
				})),
				eligibleCodes,
				initialData.year,
			),
		[initialData.revisions, initialData.year, eligibleCodes],
	);
	const skor = useMemo(() => calcRevisiScore(s1, s2), [s1, s2]);
	const byId = useMemo(() => {
		const m = new Map<string, (typeof classified)[number]>();
		initialData.revisions.forEach((r, i) => m.set(r.id, classified[i]));
		return m;
	}, [initialData.revisions, classified]);

	const preview = useMemo(
		() =>
			previewRevisi(
				{
					revisionDate: revDate,
					revisionCode: revCodes.join(", "),
					paguBefore: paguBefore || "0",
					paguAfter: paguAfter || "0",
				},
				eligibleCodes,
				initialData.year,
			),
		[revDate, revCodes, paguBefore, paguAfter, eligibleCodes, initialData.year],
	);
	const previewDelta =
		(Number.parseFloat(paguAfter) || 0) - (Number.parseFloat(paguBefore) || 0);

	const revisiNo = useMemo(() => {
		const order = [...initialData.revisions].sort((a, b) =>
			a.revisionDate < b.revisionDate ? -1 : a.revisionDate > b.revisionDate ? 1 : 0,
		);
		const m = new Map<string, number>();
		order.forEach((r, i) => m.set(r.id, i + 1));
		return m;
	}, [initialData.revisions]);

	const filteredRevisions = initialData.revisions.filter((item) => {
		const c = byId.get(item.id);
		if (semesterFilter !== "all" && String(c?.semester) !== semesterFilter)
			return false;
		if (onlyObjek && !c?.isObjek) return false;
		return (
			item.revisionCode.toLowerCase().includes(search.toLowerCase()) ||
			(item.notes &&
				item.notes.toLowerCase().includes(search.toLowerCase()))
		);
	});

	const handleAddJenis = (code: string) => {
		const c = code.trim();
		if (!c) return;
		if (!/^\d{3}$/.test(c)) {
			setErrorMessage("Kode jenis revisi harus 3 angka.");
			return;
		}
		setErrorMessage(null);
		setRevCodes((prev) => {
			if (prev.includes(c) || prev.length >= MAX_REVISI_JENIS) return prev;
			return [...prev, c];
		});
	};

	const handleOpenCreateRevision = () => {
		setEditingRevisionId(null);
		setRevDate(new Date().toISOString().slice(0, 10));
		setRevCodes([]);
		setRevJenisSelect("");
		setRevCustom("");
		setPaguBefore(totalPagu > 0 ? totalPagu.toString() : "");
		setPaguAfter(totalPagu > 0 ? totalPagu.toString() : "");
		setRevNotes("");
		setErrorMessage(null);
		setIsRevisionDrawerOpen(true);
	};

	const handleOpenEditRevision = (item: DipaRevisionRecord) => {
		setEditingRevisionId(item.id);
		setRevDate(item.revisionDate);
		setRevCodes(parseRevisionCodes(item.revisionCode));
		setRevJenisSelect("");
		setRevCustom("");
		setPaguBefore(item.paguBefore);
		setPaguAfter(item.paguAfter);
		setRevNotes(item.notes || "");
		setErrorMessage(null);
		setIsRevisionDrawerOpen(true);
	};

	const handleCloseRevisionDrawer = () => {
		setIsRevisionDrawerOpen(false);
		setEditingRevisionId(null);
		setRevCodes([]);
		setRevJenisSelect("");
		setRevCustom("");
		setPaguBefore("");
		setPaguAfter("");
		setRevNotes("");
	};

	const handleSaveRevision = async () => {
		setActionMessage(null);
		setErrorMessage(null);

		if (revCodes.length === 0) {
			setErrorMessage("Pilih minimal 1 jenis revisi.");
			return;
		}

		const beforeVal = Number.parseFloat(paguBefore) || 0;
		const afterVal = Number.parseFloat(paguAfter) || 0;

		setIsSubmitting(true);
		try {
			if (editingRevisionId) {
				await editRevision({
					revisionId: editingRevisionId,
					revisionDate: revDate,
					revisionCode: revCodes.join(", "),
					paguBefore: beforeVal.toFixed(2),
					paguAfter: afterVal.toFixed(2),
					notes: revNotes.trim() || undefined,
				});
				setActionMessage("Data revisi DIPA berhasil diperbarui.");
			} else {
				await addRevision({
					revisionDate: revDate,
					revisionCode: revCodes.join(", "),
					paguBefore: beforeVal.toFixed(2),
					paguAfter: afterVal.toFixed(2),
					notes: revNotes.trim() || undefined,
				});
				setActionMessage("Data revisi DIPA berhasil disimpan.");
			}

			handleCloseRevisionDrawer();
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
			key: "no",
			header: "Revisi Ke-",
			render: (item) => (
				<span className="text-xs font-semibold text-foreground">
					{revisiNo.get(item.id) ?? "-"}
				</span>
			),
		},
		{
			key: "date",
			header: "Tanggal Revisi",
			render: (item) => (
				<span className="inline-flex items-center gap-1.5 font-medium text-foreground">
					<Calendar className="size-3.5 text-muted-foreground" />
					<span>{item.revisionDate}</span>
				</span>
			),
		},
		{
			key: "code",
			header: "Jenis Revisi",
			render: (item) => (
				<span className="flex flex-wrap gap-1">
					{parseRevisionCodes(item.revisionCode).map((c) => (
						<span
							key={c}
							title={REVISI_JENIS[c] ?? c}
							className="rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-bold text-foreground"
						>
							{c}
						</span>
					))}
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
			header: "Perubahan Pagu",
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
			key: "semester",
			header: "Semester",
			render: (item) => {
				const c = byId.get(item.id);
				return (
					<span className="text-xs font-semibold text-foreground">
						{semesterRoman(c?.semester ?? 0)}
					</span>
				);
			},
		},
		{
			key: "objek",
			header: "Objek Perhitungan",
			render: (item) => {
				const c = byId.get(item.id);
				if (!c) return <span>-</span>;
				if (c.isObjek)
					return (
						<span className="rounded-md bg-success/10 px-2 py-0.5 text-[11px] font-bold text-success">
							Dihitung
						</span>
					);
				const label =
					c.reason === "awal"
						? "Pengesahan awal (dikecualikan)"
						: c.reason === "pagu-berubah"
							? "Tidak dihitung — pagu berubah"
							: "Tidak dihitung — kode di luar 14 jenis";
				return (
					<span
						title={label}
						className="rounded-md bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
					>
						{label}
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
						onClick={() => handleOpenEditRevision(item)}
						className="inline-flex items-center rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition"
						title="Edit Revisi"
						aria-label={`Edit revisi ${revisiNo.get(item.id) ?? item.id}`}
					>
						<Pencil className="size-3.5" />
					</button>
					<button
						type="button"
						onClick={() => handleDeleteRevision(item.id)}
						className="inline-flex items-center rounded-lg p-1.5 text-danger hover:bg-danger/10 transition"
						title="Hapus Revisi"
						aria-label={`Hapus revisi ${revisiNo.get(item.id) ?? item.id}`}
					>
						<Trash2 className="size-3.5" />
					</button>
				</div>
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
								Revisi DIPA · Bobot 10% · Dinilai per semester, hanya revisi
								pagu tetap.
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

				{/* Skor langsung */}
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					{[
						{ title: "NKRA Semester I", sub: `${s1} objek terhitung · ${semesterStatus(s1)}`, value: skor.nkraS1 },
						{ title: "NKRA Semester II", sub: `${s2} objek terhitung · ${semesterStatus(s2)}`, value: skor.nkraS2 },
						{ title: "Nilai tahunan", sub: "(I+II)/2", value: skor.annual },
						{ title: "Kontribusi ke IKPA", sub: "×10%", value: skor.contribution },
					].map((k) => (
						<div key={k.title} className="rounded-2xl border border-border bg-background p-4 shadow-xs">
							<p className="text-[11px] font-semibold text-foreground">{k.title}</p>
							<p className="text-[11px] text-muted-foreground">{k.sub}</p>
							<p className="text-xl font-bold text-foreground">{k.value}</p>
						</div>
					))}
				</div>
				{s1 === 0 && s2 === 0 && (
					<p className="text-xs text-muted-foreground">
						Belum ada revisi objek — nilai 110 maksimal.
					</p>
				)}

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
				<p className="text-[11px] text-muted-foreground">
					Mengubah kartu pagu tidak menambah hitungan revisi. Yang dihitung
					hanya baris pengesahan di tabel.
				</p>

				{/* DIPA Revisions Data Table */}
				<div className="flex flex-wrap items-center gap-2 text-xs">
					<label className="font-semibold text-foreground">
						Semester{" "}
						<select
							value={semesterFilter}
							onChange={(e) =>
								setSemesterFilter(e.target.value as "all" | "1" | "2")
							}
							className="rounded-lg border border-border bg-background px-2 py-1"
						>
							<option value="all">Semua</option>
							<option value="1">I</option>
							<option value="2">II</option>
						</select>
					</label>
					<label className="inline-flex items-center gap-1.5 font-semibold text-foreground">
						<input
							type="checkbox"
							checked={onlyObjek}
							onChange={(e) => setOnlyObjek(e.target.checked)}
						/>
						Hanya objek penilaian
					</label>
					<span className="text-muted-foreground">
						Objek I: {s1} · Objek II: {s2}
					</span>
				</div>
				<DomainDataTable
					title="Daftar Pengesahan &amp; Riwayat Revisi DIPA"
					data={filteredRevisions}
					columns={columns}
					searchValue={search}
					onSearchChange={setSearch}
					onAddClick={handleOpenCreateRevision}
					totalCount={filteredRevisions.length}
				/>

				{/* Drawer 1: Form Tambah/Ubah Revisi DIPA */}
				<DomainFormDrawer
					isOpen={isRevisionDrawerOpen}
					title={
						editingRevisionId
							? "Ubah Catatan Pengesahan Revisi DIPA"
							: "Catat Pengesahan Revisi DIPA"
					}
					description={
						editingRevisionId
							? "Perbarui rincian data pengesahan revisi DIPA resmi untuk pencatatan frekuensi revisi per semester."
							: "Masukkan data pengesahan revisi DIPA resmi untuk pencatatan frekuensi revisi per semester."
					}
					onClose={handleCloseRevisionDrawer}
					onSubmit={handleSaveRevision}
					isSubmitting={isSubmitting}
				>
					<div className="space-y-4">
						<div className="space-y-1.5">
							<label
								htmlFor="rev-jenis"
								className="block text-xs font-semibold text-foreground"
							>
								Jenis Revisi (maksimal {MAX_REVISI_JENIS})
							</label>
							{revCodes.length > 0 && (
								<div className="flex flex-wrap gap-1.5">
									{revCodes.map((c) => (
										<span
											key={c}
											className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary"
										>
											{c}{REVISI_JENIS[c] ? ` — ${REVISI_JENIS[c]}` : ""}
											<button
												type="button"
												disabled={isSubmitting}
												onClick={() =>
													setRevCodes((prev) => prev.filter((x) => x !== c))
												}
												className="font-bold hover:underline"
												aria-label={`Hapus jenis ${c}`}
											>
												×
											</button>
										</span>
									))}
								</div>
							)}
							<select
								id="rev-jenis"
								value={revJenisSelect}
								onChange={(e) => {
									const v = e.target.value;
									setRevJenisSelect("");
									if (v) handleAddJenis(v);
								}}
								disabled={isSubmitting || revCodes.length >= MAX_REVISI_JENIS}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							>
								<option value="">Pilih jenis revisi…</option>
								{Object.entries(REVISI_JENIS).map(([code, desc]) => (
									<option key={code} value={code}>
										{code} — {desc}
									</option>
								))}
							</select>
							<div className="flex gap-2">
								<input
									id="rev-code"
									type="text"
									inputMode="numeric"
									maxLength={3}
									placeholder="Kode lain (3 angka)"
									value={revCustom}
									onChange={(e) => setRevCustom(e.target.value.replace(/\D/g, "").slice(0, 3))}
									disabled={isSubmitting || revCodes.length >= MAX_REVISI_JENIS}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
								<button
									type="button"
									disabled={isSubmitting || revCodes.length >= MAX_REVISI_JENIS}
									onClick={() => {
										handleAddJenis(revCustom);
										setRevCustom("");
									}}
									className="min-h-10 shrink-0 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-surface"
								>
									Tambah
								</button>
							</div>
							<p className="text-[11px] text-muted-foreground">
								14 kode pagu tetap tersedia di daftar; kode lain wajib 3
								angka. Satu revisi menampung {MAX_REVISI_JENIS} jenis.
							</p>
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="rev-date"
								className="block text-xs font-semibold text-foreground"
							>
								Tanggal Revisi
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
						<p className="text-xs text-muted-foreground">
							Δ pagu: {formatRupiah(previewDelta)}. Jika pagu berubah,
							revisi otomatis tidak dihitung.
						</p>
						<p role="status" className="text-xs font-semibold text-foreground">
							{preview.reason === "pagu-berubah"
								? `Revisi ini tidak dihitung karena pagu satker berubah (${formatRupiah(previewDelta)}).`
								: preview.reason === "awal"
									? "Pengesahan awal dikecualikan — tidak dihitung."
									: preview.reason === "kode-luar"
										? "Revisi ini tidak dihitung — kode di luar 14 jenis."
										: preview.semester === 0
											? "Tanggal di luar TA — tidak dihitung semester ini."
											: `Revisi ini dihitung sebagai objek Semester ${semesterRoman(preview.semester)}.`}
						</p>

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

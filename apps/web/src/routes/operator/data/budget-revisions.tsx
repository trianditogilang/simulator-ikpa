import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
	AlertCircle,
	Calendar,
	CheckCircle2,
	Coins,
	Info,
	Pencil,
	Plus,
	ShieldCheck,
	SlidersHorizontal,
	Sparkles,
	Trash2,
	TrendingUp,
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
	ACCOUNT_CODES,
	ACCOUNT_NAMES,
	type AccountCode,
	type AccountRevisionDetail,
	calcRevisiScore,
	countObjek,
	formatRevisionNotesPayload,
	MAX_REVISI_JENIS,
	parseRevisionCodes,
	parseRevisionNotesPayload,
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
	saveInitialBudgets,
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

function BudgetRevisionsPage() {
	const router = useRouter();
	const initialData = Route.useLoaderData();

	// Modal / Drawer state
	const [isRevisionDrawerOpen, setIsRevisionDrawerOpen] = useState(false);
	const [editingRevisionId, setEditingRevisionId] = useState<string | null>(
		null,
	);
	const [isInitialBudgetDrawerOpen, setIsInitialBudgetDrawerOpen] =
		useState(false);
	const [isSingleBudgetDrawerOpen, setIsSingleBudgetDrawerOpen] =
		useState(false);
	const [singleBudgetAccount, setSingleBudgetAccount] =
		useState<AccountCode>("51");
	const [singleBudgetAmount, setSingleBudgetAmount] = useState("");

	// Table filter & search state
	const [search, setSearch] = useState("");
	const [semesterFilter, setSemesterFilter] = useState<"all" | "1" | "2">("all");
	const [onlyObjek, setOnlyObjek] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [actionMessage, setActionMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	// Initial Budget (Pagu Awal TA) State for 4 accounts
	const [initialBudget51, setInitialBudget51] = useState("");
	const [initialBudget52, setInitialBudget52] = useState("");
	const [initialBudget53, setInitialBudget53] = useState("");
	const [initialBudget57, setInitialBudget57] = useState("");
	const [initialBudgetEffectiveDate, setInitialBudgetEffectiveDate] = useState(
		`${initialData.year}-01-01`,
	);

	// Revision Form State
	const [revDate, setRevDate] = useState(
		new Date().toISOString().slice(0, 10),
	);
	const [revCodes, setRevCodes] = useState<string[]>([]);
	const [revJenisSelect, setRevJenisSelect] = useState("");
	const [revCustom, setRevCustom] = useState("");
	const [revUserNotes, setRevUserNotes] = useState("");

	// Account breakdown in Revision Form (51, 52, 53, 57)
	const [revAcc51Before, setRevAcc51Before] = useState("");
	const [revAcc51After, setRevAcc51After] = useState("");
	const [revAcc52Before, setRevAcc52Before] = useState("");
	const [revAcc52After, setRevAcc52After] = useState("");
	const [revAcc53Before, setRevAcc53Before] = useState("");
	const [revAcc53After, setRevAcc53After] = useState("");
	const [revAcc57Before, setRevAcc57Before] = useState("");
	const [revAcc57After, setRevAcc57After] = useState("");

	// Current Active Budgets Map
	const budgetMap = useMemo(() => {
		const m = new Map<AccountCode, number>();
		ACCOUNT_CODES.forEach((c) => m.set(c, 0));
		initialData.budgets.forEach((b) => {
			if (ACCOUNT_CODES.includes(b.accountCode as AccountCode)) {
				m.set(
					b.accountCode as AccountCode,
					Number.parseFloat(b.amount) || 0,
				);
			}
		});
		return m;
	}, [initialData.budgets]);

	// Total active pagu
	const totalActivePagu = useMemo(() => {
		return ACCOUNT_CODES.reduce((sum, c) => sum + (budgetMap.get(c) || 0), 0);
	}, [budgetMap]);

	// Revision form real-time sums
	const formTotalBefore = useMemo(() => {
		return (
			(Number.parseFloat(revAcc51Before) || 0) +
			(Number.parseFloat(revAcc52Before) || 0) +
			(Number.parseFloat(revAcc53Before) || 0) +
			(Number.parseFloat(revAcc57Before) || 0)
		);
	}, [revAcc51Before, revAcc52Before, revAcc53Before, revAcc57Before]);

	const formTotalAfter = useMemo(() => {
		return (
			(Number.parseFloat(revAcc51After) || 0) +
			(Number.parseFloat(revAcc52After) || 0) +
			(Number.parseFloat(revAcc53After) || 0) +
			(Number.parseFloat(revAcc57After) || 0)
		);
	}, [revAcc51After, revAcc52After, revAcc53After, revAcc57After]);

	const formTotalDelta = formTotalAfter - formTotalBefore;

	// Eligible revision codes & score calculation
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

	// Real-time Preview in Revision Drawer
	const preview = useMemo(
		() =>
			previewRevisi(
				{
					revisionDate: revDate,
					revisionCode: revCodes.join(", "),
					paguBefore: formTotalBefore.toFixed(2),
					paguAfter: formTotalAfter.toFixed(2),
				},
				eligibleCodes,
				initialData.year,
			),
		[revDate, revCodes, formTotalBefore, formTotalAfter, eligibleCodes, initialData.year],
	);

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
		const parsed = parseRevisionNotesPayload(item.notes);
		return (
			item.revisionCode.toLowerCase().includes(search.toLowerCase()) ||
			parsed.userNotes.toLowerCase().includes(search.toLowerCase())
		);
	});

	// --- Handlers for Initial Budgets (Pagu Awal TA) ---
	const handleOpenInitialBudgetDrawer = () => {
		setInitialBudget51(String(budgetMap.get("51") || ""));
		setInitialBudget52(String(budgetMap.get("52") || ""));
		setInitialBudget53(String(budgetMap.get("53") || ""));
		setInitialBudget57(String(budgetMap.get("57") || ""));
		setInitialBudgetEffectiveDate(`${initialData.year}-01-01`);
		setErrorMessage(null);
		setIsInitialBudgetDrawerOpen(true);
	};

	const handleSaveInitialBudgets = async () => {
		setActionMessage(null);
		setErrorMessage(null);
		setIsSubmitting(true);
		try {
			const b51 = Number.parseFloat(initialBudget51) || 0;
			const b52 = Number.parseFloat(initialBudget52) || 0;
			const b53 = Number.parseFloat(initialBudget53) || 0;
			const b57 = Number.parseFloat(initialBudget57) || 0;

			await saveInitialBudgets({
				budgets: [
					{ accountCode: "51", amount: b51.toFixed(2) },
					{ accountCode: "52", amount: b52.toFixed(2) },
					{ accountCode: "53", amount: b53.toFixed(2) },
					{ accountCode: "57", amount: b57.toFixed(2) },
				],
				effectiveAt: initialBudgetEffectiveDate || `${initialData.year}-01-01`,
			});

			setActionMessage(
				`Pagu Awal Tahun Anggaran ${initialData.year} berhasil disimpan.`,
			);
			setIsInitialBudgetDrawerOpen(false);
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error
					? err.message
					: "Gagal menyimpan Pagu Awal Tahun Anggaran.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	// --- Handlers for Single Budget Edit ---
	const handleOpenSingleBudgetEdit = (code: AccountCode) => {
		setSingleBudgetAccount(code);
		const currentAmt = budgetMap.get(code) || 0;
		setSingleBudgetAmount(currentAmt > 0 ? currentAmt.toString() : "");
		setErrorMessage(null);
		setIsSingleBudgetDrawerOpen(true);
	};

	const handleSaveSingleBudget = async () => {
		setActionMessage(null);
		setErrorMessage(null);
		const amountVal = Number.parseFloat(singleBudgetAmount) || 0;
		setIsSubmitting(true);
		try {
			await saveBudget({
				accountCode: singleBudgetAccount,
				amount: amountVal.toFixed(2),
				effectiveAt: `${initialData.year}-01-01`,
			});

			setActionMessage(
				`Alokasi ${ACCOUNT_NAMES[singleBudgetAccount]} berhasil diperbarui.`,
			);
			setIsSingleBudgetDrawerOpen(false);
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

	// --- Handlers for Revision CRUD ---
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
		setRevUserNotes("");

		// Prefill before & after from currently active budgets
		const b51 = budgetMap.get("51") || 0;
		const b52 = budgetMap.get("52") || 0;
		const b53 = budgetMap.get("53") || 0;
		const b57 = budgetMap.get("57") || 0;

		setRevAcc51Before(b51 > 0 ? b51.toString() : "0");
		setRevAcc51After(b51 > 0 ? b51.toString() : "0");
		setRevAcc52Before(b52 > 0 ? b52.toString() : "0");
		setRevAcc52After(b52 > 0 ? b52.toString() : "0");
		setRevAcc53Before(b53 > 0 ? b53.toString() : "0");
		setRevAcc53After(b53 > 0 ? b53.toString() : "0");
		setRevAcc57Before(b57 > 0 ? b57.toString() : "0");
		setRevAcc57After(b57 > 0 ? b57.toString() : "0");

		setErrorMessage(null);
		setIsRevisionDrawerOpen(true);
	};

	const handleOpenEditRevision = (item: DipaRevisionRecord) => {
		setEditingRevisionId(item.id);
		setRevDate(item.revisionDate);
		setRevCodes(parseRevisionCodes(item.revisionCode));
		setRevJenisSelect("");
		setRevCustom("");

		const parsed = parseRevisionNotesPayload(item.notes);
		setRevUserNotes(parsed.userNotes);

		if (parsed.accountDetails) {
			setRevAcc51Before(parsed.accountDetails["51"]?.paguBefore || "0");
			setRevAcc51After(parsed.accountDetails["51"]?.paguAfter || "0");
			setRevAcc52Before(parsed.accountDetails["52"]?.paguBefore || "0");
			setRevAcc52After(parsed.accountDetails["52"]?.paguAfter || "0");
			setRevAcc53Before(parsed.accountDetails["53"]?.paguBefore || "0");
			setRevAcc53After(parsed.accountDetails["53"]?.paguAfter || "0");
			setRevAcc57Before(parsed.accountDetails["57"]?.paguBefore || "0");
			setRevAcc57After(parsed.accountDetails["57"]?.paguAfter || "0");
		} else {
			// Fallback if legacy item without per-account breakdown
			const b51 = budgetMap.get("51") || 0;
			const b52 = budgetMap.get("52") || 0;
			const b53 = budgetMap.get("53") || 0;
			const b57 = budgetMap.get("57") || 0;
			setRevAcc51Before(b51.toString());
			setRevAcc51After(b51.toString());
			setRevAcc52Before(b52.toString());
			setRevAcc52After(b52.toString());
			setRevAcc53Before(b53.toString());
			setRevAcc53After(b53.toString());
			setRevAcc57Before(b57.toString());
			setRevAcc57After(b57.toString());
		}

		setErrorMessage(null);
		setIsRevisionDrawerOpen(true);
	};

	const handleCloseRevisionDrawer = () => {
		setIsRevisionDrawerOpen(false);
		setEditingRevisionId(null);
		setRevCodes([]);
		setRevJenisSelect("");
		setRevCustom("");
		setRevUserNotes("");
	};

	const handleSaveRevision = async () => {
		setActionMessage(null);
		setErrorMessage(null);

		if (revCodes.length === 0) {
			setErrorMessage("Pilih minimal 1 jenis revisi.");
			return;
		}

		const a51B = Number.parseFloat(revAcc51Before) || 0;
		const a51A = Number.parseFloat(revAcc51After) || 0;
		const a52B = Number.parseFloat(revAcc52Before) || 0;
		const a52A = Number.parseFloat(revAcc52After) || 0;
		const a53B = Number.parseFloat(revAcc53Before) || 0;
		const a53A = Number.parseFloat(revAcc53After) || 0;
		const a57B = Number.parseFloat(revAcc57Before) || 0;
		const a57A = Number.parseFloat(revAcc57After) || 0;

		const accountDetails: AccountRevisionDetail[] = [
			{ accountCode: "51", paguBefore: a51B.toFixed(2), paguAfter: a51A.toFixed(2) },
			{ accountCode: "52", paguBefore: a52B.toFixed(2), paguAfter: a52A.toFixed(2) },
			{ accountCode: "53", paguBefore: a53B.toFixed(2), paguAfter: a53A.toFixed(2) },
			{ accountCode: "57", paguBefore: a57B.toFixed(2), paguAfter: a57A.toFixed(2) },
		];

		const totalBefore = a51B + a52B + a53B + a57B;
		const totalAfter = a51A + a52A + a53A + a57A;

		const serializedNotes = formatRevisionNotesPayload(
			revUserNotes,
			accountDetails,
		);

		setIsSubmitting(true);
		try {
			if (editingRevisionId) {
				await editRevision({
					revisionId: editingRevisionId,
					revisionDate: revDate,
					revisionCode: revCodes.join(", "),
					paguBefore: totalBefore.toFixed(2),
					paguAfter: totalAfter.toFixed(2),
					accountDetails,
					notes: serializedNotes,
				});
				setActionMessage(
					"Data revisi DIPA dan pagu belanja aktif berhasil diperbarui.",
				);
			} else {
				await addRevision({
					revisionDate: revDate,
					revisionCode: revCodes.join(", "),
					paguBefore: totalBefore.toFixed(2),
					paguAfter: totalAfter.toFixed(2),
					accountDetails,
					notes: serializedNotes,
				});
				setActionMessage(
					"Data pengesahan revisi DIPA dicatat & pagu belanja aktif dimutakhirkan.",
				);
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

	// Columns for DIPA Revisions Table
	const columns: ColumnDef<DipaRevisionRecord>[] = [
		{
			key: "no",
			header: "Revisi Ke-",
			render: (item) => (
				<span className="text-xs font-bold text-foreground">
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
						<span className="rounded-md bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
							Tetap (Rp 0)
						</span>
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
					<div className="flex items-center gap-3.5">
						<div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
							<Coins className="size-5" />
						</div>
						<div>
							<div className="flex items-center gap-2">
								<h1 className="text-lg font-bold text-foreground sm:text-xl">
									Pagu &amp; Histori Revisi DIPA
								</h1>
								<span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
									TA {initialData.year}
								</span>
							</div>
							<p className="mt-0.5 text-xs text-muted-foreground">
								Revisi DIPA · Bobot 10% · Dinilai per semester, hanya revisi
								pagu tetap dengan 14 kode eligible.
							</p>
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-3">
						<div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 text-right">
							<span className="text-[11px] font-medium text-muted-foreground">
								Total Pagu Aktif TA {initialData.year}
							</span>
							<p className="text-base font-bold text-primary sm:text-lg">
								{formatRupiah(totalActivePagu)}
							</p>
						</div>

						<button
							type="button"
							onClick={handleOpenInitialBudgetDrawer}
							className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs transition hover:bg-surface"
						>
							<SlidersHorizontal className="size-3.5 text-primary" />
							<span>Atur Pagu Awal TA</span>
						</button>

						<button
							type="button"
							onClick={handleOpenCreateRevision}
							className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90"
						>
							<Plus className="size-3.5" />
							<span>Catat Pengesahan Revisi DIPA</span>
						</button>
					</div>
				</div>

				{/* Score Cards in Balanced Grid */}
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{/* Card 1: NKRA Semester I */}
					<div className="rounded-xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold">NKRA Semester I</span>
							<Calendar className="size-4 text-primary" />
						</div>
						<p className="text-2xl font-bold text-foreground sm:text-3xl">
							{skor.nkraS1}
						</p>
						<p className="text-[11px] text-muted-foreground">
							{s1} objek terhitung · {semesterStatus(s1)}
						</p>
					</div>

					{/* Card 2: NKRA Semester II */}
					<div className="rounded-xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold">NKRA Semester II</span>
							<Calendar className="size-4 text-primary" />
						</div>
						<p className="text-2xl font-bold text-foreground sm:text-3xl">
							{skor.nkraS2}
						</p>
						<p className="text-[11px] text-muted-foreground">
							{s2} objek terhitung · {semesterStatus(s2)}
						</p>
					</div>

					{/* Card 3: Nilai IKPA Revisi DIPA (2nd from right) */}
					<div className="rounded-xl border border-primary/20 bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold">
								Nilai IKPA Revisi DIPA
							</span>
							<ShieldCheck className="size-4 text-primary" />
						</div>
						<p className="text-2xl font-extrabold text-primary sm:text-3xl">
							{skor.annual}
						</p>
						<p className="text-[11px] text-muted-foreground">
							Rata-rata: (Semester I + II) / 2
						</p>
					</div>

					{/* Card 4: Nilai Akhir IKPA (Rightmost) */}
					<div className="rounded-xl border border-success/20 bg-success/5 p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold">
								Nilai Akhir (10%)
							</span>
							<Sparkles className="size-4 text-success" />
						</div>
						<p className="text-2xl font-extrabold text-success sm:text-3xl">
							{skor.contribution.toFixed(2)} pts
						</p>
						<p className="text-[11px] text-muted-foreground">
							{skor.contribution > 10
								? `Bobot 10% + Insentif Revisi (+${(skor.contribution - 10).toFixed(2)} pts)`
								: "Bobot 10% terhadap total IKPA"}
						</p>
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

				{/* Budget Allocation Cards per Account (51, 52, 53, 57) */}
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-sm font-bold text-foreground sm:text-base">
								Pagu Aktif per Jenis Belanja TA {initialData.year}
							</h2>
							<p className="text-xs text-muted-foreground">
								Pagu belanja diisi sekali dalam setahun (Pagu Awal DIPA) dan
								dimutakhirkan otomatis ketika ada pengesahan revisi DIPA.
							</p>
						</div>
						<button
							type="button"
							onClick={handleOpenInitialBudgetDrawer}
							className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
						>
							<SlidersHorizontal className="size-3.5" />
							<span>Kelola Pagu Awal TA</span>
						</button>
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{ACCOUNT_CODES.map((code) => {
							const amount = budgetMap.get(code) || 0;
							const hasRevisions = initialData.revisions.length > 0;

							return (
								<div
									key={code}
									className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-2.5 transition-all hover:border-primary/40"
								>
									<div className="flex items-center justify-between">
										<span className="rounded-md bg-surface px-2 py-0.5 text-[11px] font-bold text-foreground">
											Akun {code}
										</span>
										<button
											type="button"
											onClick={() => handleOpenSingleBudgetEdit(code)}
											className="text-[11px] font-semibold text-primary hover:underline"
										>
											Edit
										</button>
									</div>
									<div>
										<p className="text-xs font-medium text-muted-foreground">
											{ACCOUNT_NAMES[code]}
										</p>
										<p className="mt-1 text-base font-bold text-foreground sm:text-lg">
											{formatRupiah(amount)}
										</p>
									</div>
									<div className="flex items-center justify-between border-t border-border/70 pt-2 text-[11px]">
										<span className="text-muted-foreground">Status Pagu:</span>
										<span
											className={`rounded-md px-1.5 py-0.5 font-semibold ${
												hasRevisions
													? "bg-primary/10 text-primary"
													: "bg-surface text-muted-foreground"
											}`}
										>
											{hasRevisions ? "Terkini (Revisi DIPA)" : "Pagu Awal TA"}
										</span>
									</div>
								</div>
							);
						})}
					</div>
				</div>

				{/* DIPA Revisions Data Table */}
				<div className="space-y-4">
					<div className="flex flex-wrap items-center justify-between gap-3 text-xs">
						<div className="flex flex-wrap items-center gap-3">
							<label className="font-semibold text-foreground flex items-center gap-1.5">
								<span>Semester:</span>
								<select
									value={semesterFilter}
									onChange={(e) =>
										setSemesterFilter(e.target.value as "all" | "1" | "2")
									}
									className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs"
								>
									<option value="all">Semua Semester</option>
									<option value="1">Semester I</option>
									<option value="2">Semester II</option>
								</select>
							</label>
							<label className="inline-flex items-center gap-1.5 font-semibold text-foreground cursor-pointer">
								<input
									type="checkbox"
									checked={onlyObjek}
									onChange={(e) => setOnlyObjek(e.target.checked)}
									className="rounded text-primary"
								/>
								<span>Hanya Objek Penilaian</span>
							</label>
						</div>

						<span className="text-muted-foreground font-medium">
							Objek S1: <strong>{s1}</strong> · Objek S2: <strong>{s2}</strong>
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
				</div>

				{/* Strategy Assistance Panel */}
				<section
					aria-label="Strategi Optimalisasi Nilai IKPA - Revisi DIPA"
					className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4"
				>
					<div className="flex items-center gap-2.5">
						<div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
							<TrendingUp className="size-4" />
						</div>
						<div>
							<h2 className="text-base font-bold text-foreground">
								Strategi Optimalisasi Nilai IKPA - Revisi DIPA
							</h2>
							<p className="text-xs text-muted-foreground">
								Rekomendasi taktis dan panduan operasional satker untuk memaksimalkan nilai indikator Revisi DIPA (Bobot 10%).
							</p>
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
						<div className="p-4 rounded-xl border border-border bg-background space-y-2 flex flex-col justify-between">
							<div className="space-y-1.5">
								<span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
									1
								</span>
								<h3 className="font-bold text-foreground">
									Reviu DIPA secara Periodik &amp; Rutin
								</h3>
								<p className="text-muted-foreground leading-relaxed text-[11px]">
									Melakukan reviu DIPA secara periodik (minimal triwulanan, disarankan setiap bulan) guna melihat kesesuaian alokasi Program, Kegiatan, dan Output dalam DIPA dengan kebutuhan riil satker K/L.
								</p>
							</div>
						</div>

						<div className="p-4 rounded-xl border border-border bg-background space-y-2 flex flex-col justify-between">
							<div className="space-y-1.5">
								<span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
									2
								</span>
								<h3 className="font-bold text-foreground">
									Konsolidasi &amp; Batas Waktu Internal
								</h3>
								<p className="text-muted-foreground leading-relaxed text-[11px]">
									Melakukan konsolidasi dalam revisi anggaran dan menetapkan batas waktu revisi anggaran secara internal sehingga frekuensi revisi anggaran dapat diminimalisasi (maksimal 1 kali per semester).
								</p>
							</div>
						</div>

						<div className="p-4 rounded-xl border border-border bg-background space-y-2 flex flex-col justify-between">
							<div className="space-y-1.5">
								<span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
									3
								</span>
								<h3 className="font-bold text-foreground">
									Percepatan Pembukaan Catatan DIPA (Blokir)
								</h3>
								<p className="text-muted-foreground leading-relaxed text-[11px]">
									Mempersiapkan dokumen yang diperlukan sedini mungkin apabila masih terdapat alokasi anggaran yang diberikan catatan dalam DIPA (tanda blokir).
								</p>
							</div>
						</div>
					</div>
				</section>

				{/* Drawer 1: Form Atur Pagu Awal Tahun Anggaran (51, 52, 53, 57) */}
				<DomainFormDrawer
					isOpen={isInitialBudgetDrawerOpen}
					className="max-w-2xl"
					title={`Atur Pagu Awal Tahun Anggaran ${initialData.year}`}
					description="Tentukan pagu awal induk per jenis belanja (51, 52, 53, 57) yang berlaku selama satu tahun anggaran."
					onClose={() => setIsInitialBudgetDrawerOpen(false)}
					onSubmit={handleSaveInitialBudgets}
					isSubmitting={isSubmitting}
				>
					<div className="space-y-4">
						<div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs space-y-1">
							<p className="font-semibold text-foreground flex items-center gap-1.5">
								<Info className="size-4 text-primary shrink-0" />
								<span>Baseline Pagu Induk Satker</span>
							</p>
							<p className="text-muted-foreground leading-relaxed">
								Pagu ini menjadi acuan baseline awal. Jika di kemudian hari
								terdapat pergeseran atau perubahan pagu resmi, catatlah melalui
								menu <strong>Pengesahan Revisi DIPA</strong> agar terhitung di
								IKPA.
							</p>
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
							<div className="space-y-1.5">
								<label
									htmlFor="init-51"
									className="block text-xs font-semibold text-foreground"
								>
									{ACCOUNT_NAMES["51"]} (Rp)
								</label>
								<FormattedNumberInput
									id="init-51"
									placeholder="0"
									value={initialBudget51}
									onChange={setInitialBudget51}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
							</div>

							<div className="space-y-1.5">
								<label
									htmlFor="init-52"
									className="block text-xs font-semibold text-foreground"
								>
									{ACCOUNT_NAMES["52"]} (Rp)
								</label>
								<FormattedNumberInput
									id="init-52"
									placeholder="0"
									value={initialBudget52}
									onChange={setInitialBudget52}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
							</div>

							<div className="space-y-1.5">
								<label
									htmlFor="init-53"
									className="block text-xs font-semibold text-foreground"
								>
									{ACCOUNT_NAMES["53"]} (Rp)
								</label>
								<FormattedNumberInput
									id="init-53"
									placeholder="0"
									value={initialBudget53}
									onChange={setInitialBudget53}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
							</div>

							<div className="space-y-1.5">
								<label
									htmlFor="init-57"
									className="block text-xs font-semibold text-foreground"
								>
									{ACCOUNT_NAMES["57"]} (Rp)
								</label>
								<FormattedNumberInput
									id="init-57"
									placeholder="0"
									value={initialBudget57}
									onChange={setInitialBudget57}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
							</div>
						</div>

						{/* Total Pagu Awal Preview & Effective Date */}
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-end">
							<div className="rounded-xl border border-border bg-surface p-3 space-y-1 text-xs">
								<span className="text-muted-foreground block">
									Total Pagu Awal TA {initialData.year}:
								</span>
								<span className="font-extrabold text-foreground text-sm block">
									{formatRupiah(
										(Number.parseFloat(initialBudget51) || 0) +
											(Number.parseFloat(initialBudget52) || 0) +
											(Number.parseFloat(initialBudget53) || 0) +
											(Number.parseFloat(initialBudget57) || 0),
									)}
								</span>
							</div>

							<div className="space-y-1.5">
								<label
									htmlFor="init-eff-date"
									className="block text-xs font-semibold text-foreground"
								>
									Tanggal Efektif Pagu Awal
								</label>
								<input
									id="init-eff-date"
									type="date"
									required
									value={initialBudgetEffectiveDate}
									onChange={(e) => setInitialBudgetEffectiveDate(e.target.value)}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
							</div>
						</div>
					</div>
				</DomainFormDrawer>

				{/* Drawer 2: Form Catat / Ubah Pengesahan Revisi DIPA (dengan Rincian Akun Wajib - Horizontal Layout) */}
				<DomainFormDrawer
					isOpen={isRevisionDrawerOpen}
					className="max-w-4xl lg:max-w-5xl"
					title={
						editingRevisionId
							? "Ubah Catatan Pengesahan Revisi DIPA"
							: "Catat Pengesahan Revisi DIPA"
					}
					description="Sertakan rincian alokasi per jenis belanja (51, 52, 53, 57). Perubahan ini akan langsung memutakhirkan pagu belanja aktif dalam tahun anggaran."
					onClose={handleCloseRevisionDrawer}
					onSubmit={handleSaveRevision}
					isSubmitting={isSubmitting}
				>
					<div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
						{/* Left Column: Identitas Revisi & Catatan (5 cols on lg) */}
						<div className="lg:col-span-5 space-y-4">
							{/* Step 1: Identitas Revisi */}
							<div className="rounded-xl border border-border bg-surface/40 p-3.5 space-y-3">
								<p className="text-xs font-bold uppercase tracking-wider text-primary">
									1. Identitas Revisi DIPA
								</p>

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
													{c}
													{REVISI_JENIS[c] ? ` — ${REVISI_JENIS[c]}` : ""}
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
										disabled={
											isSubmitting || revCodes.length >= MAX_REVISI_JENIS
										}
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
											onChange={(e) =>
												setRevCustom(
													e.target.value.replace(/\D/g, "").slice(0, 3),
												)
											}
											disabled={
												isSubmitting || revCodes.length >= MAX_REVISI_JENIS
											}
											className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
										/>
										<button
											type="button"
											disabled={
												isSubmitting || revCodes.length >= MAX_REVISI_JENIS
											}
											onClick={() => {
												handleAddJenis(revCustom);
												setRevCustom("");
											}}
											className="min-h-10 shrink-0 rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-surface"
										>
											Tambah
										</button>
									</div>
									<p className="text-[10px] text-muted-foreground">
										14 kode pagu tetap tersedia di daftar; kode lain wajib 3
										angka.
									</p>
								</div>

								<div className="space-y-1.5">
									<label
										htmlFor="rev-date"
										className="block text-xs font-semibold text-foreground"
									>
										Tanggal Pengesahan Revisi
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
							</div>

							{/* Step 3: Catatan */}
							<div className="rounded-xl border border-border bg-surface/40 p-3.5 space-y-1.5">
								<label
									htmlFor="rev-notes"
									className="block text-xs font-semibold text-foreground"
								>
									3. Catatan / No. Surat Pengesahan
								</label>
								<textarea
									id="rev-notes"
									rows={2}
									maxLength={500}
									placeholder="Contoh: Pergeseran anggaran belanja barang ke modal (Surat DJPb No. S-123/2026)"
									value={revUserNotes}
									onChange={(e) => setRevUserNotes(e.target.value)}
									disabled={isSubmitting}
									className="w-full rounded-lg border border-border bg-background p-2.5 text-xs text-foreground focus:border-primary focus:outline-none resize-none"
								/>
							</div>
						</div>

						{/* Right Column: Rincian Perubahan Pagu per Jenis Belanja (7 cols on lg) */}
						<div className="lg:col-span-7 space-y-3.5">
							<div className="flex items-center justify-between">
								<p className="text-xs font-bold uppercase tracking-wider text-primary">
									2. Rincian Pagu per Jenis Belanja (Wajib)
								</p>
								<span className="text-[11px] text-muted-foreground font-medium">
									Mempengaruhi Pagu Aktif TA
								</span>
							</div>

							{/* 2x2 Grid of Account Cards */}
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
								{/* Akun 51 */}
								<div className="space-y-1.5 rounded-xl border border-border/80 bg-surface/40 p-2.5">
									<div className="flex items-center justify-between font-semibold text-xs">
										<span className="truncate">{ACCOUNT_NAMES["51"]}</span>
										{(() => {
											const d =
												(Number.parseFloat(revAcc51After) || 0) -
												(Number.parseFloat(revAcc51Before) || 0);
											if (d === 0)
												return (
													<span className="text-muted-foreground text-[10px] shrink-0">
														Tetap
													</span>
												);
											return (
												<span
													className={`text-[10px] font-bold shrink-0 ${
														d > 0 ? "text-success" : "text-danger"
													}`}
												>
													{d > 0 ? "+" : ""}
													{formatRupiah(d)}
												</span>
											);
										})()}
									</div>
									<div className="grid grid-cols-2 gap-2">
										<div>
											<span className="text-[10px] text-muted-foreground">
												Sebelum
											</span>
											<FormattedNumberInput
												value={revAcc51Before}
												onChange={setRevAcc51Before}
												disabled={isSubmitting}
												className="min-h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
											/>
										</div>
										<div>
											<span className="text-[10px] text-muted-foreground">
												Sesudah
											</span>
											<FormattedNumberInput
												value={revAcc51After}
												onChange={setRevAcc51After}
												disabled={isSubmitting}
												className="min-h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
											/>
										</div>
									</div>
								</div>

								{/* Akun 52 */}
								<div className="space-y-1.5 rounded-xl border border-border/80 bg-surface/40 p-2.5">
									<div className="flex items-center justify-between font-semibold text-xs">
										<span className="truncate">{ACCOUNT_NAMES["52"]}</span>
										{(() => {
											const d =
												(Number.parseFloat(revAcc52After) || 0) -
												(Number.parseFloat(revAcc52Before) || 0);
											if (d === 0)
												return (
													<span className="text-muted-foreground text-[10px] shrink-0">
														Tetap
													</span>
												);
											return (
												<span
													className={`text-[10px] font-bold shrink-0 ${
														d > 0 ? "text-success" : "text-danger"
													}`}
												>
													{d > 0 ? "+" : ""}
													{formatRupiah(d)}
												</span>
											);
										})()}
									</div>
									<div className="grid grid-cols-2 gap-2">
										<div>
											<span className="text-[10px] text-muted-foreground">
												Sebelum
											</span>
											<FormattedNumberInput
												value={revAcc52Before}
												onChange={setRevAcc52Before}
												disabled={isSubmitting}
												className="min-h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
											/>
										</div>
										<div>
											<span className="text-[10px] text-muted-foreground">
												Sesudah
											</span>
											<FormattedNumberInput
												value={revAcc52After}
												onChange={setRevAcc52After}
												disabled={isSubmitting}
												className="min-h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
											/>
										</div>
									</div>
								</div>

								{/* Akun 53 */}
								<div className="space-y-1.5 rounded-xl border border-border/80 bg-surface/40 p-2.5">
									<div className="flex items-center justify-between font-semibold text-xs">
										<span className="truncate">{ACCOUNT_NAMES["53"]}</span>
										{(() => {
											const d =
												(Number.parseFloat(revAcc53After) || 0) -
												(Number.parseFloat(revAcc53Before) || 0);
											if (d === 0)
												return (
													<span className="text-muted-foreground text-[10px] shrink-0">
														Tetap
													</span>
												);
											return (
												<span
													className={`text-[10px] font-bold shrink-0 ${
														d > 0 ? "text-success" : "text-danger"
													}`}
												>
													{d > 0 ? "+" : ""}
													{formatRupiah(d)}
												</span>
											);
										})()}
									</div>
									<div className="grid grid-cols-2 gap-2">
										<div>
											<span className="text-[10px] text-muted-foreground">
												Sebelum
											</span>
											<FormattedNumberInput
												value={revAcc53Before}
												onChange={setRevAcc53Before}
												disabled={isSubmitting}
												className="min-h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
											/>
										</div>
										<div>
											<span className="text-[10px] text-muted-foreground">
												Sesudah
											</span>
											<FormattedNumberInput
												value={revAcc53After}
												onChange={setRevAcc53After}
												disabled={isSubmitting}
												className="min-h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
											/>
										</div>
									</div>
								</div>

								{/* Akun 57 */}
								<div className="space-y-1.5 rounded-xl border border-border/80 bg-surface/40 p-2.5">
									<div className="flex items-center justify-between font-semibold text-xs">
										<span className="truncate">{ACCOUNT_NAMES["57"]}</span>
										{(() => {
											const d =
												(Number.parseFloat(revAcc57After) || 0) -
												(Number.parseFloat(revAcc57Before) || 0);
											if (d === 0)
												return (
													<span className="text-muted-foreground text-[10px] shrink-0">
														Tetap
													</span>
												);
											return (
												<span
													className={`text-[10px] font-bold shrink-0 ${
														d > 0 ? "text-success" : "text-danger"
													}`}
												>
													{d > 0 ? "+" : ""}
													{formatRupiah(d)}
												</span>
											);
										})()}
									</div>
									<div className="grid grid-cols-2 gap-2">
										<div>
											<span className="text-[10px] text-muted-foreground">
												Sebelum
											</span>
											<FormattedNumberInput
												value={revAcc57Before}
												onChange={setRevAcc57Before}
												disabled={isSubmitting}
												className="min-h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
											/>
										</div>
										<div>
											<span className="text-[10px] text-muted-foreground">
												Sesudah
											</span>
											<FormattedNumberInput
												value={revAcc57After}
												onChange={setRevAcc57After}
												disabled={isSubmitting}
												className="min-h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
											/>
										</div>
									</div>
								</div>
							</div>

							{/* Summary of Totals */}
							<div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2 text-xs">
								<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
									<div>
										<span className="text-[10px] text-muted-foreground block">
											Total Sebelum
										</span>
										<span className="font-semibold text-foreground text-xs sm:text-sm">
											{formatRupiah(formTotalBefore)}
										</span>
									</div>
									<div>
										<span className="text-[10px] text-muted-foreground block">
											Total Sesudah
										</span>
										<span className="font-bold text-foreground text-xs sm:text-sm">
											{formatRupiah(formTotalAfter)}
										</span>
									</div>
									<div className="col-span-2 sm:col-span-1">
										<span className="text-[10px] text-muted-foreground block">
											Perubahan Pagu (Δ)
										</span>
										<span
											className={`font-extrabold text-xs sm:text-sm ${
												formTotalDelta === 0
													? "text-primary"
													: formTotalDelta > 0
														? "text-success"
														: "text-danger"
											}`}
										>
											{formTotalDelta === 0
												? "Tetap (Rp 0)"
												: `${formTotalDelta > 0 ? "+" : ""}${formatRupiah(formTotalDelta)}`}
										</span>
									</div>
								</div>

								{/* Status Explanation */}
								<div className="border-t border-primary/20 pt-2 text-[11px] font-medium text-foreground flex items-center gap-1.5">
									<Info className="size-3.5 text-primary shrink-0" />
									<p role="status">
										{preview.reason === "pagu-berubah"
											? `Revisi ini tidak dihitung dalam frekuensi revisi IKPA karena total pagu satker berubah (${formatRupiah(formTotalDelta)}).`
											: preview.reason === "awal"
												? "Pengesahan awal dikecualikan — tidak dihitung."
												: preview.reason === "kode-luar"
													? "Revisi ini tidak dihitung — kode di luar 14 jenis."
													: preview.semester === 0
														? "Tanggal di luar TA — tidak dihitung semester ini."
														: `Revisi ini dihitung sebagai objek Semester ${semesterRoman(preview.semester)}.`}
									</p>
								</div>
							</div>
						</div>
					</div>
				</DomainFormDrawer>

				{/* Drawer 3: Single Budget Edit Drawer */}
				<DomainFormDrawer
					isOpen={isSingleBudgetDrawerOpen}
					title={`Edit Alokasi ${ACCOUNT_NAMES[singleBudgetAccount]}`}
					description="Perbarui alokasi pagu belanja aktif akun ini untuk Tahun Anggaran."
					onClose={() => setIsSingleBudgetDrawerOpen(false)}
					onSubmit={handleSaveSingleBudget}
					isSubmitting={isSubmitting}
				>
					<div className="space-y-4">
						<div className="space-y-1.5">
							<label
								htmlFor="single-budget-amount"
								className="block text-xs font-semibold text-foreground"
							>
								Alokasi Pagu (Rp)
							</label>
							<FormattedNumberInput
								id="single-budget-amount"
								required
								placeholder="0"
								value={singleBudgetAmount}
								onChange={setSingleBudgetAmount}
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


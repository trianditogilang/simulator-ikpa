import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
	AlertCircle,
	Calendar,
	CheckCircle2,
	Coins,
	CreditCard,
	Layers,
	Plus,
	Trash2,
	Wallet,
} from "lucide-react";
import { useState } from "react";
import {
	type ColumnDef,
	DomainDataTable,
} from "@/components/data/domain-data-table";
import { DomainFormDrawer } from "@/components/data/domain-form-drawer";
import { OperatorShell } from "@/components/layout/operator-shell";
import { formatRupiah } from "@/lib/format";
import {
	addUpTup,
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
	SETORAN_TUP: "Setoran Sisa TUP (SSBP)",
};

function UpTupKkpPage() {
	const router = useRouter();
	const initialData = Route.useLoaderData();

	const [activeTab, setActiveTab] = useState<"uptup" | "kkp">("uptup");
	const [search, setSearch] = useState("");
	const [isUpTupDrawerOpen, setIsUpTupDrawerOpen] = useState(false);
	const [isKkpDrawerOpen, setIsKkpDrawerOpen] = useState(false);
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
	const [settleDate, setSettleDate] = useState("");
	const [isSettled, setIsSettled] = useState(false);

	// KKP Form State
	const [kkpMonth, setKkpMonth] = useState<number>(new Date().getMonth() + 1);
	const [kkpAmount, setKkpAmount] = useState("");
	const [kkpUsageDate, setKkpUsageDate] = useState(
		new Date().toISOString().slice(0, 10),
	);

	// Totals
	const totalUpAmount = initialData.upTupList
		.filter((u) => u.type === "UP" || u.type === "TUP")
		.reduce((sum, u) => sum + (Number.parseFloat(u.amount) || 0), 0);

	const totalKkpAmount = initialData.kkpList.reduce(
		(sum, k) => sum + (Number.parseFloat(k.amount) || 0),
		0,
	);

	const handleCreateUpTup = async () => {
		setActionMessage(null);
		setErrorMessage(null);

		const amountVal = Number.parseFloat(txAmount) || 0;
		setIsSubmitting(true);
		try {
			await addUpTup({
				type: txType,
				amount: amountVal.toFixed(2),
				sp2dAt: txSp2dDate,
				referenceSp2dAt: refSp2dDate || null,
				settlementDate: settleDate || null,
				isSettled,
			});

			setActionMessage("Transaksi UP/TUP berhasil dicatat.");
			setIsUpTupDrawerOpen(false);
			setTxAmount("");
			setRefSp2dDate("");
			setSettleDate("");
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

		const amountVal = Number.parseFloat(kkpAmount) || 0;
		setIsSubmitting(true);
		try {
			await saveKkpUsage({
				month: kkpMonth,
				amount: amountVal.toFixed(2),
				usageDate: kkpUsageDate || null,
			});

			setActionMessage(
				`Penggunaan KKP bulan ${MONTH_NAMES[kkpMonth - 1]} berhasil diperbarui.`,
			);
			setIsKkpDrawerOpen(false);
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

	const upTupColumns: ColumnDef<UpTupRecord>[] = [
		{
			key: "type",
			header: "Jenis Transaksi",
			render: (item) => (
				<div>
					<span className="font-semibold text-foreground">
						{TYPE_LABELS[item.type] || item.type}
					</span>
					<p className="text-[11px] text-muted-foreground">
						Kode Tipe: {item.type}
					</p>
				</div>
			),
		},
		{
			key: "amount",
			header: "Nominal",
			render: (item) => (
				<span className="font-semibold text-foreground">
					{formatRupiah(Number.parseFloat(item.amount))}
				</span>
			),
		},
		{
			key: "sp2d",
			header: "Tanggal SP2D",
			render: (item) => (
				<span className="inline-flex items-center gap-1.5 text-foreground">
					<Calendar className="size-3.5 text-muted-foreground" />
					<span>{item.sp2dAt}</span>
				</span>
			),
		},
		{
			key: "ref",
			header: "Referensi SP2D Asal",
			render: (item) => (
				<span className="text-xs text-muted-foreground">
					{item.referenceSp2dAt || "-"}
				</span>
			),
		},
		{
			key: "status",
			header: "Status Penyelesaian",
			render: (item) => (
				<span
					className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
						item.isSettled
							? "bg-success/10 text-success"
							: "bg-surface text-muted-foreground"
					}`}
				>
					{item.isSettled ? "Lunas / Selesai" : "Aktif / Berjalan"}
				</span>
			),
		},
		{
			key: "actions",
			header: "Aksi",
			render: (item) => (
				<button
					type="button"
					onClick={() => handleDeleteUpTup(item.id)}
					className="inline-flex items-center rounded-lg p-1.5 text-danger hover:bg-danger/10 transition"
					title="Hapus Transaksi"
				>
					<Trash2 className="size-3.5" />
				</button>
			),
		},
	];

	const kkpColumns: ColumnDef<KkpRecord>[] = [
		{
			key: "month",
			header: "Bulan Penggunaan",
			render: (item) => (
				<span className="font-semibold text-foreground">
					{MONTH_NAMES[item.month - 1]} ({item.month})
				</span>
			),
		},
		{
			key: "amount",
			header: "Nominal Transaksi KKP",
			render: (item) => (
				<span className="font-bold text-foreground">
					{formatRupiah(Number.parseFloat(item.amount))}
				</span>
			),
		},
		{
			key: "usageDate",
			header: "Tanggal Transaksi",
			render: (item) => (
				<span className="text-xs text-muted-foreground">
					{item.usageDate || "Rekap Bulanan"}
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
							setKkpMonth(item.month);
							setKkpAmount(item.amount);
							setKkpUsageDate(item.usageDate || "");
							setIsKkpDrawerOpen(true);
						}}
						className="text-[11px] font-semibold text-primary hover:underline"
					>
						Ubah
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
						<div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<Wallet className="size-5" />
						</div>
						<div>
							<h1 className="text-lg font-bold text-foreground sm:text-xl">
								Pengelolaan UP / TUP &amp; Kartu Kredit Pemerintah (KKP)
							</h1>
							<p className="text-xs text-muted-foreground">
								Pantau frekuensi revolving GUP (maksimal 1 bulan), batas waktu
								pertanggungjawaban TUP (1 bulan), dan porsi penggunaan KKP.
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => setIsUpTupDrawerOpen(true)}
							className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90"
						>
							<Plus className="size-3.5" />
							<span>Catat UP/TUP</span>
						</button>
						<button
							type="button"
							onClick={() => setIsKkpDrawerOpen(true)}
							className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs transition hover:bg-surface-muted"
						>
							<CreditCard className="size-3.5 text-primary" />
							<span>Input KKP</span>
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
							<span className="text-xs font-medium">Total UP/TUP Terbit</span>
							<Coins className="size-4 text-primary" />
						</div>
						<p className="text-lg font-bold text-foreground sm:text-xl">
							{formatRupiah(totalUpAmount)}
						</p>
						<p className="text-[11px] text-muted-foreground">
							Alokasi dana persediaan aktif
						</p>
					</div>

					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-medium">
								Total Transaksi Revolving
							</span>
							<Layers className="size-4 text-success" />
						</div>
						<p className="text-lg font-bold text-foreground sm:text-xl">
							{initialData.upTupList.length} Transaksi
						</p>
						<p className="text-[11px] text-muted-foreground">
							UP, GUP, GUP Nihil, PTUP &amp; Setoran
						</p>
					</div>

					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-medium">Total Transaksi KKP</span>
							<CreditCard className="size-4 text-warning" />
						</div>
						<p className="text-lg font-bold text-foreground sm:text-xl">
							{formatRupiah(totalKkpAmount)}
						</p>
						<p className="text-[11px] text-muted-foreground">
							Realisasi belanja via KKP Satker
						</p>
					</div>
				</div>

				{/* Tab Selector */}
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

				{/* Table Views */}
				{activeTab === "uptup" ? (
					<DomainDataTable
						title="Riwayat Transaksi UP / TUP / Revolving GUP"
						data={filteredUpTup}
						columns={upTupColumns}
						searchValue={search}
						onSearchChange={setSearch}
						onAddClick={() => setIsUpTupDrawerOpen(true)}
						onImportClick={() => {
							window.location.href = "/operator/import";
						}}
						totalCount={filteredUpTup.length}
					/>
				) : (
					<DomainDataTable
						title="Daftar Penggunaan Kartu Kredit Pemerintah (KKP)"
						data={initialData.kkpList}
						columns={kkpColumns}
						searchValue=""
						onSearchChange={() => {}}
						onAddClick={() => setIsKkpDrawerOpen(true)}
						onImportClick={() => {
							window.location.href = "/operator/import";
						}}
						totalCount={initialData.kkpList.length}
					/>
				)}

				{/* Drawer 1: Form Tambah UP/TUP/GUP */}
				<DomainFormDrawer
					isOpen={isUpTupDrawerOpen}
					title="Catat Transaksi UP / TUP / GUP"
					description="Masukkan data penerbitan SP2D UP, TUP, revolving GUP, atau pertanggungjawaban TUP."
					onClose={() => setIsUpTupDrawerOpen(false)}
					onSubmit={handleCreateUpTup}
					isSubmitting={isSubmitting}
				>
					<div className="space-y-4">
						<div className="space-y-1.5">
							<label
								htmlFor="tx-type"
								className="block text-xs font-semibold text-foreground"
							>
								Jenis Transaksi
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
								<option value="SETORAN_TUP">Setoran Sisa TUP</option>
							</select>
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="tx-amount"
								className="block text-xs font-semibold text-foreground"
							>
								Nominal Transaksi (Rp)
							</label>
							<input
								id="tx-amount"
								type="number"
								required
								min="0"
								step="1"
								placeholder="Contoh: 50000000"
								value={txAmount}
								onChange={(e) => setTxAmount(e.target.value)}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							/>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<label
									htmlFor="tx-sp2d-date"
									className="block text-xs font-semibold text-foreground"
								>
									Tanggal SP2D
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

							<div className="space-y-1.5">
								<label
									htmlFor="ref-sp2d-date"
									className="block text-xs font-semibold text-foreground"
								>
									Tanggal SP2D Asal (GUP/PTUP)
								</label>
								<input
									id="ref-sp2d-date"
									type="date"
									value={refSp2dDate}
									onChange={(e) => setRefSp2dDate(e.target.value)}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
							</div>
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="settle-date"
								className="block text-xs font-semibold text-foreground"
							>
								Tanggal Pertanggungjawaban (Opsional)
							</label>
							<input
								id="settle-date"
								type="date"
								value={settleDate}
								onChange={(e) => setSettleDate(e.target.value)}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							/>
						</div>

						<div className="flex items-center gap-2 pt-1">
							<input
								id="tx-is-settled"
								type="checkbox"
								checked={isSettled}
								onChange={(e) => setIsSettled(e.target.checked)}
								disabled={isSubmitting}
								className="size-4 rounded border-border text-primary focus:ring-primary"
							/>
							<label
								htmlFor="tx-is-settled"
								className="text-xs text-foreground font-medium cursor-pointer"
							>
								Tandai sudah dipertanggungjawabkan lunas
							</label>
						</div>
					</div>
				</DomainFormDrawer>

				{/* Drawer 2: Form Input KKP Bulanan */}
				<DomainFormDrawer
					isOpen={isKkpDrawerOpen}
					title="Atur Realisasi KKP Bulanan"
					description="Masukkan realisasi transaksi belanja menggunakan Kartu Kredit Pemerintah."
					onClose={() => setIsKkpDrawerOpen(false)}
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
										{n}
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
							<input
								id="kkp-amount"
								type="number"
								required
								min="0"
								step="1"
								placeholder="Contoh: 15000000"
								value={kkpAmount}
								onChange={(e) => setKkpAmount(e.target.value)}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
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

import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
	AlertCircle,
	CheckCircle2,
	Clock,
	FileCheck,
	Percent,
	Target,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import {
	type ColumnDef,
	DomainDataTable,
} from "@/components/data/domain-data-table";
import { DomainFormDrawer } from "@/components/data/domain-form-drawer";
import { OperatorShell } from "@/components/layout/operator-shell";
import { formatPercent } from "@/lib/format";
import {
	fetchOutputReports,
	removeOutputReport,
	saveOutputReport,
	verifyOutputReport,
	type OutputReportRecord,
} from "@/services/output-achievement-service";

export const Route = createFileRoute("/operator/data/output-achievement")({
	loader: async ({ context }) => {
		const activeOrgId =
			context.auth?.isAuthenticated &&
			(context.access?.status === "operator_single_scope" ||
				context.access?.status === "operator_multiple_scopes")
				? (context.access.activeOrganizationId ?? undefined)
				: undefined;

		return fetchOutputReports(activeOrgId);
	},
	component: OutputAchievementPage,
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

function OutputAchievementPage() {
	const router = useRouter();
	const initialData = Route.useLoaderData();

	const [selectedMonth, setSelectedMonth] = useState<number>(
		new Date().getMonth() + 1,
	);
	const [search, setSearch] = useState("");
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [actionMessage, setActionMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	// Drawer Form State
	const [roCode, setRoCode] = useState("");
	const [formMonth, setFormMonth] = useState<number>(selectedMonth);
	const [rvro, setRvro] = useState("");
	const [volumeDipa, setVolumeDipa] = useState("");
	const [pcro, setPcro] = useState("");
	const [tpcro, setTpcro] = useState("");
	const [isConfirmed, setIsConfirmed] = useState(false);

	// Filter outputs by month & search
	const filteredData = initialData.outputs.filter(
		(item) =>
			item.month === selectedMonth &&
			item.roCode.toLowerCase().includes(search.toLowerCase()),
	);

	// Summary stats
	const totalRo = filteredData.length;
	const confirmedCount = filteredData.filter((i) => i.confirmed).length;
	const avgPcro =
		totalRo > 0
			? filteredData.reduce((s, i) => s + (Number.parseFloat(i.pcro) || 0), 0) /
				totalRo
			: 0;
	const avgTpcro =
		totalRo > 0
			? filteredData.reduce(
					(s, i) => s + (Number.parseFloat(i.tpcro) || 0),
					0,
				) / totalRo
			: 0;

	const handleSaveOutput = async () => {
		setActionMessage(null);
		setErrorMessage(null);

		const rvVal = Number.parseFloat(rvro) || 0;
		const volVal = Number.parseFloat(volumeDipa) || 0;
		const pcVal = Number.parseFloat(pcro) || 0;
		const tpcVal = Number.parseFloat(tpcro) || 0;

		setIsSubmitting(true);
		try {
			await saveOutputReport({
				roCode: roCode.trim(),
				month: formMonth,
				rvro: rvVal.toFixed(4),
				volumeDipa: volVal.toFixed(4),
				pcro: pcVal.toFixed(4),
				tpcro: tpcVal.toFixed(4),
				confirmed: isConfirmed,
			});

			setActionMessage(
				`Data capaian output ${roCode} berhasil disimpan ke simulasi.`,
			);
			setIsDrawerOpen(false);
			setRoCode("");
			setRvro("");
			setVolumeDipa("");
			setPcro("");
			setTpcro("");
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error
					? err.message
					: "Gagal menyimpan capaian output.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleConfirm = async (id: string, code: string) => {
		try {
			await verifyOutputReport(id);
			setActionMessage(`Output ${code} berhasil dikonfirmasi.`);
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal mengonfirmasi output.",
			);
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Hapus catatan capaian output ini?")) {
			return;
		}
		try {
			await removeOutputReport(id);
			setActionMessage("Catatan output berhasil dihapus.");
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal menghapus data.",
			);
		}
	};

	const columns: ColumnDef<OutputReportRecord>[] = [
		{
			key: "ro",
			header: "Kode Rincian Output (RO)",
			render: (item) => (
				<div>
					<span className="font-semibold text-foreground">{item.roCode}</span>
					<p className="text-[11px] text-muted-foreground">
						Bulan {MONTH_NAMES[item.month - 1]}
					</p>
				</div>
			),
		},
		{
			key: "pcro",
			header: "Realisasi PCRO (%)",
			render: (item) => (
				<span className="font-semibold text-foreground">
					{formatPercent(Number.parseFloat(item.pcro))}
				</span>
			),
		},
		{
			key: "tpcro",
			header: "Target PCRO (%)",
			render: (item) => (
				<span className="text-muted-foreground font-medium">
					{formatPercent(Number.parseFloat(item.tpcro))}
				</span>
			),
		},
		{
			key: "rvro",
			header: "Realisasi Volume (RVRO / Volume DIPA)",
			render: (item) => (
				<span className="font-medium text-foreground">
					{Number.parseFloat(item.rvro).toLocaleString("id-ID")} /{" "}
					{Number.parseFloat(item.volumeDipa).toLocaleString("id-ID")} Output
				</span>
			),
		},
		{
			key: "status",
			header: "Status Konfirmasi",
			render: (item) => (
				<span
					className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
						item.confirmed
							? "bg-success/10 text-success"
							: "bg-warning/10 text-warning"
					}`}
				>
					{item.confirmed ? "Terkonfirmasi" : "Belum Konfirmasi (Draft)"}
				</span>
			),
		},
		{
			key: "actions",
			header: "Aksi",
			render: (item) => (
				<div className="flex items-center gap-2">
					{!item.confirmed && (
						<button
							type="button"
							onClick={() => handleConfirm(item.id, item.roCode)}
							className="inline-flex items-center gap-1 rounded-lg bg-success/10 px-2 py-1 text-[11px] font-semibold text-success hover:bg-success/20 transition"
						>
							<FileCheck className="size-3" />
							<span>Konfirmasi</span>
						</button>
					)}
					<button
						type="button"
						onClick={() => handleDelete(item.id)}
						className="inline-flex items-center rounded-lg p-1.5 text-danger hover:bg-danger/10 transition"
						title="Hapus Output"
					>
						<Trash2 className="size-3.5" />
					</button>
				</div>
			),
		},
	];

	return (
		<OperatorShell currentPath="/operator/data/output-achievement">
			<div className="space-y-6">
				{/* Top Summary Banner */}
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div className="flex items-center gap-3">
						<div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<Target className="size-5" />
						</div>
						<div>
							<h1 className="text-lg font-bold text-foreground sm:text-xl">
								Capaian Output Satker (PCRO / RVRO)
							</h1>
							<p className="text-xs text-muted-foreground">
								Kelola pelaporan progres capaian rincian output bulanan dan
								konfirmasi data sebelum batas waktu penilaian IKPA.
							</p>
						</div>
					</div>

					{/* Month Selector Pills */}
					<div className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-background p-1 text-xs">
						{MONTH_NAMES.map((name, idx) => {
							const m = idx + 1;
							const isSelected = m === selectedMonth;
							return (
								<button
									key={name}
									type="button"
									onClick={() => setSelectedMonth(m)}
									className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
										isSelected
											? "bg-primary text-primary-foreground shadow-xs"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									{name.slice(0, 3)}
								</button>
							);
						})}
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
							<span className="text-xs font-medium">
								Rincian Output {MONTH_NAMES[selectedMonth - 1]}
							</span>
							<Target className="size-4 text-primary" />
						</div>
						<p className="text-lg font-bold text-foreground sm:text-xl">
							{totalRo} RO Terdaftar
						</p>
						<p className="text-[11px] text-muted-foreground">
							{confirmedCount} Terkonfirmasi ({totalRo - confirmedCount} Draft)
						</p>
					</div>

					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-medium">Rata-rata PCRO</span>
							<Percent className="size-4 text-success" />
						</div>
						<p className="text-lg font-bold text-foreground sm:text-xl">
							{formatPercent(avgPcro)}
						</p>
						<p className="text-[11px] text-muted-foreground">
							Target TPCRO: {formatPercent(avgTpcro)}
						</p>
					</div>

					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-medium">Batas Konfirmasi</span>
							<Clock className="size-4 text-warning" />
						</div>
						<p className="text-lg font-bold text-foreground sm:text-xl">
							5 Hari Kerja
						</p>
						<p className="text-[11px] text-muted-foreground">
							Awal bulan berikutnya via OMSPAN
						</p>
					</div>
				</div>

				{/* Data Table */}
				<DomainDataTable
					title={`Laporan Capaian Rincian Output (Bulan ${MONTH_NAMES[selectedMonth - 1]} 2026)`}
					data={filteredData}
					columns={columns}
					searchValue={search}
					onSearchChange={setSearch}
					onAddClick={() => {
						setFormMonth(selectedMonth);
						setRoCode("");
						setRvro("");
						setVolumeDipa("100");
						setPcro("");
						setTpcro("80");
						setIsConfirmed(false);
						setIsDrawerOpen(true);
					}}
					onImportClick={() => {
						window.location.href = "/operator/import";
					}}
					totalCount={filteredData.length}
				/>

				{/* Form Drawer: Input Capaian Output */}
				<DomainFormDrawer
					isOpen={isDrawerOpen}
					title="Input / Perbarui Capaian Output (RO)"
					description="Masukkan data perkembangan fisik (PCRO) dan realisasi volume rincian output (RVRO)."
					onClose={() => setIsDrawerOpen(false)}
					onSubmit={handleSaveOutput}
					isSubmitting={isSubmitting}
				>
					<div className="space-y-4">
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<label
									htmlFor="out-ro-code"
									className="block text-xs font-semibold text-foreground"
								>
									Kode RO
								</label>
								<input
									id="out-ro-code"
									type="text"
									required
									placeholder="Contoh: 1234.EBA.001"
									value={roCode}
									onChange={(e) => setRoCode(e.target.value)}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
							</div>

							<div className="space-y-1.5">
								<label
									htmlFor="out-month"
									className="block text-xs font-semibold text-foreground"
								>
									Bulan Laporan
								</label>
								<select
									id="out-month"
									value={formMonth}
									onChange={(e) => setFormMonth(Number(e.target.value))}
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
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<label
									htmlFor="out-rvro"
									className="block text-xs font-semibold text-foreground"
								>
									Realisasi Volume (RVRO)
								</label>
								<input
									id="out-rvro"
									type="number"
									required
									min="0"
									step="0.0001"
									placeholder="Contoh: 25.0000"
									value={rvro}
									onChange={(e) => setRvro(e.target.value)}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
							</div>

							<div className="space-y-1.5">
								<label
									htmlFor="out-vol-dipa"
									className="block text-xs font-semibold text-foreground"
								>
									Target Volume DIPA
								</label>
								<input
									id="out-vol-dipa"
									type="number"
									required
									min="1"
									step="0.0001"
									placeholder="Contoh: 100.0000"
									value={volumeDipa}
									onChange={(e) => setVolumeDipa(e.target.value)}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<label
									htmlFor="out-pcro"
									className="block text-xs font-semibold text-foreground"
								>
									Progres Fisik PCRO (%)
								</label>
								<input
									id="out-pcro"
									type="number"
									required
									min="0"
									max="100"
									step="0.0001"
									placeholder="Contoh: 25.0000"
									value={pcro}
									onChange={(e) => setPcro(e.target.value)}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
							</div>

							<div className="space-y-1.5">
								<label
									htmlFor="out-tpcro"
									className="block text-xs font-semibold text-foreground"
								>
									Target PCRO (%)
								</label>
								<input
									id="out-tpcro"
									type="number"
									required
									min="0"
									max="100"
									step="0.0001"
									placeholder="Contoh: 25.0000"
									value={tpcro}
									onChange={(e) => setTpcro(e.target.value)}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
							</div>
						</div>

						<div className="flex items-center gap-2 pt-1">
							<input
								id="out-is-confirmed"
								type="checkbox"
								checked={isConfirmed}
								onChange={(e) => setIsConfirmed(e.target.checked)}
								disabled={isSubmitting}
								className="size-4 rounded border-border text-primary focus:ring-primary"
							/>
							<label
								htmlFor="out-is-confirmed"
								className="text-xs text-foreground font-medium cursor-pointer"
							>
								Konfirmasi data pelaporan (Eligible penilaian IKPA)
							</label>
						</div>
					</div>
				</DomainFormDrawer>
			</div>
		</OperatorShell>
	);
}

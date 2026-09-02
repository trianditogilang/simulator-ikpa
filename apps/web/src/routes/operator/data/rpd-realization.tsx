import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
	AlertCircle,
	CheckCircle2,
	Coins,
	CreditCard,
	Percent,
	TrendingUp,
} from "lucide-react";
import { useState } from "react";
import {
	type ColumnDef,
	DomainDataTable,
} from "@/components/data/domain-data-table";
import { DomainFormDrawer } from "@/components/data/domain-form-drawer";
import { OperatorShell } from "@/components/layout/operator-shell";
import { formatPercent, formatRupiah } from "@/lib/format";
import {
	fetchRpdAndRealizations,
	saveRealization,
	saveRpdLine,
} from "@/services/rpd-realization-service";

export const Route = createFileRoute("/operator/data/rpd-realization")({
	loader: async ({ context }) => {
		const activeOrgId =
			context.auth?.isAuthenticated &&
			(context.access?.status === "operator_single_scope" ||
				context.access?.status === "operator_multiple_scopes")
				? (context.access.activeOrganizationId ?? undefined)
				: undefined;

		return fetchRpdAndRealizations(activeOrgId);
	},
	component: RpdRealizationPage,
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

const ACCOUNT_LABELS: Record<string, string> = {
	"51": "Belanja Pegawai (51)",
	"52": "Belanja Barang (52)",
	"53": "Belanja Modal (53)",
	"57": "Belanja Bantuan Sosial (57)",
};

interface MonthlyAccountSummary {
	id: string;
	accountCode: "51" | "52" | "53" | "57";
	accountName: string;
	month: number;
	rpdAmount: number;
	realizationAmount: number;
	deviationPercent: number;
	absorptionPercent: number;
	status: "safe" | "warning" | "danger";
}

function RpdRealizationPage() {
	const router = useRouter();
	const initialData = Route.useLoaderData();

	const [selectedMonth, setSelectedMonth] = useState<number>(
		new Date().getMonth() + 1,
	);
	const [isRpdDrawerOpen, setIsRpdDrawerOpen] = useState(false);
	const [isRealDrawerOpen, setIsRealDrawerOpen] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [actionMessage, setActionMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	// Drawer form states
	const [formAccount, setFormAccount] = useState<"51" | "52" | "53" | "57">("51");
	const [formMonth, setFormMonth] = useState<number>(selectedMonth);
	const [formAmount, setFormAmount] = useState<string>("");

	// Build 4 rows for 4 accounts for selected month
	const monthlyData: MonthlyAccountSummary[] = (
		["51", "52", "53", "57"] as const
	).map((code) => {
		const rpdRow = initialData.rpdLines.find(
			(r) => r.accountCode === code && r.month === selectedMonth,
		);
		const realRow = initialData.realizations.find(
			(r) => r.accountCode === code && r.month === selectedMonth,
		);

		const rpdVal = rpdRow ? Number.parseFloat(rpdRow.amount) || 0 : 0;
		const realVal = realRow ? Number.parseFloat(realRow.amount) || 0 : 0;

		const devPercent =
			rpdVal > 0 ? (Math.abs(realVal - rpdVal) / rpdVal) * 100 : 0;
		const absPercent = rpdVal > 0 ? (realVal / rpdVal) * 100 : 0;

		let status: "safe" | "warning" | "danger" = "safe";
		if (devPercent > 10) status = "danger";
		else if (devPercent > 5) status = "warning";

		return {
			id: `${code}-${selectedMonth}`,
			accountCode: code,
			accountName: ACCOUNT_LABELS[code],
			month: selectedMonth,
			rpdAmount: rpdVal,
			realizationAmount: realVal,
			deviationPercent: devPercent,
			absorptionPercent: absPercent,
			status,
		};
	});

	// Monthly summary totals
	const totalMonthRpd = monthlyData.reduce((s, r) => s + r.rpdAmount, 0);
	const totalMonthReal = monthlyData.reduce(
		(s, r) => s + r.realizationAmount,
		0,
	);
	const avgMonthDev =
		totalMonthRpd > 0
			? (Math.abs(totalMonthReal - totalMonthRpd) / totalMonthRpd) * 100
			: 0;

	const handleSaveRpd = async () => {
		setActionMessage(null);
		setErrorMessage(null);
		const val = Number.parseFloat(formAmount) || 0;

		setIsSubmitting(true);
		try {
			await saveRpdLine({
				month: formMonth,
				accountCode: formAccount,
				amount: val.toFixed(2),
			});
			setActionMessage(
				`Target RPD ${ACCOUNT_LABELS[formAccount]} bulan ${MONTH_NAMES[formMonth - 1]} berhasil diperbarui.`,
			);
			setIsRpdDrawerOpen(false);
			setFormAmount("");
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal menyimpan target RPD.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSaveRealization = async () => {
		setActionMessage(null);
		setErrorMessage(null);
		const val = Number.parseFloat(formAmount) || 0;

		setIsSubmitting(true);
		try {
			await saveRealization({
				month: formMonth,
				accountCode: formAccount,
				amount: val.toFixed(2),
			});
			setActionMessage(
				`Realisasi ${ACCOUNT_LABELS[formAccount]} bulan ${MONTH_NAMES[formMonth - 1]} berhasil diperbarui.`,
			);
			setIsRealDrawerOpen(false);
			setFormAmount("");
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal menyimpan realisasi.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const columns: ColumnDef<MonthlyAccountSummary>[] = [
		{
			key: "account",
			header: "Jenis Belanja",
			render: (item) => (
				<div>
					<span className="font-semibold text-foreground">
						Akun {item.accountCode}
					</span>
					<p className="text-[11px] text-muted-foreground">
						{item.accountName}
					</p>
				</div>
			),
		},
		{
			key: "rpd",
			header: "Target RPD (Hal III DIPA)",
			render: (item) => (
				<div className="flex items-center justify-between gap-2">
					<span className="font-medium text-foreground">
						{formatRupiah(item.rpdAmount)}
					</span>
					<button
						type="button"
						onClick={() => {
							setFormAccount(item.accountCode);
							setFormMonth(selectedMonth);
							setFormAmount(
								item.rpdAmount > 0 ? item.rpdAmount.toString() : "",
							);
							setIsRpdDrawerOpen(true);
						}}
						className="text-[11px] font-semibold text-primary hover:underline"
					>
						Ubah
					</button>
				</div>
			),
		},
		{
			key: "realization",
			header: "Realisasi SP2D",
			render: (item) => (
				<div className="flex items-center justify-between gap-2">
					<span className="font-semibold text-foreground">
						{formatRupiah(item.realizationAmount)}
					</span>
					<button
						type="button"
						onClick={() => {
							setFormAccount(item.accountCode);
							setFormMonth(selectedMonth);
							setFormAmount(
								item.realizationAmount > 0
									? item.realizationAmount.toString()
									: "",
							);
							setIsRealDrawerOpen(true);
						}}
						className="text-[11px] font-semibold text-primary hover:underline"
					>
						Ubah
					</button>
				</div>
			),
		},
		{
			key: "deviation",
			header: "Deviasi (%)",
			render: (item) => (
				<span
					className={`font-semibold ${
						item.status === "danger"
							? "text-danger"
							: item.status === "warning"
								? "text-warning"
								: "text-success"
					}`}
				>
					{formatPercent(item.deviationPercent)}
				</span>
			),
		},
		{
			key: "absorption",
			header: "Penyerapan (%)",
			render: (item) => (
				<span className="font-semibold text-foreground">
					{formatPercent(item.absorptionPercent)}
				</span>
			),
		},
		{
			key: "status",
			header: "Status Kepatuhan",
			render: (item) => {
				const badgeStyle =
					item.status === "safe"
						? "bg-success/10 text-success"
						: item.status === "warning"
							? "bg-warning/10 text-warning"
							: "bg-danger/10 text-danger";

				const label =
					item.status === "safe"
						? "Deviasi <= 5%"
						: item.status === "warning"
							? "Deviasi 5% - 10%"
							: "Deviasi > 10%";

				return (
					<span
						className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${badgeStyle}`}
					>
						{label}
					</span>
				);
			},
		},
	];

	return (
		<OperatorShell currentPath="/operator/data/rpd-realization">
			<div className="space-y-6">
				{/* Top Header Banner */}
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div className="flex items-center gap-3">
						<div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<TrendingUp className="size-5" />
						</div>
						<div>
							<h1 className="text-lg font-bold text-foreground sm:text-xl">
								RPD &amp; Realisasi Anggaran Bulanan
							</h1>
							<p className="text-xs text-muted-foreground">
								Pantau deviasi RPD Halaman III DIPA dan realisasi SP2D per jenis
								belanja untuk memaksimalkan nilai indikator IKPA.
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

				{/* Summary Metrics for Selected Month */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-medium">
								Total RPD {MONTH_NAMES[selectedMonth - 1]}
							</span>
							<Coins className="size-4 text-primary" />
						</div>
						<p className="text-lg font-bold text-foreground sm:text-xl">
							{formatRupiah(totalMonthRpd)}
						</p>
						<p className="text-[11px] text-muted-foreground">
							Target rencana penarikan dana
						</p>
					</div>

					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-medium">
								Total Realisasi {MONTH_NAMES[selectedMonth - 1]}
							</span>
							<CreditCard className="size-4 text-success" />
						</div>
						<p className="text-lg font-bold text-foreground sm:text-xl">
							{formatRupiah(totalMonthReal)}
						</p>
						<p className="text-[11px] text-muted-foreground">
							Akumulasi SP2D terbit
						</p>
					</div>

					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-medium">
								Rata-rata Deviasi Bulan Ini
							</span>
							<Percent
								className={`size-4 ${
									avgMonthDev > 10
										? "text-danger"
										: avgMonthDev > 5
											? "text-warning"
											: "text-success"
								}`}
							/>
						</div>
						<p
							className={`text-lg font-bold sm:text-xl ${
								avgMonthDev > 10
									? "text-danger"
									: avgMonthDev > 5
										? "text-warning"
										: "text-success"
							}`}
						>
							{formatPercent(avgMonthDev)}
						</p>
						<p className="text-[11px] text-muted-foreground">
							Target IKPA: Deviasi &lt;= 5% (Maksimal 100)
						</p>
					</div>
				</div>

				{/* Data Table */}
				<DomainDataTable
					title={`Rincian Deviasi RPD ${MONTH_NAMES[selectedMonth - 1]} 2026`}
					data={monthlyData}
					columns={columns}
					onAddClick={() => {
						setFormMonth(selectedMonth);
						setFormAccount("51");
						setFormAmount("");
						setIsRpdDrawerOpen(true);
					}}
					onImportClick={() => {
						window.location.href = "/operator/import";
					}}
					totalCount={monthlyData.length}
				/>

				{/* Drawer 1: Form Input RPD */}
				<DomainFormDrawer
					isOpen={isRpdDrawerOpen}
					title="Atur Target RPD (Hal III DIPA)"
					description="Masukkan rencana penarikan dana per jenis belanja untuk bulan terpilih."
					onClose={() => setIsRpdDrawerOpen(false)}
					onSubmit={handleSaveRpd}
					isSubmitting={isSubmitting}
				>
					<div className="space-y-4">
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<label
									htmlFor="rpd-month"
									className="block text-xs font-semibold text-foreground"
								>
									Bulan
								</label>
								<select
									id="rpd-month"
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

							<div className="space-y-1.5">
								<label
									htmlFor="rpd-account"
									className="block text-xs font-semibold text-foreground"
								>
									Jenis Belanja
								</label>
								<select
									id="rpd-account"
									value={formAccount}
									onChange={(e) =>
										setFormAccount(
											e.target.value as "51" | "52" | "53" | "57",
										)
									}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								>
									<option value="51">Belanja Pegawai (51)</option>
									<option value="52">Belanja Barang (52)</option>
									<option value="53">Belanja Modal (53)</option>
									<option value="57">Belanja Bansos (57)</option>
								</select>
							</div>
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="rpd-amount"
								className="block text-xs font-semibold text-foreground"
							>
								Nominal RPD Target (Rp)
							</label>
							<input
								id="rpd-amount"
								type="number"
								required
								min="0"
								step="1"
								placeholder="Contoh: 250000000"
								value={formAmount}
								onChange={(e) => setFormAmount(e.target.value)}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							/>
						</div>
					</div>
				</DomainFormDrawer>

				{/* Drawer 2: Form Input Realisasi */}
				<DomainFormDrawer
					isOpen={isRealDrawerOpen}
					title="Atur Realisasi SP2D"
					description="Masukkan realisasi belanja aktual SP2D untuk bulan terpilih."
					onClose={() => setIsRealDrawerOpen(false)}
					onSubmit={handleSaveRealization}
					isSubmitting={isSubmitting}
				>
					<div className="space-y-4">
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<label
									htmlFor="real-month"
									className="block text-xs font-semibold text-foreground"
								>
									Bulan
								</label>
								<select
									id="real-month"
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

							<div className="space-y-1.5">
								<label
									htmlFor="real-account"
									className="block text-xs font-semibold text-foreground"
								>
									Jenis Belanja
								</label>
								<select
									id="real-account"
									value={formAccount}
									onChange={(e) =>
										setFormAccount(
											e.target.value as "51" | "52" | "53" | "57",
										)
									}
									disabled={isSubmitting}
									className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								>
									<option value="51">Belanja Pegawai (51)</option>
									<option value="52">Belanja Barang (52)</option>
									<option value="53">Belanja Modal (53)</option>
									<option value="57">Belanja Bansos (57)</option>
								</select>
							</div>
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="real-amount"
								className="block text-xs font-semibold text-foreground"
							>
								Nominal Realisasi Aktual (Rp)
							</label>
							<input
								id="real-amount"
								type="number"
								required
								min="0"
								step="1"
								placeholder="Contoh: 245000000"
								value={formAmount}
								onChange={(e) => setFormAmount(e.target.value)}
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

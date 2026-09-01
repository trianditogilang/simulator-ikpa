import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OperatorShell } from "@/components/layout/operator-shell";
import { DomainDataTable, type ColumnDef } from "@/components/data/domain-data-table";
import { DomainFormDrawer } from "@/components/data/domain-form-drawer";
import { mockRpdRealizations, type RpdRealizationItem } from "@/mocks/rpd-realization";
import { formatRupiah, formatPercent } from "@/lib/format";

export const Route = createFileRoute("/operator/data/rpd-realization")({
	component: RpdRealizationPage,
});

function RpdRealizationPage() {
	const data = mockRpdRealizations;
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [selectedMonth, setSelectedMonth] = useState<number>(8);

	const filteredData = data.filter((item) => item.month === selectedMonth);

	const columns: ColumnDef<RpdRealizationItem>[] = [
		{
			key: "account",
			header: "Jenis Belanja",
			render: (item) => (
				<div>
					<span className="font-semibold text-foreground">Akun {item.account}</span>
					<p className="text-[11px] text-muted-foreground">{item.accountName}</p>
				</div>
			),
		},
		{
			key: "rpd",
			header: "Target RPD (Hal III DIPA)",
			render: (item) => formatRupiah(item.rpdAmount),
		},
		{
			key: "realization",
			header: "Realisasi SP2D",
			render: (item) => formatRupiah(item.realizationAmount),
		},
		{
			key: "deviation",
			header: "Deviasi (%)",
			render: (item) => (
				<span
					className={`font-semibold ${
						item.deviationPercent > 10 ? "text-warning" : "text-success"
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
			header: "Status Deviasi",
			render: (item) => (
				<span
					className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
						item.status === "safe"
							? "bg-success/10 text-success"
							: "bg-warning/10 text-warning"
					}`}
				>
					{item.status === "safe" ? "Sesuai Target" : "Deviasi > 10%"}
				</span>
			),
		},
	];

	return (
		<OperatorShell currentPath="/operator/data/rpd-realization">
			<div className="space-y-6">
				{/* Top Summary Banner */}
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div>
						<h1 className="text-lg font-bold text-foreground sm:text-xl">
							RPD & Realisasi Anggaran Bulanan
						</h1>
						<p className="text-xs text-muted-foreground">
							Kelola komitmen RPD Halaman III DIPA dan pantau deviasi bulanan serta
							penyerapan triwulanan.
						</p>
					</div>

					<div className="flex items-center gap-2">
						<label htmlFor="monthSelect" className="text-xs font-semibold text-muted-foreground">
							Pilih Bulan:
						</label>
						<select
							id="monthSelect"
							value={selectedMonth}
							onChange={(e) => setSelectedMonth(Number.parseInt(e.target.value, 10))}
							className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
						>
							<option value={8}>Agustus 2026</option>
							<option value={7}>Juli 2026</option>
							<option value={6}>Juni 2026</option>
						</select>
					</div>
				</div>

				<DomainDataTable
					title={`Data RPD & Realisasi — Bulan ${selectedMonth === 8 ? "Agustus" : "Juli"}`}
					data={filteredData}
					columns={columns}
					onAddClick={() => setIsDrawerOpen(true)}
					onImportClick={() => {
						window.location.href = "/operator/import";
					}}
					totalCount={filteredData.length}
				/>

				{/* Add/Edit RPD Form Drawer */}
				<DomainFormDrawer
					isOpen={isDrawerOpen}
					title="Input RPD & Realisasi Bulan Ini"
					description="Masukkan rencana penarikan dana dan realisasi per jenis belanja."
					onClose={() => setIsDrawerOpen(false)}
					onSubmit={() => {
						alert("Data RPD & Realisasi berhasil disimpan.");
						setIsDrawerOpen(false);
					}}
				>
					<div className="space-y-3">
						<div>
							<label htmlFor="accountSelect" className="block text-[11px] font-semibold text-foreground">
								Jenis Belanja (Akun)
							</label>
							<select
								id="accountSelect"
								className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
							>
								<option value="51">51 - Belanja Pegawai</option>
								<option value="52">52 - Belanja Barang</option>
								<option value="53">53 - Belanja Modal</option>
							</select>
						</div>
						<div>
							<label htmlFor="rpdInput" className="block text-[11px] font-semibold text-foreground">
								Target RPD (Rp)
							</label>
							<input
								id="rpdInput"
								type="number"
								defaultValue={150000000}
								className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
							/>
						</div>
						<div>
							<label htmlFor="realizationInput" className="block text-[11px] font-semibold text-foreground">
								Realisasi SP2D (Rp)
							</label>
							<input
								id="realizationInput"
								type="number"
								defaultValue={145000000}
								className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
							/>
						</div>
					</div>
				</DomainFormDrawer>
			</div>
		</OperatorShell>
	);
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
	type ColumnDef,
	DomainDataTable,
} from "@/components/data/domain-data-table";
import { DomainFormDrawer } from "@/components/data/domain-form-drawer";
import { OperatorShell } from "@/components/layout/operator-shell";
import { formatRupiah } from "@/lib/format";
import {
	mockSpmDispensations,
	type SpmDispensationItem,
} from "@/mocks/spm-dispensation";

export const Route = createFileRoute("/operator/data/spm-dispensation")({
	component: SpmDispensationPage,
});

function SpmDispensationPage() {
	const data = mockSpmDispensations;
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [search, setSearch] = useState("");

	const filteredData = data.filter(
		(item) =>
			item.spmNumber.toLowerCase().includes(search.toLowerCase()) ||
			item.dispensationReason.toLowerCase().includes(search.toLowerCase()),
	);

	const columns: ColumnDef<SpmDispensationItem>[] = [
		{
			key: "spm",
			header: "Nomor & Tanggal SPM Q4",
			render: (item) => (
				<div>
					<span className="font-semibold text-foreground">
						{item.spmNumber}
					</span>
					<p className="text-[11px] text-muted-foreground">{item.spmDate}</p>
				</div>
			),
		},
		{
			key: "amount",
			header: "Nominal SPM",
			render: (item) => formatRupiah(item.amount),
		},
		{
			key: "reason",
			header: "Alasan / Keterangan",
			render: (item) => item.dispensationReason,
		},
		{
			key: "status",
			header: "Status Dispensasi",
			render: (item) => (
				<span
					className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
						item.isDispensation
							? "bg-danger/10 text-danger"
							: "bg-success/10 text-success"
					}`}
				>
					{item.isDispensation ? "Dispensasi SPM (−0.75)" : "Normal"}
				</span>
			),
		},
	];

	return (
		<OperatorShell currentPath="/operator/data/spm-dispensation">
			<div className="space-y-6">
				{/* Top Summary Banner */}
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div>
						<h1 className="text-lg font-bold text-foreground sm:text-xl">
							Dispensasi Penerbitan SPM Triwulan IV
						</h1>
						<p className="text-xs text-muted-foreground">
							Pantau penerbitan SPM dispensasi pada akhir tahun anggaran sebagai
							faktor pengurang nilai total IKPA.
						</p>
					</div>

					<div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-2 text-right">
						<span className="text-[11px] text-muted-foreground">
							Potensi Pengurang IKPA
						</span>
						<p className="text-base font-bold text-danger">−0,75 Poin</p>
					</div>
				</div>

				<DomainDataTable
					title="Daftar Penerbitan SPM Q4 & Riwayat Dispensasi"
					data={filteredData}
					columns={columns}
					searchValue={search}
					onSearchChange={setSearch}
					onAddClick={() => setIsDrawerOpen(true)}
					onImportClick={() => {
						window.location.href = "/operator/import";
					}}
					totalCount={filteredData.length}
				/>

				{/* Add SPM Drawer */}
				<DomainFormDrawer
					isOpen={isDrawerOpen}
					title="Rekam SPM Dispensasi Q4"
					description="Masukkan data SPM yang diterbitkan dengan surat dispensasi KPPN."
					onClose={() => setIsDrawerOpen(false)}
					onSubmit={() => {
						alert("Data dispensasi SPM berhasil disimpan.");
						setIsDrawerOpen(false);
					}}
				>
					<div className="space-y-3">
						<div>
							<label
								htmlFor="spmNum"
								className="block text-[11px] font-semibold text-foreground"
							>
								Nomor SPM
							</label>
							<input
								id="spmNum"
								type="text"
								defaultValue="SPM-LS/0095/2026"
								className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
							/>
						</div>
						<div>
							<label
								htmlFor="spmReason"
								className="block text-[11px] font-semibold text-foreground"
							>
								Alasan Dispensasi
							</label>
							<input
								id="spmReason"
								type="text"
								defaultValue="Penyampaian SPM melampaui batas jam layanan akhir tahun"
								className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
							/>
						</div>
						<div>
							<label
								htmlFor="spmNominal"
								className="block text-[11px] font-semibold text-foreground"
							>
								Nominal SPM (Rp)
							</label>
							<input
								id="spmNominal"
								type="number"
								defaultValue={180000000}
								className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
							/>
						</div>
					</div>
				</DomainFormDrawer>
			</div>
		</OperatorShell>
	);
}

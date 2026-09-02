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
	type ContractInvoiceItem,
	mockContractsInvoices,
} from "@/mocks/contracts-invoices";

export const Route = createFileRoute("/operator/data/contracts-invoices")({
	component: ContractsInvoicesPage,
});

function ContractsInvoicesPage() {
	const data = mockContractsInvoices;
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [search, setSearch] = useState("");

	const filteredData = data.filter(
		(item) =>
			item.contractNumber.toLowerCase().includes(search.toLowerCase()) ||
			item.vendorName.toLowerCase().includes(search.toLowerCase()),
	);

	const columns: ColumnDef<ContractInvoiceItem>[] = [
		{
			key: "contract",
			header: "Nomor & Rekanan Kontrak",
			render: (item) => (
				<div>
					<span className="font-semibold text-foreground">
						{item.contractNumber}
					</span>
					<p className="text-[11px] text-muted-foreground">{item.vendorName}</p>
				</div>
			),
		},
		{
			key: "value",
			header: "Nilai Kontrak",
			render: (item) => formatRupiah(item.contractValue),
		},
		{
			key: "bast",
			header: "Tanggal BAST/BAPP",
			render: (item) => item.bastDate,
		},
		{
			key: "deadline",
			header: "Batas 17 Hari Kerja",
			render: (item) => (
				<div>
					<span className="font-semibold text-foreground">
						{item.deadlineDate}
					</span>
					<p className="text-[11px] text-muted-foreground">
						{item.status === "completed"
							? "SPM Terbit"
							: item.workDaysLeft === 0
								? "Batas Lewat"
								: `${item.workDaysLeft} hari kerja lagi`}
					</p>
				</div>
			),
		},
		{
			key: "status",
			header: "Status Tagihan",
			render: (item) => (
				<span
					className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
						item.status === "completed"
							? "bg-success/10 text-success"
							: item.status === "warning"
								? "bg-warning/10 text-warning"
								: "bg-danger/10 text-danger"
					}`}
				>
					{item.statusLabel}
				</span>
			),
		},
	];

	return (
		<OperatorShell currentPath="/operator/data/contracts-invoices">
			<div className="space-y-6">
				{/* Top Summary Banner */}
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div>
						<h1 className="text-lg font-bold text-foreground sm:text-xl">
							Kontrak & Penyelesaian Tagihan (SPM-LS)
						</h1>
						<p className="text-xs text-muted-foreground">
							Pantau kepatuhan penyampaian kontrak 3 hari kerja dan penyelesaian
							tagihan H+17 hari kerja sejak BAST.
						</p>
					</div>

					<div className="flex items-center gap-2">
						<div className="rounded-xl border border-warning/30 bg-warning/5 px-3 py-1.5 text-xs font-semibold text-warning">
							⚠ 1 Tagihan Kritis (H-2)
						</div>
					</div>
				</div>

				<DomainDataTable
					title="Daftar Tagihan & SPM-LS Kontraktual"
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

				{/* Add Invoice Form Drawer */}
				<DomainFormDrawer
					isOpen={isDrawerOpen}
					title="Rekam Tagihan BAST / SPM-LS Baru"
					description="Masukkan data BAST untuk memulai kalkulasi tenggat 17 hari kerja."
					onClose={() => setIsDrawerOpen(false)}
					onSubmit={() => {
						alert("Data tagihan BAST berhasil ditambahkan.");
						setIsDrawerOpen(false);
					}}
				>
					<div className="space-y-3">
						<div>
							<label
								htmlFor="invContract"
								className="block text-[11px] font-semibold text-foreground"
							>
								Nomor Kontrak
							</label>
							<input
								id="invContract"
								type="text"
								defaultValue="KTR-2026/015/08-04"
								className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
							/>
						</div>
						<div>
							<label
								htmlFor="invVendor"
								className="block text-[11px] font-semibold text-foreground"
							>
								Nama Rekanan / Penyedia
							</label>
							<input
								id="invVendor"
								type="text"
								defaultValue="PT Solusi Prima Mandiri"
								className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
							/>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<div>
								<label
									htmlFor="invVal"
									className="block text-[11px] font-semibold text-foreground"
								>
									Nilai Tagihan (Rp)
								</label>
								<input
									id="invVal"
									type="number"
									defaultValue={320000000}
									className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
								/>
							</div>
							<div>
								<label
									htmlFor="invDate"
									className="block text-[11px] font-semibold text-foreground"
								>
									Tanggal BAST
								</label>
								<input
									id="invDate"
									type="date"
									defaultValue="2026-08-20"
									className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
								/>
							</div>
						</div>
					</div>
				</DomainFormDrawer>
			</div>
		</OperatorShell>
	);
}

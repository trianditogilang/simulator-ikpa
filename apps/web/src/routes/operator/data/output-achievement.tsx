import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
	type ColumnDef,
	DomainDataTable,
} from "@/components/data/domain-data-table";
import { DomainFormDrawer } from "@/components/data/domain-form-drawer";
import { OperatorShell } from "@/components/layout/operator-shell";
import { formatPercent } from "@/lib/format";
import {
	mockOutputAchievements,
	type OutputAchievementItem,
} from "@/mocks/output-achievement";

export const Route = createFileRoute("/operator/data/output-achievement")({
	component: OutputAchievementPage,
});

function OutputAchievementPage() {
	const data = mockOutputAchievements;
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [search, setSearch] = useState("");

	const filteredData = data.filter(
		(item) =>
			item.roCode.toLowerCase().includes(search.toLowerCase()) ||
			item.roName.toLowerCase().includes(search.toLowerCase()),
	);

	const columns: ColumnDef<OutputAchievementItem>[] = [
		{
			key: "ro",
			header: "Kode & Rincian Output (RO)",
			render: (item) => (
				<div>
					<span className="font-semibold text-foreground">{item.roCode}</span>
					<p className="text-[11px] text-muted-foreground">{item.roName}</p>
				</div>
			),
		},
		{
			key: "pcro",
			header: "PCRO (%)",
			render: (item) => formatPercent(item.pcroPercent),
		},
		{
			key: "tpcro",
			header: "Target PCRO (%)",
			render: (item) => formatPercent(item.tpcroPercent),
		},
		{
			key: "rvro",
			header: "Realisasi Volume (RVRO)",
			render: (item) => `${item.rvroValue} Output`,
		},
		{
			key: "status",
			header: "Status Konfirmasi",
			render: (item) => (
				<span
					className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
						item.isConfirmed
							? "bg-success/10 text-success"
							: "bg-warning/10 text-warning"
					}`}
				>
					{item.isConfirmed
						? "Terkonfirmasi"
						: "Belum Konfirmasi (Eligible Belum)"}
				</span>
			),
		},
	];

	return (
		<OperatorShell currentPath="/operator/data/output-achievement">
			<div className="space-y-6">
				{/* Top Summary Banner */}
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div>
						<h1 className="text-lg font-bold text-foreground sm:text-xl">
							Capaian Output Satker (PCRO / RVRO)
						</h1>
						<p className="text-xs text-muted-foreground">
							Kelola pelaporan capaian output bulanan dan pastikan konfirmasi
							data sebelum batas 5 hari kerja awal bulan.
						</p>
					</div>

					<div className="rounded-xl border border-warning/30 bg-warning/5 px-3 py-1.5 text-xs font-semibold text-warning">
						⚠ 1 RO Membutuhkan Konfirmasi
					</div>
				</div>

				<DomainDataTable
					title="Daftar Laporan Capaian Rincian Output"
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

				{/* Add/Edit RO Form Drawer */}
				<DomainFormDrawer
					isOpen={isDrawerOpen}
					title="Input Laporan Capaian Output (RO)"
					description="Masukkan data progres fisik dan volume capaian rincian output."
					onClose={() => setIsDrawerOpen(false)}
					onSubmit={() => {
						alert("Laporan capaian output berhasil disimpan.");
						setIsDrawerOpen(false);
					}}
				>
					<div className="space-y-3">
						<div>
							<label
								htmlFor="roCodeInput"
								className="block text-[11px] font-semibold text-foreground"
							>
								Kode Rincian Output (RO)
							</label>
							<input
								id="roCodeInput"
								type="text"
								defaultValue="015.08.WA.5231.EBA.003"
								className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
							/>
						</div>
						<div>
							<label
								htmlFor="roNameInput"
								className="block text-[11px] font-semibold text-foreground"
							>
								Nama Rincian Output
							</label>
							<input
								id="roNameInput"
								type="text"
								defaultValue="Pengelolaan Sistem Akuntansi Satker"
								className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
							/>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<div>
								<label
									htmlFor="pcroInput"
									className="block text-[11px] font-semibold text-foreground"
								>
									PCRO (%)
								</label>
								<input
									id="pcroInput"
									type="number"
									defaultValue={100}
									className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
								/>
							</div>
							<div>
								<label
									htmlFor="rvroInput"
									className="block text-[11px] font-semibold text-foreground"
								>
									Realisasi Volume (RVRO)
								</label>
								<input
									id="rvroInput"
									type="number"
									defaultValue={1}
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

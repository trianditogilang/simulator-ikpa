import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OperatorShell } from "@/components/layout/operator-shell";
import { DomainDataTable, type ColumnDef } from "@/components/data/domain-data-table";
import { DomainFormDrawer } from "@/components/data/domain-form-drawer";
import { mockBudgetRevisions, type BudgetRevisionItem } from "@/mocks/budget-revisions";
import { formatRupiah } from "@/lib/format";

export const Route = createFileRoute("/operator/data/budget-revisions")({
	component: BudgetRevisionsPage,
});

function BudgetRevisionsPage() {
	const data = mockBudgetRevisions;
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [search, setSearch] = useState("");

	const filteredData = data.filter((item) =>
		item.notes.toLowerCase().includes(search.toLowerCase()) ||
		item.dipaNumber.toLowerCase().includes(search.toLowerCase())
	);

	const columns: ColumnDef<BudgetRevisionItem>[] = [
		{
			key: "seq",
			header: "Revisi Ke-",
			render: (item) => (
				<span className="font-semibold text-foreground">
					{item.revisionSequence === 0 ? "DIPA Induk (0)" : `Revisi ${item.revisionSequence}`}
				</span>
			),
		},
		{
			key: "date",
			header: "Tanggal Pengesahan",
			render: (item) => item.revisionDate,
		},
		{
			key: "semester",
			header: "Semester",
			render: (item) => `Semester ${item.semester}`,
		},
		{
			key: "pagu51",
			header: "Pagu Pegawai (51)",
			render: (item) => formatRupiah(item.pagu51),
		},
		{
			key: "pagu52",
			header: "Pagu Barang (52)",
			render: (item) => formatRupiah(item.pagu52),
		},
		{
			key: "pagu53",
			header: "Pagu Modal (53)",
			render: (item) => formatRupiah(item.pagu53),
		},
		{
			key: "total",
			header: "Total Pagu",
			render: (item) => (
				<span className="font-bold text-foreground">
					{formatRupiah(item.totalPagu)}
				</span>
			),
		},
		{
			key: "status",
			header: "Eligibilitas IKPA",
			render: (item) => (
				<span className="rounded-md bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
					{item.isEligibleIkpa ? "Eligible" : "Dikecualikan"}
				</span>
			),
		},
	];

	return (
		<OperatorShell currentPath="/operator/data/budget-revisions">
			<div className="space-y-6">
				{/* Top Summary Banner */}
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div>
						<h1 className="text-lg font-bold text-foreground sm:text-xl">
							Pagu & Histori Revisi DIPA
						</h1>
						<p className="text-xs text-muted-foreground">
							Kelola alokasi pagu per jenis belanja dan catat histori pengesahan revisi
							DIPA per semester.
						</p>
					</div>
					<div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 text-right">
						<span className="text-[11px] text-muted-foreground">Total Pagu Aktif</span>
						<p className="text-base font-bold text-primary">
							{formatRupiah(5500000000)}
						</p>
					</div>
				</div>

				<DomainDataTable
					title="Daftar Pengesahan DIPA & Revisi"
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

				{/* Add Revision Form Drawer */}
				<DomainFormDrawer
					isOpen={isDrawerOpen}
					title="Tambah Data Revisi DIPA"
					description="Masukkan data perubahan pagu DIPA hasil pengesahan DJA/Kanwil."
					onClose={() => setIsDrawerOpen(false)}
					onSubmit={() => {
						alert("Data revisi DIPA berhasil ditambahkan ke simulasi.");
						setIsDrawerOpen(false);
					}}
				>
					<div className="space-y-3">
						<div>
							<label htmlFor="dipaNumber" className="block text-[11px] font-semibold text-foreground">
								Nomor DIPA / SP DIPA
							</label>
							<input
								id="dipaNumber"
								type="text"
								defaultValue="DIPA-015.08.2.123456/2026"
								className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
							/>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<div>
								<label htmlFor="revSeq" className="block text-[11px] font-semibold text-foreground">
									Revisi Ke-
								</label>
								<input
									id="revSeq"
									type="number"
									defaultValue={2}
									className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
								/>
							</div>
							<div>
								<label htmlFor="semester" className="block text-[11px] font-semibold text-foreground">
									Semester
								</label>
								<select
									id="semester"
									className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
								>
									<option value={1}>Semester 1</option>
									<option value={2}>Semester 2</option>
								</select>
							</div>
						</div>
						<div>
							<label htmlFor="pagu52" className="block text-[11px] font-semibold text-foreground">
								Pagu Belanja Barang (52)
							</label>
							<input
								id="pagu52"
								type="number"
								defaultValue={2000000000}
								className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
							/>
						</div>
					</div>
				</DomainFormDrawer>
			</div>
		</OperatorShell>
	);
}

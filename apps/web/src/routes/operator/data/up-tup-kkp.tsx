import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OperatorShell } from "@/components/layout/operator-shell";
import {
	DomainDataTable,
	type ColumnDef,
} from "@/components/data/domain-data-table";
import { DomainFormDrawer } from "@/components/data/domain-form-drawer";
import { mockUpTupKkpList, type UpTupKkpItem } from "@/mocks/up-tup-kkp";
import { formatRupiah } from "@/lib/format";

export const Route = createFileRoute("/operator/data/up-tup-kkp")({
	component: UpTupKkpPage,
});

function UpTupKkpPage() {
	const data = mockUpTupKkpList;
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [search, setSearch] = useState("");

	const filteredData = data.filter(
		(item) =>
			item.referenceNumber.toLowerCase().includes(search.toLowerCase()) ||
			item.transactionType.toLowerCase().includes(search.toLowerCase()),
	);

	const columns: ColumnDef<UpTupKkpItem>[] = [
		{
			key: "ref",
			header: "Jenis & Nomor SP2D",
			render: (item) => (
				<div>
					<span className="font-semibold text-foreground">
						{item.referenceNumber}
					</span>
					<p className="text-[11px] text-muted-foreground">
						{item.transactionType}
					</p>
				</div>
			),
		},
		{
			key: "amount",
			header: "Nominal",
			render: (item) => formatRupiah(item.amount),
		},
		{
			key: "date",
			header: "Tanggal SP2D / Transaksi",
			render: (item) => item.sp2dDate,
		},
		{
			key: "interval",
			header: "Interval Revolving (Hari)",
			render: (item) => `${item.intervalDays} Hari`,
		},
		{
			key: "status",
			header: "Status Revolving",
			render: (item) => (
				<span className="rounded-md bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
					{item.statusLabel}
				</span>
			),
		},
	];

	return (
		<OperatorShell currentPath="/operator/data/up-tup-kkp">
			<div className="space-y-6">
				{/* Top Summary Banner */}
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div>
						<h1 className="text-lg font-bold text-foreground sm:text-xl">
							Pengelolaan UP / TUP & Kartu Kredit Pemerintah (KKP)
						</h1>
						<p className="text-xs text-muted-foreground">
							Pantau revolving GUP 1 bulan sekali, penyelesaian TUP, dan
							proporsi penggunaan KKP (100% bobot).
						</p>
					</div>

					<div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 text-right">
						<span className="text-[11px] text-muted-foreground">
							Nilai Pengelolaan UP/TUP
						</span>
						<p className="text-base font-bold text-primary">96,00</p>
					</div>
				</div>

				<DomainDataTable
					title="Histori Transaksi UP, GUP, PTUP, dan KKP"
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

				{/* Add UP/TUP Form Drawer */}
				<DomainFormDrawer
					isOpen={isDrawerOpen}
					title="Rekam Transaksi UP / TUP / KKP"
					description="Masukkan data SP2D revolving atau tagihan KKP."
					onClose={() => setIsDrawerOpen(false)}
					onSubmit={() => {
						alert("Transaksi berhasil disimpan.");
						setIsDrawerOpen(false);
					}}
				>
					<div className="space-y-3">
						<div>
							<label
								htmlFor="txType"
								className="block text-[11px] font-semibold text-foreground"
							>
								Tipe Transaksi
							</label>
							<select
								id="txType"
								className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
							>
								<option value="GUP">GUP - Ganti Uang Persediaan</option>
								<option value="PTUP">PTUP - Pertanggungjawaban TUP</option>
								<option value="KKP">
									KKP - Pembayaran Kartu Kredit Pemerintah
								</option>
							</select>
						</div>
						<div>
							<label
								htmlFor="txRef"
								className="block text-[11px] font-semibold text-foreground"
							>
								Nomor SP2D
							</label>
							<input
								id="txRef"
								type="text"
								defaultValue="SP2D-GUP/0034/2026"
								className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
							/>
						</div>
						<div>
							<label
								htmlFor="txAmount"
								className="block text-[11px] font-semibold text-foreground"
							>
								Nominal (Rp)
							</label>
							<input
								id="txAmount"
								type="number"
								defaultValue={75000000}
								className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
							/>
						</div>
					</div>
				</DomainFormDrawer>
			</div>
		</OperatorShell>
	);
}

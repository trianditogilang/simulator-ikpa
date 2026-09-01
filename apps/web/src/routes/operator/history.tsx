import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OperatorShell } from "@/components/layout/operator-shell";
import { DomainDataTable, type ColumnDef } from "@/components/data/domain-data-table";
import { mockSimulations, type SimulationHistoryItem } from "@/mocks/simulations";
import { formatNumber } from "@/lib/format";

export const Route = createFileRoute("/operator/history")({
	component: OperatorHistoryPage,
});

function OperatorHistoryPage() {
	const data = mockSimulations;
	const [search, setSearch] = useState("");
	const [selectedItems, setSelectedItems] = useState<string[]>([]);

	const filteredData = data.filter((item) =>
		item.name.toLowerCase().includes(search.toLowerCase()) ||
		item.periodLabel.toLowerCase().includes(search.toLowerCase())
	);

	const toggleSelect = (id: string) => {
		setSelectedItems((prev) =>
			prev.includes(id) ? prev.filter((i) => i !== id) : prev.length < 2 ? [...prev, id] : [prev[1], id]
		);
	};

	const columns: ColumnDef<SimulationHistoryItem>[] = [
		{
			key: "select",
			header: "Pilih",
			render: (item) => (
				<input
					type="checkbox"
					checked={selectedItems.includes(item.id)}
					onChange={() => toggleSelect(item.id)}
					className="size-4 rounded border-border text-primary focus:ring-primary"
				/>
			),
		},
		{
			key: "name",
			header: "Nama Skenario / Snapshot",
			render: (item) => (
				<div>
					<span className="font-semibold text-foreground">{item.name}</span>
					<p className="text-[11px] text-muted-foreground">Waktu: {item.createdAt}</p>
				</div>
			),
		},
		{
			key: "type",
			header: "Tipe",
			render: (item) => (
				<span
					className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
						item.type === "actual"
							? "bg-surface-muted text-foreground"
							: item.type === "scenario"
								? "bg-primary/10 text-primary"
								: "bg-info/10 text-info"
					}`}
				>
					{item.type === "actual" ? "Actual" : item.type === "scenario" ? "Skenario" : "Forecast"}
				</span>
			),
		},
		{
			key: "period",
			header: "Periode",
			render: (item) => item.periodLabel,
		},
		{
			key: "score",
			header: "Nilai IKPA",
			render: (item) => (
				<span className="text-sm font-bold text-foreground">
					{formatNumber(item.totalScore)}
				</span>
			),
		},
		{
			key: "ruleset",
			header: "Rule Set",
			render: (item) => `v${item.ruleSetVersion}`,
		},
	];

	return (
		<OperatorShell currentPath="/operator/history">
			<div className="space-y-6">
				{/* Top Summary Banner */}
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div>
						<h1 className="text-lg font-bold text-foreground sm:text-xl">
							Skenario & Riwayat Simulasi IKPA
						</h1>
						<p className="text-xs text-muted-foreground">
							Kelola snapshot nilai tersimpan dan bandingkan dua skenario simulasi
							secara langsung.
						</p>
					</div>

					<div className="flex items-center gap-2">
						{selectedItems.length === 2 && (
							<button
								type="button"
								onClick={() => {
									alert("Membuka perbandingan dua skenario.");
								}}
								className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary-hover"
							>
								Bandingkan 2 Skenario
							</button>
						)}
					</div>
				</div>

				<DomainDataTable
					title="Daftar Skenario & Snapshot Nilai"
					data={filteredData}
					columns={columns}
					searchValue={search}
					onSearchChange={setSearch}
					onAddClick={() => {
						window.location.href = "/operator/simulation";
					}}
					totalCount={filteredData.length}
				/>
			</div>
		</OperatorShell>
	);
}

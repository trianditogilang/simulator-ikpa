import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { OperatorShell } from "@/components/layout/operator-shell";
import {
	DomainDataTable,
	type ColumnDef,
} from "@/components/data/domain-data-table";
import {
	mockSimulations,
	type SimulationHistoryItem,
} from "@/mocks/simulations";
import { formatNumber } from "@/lib/format";

export const Route = createFileRoute("/operator/history")({
	component: OperatorHistoryPage,
});

function OperatorHistoryPage() {
	const data = mockSimulations;
	const [search, setSearch] = useState("");
	const [selectedItems, setSelectedItems] = useState<string[]>([]);
	const [isComparing, setIsComparing] = useState(false);

	const filteredData = data.filter(
		(item) =>
			item.name.toLowerCase().includes(search.toLowerCase()) ||
			item.periodLabel.toLowerCase().includes(search.toLowerCase()),
	);

	const toggleSelect = (id: string) => {
		setSelectedItems((prev) =>
			prev.includes(id)
				? prev.filter((i) => i !== id)
				: prev.length < 2
					? [...prev, id]
					: [prev[1], id],
		);
	};

	const selectedSims = data.filter((item) => selectedItems.includes(item.id));

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
					<p className="text-[11px] text-muted-foreground">
						Waktu: {item.createdAt}
					</p>
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
					{item.type === "actual"
						? "Actual"
						: item.type === "scenario"
							? "Skenario"
							: "Forecast"}
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
							Kelola snapshot nilai tersimpan dan bandingkan dua skenario
							simulasi secara langsung.
						</p>
					</div>

					<div className="flex items-center gap-2">
						{selectedItems.length === 2 && (
							<button
								type="button"
								onClick={() => setIsComparing(true)}
								className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary-hover"
							>
								Bandingkan 2 Skenario
							</button>
						)}
					</div>
				</div>

				{/* Interactive Comparison Dialog / Panel */}
				{isComparing && selectedSims.length === 2 && (
					<div className="rounded-2xl border border-primary/30 bg-background p-5 shadow-md">
						<div className="flex items-center justify-between border-b border-border/80 pb-3">
							<div>
								<h2 className="text-sm font-bold text-foreground sm:text-base">
									Perbandingan Skenario: {selectedSims[0].name} vs{" "}
									{selectedSims[1].name}
								</h2>
								<p className="text-xs text-muted-foreground">
									Analisis delta selisih poin per indikator antara kedua
									simulasi.
								</p>
							</div>
							<button
								type="button"
								onClick={() => setIsComparing(false)}
								className="rounded-lg border border-border px-3 py-1 text-xs font-semibold text-foreground hover:bg-surface-muted"
							>
								Tutup Perbandingan
							</button>
						</div>

						<div className="mt-4 grid grid-cols-2 gap-4">
							<div className="rounded-xl border border-border bg-surface p-4 text-center">
								<span className="text-xs font-semibold text-muted-foreground">
									{selectedSims[0].name}
								</span>
								<p className="mt-1 text-2xl font-bold text-foreground">
									{formatNumber(selectedSims[0].totalScore)}
								</p>
								<span className="text-[11px] text-muted-foreground">
									Tipe: {selectedSims[0].type.toUpperCase()}
								</span>
							</div>

							<div className="rounded-xl border border-primary/40 bg-primary/5 p-4 text-center">
								<span className="text-xs font-semibold text-primary">
									{selectedSims[1].name}
								</span>
								<p className="mt-1 text-2xl font-bold text-primary">
									{formatNumber(selectedSims[1].totalScore)}
								</p>
								<span className="text-[11px] font-semibold text-success">
									Selisih: +
									{formatNumber(
										Math.abs(
											selectedSims[1].totalScore - selectedSims[0].totalScore,
										),
									)}{" "}
									Poin
								</span>
							</div>
						</div>
					</div>
				)}

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

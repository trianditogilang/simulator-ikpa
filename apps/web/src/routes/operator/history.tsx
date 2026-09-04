import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
	type ColumnDef,
	DomainDataTable,
} from "@/components/data/domain-data-table";
import { OperatorShell } from "@/components/layout/operator-shell";
import { formatNumber } from "@/lib/format";
import { fetchSnapshots, type ScoreSnapshotRecord } from "@/services/simulation-service";

export const Route = createFileRoute("/operator/history")({
	loader: async ({ context }) => {
		const activeOrgId =
			context.auth?.isAuthenticated &&
			(context.access?.status === "operator_single_scope" ||
				context.access?.status === "operator_multiple_scopes")
				? (context.access.activeOrganizationId ?? undefined)
				: undefined;
		try {
			return await fetchSnapshots(activeOrgId);
		} catch {
			return { snapshots: [] as ScoreSnapshotRecord[] };
		}
	},
	component: OperatorHistoryPage,
});

const INDICATOR_LABELS: Record<string, string> = {
	dipa_revision: "Revisi DIPA",
	rpd_deviation: "Deviasi Hal III",
	budget_absorption: "Penyerapan",
	contractual: "Kontraktual",
	invoice_timeliness: "Tagihan",
	up_tup: "UP/TUP",
	output_achievement: "Output",
	spm_dispensasi: "Dispensasi (pengurang)",
};

function breakdownOf(snap: ScoreSnapshotRecord): Array<{ key: string; contrib: number }> {
	const b = snap.breakdownJson as unknown as {
		indicators?: Array<{ key: string; weightedContribution?: string | null }>;
		dispensationDeduction?: string;
	} | null;
	if (!b) return [];
	const rows = (b.indicators ?? []).map((i) => ({
		key: i.key,
		contrib: Number(i.weightedContribution ?? "0") || 0,
	}));
	rows.push({ key: "spm_dispensasi", contrib: -(Number(b.dispensationDeduction ?? "0") || 0) });
	return rows;
}

function OperatorHistoryPage() {
	const { snapshots } = Route.useLoaderData();
	const [search, setSearch] = useState("");
	const [selectedItems, setSelectedItems] = useState<string[]>([]);
	const [isComparing, setIsComparing] = useState(false);

	const filteredData = useMemo(
		() =>
			snapshots.filter((item) =>
				`${item.simulationName} ${item.simulationType}`.toLowerCase().includes(search.toLowerCase()),
			),
		[snapshots, search],
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

	const selectedSims = snapshots.filter((item) => selectedItems.includes(item.id));

	const columns: ColumnDef<ScoreSnapshotRecord>[] = [
		{
			key: "select",
			header: "Pilih",
			render: (item) => (
				<input
					type="checkbox"
					aria-label={`Pilih ${item.simulationName}`}
					checked={selectedItems.includes(item.id)}
					onChange={() => toggleSelect(item.id)}
					className="size-4 rounded border-border text-primary focus:ring-primary"
				/>
			),
		},
		{
			key: "name",
			header: "Nama",
			render: (item) => (
				<div>
					<span className="font-semibold text-foreground">{item.simulationName}</span>
					<p className="text-[11px] text-muted-foreground">
						{new Date(item.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
					</p>
				</div>
			),
		},
		{
			key: "type",
			header: "Tipe",
			render: (item) => (
				<span className="rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-semibold">
					{item.simulationType === "actual" ? "Aktual" : item.simulationType === "scenario" ? "Skenario" : "Proyeksi"}
				</span>
			),
		},
		{
			key: "score",
			header: "Nilai IKPA",
			render: (item) => (
				<span className="text-sm font-bold text-foreground">
					{formatNumber(Number(item.totalScore ?? "0") || 0)}
				</span>
			),
		},
	];

	const compareRows = useMemo(() => {
		if (selectedSims.length !== 2) return [];
		const a = new Map(breakdownOf(selectedSims[0]).map((r) => [r.key, r.contrib]));
		const b = new Map(breakdownOf(selectedSims[1]).map((r) => [r.key, r.contrib]));
		return [...INDICATOR_LABELS ? Object.keys(INDICATOR_LABELS) : []].map((key) => ({
			key,
			label: INDICATOR_LABELS[key],
			a: a.get(key) ?? 0,
			b: b.get(key) ?? 0,
			delta: (b.get(key) ?? 0) - (a.get(key) ?? 0),
		}));
	}, [selectedSims]);

	return (
		<OperatorShell currentPath="/operator/history">
			<div className="space-y-6">
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5">
					<div>
						<h1 className="text-lg font-bold text-foreground sm:text-xl">
							Riwayat Simulasi
						</h1>
						<p className="text-xs text-muted-foreground">
							Aktual, Proyeksi, dan Skenario dengan rincian 8 indikator.
						</p>
					</div>
					{selectedItems.length === 2 && (
						<button
							type="button"
							onClick={() => setIsComparing(true)}
							className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-hover"
						>
							Bandingkan 2
						</button>
					)}
				</div>

				{isComparing && selectedSims.length === 2 && (
					<div className="rounded-2xl border border-primary/30 bg-background p-5">
						<div className="flex items-center justify-between border-b border-border/80 pb-3">
							<h2 className="text-sm font-bold text-foreground">
								{selectedSims[0].simulationName} vs {selectedSims[1].simulationName}
							</h2>
							<button
								type="button"
								onClick={() => setIsComparing(false)}
								className="rounded-lg border border-border px-3 py-1 text-xs font-semibold hover:bg-surface-muted"
							>
								Tutup
							</button>
						</div>
						<div className="mt-3 space-y-1.5 text-xs">
							{compareRows.map((r) => (
								<div key={r.key} className="flex items-center justify-between rounded-lg border border-border/60 px-2.5 py-1.5">
									<span className="font-medium text-foreground">{r.label}</span>
									<span className="text-muted-foreground">
										{formatNumber(r.a)} → {formatNumber(r.b)}{" "}
										<strong className={r.delta >= 0 ? "text-success" : "text-danger"}>
											({r.delta >= 0 ? "+" : ""}{formatNumber(r.delta)})
										</strong>
									</span>
								</div>
							))}
						</div>
					</div>
				)}

				{snapshots.length === 0 ? (
					<div className="rounded-2xl border border-border bg-background p-6 text-center text-xs text-muted-foreground">
						Belum ada snapshot. Buat dari menu Simulasi, lalu arsipkan via Simpan Hasil Saat Ini / Simpan Skenario.
					</div>
				) : (
					<DomainDataTable
						title="Daftar Snapshot"
						data={filteredData}
						columns={columns}
						searchValue={search}
						onSearchChange={setSearch}
						onAddClick={() => {
							window.location.href = "/operator/simulation";
						}}
						totalCount={filteredData.length}
					/>
				)}
			</div>
		</OperatorShell>
	);
}

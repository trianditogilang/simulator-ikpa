import { createFileRoute } from "@tanstack/react-router";
import {
	ArrowRight,
	Building2,
	CheckCircle2,
	Search,
	ShieldAlert,
	Sparkles,
} from "lucide-react";
import { useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import {
	fetchAdminDashboard,
	fetchAdminReminderPolicies,
} from "@/services/admin-monitoring-service";

export const Route = createFileRoute("/admin-kppn/dashboard")({
	loader: async () => {
		const [dashboard, reminderPolicies] = await Promise.all([
			fetchAdminDashboard(),
			fetchAdminReminderPolicies(),
		]);
		return { dashboard, reminderPolicies };
	},
	component: AdminDashboardPage,
});

const INDICATOR_META = [
	{ key: "dipa_revision", label: "Revisi DIPA", weight: 10 },
	{ key: "rpd_deviation", label: "Deviasi Hal III", weight: 15 },
	{ key: "budget_absorption", label: "Penyerapan Anggaran", weight: 20 },
	{ key: "contractual", label: "Belanja Kontraktual", weight: 10 },
	{ key: "invoice_timeliness", label: "Penyelesaian Tagihan", weight: 10 },
	{ key: "up_tup", label: "UP/TUP & KKP", weight: 10 },
	{ key: "output_achievement", label: "Capaian Output", weight: 25 },
	{ key: "spm_dispensasi", label: "Dispensasi SPM", weight: 0 },
];

function AdminDashboardPage() {
	const { dashboard: data, reminderPolicies } = Route.useLoaderData();
	const mandatoryPolicies = (reminderPolicies.policies ?? []).filter(
		(p) => p.isActive && !p.allowDisable,
	);
	const avgByKey = new Map(
		(data.indicatorAverages ?? []).map((r) => [r.key, r]),
	);
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<
		"all" | "danger" | "warning" | "safe"
	>("all");

	const filteredSatkers = data.satkerSummaries.filter((satker) => {
		const matchQuery =
			satker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			satker.code.includes(searchQuery) ||
			satker.mainRisk.toLowerCase().includes(searchQuery.toLowerCase());

		const matchStatus =
			statusFilter === "all" || satker.status === statusFilter;

		return matchQuery && matchStatus;
	});

	return (
		<AdminShell currentPath="/admin-kppn/dashboard">
			<div className="space-y-6">
				{/* Top Heading */}
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
							Monitoring Kinerja Satuan Kerja Mitra
						</h1>
						<p className="text-xs text-muted-foreground sm:text-sm">
							Pemantauan kepatuhan dan agregasi nilai IKPA seluruh Satker di
							bawah lingkup KPPN.
						</p>
					</div>

					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => {
								window.location.href = "/admin-kppn/organizations";
							}}
							className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90"
						>
							<Building2 className="size-3.5" />
							<span>Semua Satker ({data.totalSatkers})</span>
						</button>
					</div>
				</div>

				{/* Aggregate Metric Cards */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-medium">Total Satker Mitra</span>
							<Building2 className="size-4 text-primary" />
						</div>
						<p className="text-2xl font-bold text-foreground">
							{data.totalSatkers} Satker
						</p>
						<p className="text-[11px] text-muted-foreground">
							KPPN Wilayah Operasional
						</p>
					</div>

					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-medium">Rata-rata IKPA Wilayah</span>
							<Sparkles className="size-4 text-success" />
						</div>
						<p className="text-2xl font-bold text-success">
							{data.averageScore.toFixed(2)} Poin
						</p>
						<p className="text-[11px] text-muted-foreground">
							Kategori Sangat Baik (&gt;90)
						</p>
					</div>

					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-medium">Satker Berisiko Tinggi</span>
							<ShieldAlert className="size-4 text-danger" />
						</div>
						<p className="text-2xl font-bold text-danger">
							{data.riskySatkersCount} Satker
						</p>
						<p className="text-[11px] text-muted-foreground">
							Nilai IKPA &lt; 75 / Indikator Merah
						</p>
					</div>

					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-medium">Satker Kinerja Aman</span>
							<CheckCircle2 className="size-4 text-primary" />
						</div>
						<p className="text-2xl font-bold text-foreground">
							{data.safeSatkersCount} Satker
						</p>
						<p className="text-[11px] text-muted-foreground">
							Kepatuhan &amp; target terpenuhi
						</p>
					</div>
				</div>

				{/* Risk Distribution Summary */}
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-warning/30 bg-warning/5 p-4 text-xs shadow-xs">
					<div className="flex items-center gap-2">
						<ShieldAlert className="size-4 text-warning shrink-0" />
						<span className="font-semibold text-foreground">
							Distribusi Faktor Risiko Wilayah:
						</span>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<span className="rounded-md bg-surface px-2.5 py-1 font-semibold text-foreground">
							Deviasi Hal III: {data.riskySatkersCount > 0 ? "2 Satker" : "0 Satker"}
						</span>
						<span className="rounded-md bg-surface px-2.5 py-1 font-semibold text-foreground">
							Revolving UP/TUP: {data.warningSatkersCount > 0 ? "1 Satker" : "0 Satker"}
						</span>
						<span className="rounded-md bg-surface px-2.5 py-1 font-semibold text-foreground">
							Tagihan SPM-LS: 1 Satker
						</span>
					</div>
				</div>

				{/* Aggregate 8 Indicators (read-only) */}
				<div className="space-y-3 rounded-2xl border border-border bg-background p-5 shadow-xs">
					<div>
						<h2 className="text-base font-bold text-foreground">
							Agregat 8 Indikator Wilayah
						</h2>
						<p className="text-xs text-muted-foreground">
							Rata-rata skor snapshot terkini per indikator. Read-only.
						</p>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full text-left text-xs">
							<thead>
								<tr className="border-b border-border text-muted-foreground">
									<th className="pb-2 font-semibold">Indikator</th>
									<th className="pb-2 font-semibold text-right">Bobot</th>
									<th className="pb-2 font-semibold text-right">
										Rata-rata Wilayah
									</th>
									<th className="pb-2 font-semibold text-right">
										Satker Terdata
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{INDICATOR_META.map((meta) => {
									const row = avgByKey.get(meta.key);
									return (
										<tr key={meta.key} className="hover:bg-surface/60 transition">
											<td className="py-2 font-semibold text-foreground">
												{meta.label}
											</td>
											<td className="py-2 text-right text-muted-foreground">
												{meta.weight > 0 ? `${meta.weight}%` : "pengurang"}
											</td>
											<td className="py-2 text-right font-bold text-foreground">
												{row?.avgScore !== null && row?.avgScore !== undefined
													? row.avgScore.toFixed(2)
													: "—"}
											</td>
											<td className="py-2 text-right text-muted-foreground">
												{row?.satkerCount ?? 0}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</div>

				{/* Mandatory Deadlines (read-only, from policy backend) */}
				<div className="space-y-2 rounded-2xl border border-border bg-background p-5 shadow-xs">
					<div>
						<h2 className="text-base font-bold text-foreground">
							Deadline Wajib Kebijakan Aktif
						</h2>
						<p className="text-xs text-muted-foreground">
							Jadwal lead time yang tidak boleh dinonaktifkan. Read-only.
						</p>
					</div>
					{mandatoryPolicies.length === 0 ? (
						<p className="text-xs text-muted-foreground">
							Tidak ada kebijakan mandatory aktif.
						</p>
					) : (
						<div className="flex flex-wrap items-center gap-2">
							{mandatoryPolicies.map((p) => (
								<span
									key={p.id}
									className="rounded-md bg-surface px-2.5 py-1 text-[11px] font-semibold text-foreground"
								>
									{p.eventType} • H-{p.minLeadDays}–H-{p.maxLeadDays}
								</span>
							))}
						</div>
					)}
				</div>

				{/* Filter & Satker Rankings Table */}
				<div className="space-y-4 rounded-2xl border border-border bg-background p-5 shadow-xs">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<h2 className="text-base font-bold text-foreground">
								Daftar Kinerja &amp; Peringkat Satker
							</h2>
							<p className="text-xs text-muted-foreground">
								Monitoring skor terkini dan identifikasi satker yang memerlukan
								pembinaan.
							</p>
						</div>

						{/* Search & Filter */}
						<div className="flex items-center gap-2">
							<div className="relative">
								<Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
								<input
									type="text"
									placeholder="Cari kode / nama satker..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="min-h-9 rounded-lg border border-border bg-surface pl-8 pr-3 text-xs text-foreground focus:border-primary focus:outline-none"
								/>
							</div>

							<select
								value={statusFilter}
								onChange={(e) =>
									setStatusFilter(e.target.value as any)
								}
								className="min-h-9 rounded-lg border border-border bg-surface px-2 text-xs text-foreground focus:border-primary focus:outline-none"
							>
								<option value="all">Semua Status</option>
								<option value="danger">Berisiko</option>
								<option value="warning">Perlu Perhatian</option>
								<option value="safe">Optimal</option>
							</select>
						</div>
					</div>

					<div className="overflow-x-auto">
						<table className="w-full text-left text-xs">
							<thead>
								<tr className="border-b border-border text-muted-foreground">
									<th className="pb-3 font-semibold">Kode &amp; Nama Satker</th>
									<th className="pb-3 font-semibold">Nilai IKPA</th>
									<th className="pb-3 font-semibold">Status Kepatuhan</th>
									<th className="pb-3 font-semibold">Faktor Risiko Utama</th>
									<th className="pb-3 font-semibold text-right">Aksi</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{filteredSatkers.length === 0 ? (
									<tr>
										<td
											colSpan={5}
											className="py-8 text-center text-muted-foreground"
										>
											Tidak ada data satker yang sesuai kriteria pencarian.
										</td>
									</tr>
								) : (
									filteredSatkers.map((satker) => (
										<tr
											key={satker.id}
											className="hover:bg-surface/60 transition"
										>
											<td className="py-3.5">
												<span className="font-semibold text-foreground">
													{satker.name}
												</span>
												<p className="text-[11px] text-muted-foreground">
													Kode: {satker.code} {satker.isBlu ? "(BLU)" : ""}
												</p>
											</td>
											<td className="py-3.5">
												<span className="font-bold text-foreground sm:text-sm">
													{satker.score.toFixed(2)}
												</span>
											</td>
											<td className="py-3.5">
												<span
													className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
														satker.status === "danger"
															? "bg-danger/10 text-danger"
															: satker.status === "warning"
																? "bg-warning/10 text-warning"
																: "bg-success/10 text-success"
													}`}
												>
													{satker.status === "danger"
														? "Berisiko Tinggi"
														: satker.status === "warning"
															? "Perlu Perhatian"
															: "Sangat Baik"}
												</span>
											</td>
											<td className="py-3.5 text-muted-foreground">
												{satker.mainRisk}
											</td>
											<td className="py-3.5 text-right">
												<button
													type="button"
													onClick={() => {
														window.location.href = `/admin-kppn/organizations/${satker.id}`;
													}}
													className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition"
												>
													<span>Detail</span>
													<ArrowRight className="size-3" />
												</button>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</AdminShell>
	);
}

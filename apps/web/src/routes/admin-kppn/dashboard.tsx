import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { RiskOverview } from "@/components/admin/risk-overview";
import { getMockAdminDashboardData } from "@/mocks/admin-dashboard";
import { ArrowRight, Building2, Search } from "lucide-react";

export const Route = createFileRoute("/admin-kppn/dashboard")({
	component: AdminDashboardPage,
});

function AdminDashboardPage() {
	const [scenario, setScenario] = useState<
		"normal" | "risky" | "delivery-failed" | "policy-changed" | "no-data"
	>("normal");
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<"all" | "danger" | "warning" | "safe">("all");

	const data = getMockAdminDashboardData(scenario);

	const filteredSatkers = data.satkerSummaries.filter((satker) => {
		const matchQuery =
			satker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			satker.code.includes(searchQuery) ||
			satker.mainRisk.toLowerCase().includes(searchQuery.toLowerCase());

		const matchStatus = statusFilter === "all" || satker.status === statusFilter;

		return matchQuery && matchStatus;
	});

	return (
		<AdminShell currentPath="/admin-kppn/dashboard">
			<div className="space-y-6">
				{/* Scenario Switcher for Demo / Mock Testing */}
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface p-3.5">
					<div className="flex flex-wrap items-center gap-2">
						<span className="text-xs font-semibold text-muted-foreground">
							Skenario Data Admin:
						</span>
						<div className="flex flex-wrap items-center gap-1">
							<button
								type="button"
								onClick={() => setScenario("normal")}
								className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
									scenario === "normal"
										? "bg-primary text-primary-foreground shadow-xs"
										: "bg-background text-foreground hover:bg-surface-muted"
								}`}
							>
								Normal (48 Satker)
							</button>
							<button
								type="button"
								onClick={() => setScenario("risky")}
								className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
									scenario === "risky"
										? "bg-danger text-primary-foreground shadow-xs"
										: "bg-background text-foreground hover:bg-surface-muted"
								}`}
							>
								Banyak Risiko
							</button>
							<button
								type="button"
								onClick={() => setScenario("delivery-failed")}
								className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
									scenario === "delivery-failed"
										? "bg-warning text-primary-foreground shadow-xs"
										: "bg-background text-foreground hover:bg-surface-muted"
								}`}
							>
								Delivery Gagal
							</button>
							<button
								type="button"
								onClick={() => setScenario("policy-changed")}
								className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
									scenario === "policy-changed"
										? "bg-primary/90 text-primary-foreground shadow-xs"
										: "bg-background text-foreground hover:bg-surface-muted"
								}`}
							>
								Perubahan Policy
							</button>
							<button
								type="button"
								onClick={() => setScenario("no-data")}
								className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
									scenario === "no-data"
										? "bg-surface-muted text-foreground shadow-xs"
										: "bg-background text-foreground hover:bg-surface-muted"
								}`}
							>
								Kosong (No Data)
							</button>
						</div>
					</div>
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<span>Scope: {data.kppnName} ({data.kppnCode})</span>
						<span>•</span>
						<span>Update: {data.lastUpdated}</span>
					</div>
				</div>

				{/* Header Section */}
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
							Dashboard Monitoring IKPA
						</h1>
						<p className="text-xs text-muted-foreground sm:text-sm">
							Pengawasan kinerja pelaksanaan anggaran satker lingkup {data.kppnName} ({data.fiscalYear})
						</p>
					</div>
					<div className="flex items-center gap-2">
						<a
							href="/admin-kppn/reports"
							className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-muted"
						>
							<span>Laporan Agregat</span>
						</a>
						<a
							href="/admin-kppn/organizations"
							className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 shadow-xs"
						>
							<Building2 className="size-3.5" />
							<span>Daftar Satker</span>
						</a>
					</div>
				</div>

				{/* Main Risk Overview */}
				<RiskOverview
					kpi={data.kpi}
					riskySatkers={data.riskySatkers}
					upcomingDeadlines={data.upcomingDeadlines}
					policyStatus={data.policyStatus}
					monthlyTrend={data.monthlyTrend}
				/>

				{/* Quick Satker Monitoring Table */}
				<div className="space-y-4 rounded-xl border border-border/80 bg-surface p-5 shadow-xs">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<h3 className="text-sm font-semibold text-foreground">
								Monitoring Kinerja Satker
							</h3>
							<p className="text-xs text-muted-foreground">
								Ringkasan nilai IKPA dan status risiko per satker mitra KPPN
							</p>
						</div>

						{/* Search and Filters */}
						<div className="flex flex-wrap items-center gap-2">
							<div className="relative">
								<Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
								<input
									type="text"
									placeholder="Cari satker / kode..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="h-8 rounded-lg border border-border bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
								/>
							</div>

							<div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5">
								<button
									type="button"
									onClick={() => setStatusFilter("all")}
									className={`rounded px-2 py-1 text-[11px] font-semibold transition ${
										statusFilter === "all"
											? "bg-surface-muted text-foreground"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									Semua
								</button>
								<button
									type="button"
									onClick={() => setStatusFilter("danger")}
									className={`rounded px-2 py-1 text-[11px] font-semibold transition ${
										statusFilter === "danger"
											? "bg-danger/10 text-danger"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									Kritis
								</button>
								<button
									type="button"
									onClick={() => setStatusFilter("warning")}
									className={`rounded px-2 py-1 text-[11px] font-semibold transition ${
										statusFilter === "warning"
											? "bg-warning/10 text-warning"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									Waspada
								</button>
								<button
									type="button"
									onClick={() => setStatusFilter("safe")}
									className={`rounded px-2 py-1 text-[11px] font-semibold transition ${
										statusFilter === "safe"
											? "bg-success/10 text-success"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									Aman
								</button>
							</div>

							<a
								href="/admin-kppn/organizations"
								className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-surface-muted"
							>
								<span>Lihat Semua</span>
								<ArrowRight className="size-3" />
							</a>
						</div>
					</div>

					{/* Table / Mobile Cards */}
					<div className="overflow-x-auto">
						<table className="w-full text-left text-xs">
							<thead>
								<tr className="border-b border-border/80 bg-surface-muted/50 text-muted-foreground font-medium">
									<th className="py-2.5 pl-3 pr-2">Kode</th>
									<th className="px-3 py-2.5">Nama Satker</th>
									<th className="px-3 py-2.5 text-right">IKPA</th>
									<th className="px-3 py-2.5 text-right">Gap</th>
									<th className="px-3 py-2.5">Risiko Utama</th>
									<th className="px-3 py-2.5">Deadline Terdekat</th>
									<th className="px-3 py-2.5 text-center">Status</th>
									<th className="py-2.5 pl-2 pr-3 text-right">Aksi</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border/60">
								{filteredSatkers.length === 0 ? (
									<tr>
										<td colSpan={8} className="py-8 text-center text-muted-foreground">
											Tidak ada satker yang cocok dengan kriteria pencarian.
										</td>
									</tr>
								) : (
									filteredSatkers.map((satker) => (
										<tr
											key={satker.id}
											className="transition-colors hover:bg-surface-muted/40"
										>
											<td className="py-2.5 pl-3 pr-2 font-semibold text-foreground">
												{satker.code}
											</td>
											<td className="px-3 py-2.5 font-medium text-foreground">
												{satker.name}
											</td>
											<td className="px-3 py-2.5 text-right font-semibold text-foreground">
												{satker.score.toFixed(2).replace(".", ",")}
											</td>
											<td
												className={`px-3 py-2.5 text-right font-semibold ${
													satker.gap < 0 ? "text-danger" : "text-success"
												}`}
											>
												{satker.gap.toFixed(2).replace(".", ",")}
											</td>
											<td className="px-3 py-2.5 text-muted-foreground">
												{satker.mainRisk}
											</td>
											<td className="px-3 py-2.5 text-muted-foreground">
												{satker.nearestDeadline}
											</td>
											<td className="px-3 py-2.5 text-center">
												<span
													className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
														satker.status === "danger"
															? "bg-danger/10 text-danger"
															: satker.status === "warning"
																? "bg-warning/10 text-warning"
																: "bg-success/10 text-success"
													}`}
												>
													{satker.status === "danger"
														? "Kritis"
														: satker.status === "warning"
															? "Waspada"
															: "Aman"}
												</span>
											</td>
											<td className="py-2.5 pl-2 pr-3 text-right">
												<a
													href={`/admin-kppn/organizations/${satker.id}`}
													className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-4 hover:underline"
												>
													Detail
												</a>
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

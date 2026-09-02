import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { getMockAdminOrganizations } from "@/mocks/admin-organizations";

export const Route = createFileRoute("/admin-kppn/organizations/")({
	component: AdminOrganizationsPage,
});

function AdminOrganizationsPage() {
	const allSatkers = getMockAdminOrganizations();

	const [searchQuery, setSearchQuery] = useState("");
	const [riskFilter, setRiskFilter] = useState<string>("all");
	const [indicatorFilter, setIndicatorFilter] = useState<string>("all");
	const [completenessFilter, setCompletenessFilter] = useState<string>("all");
	const [currentPage, setCurrentPage] = useState(1);
	const pageSize = 5;

	const filteredSatkers = useMemo(() => {
		return allSatkers.filter((satker) => {
			const matchQuery =
				satker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				satker.code.includes(searchQuery) ||
				satker.primaryRisk.toLowerCase().includes(searchQuery.toLowerCase());

			const matchRisk = riskFilter === "all" || satker.riskLevel === riskFilter;

			const matchIndicator =
				indicatorFilter === "all" ||
				satker.primaryIndicatorKey === indicatorFilter;

			const matchCompleteness =
				completenessFilter === "all" ||
				satker.dataCompleteness === completenessFilter;

			return matchQuery && matchRisk && matchIndicator && matchCompleteness;
		});
	}, [
		allSatkers,
		searchQuery,
		riskFilter,
		indicatorFilter,
		completenessFilter,
	]);

	const totalPages = Math.max(1, Math.ceil(filteredSatkers.length / pageSize));
	const paginatedSatkers = filteredSatkers.slice(
		(currentPage - 1) * pageSize,
		currentPage * pageSize,
	);

	return (
		<AdminShell currentPath="/admin-kppn/organizations">
			<div className="space-y-6">
				{/* Top Heading */}
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
							Daftar Satker Mitra KPPN
						</h1>
						<p className="text-xs text-muted-foreground sm:text-sm">
							Monitoring dan evaluasi kinerja {allSatkers.length} Satuan Kerja
							di bawah KPPN Malang (032)
						</p>
					</div>

					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => {
								alert("Mengekspor daftar seluruh satker (XLSX)...");
							}}
							className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-muted shadow-xs"
						>
							<Download className="size-3.5" />
							<span>Ekspor Satker</span>
						</button>
					</div>
				</div>

				{/* Filter & Search Bar */}
				<div className="space-y-3 rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
					<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
						{/* Search Input */}
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<input
								aria-label="Cari satker"
								type="text"
								placeholder="Cari kode satker, nama kementerian/lembaga, atau indikator risiko..."
								value={searchQuery}
								onChange={(e) => {
									setSearchQuery(e.target.value);
									setCurrentPage(1);
								}}
								className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
							/>
						</div>

						{/* Dropdown Filters */}
						<div className="flex flex-wrap items-center gap-2">
							{/* Filter Risiko */}
							<select
								aria-label="Filter status risiko"
								value={riskFilter}
								onChange={(e) => {
									setRiskFilter(e.target.value);
									setCurrentPage(1);
								}}
								className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							>
								<option value="all">Semua Status Risiko</option>
								<option value="danger">Kritis (Skor &lt; 90)</option>
								<option value="warning">Waspada (90 - 94)</option>
								<option value="safe">Aman (≥ 95)</option>
							</select>

							{/* Filter Indikator */}
							<select
								aria-label="Filter indikator IKPA"
								value={indicatorFilter}
								onChange={(e) => {
									setIndicatorFilter(e.target.value);
									setCurrentPage(1);
								}}
								className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							>
								<option value="all">Semua Indikator</option>
								<option value="invoice_timeliness">Penyelesaian Tagihan</option>
								<option value="rpd_deviation">Deviasi Hal III DIPA</option>
								<option value="up_tup">Pengelolaan UP/TUP</option>
								<option value="output_achievement">Capaian Output</option>
								<option value="budget_absorption">Penyerapan Anggaran</option>
								<option value="spm_dispensation">Dispensasi SPM</option>
							</select>

							{/* Filter Kelengkapan */}
							<select
								aria-label="Filter kelengkapan data"
								value={completenessFilter}
								onChange={(e) => {
									setCompletenessFilter(e.target.value);
									setCurrentPage(1);
								}}
								className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							>
								<option value="all">Semua Kelengkapan</option>
								<option value="complete">Data Lengkap</option>
								<option value="warning">Perlu Konfirmasi</option>
								<option value="incomplete">Incomplete</option>
							</select>
						</div>
					</div>

					{/* Active Filter Summary */}
					<div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
						<span>
							Menampilkan{" "}
							<strong className="text-foreground">
								{filteredSatkers.length}
							</strong>{" "}
							dari {allSatkers.length} satker
						</span>
						{(searchQuery ||
							riskFilter !== "all" ||
							indicatorFilter !== "all" ||
							completenessFilter !== "all") && (
							<button
								type="button"
								onClick={() => {
									setSearchQuery("");
									setRiskFilter("all");
									setIndicatorFilter("all");
									setCompletenessFilter("all");
									setCurrentPage(1);
								}}
								className="font-semibold text-primary underline-offset-4 hover:underline"
							>
								Reset Filter
							</button>
						)}
					</div>
				</div>

				{/* Desktop Table View */}
				<div className="hidden rounded-xl border border-border/80 bg-surface shadow-xs md:block">
					<div className="overflow-x-auto">
						<table className="w-full text-left text-xs">
							<thead>
								<tr className="border-b border-border/80 bg-surface-muted/50 font-semibold text-muted-foreground">
									<th className="py-3 pl-4 pr-2">Kode</th>
									<th className="px-3 py-3">Nama Satker</th>
									<th className="px-3 py-3 text-right">Skor IKPA</th>
									<th className="px-3 py-3 text-right">Gap Target</th>
									<th className="px-3 py-3">Risiko Utama / Indikator</th>
									<th className="px-3 py-3">Deadline Terdekat</th>
									<th className="px-3 py-3 text-center">Kelengkapan</th>
									<th className="py-3 pl-2 pr-4 text-right">Aksi</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border/60">
								{paginatedSatkers.length === 0 ? (
									<tr>
										<td
											colSpan={8}
											className="py-12 text-center text-muted-foreground"
										>
											Tidak ada satker yang cocok dengan filter yang dipilih.
										</td>
									</tr>
								) : (
									paginatedSatkers.map((satker) => (
										<tr
											key={satker.id}
											className="transition-colors hover:bg-surface-muted/30"
										>
											<td className="py-3 pl-4 pr-2 font-semibold text-foreground">
												{satker.code}
											</td>
											<td className="px-3 py-3">
												<div className="flex items-center gap-1.5 font-medium text-foreground">
													<span>{satker.name}</span>
													{satker.isBlu && (
														<span className="rounded bg-primary/10 px-1 py-0.5 text-[10px] font-semibold text-primary">
															BLU
														</span>
													)}
												</div>
												<span className="text-[11px] text-muted-foreground">
													{satker.operatorCount} operator terdaftar
												</span>
											</td>
											<td className="px-3 py-3 text-right font-semibold text-foreground">
												{satker.totalScore.toFixed(2).replace(".", ",")}
											</td>
											<td
												className={`px-3 py-3 text-right font-semibold ${
													satker.gapScore < 0 ? "text-danger" : "text-success"
												}`}
											>
												{satker.gapScore.toFixed(2).replace(".", ",")}
											</td>
											<td className="px-3 py-3">
												<div className="flex flex-col gap-0.5">
													<span
														className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${
															satker.riskLevel === "danger"
																? "bg-danger/10 text-danger"
																: satker.riskLevel === "warning"
																	? "bg-warning/10 text-warning"
																	: "bg-success/10 text-success"
														}`}
													>
														{satker.primaryIndicatorLabel}
													</span>
													<span className="truncate max-w-xs text-muted-foreground">
														{satker.primaryRisk}
													</span>
												</div>
											</td>
											<td className="px-3 py-3 text-muted-foreground">
												<div className="flex flex-col">
													<span>{satker.nearestDeadline}</span>
													<span
														className={`text-[11px] font-semibold ${
															satker.workDaysLeft <= 3
																? "text-danger"
																: "text-muted-foreground"
														}`}
													>
														H-{satker.workDaysLeft} hari kerja
													</span>
												</div>
											</td>
											<td className="px-3 py-3 text-center">
												<span
													className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
														satker.dataCompleteness === "complete"
															? "bg-success/10 text-success"
															: satker.dataCompleteness === "warning"
																? "bg-warning/10 text-warning"
																: "bg-danger/10 text-danger"
													}`}
												>
													{satker.dataCompleteness === "complete"
														? "Lengkap"
														: satker.dataCompleteness === "warning"
															? "Perlu Konfirmasi"
															: "Incomplete"}
												</span>
											</td>
											<td className="py-3 pl-2 pr-4 text-right">
												<a
													href={`/admin-kppn/organizations/${satker.id}`}
													className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground"
												>
													<span>Detail</span>
													<ArrowRight className="size-3" />
												</a>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>

				{/* Mobile Card List View */}
				<div className="space-y-3 md:hidden">
					{paginatedSatkers.length === 0 ? (
						<div className="rounded-xl border border-dashed border-border/80 bg-surface p-8 text-center text-xs text-muted-foreground">
							Tidak ada satker yang cocok dengan filter yang dipilih.
						</div>
					) : (
						paginatedSatkers.map((satker) => (
							<div
								key={satker.id}
								className="space-y-3 rounded-xl border border-border/80 bg-surface p-4 shadow-xs"
							>
								<div className="flex items-start justify-between gap-2">
									<div>
										<div className="flex items-center gap-1.5">
											<span className="rounded bg-surface-muted px-1.5 py-0.5 text-xs font-semibold text-foreground">
												{satker.code}
											</span>
											{satker.isBlu && (
												<span className="rounded bg-primary/10 px-1 py-0.5 text-[10px] font-semibold text-primary">
													BLU
												</span>
											)}
										</div>
										<h3 className="mt-1 text-sm font-semibold text-foreground">
											{satker.name}
										</h3>
									</div>
									<div className="text-right">
										<div className="text-sm font-semibold text-foreground">
											{satker.totalScore.toFixed(2).replace(".", ",")}
										</div>
										<div
											className={`text-xs font-medium ${
												satker.gapScore < 0 ? "text-danger" : "text-success"
											}`}
										>
											Gap {satker.gapScore.toFixed(2).replace(".", ",")}
										</div>
									</div>
								</div>

								<div className="rounded-lg bg-surface-muted/50 p-2.5 text-xs text-muted-foreground">
									<div className="flex items-center justify-between">
										<span className="font-semibold text-foreground">
											{satker.primaryIndicatorLabel}
										</span>
										<span
											className={`font-semibold ${
												satker.workDaysLeft <= 3
													? "text-danger"
													: "text-muted-foreground"
											}`}
										>
											H-{satker.workDaysLeft} kerja ({satker.nearestDeadline})
										</span>
									</div>
									<p className="mt-1 text-[11px] text-foreground/80">
										{satker.primaryRisk}
									</p>
								</div>

								<div className="flex items-center justify-between pt-1">
									<span
										className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
											satker.dataCompleteness === "complete"
												? "bg-success/10 text-success"
												: satker.dataCompleteness === "warning"
													? "bg-warning/10 text-warning"
													: "bg-danger/10 text-danger"
										}`}
									>
										{satker.dataCompleteness === "complete"
											? "Data Lengkap"
											: satker.dataCompleteness === "warning"
												? "Perlu Konfirmasi"
												: "Incomplete"}
									</span>
									<a
										href={`/admin-kppn/organizations/${satker.id}`}
										className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-4 hover:underline"
									>
										<span>Lihat Detail Read-only</span>
										<ArrowRight className="size-3" />
									</a>
								</div>
							</div>
						))
					)}
				</div>

				{/* Pagination Controls */}
				<div className="flex items-center justify-between rounded-xl border border-border/80 bg-surface px-4 py-3 text-xs text-muted-foreground shadow-xs">
					<span>
						Halaman <strong className="text-foreground">{currentPage}</strong>{" "}
						dari {totalPages}
					</span>
					<div className="flex items-center gap-2">
						<button
							type="button"
							disabled={currentPage === 1}
							onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
							className="rounded-lg border border-border bg-background px-3 py-1.5 font-semibold text-foreground transition hover:bg-surface-muted disabled:opacity-40"
						>
							Sebelumnya
						</button>
						<button
							type="button"
							disabled={currentPage === totalPages}
							onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
							className="rounded-lg border border-border bg-background px-3 py-1.5 font-semibold text-foreground transition hover:bg-surface-muted disabled:opacity-40"
						>
							Berikutnya
						</button>
					</div>
				</div>
			</div>
		</AdminShell>
	);
}

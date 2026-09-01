import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { getMockRuleSets } from "@/mocks/rule-sets";
import {
	ArrowRight,
	Copy,
	GitCompare,
	Lock,
	Plus,
	Scale,
	X,
} from "lucide-react";

export const Route = createFileRoute("/admin-kppn/policy/rule-sets/")({
	component: AdminRuleSetsPage,
});

function AdminRuleSetsPage() {
	const ruleSets = getMockRuleSets();

	const [yearFilter, setYearFilter] = useState<string>("all");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [compareOpen, setCompareOpen] = useState(false);

	const filteredRuleSets = ruleSets.filter((rs) => {
		const matchYear = yearFilter === "all" || rs.year.toString() === yearFilter;
		const matchStatus = statusFilter === "all" || rs.status === statusFilter;
		return matchYear && matchStatus;
	});

	const publishedVersion =
		ruleSets.find((r) => r.status === "published") || ruleSets[0];
	const draftVersion =
		ruleSets.find((r) => r.status === "draft") || ruleSets[1];

	return (
		<AdminShell currentPath="/admin-kppn/policy/rule-sets">
			<div className="space-y-6">
				{/* Top Heading */}
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
							Rule Set IKPA Berversi
						</h1>
						<p className="text-xs text-muted-foreground sm:text-sm">
							Kelola parameter, bobot indikator, dan formula penilaian IKPA
							tanpa perlu deploy ulang aplikasi
						</p>
					</div>

					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => setCompareOpen(true)}
							className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-muted shadow-xs"
						>
							<GitCompare className="size-3.5 text-primary" />
							<span>Bandingkan Versi</span>
						</button>

						<a
							href="/admin-kppn/policy/rule-sets/rs-2026-2"
							className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 shadow-xs"
						>
							<Plus className="size-3.5" />
							<span>Buat Draft Rule Set</span>
						</a>
					</div>
				</div>

				{/* Active Rule Set Summary Card */}
				<div className="rounded-xl border border-primary/20 bg-primary/5 p-5 shadow-xs">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div className="space-y-1">
							<div className="flex items-center gap-2">
								<Scale className="size-4 text-primary" />
								<span className="text-xs font-semibold uppercase tracking-wider text-primary">
									Rule Set Aktif Nasional
								</span>
								<span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
									Published ✓
								</span>
							</div>
							<h2 className="text-base font-semibold text-foreground">
								Versi {publishedVersion.version} —{" "}
								{publishedVersion.sourceRegulation}
							</h2>
							<p className="text-xs text-muted-foreground">
								Berlaku efektif sejak: {publishedVersion.effectiveFrom} •
								Disahkan oleh: {publishedVersion.authorName}
							</p>
						</div>

						<a
							href={`/admin-kppn/policy/rule-sets/${publishedVersion.id}`}
							className="inline-flex items-center gap-1 self-start rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 sm:self-center"
						>
							<span>Lihat Konfigurasi</span>
							<ArrowRight className="size-3.5" />
						</a>
					</div>
				</div>

				{/* Filter & Toolbar */}
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface p-4 shadow-xs text-xs">
					<div className="flex flex-wrap items-center gap-2">
						<span className="font-semibold text-muted-foreground">Filter:</span>
						<select
							aria-label="Filter tahun rule set"
							value={yearFilter}
							onChange={(e) => setYearFilter(e.target.value)}
							className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
						>
							<option value="all">Semua Tahun</option>
							<option value="2026">Tahun 2026</option>
							<option value="2025">Tahun 2025</option>
						</select>

						<select
							aria-label="Filter status rule set"
							value={statusFilter}
							onChange={(e) => setStatusFilter(e.target.value)}
							className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
						>
							<option value="all">Semua Status</option>
							<option value="published">Published</option>
							<option value="draft">Draft</option>
							<option value="retired">Retired (Arsip)</option>
						</select>
					</div>

					<span className="text-muted-foreground">
						Menampilkan {filteredRuleSets.length} versi rule set
					</span>
				</div>

				{/* Rule Sets Table View */}
				<div className="rounded-xl border border-border/80 bg-surface shadow-xs">
					<div className="overflow-x-auto">
						<table className="w-full text-left text-xs">
							<thead>
								<tr className="border-b border-border/80 bg-surface-muted/50 font-semibold text-muted-foreground">
									<th className="py-3 pl-4 pr-2">Versi</th>
									<th className="px-3 py-3">Status</th>
									<th className="px-3 py-3">Tanggal Efektif</th>
									<th className="px-3 py-3">Sumber Regulasi</th>
									<th className="px-3 py-3">Pembuat</th>
									<th className="px-3 py-3 text-center">Total Bobot</th>
									<th className="py-3 pl-2 pr-4 text-right">Aksi</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border/60">
								{filteredRuleSets.map((rs) => (
									<tr
										key={rs.id}
										className="transition-colors hover:bg-surface-muted/30"
									>
										<td className="py-3 pl-4 pr-2 font-semibold text-foreground">
											<div className="flex items-center gap-1.5">
												<span>{rs.version}</span>
												{rs.isLocked && (
													<span title="Terkunci (Published/Retired)">
														<Lock className="size-3 text-muted-foreground" />
													</span>
												)}
											</div>
										</td>
										<td className="px-3 py-3">
											<span
												className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
													rs.status === "published"
														? "bg-success/10 text-success"
														: rs.status === "draft"
															? "bg-warning/10 text-warning"
															: "bg-surface-muted text-muted-foreground"
												}`}
											>
												{rs.status === "published"
													? "Published ✓"
													: rs.status === "draft"
														? "Draft"
														: "Retired"}
											</span>
										</td>
										<td className="px-3 py-3 font-medium text-foreground">
											{rs.effectiveFrom}
										</td>
										<td className="px-3 py-3 text-muted-foreground max-w-xs truncate">
											{rs.sourceRegulation}
										</td>
										<td className="px-3 py-3 text-muted-foreground">
											{rs.authorName}
										</td>
										<td className="px-3 py-3 text-center font-semibold text-foreground">
											{rs.validationStatus.totalWeight}%
										</td>
										<td className="py-3 pl-2 pr-4 text-right">
											<div className="flex items-center justify-end gap-1.5">
												{rs.status === "draft" ? (
													<a
														href={`/admin-kppn/policy/rule-sets/${rs.id}`}
														className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs"
													>
														<span>Edit Draft</span>
													</a>
												) : (
													<a
														href={`/admin-kppn/policy/rule-sets/${rs.id}`}
														className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-primary hover:bg-surface-muted"
													>
														<span>Lihat</span>
													</a>
												)}

												<button
													type="button"
													onClick={() => {
														alert(
															`Membuat kloning baru dari Rule Set ${rs.version}...`,
														);
													}}
													className="rounded-md p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
													title="Duplikasi / Clone Rule Set"
												>
													<Copy className="size-3.5" />
												</button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>

				{/* Compare Modal */}
				{compareOpen && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
						<div className="w-full max-w-2xl rounded-xl border border-border bg-background p-6 shadow-2xl space-y-4">
							<div className="flex items-start justify-between">
								<div>
									<h3 className="text-base font-semibold text-foreground">
										Komparasi Versi Rule Set
									</h3>
									<p className="text-xs text-muted-foreground">
										Membandingkan Rule Set {publishedVersion.version}{" "}
										(Published) vs {draftVersion.version} (Draft)
									</p>
								</div>
								<button
									type="button"
									onClick={() => setCompareOpen(false)}
									className="rounded-lg p-1 text-muted-foreground hover:bg-surface-muted"
								>
									<X className="size-4" />
								</button>
							</div>

							<div className="space-y-3 rounded-lg border border-border/80 bg-surface p-4 text-xs">
								<div className="grid grid-cols-3 gap-2 border-b border-border/80 pb-2 font-semibold text-muted-foreground">
									<span>Parameter</span>
									<span className="text-primary">
										{publishedVersion.version} (Aktif)
									</span>
									<span className="text-warning">
										{draftVersion.version} (Draft)
									</span>
								</div>

								<div className="grid grid-cols-3 gap-2 py-1">
									<span className="font-semibold text-foreground">
										Tanggal Efektif
									</span>
									<span>{publishedVersion.effectiveFrom}</span>
									<span className="font-semibold text-warning">
										{draftVersion.effectiveFrom}
									</span>
								</div>

								<div className="grid grid-cols-3 gap-2 py-1 border-t border-border/40">
									<span className="font-semibold text-foreground">
										Toleransi Deviasi RPD
									</span>
									<span>5,0% (Normal)</span>
									<span className="font-semibold text-warning">
										3,0% (Diperketat)
									</span>
								</div>

								<div className="grid grid-cols-3 gap-2 py-1 border-t border-border/40">
									<span className="font-semibold text-foreground">
										Batas SPM-LS Tagihan
									</span>
									<span>H+17 Hari Kerja</span>
									<span>H+17 Hari Kerja (Sama)</span>
								</div>

								<div className="grid grid-cols-3 gap-2 py-1 border-t border-border/40">
									<span className="font-semibold text-foreground">
										Target Minimum KKP
									</span>
									<span>10% dari proporsi UP</span>
									<span>10% dari proporsi UP (Sama)</span>
								</div>

								<div className="grid grid-cols-3 gap-2 py-1 border-t border-border/40">
									<span className="font-semibold text-foreground">
										Total Bobot 8 Indikator
									</span>
									<span>100% (Valid)</span>
									<span>100% (Valid)</span>
								</div>
							</div>

							<div className="flex items-center justify-end gap-2 border-t border-border pt-3">
								<button
									type="button"
									onClick={() => setCompareOpen(false)}
									className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted"
								>
									Tutup
								</button>
								<a
									href={`/admin-kppn/policy/rule-sets/${draftVersion.id}`}
									className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs"
								>
									Buka Editor Draft
								</a>
							</div>
						</div>
					</div>
				)}
			</div>
		</AdminShell>
	);
}

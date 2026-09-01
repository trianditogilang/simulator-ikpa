import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { getMockPolicyHistory } from "@/mocks/policy-history";
import {
	History,
	Info,
	Scale,
} from "lucide-react";

export const Route = createFileRoute("/admin-kppn/policy/history")({
	component: AdminPolicyHistoryPage,
});

function AdminPolicyHistoryPage() {
	const historyItems = getMockPolicyHistory();
	const [selectedVersion, setSelectedVersion] = useState<string>("hist-01");

	const activeItem =
		historyItems.find((h) => h.id === selectedVersion) || historyItems[0];

	return (
		<AdminShell currentPath="/admin-kppn/policy/history">
			<div className="space-y-6">
				{/* Top Heading */}
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
							Riwayat Versi Policy &amp; Regulasi
						</h1>
						<p className="text-xs text-muted-foreground sm:text-sm">
							Rekam jejak perubahan parameter, aktor penerbitan, audit pemakaian snapshot, dan dampak schedule
						</p>
					</div>
					<div className="flex items-center gap-2">
						<a
							href="/admin-kppn/policy/rule-sets"
							className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-muted shadow-xs"
						>
							<Scale className="size-3.5 text-primary" />
							<span>Kelola Rule Set</span>
						</a>
					</div>
				</div>

				{/* Two Column Layout: Timeline list on left, Diff Details on right */}
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
					{/* Left: Version Timeline List */}
					<div className="space-y-3 lg:col-span-5">
						<div className="flex items-center gap-2 text-xs font-semibold text-foreground">
							<History className="size-4 text-primary" />
							<span>Daftar Versi Kebijakan</span>
						</div>

						<div className="space-y-2.5">
							{historyItems.map((item) => (
								<button
									key={item.id}
									type="button"
									onClick={() => setSelectedVersion(item.id)}
									className={`w-full text-left rounded-xl border p-4 text-xs transition-all ${
										selectedVersion === item.id
											? "border-primary bg-primary/5 shadow-xs"
											: "border-border/80 bg-surface hover:border-border"
									}`}
								>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<span className="font-semibold text-foreground text-sm">
												Versi {item.version}
											</span>
											<span
												className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
													item.status === "published"
														? "bg-success/10 text-success"
														: item.status === "draft"
															? "bg-warning/10 text-warning"
															: "bg-surface-muted text-muted-foreground"
												}`}
											>
												{item.status === "published"
													? "Published ✓"
													: item.status === "draft"
														? "Draft"
														: "Retired"}
											</span>
										</div>
										<span className="text-[11px] text-muted-foreground font-medium">
											{item.effectiveFrom}
										</span>
									</div>

									<p className="mt-2 text-foreground/90 line-clamp-2">
										{item.changeSummary}
									</p>

									<div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
										<span>Aktor: {item.publishActor}</span>
										<span>{item.snapshotUsageCount} snapshot</span>
									</div>
								</button>
							))}
						</div>
					</div>

					{/* Right: Version Diff & Audit Details */}
					<div className="space-y-4 lg:col-span-7">
						<div className="rounded-xl border border-border/80 bg-surface p-5 shadow-xs space-y-4">
							<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-3.5">
								<div>
									<div className="flex items-center gap-2">
										<h2 className="text-base font-semibold text-foreground">
											Detail Versi {activeItem.version}
										</h2>
										<span
											className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
												activeItem.status === "published"
													? "bg-success/10 text-success"
													: activeItem.status === "draft"
														? "bg-warning/10 text-warning"
														: "bg-surface-muted text-muted-foreground"
											}`}
										>
											{activeItem.status}
										</span>
									</div>
									<p className="text-xs text-muted-foreground mt-0.5">
										{activeItem.sourceRegulation}
									</p>
								</div>

								<div className="text-left sm:text-right text-xs text-muted-foreground">
									<span>Dipublikasikan:</span>
									<p className="font-semibold text-foreground">
										{activeItem.publishTimestamp}
									</p>
								</div>
							</div>

							{/* Usage Stats Box */}
							<div className="grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-background p-3.5 text-xs">
								<div>
									<span className="text-muted-foreground">Penggunaan Snapshot:</span>
									<p className="font-semibold text-foreground text-sm">
										{activeItem.snapshotUsageCount} Simulasi Satker
									</p>
								</div>
								<div>
									<span className="text-muted-foreground">Delivery Notifikasi:</span>
									<p className="font-semibold text-foreground text-sm">
										{activeItem.deliveryProcessedCount} Email Terkirim
									</p>
								</div>
								<div className="col-span-2 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
									Dampak Jadwal: <strong className="text-foreground">{activeItem.impactSummary}</strong>
								</div>
							</div>

							{/* Parameter Diff Table */}
							<div className="space-y-2">
								<h3 className="text-xs font-semibold text-foreground">
									Rincian Perubahan Parameter vs Versi Sebelumnya
								</h3>

								{activeItem.parameterDiffs.length === 0 ? (
									<div className="rounded-lg border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
										Tidak ada perubahan parameter atau versi ini adalah versi inisial arsip.
									</div>
								) : (
									<div className="overflow-x-auto rounded-lg border border-border/80">
										<table className="w-full text-left text-xs">
											<thead>
												<tr className="border-b border-border/80 bg-surface-muted/60 font-semibold text-muted-foreground">
													<th className="px-3 py-2.5">Parameter</th>
													<th className="px-3 py-2.5">Versi Lama</th>
													<th className="px-3 py-2.5">Versi Baru</th>
													<th className="px-3 py-2.5">Dampak Penilaian</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-border/60">
												{activeItem.parameterDiffs.map((diff) => (
													<tr key={diff.parameterName}>
														<td className="px-3 py-2.5 font-semibold text-foreground">
															{diff.parameterName}
														</td>
														<td className="px-3 py-2.5 text-muted-foreground">
															{diff.oldValue}
														</td>
														<td className="px-3 py-2.5 font-semibold text-primary">
															{diff.newValue}
														</td>
														<td className="px-3 py-2.5 text-muted-foreground">
															{diff.impact}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								)}
							</div>

							{/* Audit Guarantee Note */}
							<div className="flex items-start gap-2 rounded-lg bg-surface-muted/50 p-3 text-xs text-muted-foreground">
								<Info className="size-4 shrink-0 text-primary mt-0.5" />
								<p>
									Prinsip immutability memastikan bahwa perubahan policy versi baru tidak akan
									mengubah atau menghitung ulang nilai snapshot historis yang telah terbit.
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</AdminShell>
	);
}

import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import {
	getMockAuditLogs,
	type AuditLogItem,
} from "@/mocks/audit-logs";
import {
	ChevronDown,
	ChevronRight,
	FileCode,
	Search,
	ShieldCheck,
	X,
} from "lucide-react";

export const Route = createFileRoute("/admin-kppn/audit-logs")({
	component: AdminAuditLogsPage,
});

function AdminAuditLogsPage() {
	const allLogs = getMockAuditLogs();

	const [searchQuery, setSearchQuery] = useState("");
	const [actionFilter, setActionFilter] = useState<string>("all");
	const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
	const [showRawJson, setShowRawJson] = useState(false);

	const filteredLogs = useMemo(() => {
		return allLogs.filter((log) => {
			const matchQuery =
				log.actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
				log.actorEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
				log.entityName.toLowerCase().includes(searchQuery.toLowerCase()) ||
				log.requestId.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(log.organizationName?.toLowerCase().includes(searchQuery.toLowerCase()));

			const matchAction = actionFilter === "all" || log.actionType === actionFilter;

			return matchQuery && matchAction;
		});
	}, [allLogs, searchQuery, actionFilter]);

	return (
		<AdminShell currentPath="/admin-kppn/audit-logs">
			<div className="space-y-6">
				{/* Top Heading */}
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
							Audit Log Aktivitas
						</h1>
						<p className="text-xs text-muted-foreground sm:text-sm">
							Pencatatan append-only untuk seluruh mutasi data, perubahan policy, import, dan manajemen akses
						</p>
					</div>

					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<ShieldCheck className="size-4 text-success" />
						<span>Audit Trail Tamper-Proof</span>
					</div>
				</div>

				{/* Search & Filter Bar */}
				<div className="space-y-3 rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
					<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
						{/* Search Input */}
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<input
								type="text"
								placeholder="Cari aktor, email, nama satker, request ID, atau objek..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
							/>
						</div>

						{/* Action Filter */}
						<div className="flex items-center gap-2">
							<select
								value={actionFilter}
								onChange={(e) => setActionFilter(e.target.value)}
								className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							>
								<option value="all">Semua Jenis Aksi</option>
								<option value="publish">Publikasi (Publish)</option>
								<option value="update">Ubah Data (Update)</option>
								<option value="create">Tambah Data (Create)</option>
								<option value="import">Import File</option>
								<option value="override">Override Kalender</option>
							</select>
						</div>
					</div>

					<div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
						<span>
							Menampilkan <strong className="text-foreground">{filteredLogs.length}</strong> catatan audit
						</span>
						{(searchQuery || actionFilter !== "all") && (
							<button
								type="button"
								onClick={() => {
									setSearchQuery("");
									setActionFilter("all");
								}}
								className="font-semibold text-primary underline-offset-4 hover:underline"
							>
								Reset Filter
							</button>
						)}
					</div>
				</div>

				{/* Table View */}
				<div className="rounded-xl border border-border/80 bg-surface shadow-xs">
					<div className="overflow-x-auto">
						<table className="w-full text-left text-xs">
							<thead>
								<tr className="border-b border-border/80 bg-surface-muted/50 font-semibold text-muted-foreground">
									<th className="py-3 pl-4 pr-2">Waktu (WIB)</th>
									<th className="px-3 py-3">Aktor / Pengguna</th>
									<th className="px-3 py-3">Aksi</th>
									<th className="px-3 py-3">Objek / Entitas</th>
									<th className="px-3 py-3">Ringkasan Aktivitas</th>
									<th className="py-3 pl-2 pr-4 text-right">Detail</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border/60">
								{filteredLogs.length === 0 ? (
									<tr>
										<td colSpan={6} className="py-12 text-center text-muted-foreground">
											Tidak ada catatan audit yang cocok dengan filter pencarian.
										</td>
									</tr>
								) : (
									filteredLogs.map((log) => (
										<tr
											key={log.id}
											className="transition-colors hover:bg-surface-muted/30"
										>
											<td className="py-3 pl-4 pr-2 font-medium text-foreground whitespace-nowrap">
												{log.timestamp}
											</td>
											<td className="px-3 py-3">
												<span className="font-semibold text-foreground">
													{log.actorName}
												</span>
												<p className="text-[11px] text-muted-foreground truncate max-w-[180px]">
													{log.actorEmail}
												</p>
											</td>
											<td className="px-3 py-3">
												<span
													className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
														log.actionType === "publish"
															? "bg-primary/10 text-primary"
															: log.actionType === "update"
																? "bg-warning/10 text-warning"
																: log.actionType === "create"
																	? "bg-success/10 text-success"
																	: "bg-surface-muted text-muted-foreground"
													}`}
												>
													{log.actionType}
												</span>
											</td>
											<td className="px-3 py-3">
												<span className="font-medium text-foreground">
													{log.entityName}
												</span>
												{log.organizationName && (
													<p className="text-[11px] text-muted-foreground">
														{log.organizationName}
													</p>
												)}
											</td>
											<td className="px-3 py-3 text-muted-foreground max-w-sm truncate">
												{log.summary}
											</td>
											<td className="py-3 pl-2 pr-4 text-right">
												<button
													type="button"
													onClick={() => {
														setSelectedLog(log);
														setShowRawJson(false);
													}}
													className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-surface-muted"
												>
													Lihat
												</button>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>

				{/* Detail Audit Drawer / Modal */}
				{selectedLog && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
						<div className="w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
							<div className="flex items-start justify-between">
								<div className="space-y-1">
									<div className="flex items-center gap-2">
										<span className="rounded bg-surface-muted px-2 py-0.5 text-xs font-semibold uppercase text-foreground">
											{selectedLog.actionType}
										</span>
										<span className="text-xs text-muted-foreground">
											{selectedLog.timestamp}
										</span>
									</div>
									<h3 className="text-base font-semibold text-foreground">
										Detail Catatan Audit
									</h3>
								</div>
								<button
									type="button"
									onClick={() => setSelectedLog(null)}
									className="rounded-lg p-1 text-muted-foreground hover:bg-surface-muted"
								>
									<X className="size-4" />
								</button>
							</div>

							{/* Readable Human Summary */}
							<div className="space-y-3 rounded-lg border border-border/80 bg-surface p-4 text-xs">
								<div>
									<span className="text-muted-foreground">Aktor Pelaksana:</span>
									<p className="font-semibold text-foreground">
										{selectedLog.actorName} ({selectedLog.actorEmail})
									</p>
									<p className="text-[11px] text-muted-foreground">{selectedLog.actorRole}</p>
								</div>

								<div className="border-t border-border/60 pt-2.5">
									<span className="text-muted-foreground">Aksi &amp; Entitas:</span>
									<p className="font-semibold text-foreground">
										{selectedLog.actionLabel} — {selectedLog.entityName}
									</p>
									{selectedLog.organizationName && (
										<p className="text-[11px] text-muted-foreground">
											Satker: {selectedLog.organizationName} ({selectedLog.organizationCode})
										</p>
									)}
								</div>

								<div className="border-t border-border/60 pt-2.5">
									<span className="text-muted-foreground">Ringkasan Perubahan:</span>
									<p className="font-medium text-foreground">{selectedLog.summary}</p>
								</div>

								<div className="border-t border-border/60 pt-2.5">
									<span className="text-muted-foreground">Request ID:</span>
									<p className="font-mono text-[11px] text-muted-foreground">
										{selectedLog.requestId}
									</p>
								</div>
							</div>

							{/* Technical Before/After JSON Collapsible */}
							<div className="rounded-lg border border-border/80 bg-surface p-3 text-xs space-y-2">
								<button
									type="button"
									onClick={() => setShowRawJson(!showRawJson)}
									className="flex w-full items-center justify-between font-semibold text-foreground hover:text-primary"
								>
									<div className="flex items-center gap-1.5">
										<FileCode className="size-3.5 text-primary" />
										<span>Detail Teknis Before / After JSON</span>
									</div>
									{showRawJson ? (
										<ChevronDown className="size-4" />
									) : (
										<ChevronRight className="size-4" />
									)}
								</button>

								{showRawJson && (
									<div className="space-y-3 pt-2">
										<div>
											<span className="text-[11px] font-semibold text-muted-foreground">
												State Sebelum (Before):
											</span>
											<pre className="mt-1 max-h-32 overflow-auto rounded bg-background p-2 font-mono text-[10px] text-foreground border border-border">
												{JSON.stringify(selectedLog.beforeState, null, 2) || "null (Create Baru)"}
											</pre>
										</div>

										<div>
											<span className="text-[11px] font-semibold text-muted-foreground">
												State Sesudah (After):
											</span>
											<pre className="mt-1 max-h-32 overflow-auto rounded bg-background p-2 font-mono text-[10px] text-foreground border border-border">
												{JSON.stringify(selectedLog.afterState, null, 2)}
											</pre>
										</div>
									</div>
								)}
							</div>

							<div className="flex items-center justify-end border-t border-border pt-3">
								<button
									type="button"
									onClick={() => setSelectedLog(null)}
									className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted"
								>
									Tutup
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		</AdminShell>
	);
}

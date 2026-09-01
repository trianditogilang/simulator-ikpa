import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import {
	getMockAdminReminders,
	type AdminReminderItem,
} from "@/mocks/admin-reminders";
import {
	AlertTriangle,
	ArrowRight,
	Bell,
	CheckCircle2,
	Clock,
	MailWarning,
	RefreshCw,
	RotateCw,
	Search,
	X,
} from "lucide-react";

export const Route = createFileRoute("/admin-kppn/monitoring/reminders")({
	component: AdminMonitoringRemindersPage,
});

function AdminMonitoringRemindersPage() {
	const { stats, items: initialItems } = getMockAdminReminders();

	const [items, setItems] = useState<AdminReminderItem[]>(initialItems);
	const [searchQuery, setSearchQuery] = useState("");
	const [categoryFilter, setCategoryFilter] = useState<string>("all");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [selectedItem, setSelectedItem] = useState<AdminReminderItem | null>(
		null,
	);
	const [retryConfirmItem, setRetryConfirmItem] =
		useState<AdminReminderItem | null>(null);
	const [retrySuccessToast, setRetrySuccessToast] = useState<string | null>(
		null,
	);

	const filteredItems = useMemo(() => {
		return items.filter((item) => {
			const matchQuery =
				item.satkerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.satkerCode.includes(searchQuery) ||
				item.eventTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.recipient.toLowerCase().includes(searchQuery.toLowerCase());

			const matchCategory =
				categoryFilter === "all" || item.category === categoryFilter;
			const matchStatus =
				statusFilter === "all" || item.deliveryStatus === statusFilter;

			return matchQuery && matchCategory && matchStatus;
		});
	}, [items, searchQuery, categoryFilter, statusFilter]);

	const handleRetryDelivery = (item: AdminReminderItem) => {
		setRetryConfirmItem(null);
		setSelectedItem(null);

		// Update item delivery status locally
		setItems((prev) =>
			prev.map((i) =>
				i.id === item.id
					? {
							...i,
							deliveryStatus: "sent",
							sentTime: "01 Sep 2026, 11.45 WIB",
							attemptCount: i.attemptCount + 1,
							errorMessage: undefined,
						}
					: i,
			),
		);

		setRetrySuccessToast(
			`Pengiriman ulang notifikasi "${item.eventTitle}" ke ${item.recipient} berhasil diproses.`,
		);

		setTimeout(() => {
			setRetrySuccessToast(null);
		}, 5000);
	};

	return (
		<AdminShell currentPath="/admin-kppn/monitoring/reminders">
			<div className="space-y-6">
				{/* Top Heading */}
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
							Monitoring Risiko &amp; Reminder
						</h1>
						<p className="text-xs text-muted-foreground sm:text-sm">
							Pengawasan jadwal, notifikasi peringatan dini, dan log pengiriman
							reminder ke seluruh Satker
						</p>
					</div>
					<div className="flex items-center gap-2">
						<a
							href="/admin-kppn/policy/reminders"
							className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-muted shadow-xs"
						>
							<span>Konfigurasi Policy</span>
							<ArrowRight className="size-3.5" />
						</a>
					</div>
				</div>

				{/* Toast Alert */}
				{retrySuccessToast && (
					<div className="flex items-center justify-between rounded-xl border border-success/30 bg-success/10 p-4 text-xs font-medium text-success">
						<div className="flex items-center gap-2">
							<CheckCircle2 className="size-4 shrink-0" />
							<span>{retrySuccessToast}</span>
						</div>
						<button
							type="button"
							onClick={() => setRetrySuccessToast(null)}
							className="text-success hover:underline"
						>
							Tutup
						</button>
					</div>
				)}

				{/* 4 Summary Stat Cards */}
				<div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
					<div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
						<div className="flex items-center justify-between">
							<span className="text-xs font-semibold text-muted-foreground">
								Total Agenda Aktif
							</span>
							<Bell className="size-4 text-primary" />
						</div>
						<div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
							{stats.totalEvents}
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							Event IKPA triwulan berjalan
						</p>
					</div>

					<div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
						<div className="flex items-center justify-between">
							<span className="text-xs font-semibold text-muted-foreground">
								Kategori Mandatory
							</span>
							<AlertTriangle className="size-4 text-primary" />
						</div>
						<div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
							{stats.mandatoryCount}
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							Terkunci oleh regulasi pusat
						</p>
					</div>

					<div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
						<div className="flex items-center justify-between">
							<span className="text-xs font-semibold text-muted-foreground">
								Delivery Gagal
							</span>
							<MailWarning className="size-4 text-danger" />
						</div>
						<div className="mt-2 text-2xl font-semibold tracking-tight text-danger">
							{stats.failedCount}
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							Memerlukan percobaan kirim ulang
						</p>
					</div>

					<div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
						<div className="flex items-center justify-between">
							<span className="text-xs font-semibold text-muted-foreground">
								Jatuh Tempo &lt; 7 Hari
							</span>
							<Clock className="size-4 text-warning" />
						</div>
						<div className="mt-2 text-2xl font-semibold tracking-tight text-warning">
							{stats.dueSoonCount}
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							Perlu eskalasi pemantauan
						</p>
					</div>
				</div>

				{/* Filter and Search Bar */}
				<div className="space-y-3 rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
					<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
						{/* Search Input */}
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<input
								type="text"
								placeholder="Cari nama satker, agenda, atau alamat email penerima..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
							/>
						</div>

						{/* Dropdown Filters */}
						<div className="flex flex-wrap items-center gap-2">
							<select
								value={categoryFilter}
								onChange={(e) => setCategoryFilter(e.target.value)}
								className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							>
								<option value="all">Semua Kategori</option>
								<option value="mandatory">Mandatory (Wajib)</option>
								<option value="recommended">Recommended</option>
								<option value="optional">Optional</option>
							</select>

							<select
								value={statusFilter}
								onChange={(e) => setStatusFilter(e.target.value)}
								className="h-9 rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							>
								<option value="all">Semua Status Pengiriman</option>
								<option value="sent">Terkirim (Sent)</option>
								<option value="scheduled">Terjadwal (Scheduled)</option>
								<option value="failed">Gagal (Failed)</option>
							</select>
						</div>
					</div>

					<div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
						<span>
							Menampilkan{" "}
							<strong className="text-foreground">
								{filteredItems.length}
							</strong>{" "}
							agenda
						</span>
						{(searchQuery ||
							categoryFilter !== "all" ||
							statusFilter !== "all") && (
							<button
								type="button"
								onClick={() => {
									setSearchQuery("");
									setCategoryFilter("all");
									setStatusFilter("all");
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
									<th className="py-3 pl-4 pr-2">Satker</th>
									<th className="px-3 py-3">Event Agenda</th>
									<th className="px-3 py-3">Indikator</th>
									<th className="px-3 py-3">Jatuh Tempo</th>
									<th className="px-3 py-3 text-center">Kategori</th>
									<th className="px-3 py-3 text-center">Status Delivery</th>
									<th className="py-3 pl-2 pr-4 text-right">Aksi</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border/60">
								{filteredItems.length === 0 ? (
									<tr>
										<td
											colSpan={7}
											className="py-12 text-center text-muted-foreground"
										>
											Tidak ada agenda pengingat yang cocok dengan kriteria
											pencarian.
										</td>
									</tr>
								) : (
									filteredItems.map((item) => (
										<tr
											key={item.id}
											className="transition-colors hover:bg-surface-muted/30"
										>
											<td className="py-3 pl-4 pr-2">
												<span className="font-semibold text-foreground">
													{item.satkerName}
												</span>
												<p className="text-[11px] text-muted-foreground">
													Kode: {item.satkerCode}
												</p>
											</td>
											<td className="px-3 py-3">
												<span className="font-medium text-foreground">
													{item.eventTitle}
												</span>
												<p className="text-[11px] text-muted-foreground truncate max-w-xs">
													{item.recipient}
												</p>
											</td>
											<td className="px-3 py-3 text-muted-foreground">
												{item.indicatorLabel}
											</td>
											<td className="px-3 py-3 text-muted-foreground">
												<div>{item.deadlineDate}</div>
												<span
													className={`text-[10px] font-semibold ${
														item.workDaysLeft <= 2
															? "text-danger"
															: "text-muted-foreground"
													}`}
												>
													H-{item.workDaysLeft} hari kerja
												</span>
											</td>
											<td className="px-3 py-3 text-center">
												<span
													className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
														item.category === "mandatory"
															? "bg-primary/10 text-primary"
															: item.category === "recommended"
																? "bg-warning/10 text-warning"
																: "bg-surface-muted text-muted-foreground"
													}`}
												>
													{item.category}
												</span>
											</td>
											<td className="px-3 py-3 text-center">
												<span
													className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
														item.deliveryStatus === "sent"
															? "bg-success/10 text-success"
															: item.deliveryStatus === "scheduled"
																? "bg-primary/10 text-primary"
																: "bg-danger/10 text-danger"
													}`}
												>
													{item.deliveryStatus === "sent"
														? "✓ Terkirim"
														: item.deliveryStatus === "scheduled"
															? "Terjadwal"
															: "⚠ Gagal"}
												</span>
											</td>
											<td className="py-3 pl-2 pr-4 text-right">
												<button
													type="button"
													onClick={() => setSelectedItem(item)}
													className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-surface-muted"
												>
													Detail
												</button>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>

				{/* Detail Delivery Drawer / Modal */}
				{selectedItem && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-xs">
						<div className="w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-xl space-y-4">
							<div className="flex items-start justify-between">
								<div className="space-y-1">
									<div className="flex items-center gap-2">
										<span className="rounded bg-surface-muted px-1.5 py-0.5 text-xs font-semibold text-foreground">
											{selectedItem.satkerCode}
										</span>
										<span
											className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
												selectedItem.deliveryStatus === "sent"
													? "bg-success/10 text-success"
													: selectedItem.deliveryStatus === "scheduled"
														? "bg-primary/10 text-primary"
														: "bg-danger/10 text-danger"
											}`}
										>
											{selectedItem.deliveryStatus}
										</span>
									</div>
									<h3 className="text-base font-semibold text-foreground">
										{selectedItem.eventTitle}
									</h3>
									<p className="text-xs text-muted-foreground">
										{selectedItem.satkerName} • Rule Set{" "}
										{selectedItem.ruleSetVersion}
									</p>
								</div>
								<button
									type="button"
									onClick={() => setSelectedItem(null)}
									className="rounded-lg p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
								>
									<X className="size-4" />
								</button>
							</div>

							<div className="grid grid-cols-2 gap-3 rounded-lg border border-border/80 bg-surface p-4 text-xs">
								<div>
									<span className="text-muted-foreground">
										Jadwal Pengiriman:
									</span>
									<p className="font-semibold text-foreground">
										{selectedItem.scheduledTime}
									</p>
								</div>
								<div>
									<span className="text-muted-foreground">Waktu Terkirim:</span>
									<p className="font-semibold text-foreground">
										{selectedItem.sentTime || "Belum Terkirim"}
									</p>
								</div>
								<div>
									<span className="text-muted-foreground">
										Jumlah Percobaan:
									</span>
									<p className="font-semibold text-foreground">
										{selectedItem.attemptCount} kali
									</p>
								</div>
								<div>
									<span className="text-muted-foreground">
										Kategori Policy:
									</span>
									<p className="font-semibold text-foreground uppercase">
										{selectedItem.category}
									</p>
								</div>
								<div className="col-span-2">
									<span className="text-muted-foreground">Email Penerima:</span>
									<p className="font-semibold text-foreground">
										{selectedItem.recipient}
									</p>
								</div>
								<div className="col-span-2">
									<span className="text-muted-foreground">
										Idempotency Key:
									</span>
									<p className="font-mono text-[11px] text-muted-foreground break-all">
										{selectedItem.idempotencyKey}
									</p>
								</div>

								{selectedItem.errorMessage && (
									<div className="col-span-2 rounded-lg bg-danger/10 p-2.5 text-xs text-danger">
										<span className="font-semibold">
											Pesan Kesalahan Teknis:
										</span>
										<p className="mt-0.5 text-foreground">
											{selectedItem.errorMessage}
										</p>
									</div>
								)}
							</div>

							<div className="flex items-center justify-between border-t border-border pt-4">
								<button
									type="button"
									onClick={() => setSelectedItem(null)}
									className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted"
								>
									Tutup
								</button>

								{selectedItem.deliveryStatus === "failed" && (
									<button
										type="button"
										onClick={() => {
											setRetryConfirmItem(selectedItem);
										}}
										className="inline-flex items-center gap-1.5 rounded-lg bg-danger px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-danger/90"
									>
										<RotateCw className="size-3.5" />
										<span>Coba Kirim Ulang</span>
									</button>
								)}
							</div>
						</div>
					</div>
				)}

				{/* Retry Confirmation AlertDialog */}
				{retryConfirmItem && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
						<div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-2xl space-y-4">
							<div className="flex items-center gap-3">
								<div className="flex size-10 items-center justify-center rounded-full bg-danger/10 text-danger">
									<RefreshCw className="size-5" />
								</div>
								<div>
									<h3 className="text-base font-semibold text-foreground">
										Kirim Ulang Notifikasi Reminder?
									</h3>
									<p className="text-xs text-muted-foreground">
										{retryConfirmItem.satkerName} ({retryConfirmItem.satkerCode}
										)
									</p>
								</div>
							</div>

							<div className="rounded-lg bg-surface p-3.5 text-xs text-muted-foreground space-y-2">
								<p>
									Sistem akan memicu antrean pengiriman ulang notifikasi{" "}
									<strong className="text-foreground">
										{retryConfirmItem.eventTitle}
									</strong>{" "}
									ke alamat:
								</p>
								<p className="font-semibold text-foreground">
									{retryConfirmItem.recipient}
								</p>
								<p className="text-[11px] text-muted-foreground border-t border-border/60 pt-2">
									Percobaan sebelumnya gagal dengan error:{" "}
									{retryConfirmItem.errorMessage}
								</p>
							</div>

							<div className="flex items-center justify-end gap-2 border-t border-border pt-3">
								<button
									type="button"
									onClick={() => setRetryConfirmItem(null)}
									className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted"
								>
									Batal
								</button>
								<button
									type="button"
									onClick={() => handleRetryDelivery(retryConfirmItem)}
									className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs"
								>
									Ya, Kirim Ulang
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		</AdminShell>
	);
}

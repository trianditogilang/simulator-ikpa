import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import {
	getMockReminderPolicies,
	type ReminderPolicyEventItem,
} from "@/mocks/reminder-policies";
import {
	CheckCircle2,
	Clock,
	Edit,
	Lock,
	Plus,
	Save,
	ShieldCheck,
	X,
} from "lucide-react";

export const Route = createFileRoute("/admin-kppn/policy/reminders")({
	component: AdminReminderPoliciesPage,
});

function AdminReminderPoliciesPage() {
	const initialPolicies = getMockReminderPolicies();

	const [policies, setPolicies] = useState<ReminderPolicyEventItem[]>(initialPolicies);
	const [selectedPolicy, setSelectedPolicy] = useState<ReminderPolicyEventItem | null>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [saveToast, setSaveToast] = useState<string | null>(null);

	const handleSavePolicy = (updatedPolicy: ReminderPolicyEventItem) => {
		setPolicies((prev) =>
			prev.map((p) => (p.id === updatedPolicy.id ? updatedPolicy : p)),
		);
		setIsEditing(false);
		setSelectedPolicy(null);
		setSaveToast(
			`Kebijakan reminder untuk event "${updatedPolicy.eventTitle}" berhasil disimpan.`,
		);
		setTimeout(() => setSaveToast(null), 4000);
	};

	return (
		<AdminShell currentPath="/admin-kppn/policy/reminders">
			<div className="space-y-6">
				{/* Top Heading */}
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
							Reminder Policy
						</h1>
						<p className="text-xs text-muted-foreground sm:text-sm">
							Pengaturan aturan notifikasi, formula deadline, kategori wajib, dan penerima notifikasi otomatis
						</p>
					</div>

					<div className="flex items-center gap-2">
						<a
							href="/admin-kppn/monitoring/reminders"
							className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-muted shadow-xs"
						>
							<Clock className="size-3.5 text-primary" />
							<span>Lihat Monitoring Pengiriman</span>
						</a>
						<button
							type="button"
							onClick={() => {
								const newPolicy: ReminderPolicyEventItem = {
									id: `pol-custom-${Date.now()}`,
									eventType: "custom_event_alert",
									eventTitle: "Event Pengingat Baru",
									indicatorKey: "general",
									indicatorLabel: "Umum",
									category: "recommended",
									dayType: "workday",
									deadlineFormulaSummary: "H+5 hari kerja",
									allowedMinLeadDays: 1,
									allowedMaxLeadDays: 10,
									defaultLeadDays: [5, 2],
									requiredRecipients: ["Operator Satker"],
									allowDisable: true,
									allowRecipientOverride: true,
									status: "draft",
									ruleSetVersion: "2026.1",
									description: "Deskripsi event pengingat kustom baru.",
								};
								setSelectedPolicy(newPolicy);
								setIsEditing(true);
							}}
							className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 shadow-xs"
						>
							<Plus className="size-3.5" />
							<span>Tambah Event Policy</span>
						</button>
					</div>
				</div>

				{/* Toast Alert */}
				{saveToast && (
					<div className="flex items-center justify-between rounded-xl border border-success/30 bg-success/10 p-4 text-xs font-medium text-success">
						<div className="flex items-center gap-2">
							<CheckCircle2 className="size-4 shrink-0" />
							<span>{saveToast}</span>
						</div>
						<button
							type="button"
							onClick={() => setSaveToast(null)}
							className="text-success hover:underline"
						>
							Tutup
						</button>
					</div>
				)}

				{/* Context Summary Banner */}
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface p-4 shadow-xs text-xs">
					<div className="flex items-center gap-2 text-muted-foreground">
						<ShieldCheck className="size-4 text-primary" />
						<span>
							Acuan Aktif: <strong className="text-foreground">Rule Set 2026.1 (PER-5/PB/2024)</strong>
						</span>
						<span>•</span>
						<span>
							Total Kebijakan: <strong className="text-foreground">{policies.length} Event Terdaftar</strong>
						</span>
					</div>
					<span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
						Compliance Guard Aktif
					</span>
				</div>

				{/* Policy Events Table */}
				<div className="rounded-xl border border-border/80 bg-surface shadow-xs">
					<div className="overflow-x-auto">
						<table className="w-full text-left text-xs">
							<thead>
								<tr className="border-b border-border/80 bg-surface-muted/50 font-semibold text-muted-foreground">
									<th className="py-3 pl-4 pr-2">Event Agenda</th>
									<th className="px-3 py-3">Indikator IKPA</th>
									<th className="px-3 py-3">Formula Deadline</th>
									<th className="px-3 py-3">Jenis Hari</th>
									<th className="px-3 py-3 text-center">Kategori</th>
									<th className="px-3 py-3">Penerima Wajib</th>
									<th className="py-3 pl-2 pr-4 text-right">Aksi</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border/60">
								{policies.map((pol) => (
									<tr
										key={pol.id}
										className="transition-colors hover:bg-surface-muted/30"
									>
										<td className="py-3 pl-4 pr-2">
											<div className="flex items-center gap-1.5">
												<span className="font-semibold text-foreground">
													{pol.eventTitle}
												</span>
												{pol.category === "mandatory" && (
													<span title="Wajib / Terkunci">
														<Lock className="size-3 text-primary" />
													</span>
												)}
											</div>
											<p className="text-[11px] text-muted-foreground font-mono">
												{pol.eventType}
											</p>
										</td>
										<td className="px-3 py-3 text-muted-foreground">
											{pol.indicatorLabel}
										</td>
										<td className="px-3 py-3 font-medium text-foreground">
											{pol.deadlineFormulaSummary}
										</td>
										<td className="px-3 py-3 text-muted-foreground capitalize">
											{pol.dayType === "workday"
												? "Hari Kerja (Workday)"
												: pol.dayType === "calendar_day"
													? "Hari Kalender"
													: "Jadwal Berkala"}
										</td>
										<td className="px-3 py-3 text-center">
											<span
												className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
													pol.category === "mandatory"
														? "bg-primary/10 text-primary"
														: pol.category === "recommended"
															? "bg-warning/10 text-warning"
															: "bg-surface-muted text-muted-foreground"
												}`}
											>
												{pol.category}
											</span>
										</td>
										<td className="px-3 py-3 text-muted-foreground">
											<div className="flex flex-wrap gap-1">
												{pol.requiredRecipients.map((rec) => (
													<span
														key={rec}
														className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground"
													>
														{rec}
													</span>
												))}
											</div>
										</td>
										<td className="py-3 pl-2 pr-4 text-right">
											<button
												type="button"
												onClick={() => {
													setSelectedPolicy(pol);
													setIsEditing(true);
												}}
												className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-surface-muted"
											>
												<Edit className="size-3" />
												<span>Edit</span>
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>

				{/* Modal / Drawer Policy Editor */}
				{isEditing && selectedPolicy && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
						<div className="w-full max-w-xl rounded-xl border border-border bg-background p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
							<div className="flex items-start justify-between">
								<div>
									<h3 className="text-base font-semibold text-foreground">
										Edit Reminder Policy
									</h3>
									<p className="text-xs text-muted-foreground">
										{selectedPolicy.eventTitle} ({selectedPolicy.eventType})
									</p>
								</div>
								<button
									type="button"
									onClick={() => {
										setIsEditing(false);
										setSelectedPolicy(null);
									}}
									className="rounded-lg p-1 text-muted-foreground hover:bg-surface-muted"
								>
									<X className="size-4" />
								</button>
							</div>

							<div className="space-y-4 text-xs">
								<div>
									<span className="text-muted-foreground block mb-1 font-medium">
										Judul Event:
									</span>
									<input
										type="text"
										value={selectedPolicy.eventTitle}
										onChange={(e) =>
											setSelectedPolicy({
												...selectedPolicy,
												eventTitle: e.target.value,
											})
										}
										className="h-9 w-full rounded-lg border border-border bg-surface px-3 font-semibold text-foreground focus:border-primary focus:outline-none"
									/>
								</div>

								<div className="grid grid-cols-2 gap-3">
									<div>
										<span className="text-muted-foreground block mb-1 font-medium">
											Kategori Pengingat:
										</span>
										<select
											value={selectedPolicy.category}
											onChange={(e) =>
												setSelectedPolicy({
													...selectedPolicy,
													category: e.target.value as "mandatory" | "recommended" | "optional",
													allowDisable: e.target.value === "mandatory" ? false : selectedPolicy.allowDisable,
												})
											}
											className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
										>
											<option value="mandatory">Mandatory (Wajib)</option>
											<option value="recommended">Recommended (Disarankan)</option>
											<option value="optional">Optional (Opsional)</option>
										</select>
									</div>

									<div>
										<span className="text-muted-foreground block mb-1 font-medium">
											Jenis Perhitungan Hari:
										</span>
										<select
											value={selectedPolicy.dayType}
											onChange={(e) =>
												setSelectedPolicy({
													...selectedPolicy,
													dayType: e.target.value as "workday" | "calendar_day" | "schedule",
												})
											}
											className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
										>
											<option value="workday">Hari Kerja (Workday)</option>
											<option value="calendar_day">Hari Kalender</option>
											<option value="schedule">Jadwal Berkala</option>
										</select>
									</div>
								</div>

								<div>
									<span className="text-muted-foreground block mb-1 font-medium">
										Formula Deadline DSL:
									</span>
									<input
										type="text"
										value={selectedPolicy.deadlineFormulaSummary}
										onChange={(e) =>
											setSelectedPolicy({
												...selectedPolicy,
												deadlineFormulaSummary: e.target.value,
											})
										}
										className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
									/>
								</div>

								<div className="grid grid-cols-2 gap-3">
									<div>
										<span className="text-muted-foreground block mb-1 font-medium">
											Min Lead Time (Hari):
										</span>
										<input
											type="number"
											value={selectedPolicy.allowedMinLeadDays}
											onChange={(e) =>
												setSelectedPolicy({
													...selectedPolicy,
													allowedMinLeadDays: Number.parseInt(e.target.value, 10) || 0,
												})
											}
											className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
										/>
									</div>

									<div>
										<span className="text-muted-foreground block mb-1 font-medium">
											Max Lead Time (Hari):
										</span>
										<input
											type="number"
											value={selectedPolicy.allowedMaxLeadDays}
											onChange={(e) =>
												setSelectedPolicy({
													...selectedPolicy,
													allowedMaxLeadDays: Number.parseInt(e.target.value, 10) || 15,
												})
											}
											className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
										/>
									</div>
								</div>

								{/* Toggles */}
								<div className="space-y-3 rounded-lg border border-border/80 bg-surface p-3.5">
									<div className="flex items-center justify-between">
										<div>
											<span className="font-semibold text-foreground">
												Izinkan Operator Menonaktifkan (Allow Disable):
											</span>
											<p className="text-[11px] text-muted-foreground">
												{selectedPolicy.category === "mandatory"
													? "🔒 Terkunci OFF untuk kategori Mandatory"
													: "Operator satker dapat menonaktifkan notifikasi"}
											</p>
										</div>
										<input
											type="checkbox"
											disabled={selectedPolicy.category === "mandatory"}
											checked={selectedPolicy.allowDisable}
											onChange={(e) =>
												setSelectedPolicy({
													...selectedPolicy,
													allowDisable: e.target.checked,
												})
											}
											className="size-4 text-primary rounded"
										/>
									</div>

									<div className="flex items-center justify-between border-t border-border/40 pt-2.5">
										<div>
											<span className="font-semibold text-foreground">
												Izinkan Penambahan Penerima Kustom:
											</span>
											<p className="text-[11px] text-muted-foreground">
												Operator dapat menambahkan email penerima internal satker
											</p>
										</div>
										<input
											type="checkbox"
											checked={selectedPolicy.allowRecipientOverride}
											onChange={(e) =>
												setSelectedPolicy({
													...selectedPolicy,
													allowRecipientOverride: e.target.checked,
												})
											}
											className="size-4 text-primary rounded"
										/>
									</div>
								</div>
							</div>

							<div className="flex items-center justify-end gap-2 border-t border-border pt-4">
								<button
									type="button"
									onClick={() => {
										setIsEditing(false);
										setSelectedPolicy(null);
									}}
									className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted"
								>
									Batal
								</button>
								<button
									type="button"
									onClick={() => handleSavePolicy(selectedPolicy)}
									className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs"
								>
									<Save className="size-3.5" />
									<span>Simpan Kebijakan</span>
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		</AdminShell>
	);
}

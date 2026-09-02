import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
	AlertCircle,
	Bell,
	CheckCircle2,
	Lock,
	Mail,
	RotateCcw,
	Settings2,
	ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import {
	type ColumnDef,
	DomainDataTable,
} from "@/components/data/domain-data-table";
import { DomainFormDrawer } from "@/components/data/domain-form-drawer";
import { OperatorShell } from "@/components/layout/operator-shell";
import {
	fetchOperatorReminders,
	resetReminderConfig,
	saveReminderConfig,
	type ReminderPolicyItem,
} from "@/services/reminders-service";

export const Route = createFileRoute("/operator/reminders")({
	loader: async ({ context }) => {
		const activeOrgId =
			context.auth?.isAuthenticated &&
			(context.access?.status === "operator_single_scope" ||
				context.access?.status === "operator_multiple_scopes")
				? (context.access.activeOrganizationId ?? undefined)
				: undefined;

		return fetchOperatorReminders(activeOrgId);
	},
	component: OperatorRemindersPage,
});

const EVENT_NAMES: Record<string, string> = {
	REVISI_DIPA_DEADLINE: "Batas Akhir Revisi DIPA (Semester I & II)",
	HAL_III_RPD_UPDATE: "Batas Pemutakhiran RPD Halaman III DIPA",
	KONTRAK_3HK: "Penyampaian Data Kontrak (3 Hari Kerja)",
	SPM_LS_17HK: "Penyelesaian Tagihan SPM-LS (17 Hari Kerja)",
	LPJ_BENDAHARA_MONTHLY: "Pertanggungjawaban LPJ Bendahara Bulanan",
	CAPAIAN_OUTPUT_CONFIRM: "Konfirmasi Capaian Output (5 HK Awal Bulan)",
	SPM_DISPENSASI_Q4: "Batas Pengajuan SPM Dispensasi Akhir Tahun",
};

interface MergedReminderRow {
	id: string;
	policy: ReminderPolicyItem;
	configId?: string;
	enabled: boolean;
	customMessage?: string | null;
	deadline?: string;
	dayType: string;
	scheduledDates: string[];
}

function OperatorRemindersPage() {
	const router = useRouter();
	const initialData = Route.useLoaderData();

	const [search, setSearch] = useState("");
	const [selectedPolicy, setSelectedPolicy] =
		useState<ReminderPolicyItem | null>(null);
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [actionMessage, setActionMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	// Form State
	const [formEnabled, setFormEnabled] = useState(true);
	const [formLeadDays, setFormLeadDays] = useState("7, 3, 1");
	const [formRecipients, setFormRecipients] = useState("");
	const [formMessage, setFormMessage] = useState("");

	// Merge data
	const rows: MergedReminderRow[] = initialData.policies.map((policy) => {
		const cfg = initialData.configs.find(
			(c) => c.reminderPolicyId === policy.id,
		);
		const prev = initialData.previews.find((p) => p.policyId === policy.id);

		return {
			id: policy.id,
			policy,
			configId: cfg?.id,
			enabled: cfg?.enabled ?? true,
			customMessage: cfg?.customMessage,
			deadline: prev?.deadline,
			dayType: policy.dayType,
			scheduledDates: prev?.scheduled.map((s) => s.scheduledDate) ?? [],
		};
	});

	const filteredRows = rows.filter((r) =>
		(EVENT_NAMES[r.policy.eventType] || r.policy.eventType)
			.toLowerCase()
			.includes(search.toLowerCase()),
	);

	const mandatoryCount = rows.filter(
		(r) => r.policy.category === "mandatory",
	).length;
	const activeCount = rows.filter((r) => r.enabled).length;

	const handleOpenEdit = (row: MergedReminderRow) => {
		setSelectedPolicy(row.policy);
		setFormEnabled(row.enabled);
		setFormLeadDays("7, 3, 1");
		setFormRecipients("");
		setFormMessage(row.customMessage || "");
		setIsDrawerOpen(true);
	};

	const handleSaveConfig = async () => {
		if (!selectedPolicy) return;
		setActionMessage(null);
		setErrorMessage(null);

		const leadArr = formLeadDays
			.split(",")
			.map((s) => Number.parseInt(s.trim(), 10))
			.filter((n) => !Number.isNaN(n) && n > 0);

		const recArr = formRecipients
			.split(",")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);

		setIsSubmitting(true);
		try {
			await saveReminderConfig({
				reminderPolicyId: selectedPolicy.id,
				enabled: formEnabled,
				leadDays: leadArr.length > 0 ? leadArr : [7, 3, 1],
				additionalRecipients: recArr,
				customMessage: formMessage || null,
			});

			setActionMessage("Konfigurasi pengingat berhasil disimpan.");
			setIsDrawerOpen(false);
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error
					? err.message
					: "Gagal menyimpan konfigurasi pengingat.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleResetConfig = async (configId?: string) => {
		if (!configId) {
			alert("Pengaturan sudah berada pada nilai default kebijakan KPPN.");
			return;
		}
		if (!confirm("Reset konfigurasi pengingat ke default policy KPPN?")) {
			return;
		}
		try {
			await resetReminderConfig(configId);
			setActionMessage("Konfigurasi direset ke default policy.");
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal mereset konfigurasi.",
			);
		}
	};

	const columns: ColumnDef<MergedReminderRow>[] = [
		{
			key: "event",
			header: "Kebijakan & Event Notifikasi",
			render: (item) => (
				<div>
					<span className="font-semibold text-foreground">
						{EVENT_NAMES[item.policy.eventType] || item.policy.eventType}
					</span>
					<p className="text-[11px] text-muted-foreground">
						Batas Evaluasi: {item.deadline || "Akhir Periode"} ({item.dayType})
					</p>
				</div>
			),
		},
		{
			key: "category",
			header: "Kategori Policy",
			render: (item) => (
				<span
					className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
						item.policy.category === "mandatory"
							? "bg-danger/10 text-danger"
							: "bg-primary/10 text-primary"
					}`}
				>
					{item.policy.category === "mandatory" && (
						<Lock className="size-3" />
					)}
					<span>
						{item.policy.category === "mandatory"
							? "Mandatory (KPPN)"
							: "Recommended"}
					</span>
				</span>
			),
		},
		{
			key: "schedule",
			header: "Jadwal Kirim",
			render: (item) => (
				<div className="space-y-0.5">
					<span className="text-xs font-medium text-foreground">
						Lead Time: {item.policy.minLeadDays}–{item.policy.maxLeadDays} Hari
					</span>
					{item.scheduledDates.length > 0 && (
						<p className="text-[10px] text-muted-foreground">
							Tgl: {item.scheduledDates.slice(0, 3).join(", ")}
						</p>
					)}
				</div>
			),
		},
		{
			key: "status",
			header: "Status Pengingat",
			render: (item) => (
				<span
					className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
						item.enabled
							? "bg-success/10 text-success"
							: "bg-surface text-muted-foreground"
					}`}
				>
					{item.enabled ? "Aktif" : "Non-Aktif"}
				</span>
			),
		},
		{
			key: "actions",
			header: "Aksi",
			render: (item) => (
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => handleOpenEdit(item)}
						className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-surface-muted transition"
					>
						<Settings2 className="size-3 text-primary" />
						<span>Atur</span>
					</button>
					{item.configId && (
						<button
							type="button"
							onClick={() => handleResetConfig(item.configId)}
							className="inline-flex items-center rounded-lg p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground transition"
							title="Reset ke Default Policy"
						>
							<RotateCcw className="size-3.5" />
						</button>
					)}
				</div>
			),
		},
	];

	return (
		<OperatorShell currentPath="/operator/reminders">
			<div className="space-y-6">
				{/* Top Summary Banner */}
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div className="flex items-center gap-3">
						<div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<Bell className="size-5" />
						</div>
						<div>
							<h1 className="text-lg font-bold text-foreground sm:text-xl">
								Reminder Center — Jadwal &amp; Notifikasi Tenggat
							</h1>
							<p className="text-xs text-muted-foreground">
								Kelola preferensi notifikasi email pengingat sebelum batas jatuh
								tempo indikator IKPA sesuai Compliance Guard KPPN.
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<div className="flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary">
							<ShieldCheck className="size-4" />
							<span>Compliance Guard Active</span>
						</div>
					</div>
				</div>

				{/* Feedback status */}
				{actionMessage && (
					<output className="flex items-center gap-2.5 rounded-xl border border-success/30 bg-success/10 p-4 text-xs font-semibold text-success shadow-xs">
						<CheckCircle2 className="size-4 shrink-0" />
						<p>{actionMessage}</p>
					</output>
				)}

				{errorMessage && (
					<div
						role="alert"
						className="flex items-center gap-2.5 rounded-xl border border-danger/30 bg-danger/10 p-4 text-xs font-semibold text-danger shadow-xs"
					>
						<AlertCircle className="size-4 shrink-0" />
						<p>{errorMessage}</p>
					</div>
				)}

				{/* Summary Metrics */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-medium">Kebijakan Aktif</span>
							<Bell className="size-4 text-primary" />
						</div>
						<p className="text-lg font-bold text-foreground sm:text-xl">
							{activeCount} Pengingat Aktif
						</p>
						<p className="text-[11px] text-muted-foreground">
							Dari {rows.length} total event kebijakan
						</p>
					</div>

					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-medium">Kebijakan Mandatory</span>
							<Lock className="size-4 text-danger" />
						</div>
						<p className="text-lg font-bold text-danger sm:text-xl">
							{mandatoryCount} Kebijakan Terkunci
						</p>
						<p className="text-[11px] text-muted-foreground">
							Tidak dapat dinonaktifkan oleh Satker
						</p>
					</div>

					<div className="rounded-2xl border border-border bg-background p-4 shadow-xs space-y-1">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-medium">Kanal Pengiriman</span>
							<Mail className="size-4 text-success" />
						</div>
						<p className="text-lg font-bold text-foreground sm:text-xl">
							Email Satker &amp; In-App
						</p>
						<p className="text-[11px] text-muted-foreground">
							Dikirim otomatis pada jam 08:00 WIB
						</p>
					</div>
				</div>

				{/* Data Table */}
				<DomainDataTable
					title="Daftar Jadwal & Kebijakan Pengingat IKPA"
					data={filteredRows}
					columns={columns}
					searchValue={search}
					onSearchChange={setSearch}
					onAddClick={() => {
						if (rows.length > 0) handleOpenEdit(rows[0]);
					}}
					onImportClick={() => {}}
					totalCount={filteredRows.length}
				/>

				{/* Form Drawer: Edit Reminder Config */}
				<DomainFormDrawer
					isOpen={isDrawerOpen}
					title={`Pengaturan: ${selectedPolicy ? EVENT_NAMES[selectedPolicy.eventType] || selectedPolicy.eventType : ""}`}
					description="Sesuaikan lead time pengingat dan alamat email penerima notifikasi."
					onClose={() => setIsDrawerOpen(false)}
					onSubmit={handleSaveConfig}
					isSubmitting={isSubmitting}
				>
					<div className="space-y-4">
						{selectedPolicy && !selectedPolicy.allowDisable && (
							<div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3 text-xs text-danger font-medium">
								<Lock className="size-4 shrink-0" />
								<span>
									Kebijakan ini bersifat MANDATORY oleh KPPN dan wajib aktif.
								</span>
							</div>
						)}

						<div className="flex items-center gap-2 pt-1">
							<input
								id="rem-enabled"
								type="checkbox"
								checked={formEnabled}
								disabled={
									isSubmitting ||
									(selectedPolicy ? !selectedPolicy.allowDisable : false)
								}
								onChange={(e) => setFormEnabled(e.target.checked)}
								className="size-4 rounded border-border text-primary focus:ring-primary"
							/>
							<label
								htmlFor="rem-enabled"
								className="text-xs text-foreground font-semibold cursor-pointer"
							>
								Aktifkan Notifikasi Pengingat
							</label>
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="rem-lead-days"
								className="block text-xs font-semibold text-foreground"
							>
								Lead Days Notifikasi (Hari sebelum jatuh tempo)
							</label>
							<input
								id="rem-lead-days"
								type="text"
								required
								placeholder="Contoh: 7, 3, 1"
								value={formLeadDays}
								onChange={(e) => setFormLeadDays(e.target.value)}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							/>
							<p className="text-[11px] text-muted-foreground">
								Batas kebijakan: minimal {selectedPolicy?.minLeadDays ?? 1} hari
								sampai maksimal {selectedPolicy?.maxLeadDays ?? 14} hari.
							</p>
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="rem-recipients"
								className="block text-xs font-semibold text-foreground"
							>
								Email Tambahan Penerima (Dipisahkan koma)
							</label>
							<input
								id="rem-recipients"
								type="text"
								placeholder="operator2@kemenkeu.go.id, ppk@satker.go.id"
								value={formRecipients}
								onChange={(e) => setFormRecipients(e.target.value)}
								disabled={
									isSubmitting ||
									(selectedPolicy
										? !selectedPolicy.allowRecipientOverride
										: false)
								}
								className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							/>
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="rem-msg"
								className="block text-xs font-semibold text-foreground"
							>
								Pesan Tambahan (Opsional)
							</label>
							<textarea
								id="rem-msg"
								rows={3}
								maxLength={500}
								placeholder="Catatan internal satker yang akan disertakan pada email..."
								value={formMessage}
								onChange={(e) => setFormMessage(e.target.value)}
								disabled={isSubmitting}
								className="w-full rounded-lg border border-border bg-background p-3 text-xs text-foreground focus:border-primary focus:outline-none"
							/>
						</div>
					</div>
				</DomainFormDrawer>
			</div>
		</OperatorShell>
	);
}

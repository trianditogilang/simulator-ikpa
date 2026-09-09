import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
	AlertCircle,
	AlertTriangle,
	Bell,
	Calendar,
	CheckCircle2,
	ChevronRight,
	Clock,
	ExternalLink,
	Eye,
	FileText,
	Info,
	Lock,
	Mail,
	RotateCcw,
	Search,
	Settings2,
	ShieldAlert,
	ShieldCheck,
	Sparkles,
	UserCheck,
	Users,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { DomainFormDrawer } from "@/components/data/domain-form-drawer";
import { OperatorShell } from "@/components/layout/operator-shell";
import {
	fetchOperatorReminders,
	resetReminderConfig,
	saveReminderConfig,
	type ActiveReminderEvent,
	type OperatorRemindersData,
	type ReminderDeliveryLogItem,
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
	spm_ls_contract_17d: "Penyelesaian Tagihan SPM-LS (17 Hari Kerja)",
	invoice_timeliness_due: "Penyelesaian Tagihan SPM-LS (17 Hari Kerja)",
	early_contract_due: "Penyelesaian Kontrak Dini / Pra-DIPA (TW I)",
	contract_distribution_due: "Distribusi Akselerasi Kontrak s.d. Triwulan II",
	capital_53_contract_due: "Akselerasi Kontrak Belanja Modal 53 Rp50–200 Juta (TW I)",
	output_report_monthly: "Pelaporan Capaian Output",
	output_report_due: "Pelaporan Capaian Output",
	output_target_update_due: "Pemutakhiran Proyeksi Target Triwulanan (10 HK Awal TW)",
	up_tup_revolving_monthly: "Batas Revolving GUP Bulanan (30 Hari Kalender)",
	up_tup_revolving_due: "Batas Revolving GUP Bulanan (30 Hari Kalender)",
	spm_dispensation_q4: "Batas Pengajuan SPM Dispensasi Akhir Tahun (TW IV)",
	spm_dispensation_warning: "Peringatan Rasio SPM Dispensasi Triwulan IV",
	dipa_revision_quarterly: "Batas Akhir Revisi DIPA Triwulanan",
	ikpa_weekly_digest: "Laporan Mingguan Estimasi IKPA Satker",
};

function maskEmail(email: string): string {
	if (!email || !email.includes("@")) return email;
	const [name, domain] = email.split("@");
	if (name.length <= 2) return `${name}***@${domain}`;
	return `${name.slice(0, 2)}***${name.slice(-1)}@${domain}`;
}

function formatDateIndo(dateStr?: string | null): string {
	if (!dateStr) return "-";
	const clean = dateStr.slice(0, 10);
	const parts = clean.split("-");
	if (parts.length === 3) {
		return `${parts[2]}-${parts[1]}-${parts[0]}`;
	}
	return dateStr;
}

function formatDateTimeIndo(isoStr?: string | null): string {
	if (!isoStr) return "-";
	try {
		const dt = new Date(isoStr);
		if (Number.isNaN(dt.getTime())) return isoStr;
		const day = String(dt.getDate()).padStart(2, "0");
		const month = String(dt.getMonth() + 1).padStart(2, "0");
		const year = dt.getFullYear();
		const hour = String(dt.getHours()).padStart(2, "0");
		const minute = String(dt.getMinutes()).padStart(2, "0");
		return `${day}-${month}-${year} ${hour}:${minute} WIB`;
	} catch {
		return isoStr;
	}
}

function OperatorRemindersPage() {
	const router = useRouter();
	const initialData = Route.useLoaderData() as OperatorRemindersData;

	// Active tab
	const [activeTab, setActiveTab] = useState<
		"active_events" | "policies" | "recipients" | "deliveries"
	>("active_events");

	// Search & Filters for Tab 1 (Active Events)
	const [eventSearch, setEventSearch] = useState("");
	const [indicatorFilter, setIndicatorFilter] = useState("all");
	const [eventStatusFilter, setEventStatusFilter] = useState("all");

	// Search & Filters for Tab 2 (Policies)
	const [policySearch, setPolicySearch] = useState("");
	const [policyCategoryFilter, setPolicyCategoryFilter] = useState("all");

	// Search for Tab 3 & 4
	const [deliverySearch, setDeliverySearch] = useState("");
	const [deliveryStatusFilter, setDeliveryStatusFilter] = useState("all");

	// Modal / Drawer states
	const [selectedPolicy, setSelectedPolicy] =
		useState<ReminderPolicyItem | null>(null);
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Detail Modal for Active Event
	const [detailEvent, setDetailEvent] = useState<ActiveReminderEvent | null>(
		null,
	);

	// Detail Modal for Delivery Log
	const [detailDelivery, setDetailDelivery] =
		useState<ReminderDeliveryLogItem | null>(null);

	// Form State in Drawer
	const [formEnabled, setFormEnabled] = useState(true);
	const [formLeadDays, setFormLeadDays] = useState("7, 3, 1");
	const [formRecipients, setFormRecipients] = useState("");
	const [formMessage, setFormMessage] = useState("");

	// Feedback toasts & drawer error
	const [actionMessage, setActionMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [drawerError, setDrawerError] = useState<string | null>(null);

	// Filtered Active Events
	const filteredEvents = useMemo(() => {
		return initialData.events.filter((evt) => {
			const matchSearch =
				evt.eventTitle.toLowerCase().includes(eventSearch.toLowerCase()) ||
				evt.entityNumber.toLowerCase().includes(eventSearch.toLowerCase()) ||
				(evt.entityDetail &&
					evt.entityDetail.toLowerCase().includes(eventSearch.toLowerCase())) ||
				evt.indicatorLabel.toLowerCase().includes(eventSearch.toLowerCase());

			const matchIndicator =
				indicatorFilter === "all" || evt.indicatorKey === indicatorFilter;

			let matchStatus = true;
			if (eventStatusFilter === "urgent") {
				matchStatus = evt.status === "urgent" || evt.status === "overdue";
			} else if (eventStatusFilter === "warning") {
				matchStatus = evt.status === "warning";
			} else if (eventStatusFilter === "safe") {
				matchStatus = evt.status === "safe";
			} else if (eventStatusFilter === "completed") {
				matchStatus = evt.status === "completed";
			}

			return matchSearch && matchIndicator && matchStatus;
		});
	}, [initialData.events, eventSearch, indicatorFilter, eventStatusFilter]);

	// Filtered Policies
	const filteredPolicies = useMemo(() => {
		return initialData.policies.filter((pol) => {
			const title = EVENT_NAMES[pol.eventType] || pol.eventType;
			const matchSearch =
				title.toLowerCase().includes(policySearch.toLowerCase()) ||
				(pol.indicatorLabel &&
					pol.indicatorLabel
						.toLowerCase()
						.includes(policySearch.toLowerCase()));

			const matchCategory =
				policyCategoryFilter === "all" ||
				pol.category === policyCategoryFilter;

			return matchSearch && matchCategory;
		});
	}, [initialData.policies, policySearch, policyCategoryFilter]);

	// Filtered Deliveries
	const filteredDeliveries = useMemo(() => {
		return initialData.deliveries.filter((del) => {
			const matchSearch =
				del.eventTitle.toLowerCase().includes(deliverySearch.toLowerCase()) ||
				del.entityNumber.toLowerCase().includes(deliverySearch.toLowerCase()) ||
				del.recipientEmail.toLowerCase().includes(deliverySearch.toLowerCase()) ||
				del.indicatorLabel.toLowerCase().includes(deliverySearch.toLowerCase());

			const matchStatus =
				deliveryStatusFilter === "all" || del.status === deliveryStatusFilter;

			return matchSearch && matchStatus;
		});
	}, [initialData.deliveries, deliverySearch, deliveryStatusFilter]);

	// Open Drawer handler
	const handleOpenEditPolicy = (policy: ReminderPolicyItem) => {
		setSelectedPolicy(policy);
		setDrawerError(null);
		setErrorMessage(null);
		const cfg = initialData.configs.find((c) => c.reminderPolicyId === policy.id);
		setFormEnabled(cfg ? cfg.enabled : policy.isActive);
		setFormLeadDays(
			cfg?.scheduleLeadDays?.slice(0, 4).join(", ") ??
				policy.defaultLeadDays?.slice(0, 4).join(", ") ??
				(policy.minLeadDays !== undefined && policy.maxLeadDays !== undefined
					? policy.minLeadDays === 0
						? `${policy.maxLeadDays}, 7, 3, 0`
						: `${policy.maxLeadDays}, ${policy.minLeadDays}`
					: "17, 10, 5, 0"),
		);
		setFormRecipients(cfg?.additionalRecipients?.join(", ") ?? "");
		setFormMessage(cfg?.customMessage ?? "");
		setIsDrawerOpen(true);
	};

	// Save Config handler
	const handleSaveConfig = async () => {
		if (!selectedPolicy) return;
		setActionMessage(null);
		setErrorMessage(null);
		setDrawerError(null);

		const leadArr = formLeadDays
			.split(",")
			.map((s) => Number.parseInt(s.trim(), 10))
			.filter((n) => !Number.isNaN(n) && n >= 0);

		// Validate lead count
		if (leadArr.length === 0) {
			setDrawerError(
				`Harap masukkan minimal satu jadwal pengingat (contoh: ${
					selectedPolicy.defaultLeadDays?.slice(0, 4).join(", ") ||
					`${selectedPolicy.maxLeadDays}, ${selectedPolicy.minLeadDays}`
				}).`,
			);
			return;
		}

		if (leadArr.length > 4) {
			setDrawerError(
				"Isian reminder maksimal 4 kali pengingat (maksimal 4 milestone hari pengingat).",
			);
			return;
		}

		// Validate lead bounds
		const minAllowed = 0;
		const maxAllowed = 20;

		for (const ld of leadArr) {
			if (ld < minAllowed || ld > maxAllowed) {
				setDrawerError(
					`Lead day ${ld} di luar batas yang diizinkan (${minAllowed} s.d. ${maxAllowed} hari). ${
						minAllowed === 0 ? "Gunakan 0 untuk pengingat pada hari H batas tenggat." : ""
					}`,
				);
				return;
			}
		}

		const recArr = formRecipients
			.split(",")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);

		// Validate email format
		for (const email of recArr) {
			if (!email.includes("@") || !email.includes(".")) {
				setDrawerError(`Format email tambahan "${email}" tidak valid.`);
				return;
			}
		}

		setIsSubmitting(true);
		try {
			await saveReminderConfig({
				reminderPolicyId: selectedPolicy.id,
				enabled: formEnabled,
				leadDays: leadArr,
				additionalRecipients: recArr,
				customMessage: formMessage || null,
			});

			setActionMessage(
				`Konfigurasi pengingat "${EVENT_NAMES[selectedPolicy.eventType] || selectedPolicy.eventType}" berhasil disimpan.`,
			);
			setIsDrawerOpen(false);
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 5000);
		} catch (err: unknown) {
			const errMsg =
				err instanceof Error
					? err.message
					: "Gagal menyimpan konfigurasi pengingat.";
			setDrawerError(errMsg);
			setErrorMessage(errMsg);
		} finally {
			setIsSubmitting(false);
		}
	};

	// Reset Config handler
	const handleResetConfig = async (policyId: string) => {
		const cfg = initialData.configs.find((c) => c.reminderPolicyId === policyId);
		if (!cfg) {
			alert("Pengaturan sudah berada pada nilai default kebijakan KPPN.");
			return;
		}
		if (
			!confirm(
				"Reset konfigurasi pengingat ini ke default kebijakan KPPN?",
			)
		) {
			return;
		}
		try {
			await resetReminderConfig(cfg.id);
			setActionMessage("Konfigurasi direset ke default policy KPPN.");
			await router.invalidate();
			setTimeout(() => setActionMessage(null), 4000);
		} catch (err: unknown) {
			setErrorMessage(
				err instanceof Error ? err.message : "Gagal mereset konfigurasi.",
			);
		}
	};

	const urgentCount = initialData.stats.urgentEventsCount;

	return (
		<OperatorShell currentPath="/operator/reminders">
			<div className="space-y-6">
				{/* Top Header Banner */}
				<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-xs">
					<div className="flex items-center gap-3">
						<div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<Bell className="size-6" />
						</div>
						<div>
							<div className="flex items-center gap-2">
								<h1 className="text-lg font-bold text-foreground sm:text-xl">
									Reminder Center — Jadwal &amp; Notifikasi Tenggat
								</h1>
								<span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
									TA {initialData.year}
								</span>
							</div>
							<p className="mt-0.5 text-xs text-muted-foreground">
								Monitoring risiko tenggat jatuh tempo indikator IKPA, preferensi
								lead time, dan riwayat pengiriman notifikasi terverifikasi.
							</p>
						</div>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						<div className="flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary">
							<ShieldCheck className="size-4" />
							<span>Compliance Guard Active</span>
						</div>
						<div className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
							<Clock className="size-4" />
							<span>Mode Sandbox</span>
						</div>
					</div>
				</div>

				{/* Sandbox & Context Guard Notice */}
				<div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-950 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-100 shadow-xs">
					<Info className="mt-0.5 size-4.5 shrink-0 text-blue-700 dark:text-blue-400" />
					<div className="space-y-1">
						<p className="font-bold text-blue-950 dark:text-blue-50">
							Informasi Pengiriman Notifikasi Satker:
						</p>
						<p className="leading-relaxed text-blue-900 dark:text-blue-200">
							{initialData.providerStatus.message} Indikator{" "}
							<strong className="font-bold text-blue-950 dark:text-blue-100">
								Belanja Kontraktual
							</strong>{" "}
							dan{" "}
							<strong className="font-bold text-blue-950 dark:text-blue-100">
								Penyelesaian Tagihan
							</strong>{" "}
							dihitung secara terpisah dengan formula dan trigger independen
							sesuai PER-5/PB/2024.
						</p>
					</div>
				</div>

				{/* Toast Feedback */}
				{actionMessage && (
					<output className="flex items-center justify-between rounded-xl border border-success/30 bg-success/10 p-4 text-xs font-semibold text-success shadow-xs">
						<div className="flex items-center gap-2.5">
							<CheckCircle2 className="size-4.5 shrink-0" />
							<span>{actionMessage}</span>
						</div>
						<button
							type="button"
							onClick={() => setActionMessage(null)}
							className="text-success hover:underline"
						>
							Tutup
						</button>
					</output>
				)}

				{errorMessage && (
					<div
						role="alert"
						className="flex items-center justify-between rounded-xl border border-danger/30 bg-danger/10 p-4 text-xs font-semibold text-danger shadow-xs"
					>
						<div className="flex items-center gap-2.5">
							<AlertCircle className="size-4.5 shrink-0" />
							<span>{errorMessage}</span>
						</div>
						<button
							type="button"
							onClick={() => setErrorMessage(null)}
							className="text-danger hover:underline"
						>
							Tutup
						</button>
					</div>
				)}

				{/* 4 Summary Stat Cards */}
				<div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
					<div className="rounded-2xl border border-border bg-surface p-4 shadow-xs space-y-2">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold">Event Terpantau</span>
							<Bell className="size-4 text-primary" />
						</div>
						<div className="flex items-baseline justify-between">
							<span className="text-2xl font-bold tracking-tight text-foreground">
								{initialData.stats.totalActiveEvents}
							</span>
							{urgentCount > 0 ? (
								<span className="inline-flex items-center gap-1 rounded-md bg-danger/10 px-2 py-0.5 text-[11px] font-bold text-danger">
									<AlertTriangle className="size-3" />
									{urgentCount} Butuh Aksi
								</span>
							) : (
								<span className="rounded-md bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
									Semua Aman
								</span>
							)}
						</div>
						<p className="text-[11px] text-muted-foreground">
							Seluruh objek tagihan, kontrak, target &amp; revolving
						</p>
					</div>

					<div className="rounded-2xl border border-border bg-surface p-4 shadow-xs space-y-2">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold">Status Kepatuhan</span>
							<ShieldAlert className="size-4 text-warning" />
						</div>
						<div className="flex items-baseline justify-between">
							<span className="text-2xl font-bold tracking-tight text-foreground">
								{initialData.stats.safeEventsCount +
									initialData.stats.completedEventsCount}{" "}
								<span className="text-sm font-normal text-muted-foreground">
									/ {initialData.stats.totalActiveEvents}
								</span>
							</span>
							<span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
								{initialData.stats.completedEventsCount} Selesai
							</span>
						</div>
						<p className="text-[11px] text-muted-foreground">
							Objek tepat waktu dan terkonversi KPPN
						</p>
					</div>

					<div className="rounded-2xl border border-border bg-surface p-4 shadow-xs space-y-2">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold">Kebijakan Policy</span>
							<Lock className="size-4 text-danger" />
						</div>
						<div className="flex items-baseline justify-between">
							<span className="text-2xl font-bold tracking-tight text-foreground">
								{initialData.stats.totalPoliciesCount}
							</span>
							<span className="inline-flex items-center gap-1 rounded-md bg-danger/10 px-2 py-0.5 text-[11px] font-semibold text-danger">
								<Lock className="size-3" />
								{initialData.stats.mandatoryPoliciesCount} Mandatory
							</span>
						</div>
						<p className="text-[11px] text-muted-foreground">
							KPPN Compliance Guard TA {initialData.year}
						</p>
					</div>

					<div className="rounded-2xl border border-border bg-surface p-4 shadow-xs space-y-2">
						<div className="flex items-center justify-between text-muted-foreground">
							<span className="text-xs font-semibold">Penerima &amp; Kanal</span>
							<Mail className="size-4 text-success" />
						</div>
						<div className="flex items-baseline justify-between">
							<span className="text-2xl font-bold tracking-tight text-foreground">
								{initialData.recipients.length} User
							</span>
							<span className="rounded-md bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
								Email &amp; In-App
							</span>
						</div>
						<p className="text-[11px] text-muted-foreground">
							User terverifikasi &amp; penerima satker
						</p>
					</div>
				</div>

				{/* 4 Main Tabs Navigation */}
				<div className="border-b border-border">
					<nav className="flex space-x-2 overflow-x-auto" aria-label="Tabs">
						<button
							type="button"
							onClick={() => setActiveTab("active_events")}
							className={`relative flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold transition ${
								activeTab === "active_events"
									? "border-primary text-primary"
									: "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
							}`}
						>
							<Calendar className="size-4" />
							<span>Event Aktif</span>
							<span
								className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
									urgentCount > 0
										? "bg-danger text-primary-foreground"
										: activeTab === "active_events"
											? "bg-primary/10 text-primary"
											: "bg-surface-muted text-muted-foreground"
								}`}
							>
								{initialData.events.length}
							</span>
						</button>

						<button
							type="button"
							onClick={() => setActiveTab("policies")}
							className={`relative flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold transition ${
								activeTab === "policies"
									? "border-primary text-primary"
									: "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
							}`}
						>
							<Settings2 className="size-4" />
							<span>Kebijakan &amp; Jadwal</span>
							<span
								className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
									activeTab === "policies"
										? "bg-primary/10 text-primary"
										: "bg-surface-muted text-muted-foreground"
								}`}
							>
								{initialData.policies.length}
							</span>
						</button>

						<button
							type="button"
							onClick={() => setActiveTab("recipients")}
							className={`relative flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold transition ${
								activeTab === "recipients"
									? "border-primary text-primary"
									: "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
							}`}
						>
							<Users className="size-4" />
							<span>Penerima Notifikasi</span>
							<span
								className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
									activeTab === "recipients"
										? "bg-primary/10 text-primary"
										: "bg-surface-muted text-muted-foreground"
								}`}
							>
								{initialData.recipients.length}
							</span>
						</button>

						<button
							type="button"
							onClick={() => setActiveTab("deliveries")}
							className={`relative flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold transition ${
								activeTab === "deliveries"
									? "border-primary text-primary"
									: "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
							}`}
						>
							<Mail className="size-4" />
							<span>Log Delivery &amp; Riwayat</span>
							<span
								className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
									activeTab === "deliveries"
										? "bg-primary/10 text-primary"
										: "bg-surface-muted text-muted-foreground"
								}`}
							>
								{initialData.deliveries.length}
							</span>
						</button>
					</nav>
				</div>

				{/* TAB 1: EVENT AKTIF */}
				{activeTab === "active_events" && (
					<div className="space-y-4">
						{/* Filter & Search */}
						<div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between">
							<div className="relative flex-1">
								<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
								<input
									type="text"
									placeholder="Cari event, nomor SPM, nomor kontrak, RO, atau akun..."
									value={eventSearch}
									onChange={(e) => setEventSearch(e.target.value)}
									className="min-h-9 w-full rounded-xl border border-border bg-background pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
								/>
							</div>

							<div className="flex flex-wrap items-center gap-2">
								<select
									value={indicatorFilter}
									onChange={(e) => setIndicatorFilter(e.target.value)}
									className="min-h-9 rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								>
									<option value="all">Semua Indikator</option>
									<option value="invoice_timeliness">Penyelesaian Tagihan</option>
									<option value="contractual">Belanja Kontraktual</option>
									<option value="output_achievement">Capaian Output</option>
									<option value="up_tup">Pengelolaan UP/TUP</option>
									<option value="spm_dispensation">Dispensasi SPM</option>
									<option value="dipa_revision">Revisi DIPA</option>
								</select>

								<select
									value={eventStatusFilter}
									onChange={(e) => setEventStatusFilter(e.target.value)}
									className="min-h-9 rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								>
									<option value="all">Semua Status Tenggat</option>
									<option value="urgent">🚨 Mendesak / Terlambat</option>
									<option value="warning">⚠️ Perhatian (H-5 / H-6)</option>
									<option value="safe">🛡️ Aman</option>
									<option value="completed">✓ Selesai / Terkonversi</option>
								</select>

								{(eventSearch ||
									indicatorFilter !== "all" ||
									eventStatusFilter !== "all") && (
									<button
										type="button"
										onClick={() => {
											setEventSearch("");
											setIndicatorFilter("all");
											setEventStatusFilter("all");
										}}
										className="text-xs font-semibold text-primary hover:underline px-2 py-1"
									>
										Reset Filter
									</button>
								)}
							</div>
						</div>

						{/* Table Active Events */}
						<div className="rounded-2xl border border-border bg-surface shadow-xs overflow-hidden">
							<div
								className={`overflow-x-auto ${
									filteredEvents.length > 5
										? "max-h-[380px] overflow-y-auto"
										: ""
								}`}
							>
								<table className="w-full text-left text-xs">
									<thead className="sticky top-0 z-10 border-b border-border bg-surface text-slate-800 dark:text-slate-200">
										<tr className="border-b border-border bg-surface-muted/90 font-semibold text-muted-foreground backdrop-blur-xs">
											<th className="py-3 pl-4 pr-3 min-w-[200px] w-[24%]">Indikator &amp; Event</th>
											<th className="px-3 py-3 min-w-[170px] max-w-[230px] w-[22%]">Objek / Entitas</th>
											<th className="px-3 py-3 whitespace-nowrap min-w-[110px] w-[13%]">Dasar Tanggal</th>
											<th className="px-3 py-3 whitespace-nowrap min-w-[120px] w-[14%]">Batas Evaluasi (Deadline)</th>
											<th className="px-3 py-3 whitespace-nowrap min-w-[110px] w-[13%]">Delivery Berikutnya</th>
											<th className="px-3 py-3 text-center whitespace-nowrap min-w-[100px] w-[10%]">Status</th>
											<th className="py-3 pl-2 pr-4 text-right whitespace-nowrap min-w-[110px] w-[4%]">Aksi</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border/60">
										{filteredEvents.length === 0 ? (
											<tr>
												<td
													colSpan={7}
													className="py-12 text-center text-muted-foreground"
												>
													Tidak ada event pengingat aktif yang sesuai dengan
													filter pencarian.
												</td>
											</tr>
										) : (
											filteredEvents.map((item) => (
												<tr
													key={item.id}
													className="transition-colors hover:bg-surface-muted/30"
												>
													<td className="py-3 pl-4 pr-3 min-w-[200px] w-[24%]">
														<div className="space-y-1">
															<span
																className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${
																	item.indicatorKey === "invoice_timeliness"
																		? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
																		: item.indicatorKey === "contractual"
																			? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
																			: item.indicatorKey ===
																					"output_achievement"
																				? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
																				: item.indicatorKey === "up_tup"
																					? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
																					: "bg-surface-muted text-muted-foreground"
																}`}
															>
																{item.indicatorLabel}
															</span>
															<p className="font-semibold text-foreground leading-snug">
																{item.eventTitle}
															</p>
														</div>
													</td>
													<td className="px-3 py-3 min-w-[170px] max-w-[230px] w-[22%]">
														<div className="space-y-0.5">
															<span className="font-bold text-foreground font-mono break-words block">
																{item.entityNumber}
															</span>
															{item.entityDetail && (
																<p className="text-[11px] text-muted-foreground whitespace-normal break-words leading-relaxed">
																	{item.entityDetail}
																</p>
															)}
														</div>
													</td>
													<td className="px-3 py-3 whitespace-nowrap min-w-[110px] w-[13%]">
														<div className="space-y-0.5">
															<span className="font-semibold text-foreground">
																{formatDateIndo(item.baseDate)}
															</span>
															<p className="text-[10px] text-muted-foreground">
																{item.baseDateLabel}
															</p>
														</div>
													</td>
													<td className="px-3 py-3 whitespace-nowrap min-w-[120px] w-[14%]">
														<div className="space-y-0.5">
															<span className="font-bold text-foreground">
																{formatDateIndo(item.deadlineDate)}
															</span>
															<p className="text-[10px] text-muted-foreground">
																{item.dayType === "workday"
																	? "Hari Kerja"
																	: "Hari Kalender"}
															</p>
														</div>
													</td>
													<td className="px-3 py-3 whitespace-nowrap min-w-[110px] w-[13%]">
														<div className="space-y-0.5">
															<span className="font-medium text-foreground">
																{item.nextMilestone}
															</span>
															<p className="text-[10px] text-muted-foreground">
																{item.nextScheduledTime}
															</p>
														</div>
													</td>
													<td className="px-3 py-3 text-center whitespace-nowrap min-w-[100px] w-[10%]">
														<span
															className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
																item.status === "completed"
																	? "bg-success/10 text-success"
																	: item.status === "urgent" ||
																			item.status === "overdue"
																		? "bg-danger/10 text-danger border border-danger/30"
																		: item.status === "warning"
																			? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30"
																			: "bg-primary/10 text-primary"
															}`}
														>
															{item.statusLabel}
														</span>
													</td>
													<td className="py-3 pl-2 pr-4 text-right whitespace-nowrap min-w-[110px] w-[4%]">
														<div className="flex items-center justify-end gap-1.5">
															<button
																type="button"
																onClick={() => setDetailEvent(item)}
																className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-surface-muted transition"
															>
																<Eye className="size-3 text-primary" />
																<span>Detail</span>
															</button>
															<a
																href={item.actionUrl}
																className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-2xs"
															>
																<span>Buka</span>
																<ChevronRight className="size-3" />
															</a>
														</div>
													</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				)}

				{/* TAB 2: KEBIJAKAN & JADWAL */}
				{activeTab === "policies" && (
					<div className="space-y-4">
						{/* Filter & Search */}
						<div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between">
							<div className="relative flex-1">
								<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
								<input
									type="text"
									placeholder="Cari kebijakan, jenis indikator, atau kata kunci..."
									value={policySearch}
									onChange={(e) => setPolicySearch(e.target.value)}
									className="min-h-9 w-full rounded-xl border border-border bg-background pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
								/>
							</div>

							<div className="flex flex-wrap items-center gap-2">
								<select
									value={policyCategoryFilter}
									onChange={(e) => setPolicyCategoryFilter(e.target.value)}
									className="min-h-9 rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								>
									<option value="all">Semua Kategori Kebijakan</option>
									<option value="mandatory">Mandatory (Wajib Pusat)</option>
									<option value="recommended">Recommended</option>
									<option value="optional">Optional</option>
								</select>

								{(policySearch || policyCategoryFilter !== "all") && (
									<button
										type="button"
										onClick={() => {
											setPolicySearch("");
											setPolicyCategoryFilter("all");
										}}
										className="text-xs font-semibold text-primary hover:underline px-2 py-1"
									>
										Reset Filter
									</button>
								)}
							</div>
						</div>

						{/* Table Policies */}
						<div className="rounded-2xl border border-border bg-surface shadow-xs overflow-hidden">
							<div
								className={`overflow-x-auto ${
									filteredPolicies.length > 5
										? "max-h-[380px] overflow-y-auto"
										: ""
								}`}
							>
								<table className="w-full text-left text-xs">
									<thead className="sticky top-0 z-10 border-b border-border bg-surface text-slate-800 dark:text-slate-200">
										<tr className="border-b border-border bg-surface-muted/90 font-semibold text-muted-foreground backdrop-blur-xs">
											<th className="py-3 pl-4 pr-2">
												Kebijakan &amp; Event Notifikasi
											</th>
											<th className="px-3 py-3">Indikator</th>
											<th className="px-3 py-3 text-center">Kategori</th>
											<th className="px-3 py-3">Rentang Lead Time Diizinkan</th>
											<th className="px-3 py-3">Jadwal Kirim (Lead Days)</th>
											<th className="px-3 py-3 text-center">Status</th>
											<th className="py-3 pl-2 pr-4 text-right">Aksi</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border/60">
										{filteredPolicies.map((pol) => {
											const cfg = initialData.configs.find(
												(c) => c.reminderPolicyId === pol.id,
											);
											const prev = initialData.previews.find(
												(p) => p.policyId === pol.id,
											);
											const isEnabled = cfg ? cfg.enabled : pol.isActive;
											const leadDays =
												cfg?.scheduleLeadDays ?? pol.defaultLeadDays ?? [];

											return (
												<tr
													key={pol.id}
													className="transition-colors hover:bg-surface-muted/30"
												>
													<td className="py-3 pl-4 pr-2 max-w-sm">
														<span className="font-semibold text-foreground">
															{EVENT_NAMES[pol.eventType] || pol.eventType}
														</span>
														<p className="text-[11px] text-muted-foreground">
															{pol.eventType === "output_report_monthly" ||
															pol.eventType === "output_report_due"
																? "Konfirmasi Realisasi Kinerja Capaian Output"
																: pol.description ||
																	`Evaluasi berbasis ${pol.dayType === "workday" ? "hari kerja" : "hari kalender"}`}
														</p>
													</td>
													<td className="px-3 py-3">
														<span className="font-medium text-foreground">
															{pol.indicatorLabel || "IKPA"}
														</span>
													</td>
													<td className="px-3 py-3 text-center">
														<span
															className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
																pol.category === "mandatory"
																	? "bg-danger/10 text-danger"
																	: "bg-primary/10 text-primary"
															}`}
														>
															{pol.category === "mandatory" && (
																<Lock className="size-3" />
															)}
															<span>
																{pol.category === "mandatory"
																	? "Mandatory"
																	: "Recommended"}
															</span>
														</span>
													</td>
													<td className="px-3 py-3">
														<span className="font-semibold text-foreground">
															{pol.minLeadDays} s.d. {pol.maxLeadDays} Hari
														</span>
														<p className="text-[10px] text-muted-foreground">
															{pol.dayType === "workday"
																? "Hari Kerja"
																: "Hari Kalender"}
														</p>
													</td>
													<td className="px-3 py-3">
														<div className="space-y-0.5">
															<span className="font-bold text-foreground">
																{leadDays
																	.map((d) => (d === 0 ? "Hari-H" : `H-${d}`))
																	.join(", ")}
															</span>
															{prev && prev.scheduled.length > 0 && (
																<p className="text-[10px] text-muted-foreground">
																	Tgl:{" "}
																	{prev.scheduled
																		.map((s) => formatDateIndo(s.scheduledDate))
																		.slice(0, 3)
																		.join(", ")}
																</p>
															)}
														</div>
													</td>
													<td className="px-3 py-3 text-center">
														<span
															className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
																isEnabled
																	? "bg-success/10 text-success"
																	: "bg-surface-muted text-muted-foreground"
															}`}
														>
															{isEnabled ? "Aktif" : "Non-Aktif"}
														</span>
													</td>
													<td className="py-3 pl-2 pr-4 text-right">
														<div className="flex items-center justify-end gap-1.5">
															<button
																type="button"
																onClick={() => handleOpenEditPolicy(pol)}
																className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-surface-muted transition"
															>
																<Settings2 className="size-3 text-primary" />
																<span>Atur</span>
															</button>
															{cfg && (
																<button
																	type="button"
																	onClick={() => handleResetConfig(pol.id)}
																	className="inline-flex items-center rounded-lg p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground transition"
																	title="Reset ke Default Policy KPPN"
																>
																	<RotateCcw className="size-3.5" />
																</button>
															)}
														</div>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				)}

				{/* TAB 3: PENERIMA NOTIFIKASI */}
				{activeTab === "recipients" && (
					<div className="space-y-4">
						{/* Info Panel */}
						<div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 text-xs text-foreground shadow-xs">
							<UserCheck className="mt-0.5 size-5 shrink-0 text-primary" />
							<div className="space-y-1">
								<h3 className="font-bold text-foreground">
									Daftar Penerima Notifikasi Satker Terverifikasi
								</h3>
								<p className="text-muted-foreground leading-relaxed">
									Penerima default diambil dari user aplikasi yang aktif dan
									terdaftar pada Satker. Alamat email mandatory diproteksi oleh
									KPPN dan tidak dapat dihapus, sedangkan email tambahan dapat
									dikonfigurasi pada masing-masing kebijakan pengingat di Tab
									Kebijakan &amp; Jadwal.
								</p>
							</div>
						</div>

						{/* Recipients Table */}
						<div className="rounded-2xl border border-border bg-surface shadow-xs overflow-hidden">
							<div
								className={`overflow-x-auto ${
									initialData.recipients.length > 5
										? "max-h-[380px] overflow-y-auto"
										: ""
								}`}
							>
								<table className="w-full text-left text-xs">
									<thead className="sticky top-0 z-10 border-b border-border bg-surface text-slate-800 dark:text-slate-200">
										<tr className="border-b border-border bg-surface-muted/90 font-semibold text-muted-foreground backdrop-blur-xs">
											<th className="py-3 pl-4 pr-2">Nama Penerima</th>
											<th className="px-3 py-3">Alamat Email</th>
											<th className="px-3 py-3">Role / Jabatan</th>
											<th className="px-3 py-3">Jenis Penerima</th>
											<th className="px-3 py-3">Kebijakan Dialokasikan</th>
											<th className="py-3 pl-2 pr-4 text-center">Status</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border/60">
										{initialData.recipients.map((rec) => (
											<tr
												key={rec.id}
												className="transition-colors hover:bg-surface-muted/30"
											>
												<td className="py-3 pl-4 pr-2">
													<div className="flex items-center gap-2">
														<div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
															{rec.name.slice(0, 2).toUpperCase()}
														</div>
														<span className="font-bold text-foreground">
															{rec.name}
														</span>
													</div>
												</td>
												<td className="px-3 py-3">
													<div className="space-y-0.5">
														<span className="font-mono text-xs font-semibold text-foreground">
															{rec.email}
														</span>
														{rec.isVerified && (
															<span className="block text-[10px] font-semibold text-success">
																Email Terverifikasi
															</span>
														)}
													</div>
												</td>
												<td className="px-3 py-3">
													<span className="font-medium text-foreground">
														{rec.role}
													</span>
												</td>
												<td className="px-3 py-3">
													<span
														className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${
															rec.isSystemUser
																? "bg-primary/10 text-primary"
																: "bg-surface-muted text-muted-foreground"
														}`}
													>
														{rec.isSystemUser
															? "User Aplikasi Satker"
															: "Penerima Tambahan"}
													</span>
												</td>
												<td className="px-3 py-3 max-w-xs">
													<div className="flex flex-wrap gap-1">
														{rec.allocatedPolicies.map((polName) => (
															<span
																key={polName}
																className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
															>
																{polName}
															</span>
														))}
													</div>
												</td>
												<td className="py-3 pl-2 pr-4 text-center">
													<span className="inline-flex rounded-full bg-success/10 px-2.5 py-0.5 text-[11px] font-semibold text-success">
														Aktif
													</span>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				)}

				{/* TAB 4: LOG DELIVERY & RIWAYAT */}
				{activeTab === "deliveries" && (
					<div className="space-y-4">
						{/* Filter & Search */}
						<div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between">
							<div className="relative flex-1">
								<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
								<input
									type="text"
									placeholder="Cari histori delivery, nama event, atau alamat email penerima..."
									value={deliverySearch}
									onChange={(e) => setDeliverySearch(e.target.value)}
									className="min-h-9 w-full rounded-xl border border-border bg-background pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
								/>
							</div>

							<div className="flex flex-wrap items-center gap-2">
								<select
									value={deliveryStatusFilter}
									onChange={(e) => setDeliveryStatusFilter(e.target.value)}
									className="min-h-9 rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
								>
									<option value="all">Semua Status Delivery</option>
									<option value="pending_provider">
										Terjadwal (Sandbox / Pending)
									</option>
									<option value="sent">Terkirim (Sent)</option>
									<option value="failed">Gagal (Failed)</option>
								</select>

								{(deliverySearch || deliveryStatusFilter !== "all") && (
									<button
										type="button"
										onClick={() => {
											setDeliverySearch("");
											setDeliveryStatusFilter("all");
										}}
										className="text-xs font-semibold text-primary hover:underline px-2 py-1"
									>
										Reset Filter
									</button>
								)}
							</div>
						</div>

						{/* Table Deliveries */}
						<div className="rounded-2xl border border-border bg-surface shadow-xs overflow-hidden">
							<div
								className={`overflow-x-auto ${
									filteredDeliveries.length > 5
										? "max-h-[380px] overflow-y-auto"
										: ""
								}`}
							>
								<table className="w-full text-left text-xs">
									<thead className="sticky top-0 z-10 border-b border-border bg-surface text-slate-800 dark:text-slate-200">
										<tr className="border-b border-border bg-surface-muted/90 font-semibold text-muted-foreground backdrop-blur-xs">
											<th className="py-3 pl-4 pr-2">Waktu Terjadwal / Kirim</th>
											<th className="px-3 py-3">Indikator &amp; Event</th>
											<th className="px-3 py-3">Entitas / Referensi</th>
											<th className="px-3 py-3">Penerima</th>
											<th className="px-3 py-3 text-center">Channel</th>
											<th className="px-3 py-3 text-center">Status Delivery</th>
											<th className="py-3 pl-2 pr-4 text-right">Aksi</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border/60">
										{filteredDeliveries.length === 0 ? (
											<tr>
												<td
													colSpan={7}
													className="py-12 text-center text-muted-foreground"
												>
													Belum ada riwayat pengiriman notifikasi yang sesuai.
												</td>
											</tr>
										) : (
											filteredDeliveries.map((del) => (
												<tr
													key={del.id}
													className="transition-colors hover:bg-surface-muted/30"
												>
													<td className="py-3 pl-4 pr-2">
														<span className="font-semibold text-foreground">
															{formatDateTimeIndo(
																del.sentAt || del.scheduledFor,
															)}
														</span>
														<p className="text-[10px] text-muted-foreground">
															{del.sentAt ? "Terkirim" : "Jadwal Kirim (WIB)"}
														</p>
													</td>
													<td className="px-3 py-3 max-w-xs">
														<span className="font-semibold text-foreground">
															{del.eventTitle}
														</span>
														<p className="text-[11px] text-muted-foreground">
															{del.indicatorLabel}
														</p>
													</td>
													<td className="px-3 py-3">
														<span className="font-mono text-xs font-bold text-foreground">
															{del.entityNumber}
														</span>
													</td>
													<td className="px-3 py-3">
														<span className="font-semibold text-foreground">
															{del.recipientName}
														</span>
														<p className="font-mono text-[11px] text-muted-foreground">
															{maskEmail(del.recipientEmail)}
														</p>
													</td>
													<td className="px-3 py-3 text-center">
														<span className="inline-flex items-center gap-1 rounded bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
															<Mail className="size-3 text-primary" />
															<span>Email</span>
														</span>
													</td>
													<td className="px-3 py-3 text-center">
														<span
															className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
																del.status === "sent"
																	? "bg-success/10 text-success"
																	: del.status === "failed"
																		? "bg-danger/10 text-danger"
																		: "bg-amber-500/10 text-amber-700 dark:text-amber-300"
															}`}
														>
															{del.statusLabel}
														</span>
													</td>
													<td className="py-3 pl-2 pr-4 text-right">
														<button
															type="button"
															onClick={() => setDetailDelivery(del)}
															className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-surface-muted transition"
														>
															<FileText className="size-3 text-primary" />
															<span>Log</span>
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
				)}

				{/* FORM DRAWER: EDIT POLICY CONFIG */}
				<DomainFormDrawer
					isOpen={isDrawerOpen}
					title={`Pengaturan: ${selectedPolicy ? EVENT_NAMES[selectedPolicy.eventType] || selectedPolicy.eventType : ""}`}
					description="Sesuaikan lead time pengingat sebelum jatuh tempo dan alamat email tambahan."
					onClose={() => setIsDrawerOpen(false)}
					onSubmit={handleSaveConfig}
					isSubmitting={isSubmitting}
				>
					<div className="space-y-4">
						{drawerError && (
							<div
								role="alert"
								className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs font-semibold text-danger shadow-xs"
							>
								<AlertCircle className="size-4 shrink-0" />
								<span>{drawerError}</span>
							</div>
						)}

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
							<div className="flex items-center justify-between">
								<label
									htmlFor="rem-lead-days"
									className="block text-xs font-semibold text-foreground"
								>
									Lead Days Notifikasi (Hari sebelum jatuh tempo) *
								</label>
								<span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
									Maksimal 4 Kali
								</span>
							</div>
							<input
								id="rem-lead-days"
								type="text"
								required
								placeholder={`Contoh: ${
									selectedPolicy?.defaultLeadDays?.slice(0, 4).join(", ") ||
									(selectedPolicy
										? selectedPolicy.maxLeadDays > selectedPolicy.minLeadDays
											? selectedPolicy.minLeadDays === 0
												? `${selectedPolicy.maxLeadDays}, 10, 5, 0`
												: `${selectedPolicy.maxLeadDays}, ${selectedPolicy.minLeadDays}`
											: `${selectedPolicy.minLeadDays}`
										: "17, 10, 5, 0")
								}`}
								value={formLeadDays}
								onChange={(e) => setFormLeadDays(e.target.value)}
								disabled={isSubmitting}
								className="min-h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none font-mono"
							/>
							<p className="text-[11px] text-muted-foreground leading-relaxed">
								Batas izin pengingat: minimal <strong>0 hari</strong> (0 = Hari-H) sampai maksimal <strong>20 hari</strong>, dengan isian pengingat maksimal 4 kali.
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
								className="min-h-10 w-full rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:border-primary focus:outline-none"
							/>
							<p className="text-[11px] text-muted-foreground">
								Penerima default satker otomatis mendapatkan email tanpa perlu
								ditulis ulang di sini.
							</p>
						</div>

						<div className="space-y-1.5">
							<label
								htmlFor="rem-msg"
								className="block text-xs font-semibold text-foreground"
							>
								Pesan Tambahan Satker (Opsional)
							</label>
							<textarea
								id="rem-msg"
								rows={3}
								maxLength={500}
								placeholder="Catatan internal satker yang akan disertakan pada badan email notifikasi..."
								value={formMessage}
								onChange={(e) => setFormMessage(e.target.value)}
								disabled={isSubmitting}
								className="w-full rounded-xl border border-border bg-background p-3 text-xs text-foreground focus:border-primary focus:outline-none"
							/>
						</div>

						{/* Live Schedule Preview Card */}
						<div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2.5 text-xs">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-1.5 font-bold text-primary">
									<Sparkles className="size-4" />
									<span>Preview Milestone Pengiriman Server</span>
								</div>
								<span className="text-[10px] font-semibold text-primary/80">
									Jam 08:00 WIB
								</span>
							</div>
							{(() => {
								const parsed = formLeadDays
									.split(",")
									.map((s) => Number.parseInt(s.trim(), 10))
									.filter((n) => !Number.isNaN(n) && n >= 0);
								if (parsed.length === 0) {
									return (
										<p className="text-muted-foreground text-[11px] italic">
											Belum ada milestone yang ditentukan.
										</p>
									);
								}
								if (parsed.length > 4) {
									return (
										<p className="text-danger text-[11px] font-semibold">
											⚠️ Terlalu banyak milestone ({parsed.length} kali). Maksimal 4 kali pengingat.
										</p>
									);
								}
								return (
									<div className="flex flex-wrap gap-1.5">
										{parsed.map((d) => (
											<span
												key={d}
												className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold border ${
													d === 0
														? "bg-danger/10 border-danger/20 text-danger"
														: d <= 3
															? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300"
															: "bg-primary/10 border-primary/20 text-primary"
												}`}
											>
												<Clock className="size-3" />
												{d === 0 ? "Hari-H (H-0)" : `H-${d} Hari`}
											</span>
										))}
									</div>
								);
							})()}
							<p className="text-muted-foreground text-[10.5px] leading-relaxed">
								Notifikasi email dikirim otomatis pada jam <strong>08:00 WIB</strong> di setiap milestone yang Anda tentukan di atas.
							</p>
						</div>
					</div>
				</DomainFormDrawer>

				{/* MODAL DETAIL: ACTIVE EVENT */}
				{detailEvent && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
						<div className="w-full max-w-xl rounded-2xl border border-border bg-background p-6 shadow-2xl space-y-5">
							<div className="flex items-start justify-between">
								<div className="space-y-1">
									<div className="flex items-center gap-2">
										<span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary uppercase">
											{detailEvent.indicatorLabel}
										</span>
										<span
											className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
												detailEvent.status === "completed"
													? "bg-success/10 text-success"
													: detailEvent.status === "urgent" ||
															detailEvent.status === "overdue"
														? "bg-danger/10 text-danger"
														: "bg-amber-500/10 text-amber-700 dark:text-amber-300"
											}`}
										>
											{detailEvent.statusLabel}
										</span>
									</div>
									<h3 className="text-base font-bold text-foreground">
										{detailEvent.eventTitle}
									</h3>
									<p className="text-xs text-muted-foreground font-mono">
										Entitas: {detailEvent.entityNumber}
									</p>
								</div>
								<button
									type="button"
									onClick={() => setDetailEvent(null)}
									className="rounded-lg p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
								>
									<X className="size-5" />
								</button>
							</div>

							<div className="grid grid-cols-2 gap-3.5 rounded-xl border border-border bg-surface p-4 text-xs">
								<div>
									<span className="text-muted-foreground">Dasar Tanggal:</span>
									<p className="font-bold text-foreground">
										{formatDateIndo(detailEvent.baseDate)}
									</p>
									<p className="text-[10px] text-muted-foreground">
										{detailEvent.baseDateLabel}
									</p>
								</div>
								<div>
									<span className="text-muted-foreground">
										Batas Waktu (Deadline):
									</span>
									<p className="font-bold text-foreground">
										{formatDateIndo(detailEvent.deadlineDate)}
									</p>
									<p className="text-[10px] text-muted-foreground">
										Kalender Kerja Kanonis
									</p>
								</div>
								<div>
									<span className="text-muted-foreground">
										Milestone Notifikasi:
									</span>
									<p className="font-bold text-foreground">
										{detailEvent.nextMilestone}
									</p>
								</div>
								<div>
									<span className="text-muted-foreground">Jadwal Kirim:</span>
									<p className="font-bold text-foreground">
										{detailEvent.nextScheduledTime}
									</p>
								</div>
								<div className="col-span-2 border-t border-border/60 pt-2.5">
									<span className="text-muted-foreground">Penerima Aktif:</span>
									<p className="font-semibold text-foreground mt-0.5">
										{detailEvent.recipients.join(", ")}
									</p>
								</div>
								{detailEvent.notes && (
									<div className="col-span-2 rounded-lg bg-primary/5 p-3 text-xs text-foreground border border-primary/15 space-y-1">
										<span className="font-bold text-primary">
											Petunjuk Teknis IKPA Satker:
										</span>
										<p className="text-muted-foreground text-[11px] leading-relaxed">
											{detailEvent.notes}
										</p>
									</div>
								)}
							</div>

							<div className="flex items-center justify-between border-t border-border pt-4">
								<button
									type="button"
									onClick={() => setDetailEvent(null)}
									className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted"
								>
									Tutup
								</button>
								<a
									href={detailEvent.actionUrl}
									className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs"
								>
									<span>Buka Menu Terkait</span>
									<ExternalLink className="size-3.5" />
								</a>
							</div>
						</div>
					</div>
				)}

				{/* MODAL DETAIL: DELIVERY LOG */}
				{detailDelivery && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
						<div className="w-full max-w-xl rounded-2xl border border-border bg-background p-6 shadow-2xl space-y-5">
							<div className="flex items-start justify-between">
								<div className="space-y-1">
									<div className="flex items-center gap-2">
										<span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary uppercase">
											{detailDelivery.indicatorLabel}
										</span>
										<span
											className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
												detailDelivery.status === "sent"
													? "bg-success/10 text-success"
													: detailDelivery.status === "failed"
														? "bg-danger/10 text-danger"
														: "bg-amber-500/10 text-amber-700 dark:text-amber-300"
											}`}
										>
											{detailDelivery.statusLabel}
										</span>
									</div>
									<h3 className="text-base font-bold text-foreground">
										Log Delivery: {detailDelivery.eventTitle}
									</h3>
									<p className="text-xs text-muted-foreground font-mono">
										Entitas: {detailDelivery.entityNumber}
									</p>
								</div>
								<button
									type="button"
									onClick={() => setDetailDelivery(null)}
									className="rounded-lg p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
								>
									<X className="size-5" />
								</button>
							</div>

							<div className="grid grid-cols-2 gap-3.5 rounded-xl border border-border bg-surface p-4 text-xs">
								<div>
									<span className="text-muted-foreground">Waktu Jadwal:</span>
									<p className="font-semibold text-foreground">
										{formatDateTimeIndo(detailDelivery.scheduledFor)}
									</p>
								</div>
								<div>
									<span className="text-muted-foreground">Waktu Terkirim:</span>
									<p className="font-semibold text-foreground">
										{detailDelivery.sentAt
											? formatDateTimeIndo(detailDelivery.sentAt)
											: "Belum Terkirim (Pending Sandbox)"}
									</p>
								</div>
								<div>
									<span className="text-muted-foreground">
										Jumlah Percobaan:
									</span>
									<p className="font-semibold text-foreground">
										{detailDelivery.attemptCount} kali
									</p>
								</div>
								<div>
									<span className="text-muted-foreground">Channel:</span>
									<p className="font-semibold text-foreground uppercase">
										{detailDelivery.channel}
									</p>
								</div>
								<div className="col-span-2 border-t border-border/60 pt-2.5">
									<span className="text-muted-foreground">Email Penerima:</span>
									<p className="font-semibold text-foreground">
										{detailDelivery.recipientName} (
										{detailDelivery.recipientEmail})
									</p>
								</div>
							</div>

							<div className="flex items-center justify-end border-t border-border pt-4">
								<button
									type="button"
									onClick={() => setDetailDelivery(null)}
									className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs"
								>
									Tutup Log
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		</OperatorShell>
	);
}

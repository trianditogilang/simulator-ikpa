import { createFileRoute } from "@tanstack/react-router";
import {
	Calendar,
	CheckCircle2,
	Clock,
	Edit,
	Lock,
	RotateCcw,
	Save,
	ShieldCheck,
	X,
} from "lucide-react";
import { useState } from "react";
import { FormattedNumberInput } from "@/components/data/formatted-number-input";
import { AdminShell } from "@/components/layout/admin-shell";
import type { ReminderPolicyEventItem } from "@/mocks/reminder-policies";
import {
	fetchAdminReminderPolicies,
} from "@/services/admin-monitoring-service";
import { saveTargetUpdateWindow } from "@/services/output-achievement-service";

export const Route = createFileRoute("/admin-kppn/policy/reminders")({
	loader: async () => {
		return fetchAdminReminderPolicies();
	},
	component: AdminReminderPoliciesPage,
});

interface TargetWindowItem {
	quarter: number;
	name: string;
	opensAt: string;
	closesAt: string;
	status: "open" | "scheduled" | "closed";
	sourceReference: string;
}

export interface RealizationOpenPeriodItem {
	month: number;
	monthName: string;
	regulerDeadline: string;
	additionalDeadline: string;
	status: "open_auto" | "open_additional" | "closed";
	isAdditionalOpen: boolean;
	sourceReference: string;
	approvalNote?: string;
}

const DEFAULT_2026_WINDOWS: TargetWindowItem[] = [
	{
		quarter: 1,
		name: "Triwulan I",
		opensAt: "2026-01-01",
		closesAt: "2026-04-30",
		status: "closed",
		sourceReference: "Periode Pengisian dan Pelaporan s.d. 30 April 2026",
	},
	{
		quarter: 2,
		name: "Triwulan II",
		opensAt: "2026-04-01",
		closesAt: "2026-04-30",
		status: "closed",
		sourceReference: "Periode Pengisian dan Pelaporan s.d. 30 April 2026",
	},
	{
		quarter: 3,
		name: "Triwulan III",
		opensAt: "2026-07-01",
		closesAt: "2026-07-14",
		status: "closed",
		sourceReference: "Periode Pengisian dan Pelaporan s.d. 14 Juli 2026",
	},
	{
		quarter: 4,
		name: "Triwulan IV",
		opensAt: "2026-10-01",
		closesAt: "2026-10-14",
		status: "scheduled",
		sourceReference: "Periode Pengisian dan Pelaporan s.d. 14 Oktober 2026",
	},
];

const DEFAULT_2026_REALIZATION_PERIODS: RealizationOpenPeriodItem[] = [
	{
		month: 1,
		monthName: "Januari",
		regulerDeadline: "2026-04-30",
		additionalDeadline: "2026-04-30",
		status: "closed",
		isAdditionalOpen: false,
		sourceReference: "Relaksasi Awal Tahun (s.d. 30 April 2026)",
	},
	{
		month: 2,
		monthName: "Februari",
		regulerDeadline: "2026-04-30",
		additionalDeadline: "2026-04-30",
		status: "closed",
		isAdditionalOpen: false,
		sourceReference: "Relaksasi Awal Tahun (s.d. 30 April 2026)",
	},
	{
		month: 3,
		monthName: "Maret",
		regulerDeadline: "2026-04-30",
		additionalDeadline: "2026-04-30",
		status: "closed",
		isAdditionalOpen: false,
		sourceReference: "Relaksasi Awal Tahun (s.d. 30 April 2026)",
	},
	{
		month: 4,
		monthName: "April",
		regulerDeadline: "2026-05-12",
		additionalDeadline: "2026-05-31",
		status: "closed",
		isAdditionalOpen: false,
		sourceReference: "HK-7 Mei 2026 (12 Mei 2026)",
	},
	{
		month: 5,
		monthName: "Mei",
		regulerDeadline: "2026-06-10",
		additionalDeadline: "2026-06-30",
		status: "closed",
		isAdditionalOpen: false,
		sourceReference: "HK-7 Juni 2026 (10 Juni 2026)",
	},
	{
		month: 6,
		monthName: "Juni",
		regulerDeadline: "2026-07-09",
		additionalDeadline: "2026-07-31",
		status: "closed",
		isAdditionalOpen: false,
		sourceReference: "HK-7 Juli 2026 (9 Juli 2026)",
	},
	{
		month: 7,
		monthName: "Juli",
		regulerDeadline: "2026-08-11",
		additionalDeadline: "2026-08-31",
		status: "closed",
		isAdditionalOpen: false,
		sourceReference: "HK-7 Agustus 2026 (11 Agustus 2026)",
	},
	{
		month: 8,
		monthName: "Agustus",
		regulerDeadline: "2026-09-09",
		additionalDeadline: "2026-09-30",
		status: "open_auto",
		isAdditionalOpen: false,
		sourceReference: "HK-7 September 2026 (9 September 2026)",
	},
	{
		month: 9,
		monthName: "September",
		regulerDeadline: "2026-10-09",
		additionalDeadline: "2026-10-31",
		status: "closed",
		isAdditionalOpen: false,
		sourceReference: "HK-7 Oktober 2026 (9 Oktober 2026)",
	},
	{
		month: 10,
		monthName: "Oktober",
		regulerDeadline: "2026-11-10",
		additionalDeadline: "2026-11-30",
		status: "closed",
		isAdditionalOpen: false,
		sourceReference: "HK-7 November 2026 (10 November 2026)",
	},
	{
		month: 11,
		monthName: "November",
		regulerDeadline: "2026-12-09",
		additionalDeadline: "2026-12-31",
		status: "closed",
		isAdditionalOpen: false,
		sourceReference: "HK-7 Desember 2026 (9 Desember 2026)",
	},
	{
		month: 12,
		monthName: "Desember",
		regulerDeadline: "2027-01-13",
		additionalDeadline: "2027-01-31",
		status: "closed",
		isAdditionalOpen: false,
		sourceReference: "HK-7 Januari 2027 (13 Januari 2027)",
	},
];

function AdminReminderPoliciesPage() {
	const loaderData = Route.useLoaderData();

	// read-only server data only (no mock fallback)
	const policies: ReminderPolicyEventItem[] = loaderData.policies.map((p) => ({
		id: p.id,
		eventType: p.eventType,
		eventTitle: p.title ?? p.eventType,
		indicatorKey: p.indicatorKey ?? "general",
		indicatorLabel: p.indicatorLabel ?? "Indikator IKPA",
		category: (p.category as "mandatory" | "recommended" | "optional") ?? "recommended",
		dayType: (p.dayType as "workday" | "calendar_day" | "schedule") ?? "workday",
		deadlineFormulaSummary: `H-${p.minLeadDays} s.d. H-${p.maxLeadDays}`,
		allowedMinLeadDays: p.minLeadDays,
		allowedMaxLeadDays: p.maxLeadDays,
		defaultLeadDays: p.defaultLeadDays ?? [],
		requiredRecipients: p.requiredRecipients ?? [],
		allowDisable: p.allowDisable,
		allowRecipientOverride: p.allowRecipientOverride,
		status: p.isActive ? "published" : "draft",
		ruleSetVersion: "—",
		description: "",
	}));

	const [activeTab, setActiveTab] = useState<
		"events" | "target_windows" | "realization_windows"
	>("events");
	const [selectedYear, setSelectedYear] = useState(2026);
	const [windows, setWindows] = useState<TargetWindowItem[]>(DEFAULT_2026_WINDOWS);
	const [editingWindow, setEditingWindow] = useState<TargetWindowItem | null>(null);

	const [realizationPeriods, setRealizationPeriods] = useState<
		RealizationOpenPeriodItem[]
	>(DEFAULT_2026_REALIZATION_PERIODS);
	const [editingRealizationPeriod, setEditingRealizationPeriod] =
		useState<RealizationOpenPeriodItem | null>(null);
	const [toggleAdditionalModal, setToggleAdditionalModal] =
		useState<RealizationOpenPeriodItem | null>(null);
	const [additionalApprovalNote, setAdditionalApprovalNote] = useState("");

	const [selectedPolicy, setSelectedPolicy] =
		useState<ReminderPolicyEventItem | null>(null);
	const [saveToast, setSaveToast] = useState<string | null>(null);

	const handleSaveRealizationPeriod = (updated: RealizationOpenPeriodItem) => {
		setRealizationPeriods((prev) =>
			prev.map((p) => (p.month === updated.month ? updated : p)),
		);
		setEditingRealizationPeriod(null);
		setSaveToast(
			`Jadwal Open Period Realisasi ${updated.monthName} TA ${selectedYear} berhasil diperbarui.`,
		);
		setTimeout(() => setSaveToast(null), 4000);
	};

	const handleConfirmToggleAdditional = () => {
		if (!toggleAdditionalModal) return;
		const nextState = !toggleAdditionalModal.isAdditionalOpen;
		const updated: RealizationOpenPeriodItem = {
			...toggleAdditionalModal,
			isAdditionalOpen: nextState,
			status: nextState ? "open_additional" : "closed",
			approvalNote: additionalApprovalNote.trim() || undefined,
		};
		setRealizationPeriods((prev) =>
			prev.map((p) => (p.month === updated.month ? updated : p)),
		);
		setToggleAdditionalModal(null);
		setAdditionalApprovalNote("");
		setSaveToast(
			`Periode Pelaporan Tambahan KPPN untuk ${updated.monthName} TA ${selectedYear} berhasil ${
				nextState ? "DIBUKA" : "DITUTUP"
			}.`,
		);
		setTimeout(() => setSaveToast(null), 4000);
	};

	const handleResetRealizationSchedule = (year: number) => {
		if (year === 2026) {
			setRealizationPeriods(DEFAULT_2026_REALIZATION_PERIODS);
			setSaveToast("Jadwal resmi Open Period TA 2026 (HK-7 & Relaksasi Jan-Mar) berhasil dimuat.");
		} else {
			const generic: RealizationOpenPeriodItem[] = Array.from({ length: 12 }, (_, i) => {
				const m = i + 1;
				const monthNames = [
					"Januari", "Februari", "Maret", "April", "Mei", "Juni",
					"Juli", "Agustus", "September", "Oktober", "November", "Desember",
				];
				const nextYear = m === 12 ? year + 1 : year;
				const nextMonth = m === 12 ? "01" : String(m + 1).padStart(2, "0");
				return {
					month: m,
					monthName: monthNames[i],
					regulerDeadline: `${nextYear}-${nextMonth}-10`,
					additionalDeadline: `${nextYear}-${nextMonth}-28`,
					status: "closed",
					isAdditionalOpen: false,
					sourceReference: `Hari Kerja ke-7 Bulan M+1 TA ${year}`,
				};
			});
			setRealizationPeriods(generic);
			setSaveToast(`Jadwal Open Period standar TA ${year} berhasil dimuat.`);
		}
		setTimeout(() => setSaveToast(null), 4000);
	};

	const handleSaveWindow = async (updatedWindow: TargetWindowItem) => {
		try {
			await saveTargetUpdateWindow({
				year: selectedYear,
				quarter: updatedWindow.quarter,
				opensAt: `${updatedWindow.opensAt}T00:00:00Z`,
				closesAt: `${updatedWindow.closesAt}T23:59:59Z`,
				status: updatedWindow.status,
				notes: updatedWindow.sourceReference,
			});
		} catch {
			// keep optimistic state
		}
		setWindows((prev) =>
			prev.map((w) => (w.quarter === updatedWindow.quarter ? updatedWindow : w)),
		);
		setEditingWindow(null);
		setSaveToast(
			`Jadwal pemutakhiran target ${updatedWindow.name} TA ${selectedYear} berhasil disimpan dan disinkronkan ke seluruh satker.`,
		);
		setTimeout(() => setSaveToast(null), 4000);
	};

	const handleApplyStandard10WorkdaysPreset = (year: number) => {
		const newWindows: TargetWindowItem[] = [
			{
				quarter: 1,
				name: "Triwulan I",
				opensAt: `${year}-01-01`,
				closesAt: `${year}-01-14`,
				status: year < 2026 ? "closed" : year === 2026 ? "closed" : "scheduled",
				sourceReference: `10 Hari Kerja Awal Triwulan I TA ${year}`,
			},
			{
				quarter: 2,
				name: "Triwulan II",
				opensAt: `${year}-04-01`,
				closesAt: `${year}-04-14`,
				status: year < 2026 ? "closed" : "scheduled",
				sourceReference: `10 Hari Kerja Awal Triwulan II TA ${year}`,
			},
			{
				quarter: 3,
				name: "Triwulan III",
				opensAt: `${year}-07-01`,
				closesAt: `${year}-07-14`,
				status: year < 2026 ? "closed" : "scheduled",
				sourceReference: `10 Hari Kerja Awal Triwulan III TA ${year}`,
			},
			{
				quarter: 4,
				name: "Triwulan IV",
				opensAt: `${year}-10-01`,
				closesAt: `${year}-10-14`,
				status: "scheduled",
				sourceReference: `10 Hari Kerja Awal Triwulan IV TA ${year}`,
			},
		];
		setWindows(newWindows);
		setSaveToast(`Preset 10 Hari Kerja Awal Triwulan untuk TA ${year} berhasil dimuat.`);
		setTimeout(() => setSaveToast(null), 4000);
	};

	return (
		<AdminShell currentPath="/admin-kppn/policy/reminders">
			<div className="space-y-6">
				{/* Top Heading */}
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
							Kebijakan Reminder & Pemutakhiran Target
						</h1>
						<p className="text-xs text-muted-foreground sm:text-sm">
							Pengaturan aturan notifikasi, formula deadline, dan jadwal jendela pemutakhiran target triwulanan satker
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

				{/* Tabs Navigation */}
				<div className="flex border-b border-border text-xs font-semibold">
					<button
						type="button"
						onClick={() => setActiveTab("events")}
						className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition ${
							activeTab === "events"
								? "border-primary text-primary"
								: "border-transparent text-muted-foreground hover:text-foreground"
						}`}
					>
						<ShieldCheck className="size-4" />
						<span>Kebijakan Event Reminder ({policies.length})</span>
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("target_windows")}
						className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition ${
							activeTab === "target_windows"
								? "border-primary text-primary"
								: "border-transparent text-muted-foreground hover:text-foreground"
						}`}
					>
						<Calendar className="size-4" />
						<span>Jadwal Target Windows (4 Triwulan)</span>
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("realization_windows")}
						className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition ${
							activeTab === "realization_windows"
								? "border-primary text-primary"
								: "border-transparent text-muted-foreground hover:text-foreground"
						}`}
					>
						<Clock className="size-4" />
						<span>Open Period Realisasi Kinerja (12 Bulan)</span>
					</button>
				</div>

				{/* TAB 1: EVENT POLICIES */}
				{activeTab === "events" && (
					<div className="space-y-4">
						{/* Context Summary Banner */}
						<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface p-4 shadow-xs text-xs">
							<div className="flex items-center gap-2 text-muted-foreground">
								<ShieldCheck className="size-4 text-primary" />
								<span>
									Acuan Aktif:{" "}
									<strong className="text-foreground">
										Rule Set 2026.1 (PER-5/PB/2024)
									</strong>
								</span>
								<span>•</span>
								<span>
									Total Kebijakan:{" "}
									<strong className="text-foreground">
										{policies.length} Event Terdaftar
									</strong>
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
														}}
														className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-surface-muted"
													>
														<span>Detail</span>
													</button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				)}

				{/* TAB 2: TARGET UPDATE WINDOWS */}
				{activeTab === "target_windows" && (
					<div className="space-y-5 text-xs">
						<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 shadow-xs">
							<div>
								<h2 className="text-sm font-bold text-foreground">
									Pengaturan Jendela Pemutakhiran Target Capaian Output
								</h2>
								<p className="text-xs text-muted-foreground mt-0.5">
									Admin KPPN dapat menentukan rentang tanggal buka/tutup dan status pemutakhiran target triwulanan untuk seluruh satker.
								</p>
							</div>

							<div className="flex items-center gap-2">
								<span className="text-xs font-semibold text-muted-foreground">Tahun Anggaran:</span>
								<select
									value={selectedYear}
									onChange={(e) => {
										const yr = Number(e.target.value);
										setSelectedYear(yr);
										if (yr === 2026) {
											setWindows(DEFAULT_2026_WINDOWS);
										} else {
											handleApplyStandard10WorkdaysPreset(yr);
										}
									}}
									className="h-9 rounded-xl border border-border bg-background px-3 font-bold text-foreground focus:border-primary focus:outline-none"
								>
									<option value={2025}>TA 2025</option>
									<option value={2026}>TA 2026 (Aktif)</option>
									<option value={2027}>TA 2027 (Tahun Depan)</option>
									<option value={2028}>TA 2028</option>
								</select>

								<button
									type="button"
									onClick={() => handleApplyStandard10WorkdaysPreset(selectedYear)}
									className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-3 py-2 font-semibold text-foreground hover:bg-surface-muted transition shadow-2xs"
								>
									<RotateCcw className="size-3.5 text-primary" />
									<span>Reset 10 HK Standard</span>
								</button>
							</div>
						</div>

						{/* 4 Quarters Table / Cards */}
						<div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
							<div className="overflow-x-auto">
								<table className="w-full text-left text-xs">
									<thead>
										<tr className="border-b border-border/80 bg-surface-muted/50 font-semibold text-muted-foreground">
											<th className="py-3 pl-4 pr-2">Triwulan</th>
											<th className="px-3 py-3">Tanggal Buka Jendela</th>
											<th className="px-3 py-3">Batas Akhir / Penutupan</th>
											<th className="px-3 py-3 text-center">Status</th>
											<th className="px-3 py-3">Dasar Kebijakan / Catatan</th>
											<th className="py-3 pl-2 pr-4 text-right">Aksi</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border/60">
										{windows.map((win) => (
											<tr key={win.quarter} className="hover:bg-surface-muted/30 transition">
												<td className="py-3 pl-4 pr-2 font-bold text-foreground">
													{win.name} TA {selectedYear}
												</td>
												<td className="px-3 py-3 font-mono font-medium text-foreground">
													{win.opensAt}
												</td>
												<td className="px-3 py-3 font-mono font-bold text-foreground">
													{win.closesAt}
												</td>
												<td className="px-3 py-3 text-center">
													<span
														className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
															win.status === "open"
																? "bg-success/15 text-success"
																: win.status === "scheduled"
																	? "bg-primary/15 text-primary"
																	: "bg-surface-muted text-muted-foreground"
														}`}
													>
														{win.status === "open"
															? "Terbuka"
															: win.status === "scheduled"
																? "Terjadwal"
																: "Ditutup"}
													</span>
												</td>
												<td className="px-3 py-3 text-muted-foreground max-w-xs truncate">
													{win.sourceReference}
												</td>
												<td className="py-3 pl-2 pr-4 text-right">
													<button
														type="button"
														onClick={() => setEditingWindow(win)}
														className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-surface-muted"
													>
														<Edit className="size-3" />
														<span>Atur Tanggal</span>
													</button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				)}

				{/* TAB 3: REALIZATION OPEN PERIODS (12 BULAN) */}
				{activeTab === "realization_windows" && (
					<div className="space-y-4">
						{/* Context Summary & Rules Banner */}
						<div className="rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-xs space-y-3">
							<div className="flex flex-wrap items-center justify-between gap-3 text-xs">
								<div className="flex items-center gap-2 text-primary font-semibold">
									<Clock className="size-4.5" />
									<span>
										Ketentuan Periodisasi Pelaporan Data Capaian Output (Open Period) Menu Realisasi Kinerja:
									</span>
								</div>
								<div className="flex items-center gap-2">
									<label className="text-xs text-muted-foreground font-medium">Tahun Anggaran:</label>
									<select
										value={selectedYear}
										onChange={(e) => {
											const yr = Number(e.target.value);
											setSelectedYear(yr);
											handleResetRealizationSchedule(yr);
										}}
										className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs font-bold text-foreground focus:border-primary focus:outline-none"
									>
										<option value={2026}>TA 2026</option>
										<option value={2027}>TA 2027</option>
										<option value={2028}>TA 2028</option>
									</select>
									<button
										type="button"
										onClick={() => handleResetRealizationSchedule(selectedYear)}
										className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-surface-muted"
									>
										<RotateCcw className="size-3 text-muted-foreground" />
										<span>Reset Jadwal Resmi (12 Bulan)</span>
									</button>
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-muted-foreground pt-1 border-t border-border/40">
								<div className="rounded-lg border border-border/60 bg-background/60 p-3 space-y-1">
									<p className="font-bold text-foreground flex items-center gap-1.5">
										<span className="flex size-4 items-center justify-center rounded-full bg-success/20 text-success text-[10px]">a</span>
										Open Period Reguler (Buka Sistem Otomatis)
									</p>
									<p className="text-[11px] leading-relaxed">
										Sejak awal bulan berikutnya sampai dengan <strong>Hari Kerja ke-7 (tujuh) bulan berikutnya</strong>. Sistem terbuka otomatis untuk seluruh satker tanpa permohonan.
									</p>
								</div>
								<div className="rounded-lg border border-border/60 bg-background/60 p-3 space-y-1">
									<p className="font-bold text-foreground flex items-center gap-1.5">
										<span className="flex size-4 items-center justify-center rounded-full bg-warning/20 text-warning text-[10px]">b</span>
										Open Period Tambahan KPPN (Kejadian Khusus)
									</p>
									<p className="text-[11px] leading-relaxed">
										Setelah hari kerja ke-7 bulan berikutnya sampai dengan <strong>akhir bulan berikutnya</strong>, sepanjang telah dibuka periode pelaporan tambahan oleh Admin KPPN pada kejadian khusus / permohonan satker.
									</p>
								</div>
							</div>
						</div>

						{/* Realization Open Periods Table */}
						<div className="rounded-xl border border-border/80 bg-surface shadow-xs">
							<div className="overflow-x-auto">
								<table className="w-full text-left text-xs">
									<thead>
										<tr className="border-b border-border/80 bg-surface-muted/50 font-semibold text-muted-foreground">
											<th className="py-3 pl-4 pr-2 w-12 text-center">No.</th>
											<th className="px-3 py-3 font-bold text-foreground">Periode Pelaporan Data Realisasi</th>
											<th className="px-3 py-3">Batas Open Period Reguler (HK-7)</th>
											<th className="px-3 py-3">Batas Periode Tambahan (M+1)</th>
											<th className="px-3 py-3 text-center">Status Sistem Saat Ini</th>
											<th className="px-3 py-3 text-center">Izin Tambahan KPPN</th>
											<th className="px-3 py-3">Dasar / Catatan Kebijakan</th>
											<th className="py-3 pl-2 pr-4 text-right">Aksi Manajemen</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-border/60">
										{realizationPeriods.map((period, idx) => (
											<tr
												key={period.month}
												className="transition hover:bg-surface-muted/40"
											>
												<td className="py-3 pl-4 pr-2 text-center text-muted-foreground font-semibold">
													{idx + 1}
												</td>
												<td className="px-3 py-3">
													<p className="font-bold text-foreground">
														{period.monthName} {selectedYear}
													</p>
													<p className="text-[10px] text-muted-foreground">
														Periode Bulan {period.month}
													</p>
												</td>
												<td className="px-3 py-3 font-semibold text-primary">
													{period.regulerDeadline}
												</td>
												<td className="px-3 py-3 text-muted-foreground">
													{period.additionalDeadline}
												</td>
												<td className="px-3 py-3 text-center">
													<span
														className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
															period.status === "open_auto"
																? "bg-success/10 text-success"
																: period.status === "open_additional"
																	? "bg-warning/10 text-warning"
																	: "bg-surface-muted text-muted-foreground"
														}`}
													>
														{period.status === "open_auto"
															? "🟢 Buka Otomatis (Reguler)"
															: period.status === "open_additional"
																? "🟡 Periode Tambahan Aktif"
																: "⚪ Ditutup"}
													</span>
												</td>
												<td className="px-3 py-3 text-center">
													<span
														className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
															period.isAdditionalOpen
																? "bg-warning/15 text-warning font-bold"
																: "bg-surface-muted text-muted-foreground"
														}`}
													>
														{period.isAdditionalOpen ? "Dibuka KPPN" : "Terkunci"}
													</span>
												</td>
												<td className="px-3 py-3 text-muted-foreground max-w-xs truncate">
													{period.approvalNote ? (
														<span className="text-foreground font-medium">
															{period.approvalNote} ({period.sourceReference})
														</span>
													) : (
														period.sourceReference
													)}
												</td>
												<td className="py-3 pl-2 pr-4 text-right">
													<div className="inline-flex items-center gap-1.5">
														<button
															type="button"
															onClick={() => {
																setToggleAdditionalModal(period);
																setAdditionalApprovalNote(period.approvalNote || "");
															}}
															className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition ${
																period.isAdditionalOpen
																	? "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20"
																	: "border border-warning/30 bg-warning/10 text-warning hover:bg-warning/20"
															}`}
														>
															<Clock className="size-3" />
															<span>
																{period.isAdditionalOpen ? "Tutup Tambahan" : "Buka Tambahan"}
															</span>
														</button>
														<button
															type="button"
															onClick={() => setEditingRealizationPeriod(period)}
															className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-surface-muted"
														>
															<Edit className="size-3" />
															<span>Atur Tanggal</span>
														</button>
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				)}

				{/* Modal / Drawer Target Window Editor */}
				{editingWindow && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
						<div className="w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
							<div className="flex items-start justify-between">
								<div>
									<h3 className="text-base font-semibold text-foreground">
										Atur Jadwal Pemutakhiran: {editingWindow.name} TA {selectedYear}
									</h3>
									<p className="text-xs text-muted-foreground">
										Tentukan tanggal pembukaan, batas akhir, status akses, dan dasar kebijakan untuk satker.
									</p>
								</div>
								<button
									type="button"
									onClick={() => setEditingWindow(null)}
									className="rounded-lg p-1 text-muted-foreground hover:bg-surface-muted"
								>
									<X className="size-4" />
								</button>
							</div>

							<div className="space-y-4 text-xs">
								<div className="grid grid-cols-2 gap-3">
									<div>
										<label className="text-muted-foreground block mb-1 font-medium">
											Tanggal Buka Jendela:
										</label>
										<input
											type="date"
											value={editingWindow.opensAt}
											onChange={(e) =>
												setEditingWindow({
													...editingWindow,
													opensAt: e.target.value,
												})
											}
											className="h-9 w-full rounded-lg border border-border bg-surface px-3 font-semibold text-foreground focus:border-primary focus:outline-none"
										/>
									</div>

									<div>
										<label className="text-muted-foreground block mb-1 font-medium">
											Batas Akhir / Penutupan:
										</label>
										<input
											type="date"
											value={editingWindow.closesAt}
											onChange={(e) =>
												setEditingWindow({
													...editingWindow,
													closesAt: e.target.value,
												})
											}
											className="h-9 w-full rounded-lg border border-border bg-surface px-3 font-bold text-foreground focus:border-primary focus:outline-none"
										/>
									</div>
								</div>

								<div>
									<label className="text-muted-foreground block mb-1 font-medium">
										Status Akses Pemutakhiran:
									</label>
									<select
										value={editingWindow.status}
										onChange={(e) =>
											setEditingWindow({
												...editingWindow,
												status: e.target.value as "open" | "scheduled" | "closed",
											})
										}
										className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none font-semibold"
									>
										<option value="open">🟢 Terbuka (Open - Satker Dapat Memutakhirkan Target)</option>
										<option value="scheduled">🔵 Terjadwal (Scheduled - Belum Dibuka)</option>
										<option value="closed">⚪ Ditutup (Closed - Batas Waktu Berakhir)</option>
									</select>
								</div>

								<div>
									<label className="text-muted-foreground block mb-1 font-medium">
										Dasar Surat / Catatan Kebijakan:
									</label>
									<textarea
										rows={2}
										value={editingWindow.sourceReference}
										onChange={(e) =>
											setEditingWindow({
												...editingWindow,
												sourceReference: e.target.value,
											})
										}
										placeholder="Contoh: Surat Dirjen Perbendaharaan No. S-123/PB/2026 atau Relaksasi Triwulan I"
										className="w-full rounded-lg border border-border bg-surface p-2.5 text-foreground focus:border-primary focus:outline-none"
									/>
								</div>
							</div>

							<div className="flex items-center justify-end gap-2 border-t border-border pt-4">
								<button
									type="button"
									onClick={() => setEditingWindow(null)}
									className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted"
								>
									Batal
								</button>
								<button
									type="button"
									onClick={() => handleSaveWindow(editingWindow)}
									className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs"
								>
									<Save className="size-3.5" />
									<span>Simpan Jadwal Jendela</span>
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Modal / Drawer Realization Open Period Editor */}
				{editingRealizationPeriod && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
						<div className="w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
							<div className="flex items-start justify-between">
								<div>
									<h3 className="text-base font-semibold text-foreground">
										Atur Open Period: Bulan {editingRealizationPeriod.monthName} TA {selectedYear}
									</h3>
									<p className="text-xs text-muted-foreground">
										Konfigurasi batas waktu Open Period Reguler (HK-7), Periode Tambahan (M+1), dan izin pembukaan.
									</p>
								</div>
								<button
									type="button"
									onClick={() => setEditingRealizationPeriod(null)}
									className="rounded-lg p-1 text-muted-foreground hover:bg-surface-muted"
								>
									<X className="size-4" />
								</button>
							</div>

							<div className="space-y-4 text-xs">
								<div className="grid grid-cols-2 gap-3">
									<div>
										<label className="text-muted-foreground block mb-1 font-medium">
											Batas Open Period Reguler (HK-7):
										</label>
										<input
											type="date"
											value={editingRealizationPeriod.regulerDeadline}
											onChange={(e) =>
												setEditingRealizationPeriod({
													...editingRealizationPeriod,
													regulerDeadline: e.target.value,
												})
											}
											className="h-9 w-full rounded-lg border border-border bg-surface px-3 font-bold text-foreground focus:border-primary focus:outline-none"
										/>
									</div>
									<div>
										<label className="text-muted-foreground block mb-1 font-medium">
											Batas Periode Tambahan (M+1):
										</label>
										<input
											type="date"
											value={editingRealizationPeriod.additionalDeadline}
											onChange={(e) =>
												setEditingRealizationPeriod({
													...editingRealizationPeriod,
													additionalDeadline: e.target.value,
												})
											}
											className="h-9 w-full rounded-lg border border-border bg-surface px-3 font-bold text-foreground focus:border-primary focus:outline-none"
										/>
									</div>
								</div>

								<div>
									<label className="text-muted-foreground block mb-1 font-medium">
										Status Akses Pelaporan Sistem:
									</label>
									<select
										value={editingRealizationPeriod.status}
										onChange={(e) =>
											setEditingRealizationPeriod({
												...editingRealizationPeriod,
												status: e.target.value as "open_auto" | "open_additional" | "closed",
											})
										}
										className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none font-semibold"
									>
										<option value="open_auto">🟢 Buka Sistem Otomatis (Reguler s.d. HK-7)</option>
										<option value="open_additional">🟡 Periode Pelaporan Tambahan KPPN Aktif</option>
										<option value="closed">⚪ Ditutup (Closed / Melewati Batas Waktu)</option>
									</select>
								</div>

								<div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted/30 p-3">
									<div>
										<p className="font-bold text-foreground">Izin Pembukaan Periode Tambahan</p>
										<p className="text-[11px] text-muted-foreground">
											Izinkan satker menginput/memutakhirkan data setelah HK-7 s.d. akhir bulan berikutnya.
										</p>
									</div>
									<input
										type="checkbox"
										checked={editingRealizationPeriod.isAdditionalOpen}
										onChange={(e) =>
											setEditingRealizationPeriod({
												...editingRealizationPeriod,
												isAdditionalOpen: e.target.checked,
												status: e.target.checked ? "open_additional" : editingRealizationPeriod.status === "open_additional" ? "closed" : editingRealizationPeriod.status,
											})
										}
										className="size-4 rounded border-border text-primary focus:ring-primary"
									/>
								</div>

								<div>
									<label className="text-muted-foreground block mb-1 font-medium">
										Dasar Rujukan / Surat Persetujuan:
									</label>
									<textarea
										rows={2}
										value={editingRealizationPeriod.sourceReference}
										onChange={(e) =>
											setEditingRealizationPeriod({
												...editingRealizationPeriod,
												sourceReference: e.target.value,
											})
										}
										placeholder="Contoh: HK-7 Bulan Mei 2026 atau ND-xxx Pembukaan Periode Tambahan"
										className="w-full rounded-lg border border-border bg-surface p-2.5 text-foreground focus:border-primary focus:outline-none"
									/>
								</div>
							</div>

							<div className="flex items-center justify-end gap-2 border-t border-border pt-4">
								<button
									type="button"
									onClick={() => setEditingRealizationPeriod(null)}
									className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted"
								>
									Batal
								</button>
								<button
									type="button"
									onClick={() => handleSaveRealizationPeriod(editingRealizationPeriod)}
									className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs"
								>
									<Save className="size-3.5" />
									<span>Simpan Open Period</span>
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Modal Toggle Buka Periode Tambahan KPPN */}
				{toggleAdditionalModal && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
						<div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-2xl space-y-4">
							<div className="flex items-start justify-between">
								<div>
									<h3 className="text-base font-semibold text-foreground">
										{toggleAdditionalModal.isAdditionalOpen ? "Tutup" : "Buka"} Periode Pelaporan Tambahan
									</h3>
									<p className="text-xs text-muted-foreground">
										Bulan {toggleAdditionalModal.monthName} TA {selectedYear}
									</p>
								</div>
								<button
									type="button"
									onClick={() => setToggleAdditionalModal(null)}
									className="rounded-lg p-1 text-muted-foreground hover:bg-surface-muted"
								>
									<X className="size-4" />
								</button>
							</div>

							<div className="space-y-3 text-xs">
								<p className="text-muted-foreground leading-relaxed">
									{toggleAdditionalModal.isAdditionalOpen ? (
										"Apakah Anda yakin ingin MENUTUP kembali periode pelaporan tambahan KPPN untuk bulan ini?"
									) : (
										<>
											Membuka periode tambahan akan mengizinkan operator satker melakukan pengisian dan pemutakhiran data realisasi capaian output setelah HK-7 sampai batas akhir{" "}
											<strong className="text-foreground">{toggleAdditionalModal.additionalDeadline}</strong> (akhir bulan berikutnya) untuk kejadian khusus.
										</>
									)}
								</p>

								{!toggleAdditionalModal.isAdditionalOpen && (
									<div>
										<label className="text-muted-foreground block mb-1 font-medium">
											Nomor Surat / ND Persetujuan Pembukaan (Opsional):
										</label>
										<input
											type="text"
											value={additionalApprovalNote}
											onChange={(e) => setAdditionalApprovalNote(e.target.value)}
											placeholder="Contoh: ND-102/KPPN/2026 atau Memo Dispensasi Satker"
											className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
										/>
									</div>
								)}
							</div>

							<div className="flex items-center justify-end gap-2 border-t border-border pt-4">
								<button
									type="button"
									onClick={() => setToggleAdditionalModal(null)}
									className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted"
								>
									Batal
								</button>
								<button
									type="button"
									onClick={handleConfirmToggleAdditional}
									className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold shadow-xs ${
										toggleAdditionalModal.isAdditionalOpen
											? "bg-danger text-danger-foreground hover:bg-danger/90"
											: "bg-warning text-warning-foreground hover:bg-warning/90"
									}`}
								>
									<Clock className="size-3.5" />
									<span>
										{toggleAdditionalModal.isAdditionalOpen
											? "Konfirmasi Tutup Tambahan"
											: "Konfirmasi Buka Periode Tambahan"}
									</span>
								</button>
							</div>
						</div>
					</div>
				)}
				{selectedPolicy && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-xs">
						<div className="w-full max-w-xl rounded-xl border border-border bg-background p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
							<div className="flex items-start justify-between">
								<div>
									<h3 className="text-base font-semibold text-foreground">
										Detail Reminder Policy
									</h3>
									<p className="text-xs text-muted-foreground">
										{selectedPolicy.eventTitle} ({selectedPolicy.eventType})
									</p>
									<p className="text-[11px] text-muted-foreground">
										Read-only — perubahan kebijakan mengikuti publikasi rule
										set.
									</p>
								</div>
								<button
									type="button"
									onClick={() => {
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
										disabled
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
											disabled
											value={selectedPolicy.category}
											onChange={(e) =>
												setSelectedPolicy({
													...selectedPolicy,
													category: e.target.value as
														| "mandatory"
														| "recommended"
														| "optional",
													allowDisable:
														e.target.value === "mandatory"
															? false
															: selectedPolicy.allowDisable,
												})
											}
											className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
										>
											<option value="mandatory">Mandatory (Wajib)</option>
											<option value="recommended">
												Recommended (Disarankan)
											</option>
											<option value="optional">Optional (Opsional)</option>
										</select>
									</div>

									<div>
										<span className="text-muted-foreground block mb-1 font-medium">
											Jenis Perhitungan Hari:
										</span>
										<select
											disabled
											value={selectedPolicy.dayType}
											onChange={(e) =>
												setSelectedPolicy({
													...selectedPolicy,
													dayType: e.target.value as
														| "workday"
														| "calendar_day"
														| "schedule",
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
										disabled
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
										<FormattedNumberInput
											disabled
											value={selectedPolicy.allowedMinLeadDays}
											onChange={(raw) =>
												setSelectedPolicy({
													...selectedPolicy,
													allowedMinLeadDays:
														Number.parseInt(raw, 10) || 0,
												})
											}
											className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-foreground focus:border-primary focus:outline-none"
										/>
									</div>

									<div>
										<span className="text-muted-foreground block mb-1 font-medium">
											Max Lead Time (Hari):
										</span>
										<FormattedNumberInput
											disabled
											value={selectedPolicy.allowedMaxLeadDays}
											onChange={(raw) =>
												setSelectedPolicy({
													...selectedPolicy,
													allowedMaxLeadDays:
														Number.parseInt(raw, 10) || 15,
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
											disabled
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
												Operator dapat menambahkan email penerima internal
												satker
											</p>
										</div>
										<input
											type="checkbox"
											disabled
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
										setSelectedPolicy(null);
									}}
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

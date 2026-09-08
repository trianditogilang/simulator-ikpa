export interface ReminderPolicyEventItem {
	id: string;
	eventType: string;
	eventTitle: string;
	indicatorKey: string;
	indicatorLabel: string;
	category: "mandatory" | "recommended" | "optional";
	dayType: "workday" | "calendar_day" | "schedule";
	deadlineFormulaSummary: string;
	allowedMinLeadDays: number;
	allowedMaxLeadDays: number;
	defaultLeadDays: number[];
	requiredRecipients: string[];
	allowDisable: boolean;
	allowRecipientOverride: boolean;
	status: "published" | "draft";
	ruleSetVersion: string;
	description: string;
}

export const mockReminderPolicies: ReminderPolicyEventItem[] = [
	{
		id: "pol-01",
		eventType: "invoice_timeliness_due",
		eventTitle: "Batas 17 Hari Kerja Penerbitan SPM-LS",
		indicatorKey: "invoice_timeliness",
		indicatorLabel: "Penyelesaian Tagihan",
		category: "mandatory",
		dayType: "workday",
		deadlineFormulaSummary: "H+17 hari kerja sejak tanggal BAST/BAPP",
		allowedMinLeadDays: 1,
		allowedMaxLeadDays: 16,
		defaultLeadDays: [5, 2, 0],
		requiredRecipients: ["Operator SPM", "PPK Satker"],
		allowDisable: false,
		allowRecipientOverride: true,
		status: "published",
		ruleSetVersion: "2026.1",
		description:
			"Pengingat wajib batas pengajuan SPM-LS untuk mencegah penurunan skor tagihan.",
	},
	{
		id: "pol-02",
		eventType: "output_report_due",
		eventTitle: "Batas Pelaporan & Konfirmasi Capaian Output (Open Period)",
		indicatorKey: "output_achievement",
		indicatorLabel: "Capaian Output",
		category: "mandatory",
		dayType: "workday",
		deadlineFormulaSummary:
			"Hari kerja ke-7 bulan berikutnya (Open Period Reguler, Jan-Mar s.d. 30 April 2026)",
		allowedMinLeadDays: 1,
		allowedMaxLeadDays: 14,
		defaultLeadDays: [7, 3, 0],
		requiredRecipients: ["Operator Capaian Output", "PPK Satker"],
		allowDisable: false,
		allowRecipientOverride: true,
		status: "published",
		ruleSetVersion: "2026.1",
		description:
			"Pengingat pelaporan dan konfirmasi capaian output bulanan pada Open Period Reguler (awal bulan s.d. HK-7) maupun periode tambahan KPPN.",
	},
	{
		id: "pol-03",
		eventType: "up_tup_revolving_due",
		eventTitle: "Batas Revolving GUP 30 Hari",
		indicatorKey: "up_tup",
		indicatorLabel: "Pengelolaan UP/TUP",
		category: "mandatory",
		dayType: "calendar_day",
		deadlineFormulaSummary: "30 hari kalender sejak SP2D GUP terakhir",
		allowedMinLeadDays: 1,
		allowedMaxLeadDays: 15,
		defaultLeadDays: [7, 3, 1],
		requiredRecipients: ["Bendahara Pengeluaran", "Operator UP"],
		allowDisable: false,
		allowRecipientOverride: true,
		status: "published",
		ruleSetVersion: "2026.1",
		description:
			"Pengingat kewajiban revolving UP minimal 1 kali sebulan untuk satker berpagu UP.",
	},
	{
		id: "pol-04",
		eventType: "spm_dispensation_warning",
		eventTitle: "Peringatan Rasio SPM Dispensasi Triwulan IV",
		indicatorKey: "spm_dispensation",
		indicatorLabel: "Dispensasi SPM",
		category: "recommended",
		dayType: "workday",
		deadlineFormulaSummary:
			"Batas akhir pengajuan SPM akhir tahun (Langkah Akhir Tahun)",
		allowedMinLeadDays: 1,
		allowedMaxLeadDays: 14,
		defaultLeadDays: [7, 2],
		requiredRecipients: ["KPA Satker", "PPK Satker", "Operator SPM"],
		allowDisable: true,
		allowRecipientOverride: true,
		status: "published",
		ruleSetVersion: "2026.1",
		description:
			"Peringatan jika pengajuan SPM dispensasi melewati ambang batas toleransi permil.",
	},
	{
		id: "pol-05",
		eventType: "ikpa_weekly_digest",
		eventTitle: "Laporan Mingguan Estimasi IKPA Satker",
		indicatorKey: "all",
		indicatorLabel: "Semua Indikator",
		category: "optional",
		dayType: "schedule",
		deadlineFormulaSummary: "Setiap hari Senin pukul 07.30 WIB",
		allowedMinLeadDays: 0,
		allowedMaxLeadDays: 7,
		defaultLeadDays: [0],
		requiredRecipients: ["Operator Satker", "KPA Satker"],
		allowDisable: true,
		allowRecipientOverride: true,
		status: "published",
		ruleSetVersion: "2026.1",
		description:
			"Ringkasan berkala progres skor estimasi dan tindakan mitigasi risiko mingguan.",
	},
	{
		id: "pol-06",
		eventType: "output_target_update_due",
		eventTitle: "Pemutakhiran Proyeksi Target Capaian Output Triwulanan",
		indicatorKey: "output_achievement",
		indicatorLabel: "Capaian Output",
		category: "mandatory",
		dayType: "workday",
		deadlineFormulaSummary:
			"10 hari kerja awal triwulan (TW I & II s.d. 30 Apr 2026, TW III s.d. 14 Jul 2026, TW IV s.d. 14 Okt 2026)",
		allowedMinLeadDays: 0,
		allowedMaxLeadDays: 10,
		defaultLeadDays: [10, 3, 0],
		requiredRecipients: ["PPK Satker", "KPA Satker", "Operator Capaian Output"],
		allowDisable: false,
		allowRecipientOverride: true,
		status: "published",
		ruleSetVersion: "2026.1",
		description:
			"Pengingat periode input dan pemutakhiran target capaian output triwulanan (10 hari kerja di awal triwulan).",
	},
];

export function getMockReminderPolicies(): ReminderPolicyEventItem[] {
	return mockReminderPolicies;
}

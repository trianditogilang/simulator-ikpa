export interface AdminReminderItem {
	id: string;
	satkerId: string;
	satkerCode: string;
	satkerName: string;
	eventTitle: string;
	eventType: string;
	indicatorLabel: string;
	category: "mandatory" | "recommended" | "optional";
	deadlineDate: string;
	workDaysLeft: number;
	deliveryStatus: "sent" | "scheduled" | "failed" | "processing";
	scheduledTime: string;
	sentTime?: string;
	attemptCount: number;
	recipient: string;
	errorMessage?: string;
	idempotencyKey: string;
	ruleSetVersion: string;
}

export interface AdminReminderStats {
	totalEvents: number;
	mandatoryCount: number;
	failedCount: number;
	dueSoonCount: number;
}

export const mockAdminReminderStats: AdminReminderStats = {
	totalEvents: 120,
	mandatoryCount: 24,
	failedCount: 3,
	dueSoonCount: 18,
};

export const mockAdminReminders: AdminReminderItem[] = [
	{
		id: "rem-adm-01",
		satkerId: "org-01",
		satkerCode: "415234",
		satkerName: "Politeknik Negeri Malang",
		eventTitle: "Batas 17 Hari Kerja SPM-LS (BAST K-001)",
		eventType: "invoice_timeliness_due",
		indicatorLabel: "Penyelesaian Tagihan",
		category: "mandatory",
		deadlineDate: "04 Sep 2026",
		workDaysLeft: 2,
		deliveryStatus: "failed",
		scheduledTime: "02 Sep 2026, 09.00 WIB",
		attemptCount: 2,
		recipient: "bambang.keu@polinema.ac.id",
		errorMessage: "SMTP Connection Timeout (Server Mailbox Host Unreachable)",
		idempotencyKey: "rem-415234-inv-k001-h2-20260902",
		ruleSetVersion: "2026.1",
	},
	{
		id: "rem-adm-02",
		satkerId: "org-02",
		satkerCode: "527812",
		satkerName: "BBTN Bromo Tengger Semeru",
		eventTitle: "Konfirmasi Capaian Output Bulan Agustus",
		eventType: "output_report_due",
		indicatorLabel: "Capaian Output",
		category: "mandatory",
		deadlineDate: "07 Sep 2026",
		workDaysLeft: 4,
		deliveryStatus: "scheduled",
		scheduledTime: "03 Sep 2026, 09.00 WIB",
		attemptCount: 0,
		recipient: "operator.output@btnbromo.go.id",
		idempotencyKey: "rem-527812-out-agu-h4-20260903",
		ruleSetVersion: "2026.1",
	},
	{
		id: "rem-adm-03",
		satkerId: "org-03",
		satkerCode: "632190",
		satkerName: "Pengadilan Negeri Malang",
		eventTitle: "Batas 30 Hari Revolving GUP",
		eventType: "up_tup_revolving_due",
		indicatorLabel: "Pengelolaan UP/TUP",
		category: "mandatory",
		deadlineDate: "08 Sep 2026",
		workDaysLeft: 5,
		deliveryStatus: "sent",
		scheduledTime: "01 Sep 2026, 09.00 WIB",
		sentTime: "01 Sep 2026, 09.00 WIB",
		attemptCount: 1,
		recipient: "bendahara@pn-malang.go.id",
		idempotencyKey: "rem-632190-uptup-gup4-20260901",
		ruleSetVersion: "2026.1",
	},
	{
		id: "rem-adm-04",
		satkerId: "org-07",
		satkerCode: "332112",
		satkerName: "Kemenag Kab. Malang",
		eventTitle: "Proyeksi Penyerapan Anggaran Triwulan III",
		eventType: "absorption_quarterly_alert",
		indicatorLabel: "Penyerapan Anggaran",
		category: "recommended",
		deadlineDate: "15 Sep 2026",
		workDaysLeft: 10,
		deliveryStatus: "failed",
		scheduledTime: "31 Agu 2026, 10.00 WIB",
		attemptCount: 3,
		recipient: "perencana.kemenag.mlg@kemenag.go.id",
		errorMessage: "Recipient Address Rejected (User Quota Exceeded)",
		idempotencyKey: "rem-332112-abs-q3-20260831",
		ruleSetVersion: "2026.1",
	},
	{
		id: "rem-adm-05",
		satkerId: "org-04",
		satkerCode: "411200",
		satkerName: "Kantor Imigrasi Kelas I TPI Malang",
		eventTitle: "Reminder Mingguan Proyeksi IKPA",
		eventType: "ikpa_weekly_digest",
		indicatorLabel: "Semua Indikator",
		category: "optional",
		deadlineDate: "04 Sep 2026",
		workDaysLeft: 2,
		deliveryStatus: "sent",
		scheduledTime: "01 Sep 2026, 07.30 WIB",
		sentTime: "01 Sep 2026, 07.31 WIB",
		attemptCount: 1,
		recipient: "keuangan.imigrasimlg@kemenkumham.go.id",
		idempotencyKey: "rem-411200-digest-w35-20260901",
		ruleSetVersion: "2026.1",
	},
	{
		id: "rem-adm-06",
		satkerId: "org-08",
		satkerCode: "554210",
		satkerName: "Lapas Kelas I Malang",
		eventTitle: "Peringatan Batas Rasio SPM Dispensasi",
		eventType: "spm_dispensation_warning",
		indicatorLabel: "Dispensasi SPM",
		category: "mandatory",
		deadlineDate: "11 Sep 2026",
		workDaysLeft: 8,
		deliveryStatus: "failed",
		scheduledTime: "31 Agu 2026, 14.00 WIB",
		attemptCount: 2,
		recipient: "keuangan@lapasmalang.go.id",
		errorMessage: "Rate Limit Exceeded (Provider API Throttling)",
		idempotencyKey: "rem-554210-spm-disp-20260831",
		ruleSetVersion: "2026.1",
	},
];

export function getMockAdminReminders(): {
	stats: AdminReminderStats;
	items: AdminReminderItem[];
} {
	return {
		stats: mockAdminReminderStats,
		items: mockAdminReminders,
	};
}

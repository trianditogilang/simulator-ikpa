export interface AdminKpiOverview {
	averageScore: number;
	targetScore: number;
	totalOrganizations: number;
	riskyCount: number;
	incompleteDataCount: number;
	deadlinesUpcomingCount: number;
	failedDeliveriesCount: number;
}

export interface RiskySatkerItem {
	id: string;
	code: string;
	name: string;
	score: number;
	gap: number;
	mainRisk: string;
	riskLevel: "danger" | "warning" | "info";
	primaryIndicator: string;
	route: string;
}

export interface AdminUpcomingDeadlinesItem {
	id: string;
	satkerCode: string;
	satkerName: string;
	eventTitle: string;
	dueDate: string;
	workDaysLeft: number;
	isUrgent: boolean;
	route: string;
}

export interface AdminSatkerSummaryItem {
	id: string;
	code: string;
	name: string;
	score: number;
	gap: number;
	status: "safe" | "warning" | "danger" | "incomplete";
	mainRisk: string;
	nearestDeadline: string;
	dataCompleteness: "complete" | "incomplete" | "warning";
	lastUpdate: string;
}

export interface AdminAggregateTrendItem {
	month: string;
	averageScore: number;
	target: number;
	highestScore: number;
	lowestScore: number;
}

export interface AdminPolicyStatus {
	currentVersion: string;
	status: "published" | "draft" | "retired";
	effectiveFrom: string;
	sourceRegulation: string;
	pendingEvaluationCount?: number;
	changeSummary?: string;
}

export interface AdminDashboardData {
	kppnName: string;
	kppnCode: string;
	fiscalYear: number;
	periodMonth: number;
	lastUpdated: string;
	kpi: AdminKpiOverview;
	policyStatus: AdminPolicyStatus;
	riskySatkers: RiskySatkerItem[];
	upcomingDeadlines: AdminUpcomingDeadlinesItem[];
	satkerSummaries: AdminSatkerSummaryItem[];
	monthlyTrend: AdminAggregateTrendItem[];
}

export const mockAdminDashboardNormal: AdminDashboardData = {
	kppnName: "KPPN Malang",
	kppnCode: "032",
	fiscalYear: 2026,
	periodMonth: 8,
	lastUpdated: "31 Agu 2026, 15.00 WIB",
	kpi: {
		averageScore: 92.4,
		targetScore: 95.0,
		totalOrganizations: 48,
		riskyCount: 8,
		incompleteDataCount: 5,
		deadlinesUpcomingCount: 12,
		failedDeliveriesCount: 0,
	},
	policyStatus: {
		currentVersion: "2026.1",
		status: "published",
		effectiveFrom: "01 Januari 2026",
		sourceRegulation: "PER-5/PB/2024",
	},
	riskySatkers: [
		{
			id: "org-01",
			code: "415234",
			name: "Politeknik Negeri Malang",
			score: 88.4,
			gap: -6.6,
			mainRisk: "Keterlambatan Tagihan Kontraktual",
			riskLevel: "danger",
			primaryIndicator: "Penyelesaian Tagihan",
			route: "/admin-kppn/organizations/org-01",
		},
		{
			id: "org-02",
			code: "527812",
			name: "Balai Besar Taman Nasional Bromo Tengger Semeru",
			score: 89.1,
			gap: -5.9,
			mainRisk: "Deviasi Halaman III DIPA Tinggi",
			riskLevel: "danger",
			primaryIndicator: "Deviasi Halaman III",
			route: "/admin-kppn/organizations/org-02",
		},
		{
			id: "org-03",
			code: "632190",
			name: "Pengadilan Negeri Malang",
			score: 89.8,
			gap: -5.2,
			mainRisk: "Revolving UP > 30 Hari",
			riskLevel: "warning",
			primaryIndicator: "Pengelolaan UP/TUP",
			route: "/admin-kppn/organizations/org-03",
		},
		{
			id: "org-04",
			code: "411200",
			name: "Kantor Imigrasi Kelas I TPI Malang",
			score: 91.2,
			gap: -3.8,
			mainRisk: "Capaian Output Belum Dikonfirmasi PPK",
			riskLevel: "warning",
			primaryIndicator: "Capaian Output",
			route: "/admin-kppn/organizations/org-04",
		},
	],
	upcomingDeadlines: [
		{
			id: "dl-01",
			satkerCode: "415234",
			satkerName: "Politeknik Negeri Malang",
			eventTitle: "Batas 17 Hari Kerja SPM-LS (BAST K-001)",
			dueDate: "04 Sep 2026",
			workDaysLeft: 2,
			isUrgent: true,
			route: "/admin-kppn/organizations/org-01",
		},
		{
			id: "dl-02",
			satkerCode: "527812",
			satkerName: "BBTN Bromo Tengger Semeru",
			eventTitle: "Konfirmasi Capaian Output Bulan Agustus",
			dueDate: "07 Sep 2026",
			workDaysLeft: 4,
			isUrgent: false,
			route: "/admin-kppn/organizations/org-02",
		},
		{
			id: "dl-03",
			satkerCode: "632190",
			satkerName: "Pengadilan Negeri Malang",
			eventTitle: "Revolving GUP Bulan Agustus 2026",
			dueDate: "08 Sep 2026",
			workDaysLeft: 5,
			isUrgent: false,
			route: "/admin-kppn/organizations/org-03",
		},
	],
	satkerSummaries: [
		{
			id: "org-01",
			code: "415234",
			name: "Politeknik Negeri Malang",
			score: 88.4,
			gap: -6.6,
			status: "danger",
			mainRisk: "Penyelesaian Tagihan",
			nearestDeadline: "04 Sep (H-2 kerja)",
			dataCompleteness: "complete",
			lastUpdate: "31 Agu 2026",
		},
		{
			id: "org-02",
			code: "527812",
			name: "BBTN Bromo Tengger Semeru",
			score: 89.1,
			gap: -5.9,
			status: "danger",
			mainRisk: "Deviasi Hal III",
			nearestDeadline: "07 Sep (H-4 kerja)",
			dataCompleteness: "warning",
			lastUpdate: "30 Agu 2026",
		},
		{
			id: "org-03",
			code: "632190",
			name: "Pengadilan Negeri Malang",
			score: 89.8,
			gap: -5.2,
			status: "warning",
			mainRisk: "Pengelolaan UP/TUP",
			nearestDeadline: "08 Sep (H-5 kerja)",
			dataCompleteness: "complete",
			lastUpdate: "29 Agu 2026",
		},
		{
			id: "org-04",
			code: "411200",
			name: "Kantor Imigrasi Kelas I TPI Malang",
			score: 91.2,
			gap: -3.8,
			status: "warning",
			mainRisk: "Capaian Output",
			nearestDeadline: "10 Sep (H-7 kerja)",
			dataCompleteness: "warning",
			lastUpdate: "31 Agu 2026",
		},
		{
			id: "org-05",
			code: "654321",
			name: "Universitas Brawijaya (BLU)",
			score: 96.5,
			gap: 1.5,
			status: "safe",
			mainRisk: "Tidak ada risiko signifikan",
			nearestDeadline: "15 Sep (H-10 kerja)",
			dataCompleteness: "complete",
			lastUpdate: "31 Agu 2026",
		},
		{
			id: "org-06",
			code: "123987",
			name: "Kantor Pelayanan Pajak Pratama Malang Utara",
			score: 95.8,
			gap: 0.8,
			status: "safe",
			mainRisk: "Tidak ada risiko signifikan",
			nearestDeadline: "14 Sep (H-9 kerja)",
			dataCompleteness: "complete",
			lastUpdate: "31 Agu 2026",
		},
	],
	monthlyTrend: [
		{ month: "Jan", averageScore: 94.8, target: 95.0, highestScore: 98.5, lowestScore: 89.2 },
		{ month: "Feb", averageScore: 94.2, target: 95.0, highestScore: 98.0, lowestScore: 88.0 },
		{ month: "Mar", averageScore: 93.5, target: 95.0, highestScore: 97.6, lowestScore: 86.5 },
		{ month: "Apr", averageScore: 93.1, target: 95.0, highestScore: 97.2, lowestScore: 87.0 },
		{ month: "Mei", averageScore: 92.8, target: 95.0, highestScore: 96.9, lowestScore: 86.2 },
		{ month: "Jun", averageScore: 92.5, target: 95.0, highestScore: 96.5, lowestScore: 85.8 },
		{ month: "Jul", averageScore: 92.2, target: 95.0, highestScore: 96.8, lowestScore: 87.1 },
		{ month: "Agu", averageScore: 92.4, target: 95.0, highestScore: 97.0, lowestScore: 88.4 },
	],
};

export const mockAdminDashboardRisky: AdminDashboardData = {
	...mockAdminDashboardNormal,
	kpi: {
		averageScore: 88.6,
		targetScore: 95.0,
		totalOrganizations: 48,
		riskyCount: 22,
		incompleteDataCount: 14,
		deadlinesUpcomingCount: 28,
		failedDeliveriesCount: 2,
	},
	riskySatkers: [
		...mockAdminDashboardNormal.riskySatkers,
		{
			id: "org-07",
			code: "332112",
			name: "Kantor Kementerian Agama Kab. Malang",
			score: 84.1,
			gap: -10.9,
			mainRisk: "Penyerapan Anggaran Terhambat (< 60%)",
			riskLevel: "danger",
			primaryIndicator: "Penyerapan Anggaran",
			route: "/admin-kppn/organizations/org-07",
		},
		{
			id: "org-08",
			code: "554210",
			name: "Lembaga Pemasyarakatan Kelas I Malang",
			score: 86.3,
			gap: -8.7,
			mainRisk: "3 SPM Dispensasi Diajukan",
			riskLevel: "danger",
			primaryIndicator: "Dispensasi SPM",
			route: "/admin-kppn/organizations/org-08",
		},
	],
};

export const mockAdminDashboardDeliveryFailed: AdminDashboardData = {
	...mockAdminDashboardNormal,
	kpi: {
		...mockAdminDashboardNormal.kpi,
		failedDeliveriesCount: 3,
	},
	upcomingDeadlines: [
		{
			id: "dl-fail-01",
			satkerCode: "415234",
			satkerName: "Politeknik Negeri Malang",
			eventTitle: "Email Reminder Tagihan Gagal Dikirim (SMTP Error 550)",
			dueDate: "04 Sep 2026",
			workDaysLeft: 2,
			isUrgent: true,
			route: "/admin-kppn/monitoring/reminders",
		},
		...mockAdminDashboardNormal.upcomingDeadlines,
	],
};

export const mockAdminDashboardPolicyChanged: AdminDashboardData = {
	...mockAdminDashboardNormal,
	policyStatus: {
		currentVersion: "2026.2",
		status: "draft",
		effectiveFrom: "01 September 2026",
		sourceRegulation: "Addendum Juknis IKPA Q3 2026",
		pendingEvaluationCount: 120,
		changeSummary:
			"Penyesuaian batas toleransi deviasi RPD menjadi 3% dan relaksasi batas H+17 kalender ke hari kerja.",
	},
};

export const mockAdminDashboardNoData: AdminDashboardData = {
	kppnName: "KPPN Malang",
	kppnCode: "032",
	fiscalYear: 2026,
	periodMonth: 8,
	lastUpdated: "31 Agu 2026, 15.00 WIB",
	kpi: {
		averageScore: 0,
		targetScore: 95.0,
		totalOrganizations: 0,
		riskyCount: 0,
		incompleteDataCount: 0,
		deadlinesUpcomingCount: 0,
		failedDeliveriesCount: 0,
	},
	policyStatus: {
		currentVersion: "2026.1",
		status: "published",
		effectiveFrom: "01 Januari 2026",
		sourceRegulation: "PER-5/PB/2024",
	},
	riskySatkers: [],
	upcomingDeadlines: [],
	satkerSummaries: [],
	monthlyTrend: [],
};

export function getMockAdminDashboardData(
	scenario: "normal" | "risky" | "delivery-failed" | "policy-changed" | "no-data" = "normal",
): AdminDashboardData {
	switch (scenario) {
		case "risky":
			return mockAdminDashboardRisky;
		case "delivery-failed":
			return mockAdminDashboardDeliveryFailed;
		case "policy-changed":
			return mockAdminDashboardPolicyChanged;
		case "no-data":
			return mockAdminDashboardNoData;
		default:
			return mockAdminDashboardNormal;
	}
}

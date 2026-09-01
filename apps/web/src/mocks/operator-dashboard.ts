export interface IndicatorScoreItem {
	id: string;
	code: string;
	name: string;
	weight: number;
	rawScore: number;
	weightedScore: number;
	status: "complete" | "warning" | "danger" | "incomplete";
	statusLabel: string;
	deltaPoints: number;
	summary: string;
	isDeduction?: boolean;
}

export interface PriorityActionItem {
	id: string;
	indicatorId: string;
	indicatorName: string;
	title: string;
	urgency: "high" | "medium" | "low";
	urgencyLabel: string;
	deadlineDays: number;
	deadlineDate: string;
	impactPoints: number;
	route: string;
	domain: string;
}

export interface NearestDeadlineItem {
	id: string;
	title: string;
	event: string;
	dueDate: string;
	workDaysLeft: number;
	status: "warning" | "danger" | "safe";
	route: string;
}

export interface CompletenessItem {
	id: string;
	domain: string;
	isComplete: boolean;
	label: string;
	missingCount?: number;
	route: string;
}

export interface OperatorDashboardData {
	totalScore: number;
	targetScore: number;
	gapScore: number;
	dataStatus: "complete" | "estimated" | "incomplete";
	ruleSetVersion: string;
	lastUpdated: string;
	nearestDeadline: NearestDeadlineItem | null;
	indicators: IndicatorScoreItem[];
	priorityActions: PriorityActionItem[];
	completeness: CompletenessItem[];
	scoreHistory: { month: string; score: number; target: number }[];
}

export const mockOperatorDashboardNormal: OperatorDashboardData = {
	totalScore: 94.2,
	targetScore: 95.0,
	gapScore: -0.8,
	dataStatus: "estimated",
	ruleSetVersion: "2026.1",
	lastUpdated: "31 Agu 2026, 15.00 WIB",
	nearestDeadline: {
		id: "dead-01",
		title: "Penyelesaian Tagihan BAST K-001",
		event: "Batas 17 Hari Kerja SPM-LS",
		dueDate: "04 September 2026",
		workDaysLeft: 2,
		status: "warning",
		route: "/operator/data/contracts-invoices",
	},
	indicators: [
		{
			id: "ind-1",
			code: "revisi_dipa",
			name: "Revisi DIPA",
			weight: 10,
			rawScore: 100.0,
			weightedScore: 10.0,
			status: "complete",
			statusLabel: "Sempurna",
			deltaPoints: 0.0,
			summary: "1 revisi triwulan ini",
		},
		{
			id: "ind-2",
			code: "deviasi_rpd",
			name: "Deviasi Hal III DIPA",
			weight: 15,
			rawScore: 92.0,
			weightedScore: 13.8,
			status: "complete",
			statusLabel: "Baik",
			deltaPoints: 1.2,
			summary: "Rata-rata deviasi 6.2%",
		},
		{
			id: "ind-3",
			code: "penyerapan",
			name: "Penyerapan Anggaran",
			weight: 20,
			rawScore: 88.4,
			weightedScore: 17.68,
			status: "warning",
			statusLabel: "Perlu Perhatian",
			deltaPoints: -1.5,
			summary: "Akun 52 di bawah target",
		},
		{
			id: "ind-4",
			code: "kontraktual",
			name: "Belanja Kontraktual",
			weight: 10,
			rawScore: 90.0,
			weightedScore: 9.0,
			status: "complete",
			statusLabel: "Baik",
			deltaPoints: 0.0,
			summary: "14 kontrak tepat waktu",
		},
		{
			id: "ind-5",
			code: "tagihan",
			name: "Penyelesaian Tagihan",
			weight: 10,
			rawScore: 86.67,
			weightedScore: 8.67,
			status: "warning",
			statusLabel: "Mendekati Batas",
			deltaPoints: -2.0,
			summary: "13/15 SPM tepat waktu",
		},
		{
			id: "ind-6",
			code: "up_tup",
			name: "Pengelolaan UP/TUP",
			weight: 10,
			rawScore: 96.0,
			weightedScore: 9.6,
			status: "complete",
			statusLabel: "Sangat Baik",
			deltaPoints: 0.5,
			summary: "GUP tertib & KKP 100%",
		},
		{
			id: "ind-7",
			code: "output",
			name: "Capaian Output",
			weight: 25,
			rawScore: 90.0,
			weightedScore: 22.5,
			status: "complete",
			statusLabel: "Baik",
			deltaPoints: 1.0,
			summary: "18/20 RO terkonfirmasi",
		},
		{
			id: "ind-8",
			code: "dispensasi",
			name: "Dispensasi SPM",
			weight: 0,
			rawScore: 0.75,
			weightedScore: -0.75,
			status: "complete",
			statusLabel: "Pengurang",
			deltaPoints: -0.75,
			summary: "24 SPM dispensasi Q4",
			isDeduction: true,
		},
	],
	priorityActions: [
		{
			id: "act-1",
			indicatorId: "ind-5",
			indicatorName: "Penyelesaian Tagihan",
			title: "Proses SPM Tagihan BAST Kontrak K-001",
			urgency: "high",
			urgencyLabel: "2 hari kerja tersisa",
			deadlineDays: 2,
			deadlineDate: "04 Sep 2026",
			impactPoints: 0.89,
			route: "/operator/data/contracts-invoices",
			domain: "Tagihan",
		},
		{
			id: "act-2",
			indicatorId: "ind-3",
			indicatorName: "Penyerapan Anggaran",
			title: "Percepat Realisasi Belanja Barang Akun 52",
			urgency: "medium",
			urgencyLabel: "Target Triwulan III",
			deadlineDays: 14,
			deadlineDate: "15 Sep 2026",
			impactPoints: 0.65,
			route: "/operator/data/rpd-realization",
			domain: "RPD & Realisasi",
		},
		{
			id: "act-3",
			indicatorId: "ind-7",
			indicatorName: "Capaian Output",
			title: "Konfirmasi Laporan Capaian 2 Rincian Output",
			urgency: "medium",
			urgencyLabel: "5 hari kerja awal bulan",
			deadlineDays: 5,
			deadlineDate: "07 Sep 2026",
			impactPoints: 0.5,
			route: "/operator/data/output-achievement",
			domain: "Capaian Output",
		},
	],
	completeness: [
		{
			id: "c-1",
			domain: "Pagu & Revisi DIPA",
			isComplete: true,
			label: "Lengkap",
			route: "/operator/data/budget-revisions",
		},
		{
			id: "c-2",
			domain: "RPD & Realisasi",
			isComplete: true,
			label: "Lengkap",
			route: "/operator/data/rpd-realization",
		},
		{
			id: "c-3",
			domain: "Kontrak & Tagihan",
			isComplete: true,
			label: "Lengkap",
			route: "/operator/data/contracts-invoices",
		},
		{
			id: "c-4",
			domain: "UP/TUP & KKP",
			isComplete: true,
			label: "Lengkap",
			route: "/operator/data/up-tup-kkp",
		},
		{
			id: "c-5",
			domain: "Capaian Output",
			isComplete: false,
			label: "2 RO Belum Konfirmasi",
			missingCount: 2,
			route: "/operator/data/output-achievement",
		},
		{
			id: "c-6",
			domain: "SPM Dispensasi",
			isComplete: true,
			label: "Lengkap",
			route: "/operator/data/spm-dispensation",
		},
	],
	scoreHistory: [
		{ month: "Jan", score: 91.5, target: 95.0 },
		{ month: "Feb", score: 92.8, target: 95.0 },
		{ month: "Mar", score: 93.4, target: 95.0 },
		{ month: "Apr", score: 93.0, target: 95.0 },
		{ month: "Mei", score: 94.1, target: 95.0 },
		{ month: "Jun", score: 93.8, target: 95.0 },
		{ month: "Jul", score: 94.5, target: 95.0 },
		{ month: "Agu", score: 94.2, target: 95.0 },
	],
};

export const mockOperatorDashboardRisky: OperatorDashboardData = {
	...mockOperatorDashboardNormal,
	totalScore: 84.5,
	gapScore: -10.5,
	nearestDeadline: {
		id: "dead-02",
		title: "SPM BAST Kontrak K-002 Terlambat",
		event: "Batas 17 Hari Kerja Lewat",
		dueDate: "25 Agustus 2026",
		workDaysLeft: 0,
		status: "danger",
		route: "/operator/data/contracts-invoices",
	},
};

export const mockOperatorDashboardIncomplete: OperatorDashboardData = {
	...mockOperatorDashboardNormal,
	totalScore: 0,
	dataStatus: "incomplete",
	nearestDeadline: null,
	priorityActions: [],
};

export function getMockOperatorDashboard(
	scenario = "normal",
): OperatorDashboardData {
	if (scenario === "risky") return mockOperatorDashboardRisky;
	if (scenario === "incomplete") return mockOperatorDashboardIncomplete;
	return mockOperatorDashboardNormal;
}

export interface IndicatorScoreItem {
	id: string;
	code: string;
	name: string;
	weight: number;
	rawScore: number | null;
	weightedScore: number;
	status: "complete" | "warning" | "danger" | "incomplete";
	statusLabel: string;
	deltaPoints: number | null;
	deltaDescription?: string;
	summary: string;
	isDeduction?: boolean;
	isEstimated?: boolean;
	isPriority1?: boolean;
	route?: string;
}

export interface PriorityActionItem {
	id: string;
	indicatorId: string;
	indicatorName: string;
	title: string;
	urgency: "high" | "medium" | "low";
	urgencyLabel: string;
	deadlineDays?: number | null;
	deadlineDate?: string | null;
	impactPoints: number;
	route: string;
	domain: string;
	domainLabel?: string;
}

export interface NearestDeadlineItem {
	id: string;
	title: string;
	event: string;
	dueDate: string;
	workDaysLeft: number;
	status: "warning" | "danger" | "safe";
	route: string;
	indicatorLabel?: string;
	otherDeadlinesCount?: number;
}

export interface CompletenessItem {
	id: string;
	domain: string;
	isComplete: boolean;
	label: string;
	missingCount?: number;
	detail?: string;
	route: string;
}

export interface OperatorDashboardData {
	totalScore: number | null;
	targetScore: number;
	gapScore: number | null;
	deltaFromPreviousPeriod?: number | null;
	previousPeriodLabel?: string | null;
	dataStatus: "complete" | "estimated" | "incomplete";
	ruleSetVersion: string;
	lastUpdated: string;
	nearestDeadline: NearestDeadlineItem | null;
	otherDeadlinesCount?: number;
	indicators: IndicatorScoreItem[];
	priorityActions: PriorityActionItem[];
	completeness: CompletenessItem[];
	firstIncompleteRoute?: string | null;
	scoreHistory: { month: string; score: number; target: number }[];
	activePeriodMonth?: number;
	activeYear?: number;
}

export const mockOperatorDashboardNormal: OperatorDashboardData = {
	totalScore: 91.25,
	targetScore: 95.0,
	gapScore: -3.75,
	deltaFromPreviousPeriod: 0.85,
	previousPeriodLabel: "Jul",
	dataStatus: "complete",
	ruleSetVersion: "PER-5/PB/2024",
	lastUpdated: "31 Agu 2026, 15.00 WIB",
	activePeriodMonth: 8,
	activeYear: 2026,
	nearestDeadline: {
		id: "dead-01",
		title: "Penyelesaian Tagihan BAST K-001",
		event: "Batas 17 Hari Kerja SPM-LS",
		dueDate: "04 September 2026",
		workDaysLeft: 2,
		status: "warning",
		route: "/operator/data/contracts-invoices?tab=invoices",
		indicatorLabel: "Penyelesaian Tagihan",
		otherDeadlinesCount: 3,
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
			deltaDescription: "Tetap vs Jul",
			summary: "1 revisi triwulan ini",
			route: "/operator/data/budget-revisions",
		},
		{
			id: "ind-2",
			code: "deviasi_rpd",
			name: "Deviasi Halaman III",
			weight: 15,
			rawScore: 92.0,
			weightedScore: 13.8,
			status: "complete",
			statusLabel: "Baik",
			deltaPoints: 1.2,
			deltaDescription: "+1.20 vs Jul",
			summary: "Rata-rata deviasi 6.2%",
			route: "/operator/deviasi",
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
			deltaDescription: "-1.50 vs Jul",
			summary: "Akun 52 di bawah target",
			isPriority1: true,
			route: "/operator/penyerapan",
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
			deltaDescription: "Tetap vs Jul",
			summary: "14 kontrak tepat waktu",
			route: "/operator/data/contracts-invoices?tab=contracts",
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
			deltaDescription: "-2.00 vs Jul",
			summary: "13/15 SPM tepat waktu",
			route: "/operator/data/contracts-invoices?tab=invoices",
		},
		{
			id: "ind-6",
			code: "up_tup",
			name: "UP/TUP & KKP",
			weight: 10,
			rawScore: 96.0,
			weightedScore: 9.6,
			status: "complete",
			statusLabel: "Sangat Baik",
			deltaPoints: 0.5,
			deltaDescription: "+0.50 vs Jul",
			summary: "GUP tertib & KKP 100%",
			route: "/operator/up-tup",
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
			deltaDescription: "+1.00 vs Jul",
			summary: "18/20 RO terkonfirmasi",
			route: "/operator/data/output-achievement",
		},
		{
			id: "ind-8",
			code: "dispensasi",
			name: "Dispensasi SPM",
			weight: 0,
			rawScore: 0.0,
			weightedScore: 0.0,
			status: "complete",
			statusLabel: "Tanpa Pengurang",
			deltaPoints: 0.0,
			deltaDescription: "Tetap vs Jul",
			summary: "Tidak ada dispensasi SPM",
			route: "/operator/data/spm-dispensation",
			isDeduction: true,
		},
	],
	priorityActions: [
		{
			id: "act-1",
			indicatorId: "ind-3",
			indicatorName: "Penyerapan Anggaran",
			title: "Percepat Realisasi Belanja Barang Akun 52",
			urgency: "high",
			urgencyLabel: "Tinggi",
			deadlineDays: null,
			deadlineDate: null,
			impactPoints: 2.32,
			route: "/operator/penyerapan",
			domain: "Penyerapan Anggaran",
			domainLabel: "Penyerapan Anggaran",
		},
		{
			id: "act-2",
			indicatorId: "ind-5",
			indicatorName: "Penyelesaian Tagihan",
			title: "Proses SPM Tagihan BAST Kontrak K-001",
			urgency: "medium",
			urgencyLabel: "Sedang",
			deadlineDays: 2,
			deadlineDate: "04 Sep 2026",
			impactPoints: 1.33,
			route: "/operator/data/contracts-invoices?tab=invoices",
			domain: "Penyelesaian Tagihan",
			domainLabel: "Penyelesaian Tagihan",
		},
		{
			id: "act-3",
			indicatorId: "ind-7",
			indicatorName: "Capaian Output",
			title: "Konfirmasi Laporan Capaian 2 Rincian Output",
			urgency: "low",
			urgencyLabel: "Rendah",
			deadlineDays: 5,
			deadlineDate: "07 Sep 2026",
			impactPoints: 2.5,
			route: "/operator/data/output-achievement",
			domain: "Capaian Output",
			domainLabel: "Capaian Output",
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
			route: "/operator/deviasi",
		},
		{
			id: "c-3",
			domain: "Kontrak & Tagihan",
			isComplete: true,
			label: "Lengkap",
			route: "/operator/data/contracts-invoices?tab=contracts",
		},
		{
			id: "c-4",
			domain: "UP/TUP & KKP",
			isComplete: true,
			label: "Lengkap",
			route: "/operator/up-tup",
		},
		{
			id: "c-5",
			domain: "Capaian Output",
			isComplete: true,
			label: "Lengkap",
			route: "/operator/data/output-achievement",
		},
		{
			id: "c-6",
			domain: "Dispensasi SPM",
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
		route: "/operator/data/contracts-invoices?tab=invoices",
		indicatorLabel: "Penyelesaian Tagihan",
	},
};

export const mockOperatorDashboardIncomplete: OperatorDashboardData = {
	...mockOperatorDashboardNormal,
	totalScore: null,
	gapScore: null,
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

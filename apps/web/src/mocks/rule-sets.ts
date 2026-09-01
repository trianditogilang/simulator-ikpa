export interface IndicatorWeightConfig {
	key: string;
	label: string;
	weight: number;
	target: number;
	tolerancePct?: number;
	deadlineDays?: number;
	dayType?: "workday" | "calendar_day";
	description: string;
}

export interface RuleSetItem {
	id: string;
	version: string;
	year: number;
	status: "published" | "draft" | "retired";
	effectiveFrom: string;
	effectiveTo?: string;
	sourceRegulation: string;
	authorName: string;
	publishedAt?: string;
	changeSummary: string;
	isLocked: boolean;
	indicatorWeights: IndicatorWeightConfig[];
	validationStatus: {
		isSchemaValid: boolean;
		totalWeight: number;
		unverifiedParamsCount: number;
		warnings: string[];
	};
}

export const mockRuleSets: RuleSetItem[] = [
	{
		id: "rs-2026-1",
		version: "2026.1",
		year: 2026,
		status: "published",
		effectiveFrom: "01 Jan 2026",
		sourceRegulation: "PER-5/PB/2024 tentang Petunjuk Teknis Penilaian IKPA",
		authorName: "Admin Pembina Kemenkeu",
		publishedAt: "01 Jan 2026, 08.00 WIB",
		changeSummary:
			"Konfigurasi dasar IKPA tahun anggaran 2026 sesuai regulasi PER-5/PB/2024.",
		isLocked: true,
		indicatorWeights: [
			{
				key: "dipa_revision",
				label: "Revisi DIPA",
				weight: 10,
				target: 100,
				description: "Maksimal 1 kali pengesahan revisi per triwulan.",
			},
			{
				key: "rpd_deviation",
				label: "Deviasi Halaman III DIPA",
				weight: 15,
				target: 95,
				tolerancePct: 5,
				description:
					"Toleransi deviasi realisasi terhadap RPD bulanan maksimal 5%.",
			},
			{
				key: "budget_absorption",
				label: "Penyerapan Anggaran",
				weight: 20,
				target: 95,
				description:
					"Target kumulatif penyerapan per triwulan (TW I: 15%, TW II: 50%, TW III: 75%, TW IV: 95%).",
			},
			{
				key: "contractual",
				label: "Belanja Kontraktual",
				weight: 10,
				target: 95,
				deadlineDays: 3,
				dayType: "workday",
				description:
					"Pendaftaran kontrak ≤ 3 hari kerja sejak penandatanganan.",
			},
			{
				key: "invoice_timeliness",
				label: "Penyelesaian Tagihan",
				weight: 10,
				target: 95,
				deadlineDays: 17,
				dayType: "workday",
				description:
					"Penerbitan SPM-LS maksimal H+17 hari kerja sejak BAST/BAPP.",
			},
			{
				key: "up_tup",
				label: "Pengelolaan UP dan TUP",
				weight: 10,
				target: 95,
				tolerancePct: 10,
				description:
					"Revolving GUP minimal 1x per bulan (≤ 30 hari) dan proporsi KKP minimal 10%.",
			},
			{
				key: "output_achievement",
				label: "Capaian Output",
				weight: 25,
				target: 95,
				description:
					"Ketepatan waktu (bobot 30%) dan capaian PCRO/RVRO (bobot 70%).",
			},
			{
				key: "spm_dispensation",
				label: "Dispensasi SPM (Pengurang)",
				weight: 0,
				target: 0,
				description:
					"Faktor pengurang nilai IKPA pada Triwulan IV (-0,50 s.d. -2,00).",
			},
		],
		validationStatus: {
			isSchemaValid: true,
			totalWeight: 100,
			unverifiedParamsCount: 0,
			warnings: [],
		},
	},
	{
		id: "rs-2026-2",
		version: "2026.2",
		year: 2026,
		status: "draft",
		effectiveFrom: "01 Sep 2026",
		sourceRegulation: "Addendum Juknis IKPA Semester II / 2026",
		authorName: "Admin KPPN Malang",
		changeSummary:
			"Penyesuaian batas toleransi deviasi RPD menjadi 3% dan penegasan kalender hari kerja pada pelaporan output.",
		isLocked: false,
		indicatorWeights: [
			{
				key: "dipa_revision",
				label: "Revisi DIPA",
				weight: 10,
				target: 100,
				description: "Maksimal 1 kali pengesahan revisi per triwulan.",
			},
			{
				key: "rpd_deviation",
				label: "Deviasi Halaman III DIPA",
				weight: 15,
				target: 95,
				tolerancePct: 3,
				description:
					"Toleransi deviasi realisasi terhadap RPD bulanan diperketat menjadi 3%.",
			},
			{
				key: "budget_absorption",
				label: "Penyerapan Anggaran",
				weight: 20,
				target: 95,
				description: "Target kumulatif penyerapan per triwulan.",
			},
			{
				key: "contractual",
				label: "Belanja Kontraktual",
				weight: 10,
				target: 95,
				deadlineDays: 3,
				dayType: "workday",
				description: "Pendaftaran kontrak ≤ 3 hari kerja.",
			},
			{
				key: "invoice_timeliness",
				label: "Penyelesaian Tagihan",
				weight: 10,
				target: 95,
				deadlineDays: 17,
				dayType: "workday",
				description: "Penerbitan SPM-LS maksimal H+17 hari kerja sejak BAST.",
			},
			{
				key: "up_tup",
				label: "Pengelolaan UP dan TUP",
				weight: 10,
				target: 95,
				tolerancePct: 10,
				description: "Revolving GUP ≤ 30 hari dan KKP ≥ 10%.",
			},
			{
				key: "output_achievement",
				label: "Capaian Output",
				weight: 25,
				target: 95,
				description: "Ketepatan waktu dan capaian PCRO/RVRO.",
			},
			{
				key: "spm_dispensation",
				label: "Dispensasi SPM (Pengurang)",
				weight: 0,
				target: 0,
				description: "Faktor pengurang nilai IKPA pada Triwulan IV.",
			},
		],
		validationStatus: {
			isSchemaValid: true,
			totalWeight: 100,
			unverifiedParamsCount: 1,
			warnings: [
				"1 parameter addendum masih menunggu nomor surat edaran formal DJPb.",
			],
		},
	},
	{
		id: "rs-2025-1",
		version: "2025.1",
		year: 2025,
		status: "retired",
		effectiveFrom: "01 Jan 2025",
		effectiveTo: "31 Des 2025",
		sourceRegulation: "PER-5/PB/2022 tentang IKPA",
		authorName: "Admin Pembina Kemenkeu",
		publishedAt: "01 Jan 2025, 08.00 WIB",
		changeSummary: "Rule set resmi tahun anggaran 2025 (Arsip Historis).",
		isLocked: true,
		indicatorWeights: [
			{
				key: "dipa_revision",
				label: "Revisi DIPA",
				weight: 10,
				target: 100,
				description: "1x per triwulan.",
			},
			{
				key: "rpd_deviation",
				label: "Deviasi Halaman III DIPA",
				weight: 15,
				target: 95,
				tolerancePct: 5,
				description: "Toleransi 5%.",
			},
			{
				key: "budget_absorption",
				label: "Penyerapan Anggaran",
				weight: 20,
				target: 95,
				description: "Target triwulan.",
			},
			{
				key: "contractual",
				label: "Belanja Kontraktual",
				weight: 10,
				target: 95,
				description: "Kontrak 3 hari kerja.",
			},
			{
				key: "invoice_timeliness",
				label: "Penyelesaian Tagihan",
				weight: 10,
				target: 95,
				description: "Tagihan 17 hari kerja.",
			},
			{
				key: "up_tup",
				label: "Pengelolaan UP dan TUP",
				weight: 10,
				target: 95,
				description: "UP/TUP dan KKP.",
			},
			{
				key: "output_achievement",
				label: "Capaian Output",
				weight: 25,
				target: 95,
				description: "Pelaporan output.",
			},
			{
				key: "spm_dispensation",
				label: "Dispensasi SPM",
				weight: 0,
				target: 0,
				description: "Dispensasi SPM Q4.",
			},
		],
		validationStatus: {
			isSchemaValid: true,
			totalWeight: 100,
			unverifiedParamsCount: 0,
			warnings: [],
		},
	},
];

export function getMockRuleSets(): RuleSetItem[] {
	return mockRuleSets;
}

export function getMockRuleSetById(id: string): RuleSetItem {
	return mockRuleSets.find((r) => r.id === id) || mockRuleSets[0];
}

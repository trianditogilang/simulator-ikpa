export type IndicatorRoute = {
	key: string;
	label: string;
	route: string;
	description?: string;
};

export const INDICATOR_ROUTES: Record<string, IndicatorRoute> = {
	dipa_revision: {
		key: "dipa_revision",
		label: "Revisi DIPA",
		route: "/operator/data/budget-revisions",
		description: "Revisi DIPA dan pergeseran anggaran",
	},
	revisi_dipa: {
		key: "revisi_dipa",
		label: "Revisi DIPA",
		route: "/operator/data/budget-revisions",
		description: "Revisi DIPA dan pergeseran anggaran",
	},
	deviation: {
		key: "deviation",
		label: "Deviasi Halaman III",
		route: "/operator/deviasi",
		description: "Deviasi Halaman III DIPA terhadap realisasi bulanan",
	},
	rpd_deviation: {
		key: "rpd_deviation",
		label: "Deviasi Halaman III",
		route: "/operator/deviasi",
		description: "Deviasi Halaman III DIPA terhadap realisasi bulanan",
	},
	deviasi: {
		key: "deviasi",
		label: "Deviasi Halaman III",
		route: "/operator/deviasi",
		description: "Deviasi Halaman III DIPA terhadap realisasi bulanan",
	},
	budget_absorption: {
		key: "budget_absorption",
		label: "Penyerapan Anggaran",
		route: "/operator/penyerapan",
		description: "Penyerapan anggaran per jenis belanja",
	},
	penyerapan: {
		key: "penyerapan",
		label: "Penyerapan Anggaran",
		route: "/operator/penyerapan",
		description: "Penyerapan anggaran per jenis belanja",
	},
	contractual: {
		key: "contractual",
		label: "Belanja Kontraktual",
		route: "/operator/data/contracts-invoices?tab=contracts",
		description: "Pendaftaran kontrak dini dan komitmen belanja",
	},
	belanja_kontraktual: {
		key: "belanja_kontraktual",
		label: "Belanja Kontraktual",
		route: "/operator/data/contracts-invoices?tab=contracts",
		description: "Pendaftaran kontrak dini dan komitmen belanja",
	},
	invoice_timeliness: {
		key: "invoice_timeliness",
		label: "Penyelesaian Tagihan",
		route: "/operator/data/contracts-invoices?tab=invoices",
		description: "Penyampaian SPM-LS kontraktual 17 hari kerja",
	},
	tagihan: {
		key: "tagihan",
		label: "Penyelesaian Tagihan",
		route: "/operator/data/contracts-invoices?tab=invoices",
		description: "Penyampaian SPM-LS kontraktual 17 hari kerja",
	},
	up_tup: {
		key: "up_tup",
		label: "UP/TUP & KKP",
		route: "/operator/up-tup",
		description: "Pengelolaan UP/TUP tunai dan porsi belanja KKP",
	},
	output_achievement: {
		key: "output_achievement",
		label: "Capaian Output",
		route: "/operator/data/output-achievement",
		description: "Ketercapaian PCRO dan RVRO target rincian output",
	},
	capaian_output: {
		key: "capaian_output",
		label: "Capaian Output",
		route: "/operator/data/output-achievement",
		description: "Ketercapaian PCRO dan RVRO target rincian output",
	},
	spm_dispensation: {
		key: "spm_dispensation",
		label: "Dispensasi SPM",
		route: "/operator/data/spm-dispensation",
		description: "Dispensasi SPM akhir tahun (faktor pengurang)",
	},
	spm_dispensasi: {
		key: "spm_dispensasi",
		label: "Dispensasi SPM",
		route: "/operator/data/spm-dispensation",
		description: "Dispensasi SPM akhir tahun (faktor pengurang)",
	},
};

export const CANONICAL_INDICATOR_KEYS = [
	"dipa_revision",
	"deviation",
	"budget_absorption",
	"contractual",
	"invoice_timeliness",
	"up_tup",
	"output_achievement",
	"spm_dispensation",
] as const;

export function resolveIndicatorRoute(
	key: string | undefined | null,
): IndicatorRoute | null {
	if (!key) return null;
	const normalized = key.toLowerCase().trim();
	if (INDICATOR_ROUTES[normalized]) {
		return INDICATOR_ROUTES[normalized];
	}
	console.warn(`[resolveIndicatorRoute] Unknown indicator key: "${key}"`);
	return null;
}

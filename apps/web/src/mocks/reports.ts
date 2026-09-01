export interface ReportTemplateItem {
	id: string;
	title: string;
	description: string;
	period: string;
	format: "PDF" | "XLSX";
}

export const mockReports: ReportTemplateItem[] = [
	{
		id: "rep-01",
		title: "Laporan Eksekutif Simulasi IKPA Satker",
		description:
			"Rangkuman komprehensif nilai akhir, gap target, breakdown 8 indikator, dan rekomendasi mitigasi risiko.",
		period: "Agustus 2026",
		format: "PDF",
	},
	{
		id: "rep-02",
		title: "Matriks Rincian Data Transaksional & Deviasi",
		description:
			"Ekspor tabel lengkap pagu, RPD bulanan, SPM-LS, UP/TUP, capaian RO, dan SPM dispensasi.",
		period: "Agustus 2026",
		format: "XLSX",
	},
];

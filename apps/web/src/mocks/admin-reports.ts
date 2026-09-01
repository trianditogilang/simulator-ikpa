export interface AdminReportTypeOption {
	id: string;
	title: string;
	description: string;
	category: string;
	columns: string[];
}

export interface AdminReportPreviewRow {
	id: string;
	col1: string;
	col2: string;
	col3: string;
	col4: string;
	col5: string;
	col6: string;
	status?: "safe" | "warning" | "danger" | "complete" | "incomplete";
}

export const mockAdminReportTypes: AdminReportTypeOption[] = [
	{
		id: "rekap-nilai",
		title: "Rekap Nilai dan Target Satker",
		description: "Laporan komprehensif capaian nilai IKPA seluruh satker terhadap target nasional 95,00.",
		category: "Kinerja Utama",
		columns: ["Kode Satker", "Nama Satker", "Nilai IKPA", "Target", "Gap Poin", "Status Kinerja"],
	},
	{
		id: "indikator-gap",
		title: "Indikator dan Gap per Satker",
		description: "Matriks rincian 8 indikator IKPA (nilai asli dan nilai terbobot) per Satker.",
		category: "Rincian Indikator",
		columns: ["Kode", "Satker", "Indikator Utama", "Nilai Asli", "Bobot Poin", "Kategori Status"],
	},
	{
		id: "risiko-deadline",
		title: "Risiko dan Deadline Agenda",
		description: "Daftar potensi deviasi kinerja dan agenda deadline terdekat (< 7 hari kerja).",
		category: "Mitigasi Risiko",
		columns: ["Satker", "Agenda Deadline", "Jatuh Tempo", "Sisa Hari Kerja", "Faktor Risiko", "Tingkat Urgensi"],
	},
	{
		id: "kelengkapan-data",
		title: "Kelengkapan Data Operasional",
		description: "Audit kesiapan dan kelengkapan data operasional pada 6 modul input satker.",
		category: "Kualitas Data",
		columns: ["Kode", "Satker", "Modul Belum Lengkap", "Catatan Verifikasi", "Status Data", "Update Terakhir"],
	},
	{
		id: "reminder-delivery",
		title: "Status Reminder dan Log Delivery",
		description: "Rekap pengiriman notifikasi email reminder, status keberhasilan, dan retry log.",
		category: "Komunikasi",
		columns: ["Satker", "Event Agenda", "Jadwal Kirim", "Penerima", "Percobaan", "Status Delivery"],
	},
];

export const mockReportPreviewData: Record<string, AdminReportPreviewRow[]> = {
	"rekap-nilai": [
		{
			id: "1",
			col1: "415234",
			col2: "Politeknik Negeri Malang (BLU)",
			col3: "88,40",
			col4: "95,00",
			col5: "-6,60",
			col6: "Kritis / Perlu Pembinaan",
			status: "danger",
		},
		{
			id: "2",
			col1: "527812",
			col2: "BBTN Bromo Tengger Semeru",
			col3: "89,10",
			col4: "95,00",
			col5: "-5,90",
			col6: "Kritis / Deviasi RPD",
			status: "danger",
		},
		{
			id: "3",
			col1: "632190",
			col2: "Pengadilan Negeri Malang",
			col3: "89,80",
			col4: "95,00",
			col5: "-5,20",
			col6: "Waspada / UP-TUP",
			status: "warning",
		},
		{
			id: "4",
			col1: "411200",
			col2: "Kantor Imigrasi Kelas I TPI Malang",
			col3: "91,20",
			col4: "95,00",
			col5: "-3,80",
			col6: "Waspada / Output",
			status: "warning",
		},
		{
			id: "5",
			col1: "654321",
			col2: "Universitas Brawijaya (BLU)",
			col3: "96,50",
			col4: "95,00",
			col5: "+1,50",
			col6: "Sangat Baik",
			status: "safe",
		},
		{
			id: "6",
			col1: "123987",
			col2: "KPP Pratama Malang Utara",
			col3: "95,80",
			col4: "95,00",
			col5: "+0,80",
			col6: "Sangat Baik",
			status: "safe",
		},
	],
	"indikator-gap": [
		{
			id: "1",
			col1: "415234",
			col2: "Polinema",
			col3: "Penyelesaian Tagihan",
			col4: "78,20%",
			col5: "7,82 dari 10,00",
			col6: "Kritis",
			status: "danger",
		},
		{
			id: "2",
			col1: "527812",
			col2: "BBTN Bromo",
			col3: "Deviasi Hal III DIPA",
			col4: "84,50%",
			col5: "12,68 dari 15,00",
			col6: "Kritis",
			status: "danger",
		},
		{
			id: "3",
			col1: "411200",
			col2: "Imigrasi Malang",
			col3: "Capaian Output",
			col4: "83,60%",
			col5: "20,90 dari 25,00",
			col6: "Waspada",
			status: "warning",
		},
	],
	"risiko-deadline": [
		{
			id: "1",
			col1: "Polinema (415234)",
			col2: "SPM-LS BAST K-001 (Lab Komputer)",
			col3: "04 Sep 2026",
			col4: "H-2 hari kerja",
			col5: "Keterlambatan SPM-LS > 17 hari kerja",
			col6: "Tinggi",
			status: "danger",
		},
		{
			id: "2",
			col1: "BBTN Bromo (527812)",
			col2: "Konfirmasi Capaian Output Agustus",
			col3: "07 Sep 2026",
			col4: "H-4 hari kerja",
			col5: "2 RO belum dikonfirmasi PPK",
			col6: "Sedang",
			status: "warning",
		},
	],
	"kelengkapan-data": [
		{
			id: "1",
			col1: "415234",
			col2: "Politeknik Negeri Malang",
			col3: "Capaian Output",
			col4: "2 dari 18 RO belum divalidasi PPK",
			col5: "Perlu Konfirmasi",
			col6: "31 Agu 2026",
			status: "warning",
		},
		{
			id: "2",
			col1: "332112",
			col2: "Kemenag Kab. Malang",
			col3: "RPD & Realisasi",
			col4: "Data belanja modal bulan 8 belum lengkap",
			col5: "Incomplete",
			col6: "28 Agu 2026",
			status: "danger",
		},
	],
	"reminder-delivery": [
		{
			id: "1",
			col1: "Polinema (415234)",
			col2: "SPM-LS BAST K-001 Due",
			col3: "02 Sep 2026, 09.00",
			col4: "bambang.keu@polinema.ac.id",
			col5: "2 kali",
			col6: "Gagal (Timeout)",
			status: "danger",
		},
		{
			id: "2",
			col1: "PN Malang (632190)",
			col2: "Revolving GUP 30 Hari",
			col3: "01 Sep 2026, 09.00",
			col4: "bendahara@pn-malang.go.id",
			col5: "1 kali",
			col6: "Terkirim",
			status: "safe",
		},
	],
};

export function getMockAdminReports() {
	return {
		reportTypes: mockAdminReportTypes,
		previewData: mockReportPreviewData,
	};
}

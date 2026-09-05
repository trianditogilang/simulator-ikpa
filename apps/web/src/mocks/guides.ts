export interface GuideItem {
	id: string;
	title: string;
	weightLabel: string;
	regulationSource: string;
	summary: string;
	formula: string;
	tips: string;
}

export const mockGuides: GuideItem[] = [
	{
		id: "g-01",
		title: "1. Revisi DIPA",
		weightLabel: "Bobot 10%",
		regulationSource: "PER-5/PB/2024 Pasal 4",
		summary:
			"Menilai frekuensi pengesahan revisi DIPA per satker pada setiap semester anggaran.",
		formula:
			"0–1 revisi objek per semester = 110; 2 = 100; ≥3 = 50. Nilai tahun = (NKRA S1 + NKRA S2) / 2. Hanya revisi pagu tetap dengan 14 kode objek (201, 211, 212, 213, 217, 220, 221, 222, 225, 226, 229, 231, 236, 239); pagu berubah = tidak dihitung; DIPA-AWAL dikecualikan.",
		tips: "Kumpulkan usulan revisi anggaran agar diajukan sekaligus dalam satu paket per semester.",
	},
	{
		id: "g-02",
		title: "2. Deviasi Halaman III DIPA",
		weightLabel: "Bobot 15%",
		regulationSource: "PER-5/PB/2024 Pasal 5",
		summary:
			"Menilai kesesuaian antara realisasi anggaran bulanan dengan rencana penarikan dana (RPD).",
		formula:
			"Rata-rata deviasi bulanan. Deviasi ≤ 5% = 100. Kurva linier turun hingga batas toleransi.",
		tips: "Perbarui RPD Hal III DIPA pada batas akhir triwulan sebelum triwulan berikutnya dimulai.",
	},
	{
		id: "g-03",
		title: "3. Penyerapan Anggaran",
		weightLabel: "Bobot 20%",
		regulationSource: "PER-5/PB/2024 Pasal 6",
		summary:
			"Menilai proporsi realisasi anggaran terhadap pagu DIPA per triwulan menurut jenis belanja.",
		formula:
			"Target triwulanan: Q1 (15%), Q2 (40%–50%), Q3 (60%–70%), Q4 (90%–95%).",
		tips: "Akselerasi pengadaan barang/jasa sejak awal tahun anggaran untuk menghindari penumpukan di Q4.",
	},
	{
		id: "g-04",
		title: "4. Belanja Kontraktual",
		weightLabel: "Bobot 10%",
		regulationSource: "PER-5/PB/2024 Pasal 7",
		summary:
			"Menilai ketepatan pendaftaran data kontrak ke KPPN maksimal 3 hari kerja sejak penandatanganan.",
		formula: "(Jumlah Kontrak Tepat Waktu / Total Kontrak) × 100.",
		tips: "Segera kirimkan ADK pendaftaran kontrak ke KPPN begitu kontrak ditandatangani PPK.",
	},
	{
		id: "g-05",
		title: "5. Penyelesaian Tagihan (SPM-LS)",
		weightLabel: "Bobot 10%",
		regulationSource: "PER-5/PB/2024 Pasal 8",
		summary:
			"Menilai ketepatan penerbitan SPM-LS non-pegawai maksimal 17 hari kerja sejak BAST/BAPP.",
		formula: "(Jumlah SPM-LS ≤ 17 Hari Kerja / Total SPM-LS) × 100.",
		tips: "Pantau tanggal BAST di aplikasi dan jadwalkan pengujian berkas tagihan sebelum H-5.",
	},
	{
		id: "g-06",
		title: "6. Pengelolaan UP dan TUP",
		weightLabel: "Bobot 10%",
		regulationSource: "PER-5/PB/2024 Pasal 9",
		summary:
			"Menilai ketertiban revolving UP minimal 1 kali sebulan, pertanggungjawaban TUP, dan penggunaan KKP.",
		formula:
			"Komposit: Ketepatan GUP (50%) + Setoran TUP (25%) + Porsi KKP (25%).",
		tips: "Lakukan revolving GUP sebelum saldo mengendap lebih dari 30 hari kalender.",
	},
	{
		id: "g-07",
		title: "7. Capaian Output Satker",
		weightLabel: "Bobot 25%",
		regulationSource: "PER-5/PB/2024 Pasal 10",
		summary:
			"Menilai ketepatan waktu pelaporan (5 hari kerja awal bulan) dan ketercapaian target output (PCRO/RVRO).",
		formula: "30% Ketepatan Waktu Pelaporan + 70% Ketercapaian Target Output.",
		tips: "Pastikan PPK mengonfirmasi data capaian rincian output setiap awal bulan secara konsisten.",
	},
	{
		id: "g-08",
		title: "8. Dispensasi SPM (Faktor Pengurang)",
		weightLabel: "Pengurang",
		regulationSource: "PER-5/PB/2024 Pasal 11",
		summary:
			"Pengurang nilai total IKPA satker akibat penerbitan SPM dispensasi pada akhir tahun anggaran.",
		formula:
			"Rasio permil dispensasi terhadap total SPM Q4 (rentang pengurangan 0,25 hingga 2,00 poin).",
		tips: "Selesaikan seluruh proses tagihan dan SPM sebelum batas cut-off akhir tahun yang ditetapkan KPPN.",
	},
];

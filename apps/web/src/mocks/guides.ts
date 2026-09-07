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
			"Menilai kesesuaian antara realisasi anggaran bulanan dengan rencana penarikan dana (RPD) per jenis belanja (51, 52, 53, 57).",
		formula:
			"Deviasi akun = min(100, |Realisasi − RPD| ÷ RPD × 100). Deviasi bulanan = sum(deviasi akun × bobot pagu). Rata-rata = sum(deviasi bulanan) ÷ n bulan berjalan (Jan–Nov). Rata-rata ≤ 5% = 100; rata-rata > 5% = 100 − rata-rata (cap 0).",
		tips: "Perbarui RPD Hal III DIPA pada batas akhir triwulan (Feb/Apr/Jul/Okt) sebelum triwulan berikutnya dimulai dan jaga rata-rata deviasi ≤ 5%.",
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
			"Menilai akselerasi dan penyelesaian kontrak melalui tiga subkomponen: Distribusi Akselerasi Kontrak (20%), Kontrak Pra-DIPA / Dini (40%), dan Akselerasi Kontrak 53 (40%).",
		formula:
			"Nilai BK = (NK-DAK × 20%) + (NK-KD × 40%) + (NK-AK53 × 40%). DAK: Rasio jumlah kontrak ≥ Rp50jt s.d. 30 Juni / Total Kontrak TA. KD: Rata-rata poin kontrak Pra-DIPA (120) & s.d. 31 Mar (110) untuk kontrak ≥ Rp50jt. AK53: Rata-rata poin kontrak belanja 53 (Rp50–200jt, sekaligus) berdasarkan triwulan terbit SP2D (TW I: 100, TW II: 90, TW III: 80, TW IV: 70).",
		tips: "Percepat pendaftaran kontrak eligible sebelum 30 Juni, maksimalkan penandatanganan Pra-DIPA/TW I, dan prioritaskan penerbitan SP2D belanja modal 53 di Triwulan I.",
	},
	{
		id: "g-05",
		title: "5. Penyelesaian Tagihan (SPM-LS)",
		weightLabel: "Bobot 10%",
		regulationSource: "PER-5/PB/2024 Pasal 8",
		summary:
			"Menilai ketepatan waktu penyelesaian tagihan SPM-LS kontraktual non-belanja pegawai maksimal 17 hari kerja sejak tanggal BAST/BAPP hingga diterima KPPN saat proses konversi.",
		formula:
			"Nilai PT = (Jumlah SPM-LS Kontraktual Non-Pegawai Tepat Waktu (≤ 17 Hari Kerja) ÷ Total SPM-LS Kontraktual Non-Pegawai Eligible) × 100. Kontribusi IKPA = min(Nilai PT × 10%, 10.00 pts). SPM Belanja Pegawai dikecualikan dari pembilang dan penyebut.",
		tips: "Titik awal adalah tanggal BAST/BAPP di Modul Komitmen SAKTI dan titik akhir adalah tanggal SPM diterima KPPN pada proses konversi (17 hari kerja, Senin–Jumat di luar libur). Koordinasikan kelengkapan berkas rekanan dan ajukan sebelum batas H-5.",
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

export interface RolePermissionItem {
	moduleName: string;
	adminKppnAccess: string;
	operatorSatkerAccess: string;
	isAdminAllowed: boolean;
	isOperatorAllowed: boolean;
}

export interface AuthPresetUser {
	id: string;
	name: string;
	email: string;
	role: "admin_kppn" | "operator_satker" | "multi_satker" | "pending";
	roleLabel: string;
	scopeName: string;
	scopeCode: string;
	badgeColor: string;
	description: string;
	targetPath: string;
	avatarInitials: string;
	permissionsSummary: string[];
}

export const mockAuthPresets: AuthPresetUser[] = [
	{
		id: "preset-admin",
		name: "Triandito Gilang",
		email: "admin.kppn@kemenkeu.go.id",
		role: "admin_kppn",
		roleLabel: "Admin KPPN",
		scopeName: "KPPN Malang",
		scopeCode: "032",
		badgeColor: "bg-primary/10 text-primary border-primary/20",
		description: "Akses administratif penuh pembina perbendaharaan untuk seluruh satker lingkup KPPN Malang.",
		targetPath: "/admin-kppn/dashboard",
		avatarInitials: "TG",
		permissionsSummary: [
			"Monitoring agregat seluruh satker mitra",
			"Kelola & publikasikan Rule Set IKPA berversi",
			"Konfigurasi Reminder Policy & Kalender Hari Kerja",
			"Manajemen akses pengguna & audit trail",
			"Ekspor laporan agregat KPPN (XLSX/PDF)",
		],
	},
	{
		id: "preset-operator",
		name: "Bambang Sudarsono",
		email: "bambang.keu@polinema.ac.id",
		role: "operator_satker",
		roleLabel: "Operator Satker",
		scopeName: "Politeknik Negeri Malang",
		scopeCode: "415234",
		badgeColor: "bg-success/10 text-success border-success/20",
		description: "Akses operasional pengelola keuangan dan pelaporan IKPA satker mandiri.",
		targetPath: "/operator/dashboard",
		avatarInitials: "BS",
		permissionsSummary: [
			"Input & edit data operasional (Pagu, RPD, Kontrak, UP, Output, SPM)",
			"Simulasi perhitungan interaktif What-If & komparasi skenario",
			"Pengaturan jadwal reminder & notifikasi satker",
			"Unduh laporan eksekutif dan matriks satker",
			"Read-only pada Rule Set & Kalender KPPN",
		],
	},
	{
		id: "preset-multi",
		name: "Dewi Sartika",
		email: "koordinator.wilayah@kemdikbud.go.id",
		role: "multi_satker",
		roleLabel: "Operator Multi-Satker",
		scopeName: "4 Satker Terdaftar",
		scopeCode: "MULTI",
		badgeColor: "bg-info/10 text-info border-info/20",
		description: "Akun pengelola yang mengampu beberapa satker di bawah kementerian/lembaga yang sama.",
		targetPath: "/select-organization",
		avatarInitials: "DS",
		permissionsSummary: [
			"Pemilihan satker aktif sebelum mengakses modul operasional",
			"Pencarian katalog satker naungan dengan cepat",
			"Input & simulasi data pada satker yang dipilih",
		],
	},
	{
		id: "preset-pending",
		name: "Pegawai Baru",
		email: "pegawai.baru@kemenkeu.go.id",
		role: "pending",
		roleLabel: "Akses Belum Terdaftar",
		scopeName: "Belum Ada Mapping",
		scopeCode: "-",
		badgeColor: "bg-warning/10 text-warning border-warning/20",
		description: "Akun terotentikasi yang belum diberikan hak akses satker atau KPPN.",
		targetPath: "/access-pending",
		avatarInitials: "PB",
		permissionsSummary: [
			"Halaman petunjuk konfirmasi akses ke Admin KPPN",
			"Tampilan email tersamarkan aman tanpa data satker",
		],
	},
];

export const mockPermissionMatrix: RolePermissionItem[] = [
	{
		moduleName: "Cakupan Data (Scope)",
		adminKppnAccess: "Seluruh Satker Mitra KPPN Malang",
		operatorSatkerAccess: "Satker Mandiri Terdaftar Saja",
		isAdminAllowed: true,
		isOperatorAllowed: true,
	},
	{
		moduleName: "Dashboard & Monitoring",
		adminKppnAccess: "Monitoring Agregat, Peringkat, & Risiko KPPN",
		operatorSatkerAccess: "Skor Mandiri, Gap Target, & Deadline Satker",
		isAdminAllowed: true,
		isOperatorAllowed: true,
	},
	{
		moduleName: "Input Data Transaksi (6 Indikator)",
		adminKppnAccess: "🔒 Read-Only (Hanya melihat)",
		operatorSatkerAccess: "✏️ Full Edit & Rekam Transaksi",
		isAdminAllowed: false,
		isOperatorAllowed: true,
	},
	{
		moduleName: "Simulasi Perhitungan IKPA",
		adminKppnAccess: "👁️ Monitoring Hasil Snapshot",
		operatorSatkerAccess: "⚡ Simulator Interaktif & Mode What-If",
		isAdminAllowed: false,
		isOperatorAllowed: true,
	},
	{
		moduleName: "Pengaturan Rule Set & Bobot",
		adminKppnAccess: "⚙️ Buat, Ubah Bobot, & Publikasikan",
		operatorSatkerAccess: "🔒 Read-Only (Mengikuti Regulasi Aktif)",
		isAdminAllowed: true,
		isOperatorAllowed: false,
	},
	{
		moduleName: "Kebijakan Reminder Policy",
		adminKppnAccess: "⚙️ Tetapkan Aturan Event & Batas Lead Time",
		operatorSatkerAccess: "🔔 Konfigurasi Jadwal Pengingat Internal",
		isAdminAllowed: true,
		isOperatorAllowed: true,
	},
	{
		moduleName: "Kalender Hari Kerja & Libur",
		adminKppnAccess: "📅 Kelola Override Hari Libur SKB",
		operatorSatkerAccess: "🔒 Read-Only Kalender Pembina",
		isAdminAllowed: true,
		isOperatorAllowed: false,
	},
	{
		moduleName: "Manajemen Akses & Hak Pengguna",
		adminKppnAccess: "👥 Tambah/Ubah Mapping User & Scope",
		operatorSatkerAccess: "🚫 Tidak Memiliki Akses",
		isAdminAllowed: true,
		isOperatorAllowed: false,
	},
	{
		moduleName: "Audit Log & Jejak Perubahan",
		adminKppnAccess: "📜 Full System Audit Trail & JSON Diff",
		operatorSatkerAccess: "📋 Riwayat Simulasi Satker Sendiri",
		isAdminAllowed: true,
		isOperatorAllowed: true,
	},
];

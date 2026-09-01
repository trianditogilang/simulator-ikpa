export interface AuditLogItem {
	id: string;
	timestamp: string;
	actorName: string;
	actorEmail: string;
	actorRole: string;
	actionType:
		| "publish"
		| "update"
		| "create"
		| "delete"
		| "import"
		| "override";
	actionLabel: string;
	targetEntity: string;
	entityName: string;
	organizationCode?: string;
	organizationName?: string;
	summary: string;
	requestId: string;
	ruleSetVersion?: string;
	beforeState?: Record<string, unknown> | null;
	afterState?: Record<string, unknown> | null;
}

export const mockAuditLogs: AuditLogItem[] = [
	{
		id: "aud-101",
		timestamp: "31 Agu 2026, 15.30 WIB",
		actorName: "Triandito Gilang",
		actorEmail: "admin.kppn@kemenkeu.go.id",
		actorRole: "Admin KPPN Malang",
		actionType: "publish",
		actionLabel: "Publikasi Regulasi",
		targetEntity: "rule_sets",
		entityName: "Rule Set 2026.1",
		summary:
			"Mempublikasikan Rule Set versi 2026.1 sebagai acuan aktif nasional.",
		requestId: "req_pub_882910398",
		ruleSetVersion: "2026.1",
		beforeState: { status: "draft", version: "2026.1" },
		afterState: {
			status: "published",
			version: "2026.1",
			publishedAt: "2026-08-31T15:30:00+07:00",
		},
	},
	{
		id: "aud-102",
		timestamp: "31 Agu 2026, 15.10 WIB",
		actorName: "Bambang Sudarsono",
		actorEmail: "bambang.keu@polinema.ac.id",
		actorRole: "Operator Satker",
		actionType: "update",
		actionLabel: "Ubah Data Tagihan",
		targetEntity: "contracts_invoices",
		entityName: "BAST K-001 (Lab Komputer)",
		organizationCode: "415234",
		organizationName: "Politeknik Negeri Malang",
		summary: "Memperbarui tanggal BAST dan nomor SPM-LS pendaftaran tagihan.",
		requestId: "req_inv_119283741",
		ruleSetVersion: "2026.1",
		beforeState: { spmNumber: null, status: "pending" },
		afterState: { spmNumber: "SPM-LS/2026/004", status: "submitted" },
	},
	{
		id: "aud-103",
		timestamp: "31 Agu 2026, 14.55 WIB",
		actorName: "Triandito Gilang",
		actorEmail: "admin.kppn@kemenkeu.go.id",
		actorRole: "Admin KPPN Malang",
		actionType: "create",
		actionLabel: "Tambah Akses Pengguna",
		targetEntity: "user_accesses",
		entityName: "Rian Prasetya (Operator Capaian Output)",
		organizationCode: "415234",
		organizationName: "Politeknik Negeri Malang",
		summary: "Menambahkan mapping akses operator satker untuk Polinema.",
		requestId: "req_usr_998124567",
		beforeState: null,
		afterState: {
			email: "rian.output@polinema.ac.id",
			role: "operator_satker",
			orgCode: "415234",
		},
	},
	{
		id: "aud-104",
		timestamp: "30 Agu 2026, 11.20 WIB",
		actorName: "Ahmad Fauzi",
		actorEmail: "operator.output@btnbromo.go.id",
		actorRole: "Operator Satker",
		actionType: "import",
		actionLabel: "Import Excel Data",
		targetEntity: "output_reports",
		entityName: "16 Rincian Output Bulan Agustus",
		organizationCode: "527812",
		organizationName: "BBTN Bromo Tengger Semeru",
		summary: "Import data realisasi fisik capaian output dari template Excel.",
		requestId: "req_imp_556213490",
		ruleSetVersion: "2026.1",
		beforeState: { rowCount: 0 },
		afterState: { rowCount: 16, validRows: 16, errorRows: 0 },
	},
	{
		id: "aud-105",
		timestamp: "29 Agu 2026, 16.45 WIB",
		actorName: "Triandito Gilang",
		actorEmail: "admin.kppn@kemenkeu.go.id",
		actorRole: "Admin KPPN Malang",
		actionType: "override",
		actionLabel: "Override Hari Libur",
		targetEntity: "workday_calendars",
		entityName: "17 Agustus 2026 (Hari Kemerdekaan)",
		summary:
			"Menandai 17 Agustus 2026 sebagai Hari Libur Nasional pada kalender kerja.",
		requestId: "req_cal_443198022",
		ruleSetVersion: "2026.1",
		beforeState: { isHoliday: false },
		afterState: { isHoliday: true, description: "Hari Kemerdekaan RI Ke-81" },
	},
];

export function getMockAuditLogs(): AuditLogItem[] {
	return mockAuditLogs;
}

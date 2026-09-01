export interface UserAccessItem {
	id: string;
	userId: string;
	name: string;
	email: string;
	accessType: "operator_satker" | "admin_kppn";
	accessTypeLabel: string;
	scopeCode: string;
	scopeName: string;
	status: "active" | "inactive";
	verifiedIdentity: boolean;
	createdAt: string;
	lastLogin?: string;
	isLastAdmin?: boolean;
}

export const mockUserAccesses: UserAccessItem[] = [
	{
		id: "acc-01",
		userId: "usr-01",
		name: "Triandito Gilang",
		email: "admin.kppn@kemenkeu.go.id",
		accessType: "admin_kppn",
		accessTypeLabel: "Admin KPPN",
		scopeCode: "032",
		scopeName: "KPPN Malang",
		status: "active",
		verifiedIdentity: true,
		createdAt: "01 Jan 2026",
		lastLogin: "31 Agu 2026, 15.30 WIB",
		isLastAdmin: false,
	},
	{
		id: "acc-02",
		userId: "usr-02",
		name: "Siti Rahmawati",
		email: "siti.rahma@kemenkeu.go.id",
		accessType: "admin_kppn",
		accessTypeLabel: "Admin KPPN",
		scopeCode: "032",
		scopeName: "KPPN Malang",
		status: "active",
		verifiedIdentity: true,
		createdAt: "10 Jan 2026",
		lastLogin: "30 Agu 2026, 09.15 WIB",
		isLastAdmin: false,
	},
	{
		id: "acc-03",
		userId: "usr-03",
		name: "Bambang Sudarsono",
		email: "bambang.keu@polinema.ac.id",
		accessType: "operator_satker",
		accessTypeLabel: "Operator Satker",
		scopeCode: "415234",
		scopeName: "Politeknik Negeri Malang",
		status: "active",
		verifiedIdentity: true,
		createdAt: "15 Jan 2026",
		lastLogin: "31 Agu 2026, 14.50 WIB",
	},
	{
		id: "acc-04",
		userId: "usr-04",
		name: "Dewi Lestari",
		email: "dewi.anggaran@polinema.ac.id",
		accessType: "operator_satker",
		accessTypeLabel: "Operator Satker",
		scopeCode: "415234",
		scopeName: "Politeknik Negeri Malang",
		status: "active",
		verifiedIdentity: true,
		createdAt: "20 Jan 2026",
		lastLogin: "30 Agu 2026, 10.15 WIB",
	},
	{
		id: "acc-05",
		userId: "usr-05",
		name: "Ahmad Fauzi",
		email: "operator.output@btnbromo.go.id",
		accessType: "operator_satker",
		accessTypeLabel: "Operator Satker",
		scopeCode: "527812",
		scopeName: "BBTN Bromo Tengger Semeru",
		status: "active",
		verifiedIdentity: true,
		createdAt: "01 Feb 2026",
		lastLogin: "31 Agu 2026, 11.20 WIB",
	},
	{
		id: "acc-06",
		userId: "usr-06",
		name: "Hendra Wijaya",
		email: "hendra.pn@pn-malang.go.id",
		accessType: "operator_satker",
		accessTypeLabel: "Operator Satker",
		scopeCode: "632190",
		scopeName: "Pengadilan Negeri Malang",
		status: "inactive",
		verifiedIdentity: false,
		createdAt: "15 Feb 2026",
		lastLogin: "01 Jul 2026, 14.00 WIB",
	},
];

export function getMockUserAccesses(): UserAccessItem[] {
	return mockUserAccesses;
}

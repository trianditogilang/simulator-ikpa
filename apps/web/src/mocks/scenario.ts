import type { ApiError } from "@simulator-ikpa/contracts";

export const MOCK_SCENARIO_IDS = [
	"SCN-NORMAL",
	"SCN-EMPTY",
	"SCN-INCOMPLETE",
	"SCN-RISKY",
	"SCN-STALE-RULE-SET",
	"SCN-POLICY-LOCKED",
	"SCN-DELIVERY-FAILED",
	"SCN-UNAUTHORIZED",
	"SCN-SERVER-ERROR",
] as const;

export type MockScenarioId = (typeof MOCK_SCENARIO_IDS)[number];
export type MockScenarioState =
	| "normal"
	| "empty"
	| "incomplete"
	| "risky"
	| "stale_rule_set"
	| "policy_locked"
	| "delivery_failed"
	| "unauthorized"
	| "server_error";
export type MockScenarioAudience =
	| "operator_satker"
	| "admin_kppn"
	| "unauthenticated";

export type MockScenario = {
	id: MockScenarioId;
	label: string;
	description: string;
	primaryRoute: string;
	state: MockScenarioState;
	audience: readonly MockScenarioAudience[];
	error?: ApiError;
};

export const MOCK_SCENARIOS = [
	{
		id: "SCN-NORMAL",
		label: "Data lengkap dan sehat",
		description: "Dashboard dengan tujuh indikator lengkap dan score sehat.",
		primaryRoute: "/operator/dashboard",
		state: "normal",
		audience: ["operator_satker"],
	},
	{
		id: "SCN-EMPTY",
		label: "Belum ada data",
		description: "RPD dan realisasi belum memiliki data pada periode aktif.",
		primaryRoute: "/operator/data/rpd-realization",
		state: "empty",
		audience: ["operator_satker"],
	},
	{
		id: "SCN-INCOMPLETE",
		label: "Data belum lengkap",
		description: "Hasil masih estimasi karena beberapa domain belum tersedia.",
		primaryRoute: "/operator/simulation",
		state: "incomplete",
		audience: ["operator_satker"],
	},
	{
		id: "SCN-RISKY",
		label: "Nilai atau deadline berisiko",
		description:
			"Score di bawah target dan terdapat deadline yang perlu ditindaklanjuti.",
		primaryRoute: "/operator/dashboard",
		state: "risky",
		audience: ["operator_satker"],
	},
	{
		id: "SCN-STALE-RULE-SET",
		label: "Snapshot memakai aturan lama",
		description:
			"Snapshot historis memakai rule set yang sudah retired atau berbeda.",
		primaryRoute: "/operator/history",
		state: "stale_rule_set",
		audience: ["operator_satker"],
	},
	{
		id: "SCN-POLICY-LOCKED",
		label: "Field reminder dikunci policy",
		description: "Field mandatory dikunci oleh policy KPPN yang aktif.",
		primaryRoute: "/operator/reminders",
		state: "policy_locked",
		audience: ["operator_satker"],
	},
	{
		id: "SCN-DELIVERY-FAILED",
		label: "Reminder gagal dikirim",
		description: "Delivery gagal dan tersedia jalur retry yang dapat diaudit.",
		primaryRoute: "/operator/reminders",
		state: "delivery_failed",
		audience: ["operator_satker", "admin_kppn"],
	},
	{
		id: "SCN-UNAUTHORIZED",
		label: "User tanpa mapping aktif",
		description:
			"User terautentikasi tetapi belum memiliki mapping akses aktif.",
		primaryRoute: "/access-pending",
		state: "unauthorized",
		audience: ["unauthenticated"],
	},
	{
		id: "SCN-SERVER-ERROR",
		label: "Server error",
		description:
			"Fetch gagal dengan pesan aman dan request ID yang dapat ditelusuri.",
		primaryRoute: "/operator/dashboard",
		state: "server_error",
		audience: ["operator_satker"],
		error: {
			code: "SERVICE_UNAVAILABLE",
			message: "Data tidak dapat dimuat. Coba lagi.",
			requestId: "req_mock_5001",
			retryable: true,
		},
	},
] as const satisfies readonly MockScenario[];

export function isMockScenarioId(value: string): value is MockScenarioId {
	return MOCK_SCENARIO_IDS.some((scenarioId) => scenarioId === value);
}

export function getMockScenario(id: string): MockScenario {
	const scenario = MOCK_SCENARIOS.find((candidate) => candidate.id === id);

	if (!scenario) {
		throw new RangeError(`Mock scenario tidak dikenal: ${id}`);
	}

	return scenario;
}

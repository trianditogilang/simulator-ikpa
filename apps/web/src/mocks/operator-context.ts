import type { GlobalContext } from "@simulator-ikpa/contracts";

export const mockOperatorContext: GlobalContext = {
	access: {
		status: "operator_single_scope",
		userId: "11111111-1111-4111-8111-111111111111",
		accessType: "operator_satker",
		organizations: [
			{
				id: "22222222-2222-4222-8222-222222222222",
				code: "123456",
				name: "Kantor Pelayanan Perbendaharaan Satker Contoh",
				timezone: "Asia/Jakarta",
			},
		],
		activeOrganizationId: "22222222-2222-4222-8222-222222222222",
	},
	activeOrganization: {
		id: "22222222-2222-4222-8222-222222222222",
		code: "123456",
		name: "Kantor Pelayanan Perbendaharaan Satker Contoh",
		timezone: "Asia/Jakarta",
	},
	activeKppnScope: null,
	fiscalYear: {
		id: "33333333-3333-4333-8333-333333333333",
		year: 2026,
	},
	period: {
		kind: "month",
		value: 8,
	},
	ruleSet: {
		id: "44444444-4444-4444-8444-444444444444",
		version: 1,
		status: "published",
		effectiveFrom: "2026-01-01T00:00:00+07:00",
		calendarVersionId: "55555555-5555-4555-8555-555555555555",
	},
	timezone: "Asia/Jakarta",
	generatedAt: "2026-08-31T15:00:00+07:00",
};

export function getMockOperatorContext(): GlobalContext {
	return mockOperatorContext;
}

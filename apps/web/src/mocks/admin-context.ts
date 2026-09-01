import type { GlobalContext } from "@simulator-ikpa/contracts";

export const mockAdminContext: GlobalContext = {
	access: {
		status: "admin",
		userId: "99999999-9999-4999-8999-999999999999",
		accessType: "admin_kppn",
		kppnScopes: [
			{
				id: "88888888-8888-4888-8888-888888888888",
				code: "032",
				name: "KPPN Malang",
			},
		],
	},
	activeOrganization: null,
	activeKppnScope: {
		id: "88888888-8888-4888-8888-888888888888",
		code: "032",
		name: "KPPN Malang",
	},
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

export function getMockAdminContext(): GlobalContext {
	return mockAdminContext;
}

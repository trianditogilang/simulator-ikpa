import { describe, expect, it } from "vitest";
import {
	decimalStringSchema,
	globalContextSchema,
	paginatedSchema,
	snapshotSummarySchema,
} from "./index.ts";

const organization = {
	id: "11111111-1111-4111-8111-111111111111",
	code: "012345",
	name: "Satker Contoh",
	timezone: "Asia/Jakarta",
};

const ruleSet = {
	id: "22222222-2222-4222-8222-222222222222",
	version: 1,
	status: "published" as const,
	effectiveFrom: "2026-01-01T00:00:00+07:00",
	calendarVersionId: "33333333-3333-4333-8333-333333333333",
};

describe("shared contracts", () => {
	it("accepts valid DTOs and rejects unsafe shapes", () => {
	const context = globalContextSchema.parse({
		access: {
			status: "operator_single_scope",
			userId: "44444444-4444-4444-8444-444444444444",
			accessType: "operator_satker",
			organizations: [organization],
			activeOrganizationId: organization.id,
		},
		activeOrganization: organization,
		activeKppnScope: null,
		fiscalYear: { id: "55555555-5555-4555-8555-555555555555", year: 2026 },
		period: { kind: "month", value: 8 },
		ruleSet,
		timezone: "Asia/Jakarta",
		generatedAt: "2026-08-31T21:12:00+07:00",
	});
	expect(context.access.status).toBe("operator_single_scope");

	const page = paginatedSchema(snapshotSummarySchema).parse({
		items: [
			{
				id: "66666666-6666-4666-8666-666666666666",
				simulationId: "77777777-7777-4777-8777-777777777777",
				name: "Agustus 2026",
				type: "actual",
				periodEnd: "2026-08-31",
				totalScore: "94.25",
				ruleSet,
				calendarVersionId: ruleSet.calendarVersionId,
				createdAt: "2026-08-31T21:12:00+07:00",
			},
		],
		page: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
	});
	expect(page.items[0]?.totalScore).toBe("94.25");
	expect(decimalStringSchema.safeParse(94.25).success).toBe(false);
	expect(decimalStringSchema.safeParse("1e3").success).toBe(false);
	expect(
		globalContextSchema.safeParse({ ...context, unexpectedDatabaseField: true })
			.success,
	).toBe(false);
	});
});

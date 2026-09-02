import { describe, expect, it, vi } from "vitest";
import { writeAudit } from "./write-audit";

describe("writeAudit", () => {
	it("inserts audit row with before/after and redacts sensitive keys", async () => {
		const mockReturning = vi.fn().mockResolvedValue([{ id: "audit-1" }]);
		const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
		const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
		const mockDb = { insert: mockInsert } as never;

		await writeAudit(mockDb, {
			actorId: "11111111-1111-4111-8111-111111111111",
			actorAccessType: "operator_satker",
			entityType: "budgets",
			entityId: "22222222-2222-4222-8222-222222222222",
			action: "create",
			beforeJson: null,
			afterJson: {
				amount: "1000",
				clerkUserId: "user_123",
				nested: { token: "abc" },
			},
			orgId: "33333333-3333-4333-8333-333333333333",
			requestId: "req-1",
		});

		expect(mockInsert).toHaveBeenCalledTimes(1);
		const calledValues = mockValues.mock.calls[0][0];
		expect(calledValues.entityType).toBe("budgets");
		expect(calledValues.requestId).toBe("req-1");
		// redacted
		expect(calledValues.afterJson.clerkUserId).toBe("[REDACTED]");
		expect(calledValues.afterJson.nested.token).toBe("[REDACTED]");
		expect(calledValues.afterJson.amount).toBe("1000");
	});

	it("handles null actor and missing optional fields", async () => {
		const mockReturning = vi.fn().mockResolvedValue([{ id: "audit-2" }]);
		const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
		const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
		const mockDb = { insert: mockInsert } as never;

		const row = await writeAudit(mockDb, {
			actorId: null,
			entityType: "fiscal_years",
			action: "update",
			beforeJson: { isBlu: false },
			afterJson: { isBlu: true },
		});

		expect(row).toEqual({ id: "audit-2" });
		const calledValues = mockValues.mock.calls[0][0];
		expect(calledValues.actorId).toBeNull();
		expect(calledValues.policyId).toBeNull();
	});
});

import { describe, expect, it, vi } from "vitest";
import { resolveUserAccess } from "./access-resolver";

const mockUserId = "11111111-1111-4111-8111-111111111111";
const mockOrgId1 = "22222222-2222-4222-8222-222222222222";
const mockOrgId2 = "33333333-3333-4333-8333-333333333333";
const mockScopeId1 = "44444444-4444-4444-8444-444444444444";

describe("resolveUserAccess", () => {
	it("returns unauthenticated when clerkUserId is null", async () => {
		const mockDb = {} as unknown as Parameters<typeof resolveUserAccess>[0];
		const result = await resolveUserAccess(mockDb, { clerkUserId: null });

		expect(result).toEqual({ status: "unauthenticated" });
	});

	it("returns unauthenticated when user is not found in database", async () => {
		const mockDb = {
			select: vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue([]),
					}),
				}),
			}),
		} as unknown as Parameters<typeof resolveUserAccess>[0];

		const result = await resolveUserAccess(mockDb, {
			clerkUserId: "unknown_clerk",
		});
		expect(result).toEqual({ status: "unauthenticated" });
	});

	it("returns unmapped when user has no active accesses", async () => {
		const mockDb = {
			select: vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue([{ id: mockUserId }]),
					}),
					leftJoin: vi.fn().mockReturnValue({
						leftJoin: vi.fn().mockReturnValue({
							where: vi.fn().mockResolvedValue([]),
						}),
					}),
				}),
			}),
		} as unknown as Parameters<typeof resolveUserAccess>[0];

		const result = await resolveUserAccess(mockDb, {
			clerkUserId: "clerk_no_access",
		});
		expect(result).toEqual({
			status: "unmapped",
			userId: mockUserId,
		});
	});

	it("returns invalid_conflict when user has both operator and admin mappings (fail-closed)", async () => {
		const mixedAccesses = [
			{
				accessType: "operator_satker",
				orgId: mockOrgId1,
				orgCode: "411782",
				orgName: "Satker Contoh",
				orgTimezone: "Asia/Jakarta",
				kppnScopeId: null,
				kppnCode: null,
				kppnName: null,
			},
			{
				accessType: "admin_kppn",
				orgId: null,
				orgCode: null,
				orgName: null,
				orgTimezone: null,
				kppnScopeId: mockScopeId1,
				kppnCode: "089",
				kppnName: "KPPN Jakarta II",
			},
		];

		const mockDb = {
			select: vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue([{ id: mockUserId }]),
					}),
					leftJoin: vi.fn().mockReturnValue({
						leftJoin: vi.fn().mockReturnValue({
							where: vi.fn().mockResolvedValue(mixedAccesses),
						}),
					}),
				}),
			}),
		} as unknown as Parameters<typeof resolveUserAccess>[0];

		const result = await resolveUserAccess(mockDb, {
			clerkUserId: "clerk_mixed",
		});
		expect(result).toEqual({
			status: "invalid_conflict",
			userId: mockUserId,
			code: "ACCESS_MAPPING_CONFLICT",
		});
	});

	it("resolves admin with distinct scopes", async () => {
		const adminAccesses = [
			{
				accessType: "admin_kppn",
				orgId: null,
				orgCode: null,
				orgName: null,
				orgTimezone: null,
				kppnScopeId: mockScopeId1,
				kppnCode: "089",
				kppnName: "KPPN Jakarta II",
			},
		];

		const mockDb = {
			select: vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue([{ id: mockUserId }]),
					}),
					leftJoin: vi.fn().mockReturnValue({
						leftJoin: vi.fn().mockReturnValue({
							where: vi.fn().mockResolvedValue(adminAccesses),
						}),
					}),
				}),
			}),
		} as unknown as Parameters<typeof resolveUserAccess>[0];

		const result = await resolveUserAccess(mockDb, {
			clerkUserId: "clerk_admin",
		});
		expect(result).toEqual({
			status: "admin",
			userId: mockUserId,
			accessType: "admin_kppn",
			kppnScopes: [{ id: mockScopeId1, code: "089", name: "KPPN Jakarta II" }],
		});
	});

	it("resolves operator single scope", async () => {
		const singleOrgAccess = [
			{
				accessType: "operator_satker",
				orgId: mockOrgId1,
				orgCode: "411782",
				orgName: "Satker Contoh",
				orgTimezone: "Asia/Jakarta",
				kppnScopeId: null,
				kppnCode: null,
				kppnName: null,
			},
		];

		const mockDb = {
			select: vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue([{ id: mockUserId }]),
					}),
					leftJoin: vi.fn().mockReturnValue({
						leftJoin: vi.fn().mockReturnValue({
							where: vi.fn().mockResolvedValue(singleOrgAccess),
						}),
					}),
				}),
			}),
		} as unknown as Parameters<typeof resolveUserAccess>[0];

		const result = await resolveUserAccess(mockDb, {
			clerkUserId: "clerk_operator",
		});
		expect(result).toEqual({
			status: "operator_single_scope",
			userId: mockUserId,
			accessType: "operator_satker",
			organizations: [
				{
					id: mockOrgId1,
					code: "411782",
					name: "Satker Contoh",
					timezone: "Asia/Jakarta",
				},
			],
			activeOrganizationId: mockOrgId1,
		});
	});

	it("resolves operator multiple scopes with requestedOrgId", async () => {
		const multiOrgAccess = [
			{
				accessType: "operator_satker",
				orgId: mockOrgId1,
				orgCode: "411782",
				orgName: "Satker Contoh A",
				orgTimezone: "Asia/Jakarta",
				kppnScopeId: null,
				kppnCode: null,
				kppnName: null,
			},
			{
				accessType: "operator_satker",
				orgId: mockOrgId2,
				orgCode: "411783",
				orgName: "Satker Contoh B",
				orgTimezone: "Asia/Makassar",
				kppnScopeId: null,
				kppnCode: null,
				kppnName: null,
			},
		];

		const mockDb = {
			select: vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue([{ id: mockUserId }]),
					}),
					leftJoin: vi.fn().mockReturnValue({
						leftJoin: vi.fn().mockReturnValue({
							where: vi.fn().mockResolvedValue(multiOrgAccess),
						}),
					}),
				}),
			}),
		} as unknown as Parameters<typeof resolveUserAccess>[0];

		// Without requestedOrgId -> activeOrganizationId: null
		const res1 = await resolveUserAccess(mockDb, {
			clerkUserId: "clerk_multi",
		});
		expect(res1.status).toBe("operator_multiple_scopes");
		if (res1.status === "operator_multiple_scopes") {
			expect(res1.activeOrganizationId).toBeNull();
			expect(res1.organizations).toHaveLength(2);
		}

		// With valid requestedOrgId -> activeOrganizationId: mockOrgId2
		const res2 = await resolveUserAccess(mockDb, {
			clerkUserId: "clerk_multi",
			requestedOrgId: mockOrgId2,
		});
		expect(res2.status).toBe("operator_multiple_scopes");
		if (res2.status === "operator_multiple_scopes") {
			expect(res2.activeOrganizationId).toBe(mockOrgId2);
		}

		// With unauthorized requestedOrgId -> activeOrganizationId: null
		const res3 = await resolveUserAccess(mockDb, {
			clerkUserId: "clerk_multi",
			requestedOrgId: "99999999-9999-4999-8999-999999999999",
		});
		expect(res3.status).toBe("operator_multiple_scopes");
		if (res3.status === "operator_multiple_scopes") {
			expect(res3.activeOrganizationId).toBeNull();
		}
	});
});

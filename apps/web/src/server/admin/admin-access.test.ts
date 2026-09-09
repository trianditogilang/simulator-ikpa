import { describe, expect, it, vi } from "vitest";
import {
	grantAdminAccess,
	grantOperatorAccess,
	LastAdminRevocationError,
	toggleAccessActive,
} from "@simulator-ikpa/access-control";

describe("Admin Access & Last Admin Protection Unit Tests", () => {
	const mockAdminActorId = "11111111-1111-4111-8111-111111111111";
	const mockTargetUserId = "22222222-2222-4222-8222-222222222222";
	const mockKppnScopeId = "33333333-3333-4333-8333-333333333333";
	const mockOrgId = "44444444-4444-4444-8444-444444444444";
	const mockAccessId = "55555555-5555-4555-8555-555555555555";

	it("grants operator access and inserts audit log record", async () => {
		const mockCreated = {
			id: mockAccessId,
			userId: mockTargetUserId,
			accessType: "operator_satker",
			orgId: mockOrgId,
			active: true,
		};

		const mockDb = {
			select: vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue([]),
					}),
				}),
			}),
			insert: vi.fn().mockReturnValue({
				values: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([mockCreated]),
				}),
			}),
		} as unknown as Parameters<typeof grantOperatorAccess>[0];

		const res = await grantOperatorAccess(mockDb, {
			actorUserId: mockAdminActorId,
			targetUserId: mockTargetUserId,
			orgId: mockOrgId,
		});

		expect(res).toEqual(mockCreated);
		expect(mockDb.insert).toHaveBeenCalledTimes(2); // userAccesses + auditLogs
	});

	it("grants admin access with KPPN scope and inserts audit log record", async () => {
		const mockCreated = {
			id: mockAccessId,
			userId: mockTargetUserId,
			accessType: "admin_kppn",
			kppnScopeId: mockKppnScopeId,
			active: true,
		};

		const mockDb = {
			select: vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue([]),
					}),
				}),
			}),
			insert: vi.fn().mockReturnValue({
				values: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([mockCreated]),
				}),
			}),
		} as unknown as Parameters<typeof grantAdminAccess>[0];

		const res = await grantAdminAccess(mockDb, {
			actorUserId: mockAdminActorId,
			targetUserId: mockTargetUserId,
			kppnScopeId: mockKppnScopeId,
		});

		expect(res).toEqual(mockCreated);
		expect(mockDb.insert).toHaveBeenCalledTimes(2); // userAccesses + auditLogs
	});

	it("enforces Last Admin Protection when deactivating the sole active admin", async () => {
		const targetAccess = {
			id: mockAccessId,
			userId: mockTargetUserId,
			accessType: "admin_kppn",
			kppnScopeId: mockKppnScopeId,
			active: true,
		};

		let callCount = 0;
		const mockDb = {
			select: vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockImplementation(() => {
						callCount++;
						if (callCount === 1) {
							return { limit: () => Promise.resolve([targetAccess]) };
						}
						return Promise.resolve([{ total: 1 }]); // Only 1 active admin
					}),
				}),
			}),
		} as unknown as Parameters<typeof toggleAccessActive>[0];

		await expect(
			toggleAccessActive(mockDb, {
				actorUserId: mockAdminActorId,
				userAccessId: mockAccessId,
				active: false,
			}),
		).rejects.toThrow(LastAdminRevocationError);
	});
});

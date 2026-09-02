import { describe, expect, it, vi } from "vitest";
import {
	AccessConflictError,
	grantAdminAccess,
	grantOperatorAccess,
	LastAdminRevocationError,
	revokeAccess,
	toggleAccessActive,
} from "./manage-access";

const mockActorId = "11111111-1111-4111-8111-111111111111";
const mockTargetId = "22222222-2222-4222-8222-222222222222";
const mockOrgId = "33333333-3333-4333-8333-333333333333";
const mockScopeId = "44444444-4444-4444-8444-444444444444";
const mockAccessId = "55555555-5555-4555-8555-555555555555";

describe("manage-access", () => {
	describe("grantOperatorAccess", () => {
		it("successfully grants operator access and logs audit", async () => {
			const mockCreated = {
				id: mockAccessId,
				userId: mockTargetId,
				accessType: "operator_satker",
				orgId: mockOrgId,
				active: true,
			};

			const mockDb = {
				select: vi.fn().mockReturnValue({
					from: vi.fn().mockReturnValue({
						where: vi.fn().mockReturnValue({
							limit: vi.fn().mockResolvedValue([]), // No conflicting admin access
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
				actorUserId: mockActorId,
				targetUserId: mockTargetId,
				orgId: mockOrgId,
			});

			expect(res).toEqual(mockCreated);
			expect(mockDb.insert).toHaveBeenCalledTimes(2); // userAccesses + auditLogs
		});

		it("throws AccessConflictError when target user already has active admin access", async () => {
			const mockDb = {
				select: vi.fn().mockReturnValue({
					from: vi.fn().mockReturnValue({
						where: vi.fn().mockReturnValue({
							limit: vi.fn().mockResolvedValue([{ id: "admin-acc-1" }]),
						}),
					}),
				}),
			} as unknown as Parameters<typeof grantOperatorAccess>[0];

			await expect(
				grantOperatorAccess(mockDb, {
					actorUserId: mockActorId,
					targetUserId: mockTargetId,
					orgId: mockOrgId,
				}),
			).rejects.toThrow(AccessConflictError);
		});
	});

	describe("grantAdminAccess", () => {
		it("successfully grants admin access and logs audit", async () => {
			const mockCreated = {
				id: mockAccessId,
				userId: mockTargetId,
				accessType: "admin_kppn",
				kppnScopeId: mockScopeId,
				active: true,
			};

			const mockDb = {
				select: vi.fn().mockReturnValue({
					from: vi.fn().mockReturnValue({
						where: vi.fn().mockReturnValue({
							limit: vi.fn().mockResolvedValue([]), // No conflicting operator access
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
				actorUserId: mockActorId,
				targetUserId: mockTargetId,
				kppnScopeId: mockScopeId,
			});

			expect(res).toEqual(mockCreated);
			expect(mockDb.insert).toHaveBeenCalledTimes(2);
		});

		it("throws AccessConflictError when target user already has active operator access", async () => {
			const mockDb = {
				select: vi.fn().mockReturnValue({
					from: vi.fn().mockReturnValue({
						where: vi.fn().mockReturnValue({
							limit: vi.fn().mockResolvedValue([{ id: "op-acc-1" }]),
						}),
					}),
				}),
			} as unknown as Parameters<typeof grantAdminAccess>[0];

			await expect(
				grantAdminAccess(mockDb, {
					actorUserId: mockActorId,
					targetUserId: mockTargetId,
					kppnScopeId: mockScopeId,
				}),
			).rejects.toThrow(AccessConflictError);
		});
	});

	describe("revokeAccess & Last Admin Protection", () => {
		it("throws LastAdminRevocationError when revoking the only active admin", async () => {
			const targetAccess = {
				id: mockAccessId,
				userId: mockTargetId,
				accessType: "admin_kppn",
				kppnScopeId: mockScopeId,
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
							return Promise.resolve([{ total: 1 }]); // Only 1 active admin!
						}),
					}),
				}),
			} as unknown as Parameters<typeof revokeAccess>[0];

			await expect(
				revokeAccess(mockDb, {
					actorUserId: mockActorId,
					userAccessId: mockAccessId,
				}),
			).rejects.toThrow(LastAdminRevocationError);
		});

		it("successfully revokes admin when more than 1 active admin exists", async () => {
			const targetAccess = {
				id: mockAccessId,
				userId: mockTargetId,
				accessType: "admin_kppn",
				kppnScopeId: mockScopeId,
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
							return Promise.resolve([{ total: 3 }]); // 3 active admins!
						}),
					}),
				}),
				delete: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						returning: vi.fn().mockResolvedValue([targetAccess]),
					}),
				}),
				insert: vi.fn().mockReturnValue({
					values: vi.fn().mockResolvedValue({}),
				}),
			} as unknown as Parameters<typeof revokeAccess>[0];

			const res = await revokeAccess(mockDb, {
				actorUserId: mockActorId,
				userAccessId: mockAccessId,
			});

			expect(res).toEqual(targetAccess);
		});
	});

	describe("toggleAccessActive & Last Admin Protection", () => {
		it("throws LastAdminRevocationError when deactivating the last active admin", async () => {
			const targetAccess = {
				id: mockAccessId,
				userId: mockTargetId,
				accessType: "admin_kppn",
				kppnScopeId: mockScopeId,
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
							return Promise.resolve([{ total: 1 }]);
						}),
					}),
				}),
			} as unknown as Parameters<typeof toggleAccessActive>[0];

			await expect(
				toggleAccessActive(mockDb, {
					actorUserId: mockActorId,
					userAccessId: mockAccessId,
					active: false,
				}),
			).rejects.toThrow(LastAdminRevocationError);
		});

		it("allows activating an inactive access without count check", async () => {
			const targetAccess = {
				id: mockAccessId,
				userId: mockTargetId,
				accessType: "admin_kppn",
				kppnScopeId: mockScopeId,
				active: false,
			};
			const updated = { ...targetAccess, active: true };

			const mockDb = {
				select: vi.fn().mockReturnValue({
					from: vi.fn().mockReturnValue({
						where: vi.fn().mockReturnValue({
							limit: vi.fn().mockResolvedValue([targetAccess]),
						}),
					}),
				}),
				update: vi.fn().mockReturnValue({
					set: vi.fn().mockReturnValue({
						where: vi.fn().mockReturnValue({
							returning: vi.fn().mockResolvedValue([updated]),
						}),
					}),
				}),
				insert: vi.fn().mockReturnValue({
					values: vi.fn().mockResolvedValue({}),
				}),
			} as unknown as Parameters<typeof toggleAccessActive>[0];

			const res = await toggleAccessActive(mockDb, {
				actorUserId: mockActorId,
				userAccessId: mockAccessId,
				active: true,
			});

			expect(res).toEqual(updated);
		});
	});
});

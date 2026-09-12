import { describe, expect, it, vi } from "vitest";
import {
	AccessConflictError,
	EmailLockedError,
	grantAdminAccess,
	grantOperatorAccess,
	hardDeleteUser,
	LastAdminRevocationError,
	OperatorAlreadyExistsError,
	revokeAccess,
	SelfDeleteError,
	toggleAccessActive,
	updateUserProfile,
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
			let call = 0;
			const mockDb = {
				select: vi.fn().mockImplementation(() => ({
					from: vi.fn().mockReturnValue({
						where: vi.fn().mockImplementation(() => {
							call++;
							if (call === 1) return { limit: () => Promise.resolve([]) };
							return Promise.resolve([]);
						}),
					}),
				})),
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

	describe("guard 1-operator-per-satker", () => {
		it("rejects second active operator for same satker", async () => {
			let selCall = 0;
			const mockDb = {
				select: vi.fn().mockImplementation(() => ({
					from: vi.fn().mockReturnValue({
						where: vi.fn().mockImplementation(() => {
							selCall++;
							if (selCall === 1) return { limit: () => Promise.resolve([]) };
							return { limit: () => Promise.resolve([{ id: "existing-op" }]) };
						}),
					}),
				})),
			} as unknown as Parameters<typeof grantOperatorAccess>[0];
			await expect(grantOperatorAccess(mockDb, { actorUserId: mockActorId, targetUserId: mockTargetId, orgId: mockOrgId })).rejects.toThrow(OperatorAlreadyExistsError);
		});
	});

	describe("admin_slot smallest free allocation", () => {
		it("allocates smallest free slot in scope", async () => {
			let selCall = 0;
			const valuesCalls: unknown[] = [];
			const mockCreated = { id: mockAccessId, userId: mockTargetId, accessType: "admin_kppn", kppnScopeId: mockScopeId, adminSlot: 2, active: true };
			const mockDb = {
				select: vi.fn().mockImplementation(() => ({
					from: vi.fn().mockReturnValue({
						where: vi.fn().mockImplementation(() => {
							selCall++;
							if (selCall === 1) return { limit: () => Promise.resolve([]) };
							return Promise.resolve([{ adminSlot: 1 }, { adminSlot: 3 }]);
						}),
					}),
				})),
				insert: vi.fn().mockImplementation(() => ({
					values: vi.fn().mockImplementation((vals: unknown) => {
						valuesCalls.push(vals);
						return { returning: vi.fn().mockResolvedValue([mockCreated]) };
					}),
				})),
			} as unknown as Parameters<typeof grantAdminAccess>[0];
			const res = await grantAdminAccess(mockDb, { actorUserId: mockActorId, targetUserId: mockTargetId, kppnScopeId: mockScopeId });
			expect(res).toEqual(mockCreated);
			expect((valuesCalls[0] as { adminSlot: number }).adminSlot).toBe(2);
		});
		it("reuses slot 1 when scope empty", async () => {
			let selCall = 0;
			const valuesCalls: unknown[] = [];
			const mockCreated = { id: mockAccessId, userId: mockTargetId, accessType: "admin_kppn", kppnScopeId: mockScopeId, adminSlot: 1, active: true };
			const mockDb = {
				select: vi.fn().mockImplementation(() => ({
					from: vi.fn().mockReturnValue({
						where: vi.fn().mockImplementation(() => {
							selCall++;
							if (selCall === 1) return { limit: () => Promise.resolve([]) };
							return Promise.resolve([]);
						}),
					}),
				})),
				insert: vi.fn().mockImplementation(() => ({
					values: vi.fn().mockImplementation((vals: unknown) => {
						valuesCalls.push(vals);
						return { returning: vi.fn().mockResolvedValue([mockCreated]) };
					}),
				})),
			} as unknown as Parameters<typeof grantAdminAccess>[0];
			await grantAdminAccess(mockDb, { actorUserId: mockActorId, targetUserId: mockTargetId, kppnScopeId: mockScopeId });
			expect((valuesCalls[0] as { adminSlot: number }).adminSlot).toBe(1);
		});
	});

	describe("hardDeleteUser", () => {
		it("rejects self delete", async () => {
			const mockDb = {} as unknown as Parameters<typeof hardDeleteUser>[0];
			await expect(hardDeleteUser(mockDb, { actorUserId: mockActorId, targetUserId: mockActorId })).rejects.toThrow(SelfDeleteError);
		});
		it("rejects deleting last active admin", async () => {
			let call = 0;
			const targetUser = { id: mockTargetId, clerkUserId: "manual_1", email: "a@b.com", name: "A" };
			const mockDb = {
				select: vi.fn().mockImplementation(() => ({
					from: vi.fn().mockReturnValue({
						where: vi.fn().mockImplementation(() => {
							call++;
							if (call === 1) return { limit: () => Promise.resolve([targetUser]) };
							if (call === 2) return Promise.resolve([{ kppnScopeId: mockScopeId }]);
							return Promise.resolve([{ total: 1 }]);
						}),
					}),
				})),
			} as unknown as Parameters<typeof hardDeleteUser>[0];
			await expect(hardDeleteUser(mockDb, { actorUserId: mockActorId, targetUserId: mockTargetId })).rejects.toThrow(LastAdminRevocationError);
		});
		it("hard deletes user and audits when not last admin", async () => {
			let call = 0;
			const targetUser = { id: mockTargetId, clerkUserId: "manual_1", email: "a@b.com", name: "A" };
			const mockDb = {
				select: vi.fn().mockImplementation(() => ({
					from: vi.fn().mockReturnValue({
						where: vi.fn().mockImplementation(() => {
							call++;
							if (call === 1) return { limit: () => Promise.resolve([targetUser]) };
							if (call === 2) return Promise.resolve([{ kppnScopeId: mockScopeId }]);
							if (call === 3) return Promise.resolve([{ total: 2 }]);
							return Promise.resolve([]);
						}),
					}),
				})),
				insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue({}) }),
				delete: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([targetUser]) }) }),
			} as unknown as Parameters<typeof hardDeleteUser>[0];
			const res = await hardDeleteUser(mockDb, { actorUserId: mockActorId, targetUserId: mockTargetId });
			expect(res).toEqual(targetUser);
		});
	});

	describe("updateUserProfile email lock", () => {
		it("allows email change for manual_ user", async () => {
			const targetUser = { id: mockTargetId, clerkUserId: "manual_12345", email: "old@x.com", name: "Old" };
			const updated = { ...targetUser, email: "new@x.com", name: "New" };
			let call = 0;
			const mockDb = {
				select: vi.fn().mockImplementation(() => ({
					from: vi.fn().mockReturnValue({
						where: vi.fn().mockImplementation(() => {
							call++;
							if (call === 1) return { limit: () => Promise.resolve([targetUser]) };
							return { limit: () => Promise.resolve([]) };
						}),
					}),
				})),
				update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([updated]) }) }) }),
				insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue({}) }),
			} as unknown as Parameters<typeof updateUserProfile>[0];
			const res = await updateUserProfile(mockDb, { actorUserId: mockActorId, targetUserId: mockTargetId, email: "NEW@x.com", name: "New" });
			expect(res.email).toBe("new@x.com");
		});
		it("rejects email change for Clerk-claimed user", async () => {
			const targetUser = { id: mockTargetId, clerkUserId: "user_2abcClerkId", email: "old@x.com", name: "Old" };
			const mockDb = {
				select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([targetUser]) }) }) }),
			} as unknown as Parameters<typeof updateUserProfile>[0];
			await expect(updateUserProfile(mockDb, { actorUserId: mockActorId, targetUserId: mockTargetId, email: "new@x.com" })).rejects.toThrow(EmailLockedError);
		});
	});
});

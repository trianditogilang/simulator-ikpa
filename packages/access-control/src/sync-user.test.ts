import { describe, expect, it, vi } from "vitest";
import {
	normalizeEmail,
	syncClerkUser,
	UserSyncConflictError,
} from "./sync-user";

describe("syncClerkUser", () => {
	it("normalizes email to lowercase trimmed", () => {
		expect(normalizeEmail("  Admin.KPPN@Kemenkeu.GO.ID  ")).toBe(
			"admin.kppn@kemenkeu.go.id",
		);
	});

	it("creates a new user when no existing user found", async () => {
		const mockCreated = {
			id: "u-123",
			clerkUserId: "clerk_123",
			email: "operator@satker.go.id",
			name: "Budi Operator",
			createdAt: new Date(),
			updatedAt: new Date(),
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
		} as unknown as Parameters<typeof syncClerkUser>[0];

		const result = await syncClerkUser(mockDb, {
			clerkUserId: "clerk_123",
			email: "OPERATOR@SATKER.GO.ID",
			name: "Budi Operator",
		});

		expect(result).toEqual(mockCreated);
	});

	it("updates existing user when found by Clerk ID", async () => {
		const existing = {
			id: "u-123",
			clerkUserId: "clerk_123",
			email: "old@satker.go.id",
			name: "Old Name",
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		const updated = {
			...existing,
			email: "new@satker.go.id",
			name: "New Name",
		};

		const mockDb = {
			select: vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue([existing]),
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
		} as unknown as Parameters<typeof syncClerkUser>[0];

		const result = await syncClerkUser(mockDb, {
			clerkUserId: "clerk_123",
			email: "new@satker.go.id",
			name: "New Name",
		});

		expect(result).toEqual(updated);
	});

	it("throws UserSyncConflictError if email is registered to a different Clerk ID", async () => {
		const existingDifferentClerk = {
			id: "u-999",
			clerkUserId: "clerk_other_user",
			email: "same@satker.go.id",
			name: "Other User",
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		let callCount = 0;
		const mockDb = {
			select: vi.fn().mockReturnValue({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						limit: vi.fn().mockImplementation(() => {
							callCount++;
							if (callCount === 1) return Promise.resolve([]); // Not found by clerk ID
							return Promise.resolve([existingDifferentClerk]); // Found by email with different clerk ID
						}),
					}),
				}),
			}),
		} as unknown as Parameters<typeof syncClerkUser>[0];

		await expect(
			syncClerkUser(mockDb, {
				clerkUserId: "clerk_new_attacker",
				email: "same@satker.go.id",
				name: "Attacker",
			}),
		).rejects.toThrow(UserSyncConflictError);
	});
});

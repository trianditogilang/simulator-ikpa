import { eq } from "drizzle-orm";
import type { DbClient } from "@simulator-ikpa/db";
import { users } from "@simulator-ikpa/db/schema";

export interface SyncClerkUserInput {
	clerkUserId: string;
	email: string;
	name?: string | null;
}

export interface SyncedUser {
	id: string;
	clerkUserId: string;
	email: string;
	name: string;
	createdAt: Date;
	updatedAt: Date;
}

export class UserSyncConflictError extends Error {
	constructor(
		public readonly email: string,
		public readonly existingClerkId: string,
		public readonly incomingClerkId: string,
	) {
		super(
			`Conflict: Email '${email}' is already associated with Clerk ID '${existingClerkId}', cannot bind to '${incomingClerkId}'.`,
		);
		this.name = "UserSyncConflictError";
	}
}

/**
 * Normalizes email address for consistent lookup and uniqueness.
 */
export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

/**
 * Upserts a verified Clerk identity into the internal `users` table.
 * Adheres to ADR-007 security invariants (no account hijacking, fail-closed on conflict).
 */
export async function syncClerkUser(
	db: DbClient,
	input: SyncClerkUserInput,
): Promise<SyncedUser> {
	const normalizedEmail = normalizeEmail(input.email);
	const resolvedName =
		input.name?.trim() || normalizedEmail.split("@")[0] || "User";

	// 1. Check by Clerk User ID
	const [existingByClerkId] = await db
		.select()
		.from(users)
		.where(eq(users.clerkUserId, input.clerkUserId))
		.limit(1);

	if (existingByClerkId) {
		// Update email & name if changed
		const [updated] = await db
			.update(users)
			.set({
				email: normalizedEmail,
				name: resolvedName,
				updatedAt: new Date(),
			})
			.where(eq(users.id, existingByClerkId.id))
			.returning();

		return updated;
	}

	// 2. Check by Email
	const [existingByEmail] = await db
		.select()
		.from(users)
		.where(eq(users.email, normalizedEmail))
		.limit(1);

	if (existingByEmail) {
		// If existing user was pre-provisioned without Clerk ID (or matching), claim it
		if (
			!existingByEmail.clerkUserId ||
			existingByEmail.clerkUserId === input.clerkUserId
		) {
			const [claimed] = await db
				.update(users)
				.set({
					clerkUserId: input.clerkUserId,
					name: resolvedName,
					updatedAt: new Date(),
				})
				.where(eq(users.id, existingByEmail.id))
				.returning();

			return claimed;
		}

		// Security Conflict: Email registered to another distinct Clerk account!
		throw new UserSyncConflictError(
			normalizedEmail,
			existingByEmail.clerkUserId,
			input.clerkUserId,
		);
	}

	// 3. Create fresh user
	const [created] = await db
		.insert(users)
		.values({
			clerkUserId: input.clerkUserId,
			email: normalizedEmail,
			name: resolvedName,
		})
		.returning();

	return created;
}

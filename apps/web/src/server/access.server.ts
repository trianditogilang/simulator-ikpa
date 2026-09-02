import {
	resolveUserAccess,
	syncClerkUser,
} from "@simulator-ikpa/access-control";
import {
	type AccessResolution,
	accessResolutionSchema,
} from "@simulator-ikpa/contracts";
import { createDbClient } from "@simulator-ikpa/db";
import type { AuthSession } from "./auth-session";
import { getClerkIdentity } from "./auth-session.server";

function resolveDevelopmentAccess(
	auth: AuthSession,
	requestedOrgId?: string | null,
): AccessResolution {
	if (auth.clerkUserId?.includes("admin")) {
		return accessResolutionSchema.parse({
			status: "admin",
			userId: "11111111-1111-4111-8111-111111111111",
			accessType: "admin_kppn",
			kppnScopes: [
				{
					id: "44444444-4444-4444-8444-444444444444",
					code: "089",
					name: "KPPN Jakarta II",
				},
			],
		});
	}

	if (auth.clerkUserId?.includes("multi")) {
		const organizations = [
			{
				id: "22222222-2222-4222-8222-222222222222",
				code: "411782",
				name: "Satker Contoh A",
				timezone: "Asia/Jakarta",
			},
			{
				id: "33333333-3333-4333-8333-333333333333",
				code: "411783",
				name: "Satker Contoh B",
				timezone: "Asia/Makassar",
			},
		];
		const activeOrganizationId = organizations.find(
			(organization) => organization.id === requestedOrgId,
		)?.id;

		return accessResolutionSchema.parse({
			status: "operator_multiple_scopes",
			userId: "11111111-1111-4111-8111-111111111111",
			accessType: "operator_satker",
			organizations,
			activeOrganizationId: activeOrganizationId ?? null,
		});
	}

	if (auth.clerkUserId?.includes("unmapped")) {
		return accessResolutionSchema.parse({
			status: "unmapped",
			userId: "11111111-1111-4111-8111-111111111111",
		});
	}

	return accessResolutionSchema.parse({
		status: "operator_single_scope",
		userId: "11111111-1111-4111-8111-111111111111",
		accessType: "operator_satker",
		organizations: [
			{
				id: "22222222-2222-4222-8222-222222222222",
				code: "411782",
				name: "Satker Contoh",
				timezone: "Asia/Jakarta",
			},
		],
		activeOrganizationId: "22222222-2222-4222-8222-222222222222",
	});
}

/**
 * Resolves access from a verified server session. `auth` never comes from a
 * browser payload, and every requested organization is checked by the DB
 * resolver before it can become active.
 */
export async function getAccessResolutionForSession(
	auth: AuthSession,
	requestedOrgId?: string | null,
): Promise<AccessResolution> {
	if (!auth.isAuthenticated || !auth.clerkUserId) {
		return accessResolutionSchema.parse({ status: "unauthenticated" });
	}

	const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
	if (!dbUrl) {
		if (process.env.NODE_ENV === "production") {
			throw new Error(
				"DATABASE_URL is required for production access resolution",
			);
		}

		return resolveDevelopmentAccess(auth, requestedOrgId);
	}

	const db = createDbClient(dbUrl);
	let access = await resolveUserAccess(db, {
		clerkUserId: auth.clerkUserId,
		requestedOrgId,
	});

	if (access.status === "unauthenticated" && process.env.CLERK_SECRET_KEY) {
		const identity = await getClerkIdentity(auth.clerkUserId);
		await syncClerkUser(db, identity);
		access = await resolveUserAccess(db, {
			clerkUserId: auth.clerkUserId,
			requestedOrgId,
		});
	}

	return access;
}

import {
	claimPendingAccess,
	resolveUserAccess,
} from "@simulator-ikpa/access-control";
import {
	type AccessResolution,
	accessResolutionSchema,
} from "@simulator-ikpa/contracts";
import { createDbClient } from "@simulator-ikpa/db";
import type { AuthSession } from "./auth-session";

/**
 * Resolves access from a verified server session. `auth` never comes from a
 * browser payload, and every requested organization is checked by the DB
 * resolver before it can become active.
 */
export async function getAccessResolutionForSession(
	auth: AuthSession,
	requestedOrgId?: string | null,
): Promise<AccessResolution> {
	if (!auth.isAuthenticated || !auth.userId) {
		return accessResolutionSchema.parse({ status: "unauthenticated" });
	}

	const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
	if (!dbUrl) {
		throw new Error("DATABASE_URL is required for access resolution");
	}

	const db = createDbClient(dbUrl);
	const input = { userId: auth.userId, requestedOrgId };
	const access = await resolveUserAccess(db, input);

	// An Admin invitation is a pending access for the user's email. It is
	// claimed on the first request after that email has been verified by OTP.
	if (access.status === "unmapped") {
		const claimed = await claimPendingAccess(db, { userId: auth.userId });
		if (claimed) return resolveUserAccess(db, input);
	}

	return access;
}

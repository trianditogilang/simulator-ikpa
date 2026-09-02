import { auth, clerkClient } from "@clerk/tanstack-react-start/server";
import { getCookie, getRequest } from "@tanstack/react-start/server";
import {
	type AuthSession,
	createUnauthenticatedAuthSession,
	getAuthContextFromRequest,
} from "./auth-session";

export const ACTIVE_ORGANIZATION_COOKIE = "ikpa_active_org";

/**
 * Returns the verified identity for the current request.
 * Clerk is authoritative whenever its server key is configured. The local
 * cookie parser is intentionally restricted to non-production demo mode.
 */
export async function getServerAuthSession(): Promise<AuthSession> {
	if (process.env.CLERK_SECRET_KEY) {
		const { userId } = await auth();
		if (!userId) {
			return createUnauthenticatedAuthSession();
		}

		return {
			userId: null,
			clerkUserId: userId,
			email: null,
			name: null,
			isAuthenticated: true,
		};
	}

	if (process.env.NODE_ENV === "production") {
		return createUnauthenticatedAuthSession();
	}

	return getAuthContextFromRequest(getRequest());
}

export function getRequestedOrganizationIdFromRequest(): string | undefined {
	return getCookie(ACTIVE_ORGANIZATION_COOKIE);
}

/**
 * Loads verified Clerk profile data only when a real user is not yet
 * provisioned internally. This keeps normal access checks read-only while
 * allowing the existing sync service to provision a newly authenticated user.
 */
export async function getClerkIdentity(clerkUserId: string) {
	const user = await clerkClient().users.getUser(clerkUserId);
	const email =
		user.primaryEmailAddress?.emailAddress ??
		user.emailAddresses[0]?.emailAddress;

	if (!email) {
		throw new Error("Authenticated Clerk user has no verified email address");
	}

	return {
		clerkUserId,
		email,
		name: user.fullName,
	};
}

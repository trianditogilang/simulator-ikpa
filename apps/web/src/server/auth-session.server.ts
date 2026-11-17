import { getCookie, getRequest } from "@tanstack/react-start/server";
import { getAuth } from "./auth.server";
import {
	type AuthSession,
	createUnauthenticatedAuthSession,
} from "./auth-session";

export const ACTIVE_ORGANIZATION_COOKIE = "ikpa_active_org";

/**
 * Returns the verified identity for the current request from the Better Auth
 * session cookie. Without a configured database there is no way to verify a
 * session, so the request is treated as unauthenticated (fail closed).
 */
export async function getServerAuthSession(): Promise<AuthSession> {
	if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
		return createUnauthenticatedAuthSession();
	}

	const session = await getAuth().api.getSession({
		headers: getRequest().headers,
	});
	if (!session) return createUnauthenticatedAuthSession();

	return {
		userId: session.user.id,
		email: session.user.email,
		name: session.user.name,
		isAuthenticated: true,
	};
}

export function getRequestedOrganizationIdFromRequest(): string | undefined {
	return getCookie(ACTIVE_ORGANIZATION_COOKIE);
}

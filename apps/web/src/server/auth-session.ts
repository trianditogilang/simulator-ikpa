export interface AuthSession {
	/** `users.id` of the verified session user (ADR-008: canonical identity). */
	userId: string | null;
	email: string | null;
	name: string | null;
	isAuthenticated: boolean;
}

export function createUnauthenticatedAuthSession(): AuthSession {
	return {
		userId: null,
		email: null,
		name: null,
		isAuthenticated: false,
	};
}

/** Shared by the sign-up form and the Better Auth server config. */
export const MIN_PASSWORD_LENGTH = 10;

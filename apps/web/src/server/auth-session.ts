export interface AuthSession {
	userId: string | null;
	clerkUserId: string | null;
	email: string | null;
	name: string | null;
	isAuthenticated: boolean;
}

export function createUnauthenticatedAuthSession(): AuthSession {
	return {
		userId: null,
		clerkUserId: null,
		email: null,
		name: null,
		isAuthenticated: false,
	};
}

function decodeCookieValue(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

function readCookieHeader(cookieHeader: string): Record<string, string> {
	return Object.fromEntries(
		cookieHeader.split(";").flatMap((part) => {
			const separatorIndex = part.indexOf("=");
			if (separatorIndex < 1) {
				return [];
			}

			const name = part.slice(0, separatorIndex).trim();
			const value = part.slice(separatorIndex + 1).trim();
			return [[name, decodeCookieValue(value)]];
		}),
	);
}

/**
 * Reads the deliberately limited local demo session.
 *
 * This function is only called when Clerk is not configured in development.
 * It must never be used as production authentication.
 */
export async function getAuthContextFromRequest(
	request: Request,
): Promise<AuthSession> {
	const authHeader = request.headers.get("authorization");
	const cookieHeader = request.headers.get("cookie");

	// 1. Check Bearer token or dev session cookie
	if (authHeader?.startsWith("Bearer ")) {
		const token = authHeader.substring(7);
		if (token.startsWith("dev_user_") || token.startsWith("user_")) {
			return {
				userId: token,
				clerkUserId: token,
				email: `${token}@kemenkeu.go.id`,
				name: `User ${token}`,
				isAuthenticated: true,
			};
		}
	}

	// 2. Check Cookie for active session or active dev user
	if (cookieHeader) {
		const cookies = readCookieHeader(cookieHeader);

		if (cookies.__session || cookies.dev_session) {
			const sessionVal = cookies.__session || cookies.dev_session;
			return {
				userId: sessionVal,
				clerkUserId: sessionVal,
				email: `${sessionVal}@kemenkeu.go.id`,
				name: `User ${sessionVal}`,
				isAuthenticated: true,
			};
		}
	}

	return createUnauthenticatedAuthSession();
}

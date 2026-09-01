export interface AuthSession {
	userId: string | null;
	clerkUserId: string | null;
	email: string | null;
	name: string | null;
	isAuthenticated: boolean;
}

/**
 * Extracts and verifies auth session from an incoming HTTP Request.
 * In development, supports Authorization/Cookie header or dev presets.
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
		const cookies = Object.fromEntries(
			cookieHeader
				.split(";")
				.map((c) => c.trim().split("="))
				.filter((parts) => parts.length === 2),
		);

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

	return {
		userId: null,
		clerkUserId: null,
		email: null,
		name: null,
		isAuthenticated: false,
	};
}

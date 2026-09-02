import type { AccessResolution } from "@simulator-ikpa/contracts";

export class UnauthorizedError extends Error {
	public readonly statusCode = 401;
	public readonly code = "UNAUTHORIZED";

	constructor(message = "Sesi login tidak valid atau telah berakhir.") {
		super(message);
		this.name = "UnauthorizedError";
	}
}

export class ForbiddenError extends Error {
	public readonly statusCode = 403;
	public readonly code = "FORBIDDEN";

	constructor(message = "Akses ditolak untuk resource atau scope ini.") {
		super(message);
		this.name = "ForbiddenError";
	}
}

export interface OperatorContext {
	userId: string;
	orgId: string;
}

export interface AdminContext {
	userId: string;
	allowedKppnScopeIds: string[];
}

/**
 * Asserts that the request identity has valid authenticated access.
 */
export function assertAuthenticated(resolution: AccessResolution): {
	userId: string;
} {
	if (resolution.status === "unauthenticated") {
		throw new UnauthorizedError();
	}
	return { userId: resolution.userId };
}

/**
 * Asserts that the current actor is an Operator Satker with authority over `targetOrgId`.
 * Throws UnauthorizedError (401) or ForbiddenError (403).
 */
export function assertOperatorOrgScope(
	resolution: AccessResolution,
	targetOrgId: string,
): OperatorContext {
	if (resolution.status === "unauthenticated") {
		throw new UnauthorizedError();
	}

	if (
		resolution.status === "unmapped" ||
		resolution.status === "invalid_conflict"
	) {
		throw new ForbiddenError("Akun belum memiliki pemetaan akses yang valid.");
	}

	if (resolution.status === "admin") {
		throw new ForbiddenError(
			"Admin KPPN tidak diizinkan melakukan mutasi operasional satker secara langsung.",
		);
	}

	if (
		resolution.status === "operator_single_scope" ||
		resolution.status === "operator_multiple_scopes"
	) {
		const isAuthorized = resolution.organizations.some(
			(org) => org.id === targetOrgId,
		);
		if (!isAuthorized) {
			throw new ForbiddenError(
				"Satker berada di luar wewenang operator yang terdaftar.",
			);
		}
		return {
			userId: resolution.userId,
			orgId: targetOrgId,
		};
	}

	throw new ForbiddenError();
}

/**
 * Asserts that the current actor is an Admin KPPN with authority over the specified scope(s).
 */
export function assertAdminKppnScope(
	resolution: AccessResolution,
	targetKppnScopeId?: string | null,
): AdminContext {
	if (resolution.status === "unauthenticated") {
		throw new UnauthorizedError();
	}

	if (resolution.status !== "admin") {
		throw new ForbiddenError(
			"Hanya Admin KPPN yang memiliki akses ke area monitoring dan kebijakan ini.",
		);
	}

	const allowedScopeIds = resolution.kppnScopes.map((scope) => scope.id);

	if (targetKppnScopeId && !allowedScopeIds.includes(targetKppnScopeId)) {
		throw new ForbiddenError("Scope KPPN berada di luar wewenang admin ini.");
	}

	return {
		userId: resolution.userId,
		allowedKppnScopeIds: allowedScopeIds,
	};
}

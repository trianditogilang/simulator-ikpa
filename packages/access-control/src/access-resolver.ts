import { and, eq } from "drizzle-orm";
import {
	type AccessResolution,
	accessResolutionSchema,
} from "@simulator-ikpa/contracts";
import type { DbClient } from "@simulator-ikpa/db";
import {
	kppnScopes,
	organizations,
	userAccesses,
	users,
} from "@simulator-ikpa/db/schema";

export interface ResolveAccessInput {
	clerkUserId: string | null;
	requestedOrgId?: string | null;
}

/**
 * Resolves application authorization state for a verified Clerk identity.
 * Conforms strictly to ADR-007 invariant rules:
 * - unauthenticated -> status "unauthenticated"
 * - no active mapping -> status "unmapped"
 * - mixed access types -> status "invalid_conflict" (fail-closed)
 * - operator single satker -> status "operator_single_scope"
 * - operator multi satker -> status "operator_multiple_scopes"
 * - admin KPPN -> status "admin"
 */
export async function resolveUserAccess(
	db: DbClient,
	input: ResolveAccessInput,
): Promise<AccessResolution> {
	if (!input.clerkUserId) {
		return accessResolutionSchema.parse({ status: "unauthenticated" });
	}

	// 1. Find User by Clerk ID
	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.clerkUserId, input.clerkUserId))
		.limit(1);

	if (!user) {
		return accessResolutionSchema.parse({ status: "unauthenticated" });
	}

	// 2. Fetch all active access mappings
	const accesses = await db
		.select({
			accessType: userAccesses.accessType,
			orgId: userAccesses.orgId,
			orgCode: organizations.kodeSatker,
			orgName: organizations.name,
			orgTimezone: organizations.timezone,
			kppnScopeId: userAccesses.kppnScopeId,
			kppnCode: kppnScopes.code,
			kppnName: kppnScopes.name,
		})
		.from(userAccesses)
		.leftJoin(organizations, eq(userAccesses.orgId, organizations.id))
		.leftJoin(kppnScopes, eq(userAccesses.kppnScopeId, kppnScopes.id))
		.where(
			and(eq(userAccesses.userId, user.id), eq(userAccesses.active, true)),
		);

	if (accesses.length === 0) {
		return accessResolutionSchema.parse({
			status: "unmapped",
			userId: user.id,
		});
	}

	// 3. Check for conflicting access types (ADR-007 Invariant 1: fail-closed)
	const hasOperator = accesses.some((a) => a.accessType === "operator_satker");
	const hasAdmin = accesses.some((a) => a.accessType === "admin_kppn");

	if (hasOperator && hasAdmin) {
		return accessResolutionSchema.parse({
			status: "invalid_conflict",
			userId: user.id,
			code: "ACCESS_MAPPING_CONFLICT",
		});
	}

	// 4. Admin Resolution
	if (hasAdmin) {
		const distinctScopesMap = new Map<
			string,
			{ id: string; code: string; name: string }
		>();

		for (const a of accesses) {
			if (a.kppnScopeId && a.kppnCode && a.kppnName) {
				distinctScopesMap.set(a.kppnScopeId, {
					id: a.kppnScopeId,
					code: a.kppnCode,
					name: a.kppnName,
				});
			}
		}

		const scopes = Array.from(distinctScopesMap.values());
		if (scopes.length === 0) {
			return accessResolutionSchema.parse({
				status: "unmapped",
				userId: user.id,
			});
		}

		return accessResolutionSchema.parse({
			status: "admin",
			userId: user.id,
			accessType: "admin_kppn",
			kppnScopes: scopes,
		});
	}

	// 5. Operator Resolution
	const distinctOrgsMap = new Map<
		string,
		{ id: string; code: string; name: string; timezone: string }
	>();

	for (const a of accesses) {
		if (a.orgId && a.orgCode && a.orgName) {
			distinctOrgsMap.set(a.orgId, {
				id: a.orgId,
				code: a.orgCode,
				name: a.orgName,
				timezone: a.orgTimezone ?? "Asia/Jakarta",
			});
		}
	}

	const orgs = Array.from(distinctOrgsMap.values());
	if (orgs.length === 0) {
		return accessResolutionSchema.parse({
			status: "unmapped",
			userId: user.id,
		});
	}

	if (orgs.length === 1) {
		return accessResolutionSchema.parse({
			status: "operator_single_scope",
			userId: user.id,
			accessType: "operator_satker",
			organizations: [orgs[0]],
			activeOrganizationId: orgs[0].id,
		});
	}

	const requestedOrg = input.requestedOrgId
		? orgs.find((o) => o.id === input.requestedOrgId)
		: undefined;

	return accessResolutionSchema.parse({
		status: "operator_multiple_scopes",
		userId: user.id,
		accessType: "operator_satker",
		organizations: orgs,
		activeOrganizationId: requestedOrg ? requestedOrg.id : null,
	});
}

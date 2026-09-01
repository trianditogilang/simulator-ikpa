import { createServerFn } from "@tanstack/react-start";
import { accessResolutionSchema } from "@simulator-ikpa/contracts";
import { resolveUserAccess } from "@simulator-ikpa/access-control";
import { createDbClient } from "@simulator-ikpa/db";
import type { AuthSession } from "./auth-session";

export interface GetAccessParams {
	auth?: AuthSession;
	requestedOrgId?: string | null;
}

export const getAccessResolutionFn = createServerFn({ method: "GET" })
	.validator((data?: GetAccessParams) => data)
	.handler(async ({ data }) => {
		const auth = data?.auth;
		const requestedOrgId = data?.requestedOrgId;

		if (!auth || !auth.isAuthenticated || !auth.clerkUserId) {
			return accessResolutionSchema.parse({ status: "unauthenticated" });
		}

		const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
		if (!dbUrl) {
			// Mock fallback for local demo when DATABASE_URL is not set
			if (auth.clerkUserId.includes("admin")) {
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

			if (auth.clerkUserId.includes("multi")) {
				const org1 = {
					id: "22222222-2222-4222-8222-222222222222",
					code: "411782",
					name: "Satker Contoh A",
					timezone: "Asia/Jakarta",
				};
				const org2 = {
					id: "33333333-3333-4333-8333-333333333333",
					code: "411783",
					name: "Satker Contoh B",
					timezone: "Asia/Makassar",
				};
				const activeId =
					requestedOrgId === org2.id
						? org2.id
						: requestedOrgId === org1.id
							? org1.id
							: null;
				return accessResolutionSchema.parse({
					status: "operator_multiple_scopes",
					userId: "11111111-1111-4111-8111-111111111111",
					accessType: "operator_satker",
					organizations: [org1, org2],
					activeOrganizationId: activeId,
				});
			}

			if (auth.clerkUserId.includes("unmapped")) {
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

		const db = createDbClient(dbUrl);
		return resolveUserAccess(db, {
			clerkUserId: auth.clerkUserId,
			requestedOrgId,
		});
	});

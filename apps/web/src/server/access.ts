import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, setCookie } from "@tanstack/react-start/server";
import { uuidSchema } from "@simulator-ikpa/contracts";
import { getAccessResolutionForSession } from "./access.server";
import {
	ACTIVE_ORGANIZATION_COOKIE,
	getRequestedOrganizationIdFromRequest,
	getServerAuthSession,
} from "./auth-session.server";

export interface GetAccessParams {
	requestedOrgId?: string | null;
}

export const getAuthSessionFn = createServerFn({ method: "GET" }).handler(
	async () => getServerAuthSession(),
);

export const getAccessResolutionFn = createServerFn({ method: "GET" })
	.validator((data?: GetAccessParams) => data)
	.handler(async ({ data }) => {
		const hasExplicitOrganization =
			data && Object.hasOwn(data, "requestedOrgId");
		const requestedOrgId = hasExplicitOrganization
			? (data?.requestedOrgId ?? undefined)
			: getRequestedOrganizationIdFromRequest();

		return getAccessResolutionForSession(
			await getServerAuthSession(),
			requestedOrgId,
		);
	});

export const setActiveOrganizationFn = createServerFn({ method: "POST" })
	.validator((data: { organizationId: string }) => {
		const organizationId = uuidSchema.parse(data.organizationId);
		return { organizationId };
	})
	.handler(async ({ data }) => {
		const access = await getAccessResolutionForSession(
			await getServerAuthSession(),
			data.organizationId,
		);

		const hasSelectedOrganization =
			(access.status === "operator_single_scope" ||
				access.status === "operator_multiple_scopes") &&
			access.activeOrganizationId === data.organizationId;

		if (!hasSelectedOrganization) {
			throw new Error("Organization is not available for the current user");
		}

		setCookie(ACTIVE_ORGANIZATION_COOKIE, data.organizationId, {
			httpOnly: true,
			maxAge: 60 * 60 * 24 * 30,
			path: "/",
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
		});

		return access;
	});

export const clearActiveOrganizationFn = createServerFn({
	method: "POST",
}).handler(async () => {
	deleteCookie(ACTIVE_ORGANIZATION_COOKIE, { path: "/" });
	return { cleared: true };
});

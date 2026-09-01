import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAccessResolutionFn } from "@/server/access";

export const Route = createFileRoute("/operator")({
	beforeLoad: async ({ context, location }) => {
		const access = await getAccessResolutionFn({ data: { auth: context?.auth } });

		if (access.status === "unauthenticated") {
			// In development mode, allow direct access if no session is set, or redirect to sign-in
			if (process.env.NODE_ENV === "production") {
				throw redirect({
					to: "/sign-in",
					search: {
						next: location.href,
					},
				});
			}
		}

		if (access.status === "unmapped" || access.status === "invalid_conflict") {
			throw redirect({
				to: "/access-pending",
			});
		}

		if (access.status === "admin") {
			throw redirect({
				to: "/admin-kppn/dashboard",
			});
		}

		if (
			access.status === "operator_multiple_scopes" &&
			!access.activeOrganizationId
		) {
			throw redirect({
				to: "/select-organization",
			});
		}

		return {
			access,
		};
	},
	component: OperatorLayout,
});

function OperatorLayout() {
	return <Outlet />;
}

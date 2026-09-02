import { uuidSchema } from "@simulator-ikpa/contracts";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ActiveContextProvider } from "@/components/layout/active-context";
import { getAccessResolutionFn } from "@/server/access";

export const Route = createFileRoute("/operator")({
	validateSearch: (search) => ({
		org: uuidSchema.safeParse(search.org).success
			? String(search.org)
			: undefined,
	}),
	beforeLoad: async ({ location, search }) => {
		const access = await getAccessResolutionFn({
			data: search.org ? { requestedOrgId: search.org } : {},
		});

		if (access.status === "unauthenticated") {
			throw redirect({
				to: "/sign-in",
				search: {
					next: location.href,
				},
			});
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
				search: { org: undefined },
			});
		}

		return {
			access,
		};
	},
	component: OperatorLayout,
});

function OperatorLayout() {
	const { access } = Route.useRouteContext();
	return (
		<ActiveContextProvider access={access}>
			<Outlet />
		</ActiveContextProvider>
	);
}

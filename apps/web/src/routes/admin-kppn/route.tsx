import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ActiveContextProvider } from "@/components/layout/active-context";
import { getAccessResolutionFn } from "@/server/access";

export const Route = createFileRoute("/admin-kppn")({
	beforeLoad: async ({ location }) => {
		const access = await getAccessResolutionFn({ data: {} });

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

		if (
			access.status === "operator_single_scope" ||
			access.status === "operator_multiple_scopes"
		) {
			throw redirect({
				to: "/operator/dashboard",
				search: { org: undefined },
			});
		}

		return {
			access,
		};
	},
	component: AdminKppnLayout,
});

function AdminKppnLayout() {
	const { access } = Route.useRouteContext();
	return (
		<ActiveContextProvider access={access}>
			<Outlet />
		</ActiveContextProvider>
	);
}

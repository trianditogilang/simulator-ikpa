import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAccessResolutionFn } from "@/server/access";

export const Route = createFileRoute("/admin-kppn")({
	beforeLoad: async ({ context, location }) => {
		const access = await getAccessResolutionFn({ data: { auth: context?.auth } });

		if (access.status === "unauthenticated") {
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

		if (
			access.status === "operator_single_scope" ||
			access.status === "operator_multiple_scopes"
		) {
			throw redirect({
				to: "/operator/dashboard",
			});
		}

		return {
			access,
		};
	},
	component: AdminKppnLayout,
});

function AdminKppnLayout() {
	return <Outlet />;
}

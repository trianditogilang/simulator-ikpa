import { createFileRoute, redirect } from "@tanstack/react-router";
import { AccessPending } from "@/components/access/access-pending";
import { PublicShell } from "@/components/layout/public-shell";
import { getAccessResolutionFn } from "@/server/access";

export const Route = createFileRoute("/access-pending")({
	beforeLoad: async ({ context, location }) => {
		if (!context.auth.isAuthenticated) {
			throw redirect({
				to: "/sign-in",
				search: { next: location.href },
			});
		}

		const access = await getAccessResolutionFn({ data: {} });
		if (access.status === "admin") {
			throw redirect({ to: "/admin-kppn/dashboard" });
		}

		if (access.status === "operator_single_scope") {
			throw redirect({
				to: "/operator/dashboard",
				search: { org: undefined },
			});
		}

		if (
			access.status === "operator_multiple_scopes" &&
			access.activeOrganizationId
		) {
			throw redirect({
				to: "/operator/dashboard",
				search: { org: undefined },
			});
		}
	},
	component: AccessPendingPage,
});

function AccessPendingPage() {
	const { auth } = Route.useRouteContext();

	return (
		<PublicShell contentClassName="py-8 sm:py-10">
			<AccessPending email={auth.email ?? undefined} />
		</PublicShell>
	);
}

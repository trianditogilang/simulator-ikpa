import { createFileRoute, redirect } from "@tanstack/react-router";
import { uuidSchema } from "@simulator-ikpa/contracts";
import { OrgPicker } from "@/components/access/org-picker";
import { PublicShell } from "@/components/layout/public-shell";
import { getAccessResolutionFn } from "@/server/access";

export const Route = createFileRoute("/select-organization")({
	validateSearch: (search) => ({
		org: uuidSchema.safeParse(search.org).success
			? String(search.org)
			: undefined,
	}),
	beforeLoad: async ({ location, search }) => {
		const access = await getAccessResolutionFn({
			data: { requestedOrgId: search.org ?? null },
		});

		if (access.status === "unauthenticated") {
			throw redirect({
				to: "/sign-in",
				search: { next: location.href },
			});
		}

		if (access.status === "unmapped" || access.status === "invalid_conflict") {
			throw redirect({ to: "/access-pending" });
		}

		if (access.status === "admin") {
			throw redirect({ to: "/admin-kppn/dashboard" });
		}

		if (access.status === "operator_single_scope") {
			throw redirect({
				to: "/operator/dashboard",
				search: { org: undefined },
			});
		}

		if (access.activeOrganizationId) {
			throw redirect({
				to: "/operator/dashboard",
				search: { org: undefined },
			});
		}

		return { access };
	},
	component: SelectOrganizationPage,
});

function SelectOrganizationPage() {
	const { access } = Route.useRouteContext();

	return (
		<PublicShell contentClassName="py-8 sm:py-10">
			<OrgPicker
				organizations={
					access.status === "operator_multiple_scopes"
						? access.organizations
						: []
				}
			/>
		</PublicShell>
	);
}

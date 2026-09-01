import { createFileRoute, redirect } from "@tanstack/react-router";
import { PublicShell } from "@/components/layout/public-shell";
import { SignInPanel } from "@/components/public/sign-in-panel";
import { getAccessResolutionFn } from "@/server/access";

function isSafeRedirectIntent(value: unknown): value is string {
	return (
		typeof value === "string" &&
		value.length <= 512 &&
		value.startsWith("/") &&
		!value.startsWith("//") &&
		!value.includes("\\") &&
		!/[\r\n]/.test(value)
	);
}

export const Route = createFileRoute("/sign-in")({
	validateSearch: (search) => ({
		next: isSafeRedirectIntent(search.next) ? search.next : undefined,
	}),
	beforeLoad: async ({ context }) => {
		if (!context.auth.isAuthenticated) {
			return;
		}

		const access = await getAccessResolutionFn({ data: {} });
		if (access.status === "admin") {
			throw redirect({ to: "/admin-kppn/dashboard" });
		}

		if (access.status === "unmapped" || access.status === "invalid_conflict") {
			throw redirect({ to: "/access-pending" });
		}

		if (access.status === "operator_single_scope") {
			throw redirect({
				to: "/operator/dashboard",
				search: { org: undefined },
			});
		}

		if (access.status === "operator_multiple_scopes") {
			throw redirect(
				access.activeOrganizationId
					? {
							to: "/operator/dashboard",
							search: { org: undefined },
						}
					: { to: "/select-organization", search: { org: undefined } },
			);
		}
	},
	component: SignInPage,
});

function SignInPage() {
	const { next } = Route.useSearch();

	return (
		<PublicShell contentClassName="py-8 sm:py-10">
			<SignInPanel redirectIntent={next} />
		</PublicShell>
	);
}

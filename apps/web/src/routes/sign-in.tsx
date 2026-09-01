import { createFileRoute } from "@tanstack/react-router";
import { PublicShell } from "@/components/layout/public-shell";
import { SignInPanel } from "@/components/public/sign-in-panel";

function isSafeRedirectIntent(value: unknown): value is string {
	return (
		typeof value === "string" &&
		value.startsWith("/") &&
		!value.startsWith("//")
	);
}

export const Route = createFileRoute("/sign-in")({
	validateSearch: (search) => ({
		next: isSafeRedirectIntent(search.next) ? search.next : "/access-pending",
	}),
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

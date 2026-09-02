import { AuthenticateWithRedirectCallback } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";
import { PublicShell } from "@/components/layout/public-shell";

export const Route = createFileRoute("/sso-callback")({
	component: SsoCallbackPage,
});

function SsoCallbackPage() {
	return (
		<PublicShell contentClassName="py-12 flex justify-center items-center">
			<AuthenticateWithRedirectCallback
				signInFallbackRedirectUrl="/sign-in"
				signUpFallbackRedirectUrl="/sign-in"
			/>
		</PublicShell>
	);
}

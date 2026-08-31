import { createFileRoute } from "@tanstack/react-router";
import { PublicShell } from "@/components/layout/public-shell";
import { LandingContent } from "@/components/public/landing-content";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	return (
		<PublicShell>
			<LandingContent />
		</PublicShell>
	);
}

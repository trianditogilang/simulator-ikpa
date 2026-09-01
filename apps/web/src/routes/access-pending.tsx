import { createFileRoute } from "@tanstack/react-router";
import { AccessPending } from "@/components/access/access-pending";
import { PublicShell } from "@/components/layout/public-shell";

export const Route = createFileRoute("/access-pending")({
	component: AccessPendingPage,
});

function AccessPendingPage() {
	return (
		<PublicShell contentClassName="py-8 sm:py-10">
			<AccessPending />
		</PublicShell>
	);
}

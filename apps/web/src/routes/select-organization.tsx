import { createFileRoute } from "@tanstack/react-router";
import { OrgPicker } from "@/components/access/org-picker";
import { PublicShell } from "@/components/layout/public-shell";

export const Route = createFileRoute("/select-organization")({
	component: SelectOrganizationPage,
});

function SelectOrganizationPage() {
	return (
		<PublicShell contentClassName="py-8 sm:py-10">
			<OrgPicker />
		</PublicShell>
	);
}

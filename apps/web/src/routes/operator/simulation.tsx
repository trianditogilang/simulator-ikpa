import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/operator/simulation")({
	beforeLoad: () => {
		throw (redirect as any)({
			to: "/operator/history",
			replace: true,
		});
	},
	component: () => null,
});

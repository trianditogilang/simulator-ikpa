import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/operator/data/rpd-realization")({
	beforeLoad: ({ search }) => {
		throw redirect({
			to: "/operator/deviasi",
			search: {
				tab: "data",
				org: typeof (search as any)?.org === "string" ? (search as any).org : undefined,
			},
		});
	},
	component: () => null,
});


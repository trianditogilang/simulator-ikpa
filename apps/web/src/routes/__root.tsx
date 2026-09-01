import { ClerkProvider } from "@clerk/tanstack-react-start";
import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Agentation } from "agentation";
import type { RouterContext } from "../router";
import { getAuthSessionFn } from "../server/access";

import appCss from "../styles.css?url";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim();

export const Route = createRootRouteWithContext<RouterContext>()({
	beforeLoad: async () => ({
		auth: await getAuthSessionFn(),
	}),
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Simulator Penilaian IKPA Satker",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	const body = (
		<>
			{children}
			{process.env.NODE_ENV === "development" && <Agentation />}
			<TanStackDevtools
				config={{
					position: "bottom-right",
				}}
				plugins={[
					{
						name: "Tanstack Router",
						render: <TanStackRouterDevtoolsPanel />,
					},
				]}
			/>
		</>
	);

	return (
		<html lang="id">
			<head>
				<HeadContent />
			</head>
			<body>
				{clerkPublishableKey ? (
					<ClerkProvider publishableKey={clerkPublishableKey}>
						{body}
					</ClerkProvider>
				) : (
					body
				)}
				<Scripts />
			</body>
		</html>
	);
}

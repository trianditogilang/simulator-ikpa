import { createMiddleware, createStart } from "@tanstack/react-start";
import { getAuthContextFromRequest } from "./server/auth-session";

export const authMiddleware = createMiddleware().server(
	async ({ next, request }) => {
		const auth = await getAuthContextFromRequest(request);
		return next({
			context: {
				auth,
			},
		});
	},
);

export const startInstance = createStart(() => ({
	requestMiddleware: [authMiddleware],
}));

export const start = startInstance;

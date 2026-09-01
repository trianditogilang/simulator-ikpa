import { clerkMiddleware } from "@clerk/tanstack-react-start/server";
import { createStart } from "@tanstack/react-start";

const requestMiddleware = process.env.CLERK_SECRET_KEY
	? [clerkMiddleware()]
	: [];

export const startInstance = createStart(() => ({
	requestMiddleware,
}));

export const start = startInstance;

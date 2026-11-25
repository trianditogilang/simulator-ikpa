import { createStart } from "@tanstack/react-start";

// Sessions are verified per request by Better Auth (server/auth.server.ts);
// no global request middleware is needed.
export const startInstance = createStart(() => ({}));

export const start = startInstance;

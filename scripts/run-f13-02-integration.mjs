import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createClerkClient } from "@clerk/backend";

function waitForHttp(url, timeoutMs = 120_000) {
	const startedAt = Date.now();
	return new Promise((resolvePromise, reject) => {
		const probe = async () => {
			try {
				const response = await fetch(url);
				if (response.status >= 200 && response.status < 500) {
					resolvePromise();
					return;
				}
			} catch {
				// The dev server is still starting.
			}
			if (Date.now() - startedAt >= timeoutMs) {
				reject(new Error(`Timed out waiting for ${url}`));
				return;
			}
			setTimeout(probe, 500);
		};
		void probe();
	});
}

const envPath = resolve(".env.f13-02.local");
if (!existsSync(envPath)) {
	console.error("Missing .env.f13-02.local. Create it from the isolated test branch first.");
	process.exit(2);
}

const env = { ...process.env, NODE_ENV: "test" };
for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
	const line = rawLine.trim();
	if (!line || line.startsWith("#")) continue;
	const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
	if (!match) continue;
	const value = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
	env[match[1]] = value;
}

if (!env.DATABASE_URL || !env.DIRECT_URL) {
	console.error(".env.f13-02.local must contain DATABASE_URL and DIRECT_URL.");
	process.exit(2);
}

if (!env.CLERK_SECRET_KEY || !env.VITE_CLERK_PUBLISHABLE_KEY) {
	console.error(
		".env.f13-02.local must contain Clerk test keys for the authenticated HTTP harness.",
	);
	process.exit(2);
}
if (!env.F13_02_CLERK_OPERATOR_USER_ID) {
	console.error(
		".env.f13-02.local must contain F13_02_CLERK_OPERATOR_USER_ID for the seeded Operator fixture.",
	);
	process.exit(2);
}

const clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
const clerkSession = await clerkClient.sessions.createSession({
	userId: env.F13_02_CLERK_OPERATOR_USER_ID,
});
const clerkToken = await clerkClient.sessions.getToken(clerkSession.id);

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const httpUrl = "http://127.0.0.1:3002";
const httpServerEnv = {
	...env,
	F13_02_HTTP_URL: httpUrl,
};
const httpServer = spawn(
	npmCommand,
	["run", "dev", "--workspace", "@simulator-ikpa/web", "--", "--host", "127.0.0.1", "--port", "3002"],
	{ cwd: resolve("."), env: httpServerEnv, stdio: "inherit", shell: process.platform === "win32" },
);

let resultStatus = 1;
try {
	await waitForHttp(`${httpUrl}/`);
	const result = spawnSync(
		npmCommand,
		["run", "test:integration", "--workspace", "@simulator-ikpa/web"],
		{
			cwd: resolve("."),
			env: {
				...env,
				F13_02_HTTP_URL: httpUrl,
				F13_02_CLERK_SESSION_TOKEN: clerkToken.jwt,
			},
			stdio: "inherit",
			shell: process.platform === "win32",
		},
	);
	if (result.error) {
		console.error(`Unable to start integration test runner: ${result.error.message}`);
		resultStatus = 1;
	} else {
		resultStatus = result.status ?? 1;
	}
} catch (error) {
	console.error(`Unable to start F13-02 HTTP harness: ${error instanceof Error ? error.message : "unknown error"}`);
} finally {
	if (httpServer.pid) {
		if (process.platform === "win32") {
			spawnSync("taskkill", ["/PID", String(httpServer.pid), "/T", "/F"], { stdio: "ignore" });
		} else {
			httpServer.kill("SIGTERM");
		}
	}
	try {
		await clerkClient.sessions.revokeSession(clerkSession.id);
	} catch {
		// Session cleanup is best-effort; never print credentials or tokens.
	}
}

process.exit(resultStatus);

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const envPath = resolve(".env.f13-02.local");
if (!existsSync(envPath)) {
	console.error("Missing .env.f13-02.local.");
	process.exit(2);
}

const env = { ...process.env, NODE_ENV: "test" };
for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
	const line = rawLine.trim();
	if (!line || line.startsWith("#")) continue;
	const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
	if (!match) continue;
	env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
}

if (
	!env.DATABASE_URL ||
	!env.QSTASH_CURRENT_SIGNING_KEY ||
	!env.RESEND_API_KEY ||
	!env.NOTIFICATION_SENDER_EMAIL
) {
	console.error(
		".env.f13-02.local must contain the database and provider configuration.",
	);
	process.exit(2);
}

const targetUrl = env.F13_03_HTTP_URL ?? "http://127.0.0.1:3002";
const localTarget =
	targetUrl.startsWith("http://127.0.0.1:") ||
	targetUrl.startsWith("http://localhost:");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
let httpServer;

if (localTarget) {
	httpServer = spawn(
		npmCommand,
		[
			"run",
			"dev",
			"--workspace",
			"@simulator-ikpa/web",
			"--",
			"--host",
			"127.0.0.1",
			"--port",
			"3002",
		],
		{
			cwd: resolve("."),
			env: {
				...env,
				F13_03_HTTP_URL: targetUrl,
			},
			stdio: "inherit",
			shell: process.platform === "win32",
		},
	);
	const startedAt = Date.now();
	while (Date.now() - startedAt < 120_000) {
		try {
			const response = await fetch(targetUrl + "/");
			if (response.status >= 200 && response.status < 500) break;
		} catch {
			// The dev server is still starting.
		}
		await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
	}
}

let resultStatus = 1;
try {
	const result = spawnSync(
		npmCommand,
		[
			"run",
			"test:integration",
			"--workspace",
			"@simulator-ikpa/web",
			"--",
			"src/server/integration/qstash-resend.integration.test.ts",
		],
		{
			cwd: resolve("."),
			env: {
				...env,
				F13_03_REAL_PROVIDER_TEST: "1",
				F13_03_HTTP_URL: targetUrl,
			},
			stdio: "inherit",
			shell: process.platform === "win32",
		},
	);
	resultStatus = result.error ? 1 : result.status ?? 1;
} finally {
	if (httpServer?.pid) {
		if (process.platform === "win32") {
			spawnSync("taskkill", ["/PID", String(httpServer.pid), "/T", "/F"], {
				stdio: "ignore",
			});
		} else {
			httpServer.kill("SIGTERM");
		}
	}
}

process.exit(resultStatus);

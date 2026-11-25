import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { assertLoopbackUrl, localAuthEnv } from "./auth-fixture.mjs";

// F13-03 delivery probe on the ADR-008 stack (MIG-04): a local dev server
// sends over SMTP to Mailpit, and the test calls the job endpoint the way the
// VPS scheduler does. Only the process environment is read.
const env = { ...process.env, NODE_ENV: "test" };
env.DIRECT_URL ||= env.DATABASE_URL;
env.JOB_SECRET ||= randomBytes(32).toString("base64url");

try {
	assertLoopbackUrl(env.DATABASE_URL ?? "", "DATABASE_URL");
} catch (error) {
	console.error(error.message);
	process.exit(2);
}

const httpUrl = "http://127.0.0.1:3002";
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const httpServer = spawn(
	npmCommand,
	["run", "dev", "--workspace", "@simulator-ikpa/web", "--", "--host", "127.0.0.1", "--port", "3002"],
	{
		cwd: resolve("."),
		env: { ...env, ...localAuthEnv(httpUrl) },
		stdio: "inherit",
		shell: process.platform === "win32",
	},
);

let resultStatus = 1;
try {
	const startedAt = Date.now();
	while (Date.now() - startedAt < 120_000) {
		try {
			const response = await fetch(httpUrl + "/");
			if (response.status >= 200 && response.status < 500) break;
		} catch {
			// The dev server is still starting.
		}
		await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
	}
	const result = spawnSync(
		npmCommand,
		[
			"run",
			"test:integration",
			"--workspace",
			"@simulator-ikpa/web",
			"--",
			"src/server/integration/job-delivery.integration.test.ts",
		],
		{
			cwd: resolve("."),
			env: { ...env, F13_03_REAL_PROVIDER_TEST: "1", F13_03_HTTP_URL: httpUrl },
			stdio: "inherit",
			shell: process.platform === "win32",
		},
	);
	resultStatus = result.error ? 1 : (result.status ?? 1);
} finally {
	if (httpServer.pid) {
		if (process.platform === "win32") {
			spawnSync("taskkill", ["/PID", String(httpServer.pid), "/T", "/F"], { stdio: "ignore" });
		} else {
			httpServer.kill("SIGTERM");
		}
	}
}

process.exit(resultStatus);

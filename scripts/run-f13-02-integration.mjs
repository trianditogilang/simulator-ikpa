import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import {
	assertLoopbackUrl,
	createFixtureSession,
	localAuthEnv,
} from "./auth-fixture.mjs";
import { createSql } from "./pg-sql.mjs";

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

// Values already in the process environment win, so CI and local runs can
// point at their own database without editing the optional env file. NODE_ENV
// is owned by this runner: the suite runs the server in "test" mode, as CI does.
process.env.NODE_ENV = "test";
const env = { ...process.env };
const envPath = resolve(".env.f13-02.local");
if (existsSync(envPath)) {
	for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
		if (!match || process.env[match[1]] !== undefined) continue;
		env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
	}
}
env.DIRECT_URL ||= env.DATABASE_URL;
// The import-job test calls the handler with the scheduler's bearer secret.
env.JOB_SECRET ||= randomBytes(32).toString("base64url");

if (!env.DATABASE_URL || !env.DIRECT_URL) {
	console.error(
		"Set DATABASE_URL (environment or .env.f13-02.local) to the isolated test database.",
	);
	process.exit(2);
}

try {
	assertLoopbackUrl(env.DATABASE_URL, "DATABASE_URL");
	assertLoopbackUrl(env.DIRECT_URL, "DIRECT_URL");
} catch (error) {
	console.error(error.message);
	process.exit(2);
}

const sql = createSql(env.DATABASE_URL);
async function findFixtureUser(accessType) {
	const rows = await sql`
		SELECT u.id, u.email
		FROM users u
		INNER JOIN user_accesses ua ON ua.user_id = u.id
		WHERE ua.access_type = ${accessType}
			AND ua.active = true
			AND ua.status = 'active'
		ORDER BY ua.created_at
		LIMIT 1
	`;
	return rows[0];
}
const operatorUser = await findFixtureUser("operator_satker");
const adminUser = await findFixtureUser("admin_kppn");
if (!operatorUser || !adminUser) {
	console.error(
		"No active Operator/Admin fixture found. Migrate and seed the isolated test database first.",
	);
	process.exit(2);
}
// Repeated local runs must not trip the per-mailbox OTP quota.
await sql`DELETE FROM auth_rate_limits`;

// The Admin suite needs a satker in the Admin's KPPN scope that has no active
// Operator, with a 2026 fiscal year. The seed only creates the Operator's
// satker, so the harness adds this one idempotently.
await sql`
	INSERT INTO organizations (kppn_scope_id, kode_satker, name, kppn_name)
	SELECT ua.kppn_scope_id, 'F13ADM', 'Satker Fixture Admin F13', s.name
	FROM user_accesses ua
	INNER JOIN kppn_scopes s ON s.id = ua.kppn_scope_id
	WHERE ua.user_id = ${adminUser.id} AND ua.access_type = 'admin_kppn'
	LIMIT 1
	ON CONFLICT (kode_satker) DO NOTHING
`;
await sql`
	INSERT INTO fiscal_years (org_id, year, active_rule_set_id)
	SELECT o.id, 2026, fy.active_rule_set_id
	FROM organizations o
	CROSS JOIN LATERAL (
		SELECT f.active_rule_set_id
		FROM fiscal_years f
		INNER JOIN user_accesses ua ON ua.org_id = f.org_id
		WHERE ua.user_id = ${operatorUser.id} AND f.year = 2026
		LIMIT 1
	) fy
	WHERE o.kode_satker = 'F13ADM'
		AND NOT EXISTS (
			SELECT 1 FROM fiscal_years x WHERE x.org_id = o.id AND x.year = 2026
		)
`;

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const httpUrl = "http://127.0.0.1:3002";
const httpServerEnv = {
	...env,
	...localAuthEnv(httpUrl),
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
	await waitForHttp(`${httpUrl}/api/auth/ok`);
	const operatorCookie = await createFixtureSession({
		baseUrl: httpUrl,
		email: operatorUser.email,
	});
	const adminCookie = await createFixtureSession({
		baseUrl: httpUrl,
		email: adminUser.email,
	});
	const result = spawnSync(
		npmCommand,
		["run", "test:integration", "--workspace", "@simulator-ikpa/web"],
		{
			cwd: resolve("."),
			env: {
				...env,
				F13_02_HTTP_URL: httpUrl,
				F13_02_SESSION_COOKIE: operatorCookie,
				F13_02_ADMIN_SESSION_COOKIE: adminCookie,
				F13_02_OPERATOR_USER_ID: operatorUser.id,
				F13_02_ADMIN_USER_ID: adminUser.id,
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
	// Fixture sessions live only in the isolated test database.
}

process.exit(resultStatus);

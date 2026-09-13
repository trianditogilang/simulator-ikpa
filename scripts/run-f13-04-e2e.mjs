import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createClerkClient } from "@clerk/backend";
import { neon } from "@neondatabase/serverless";

function readEnvFile(path) {
	const env = {};
	for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
		if (!match) continue;
		env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
	}
	return env;
}

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
				// Preview/server is still starting.
			}
			if (Date.now() - startedAt >= timeoutMs) {
				reject(new Error("Timed out waiting for the F13-04 E2E target."));
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

const providerEnv = readEnvFile(envPath);
const env = { ...process.env, ...providerEnv, NODE_ENV: "test" };
if (!env.DATABASE_URL || !env.CLERK_SECRET_KEY || !env.F13_02_CLERK_OPERATOR_USER_ID) {
	console.error("F13-04 requires the isolated database, Clerk secret, and seeded Operator ID.");
	process.exit(2);
}

const targetArg = process.argv[2];
const targetUrl = targetArg || env.F13_04_HTTP_URL || null;
if (targetUrl) {
	try {
		const parsed = new URL(targetUrl);
		if (!/^https?:$/.test(parsed.protocol)) throw new Error("unsupported protocol");
	} catch {
		console.error("F13-04 target URL is invalid.");
		process.exit(2);
	}
}

const fixtureTag = randomUUID();
const sql = neon(env.DATABASE_URL);
const clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
const session = await clerkClient.sessions.createSession({
	userId: env.F13_02_CLERK_OPERATOR_USER_ID,
});

async function cleanupFixture() {
	for (let attempt = 0; attempt < 3; attempt += 1) {
		try {
			await sql`DELETE FROM simulations WHERE name LIKE ${`%${fixtureTag}%`}`;
			await sql`DELETE FROM notification_deliveries WHERE idempotency_key LIKE ${`%${fixtureTag}%`}`;
			return;
		} catch {
			if (attempt === 2) {
				console.error("F13-04 fixture cleanup failed; inspect only the isolated test branch.");
			}
		}
	}
}

async function seedHistoryFixture() {
	const [identity] = await sql`
		SELECT u.id AS user_id, ua.org_id
		FROM users u
		INNER JOIN user_accesses ua ON ua.user_id = u.id
		WHERE u.clerk_user_id = ${env.F13_02_CLERK_OPERATOR_USER_ID}
			AND ua.access_type = 'operator_satker'
			AND ua.active = true
			AND ua.status = 'active'
		LIMIT 1
	`;
	if (!identity?.user_id || !identity.org_id) {
		throw new Error("Configured Clerk user has no active Operator organization in the test database.");
	}

	const [fiscalYear] = await sql`
		SELECT id AS fiscal_year_id, active_rule_set_id
		FROM fiscal_years
		WHERE org_id = ${identity.org_id} AND year = 2026
		LIMIT 1
	`;
	if (!fiscalYear?.fiscal_year_id || !fiscalYear.active_rule_set_id) {
		throw new Error("Seeded Operator fiscal year is missing from the test database.");
	}
	const [ruleSet] = await sql`
		SELECT version FROM rule_sets WHERE id = ${fiscalYear.active_rule_set_id} LIMIT 1
	`;
	if (!ruleSet?.version) throw new Error("Seeded Operator rule set is missing from the test database.");
	const [reminderPolicy] = await sql`
		SELECT id AS reminder_policy_id
		FROM reminder_policies
		WHERE is_active = true
		ORDER BY id
		LIMIT 1
	`;
	if (!reminderPolicy?.reminder_policy_id) {
		throw new Error("Seeded reminder policy is missing from the test database.");
	}

	for (const month of [7, 8]) {
		const [simulation] = await sql`
			INSERT INTO simulations (fiscal_year_id, name, type, target_score, created_by)
			VALUES (
				${fiscalYear.fiscal_year_id},
				${`F13-04 E2E Actual ${fixtureTag} ${month}`},
				'actual',
				'95.00',
				${identity.user_id}
			)
			RETURNING id
		`;
		if (!simulation?.id) throw new Error("Unable to create the isolated E2E history fixture.");
		await sql`
			INSERT INTO score_snapshots (
				simulation_id, period_end, total_score, breakdown_json,
				rule_set_version, rule_set_id, input_hash, created_by
			)
			VALUES (
				${simulation.id},
				${`2026-${String(month).padStart(2, "0")}-01`},
				'88.0000',
				${JSON.stringify({ indicators: [], fixture: "f13-04" })}::jsonb,
				${ruleSet.version},
				${fiscalYear.active_rule_set_id},
				${`f13-04-${fixtureTag}-${month}`},
				${identity.user_id}
			)
		`;
	}

	await sql`
		INSERT INTO notification_deliveries (
			org_id, reminder_policy_id, rule_set_version, entity_type,
			scheduled_for, status, attempt_count, idempotency_key, payload_json
		)
		VALUES (
			${identity.org_id},
			${reminderPolicy.reminder_policy_id},
			${ruleSet.version},
			'f13-04-fixture',
			'2026-07-01T09:00:00Z',
			'scheduled',
			0,
			${`f13-04-${fixtureTag}-reminder`},
			${JSON.stringify({ fixture: "f13-04", recipient: "operator@example.test" })}::jsonb
		)
	`;
}

let resultStatus = 1;
try {
	await cleanupFixture();
	await seedHistoryFixture();
	if (targetUrl) await waitForHttp(`${targetUrl.replace(/\/$/, "")}/`);

	const token = await clerkClient.sessions.getToken(session.id, undefined, 3600);
	const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
	const childEnv = {
		...env,
		F13_04_E2E_TAG: fixtureTag,
		F13_04_CLERK_SESSION_TOKEN: token.jwt,
	};
	if (targetUrl) childEnv.F13_04_HTTP_URL = targetUrl.replace(/\/$/, "");
	else delete childEnv.F13_04_HTTP_URL;

	const result = spawnSync(
		npmCommand,
		["run", "test:e2e", "--workspace", "@simulator-ikpa/web"],
		{
			cwd: resolve("."),
			env: childEnv,
			stdio: "inherit",
			shell: process.platform === "win32",
		},
	);
	if (result.error) {
		console.error("Unable to start the F13-04 Playwright runner.");
		resultStatus = 1;
	} else {
		resultStatus = result.status ?? 1;
	}
} catch (error) {
	console.error(`F13-04 E2E runner failed: ${error instanceof Error ? error.message : "unknown error"}`);
} finally {
	await cleanupFixture();
	try {
		await clerkClient.sessions.revokeSession(session.id);
	} catch {
		// Best effort; never print credentials or tokens.
	}
}

process.exit(resultStatus);

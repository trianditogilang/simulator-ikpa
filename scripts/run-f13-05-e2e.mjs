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
				reject(new Error("Timed out waiting for the F13-05 E2E target."));
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
if (!env.DATABASE_URL || !env.CLERK_SECRET_KEY) {
	console.error("F13-05 requires the isolated database and Clerk secret.");
	process.exit(2);
}

const targetArg = process.argv[2];
const targetUrl = targetArg || env.F13_05_HTTP_URL || null;
if (targetUrl) {
	try {
		const parsed = new URL(targetUrl);
		if (!/^https?:$/.test(parsed.protocol)) throw new Error("unsupported protocol");
	} catch {
		console.error("F13-05 target URL is invalid.");
		process.exit(2);
	}
}

const fixtureTag = randomUUID().replaceAll("-", "").slice(0, 12);
const markerPrefix = `F13-05 E2E ${fixtureTag}`;
const ownActualCode = `F1305${fixtureTag.slice(0, 6)}A`;
const ownForecastCode = `F1305${fixtureTag.slice(0, 6)}P`;
const ownEmptyCode = `F1305${fixtureTag.slice(0, 6)}E`;
const peerOrgCode = `F1305${fixtureTag.slice(0, 6)}X`;
const peerScopeCode = `F13-05-SCOPE-${fixtureTag}`;
const ownActualName = `${markerPrefix} Actual`;
const ownForecastName = `${markerPrefix} Proyeksi`;
const ownEmptyName = `${markerPrefix} Kosong`;
const peerOrgName = `${markerPrefix} Peer out of scope`;
const deliveryFixtures = {
	CHROMIUM: {
		entity: `f13-05-delivery-${fixtureTag}-chromium`,
		error: `${markerPrefix} Chromium delivery failure`,
		recipient: `f13-05-${fixtureTag}-chromium@example.invalid`,
	},
	MOBILE: {
		entity: `f13-05-delivery-${fixtureTag}-mobile`,
		error: `${markerPrefix} Mobile delivery failure`,
		recipient: `f13-05-${fixtureTag}-mobile@example.invalid`,
	},
};
const peerDeliveryEntity = `f13-05-peer-delivery-${fixtureTag}`;
const peerRecipient = `peer-${fixtureTag}@example.invalid`;

const sql = neon(env.DATABASE_URL);
const clerkClient = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
let adminSession = null;
let adminUserId = "";
let adminScopeId = "";
let activeRuleSetId = "";
let activeRuleSetVersion = "";
let reminderPolicyId = "";
let ownActualOrgId = "";
let ownForecastOrgId = "";
let ownEmptyOrgId = "";
let peerOrgId = "";

async function cleanupFixture() {
	for (let attempt = 0; attempt < 3; attempt += 1) {
		try {
			await sql`
				DELETE FROM audit_logs
				WHERE entity_id IN (
					SELECT id FROM notification_deliveries
					WHERE idempotency_key LIKE ${`%${fixtureTag}%`}
				)
			`;
			await sql`
				DELETE FROM notification_deliveries
				WHERE idempotency_key LIKE ${`%${fixtureTag}%`}
			`;
			await sql`
				DELETE FROM simulations
				WHERE name LIKE ${`%${fixtureTag}%`}
			`;
			await sql`
				DELETE FROM organizations
				WHERE kode_satker LIKE ${`F1305${fixtureTag.slice(0, 6)}%`}
			`;
			await sql`DELETE FROM kppn_scopes WHERE code = ${peerScopeCode}`;
			return;
		} catch {
			if (attempt === 2) {
				console.error("F13-05 fixture cleanup failed; inspect only the isolated test branch.");
			}
		}
	}
}

function indicatorBreakdown(baseScore) {
	const keys = [
		"dipa_revision",
		"rpd_deviation",
		"budget_absorption",
		"contractual",
		"invoice_timeliness",
		"up_tup",
		"output_achievement",
	];
	return {
		indicators: keys.map((key, index) => ({
			key,
			score: String(baseScore - index * 0.25),
			weightedContribution: String((baseScore - index * 0.25) / keys.length),
		})),
		dispensationDeduction: "0.50",
	};
}

async function seedFixture() {
	const [admin] = await sql`
		SELECT
			u.id AS "adminUserId",
			u.clerk_user_id AS "clerkUserId",
			ua.kppn_scope_id AS "scopeId"
		FROM users u
		INNER JOIN user_accesses ua ON ua.user_id = u.id
		WHERE ua.access_type = 'admin_kppn'
			AND ua.active = true
			AND ua.status = 'active'
		LIMIT 1
	`;
	if (!admin?.adminUserId || !admin.scopeId || !admin.clerkUserId) {
		throw new Error("No active Admin KPPN fixture is mapped in the isolated database.");
	}
	adminUserId = admin.adminUserId;
	adminScopeId = admin.scopeId;

	const [base] = await sql`
		SELECT
			o.kppn_name AS "kppnName",
			f.active_rule_set_id AS "ruleSetId"
		FROM organizations o
		INNER JOIN fiscal_years f ON f.org_id = o.id AND f.year = 2026
		WHERE o.kppn_scope_id = ${adminScopeId}
		LIMIT 1
	`;
	if (!base?.ruleSetId || !base.kppnName) {
		throw new Error("Admin KPPN scope has no seeded 2026 fiscal year.");
	}
	activeRuleSetId = base.ruleSetId;
	const [ruleSet] = await sql`
		SELECT version FROM rule_sets WHERE id = ${activeRuleSetId} LIMIT 1
	`;
	if (!ruleSet?.version) throw new Error("Active Admin rule set is missing.");
	activeRuleSetVersion = ruleSet.version;
	const [policy] = await sql`
		SELECT id AS "policyId"
		FROM reminder_policies
		WHERE rule_set_id = ${activeRuleSetId} AND is_active = true
		ORDER BY id
		LIMIT 1
	`;
	if (!policy?.policyId) throw new Error("Active reminder policy is missing.");
	reminderPolicyId = policy.policyId;

	const [peerScope] = await sql`
		INSERT INTO kppn_scopes (code, name)
		VALUES (${peerScopeCode}, ${`${markerPrefix} Peer KPPN`})
		RETURNING id
	`;
	if (!peerScope?.id) throw new Error("Unable to create the isolated peer scope.");
	const [peerOrg] = await sql`
		INSERT INTO organizations (
			kppn_scope_id, kode_satker, name, kppn_name, is_blu, timezone
		)
		VALUES (
			${peerScope.id}, ${peerOrgCode}, ${peerOrgName},
			${`${markerPrefix} Peer KPPN`}, false, 'Asia/Jakarta'
		)
		RETURNING id
	`;
	if (!peerOrg?.id) throw new Error("Unable to create the isolated peer organization.");
	peerOrgId = peerOrg.id;
	const [peerFiscalYear] = await sql`
		INSERT INTO fiscal_years (org_id, year, active_rule_set_id)
		VALUES (${peerOrgId}, 2026, ${activeRuleSetId})
		RETURNING id
	`;
	if (!peerFiscalYear?.id) throw new Error("Unable to create the peer fiscal year fixture.");
	const [peerSimulation] = await sql`
		INSERT INTO simulations (fiscal_year_id, name, type, target_score, created_by)
		VALUES (${peerFiscalYear.id}, ${`${markerPrefix} Peer simulation`}, 'actual', '70.00', ${adminUserId})
		RETURNING id
	`;
	await sql`
		INSERT INTO score_snapshots (
			simulation_id, period_end, total_score, breakdown_json,
			rule_set_version, rule_set_id, input_hash, created_by
		)
		VALUES (
			${peerSimulation.id}, '2026-08-31', '70.0000',
			${JSON.stringify({ ...indicatorBreakdown(70), marker: peerOrgName })}::jsonb,
			${activeRuleSetVersion}, ${activeRuleSetId}, ${`${markerPrefix} peer input`}, ${adminUserId}
		)
	`;

	const ownDefinitions = [
		{ code: ownActualCode, name: ownActualName, type: "actual", score: "92.0000" },
		{ code: ownForecastCode, name: ownForecastName, type: "forecast", score: "84.0000" },
		{ code: ownEmptyCode, name: ownEmptyName, type: null, score: null },
	];
	for (const definition of ownDefinitions) {
		const [org] = await sql`
			INSERT INTO organizations (
				kppn_scope_id, kode_satker, name, kppn_name, is_blu, timezone
			)
			VALUES (
				${adminScopeId}, ${definition.code}, ${definition.name},
				${base.kppnName}, false, 'Asia/Jakarta'
			)
			RETURNING id
		`;
		if (!org?.id) throw new Error("Unable to create the isolated Admin organization fixture.");
		if (definition.code === ownActualCode) ownActualOrgId = org.id;
		if (definition.code === ownForecastCode) ownForecastOrgId = org.id;
		if (definition.code === ownEmptyCode) ownEmptyOrgId = org.id;
		const [fiscalYear] = await sql`
			INSERT INTO fiscal_years (org_id, year, active_rule_set_id)
			VALUES (${org.id}, 2026, ${activeRuleSetId})
			RETURNING id
		`;
		if (!fiscalYear?.id) throw new Error("Unable to create the Admin fiscal year fixture.");
		if (definition.type) {
			const [simulation] = await sql`
				INSERT INTO simulations (fiscal_year_id, name, type, target_score, created_by)
				VALUES (
					${fiscalYear.id}, ${definition.name}, ${definition.type},
					'90.00', ${adminUserId}
				)
				RETURNING id
			`;
			await sql`
				INSERT INTO score_snapshots (
					simulation_id, period_end, total_score, breakdown_json,
					rule_set_version, rule_set_id, input_hash, created_by
				)
				VALUES (
					${simulation.id}, '2026-08-31', ${definition.score},
					${JSON.stringify({ ...indicatorBreakdown(Number(definition.score)), marker: definition.name })}::jsonb,
					${activeRuleSetVersion}, ${activeRuleSetId}, ${`${definition.name} input`}, ${adminUserId}
				)
			`;
		}
	}

	for (const fixture of Object.values(deliveryFixtures)) {
		const [ownDelivery] = await sql`
			INSERT INTO notification_deliveries (
				org_id, reminder_policy_id, rule_set_version, entity_type,
				scheduled_for, status, attempt_count, idempotency_key, payload_json, error_message
			)
			VALUES (
				${ownActualOrgId}, ${reminderPolicyId}, ${activeRuleSetVersion}, ${fixture.entity},
				'2026-09-01T08:00:00Z', 'failed', 0, ${`${markerPrefix} own ${fixture.entity}`},
				${JSON.stringify({ fixture: markerPrefix, recipient: fixture.recipient })}::jsonb,
				${fixture.error}
			)
			RETURNING id
		`;
		if (!ownDelivery?.id) throw new Error("Unable to create the own failed delivery fixture.");
	}
	await sql`
		INSERT INTO notification_deliveries (
			org_id, reminder_policy_id, rule_set_version, entity_type,
			scheduled_for, status, attempt_count, idempotency_key, payload_json, error_message
		)
		VALUES (
			${peerOrgId}, ${reminderPolicyId}, ${activeRuleSetVersion}, ${peerDeliveryEntity},
			'2026-09-01T08:00:00Z', 'failed', 0, ${`${markerPrefix} peer delivery`},
			${JSON.stringify({ fixture: markerPrefix, recipient: peerRecipient })}::jsonb,
			${`${markerPrefix} peer error`}
		)
	`;

	return { adminClerkUserId: admin.clerkUserId };
}

async function verifyRetryAudit() {
	const [deliveries] = await sql`
		SELECT COUNT(*)::int AS count
		FROM notification_deliveries
		WHERE entity_type LIKE ${`f13-05-delivery-${fixtureTag}%`}
			AND status = 'scheduled'
			AND attempt_count = 1
	`;
	const [audits] = await sql`
		SELECT COUNT(*)::int AS count
		FROM audit_logs
		WHERE action = 'retry_delivery'
			AND actor_id = ${adminUserId}
			AND entity_id IN (
				SELECT id FROM notification_deliveries
				WHERE entity_type LIKE ${`f13-05-delivery-${fixtureTag}%`}
			)
	`;
	return Number(deliveries?.count ?? 0) === 2 && Number(audits?.count ?? 0) === 2;
}

let resultStatus = 1;
try {
	await cleanupFixture();
	const identity = await seedFixture();
	adminSession = await clerkClient.sessions.createSession({
		userId: identity.adminClerkUserId,
	});
	if (targetUrl) await waitForHttp(`${targetUrl.replace(/\/$/, "")}/`);

	const token = await clerkClient.sessions.getToken(adminSession.id, undefined, 3600);
	const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
	const childEnv = {
		...env,
		F13_05_E2E: "1",
		F13_05_E2E_TAG: fixtureTag,
		F13_05_CLERK_SESSION_TOKEN: token.jwt,
		F13_05_OWN_ACTUAL_ORG_ID: ownActualOrgId,
		F13_05_OWN_ACTUAL_CODE: ownActualCode,
		F13_05_OWN_FORECAST_CODE: ownForecastCode,
		F13_05_OWN_EMPTY_CODE: ownEmptyCode,
		F13_05_PEER_ORG_ID: peerOrgId,
		F13_05_PEER_MARKER: peerOrgName,
		F13_05_DELIVERY_ERROR_CHROMIUM: deliveryFixtures.CHROMIUM.error,
		F13_05_DELIVERY_RECIPIENT_CHROMIUM: deliveryFixtures.CHROMIUM.recipient,
		F13_05_DELIVERY_ERROR_MOBILE: deliveryFixtures.MOBILE.error,
		F13_05_DELIVERY_RECIPIENT_MOBILE: deliveryFixtures.MOBILE.recipient,
	};
	if (targetUrl) childEnv.F13_05_HTTP_URL = targetUrl.replace(/\/$/, "");
	else delete childEnv.F13_05_HTTP_URL;

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
		console.error("Unable to start the F13-05 Playwright runner.");
		resultStatus = 1;
	} else {
		resultStatus = result.status ?? 1;
	}
	if (resultStatus === 0 && !(await verifyRetryAudit())) {
		console.error("F13-05 retry audit verification failed.");
		resultStatus = 1;
	}
} catch (error) {
	console.error(
		`F13-05 E2E runner failed: ${error instanceof Error ? error.message : "unknown error"}`,
	);
} finally {
	await cleanupFixture();
	if (adminSession) {
		try {
			await clerkClient.sessions.revokeSession(adminSession.id);
		} catch {
			// Best effort; never print credentials or tokens.
		}
	}
}

process.exit(resultStatus);

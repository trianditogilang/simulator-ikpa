import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { Pool } from "@neondatabase/serverless";
import { and, desc, eq, isNull } from "drizzle-orm";
import { resolveUserAccess } from "@simulator-ikpa/access-control";
import { createDbClient } from "@simulator-ikpa/db";
import {
	fiscalYears,
	organizations,
	scoreSnapshots,
	simulations,
} from "@simulator-ikpa/db/schema";
import { planDeliveries } from "@simulator-ikpa/policy-reminder";
import { parseImportFile } from "../apps/web/src/server/import/parser.ts";
import { getActiveReminderEvents, getWorkdayCalendar } from "../apps/web/src/server/reminders/active-events.queries.ts";
import { calculateAndPersistSnapshot } from "../apps/web/src/server/simulation/calculate.ts";
import { buildOperatorXlsxBuffer } from "../apps/web/src/server/exports/operator-xlsx.ts";

dotenv.config({ path: ".env.f13-02.local", quiet: true });

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const operatorClerkUserId = process.env.F13_02_CLERK_OPERATOR_USER_ID;

if (!databaseUrl || !operatorClerkUserId) {
	console.error(
		"F13-07 requires the isolated test database and Clerk Operator ID in .env.f13-02.local.",
	);
	process.exit(2);
}

const db = createDbClient(databaseUrl);
const pool = new Pool({ connectionString: databaseUrl });
const fixtureName = `F13-07 benchmark ${randomUUID()}`;

function stats(values) {
	const sorted = [...values].sort((a, b) => a - b);
	const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
	return {
		minMs: Number(Math.min(...sorted).toFixed(1)),
		medianMs: Number(sorted[Math.floor(sorted.length / 2)].toFixed(1)),
		p95Ms: Number(percentile(0.95).toFixed(1)),
		maxMs: Number(Math.max(...sorted).toFixed(1)),
	};
}

async function benchmark(fn, runs = 3) {
	const warm = await fn();
	const times = [];
	let observed = warm;
	for (let i = 0; i < runs; i += 1) {
		const started = performance.now();
		observed = await fn();
		times.push(performance.now() - started);
	}
	return { ...stats(times), observed };
}

function summarizePlan(value) {
	const nodes = [];
	const visit = (node) => {
		if (!node || typeof node !== "object") return;
		if (node["Node Type"]) {
			nodes.push({
				nodeType: node["Node Type"],
				indexName: node["Index Name"] ?? null,
				relationName: node["Relation Name"] ?? null,
			});
		}
		for (const child of Object.values(node)) visit(child);
	};
	visit(value);
	return nodes.filter(
		(node, index, all) =>
			all.findIndex(
				(candidate) =>
					candidate.nodeType === node.nodeType &&
					candidate.indexName === node.indexName &&
					candidate.relationName === node.relationName,
			) === index,
	);
}

async function collectQueryPlan(name, query, params) {
	const result = await pool.query(`EXPLAIN (FORMAT JSON) ${query}`, params);
	return { name, nodes: summarizePlan(result.rows[0]?.["QUERY PLAN"]) };
}

async function main() {
	const access = await resolveUserAccess(db, { clerkUserId: operatorClerkUserId });
	if (
		access.status !== "operator_single_scope" &&
		access.status !== "operator_multiple_scopes"
	) {
		throw new Error("Configured Clerk identity is not mapped to an Operator scope.");
	}

	let target = null;
	for (const organization of access.organizations) {
		const [fiscalYear] = await db
			.select({ id: fiscalYears.id })
			.from(fiscalYears)
			.where(
				and(eq(fiscalYears.orgId, organization.id), eq(fiscalYears.year, 2026)),
			)
			.limit(1);
		if (fiscalYear) {
			const [org] = await db
				.select({ id: organizations.id, kppnScopeId: organizations.kppnScopeId })
				.from(organizations)
				.where(eq(organizations.id, organization.id))
				.limit(1);
			if (org) target = { orgId: org.id, fiscalYearId: fiscalYear.id, kppnScopeId: org.kppnScopeId };
			if (target) break;
		}
	}
	if (!target) throw new Error("No seeded Operator fiscal year is available for the benchmark.");

	const cleanupFixtureSimulations = async () => {
		const rows = await db
			.select({ id: simulations.id })
			.from(simulations)
			.where(eq(simulations.name, fixtureName));
		for (const row of rows) {
			await db
				.delete(scoreSnapshots)
				.where(eq(scoreSnapshots.simulationId, row.id));
			await db
				.delete(simulations)
				.where(eq(simulations.id, row.id));
		}
	};

	const parserRows = ["month,account_code,amount"];
	for (let i = 0; i < 10_000; i += 1) {
		parserRows.push(`${(i % 12) + 1},51,1000000`);
	}
	const parserBuffer = new TextEncoder().encode(parserRows.join("\n"));
	const parseOptions = {
		domain: "rpd_realization",
		buffer: parserBuffer,
		filename: "f13-07-10k.csv",
		mimeType: "text/csv",
		size: parserBuffer.byteLength,
	};
	const import10k = await benchmark(async () => {
		const result = await parseImportFile(parseOptions);
		if (result.totalRows !== 10_000 || result.validRows.length !== 10_000) {
			throw new Error("The 10k import fixture did not validate.");
		}
		return { rows: result.totalRows, bytes: parserBuffer.byteLength };
	}, 5);

	const calculate = async () =>
		calculateAndPersistSnapshot(
			db,
			access,
			{
				orgId: target.orgId,
				fiscalYearId: target.fiscalYearId,
				period: { kind: "month", value: 8 },
				simulationType: "forecast",
				targetScore: "95.00",
				simulationName: fixtureName,
			},
			{ actorId: access.userId },
		);
	await calculate();
	await cleanupFixtureSimulations();
	const calculationTimes = [];
	for (let i = 0; i < 3; i += 1) {
		const started = performance.now();
		const result = await calculate();
		calculationTimes.push(performance.now() - started);
		if (!result.snapshot) throw new Error("Calculation did not persist a snapshot.");
		await cleanupFixtureSimulations();
	}

	const dashboardAggregate = await benchmark(async () => {
		const orgRows = await db
			.select({ id: organizations.id })
			.from(organizations)
			.where(eq(organizations.kppnScopeId, target.kppnScopeId));
		const summaries = await Promise.all(
			orgRows.map(async (org) => {
				const [fiscalYear] = await db
					.select({ id: fiscalYears.id })
					.from(fiscalYears)
					.where(
						and(eq(fiscalYears.orgId, org.id), eq(fiscalYears.year, 2026)),
					)
					.limit(1);
				if (!fiscalYear) return null;
				const [snapshot] = await db
					.select({ totalScore: scoreSnapshots.totalScore })
					.from(scoreSnapshots)
					.innerJoin(simulations, eq(scoreSnapshots.simulationId, simulations.id))
					.where(
						and(
							eq(simulations.fiscalYearId, fiscalYear.id),
							isNull(simulations.deletedAt),
						),
					)
					.orderBy(desc(scoreSnapshots.createdAt))
					.limit(1);
				return snapshot?.totalScore ?? null;
			}),
		);
		return {
			satkers: orgRows.length,
			snapshots: summaries.filter((score) => score !== null).length,
		};
	}, 3);

	const calendar = await getWorkdayCalendar(db, 2026);
	const schedulerBatch = await benchmark(async () => {
		const events = await getActiveReminderEvents(db, target.orgId, target.fiscalYearId);
		const planned = planDeliveries({
			orgId: target.orgId,
			fiscalYearId: target.fiscalYearId,
			policyId: target.fiscalYearId,
			eventType: events[0]?.eventType ?? "f13-07-benchmark",
			deadline: events[0]?.deadlineDate ?? "2026-12-31",
			leadDays: [5, 2, 0],
			dayType: "workday",
			calendar,
			ruleSetVersion: "2026.1",
			ruleSetId: target.fiscalYearId,
		});
		return { events: events.length, planned: planned.length };
	}, 3);

	const exportOperator = await benchmark(async () => {
		const buffer = await buildOperatorXlsxBuffer({
			orgId: target.orgId,
			db,
			fiscalYearId: target.fiscalYearId,
		});
		return { bytes: buffer.byteLength };
	}, 3);

	const expectedIndexes = [
		"organizations_kppn_scope_id_idx",
		"fiscal_years_org_year_idx",
		"rpd_lines_fiscal_year_id_idx",
		"score_snapshots_simulation_id_idx",
		"score_snapshots_created_at_idx",
		"import_jobs_org_id_idx",
		"notification_deliveries_status_idx",
		"notification_deliveries_scheduled_for_idx",
	];
	const indexRows = await pool.query(
		"SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1)",
		[expectedIndexes],
	);
	const presentIndexes = new Set(indexRows.rows.map((row) => row.indexname));
	const queryPlanReview = {
		indexes: expectedIndexes.map((name) => ({ name, present: presentIndexes.has(name) })),
		plans: await Promise.all([
			collectQueryPlan(
				"fiscal_year_scope",
				"SELECT id FROM fiscal_years WHERE org_id = $1 AND year = $2",
				[target.orgId, 2026],
			),
			collectQueryPlan(
				"rpd_scope",
				"SELECT id FROM rpd_lines WHERE fiscal_year_id = $1 AND deleted_at IS NULL",
				[target.fiscalYearId],
			),
			collectQueryPlan(
				"snapshot_history",
				"SELECT ss.id FROM score_snapshots ss JOIN simulations s ON ss.simulation_id = s.id WHERE s.fiscal_year_id = $1 AND s.deleted_at IS NULL ORDER BY ss.created_at DESC",
				[target.fiscalYearId],
			),
			collectQueryPlan(
				"import_scope",
				"SELECT id FROM import_jobs WHERE org_id = $1 AND fiscal_year_id = $2 ORDER BY created_at DESC LIMIT 20",
				[target.orgId, target.fiscalYearId],
			),
			collectQueryPlan(
				"delivery_batch",
				"SELECT id FROM notification_deliveries WHERE status = $1 AND scheduled_for <= $2 ORDER BY scheduled_for LIMIT 50",
				["scheduled", new Date().toISOString()],
			),
		]),
	};

	console.log(
		JSON.stringify(
			{
				database: "isolated-test",
				operatorScopes: access.organizations.length,
				benchmarks: {
					calculation: { ...stats(calculationTimes), under500Median: stats(calculationTimes).medianMs < 500 },
					import10k,
					dashboardAggregate,
					schedulerBatch,
					exportOperator,
				},
				queryPlanReview,
			},
			null,
			2,
		),
	);
}

try {
	await main();
} catch (error) {
	console.error(
		"F13-07 performance benchmark failed:",
		error instanceof Error ? error.name : "unknown error",
	);
	process.exitCode = 1;
} finally {
	try {
		const rows = await db
			.select({ id: simulations.id })
			.from(simulations)
			.where(eq(simulations.name, fixtureName));
		for (const row of rows) {
			await db
				.delete(scoreSnapshots)
				.where(eq(scoreSnapshots.simulationId, row.id));
			await db.delete(simulations).where(eq(simulations.id, row.id));
		}
	} catch {
		// Best-effort cleanup; the fixture name is unique to this process.
	}
	await pool.end();
}

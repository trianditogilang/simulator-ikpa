import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { toJSONAsync } from "seroval";
import { createDbClient } from "@simulator-ikpa/db";
import {
	fiscalYears,
	kppnScopes,
	organizations,
	ruleSets,
	scoreSnapshots,
	simulationOverrides,
	simulations,
	userAccesses,
	users,
} from "@simulator-ikpa/db/schema";
import { and, eq, inArray } from "drizzle-orm";

const baseUrl = process.env.F13_02_HTTP_URL;
const testDatabaseUrl = process.env.DATABASE_URL;
const configuredClerkUserId = process.env.F13_02_CLERK_OPERATOR_USER_ID;
const sessionToken = process.env.F13_02_CLERK_SESSION_TOKEN;
if (!baseUrl || !testDatabaseUrl || !configuredClerkUserId || !sessionToken) {
	throw new Error(
		"F13-02 simulation HTTP integration requires the isolated database and short-lived Clerk session.",
	);
}

const db = createDbClient(testDatabaseUrl);
const fixtureTag = randomUUID();
const peerScopeCode = `F13-02-SIM-SCOPE-${fixtureTag}`;
const peerOrgCode = `F13-02-SIM-ORG-${fixtureTag}`;
const ownActualName = `F13-02 own actual ${fixtureTag}`;
const ownScenarioName = `F13-02 own scenario ${fixtureTag}`;
const peerScenarioName = `F13-02 peer scenario ${fixtureTag}`;
const whatIfName = `F13-02 HTTP what-if ${fixtureTag}`;
const peerPayloadMarker = `peer-payload-${fixtureTag}`;
const peerTransactionMarker = `peer-transaction-${fixtureTag}`;
const deniedPattern = /ditolak|wewenang|unauthorized|forbidden|tidak ditemukan/i;

let operatorUserId = "";
let orgId = "";
let fiscalYearId = "";
let ruleSetId = "";
let ruleSetVersion = "";
let peerScopeId = "";
let peerOrgId = "";
let peerFiscalYearId = "";
let ownActualSimulationId = "";
let ownActualSnapshotId = "";
let ownScenarioSnapshotId = "";
let peerScenarioId = "";
let peerSnapshotId = "";
const ownFixtureSimulationIds = new Set<string>();

async function findServerFnId(sourcePath: string, exportName: string): Promise<string> {
	const response = await fetch(`${baseUrl}${sourcePath}`);
	if (!response.ok) throw new Error(`Cannot load ${sourcePath}: HTTP ${response.status}`);
	const source = await response.text();
	const start = source.indexOf(`export const ${exportName} =`);
	if (start < 0) throw new Error(`Cannot find ${exportName} in ${sourcePath}`);
	const nextExport = source.indexOf("\nexport const ", start + 1);
	const match = source
		.slice(start, nextExport < 0 ? undefined : nextExport)
		.match(/createClientRpc\("([^"]+)"\)/);
	if (!match?.[1]) throw new Error(`Cannot resolve server function metadata for ${exportName}`);
	return match[1];
}

async function callServerFn(args: {
	id: string;
	method: "GET" | "POST";
	data: unknown;
}): Promise<{ status: number; body: string }> {
	const payload = JSON.stringify(await toJSONAsync({ data: args.data }));
	const headers = new Headers({
		"x-tsr-serverFn": "true",
		accept: "application/json",
		authorization: `Bearer ${sessionToken}`,
	});
	const init: RequestInit = { method: args.method, headers };
	let url = `${baseUrl}/_serverFn/${encodeURIComponent(args.id)}`;
	if (args.method === "GET") {
		url += `?payload=${encodeURIComponent(payload)}`;
	} else {
		headers.set("content-type", "application/json");
		init.body = payload;
	}
	const response = await fetch(url, init);
	return { status: response.status, body: await response.text() };
}

function expectDenied(
	result: { status: number; body: string },
	forbiddenValues: string[],
) {
	expect(result.status).toBe(200);
	expect(deniedPattern.test(result.body)).toBe(true);
	for (const value of forbiddenValues) {
		expect(result.body.includes(value)).toBe(false);
	}
}

async function expectPeerUnchanged() {
	const peerRows = await db
		.select({
			id: simulations.id,
			name: simulations.name,
			targetScore: simulations.targetScore,
			deletedAt: simulations.deletedAt,
		})
		.from(simulations)
		.where(eq(simulations.fiscalYearId, peerFiscalYearId));
	const overrides = await db
		.select({ patchJson: simulationOverrides.patchJson })
		.from(simulationOverrides)
		.where(eq(simulationOverrides.simulationId, peerScenarioId));
	const snapshots = await db
		.select({ id: scoreSnapshots.id, breakdownJson: scoreSnapshots.breakdownJson })
		.from(scoreSnapshots)
		.where(eq(scoreSnapshots.simulationId, peerScenarioId));

	expect(peerRows).toHaveLength(1);
	expect(peerRows[0]?.id).toBe(peerScenarioId);
	expect(peerRows[0]?.name).toBe(peerScenarioName);
	expect(peerRows[0]?.targetScore).toBe("91.0000");
	expect(peerRows[0]?.deletedAt).toBeNull();
	expect(overrides).toHaveLength(1);
	expect(JSON.stringify(overrides[0]?.patchJson).includes(peerPayloadMarker)).toBe(true);
	expect(snapshots).toHaveLength(1);
	expect(snapshots[0]?.id).toBe(peerSnapshotId);
	expect(JSON.stringify(snapshots[0]?.breakdownJson).includes(peerTransactionMarker)).toBe(
		true,
	);
}

async function getActualFixtureState() {
	const [simulation] = await db
		.select()
		.from(simulations)
		.where(eq(simulations.id, ownActualSimulationId));
	const [snapshot] = await db
		.select()
		.from(scoreSnapshots)
		.where(eq(scoreSnapshots.id, ownActualSnapshotId));
	return { simulation, snapshot };
}

beforeAll(async () => {
	const [operator] = await db
		.select({ id: users.id, orgId: userAccesses.orgId })
		.from(users)
		.innerJoin(userAccesses, eq(userAccesses.userId, users.id))
		.where(
			and(
				eq(userAccesses.accessType, "operator_satker"),
				eq(users.clerkUserId, configuredClerkUserId),
			),
		)
		.limit(1);
	if (!operator?.orgId) {
		throw new Error("Configured Clerk operator is not mapped to an organization.");
	}
	operatorUserId = operator.id;
	orgId = operator.orgId;

	const [fy] = await db
		.select({ id: fiscalYears.id, activeRuleSetId: fiscalYears.activeRuleSetId })
		.from(fiscalYears)
		.where(and(eq(fiscalYears.orgId, orgId), eq(fiscalYears.year, 2026)))
		.limit(1);
	if (!fy) throw new Error("Seeded operator fiscal year is missing.");
	fiscalYearId = fy.id;
	ruleSetId = fy.activeRuleSetId;

	const [ruleSet] = await db
		.select({ version: ruleSets.version })
		.from(ruleSets)
		.where(eq(ruleSets.id, ruleSetId))
		.limit(1);
	if (!ruleSet) throw new Error("Seeded active rule set is missing.");
	ruleSetVersion = ruleSet.version;

	const [scope] = await db
		.insert(kppnScopes)
		.values({ code: peerScopeCode, name: "F13-02 Simulation HTTP Peer Scope" })
		.returning({ id: kppnScopes.id });
	const [peerOrg] = await db
		.insert(organizations)
		.values({
			kppnScopeId: scope.id,
			kodeSatker: peerOrgCode,
			name: "F13-02 Simulation HTTP Peer Organization",
			kppnName: "F13-02 Simulation HTTP Peer Scope",
			isBlu: false,
			timezone: "Asia/Jakarta",
		})
		.returning({ id: organizations.id });
	const [peerFy] = await db
		.insert(fiscalYears)
		.values({ orgId: peerOrg.id, year: 2026, activeRuleSetId: ruleSetId })
		.returning({ id: fiscalYears.id });
	peerScopeId = scope.id;
	peerOrgId = peerOrg.id;
	peerFiscalYearId = peerFy.id;

	const [ownActual] = await db
		.insert(simulations)
		.values({
			fiscalYearId,
			name: ownActualName,
			type: "actual",
			targetScore: "95.00",
			createdBy: operatorUserId,
		})
		.returning({ id: simulations.id });
	ownActualSimulationId = ownActual.id;
	ownFixtureSimulationIds.add(ownActual.id);

	const [ownActualSnapshot] = await db
		.insert(scoreSnapshots)
		.values({
			simulationId: ownActual.id,
			periodEnd: "2026-07-01",
			totalScore: "88.0000",
			breakdownJson: { indicators: [], marker: `own-actual-${fixtureTag}` },
			ruleSetVersion,
			ruleSetId,
			inputHash: `own-actual-${fixtureTag}`,
			createdBy: operatorUserId,
		})
		.returning({ id: scoreSnapshots.id });
	ownActualSnapshotId = ownActualSnapshot.id;

	const [ownScenario] = await db
		.insert(simulations)
		.values({
			fiscalYearId,
			name: ownScenarioName,
			type: "scenario",
			targetScore: "94.00",
			parentSnapshotId: ownActualSnapshot.id,
			createdBy: operatorUserId,
		})
		.returning({ id: simulations.id });
	ownFixtureSimulationIds.add(ownScenario.id);
	await db.insert(simulationOverrides).values({
		simulationId: ownScenario.id,
		entityType: "assumptions",
		patchJson: { dispensasi: { dispensationCount: 0, totalSpmQ4: 10 } },
	});
	const [ownScenarioSnapshot] = await db
		.insert(scoreSnapshots)
		.values({
			simulationId: ownScenario.id,
			periodEnd: "2026-08-01",
			totalScore: "90.0000",
			breakdownJson: { indicators: [], marker: `own-scenario-${fixtureTag}` },
			ruleSetVersion,
			ruleSetId,
			inputHash: `own-scenario-${fixtureTag}`,
			createdBy: operatorUserId,
		})
		.returning({ id: scoreSnapshots.id });
	ownScenarioSnapshotId = ownScenarioSnapshot.id;

	const [peerScenario] = await db
		.insert(simulations)
		.values({
			fiscalYearId: peerFiscalYearId,
			name: peerScenarioName,
			type: "scenario",
			targetScore: "91.00",
			createdBy: operatorUserId,
		})
		.returning({ id: simulations.id });
	peerScenarioId = peerScenario.id;
	await db.insert(simulationOverrides).values({
		simulationId: peerScenario.id,
		entityType: "peer-secret",
		patchJson: { marker: peerPayloadMarker },
	});
	const [peerSnapshot] = await db
		.insert(scoreSnapshots)
		.values({
			simulationId: peerScenario.id,
			periodEnd: "2026-08-01",
			totalScore: "87.0000",
			breakdownJson: { indicators: [], transaction: peerTransactionMarker },
			ruleSetVersion,
			ruleSetId,
			inputHash: `peer-${fixtureTag}`,
			createdBy: operatorUserId,
		})
		.returning({ id: scoreSnapshots.id });
	peerSnapshotId = peerSnapshot.id;
});

afterAll(async () => {
	if (fiscalYearId) {
		const createdWhatIf = await db
			.select({ id: simulations.id })
			.from(simulations)
			.where(
				and(
					eq(simulations.fiscalYearId, fiscalYearId),
					eq(simulations.name, whatIfName),
				),
			);
		for (const row of createdWhatIf) ownFixtureSimulationIds.add(row.id);
	}
	const ownIds = [...ownFixtureSimulationIds];
	if (ownIds.length > 0) {
		await db.delete(simulations).where(inArray(simulations.id, ownIds));
	}
	if (peerOrgId) await db.delete(organizations).where(eq(organizations.id, peerOrgId));
	if (peerScopeId) await db.delete(kppnScopes).where(eq(kppnScopes.id, peerScopeId));
});

describe("F13-02 simulation authenticated HTTP boundary", () => {
	it("listSnapshotsFn reads own snapshots and rejects peer snapshots without leakage", async () => {
		const id = await findServerFnId("/src/server/simulation.ts", "listSnapshotsFn");
		const own = await callServerFn({ id, method: "GET", data: { orgId, year: 2026 } });
		expect(own.status).toBe(200);
		expect(own.body.includes(ownActualSnapshotId)).toBe(true);
		expect(own.body.includes(ownScenarioSnapshotId)).toBe(true);
		expect(own.body.includes(ownActualName)).toBe(true);
		expect(own.body.includes(ownScenarioName)).toBe(true);
		expect(own.body.includes(peerScenarioId)).toBe(false);
		expect(own.body.includes(peerTransactionMarker)).toBe(false);

		const peer = await callServerFn({
			id,
			method: "GET",
			data: { orgId: peerOrgId, year: 2026 },
		});
		expectDenied(peer, [
			peerOrgId,
			peerFiscalYearId,
			peerScenarioId,
			peerSnapshotId,
			peerScenarioName,
			peerPayloadMarker,
			peerTransactionMarker,
		]);
	});

	it("runSimulationFn keeps actual immutable, persists a separate own what-if, and rejects peer writes", async () => {
		const id = await findServerFnId("/src/server/simulation.ts", "runSimulationFn");
		const actualBefore = await getActualFixtureState();
		const own = await callServerFn({
			id,
			method: "POST",
			data: {
				orgId,
				period: { kind: "month", value: 9 },
				simulationType: "scenario",
				targetScore: "95.00",
				simulationName: whatIfName,
				assumptions: {
					dispensasi: { dispensationCount: 1, totalSpmQ4: 10 },
				},
			},
		});
		expect(own.status).toBe(200);
		expect(own.body.includes("simulationId")).toBe(true);
		const [createdScenario] = await db
			.select({ id: simulations.id, type: simulations.type })
			.from(simulations)
			.where(
				and(
					eq(simulations.fiscalYearId, fiscalYearId),
					eq(simulations.name, whatIfName),
				),
			)
			.limit(1);
		expect(createdScenario?.type).toBe("scenario");
		expect(createdScenario?.id === ownActualSimulationId).toBe(false);
		if (createdScenario) ownFixtureSimulationIds.add(createdScenario.id);
		expect(await getActualFixtureState()).toEqual(actualBefore);

		const peer = await callServerFn({
			id,
			method: "POST",
			data: {
				orgId: peerOrgId,
				period: { kind: "month", value: 9 },
				simulationType: "scenario",
				simulationName: `peer-write-${fixtureTag}`,
				assumptions: {
					dispensasi: { dispensationCount: 1, totalSpmQ4: 10 },
				},
			},
		});
		expectDenied(peer, [peerOrgId, peerFiscalYearId, peerPayloadMarker, peerTransactionMarker]);
		await expectPeerUnchanged();
	});

	it("updateScenarioFn rejects an own-org request carrying a peer scenario ID", async () => {
		const id = await findServerFnId("/src/server/simulation.ts", "updateScenarioFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: {
				orgId,
				scenarioId: peerScenarioId,
				name: `unauthorized-update-${fixtureTag}`,
				targetScore: "1.00",
				indicatorScores: { absorption: 1 },
			},
		});
		expectDenied(result, [
			peerOrgId,
			peerFiscalYearId,
			peerScenarioId,
			peerSnapshotId,
			peerPayloadMarker,
			peerTransactionMarker,
		]);
		await expectPeerUnchanged();
	});

	it("duplicateScenarioFn rejects an own-org request carrying a peer scenario ID", async () => {
		const id = await findServerFnId("/src/server/simulation.ts", "duplicateScenarioFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: {
				orgId,
				scenarioId: peerScenarioId,
				newName: `unauthorized-copy-${fixtureTag}`,
			},
		});
		expectDenied(result, [
			peerOrgId,
			peerFiscalYearId,
			peerScenarioId,
			peerSnapshotId,
			peerPayloadMarker,
			peerTransactionMarker,
		]);
		await expectPeerUnchanged();
	});

	it("deleteScenarioFn rejects an own-org request carrying a peer scenario ID", async () => {
		const id = await findServerFnId("/src/server/simulation.ts", "deleteScenarioFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: { orgId, scenarioId: peerScenarioId },
		});
		expectDenied(result, [
			peerOrgId,
			peerFiscalYearId,
			peerScenarioId,
			peerSnapshotId,
			peerPayloadMarker,
			peerTransactionMarker,
		]);
		await expectPeerUnchanged();
	});
});

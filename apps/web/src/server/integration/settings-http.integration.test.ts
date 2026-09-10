import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { toJSONAsync } from "seroval";
import { createDbClient } from "@simulator-ikpa/db";
import {
	fiscalYears,
	kppnScopes,
	organizations,
	userAccesses,
	users,
} from "@simulator-ikpa/db/schema";
import { and, eq } from "drizzle-orm";

const baseUrl = process.env.F13_02_HTTP_URL;
const testDatabaseUrl = process.env.DATABASE_URL;
const configuredClerkUserId = process.env.F13_02_CLERK_OPERATOR_USER_ID;
const sessionToken = process.env.F13_02_CLERK_SESSION_TOKEN;
if (!baseUrl || !testDatabaseUrl || !configuredClerkUserId || !sessionToken) {
	throw new Error(
		"F13-02 settings HTTP integration requires the isolated database and short-lived Clerk session.",
	);
}

const db = createDbClient(testDatabaseUrl);
const fixtureTag = randomUUID().replaceAll("-", "").slice(0, 12);
const peerScopeCode = `F13-02-SET-SCOPE-${fixtureTag}`;
const peerOrgCode = `F13SE${fixtureTag.slice(0, 7)}`;
const peerOrgName = `F13-02 settings peer ${fixtureTag}`;
const peerKppnName = `F13-02 settings peer KPPN ${fixtureTag}`;
const attemptedPeerName = `F13-02 attempted peer update ${fixtureTag}`;
const deniedPattern = /ditolak|wewenang|unauthorized|forbidden|tidak ditemukan|tidak valid|terdaftar/i;

let operatorUserId = "";
let orgId = "";
let ownOrgCode = "";
let ownOrgName = "";
let peerScopeId = "";
let peerOrgId = "";
let peerFiscalYearId = "";

async function findServerFnId(exportName: string): Promise<string> {
	const sourcePath = "/src/server/settings.ts";
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

function expectDenied(result: { status: number; body: string }) {
	expect(result.status).toBe(200);
	expect(deniedPattern.test(result.body)).toBe(true);
	for (const value of [
		peerOrgId,
		peerFiscalYearId,
		peerOrgCode,
		peerOrgName,
		peerKppnName,
		attemptedPeerName,
	]) {
		expect(result.body.includes(value)).toBe(false);
	}
}

async function expectPeerUnchanged() {
	const [peer] = await db
		.select({
			id: organizations.id,
			kodeSatker: organizations.kodeSatker,
			name: organizations.name,
			kppnName: organizations.kppnName,
			isBlu: organizations.isBlu,
			timezone: organizations.timezone,
		})
		.from(organizations)
		.where(eq(organizations.id, peerOrgId))
		.limit(1);
	expect(peer).toEqual({
		id: peerOrgId,
		kodeSatker: peerOrgCode,
		name: peerOrgName,
		kppnName: peerKppnName,
		isBlu: false,
		timezone: "Asia/Jakarta",
	});

	const peerAccesses = await db
		.select({ id: userAccesses.id, active: userAccesses.active })
		.from(userAccesses)
		.where(
			and(
				eq(userAccesses.userId, operatorUserId),
				eq(userAccesses.orgId, peerOrgId),
			),
		);
	expect(peerAccesses).toEqual([]);
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

	const [ownOrg] = await db
		.select({ kodeSatker: organizations.kodeSatker, name: organizations.name })
		.from(organizations)
		.where(eq(organizations.id, orgId))
		.limit(1);
	if (!ownOrg) throw new Error("Seeded operator organization is missing.");
	ownOrgCode = ownOrg.kodeSatker;
	ownOrgName = ownOrg.name;

	const [fy] = await db
		.select({ activeRuleSetId: fiscalYears.activeRuleSetId })
		.from(fiscalYears)
		.where(and(eq(fiscalYears.orgId, orgId), eq(fiscalYears.year, 2026)))
		.limit(1);
	if (!fy) throw new Error("Seeded operator fiscal year is missing.");

	const [scope] = await db
		.insert(kppnScopes)
		.values({ code: peerScopeCode, name: peerKppnName })
		.returning({ id: kppnScopes.id });
	peerScopeId = scope.id;
	const [peerOrg] = await db
		.insert(organizations)
		.values({
			kppnScopeId: peerScopeId,
			kodeSatker: peerOrgCode,
			name: peerOrgName,
			kppnName: peerKppnName,
			isBlu: false,
			timezone: "Asia/Jakarta",
		})
		.returning({ id: organizations.id });
	peerOrgId = peerOrg.id;
	const [peerFy] = await db
		.insert(fiscalYears)
		.values({
			orgId: peerOrgId,
			year: 2026,
			activeRuleSetId: fy.activeRuleSetId,
		})
		.returning({ id: fiscalYears.id });
	peerFiscalYearId = peerFy.id;
});

afterAll(async () => {
	if (peerFiscalYearId) await db.delete(fiscalYears).where(eq(fiscalYears.id, peerFiscalYearId));
	if (peerOrgId) await db.delete(organizations).where(eq(organizations.id, peerOrgId));
	if (peerScopeId) await db.delete(kppnScopes).where(eq(kppnScopes.id, peerScopeId));
});

describe("F13-02 settings authenticated HTTP boundary", () => {
	it("getSatkerSettingsFn reads own settings and rejects peer settings without leakage", async () => {
		const id = await findServerFnId("getSatkerSettingsFn");
		const own = await callServerFn({ id, method: "GET", data: { orgId } });
		expect(own.status).toBe(200);
		expect(own.body.includes(orgId)).toBe(true);
		expect(own.body.includes(ownOrgCode)).toBe(true);
		expect(own.body.includes(ownOrgName)).toBe(true);
		expect(own.body.includes(peerOrgId)).toBe(false);
		expect(own.body.includes(peerOrgCode)).toBe(false);
		expect(own.body.includes(peerOrgName)).toBe(false);

		const peer = await callServerFn({ id, method: "GET", data: { orgId: peerOrgId } });
		expectDenied(peer);
	});

	it("updateSatkerSettingsFn rejects a peer organization mutation and preserves it", async () => {
		const id = await findServerFnId("updateSatkerSettingsFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: { orgId: peerOrgId, name: attemptedPeerName, isBlu: true },
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("registerSatkerOnboardingFn cannot claim an existing peer Satker", async () => {
		const id = await findServerFnId("registerSatkerOnboardingFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: {
				kodeSatker: peerOrgCode,
				name: attemptedPeerName,
				isBlu: true,
			},
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});
});

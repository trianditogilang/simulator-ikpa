import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { toJSONAsync } from "seroval";
import { createDbClient } from "@simulator-ikpa/db";
import {
	fiscalYears,
	kkpUsages,
	kppnScopes,
	organizations,
	upTupTransactions,
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
		"F13-02 UP/TUP/KKP HTTP integration requires the isolated database and short-lived Clerk session.",
	);
}

const db = createDbClient(testDatabaseUrl);
const fixtureTag = randomUUID();
const peerScopeCode = `F13-02-UP-SCOPE-${fixtureTag}`;
const peerOrgCode = `F13-02-UP-ORG-${fixtureTag}`;
const ownUpTupAmount = "123456789.12";
const peerUpTupAmount = "987654321.12";
const ownKkpAmount = "234567890.23";
const peerKkpAmount = "876543210.21";
const deniedPattern = /ditolak|wewenang|unauthorized|forbidden|tidak ditemukan|tidak valid/i;

let operatorUserId = "";
let orgId = "";
let fiscalYearId = "";
let peerScopeId = "";
let peerOrgId = "";
let peerFiscalYearId = "";
let ownUpTupId = "";
let ownKkpId = "";
let peerUpTupId = "";
let peerKkpId = "";

async function findServerFnId(exportName: string): Promise<string> {
	const sourcePath = "/src/server/up-tup-kkp.ts";
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
		peerUpTupId,
		peerKkpId,
		peerUpTupAmount,
		peerKkpAmount,
	]) {
		expect(result.body.includes(value)).toBe(false);
	}
}

async function expectPeerUnchanged() {
	const upTupRows = await db
		.select({
			id: upTupTransactions.id,
			type: upTupTransactions.type,
			amount: upTupTransactions.amount,
			sp2dAt: upTupTransactions.sp2dAt,
			referenceSp2dAt: upTupTransactions.referenceSp2dAt,
			settlementDate: upTupTransactions.settlementDate,
			isSettled: upTupTransactions.isSettled,
			deletedAt: upTupTransactions.deletedAt,
		})
		.from(upTupTransactions)
		.where(eq(upTupTransactions.fiscalYearId, peerFiscalYearId));
	const kkpRows = await db
		.select({
			id: kkpUsages.id,
			month: kkpUsages.month,
			amount: kkpUsages.amount,
			usageDate: kkpUsages.usageDate,
			deletedAt: kkpUsages.deletedAt,
		})
		.from(kkpUsages)
		.where(eq(kkpUsages.fiscalYearId, peerFiscalYearId));

	expect(upTupRows).toHaveLength(1);
	expect(upTupRows[0]).toEqual({
		id: peerUpTupId,
		type: "UP",
		amount: peerUpTupAmount,
		sp2dAt: "2026-12-01",
		referenceSp2dAt: null,
		settlementDate: null,
		isSettled: false,
		deletedAt: null,
	});
	expect(kkpRows).toHaveLength(1);
	expect(kkpRows[0]).toEqual({
		id: peerKkpId,
		month: 12,
		amount: peerKkpAmount,
		usageDate: "2026-12-15",
		deletedAt: null,
	});
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

	const [scope] = await db
		.insert(kppnScopes)
		.values({ code: peerScopeCode, name: "F13-02 UP/TUP HTTP Peer Scope" })
		.returning({ id: kppnScopes.id });
	const [peerOrg] = await db
		.insert(organizations)
		.values({
			kppnScopeId: scope.id,
			kodeSatker: peerOrgCode,
			name: "F13-02 UP/TUP HTTP Peer Organization",
			kppnName: "F13-02 UP/TUP HTTP Peer Scope",
			isBlu: false,
			timezone: "Asia/Jakarta",
		})
		.returning({ id: organizations.id });
	const [peerFy] = await db
		.insert(fiscalYears)
		.values({
			orgId: peerOrg.id,
			year: 2026,
			activeRuleSetId: fy.activeRuleSetId,
		})
		.returning({ id: fiscalYears.id });
	peerScopeId = scope.id;
	peerOrgId = peerOrg.id;
	peerFiscalYearId = peerFy.id;

	const [ownUpTup] = await db
		.insert(upTupTransactions)
		.values({
			fiscalYearId,
			type: "UP",
			amount: ownUpTupAmount,
			sp2dAt: "2026-12-01",
			createdBy: operatorUserId,
		})
		.returning({ id: upTupTransactions.id });
	const [ownKkp] = await db
		.insert(kkpUsages)
		.values({
			fiscalYearId,
			month: 12,
			amount: ownKkpAmount,
			usageDate: "2026-12-15",
			createdBy: operatorUserId,
		})
		.returning({ id: kkpUsages.id });
	const [peerUpTup] = await db
		.insert(upTupTransactions)
		.values({
			fiscalYearId: peerFiscalYearId,
			type: "UP",
			amount: peerUpTupAmount,
			sp2dAt: "2026-12-01",
			createdBy: operatorUserId,
		})
		.returning({ id: upTupTransactions.id });
	const [peerKkp] = await db
		.insert(kkpUsages)
		.values({
			fiscalYearId: peerFiscalYearId,
			month: 12,
			amount: peerKkpAmount,
			usageDate: "2026-12-15",
			createdBy: operatorUserId,
		})
		.returning({ id: kkpUsages.id });
	ownUpTupId = ownUpTup.id;
	ownKkpId = ownKkp.id;
	peerUpTupId = peerUpTup.id;
	peerKkpId = peerKkp.id;
});

afterAll(async () => {
	if (ownUpTupId) await db.delete(upTupTransactions).where(eq(upTupTransactions.id, ownUpTupId));
	if (ownKkpId) await db.delete(kkpUsages).where(eq(kkpUsages.id, ownKkpId));
	if (peerOrgId) await db.delete(organizations).where(eq(organizations.id, peerOrgId));
	if (peerScopeId) await db.delete(kppnScopes).where(eq(kppnScopes.id, peerScopeId));
});

describe("F13-02 UP/TUP and KKP authenticated HTTP boundary", () => {
	it("listUpTupAndKkpFn reads own data and rejects peer data without leakage", async () => {
		const id = await findServerFnId("listUpTupAndKkpFn");
		const own = await callServerFn({ id, method: "GET", data: { orgId } });
		expect(own.status).toBe(200);
		expect(own.body.includes(fiscalYearId)).toBe(true);
		expect(own.body.includes(ownUpTupId)).toBe(true);
		expect(own.body.includes(ownKkpId)).toBe(true);
		expect(own.body.includes(peerUpTupId)).toBe(false);
		expect(own.body.includes(peerKkpId)).toBe(false);

		const peer = await callServerFn({ id, method: "GET", data: { orgId: peerOrgId } });
		expectDenied(peer);
	});

	it("createUpTupFn rejects peer mutation and preserves peer transactions", async () => {
		const id = await findServerFnId("createUpTupFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: {
				orgId: peerOrgId,
				type: "TUP",
				amount: "1.00",
				sp2dAt: "2026-11-01",
				isSettled: false,
			},
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("updateUpTupFn rejects an own-org request carrying a peer transaction ID", async () => {
		const id = await findServerFnId("updateUpTupFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: {
				orgId,
				id: peerUpTupId,
				type: "TUP",
				amount: "2.00",
				sp2dAt: "2026-11-02",
				isSettled: true,
			},
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("deleteUpTupFn rejects an own-org request carrying a peer transaction ID", async () => {
		const id = await findServerFnId("deleteUpTupFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: { orgId, id: peerUpTupId },
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("upsertKkpFn rejects peer mutation and preserves peer usage", async () => {
		const id = await findServerFnId("upsertKkpFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: { orgId: peerOrgId, month: 11, amount: "3.00", usageDate: "2026-11-15" },
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("deleteKkpFn rejects an own-org request carrying a peer usage ID", async () => {
		const id = await findServerFnId("deleteKkpFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: { orgId, id: peerKkpId },
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});
});

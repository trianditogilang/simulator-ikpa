import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { toJSONAsync } from "seroval";
import { createDbClient } from "@simulator-ikpa/db";
import {
	fiscalYears,
	kppnScopes,
	organizations,
	spmQ4,
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
		"F13-02 SPM dispensation HTTP integration requires the isolated database and short-lived Clerk session.",
	);
}

const db = createDbClient(testDatabaseUrl);
const fixtureTag = randomUUID();
const peerScopeCode = `F13-02-SPM-SCOPE-${fixtureTag}`;
const peerOrgCode = `F13-02-SPM-ORG-${fixtureTag}`;
const ownReferenceNumber = `F13-02-SPM-OWN-${fixtureTag}`;
const peerReferenceNumber = `F13-02-SPM-PEER-${fixtureTag}`;
const peerIssuedAt = "2026-11-01";
const deniedPattern = /ditolak|wewenang|unauthorized|forbidden|tidak ditemukan|tidak valid/i;

let operatorUserId = "";
let orgId = "";
let fiscalYearId = "";
let peerScopeId = "";
let peerOrgId = "";
let peerFiscalYearId = "";
let ownSpmId = "";
let peerSpmId = "";

async function findServerFnId(exportName: string): Promise<string> {
	const sourcePath = "/src/server/spm-dispensation.ts";
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
		peerSpmId,
		peerReferenceNumber,
		peerIssuedAt,
	]) {
		expect(result.body.includes(value)).toBe(false);
	}
}

async function expectPeerUnchanged() {
	const rows = await db
		.select({
			id: spmQ4.id,
			referenceNumber: spmQ4.referenceNumber,
			issuedAt: spmQ4.issuedAt,
			isDispensasi: spmQ4.isDispensasi,
			deletedAt: spmQ4.deletedAt,
		})
		.from(spmQ4)
		.where(eq(spmQ4.fiscalYearId, peerFiscalYearId));

	expect(rows).toHaveLength(1);
	expect(rows[0]).toEqual({
		id: peerSpmId,
		referenceNumber: peerReferenceNumber,
		issuedAt: peerIssuedAt,
		isDispensasi: true,
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
		.values({ code: peerScopeCode, name: "F13-02 SPM HTTP Peer Scope" })
		.returning({ id: kppnScopes.id });
	peerScopeId = scope.id;
	const [peerOrg] = await db
		.insert(organizations)
		.values({
			kppnScopeId: peerScopeId,
			kodeSatker: peerOrgCode,
			name: "F13-02 SPM HTTP Peer Organization",
			kppnName: "F13-02 SPM HTTP Peer Scope",
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

	const [ownSpm] = await db
		.insert(spmQ4)
		.values({
			fiscalYearId,
			referenceNumber: ownReferenceNumber,
			issuedAt: "2026-12-01",
			isDispensasi: false,
			createdBy: operatorUserId,
		})
		.returning({ id: spmQ4.id });
	const [peerSpm] = await db
		.insert(spmQ4)
		.values({
			fiscalYearId: peerFiscalYearId,
			referenceNumber: peerReferenceNumber,
			issuedAt: peerIssuedAt,
			isDispensasi: true,
			createdBy: operatorUserId,
		})
		.returning({ id: spmQ4.id });
	ownSpmId = ownSpm.id;
	peerSpmId = peerSpm.id;
});

afterAll(async () => {
	if (ownSpmId) await db.delete(spmQ4).where(eq(spmQ4.id, ownSpmId));
	if (peerOrgId) await db.delete(organizations).where(eq(organizations.id, peerOrgId));
	if (peerScopeId) await db.delete(kppnScopes).where(eq(kppnScopes.id, peerScopeId));
});

describe("F13-02 SPM dispensation authenticated HTTP boundary", () => {
	it("listSpmDispensationsFn reads own data and rejects peer data without leakage", async () => {
		const id = await findServerFnId("listSpmDispensationsFn");
		const own = await callServerFn({ id, method: "GET", data: { orgId } });
		expect(own.status).toBe(200);
		expect(own.body.includes(fiscalYearId)).toBe(true);
		expect(own.body.includes(ownSpmId)).toBe(true);
		expect(own.body.includes(ownReferenceNumber)).toBe(true);
		expect(own.body.includes(peerSpmId)).toBe(false);
		expect(own.body.includes(peerReferenceNumber)).toBe(false);

		const peer = await callServerFn({ id, method: "GET", data: { orgId: peerOrgId } });
		expectDenied(peer);
	});

	it("createSpmDispensasiFn rejects peer mutation and preserves peer SPM", async () => {
		const id = await findServerFnId("createSpmDispensasiFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: {
				orgId: peerOrgId,
				referenceNumber: `F13-02-SPM-CREATE-${fixtureTag}`,
				issuedAt: "2026-10-15",
				isDispensasi: false,
			},
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("updateSpmDispensasiFn rejects an own-org request carrying a peer SPM ID", async () => {
		const id = await findServerFnId("updateSpmDispensasiFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: {
				orgId,
				spmId: peerSpmId,
				referenceNumber: `F13-02-SPM-UPDATE-${fixtureTag}`,
				issuedAt: "2026-11-15",
				isDispensasi: false,
			},
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("deleteSpmDispensasiFn rejects an own-org request carrying a peer SPM ID", async () => {
		const id = await findServerFnId("deleteSpmDispensasiFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: { orgId, spmId: peerSpmId },
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});
});

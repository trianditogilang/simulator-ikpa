import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { toJSONAsync } from "seroval";
import { createDbClient } from "@simulator-ikpa/db";
import {
	fiscalYears,
	kppnScopes,
	organizations,
	realizations,
	rpdLines,
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
		"F13-02 RPD/realization HTTP integration requires the isolated database and short-lived Clerk session.",
	);
}

const db = createDbClient(testDatabaseUrl);
const fixtureTag = randomUUID();
const peerScopeCode = `F13-02-RPD-SCOPE-${fixtureTag}`;
const peerOrgCode = `F13-02-RPD-ORG-${fixtureTag}`;
const ownRpdAmount = "123456789.12";
const ownRealizationAmount = "234567890.23";
const peerRpdAmount = "987654321.12";
const peerRealizationAmount = "876543210.21";
const deniedPattern = /ditolak|wewenang|unauthorized|forbidden/i;

let operatorUserId = "";
let orgId = "";
let fiscalYearId = "";
let peerScopeId = "";
let peerOrgId = "";
let peerFiscalYearId = "";
let ownRpdId = "";
let ownRealizationId = "";
let peerRpdId = "";
let peerRealizationId = "";

async function findServerFnId(exportName: string): Promise<string> {
	const sourcePath = "/src/server/rpd-realization.ts";
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
		peerRpdId,
		peerRealizationId,
		peerRpdAmount,
		peerRealizationAmount,
	]) {
		expect(result.body.includes(value)).toBe(false);
	}
}

async function expectPeerUnchanged() {
	const peerRpd = await db
		.select({ id: rpdLines.id, amount: rpdLines.amount, deletedAt: rpdLines.deletedAt })
		.from(rpdLines)
		.where(eq(rpdLines.fiscalYearId, peerFiscalYearId));
	const peerRealization = await db
		.select({
			id: realizations.id,
			amount: realizations.amount,
			deletedAt: realizations.deletedAt,
		})
		.from(realizations)
		.where(eq(realizations.fiscalYearId, peerFiscalYearId));

	expect(peerRpd).toHaveLength(1);
	expect(peerRpd[0]).toEqual({ id: peerRpdId, amount: peerRpdAmount, deletedAt: null });
	expect(peerRealization).toHaveLength(1);
	expect(peerRealization[0]).toEqual({
		id: peerRealizationId,
		amount: peerRealizationAmount,
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
		.values({ code: peerScopeCode, name: "F13-02 RPD HTTP Peer Scope" })
		.returning({ id: kppnScopes.id });
	const [peerOrg] = await db
		.insert(organizations)
		.values({
			kppnScopeId: scope.id,
			kodeSatker: peerOrgCode,
			name: "F13-02 RPD HTTP Peer Organization",
			kppnName: "F13-02 RPD HTTP Peer Scope",
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

	const [ownRpd] = await db
		.insert(rpdLines)
		.values({
			fiscalYearId,
			month: 12,
			accountCode: "57",
			amount: ownRpdAmount,
			createdBy: operatorUserId,
		})
		.returning({ id: rpdLines.id });
	const [ownRealization] = await db
		.insert(realizations)
		.values({
			fiscalYearId,
			month: 12,
			accountCode: "57",
			amount: ownRealizationAmount,
			createdBy: operatorUserId,
		})
		.returning({ id: realizations.id });
	const [peerRpd] = await db
		.insert(rpdLines)
		.values({
			fiscalYearId: peerFiscalYearId,
			month: 12,
			accountCode: "57",
			amount: peerRpdAmount,
			createdBy: operatorUserId,
		})
		.returning({ id: rpdLines.id });
	const [peerRealization] = await db
		.insert(realizations)
		.values({
			fiscalYearId: peerFiscalYearId,
			month: 12,
			accountCode: "57",
			amount: peerRealizationAmount,
			createdBy: operatorUserId,
		})
		.returning({ id: realizations.id });
	ownRpdId = ownRpd.id;
	ownRealizationId = ownRealization.id;
	peerRpdId = peerRpd.id;
	peerRealizationId = peerRealization.id;
});

afterAll(async () => {
	if (ownRpdId) await db.delete(rpdLines).where(eq(rpdLines.id, ownRpdId));
	if (ownRealizationId) {
		await db.delete(realizations).where(eq(realizations.id, ownRealizationId));
	}
	if (peerOrgId) await db.delete(organizations).where(eq(organizations.id, peerOrgId));
	if (peerScopeId) await db.delete(kppnScopes).where(eq(kppnScopes.id, peerScopeId));
});

describe("F13-02 RPD and realization authenticated HTTP boundary", () => {
	it("listRpdAndRealizationFn reads own data and rejects peer data without leakage", async () => {
		const id = await findServerFnId("listRpdAndRealizationFn");
		const own = await callServerFn({ id, method: "GET", data: { orgId } });
		expect(own.status).toBe(200);
		expect(own.body.includes(fiscalYearId)).toBe(true);
		expect(own.body.includes(ownRpdId)).toBe(true);
		expect(own.body.includes(ownRealizationId)).toBe(true);
		expect(own.body.includes(peerRpdId)).toBe(false);
		expect(own.body.includes(peerRealizationId)).toBe(false);

		const peer = await callServerFn({ id, method: "GET", data: { orgId: peerOrgId } });
		expectDenied(peer);
	});

	it("upsertRpdFn rejects peer mutation and preserves peer rows", async () => {
		const id = await findServerFnId("upsertRpdFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: { orgId: peerOrgId, month: 11, accountCode: "53", amount: "1.00" },
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("upsertRealizationFn rejects peer mutation and preserves peer rows", async () => {
		const id = await findServerFnId("upsertRealizationFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: { orgId: peerOrgId, month: 11, accountCode: "53", amount: "2.00" },
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("batchUpsertRpdRealizationFn rejects peer batch mutation and preserves peer rows", async () => {
		const id = await findServerFnId("batchUpsertRpdRealizationFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: {
				orgId: peerOrgId,
				target: "rpd",
				rows: [
					{ month: 10, accountCode: "51", amount: "3.00" },
					{ month: 11, accountCode: "52", amount: "4.00" },
				],
			},
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});
});

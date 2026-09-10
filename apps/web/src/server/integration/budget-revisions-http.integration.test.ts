import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { toJSONAsync } from "seroval";
import { createDbClient } from "@simulator-ikpa/db";
import {
	budgets,
	dipaRevisions,
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
		"F13-02 budget revisions HTTP integration requires the isolated database and short-lived Clerk session.",
	);
}

const db = createDbClient(testDatabaseUrl);
const fixtureTag = randomUUID().replaceAll("-", "").slice(0, 12);
const peerScopeCode = `F13-02-BR-SCOPE-${fixtureTag}`;
const peerOrgCode = `F13-02-BR-ORG-${fixtureTag}`;
const ownRevisionCode = `F13-02-BR-OWN-${fixtureTag}`;
const peerRevisionCode = `F13-02-BR-PEER-${fixtureTag}`;
const ownRevisionNote = `own-budget-revision-note-${fixtureTag}`;
const peerRevisionNote = `peer-budget-revision-note-${fixtureTag}`;
const peerAmount = "987654321.12";
const peerRevisionBefore = "1500000000.00";
const peerRevisionAfter = "1400000000.00";
const deniedPattern = /ditolak|wewenang|unauthorized|forbidden|tidak ditemukan|tidak valid/i;

let operatorUserId = "";
let orgId = "";
let fiscalYearId = "";
let activeRuleSetId = "";
let peerScopeId = "";
let peerOrgId = "";
let peerFiscalYearId = "";
let ownBudgetId = "";
let peerBudgetId = "";
let ownRevisionId = "";
let peerRevisionId = "";

async function findServerFnId(exportName: string): Promise<string> {
	const sourcePath = "/src/server/budget-revisions.ts";
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
		peerBudgetId,
		peerRevisionId,
		peerRevisionCode,
		peerRevisionNote,
		peerAmount,
		peerRevisionBefore,
		peerRevisionAfter,
	]) {
		expect(result.body.includes(value)).toBe(false);
	}
}

async function expectPeerUnchanged() {
	const peerBudgetRows = await db
		.select({
			id: budgets.id,
			fiscalYearId: budgets.fiscalYearId,
			accountCode: budgets.accountCode,
			amount: budgets.amount,
			effectiveAt: budgets.effectiveAt,
			deletedAt: budgets.deletedAt,
		})
		.from(budgets)
		.where(eq(budgets.fiscalYearId, peerFiscalYearId));
	const peerRevisionRows = await db
		.select({
			id: dipaRevisions.id,
			fiscalYearId: dipaRevisions.fiscalYearId,
			revisionDate: dipaRevisions.revisionDate,
			revisionCode: dipaRevisions.revisionCode,
			paguBefore: dipaRevisions.paguBefore,
			paguAfter: dipaRevisions.paguAfter,
			notes: dipaRevisions.notes,
			deletedAt: dipaRevisions.deletedAt,
		})
		.from(dipaRevisions)
		.where(eq(dipaRevisions.fiscalYearId, peerFiscalYearId));

	expect(peerBudgetRows).toEqual([
		{
			id: peerBudgetId,
			fiscalYearId: peerFiscalYearId,
			accountCode: "52",
			amount: peerAmount,
			effectiveAt: "2026-02-01",
			deletedAt: null,
		},
	]);
	expect(peerRevisionRows).toEqual([
		{
			id: peerRevisionId,
			fiscalYearId: peerFiscalYearId,
			revisionDate: "2026-04-01",
			revisionCode: peerRevisionCode,
			paguBefore: peerRevisionBefore,
			paguAfter: peerRevisionAfter,
			notes: peerRevisionNote,
			deletedAt: null,
		},
	]);
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
	activeRuleSetId = fy.activeRuleSetId;

	const [scope] = await db
		.insert(kppnScopes)
		.values({ code: peerScopeCode, name: "F13-02 Budget Revisions HTTP Peer Scope" })
		.returning({ id: kppnScopes.id });
	peerScopeId = scope.id;
	const [peerOrg] = await db
		.insert(organizations)
		.values({
			kppnScopeId: peerScopeId,
			kodeSatker: peerOrgCode,
			name: "F13-02 Budget Revisions HTTP Peer Organization",
			kppnName: "F13-02 Budget Revisions HTTP Peer Scope",
			isBlu: false,
			timezone: "Asia/Jakarta",
		})
		.returning({ id: organizations.id });
	peerOrgId = peerOrg.id;
	const [peerFy] = await db
		.insert(fiscalYears)
		.values({ orgId: peerOrgId, year: 2026, activeRuleSetId })
		.returning({ id: fiscalYears.id });
	peerFiscalYearId = peerFy.id;

	const [ownBudget] = await db
		.insert(budgets)
		.values({
			fiscalYearId,
			accountCode: "57",
			amount: "123456.78",
			effectiveAt: "2026-01-01",
			createdBy: operatorUserId,
		})
		.returning({ id: budgets.id });
	ownBudgetId = ownBudget.id;
	const [peerBudget] = await db
		.insert(budgets)
		.values({
			fiscalYearId: peerFiscalYearId,
			accountCode: "52",
			amount: peerAmount,
			effectiveAt: "2026-02-01",
			createdBy: operatorUserId,
		})
		.returning({ id: budgets.id });
	peerBudgetId = peerBudget.id;

	const [ownRevision] = await db
		.insert(dipaRevisions)
		.values({
			fiscalYearId,
			revisionDate: "2026-03-01",
			revisionCode: ownRevisionCode,
			paguBefore: "1000000.00",
			paguAfter: "950000.00",
			notes: ownRevisionNote,
			createdBy: operatorUserId,
		})
		.returning({ id: dipaRevisions.id });
	ownRevisionId = ownRevision.id;
	const [peerRevision] = await db
		.insert(dipaRevisions)
		.values({
			fiscalYearId: peerFiscalYearId,
			revisionDate: "2026-04-01",
			revisionCode: peerRevisionCode,
			paguBefore: peerRevisionBefore,
			paguAfter: peerRevisionAfter,
			notes: peerRevisionNote,
			createdBy: operatorUserId,
		})
		.returning({ id: dipaRevisions.id });
	peerRevisionId = peerRevision.id;
});

afterAll(async () => {
	if (ownBudgetId) await db.delete(budgets).where(eq(budgets.id, ownBudgetId));
	if (peerBudgetId) await db.delete(budgets).where(eq(budgets.id, peerBudgetId));
	if (ownRevisionId) await db.delete(dipaRevisions).where(eq(dipaRevisions.id, ownRevisionId));
	if (peerRevisionId) await db.delete(dipaRevisions).where(eq(dipaRevisions.id, peerRevisionId));
	if (peerFiscalYearId) await db.delete(fiscalYears).where(eq(fiscalYears.id, peerFiscalYearId));
	if (peerOrgId) await db.delete(organizations).where(eq(organizations.id, peerOrgId));
	if (peerScopeId) await db.delete(kppnScopes).where(eq(kppnScopes.id, peerScopeId));
});

describe("F13-02 budget revisions authenticated HTTP boundary", () => {
	it("listBudgetsAndRevisionsFn reads own data and rejects peer data without leakage", async () => {
		const id = await findServerFnId("listBudgetsAndRevisionsFn");
		const own = await callServerFn({ id, method: "GET", data: { orgId } });
		expect(own.status).toBe(200);
		expect(own.body.includes(fiscalYearId)).toBe(true);
		expect(own.body.includes(ownBudgetId)).toBe(true);
		expect(own.body.includes(ownRevisionId)).toBe(true);
		expect(own.body.includes(ownRevisionCode)).toBe(true);
		expect(own.body.includes(peerBudgetId)).toBe(false);
		expect(own.body.includes(peerRevisionId)).toBe(false);
		expect(own.body.includes(peerRevisionCode)).toBe(false);

		const peer = await callServerFn({ id, method: "GET", data: { orgId: peerOrgId } });
		expectDenied(peer);
	});

	it("saveInitialBudgetsFn rejects peer mutation and preserves peer budget", async () => {
		const id = await findServerFnId("saveInitialBudgetsFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: {
				orgId: peerOrgId,
				budgets: [{ accountCode: "57", amount: "1.00" }],
				effectiveAt: "2026-05-01",
			},
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("upsertBudgetFn rejects peer mutation and preserves the peer row", async () => {
		const id = await findServerFnId("upsertBudgetFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: {
				orgId: peerOrgId,
				accountCode: "52",
				amount: "1.00",
				effectiveAt: "2026-06-01",
			},
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("createRevisionFn rejects peer mutation and preserves peer records", async () => {
		const id = await findServerFnId("createRevisionFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: {
				orgId: peerOrgId,
				revisionDate: "2026-07-01",
				revisionCode: `F13-02-BR-CREATE-${fixtureTag}`,
				paguBefore: "2000000.00",
				paguAfter: "1900000.00",
				notes: `peer-create-note-${fixtureTag}`,
				accountDetails: [{
					accountCode: "57",
					paguBefore: "500000.00",
					paguAfter: "450000.00",
				}],
			},
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("updateRevisionFn rejects an own-org request carrying a peer revision ID", async () => {
		const id = await findServerFnId("updateRevisionFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: {
				orgId,
				revisionId: peerRevisionId,
				revisionDate: "2026-08-01",
				revisionCode: `F13-02-BR-UPDATE-${fixtureTag}`,
				paguBefore: "3000000.00",
				paguAfter: "2800000.00",
				notes: `peer-update-note-${fixtureTag}`,
				accountDetails: [{
					accountCode: "57",
					paguBefore: "600000.00",
					paguAfter: "550000.00",
				}],
			},
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("deleteRevisionFn rejects an own-org request carrying a peer revision ID", async () => {
		const id = await findServerFnId("deleteRevisionFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: { orgId, revisionId: peerRevisionId },
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("deleteBudgetFn rejects an own-org request carrying a peer budget ID", async () => {
		const id = await findServerFnId("deleteBudgetFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: { orgId, budgetId: peerBudgetId },
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});
});

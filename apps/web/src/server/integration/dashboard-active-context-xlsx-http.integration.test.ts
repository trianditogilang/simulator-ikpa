import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { toJSONAsync } from "seroval";
import { createDbClient } from "@simulator-ikpa/db";
import {
	budgets,
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
		"F13-02 dashboard/active-context/XLSX HTTP integration requires the isolated database and short-lived Clerk session.",
	);
}

const db = createDbClient(testDatabaseUrl);
const fixtureTag = randomUUID().replaceAll("-", "").slice(0, 12);
const peerScopeCode = `F13-02-DASH-SCOPE-${fixtureTag}`;
const peerOrgCode = `F13D${fixtureTag.slice(0, 8)}`;
const peerOrgName = `F13-02 dashboard peer ${fixtureTag}`;
const peerKppnName = `F13-02 dashboard peer KPPN ${fixtureTag}`;
const peerBudgetMarker = `PEER-${fixtureTag}-BUDGET`;
const peerBudgetAmount = "987654.32";
const deniedPattern =
	/ditolak|wewenang|unauthorized|forbidden|tidak ditemukan|tidak valid|di luar/i;

let operatorUserId = "";
let orgId = "";
let fiscalYearId = "";
let activeRuleSetId = "";
let peerScopeId = "";
let peerOrgId = "";
let peerFiscalYearId = "";
let peerBudgetId = "";

async function findServerFnId(
	sourcePath: string,
	exportName: string,
): Promise<string> {
	const response = await fetch(`${baseUrl}${sourcePath}`);
	if (!response.ok) {
		throw new Error(`Cannot load ${sourcePath}: HTTP ${response.status}`);
	}
	const source = await response.text();
	const start = source.indexOf(`export const ${exportName} =`);
	if (start < 0) throw new Error(`Cannot find ${exportName} in ${sourcePath}`);
	const nextExport = source.indexOf("\nexport const ", start + 1);
	const match = source
		.slice(start, nextExport < 0 ? undefined : nextExport)
		.match(/createClientRpc\("([^"]+)"\)/);
	if (!match?.[1]) {
		throw new Error(`Cannot resolve server function metadata for ${exportName}`);
	}
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

async function expectPeerBudgetUnchanged() {
	const [peerBudget] = await db
		.select({
			id: budgets.id,
			fiscalYearId: budgets.fiscalYearId,
			accountCode: budgets.accountCode,
			amount: budgets.amount,
			deletedAt: budgets.deletedAt,
		})
		.from(budgets)
		.where(eq(budgets.id, peerBudgetId))
		.limit(1);
	expect(peerBudget).toEqual({
		id: peerBudgetId,
		fiscalYearId: peerFiscalYearId,
		accountCode: peerBudgetMarker,
		amount: peerBudgetAmount,
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
	activeRuleSetId = fy.activeRuleSetId;

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
		.values({ orgId: peerOrgId, year: 2026, activeRuleSetId })
		.returning({ id: fiscalYears.id });
	peerFiscalYearId = peerFy.id;
	const [peerBudget] = await db
		.insert(budgets)
		.values({
			fiscalYearId: peerFiscalYearId,
			accountCode: peerBudgetMarker,
			amount: peerBudgetAmount,
			effectiveAt: "2026-01-01",
			createdBy: operatorUserId,
		})
		.returning({ id: budgets.id });
	peerBudgetId = peerBudget.id;
});

afterAll(async () => {
	if (peerBudgetId) await db.delete(budgets).where(eq(budgets.id, peerBudgetId));
	if (peerFiscalYearId) {
		await db.delete(fiscalYears).where(eq(fiscalYears.id, peerFiscalYearId));
	}
	if (peerOrgId) await db.delete(organizations).where(eq(organizations.id, peerOrgId));
	if (peerScopeId) await db.delete(kppnScopes).where(eq(kppnScopes.id, peerScopeId));
});

describe("F13-02 dashboard, active context, and Operator XLSX HTTP boundary", () => {
	it("getOperatorDashboardFn reads the own dashboard and rejects the peer without leakage", async () => {
		const id = await findServerFnId(
			"/src/server/dashboard.ts",
			"getOperatorDashboardFn",
		);
		const own = await callServerFn({
			id,
			method: "GET",
			data: { orgId, periodMonth: 8, year: 2026 },
		});
		expect(own.status).toBe(200);
		expect(own.body).toContain("activePeriodMonth");
		expect(own.body).toContain("activeYear");
		expect(own.body).toContain("indicators");
		expect(own.body).not.toContain(peerOrgId);
		expect(own.body).not.toContain(peerFiscalYearId);
		expect(own.body).not.toContain(peerBudgetMarker);

		const peer = await callServerFn({
			id,
			method: "GET",
			data: { orgId: peerOrgId, periodMonth: 8, year: 2026 },
		});
		expectDenied(peer, [
			peerOrgId,
			peerFiscalYearId,
			peerBudgetMarker,
			peerBudgetAmount,
			peerOrgCode,
			peerOrgName,
			peerKppnName,
		]);
		await expectPeerBudgetUnchanged();
	});

	it("getHeaderRuleSetFn reads the own fiscal context and rejects a peer context", async () => {
		const id = await findServerFnId(
			"/src/server/active-context.ts",
			"getHeaderRuleSetFn",
		);
		const own = await callServerFn({
			id,
			method: "GET",
			data: { orgId, year: 2026 },
		});
		expect(own.status).toBe(200);
		expect(own.body).toContain(fiscalYearId);
		expect(own.body).toContain(activeRuleSetId);
		expect(own.body).not.toContain(peerOrgId);
		expect(own.body).not.toContain(peerFiscalYearId);
		expect(own.body).not.toContain(peerBudgetMarker);

		const peer = await callServerFn({
			id,
			method: "GET",
			data: { orgId: peerOrgId, year: 2026 },
		});
		expectDenied(peer, [
			peerOrgId,
			peerFiscalYearId,
			peerBudgetMarker,
			peerBudgetAmount,
			peerOrgCode,
			peerOrgName,
			peerKppnName,
		]);
		await expectPeerBudgetUnchanged();
	});

	it("requestOperatorXlsxFn returns a valid own workbook and rejects peer export", async () => {
		const id = await findServerFnId(
			"/src/server/exports/operator-xlsx.ts",
			"requestOperatorXlsxFn",
		);
		const own = await callServerFn({
			id,
			method: "GET",
			data: { orgId },
		});
		expect(own.status).toBe(200);
		expect(own.body).toContain(orgId);
		expect(own.body).toContain(
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		);
		expect(own.body).toContain("contentBase64");
		expect(own.body).toContain("UEsDB");
		expect(own.body).not.toContain(peerOrgId);
		expect(own.body).not.toContain(peerFiscalYearId);
		expect(own.body).not.toContain(peerBudgetMarker);

		const peer = await callServerFn({
			id,
			method: "GET",
			data: { orgId: peerOrgId },
		});
		expectDenied(peer, [
			peerOrgId,
			peerFiscalYearId,
			peerBudgetMarker,
			peerBudgetAmount,
			peerOrgCode,
			peerOrgName,
			peerKppnName,
		]);
		await expectPeerBudgetUnchanged();
	});
});

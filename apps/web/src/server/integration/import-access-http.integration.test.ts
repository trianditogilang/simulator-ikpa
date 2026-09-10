import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { toJSONAsync } from "seroval";
import { and, eq } from "drizzle-orm";
import { createDbClient } from "@simulator-ikpa/db";
import {
	auditLogs,
	contracts,
	fiscalYears,
	importJobs,
	kppnScopes,
	organizations,
	userAccesses,
	users,
} from "@simulator-ikpa/db/schema";

const baseUrl = process.env.F13_02_HTTP_URL;
const testDatabaseUrl = process.env.DATABASE_URL;
const configuredClerkUserId = process.env.F13_02_CLERK_OPERATOR_USER_ID;
const sessionToken = process.env.F13_02_CLERK_SESSION_TOKEN;
if (!baseUrl || !testDatabaseUrl || !configuredClerkUserId || !sessionToken) {
	throw new Error(
		"F13-02 import/access HTTP integration requires the isolated database and short-lived Clerk session.",
	);
}

const db = createDbClient(testDatabaseUrl);
const fixtureTag = randomUUID();
const peerScopeCode = `F13-02-IA-SCOPE-${fixtureTag}`;
const peerOrgCode = `F13-02-IA-ORG-${fixtureTag}`;
const peerOrgName = `F13-02 Import Access Peer ${fixtureTag}`;
const ownImportFilename = `f13-02-import-own-${fixtureTag}.csv`;
const peerImportFilename = `f13-02-import-peer-${fixtureTag}.csv`;
const peerUploadAttemptFilename = `f13-02-import-peer-attempt-${fixtureTag}.csv`;
const ownImportContractNumber = `F13-02-IA-CONTRACT-OWN-${fixtureTag}`;
const peerImportContractNumber = `F13-02-IA-CONTRACT-PEER-${fixtureTag}`;
const peerImportMarker = `f13-02-peer-import-marker-${fixtureTag}`;
const ownCancelFilename = `f13-02-import-cancel-${fixtureTag}.csv`;
const peerImportValue = "987654321.12";

let operatorUserId = "";
let orgId = "";
let fiscalYearId = "";
let activeRuleSetId = "";
let peerScopeId = "";
let peerOrgId = "";
let peerFiscalYearId = "";
let peerImportJobId = "";
let ownCancelJobId = "";
let ownUploadJobId = "";
let ownContractId = "";

type CallResult = { status: number; body: string; headers: Headers };

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
	authToken?: string;
	cookie?: string;
}): Promise<CallResult> {
	const payload = JSON.stringify(await toJSONAsync({ data: args.data }));
	const headers = new Headers({
		"x-tsr-serverFn": "true",
		accept: "application/json",
	});
	const authToken = args.authToken ?? sessionToken;
	if (authToken) headers.set("authorization", `Bearer ${authToken}`);
	if (args.cookie) headers.set("cookie", args.cookie);
	const init: RequestInit = { method: args.method, headers };
	let url = `${baseUrl}/_serverFn/${encodeURIComponent(args.id)}`;
	if (args.method === "GET") {
		url += `?payload=${encodeURIComponent(payload)}`;
	} else {
		headers.set("content-type", "application/json");
		init.body = payload;
	}
	const response = await fetch(url, init);
	return {
		status: response.status,
		body: await response.text(),
		headers: response.headers,
	};
}

function expectBodyContains(body: string, value: string, expected = true) {
	expect(body.includes(value)).toBe(expected);
}

function peerForbiddenValues() {
	return [
		peerScopeId,
		peerOrgId,
		peerFiscalYearId,
		peerImportJobId,
		peerOrgCode,
		peerOrgName,
		peerImportFilename,
		peerUploadAttemptFilename,
		peerImportContractNumber,
		peerImportMarker,
		peerImportValue,
	];
}

function expectDenied(result: CallResult, forbidden = peerForbiddenValues()) {
	// TanStack serializes ServerFn failures in a 200 RPC envelope.
	expect(result.status).toBe(200);
	expect(result.body).toMatch(
		/ditolak|wewenang|unauthorized|forbidden|not available|tidak ditemukan|bukan milik|pemetaan akses/i,
	);
	for (const value of forbidden) {
		if (value) expectBodyContains(result.body, value, false);
	}
}

function requireFixtureId(value: string, label: string): string {
	if (!value) throw new Error(`${label} fixture was not initialized.`);
	return value;
}

const ownImportCsv = () =>
	[
		"contract_number,account_code,value,signed_at,payment_type",
		`${ownImportContractNumber},51,123.45,2026-08-15,sekaligus`,
	].join("\n");

beforeAll(async () => {
	const [operator] = await db
		.select({ id: users.id, orgId: userAccesses.orgId })
		.from(users)
		.innerJoin(userAccesses, eq(userAccesses.userId, users.id))
		.where(
			and(
				eq(users.clerkUserId, configuredClerkUserId),
				eq(userAccesses.accessType, "operator_satker"),
				eq(userAccesses.active, true),
			),
		)
		.limit(1);
	if (!operator?.orgId) {
		throw new Error("Configured Clerk operator is not mapped to an active organization.");
	}
	operatorUserId = operator.id;
	orgId = operator.orgId;

	const [fy] = await db
		.select({ id: fiscalYears.id, activeRuleSetId: fiscalYears.activeRuleSetId })
		.from(fiscalYears)
		.where(and(eq(fiscalYears.orgId, orgId), eq(fiscalYears.year, 2026)))
		.limit(1);
	if (!fy) throw new Error("Seeded operator fiscal year 2026 is missing.");
	fiscalYearId = fy.id;
	activeRuleSetId = fy.activeRuleSetId;

	const [peerScope] = await db
		.insert(kppnScopes)
		.values({ code: peerScopeCode, name: `F13-02 Import Access Scope ${fixtureTag}` })
		.returning({ id: kppnScopes.id });
	peerScopeId = peerScope.id;
	const [peerOrg] = await db
		.insert(organizations)
		.values({
			kppnScopeId: peerScopeId,
			kodeSatker: peerOrgCode,
			name: peerOrgName,
			kppnName: `F13-02 Import Access Scope ${fixtureTag}`,
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

	const peerRow = {
		contractNumber: peerImportContractNumber,
		accountCode: "51",
		value: peerImportValue,
		signedAt: "2026-08-01",
		paymentType: "sekaligus",
	};
	const [peerJob] = await db
		.insert(importJobs)
		.values({
			orgId: peerOrgId,
			fiscalYearId: peerFiscalYearId,
			domain: "contracts_invoices",
			filename: peerImportFilename,
			status: "validated",
			totalRows: 1,
			validRows: 1,
			invalidRows: 0,
			errorReportJson: {
				marker: peerImportMarker,
				errors: [],
				preview: [peerRow],
				validRows: [peerRow],
			} as never,
			createdBy: operatorUserId,
		})
		.returning({ id: importJobs.id });
	peerImportJobId = peerJob.id;

	const [cancelJob] = await db
		.insert(importJobs)
		.values({
			orgId,
			fiscalYearId,
			domain: "contracts_invoices",
			filename: ownCancelFilename,
			status: "uploaded",
			totalRows: 0,
			validRows: 0,
			invalidRows: 0,
			createdBy: operatorUserId,
		})
		.returning({ id: importJobs.id });
	ownCancelJobId = cancelJob.id;
});

afterAll(async () => {
	if (ownContractId) {
		await db.delete(auditLogs).where(eq(auditLogs.entityId, ownContractId));
		await db.delete(contracts).where(eq(contracts.id, ownContractId));
	}
	for (const jobId of [ownUploadJobId, ownCancelJobId, peerImportJobId]) {
		if (jobId) await db.delete(importJobs).where(eq(importJobs.id, jobId));
	}
	if (peerFiscalYearId) {
		await db.delete(fiscalYears).where(eq(fiscalYears.id, peerFiscalYearId));
	}
	if (peerOrgId) await db.delete(organizations).where(eq(organizations.id, peerOrgId));
	if (peerScopeId) await db.delete(kppnScopes).where(eq(kppnScopes.id, peerScopeId));
});

describe("F13-02 access and import authenticated HTTP boundary", () => {
	it("getAuthSessionFn returns the verified Clerk session without peer data", async () => {
		const id = await findServerFnId("/src/server/access.ts", "getAuthSessionFn");
		const result = await callServerFn({ id, method: "GET", data: undefined });
		expect(result.status).toBe(200);
		// Seroval encodes booleans as tagged values; the final `s:2` is true.
		expect(result.body).toMatch(/isAuthenticated.*?s":2/i);
		expectBodyContains(result.body, configuredClerkUserId);
		expectBodyContains(result.body, peerOrgId, false);
		expectBodyContains(result.body, peerImportMarker, false);
	});

	it("getAccessResolutionFn keeps an explicit peer request outside the operator scope", async () => {
		const id = await findServerFnId("/src/server/access.ts", "getAccessResolutionFn");
		const own = await callServerFn({
			id,
			method: "GET",
			data: { requestedOrgId: orgId },
		});
		expect(own.status).toBe(200);
		expect(own.body).toMatch(/operator_single_scope|operator_multiple_scopes/);
		expectBodyContains(own.body, orgId);
		expectBodyContains(own.body, peerOrgId, false);

		const peer = await callServerFn({
			id,
			method: "GET",
			data: { requestedOrgId: peerOrgId },
		});
		expect(peer.status).toBe(200);
		expect(peer.body).toMatch(/operator_single_scope|operator_multiple_scopes/);
		// A requested peer is never promoted to active access or returned as an organization.
		expectBodyContains(peer.body, orgId);
		for (const value of [peerOrgId, peerFiscalYearId, peerImportMarker]) {
			expectBodyContains(peer.body, value, false);
		}
	});

	it("setActiveOrganizationFn sets only an authorized organization cookie", async () => {
		const id = await findServerFnId("/src/server/access.ts", "setActiveOrganizationFn");
		const own = await callServerFn({
			id,
			method: "POST",
			data: { organizationId: orgId },
		});
		expect(own.status).toBe(200);
		expectBodyContains(own.body, orgId);
		const ownCookie = own.headers.get("set-cookie") ?? "";
		expect(ownCookie).toContain(`ikpa_active_org=${orgId}`);
		expect(ownCookie).toMatch(/httponly/i);

		const peer = await callServerFn({
			id,
			method: "POST",
			data: { organizationId: peerOrgId },
		});
		expectDenied(peer, [peerOrgId, peerFiscalYearId, peerImportMarker]);
		expect((peer.headers.get("set-cookie") ?? "").includes(peerOrgId)).toBe(false);
	});

	it("clearActiveOrganizationFn clears the active organization cookie", async () => {
		const id = await findServerFnId("/src/server/access.ts", "clearActiveOrganizationFn");
		const result = await callServerFn({ id, method: "POST", data: undefined });
		expect(result.status).toBe(200);
		expect(result.body).toMatch(/cleared/);
		const clearedCookie = result.headers.get("set-cookie") ?? "";
		expect(clearedCookie).toMatch(/ikpa_active_org=/i);
		expect(clearedCookie).toMatch(/max-age=0|expires=/i);
		expectBodyContains(clearedCookie, peerOrgId, false);
	});

	it("uploadImportFn accepts a valid own CSV and rejects peer upload without creating a job", async () => {
		const id = await findServerFnId("/src/server/import.ts", "uploadImportFn");
		const own = await callServerFn({
			id,
			method: "POST",
			data: {
				orgId,
				domain: "contracts_invoices",
				filename: ownImportFilename,
				contentBase64: Buffer.from(ownImportCsv(), "utf8").toString("base64"),
				mimeType: "text/csv",
			},
		});
		expect(own.status).toBe(200);
		expectBodyContains(own.body, ownImportFilename);
		expectBodyContains(own.body, "contracts_invoices");
		expectBodyContains(own.body, "validated");
		expectBodyContains(own.body, ownImportContractNumber);
		expectBodyContains(own.body, peerImportMarker, false);

		const [ownJob] = await db
			.select({ id: importJobs.id, orgId: importJobs.orgId, fiscalYearId: importJobs.fiscalYearId })
			.from(importJobs)
			.where(and(eq(importJobs.orgId, orgId), eq(importJobs.filename, ownImportFilename)))
			.limit(1);
		expect(ownJob?.orgId).toBe(orgId);
		expect(ownJob?.fiscalYearId).toBe(fiscalYearId);
		ownUploadJobId = ownJob?.id ?? "";
		expect(ownUploadJobId).not.toBe("");

		const peer = await callServerFn({
			id,
			method: "POST",
			data: {
				orgId: peerOrgId,
				domain: "contracts_invoices",
				filename: peerUploadAttemptFilename,
				contentBase64: Buffer.from(
					[
						"contract_number,account_code,value,signed_at,payment_type",
						`${peerImportContractNumber},51,${peerImportValue},2026-08-15,sekaligus`,
					].join("\n"),
					"utf8",
				).toString("base64"),
				mimeType: "text/csv",
			},
		});
		expectDenied(peer);
		const peerJobs = await db
			.select({ id: importJobs.id })
			.from(importJobs)
			.where(and(eq(importJobs.orgId, peerOrgId), eq(importJobs.filename, peerUploadAttemptFilename)));
		expect(peerJobs).toEqual([]);
	});

	it("listImportJobsFn lists own jobs and rejects the peer organization", async () => {
		const uploadJobId = requireFixtureId(ownUploadJobId, "own upload job");
		const id = await findServerFnId("/src/server/import.ts", "listImportJobsFn");
		const own = await callServerFn({ id, method: "GET", data: { orgId } });
		expect(own.status).toBe(200);
		expectBodyContains(own.body, uploadJobId);
		expectBodyContains(own.body, ownImportFilename);
		expectBodyContains(own.body, ownImportContractNumber);
		expectBodyContains(own.body, peerImportJobId, false);
		expectBodyContains(own.body, peerImportFilename, false);
		expectBodyContains(own.body, peerImportMarker, false);

		const peer = await callServerFn({ id, method: "GET", data: { orgId: peerOrgId } });
		expectDenied(peer);
	});

	it("getImportJobFn returns an own job but not a peer job carried by an own request", async () => {
		const uploadJobId = requireFixtureId(ownUploadJobId, "own upload job");
		const id = await findServerFnId("/src/server/import.ts", "getImportJobFn");
		const own = await callServerFn({
			id,
			method: "GET",
			data: { orgId, jobId: uploadJobId },
		});
		expect(own.status).toBe(200);
		expectBodyContains(own.body, uploadJobId);
		expectBodyContains(own.body, ownImportFilename);
		expectBodyContains(own.body, ownImportContractNumber);
		expectBodyContains(own.body, peerImportMarker, false);

		const peerJob = requireFixtureId(peerImportJobId, "peer import job");
		const crossTenant = await callServerFn({
			id,
			method: "GET",
			data: { orgId, jobId: peerJob },
		});
		expectDenied(crossTenant);
		const peerTarget = await callServerFn({
			id,
			method: "GET",
			data: { orgId: peerOrgId, jobId: peerJob },
		});
		expectDenied(peerTarget);
	});

	it("commitImportFn commits only the own validated contract and leaves peer data unchanged", async () => {
		const uploadJobId = requireFixtureId(ownUploadJobId, "own upload job");
		const id = await findServerFnId("/src/server/import.ts", "commitImportFn");
		const own = await callServerFn({
			id,
			method: "POST",
			data: { orgId, jobId: uploadJobId },
		});
		expect(own.status).toBe(200);
		expect(own.body).toMatch(/success|committed|totalValid/i);
		expectBodyContains(own.body, "1");

		const [completedJob] = await db
			.select({ status: importJobs.status })
			.from(importJobs)
			.where(eq(importJobs.id, uploadJobId))
			.limit(1);
		expect(completedJob?.status).toBe("completed");
		const [ownContract] = await db
			.select({ id: contracts.id, fiscalYearId: contracts.fiscalYearId, contractNumber: contracts.contractNumber })
			.from(contracts)
			.where(and(eq(contracts.fiscalYearId, fiscalYearId), eq(contracts.contractNumber, ownImportContractNumber)))
			.limit(1);
		expect(ownContract?.fiscalYearId).toBe(fiscalYearId);
		ownContractId = ownContract?.id ?? "";
		expect(ownContractId).not.toBe("");

		const peerJob = requireFixtureId(peerImportJobId, "peer import job");
		const denied = await callServerFn({
			id,
			method: "POST",
			data: { orgId, jobId: peerJob },
		});
		expectDenied(denied);
		const [peerAfter] = await db
			.select({ status: importJobs.status })
			.from(importJobs)
			.where(eq(importJobs.id, peerJob))
			.limit(1);
		expect(peerAfter?.status).toBe("validated");
		const peerContracts = await db
			.select({ id: contracts.id })
			.from(contracts)
			.where(and(eq(contracts.fiscalYearId, peerFiscalYearId), eq(contracts.contractNumber, peerImportContractNumber)));
		expect(peerContracts).toEqual([]);
	});

	it("cancelImportFn cancels an own job and cannot cancel the peer job", async () => {
		const cancelJobId = requireFixtureId(ownCancelJobId, "own cancel job");
		const id = await findServerFnId("/src/server/import.ts", "cancelImportFn");
		const own = await callServerFn({
			id,
			method: "POST",
			data: { orgId, jobId: cancelJobId },
		});
		expect(own.status).toBe(200);
		expect(own.body).toMatch(/success/);
		const [cancelled] = await db
			.select({ status: importJobs.status })
			.from(importJobs)
			.where(eq(importJobs.id, cancelJobId))
			.limit(1);
		expect(cancelled?.status).toBe("failed");

		const peerJob = requireFixtureId(peerImportJobId, "peer import job");
		const denied = await callServerFn({
			id,
			method: "POST",
			data: { orgId, jobId: peerJob },
		});
		expectDenied(denied);
		const [peerAfter] = await db
			.select({ status: importJobs.status })
			.from(importJobs)
			.where(eq(importJobs.id, peerJob))
			.limit(1);
		expect(peerAfter?.status).toBe("validated");
	});
});

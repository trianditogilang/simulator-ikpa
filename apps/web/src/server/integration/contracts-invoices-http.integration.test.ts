import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { toJSONAsync } from "seroval";
import { createDbClient } from "@simulator-ikpa/db";
import {
	contracts,
	fiscalYears,
	kppnScopes,
	organizations,
	spmLs,
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
		"F13-02 contracts/invoices HTTP integration requires the isolated database and short-lived Clerk session.",
	);
}

const db = createDbClient(testDatabaseUrl);
const fixtureTag = randomUUID();
const peerScopeCode = `F13-02-CI-SCOPE-${fixtureTag}`;
const peerOrgCode = `F13-02-CI-ORG-${fixtureTag}`;
const ownContractNumber = `F13-02-CI-CONTRACT-OWN-${fixtureTag}`;
const peerContractNumber = `F13-02-CI-CONTRACT-PEER-${fixtureTag}`;
const peerContractValue = "987654321.12";
const ownSpmReference = `F13-02-CI-SPM-OWN-${fixtureTag}`;
const peerSpmReference = `F13-02-CI-SPM-PEER-${fixtureTag}`;
const peerSpmBastBappDate = "2026-04-01";
const peerSpmReceivedAtKppn = "2026-04-27";
const deniedPattern = /ditolak|wewenang|unauthorized|forbidden|tidak ditemukan|tidak valid/i;

let operatorUserId = "";
let orgId = "";
let fiscalYearId = "";
let peerScopeId = "";
let peerOrgId = "";
let peerFiscalYearId = "";
let ownContractId = "";
let peerContractId = "";
let ownSpmId = "";
let peerSpmId = "";

async function findServerFnId(exportName: string): Promise<string> {
	const sourcePath = "/src/server/contracts-invoices.ts";
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
		peerContractId,
		peerSpmId,
		peerContractNumber,
		peerContractValue,
		peerSpmReference,
		peerSpmBastBappDate,
		peerSpmReceivedAtKppn,
	]) {
		expect(result.body.includes(value)).toBe(false);
	}
}

async function expectPeerUnchanged() {
	const peerContracts = await db
		.select({
			id: contracts.id,
			contractNumber: contracts.contractNumber,
			accountCode: contracts.accountCode,
			value: contracts.value,
			signedAt: contracts.signedAt,
			paymentType: contracts.paymentType,
			sp2dAt: contracts.sp2dAt,
			deletedAt: contracts.deletedAt,
		})
		.from(contracts)
		.where(eq(contracts.fiscalYearId, peerFiscalYearId));
	const peerSpm = await db
		.select({
			id: spmLs.id,
			contractId: spmLs.contractId,
			referenceNumber: spmLs.referenceNumber,
			bastBappDate: spmLs.bastBappDate,
			receivedAtKppn: spmLs.receivedAtKppn,
			isPegawai: spmLs.isPegawai,
			deletedAt: spmLs.deletedAt,
		})
		.from(spmLs)
		.where(eq(spmLs.fiscalYearId, peerFiscalYearId));

	expect(peerContracts).toHaveLength(1);
	expect(peerContracts[0]).toEqual({
		id: peerContractId,
		contractNumber: peerContractNumber,
		accountCode: "51",
		value: peerContractValue,
		signedAt: "2026-01-20",
		paymentType: "sekaligus",
		sp2dAt: null,
		deletedAt: null,
	});
	expect(peerSpm).toHaveLength(1);
	expect(peerSpm[0]).toEqual({
		id: peerSpmId,
		contractId: peerContractId,
		referenceNumber: peerSpmReference,
		bastBappDate: peerSpmBastBappDate,
		receivedAtKppn: peerSpmReceivedAtKppn,
		isPegawai: true,
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
		.values({ code: peerScopeCode, name: "F13-02 Contracts HTTP Peer Scope" })
		.returning({ id: kppnScopes.id });
	peerScopeId = scope.id;
	const [peerOrg] = await db
		.insert(organizations)
		.values({
			kppnScopeId: peerScopeId,
			kodeSatker: peerOrgCode,
			name: "F13-02 Contracts HTTP Peer Organization",
			kppnName: "F13-02 Contracts HTTP Peer Scope",
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

	const [ownContract] = await db
		.insert(contracts)
		.values({
			fiscalYearId,
			contractNumber: ownContractNumber,
			accountCode: "53",
			value: "123456789.12",
			signedAt: "2026-01-15",
			paymentType: "termin",
			sp2dAt: "2026-02-01",
			createdBy: operatorUserId,
		})
		.returning({ id: contracts.id });
	const [peerContract] = await db
		.insert(contracts)
		.values({
			fiscalYearId: peerFiscalYearId,
			contractNumber: peerContractNumber,
			accountCode: "51",
			value: peerContractValue,
			signedAt: "2026-01-20",
			paymentType: "sekaligus",
			sp2dAt: null,
			createdBy: operatorUserId,
		})
		.returning({ id: contracts.id });
	ownContractId = ownContract.id;
	peerContractId = peerContract.id;

	const [ownSpm] = await db
		.insert(spmLs)
		.values({
			fiscalYearId,
			contractId: ownContractId,
			referenceNumber: ownSpmReference,
			bastBappDate: "2026-03-01",
			receivedAtKppn: "2026-03-25",
			isPegawai: false,
			createdBy: operatorUserId,
		})
		.returning({ id: spmLs.id });
	const [peerSpm] = await db
		.insert(spmLs)
		.values({
			fiscalYearId: peerFiscalYearId,
			contractId: peerContractId,
			referenceNumber: peerSpmReference,
			bastBappDate: peerSpmBastBappDate,
			receivedAtKppn: peerSpmReceivedAtKppn,
			isPegawai: true,
			createdBy: operatorUserId,
		})
		.returning({ id: spmLs.id });
	ownSpmId = ownSpm.id;
	peerSpmId = peerSpm.id;
});

afterAll(async () => {
	if (ownSpmId) await db.delete(spmLs).where(eq(spmLs.id, ownSpmId));
	if (ownContractId) await db.delete(contracts).where(eq(contracts.id, ownContractId));
	if (peerOrgId) await db.delete(organizations).where(eq(organizations.id, peerOrgId));
	if (peerScopeId) await db.delete(kppnScopes).where(eq(kppnScopes.id, peerScopeId));
});

describe("F13-02 contracts and invoices authenticated HTTP boundary", () => {
	it("listContractsAndSpmFn reads own data and rejects peer data without leakage", async () => {
		const id = await findServerFnId("listContractsAndSpmFn");
		const own = await callServerFn({ id, method: "GET", data: { orgId } });
		expect(own.status).toBe(200);
		expect(own.body.includes(fiscalYearId)).toBe(true);
		expect(own.body.includes(ownContractId)).toBe(true);
		expect(own.body.includes(ownSpmId)).toBe(true);
		expect(own.body.includes(ownContractNumber)).toBe(true);
		expect(own.body.includes(ownSpmReference)).toBe(true);
		expect(own.body.includes(peerContractId)).toBe(false);
		expect(own.body.includes(peerSpmId)).toBe(false);
		expect(own.body.includes(peerContractNumber)).toBe(false);
		expect(own.body.includes(peerSpmReference)).toBe(false);

		const peer = await callServerFn({ id, method: "GET", data: { orgId: peerOrgId } });
		expectDenied(peer);
	});

	it("createContractFn rejects peer mutation and preserves peer records", async () => {
		const id = await findServerFnId("createContractFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: {
				orgId: peerOrgId,
				contractNumber: `F13-02-CI-CONTRACT-CREATE-${fixtureTag}`,
				accountCode: "52",
				value: "1.00",
				signedAt: "2026-06-01",
				paymentType: "sekaligus",
				sp2dAt: "2026-06-02",
			},
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("updateContractFn rejects an own-org request carrying a peer contract ID", async () => {
		const id = await findServerFnId("updateContractFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: {
				orgId,
				contractId: peerContractId,
				contractNumber: `F13-02-CI-CONTRACT-UPDATE-${fixtureTag}`,
				accountCode: "57",
				value: "2.00",
				signedAt: "2026-07-01",
				paymentType: "termin",
				sp2dAt: "2026-07-02",
			},
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("deleteContractFn rejects an own-org request carrying a peer contract ID", async () => {
		const id = await findServerFnId("deleteContractFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: { orgId, contractId: peerContractId },
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("createSpmLsFn rejects peer mutation and preserves peer records", async () => {
		const id = await findServerFnId("createSpmLsFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: {
				orgId: peerOrgId,
				contractId: peerContractId,
				referenceNumber: `F13-02-CI-SPM-CREATE-${fixtureTag}`,
				bastBappDate: "2026-05-01",
				receivedAtKppn: "2026-05-27",
				isPegawai: false,
			},
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("updateSpmLsFn rejects an own-org request carrying a peer SPM ID", async () => {
		const id = await findServerFnId("updateSpmLsFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: {
				orgId,
				spmId: peerSpmId,
				contractId: peerContractId,
				referenceNumber: `F13-02-CI-SPM-UPDATE-${fixtureTag}`,
				bastBappDate: "2026-06-01",
				receivedAtKppn: "2026-06-27",
				isPegawai: false,
			},
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("deleteSpmLsFn rejects an own-org request carrying a peer SPM ID", async () => {
		const id = await findServerFnId("deleteSpmLsFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: { orgId, spmId: peerSpmId },
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});
});

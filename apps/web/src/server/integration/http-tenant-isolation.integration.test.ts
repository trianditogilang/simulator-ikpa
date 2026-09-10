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
		"F13-02 HTTP integration requires HTTP URL, database URL, Clerk operator ID, and a short-lived Clerk session token.",
	);
}

const db = createDbClient(testDatabaseUrl);
const PEER_SCOPE_CODE = "F13-02-HTTP-PEER-SCOPE";
const PEER_ORG_CODE = "F13-02-HTTP-PEER";

let orgId = "";
let fiscalYearId = "";
let peerScopeId = "";
let peerOrgId = "";

async function findServerFnId(sourcePath: string, exportName: string): Promise<string> {
	const response = await fetch(`${baseUrl}${sourcePath}`);
	if (!response.ok) throw new Error(`Cannot load ${sourcePath}: HTTP ${response.status}`);
	const source = await response.text();
	const start = source.indexOf(`export const ${exportName} =`);
	if (start < 0) throw new Error(`Cannot find ${exportName} in ${sourcePath}`);
	const match = source.slice(start, start + 800).match(/createClientRpc\("([^"]+)"\)/);
	if (!match?.[1]) throw new Error(`Cannot resolve server function metadata for ${exportName}`);
	return match[1];
}

async function callServerFn(args: {
	id: string;
	method: "GET" | "POST";
	data: unknown;
	authToken?: string;
}): Promise<{ status: number; body: string }> {
	const payload = JSON.stringify(await toJSONAsync({ data: args.data }));
	const headers = new Headers({
		"x-tsr-serverFn": "true",
		accept: "application/json",
	});
	if (args.authToken) headers.set("authorization", `Bearer ${args.authToken}`);
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

beforeAll(async () => {
	const [operator] = await db
		.select({ id: users.id, clerkUserId: users.clerkUserId })
		.from(users)
		.innerJoin(userAccesses, eq(userAccesses.userId, users.id))
		.where(
			and(
				eq(userAccesses.accessType, "operator_satker"),
				eq(users.clerkUserId, configuredClerkUserId),
			),
		)
		.limit(1);
	if (!operator) {
		throw new Error(
			"Configured Clerk operator is not mapped to an operator access row in the test database.",
		);
	}
	const [access] = await db
		.select({ orgId: userAccesses.orgId })
		.from(userAccesses)
		.where(and(eq(userAccesses.userId, operator.id), eq(userAccesses.accessType, "operator_satker")))
		.limit(1);
	orgId = access?.orgId ?? "";
	if (!orgId) throw new Error("Seeded operator organization is missing.");

	const [fy] = await db
		.select({ id: fiscalYears.id })
		.from(fiscalYears)
		.where(and(eq(fiscalYears.orgId, orgId), eq(fiscalYears.year, 2026)))
		.limit(1);
	fiscalYearId = fy?.id ?? "";
	if (!fiscalYearId) throw new Error("Seeded fiscal year is missing.");

	await db.delete(organizations).where(eq(organizations.kodeSatker, PEER_ORG_CODE));
	await db.delete(kppnScopes).where(eq(kppnScopes.code, PEER_SCOPE_CODE));
	const [scope] = await db
		.insert(kppnScopes)
		.values({ code: PEER_SCOPE_CODE, name: "F13-02 HTTP Peer Scope" })
		.returning({ id: kppnScopes.id });
	const [organization] = await db
		.insert(organizations)
		.values({
			kppnScopeId: scope.id,
			kodeSatker: PEER_ORG_CODE,
			name: "F13-02 HTTP Peer Organization",
			kppnName: "F13-02 HTTP Peer Scope",
			isBlu: false,
			timezone: "Asia/Jakarta",
		})
		.returning({ id: organizations.id });
	peerScopeId = scope.id;
	peerOrgId = organization.id;
});

afterAll(async () => {
	if (peerOrgId) await db.delete(organizations).where(eq(organizations.id, peerOrgId));
	if (peerScopeId) await db.delete(kppnScopes).where(eq(kppnScopes.id, peerScopeId));
});

describe("F13-02 authenticated HTTP tenant boundary", () => {
	it("serves an authenticated operator route through the real test database", async () => {
		const response = await fetch(`${baseUrl}/operator/dashboard`, {
			headers: { authorization: `Bearer ${sessionToken}` },
		});
		expect(response.status).toBe(200);
		expect(await response.text()).not.toContain("Error connecting to database");
	});

	it("rejects cross-tenant ServerFn query and mutation without leaking the peer ID", async () => {
		const listId = await findServerFnId("/src/server/budget-revisions.ts", "listBudgetsAndRevisionsFn");
		const listAuthorized = await callServerFn({
			id: listId,
			method: "GET",
			data: { orgId },
			authToken: sessionToken,
		});
		expect(listAuthorized.status).toBe(200);
		expect(listAuthorized.body).toContain(fiscalYearId);

		const listPeer = await callServerFn({
			id: listId,
			method: "GET",
			data: { orgId: peerOrgId },
			authToken: sessionToken,
		});
		// TanStack serializes application errors in a 200 RPC envelope; the
		// client turns this envelope into a thrown error. Assert the envelope is
		// an authorization failure and contains no peer payload.
		expect(listPeer.status).toBe(200);
		expect(listPeer.body).not.toContain("fiscalYearId");
		expect(listPeer.body).not.toContain(peerOrgId);
		expect(listPeer.body).toMatch(/ditolak|wewenang|unauthorized|forbidden/i);

		const writeId = await findServerFnId("/src/server/budget-revisions.ts", "upsertBudgetFn");
		const writePeer = await callServerFn({
			id: writeId,
			method: "POST",
			data: { orgId: peerOrgId, accountCode: "51", amount: "1.00", effectiveAt: "2026-01-01" },
			authToken: sessionToken,
		});
		expect(writePeer.status).toBe(200);
		expect(writePeer.body).not.toContain(peerOrgId);
		expect(writePeer.body).toMatch(/ditolak|wewenang|unauthorized|forbidden/i);
	});
});

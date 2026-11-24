import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { fromCrossJSON, toJSONAsync } from "seroval";
import { createDbClient } from "@simulator-ikpa/db";
import {
	accessRequests,
	auditLogs,
	authAccounts,
	organizations,
	userAccesses,
	users,
} from "@simulator-ikpa/db/schema";
import { and, eq, inArray } from "drizzle-orm";

// Owner decision 2026-11-23 (MIG-03): self-service sign-up files an access
// request that only an Admin KPPN can approve; invitations create the account
// and the invitee sets a password through "Lupa kata sandi".
const baseUrl = process.env.F13_02_HTTP_URL;
const testDatabaseUrl = process.env.DATABASE_URL;
const operatorSession = process.env.F13_02_SESSION_COOKIE;
const adminSession = process.env.F13_02_ADMIN_SESSION_COOKIE;
const requesterSession = process.env.F13_02_REQUESTER_SESSION_COOKIE;
const requesterUserId = process.env.F13_02_REQUESTER_USER_ID;
const operatorUserId = process.env.F13_02_OPERATOR_USER_ID;
if (
	!baseUrl ||
	!testDatabaseUrl ||
	!operatorSession ||
	!adminSession ||
	!requesterSession ||
	!requesterUserId ||
	!operatorUserId
) {
	throw new Error(
		"Access request HTTP integration requires the isolated database and the Operator, Admin, and requester sessions.",
	);
}

const db = createDbClient(testDatabaseUrl);
const tag = randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
// Owner decision 2026-11-24: kode satker is exactly 6 digits.
const randomKode = () => String(900000 + Math.floor(Math.random() * 90000));
const newKode = randomKode();
const nameMatchKode = randomKode();
const newName = `Satker Permintaan F13 ${tag}`;
const inviteKode = randomKode();
const inviteEmail = `f13-invite-${tag.toLowerCase()}@example.test`;
const bareEmail = `f13-bare-${tag.toLowerCase()}@example.test`;
const duplicateEmail = `f13-dup-${tag.toLowerCase()}@example.test`;
const orphanEmail = `f13-orphan-${tag.toLowerCase()}@example.test`;
const historyEmail = `f13-history-${tag.toLowerCase()}@example.test`;
const pendingEmail = `f13-pending-${tag.toLowerCase()}@example.test`;
let releasedUserId: string | undefined;
const deniedPattern = /ditolak|wewenang|unauthorized|forbidden|sudah memiliki akses|hanya admin kppn/i;

async function findServerFnId(sourcePath: string, exportName: string) {
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

async function call(
	sourcePath: string,
	exportName: string,
	method: "GET" | "POST",
	data: unknown,
	cookie: string,
) {
	const id = await findServerFnId(sourcePath, exportName);
	const payload = JSON.stringify(await toJSONAsync({ data }));
	const headers = new Headers({
		"x-tsr-serverFn": "true",
		accept: "application/json",
		cookie,
	});
	const init: RequestInit = { method, headers };
	let url = `${baseUrl}/_serverFn/${encodeURIComponent(id)}`;
	if (method === "GET") {
		url += `?payload=${encodeURIComponent(payload)}`;
	} else {
		headers.set("content-type", "application/json");
		init.body = payload;
	}
	const response = await fetch(url, init);
	return { status: response.status, body: await response.text() };
}

const settings = "/src/server/settings.ts";
const adminAccess = "/src/server/admin-access.ts";

async function myRequest() {
	const [row] = await db
		.select()
		.from(accessRequests)
		.where(eq(accessRequests.userId, requesterUserId as string))
		.limit(1);
	return row;
}

async function requesterAccesses() {
	return db
		.select({ id: userAccesses.id, orgId: userAccesses.orgId })
		.from(userAccesses)
		.where(eq(userAccesses.userId, requesterUserId as string));
}

async function signIn(email: string) {
	const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
		method: "POST",
		headers: { "content-type": "application/json", origin: baseUrl as string },
		body: JSON.stringify({ email, password: "salahsemua123" }),
	});
	return { status: response.status, body: (await response.json()) as { code?: string } };
}

afterAll(async () => {
	await db.delete(userAccesses).where(eq(userAccesses.userId, requesterUserId as string));
	await db.delete(accessRequests).where(eq(accessRequests.userId, requesterUserId as string));
	await db
		.delete(users)
		.where(inArray(users.email, [inviteEmail, bareEmail, duplicateEmail, orphanEmail, historyEmail, pendingEmail]));
	if (releasedUserId) await db.delete(users).where(eq(users.id, releasedUserId));
	await db.delete(organizations).where(inArray(organizations.kodeSatker, [newKode, inviteKode]));
});

describe("Access request and invitation HTTP flow", () => {
	it("a mapped Operator cannot file a request", async () => {
		const result = await call(
			settings,
			"requestSatkerAccessFn",
			"POST",
			{ kodeSatker: newKode, name: newName },
			operatorSession,
		);
		expect(result.status).toBe(200);
		expect(deniedPattern.test(result.body)).toBe(true);
		const [row] = await db
			.select({ id: accessRequests.id })
			.from(accessRequests)
			.where(eq(accessRequests.userId, operatorUserId as string));
		expect(row).toBeUndefined();
	});

	it("the access-pending form refuses a bad code and a satker that already has an Operator", async () => {
		const [ownOrg] = await db
			.select({ id: organizations.id, kode: organizations.kodeSatker, name: organizations.name })
			.from(userAccesses)
			.innerJoin(organizations, eq(userAccesses.orgId, organizations.id))
			.where(eq(userAccesses.userId, operatorUserId as string))
			.limit(1);
		expect(ownOrg).toBeDefined();
		const badKode = await call(
			settings,
			"requestSatkerAccessFn",
			"POST",
			{ kodeSatker: "12345", name: newName },
			requesterSession,
		);
		expect(badKode.body).toContain("6 digit");
		for (const satker of [
			{ kodeSatker: ownOrg.kode, name: `Nama lain ${tag}` },
			{ kodeSatker: nameMatchKode, name: ` ${ownOrg.name.toUpperCase()} ` },
		]) {
			const result = await call(settings, "requestSatkerAccessFn", "POST", satker, requesterSession);
			expect(result.body).toContain(`Satker ${ownOrg.kode}`);
			expect(result.body).toContain("hubungi Admin KPPN Malang");
		}
		expect(await myRequest()).toBeUndefined();
		expect(await requesterAccesses()).toEqual([]);
		const [after] = await db
			.select({ name: organizations.name })
			.from(organizations)
			.where(eq(organizations.id, ownOrg.id));
		expect(after.name).toBe(ownOrg.name);
	});

	it("refiling replaces the request; the requester reads only their own", async () => {
		await call(settings, "requestSatkerAccessFn", "POST", { kodeSatker: newKode, name: newName }, requesterSession);
		const request = await myRequest();
		expect(request).toMatchObject({ kodeSatker: newKode, satkerName: newName, status: "pending" });
		const [org] = await db
			.select({ id: organizations.id })
			.from(organizations)
			.where(eq(organizations.kodeSatker, newKode));
		expect(org).toBeUndefined();

		const mine = await call(settings, "getMyAccessRequestFn", "GET", undefined, requesterSession);
		expect(mine.body.includes(newKode)).toBe(true);
	});

	it("only an Admin lists and decides requests", async () => {
		const request = await myRequest();
		const asOperator = await call(adminAccess, "listAccessRequestsFn", "GET", undefined, operatorSession);
		expect(asOperator.body.includes(newKode)).toBe(false);
		const approveAsOperator = await call(
			adminAccess,
			"approveAccessRequestFn",
			"POST",
			{ requestId: request.id },
			operatorSession,
		);
		expect(deniedPattern.test(approveAsOperator.body)).toBe(true);
		expect(await requesterAccesses()).toEqual([]);

		// A second person asking for the same code is flagged, not blocked.
		const [other] = await db
			.insert(users)
			.values({ email: duplicateEmail, name: "Peminta kedua", emailVerified: true })
			.returning({ id: users.id });
		await db.insert(accessRequests).values({ userId: other.id, kodeSatker: newKode, satkerName: newName });
		const asAdmin = await call(adminAccess, "listAccessRequestsFn", "GET", undefined, adminSession);
		type Listed = { requests: { kodeSatker: string; duplicateCount: number }[] };
		const decoded = fromCrossJSON(JSON.parse(asAdmin.body), { refs: new Map() }) as
			| Listed
			| { result: Listed };
		const listed = "result" in decoded ? decoded.result : decoded;
		const forKode = listed.requests.filter((row) => row.kodeSatker === newKode);
		expect(forKode.map((row) => row.duplicateCount)).toEqual([2, 2]);
		await db.delete(users).where(eq(users.id, other.id));
	});

	it("rejecting keeps the account and marks the request rejected", async () => {
		const request = await myRequest();
		await call(adminAccess, "rejectAccessRequestFn", "POST", { requestId: request.id }, adminSession);
		expect((await myRequest())?.status).toBe("rejected");
		const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, requesterUserId as string));
		expect(user).toBeDefined();
		expect(await requesterAccesses()).toEqual([]);
	});

	it("approving maps the requester as Operator of the requested satker", async () => {
		await call(settings, "requestSatkerAccessFn", "POST", { kodeSatker: newKode, name: newName }, requesterSession);
		const request = await myRequest();
		expect(request?.status).toBe("pending");
		await call(adminAccess, "approveAccessRequestFn", "POST", { requestId: request.id }, adminSession);

		expect(await myRequest()).toBeUndefined();
		const [org] = await db
			.select({ id: organizations.id, name: organizations.name })
			.from(organizations)
			.where(eq(organizations.kodeSatker, newKode));
		expect(org?.name).toBe(newName);
		const accesses = await requesterAccesses();
		expect(accesses).toEqual([{ id: expect.any(String), orgId: org.id }]);
	});

	it("an invitation needs a 6-digit code", async () => {
		const result = await call(
			adminAccess,
			"assignUserAccessFn",
			"POST",
			{
				email: inviteEmail,
				name: `Undangan ${tag}`,
				accessType: "operator_satker",
				kodeSatker: "12345",
				satkerName: `Satker Undangan ${tag}`,
			},
			adminSession,
		);
		expect(result.body).toContain("6 digit");
		const [invited] = await db.select({ id: users.id }).from(users).where(eq(users.email, inviteEmail));
		expect(invited).toBeUndefined();
	});

	it("an invitation creates a password-less account with active access", async () => {
		await call(
			adminAccess,
			"assignUserAccessFn",
			"POST",
			{
				email: inviteEmail,
				name: `Undangan ${tag}`,
				accessType: "operator_satker",
				kodeSatker: inviteKode,
				satkerName: `Satker Undangan ${tag}`,
			},
			adminSession,
		);
		const [invited] = await db
			.select({ id: users.id, emailVerified: users.emailVerified })
			.from(users)
			.where(eq(users.email, inviteEmail));
		expect(invited).toMatchObject({ emailVerified: false });
		const [access] = await db
			.select({ status: userAccesses.status, active: userAccesses.active })
			.from(userAccesses)
			.where(and(eq(userAccesses.userId, invited.id), eq(userAccesses.accessType, "operator_satker")));
		expect(access).toEqual({ status: "active", active: true });
		const credentials = await db
			.select({ id: authAccounts.id })
			.from(authAccounts)
			.where(eq(authAccounts.userId, invited.id));
		expect(credentials).toEqual([]);

		const list = await call(adminAccess, "listAdminUserAccessFn", "GET", undefined, adminSession);
		expect(list.body.includes(inviteEmail)).toBe(true);
	});

	it("sign-up refuses a registered email and a satker that already has an Operator", async () => {
		const [own] = await db
			.select({ email: users.email, kode: organizations.kodeSatker, name: organizations.name })
			.from(userAccesses)
			.innerJoin(organizations, eq(userAccesses.orgId, organizations.id))
			.innerJoin(users, eq(users.id, userAccesses.userId))
			.where(eq(userAccesses.userId, operatorUserId as string))
			.limit(1);
		const freshEmail = `f13-signup-${tag.toLowerCase()}@example.test`;
		const signUp = async (body: Record<string, string>) => {
			const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
				method: "POST",
				headers: { "content-type": "application/json", origin: baseUrl as string },
				body: JSON.stringify({ name: "Uji Daftar", password: "rahasia2026x", ...body }),
			});
			return { status: response.status, body: (await response.json()) as { code?: string; message?: string } };
		};

		const sameEmail = await signUp({ email: own.email, kodeSatker: newKode, namaSatker: newName });
		expect(sameEmail).toMatchObject({ status: 400, body: { code: "EMAIL_ALREADY_REGISTERED" } });

		for (const satker of [
			{ kodeSatker: own.kode.toLowerCase(), namaSatker: `Nama lain ${tag}` },
			{ kodeSatker: nameMatchKode, namaSatker: ` ${own.name.toUpperCase()} ` },
		]) {
			const taken = await signUp({ email: freshEmail, ...satker });
			expect(taken.status).toBe(400);
			expect(taken.body.code).toBe("SATKER_ALREADY_HAS_OPERATOR");
			expect(taken.body.message).toContain(`Satker ${own.kode} – ${own.name}`);
			expect(taken.body.message).not.toContain(own.email);
		}
		const badKode = await signUp({ email: freshEmail, kodeSatker: "12345", namaSatker: `Satker Bebas ${tag}` });
		expect(badKode).toMatchObject({ status: 400, body: { code: "KODE_SATKER_INVALID" } });

		const [created] = await db.select({ id: users.id }).from(users).where(eq(users.email, freshEmail));
		expect(created).toBeUndefined();
	});

	it("sign-up refuses an email with a pending request and reuses an orphan email", async () => {
		const signUp = async (email: string) => {
			const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
				method: "POST",
				headers: { "content-type": "application/json", origin: baseUrl as string },
				body: JSON.stringify({
					name: "Uji Daftar",
					email,
					password: "rahasia2026x",
					kodeSatker: randomKode(),
					namaSatker: `Satker Ulang ${tag} ${email.length}`,
				}),
			});
			return { status: response.status, body: (await response.json()) as { code?: string } };
		};

		const [pending] = await db
			.insert(users)
			.values({ email: pendingEmail, name: "Menunggu", emailVerified: true })
			.returning({ id: users.id });
		await db.insert(accessRequests).values({ userId: pending.id, kodeSatker: randomKode(), satkerName: `Satker Tunggu ${tag}` });
		const waiting = await signUp(pendingEmail);
		expect(waiting).toMatchObject({ status: 400, body: { code: "EMAIL_REQUEST_PENDING" } });

		// No access and no pending request: the Admin cannot see it, so the
		// email is reused. Without history the old account is deleted.
		const [orphan] = await db
			.insert(users)
			.values({ email: orphanEmail, name: "Akun yatim", emailVerified: true })
			.returning({ id: users.id });
		expect((await signUp(orphanEmail)).status).toBe(200);
		const [gone] = await db.select({ id: users.id }).from(users).where(eq(users.id, orphan.id));
		expect(gone).toBeUndefined();
		const [fresh] = await db
			.select({ id: users.id, emailVerified: users.emailVerified })
			.from(users)
			.where(eq(users.email, orphanEmail));
		expect(fresh.id).not.toBe(orphan.id);
		expect(fresh.emailVerified).toBe(false);

		// With history (an audit entry) the old row stays and only its email goes.
		const [withHistory] = await db
			.insert(users)
			.values({ email: historyEmail, name: "Akun berriwayat", emailVerified: true })
			.returning({ id: users.id });
		releasedUserId = withHistory.id;
		await db.insert(auditLogs).values({ actorId: withHistory.id, entityType: "users", action: "f13_history_fixture" });
		expect((await signUp(historyEmail)).status).toBe(200);
		const [released] = await db.select({ email: users.email }).from(users).where(eq(users.id, withHistory.id));
		expect(released.email).toBe(`released-${withHistory.id}@released.invalid`);
		const kept = await db.select({ id: auditLogs.id }).from(auditLogs).where(eq(auditLogs.actorId, withHistory.id));
		expect(kept).toHaveLength(1);
	});

	it("sign-in explains an unknown email and a password-less account", async () => {
		const unknown = await signIn(`f13-unknown-${tag.toLowerCase()}@example.test`);
		expect(unknown.status).toBe(400);
		expect(unknown.body.code).toBe("EMAIL_NOT_REGISTERED");

		await db.insert(users).values({ email: bareEmail, name: "Akun tanpa kata sandi" });
		const bare = await signIn(bareEmail);
		expect(bare.status).toBe(400);
		expect(bare.body.code).toBe("PASSWORD_NOT_SET");
	});
});

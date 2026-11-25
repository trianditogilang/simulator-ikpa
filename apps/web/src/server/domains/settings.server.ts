import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";
import { createDbClient } from "@simulator-ikpa/db";
import {
	accessRequests,
	fiscalYears,
	kppnScopes,
	organizations,
	ruleSets,
	userAccesses,
	users,
} from "@simulator-ikpa/db/schema";
import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { getAccessResolutionForSession } from "../access.server";
import { writeAudit } from "../audit/write-audit";
import { findSatkerTakenMessage } from "../auth.server";
import { getServerAuthSession } from "../auth-session.server";
import { failIfProduction } from "../runtime-guards";

export interface SatkerSettingsData {
	satkerId: string;
	satkerCode: string;
	satkerName: string;
	kppnName: string;
	kppnCode: string;
	isBlu: boolean;
	targetIkpa: number;
	timezone: string;
	activeRuleSet: string;
	operators: { name: string; email: string; role: string }[];
}

function getDatabase() {
	const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
	if (!dbUrl) {
		failIfProduction(true, "Production database is not configured for satker settings.");
		return null;
	}
	return createDbClient(dbUrl);
}

async function findVisibleOperatorForOrganization(
	db: ReturnType<typeof createDbClient>,
	orgId: string,
) {
	const visibleStatus = or(
		and(eq(userAccesses.status, "active"), isNotNull(userAccesses.userId)),
		and(eq(userAccesses.status, "pending"), isNull(userAccesses.userId)),
	);
	if (!visibleStatus) return undefined;

	const [operator] = await db
		.select({ id: userAccesses.id })
		.from(userAccesses)
		.where(
			and(
				eq(userAccesses.orgId, orgId),
				eq(userAccesses.accessType, "operator_satker"),
				eq(userAccesses.active, true),
				visibleStatus,
			),
		)
		.limit(1);
	return operator;
}

export type RegisterSatkerForUserInput = {
	userId: string;
	kodeSatker: string;
	name: string;
	isBlu?: boolean;
	/** Admin KPPN approving the request (ADR-008 amendment 2026-11-23). */
	actorId: string;
	actorAccessType: "operator_satker" | "admin_kppn";
};

/**
 * Maps `userId` as Operator of the satker (creating the organization when the
 * code is new). Only an Admin approval reaches this since 2026-11-23: a
 * self-service sign-up files an access request instead, so nobody can claim a
 * satker, or read its data, on their own.
 */
export async function registerSatkerForUser(
	db: ReturnType<typeof createDbClient>,
	input: RegisterSatkerForUserInput,
) {
	const normalizedKode = input.kodeSatker.trim().toUpperCase();
	const normalizedName = input.name.trim();
	if (!normalizedKode) throw new Error("Kode Satker tidak boleh kosong.");
	if (!normalizedName) throw new Error("Nama Satker tidak boleh kosong.");

	// 2. Resolve default KPPN scope — Malang 032
	let [scope] = await db.select().from(kppnScopes).where(eq(kppnScopes.code, "KPPN-032")).limit(1);
	if (!scope) {
		[scope] = await db.select().from(kppnScopes).where(eq(kppnScopes.code, "032")).limit(1) as unknown as typeof scope[];
	}
	if (!scope) {
		[scope] = await db.select().from(kppnScopes).limit(1) as unknown as typeof scope[];
	}
	if (!scope) {
		[scope] = await db
			.insert(kppnScopes)
			.values({
				code: "KPPN-032",
				name: "KPPN Malang",
			})
			.returning();
	} else if (scope.code !== "KPPN-032" || scope.name !== "KPPN Malang") {
		const [updated] = await db.update(kppnScopes).set({ code: "KPPN-032", name: "KPPN Malang", updatedAt: new Date() }).where(eq(kppnScopes.id, scope.id)).returning();
		if (updated) scope = updated;
	}

	// 3. Find or create organization. An unmapped user may reuse an organization
	// row that has no visible operator/pending mapping; the access list is the
	// source of truth for whether the code is already claimed.
	let [org] = await db
		.select()
		.from(organizations)
		.where(eq(organizations.kodeSatker, normalizedKode))
		.limit(1);

	if (org) {
		if (org.kppnScopeId !== scope.id) {
			throw Object.assign(
				new Error("Akses onboarding ditolak: Satker sudah terdaftar. Minta Admin KPPN memetakan akses Anda."),
				{ statusCode: 409, code: "SATKER_ALREADY_REGISTERED" },
			);
		}
		if (org.name.trim().toLowerCase() !== normalizedName.toLowerCase()) {
			if (await findVisibleOperatorForOrganization(db, org.id)) {
				throw Object.assign(new Error("Kode satker sudah terdaftar dengan nama berbeda."), { statusCode: 409, code: "ORGANIZATION_NAME_MISMATCH" });
			}
		}
		// An existing organization keeps its registered name: a requester's
		// spelling never renames it (the Admin saw both names when approving).
	} else {
		[org] = await db
			.insert(organizations)
			.values({
				kodeSatker: normalizedKode,
				name: normalizedName,
				kppnScopeId: scope.id,
				kppnName: scope.name,
				isBlu: input.isBlu ?? false,
				timezone: "Asia/Jakarta",
			})
			.returning();
	}

	// 4. Ensure Fiscal Year 2026 exists
	const [ruleSet] = await db
		.select()
		.from(ruleSets)
		.where(and(eq(ruleSets.year, 2026), eq(ruleSets.status, "published")))
		.limit(1);

	if (ruleSet) {
		const [existingFy] = await db
			.select()
			.from(fiscalYears)
			.where(and(eq(fiscalYears.orgId, org.id), eq(fiscalYears.year, 2026)))
			.limit(1);

		if (!existingFy) {
			await db.insert(fiscalYears).values({
				orgId: org.id,
				year: 2026,
				activeRuleSetId: ruleSet.id,
			});
		}
	}

	// 5. Insert / activate user access
	const [existingAccess] = await db
		.select()
		.from(userAccesses)
		.where(
			and(eq(userAccesses.userId, input.userId), eq(userAccesses.orgId, org.id)),
		)
		.limit(1);

	if (!existingAccess) {
		if (await findVisibleOperatorForOrganization(db, org.id)) {
			throw Object.assign(new Error("Satker sudah memiliki operator aktif."), { statusCode: 409, code: "SATKER_OPERATOR_EXISTS" });
		}
	}

	if (!existingAccess) {
		await db.insert(userAccesses).values({
			userId: input.userId,
			accessType: "operator_satker",
			orgId: org.id,
			active: true,
			createdBy: input.actorId,
		});
	} else if (!existingAccess.active) {
		const visibleOperator = await findVisibleOperatorForOrganization(db, org.id);
		if (visibleOperator && visibleOperator.id !== existingAccess.id) {
			throw Object.assign(new Error("Satker sudah memiliki operator aktif."), { statusCode: 409, code: "SATKER_OPERATOR_EXISTS" });
		}
		await db.update(userAccesses).set({ active: true, updatedAt: new Date() }).where(eq(userAccesses.id, existingAccess.id));
	}

	// Owner decision 2026-11-24: an Operator account is named after its satker.
	await db.update(users).set({ name: org.name, updatedAt: new Date() }).where(eq(users.id, input.userId));

	// 7. Write audit log
	await writeAudit(db, {
		actorId: input.actorId,
		actorAccessType: input.actorAccessType,
		entityType: "organizations",
		entityId: org.id,
		action: "onboard_satker",
		beforeJson: null,
		afterJson: {
			kodeSatker: org.kodeSatker,
			name: org.name,
			isBlu: org.isBlu,
		},
		orgId: org.id,
	});

	return org;
}

async function getVerifiedSessionUser() {
	const auth = await getServerAuthSession();
	if (!auth.isAuthenticated || !auth.userId) {
		throw new Error("Sesi tidak valid. Silakan login terlebih dahulu.");
	}
	const db = getDatabase();
	if (!db) {
		throw new Error("Database belum dikonfigurasi.");
	}
	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.id, auth.userId))
		.limit(1);
	if (!user?.emailVerified) {
		throw new Error("Sesi tidak valid. Silakan login terlebih dahulu.");
	}
	return { auth, db, user };
}

export type MyAccessRequest = {
	kodeSatker: string;
	satkerName: string;
	status: "pending" | "rejected";
} | null;

/** The session user's own access request, if any. */
export async function handleGetMyAccessRequest(): Promise<MyAccessRequest> {
	const { db, user } = await getVerifiedSessionUser();
	const [request] = await db
		.select({
			kodeSatker: accessRequests.kodeSatker,
			satkerName: accessRequests.satkerName,
			status: accessRequests.status,
		})
		.from(accessRequests)
		.where(eq(accessRequests.userId, user.id))
		.limit(1);
	return request ?? null;
}

/**
 * Files (or refiles) the session user's request to become Operator of a
 * satker. It grants nothing and touches no organization. Since 2026-11-24 it
 * refuses a satker that already has an Operator or someone else's pending
 * request, like sign-up does (owner decision: the masked email beats silent
 * probing protection).
 */
export async function handleRequestSatkerAccess(data: {
	kodeSatker: string;
	name: string;
}): Promise<{ success: true }> {
	const { auth, db, user } = await getVerifiedSessionUser();
	const access = await getAccessResolutionForSession(auth);
	if (access.status !== "unmapped") {
		throw Object.assign(new Error("Akun ini sudah memiliki akses."), {
			statusCode: 409,
			code: "ACCESS_ALREADY_GRANTED",
		});
	}

	const taken = await findSatkerTakenMessage(db, data.kodeSatker, data.name, user.id);
	if (taken) {
		throw Object.assign(new Error(taken.message), { statusCode: 409, code: taken.code });
	}

	const values = {
		kodeSatker: data.kodeSatker.trim().toUpperCase(),
		satkerName: data.name.trim(),
		status: "pending" as const,
		decidedBy: null,
		decidedAt: null,
		updatedAt: new Date(),
	};
	await db
		.insert(accessRequests)
		.values({ userId: user.id, ...values })
		.onConflictDoUpdate({ target: accessRequests.userId, set: values });
	return { success: true };
}

export async function handleGetSatkerSettings(data?: {
	orgId?: string;
}): Promise<SatkerSettingsData> {
	const auth = await getServerAuthSession();
	const access = await getAccessResolutionForSession(auth, data?.orgId);

	const targetOrgId =
		data?.orgId ||
		(access.status === "operator_single_scope" ||
		access.status === "operator_multiple_scopes"
			? access.activeOrganizationId
			: null);

	if (!targetOrgId) {
		throw new Error("Satuan Kerja aktif tidak ditemukan.");
	}

	assertOperatorOrgScope(access, targetOrgId);

	const db = getDatabase();
	if (!db) {
		return {
			satkerId: targetOrgId,
			satkerCode: "411782",
			satkerName: "Kantor Pelayanan Perbendaharaan Satker Contoh",
			kppnName: "KPPN Malang",
			kppnCode: "032",
			isBlu: false,
			targetIkpa: 95.0,
			timezone: "Asia/Jakarta (WIB)",
			activeRuleSet: "2026.1 (PER-5/PB/2024)",
			operators: [
				{
					name: auth.name || "Operator Satker",
					email: auth.email || "operator@kemenkeu.go.id",
					role: "Operator Satker (Aktif)",
				},
			],
		};
	}

	// 1. Fetch organization with scope
	const [org] = await db
		.select({
			id: organizations.id,
			kodeSatker: organizations.kodeSatker,
			name: organizations.name,
			kppnName: organizations.kppnName,
			isBlu: organizations.isBlu,
			timezone: organizations.timezone,
			kppnCode: kppnScopes.code,
		})
		.from(organizations)
		.leftJoin(kppnScopes, eq(organizations.kppnScopeId, kppnScopes.id))
		.where(eq(organizations.id, targetOrgId))
		.limit(1);

	if (!org) {
		throw new Error("Data Satker tidak ditemukan di database.");
	}

	// 2. Fetch active rule set
	const [fy] = await db
		.select({
			year: fiscalYears.year,
			ruleSetVersion: ruleSets.version,
			sourceRegulation: ruleSets.sourceRegulation,
		})
		.from(fiscalYears)
		.leftJoin(ruleSets, eq(fiscalYears.activeRuleSetId, ruleSets.id))
		.where(and(eq(fiscalYears.orgId, targetOrgId), eq(fiscalYears.year, 2026)))
		.limit(1);

	const activeRuleSetLabel = fy
		? `${fy.year} (Versi ${fy.ruleSetVersion || "Standar"})`
		: "2026.1 (PER-5/PB/2024)";

	// 3. Fetch registered operators
	const operatorRows = await db
		.select({
			name: users.name,
			email: users.email,
			accessType: userAccesses.accessType,
			active: userAccesses.active,
		})
		.from(userAccesses)
		.innerJoin(users, eq(userAccesses.userId, users.id))
		.where(
			and(eq(userAccesses.orgId, targetOrgId), eq(userAccesses.active, true)),
		);

	const operators = operatorRows.map((op) => ({
		name: op.name,
		email: op.email,
		role: "Operator Satker",
	}));

	if (operators.length === 0 && auth.name && auth.email) {
		operators.push({
			name: auth.name,
			email: auth.email,
			role: "Operator Satker (Sesi Aktif)",
		});
	}

	return {
		satkerId: org.id,
		satkerCode: org.kodeSatker,
		satkerName: org.name,
		kppnName: org.kppnName || "KPPN Malang",
		kppnCode: org.kppnCode || "032",
		isBlu: org.isBlu,
		targetIkpa: 95.0,
		timezone: "Asia/Jakarta (WIB)",
		activeRuleSet: activeRuleSetLabel,
		operators,
	};
}

export async function handleUpdateSatkerSettings(data: {
	orgId: string;
	name: string;
	isBlu: boolean;
}) {
	const auth = await getServerAuthSession();
	const access = await getAccessResolutionForSession(auth, data.orgId);

	assertOperatorOrgScope(access, data.orgId);

	const db = getDatabase();
	if (!db) {
		return { success: true };
	}

	const [before] = await db
		.select()
		.from(organizations)
		.where(eq(organizations.id, data.orgId))
		.limit(1);

	if (!before) {
		throw new Error("Satker tidak ditemukan.");
	}

	const [after] = await db
		.update(organizations)
		.set({
			name: data.name,
			isBlu: data.isBlu,
			updatedAt: new Date(),
		})
		.where(eq(organizations.id, data.orgId))
		.returning();
	// Operator accounts carry the satker name (owner decision 2026-11-24).
	await db
		.update(users)
		.set({ name: data.name, updatedAt: new Date() })
		.where(
			inArray(
				users.id,
				db
					.select({ id: userAccesses.userId })
					.from(userAccesses)
					.where(
						and(
							eq(userAccesses.orgId, data.orgId),
							eq(userAccesses.accessType, "operator_satker"),
							eq(userAccesses.active, true),
						),
					),
			),
		);

	const actorId =
		access.status === "operator_single_scope" ||
		access.status === "operator_multiple_scopes" ||
		access.status === "admin"
			? access.userId
			: before.id;

	await writeAudit(db, {
		actorId,
		actorAccessType: "operator_satker",
		entityType: "organizations",
		entityId: data.orgId,
		action: "update_settings",
		beforeJson: before,
		afterJson: after,
		orgId: data.orgId,
	});

	return { success: true, updated: after };
}

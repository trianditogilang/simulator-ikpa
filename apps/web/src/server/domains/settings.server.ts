import {
	assertOperatorOrgScope,
	syncClerkUser,
} from "@simulator-ikpa/access-control";
import { createDbClient } from "@simulator-ikpa/db";
import {
	fiscalYears,
	kppnScopes,
	organizations,
	ruleSets,
	userAccesses,
	users,
} from "@simulator-ikpa/db/schema";
import { setCookie } from "@tanstack/react-start/server";
import { and, eq } from "drizzle-orm";
import { getAccessResolutionForSession } from "../access.server";
import { writeAudit } from "../audit/write-audit";
import {
	ACTIVE_ORGANIZATION_COOKIE,
	getClerkIdentity,
	getServerAuthSession,
} from "../auth-session.server";
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

export async function handleRegisterSatkerOnboarding(data: {
	kodeSatker: string;
	name: string;
	isBlu?: boolean;
}) {
	const auth = await getServerAuthSession();
	if (!auth.isAuthenticated || !auth.clerkUserId) {
		throw new Error("Sesi tidak valid. Silakan login terlebih dahulu.");
	}

	const db = getDatabase();
	if (!db) {
		if (process.env.NODE_ENV === "production") {
			throw new Error("DATABASE_URL is required in production");
		}
		return {
			success: true,
			orgId: "22222222-2222-4222-8222-222222222222",
			satkerName: data.name,
			kodeSatker: data.kodeSatker,
		};
	}

	// 1. Ensure user exists
	let [user] = await db
		.select()
		.from(users)
		.where(eq(users.clerkUserId, auth.clerkUserId))
		.limit(1);

	if (!user) {
		const identity = process.env.CLERK_SECRET_KEY
			? await getClerkIdentity(auth.clerkUserId)
			: {
					clerkUserId: auth.clerkUserId,
					email: auth.email || `${auth.clerkUserId}@kemenkeu.go.id`,
					name: auth.name || "Operator Satker",
				};
		user = await syncClerkUser(db, identity);
	}

	const normalizedKode = data.kodeSatker.trim().toUpperCase();
	const normalizedName = data.name.trim();
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

	// 3. Find or create organization. An unmapped user may create a new satker,
	// but may not claim an already-registered satker by guessing its code.
	let createdOrganization = false;
	let [org] = await db
		.select()
		.from(organizations)
		.where(eq(organizations.kodeSatker, normalizedKode))
		.limit(1);

	if (org) {
		if (org.name.trim() !== normalizedName) {
			throw Object.assign(new Error("Kode satker sudah terdaftar dengan nama berbeda."), { statusCode: 409, code: "ORGANIZATION_NAME_MISMATCH" });
		}
	} else {
		[org] = await db
			.insert(organizations)
			.values({
				kodeSatker: normalizedKode,
				name: normalizedName,
				kppnScopeId: scope.id,
				kppnName: scope.name,
				isBlu: data.isBlu ?? false,
				timezone: "Asia/Jakarta",
			})
			.returning();
		createdOrganization = true;
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
			and(eq(userAccesses.userId, user.id), eq(userAccesses.orgId, org.id)),
		)
		.limit(1);

	if (!createdOrganization && !existingAccess) {
		const [activeOperator] = await db.select().from(userAccesses).where(and(eq(userAccesses.orgId, org.id), eq(userAccesses.accessType, "operator_satker"), eq(userAccesses.active, true))).limit(1);
		if (activeOperator) {
			throw Object.assign(new Error("Satker sudah memiliki operator aktif."), { statusCode: 409, code: "SATKER_OPERATOR_EXISTS" });
		}
		throw Object.assign(new Error("Satker sudah terdaftar. Minta Admin KPPN memetakan akses Anda."), { statusCode: 409, code: "SATKER_ALREADY_REGISTERED" });
	}

	if (!existingAccess) {
		const [activeOperator] = await db.select().from(userAccesses).where(and(eq(userAccesses.orgId, org.id), eq(userAccesses.accessType, "operator_satker"), eq(userAccesses.active, true))).limit(1);
		if (activeOperator) {
			throw Object.assign(new Error("Satker sudah memiliki operator aktif."), { statusCode: 409, code: "SATKER_OPERATOR_EXISTS" });
		}
		await db.insert(userAccesses).values({
			userId: user.id,
			accessType: "operator_satker",
			orgId: org.id,
			active: true,
			createdBy: user.id,
		});
	} else if (!existingAccess.active) {
		const [activeOperator] = await db.select().from(userAccesses).where(and(eq(userAccesses.orgId, org.id), eq(userAccesses.accessType, "operator_satker"), eq(userAccesses.active, true))).limit(1);
		if (activeOperator && activeOperator.userId !== user.id) {
			throw Object.assign(new Error("Satker sudah memiliki operator aktif."), { statusCode: 409, code: "SATKER_OPERATOR_EXISTS" });
		}
		await db.update(userAccesses).set({ active: true, updatedAt: new Date() }).where(eq(userAccesses.id, existingAccess.id));
	}

	// 6. Set active organization cookie
	setCookie(ACTIVE_ORGANIZATION_COOKIE, org.id, {
		httpOnly: true,
		maxAge: 60 * 60 * 24 * 30,
		path: "/",
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
	});

	// 7. Write audit log
	await writeAudit(db, {
		actorId: user.id,
		actorAccessType: "operator_satker",
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

	return {
		success: true,
		orgId: org.id,
		satkerName: org.name,
		kodeSatker: org.kodeSatker,
	};
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

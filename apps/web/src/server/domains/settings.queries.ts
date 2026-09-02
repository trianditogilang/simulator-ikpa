import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";
import type { AccessResolution } from "@simulator-ikpa/contracts";
import type { DbClient } from "@simulator-ikpa/db";
import { fiscalYears, organizations } from "@simulator-ikpa/db/schema";
import { and, eq } from "drizzle-orm";

export async function getOrganizationSettings(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
) {
	const { orgId: scopedOrgId } = assertOperatorOrgScope(access, orgId);
	const [org] = await db
		.select()
		.from(organizations)
		.where(eq(organizations.id, scopedOrgId))
		.limit(1);
	if (!org) throw new Error("Satker tidak ditemukan.");
	return org;
}

export async function getFiscalYear(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	year: number,
) {
	assertOperatorOrgScope(access, orgId);
	const [fy] = await db
		.select()
		.from(fiscalYears)
		.where(and(eq(fiscalYears.orgId, orgId), eq(fiscalYears.year, year)))
		.limit(1);
	return fy ?? null;
}

export async function listFiscalYears(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
) {
	assertOperatorOrgScope(access, orgId);
	return db.select().from(fiscalYears).where(eq(fiscalYears.orgId, orgId));
}

export async function getActiveFiscalYear(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
) {
	assertOperatorOrgScope(access, orgId);
	// latest year for org
	const rows = await db
		.select()
		.from(fiscalYears)
		.where(eq(fiscalYears.orgId, orgId));
	if (rows.length === 0) return null;
	return rows.reduce((a, b) => (a.year > b.year ? a : b));
}

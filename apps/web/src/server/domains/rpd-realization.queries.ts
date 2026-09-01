import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "@simulator-ikpa/db";
import { fiscalYears, realizations, rpdLines } from "@simulator-ikpa/db/schema";
import type { AccessResolution } from "@simulator-ikpa/contracts";
import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";

async function assertFy(db: DbClient, access: AccessResolution, orgId: string, fiscalYearId: string) {
  assertOperatorOrgScope(access, orgId);
  const [fy] = await db.select().from(fiscalYears).where(eq(fiscalYears.id, fiscalYearId)).limit(1);
  if (!fy || fy.orgId !== orgId) throw new Error("Fiscal year tidak valid.");
  return fy;
}

export async function listRpdLines(db: DbClient, access: AccessResolution, orgId: string, fiscalYearId: string) {
  await assertFy(db, access, orgId, fiscalYearId);
  return db.select().from(rpdLines).where(and(eq(rpdLines.fiscalYearId, fiscalYearId), isNull(rpdLines.deletedAt)));
}

export async function listRealizations(db: DbClient, access: AccessResolution, orgId: string, fiscalYearId: string) {
  await assertFy(db, access, orgId, fiscalYearId);
  return db.select().from(realizations).where(and(eq(realizations.fiscalYearId, fiscalYearId), isNull(realizations.deletedAt)));
}

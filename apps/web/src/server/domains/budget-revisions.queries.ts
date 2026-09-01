import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "@simulator-ikpa/db";
import { budgets, dipaRevisions, fiscalYears } from "@simulator-ikpa/db/schema";
import type { AccessResolution } from "@simulator-ikpa/contracts";
import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";

async function assertFiscalYearAccess(
  db: DbClient,
  access: AccessResolution,
  fiscalYearId: string,
  orgId: string,
) {
  assertOperatorOrgScope(access, orgId);
  const [fy] = await db.select().from(fiscalYears).where(eq(fiscalYears.id, fiscalYearId)).limit(1);
  if (!fy || fy.orgId !== orgId) throw new Error("Fiscal year tidak ditemukan atau di luar scope.");
  return fy;
}

export async function listBudgets(
  db: DbClient,
  access: AccessResolution,
  orgId: string,
  fiscalYearId: string,
) {
  await assertFiscalYearAccess(db, access, fiscalYearId, orgId);
  return db.select().from(budgets).where(and(eq(budgets.fiscalYearId, fiscalYearId), isNull(budgets.deletedAt)));
}

export async function listRevisions(
  db: DbClient,
  access: AccessResolution,
  orgId: string,
  fiscalYearId: string,
) {
  await assertFiscalYearAccess(db, access, fiscalYearId, orgId);
  return db.select().from(dipaRevisions).where(and(eq(dipaRevisions.fiscalYearId, fiscalYearId), isNull(dipaRevisions.deletedAt)));
}

// preview eligibility based on ruleSet config (static list check)
export function previewRevisionEligibility(revisionCode: string, eligibleCodes: string[]) {
  return eligibleCodes.includes(revisionCode);
}

import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "@simulator-ikpa/db";
import { contracts, fiscalYears, spmLs } from "@simulator-ikpa/db/schema";
import type { AccessResolution } from "@simulator-ikpa/contracts";
import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";

async function assertFy(db: DbClient, access: AccessResolution, orgId: string, fiscalYearId: string) {
  assertOperatorOrgScope(access, orgId);
  const [fy] = await db.select().from(fiscalYears).where(eq(fiscalYears.id, fiscalYearId)).limit(1);
  if (!fy || fy.orgId !== orgId) throw new Error("Fiscal year tidak valid.");
  return fy;
}

export async function listContracts(db: DbClient, access: AccessResolution, orgId: string, fiscalYearId: string) {
  await assertFy(db, access, orgId, fiscalYearId);
  return db.select().from(contracts).where(and(eq(contracts.fiscalYearId, fiscalYearId), isNull(contracts.deletedAt)));
}

export async function listSpmLs(db: DbClient, access: AccessResolution, orgId: string, fiscalYearId: string) {
  await assertFy(db, access, orgId, fiscalYearId);
  return db.select().from(spmLs).where(and(eq(spmLs.fiscalYearId, fiscalYearId), isNull(spmLs.deletedAt)));
}

// H+17 workday projection helper (uses DB workdays if available, fallback calendar_day)
export function projectDeadlineH17(bastDate: string, holidays: string[] = []): string {
  const date = new Date(bastDate);
  let added = 0;
  while (added < 17) {
    date.setDate(date.getDate() + 1);
    const dow = date.getDay();
    const iso = date.toISOString().slice(0, 10);
    if (dow === 0 || dow === 6) continue;
    if (holidays.includes(iso)) continue;
    added++;
  }
  return date.toISOString().slice(0, 10);
}

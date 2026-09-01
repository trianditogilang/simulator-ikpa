import { and, eq } from "drizzle-orm";
import type { DbClient } from "@simulator-ikpa/db";
import { fiscalYears, orgReminderConfigs, reminderPolicies } from "@simulator-ikpa/db/schema";
import type { AccessResolution } from "@simulator-ikpa/contracts";
import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";
import { evaluateDeadline, subtractWorkdays } from "@simulator-ikpa/policy-reminder";
import type { WorkdayCalendar } from "@simulator-ikpa/policy-reminder";

async function assertFy(db: DbClient, access: AccessResolution, orgId: string, fiscalYearId: string) {
  assertOperatorOrgScope(access, orgId);
  const [fy] = await db.select().from(fiscalYears).where(eq(fiscalYears.id, fiscalYearId)).limit(1);
  if (!fy || fy.orgId !== orgId) throw new Error("Fiscal year tidak valid.");
  return fy;
}

export async function listReminderConfigs(
  db: DbClient,
  access: AccessResolution,
  orgId: string,
  fiscalYearId: string,
) {
  await assertFy(db, access, orgId, fiscalYearId);
  return db.select().from(orgReminderConfigs).where(and(eq(orgReminderConfigs.orgId, orgId), eq(orgReminderConfigs.fiscalYearId, fiscalYearId)));
}

export async function getReminderConfig(
  db: DbClient,
  access: AccessResolution,
  orgId: string,
  configId: string,
) {
  const [cfg] = await db.select().from(orgReminderConfigs).where(eq(orgReminderConfigs.id, configId)).limit(1);
  if (!cfg) throw new Error("Konfigurasi reminder tidak ditemukan.");
  assertOperatorOrgScope(access, orgId);
  if (cfg.orgId !== orgId) throw new Error("Config di luar scope satker.");
  return cfg;
}

// server-authoritative preview: computes deadline + scheduled dates from policy + config
export async function previewReminderSchedule(
  db: DbClient,
  access: AccessResolution,
  orgId: string,
  fiscalYearId: string,
  policyId: string,
  configOverride?: { enabled?: boolean; scheduleJson?: unknown; additionalRecipientsJson?: unknown },
  calendar?: WorkdayCalendar,
) {
  await assertFy(db, access, orgId, fiscalYearId);
  const [policy] = await db.select().from(reminderPolicies).where(eq(reminderPolicies.id, policyId)).limit(1);
  if (!policy) throw new Error("Policy tidak ditemukan.");
  if (!policy.isActive) throw new Error("Policy tidak aktif, tidak dapat di-preview.");

  const cal = calendar ?? { holidays: [], workdays: [] };
  // deadline via DSL
  const formula = policy.deadlineFormula as never;
  let deadline: string;
  try {
    deadline = evaluateDeadline(formula, { year: new Date().getFullYear(), bastDate: "2026-01-30", month: 2, quarter: 1 }, cal);
  } catch {
    deadline = "2026-12-31";
  }

  const schedule = (configOverride?.scheduleJson ?? policy.defaultScheduleJson) as { leadDays?: number[]; sendHour?: number };
  const leadDays = schedule?.leadDays ?? [];
  // compute scheduledFor per lead using same logic as scheduler plan
  const scheduled = leadDays.map(ld => {
    let date: string;
    if (policy.dayType === "workday") {
      date = subtractWorkdays(deadline, ld, cal);
    } else {
      const [y, m, d] = deadline.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      dt.setUTCDate(dt.getUTCDate() - ld);
      date = dt.toISOString().slice(0, 10);
    }
    return { leadDays: ld, scheduledDate: date, deadline };
  });

  return { policyId, deadline, dayType: policy.dayType, scheduled, requiredRecipients: policy.requiredRecipientsJson };
}

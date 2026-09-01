import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { DbClient } from "@simulator-ikpa/db";
import { fiscalYears, organizations } from "@simulator-ikpa/db/schema";
import type { AccessResolution } from "@simulator-ikpa/contracts";
import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";
import { writeAudit } from "../audit/write-audit";

const updateOrgSchema = z.strictObject({
  isBlu: z.boolean().optional(),
  timezone: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(200).optional(),
});

const upsertFiscalYearSchema = z.strictObject({
  year: z.number().int().min(2020).max(2100),
  activeRuleSetId: z.string().uuid(),
});

export async function updateOrganizationSettings(
  db: DbClient,
  access: AccessResolution,
  orgId: string,
  input: unknown,
  meta: { actorId: string; requestId?: string | null },
) {
  const data = updateOrgSchema.parse(input);
  const { orgId: scoped } = assertOperatorOrgScope(access, orgId);

  const [before] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, scoped))
    .limit(1);
  if (!before) throw new Error("Satker tidak ditemukan.");

  if (Object.keys(data).length === 0) throw new Error("Tidak ada perubahan.");

  const [after] = await db
    .update(organizations)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(organizations.id, scoped))
    .returning();

  await writeAudit(db, {
    actorId: meta.actorId,
    actorAccessType: "operator_satker",
    entityType: "organizations",
    entityId: scoped,
    action: "update_settings",
    beforeJson: before,
    afterJson: after,
    orgId: scoped,
    requestId: meta.requestId ?? null,
  });

  return after;
}

export async function upsertFiscalYear(
  db: DbClient,
  access: AccessResolution,
  orgId: string,
  input: unknown,
  meta: { actorId: string; requestId?: string | null },
) {
  const data = upsertFiscalYearSchema.parse(input);
  const { orgId: scoped } = assertOperatorOrgScope(access, orgId);

  const [existing] = await db
    .select()
    .from(fiscalYears)
    .where(and(eq(fiscalYears.orgId, scoped), eq(fiscalYears.year, data.year)))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(fiscalYears)
      .set({ activeRuleSetId: data.activeRuleSetId, updatedAt: new Date() })
      .where(eq(fiscalYears.id, existing.id))
      .returning();

    await writeAudit(db, {
      actorId: meta.actorId,
      actorAccessType: "operator_satker",
      entityType: "fiscal_years",
      entityId: existing.id,
      action: "update_fiscal_year",
      beforeJson: existing,
      afterJson: updated,
      orgId: scoped,
      requestId: meta.requestId ?? null,
    });
    return updated;
  }

  const [created] = await db
    .insert(fiscalYears)
    .values({
      orgId: scoped,
      year: data.year,
      activeRuleSetId: data.activeRuleSetId,
    })
    .returning();

  await writeAudit(db, {
    actorId: meta.actorId,
    actorAccessType: "operator_satker",
    entityType: "fiscal_years",
    entityId: created.id,
    action: "create_fiscal_year",
    beforeJson: null,
    afterJson: created,
    orgId: scoped,
    requestId: meta.requestId ?? null,
  });

  return created;
}

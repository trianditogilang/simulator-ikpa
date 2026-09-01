import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { DbClient } from "@simulator-ikpa/db";
import { fiscalYears, kkpUsages, upTupTransactions } from "@simulator-ikpa/db/schema";
import type { AccessResolution } from "@simulator-ikpa/contracts";
import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";
import { writeAudit } from "../audit/write-audit";

const dec182 = z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/, "Decimal invalid");

const upTupSchema = z.strictObject({
  fiscalYearId: z.string().uuid(),
  type: z.enum(["UP", "TUP", "GUP", "GUP_NIHIL", "PTUP", "SETORAN_TUP"]),
  amount: dec182,
  sp2dAt: z.iso.date(),
  referenceSp2dAt: z.iso.date().nullable().optional(),
  settlementDate: z.iso.date().nullable().optional(),
  isSettled: z.boolean().optional(),
});

const kkpSchema = z.strictObject({
  fiscalYearId: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  amount: dec182,
  usageDate: z.iso.date().nullable().optional(),
});

async function assertFy(db: DbClient, access: AccessResolution, orgId: string, fiscalYearId: string) {
  assertOperatorOrgScope(access, orgId);
  const [fy] = await db.select().from(fiscalYears).where(eq(fiscalYears.id, fiscalYearId)).limit(1);
  if (!fy || fy.orgId !== orgId) throw new Error("Fiscal year tidak valid.");
  return fy;
}

export async function createUpTup(db: DbClient, access: AccessResolution, orgId: string, input: unknown, meta: { actorId: string; requestId?: string | null }) {
  const data = upTupSchema.parse(input);
  await assertFy(db, access, orgId, data.fiscalYearId);
  // reference validation: PTUP/GUP should have reference?
  if ((data.type === "GUP" || data.type === "PTUP") && !data.referenceSp2dAt) {
    // allow but warn via audit? we enforce: reference required for GUP/PTUP
    throw new Error("GUP/PTUP wajib memiliki referensi SP2D asal.");
  }
  const [created] = await db.insert(upTupTransactions).values({ fiscalYearId: data.fiscalYearId, type: data.type, amount: data.amount, sp2dAt: data.sp2dAt, referenceSp2dAt: data.referenceSp2dAt ?? null, settlementDate: data.settlementDate ?? null, isSettled: data.isSettled ?? false, createdBy: meta.actorId }).returning();
  await writeAudit(db, { actorId: meta.actorId, actorAccessType: "operator_satker", entityType: "up_tup_transactions", entityId: created.id, action: "create_up_tup", beforeJson: null, afterJson: created, orgId, requestId: meta.requestId ?? null });
  return created;
}

export async function softDeleteUpTup(db: DbClient, access: AccessResolution, orgId: string, id: string, meta: { actorId: string; requestId?: string | null }) {
  const [row] = await db.select().from(upTupTransactions).where(eq(upTupTransactions.id, id)).limit(1);
  if (!row) throw new Error("Transaksi UP/TUP tidak ditemukan.");
  await assertFy(db, access, orgId, row.fiscalYearId);
  const [updated] = await db.update(upTupTransactions).set({ deletedAt: new Date() }).where(eq(upTupTransactions.id, id)).returning();
  await writeAudit(db, { actorId: meta.actorId, actorAccessType: "operator_satker", entityType: "up_tup_transactions", entityId: id, action: "delete_up_tup", beforeJson: row, afterJson: updated, orgId, requestId: meta.requestId ?? null });
  return updated;
}

export async function upsertKkp(db: DbClient, access: AccessResolution, orgId: string, input: unknown, meta: { actorId: string; requestId?: string | null }) {
  const data = kkpSchema.parse(input);
  await assertFy(db, access, orgId, data.fiscalYearId);
  // monthly uniqueness: one KKP usage per month per fiscal year
  const [existing] = await db.select().from(kkpUsages).where(and(eq(kkpUsages.fiscalYearId, data.fiscalYearId), eq(kkpUsages.month, data.month), isNull(kkpUsages.deletedAt))).limit(1);
  if (existing) {
    const [updated] = await db.update(kkpUsages).set({ amount: data.amount, usageDate: data.usageDate ?? null, updatedAt: new Date() }).where(eq(kkpUsages.id, existing.id)).returning();
    await writeAudit(db, { actorId: meta.actorId, actorAccessType: "operator_satker", entityType: "kkp_usages", entityId: existing.id, action: "update_kkp", beforeJson: existing, afterJson: updated, orgId, requestId: meta.requestId ?? null });
    return updated;
  }
  const [created] = await db.insert(kkpUsages).values({ fiscalYearId: data.fiscalYearId, month: data.month, amount: data.amount, usageDate: data.usageDate ?? null, createdBy: meta.actorId }).returning();
  await writeAudit(db, { actorId: meta.actorId, actorAccessType: "operator_satker", entityType: "kkp_usages", entityId: created.id, action: "create_kkp", beforeJson: null, afterJson: created, orgId, requestId: meta.requestId ?? null });
  return created;
}

export async function softDeleteKkp(db: DbClient, access: AccessResolution, orgId: string, id: string, meta: { actorId: string; requestId?: string | null }) {
  const [row] = await db.select().from(kkpUsages).where(eq(kkpUsages.id, id)).limit(1);
  if (!row) throw new Error("KKP tidak ditemukan.");
  await assertFy(db, access, orgId, row.fiscalYearId);
  const [updated] = await db.update(kkpUsages).set({ deletedAt: new Date() }).where(eq(kkpUsages.id, id)).returning();
  await writeAudit(db, { actorId: meta.actorId, actorAccessType: "operator_satker", entityType: "kkp_usages", entityId: id, action: "delete_kkp", beforeJson: row, afterJson: updated, orgId, requestId: meta.requestId ?? null });
  return updated;
}

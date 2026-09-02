import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";
import type { AccessResolution } from "@simulator-ikpa/contracts";
import type { DbClient } from "@simulator-ikpa/db";
import { fiscalYears, realizations, rpdLines } from "@simulator-ikpa/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "../audit/write-audit";

const dec182 = z
	.string()
	.regex(/^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/, "Decimal 18,2 invalid");

const upsertRpdSchema = z.strictObject({
	fiscalYearId: z.string().uuid(),
	month: z.number().int().min(1).max(12),
	accountCode: z.enum(["51", "52", "53", "57"]),
	amount: dec182,
});

const upsertRealizationSchema = z.strictObject({
	fiscalYearId: z.string().uuid(),
	month: z.number().int().min(1).max(12),
	accountCode: z.enum(["51", "52", "53", "57"]),
	amount: dec182,
});

const batchUpsertSchema = z.strictObject({
	fiscalYearId: z.string().uuid(),
	rows: z
		.array(upsertRpdSchema.omit({ fiscalYearId: true }))
		.min(1)
		.max(100),
	target: z.enum(["rpd", "realization"]),
});

async function assertFy(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	fiscalYearId: string,
) {
	assertOperatorOrgScope(access, orgId);
	const [fy] = await db
		.select()
		.from(fiscalYears)
		.where(eq(fiscalYears.id, fiscalYearId))
		.limit(1);
	if (!fy || fy.orgId !== orgId) throw new Error("Fiscal year tidak valid.");
	return fy;
}

export async function upsertRpdLine(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	input: unknown,
	meta: { actorId: string; requestId?: string | null },
) {
	const data = upsertRpdSchema.parse(input);
	await assertFy(db, access, orgId, data.fiscalYearId);
	const [existing] = await db
		.select()
		.from(rpdLines)
		.where(
			and(
				eq(rpdLines.fiscalYearId, data.fiscalYearId),
				eq(rpdLines.month, data.month),
				eq(rpdLines.accountCode, data.accountCode),
				isNull(rpdLines.deletedAt),
			),
		)
		.limit(1);
	if (existing) {
		const [updated] = await db
			.update(rpdLines)
			.set({ amount: data.amount, updatedAt: new Date() })
			.where(eq(rpdLines.id, existing.id))
			.returning();
		await writeAudit(db, {
			actorId: meta.actorId,
			actorAccessType: "operator_satker",
			entityType: "rpd_lines",
			entityId: existing.id,
			action: "update_rpd",
			beforeJson: existing,
			afterJson: updated,
			orgId,
			requestId: meta.requestId ?? null,
		});
		return updated;
	}
	const [created] = await db
		.insert(rpdLines)
		.values({
			fiscalYearId: data.fiscalYearId,
			month: data.month,
			accountCode: data.accountCode,
			amount: data.amount,
			createdBy: meta.actorId,
		})
		.returning();
	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "rpd_lines",
		entityId: created.id,
		action: "create_rpd",
		beforeJson: null,
		afterJson: created,
		orgId,
		requestId: meta.requestId ?? null,
	});
	return created;
}

export async function upsertRealization(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	input: unknown,
	meta: { actorId: string; requestId?: string | null },
) {
	const data = upsertRealizationSchema.parse(input);
	await assertFy(db, access, orgId, data.fiscalYearId);
	const [existing] = await db
		.select()
		.from(realizations)
		.where(
			and(
				eq(realizations.fiscalYearId, data.fiscalYearId),
				eq(realizations.month, data.month),
				eq(realizations.accountCode, data.accountCode),
				isNull(realizations.deletedAt),
			),
		)
		.limit(1);
	if (existing) {
		const [updated] = await db
			.update(realizations)
			.set({ amount: data.amount, updatedAt: new Date() })
			.where(eq(realizations.id, existing.id))
			.returning();
		await writeAudit(db, {
			actorId: meta.actorId,
			actorAccessType: "operator_satker",
			entityType: "realizations",
			entityId: existing.id,
			action: "update_realization",
			beforeJson: existing,
			afterJson: updated,
			orgId,
			requestId: meta.requestId ?? null,
		});
		return updated;
	}
	const [created] = await db
		.insert(realizations)
		.values({
			fiscalYearId: data.fiscalYearId,
			month: data.month,
			accountCode: data.accountCode,
			amount: data.amount,
			createdBy: meta.actorId,
		})
		.returning();
	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "realizations",
		entityId: created.id,
		action: "create_realization",
		beforeJson: null,
		afterJson: created,
		orgId,
		requestId: meta.requestId ?? null,
	});
	return created;
}

export async function batchUpsertRpdOrRealization(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	input: unknown,
	meta: { actorId: string; requestId?: string | null },
) {
	const data = batchUpsertSchema.parse(input);
	const results: unknown[] = [];
	for (const row of data.rows) {
		const payload = { ...row, fiscalYearId: data.fiscalYearId };
		const res =
			data.target === "rpd"
				? await upsertRpdLine(db, access, orgId, payload, meta)
				: await upsertRealization(db, access, orgId, payload, meta);
		results.push(res);
	}
	return results;
}

export async function softDeleteRpd(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	id: string,
	meta: { actorId: string; requestId?: string | null },
) {
	const [row] = await db
		.select()
		.from(rpdLines)
		.where(eq(rpdLines.id, id))
		.limit(1);
	if (!row) throw new Error("RPD tidak ditemukan");
	await assertFy(db, access, orgId, row.fiscalYearId);
	const [updated] = await db
		.update(rpdLines)
		.set({ deletedAt: new Date() })
		.where(eq(rpdLines.id, id))
		.returning();
	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "rpd_lines",
		entityId: id,
		action: "delete_rpd",
		beforeJson: row,
		afterJson: updated,
		orgId,
		requestId: meta.requestId ?? null,
	});
	return updated;
}

export async function softDeleteRealization(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	id: string,
	meta: { actorId: string; requestId?: string | null },
) {
	const [row] = await db
		.select()
		.from(realizations)
		.where(eq(realizations.id, id))
		.limit(1);
	if (!row) throw new Error("Realisasi tidak ditemukan");
	await assertFy(db, access, orgId, row.fiscalYearId);
	const [updated] = await db
		.update(realizations)
		.set({ deletedAt: new Date() })
		.where(eq(realizations.id, id))
		.returning();
	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "realizations",
		entityId: id,
		action: "delete_realization",
		beforeJson: row,
		afterJson: updated,
		orgId,
		requestId: meta.requestId ?? null,
	});
	return updated;
}

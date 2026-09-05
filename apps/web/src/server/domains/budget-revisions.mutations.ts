import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";
import type { AccessResolution } from "@simulator-ikpa/contracts";
import type { DbClient } from "@simulator-ikpa/db";
import { budgets, dipaRevisions, fiscalYears } from "@simulator-ikpa/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "../audit/write-audit";

const decimal18_2 = z
	.string()
	.regex(/^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/, "Decimal 18,2 invalid");

const upsertBudgetSchema = z.strictObject({
	fiscalYearId: z.string().uuid(),
	accountCode: z.enum(["51", "52", "53", "57"]),
	amount: decimal18_2,
	effectiveAt: z.iso.date(),
});

const createRevisionSchema = z.strictObject({
	fiscalYearId: z.string().uuid(),
	revisionDate: z.iso.date(),
	revisionCode: z.string().min(1).max(32),
	paguBefore: decimal18_2,
	paguAfter: decimal18_2,
	notes: z.string().max(500).optional(),
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
	if (!fy || fy.orgId !== orgId)
		throw new Error("Fiscal year tidak valid untuk satker ini.");
	return fy;
}

export async function upsertBudget(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	input: unknown,
	meta: { actorId: string; requestId?: string | null },
) {
	const data = upsertBudgetSchema.parse(input);
	await assertFy(db, access, orgId, data.fiscalYearId);

	const [existing] = await db
		.select()
		.from(budgets)
		.where(
			and(
				eq(budgets.fiscalYearId, data.fiscalYearId),
				eq(budgets.accountCode, data.accountCode),
				isNull(budgets.deletedAt),
			),
		)
		.limit(1);

	if (existing) {
		const [updated] = await db
			.update(budgets)
			.set({
				amount: data.amount,
				effectiveAt: data.effectiveAt,
				updatedAt: new Date(),
			})
			.where(eq(budgets.id, existing.id))
			.returning();
		await writeAudit(db, {
			actorId: meta.actorId,
			actorAccessType: "operator_satker",
			entityType: "budgets",
			entityId: existing.id,
			action: "update_budget",
			beforeJson: existing,
			afterJson: updated,
			orgId,
			requestId: meta.requestId ?? null,
		});
		return updated;
	}
	const [created] = await db
		.insert(budgets)
		.values({
			fiscalYearId: data.fiscalYearId,
			accountCode: data.accountCode,
			amount: data.amount,
			effectiveAt: data.effectiveAt,
			createdBy: meta.actorId,
		})
		.returning();
	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "budgets",
		entityId: created.id,
		action: "create_budget",
		beforeJson: null,
		afterJson: created,
		orgId,
		requestId: meta.requestId ?? null,
	});
	return created;
}

export async function softDeleteBudget(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	budgetId: string,
	meta: { actorId: string; requestId?: string | null },
) {
	const [row] = await db
		.select()
		.from(budgets)
		.where(eq(budgets.id, budgetId))
		.limit(1);
	if (!row) throw new Error("Pagu tidak ditemukan.");
	await assertFy(db, access, orgId, row.fiscalYearId);
	const [updated] = await db
		.update(budgets)
		.set({ deletedAt: new Date() })
		.where(eq(budgets.id, budgetId))
		.returning();
	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "budgets",
		entityId: budgetId,
		action: "delete_budget",
		beforeJson: row,
		afterJson: updated,
		orgId,
		requestId: meta.requestId ?? null,
	});
	return updated;
}

export async function createRevision(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	input: unknown,
	meta: { actorId: string; requestId?: string | null },
) {
	const data = createRevisionSchema.parse(input);
	await assertFy(db, access, orgId, data.fiscalYearId);
	const [created] = await db
		.insert(dipaRevisions)
		.values({
			fiscalYearId: data.fiscalYearId,
			revisionDate: data.revisionDate,
			revisionCode: data.revisionCode,
			paguBefore: data.paguBefore,
			paguAfter: data.paguAfter,
			notes: data.notes ?? null,
			createdBy: meta.actorId,
		})
		.returning();
	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "dipa_revisions",
		entityId: created.id,
		action: "create_revision",
		beforeJson: null,
		afterJson: created,
		orgId,
		requestId: meta.requestId ?? null,
	});
	return created;
}

export async function updateRevision(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	revisionId: string,
	input: unknown,
	meta: { actorId: string; requestId?: string | null },
) {
	const data = createRevisionSchema.parse(input);
	const [row] = await db
		.select()
		.from(dipaRevisions)
		.where(eq(dipaRevisions.id, revisionId))
		.limit(1);
	if (!row || row.deletedAt) throw new Error("Revisi tidak ditemukan.");
	await assertFy(db, access, orgId, row.fiscalYearId);
	const [updated] = await db
		.update(dipaRevisions)
		.set({
			revisionDate: data.revisionDate,
			revisionCode: data.revisionCode,
			paguBefore: data.paguBefore,
			paguAfter: data.paguAfter,
			notes: data.notes ?? null,
			updatedAt: new Date(),
		})
		.where(eq(dipaRevisions.id, revisionId))
		.returning();
	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "dipa_revisions",
		entityId: revisionId,
		action: "update_revision",
		beforeJson: row,
		afterJson: updated,
		orgId,
		requestId: meta.requestId ?? null,
	});
	return updated;
}

export async function softDeleteRevision(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	revisionId: string,
	meta: { actorId: string; requestId?: string | null },
) {
	const [row] = await db
		.select()
		.from(dipaRevisions)
		.where(eq(dipaRevisions.id, revisionId))
		.limit(1);
	if (!row) throw new Error("Revisi tidak ditemukan.");
	await assertFy(db, access, orgId, row.fiscalYearId);
	const [updated] = await db
		.update(dipaRevisions)
		.set({ deletedAt: new Date() })
		.where(eq(dipaRevisions.id, revisionId))
		.returning();
	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "dipa_revisions",
		entityId: revisionId,
		action: "delete_revision",
		beforeJson: row,
		afterJson: updated,
		orgId,
		requestId: meta.requestId ?? null,
	});
	return updated;
}

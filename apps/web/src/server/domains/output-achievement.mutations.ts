import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";
import type { AccessResolution } from "@simulator-ikpa/contracts";
import type { DbClient } from "@simulator-ikpa/db";
import { fiscalYears, outputReports } from "@simulator-ikpa/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "../audit/write-audit";

const dec4 = z
	.string()
	.regex(/^-?(?:0|[1-9]\d*)(?:\.\d{1,4})?$/, "Decimal 18,4 invalid");
const dec84 = z
	.string()
	.regex(/^-?(?:0|[1-9]\d*)(?:\.\d{1,4})?$/, "Decimal 8,4 invalid");

const outputSchema = z.strictObject({
	fiscalYearId: z.string().uuid(),
	roCode: z.string().min(1).max(32),
	month: z.number().int().min(1).max(12),
	rvro: dec4,
	volumeDipa: dec4,
	pcro: dec84,
	tpcro: dec84,
	reportedAt: z.iso.datetime({ offset: true }).nullable().optional(),
	confirmed: z.boolean().optional(),
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

export async function upsertOutput(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	input: unknown,
	meta: { actorId: string; requestId?: string | null },
) {
	const data = outputSchema.parse(input);
	await assertFy(db, access, orgId, data.fiscalYearId);

	// Range checks: RVRO 0..volume, PCRO 0..100, TPCRO 0..100
	const rv = parseFloat(data.rvro);
	const vol = parseFloat(data.volumeDipa);
	if (rv < 0 || rv > vol) throw new Error("RVRO harus 0..volume DIPA.");
	if (parseFloat(data.pcro) < 0 || parseFloat(data.pcro) > 100)
		throw new Error("PCRO harus 0..100.");
	if (parseFloat(data.tpcro) < 0 || parseFloat(data.tpcro) > 100)
		throw new Error("TPCRO harus 0..100.");

	const [existing] = await db
		.select()
		.from(outputReports)
		.where(
			and(
				eq(outputReports.fiscalYearId, data.fiscalYearId),
				eq(outputReports.roCode, data.roCode),
				eq(outputReports.month, data.month),
				isNull(outputReports.deletedAt),
			),
		)
		.limit(1);

	const reportedAtDate = data.reportedAt
		? new Date(data.reportedAt)
		: undefined;
	if (existing) {
		const [updated] = await db
			.update(outputReports)
			.set({
				rvro: data.rvro,
				volumeDipa: data.volumeDipa,
				pcro: data.pcro,
				tpcro: data.tpcro,
				...(reportedAtDate !== undefined ? { reportedAt: reportedAtDate } : {}),
				confirmed: data.confirmed ?? existing.confirmed,
				updatedAt: new Date(),
			})
			.where(eq(outputReports.id, existing.id))
			.returning();
		await writeAudit(db, {
			actorId: meta.actorId,
			actorAccessType: "operator_satker",
			entityType: "output_reports",
			entityId: existing.id,
			action: "update_output",
			beforeJson: existing,
			afterJson: updated,
			orgId,
			requestId: meta.requestId ?? null,
		});
		return updated;
	}
	const [created] = await db
		.insert(outputReports)
		.values({
			fiscalYearId: data.fiscalYearId,
			roCode: data.roCode,
			month: data.month,
			rvro: data.rvro,
			volumeDipa: data.volumeDipa,
			pcro: data.pcro,
			tpcro: data.tpcro,
			reportedAt: reportedAtDate ?? null,
			confirmed: data.confirmed ?? false,
			createdBy: meta.actorId,
		})
		.returning();
	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "output_reports",
		entityId: created.id,
		action: "create_output",
		beforeJson: null,
		afterJson: created,
		orgId,
		requestId: meta.requestId ?? null,
	});
	return created;
}

export async function confirmOutput(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	outputId: string,
	meta: { actorId: string; requestId?: string | null },
) {
	const [row] = await db
		.select()
		.from(outputReports)
		.where(eq(outputReports.id, outputId))
		.limit(1);
	if (!row) throw new Error("Output tidak ditemukan.");
	await assertFy(db, access, orgId, row.fiscalYearId);
	const [updated] = await db
		.update(outputReports)
		.set({ confirmed: true, updatedAt: new Date() })
		.where(eq(outputReports.id, outputId))
		.returning();
	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "output_reports",
		entityId: outputId,
		action: "confirm_output",
		beforeJson: row,
		afterJson: updated,
		orgId,
		requestId: meta.requestId ?? null,
	});
	return updated;
}

export async function softDeleteOutput(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	outputId: string,
	meta: { actorId: string; requestId?: string | null },
) {
	const [row] = await db
		.select()
		.from(outputReports)
		.where(eq(outputReports.id, outputId))
		.limit(1);
	if (!row) throw new Error("Output tidak ditemukan.");
	await assertFy(db, access, orgId, row.fiscalYearId);
	const [updated] = await db
		.update(outputReports)
		.set({ deletedAt: new Date() })
		.where(eq(outputReports.id, outputId))
		.returning();
	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "output_reports",
		entityId: outputId,
		action: "delete_output",
		beforeJson: row,
		afterJson: updated,
		orgId,
		requestId: meta.requestId ?? null,
	});
	return updated;
}

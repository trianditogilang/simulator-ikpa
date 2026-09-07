import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";
import type { AccessResolution } from "@simulator-ikpa/contracts";
import type { DbClient } from "@simulator-ikpa/db";
import { fiscalYears, spmQ4 } from "@simulator-ikpa/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "../audit/write-audit";

const spmQ4Schema = z.strictObject({
	fiscalYearId: z.string().uuid(),
	referenceNumber: z.string().trim().min(1).max(64),
	issuedAt: z.iso.date(),
	isDispensasi: z.boolean().optional(),
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

function parseIsoDateWib(dateStr: string): { year: number; month: number; day: number } | null {
	const parts = String(dateStr ?? "").trim().split("-");
	if (parts.length !== 3) return null;
	const year = Number(parts[0]);
	const month = Number(parts[1]);
	const day = Number(parts[2]);
	if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
		return null;
	}
	return { year, month, day };
}

function validateQ4Date(dateStr: string, fyYear: number) {
	const parsed = parseIsoDateWib(dateStr);
	if (!parsed || parsed.year !== fyYear || parsed.month < 10 || parsed.month > 12) {
		throw new Error(
			`Tanggal harus pada Oktober–Desember ${fyYear}. Penyebut rasio hanya SPM Triwulan IV.`,
		);
	}
}

export async function createSpmQ4(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	input: unknown,
	meta: { actorId: string; requestId?: string | null },
) {
	const data = spmQ4Schema.parse(input);
	const fy = await assertFy(db, access, orgId, data.fiscalYearId);

	validateQ4Date(data.issuedAt, fy.year);

	// Enforce uniqueness per fiscal year (excluding soft-deleted)
	const cleanRef = data.referenceNumber.trim();
	const [existingRef] = await db
		.select()
		.from(spmQ4)
		.where(
			and(
				eq(spmQ4.fiscalYearId, data.fiscalYearId),
				eq(spmQ4.referenceNumber, cleanRef),
				isNull(spmQ4.deletedAt),
			),
		)
		.limit(1);

	if (existingRef) {
		throw new Error("Nomor SPM sudah tercatat di Triwulan IV tahun ini.");
	}

	const [created] = await db
		.insert(spmQ4)
		.values({
			fiscalYearId: data.fiscalYearId,
			referenceNumber: cleanRef,
			issuedAt: data.issuedAt,
			isDispensasi: data.isDispensasi ?? false,
			createdBy: meta.actorId,
		})
		.returning();

	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "spm_q4",
		entityId: created.id,
		action: "create_spm_q4",
		beforeJson: null,
		afterJson: created,
		orgId,
		requestId: meta.requestId ?? null,
	});

	return created;
}

export async function updateSpmQ4(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	spmId: string,
	input: unknown,
	meta: { actorId: string; requestId?: string | null },
) {
	const data = spmQ4Schema.partial().parse(input);
	const [existing] = await db
		.select()
		.from(spmQ4)
		.where(eq(spmQ4.id, spmId))
		.limit(1);
	if (!existing) throw new Error("SPM Q4 tidak ditemukan.");

	const fy = await assertFy(db, access, orgId, existing.fiscalYearId);

	if (data.issuedAt) {
		validateQ4Date(data.issuedAt, fy.year);
	}

	if (data.referenceNumber) {
		const cleanRef = data.referenceNumber.trim();
		const [duplicate] = await db
			.select()
			.from(spmQ4)
			.where(
				and(
					eq(spmQ4.fiscalYearId, existing.fiscalYearId),
					eq(spmQ4.referenceNumber, cleanRef),
					isNull(spmQ4.deletedAt),
				),
			)
			.limit(1);

		if (duplicate && duplicate.id !== spmId) {
			throw new Error("Nomor SPM sudah tercatat di Triwulan IV tahun ini.");
		}
		data.referenceNumber = cleanRef;
	}

	const [updated] = await db
		.update(spmQ4)
		.set({ ...data, updatedAt: new Date() })
		.where(eq(spmQ4.id, spmId))
		.returning();

	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "spm_q4",
		entityId: spmId,
		action: "update_spm_q4",
		beforeJson: existing,
		afterJson: updated,
		orgId,
		requestId: meta.requestId ?? null,
	});

	return updated;
}

export async function softDeleteSpmQ4(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	spmId: string,
	meta: { actorId: string; requestId?: string | null },
) {
	const [row] = await db
		.select()
		.from(spmQ4)
		.where(eq(spmQ4.id, spmId))
		.limit(1);
	if (!row) throw new Error("SPM Q4 tidak ditemukan.");

	await assertFy(db, access, orgId, row.fiscalYearId);

	const [updated] = await db
		.update(spmQ4)
		.set({ deletedAt: new Date() })
		.where(eq(spmQ4.id, spmId))
		.returning();

	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "spm_q4",
		entityId: spmId,
		action: "delete_spm_q4",
		beforeJson: row,
		afterJson: updated,
		orgId,
		requestId: meta.requestId ?? null,
	});

	return updated;
}

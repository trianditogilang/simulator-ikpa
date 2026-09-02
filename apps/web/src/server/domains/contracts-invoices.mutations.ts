import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";
import type { AccessResolution } from "@simulator-ikpa/contracts";
import type { DbClient } from "@simulator-ikpa/db";
import { contracts, fiscalYears, spmLs } from "@simulator-ikpa/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "../audit/write-audit";

const dec182 = z
	.string()
	.regex(/^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/, "Decimal invalid");

const createContractSchema = z.strictObject({
	fiscalYearId: z.string().uuid(),
	contractNumber: z.string().min(1).max(64),
	accountCode: z.enum(["51", "52", "53"]),
	value: dec182,
	signedAt: z.iso.date(),
	paymentType: z.enum(["sekaligus", "termin"]),
	sp2dAt: z.iso.date().nullable().optional(),
});

const createSpmSchema = z.strictObject({
	fiscalYearId: z.string().uuid(),
	contractId: z.string().uuid(),
	referenceNumber: z.string().min(1).max(64),
	bastBappDate: z.iso.date(),
	receivedAtKppn: z.iso.date(),
	isPegawai: z.boolean().optional(),
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

export async function createContract(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	input: unknown,
	meta: { actorId: string; requestId?: string | null },
) {
	const data = createContractSchema.parse(input);
	await assertFy(db, access, orgId, data.fiscalYearId);
	// eligibility: account 53 only contractual eligible? we allow but store as is (engine handles)
	const [created] = await db
		.insert(contracts)
		.values({
			fiscalYearId: data.fiscalYearId,
			contractNumber: data.contractNumber,
			accountCode: data.accountCode,
			value: data.value,
			signedAt: data.signedAt,
			paymentType: data.paymentType,
			sp2dAt: data.sp2dAt ?? null,
			createdBy: meta.actorId,
		})
		.returning();
	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "contracts",
		entityId: created.id,
		action: "create_contract",
		beforeJson: null,
		afterJson: created,
		orgId,
		requestId: meta.requestId ?? null,
	});
	return created;
}

export async function updateContract(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	contractId: string,
	input: unknown,
	meta: { actorId: string; requestId?: string | null },
) {
	const data = createContractSchema.partial().parse(input);
	const [existing] = await db
		.select()
		.from(contracts)
		.where(eq(contracts.id, contractId))
		.limit(1);
	if (!existing) throw new Error("Kontrak tidak ditemukan.");
	await assertFy(db, access, orgId, existing.fiscalYearId);
	const [updated] = await db
		.update(contracts)
		.set({ ...data, updatedAt: new Date() })
		.where(eq(contracts.id, contractId))
		.returning();
	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "contracts",
		entityId: contractId,
		action: "update_contract",
		beforeJson: existing,
		afterJson: updated,
		orgId,
		requestId: meta.requestId ?? null,
	});
	return updated;
}

export async function softDeleteContract(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	contractId: string,
	meta: { actorId: string; requestId?: string | null },
) {
	const [row] = await db
		.select()
		.from(contracts)
		.where(eq(contracts.id, contractId))
		.limit(1);
	if (!row) throw new Error("Kontrak tidak ditemukan.");
	await assertFy(db, access, orgId, row.fiscalYearId);
	const [updated] = await db
		.update(contracts)
		.set({ deletedAt: new Date() })
		.where(eq(contracts.id, contractId))
		.returning();
	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "contracts",
		entityId: contractId,
		action: "delete_contract",
		beforeJson: row,
		afterJson: updated,
		orgId,
		requestId: meta.requestId ?? null,
	});
	return updated;
}

export async function createSpmLs(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	input: unknown,
	meta: { actorId: string; requestId?: string | null },
) {
	const data = createSpmSchema.parse(input);
	await assertFy(db, access, orgId, data.fiscalYearId);
	// same-fiscal-year relation guard
	const [contract] = await db
		.select()
		.from(contracts)
		.where(eq(contracts.id, data.contractId))
		.limit(1);
	if (!contract) throw new Error("Kontrak terkait tidak ditemukan.");
	if (contract.fiscalYearId !== data.fiscalYearId)
		throw new Error("Kontrak dan SPM harus dalam tahun anggaran yang sama.");
	if (contract.deletedAt) throw new Error("Kontrak sudah dihapus.");
	// H+17 not validated here, just stored; projection available via queries helper
	const [created] = await db
		.insert(spmLs)
		.values({
			fiscalYearId: data.fiscalYearId,
			contractId: data.contractId,
			referenceNumber: data.referenceNumber,
			bastBappDate: data.bastBappDate,
			receivedAtKppn: data.receivedAtKppn,
			isPegawai: data.isPegawai ?? false,
			createdBy: meta.actorId,
		})
		.returning();
	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "spm_ls",
		entityId: created.id,
		action: "create_spm_ls",
		beforeJson: null,
		afterJson: created,
		orgId,
		requestId: meta.requestId ?? null,
	});
	return created;
}

export async function softDeleteSpmLs(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	spmId: string,
	meta: { actorId: string; requestId?: string | null },
) {
	const [row] = await db
		.select()
		.from(spmLs)
		.where(eq(spmLs.id, spmId))
		.limit(1);
	if (!row) throw new Error("SPM LS tidak ditemukan.");
	await assertFy(db, access, orgId, row.fiscalYearId);
	const [updated] = await db
		.update(spmLs)
		.set({ deletedAt: new Date() })
		.where(eq(spmLs.id, spmId))
		.returning();
	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "spm_ls",
		entityId: spmId,
		action: "delete_spm_ls",
		beforeJson: row,
		afterJson: updated,
		orgId,
		requestId: meta.requestId ?? null,
	});
	return updated;
}

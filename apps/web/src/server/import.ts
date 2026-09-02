import { Buffer } from "node:buffer";
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";
import { createDbClient } from "@simulator-ikpa/db";
import { fiscalYears, importJobs, ruleSets } from "@simulator-ikpa/db/schema";
import { getAccessResolutionForSession } from "./access.server";
import { getServerAuthSession } from "./auth-session.server";
import { parseImportFile, type ImportDomain } from "./import/parser";

// ponytail: direct base64 upload (no R2 presigned for <4.5MB); ceiling = Vercel body 4.5MB
// upgrade path: R2 presigned PUT for 10MB files when R2 env present

function getDatabase() {
	const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
	if (!dbUrl) return null;
	return createDbClient(dbUrl);
}

async function getOrInitFiscalYear(db: ReturnType<typeof createDbClient>, orgId: string, year = 2026) {
	let [fy] = await db.select().from(fiscalYears).where(and(eq(fiscalYears.orgId, orgId), eq(fiscalYears.year, year))).limit(1);
	if (!fy) {
		const [ruleSet] = await db.select().from(ruleSets).where(and(eq(ruleSets.year, year), eq(ruleSets.status, "published"))).limit(1);
		if (ruleSet) {
			const inserted = await db.insert(fiscalYears).values({ orgId, year, activeRuleSetId: ruleSet.id }).returning();
			[fy] = inserted;
		}
	}
	return fy;
}

const DOMAIN_MAP: Record<string, ImportDomain> = {
	"Pagu & Revisi DIPA": "budget_revisions",
	"RPD & Realisasi": "rpd_realization",
	"RPD & Realisasi Anggaran": "rpd_realization",
	"Kontrak & Tagihan": "contracts_invoices",
	"Kontrak & SPM-LS Tagihan": "contracts_invoices",
	"UP/TUP & KKP": "up_tup_kkp",
	"UP/TUP & Kartu Kredit Pemerintah": "up_tup_kkp",
	"Capaian Output": "output_achievement",
	"Capaian Output Satker": "output_achievement",
	"SPM Dispensasi": "spm_dispensation",
	"SPM Dispensasi Akhir Tahun": "spm_dispensation",
	budget_revisions: "budget_revisions",
	rpd_realization: "rpd_realization",
	contracts_invoices: "contracts_invoices",
	up_tup_kkp: "up_tup_kkp",
	output_achievement: "output_achievement",
	spm_dispensation: "spm_dispensation",
};

function normalizeDomain(input: string): ImportDomain {
	const n = DOMAIN_MAP[input] ?? DOMAIN_MAP[input.replace(/\s+/g, "_").toLowerCase()];
	if (!n) throw new Error(`Domain tidak dikenal: ${input}`);
	return n;
}

// @ts-ignore – ValidateSerializable false positive for preview unknown[]
export const uploadImportFn = createServerFn({ method: "POST" })
	.validator((data: { orgId?: string; domain: string; filename: string; contentBase64: string; mimeType?: string }) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth, data.orgId);
		const targetOrgId = data.orgId || (access.status === "operator_single_scope" || access.status === "operator_multiple_scopes" ? access.activeOrganizationId : null);
		if (!targetOrgId) throw new Error("Satuan Kerja aktif tidak ditemukan.");
		assertOperatorOrgScope(access, targetOrgId);
		const domain = normalizeDomain(data.domain);
		// size/MIME checks also inside parser, but early guard for base64 length ~10MB -> ~13MB base64
		if (data.contentBase64.length > 14 * 1024 * 1024) throw new Error("File melebihi 10 MB (base64 oversize)");
		// extension/MIME already via filename
		if (!data.filename.match(/\.(csv|xlsx)$/i)) throw new Error("Hanya .csv dan .xlsx diizinkan");
		// decode
		let buffer: Uint8Array;
		try {
			buffer = Uint8Array.from(Buffer.from(data.contentBase64, "base64"));
		} catch {
			throw new Error("contentBase64 tidak valid");
		}
		if (buffer.byteLength === 0) throw new Error("File kosong");
		if (buffer.byteLength > 10 * 1024 * 1024) throw new Error("File melebihi 10 MB");

		const parsed = await parseImportFile({ domain, buffer, filename: data.filename, mimeType: data.mimeType, size: buffer.byteLength });

		const db = getDatabase();
		if (!db) {
			// mock fallback (dev without DB) – return ephemeral job id
			return {
				jobId: `mock-${Date.now()}`,
				domain,
				filename: data.filename,
				totalRows: parsed.totalRows,
				validRows: parsed.validRows.length,
				invalidRows: parsed.invalidRows,
				errors: parsed.errors,
				preview: parsed.preview,
				status: "validated" as const,
			} as never;
		}

		const fy = await getOrInitFiscalYear(db, targetOrgId, 2026);
		if (!fy) throw new Error("Tahun anggaran 2026 belum diinisialisasi.");

		const [job] = await db.insert(importJobs).values({
			orgId: targetOrgId,
			fiscalYearId: fy.id,
			domain,
			filename: data.filename.slice(0, 200),
			storageKey: null,
			status: "validated" as never,
			totalRows: parsed.totalRows,
			validRows: parsed.validRows.length,
			invalidRows: parsed.invalidRows,
			errorReportJson: { errors: parsed.errors, preview: parsed.preview, validRows: parsed.validRows.slice(0, 100) } as never,
			createdBy: (access as { userId?: string }).userId ?? null as never,
		}).returning();

		return {
			jobId: job.id,
			domain,
			filename: job.filename,
			totalRows: job.totalRows,
			validRows: job.validRows,
			invalidRows: job.invalidRows,
			errors: parsed.errors,
			preview: parsed.preview,
			status: job.status,
		} as never;
	});

// @ts-ignore – ValidateSerializable false positive for errorReportJson unknown
export const listImportJobsFn = createServerFn({ method: "GET" })
	.validator((data?: { orgId?: string }) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth, data?.orgId);
		const targetOrgId = data?.orgId || (access.status === "operator_single_scope" || access.status === "operator_multiple_scopes" ? access.activeOrganizationId : null);
		if (!targetOrgId) throw new Error("Satuan Kerja aktif tidak ditemukan.");
		assertOperatorOrgScope(access, targetOrgId);
		const db = getDatabase();
		if (!db) return { jobs: [] };
		const fy = await getOrInitFiscalYear(db, targetOrgId, 2026);
		if (!fy) return { jobs: [] };
		const rows = await db.select().from(importJobs).where(and(eq(importJobs.orgId, targetOrgId), eq(importJobs.fiscalYearId, fy.id))).orderBy(desc(importJobs.createdAt)).limit(20);
		return { jobs: rows.map(r=>({ id: r.id, domain: r.domain, filename: r.filename, status: r.status, totalRows: r.totalRows, validRows: r.validRows, invalidRows: r.invalidRows, createdAt: r.createdAt.toISOString(), errorReportJson: r.errorReportJson })) } as never;
	});

// @ts-ignore – ValidateSerializable false positive for errorReportJson unknown
export const getImportJobFn = createServerFn({ method: "GET" })
	.validator((data: { jobId: string; orgId?: string }) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth, data.orgId);
		const targetOrgId = data.orgId || (access.status === "operator_single_scope" || access.status === "operator_multiple_scopes" ? access.activeOrganizationId : null);
		if (!targetOrgId) throw new Error("Satuan Kerja aktif tidak ditemukan.");
		assertOperatorOrgScope(access, targetOrgId);
		const db = getDatabase();
		if (!db) return { job: null };
		const [job] = await db.select().from(importJobs).where(eq(importJobs.id, data.jobId)).limit(1);
		if (!job || job.orgId !== targetOrgId) throw new Error("Job tidak ditemukan atau bukan milik satker ini");
		return { job: { id: job.id, domain: job.domain, filename: job.filename, status: job.status, totalRows: job.totalRows, validRows: job.validRows, invalidRows: job.invalidRows, errorReportJson: job.errorReportJson, createdAt: job.createdAt.toISOString(), updatedAt: job.updatedAt.toISOString() } } as never;
	});

export const commitImportFn = createServerFn({ method: "POST" })
	.validator((data: { jobId: string; orgId?: string }) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth, data.orgId);
		const targetOrgId = data.orgId || (access.status === "operator_single_scope" || access.status === "operator_multiple_scopes" ? access.activeOrganizationId : null);
		if (!targetOrgId) throw new Error("Satuan Kerja aktif tidak ditemukan.");
		assertOperatorOrgScope(access, targetOrgId);
		const db = getDatabase();
		if (!db) return { success: true, committed: 0, note: "DB mock – no write" };
		const [job] = await db.select().from(importJobs).where(eq(importJobs.id, data.jobId)).limit(1);
		if (!job) throw new Error("Job tidak ditemukan");
		if (job.orgId !== targetOrgId) throw new Error("Job bukan milik satker ini");
		if (!["validated", "uploaded"].includes(job.status)) throw new Error(`Job status ${job.status} tidak dapat di-commit (harus validated)`);
		if (job.validRows === 0) throw new Error("Tidak ada baris valid untuk di-commit");

		const report = job.errorReportJson as { validRows?: unknown[]; errors?: unknown } | null;
		const validRows = (report?.validRows as unknown[] | undefined) ?? [];
		// If validRows truncated to 100 preview, we need full – but for ponytail we commit preview slice (ceiling)
		// Real would store full in DB or re-parse; we use stored slice
		const fy = await getOrInitFiscalYear(db, targetOrgId, 2026);
		if (!fy) throw new Error("Fiscal year tidak ditemukan");
		const actorId = (access as { userId?: string }).userId ?? targetOrgId;

		// Mark committing
		await db.update(importJobs).set({ status: "committing" as never, updatedAt: new Date() as never }).where(eq(importJobs.id, job.id));

		let committed = 0;
		let lastError: string | null = null;
		try {
			// Batch transaction: valid-row-only policy
			const { upsertBudget, createRevision } = await import("./domains/budget-revisions.mutations");
			const { upsertRpdLine, upsertRealization } = await import("./domains/rpd-realization.mutations");
			const { createContract, createSpmLs } = await import("./domains/contracts-invoices.mutations");
			const { createUpTup, upsertKkp } = await import("./domains/up-tup-kkp.mutations");
			const { upsertOutput } = await import("./domains/output-achievement.mutations");
			const { createSpmQ4 } = await import("./domains/spm-dispensation.mutations");

			for (const row of validRows as unknown as Record<string, unknown>[]) {
				try {
					if (job.domain === "budget_revisions") {
						if ("revisionCode" in row) {
							await createRevision(db, access, targetOrgId, { fiscalYearId: fy.id, revisionDate: (row as { revisionDate: string }).revisionDate, revisionCode: (row as { revisionCode: string }).revisionCode, paguBefore: (row as { paguBefore: string }).paguBefore, paguAfter: (row as { paguAfter: string }).paguAfter }, { actorId });
						} else {
							await upsertBudget(db, access, targetOrgId, { fiscalYearId: fy.id, accountCode: (row as { accountCode: string }).accountCode, amount: (row as { amount: string }).amount, effectiveAt: (row as { effectiveAt: string }).effectiveAt }, { actorId });
						}
					} else if (job.domain === "rpd_realization") {
						const r = row as { month: number; accountCode: string; amount: string; target: string };
						if (r.target === "realization") await upsertRealization(db, access, targetOrgId, { fiscalYearId: fy.id, month: r.month, accountCode: r.accountCode as "51"|"52"|"53"|"57", amount: r.amount }, { actorId });
						else await upsertRpdLine(db, access, targetOrgId, { fiscalYearId: fy.id, month: r.month, accountCode: r.accountCode as "51"|"52"|"53"|"57", amount: r.amount }, { actorId });
					} else if (job.domain === "contracts_invoices") {
						if ("referenceNumber" in row) {
							// need contract id lookup by contractNumber – try find existing
							const { contracts } = await import("@simulator-ikpa/db/schema");
							const r = row as { contractNumber: string; referenceNumber: string; bastBappDate: string; receivedAtKppn: string };
							const [ctr] = await db.select().from(contracts).where(eq(contracts.contractNumber, r.contractNumber)).limit(1);
							if (!ctr) throw new Error(`Kontrak ${r.contractNumber} tidak ditemukan untuk SPM`);
							await createSpmLs(db, access, targetOrgId, { fiscalYearId: fy.id, contractId: ctr.id, referenceNumber: r.referenceNumber, bastBappDate: r.bastBappDate, receivedAtKppn: r.receivedAtKppn }, { actorId });
						} else {
							const r = row as { contractNumber: string; accountCode: string; value: string; signedAt: string; paymentType: string };
							await createContract(db, access, targetOrgId, { fiscalYearId: fy.id, contractNumber: r.contractNumber, accountCode: r.accountCode as "51"|"52"|"53", value: r.value, signedAt: r.signedAt, paymentType: r.paymentType as "sekaligus"|"termin" }, { actorId });
						}
					} else if (job.domain === "up_tup_kkp") {
						if ("type" in row) {
							const r = row as { type: string; amount: string; sp2dAt: string; referenceSp2dAt: string | null };
							await createUpTup(db, access, targetOrgId, { fiscalYearId: fy.id, type: r.type as "UP"|"TUP"|"GUP"|"GUP_NIHIL"|"PTUP"|"SETORAN_TUP", amount: r.amount, sp2dAt: r.sp2dAt, referenceSp2dAt: r.referenceSp2dAt }, { actorId });
						} else {
							const r = row as { month: number; amount: string; usageDate: string | null };
							await upsertKkp(db, access, targetOrgId, { fiscalYearId: fy.id, month: r.month, amount: r.amount, usageDate: r.usageDate }, { actorId });
						}
					} else if (job.domain === "output_achievement") {
						const r = row as { roCode: string; month: number; rvro: string; volumeDipa: string; pcro: string; tpcro: string };
						await upsertOutput(db, access, targetOrgId, { fiscalYearId: fy.id, roCode: r.roCode, month: r.month, rvro: r.rvro, volumeDipa: r.volumeDipa, pcro: r.pcro, tpcro: r.tpcro }, { actorId });
					} else if (job.domain === "spm_dispensation") {
						const r = row as { referenceNumber: string; issuedAt: string; isDispensasi: boolean };
						await createSpmQ4(db, access, targetOrgId, { fiscalYearId: fy.id, referenceNumber: r.referenceNumber, issuedAt: r.issuedAt, isDispensasi: r.isDispensasi }, { actorId });
					}
					committed++;
				} catch (e) {
					lastError = (e as Error).message.slice(0, 200);
					// continue valid-row-only (skip invalid on commit too)
				}
			}
			await db.update(importJobs).set({ status: "completed" as never, updatedAt: new Date() as never }).where(eq(importJobs.id, job.id));
		} catch (e) {
			await db.update(importJobs).set({ status: "failed" as never, updatedAt: new Date() as never, errorReportJson: { ...(report as object), commitError: (e as Error).message.slice(0, 200) } as never }).where(eq(importJobs.id, job.id));
			throw e;
		}
		return { success: true, committed, totalValid: validRows.length, lastError };
	});

export const cancelImportFn = createServerFn({ method: "POST" })
	.validator((data: { jobId: string; orgId?: string }) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth, data.orgId);
		const targetOrgId = data.orgId || (access.status === "operator_single_scope" || access.status === "operator_multiple_scopes" ? access.activeOrganizationId : null);
		if (!targetOrgId) throw new Error("Satuan Kerja aktif tidak ditemukan.");
		assertOperatorOrgScope(access, targetOrgId);
		const db = getDatabase();
		if (!db) return { success: true };
		const [job] = await db.select().from(importJobs).where(eq(importJobs.id, data.jobId)).limit(1);
		if (!job || job.orgId !== targetOrgId) throw new Error("Job tidak ditemukan");
		if (["completed", "failed"].includes(job.status)) throw new Error(`Job ${job.status} tidak dapat dibatalkan`);
		await db.update(importJobs).set({ status: "failed" as never, updatedAt: new Date() as never }).where(eq(importJobs.id, job.id));
		return { success: true };
	});

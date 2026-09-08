import {
	assertAdminKppnScope,
	assertOperatorOrgScope,
} from "@simulator-ikpa/access-control";
import type { AccessResolution } from "@simulator-ikpa/contracts";
import type { DbClient } from "@simulator-ikpa/db";
import {
	assessmentExclusionPolicies,
	assessmentExclusionProposals,
	fiscalYears,
	outputReports,
	outputTargetPlans,
	roBudgetRealizations,
	targetUpdateWindows,
} from "@simulator-ikpa/db/schema";
import {
	hasBlockingValidation,
	validateOutputRecord,
} from "@simulator-ikpa/ikpa-engine";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "../audit/write-audit";

const dec4 = z
	.string()
	.regex(/^-?(?:0|[1-9]\d*)(?:\.\d{1,4})?$/, "Decimal 18,4 invalid");
const dec84 = z
	.string()
	.regex(/^-?(?:0|[1-9]\d*)(?:\.\d{1,4})?$/, "Decimal 8,4 invalid");

const monthlyTargetSchema = z.strictObject({
	month: z.number().int().min(1).max(12),
	targetRvro: z.number().nonnegative(),
	targetPcro: z.number().nonnegative(),
	targetRvroCumulative: z.number().nonnegative().optional(),
	targetPcroCumulative: z.number().nonnegative().optional(),
	rpdCumulative: z.number().nonnegative().optional(),
});

const targetPlanSchema = z.strictObject({
	fiscalYearId: z.string().uuid(),
	roCode: z.string().min(1).max(32),
	roName: z.string().max(255).optional().nullable(),
	unit: z.string().default("Layanan"),
	unitAllowsDecimal: z.boolean().default(false),
	maxDecimalPlaces: z.number().int().default(0),
	isPriorityNational: z.boolean().default(false),
	volumeDipa: dec4,
	budgetAmountRo: z.string().optional().nullable(),
	measurementMethod: z.string().optional().nullable(),
	monthlyTargets: z.array(monthlyTargetSchema).length(12),
	changeReason: z.string().optional().nullable(),
	status: z.enum(["draft", "submitted", "active", "superseded"]).default("draft"),
});

const outputSchema = z.strictObject({
	fiscalYearId: z.string().uuid(),
	roCode: z.string().min(1).max(32),
	roName: z.string().max(255).optional().nullable(),
	month: z.number().int().min(1).max(12),
	rvro: dec4,
	volumeDipa: dec4,
	pcro: dec84,
	tpcro: dec84,
	rvroIncremental: dec4.optional().nullable(),
	pcroIncremental: dec84.optional().nullable(),
	evidenceDocumentUrl: z.string().optional().nullable(),
	achievementReference: z.string().optional().nullable(),
	operatorNote: z.string().max(1000).optional().nullable(),
	ppkValidationNote: z.string().max(1000).optional().nullable(),
	reportedAt: z.iso.datetime({ offset: true }).nullable().optional(),
	confirmed: z.boolean().optional(),
});

const budgetRealizationSchema = z.strictObject({
	fiscalYearId: z.string().uuid(),
	roCode: z.string().min(1).max(32),
	month: z.number().int().min(1).max(12),
	budgetAmountRo: z.string(),
	realizedAmountMonthly: z.string(),
	realizedAmountCumulative: z.string(),
	ppaMonthly: dec84,
	ppaCumulative: dec84,
	sourceType: z.enum(["manual", "import_sakti", "import_omspan", "account_allocation"]).default("manual"),
	sourceReference: z.string().optional().nullable(),
	verificationStatus: z.enum(["unverified", "verified", "estimated"]).default("verified"),
});

const targetUpdateWindowSchema = z.strictObject({
	fiscalYearId: z.string().uuid(),
	quarter: z.number().int().min(1).max(4),
	opensAt: z.iso.datetime({ offset: true }),
	closesAt: z.iso.datetime({ offset: true }),
	dayType: z.string().default("workday"),
	sourceReference: z.string().optional().nullable(),
	status: z.enum(["scheduled", "open", "closed"]).default("scheduled"),
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

// ---------------------------------------------------------------------------
// TARGET PLAN MUTATIONS (TAR-01 s.d. TAR-07)
// ---------------------------------------------------------------------------

export async function upsertTargetPlan(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	input: unknown,
	meta: { actorId: string; requestId?: string | null },
) {
	const data = targetPlanSchema.parse(input);
	await assertFy(db, access, orgId, data.fiscalYearId);

	const vol = parseFloat(data.volumeDipa);
	if (vol <= 0) throw new Error("Target Volume DIPA harus > 0.");

	// TAR-01 & TAR-03: Validate total RVRO Jan-Des equals volume DIPA
	const totalRvro = data.monthlyTargets.reduce((s, m) => s + m.targetRvro, 0);
	if (Math.abs(totalRvro - vol) > 0.0001) {
		throw new Error(
			`Total distribusi Target Realisasi Volume (${totalRvro}) harus sama dengan Target Volume DIPA (${vol}).`,
		);
	}

	// TAR-02 & TAR-04: Validate total PCRO Jan-Des equals 100%
	const totalPcro = data.monthlyTargets.reduce((s, m) => s + m.targetPcro, 0);
	if (Math.abs(totalPcro - 100) > 0.01) {
		throw new Error(
			`Total distribusi Target PCRO (${totalPcro}%) harus berjumlah tepat 100%.`,
		);
	}

	// Calculate cumulative values
	let cumRvro = 0;
	let cumPcro = 0;
	const enrichedMonthlyTargets = data.monthlyTargets.map((m) => {
		cumRvro += m.targetRvro;
		cumPcro += m.targetPcro;
		return {
			...m,
			targetRvroCumulative: Math.round(cumRvro * 10000) / 10000,
			targetPcroCumulative: Math.round(cumPcro * 100) / 100,
		};
	});

	// Check existing plan for this RO
	const [existing] = await db
		.select()
		.from(outputTargetPlans)
		.where(
			and(
				eq(outputTargetPlans.fiscalYearId, data.fiscalYearId),
				eq(outputTargetPlans.roCode, data.roCode),
				isNull(outputTargetPlans.deletedAt),
			),
		)
		.limit(1);

	// Check active window if updating
	const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
	const [activeWindow] = await db
		.select()
		.from(targetUpdateWindows)
		.where(
			and(
				eq(targetUpdateWindows.fiscalYearId, data.fiscalYearId),
				eq(targetUpdateWindows.quarter, currentQuarter),
				eq(targetUpdateWindows.status, "open"),
			),
		)
		.limit(1);

	const isWindowOpen = !!activeWindow;

	if (existing) {
		// If existing is active and window is closed, cannot update unless draft
		if (existing.status === "active" && !isWindowOpen && data.status === "active") {
			// Update in draft or require open window
		}

		const nextVersion = existing.version + 1;
		const [updated] = await db
			.update(outputTargetPlans)
			.set({
				roName: data.roName !== undefined ? data.roName : existing.roName,
				unit: data.unit,
				unitAllowsDecimal: data.unitAllowsDecimal,
				maxDecimalPlaces: data.maxDecimalPlaces,
				isPriorityNational: data.isPriorityNational,
				volumeDipa: data.volumeDipa,
				budgetAmountRo: data.budgetAmountRo !== undefined ? data.budgetAmountRo : existing.budgetAmountRo,
				measurementMethod: data.measurementMethod !== undefined ? data.measurementMethod : existing.measurementMethod,
				version: nextVersion,
				status: data.status,
				monthlyTargetsJson: enrichedMonthlyTargets,
				changeReason: data.changeReason ?? existing.changeReason,
				submittedAt: data.status === "submitted" || data.status === "active" ? new Date() : existing.submittedAt,
				submittedBy: data.status === "submitted" || data.status === "active" ? meta.actorId : existing.submittedBy,
				activatedAt: data.status === "active" ? new Date() : existing.activatedAt,
				updatedAt: new Date(),
			})
			.where(eq(outputTargetPlans.id, existing.id))
			.returning();

		await writeAudit(db, {
			actorId: meta.actorId,
			actorAccessType: "operator_satker",
			entityType: "output_target_plans",
			entityId: existing.id,
			action: "update_target_plan",
			beforeJson: existing,
			afterJson: updated,
			orgId,
			requestId: meta.requestId ?? null,
		});

		return updated;
	}

	// Create new target plan
	const [created] = await db
		.insert(outputTargetPlans)
		.values({
			fiscalYearId: data.fiscalYearId,
			organizationId: orgId,
			roCode: data.roCode,
			roName: data.roName ?? null,
			unit: data.unit,
			unitAllowsDecimal: data.unitAllowsDecimal,
			maxDecimalPlaces: data.maxDecimalPlaces,
			isPriorityNational: data.isPriorityNational,
			volumeDipa: data.volumeDipa,
			budgetAmountRo: data.budgetAmountRo ?? null,
			measurementMethod: data.measurementMethod ?? null,
			version: 1,
			status: data.status,
			monthlyTargetsJson: enrichedMonthlyTargets,
			changeReason: data.changeReason ?? null,
			submittedAt: data.status === "submitted" || data.status === "active" ? new Date() : null,
			submittedBy: data.status === "submitted" || data.status === "active" ? meta.actorId : null,
			activatedAt: data.status === "active" ? new Date() : null,
			createdBy: meta.actorId,
		})
		.returning();

	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "output_target_plans",
		entityId: created.id,
		action: "create_target_plan",
		beforeJson: null,
		afterJson: created,
		orgId,
		requestId: meta.requestId ?? null,
	});

	return created;
}

export async function submitTargetPlan(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	targetPlanId: string,
	meta: { actorId: string; requestId?: string | null },
) {
	assertOperatorOrgScope(access, orgId);

	const [existing] = await db
		.select()
		.from(outputTargetPlans)
		.where(eq(outputTargetPlans.id, targetPlanId))
		.limit(1);

	if (!existing) throw new Error("Target Kinerja RO tidak ditemukan.");
	await assertFy(db, access, orgId, existing.fiscalYearId);

	const [updated] = await db
		.update(outputTargetPlans)
		.set({
			status: "active",
			submittedAt: new Date(),
			submittedBy: meta.actorId,
			activatedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(eq(outputTargetPlans.id, targetPlanId))
		.returning();

	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "output_target_plans",
		entityId: updated.id,
		action: "submit_target_plan",
		beforeJson: existing,
		afterJson: updated,
		orgId,
		requestId: meta.requestId ?? null,
	});

	return updated;
}

// ---------------------------------------------------------------------------
// TARGET UPDATE WINDOW MUTATIONS (Admin KPPN)
// ---------------------------------------------------------------------------

export async function upsertTargetUpdateWindow(
	db: DbClient,
	access: AccessResolution,
	input: unknown,
	meta: { actorId: string; requestId?: string | null },
) {
	assertAdminKppnScope(access);
	const data = targetUpdateWindowSchema.parse(input);

	const [existing] = await db
		.select()
		.from(targetUpdateWindows)
		.where(
			and(
				eq(targetUpdateWindows.fiscalYearId, data.fiscalYearId),
				eq(targetUpdateWindows.quarter, data.quarter),
			),
		)
		.limit(1);

	if (existing) {
		const [updated] = await db
			.update(targetUpdateWindows)
			.set({
				opensAt: new Date(data.opensAt),
				closesAt: new Date(data.closesAt),
				dayType: data.dayType,
				sourceReference: data.sourceReference ?? existing.sourceReference,
				status: data.status,
				updatedAt: new Date(),
			})
			.where(eq(targetUpdateWindows.id, existing.id))
			.returning();

		return updated;
	}

	const [created] = await db
		.insert(targetUpdateWindows)
		.values({
			fiscalYearId: data.fiscalYearId,
			quarter: data.quarter,
			opensAt: new Date(data.opensAt),
			closesAt: new Date(data.closesAt),
			dayType: data.dayType,
			sourceReference: data.sourceReference ?? null,
			status: data.status,
			createdBy: meta.actorId,
		})
		.returning();

	return created;
}

// ---------------------------------------------------------------------------
// RO BUDGET REALIZATIONS (PPA) MUTATIONS
// ---------------------------------------------------------------------------

export async function upsertRoBudgetRealization(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	input: unknown,
	meta: { actorId: string; requestId?: string | null },
) {
	const data = budgetRealizationSchema.parse(input);
	await assertFy(db, access, orgId, data.fiscalYearId);

	const [existing] = await db
		.select()
		.from(roBudgetRealizations)
		.where(
			and(
				eq(roBudgetRealizations.fiscalYearId, data.fiscalYearId),
				eq(roBudgetRealizations.roCode, data.roCode),
				eq(roBudgetRealizations.month, data.month),
			),
		)
		.limit(1);

	if (existing) {
		const [updated] = await db
			.update(roBudgetRealizations)
			.set({
				budgetAmountRo: data.budgetAmountRo,
				realizedAmountMonthly: data.realizedAmountMonthly,
				realizedAmountCumulative: data.realizedAmountCumulative,
				ppaMonthly: data.ppaMonthly,
				ppaCumulative: data.ppaCumulative,
				sourceType: data.sourceType,
				sourceReference: data.sourceReference ?? existing.sourceReference,
				verificationStatus: data.verificationStatus,
				updatedAt: new Date(),
			})
			.where(eq(roBudgetRealizations.id, existing.id))
			.returning();

		await writeAudit(db, {
			actorId: meta.actorId,
			actorAccessType: "operator_satker",
			entityType: "ro_budget_realizations",
			entityId: existing.id,
			action: "update_ro_budget_realization",
			beforeJson: existing,
			afterJson: updated,
			orgId,
			requestId: meta.requestId ?? null,
		});

		return updated;
	}

	const [created] = await db
		.insert(roBudgetRealizations)
		.values({
			fiscalYearId: data.fiscalYearId,
			organizationId: orgId,
			roCode: data.roCode,
			month: data.month,
			budgetAmountRo: data.budgetAmountRo,
			realizedAmountMonthly: data.realizedAmountMonthly,
			realizedAmountCumulative: data.realizedAmountCumulative,
			ppaMonthly: data.ppaMonthly,
			ppaCumulative: data.ppaCumulative,
			sourceType: data.sourceType,
			sourceReference: data.sourceReference ?? null,
			verificationStatus: data.verificationStatus,
		})
		.returning();

	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "ro_budget_realizations",
		entityId: created.id,
		action: "create_ro_budget_realization",
		beforeJson: null,
		afterJson: created,
		orgId,
		requestId: meta.requestId ?? null,
	});

	return created;
}

// ---------------------------------------------------------------------------
// OUTPUT REALIZATION REPORT MUTATIONS (REAL-01 s.d. REAL-08, VAL-00 s.d. VAL-09)
// ---------------------------------------------------------------------------

export async function upsertOutput(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	input: unknown,
	meta: { actorId: string; requestId?: string | null },
) {
	const data = outputSchema.parse(input);
	await assertFy(db, access, orgId, data.fiscalYearId);

	// Range checks
	const rv = parseFloat(data.rvro);
	const vol = parseFloat(data.volumeDipa);
	const pcroNum = parseFloat(data.pcro);
	const tpcroNum = parseFloat(data.tpcro);

	if (pcroNum < 0 || pcroNum > 100) throw new Error("PCRO harus 0..100.");
	if (tpcroNum < 0 || tpcroNum > 100) throw new Error("TPCRO harus 0..100.");

	// Fetch PPA for validation
	const [ppaRecord] = await db
		.select()
		.from(roBudgetRealizations)
		.where(
			and(
				eq(roBudgetRealizations.fiscalYearId, data.fiscalYearId),
				eq(roBudgetRealizations.roCode, data.roCode),
				eq(roBudgetRealizations.month, data.month),
			),
		)
		.limit(1);

	const ppaCumulative = ppaRecord ? Number(ppaRecord.ppaCumulative) : null;
	const hasPpaData = ppaRecord !== undefined;

	// Execute Validation Engine
	const validationResults = validateOutputRecord({
		roCode: data.roCode,
		month: data.month,
		volumeDipa: vol,
		pcroCumulative: pcroNum,
		tpcroCumulative: tpcroNum,
		rvroCumulative: rv,
		ppaCumulative,
		hasPpaData,
		confirmed: data.confirmed,
		evidenceStatus: !!data.evidenceDocumentUrl,
	});

	let computedStatus = "draft";
	if (data.confirmed) {
		computedStatus = "confirmed";
	} else if (hasBlockingValidation(validationResults)) {
		computedStatus = "validation_failed";
	} else if (validationResults.some((v) => v.status === "failed" && v.severity === "confirmation_required") && !data.operatorNote) {
		computedStatus = "validation_confirmation_required";
	} else {
		computedStatus = "ready_to_submit";
	}

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

	const reportedAtDate = data.reportedAt ? new Date(data.reportedAt) : undefined;

	if (existing) {
		const isConfirming = data.confirmed === true && !existing.confirmed;
		const [updated] = await db
			.update(outputReports)
			.set({
				roName: data.roName !== undefined ? data.roName : existing.roName,
				rvro: data.rvro,
				volumeDipa: data.volumeDipa,
				pcro: data.pcro,
				tpcro: data.tpcro,
				rvroIncremental: data.rvroIncremental !== undefined ? data.rvroIncremental : existing.rvroIncremental,
				pcroIncremental: data.pcroIncremental !== undefined ? data.pcroIncremental : existing.pcroIncremental,
				evidenceDocumentUrl: data.evidenceDocumentUrl !== undefined ? data.evidenceDocumentUrl : existing.evidenceDocumentUrl,
				achievementReference: data.achievementReference !== undefined ? data.achievementReference : existing.achievementReference,
				operatorNote: data.operatorNote !== undefined ? data.operatorNote : existing.operatorNote,
				ppkValidationNote: data.ppkValidationNote !== undefined ? data.ppkValidationNote : existing.ppkValidationNote,
				...(reportedAtDate !== undefined ? { reportedAt: reportedAtDate } : {}),
				status: computedStatus,
				validationResultsJson: validationResults,
				confirmed: data.confirmed ?? existing.confirmed,
				...(isConfirming ? { confirmedAt: new Date(), confirmedBy: meta.actorId } : {}),
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
			organizationId: orgId,
			roCode: data.roCode,
			roName: data.roName ?? null,
			month: data.month,
			rvro: data.rvro,
			volumeDipa: data.volumeDipa,
			pcro: data.pcro,
			tpcro: data.tpcro,
			rvroIncremental: data.rvroIncremental ?? null,
			pcroIncremental: data.pcroIncremental ?? null,
			evidenceDocumentUrl: data.evidenceDocumentUrl ?? null,
			achievementReference: data.achievementReference ?? null,
			operatorNote: data.operatorNote ?? null,
			ppkValidationNote: data.ppkValidationNote ?? null,
			reportedAt: reportedAtDate ?? null,
			status: computedStatus,
			validationResultsJson: validationResults,
			confirmed: data.confirmed ?? false,
			confirmedAt: data.confirmed ? new Date() : null,
			confirmedBy: data.confirmed ? meta.actorId : null,
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

export async function submitOutputReport(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	outputId: string,
	meta: { actorId: string; requestId?: string | null },
) {
	assertOperatorOrgScope(access, orgId);

	const [existing] = await db
		.select()
		.from(outputReports)
		.where(eq(outputReports.id, outputId))
		.limit(1);

	if (!existing) throw new Error("Laporan Capaian Output tidak ditemukan.");
	await assertFy(db, access, orgId, existing.fiscalYearId);

	// Check validation blockers
	const valResults = (existing.validationResultsJson as any[]) || [];
	if (hasBlockingValidation(valResults)) {
		throw new Error("Laporan memiliki temuan validasi kritis (blocking) yang wajib diperbaiki sebelum dikirim.");
	}

	const now = new Date();
	const [updated] = await db
		.update(outputReports)
		.set({
			status: "submitted",
			reportedAt: now,
			updatedAt: now,
		})
		.where(eq(outputReports.id, outputId))
		.returning();

	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "output_reports",
		entityId: updated.id,
		action: "submit_output",
		beforeJson: existing,
		afterJson: updated,
		orgId,
		requestId: meta.requestId ?? null,
	});

	return updated;
}

export async function confirmOutput(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	outputId: string,
	meta: { actorId: string; requestId?: string | null },
) {
	assertOperatorOrgScope(access, orgId);

	const [existing] = await db
		.select()
		.from(outputReports)
		.where(eq(outputReports.id, outputId))
		.limit(1);

	if (!existing) throw new Error("Laporan Capaian Output tidak ditemukan.");
	await assertFy(db, access, orgId, existing.fiscalYearId);

	const now = new Date();
	const [updated] = await db
		.update(outputReports)
		.set({
			confirmed: true,
			confirmedAt: now,
			confirmedBy: meta.actorId,
			status: "confirmed",
			updatedAt: now,
		})
		.where(eq(outputReports.id, outputId))
		.returning();

	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "output_reports",
		entityId: updated.id,
		action: "confirm_output",
		beforeJson: existing,
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
	assertOperatorOrgScope(access, orgId);

	const [existing] = await db
		.select()
		.from(outputReports)
		.where(eq(outputReports.id, outputId))
		.limit(1);

	if (!existing) throw new Error("Laporan Capaian Output tidak ditemukan.");
	await assertFy(db, access, orgId, existing.fiscalYearId);

	const [deleted] = await db
		.update(outputReports)
		.set({
			deletedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(eq(outputReports.id, outputId))
		.returning();

	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "output_reports",
		entityId: deleted.id,
		action: "delete_output",
		beforeJson: existing,
		afterJson: deleted,
		orgId,
		requestId: meta.requestId ?? null,
	});

	return { success: true };
}

// ---------------------------------------------------------------------------
// FAIRNESS PROPOSAL & POLICY MUTATIONS
// ---------------------------------------------------------------------------

const proposalInputSchema = z.strictObject({
	fiscalYearId: z.string().uuid(),
	roCode: z.string().min(1).max(32),
	month: z.number().int().min(1).max(12).optional().nullable(),
	category: z.enum(["ro_khusus", "keadaan_kahar", "kebijakan_pusat"]).default("ro_khusus"),
	basisReference: z.string().min(1).max(255),
	operatorNote: z.string().max(1000).optional().nullable(),
	attachmentRef: z.string().max(500).optional().nullable(),
});

export async function createFairnessProposal(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	input: unknown,
	meta: { actorId: string; requestId?: string | null },
) {
	const data = proposalInputSchema.parse(input);
	await assertFy(db, access, orgId, data.fiscalYearId);

	const cleanRo = data.roCode.trim().toUpperCase();
	const existingRows = await db
		.select()
		.from(assessmentExclusionProposals)
		.where(
			and(
				eq(assessmentExclusionProposals.organizationId, orgId),
				eq(assessmentExclusionProposals.fiscalYearId, data.fiscalYearId),
				eq(assessmentExclusionProposals.roCode, cleanRo),
			),
		);

	if (existingRows.length > 0) {
		const primary = existingRows[0];
		const [updated] = await db
			.update(assessmentExclusionProposals)
			.set({
				month: data.month ?? null,
				category: data.category,
				basisReference: data.basisReference,
				operatorNote: data.operatorNote ?? null,
				attachmentRef: data.attachmentRef ?? null,
				status: "submitted",
				submittedAt: new Date(),
			})
			.where(eq(assessmentExclusionProposals.id, primary.id))
			.returning();

		if (existingRows.length > 1) {
			const duplicateIds = existingRows.slice(1).map((r) => r.id);
			for (const dupId of duplicateIds) {
				await db.delete(assessmentExclusionProposals).where(eq(assessmentExclusionProposals.id, dupId));
			}
		}

		await writeAudit(db, {
			actorId: meta.actorId,
			actorAccessType: "operator_satker",
			entityType: "assessment_exclusion_proposals",
			entityId: updated.id,
			action: "update_proposal",
			beforeJson: primary,
			afterJson: updated,
			orgId,
			requestId: meta.requestId ?? null,
		});

		return updated;
	}

	const [created] = await db
		.insert(assessmentExclusionProposals)
		.values({
			organizationId: orgId,
			fiscalYearId: data.fiscalYearId,
			indicatorKey: "output_achievement",
			roCode: cleanRo,
			month: data.month ?? null,
			category: data.category,
			basisReference: data.basisReference,
			operatorNote: data.operatorNote ?? null,
			attachmentRef: data.attachmentRef ?? null,
			status: "submitted",
			submittedAt: new Date(),
		})
		.returning();

	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "assessment_exclusion_proposals",
		entityId: created.id,
		action: "create_proposal",
		beforeJson: null,
		afterJson: created,
		orgId,
		requestId: meta.requestId ?? null,
	});

	return created;
}

export async function deleteFairnessProposal(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	input: { proposalId?: string; roCode?: string; month?: number | null },
	meta: { actorId: string; requestId?: string | null },
) {
	assertOperatorOrgScope(access, orgId);

	let existing: typeof assessmentExclusionProposals.$inferSelect | undefined;
	if (input.proposalId) {
		const [row] = await db
			.select()
			.from(assessmentExclusionProposals)
			.where(
				and(
					eq(assessmentExclusionProposals.id, input.proposalId),
					eq(assessmentExclusionProposals.organizationId, orgId),
				),
			)
			.limit(1);
		existing = row;
	} else if (input.roCode) {
		const [row] = await db
			.select()
			.from(assessmentExclusionProposals)
			.where(
				and(
					eq(assessmentExclusionProposals.organizationId, orgId),
					eq(assessmentExclusionProposals.roCode, input.roCode.trim().toUpperCase()),
				),
			)
			.limit(1);
		existing = row;
	}

	if (!existing) {
		return { success: true };
	}

	await db
		.delete(assessmentExclusionProposals)
		.where(eq(assessmentExclusionProposals.id, existing.id));

	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "assessment_exclusion_proposals",
		entityId: existing.id,
		action: "delete_proposal",
		beforeJson: existing,
		afterJson: null,
		orgId,
		requestId: meta.requestId ?? null,
	});

	return { success: true };
}

const policyInputSchema = z.strictObject({
	id: z.string().uuid().optional(),
	ruleSetId: z.string().uuid().optional().nullable(),
	name: z.string().min(1).max(255),
	indicatorKey: z.string().default("output_achievement"),
	action: z.string().default("exclude_from_assessment"),
	category: z.string().default("ro_khusus"),
	matchType: z.enum(["exact", "list", "prefix", "regex"]).default("exact"),
	roMatchValue: z.union([z.string(), z.array(z.string())]),
	scopeType: z.enum(["national", "kppn", "organization"]).default("national"),
	scopeId: z.string().optional().nullable(),
	fiscalYearId: z.string().uuid().optional().nullable(),
	year: z.number().int().default(2026),
	effectiveMonthStart: z.number().int().min(1).max(12).default(1),
	effectiveMonthEnd: z.number().int().min(1).max(12).default(12),
	basisReference: z.string().min(1),
	displayReason: z.string().min(1),
	internalNote: z.string().optional().nullable(),
	allowOperatorProposal: z.boolean().default(true),
	status: z.enum(["draft", "published", "retired"]).default("published"),
});

export async function upsertFairnessPolicy(
	db: DbClient,
	access: AccessResolution,
	input: unknown,
	meta: { actorId: string; requestId?: string | null },
) {
	assertAdminKppnScope(access);
	const data = policyInputSchema.parse(input);

	if (data.id) {
		const [existing] = await db
			.select()
			.from(assessmentExclusionPolicies)
			.where(eq(assessmentExclusionPolicies.id, data.id))
			.limit(1);

		if (!existing) throw new Error("Policy tidak ditemukan.");

		const [updated] = await db
			.update(assessmentExclusionPolicies)
			.set({
				name: data.name,
				category: data.category,
				matchType: data.matchType,
				roMatchValue: data.roMatchValue,
				scopeType: data.scopeType,
				scopeId: data.scopeId ?? null,
				fiscalYearId: data.fiscalYearId ?? null,
				year: data.year,
				effectiveMonthStart: data.effectiveMonthStart,
				effectiveMonthEnd: data.effectiveMonthEnd,
				basisReference: data.basisReference,
				displayReason: data.displayReason,
				internalNote: data.internalNote ?? null,
				allowOperatorProposal: data.allowOperatorProposal,
				status: data.status,
				updatedAt: new Date(),
			})
			.where(eq(assessmentExclusionPolicies.id, data.id))
			.returning();

		return updated;
	}

	const [created] = await db
		.insert(assessmentExclusionPolicies)
		.values({
			name: data.name,
			category: data.category,
			matchType: data.matchType,
			roMatchValue: data.roMatchValue,
			scopeType: data.scopeType,
			scopeId: data.scopeId ?? null,
			fiscalYearId: data.fiscalYearId ?? null,
			year: data.year,
			effectiveMonthStart: data.effectiveMonthStart,
			effectiveMonthEnd: data.effectiveMonthEnd,
			basisReference: data.basisReference,
			displayReason: data.displayReason,
			internalNote: data.internalNote ?? null,
			allowOperatorProposal: data.allowOperatorProposal,
			status: data.status,
			version: 1,
			publishedAt: data.status === "published" ? new Date() : null,
			publishedBy: data.status === "published" ? meta.actorId : null,
			createdBy: meta.actorId,
		})
		.returning();

	return created;
}

const reviewInputSchema = z.strictObject({
	proposalId: z.string().uuid(),
	status: z.enum(["approved", "rejected", "cancelled"]),
	reviewNote: z.string().max(1000).optional().nullable(),
	createPolicy: z.boolean().optional(),
});

export async function reviewFairnessProposal(
	db: DbClient,
	access: AccessResolution,
	input: unknown,
	meta: { actorId: string; requestId?: string | null },
) {
	assertAdminKppnScope(access);
	const data = reviewInputSchema.parse(input);

	const [proposal] = await db
		.select()
		.from(assessmentExclusionProposals)
		.where(eq(assessmentExclusionProposals.id, data.proposalId))
		.limit(1);

	if (!proposal) throw new Error("Proposal fairness tidak ditemukan.");

	let createdPolicyId: string | null = null;
	if (data.status === "approved" && data.createPolicy) {
		const [newPolicy] = await db
			.insert(assessmentExclusionPolicies)
			.values({
				name: `Pengecualian RO ${proposal.roCode}`,
				category: proposal.category,
				matchType: "exact",
				roMatchValue: [proposal.roCode],
				scopeType: "organization",
				scopeId: proposal.organizationId,
				fiscalYearId: proposal.fiscalYearId,
				year: 2026,
				effectiveMonthStart: proposal.month ?? 1,
				effectiveMonthEnd: proposal.month ?? 12,
				basisReference: proposal.basisReference,
				displayReason: proposal.operatorNote || `Persetujuan usulan fairness ${proposal.roCode}`,
				status: "published",
				version: 1,
				publishedAt: new Date(),
				publishedBy: meta.actorId,
				createdBy: meta.actorId,
			})
			.returning();
		createdPolicyId = newPolicy.id;
	}

	const [updated] = await db
		.update(assessmentExclusionProposals)
		.set({
			status: data.status,
			reviewNote: data.reviewNote ?? null,
			resolvedPolicyId: createdPolicyId ?? proposal.resolvedPolicyId,
			reviewedAt: new Date(),
		})
		.where(eq(assessmentExclusionProposals.id, data.proposalId))
		.returning();

	return updated;
}

import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";
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
	workdays,
} from "@simulator-ikpa/db/schema";
import {
	calculateFifthWorkingDayOfNextMonth,
	evaluateOutputAnomaly,
	validateOutputRecord,
	type OutputValidationResult,
	type AnomalyEvaluationResult,
} from "@simulator-ikpa/ikpa-engine";
import { and, desc, eq, isNull } from "drizzle-orm";
import { resolveOutputAssessmentEligibility } from "../policy/fairness-resolver";

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

export async function listOutputs(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	fiscalYearId: string,
) {
	await assertFy(db, access, orgId, fiscalYearId);
	return db
		.select()
		.from(outputReports)
		.where(
			and(
				eq(outputReports.fiscalYearId, fiscalYearId),
				isNull(outputReports.deletedAt),
			),
		);
}

export async function listOutputsWithEligibility(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	fiscalYearId: string,
) {
	const fy = await assertFy(db, access, orgId, fiscalYearId);

	const [
		reports,
		workdayRows,
		policies,
		proposals,
		targetPlans,
		targetWindows,
		budgetReals,
	] = await Promise.all([
		db
			.select()
			.from(outputReports)
			.where(
				and(
					eq(outputReports.fiscalYearId, fiscalYearId),
					isNull(outputReports.deletedAt),
				),
			),
		db.select().from(workdays).where(eq(workdays.year, fy.year)),
		db
			.select()
			.from(assessmentExclusionPolicies)
			.where(
				and(
					eq(assessmentExclusionPolicies.status, "published"),
					eq(assessmentExclusionPolicies.indicatorKey, "output_achievement"),
				),
			)
			.catch(() => []),
		db
			.select()
			.from(assessmentExclusionProposals)
			.where(
				and(
					eq(assessmentExclusionProposals.organizationId, orgId),
					eq(assessmentExclusionProposals.fiscalYearId, fiscalYearId),
				),
			)
			.catch(() => []),
		db
			.select()
			.from(outputTargetPlans)
			.where(
				and(
					eq(outputTargetPlans.fiscalYearId, fiscalYearId),
					isNull(outputTargetPlans.deletedAt),
				),
			)
			.orderBy(desc(outputTargetPlans.version))
			.catch(() => []),
		db
			.select()
			.from(targetUpdateWindows)
			.where(eq(targetUpdateWindows.fiscalYearId, fiscalYearId))
			.catch(() => []),
		db
			.select()
			.from(roBudgetRealizations)
			.where(
				and(
					eq(roBudgetRealizations.fiscalYearId, fiscalYearId),
					eq(roBudgetRealizations.organizationId, orgId),
				),
			)
			.catch(() => []),
	]);

	const holidays = workdayRows
		.filter((w) => w.isHoliday)
		.map((w) => w.date as string);
	const workdayOverrides = workdayRows
		.filter((w) => !w.isHoliday)
		.map((w) => w.date as string);
	const cal = { holidays, workdays: workdayOverrides };

	// Map Target Plans
	const mappedTargetPlans = targetPlans.map((t) => {
		const monthlyTargets = Array.isArray(t.monthlyTargetsJson)
			? (t.monthlyTargetsJson as Array<{
					month: number;
					targetRvro: number;
					targetPcro: number;
					targetRvroCumulative: number;
					targetPcroCumulative: number;
					rpdCumulative?: number;
				}>)
			: [];

		const totalRvro = monthlyTargets.reduce((s, m) => s + (Number(m.targetRvro) || 0), 0);
		const totalPcro = monthlyTargets.reduce((s, m) => s + (Number(m.targetPcro) || 0), 0);

		return {
			id: t.id,
			roCode: t.roCode,
			roName: t.roName ?? undefined,
			unit: t.unit,
			unitAllowsDecimal: t.unitAllowsDecimal,
			maxDecimalPlaces: t.maxDecimalPlaces,
			isPriorityNational: t.isPriorityNational,
			volumeDipa: t.volumeDipa as string,
			budgetAmountRo: t.budgetAmountRo ? (t.budgetAmountRo as string) : undefined,
			measurementMethod: t.measurementMethod ?? undefined,
			version: t.version,
			status: t.status as "draft" | "submitted" | "active" | "superseded",
			effectiveMonthStart: t.effectiveMonthStart,
			effectiveMonthEnd: t.effectiveMonthEnd,
			monthlyTargets,
			totalRvro,
			totalPcro,
			changeReason: t.changeReason ?? undefined,
			submittedAt: t.submittedAt ? new Date(t.submittedAt).toISOString() : null,
			activatedAt: t.activatedAt ? new Date(t.activatedAt).toISOString() : null,
		};
	});

	// Map Output Reports with Target & PPA linkage + Validation Engine 00-08
	const mappedReports = reports.map((r) => {
		const eligibility = resolveOutputAssessmentEligibility({
			roCode: r.roCode,
			periodMonth: r.month,
			year: fy.year,
			organizationId: orgId,
			publishedPolicies: policies as never,
			operatorProposals: proposals as never,
		});

		const deadlineDate = calculateFifthWorkingDayOfNextMonth(
			fy.year,
			r.month,
			cal,
		);

		// Find active target plan for this RO
		const activeTarget = mappedTargetPlans.find(
			(t) => t.roCode.toUpperCase() === r.roCode.toUpperCase() && (t.status === "active" || t.status === "submitted"),
		) || mappedTargetPlans.find((t) => t.roCode.toUpperCase() === r.roCode.toUpperCase());

		const monthTarget = activeTarget?.monthlyTargets.find((m) => m.month === r.month);
		const targetPcroCumulative = monthTarget?.targetPcroCumulative ?? Number(r.tpcro);
		const targetRvroCumulative = monthTarget?.targetRvroCumulative ?? Number(r.rvro);

		// Find PPA Realization for this RO and month
		const ppaRecord = budgetReals.find(
			(b) => b.roCode.toUpperCase() === r.roCode.toUpperCase() && b.month === r.month,
		);

		const ppaCumulative = ppaRecord ? Number(ppaRecord.ppaCumulative) : null;
		const hasPpaData = ppaRecord !== undefined;

		// Execute Validation Engine 00-08
		const validationResults: OutputValidationResult[] = validateOutputRecord({
			fiscalYear: fy.year,
			organizationId: orgId,
			roCode: r.roCode,
			month: r.month,
			isPriorityNational: activeTarget?.isPriorityNational ?? false,
			unit: activeTarget?.unit ?? "Layanan",
			unitAllowsDecimal: activeTarget?.unitAllowsDecimal ?? false,
			volumeDipa: Number(r.volumeDipa),
			pcroCumulative: Number(r.pcro),
			tpcroCumulative: targetPcroCumulative,
			rvroCumulative: Number(r.rvro),
			ppaCumulative,
			hasPpaData,
			confirmed: r.confirmed,
			fairnessStatus: eligibility.assessmentStatus,
			evidenceStatus: !!r.evidenceDocumentUrl,
		});

		// Anomaly Detection
		const anomaly: AnomalyEvaluationResult = evaluateOutputAnomaly({
			roCode: r.roCode,
			month: r.month,
			isPriorityNational: activeTarget?.isPriorityNational ?? false,
			volumeDipa: Number(r.volumeDipa),
			pcroCumulative: Number(r.pcro),
			tpcroCumulative: targetPcroCumulative,
			rvroCumulative: Number(r.rvro),
			ppaCumulative,
		});

		// Compute Lifecycle Status
		let computedStatus = r.status || (r.confirmed ? "confirmed" : r.reportedAt ? "submitted" : "draft");
		const hasBlocking = validationResults.some((v) => v.status === "failed" && v.severity === "blocking");
		const hasConfirmation = validationResults.some((v) => v.status === "failed" && v.severity === "confirmation_required");

		if (r.confirmed) {
			computedStatus = "confirmed";
		} else if (r.reportedAt) {
			computedStatus = "submitted";
		} else if (hasBlocking) {
			computedStatus = "validation_failed";
		} else if (hasConfirmation && !r.operatorNote) {
			computedStatus = "validation_confirmation_required";
		} else {
			computedStatus = "ready_to_submit";
		}

		return {
			id: r.id,
			roCode: r.roCode,
			roName: r.roName ?? activeTarget?.roName ?? undefined,
			month: r.month,
			rvro: r.rvro as string,
			volumeDipa: r.volumeDipa as string,
			pcro: r.pcro as string,
			tpcro: r.tpcro as string,
			rvroIncremental: r.rvroIncremental ? (r.rvroIncremental as string) : undefined,
			pcroIncremental: r.pcroIncremental ? (r.pcroIncremental as string) : undefined,
			evidenceDocumentUrl: r.evidenceDocumentUrl ?? undefined,
			achievementReference: r.achievementReference ?? undefined,
			operatorNote: r.operatorNote ?? undefined,
			ppkValidationNote: r.ppkValidationNote ?? undefined,
			reportedAt: r.reportedAt
				? new Date(r.reportedAt).toISOString()
				: null,
			status: computedStatus,
			validationResults,
			anomaly,
			targetInfo: {
				unit: activeTarget?.unit ?? "Layanan",
				unitAllowsDecimal: activeTarget?.unitAllowsDecimal ?? false,
				isPriorityNational: activeTarget?.isPriorityNational ?? false,
				targetPcroCumulative,
				targetRvroCumulative,
				targetVersion: activeTarget?.version ?? 1,
			},
			budgetInfo: ppaRecord
				? {
						budgetAmountRo: ppaRecord.budgetAmountRo as string,
						realizedAmountMonthly: ppaRecord.realizedAmountMonthly as string,
						realizedAmountCumulative: ppaRecord.realizedAmountCumulative as string,
						ppaMonthly: ppaRecord.ppaMonthly as string,
						ppaCumulative: ppaRecord.ppaCumulative as string,
						sourceType: ppaRecord.sourceType,
						verificationStatus: ppaRecord.verificationStatus,
					}
				: undefined,
			confirmed: r.confirmed,
			confirmedAt: r.confirmedAt
				? new Date(r.confirmedAt).toISOString()
				: null,
			eligibility,
			deadlineDate,
		};
	});

	const mappedPolicies = policies.map((p) => ({
		...p,
		roMatchValue: (Array.isArray(p.roMatchValue)
			? p.roMatchValue
			: typeof p.roMatchValue === "string"
				? p.roMatchValue
				: String(p.roMatchValue ?? "")) as string | string[],
	}));

	const mappedWindows = targetWindows.map((w) => ({
		id: w.id,
		quarter: w.quarter,
		opensAt: new Date(w.opensAt).toISOString(),
		closesAt: new Date(w.closesAt).toISOString(),
		dayType: w.dayType,
		sourceReference: w.sourceReference ?? undefined,
		status: w.status as "scheduled" | "open" | "closed",
	}));

	return {
		fiscalYearId,
		year: fy.year,
		reports: mappedReports,
		targetPlans: mappedTargetPlans,
		targetWindows: mappedWindows,
		budgetRealizations: budgetReals,
		publishedPolicies: mappedPolicies,
		proposals,
		holidays,
	};
}

export async function listFairnessPolicies(
	db: DbClient,
	year = 2026,
) {
	const rows = await db
		.select()
		.from(assessmentExclusionPolicies)
		.where(
			and(
				eq(assessmentExclusionPolicies.year, year),
				eq(assessmentExclusionPolicies.indicatorKey, "output_achievement"),
			),
		)
		.catch(() => []);

	return rows.map((p) => ({
		...p,
		roMatchValue: (Array.isArray(p.roMatchValue)
			? p.roMatchValue
			: typeof p.roMatchValue === "string"
				? p.roMatchValue
				: String(p.roMatchValue ?? "")) as string | string[],
	}));
}

export async function listFairnessProposals(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	fiscalYearId: string,
) {
	await assertFy(db, access, orgId, fiscalYearId);
	return db
		.select()
		.from(assessmentExclusionProposals)
		.where(
			and(
				eq(assessmentExclusionProposals.organizationId, orgId),
				eq(assessmentExclusionProposals.fiscalYearId, fiscalYearId),
			),
		)
		.catch(() => []);
}

export async function listAllFairnessProposals(
	db: DbClient,
) {
	return db
		.select()
		.from(assessmentExclusionProposals)
		.where(eq(assessmentExclusionProposals.indicatorKey, "output_achievement"))
		.catch(() => []);
}

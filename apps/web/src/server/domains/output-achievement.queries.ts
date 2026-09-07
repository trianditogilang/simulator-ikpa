import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";
import type { AccessResolution } from "@simulator-ikpa/contracts";
import type { DbClient } from "@simulator-ikpa/db";
import {
	assessmentExclusionPolicies,
	assessmentExclusionProposals,
	fiscalYears,
	outputReports,
	workdays,
} from "@simulator-ikpa/db/schema";

import { calculateFifthWorkingDayOfNextMonth } from "@simulator-ikpa/ikpa-engine";
import { and, eq, isNull } from "drizzle-orm";
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

	const [reports, workdayRows, policies, proposals] = await Promise.all([
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
	]);

	const holidays = workdayRows
		.filter((w) => w.isHoliday)
		.map((w) => w.date as string);
	const workdayOverrides = workdayRows
		.filter((w) => !w.isHoliday)
		.map((w) => w.date as string);
	const cal = { holidays, workdays: workdayOverrides };

	const mapped = reports.map((r) => {
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

		return {
			id: r.id,
			roCode: r.roCode,
			roName: r.roName ?? undefined,
			month: r.month,
			rvro: r.rvro as string,
			volumeDipa: r.volumeDipa as string,
			pcro: r.pcro as string,
			tpcro: r.tpcro as string,
			reportedAt: r.reportedAt
				? new Date(r.reportedAt).toISOString()
				: null,
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

	return {
		fiscalYearId,
		year: fy.year,
		reports: mapped,
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




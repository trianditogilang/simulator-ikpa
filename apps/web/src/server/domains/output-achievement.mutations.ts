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
} from "@simulator-ikpa/db/schema";
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
	roName: z.string().max(255).optional().nullable(),
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
	if (!Number.isInteger(rv)) throw new Error("RVRO harus berupa bilangan bulat.");
	if (!Number.isInteger(vol)) throw new Error("Target Volume RO DIPA harus berupa bilangan bulat.");
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
		const isConfirming = data.confirmed === true && !existing.confirmed;
		const [updated] = await db
			.update(outputReports)
			.set({
				roName: data.roName !== undefined ? data.roName : existing.roName,
				rvro: data.rvro,
				volumeDipa: data.volumeDipa,
				pcro: data.pcro,
				tpcro: data.tpcro,
				...(reportedAtDate !== undefined ? { reportedAt: reportedAtDate } : {}),
				confirmed: data.confirmed ?? existing.confirmed,
				...(isConfirming
					? { confirmedAt: new Date(), confirmedBy: meta.actorId }
					: {}),
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
			roName: data.roName ?? null,
			month: data.month,
			rvro: data.rvro,
			volumeDipa: data.volumeDipa,
			pcro: data.pcro,
			tpcro: data.tpcro,
			reportedAt: reportedAtDate ?? null,
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
		.set({
			confirmed: true,
			confirmedAt: new Date(),
			confirmedBy: meta.actorId,
			updatedAt: new Date(),
		})
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

const proposalSchema = z.strictObject({
	fiscalYearId: z.string().uuid(),
	roCode: z.string().min(1).max(32),
	month: z.number().int().min(1).max(12).optional().nullable(),
	category: z.string().default("ro_khusus"),
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
	const data = proposalSchema.parse(input);
	await assertFy(db, access, orgId, data.fiscalYearId);
	const uCode = data.roCode.trim().toUpperCase();

	// Check if any proposal exists for same org + fy + roCode
	const existingList = await db
		.select()
		.from(assessmentExclusionProposals)
		.where(
			and(
				eq(assessmentExclusionProposals.organizationId, orgId),
				eq(assessmentExclusionProposals.fiscalYearId, data.fiscalYearId),
				eq(assessmentExclusionProposals.roCode, uCode),
			),
		);

	if (existingList.length > 0) {
		const targetExisting =
			data.month != null
				? existingList.find((p) => p.month === data.month) ||
				  existingList.find((p) => p.month == null) ||
				  existingList[0]
				: existingList.find((p) => p.month == null) || existingList[0];

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
				submittedBy: meta.actorId,
			})
			.where(eq(assessmentExclusionProposals.id, targetExisting.id))
			.returning();

		// Purge any orphan/redundant duplicate rows for this same RO to ensure zero duplicate storage bloat
		const otherIds = existingList
			.filter((p) => p.id !== targetExisting.id)
			.map((p) => p.id);

		for (const otherId of otherIds) {
			await db
				.delete(assessmentExclusionProposals)
				.where(eq(assessmentExclusionProposals.id, otherId));
		}

		await writeAudit(db, {
			actorId: meta.actorId,
			actorAccessType: "operator_satker",
			entityType: "assessment_exclusion_proposals",
			entityId: targetExisting.id,
			action: "update_proposal",
			beforeJson: targetExisting,
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
			roCode: uCode,
			month: data.month ?? null,
			category: data.category,
			basisReference: data.basisReference,
			operatorNote: data.operatorNote ?? null,
			attachmentRef: data.attachmentRef ?? null,
			status: "submitted",
			submittedAt: new Date(),
			submittedBy: meta.actorId,
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
	input: { proposalId?: string; roCode?: string; month?: number | null; fiscalYearId?: string },
	meta: { actorId: string; requestId?: string | null },
) {
	if (input.fiscalYearId) {
		await assertFy(db, access, orgId, input.fiscalYearId);
	} else {
		assertOperatorOrgScope(access, orgId);
	}

	let query;
	if (input.proposalId) {
		query = and(
			eq(assessmentExclusionProposals.id, input.proposalId),
			eq(assessmentExclusionProposals.organizationId, orgId),
		);
	} else if (input.roCode) {
		const uCode = input.roCode.trim().toUpperCase();
		query = and(
			eq(assessmentExclusionProposals.organizationId, orgId),
			eq(assessmentExclusionProposals.roCode, uCode),
			input.fiscalYearId
				? eq(assessmentExclusionProposals.fiscalYearId, input.fiscalYearId)
				: undefined,
		);
	} else {
		throw new Error("ID proposal atau Kode RO wajib ditentukan.");
	}

	const existing = await db
		.select()
		.from(assessmentExclusionProposals)
		.where(query);

	if (existing.length === 0) return [];

	const deleted = await db
		.delete(assessmentExclusionProposals)
		.where(query)
		.returning();

	for (const row of deleted) {
		await writeAudit(db, {
			actorId: meta.actorId,
			actorAccessType: "operator_satker",
			entityType: "assessment_exclusion_proposals",
			entityId: row.id,
			action: "delete_proposal",
			beforeJson: row,
			afterJson: null,
			orgId,
			requestId: meta.requestId ?? null,
		});
	}

	return deleted;
}

const fairnessPolicySchema = z.strictObject({
	id: z.string().uuid().optional(),
	ruleSetId: z.string().uuid().optional().nullable(),
	name: z.string().min(1).max(255),
	indicatorKey: z.string().default("output_achievement"),
	action: z.string().default("exclude_from_assessment"),
	category: z.string().default("ro_khusus"),
	matchType: z.enum(["exact", "list", "prefix", "regex"]),
	roMatchValue: z.union([z.string(), z.array(z.string())]),
	scopeType: z.enum(["national", "kppn", "organization"]).default("national"),
	scopeId: z.string().uuid().optional().nullable(),
	year: z.number().int().default(2026),
	effectiveMonthStart: z.number().int().min(1).max(12).default(1),
	effectiveMonthEnd: z.number().int().min(1).max(12).default(12),
	basisReference: z.string().min(1),
	displayReason: z.string().min(1),
	internalNote: z.string().optional().nullable(),
	allowOperatorProposal: z.boolean().default(false),
	status: z.enum(["draft", "published", "retired", "expired"]).default("draft"),
});

export async function upsertFairnessPolicy(
	db: DbClient,
	access: AccessResolution,
	input: unknown,
	meta: { actorId: string; requestId?: string | null },
) {
	assertAdminKppnScope(access);
	const data = fairnessPolicySchema.parse(input);

	if (data.id) {
		const [existing] = await db
			.select()
			.from(assessmentExclusionPolicies)
			.where(eq(assessmentExclusionPolicies.id, data.id))
			.limit(1);

		if (!existing) throw new Error("Kebijakan fairness tidak ditemukan.");

		const [updated] = await db
			.update(assessmentExclusionPolicies)
			.set({
				name: data.name,
				matchType: data.matchType,
				roMatchValue: data.roMatchValue,
				scopeType: data.scopeType,
				scopeId: data.scopeId ?? null,
				year: data.year,
				effectiveMonthStart: data.effectiveMonthStart,
				effectiveMonthEnd: data.effectiveMonthEnd,
				basisReference: data.basisReference,
				displayReason: data.displayReason,
				internalNote: data.internalNote ?? null,
				allowOperatorProposal: data.allowOperatorProposal,
				status: data.status,
				publishedAt: data.status === "published" ? new Date() : existing.publishedAt,
				publishedBy: data.status === "published" ? meta.actorId : existing.publishedBy,
				updatedAt: new Date(),
			})
			.where(eq(assessmentExclusionPolicies.id, data.id))
			.returning();

		await writeAudit(db, {
			actorId: meta.actorId,
			actorAccessType: "admin_kppn",
			entityType: "assessment_exclusion_policies",
			entityId: data.id,
			action: "update_fairness_policy",
			beforeJson: existing,
			afterJson: updated,
			requestId: meta.requestId ?? null,
		});

		return {
			...updated,
			roMatchValue: (Array.isArray(updated.roMatchValue)
				? updated.roMatchValue
				: typeof updated.roMatchValue === "string"
					? updated.roMatchValue
					: String(updated.roMatchValue ?? "")) as string | string[],
		};
	}

	const [created] = await db
		.insert(assessmentExclusionPolicies)
		.values({
			name: data.name,
			indicatorKey: data.indicatorKey,
			action: data.action,
			category: data.category,
			matchType: data.matchType,
			roMatchValue: data.roMatchValue,
			scopeType: data.scopeType,
			scopeId: data.scopeId ?? null,
			year: data.year,
			effectiveMonthStart: data.effectiveMonthStart,
			effectiveMonthEnd: data.effectiveMonthEnd,
			basisReference: data.basisReference,
			displayReason: data.displayReason,
			internalNote: data.internalNote ?? null,
			allowOperatorProposal: data.allowOperatorProposal,
			status: data.status,
			publishedAt: data.status === "published" ? new Date() : null,
			publishedBy: data.status === "published" ? meta.actorId : null,
			createdBy: meta.actorId,
		})
		.returning();

	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "admin_kppn",
		entityType: "assessment_exclusion_policies",
		entityId: created.id,
		action: "create_fairness_policy",
		beforeJson: null,
		afterJson: created,
		requestId: meta.requestId ?? null,
	});

	return {
		...created,
		roMatchValue: (Array.isArray(created.roMatchValue)
			? created.roMatchValue
			: typeof created.roMatchValue === "string"
				? created.roMatchValue
				: String(created.roMatchValue ?? "")) as string | string[],
	};
}


export async function reviewFairnessProposal(
	db: DbClient,
	access: AccessResolution,
	input: {
		proposalId: string;
		status: "approved" | "rejected";
		reviewNote?: string;
		resolvedPolicyId?: string;
	},
	meta: { actorId: string; requestId?: string | null },
) {
	assertAdminKppnScope(access);
	const [proposal] = await db
		.select()
		.from(assessmentExclusionProposals)
		.where(eq(assessmentExclusionProposals.id, input.proposalId))
		.limit(1);

	if (!proposal) throw new Error("Usulan tidak ditemukan.");

	const [updated] = await db
		.update(assessmentExclusionProposals)
		.set({
			status: input.status,
			reviewNote: input.reviewNote ?? null,
			resolvedPolicyId: input.resolvedPolicyId ?? null,
			reviewedAt: new Date(),
			reviewedBy: meta.actorId,
			updatedAt: new Date(),
		})
		.where(eq(assessmentExclusionProposals.id, input.proposalId))
		.returning();

	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "admin_kppn",
		entityType: "assessment_exclusion_proposals",
		entityId: proposal.id,
		action: `review_proposal_${input.status}`,
		beforeJson: proposal,
		afterJson: updated,
		requestId: meta.requestId ?? null,
	});

	return updated;
}


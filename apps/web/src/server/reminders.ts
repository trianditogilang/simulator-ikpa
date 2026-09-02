import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";
import { createDbClient } from "@simulator-ikpa/db";
import {
	fiscalYears,
	reminderPolicies,
	ruleSets,
} from "@simulator-ikpa/db/schema";
import { getAccessResolutionForSession } from "./access.server";
import { getServerAuthSession } from "./auth-session.server";
import {
	resetReminderConfigToDefault,
	upsertReminderConfig,
} from "./reminders/config.mutations";
import {
	listReminderConfigs,
	previewReminderSchedule,
} from "./reminders/config.queries";

function getDatabase() {
	const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
	if (!dbUrl) {
		return null;
	}
	return createDbClient(dbUrl);
}

async function getOrInitFiscalYear(
	db: ReturnType<typeof createDbClient>,
	orgId: string,
	year = 2026,
) {
	let [fy] = await db
		.select()
		.from(fiscalYears)
		.where(and(eq(fiscalYears.orgId, orgId), eq(fiscalYears.year, year)))
		.limit(1);

	if (!fy) {
		const [ruleSet] = await db
			.select()
			.from(ruleSets)
			.where(
				and(eq(ruleSets.year, year), eq(ruleSets.status, "published")),
			)
			.limit(1);

		if (ruleSet) {
			[fy] = await db
				.insert(fiscalYears)
				.values({
					orgId,
					year,
					activeRuleSetId: ruleSet.id,
				})
				.returning();
		}
	}

	return fy;
}

export const listOperatorRemindersFn = createServerFn({ method: "GET" })
	.validator((data?: { orgId?: string }) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth, data?.orgId);

		const targetOrgId =
			data?.orgId ||
			(access.status === "operator_single_scope" ||
			access.status === "operator_multiple_scopes"
				? access.activeOrganizationId
				: null);

		if (!targetOrgId) {
			throw new Error("Satuan Kerja aktif tidak ditemukan.");
		}

		assertOperatorOrgScope(access, targetOrgId);

		const db = getDatabase();
		if (!db) {
			return {
				fiscalYearId: "fy-mock-2026",
				year: 2026,
				policies: [],
				configs: [],
				previews: [],
			};
		}

		const fy = await getOrInitFiscalYear(db, targetOrgId, 2026);
		if (!fy) {
			throw new Error("Tahun anggaran 2026 tidak ditemukan.");
		}

		const policies = await db
			.select()
			.from(reminderPolicies)
			.where(eq(reminderPolicies.isActive, true));

		const configs = await listReminderConfigs(db, access, targetOrgId, fy.id);

		// Compute preview schedules for policies
		const previews = await Promise.all(
			policies.map(async (p) => {
				const cfg = configs.find((c) => c.reminderPolicyId === p.id);
				try {
					const preview = await previewReminderSchedule(
						db,
						access,
						targetOrgId,
						fy.id,
						p.id,
						cfg
							? {
									enabled: cfg.enabled,
									scheduleJson: cfg.scheduleJson,
									additionalRecipientsJson: cfg.additionalRecipientsJson,
								}
							: undefined,
					);
					return {
						policyId: p.id,
						deadline: preview.deadline,
						dayType: preview.dayType,
						scheduled: preview.scheduled,
					};
				} catch {
					return {
						policyId: p.id,
						deadline: "2026-12-31",
						dayType: p.dayType,
						scheduled: [],
					};
				}
			}),
		);

		return {
			fiscalYearId: fy.id,
			year: fy.year,
			policies: policies.map((p) => ({
				id: p.id,
				eventType: p.eventType,
				category: p.category,
				dayType: p.dayType,
				minLeadDays: p.minLeadDays,
				maxLeadDays: p.maxLeadDays,
				allowDisable: p.allowDisable,
				allowRecipientOverride: p.allowRecipientOverride,
				isActive: p.isActive,
			})),
			configs: configs.map((c) => ({
				id: c.id,
				reminderPolicyId: c.reminderPolicyId,
				enabled: c.enabled,
				customMessage: c.customMessage,
				timezone: c.timezone,
			})),
			previews,
		};
	});

export const updateOperatorReminderConfigFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			orgId?: string;
			reminderPolicyId: string;
			enabled: boolean;
			leadDays?: number[];
			additionalRecipients?: string[];
			customMessage?: string | null;
		}) => data,
	)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth, data.orgId);

		const targetOrgId =
			data.orgId ||
			(access.status === "operator_single_scope" ||
			access.status === "operator_multiple_scopes"
				? access.activeOrganizationId
				: null);

		if (!targetOrgId) {
			throw new Error("Satuan Kerja aktif tidak ditemukan.");
		}

		assertOperatorOrgScope(access, targetOrgId);

		const db = getDatabase();
		if (!db) {
			return { success: true };
		}

		const fy = await getOrInitFiscalYear(db, targetOrgId, 2026);
		if (!fy) {
			throw new Error("Tahun anggaran 2026 tidak ditemukan.");
		}

		const result = await upsertReminderConfig(
			db,
			access,
			targetOrgId,
			{
				fiscalYearId: fy.id,
				reminderPolicyId: data.reminderPolicyId,
				enabled: data.enabled,
				scheduleJson: { leadDays: data.leadDays ?? [7, 3, 1], sendHour: 8 },
				additionalRecipientsJson: data.additionalRecipients ?? [],
				customMessage: data.customMessage,
				timezone: "Asia/Jakarta",
			},
			{
				actorId:
					access.status === "operator_single_scope" ||
					access.status === "operator_multiple_scopes"
						? access.userId
						: targetOrgId,
			},
		);

		return { success: true, configId: result?.id };
	});

export const resetOperatorReminderConfigFn = createServerFn({ method: "POST" })
	.validator((data: { orgId?: string; configId: string }) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth, data.orgId);

		const targetOrgId =
			data.orgId ||
			(access.status === "operator_single_scope" ||
			access.status === "operator_multiple_scopes"
				? access.activeOrganizationId
				: null);

		if (!targetOrgId) {
			throw new Error("Satuan Kerja aktif tidak ditemukan.");
		}

		assertOperatorOrgScope(access, targetOrgId);

		const db = getDatabase();
		if (!db) {
			return { success: true };
		}

		const result = await resetReminderConfigToDefault(
			db,
			access,
			targetOrgId,
			data.configId,
			{
				actorId:
					access.status === "operator_single_scope" ||
					access.status === "operator_multiple_scopes"
						? access.userId
						: targetOrgId,
			},
		);

		return { success: true, configId: result?.id };
	});

import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";
import type { AccessResolution } from "@simulator-ikpa/contracts";
import type { DbClient } from "@simulator-ikpa/db";
import {
	fiscalYears,
	orgReminderConfigs,
	reminderPolicies,
} from "@simulator-ikpa/db/schema";
import { checkCompliance } from "@simulator-ikpa/policy-reminder";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "../audit/write-audit";

const upsertSchema = z.strictObject({
	fiscalYearId: z.string().uuid(),
	reminderPolicyId: z.string().uuid(),
	enabled: z.boolean(),
	scheduleJson: z.unknown(),
	additionalRecipientsJson: z.array(z.string()).optional(),
	customMessage: z.string().max(1000).nullable().optional(),
	timezone: z.string().min(1).max(64).optional(),
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

function sanitizeMessage(msg: string | null | undefined): string | null {
	if (!msg) return null;
	// ponytail: strip script tags, escape is done at render time; store sanitized truncated
	return msg.replace(/<script[^>]*>.*?<\/script>/gi, "").slice(0, 1000);
}

export async function upsertReminderConfig(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	input: unknown,
	meta: { actorId: string; requestId?: string | null },
) {
	const data = upsertSchema.parse(input);
	await assertFy(db, access, orgId, data.fiscalYearId);

	const [policy] = await db
		.select()
		.from(reminderPolicies)
		.where(eq(reminderPolicies.id, data.reminderPolicyId))
		.limit(1);
	if (!policy) throw new Error("Policy tidak ditemukan.");
	if (!policy.isActive)
		throw new Error("Policy tidak aktif, tidak dapat dikonfigurasi.");

	// compliance guard
	const scheduleLeadDays = (data.scheduleJson as { leadDays?: number[] })
		?.leadDays;
	const errors = checkCompliance(
		{
			id: policy.id,
			eventType: policy.eventType,
			category: policy.category as never,
			dayType: policy.dayType as never,
			minLeadDays: policy.minLeadDays,
			maxLeadDays: policy.maxLeadDays,
			requiredRecipientsJson: policy.requiredRecipientsJson as string[],
			allowDisable: policy.allowDisable,
			allowRecipientOverride: policy.allowRecipientOverride,
			isActive: policy.isActive,
		},
		{
			enabled: data.enabled,
			scheduleLeadDays,
			recipients: [
				...((policy.requiredRecipientsJson as string[]) ?? []),
				...(data.additionalRecipientsJson ?? []),
			],
		},
	);
	if (errors.length)
		throw new Error(
			errors.map((e: { message: string }) => e.message).join("; "),
		);

	const [existing] = await db
		.select()
		.from(orgReminderConfigs)
		.where(
			and(
				eq(orgReminderConfigs.orgId, orgId),
				eq(orgReminderConfigs.fiscalYearId, data.fiscalYearId),
				eq(orgReminderConfigs.reminderPolicyId, data.reminderPolicyId),
			),
		)
		.limit(1);

	const sanitized = sanitizeMessage(data.customMessage ?? null);

	if (existing) {
		const [updated] = await db
			.update(orgReminderConfigs)
			.set({
				enabled: data.enabled,
				scheduleJson: data.scheduleJson as never,
				additionalRecipientsJson: (data.additionalRecipientsJson ??
					[]) as never,
				customMessage: sanitized,
				timezone: data.timezone ?? existing.timezone,
				updatedBy: meta.actorId,
				updatedAt: new Date(),
			})
			.where(eq(orgReminderConfigs.id, existing.id))
			.returning();

		await writeAudit(db, {
			actorId: meta.actorId,
			actorAccessType: "operator_satker",
			entityType: "org_reminder_configs",
			entityId: existing.id,
			action: "update_reminder_config",
			beforeJson: existing,
			afterJson: updated,
			orgId,
			requestId: meta.requestId ?? null,
			policyId: policy.id,
		});
		return updated;
	}

	const [created] = await db
		.insert(orgReminderConfigs)
		.values({
			orgId,
			fiscalYearId: data.fiscalYearId,
			reminderPolicyId: data.reminderPolicyId,
			enabled: data.enabled,
			scheduleJson: data.scheduleJson as never,
			additionalRecipientsJson: (data.additionalRecipientsJson ?? []) as never,
			customMessage: sanitized,
			timezone: data.timezone ?? "Asia/Jakarta",
			updatedBy: meta.actorId,
		})
		.returning();

	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "org_reminder_configs",
		entityId: created.id,
		action: "create_reminder_config",
		beforeJson: null,
		afterJson: created,
		orgId,
		requestId: meta.requestId ?? null,
		policyId: policy.id,
	});
	return created;
}

export async function resetReminderConfigToDefault(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	configId: string,
	meta: { actorId: string; requestId?: string | null },
) {
	const [cfg] = await db
		.select()
		.from(orgReminderConfigs)
		.where(eq(orgReminderConfigs.id, configId))
		.limit(1);
	if (!cfg) throw new Error("Config tidak ditemukan.");
	assertOperatorOrgScope(access, orgId);
	if (cfg.orgId !== orgId) throw new Error("Config di luar scope.");
	const [policy] = await db
		.select()
		.from(reminderPolicies)
		.where(eq(reminderPolicies.id, cfg.reminderPolicyId))
		.limit(1);
	if (!policy) throw new Error("Policy tidak ditemukan.");

	const [updated] = await db
		.update(orgReminderConfigs)
		.set({
			enabled: true,
			scheduleJson: policy.defaultScheduleJson as never,
			additionalRecipientsJson: [] as never,
			customMessage: null,
			updatedBy: meta.actorId,
			updatedAt: new Date(),
		})
		.where(eq(orgReminderConfigs.id, configId))
		.returning();

	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "operator_satker",
		entityType: "org_reminder_configs",
		entityId: configId,
		action: "reset_reminder_config",
		beforeJson: cfg,
		afterJson: updated,
		orgId,
		requestId: meta.requestId ?? null,
		policyId: policy.id,
	});
	return updated;
}

import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import { assertAdminKppnScope } from "@simulator-ikpa/access-control";
import { createDbClient } from "@simulator-ikpa/db";
import { reminderPolicies, ruleSets } from "@simulator-ikpa/db/schema";
import { getAccessResolutionForSession } from "./access.server";
import { getServerAuthSession } from "./auth-session.server";
import {
	createDraft,
	publishRuleSet,
	retireRuleSet,
} from "./policy/rule-set.workflow";

function getDatabase() {
	const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
	if (!dbUrl) {
		return null;
	}
	return createDbClient(dbUrl);
}

export const listAdminRuleSetsFn = createServerFn({ method: "GET" })
	.validator((data?: { year?: number }) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth);

		assertAdminKppnScope(access);

		const db = getDatabase();
		if (!db) {
			return { ruleSets: [] };
		}

		const rows = await db
			.select()
			.from(ruleSets)
			.where(data?.year ? eq(ruleSets.year, data.year) : undefined)
			.orderBy(desc(ruleSets.createdAt));

		return {
			ruleSets: rows.map((r) => ({
				id: r.id,
				year: r.year,
				version: r.version,
				status: r.status,
				sourceRegulation: r.sourceRegulation,
				changeNotes: r.changeNotes,
				effectiveFrom: r.effectiveFrom.toISOString().slice(0, 10),
				publishedAt: r.publishedAt?.toISOString() ?? null,
				retiredAt: r.retiredAt?.toISOString() ?? null,
				createdAt: r.createdAt.toISOString(),
			})),
		};
	});

export const createRuleSetDraftFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			year: number;
			version: string;
			sourceRegulation: string;
			changeNotes: string;
			configJson: unknown;
		}) => data,
	)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth);

		assertAdminKppnScope(access);

		const db = getDatabase();
		if (!db) {
			return { success: true };
		}

		const result = await createDraft(
			db,
			{
				year: data.year,
				version: data.version,
				sourceRegulation: data.sourceRegulation,
				changeNotes: data.changeNotes,
				configJson: data.configJson,
			},
			{ actorId: access.status === "admin" ? access.userId : "admin" },
		);

		return { success: true, ruleSetId: result.id };
	});

export const publishRuleSetFn = createServerFn({ method: "POST" })
	.validator((data: { ruleSetId: string }) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth);

		assertAdminKppnScope(access);

		const db = getDatabase();
		if (!db) {
			return { success: true };
		}

		const result = await publishRuleSet(db, data.ruleSetId, {
			actorId: access.status === "admin" ? access.userId : "admin",
		});

		return { success: true, ruleSetId: result.id };
	});

export const retireRuleSetFn = createServerFn({ method: "POST" })
	.validator((data: { ruleSetId: string }) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth);

		assertAdminKppnScope(access);

		const db = getDatabase();
		if (!db) {
			return { success: true };
		}

		const result = await retireRuleSet(db, data.ruleSetId, {
			actorId: access.status === "admin" ? access.userId : "admin",
		});

		return { success: true, ruleSetId: result.id };
	});

export const listAdminReminderPoliciesFn = createServerFn({ method: "GET" })
	.validator(() => undefined)
	.handler(async () => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth);

		assertAdminKppnScope(access);

		const db = getDatabase();
		if (!db) {
			return { policies: [] };
		}

		const rows = await db.select().from(reminderPolicies);

		return {
			policies: rows.map((p) => ({
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
		};
	});

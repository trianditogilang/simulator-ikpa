import type { DbClient } from "@simulator-ikpa/db";
import { ruleSets } from "@simulator-ikpa/db/schema";
import { validateInvariants } from "@simulator-ikpa/ikpa-engine";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "../audit/write-audit";

const createDraftSchema = z.strictObject({
	year: z.number().int().min(2020).max(2100),
	version: z.string().min(1).max(32),
	sourceRegulation: z.string().min(1).max(300),
	changeNotes: z.string().min(1).max(1000),
	configJson: z.unknown(),
});

export async function createDraft(
	db: DbClient,
	input: unknown,
	meta: { actorId: string; requestId?: string | null },
) {
	const data = createDraftSchema.parse(input);
	const inv = validateInvariants(data.configJson as never);
	if (inv.length)
		throw new Error(
			`Invariant violation: ${inv.map((i) => `${i.path}: ${i.message}`).join("; ")}`,
		);

	const [created] = await db
		.insert(ruleSets)
		.values({
			year: data.year,
			version: data.version,
			effectiveFrom: new Date(`${data.year}-01-01T00:00:00Z`),
			status: "draft",
			sourceRegulation: data.sourceRegulation,
			changeNotes: data.changeNotes,
			configJson: data.configJson as never,
			createdBy: meta.actorId,
		})
		.returning();

	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "admin_kppn",
		entityType: "rule_sets",
		entityId: created.id,
		action: "create_draft",
		beforeJson: null,
		afterJson: created,
		ruleSetVersion: created.version,
		requestId: meta.requestId ?? null,
	});
	return created;
}

export async function publishRuleSet(
	db: DbClient,
	ruleSetId: string,
	meta: { actorId: string; requestId?: string | null },
) {
	const [row] = await db
		.select()
		.from(ruleSets)
		.where(eq(ruleSets.id, ruleSetId))
		.limit(1);
	if (!row) throw new Error("Rule set tidak ditemukan");
	if (row.status !== "draft")
		throw new Error("Hanya draft yang dapat dipublish");
	if (!row.sourceRegulation || !row.changeNotes)
		throw new Error("sourceRegulation & changeNotes wajib sebelum publish");
	// check invariant again
	const inv = validateInvariants(row.configJson as never);
	if (inv.length)
		throw new Error(
			`Invariant blocked publish: ${inv.map((i) => i.message).join("; ")}`,
		);

	const [published] = await db
		.update(ruleSets)
		.set({
			status: "published",
			publishedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(eq(ruleSets.id, ruleSetId))
		.returning();

	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "admin_kppn",
		entityType: "rule_sets",
		entityId: ruleSetId,
		action: "publish_rule_set",
		beforeJson: row,
		afterJson: published,
		ruleSetVersion: published.version,
		requestId: meta.requestId ?? null,
	});

	// ponytail: schedule re-evaluation placeholder - notifications with old version stay, new schedules will use new version
	// snapshot historis tidak berubah (immutable by design)

	return published;
}

export async function retireRuleSet(
	db: DbClient,
	ruleSetId: string,
	meta: { actorId: string; requestId?: string | null },
) {
	const [row] = await db
		.select()
		.from(ruleSets)
		.where(eq(ruleSets.id, ruleSetId))
		.limit(1);
	if (!row) throw new Error("Rule set tidak ditemukan");
	if (row.status !== "published")
		throw new Error("Hanya published yang dapat di-retire");
	const [retired] = await db
		.update(ruleSets)
		.set({ status: "retired", retiredAt: new Date(), updatedAt: new Date() })
		.where(eq(ruleSets.id, ruleSetId))
		.returning();
	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "admin_kppn",
		entityType: "rule_sets",
		entityId: ruleSetId,
		action: "retire_rule_set",
		beforeJson: row,
		afterJson: retired,
		ruleSetVersion: retired.version,
		requestId: meta.requestId ?? null,
	});
	return retired;
}

export async function diffRuleSets(db: DbClient, aId: string, bId: string) {
	const [a] = await db
		.select()
		.from(ruleSets)
		.where(eq(ruleSets.id, aId))
		.limit(1);
	const [b] = await db
		.select()
		.from(ruleSets)
		.where(eq(ruleSets.id, bId))
		.limit(1);
	if (!a || !b) throw new Error("Rule set tidak ditemukan");
	const aCfg = a.configJson as Record<string, unknown>;
	const bCfg = b.configJson as Record<string, unknown>;
	const diff: Record<string, { from: unknown; to: unknown }> = {};
	for (const k of new Set([...Object.keys(aCfg), ...Object.keys(bCfg)])) {
		if (JSON.stringify(aCfg[k]) !== JSON.stringify(bCfg[k])) {
			diff[k] = { from: aCfg[k], to: bCfg[k] };
		}
	}
	return {
		a: { id: a.id, version: a.version },
		b: { id: b.id, version: b.version },
		diff,
	};
}

export async function listRuleSets(db: DbClient, year?: number) {
	if (year) return db.select().from(ruleSets).where(eq(ruleSets.year, year));
	return db.select().from(ruleSets);
}

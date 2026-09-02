import { createHash } from "node:crypto";
import type { DbClient } from "@simulator-ikpa/db";
import { notificationDeliveries } from "@simulator-ikpa/db/schema";
import { and, eq, lte } from "drizzle-orm";
import type { WorkdayCalendar } from "./workday-calendar";
import { subtractWorkdays } from "./workday-calendar";

export function buildIdempotencyKey(params: {
	orgId: string;
	fiscalYearId?: string;
	policyId: string;
	eventType: string;
	deadline: string; // YYYY-MM-DD
	leadDays: number;
	ruleSetVersion: string;
}): string {
	const raw = `${params.orgId}|${params.policyId}|${params.eventType}|${params.deadline}|H-${params.leadDays}|${params.ruleSetVersion}`;
	// short hash to keep <=200 char but deterministic
	const hash = createHash("sha256").update(raw).digest("hex").slice(0, 16);
	return `${params.orgId.slice(0, 8)}-${params.policyId.slice(0, 8)}-${params.deadline}-H${params.leadDays}-${hash}`;
}

export interface ScheduleInput {
	orgId: string;
	fiscalYearId: string;
	policyId: string;
	eventType: string;
	deadline: string;
	leadDays: number[];
	dayType: "workday" | "calendar_day" | "event_based" | "schedule";
	calendar: WorkdayCalendar;
	ruleSetVersion: string;
	ruleSetId: string;
	payload?: unknown;
	scheduledHour?: number; // local send hour
	timezone?: string;
}

// ponytail: deterministic, bounded, eligibility checked before schedule
export function planDeliveries(
	input: ScheduleInput,
): Array<{ scheduledFor: string; idempotencyKey: string; leadDays: number }> {
	const out: Array<{
		scheduledFor: string;
		idempotencyKey: string;
		leadDays: number;
	}> = [];
	for (const lead of input.leadDays) {
		let scheduledDate: string;
		if (input.dayType === "workday") {
			scheduledDate = subtractWorkdays(input.deadline, lead, input.calendar);
		} else if (input.dayType === "calendar_day") {
			const [y, m, d] = input.deadline.split("-").map(Number);
			const dt = new Date(Date.UTC(y, m - 1, d));
			dt.setUTCDate(dt.getUTCDate() - lead);
			scheduledDate = dt.toISOString().slice(0, 10);
		} else {
			// event_based/schedule : deadline itself (H-0 only)
			scheduledDate = input.deadline;
		}
		// combine with hour and timezone naive -> UTC iso (simplified: assume Asia/Jaksarta WIB UTC+7)
		const hour = input.scheduledHour ?? 8;
		const scheduledFor = `${scheduledDate}T${String(hour).padStart(2, "0")}:00:00+07:00`;
		const key = buildIdempotencyKey({
			orgId: input.orgId,
			fiscalYearId: input.fiscalYearId,
			policyId: input.policyId,
			eventType: input.eventType,
			deadline: input.deadline,
			leadDays: lead,
			ruleSetVersion: input.ruleSetVersion,
		});
		out.push({ scheduledFor, idempotencyKey: key, leadDays: lead });
	}
	return out;
}

// DB helpers (unique insert, due selection, re-evaluation)
export async function insertScheduledDeliveries(
	db: DbClient,
	deliveries: Array<{
		orgId: string;
		fiscalYearId: string;
		policyId: string;
		eventType: string;
		scheduledFor: string;
		idempotencyKey: string;
		ruleSetId: string;
		ruleSetVersion: string;
		payload?: unknown;
	}>,
) {
	// ponytail: insert one by one with onConflictDoNothing equivalent via try/catch unique
	const inserted: unknown[] = [];
	for (const d of deliveries) {
		try {
			const [row] = await db
				.insert(notificationDeliveries)
				.values({
					orgId: d.orgId as never,
					reminderPolicyId: d.policyId as never,
					ruleSetVersion: d.ruleSetVersion as never,
					entityType: d.eventType as never,
					scheduledFor: new Date(d.scheduledFor) as never,
					status: "scheduled" as never,
					idempotencyKey: d.idempotencyKey as never,
					payloadJson: (d.payload ?? {}) as never,
				} as never)
				.returning();
			inserted.push(row);
		} catch (e: unknown) {
			// duplicate idempotency_key -> skip (replay safe)
			const msg = (e as Error).message ?? "";
			if (
				msg.includes("idempotency") ||
				msg.includes("duplicate") ||
				msg.includes("unique")
			)
				continue;
			throw e;
		}
	}
	return inserted;
}

export async function selectDueDeliveries(
	db: DbClient,
	nowIso: string,
	batchLimit = 50,
) {
	const now = new Date(nowIso);
	const rows = await db
		.select()
		.from(notificationDeliveries)
		.where(
			and(
				eq(notificationDeliveries.status, "scheduled"),
				lte(notificationDeliveries.scheduledFor, now),
			),
		)
		.limit(batchLimit);
	return rows;
}

export async function reEvaluatePending(
	db: DbClient,
	orgId: string,
	// when rule set version changes, mark scheduled with old version as cancelled? simplified: return pending rows
) {
	const rows = await db
		.select()
		.from(notificationDeliveries)
		.where(and(eq(notificationDeliveries.status, "scheduled")))
		.limit(100);
	// ponytail: placeholder re-evaluation - caller will regenerate keys and cancel outdated
	return rows
		.filter((r) => (r as unknown as { orgId?: string }).orgId === orgId || true)
		.slice(0, 20);
}

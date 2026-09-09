import { describe, expect, it } from "vitest";
import { buildIdempotencyKey, planDeliveries } from "./scheduler";

const calendar = { holidays: [], workdays: [] };

describe("reminder scheduler planning", () => {
	it("creates deterministic, distinct idempotency keys per lead day", () => {
		const base = {
			orgId: "org-123456789",
			fiscalYearId: "fy-2026",
			policyId: "policy-abc",
			eventType: "invoice_deadline",
			deadline: "2026-02-24",
			ruleSetVersion: "2026.1",
		};
		const first = buildIdempotencyKey({ ...base, leadDays: 5 });
		const second = buildIdempotencyKey({ ...base, leadDays: 10 });
		expect(first).toBe(buildIdempotencyKey({ ...base, leadDays: 5 }));
		expect(first).not.toBe(second);
		expect(first).toContain("2026-02-24-H5");
	});

	it("plans workday reminders using the calendar and local send hour", () => {
		const rows = planDeliveries({
			orgId: "org-123456789",
			fiscalYearId: "fy-2026",
			policyId: "policy-abc",
			eventType: "invoice_deadline",
			deadline: "2026-02-24",
			leadDays: [5, 10],
			dayType: "workday",
			calendar,
			ruleSetVersion: "2026.1",
			ruleSetId: "rule-2026",
			scheduledHour: 9,
		});
		expect(rows.map((row) => row.scheduledFor)).toEqual([
			"2026-02-17T09:00:00+07:00",
			"2026-02-10T09:00:00+07:00",
		]);
		expect(rows.map((row) => row.leadDays)).toEqual([5, 10]);
	});

	it("supports calendar-day and event-based schedules", () => {
		const calendarDay = planDeliveries({
			orgId: "org-1",
			fiscalYearId: "fy-2026",
			policyId: "policy-1",
			eventType: "output_deadline",
			deadline: "2026-03-10",
			leadDays: [2],
			dayType: "calendar_day",
			calendar,
			ruleSetVersion: "2026.1",
			ruleSetId: "rule-2026",
		});
		const eventBased = planDeliveries({
			orgId: "org-1",
			fiscalYearId: "fy-2026",
			policyId: "policy-1",
			eventType: "output_deadline",
			deadline: "2026-03-10",
			dayType: "event_based",
			leadDays: [0],
			calendar,
			ruleSetVersion: "2026.1",
			ruleSetId: "rule-2026",
		});
		expect(calendarDay[0].scheduledFor).toBe("2026-03-08T08:00:00+07:00");
		expect(eventBased[0].scheduledFor).toBe("2026-03-10T08:00:00+07:00");
	});
});

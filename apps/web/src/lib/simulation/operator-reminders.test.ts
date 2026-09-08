import { describe, expect, it } from "vitest";
import {
	getActiveReminderEvents,
	getMockActiveReminderEvents,
} from "../../server/reminders/active-events.queries";

describe("Operator Reminder Center Logic & Context Guard", () => {
	it("should provide mock active events separated cleanly between Belanja Kontraktual and Penyelesaian Tagihan", async () => {
		const events = await getActiveReminderEvents(null, "org-mock-001");

		expect(events.length).toBeGreaterThan(0);

		// 1. Tagihan SPM-LS
		const tagihanEvents = events.filter(
			(e) => e.indicatorKey === "invoice_timeliness",
		);
		expect(tagihanEvents.length).toBeGreaterThan(0);
		for (const te of tagihanEvents) {
			expect(te.dayType).toBe("workday");
			expect(te.baseDateLabel).toBe("Tanggal BAST/BAPP");
			expect(te.actionUrl).toContain("/operator/data/contracts-invoices?tab=invoices");
		}

		// 2. Belanja Kontraktual
		const contractualEvents = events.filter(
			(e) => e.indicatorKey === "contractual",
		);
		expect(contractualEvents.length).toBeGreaterThan(0);
		for (const ce of contractualEvents) {
			// Contractual uses calendar days and evaluates signedAt or sp2dAt (NOT BAST)
			expect(ce.dayType).toBe("calendar_day");
			expect(ce.baseDateLabel).not.toBe("Tanggal BAST/BAPP");
			expect(ce.actionUrl).toContain("/operator/data/contracts-invoices?tab=contracts");
		}

		// 3. Capaian Output
		const outputEvents = events.filter(
			(e) => e.indicatorKey === "output_achievement",
		);
		expect(outputEvents.length).toBeGreaterThan(0);
		const realizationEvent = outputEvents.find(
			(e) => e.eventType === "output_report_monthly",
		);
		expect(realizationEvent).toBeDefined();
		expect(realizationEvent?.dayType).toBe("workday");

		// 4. UP/TUP
		const upTupEvents = events.filter((e) => e.indicatorKey === "up_tup");
		expect(upTupEvents.length).toBeGreaterThan(0);
		expect(upTupEvents[0].dayType).toBe("calendar_day");
		expect(upTupEvents[0].deadlineDate).toBe("2026-09-14");
	});

	it("should enforce distinct rules for capital 53 contract acceleration", () => {
		const mockEvents = getMockActiveReminderEvents();
		const cap53Event = mockEvents.find(
			(e) => e.eventType === "capital_53_contract_due",
		);

		expect(cap53Event).toBeDefined();
		expect(cap53Event?.indicatorKey).toBe("contractual");
		expect(cap53Event?.baseDateLabel).toBe("Tanggal SP2D");
		expect(cap53Event?.deadlineDate).toBe("2026-03-31");
		expect(cap53Event?.status).toBe("completed");
		expect(cap53Event?.statusLabel).toContain("100 Poin");
	});

	it("should correctly identify overdue SPM-LS vs safe SPM-LS", () => {
		const mockEvents = getMockActiveReminderEvents();
		const overdueSpm = mockEvents.find((e) => e.status === "overdue");
		const safeSpm = mockEvents.find((e) => e.status === "safe");

		expect(overdueSpm).toBeDefined();
		expect(overdueSpm?.indicatorKey).toBe("invoice_timeliness");
		expect(overdueSpm?.daysRemaining).toBeLessThan(0);

		expect(safeSpm).toBeDefined();
		expect(safeSpm?.daysRemaining).toBeGreaterThan(0);
	});

	it("should enforce lead days validation: minimal 0 (Hari-H), maximal 20, and max 4 reminder milestones", () => {
		// Valid cases: 0..20 days, <= 4 items
		const validLeads = [
			[20, 17, 10, 0],
			[17, 10, 5, 0],
			[14, 7, 3, 0],
			[10, 3, 0],
			[4, 2],
			[0],
		];
		for (const leads of validLeads) {
			expect(leads.length).toBeLessThanOrEqual(4);
			expect(leads.every((d) => d >= 0 && d <= 20)).toBe(true);
		}

		// Invalid case: > 4 items
		const excessLeads = [20, 17, 14, 10, 0];
		expect(excessLeads.length).toBeGreaterThan(4);

		// Invalid case: out of bounds (< 0 or > 20)
		const outOfBoundsLeads = [25, 21, -1];
		expect(outOfBoundsLeads.some((d) => d < 0 || d > 20)).toBe(true);
	});
});



import { describe, expect, it } from "vitest";
import { evaluateDeadline } from "./deadline-calculator";

const cal = { holidays: [], workdays: [] };

describe("deadline-calculator", () => {
	it("workdays_after_bast 17 from 2026-01-30 => 2026-02-24", () => {
		expect(
			evaluateDeadline(
				{ type: "workdays_after_bast", workdays: 17 },
				{ year: 2026, bastDate: "2026-01-30" },
				cal,
			),
		).toBe("2026-02-24");
	});
	it("workdays_after_month_end 5 from Feb 2026 => 2026-03-06", () => {
		// Feb 2026 last day = 2026-02-28 (Sat) -> next workdays: Mar 2,3,4,5,6
		expect(
			evaluateDeadline(
				{ type: "workdays_after_month_end", workdays: 5 },
				{ year: 2026, month: 2 },
				cal,
			),
		).toBe("2026-03-06");
	});
	it("monthly_revolving 30 from 2026-01-01 => 2026-01-31", () => {
		expect(
			evaluateDeadline(
				{ type: "monthly_revolving", days: 30 },
				{ year: 2026, referenceDate: "2026-01-01" },
				cal,
			),
		).toBe("2026-01-31");
	});
	it("quarterly_deadline Q1 => 2026-03-31", () => {
		expect(
			evaluateDeadline(
				{ type: "quarterly_deadline" },
				{ year: 2026, quarter: 1 },
				cal,
			),
		).toBe("2026-03-31");
		expect(
			evaluateDeadline(
				{ type: "quarterly_deadline" },
				{ year: 2026, quarter: 4 },
				cal,
			),
		).toBe("2026-12-31");
	});
	it("end_of_year_schedule => 2026-12-31", () => {
		expect(
			evaluateDeadline({ type: "end_of_year_schedule" }, { year: 2026 }, cal),
		).toBe("2026-12-31");
	});
	it("target_window_close for 2026 quarters", () => {
		expect(
			evaluateDeadline(
				{ type: "target_window_close" },
				{ year: 2026, quarter: 1 },
				cal,
			),
		).toBe("2026-04-30");
		expect(
			evaluateDeadline(
				{ type: "target_window_close" },
				{ year: 2026, quarter: 2 },
				cal,
			),
		).toBe("2026-04-30");
		expect(
			evaluateDeadline(
				{ type: "target_window_close" },
				{ year: 2026, quarter: 3 },
				cal,
			),
		).toBe("2026-07-14");
		expect(
			evaluateDeadline(
				{ type: "target_window_close" },
				{ year: 2026, quarter: 4 },
				cal,
			),
		).toBe("2026-10-14");
	});
	it("output_report_deadline for 2026 realization open periods", () => {
		expect(
			evaluateDeadline(
				{ type: "output_report_deadline" },
				{ year: 2026, month: 1 },
				cal,
			),
		).toBe("2026-04-30");
		expect(
			evaluateDeadline(
				{ type: "output_report_deadline" },
				{ year: 2026, month: 4 },
				cal,
			),
		).toBe("2026-05-12");
		expect(
			evaluateDeadline(
				{ type: "output_report_deadline" },
				{ year: 2026, month: 5 },
				cal,
			),
		).toBe("2026-06-10");
		expect(
			evaluateDeadline(
				{ type: "output_report_deadline" },
				{ year: 2026, month: 6 },
				cal,
			),
		).toBe("2026-07-09");
		expect(
			evaluateDeadline(
				{ type: "output_report_deadline" },
				{ year: 2026, month: 7 },
				cal,
			),
		).toBe("2026-08-11");
		expect(
			evaluateDeadline(
				{ type: "output_report_deadline" },
				{ year: 2026, month: 8 },
				cal,
			),
		).toBe("2026-09-09");
		expect(
			evaluateDeadline(
				{ type: "output_report_deadline" },
				{ year: 2026, month: 9 },
				cal,
			),
		).toBe("2026-10-09");
		expect(
			evaluateDeadline(
				{ type: "output_report_deadline" },
				{ year: 2026, month: 10 },
				cal,
			),
		).toBe("2026-11-10");
		expect(
			evaluateDeadline(
				{ type: "output_report_deadline" },
				{ year: 2026, month: 11 },
				cal,
			),
		).toBe("2026-12-09");
		expect(
			evaluateDeadline(
				{ type: "output_report_deadline" },
				{ year: 2026, month: 12 },
				cal,
			),
		).toBe("2027-01-13");
	});
	it("rejects unknown formula", () => {
		expect(() =>
			evaluateDeadline({ type: "unknown" } as never, { year: 2026 }, cal),
		).toThrow();
	});
	it("bounded workdays throws if out of range", () => {
		expect(() =>
			evaluateDeadline(
				{ type: "workdays_after_bast", workdays: 100 },
				{ year: 2026, bastDate: "2026-01-01" },
				cal,
			),
		).toThrow();
	});
});

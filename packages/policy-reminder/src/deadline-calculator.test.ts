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

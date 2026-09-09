import { describe, expect, it } from "vitest";
import {
	OFFICIAL_2026_OUTPUT_REALIZATION_DEADLINES,
	addWorkdays,
	calculateOutputReportDeadline,
	countWorkdays,
	parseIsoDateParts,
	subtractWorkdays,
} from "./workday-calendar";

const emptyCalendar = { holidays: [], workdays: [] };

describe("engine workday and output deadline helpers", () => {
	it("parses only valid ISO date prefixes", () => {
		expect(parseIsoDateParts("2026-02-03T00:00:00Z")).toEqual({
			year: 2026,
			month: 2,
			day: 3,
		});
		expect(parseIsoDateParts("03/02/2026")).toBeNull();
		expect(parseIsoDateParts(null)).toBeNull();
	});

	it("applies weekday, holiday, and weekend overrides", () => {
		expect(addWorkdays("2026-01-30", 1, emptyCalendar)).toBe("2026-02-02");
		expect(
			addWorkdays("2026-01-30", 1, {
				holidays: ["2026-02-02"],
				workdays: [],
			}),
		).toBe("2026-02-03");
		expect(
			addWorkdays("2026-01-30", 1, {
				holidays: [],
				workdays: ["2026-01-31"],
			}),
		).toBe("2026-01-31");
	});

	it("keeps add/subtract/count semantics explicit", () => {
		expect(subtractWorkdays("2026-02-24", 5, emptyCalendar)).toBe("2026-02-17");
		expect(countWorkdays("2026-01-30", "2026-02-24", emptyCalendar)).toBe(17);
		expect(() => addWorkdays("2026-01-30", -1, emptyCalendar)).toThrow();
	});

	it("uses the verified 2026 output realization table", () => {
		expect(Object.keys(OFFICIAL_2026_OUTPUT_REALIZATION_DEADLINES)).toHaveLength(12);
		expect(calculateOutputReportDeadline(2026, 4, emptyCalendar)).toBe(
			"2026-05-12",
		);
		expect(calculateOutputReportDeadline(2025, 1, emptyCalendar)).toBe(
			"2025-02-11",
		);
	});
});

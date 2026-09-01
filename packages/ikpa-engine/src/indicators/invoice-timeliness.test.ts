import { describe, expect, it } from "vitest";
import { calculateInvoiceTimeliness } from "./invoice-timeliness";
import { default2026RuleSet } from "../rule-set";
import type { InvoiceTimelinessInput } from "../types";

describe("calculateInvoiceTimeliness", () => {
	it("returns incomplete when no invoices are present", () => {
		const input: InvoiceTimelinessInput = {
			invoices: [],
			workdayCalendar: {
				holidays: [],
				workdays: [],
			},
		};

		const result = calculateInvoiceTimeliness(input, default2026RuleSet);

		expect(result.status).toBe("incomplete");
		expect(result.score).toBeNull();
		expect(result.weightedContribution).toBeNull();
		expect(result.warnings).toContain(
			"Tidak ada data SPM-LS non-pegawai (denominator nol).",
		);
	});

	it("calculates correctly with golden test case (13 on-time out of 15)", () => {
		const invoices = [];
		// 13 on time
		for (let i = 0; i < 13; i++) {
			invoices.push({
				id: `inv-ontime-${i}`,
				bastDate: "2026-01-01",
				spmDate: "2026-01-10", // 9 days later
			});
		}
		// 2 late
		for (let i = 0; i < 2; i++) {
			invoices.push({
				id: `inv-late-${i}`,
				bastDate: "2026-01-01",
				spmDate: "2026-01-25", // 24 days later
			});
		}

		const input: InvoiceTimelinessInput = {
			invoices,
			workdayCalendar: {
				holidays: [],
				workdays: [],
			},
		};

		const result = calculateInvoiceTimeliness(input, default2026RuleSet);

		expect(result.status).toBe("complete");
		// 13 / 15 = 0.86666... * 100 = 86.6666... -> rounded half_up 2 digits = 86.67
		expect(result.score).toBe("86.67");

		// Weight is 10. (86.67 * 10) / 100 = 8.667 -> 8.67
		expect(result.weightedContribution).toBe("8.67");

		const tagWarnings = default2026RuleSet.assumptionWarnings.filter((w) =>
			w.startsWith("TAG-"),
		);
		tagWarnings.forEach((w) => {
			expect(result.warnings).toContain(w);
		});
	});

	it("skips holidays when counting workdays", () => {
		const input: InvoiceTimelinessInput = {
			invoices: [
				{
					id: "inv-1",
					bastDate: "2026-01-01",
					// 17 actual days later is 2026-01-18.
					// If we add 10 holidays in between, 2026-01-28 is 17 workdays later.
					spmDate: "2026-01-28",
				},
			],
			workdayCalendar: {
				holidays: [
					"2026-01-02",
					"2026-01-03",
					"2026-01-04",
					"2026-01-05",
					"2026-01-06",
					"2026-01-07",
					"2026-01-08",
					"2026-01-09",
					"2026-01-10",
					"2026-01-11",
				], // 10 holidays
				workdays: [],
			},
		};

		const result = calculateInvoiceTimeliness(input, default2026RuleSet);
		// 17 workdays -> on time -> 100%
		expect(result.score).toBe("100.00");
	});

	it("fails if > 17 workdays", () => {
		const input: InvoiceTimelinessInput = {
			invoices: [
				{
					id: "inv-1",
					bastDate: "2026-01-01",
					spmDate: "2026-01-20", // 19 days, no holidays
				},
			],
			workdayCalendar: {
				holidays: [],
				workdays: [],
			},
		};

		const result = calculateInvoiceTimeliness(input, default2026RuleSet);
		expect(result.score).toBe("0.00");
	});
});

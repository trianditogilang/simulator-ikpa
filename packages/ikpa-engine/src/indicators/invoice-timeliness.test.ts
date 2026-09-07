import { describe, expect, it } from "vitest";
import { default2026RuleSet } from "../rule-set";
import type { InvoiceTimelinessInput } from "../types";
import { addWorkdays, countWorkdays, isWorkday, parseIsoDateParts } from "../utils/workday-calendar";
import { calculateInvoiceTimeliness } from "./invoice-timeliness";

describe("calculateInvoiceTimeliness", () => {
	const defaultCalendar = {
		holidays: [
			"2026-01-01", // New year (Thursday)
			"2026-01-16", // Isra Mikraj (Friday)
		],
		workdays: [],
	};

	it("returns incomplete when no invoices are present", () => {
		const input: InvoiceTimelinessInput = {
			invoices: [],
			workdayCalendar: defaultCalendar,
		};

		const result = calculateInvoiceTimeliness(input, default2026RuleSet);

		expect(result.status).toBe("incomplete");
		expect(result.score).toBeNull();
		expect(result.weightedContribution).toBeNull();
		expect(result.warnings.some((w) => w.includes("Tidak ada data SPM-LS"))).toBe(true);
	});

	it("matches the canonical PDF acceptance example (13 on-time out of 15 eligible = 86.67, contribution = 8.67)", () => {
		const invoices = [];
		// 13 on time: BAST Friday 2026-01-02, SPM Friday 2026-01-23 (14 workdays <= 17)
		for (let i = 0; i < 13; i++) {
			invoices.push({
				id: `inv-ontime-${i}`,
				bastDate: "2026-01-02",
				spmDate: "2026-01-23",
				isPegawai: false,
				isContractual: true,
			});
		}
		// 2 late: BAST Friday 2026-01-02, SPM Friday 2026-02-06 (24 workdays > 17)
		for (let i = 0; i < 2; i++) {
			invoices.push({
				id: `inv-late-${i}`,
				bastDate: "2026-01-02",
				spmDate: "2026-02-06",
				isPegawai: false,
				isContractual: true,
			});
		}

		const input: InvoiceTimelinessInput = {
			invoices,
			workdayCalendar: defaultCalendar,
		};

		const result = calculateInvoiceTimeliness(input, default2026RuleSet);

		expect(result.status).toBe("complete");
		// 13 / 15 * 100 = 86.6666... -> 86.67
		expect(result.score).toBe("86.67");
		// 86.67 * 10% = 8.667 -> 8.67
		expect(result.weightedContribution).toBe("8.67");
	});

	it("strictly excludes belanja pegawai (isPegawai = true) from both numerator and denominator", () => {
		const invoices = [
			// 2 non-pegawai on time
			{ id: "inv-1", bastDate: "2026-01-02", spmDate: "2026-01-10", isPegawai: false },
			{ id: "inv-2", bastDate: "2026-01-02", spmDate: "2026-01-10", isPegawai: false },
			// 10 pegawai on time (should be completely ignored)
			...Array.from({ length: 10 }, (_, i) => ({
				id: `pegawai-ontime-${i}`,
				bastDate: "2026-01-02",
				spmDate: "2026-01-10",
				isPegawai: true,
			})),
			// 10 pegawai late (should be completely ignored)
			...Array.from({ length: 10 }, (_, i) => ({
				id: `pegawai-late-${i}`,
				bastDate: "2026-01-02",
				spmDate: "2026-02-28",
				isPegawai: true,
			})),
		];

		const result = calculateInvoiceTimeliness(
			{ invoices, workdayCalendar: defaultCalendar },
			default2026RuleSet,
		);

		// Score is based purely on the 2 non-pegawai invoices: 2 / 2 = 100%
		expect(result.status).toBe("complete");
		expect(result.score).toBe("100.00");
		expect(result.weightedContribution).toBe("10.00");
		expect(result.warnings.some((w) => w.includes("20 berkas SPM Belanja Pegawai dikecualikan"))).toBe(true);
	});

	it("evaluates exact boundary H+17 (17 workdays -> on-time, 18 workdays -> late)", () => {
		// BAST: 2026-01-02 (Friday, holiday Jan 16 is Friday)
		// Day 1: Mon Jan 5 .. Day 10: Fri Jan 16 (HOLIDAY!) .. Day 17: Wed Jan 28
		const deadline = addWorkdays("2026-01-02", 17, defaultCalendar);
		expect(deadline).toBe("2026-01-28");

		// Test on-time at exactly H+17 (Jan 28)
		const resOnTime = calculateInvoiceTimeliness(
			{
				invoices: [{ id: "inv-1", bastDate: "2026-01-02", spmDate: "2026-01-28", isPegawai: false }],
				workdayCalendar: defaultCalendar,
			},
			default2026RuleSet,
		);
		expect(resOnTime.score).toBe("100.00");

		// Test late at H+18 (Jan 29)
		const resLate = calculateInvoiceTimeliness(
			{
				invoices: [{ id: "inv-1", bastDate: "2026-01-02", spmDate: "2026-01-29", isPegawai: false }],
				workdayCalendar: defaultCalendar,
			},
			default2026RuleSet,
		);
		expect(resLate.score).toBe("0.00");
	});

	it("treats same-day BAST and konversi as 0 workdays elapsed (on-time)", () => {
		const result = calculateInvoiceTimeliness(
			{
				invoices: [{ id: "inv-same-day", bastDate: "2026-01-05", spmDate: "2026-01-05", isPegawai: false }],
				workdayCalendar: defaultCalendar,
			},
			default2026RuleSet,
		);
		expect(result.status).toBe("complete");
		expect(result.score).toBe("100.00");
	});

	it("skips weekends (Saturday & Sunday) and national holidays from workday count", () => {
		// 2026-01-02 (Friday) to 2026-01-05 (Monday)
		// Days elapsed: Jan 3 (Sat - skip), Jan 4 (Sun - skip), Jan 5 (Mon - count 1)
		const cnt = countWorkdays("2026-01-02", "2026-01-05", { holidays: [], workdays: [] });
		expect(cnt).toBe(1);

		// With Jan 16 as holiday: from Jan 15 (Thu) to Jan 19 (Mon)
		// Jan 16 (Fri - holiday skip), Jan 17 (Sat - skip), Jan 18 (Sun - skip), Jan 19 (Mon - count 1)
		const cntHoliday = countWorkdays("2026-01-15", "2026-01-19", defaultCalendar);
		expect(cntHoliday).toBe(1);
	});

	it("respects workday overrides (e.g. Saturday marked as workday)", () => {
		const calWithOverride = {
			holidays: [],
			workdays: ["2026-01-03"], // Saturday Jan 3 is overridden to be a workday
		};

		expect(isWorkday("2026-01-03", calWithOverride)).toBe(true);

		// From Jan 2 (Fri) to Jan 5 (Mon): Jan 3 (Sat - workday!), Jan 4 (Sun - skip), Jan 5 (Mon - workday) = 2
		const cnt = countWorkdays("2026-01-02", "2026-01-05", calWithOverride);
		expect(cnt).toBe(2);
	});

	it("rejects conversion date earlier than BAST date (spmDate < bastDate)", () => {
		const result = calculateInvoiceTimeliness(
			{
				invoices: [{ id: "inv-invalid", bastDate: "2026-01-10", spmDate: "2026-01-05", isPegawai: false }],
				workdayCalendar: defaultCalendar,
			},
			default2026RuleSet,
		);
		// Invalid date cannot be on-time
		expect(result.score).toBe("0.00");
		expect(result.warnings.some((w) => w.includes("tanggal konversi tidak valid"))).toBe(true);
	});

	it("does not count invoices with missing/pending spmDate as on-time", () => {
		const result = calculateInvoiceTimeliness(
			{
				invoices: [
					{ id: "inv-1", bastDate: "2026-01-02", spmDate: "2026-01-10", isPegawai: false },
					{ id: "inv-pending", bastDate: "2026-01-02", spmDate: null, isPegawai: false },
				],
				workdayCalendar: defaultCalendar,
			},
			default2026RuleSet,
		);
		// 1 on time completed
		expect(result.score).toBe("100.00");
		expect(result.warnings.some((w) => w.includes("1 berkas SPM berjalan"))).toBe(true);
	});

	it("returns incomplete when all eligible invoices are pending conversion", () => {
		const result = calculateInvoiceTimeliness(
			{
				invoices: [
					{ id: "inv-pending-1", bastDate: "2026-01-02", spmDate: null, isPegawai: false },
					{ id: "inv-pending-2", bastDate: "2026-01-05", spmDate: "", isPegawai: false },
				],
				workdayCalendar: defaultCalendar,
			},
			default2026RuleSet,
		);
		expect(result.status).toBe("incomplete");
		expect(result.score).toBeNull();
		expect(result.warnings.some((w) => w.includes("menunggu tanggal konversi"))).toBe(true);
	});

	it("parses dates deterministically without timezone shift", () => {
		expect(parseIsoDateParts("2026-01-01")).toEqual({ year: 2026, month: 1, day: 1 });
		expect(parseIsoDateParts("2026-12-31")).toEqual({ year: 2026, month: 12, day: 31 });
		expect(parseIsoDateParts(null)).toBeNull();
		expect(parseIsoDateParts("")).toBeNull();
	});
});

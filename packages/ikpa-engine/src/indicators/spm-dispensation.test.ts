import { describe, expect, it } from "vitest";
import { default2026RuleSet } from "../rule-set";
import type { SpmDispensationInput } from "../types";
import { calculateSpmDispensation } from "./spm-dispensation";

describe("F6-10 Dispensasi SPM (PER-5/PB/2024 & FIX-09)", () => {
	it("1. returns 0 deduction with warning if totalSpmQ4 is 0", () => {
		const input: SpmDispensationInput = {
			dispensationCount: 0,
			totalSpmQ4: 0,
		};
		const result = calculateSpmDispensation(input, default2026RuleSet);

		expect(result.deduction).toBe("0");
		expect(result.ratio).toBe("0.00");
		expect(result.category).toBe(1);
		expect(
			result.warnings.some((w) => w.includes("Belum ada SPM Triwulan IV")),
		).toBe(true);
	});

	it("2. returns 0 deduction for 0 / 100 SPM (Kategori 1)", () => {
		const input: SpmDispensationInput = {
			dispensationCount: 0,
			totalSpmQ4: 100,
		};
		const result = calculateSpmDispensation(input, default2026RuleSet);

		expect(result.ratio).toBe("0.00");
		expect(result.category).toBe(1);
		expect(result.deduction).toBe("0");
		expect(result.warnings.length).toBe(0);
	});

	it("3. passes the official golden test: 24/5214 SPM -> ratio 4.60‰ -> category 4 -> 0.75 deduction", () => {
		const input: SpmDispensationInput = {
			dispensationCount: 24,
			totalSpmQ4: 5214,
		};
		// Ratio = (24 / 5214) * 1000 = 4.603759... -> rounded to 4.60
		// Category 4: 1.00 - 4.99 -> deduction 0.75
		const result = calculateSpmDispensation(input, default2026RuleSet);

		expect(result.ratio).toBe("4.60");
		expect(result.category).toBe(4);
		expect(result.deduction).toBe("0.75");
		expect(result.warnings.length).toBe(0);
		expect(result.formulaTrace).toHaveLength(3);
	});

	it("4. handles boundary: 9 / 100000 = 0.09‰ -> Kategori 2 -> 0.25 deduction", () => {
		const result = calculateSpmDispensation(
			{
				dispensationCount: 9,
				totalSpmQ4: 100000,
			},
			default2026RuleSet,
		);
		expect(result.ratio).toBe("0.09");
		expect(result.category).toBe(2);
		expect(result.deduction).toBe("0.25");
	});

	it("5. handles boundary: 1 / 10000 = 0.10‰ -> Kategori 3 (batas bawah) -> 0.50 deduction", () => {
		const result = calculateSpmDispensation(
			{
				dispensationCount: 1,
				totalSpmQ4: 10000,
			},
			default2026RuleSet,
		);
		expect(result.ratio).toBe("0.10");
		expect(result.category).toBe(3);
		expect(result.deduction).toBe("0.50");
	});

	it("6. handles boundary: 99 / 100000 = 0.99‰ -> Kategori 3 (batas atas) -> 0.50 deduction", () => {
		const result = calculateSpmDispensation(
			{
				dispensationCount: 99,
				totalSpmQ4: 100000,
			},
			default2026RuleSet,
		);
		expect(result.ratio).toBe("0.99");
		expect(result.category).toBe(3);
		expect(result.deduction).toBe("0.50");
	});

	it("7. handles boundary: 1 / 1000 = 1.00‰ -> Kategori 4 (batas bawah) -> 0.75 deduction", () => {
		const result = calculateSpmDispensation(
			{
				dispensationCount: 1,
				totalSpmQ4: 1000,
			},
			default2026RuleSet,
		);
		expect(result.ratio).toBe("1.00");
		expect(result.category).toBe(4);
		expect(result.deduction).toBe("0.75");
	});

	it("8. handles boundary: 26 / 5214 ≈ 4.9865... -> 4.99‰ -> Kategori 4 (batas atas) -> 0.75 deduction", () => {
		const result = calculateSpmDispensation(
			{
				dispensationCount: 26,
				totalSpmQ4: 5214,
			},
			default2026RuleSet,
		);
		expect(result.ratio).toBe("4.99");
		expect(result.category).toBe(4);
		expect(result.deduction).toBe("0.75");
	});

	it("9. handles boundary: 5 / 1000 = 5.00‰ -> Kategori 5 (batas bawah) -> 1.00 deduction", () => {
		const result = calculateSpmDispensation(
			{
				dispensationCount: 5,
				totalSpmQ4: 1000,
			},
			default2026RuleSet,
		);
		expect(result.ratio).toBe("5.00");
		expect(result.category).toBe(5);
		expect(result.deduction).toBe("1.00");
	});

	it("10. handles high ratio: 10 / 1000 = 10.00‰ -> Kategori 5 -> 1.00 deduction", () => {
		const result = calculateSpmDispensation(
			{
				dispensationCount: 10,
				totalSpmQ4: 1000,
			},
			default2026RuleSet,
		);
		expect(result.ratio).toBe("10.00");
		expect(result.category).toBe(5);
		expect(result.deduction).toBe("1.00");
	});

	it("11. warns if dispensationCount > totalSpmQ4", () => {
		const result = calculateSpmDispensation(
			{
				dispensationCount: 15,
				totalSpmQ4: 10,
			},
			default2026RuleSet,
		);
		expect(
			result.warnings.some((w) =>
				w.includes("Jumlah SPM dispensasi tidak boleh melebihi total SPM Q4"),
			),
		).toBe(true);
	});
});

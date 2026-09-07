import { describe, expect, it } from "vitest";
import { formatGroupedInput, parseGroupedInput } from "./formatted-number-input";

describe("grouped number input", () => {
	it("formats integers with dot thousands separators", () => {
		expect(formatGroupedInput("250000000", false)).toBe("250.000.000");
		expect(formatGroupedInput("1500", false)).toBe("1.500");
		expect(formatGroupedInput("999", false)).toBe("999");
		expect(formatGroupedInput("", false)).toBe("");
	});

	it("parses grouped or prefixed display back to raw digits", () => {
		expect(parseGroupedInput("250.000.000", false)).toBe("250000000");
		expect(parseGroupedInput("Rp 1.250.000", false)).toBe("1250000");
		expect(parseGroupedInput("", false)).toBe("");
	});

	it("keeps decimal fractions with comma separator", () => {
		expect(formatGroupedInput("25.0001", true)).toBe("25,0001");
		expect(formatGroupedInput("1250000.5", true)).toBe("1.250.000,5");
		expect(formatGroupedInput("25.", true)).toBe("25,");
		expect(parseGroupedInput("1.250.000,50", true)).toBe("1250000.50");
		expect(parseGroupedInput("25,0001", true)).toBe("25.0001");
	});

	it("roundtrips raw values without loss", () => {
		for (const raw of ["0", "50", "15000000", "1500000000"]) {
			expect(parseGroupedInput(formatGroupedInput(raw, false), false)).toBe(
				raw,
			);
		}
		for (const raw of ["0.5", "25.0001", "25.", "100", "1500000.5", "250000000.75"]) {
			expect(parseGroupedInput(formatGroupedInput(raw, true), true)).toBe(
				raw,
			);
		}
	});

	it("automatically separates thousands as digits are typed sequentially", () => {
		// Simulates typing digits 1 0 0 0 0 0 0 into an input with allowDecimal: true
		let currentDisplay = "";
		const typedSequence = ["1", "0", "0", "0", "0", "0", "0"];
		const expectedDisplays = [
			"1",
			"10",
			"100",
			"1.000",
			"10.000",
			"100.000",
			"1.000.000",
		];
		const expectedRaws = [
			"1",
			"10",
			"100",
			"1000",
			"10000",
			"100000",
			"1000000",
		];

		for (let i = 0; i < typedSequence.length; i++) {
			const typed = currentDisplay + typedSequence[i];
			const raw = parseGroupedInput(typed, true);
			expect(raw).toBe(expectedRaws[i]);
			currentDisplay = formatGroupedInput(raw, true);
			expect(currentDisplay).toBe(expectedDisplays[i]);
		}
	});

	it("handles decimal typing after thousands grouping", () => {
		// Starting with "1.000.000", user adds "," then "5" then "0"
		let current = "1.000.000";
		
		// User types comma
		let raw = parseGroupedInput(`${current},`, true);
		expect(raw).toBe("1000000.");
		current = formatGroupedInput(raw, true);
		expect(current).toBe("1.000.000,");

		// User types 5
		raw = parseGroupedInput(`${current}5`, true);
		expect(raw).toBe("1000000.5");
		current = formatGroupedInput(raw, true);
		expect(current).toBe("1.000.000,5");

		// User types 0
		raw = parseGroupedInput(`${current}0`, true);
		expect(raw).toBe("1000000.50");
		current = formatGroupedInput(raw, true);
		expect(current).toBe("1.000.000,50");
	});

	it("restricts values to max and limits decimal places with maxDecimals", () => {
		// PCRO / TPCRO constraints: max = 100, maxDecimals = 2
		expect(parseGroupedInput("80,555", true, 2, 100)).toBe("80.55");
		expect(parseGroupedInput("100", true, 2, 100)).toBe("100");
		expect(parseGroupedInput("100,5", true, 2, 100)).toBe("100");
		expect(parseGroupedInput("125", true, 2, 100)).toBe("100");
		expect(parseGroupedInput("250", false, undefined, 100)).toBe("100");
		expect(parseGroupedInput("99,99", true, 2, 100)).toBe("99.99");
	});

	it("strictly strips decimals and fractions when allowDecimal is false", () => {
		expect(parseGroupedInput("100,50", false)).toBe("100");
		expect(parseGroupedInput("25,0000", false)).toBe("25");
		expect(parseGroupedInput("1.500,75", false)).toBe("1500");
		expect(parseGroupedInput("10.000", false)).toBe("10000");
		expect(formatGroupedInput(parseGroupedInput("1.500,75", false), false)).toBe("1.500");
	});
});

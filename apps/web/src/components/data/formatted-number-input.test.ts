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
		for (const raw of ["0.5", "25.0001", "25.", "100"]) {
			expect(parseGroupedInput(formatGroupedInput(raw, true), true)).toBe(
				raw,
			);
		}
	});
});

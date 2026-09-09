import { describe, expect, it } from "vitest";
import { DecimalCalc, formatBigInt, toBigInt } from "./decimal";

describe("DecimalCalc fixed-point arithmetic", () => {
	it("normalizes positive and negative values at six decimals", () => {
		expect(toBigInt("12.3456789")).toBe(12_345_678n);
		expect(toBigInt("-0.25")).toBe(-250_000n);
		expect(formatBigInt(12_345_000n)).toBe("12.345");
		expect(formatBigInt(-250_000n)).toBe("-0.25");
	});

	it("supports exact add, subtract, multiply, and divide", () => {
		expect(DecimalCalc.add("0.1", "0.2")).toBe("0.3");
		expect(DecimalCalc.sub("1", "0.35")).toBe("0.65");
		expect(DecimalCalc.mul("1.25", "8")).toBe("10");
		expect(DecimalCalc.div("1", "4")).toBe("0.25");
	});

	it("rounds half up for positive and negative values", () => {
		expect(DecimalCalc.roundHalfUp("1.235", 2)).toBe("1.24");
		expect(DecimalCalc.roundHalfUp("-1.235", 2)).toBe("-1.24");
		expect(DecimalCalc.roundHalfUp("12.9", 0)).toBe("13");
	});

	it("rejects division by zero and compares fixed-point values", () => {
		expect(() => DecimalCalc.div("1", "0")).toThrow("Division by zero");
		expect(DecimalCalc.gt("1.01", "1")).toBe(true);
		expect(DecimalCalc.gte("1", "1.000000")).toBe(true);
		expect(DecimalCalc.lt("0.99", "1")).toBe(true);
		expect(DecimalCalc.lte("1", "1")).toBe(true);
		expect(DecimalCalc.eq("1.000000", "1")).toBe(true);
	});
});

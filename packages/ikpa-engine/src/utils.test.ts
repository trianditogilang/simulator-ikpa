import { describe, expect, it } from "vitest";
import {
	add,
	div,
	fromFixedPoint,
	mul,
	parseDecimal,
	round,
	sub,
	toFixedPoint,
} from "./utils";

describe("decimal utility compatibility helpers", () => {
	it("parses numeric strings and preserves numeric inputs", () => {
		expect(parseDecimal("12.50")).toBe(12.5);
		expect(parseDecimal(12.5)).toBe(12.5);
	});

	it("round-trips fixed point values", () => {
		const fixed = toFixedPoint("12.34567891");
		expect(fixed).toBe(1_234_567_891);
		expect(fromFixedPoint(fixed)).toBe(12.34567891);
	});

	it("keeps addition and subtraction deterministic for decimal strings", () => {
		expect(add("0.1", "0.2")).toBe("0.3");
		expect(sub("1.00", "0.35")).toBe("0.65");
	});

	it("handles multiplication, division, and zero division", () => {
		expect(mul("1.25", "8")).toBe("10");
		expect(div("1", "4")).toBe("0.25");
		expect(div("1", "0")).toBe("0");
	});

	it("rounds to the requested number of fraction digits", () => {
		expect(round("12.345", 2)).toBe("12.35");
		expect(round("12", 3)).toBe("12.000");
	});
});

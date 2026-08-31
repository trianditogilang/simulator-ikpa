import { describe, expect, it } from "vitest";
import {
	formatDate,
	formatNumber,
	formatPercent,
	formatPermille,
	formatPointDelta,
	formatRupiah,
	formatScore,
	formatTimeWIB,
	formatValue,
} from "./format";

describe("format lokal Indonesia", () => {
	it("formats monetary, percentage, permille, and score values", () => {
		expect(formatRupiah(1_250_000)).toBe("Rp1.250.000");
		expect(formatPercent(88.4)).toBe("88,40%");
		expect(formatPermille("4.62")).toBe("4,62‰");
		expect(formatNumber(94.2)).toBe("94,20");
		expect(formatValue(92.67)).toBe("92,67");
		expect(formatScore(92.67)).toBe("92,67");
	});

	it("formats dates and times in WIB", () => {
		const timestamp = "2026-08-31T02:00:00.000Z";

		expect(formatDate(timestamp)).toBe("31 Agu 2026");
		expect(formatTimeWIB(timestamp)).toBe("09.00 WIB");
	});

	it("formats point deltas with Indonesian display signs", () => {
		expect(formatPointDelta(1.55)).toBe("+1,55 poin");
		expect(formatPointDelta(-0.8)).toBe("−0,80 poin");
		expect(formatPointDelta(0)).toBe("0,00 poin");
	});

	it("rejects invalid numeric and date input", () => {
		expect(() => formatNumber("not-a-number")).toThrow(RangeError);
		expect(() => formatDate("not-a-date")).toThrow(RangeError);
	});
});

import { describe, expect, it } from "vitest";
import {
	formatDate,
	formatDateDDMMYYYY,
	formatDynamicNumber,
	formatDynamicPercent,
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
		expect(formatDynamicPercent(100)).toBe("100%");
		expect(formatDynamicPercent(80)).toBe("80%");
		expect(formatDynamicPercent(80.5)).toBe("80,5%");
		expect(formatDynamicPercent(80.55)).toBe("80,55%");
		expect(formatDynamicNumber(100)).toBe("100");
		expect(formatDynamicNumber(25.5, 4)).toBe("25,5");
		expect(formatPermille("4.62")).toBe("4,62‰");
		expect(formatNumber(94.2)).toBe("94,20");
		expect(formatValue(92.67)).toBe("92,67");
		expect(formatScore(92.67)).toBe("92,67");
	});

	it("formats dates and times in WIB and DD-MM-YYYY", () => {
		const timestamp = "2026-08-31T02:00:00.000Z";

		expect(formatDate(timestamp)).toBe("31 Agu 2026");
		expect(formatDateDDMMYYYY("2026-10-07")).toBe("07-10-2026");
		expect(formatDateDDMMYYYY(timestamp)).toBe("31-08-2026");
		expect(formatDateDDMMYYYY(null)).toBe("—");
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

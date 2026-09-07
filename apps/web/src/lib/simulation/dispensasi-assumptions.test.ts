import { describe, expect, it } from "vitest";
import { calcDispensasiPreview } from "./dispensasi-assumptions";

describe("calcDispensasiPreview", () => {
	it("24/5214 → rasio 4.60 permil → pengurang 0.75 (Golden Case)", () => {
		const p = calcDispensasiPreview({ dispensationCount: 24, totalSpmQ4: 5214 });
		expect(p.isValid).toBe(true);
		expect(p.ratio).toBe(4.6);
		expect(p.ratioFormatted).toBe("4,60");
		expect(p.category).toBe(4);
		expect(p.deduction).toBe(0.75);
	});

	it("total 0 → pengurang 0", () => {
		const p = calcDispensasiPreview({ dispensationCount: 0, totalSpmQ4: 0 });
		expect(p.isValid).toBe(true);
		expect(p.category).toBe(1);
		expect(p.deduction).toBe(0);
	});

	it("dispensasi > total → invalid", () => {
		const p = calcDispensasiPreview({ dispensationCount: 5, totalSpmQ4: 3 });
		expect(p.isValid).toBe(false);
		expect(p.message).toBe("Dispensasi tidak boleh melebihi total SPM Q4.");
	});

	it("0/100 → rasio 0.00 permil → pengurang 0.00", () => {
		const p = calcDispensasiPreview({ dispensationCount: 0, totalSpmQ4: 100 });
		expect(p.isValid).toBe(true);
		expect(p.category).toBe(1);
		expect(p.deduction).toBe(0);
	});
});

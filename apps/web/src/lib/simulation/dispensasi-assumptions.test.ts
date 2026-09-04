import { describe, expect, it } from "vitest";
import { calcDispensasiPreview } from "./dispensasi-assumptions";

describe("calcDispensasiPreview", () => {
	it("24/5200 → rasio 4.615 permil → pengurang 0.75", () => {
		const p = calcDispensasiPreview({ dispensationCount: 24, totalSpmQ4: 5200 });
		expect(p.isValid).toBe(true);
		expect(p.ratio).toBeCloseTo(4.615, 3);
		expect(p.deduction).toBe(0.75);
	});
	it("total 0 → pengurang 0", () => {
		const p = calcDispensasiPreview({ dispensationCount: 0, totalSpmQ4: 0 });
		expect(p.deduction).toBe(0);
	});
	it("dispensasi > total → invalid", () => {
		const p = calcDispensasiPreview({ dispensationCount: 5, totalSpmQ4: 3 });
		expect(p.isValid).toBe(false);
	});
});

import { describe, expect, it } from "vitest";
import { default2026RuleSet } from "@simulator-ikpa/ikpa-engine";
import {
	accountQuarterScore,
	buildAbsorptionQuarters,
	calcPenyerapanScore,
	quarterOfMonth,
	quarterTarget,
} from "./penyerapan-workspace";

describe("quarterOfMonth", () => {
	it("memetakan bulan ke triwulan", () => {
		expect(quarterOfMonth(1)).toBe(1);
		expect(quarterOfMonth(3)).toBe(1);
		expect(quarterOfMonth(4)).toBe(2);
		expect(quarterOfMonth(9)).toBe(3);
		expect(quarterOfMonth(12)).toBe(4);
	});
});

describe("buildAbsorptionQuarters", () => {
	it("menjumlah realisasi per triwulan s.d. bulan berjalan", () => {
		const quarters = buildAbsorptionQuarters(
			{ "51": 1000 },
			{ 1: { "51": 50 }, 2: { "51": 50 }, 3: { "51": 100 } },
			{},
			3,
		);
		expect(quarters[0].realized["51"]).toBe("200.00");
		expect(quarters[0].budget["51"]).toBe("1000.00");
		expect(quarters[1].realized["51"]).toBe("0.00");
	});

	it("menggabung actual YTD dengan rencana sisa tahun tanpa menimpa actual", () => {
		const actual = { 3: { "51": 100 } };
		const snapshot = JSON.parse(JSON.stringify(actual));
		const quarters = buildAbsorptionQuarters(
			{ "51": 1000 },
			actual,
			{ 4: { "51": 500 } },
			3,
		);
		expect(quarters[0].realized["51"]).toBe("100.00");
		expect(quarters[1].realized["51"]).toBe("500.00");
		expect(actual).toEqual(snapshot);
	});
});

describe("calcPenyerapanScore", () => {
	it("menghitung skor via engine sesuai target triwulan", () => {
		const quarters = buildAbsorptionQuarters(
			{ "51": 1000 },
			{ 1: { "51": 100 } },
			{},
			3,
		);
		const result = calcPenyerapanScore(quarters, false, default2026RuleSet);
		expect(result.score).toBe(12.5);
		expect(result.contribution).toBe(2.5);
		expect(result.status).toBe("complete");
	});

	it("mencapai 100 saat seluruh triwulan tepat target", () => {
		const quarters = buildAbsorptionQuarters(
			{ "51": 1000 },
			{ 1: { "51": 200 }, 4: { "51": 500 }, 7: { "51": 750 }, 10: { "51": 950 } },
			{},
			12,
		);
		const result = calcPenyerapanScore(quarters, false, default2026RuleSet);
		expect(result.score).toBe(100);
		expect(result.contribution).toBe(20);
	});
});

describe("accountQuarterScore", () => {
	it("cap 100 untuk realisasi berlebih", () => {
		expect(accountQuarterScore(100, 1000, 20)).toBe(50);
		expect(accountQuarterScore(2000, 1000, 20)).toBe(100);
		expect(accountQuarterScore(100, 0, 20)).toBe(0);
	});
});

describe("quarterTarget", () => {
	it("mengambil target dari rule set 2026", () => {
		expect(quarterTarget(default2026RuleSet, "51", 1)).toBe(20);
		expect(quarterTarget(default2026RuleSet, "52", 2)).toBe(50);
		expect(quarterTarget(default2026RuleSet, "53", 3)).toBe(70);
		expect(quarterTarget(default2026RuleSet, "57", 4)).toBe(95);
	});
});

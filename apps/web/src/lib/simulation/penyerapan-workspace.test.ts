import { describe, expect, it } from "vitest";
import { default2026RuleSet } from "@simulator-ikpa/ikpa-engine";
import {
	accountQuarterScore,
	buildAbsorptionQuarters,
	calcPenyerapanScore,
	calcQuarterDetails,
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
	it("menjumlah realisasi secara akumulatif (bulan 1 s.d. akhir triwulan)", () => {
		// Bulan 1: 50, Bulan 2: 50, Bulan 3: 100 -> TW1 akumulatif = 200
		// Bulan 4: 100, Bulan 5: 100, Bulan 6: 100 -> TW2 akumulatif (1..6) = 500
		const actual = {
			1: { "51": 50 },
			2: { "51": 50 },
			3: { "51": 100 },
			4: { "51": 100 },
			5: { "51": 100 },
			6: { "51": 100 },
		};
		const quarters = buildAbsorptionQuarters({ "51": 1000 }, actual, {}, 6);
		expect(quarters).toHaveLength(2); // Evaluated up to TW2
		expect(quarters[0].realized["51"]).toBe("200.00");
		expect(quarters[0].budget["51"]).toBe("1000.00");
		expect(quarters[1].realized["51"]).toBe("500.00"); // Jan..Jun = 500
		expect(quarters[1].budget["51"]).toBe("1000.00");
	});

	it("mendukung pagu cut-off per triwulan", () => {
		const quarterPagu = {
			1: { "51": 1000, "52": 500 },
			2: { "51": 1200, "52": 600 },
		};
		const quarters = buildAbsorptionQuarters(
			quarterPagu,
			{ 1: { "51": 100 } },
			{},
			6,
			2,
		);
		expect(quarters[0].budget["51"]).toBe("1000.00");
		expect(quarters[0].budget["52"]).toBe("500.00");
		expect(quarters[1].budget["51"]).toBe("1200.00");
		expect(quarters[1].budget["52"]).toBe("600.00");
	});

	it("menggabung actual dengan rencana simulasi sisa tahun secara akumulatif", () => {
		const actual = { 1: { "51": 50 }, 2: { "51": 50 }, 3: { "51": 100 } };
		const plan = { 4: { "51": 150 }, 5: { "51": 150 } };
		const quarters = buildAbsorptionQuarters({ "51": 1000 }, actual, plan, 3);
		// With plan in month 4 and 5, max planned quarter is Q2
		expect(quarters).toHaveLength(2);
		expect(quarters[0].realized["51"]).toBe("200.00");
		expect(quarters[1].realized["51"]).toBe("500.00"); // Jan-Mar (200) + Apr-May plan (300) = 500
	});
});

describe("calcQuarterDetails", () => {
	it("menghitung rincian per akun pada triwulan yang dipilih", () => {
		// Test TW1 Golden Test numbers
		const details = calcQuarterDetails(
			1,
			{ "51": 250, "52": 200, "53": 50 },
			{ 1: { "51": 60, "52": 24.5, "53": 7 } },
			{},
			3,
			default2026RuleSet,
		);

		expect(details.totalPagu).toBe(500);
		expect(details.totalRealized).toBe(91.5);
		expect(details.totalTargetRp).toBe(85); // 50 + 30 + 5

		const r51 = details.rows.find((r) => r.acc === "51")!;
		expect(r51.pagu).toBe(250);
		expect(r51.realizedCumulative).toBe(60);
		expect(r51.targetPercent).toBe(20);
		expect(r51.targetRp).toBe(50);
		expect(r51.penyerapanVsTarget).toBe(100);
		expect(r51.proporsiPagu).toBe(0.5);
		expect(r51.nilaiTertimbang).toBe(50);
		expect(r51.sisaKebutuhan).toBe(0);

		const r52 = details.rows.find((r) => r.acc === "52")!;
		expect(r52.pagu).toBe(200);
		expect(r52.realizedCumulative).toBe(24.5);
		expect(r52.targetPercent).toBe(15);
		expect(r52.targetRp).toBe(30);
		expect(r52.penyerapanVsTarget).toBeCloseTo(81.6667, 3);
		expect(r52.proporsiPagu).toBe(0.4);
		expect(r52.nilaiTertimbang).toBeCloseTo(32.6667, 3);
		expect(r52.sisaKebutuhan).toBe(5.5);

		expect(details.nilaiKinerjaQuarter).toBeCloseTo(92.6667, 3);
	});
});

describe("calcPenyerapanScore", () => {
	it("lulus Golden Test A (TW1 = 92.67)", () => {
		const quarters = buildAbsorptionQuarters(
			{ "51": 250, "52": 200, "53": 50 },
			{ 1: { "51": 60, "52": 24.5, "53": 7 } },
			{},
			3,
		);
		const result = calcPenyerapanScore(quarters, false, default2026RuleSet);
		expect(result.score).toBe(92.67);
		expect(result.contribution).toBe(18.53);
		expect(result.status).toBe("complete");
	});

	it("lulus Golden Test B (TW2 = 85.15 dengan pagu cut-off berbeda)", () => {
		const quarterPagu = {
			1: { "51": 250, "52": 200, "53": 50 },
			2: { "51": 250, "52": 250, "53": 50 },
		};
		// Realisasi bulan 1..3: 60, 24.5, 7 (Total TW1 = 60, 24.5, 7)
		// Realisasi bulan 4..6: 104, 39, 15 (Total Jan..Jun = 164, 63.5, 22)
		const actual = {
			1: { "51": 60, "52": 24.5, "53": 7 },
			4: { "51": 104, "52": 39, "53": 15 },
		};
		const quarters = buildAbsorptionQuarters(quarterPagu, actual, {}, 6);
		expect(quarters).toHaveLength(2);
		expect(quarters[0].realized["51"]).toBe("60.00");
		expect(quarters[1].realized["51"]).toBe("164.00");
		expect(quarters[1].realized["52"]).toBe("63.50");
		expect(quarters[1].realized["53"]).toBe("22.00");

		const result = calcPenyerapanScore(quarters, false, default2026RuleSet);
		expect(result.score).toBe(85.15);
		expect(result.contribution).toBe(17.03);
		expect(result.status).toBe("complete");
	});

	it("mencapai 100 saat seluruh triwulan tepat target", () => {
		const quarters = buildAbsorptionQuarters(
			{ "51": 1000 },
			{ 1: { "51": 200 }, 4: { "51": 300 }, 7: { "51": 250 }, 10: { "51": 200 } },
			{},
			12,
		);
		// Cumulative: Q1=200 (target 200), Q2=500 (target 500), Q3=750 (target 750), Q4=950 (target 950)
		const result = calcPenyerapanScore(quarters, false, default2026RuleSet);
		expect(result.score).toBe(100);
		expect(result.contribution).toBe(20);
	});
});

describe("accountQuarterScore", () => {
	it("cap 100 untuk realisasi berlebih dan 0 jika tidak ada pagu", () => {
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


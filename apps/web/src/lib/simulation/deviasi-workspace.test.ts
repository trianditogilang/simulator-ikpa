import { describe, expect, it } from "vitest";
import { default2026RuleSet } from "@simulator-ikpa/ikpa-engine";
import {
	buildDeviationInput,
	calcDeviasiScore,
	calcMonthDeviation,
	calcNextMonthTarget,
	calculateHistoricalTrail,
	deviationOf,
	getQuarterlyRpdReminders,
	paguWeights,
} from "./deviasi-workspace";

describe("paguWeights", () => {
	it("menghitung proporsi bobot pagu", () => {
		const weights = paguWeights({ "51": 500, "52": 500, "53": 0, "57": 0 });
		expect(weights["51"]).toBe(0.5);
		expect(weights["52"]).toBe(0.5);
	});
});

describe("buildDeviationInput", () => {
	it("membangun array bulan dinamis s.d. bulan berjalan (Januari n=1)", () => {
		const input = buildDeviationInput(
			{ "51": 1000 },
			{ 1: { "51": 100 } },
			{ 1: { "51": 98 } },
			{},
			{},
			1,
		);
		expect(input.months).toHaveLength(1);
		expect(input.months[0].planned["51"]).toBe("100.00");
		expect(input.months[0].realized["51"]).toBe("98.00");
		expect(input.budgetByType["51"]).toBe("1000.00");
	});

	it("memperluas n jika ada rencana di bulan masa depan", () => {
		const rpd = { 1: { "51": 100 } };
		const actual = { 1: { "51": 90 } };
		const snapshot = JSON.parse(JSON.stringify({ rpd, actual }));
		const input = buildDeviationInput(
			{ "51": 1000 },
			rpd,
			actual,
			{ 5: { "51": 200 } },
			{ 5: { "51": 190 } },
			3,
		);
		expect(input.months).toHaveLength(5);
		expect(input.months[0].planned["51"]).toBe("100.00");
		expect(input.months[4].planned["51"]).toBe("200.00");
		expect(input.months[4].realized["51"]).toBe("190.00");
		expect({ rpd, actual }).toEqual(snapshot);
	});

	it("evalMonths eksplisit menetapkan panjang bulan", () => {
		const input = buildDeviationInput(
			{ "51": 1000 },
			{ 1: { "51": 100 } },
			{ 1: { "51": 90 } },
			{},
			{},
			1,
			11,
		);
		expect(input.months).toHaveLength(11);
	});
});

describe("calcDeviasiScore & Golden Tests", () => {
	it("Golden Test Jan: n=1, dev 4% => Nilai 100", () => {
		const pagu = { "51": 500, "52": 400, "53": 100, "57": 0 };
		const rpd = { 1: { "51": 100, "52": 100, "53": 100, "57": 0 } };
		const actual = { 1: { "51": 100, "52": 90, "53": 100, "57": 0 } }; // 52 dev 10% * 0.4 = 4%

		const input = buildDeviationInput(pagu, rpd, actual, {}, {}, 1);
		const result = calcDeviasiScore(input, default2026RuleSet);

		expect(result.monthsCount).toBe(1);
		expect(result.avgDeviation).toBeCloseTo(4.0, 2);
		expect(result.score).toBe(100);
		expect(result.contribution).toBeCloseTo(15.0, 2);
	});

	it("Golden Test Feb: n=2, bulan 1 = 4%, bulan 2 = 13% => Nilai 91.5", () => {
		const pagu = { "51": 500, "52": 400, "53": 100, "57": 0 };
		const rpd = {
			1: { "51": 100, "52": 100, "53": 100, "57": 0 },
			2: { "51": 100, "52": 100, "53": 100, "57": 0 },
		};
		const actual = {
			1: { "51": 100, "52": 90, "53": 100, "57": 0 }, // 4%
			2: { "51": 87, "52": 87, "53": 87, "57": 0 }, // 13%
		};

		const input = buildDeviationInput(pagu, rpd, actual, {}, {}, 2);
		const result = calcDeviasiScore(input, default2026RuleSet);

		expect(result.monthsCount).toBe(2);
		expect(result.avgDeviation).toBeCloseTo(8.5, 2);
		expect(result.score).toBeCloseTo(91.5, 2);
	});

	it("Golden Test Mar: n=3, bulan 1=4%, bulan 2=13%, bulan 3=18% => Nilai 88.33", () => {
		const pagu = { "51": 500, "52": 400, "53": 100, "57": 0 };
		const rpd = {
			1: { "51": 100, "52": 100, "53": 100, "57": 0 },
			2: { "51": 100, "52": 100, "53": 100, "57": 0 },
			3: { "51": 100, "52": 100, "53": 100, "57": 0 },
		};
		const actual = {
			1: { "51": 100, "52": 90, "53": 100, "57": 0 }, // 4%
			2: { "51": 87, "52": 87, "53": 87, "57": 0 }, // 13%
			3: { "51": 82, "52": 82, "53": 82, "57": 0 }, // 18%
		};

		const input = buildDeviationInput(pagu, rpd, actual, {}, {}, 3);
		const result = calcDeviasiScore(input, default2026RuleSet);

		expect(result.monthsCount).toBe(3);
		expect(result.avgDeviation).toBeCloseTo(11.67, 2);
		expect(result.score).toBeCloseTo(88.33, 2);
	});

	it("Golden Test Mei: n=5, sum = 41.05, avg = 8.21 => Nilai 91.79", () => {
		const pagu = { "51": 100, "52": 100, "53": 0, "57": 0 };
		const rpd = {
			1: { "51": 100, "52": 100 },
			2: { "51": 100, "52": 100 },
			3: { "51": 100, "52": 100 },
			4: { "51": 100, "52": 100 },
			5: { "51": 100, "52": 100 },
		};
		const actual = {
			1: { "51": 96, "52": 96 }, // 4%
			2: { "51": 87, "52": 87 }, // 13%
			3: { "51": 92, "52": 92 }, // 8%
			4: { "51": 92.95, "52": 92.95 }, // 7.05%
			5: { "51": 91, "52": 91 }, // 9%
		};

		const input = buildDeviationInput(pagu, rpd, actual, {}, {}, 5);
		const result = calcDeviasiScore(input, default2026RuleSet);

		expect(result.monthsCount).toBe(5);
		expect(result.avgDeviation).toBeCloseTo(8.21, 2);
		expect(result.score).toBeCloseTo(91.79, 2);
	});
});

describe("deviationOf", () => {
	it("nol vs nol = 0, real tanpa rencana = 100, cap 100", () => {
		expect(deviationOf(0, 0)).toBe(0);
		expect(deviationOf(0, 10)).toBe(100);
		expect(deviationOf(100, 50)).toBe(50);
		expect(deviationOf(100, 500)).toBe(100);
	});
});

describe("calcMonthDeviation", () => {
	it("menghitung deviasi akun dan tertimbang bulanan", () => {
		const pagu = { "51": 500, "52": 500 };
		const rpd = { "51": 100, "52": 100 };
		const real = { "51": 90, "52": 100 };
		const res = calcMonthDeviation(rpd, real, pagu);

		expect(res.accountDeviations["51"]).toBe(10);
		expect(res.accountDeviations["52"]).toBe(0);
		expect(res.monthWeightedDeviation).toBe(5);
		expect(res.hasData).toBe(true);
	});
});

describe("calculateHistoricalTrail", () => {
	it("menghasilkan jejak historis kumulatif yang tepat", () => {
		const pagu = { "51": 1000 };
		const rpd = { 1: { "51": 100 }, 2: { "51": 100 } };
		const actual = { 1: { "51": 96 }, 2: { "51": 90 } };
		const trail = calculateHistoricalTrail(pagu, rpd, actual, 2);

		expect(trail).toHaveLength(2);
		expect(trail[0].monthWeightedDev).toBe(4);
		expect(trail[0].cumulativeAvg).toBe(4);
		expect(trail[0].cumulativeScore).toBe(100);

		expect(trail[1].monthWeightedDev).toBe(10);
		expect(trail[1].cumulativeAvg).toBe(7);
		expect(trail[1].cumulativeScore).toBe(93);
	});
});

describe("calcNextMonthTarget", () => {
	it("target tercapai saat rata-rata masih dalam toleransi", () => {
		const res = calcNextMonthTarget(4.0, 1);
		expect(res.isReachable).toBe(true);
		expect(res.targetPerMonth).toBe(6.0); // 5*2 - 4 = 6%
	});

	it("proyeksi target realistis saat rata-rata di atas 5%", () => {
		const res = calcNextMonthTarget(11.67, 3, 6);
		expect(res.isReachable).toBe(false);
		expect(res.bestPossibleScore).toBeCloseTo(94.16, 1);
	});
});

describe("getQuarterlyRpdReminders", () => {
	it("mengembalikan 4 triwulan dan mendeteksi triwulan aktif", () => {
		const q = getQuarterlyRpdReminders(2); // Februari -> TW1
		expect(q).toHaveLength(4);
		expect(q[0].isCurrentQuarter).toBe(true);
		expect(q[0].deadlineNotice).toContain("Februari");
	});
});


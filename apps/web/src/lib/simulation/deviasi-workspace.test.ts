import { describe, expect, it } from "vitest";
import { default2026RuleSet } from "@simulator-ikpa/ikpa-engine";
import {
	buildDeviationInput,
	calcDeviasiScore,
	deviationOf,
	paguWeights,
} from "./deviasi-workspace";

describe("buildDeviationInput", () => {
	it("membangun 11 bulan, Desember tak dihitung engine", () => {
		const input = buildDeviationInput(
			{ "51": 1000 },
			{ 1: { "51": 100 } },
			{ 1: { "51": 98 } },
			{},
			{},
			3,
		);
		expect(input.months).toHaveLength(11);
		expect(input.months[0].planned["51"]).toBe("100.00");
		expect(input.months[0].realized["51"]).toBe("98.00");
		expect(input.budgetByType["51"]).toBe("1000.00");
	});

	it("menggabung actual YTD dengan rencana tanpa menimpa actual", () => {
		const rpd = { 1: { "51": 100 } };
		const actual = { 1: { "51": 90 } };
		const snapshot = JSON.parse(JSON.stringify({ rpd, actual }));
		const input = buildDeviationInput({ "51": 1000 }, rpd, actual, { 5: { "51": 200 } }, { 5: { "51": 190 } }, 3);
		expect(input.months[0].planned["51"]).toBe("100.00");
		expect(input.months[4].planned["51"]).toBe("200.00");
		expect(input.months[4].realized["51"]).toBe("190.00");
		expect({ rpd, actual }).toEqual(snapshot);
	});
});

describe("calcDeviasiScore", () => {
	it("skor 100 saat deviasi di bawah 5%", () => {
		const input = buildDeviationInput(
			{ "51": 100, "52": 100 },
			{ 1: { "51": 100, "52": 100 } },
			{ 1: { "51": 98, "52": 97 } },
			{},
			{},
			1,
		);
		const result = calcDeviasiScore(
			{ ...input, months: input.months.slice(0, 1) },
			default2026RuleSet,
		);
		expect(result.score).toBe(100);
		expect(result.status).toBe("incomplete");
	});

	it("skor via engine 50 saat deviasi 50%", () => {
		const input = buildDeviationInput(
			{ "51": 100, "52": 100 },
			{ 1: { "51": 100, "52": 100 } },
			{ 1: { "51": 50, "52": 50 } },
			{},
			{},
			1,
		);
		const result = calcDeviasiScore(
			{ ...input, months: input.months.slice(0, 1) },
			default2026RuleSet,
		);
		expect(result.score).toBe(50);
		expect(result.avgDeviation).toBe(50);
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

describe("paguWeights", () => {
	it("proporsi pagu dari sumber yang sama dengan Penyerapan", () => {
		const w = paguWeights({ "51": 100, "52": 300 });
		expect(w["51"]).toBeCloseTo(0.25);
		expect(w["52"]).toBeCloseTo(0.75);
		expect(w["53"]).toBe(0);
	});
});

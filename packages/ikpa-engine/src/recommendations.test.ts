import { describe, expect, it } from "vitest";
import { generateRecommendations } from "./recommendations";
import { default2026RuleSet } from "./rule-set";
import type { IndicatorCalculation } from "./types";

describe("generateRecommendations", () => {
	it("returns empty array for empty indicators", () => {
		const recs = generateRecommendations([], "95", default2026RuleSet);
		expect(recs).toHaveLength(0);
	});

	it("skips incomplete indicators", () => {
		const indicators: IndicatorCalculation[] = [
			{
				key: "dipa_revision",
				label: "Revisi DIPA",
				weight: "10",
				score: null,
				weightedContribution: null,
				status: "incomplete",
				formulaTrace: [],
				warnings: [],
			},
		];
		const recs = generateRecommendations(indicators, "95", default2026RuleSet);
		expect(recs).toHaveLength(0);
	});

	it("calculates priority correctly and sorts by priority score", () => {
		const indicators: IndicatorCalculation[] = [
			{
				key: "dipa_revision",
				label: "Revisi DIPA",
				weight: "10",
				score: "90", // gap = 10, low urgency (1), priorityScore = 10 * 10 * 1 = 100
				weightedContribution: "9",
				status: "complete",
				formulaTrace: [],
				warnings: [],
			},
			{
				key: "rpd_deviation",
				label: "Deviasi Halaman III DIPA",
				weight: "15",
				score: "70", // gap = 30, high urgency (3), priorityScore = 15 * 30 * 3 = 1350
				weightedContribution: "10.5",
				status: "complete",
				formulaTrace: [],
				warnings: [],
			},
			{
				key: "budget_absorption",
				label: "Penyerapan Anggaran",
				weight: "20",
				score: "80", // gap = 20, medium urgency (2), priorityScore = 20 * 20 * 2 = 800
				weightedContribution: "16",
				status: "complete",
				formulaTrace: [],
				warnings: [],
			},
		];

		const recs = generateRecommendations(indicators, "95", default2026RuleSet);
		
		expect(recs).toHaveLength(3);
		expect(recs[0].indicatorKey).toBe("rpd_deviation"); // 1350
		expect(recs[1].indicatorKey).toBe("budget_absorption"); // 800
		expect(recs[2].indicatorKey).toBe("dipa_revision"); // 100
		
		expect(recs[0].priority).toBe(1);
		expect(recs[1].priority).toBe(2);
		expect(recs[2].priority).toBe(3);
		
		expect(recs[0].urgency).toBe("high");
		expect(recs[1].urgency).toBe("medium");
		expect(recs[2].urgency).toBe("low");
	});

	it("uses stable tie-break by indicator key alphabetically when priority scores are equal", () => {
		const indicators: IndicatorCalculation[] = [
			{
				key: "rpd_deviation", // gap = 10, weight = 10 (modified for test), score = 100
				label: "Deviasi Halaman III DIPA",
				weight: "10",
				score: "90", 
				weightedContribution: "9",
				status: "complete",
				formulaTrace: [],
				warnings: [],
			},
			{
				key: "dipa_revision", // gap = 10, weight = 10, score = 100
				label: "Revisi DIPA",
				weight: "10",
				score: "90",
				weightedContribution: "9",
				status: "complete",
				formulaTrace: [],
				warnings: [],
			},
		];

		const recs = generateRecommendations(indicators, "95", default2026RuleSet);
		
		expect(recs).toHaveLength(2);
		// dipa_revision comes before rpd_deviation alphabetically
		expect(recs[0].indicatorKey).toBe("dipa_revision");
		expect(recs[1].indicatorKey).toBe("rpd_deviation");
	});

	it("maps deep link keys correctly", () => {
		const indicators: IndicatorCalculation[] = [
			{
				key: "dipa_revision",
				label: "Revisi DIPA",
				weight: "10",
				score: "90",
				weightedContribution: "9",
				status: "complete",
				formulaTrace: [],
				warnings: [],
			},
		];

		const recs = generateRecommendations(indicators, "95", default2026RuleSet);
		expect(recs[0].deepLinkKey).toBe("budget-revisions");
	});
});

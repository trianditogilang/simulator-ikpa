import { describe, expect, it } from "vitest";
import { default2026RuleSet } from "../rule-set";
import { calculateContractual } from "./contractual";

describe("calculateContractual", () => {
	it("returns 100 for all subcomponents if empty contracts", () => {
		const result = calculateContractual(
			{ contracts: [], accelerations53: [] },
			default2026RuleSet,
		);
		expect(result.score).toBe("100.00");
		expect(result.subComponents).toBeDefined();
		expect(result.subComponents![0].score).toBe("100");
		expect(result.warnings.some((w) => w.includes("Tidak ada kontrak"))).toBe(
			true,
		);
	});

	it("calculates distribution, early procurement, and acceleration properly", () => {
		const result = calculateContractual(
			{
				contracts: [
					{
						id: "c1",
						amount: "100000000",
						signedDate: "2026-02-15",
						submittedDate: "2026-02-16",
						isEarlyProcurement: false,
					},
					{
						id: "c2",
						amount: "100000000",
						signedDate: "2026-07-15", // After Q2
						submittedDate: "2026-07-16",
						isEarlyProcurement: false,
					},
				],
				accelerations53: [
					{
						id: "a1",
						amount: "100000000", // eligible 50-200
						signedDate: "2026-02-15", // Q1 completed
					},
					{
						id: "a2",
						amount: "100000000", // eligible 50-200
						signedDate: "2026-04-15", // Not Q1 completed
					},
				],
			},
			default2026RuleSet,
		);

		// Expected distribution ratio: 1/2 = 50%
		// 50% in buckets: { min: "25.01", max: "50", score: "60" } -> 60 score
		// Weight 20% -> 12

		// Expected early procurement:
		// c1: signed Feb -> 110. c2: signed July -> 0.
		// Avg = 110*1 + 0*1 / 2 = 55
		// Weight 40% -> 22

		// Expected acc53:
		// a1: Q1 completed -> 1. a2: Q2 -> 0.
		// Ratio = 50% -> score 50.
		// Weight 40% -> 20

		// Final = 12 + 22 + 20 = 54.00

		expect(result.score).toBe("54.00");
		expect(result.subComponents![0].score).toBe("60"); // Distribution
		expect(result.subComponents![1].score).toBe("55.0000"); // Early
		expect(result.subComponents![2].score).toBe("50.0000"); // Acc53
	});
});

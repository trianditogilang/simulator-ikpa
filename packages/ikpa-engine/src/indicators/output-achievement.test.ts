import { describe, expect, it } from "vitest";
import { calculateOutputAchievement } from "./output-achievement";
import { default2026RuleSet } from "../rule-set";
import type { OutputAchievementInput } from "../types";

describe("F6-09 Capaian Output", () => {
	it("returns incomplete when no reports exist", () => {
		const result = calculateOutputAchievement(
			{ reports: [] },
			default2026RuleSet,
		);
		expect(result.status).toBe("incomplete");
		expect(result.score).toBeNull();
	});

	it("calculates correctly with normal reports", () => {
		const input: OutputAchievementInput = {
			reports: [
				{
					id: "1",
					period: 1,
					target: "100",
					realized: "50", // 50%
					reportedDate: "2026-02-05",
					deadlineDate: "2026-02-07", // on time (100)
				},
				{
					id: "2",
					period: 2,
					target: "200",
					realized: "250", // 125% -> capped to 100%
					reportedDate: "2026-03-10",
					deadlineDate: "2026-03-07", // late (0)
				},
			],
		};

		const result = calculateOutputAchievement(input, default2026RuleSet);

		// Timeliness: 1 on-time, 1 late = (100 + 0) / 2 = 50
		// Achievement: period 1 (50%), period 2 (100% cap) = (50 + 100) / 2 = 75
		// Score = 30% * 50 + 70% * 75 = 15 + 52.5 = 67.5
		expect(result.score).toBe("67.50");
		expect(result.status).toBe("complete");

		expect(result.subComponents).toBeDefined();
		const timeliness = result.subComponents!.find(
			(c) => c.key === "timeliness",
		)!;
		expect(timeliness.score).toBe("50.00");

		const achievement = result.subComponents!.find(
			(c) => c.key === "achievement",
		)!;
		expect(achievement.score).toBe("75.00");
	});

	it("handles December special case (OUT-004 assumption)", () => {
		const input: OutputAchievementInput = {
			reports: [
				{
					id: "1",
					period: 12,
					target: "100",
					realized: "0", // Should be ignored, assumed 100%
					reportedDate: "2027-01-05",
					deadlineDate: "2027-01-07", // on time
				},
			],
		};

		const result = calculateOutputAchievement(input, default2026RuleSet);

		// Timeliness: 100
		// Achievement: 100 (December assumption)
		// Score = 100
		expect(result.score).toBe("100.00");
		expect(result.warnings.some((w) => w.includes("OUT-004"))).toBe(true);
	});

	it("handles zero target by skipping period and generating warning", () => {
		const input: OutputAchievementInput = {
			reports: [
				{
					id: "1",
					period: 1,
					target: "0",
					realized: "50",
					reportedDate: "2026-02-05",
					deadlineDate: "2026-02-07", // on time
				},
				{
					id: "2",
					period: 2,
					target: "100",
					realized: "100",
					reportedDate: "2026-03-05",
					deadlineDate: "2026-03-07", // on time
				},
			],
		};

		const result = calculateOutputAchievement(input, default2026RuleSet);

		// Timeliness: 2 on-time = 100
		// Achievement: period 1 skipped. period 2 = 100%. Average = 100
		// Score = 100
		expect(result.score).toBe("100.00");
		expect(result.warnings.some((w) => w.includes("Target nol"))).toBe(true);
		expect(result.status).toBe("warning");
	});
});

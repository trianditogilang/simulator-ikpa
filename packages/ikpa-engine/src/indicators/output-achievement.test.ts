import { describe, expect, it } from "vitest";
import { default2026RuleSet } from "../rule-set";
import type { OutputAchievementInput } from "../types";
import { calculateFifthWorkingDayOfNextMonth } from "../utils/workday-calendar";
import { calculateOutputAchievement } from "./output-achievement";

describe("Capaian Output & Fairness Treatment (CO-01 s.d. CO-18)", () => {
	it("returns incomplete when no reports exist", () => {
		const result = calculateOutputAchievement(
			{ reports: [] },
			default2026RuleSet,
		);
		expect(result.status).toBe("incomplete");
		expect(result.score).toBeNull();
		expect(result.weightedContribution).toBeNull();
	});

	// CO-01: Juli, confirmed, PCRO 50, TPCRO 50 -> Formula 1; nilai 100
	it("CO-01: evaluates Formula 1 correctly (PCRO 50%, TPCRO 50% -> 100)", () => {
		const input: OutputAchievementInput = {
			reports: [
				{
					id: "ro-1",
					roCode: "001.RO.A",
					period: 7,
					pcro: "50.00",
					tpcro: "50.00",
					rvro: "5",
					volumeDipa: "10",
					confirmed: true,
					reportedDate: "2026-08-05",
					deadlineDate: "2026-08-07",
				},
			],
		};
		const result = calculateOutputAchievement(input, default2026RuleSet);
		expect(result.status).toBe("complete");
		// NKKW: 100 (tepat waktu)
		// NKCRO: 50 / 50 * 100 = 100
		// Score: 30% * 100 + 70% * 100 = 100.00
		// Weighted: 100 * 25% = 25.00
		expect(result.score).toBe("100.00");
		expect(result.weightedContribution).toBe("25.00");
		expect(result.subComponents?.find((s) => s.key === "achievement")?.score).toBe("100.00");
	});

	// CO-02: Juli, confirmed, PCRO 34, TPCRO 42 -> Formula 1; nilai 80,95
	it("CO-02: evaluates Formula 1 with fractional rounding (34/42 -> 80.95)", () => {
		const input: OutputAchievementInput = {
			reports: [
				{
					id: "ro-2",
					roCode: "002.RO.B",
					period: 7,
					pcro: "34.00",
					tpcro: "42.00",
					rvro: "3",
					volumeDipa: "10",
					confirmed: true,
					reportedDate: "2026-08-05",
					deadlineDate: "2026-08-07",
				},
			],
		};
		const result = calculateOutputAchievement(input, default2026RuleSet);
		// NKCRO: 34/42 * 100 = 80.95238... -> 80.95
		// NKKW: 100
		// Score: 100*0.30 + 80.95*0.70 = 30 + 56.665 = 86.67
		// Weighted: 86.67 * 25% = 21.67
		expect(result.subComponents?.find((s) => s.key === "achievement")?.score).toBe("80.95");
		expect(result.score).toBe("86.67");
		expect(result.weightedContribution).toBe("21.67");
	});

	// CO-03: Juli, confirmed, PCRO 100, RVRO 2, volume 2 -> Formula 2; nilai 100
	it("CO-03: evaluates Formula 2 when PCRO is 100% in normal period (RVRO 2, Vol 2 -> 100)", () => {
		const input: OutputAchievementInput = {
			reports: [
				{
					id: "ro-3",
					roCode: "003.RO.C",
					period: 7,
					pcro: "100.00",
					tpcro: "70.00",
					rvro: "2",
					volumeDipa: "2",
					confirmed: true,
					reportedDate: "2026-08-05",
					deadlineDate: "2026-08-07",
				},
			],
		};
		const result = calculateOutputAchievement(input, default2026RuleSet);
		// Formula 2: 2/2 * 100 = 100
		expect(result.subComponents?.find((s) => s.key === "achievement")?.score).toBe("100.00");
		expect(result.score).toBe("100.00");
	});

	// CO-04: Desember, confirmed, PCRO 40, RVRO 2, volume 4 -> Formula 2; nilai 50, bukan 100 otomatis
	it("CO-04: evaluates Formula 2 in December without automatic 100 assumption (RVRO 2, Vol 4 -> 50)", () => {
		const input: OutputAchievementInput = {
			reports: [
				{
					id: "ro-4",
					roCode: "004.RO.D",
					period: 12,
					pcro: "40.00",
					tpcro: "100.00",
					rvro: "2",
					volumeDipa: "4",
					confirmed: true,
					reportedDate: "2027-01-05",
					deadlineDate: "2027-01-07",
				},
			],
		};
		const result = calculateOutputAchievement(input, default2026RuleSet);
		// Formula 2: 2/4 * 100 = 50.00 (NOT 100)
		expect(result.subComponents?.find((s) => s.key === "achievement")?.score).toBe("50.00");
		// Score: 30% * 100 + 70% * 50 = 30 + 35 = 65.00
		expect(result.score).toBe("65.00");
	});

	// CO-05: Non-Desember, not confirmed, PCRO/RVRO valid -> Nilai Capaian RO 0; formula ZERO_UNCONFIRMED
	it("CO-05: gives 0 achievement score when report is not confirmed", () => {
		const input: OutputAchievementInput = {
			reports: [
				{
					id: "ro-5",
					roCode: "005.RO.E",
					period: 5,
					pcro: "80.00",
					tpcro: "80.00",
					rvro: "8",
					volumeDipa: "10",
					confirmed: false, // unconfirmed
					reportedDate: "2026-06-03",
					deadlineDate: "2026-06-05",
				},
			],
		};
		const result = calculateOutputAchievement(input, default2026RuleSet);
		// NKCRO: 0.00
		expect(result.subComponents?.find((s) => s.key === "achievement")?.score).toBe("0.00");
		// NKKW: 100.00
		// Score: 100*0.30 + 0*0.70 = 30.00
		expect(result.score).toBe("30.00");
	});

	// CO-06: PCRO 0, TPCRO 0, confirmed -> Nilai Capaian RO 0; tidak error 0/0 dan tidak skip
	it("CO-06: handles PCRO 0% and TPCRO 0% safely without divide-by-zero error or skipping", () => {
		const input: OutputAchievementInput = {
			reports: [
				{
					id: "ro-6",
					roCode: "006.RO.F",
					period: 3,
					pcro: "0.00",
					tpcro: "0.00",
					rvro: "0",
					volumeDipa: "10",
					confirmed: true,
					reportedDate: "2026-04-03",
					deadlineDate: "2026-04-07",
				},
			],
		};
		const result = calculateOutputAchievement(input, default2026RuleSet);
		expect(result.subComponents?.find((s) => s.key === "achievement")?.score).toBe("0.00");
		expect(result.score).toBe("30.00");
	});

	// CO-07: PCRO 25, TPCRO 0, confirmed -> warning TPCRO_MUST_BE_GT_ZERO
	it("CO-07: generates warning when PCRO > 0 but TPCRO is 0", () => {
		const input: OutputAchievementInput = {
			reports: [
				{
					id: "ro-7",
					roCode: "007.RO.G",
					period: 4,
					pcro: "25.00",
					tpcro: "0.00",
					rvro: "2",
					volumeDipa: "10",
					confirmed: true,
					reportedDate: "2026-05-04",
					deadlineDate: "2026-05-08",
				},
			],
		};
		const result = calculateOutputAchievement(input, default2026RuleSet);
		expect(result.warnings.some((w) => w.includes("TPCRO_MUST_BE_GT_ZERO"))).toBe(true);
	});

	// CO-08: RVRO > volume (cap 100)
	it("CO-08: caps Formula 2 achievement score at 100 when RVRO > Volume DIPA", () => {
		const input: OutputAchievementInput = {
			reports: [
				{
					id: "ro-8",
					roCode: "008.RO.H",
					period: 12,
					pcro: "100.00",
					tpcro: "100.00",
					rvro: "15",
					volumeDipa: "10", // 15/10 = 150% -> capped to 100
					confirmed: true,
					reportedDate: "2027-01-05",
					deadlineDate: "2027-01-07",
				},
			],
		};
		const result = calculateOutputAchievement(input, default2026RuleSet);
		expect(result.subComponents?.find((s) => s.key === "achievement")?.score).toBe("100.00");
	});

	// CO-09 & CO-10: Timeliness on-time vs late
	it("CO-09 & CO-10: evaluates timeliness accurately (100 if on-time, 0 if late)", () => {
		const input: OutputAchievementInput = {
			reports: [
				{
					id: "ro-9",
					roCode: "009.RO.I",
					period: 7,
					pcro: "100.00",
					tpcro: "100.00",
					rvro: "10",
					volumeDipa: "10",
					confirmed: true,
					reportedDate: "2026-08-07", // exactly on deadline
					deadlineDate: "2026-08-07",
				},
				{
					id: "ro-10",
					roCode: "010.RO.J",
					period: 7,
					pcro: "100.00",
					tpcro: "100.00",
					rvro: "10",
					volumeDipa: "10",
					confirmed: true,
					reportedDate: "2026-08-08", // 1 day after deadline
					deadlineDate: "2026-08-07",
				},
			],
		};
		const result = calculateOutputAchievement(input, default2026RuleSet);
		// NKKW: (100 + 0) / 2 = 50.00
		expect(result.subComponents?.find((s) => s.key === "timeliness")?.score).toBe("50.00");
		// NKCRO: (100 + 100) / 2 = 100.00
		// Score: 30% * 50 + 70% * 100 = 15 + 70 = 85.00
		expect(result.score).toBe("85.00");
	});

	// CO-11: reportedDate kosong -> pending/warning
	it("CO-11: treats missing reportedDate without giving automatic 100", () => {
		const input: OutputAchievementInput = {
			reports: [
				{
					id: "ro-11",
					roCode: "011.RO.K",
					period: 5,
					pcro: "50.00",
					tpcro: "50.00",
					rvro: "5",
					volumeDipa: "10",
					confirmed: true,
					reportedDate: null,
					deadlineDate: "2026-06-05",
				},
			],
		};
		const result = calculateOutputAchievement(input, default2026RuleSet);
		expect(result.status).toBe("warning");
		expect(result.subComponents?.find((s) => s.key === "timeliness")?.score).toBe("0.00");
	});

	// CO-12: Canonical 7th workday / 2026 open period schedule deadline calculation
	it("CO-12: calculates output report open period deadline correctly for 2026 and generic 7 HK", () => {
		// 2026 official schedule: July 2026 -> 2026-08-11, April 2026 -> 2026-05-12, Jan-Mar 2026 -> 2026-04-30
		expect(calculateFifthWorkingDayOfNextMonth(2026, 1, { holidays: [] })).toBe("2026-04-30");
		expect(calculateFifthWorkingDayOfNextMonth(2026, 4, { holidays: [] })).toBe("2026-05-12");
		expect(calculateFifthWorkingDayOfNextMonth(2026, 7, { holidays: [] })).toBe("2026-08-11");
		expect(calculateFifthWorkingDayOfNextMonth(2026, 12, { holidays: [] })).toBe("2027-01-13");

		// Generic year 2027: July 2027 -> Aug 1 (Sun) -> Aug 2,3,4,5,6,9,10 (7 HK = Aug 10, 2027)
		const genericDeadline = calculateFifthWorkingDayOfNextMonth(2027, 7, { holidays: [] });
		expect(genericDeadline).toBe("2027-08-10");
	});

	// CO-13: Fairness treatment (4 ROs = 100, 1 RO FAN.ZZ1 excluded -> NKCRO = 100, denominator = 4)
	it("CO-13: excludes RO Khusus (FAN.ZZ1) from numerator and denominator of both components", () => {
		const input: OutputAchievementInput = {
			reports: [
				{
					id: "ro-1",
					roCode: "111.RO.A",
					period: 6,
					pcro: "100.00",
					tpcro: "100.00",
					rvro: "10",
					volumeDipa: "10",
					confirmed: true,
					reportedDate: "2026-07-03",
					deadlineDate: "2026-07-07",
				},
				{
					id: "ro-2",
					roCode: "111.RO.B",
					period: 6,
					pcro: "100.00",
					tpcro: "100.00",
					rvro: "10",
					volumeDipa: "10",
					confirmed: true,
					reportedDate: "2026-07-03",
					deadlineDate: "2026-07-07",
				},
				{
					id: "ro-3",
					roCode: "111.RO.C",
					period: 6,
					pcro: "100.00",
					tpcro: "100.00",
					rvro: "10",
					volumeDipa: "10",
					confirmed: true,
					reportedDate: "2026-07-03",
					deadlineDate: "2026-07-07",
				},
				{
					id: "ro-4",
					roCode: "111.RO.D",
					period: 6,
					pcro: "100.00",
					tpcro: "100.00",
					rvro: "10",
					volumeDipa: "10",
					confirmed: true,
					reportedDate: "2026-07-03",
					deadlineDate: "2026-07-07",
				},
				{
					id: "ro-5",
					roCode: "FAN.ZZ1",
					period: 6,
					pcro: "0.00",
					tpcro: "0.00",
					rvro: "0",
					volumeDipa: "10",
					confirmed: false,
					reportedDate: null,
					deadlineDate: "2026-07-07",
					isExcluded: true, // Fairness exclusion active
					exclusionReason: "RO Khusus tidak menjadi objek penilaian Capaian Output",
				},
			],
		};
		const result = calculateOutputAchievement(input, default2026RuleSet);
		// NKCRO: 4 RO normal @ 100 / 4 = 100.00 (FAN.ZZ1 ignored, not 80)
		expect(result.subComponents?.find((s) => s.key === "achievement")?.score).toBe("100.00");
		// NKKW: 4 RO normal @ 100 / 4 = 100.00
		expect(result.subComponents?.find((s) => s.key === "timeliness")?.score).toBe("100.00");
		expect(result.score).toBe("100.00");
		expect(result.weightedContribution).toBe("25.00");
		expect(result.formulaTrace.some((t) => t.result.includes("Dikecualikan"))).toBe(true);
	});

	// CO-14: If RO Khusus is NOT marked excluded (e.g. policy unpublished), it impacts score normally
	it("CO-14: includes RO when not excluded (4 @ 100 + 1 @ 0 -> NKCRO = 80.00)", () => {
		const input: OutputAchievementInput = {
			reports: [
				{
					id: "ro-1",
					roCode: "111.RO.A",
					period: 6,
					pcro: "100.00",
					tpcro: "100.00",
					rvro: "10",
					volumeDipa: "10",
					confirmed: true,
					reportedDate: "2026-07-03",
					deadlineDate: "2026-07-07",
				},
				{
					id: "ro-2",
					roCode: "111.RO.B",
					period: 6,
					pcro: "100.00",
					tpcro: "100.00",
					rvro: "10",
					volumeDipa: "10",
					confirmed: true,
					reportedDate: "2026-07-03",
					deadlineDate: "2026-07-07",
				},
				{
					id: "ro-3",
					roCode: "111.RO.C",
					period: 6,
					pcro: "100.00",
					tpcro: "100.00",
					rvro: "10",
					volumeDipa: "10",
					confirmed: true,
					reportedDate: "2026-07-03",
					deadlineDate: "2026-07-07",
				},
				{
					id: "ro-4",
					roCode: "111.RO.D",
					period: 6,
					pcro: "100.00",
					tpcro: "100.00",
					rvro: "10",
					volumeDipa: "10",
					confirmed: true,
					reportedDate: "2026-07-03",
					deadlineDate: "2026-07-07",
				},
				{
					id: "ro-5",
					roCode: "FAN.ZZ1",
					period: 6,
					pcro: "0.00",
					tpcro: "100.00",
					rvro: "0",
					volumeDipa: "10",
					confirmed: true,
					reportedDate: "2026-07-03",
					deadlineDate: "2026-07-07",
					isExcluded: false,
				},
			],
		};
		const result = calculateOutputAchievement(input, default2026RuleSet);
		// NKCRO: (100 + 100 + 100 + 100 + 0) / 5 = 80.00
		expect(result.subComponents?.find((s) => s.key === "achievement")?.score).toBe("80.00");
	});

	// Golden Case Official Pusdiklat (§4.3)
	it("Golden Case Pusdiklat: RO1(100), RO2(100), RO3(80.95) -> NKCRO 93.65, NKKW 100 -> IKPA-CO 95.56", () => {
		const input: OutputAchievementInput = {
			reports: [
				{
					id: "ro-1",
					roCode: "RO.1",
					period: 7,
					pcro: "100.00",
					tpcro: "100.00",
					rvro: "10",
					volumeDipa: "10",
					confirmed: true,
					reportedDate: "2026-08-05",
					deadlineDate: "2026-08-07",
				},
				{
					id: "ro-2",
					roCode: "RO.2",
					period: 7,
					pcro: "100.00",
					tpcro: "100.00",
					rvro: "10",
					volumeDipa: "10",
					confirmed: true,
					reportedDate: "2026-08-05",
					deadlineDate: "2026-08-07",
				},
				{
					id: "ro-3",
					roCode: "RO.3",
					period: 7,
					pcro: "34.00",
					tpcro: "42.00",
					rvro: "3",
					volumeDipa: "10",
					confirmed: true,
					reportedDate: "2026-08-05",
					deadlineDate: "2026-08-07",
				},
			],
		};
		const result = calculateOutputAchievement(input, default2026RuleSet);
		// NKCRO = (100 + 100 + 80.95) / 3 = 280.95 / 3 = 93.65
		expect(result.subComponents?.find((s) => s.key === "achievement")?.score).toBe("93.65");
		// NKKW = 100.00
		expect(result.subComponents?.find((s) => s.key === "timeliness")?.score).toBe("100.00");
		// Score = 100 * 30% + 93.65 * 70% = 30 + 65.555 = 95.56
		expect(result.score).toBe("95.56");
		// Weighted Contribution = 95.56 * 25% = 23.89
		expect(result.weightedContribution).toBe("23.89");
	});
});


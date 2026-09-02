import { describe, expect, it } from "vitest";
import { calculateIkpa } from "./calculate";
import { default2026RuleSet } from "./rule-set";
import type { EngineInput } from "./types";

describe("calculateIkpa orchestrator", () => {
	const mockInput: EngineInput = {
		ruleSetId: "123e4567-e89b-12d3-a456-426614174000",
		ruleSetVersion: 1,
		organizationId: "123e4567-e89b-12d3-a456-426614174001",
		fiscalYear: 2026,
		period: { kind: "quarter", value: 1 },
		isBlu: false,
		targetScore: "95",
		simulationType: "scenario",
		dipaRevision: {
			semester1Revisions: 0,
			semester2Revisions: 0,
			hasBudgetChange: [false],
		},
		rpdDeviation: {
			months: [],
			budgetByType: {
				"51": "0",
				"52": "0",
				"53": "0",
				"57": "0",
			},
		},
		absorption: {
			quarters: [],
		},
		contractual: {
			contracts: [],
			accelerations53: [],
		},
		invoiceTimeliness: {
			invoices: [],
			workdayCalendar: {
				holidays: [],
				workdays: [],
			},
		},
		upTup: {
			transactions: [],
			kkpTransactions: [],
		},
		outputAchievement: {
			reports: [],
		},
		spmDispensation: {
			dispensationCount: 0,
			totalSpmQ4: 0,
		},
	};

	it("calculates properly with incomplete indicators", () => {
		const output = calculateIkpa(mockInput, default2026RuleSet);
		// Since inputs are empty, most will be incomplete
		expect(output.totalScore).toBeNull();
		expect(output.missingData.length).toBeGreaterThan(0);
	});

	it("applies scenario overrides and completes the score", () => {
		const inputWithOverrides: EngineInput = {
			...mockInput,
			overrides: {
				dipa_revision: "100",
				rpd_deviation: "100",
				budget_absorption: "100",
				contractual: "100",
				invoice_timeliness: "100",
				up_tup: "100",
				output_achievement: "100",
			},
		};

		const output = calculateIkpa(inputWithOverrides, default2026RuleSet);
		// With all overridden, totalScore should be exactly 100
		expect(output.totalScore).toBe("100.00");
		expect(output.missingData).toHaveLength(0);
		expect(output.dispensationDeduction).toBe("0"); // assuming 0 count defaults to 0
	});

	it("applies dispensation deduction correctly", () => {
		const inputWithOverrides: EngineInput = {
			...mockInput,
			spmDispensation: {
				dispensationCount: 1, // 1/100 = 10 permil -> deduction 1.00
				totalSpmQ4: 100,
			},
			overrides: {
				dipa_revision: "100",
				rpd_deviation: "100",
				budget_absorption: "100",
				contractual: "100",
				invoice_timeliness: "100",
				up_tup: "100",
				output_achievement: "100",
			},
		};

		const output = calculateIkpa(inputWithOverrides, default2026RuleSet);
		// Total should be 100 - 1.00 = 99.00
		expect(output.totalScore).toBe("99.00");
		expect(output.dispensationDeduction).toBe("1.00");
	});

	it("rounds properly per rule set config", () => {
		// Mock overrides to get 99.985...
		const configWith1Dec = {
			...default2026RuleSet,
			rounding: {
				mode: "half_up" as const,
				fractionDigits: 1,
			},
		};

		const inputWithOverrides: EngineInput = {
			...mockInput,
			overrides: {
				dipa_revision: "99.9",
				rpd_deviation: "99.9",
				budget_absorption: "99.9",
				contractual: "99.9",
				invoice_timeliness: "99.9",
				up_tup: "99.9",
				output_achievement: "99.9",
			},
		};

		const output = calculateIkpa(inputWithOverrides, configWith1Dec);
		// 99.9 rounded to 1 fraction digit is 99.9
		expect(output.totalScore).toBe("99.9");
	});
});

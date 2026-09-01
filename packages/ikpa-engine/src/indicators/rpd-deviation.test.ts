import { expect, test } from "vitest";
import { calculateRpdDeviation } from "./rpd-deviation";
import { default2026RuleSet } from "../rule-set";
import type { RpdDeviationInput } from "../types";

test("RPD Deviation golden test - below 5%", () => {
	const input: RpdDeviationInput = {
		months: [
			{
				month: 1,
				planned: { "51": "100", "52": "100", "53": "0", "57": "0" },
				realized: { "51": "98", "52": "97", "53": "0", "57": "0" },
			},
		],
		budgetByType: { "51": "100", "52": "100", "53": "0", "57": "0" },
	};

	const result = calculateRpdDeviation(input, default2026RuleSet);

	expect(result.status).toBe("incomplete"); // Because only 1 month
	expect(result.score).toBe("100.00");
});

test("RPD Deviation golden test - above 5%", () => {
	const input: RpdDeviationInput = {
		months: [
			{
				month: 1,
				planned: { "51": "100", "52": "100", "53": "0", "57": "0" },
				realized: { "51": "50", "52": "50", "53": "0", "57": "0" },
			},
		],
		budgetByType: { "51": "100", "52": "100", "53": "0", "57": "0" },
	};

	const result = calculateRpdDeviation(input, default2026RuleSet);

	expect(result.status).toBe("incomplete");
	expect(result.score).toBe("50.00");
});

test("RPD Deviation zero denominator", () => {
	const input: RpdDeviationInput = {
		months: [
			{
				month: 1,
				planned: { "51": "0", "52": "0", "53": "0", "57": "0" },
				realized: { "51": "10", "52": "0", "53": "0", "57": "0" },
			},
		],
		budgetByType: { "51": "100", "52": "100", "53": "0", "57": "0" },
	};

	const result = calculateRpdDeviation(input, default2026RuleSet);
	// 51 deviation is 100% since planned=0 and realized>0.
	// 52 deviation is 0% since planned=0 and realized=0.
	// weights: 51=0.5, 52=0.5. average dev = 50%
	// score = 100 - 50 = 50
	expect(result.score).toBe("50.00");
});

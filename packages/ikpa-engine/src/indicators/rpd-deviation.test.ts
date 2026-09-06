import { expect, test } from "vitest";
import { default2026RuleSet } from "../rule-set";
import type { RpdDeviationInput } from "../types";
import { calculateRpdDeviation } from "./rpd-deviation";

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

test("RPD Deviation zero denominator and zero plan handling", () => {
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

test("RPD Deviation Golden Test Jan / Feb / Mar (PER-5/PB/2024 spec)", () => {
	// Budget: 50% (51), 40% (52), 10% (53), 0% (57)
	const budgetByType = { "51": "500", "52": "400", "53": "100", "57": "0" };

	// Month 1: Dev 51=0%, 52=10%, 53=0% -> Month 1 dev = 0*0.5 + 10*0.4 + 0*0.1 = 4.00%
	const month1 = {
		month: 1,
		planned: { "51": "100", "52": "100", "53": "100", "57": "0" },
		realized: { "51": "100", "52": "90", "53": "100", "57": "0" },
	};

	// Jan only: n=1 -> avg = 4.00% <= 5% -> score = 100.00
	const resJan = calculateRpdDeviation(
		{ months: [month1], budgetByType },
		default2026RuleSet,
	);
	expect(resJan.score).toBe("100.00");

	// Month 2: dev = 13.00% (e.g. 51 dev 13%, 52 dev 13%, 53 dev 13%)
	const month2 = {
		month: 2,
		planned: { "51": "100", "52": "100", "53": "100", "57": "0" },
		realized: { "51": "87", "52": "87", "53": "87", "57": "0" },
	};

	// Feb: n=2 -> sum = 4 + 13 = 17 -> avg = 8.50% -> score = 91.50
	const resFeb = calculateRpdDeviation(
		{ months: [month1, month2], budgetByType },
		default2026RuleSet,
	);
	expect(resFeb.score).toBe("91.50");

	// Month 3: dev = 18.00%
	const month3 = {
		month: 3,
		planned: { "51": "100", "52": "100", "53": "100", "57": "0" },
		realized: { "51": "82", "52": "82", "53": "82", "57": "0" },
	};

	// Mar: n=3 -> sum = 17 + 18 = 35 -> avg = 11.67% -> score = 88.33
	const resMar = calculateRpdDeviation(
		{ months: [month1, month2, month3], budgetByType },
		default2026RuleSet,
	);
	expect(resMar.score).toBe("88.33");
});

test("RPD Deviation Golden Test Mei (Satker XYZ: avg = 8.21 -> score 91.79)", () => {
	// 5 months with total weighted dev = 41.05 -> avg = 8.21 -> score = 91.79
	const budgetByType = { "51": "100", "52": "100", "53": "0", "57": "0" };
	const months = [
		{
			month: 1,
			planned: { "51": "100", "52": "100", "53": "0", "57": "0" },
			realized: { "51": "96", "52": "96", "53": "0", "57": "0" }, // 4%
		},
		{
			month: 2,
			planned: { "51": "100", "52": "100", "53": "0", "57": "0" },
			realized: { "51": "87", "52": "87", "53": "0", "57": "0" }, // 13%
		},
		{
			month: 3,
			planned: { "51": "100", "52": "100", "53": "0", "57": "0" },
			realized: { "51": "92", "52": "92", "53": "0", "57": "0" }, // 8%
		},
		{
			month: 4,
			planned: { "51": "100", "52": "100", "53": "0", "57": "0" },
			realized: { "51": "92.95", "52": "92.95", "53": "0", "57": "0" }, // 7.05%
		},
		{
			month: 5,
			planned: { "51": "100", "52": "100", "53": "0", "57": "0" },
			realized: { "51": "91", "52": "91", "53": "0", "57": "0" }, // 9%
		},
	];

	const resMei = calculateRpdDeviation(
		{ months, budgetByType },
		default2026RuleSet,
	);
	// sum = 4 + 13 + 8 + 7.05 + 9 = 41.05 / 5 = 8.21 -> score = 91.79
	expect(resMei.score).toBe("91.79");
});

import { describe, expect, it } from "vitest";
import { calculateUpTup } from "./up-tup";
import { default2026RuleSet } from "../rule-set";
import type { UpTupInput } from "../types";

describe("calculateUpTup", () => {
	it("returns incomplete when no transactions exist", () => {
		const input: UpTupInput = {
			transactions: [],
			kkpTransactions: [],
		};

		const result = calculateUpTup(
			input,
			{ kind: "year", value: 1 },
			default2026RuleSet,
		);
		expect(result.status).toBe("incomplete");
		expect(result.score).toBeNull();
		expect(result.warnings).toContain(
			"Tidak ada data transaksi UP/TUP atau KKP.",
		);
	});

	it("calculates perfectly on time tunai and KKP meets target", () => {
		const input: UpTupInput = {
			transactions: [
				{
					id: "t1",
					type: "UP",
					amount: "1000",
					date: "2026-01-01",
					settlementDate: "2026-01-15",
					isSettled: true,
				},
				{
					id: "t2",
					type: "TUP",
					amount: "1000",
					date: "2026-02-01",
					settlementDate: "2026-02-20",
					isSettled: true,
				},
			],
			kkpTransactions: [
				{
					id: "k1",
					amount: "1000",
					date: "2026-03-01",
				},
			],
		};

		const result = calculateUpTup(
			input,
			{ kind: "quarter", value: 1 },
			default2026RuleSet,
		);
		expect(result.status).toBe("complete");
		// Tunai:
		// Ketepatan: 2/2 = 100%
		// GUP disebulankan: 1/1 = 100%
		// Setoran TUP: 1/1 = 100%
		// Tunai Score = 100

		// KKP: total tunai = 2000, kkp = 1000. total = 3000. % = 33.33%
		// Q1 target is 1%. 33.33 >= 1, so Q1 kkp score = 110.
		// Total Score = 90% * 100 + 10% * 110 = 90 + 11 = 101.

		expect(result.score).toBe("101.00");
		expect(result.subComponents).toBeDefined();
		expect(result.subComponents![0].score).toBe("100.00"); // Tunai
		expect(result.subComponents![1].score).toBe("110.00"); // KKP
	});

	it("calculates tunai components correctly with some late settlements", () => {
		const input: UpTupInput = {
			transactions: [
				{
					id: "t1",
					type: "UP",
					amount: "1000",
					date: "2026-01-01",
					settlementDate: "2026-02-15", // >30 days, diff month
					isSettled: true,
				},
				{
					id: "t2",
					type: "TUP",
					amount: "1000",
					date: "2026-02-01",
					settlementDate: "2026-02-10", // <=30 days, same month (though TUP ignores month check for sebulan)
					isSettled: true,
				},
			],
			kkpTransactions: [],
		};

		const result = calculateUpTup(
			input,
			{ kind: "year", value: 1 },
			default2026RuleSet,
		);

		// Ketepatan: t1 is late (45 days), t2 is on time (9 days) -> 50%
		// GUP sebulan: t1 is diff month -> 0%
		// Setoran TUP: t2 is on time -> 100%
		// Tunai Score = (50% * 0.5) + (0% * 0.25) + (100% * 0.25) = 25 + 0 + 25 = 50.

		// KKP: 0 transactions, 0% target not met for any quarter?
		// Targets: 1, 5, 9, 12.5. all > 0. So all KKP quarter scores = 100.
		// Total Score = 90% * 50 + 10% * 100 = 45 + 10 = 55.

		expect(result.score).toBe("55.00");
	});
});

import { describe, expect, it } from "vitest";
import { default2026RuleSet } from "../rule-set";
import type { UpTupInput } from "../types";
import { calculateUpTup } from "./up-tup";

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
		const tunaiComp = result.subComponents?.find((c) => c.key === "tunai");
		const timelinessComp = result.subComponents?.find((c) => c.key === "timeliness");
		const monthlyGupComp = result.subComponents?.find((c) => c.key === "monthlyGup");
		const tupDepositComp = result.subComponents?.find((c) => c.key === "tupDeposit");
		const kkpComp = result.subComponents?.find((c) => c.key === "kkp");

		expect(tunaiComp?.score).toBe("100.00"); // Tunai
		expect(timelinessComp?.score).toBe("100.00"); // Ketepatan
		expect(monthlyGupComp?.score).toBe("100.00"); // %GUP Disebulankan
		expect(tupDepositComp?.score).toBe("100.00"); // Setoran TUP
		expect(kkpComp?.score).toBe("110.00"); // KKP
	});

	it("calculates tunai components correctly with some late settlements and no KKP (default 90% cap)", () => {
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

		// Default Tanpa KKP: 90% * 50 = 45.00
		expect(result.score).toBe("45.00");
		expect(result.subComponents?.find((c) => c.key === "kkp")?.score).toBe("0.00");
	});

	it("caps satker without UP KKP at exactly 90.00 when tunai is 100% on time", () => {
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
			],
			kkpTransactions: [],
			hasKkp: false,
		};

		const result = calculateUpTup(
			input,
			{ kind: "year", value: 1 },
			default2026RuleSet,
		);

		// Tunai is 100%, but satker has no UP KKP -> 90% * 100 = 90.00
		expect(result.score).toBe("90.00");
		expect(result.weightedContribution).toBe("9.00");
	});

	it("allows satker with active KKP to reach 100.00 even with 0 KKP transactions", () => {
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
			],
			kkpTransactions: [],
			hasKkp: true,
		};

		const result = calculateUpTup(
			input,
			{ kind: "year", value: 1 },
			default2026RuleSet,
		);

		// Tunai is 100%, KKP active (base 100) -> 90% * 100 + 10% * 100 = 100.00
		expect(result.score).toBe("100.00");
		expect(result.weightedContribution).toBe("10.00");
	});

	it("calculates Kinerja Setoran TUP precisely based on nominal ratio (e.g., TUP 6jt + Setoran TUP 100k -> 1.67% setoran -> 98.33 score)", () => {
		const input: UpTupInput = {
			transactions: [
				{
					id: "t1",
					type: "UP",
					amount: "50000000",
					date: "2026-01-10",
					settlementDate: "2026-01-10",
					isSettled: true,
				},
				{
					id: "t2",
					type: "TUP",
					amount: "6000000",
					date: "2026-02-01",
					settlementDate: "2026-02-01",
					isSettled: true,
				},
				{
					id: "t3",
					type: "SETORAN_TUP",
					amount: "100000",
					date: "2026-02-25",
					settlementDate: "2026-02-25",
					isSettled: true,
				},
			],
			kkpTransactions: [],
			hasKkp: false,
		};

		const result = calculateUpTup(
			input,
			{ kind: "month", value: 2 },
			default2026RuleSet,
		);

		// Ketepatan = 100
		// GUP Disebulankan = 100 (no GUP)
		// % Setoran TUP = 100.000 / 6.000.000 * 100 = 1.6667%
		// Kinerja Setoran TUP = 100 - 1.6667 = 98.33
		// NK Tunai = (50% * 100) + (25% * 100) + (25% * 98.33) = 50 + 25 + 24.5825 = 99.58
		// Final Score (hasKkp=false) = 99.58 * 0.9 = 89.62
		// Kontribusi IKPA = 89.62 * 0.1 = 8.96

		const tupDepositComp = result.subComponents?.find((c) => c.key === "tupDeposit");
		const tunaiComp = result.subComponents?.find((c) => c.key === "tunai");

		expect(tupDepositComp?.score).toBe("98.33");
		expect(tunaiComp?.score).toBe("99.58");
		expect(result.score).toBe("89.63");
		expect(result.weightedContribution).toBe("8.96");
	});
});

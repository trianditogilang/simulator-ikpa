import { describe, expect, it } from "vitest";
import { default2026RuleSet } from "../rule-set";
import { calculateContractual, parseIsoDate } from "./contractual";

describe("calculateContractual", () => {
	it("returns incomplete with null score if contracts are empty (not 100)", () => {
		const result = calculateContractual(
			{ contracts: [] },
			default2026RuleSet,
		);
		expect(result.status).toBe("incomplete");
		expect(result.score).toBeNull();
		expect(result.weightedContribution).toBeNull();
		expect(result.subComponents).toBeDefined();
		expect(result.subComponents![0].score).toBeNull();
		expect(result.subComponents![1].score).toBeNull();
		expect(result.subComponents![2].score).toBeNull();
		expect(result.warnings.some((w) => w.includes("Belum ada kontrak"))).toBe(
			true,
		);
	});

	it("returns incomplete if all contracts are below 50 million threshold", () => {
		const result = calculateContractual(
			{
				contracts: [
					{
						id: "c-low-1",
						amount: "49999999",
						signedDate: "2026-02-15",
						accountCode: "53",
						paymentType: "sekaligus",
						sp2dDate: "2026-03-01",
					},
					{
						id: "c-low-2",
						amount: "30000000",
						signedDate: "2026-01-10",
						accountCode: "52",
						paymentType: "sekaligus",
					},
				],
			},
			default2026RuleSet,
		);
		expect(result.status).toBe("incomplete");
		expect(result.score).toBeNull();
	});

	it("matches the canonical PDF acceptance example with final score 97.00 and contribution 9.70", () => {
		const sampleContracts = [
			{
				id: "c1",
				contractNumber: "Kontrak 1",
				accountCode: "52",
				amount: "1458000000",
				signedDate: "2025-12-29", // 29 Des prior year (Pra-DIPA)
				paymentType: "sekaligus" as const,
				sp2dDate: "2026-08-28",
			},
			{
				id: "c2",
				contractNumber: "Kontrak 2",
				accountCode: "52",
				amount: "344000000",
				signedDate: "2026-01-12",
				paymentType: "sekaligus" as const,
				sp2dDate: "2026-02-15",
			},
			{
				id: "c3",
				contractNumber: "Kontrak 3",
				accountCode: "53",
				amount: "440000000", // > 200M -> not eligible for AK53
				signedDate: "2026-02-28",
				paymentType: "sekaligus" as const,
				sp2dDate: "2026-04-19",
			},
			{
				id: "c4",
				contractNumber: "Kontrak 4",
				accountCode: "53",
				amount: "187500000", // 50-200M -> eligible AK53
				signedDate: "2026-03-01",
				paymentType: "sekaligus" as const,
				sp2dDate: "2026-03-28", // TW I SP2D -> 100 pts
			},
			{
				id: "c5",
				contractNumber: "Kontrak 5",
				accountCode: "52",
				amount: "400000000",
				signedDate: "2026-04-04",
				paymentType: "sekaligus" as const,
				sp2dDate: "2026-05-06",
			},
			{
				id: "c6",
				contractNumber: "Kontrak 6",
				accountCode: "53",
				amount: "125000000", // 50-200M -> eligible AK53
				signedDate: "2026-05-30",
				paymentType: "sekaligus" as const,
				sp2dDate: "2026-07-05", // TW III SP2D -> 80 pts
			},
			{
				id: "c7",
				contractNumber: "Kontrak 7",
				accountCode: "52",
				amount: "90360000",
				signedDate: "2026-06-27",
				paymentType: "sekaligus" as const,
				sp2dDate: "2026-07-11",
			},
			{
				id: "c8",
				contractNumber: "Kontrak 8",
				accountCode: "52",
				amount: "732000000",
				signedDate: "2026-08-23",
				paymentType: "sekaligus" as const,
				sp2dDate: "2026-12-19",
			},
			{
				id: "c9",
				contractNumber: "Kontrak 9",
				accountCode: "52",
				amount: "288500000",
				signedDate: "2026-09-16",
				paymentType: "sekaligus" as const,
				sp2dDate: "2026-10-18",
			},
			{
				id: "c10",
				contractNumber: "Kontrak 10",
				accountCode: "52",
				amount: "175600000",
				signedDate: "2026-11-11",
				paymentType: "sekaligus" as const,
				sp2dDate: "2026-11-29",
			},
		];

		const result = calculateContractual(
			{ contracts: sampleContracts, fiscalYear: 2026 },
			default2026RuleSet,
		);

		expect(result.status).toBe("complete");

		// 1. DAK: 7 of 10 contracts signed <= 30 Juni -> 70% -> Bucket >50% s.d. 75% = 80
		expect(result.subComponents![0].score).toBe("80");

		// 2. KD: 4 contracts signed <= 31 March (c1=120, c2=110, c3=110, c4=110)
		// (120 + 110 + 110 + 110) / 4 = 112.50
		expect(result.subComponents![1].score).toBe("112.50");

		// 3. AK53: 2 eligible contracts (c4=100, c6=80) -> (100 + 80) / 2 = 90.00
		expect(result.subComponents![2].score).toBe("90.00");

		// 4. Final Nilai BK = (80 * 20%) + (112.50 * 40%) + (90.00 * 40%) = 16 + 45 + 36 = 97.00
		expect(result.score).toBe("97.00");

		// 5. Kontribusi IKPA = 97.00 * 10% = 9.70
		expect(result.weightedContribution).toBe("9.70");
	});

	it("calculates DAK using contract count, not total rupiah value", () => {
		// 9 contracts in Q1 (50M each) + 1 contract in Q3 (1 Billion)
		// By count: 9 / 10 = 90% -> score 100
		// By rupiah: 450M / 1450M = 31% -> score 60 (would be incorrect!)
		const contracts = [
			...Array.from({ length: 9 }, (_, i) => ({
				id: `c-q1-${i}`,
				amount: "50000000",
				signedDate: "2026-02-01",
				accountCode: "52",
				paymentType: "sekaligus" as const,
			})),
			{
				id: "c-q3-big",
				amount: "1000000000",
				signedDate: "2026-08-01",
				accountCode: "52",
				paymentType: "sekaligus" as const,
			},
		];

		const result = calculateContractual(
			{ contracts, fiscalYear: 2026 },
			default2026RuleSet,
		);

		expect(result.subComponents![0].score).toBe("100");
	});

	it("verifies exact DAK bucket boundaries (0, 25, 25.01, 50, 50.01, 75, >75)", () => {
		// Exactly 0% -> 0
		const res0 = calculateContractual(
			{
				contracts: [
					{
						id: "c1",
						amount: "50000000",
						signedDate: "2026-08-01",
						accountCode: "52",
						paymentType: "sekaligus" as const,
					},
				],
				fiscalYear: 2026,
			},
			default2026RuleSet,
		);
		expect(res0.subComponents![0].score).toBe("0");

		// Exactly 25% (1 of 4) -> 50
		const res25 = calculateContractual(
			{
				contracts: [
					{
						id: "c1",
						amount: "50000000",
						signedDate: "2026-02-01",
						accountCode: "52",
						paymentType: "sekaligus" as const,
					},
					{
						id: "c2",
						amount: "50000000",
						signedDate: "2026-08-01",
						accountCode: "52",
						paymentType: "sekaligus" as const,
					},
					{
						id: "c3",
						amount: "50000000",
						signedDate: "2026-09-01",
						accountCode: "52",
						paymentType: "sekaligus" as const,
					},
					{
						id: "c4",
						amount: "50000000",
						signedDate: "2026-10-01",
						accountCode: "52",
						paymentType: "sekaligus" as const,
					},
				],
				fiscalYear: 2026,
			},
			default2026RuleSet,
		);
		expect(res25.subComponents![0].score).toBe("50");

		// Exactly 50% (2 of 4) -> 60
		const res50 = calculateContractual(
			{
				contracts: [
					{
						id: "c1",
						amount: "50000000",
						signedDate: "2026-02-01",
						accountCode: "52",
						paymentType: "sekaligus" as const,
					},
					{
						id: "c2",
						amount: "50000000",
						signedDate: "2026-03-01",
						accountCode: "52",
						paymentType: "sekaligus" as const,
					},
					{
						id: "c3",
						amount: "50000000",
						signedDate: "2026-08-01",
						accountCode: "52",
						paymentType: "sekaligus" as const,
					},
					{
						id: "c4",
						amount: "50000000",
						signedDate: "2026-09-01",
						accountCode: "52",
						paymentType: "sekaligus" as const,
					},
				],
				fiscalYear: 2026,
			},
			default2026RuleSet,
		);
		expect(res50.subComponents![0].score).toBe("60");

		// Exactly 75% (3 of 4) -> 80
		const res75 = calculateContractual(
			{
				contracts: [
					{
						id: "c1",
						amount: "50000000",
						signedDate: "2026-01-01",
						accountCode: "52",
						paymentType: "sekaligus" as const,
					},
					{
						id: "c2",
						amount: "50000000",
						signedDate: "2026-02-01",
						accountCode: "52",
						paymentType: "sekaligus" as const,
					},
					{
						id: "c3",
						amount: "50000000",
						signedDate: "2026-03-01",
						accountCode: "52",
						paymentType: "sekaligus" as const,
					},
					{
						id: "c4",
						amount: "50000000",
						signedDate: "2026-09-01",
						accountCode: "52",
						paymentType: "sekaligus" as const,
					},
				],
				fiscalYear: 2026,
			},
			default2026RuleSet,
		);
		expect(res75.subComponents![0].score).toBe("80");

		// > 75% (4 of 4 = 100%) -> 100
		const res100 = calculateContractual(
			{
				contracts: [
					{
						id: "c1",
						amount: "50000000",
						signedDate: "2026-01-01",
						accountCode: "52",
						paymentType: "sekaligus" as const,
					},
				],
				fiscalYear: 2026,
			},
			default2026RuleSet,
		);
		expect(res100.subComponents![0].score).toBe("100");
	});

	it("evaluates KD points accurately (120 for Pra-DIPA, 110 for Jan-Mar, post-Mar excluded from denominator)", () => {
		const contracts = [
			{
				id: "c-pra",
				amount: "100000000",
				signedDate: "2025-12-31", // Pra-DIPA -> 120
				accountCode: "52",
				paymentType: "sekaligus" as const,
			},
			{
				id: "c-jan",
				amount: "100000000",
				signedDate: "2026-01-01", // Jan -> 110
				accountCode: "52",
				paymentType: "sekaligus" as const,
			},
			{
				id: "c-mar",
				amount: "100000000",
				signedDate: "2026-03-31", // 31 Mar -> 110
				accountCode: "52",
				paymentType: "sekaligus" as const,
			},
			{
				id: "c-apr",
				amount: "100000000",
				signedDate: "2026-04-01", // 1 Apr -> excluded from denominator
				accountCode: "52",
				paymentType: "sekaligus" as const,
			},
			{
				id: "c-dec",
				amount: "100000000",
				signedDate: "2026-12-15", // Dec -> excluded from denominator
				accountCode: "52",
				paymentType: "sekaligus" as const,
			},
		];

		const result = calculateContractual(
			{ contracts, fiscalYear: 2026 },
			default2026RuleSet,
		);

		// KD: (120 + 110 + 110) / 3 = 340 / 3 = 113.33
		expect(result.subComponents![1].score).toBe("113.33");
	});

	it("evaluates AK53 filtering (only account 53, 50-200M, sekaligus) and SP2D quarter points", () => {
		const contracts = [
			// 1. Account 52 (excluded from AK53)
			{
				id: "c1",
				amount: "100000000",
				accountCode: "52",
				signedDate: "2026-01-10",
				paymentType: "sekaligus" as const,
				sp2dDate: "2026-02-10",
			},
			// 2. Account 53, amount 49.999.999 (< 50M -> excluded)
			{
				id: "c2",
				amount: "49999999",
				accountCode: "53",
				signedDate: "2026-01-10",
				paymentType: "sekaligus" as const,
				sp2dDate: "2026-02-10",
			},
			// 3. Account 53, amount 200.000.001 (> 200M -> excluded)
			{
				id: "c3",
				amount: "200000001",
				accountCode: "53",
				signedDate: "2026-01-10",
				paymentType: "sekaligus" as const,
				sp2dDate: "2026-02-10",
			},
			// 4. Account 53, termin (excluded)
			{
				id: "c4",
				amount: "100000000",
				accountCode: "53",
				signedDate: "2026-01-10",
				paymentType: "termin" as const,
				sp2dDate: "2026-02-10",
			},
			// 5. Account 53, no SP2D (excluded from completed)
			{
				id: "c5",
				amount: "100000000",
				accountCode: "53",
				signedDate: "2026-01-10",
				paymentType: "sekaligus" as const,
				sp2dDate: null,
			},
			// 6. Account 53, exactly 50M, SP2D in TW I (2026-03-31) -> 100 pts
			{
				id: "c6",
				amount: "50000000",
				accountCode: "53",
				signedDate: "2026-01-10",
				paymentType: "sekaligus" as const,
				sp2dDate: "2026-03-31",
			},
			// 7. Account 53, 100M, SP2D in TW II (2026-06-30) -> 90 pts
			{
				id: "c7",
				amount: "100000000",
				accountCode: "53",
				signedDate: "2026-01-10",
				paymentType: "sekaligus" as const,
				sp2dDate: "2026-06-30",
			},
			// 8. Account 53, 150M, SP2D in TW III (2026-09-30) -> 80 pts
			{
				id: "c8",
				amount: "150000000",
				accountCode: "53",
				signedDate: "2026-01-10",
				paymentType: "sekaligus" as const,
				sp2dDate: "2026-09-30",
			},
			// 9. Account 53, exactly 200M, SP2D in TW IV (2026-12-31) -> 70 pts
			{
				id: "c9",
				amount: "200000000",
				accountCode: "53",
				signedDate: "2026-01-10",
				paymentType: "sekaligus" as const,
				sp2dDate: "2026-12-31",
			},
		];

		const result = calculateContractual(
			{ contracts, fiscalYear: 2026 },
			default2026RuleSet,
		);

		// AK53 completed: c6 (100), c7 (90), c8 (80), c9 (70)
		// Average = (100 + 90 + 80 + 70) / 4 = 340 / 4 = 85.00
		expect(result.subComponents![2].score).toBe("85.00");
	});

	it("safely parses dates without timezone shift issues", () => {
		expect(parseIsoDate("2026-03-31")).toEqual({
			year: 2026,
			month: 3,
			day: 31,
		});
		expect(parseIsoDate("2026-04-01")).toEqual({
			year: 2026,
			month: 4,
			day: 1,
		});
		expect(parseIsoDate("2026-06-30")).toEqual({
			year: 2026,
			month: 6,
			day: 30,
		});
		expect(parseIsoDate("2026-07-01")).toEqual({
			year: 2026,
			month: 7,
			day: 1,
		});
		expect(parseIsoDate("2025-12-31")).toEqual({
			year: 2025,
			month: 12,
			day: 31,
		});
		expect(parseIsoDate("2026-01-01")).toEqual({
			year: 2026,
			month: 1,
			day: 1,
		});
		expect(parseIsoDate(null)).toBeNull();
		expect(parseIsoDate("")).toBeNull();
		expect(parseIsoDate("invalid-date")).toBeNull();
	});

	it("caps weighted contribution at 10.00 pts even when raw score exceeds 100", () => {
		// DAK = 100 (signed Q1), KD = 120 (Pra-DIPA), AK53 = 100 (TW I)
		// Final raw score = (100 * 20%) + (120 * 40%) + (100 * 40%) = 20 + 48 + 40 = 108.00
		// Capped contribution = min(108.00 * 10%, 10.00) = 10.00
		const contracts = [
			{
				id: "c-pra-modal",
				contractNumber: "Kontrak Pra Modal",
				amount: "100000000",
				signedDate: "2025-12-20", // Pra-DIPA -> 120
				accountCode: "53",
				paymentType: "sekaligus" as const,
				sp2dDate: "2026-02-15", // TW I -> 100
			},
		];

		const result = calculateContractual(
			{ contracts, fiscalYear: 2026 },
			default2026RuleSet,
		);

		expect(result.status).toBe("complete");
		expect(result.subComponents![0].score).toBe("100");
		expect(result.subComponents![1].score).toBe("120.00");
		expect(result.subComponents![2].score).toBe("100.00");
		expect(result.score).toBe("108.00");
		expect(result.weightedContribution).toBe("10.00");
	});
});

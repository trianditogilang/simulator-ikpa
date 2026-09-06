import { describe, expect, it } from "vitest";
import type { ContractRecord } from "@/services/contracts-invoices-service";
import {
	calcKontraktualSummary,
	evaluateSingleContract,
} from "./kontraktual-workspace";

describe("kontraktual-workspace", () => {
	const sampleContracts: ContractRecord[] = [
		{
			id: "c1",
			contractNumber: "Kontrak 1",
			accountCode: "52",
			value: "1458000000",
			signedAt: "2025-12-29",
			paymentType: "sekaligus",
			sp2dAt: "2026-08-28",
		},
		{
			id: "c2",
			contractNumber: "Kontrak 2",
			accountCode: "52",
			value: "344000000",
			signedAt: "2026-01-12",
			paymentType: "sekaligus",
			sp2dAt: "2026-02-15",
		},
		{
			id: "c3",
			contractNumber: "Kontrak 3",
			accountCode: "53",
			value: "440000000",
			signedAt: "2026-02-28",
			paymentType: "sekaligus",
			sp2dAt: "2026-04-19",
		},
		{
			id: "c4",
			contractNumber: "Kontrak 4",
			accountCode: "53",
			value: "187500000",
			signedAt: "2026-03-01",
			paymentType: "sekaligus",
			sp2dAt: "2026-03-28",
		},
		{
			id: "c5",
			contractNumber: "Kontrak 5",
			accountCode: "52",
			value: "400000000",
			signedAt: "2026-04-04",
			paymentType: "sekaligus",
			sp2dAt: "2026-05-06",
		},
		{
			id: "c6",
			contractNumber: "Kontrak 6",
			accountCode: "53",
			value: "125000000",
			signedAt: "2026-05-30",
			paymentType: "sekaligus",
			sp2dAt: "2026-07-05",
		},
		{
			id: "c7",
			contractNumber: "Kontrak 7",
			accountCode: "52",
			value: "90360000",
			signedAt: "2026-06-27",
			paymentType: "sekaligus",
			sp2dAt: "2026-07-11",
		},
		{
			id: "c8",
			contractNumber: "Kontrak 8",
			accountCode: "52",
			value: "732000000",
			signedAt: "2026-08-23",
			paymentType: "sekaligus",
			sp2dAt: "2026-12-19",
		},
		{
			id: "c9",
			contractNumber: "Kontrak 9",
			accountCode: "52",
			value: "288500000",
			signedAt: "2026-09-16",
			paymentType: "sekaligus",
			sp2dAt: "2026-10-18",
		},
		{
			id: "c10",
			contractNumber: "Kontrak 10",
			accountCode: "52",
			value: "175600000",
			signedAt: "2026-11-11",
			paymentType: "sekaligus",
			sp2dAt: "2026-11-29",
		},
	];

	it("evaluates single contracts accurately for all 3 subcomponents", () => {
		// c1: Pra-DIPA 52 -> DAK Q2 yes, KD Pra-DIPA 120, AK53 not 53
		const eval1 = evaluateSingleContract(sampleContracts[0]!, 2026);
		expect(eval1.isDakSignedQ2).toBe(true);
		expect(eval1.isPraDipa).toBe(true);
		expect(eval1.kdPoints).toBe(120);
		expect(eval1.isAk53Completed).toBe(false);
		expect(eval1.ak53ExclusionReason).toContain("Bukan Akun 53");

		// c4: 53 187.5M Jan-Mar -> DAK Q2 yes, KD Q1 110, AK53 TW 1 100
		const eval4 = evaluateSingleContract(sampleContracts[3]!, 2026);
		expect(eval4.isDakSignedQ2).toBe(true);
		expect(eval4.isKdQ1).toBe(true);
		expect(eval4.kdPoints).toBe(110);
		expect(eval4.isAk53Completed).toBe(true);
		expect(eval4.ak53Quarter).toBe(1);
		expect(eval4.ak53Points).toBe(100);

		// c6: 53 125M May (TW2) -> DAK Q2 yes, KD post-Mar no points, AK53 TW 3 80
		const eval6 = evaluateSingleContract(sampleContracts[5]!, 2026);
		expect(eval6.isDakSignedQ2).toBe(true);
		expect(eval6.isKdEligible).toBe(false);
		expect(eval6.isAk53Completed).toBe(true);
		expect(eval6.ak53Quarter).toBe(3);
		expect(eval6.ak53Points).toBe(80);
	});

	it("computes full summary matching canonical PDF example (97.00 and 9.70 pts)", () => {
		const summary = calcKontraktualSummary(sampleContracts, 2026);

		expect(summary.final.status).toBe("complete");
		expect(summary.final.score).toBe("97.00");
		expect(summary.final.weightedContribution).toBe("9.70");

		// DAK: 7/10 -> 70% -> 80
		expect(summary.dak.countQ2).toBe(7);
		expect(summary.dak.totalEligible).toBe(10);
		expect(summary.dak.ratio).toBe(70);
		expect(summary.dak.score).toBe("80");
		expect(summary.dak.weightedContribution).toBe("16.00");

		// KD: (120+110+110+110)/4 = 112.50
		expect(summary.kd.praDipaCount).toBe(1);
		expect(summary.kd.q1Count).toBe(3);
		expect(summary.kd.denominatorCount).toBe(4);
		expect(summary.kd.score).toBe("112.50");
		expect(summary.kd.weightedContribution).toBe("45.00");

		// AK53: (100 + 80)/2 = 90.00
		expect(summary.ak53.completedCount).toBe(2);
		expect(summary.ak53.tw1Count).toBe(1);
		expect(summary.ak53.tw3Count).toBe(1);
		expect(summary.ak53.score).toBe("90.00");
		expect(summary.ak53.weightedContribution).toBe("36.00");
	});

	it("returns incomplete status when contracts are empty", () => {
		const summary = calcKontraktualSummary([], 2026);
		expect(summary.final.status).toBe("incomplete");
		expect(summary.final.score).toBeNull();
		expect(summary.recommendations.length).toBeGreaterThan(0);
	});
});

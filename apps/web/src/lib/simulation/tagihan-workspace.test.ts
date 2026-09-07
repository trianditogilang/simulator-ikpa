import { describe, expect, it } from "vitest";
import {
	calcTagihanSummary,
	evaluateSingleSpm,
} from "./tagihan-workspace";
import type { ContractRecord, SpmLsRecord } from "@/services/contracts-invoices-service";

describe("tagihan-workspace", () => {
	const sampleContracts: ContractRecord[] = [
		{
			id: "c-1",
			contractNumber: "SPK-001",
			accountCode: "53",
			value: "100000000",
			signedAt: "2026-02-01",
			paymentType: "sekaligus",
			sp2dAt: null,
		},
		{
			id: "c-2",
			contractNumber: "SPK-002",
			accountCode: "52",
			value: "60000000",
			signedAt: "2026-02-15",
			paymentType: "sekaligus",
			sp2dAt: null,
		},
	];

	it("matches canonical PDF example: 13 on-time from 15 eligible SPM LS = 86.67 score, 8.67 contribution", () => {
		const spmList: SpmLsRecord[] = [];
		// 13 on-time (e.g. 5 workdays)
		for (let i = 1; i <= 13; i++) {
			spmList.push({
				id: `spm-ontime-${i}`,
				contractId: "c-1",
				referenceNumber: `SPM-OT-${i}`,
				bastBappDate: "2026-03-02",
				receivedAtKppn: "2026-03-09", // 5 workdays <= 17
				isPegawai: false,
			});
		}
		// 2 late (e.g. 20 workdays)
		for (let i = 1; i <= 2; i++) {
			spmList.push({
				id: `spm-late-${i}`,
				contractId: "c-2",
				referenceNumber: `SPM-LT-${i}`,
				bastBappDate: "2026-03-02",
				receivedAtKppn: "2026-04-03", // > 17 workdays
				isPegawai: false,
			});
		}

		const summary = calcTagihanSummary(spmList, sampleContracts);
		expect(summary.totalSpmCount).toBe(15);
		expect(summary.eligibleCount).toBe(15);
		expect(summary.onTimeCount).toBe(13);
		expect(summary.lateCount).toBe(2);
		expect(summary.score).toBe("86.67");
		expect(summary.weightedContribution).toBe("8.67");
		expect(summary.status).toBe("complete");
	});

	it("strictly excludes belanja pegawai from calculation", () => {
		const spmList: SpmLsRecord[] = [
			{
				id: "spm-1",
				contractId: "c-1",
				referenceNumber: "SPM-001",
				bastBappDate: "2026-03-02",
				receivedAtKppn: "2026-03-09",
				isPegawai: false,
			},
			{
				id: "spm-pegawai-1",
				contractId: "c-1",
				referenceNumber: "SPM-GAJI-01",
				bastBappDate: "2026-03-02",
				receivedAtKppn: "2026-04-30", // late date if calculated, but should be ignored
				isPegawai: true,
			},
			{
				id: "spm-pegawai-2",
				contractId: "c-1",
				referenceNumber: "SPM-GAJI-02",
				bastBappDate: "2026-03-02",
				receivedAtKppn: "2026-03-05", // on-time date if calculated, but should be ignored
				isPegawai: true,
			},
		];

		const summary = calcTagihanSummary(spmList, sampleContracts);
		expect(summary.totalSpmCount).toBe(3);
		expect(summary.pegawaiCount).toBe(2);
		expect(summary.eligibleCount).toBe(1);
		expect(summary.onTimeCount).toBe(1);
		expect(summary.lateCount).toBe(0);
		expect(summary.score).toBe("100.00");
		expect(summary.weightedContribution).toBe("10.00");
	});

	it("handles pending / in-progress SPM without converting to on-time", () => {
		const spmList: SpmLsRecord[] = [
			{
				id: "spm-1",
				contractId: "c-1",
				referenceNumber: "SPM-001",
				bastBappDate: "2026-03-02",
				receivedAtKppn: "2026-03-09",
				isPegawai: false,
			},
			{
				id: "spm-pending",
				contractId: "c-1",
				referenceNumber: "SPM-PENDING",
				bastBappDate: "2026-03-02",
				receivedAtKppn: null,
				isPegawai: false,
			},
		];

		const summary = calcTagihanSummary(spmList, sampleContracts, undefined, "2026-03-10");
		expect(summary.totalSpmCount).toBe(2);
		expect(summary.pendingCount).toBe(1);
		expect(summary.status).toBe("warning");
		expect(summary.statusLabel).toContain("Estimasi");
	});

	it("evaluates single SPM evaluation correctly for exact H+17 vs H+18", () => {
		// BAST: 2026-03-02 (Monday)
		// H+1: Tue 3 Mar, H+2: Wed 4 Mar, H+3: Thu 5 Mar, H+4: Fri 6 Mar
		// H+5: Mon 9 Mar .. H+9: Fri 13 Mar
		// H+10: Mon 16 Mar .. H+14: Fri 20 Mar
		// H+15: Mon 23 Mar, H+16: Tue 24 Mar, H+17: Wed 25 Mar
		// H+18: Thu 26 Mar
		const onTimeSpm: SpmLsRecord = {
			id: "spm-17",
			contractId: "c-1",
			referenceNumber: "SPM-17",
			bastBappDate: "2026-03-02",
			receivedAtKppn: "2026-03-25",
			isPegawai: false,
		};
		const lateSpm: SpmLsRecord = {
			id: "spm-18",
			contractId: "c-1",
			referenceNumber: "SPM-18",
			bastBappDate: "2026-03-02",
			receivedAtKppn: "2026-03-26",
			isPegawai: false,
		};

		const evalOnTime = evaluateSingleSpm(onTimeSpm, sampleContracts);
		const evalLate = evaluateSingleSpm(lateSpm, sampleContracts);

		expect(evalOnTime.status).toBe("on_time");
		expect(evalOnTime.workdaysElapsed).toBe(17);
		expect(evalLate.status).toBe("late");
		expect(evalLate.workdaysElapsed).toBe(18);
	});

	it("returns incomplete status when no eligible SPM exists", () => {
		const summary = calcTagihanSummary([], sampleContracts);
		expect(summary.totalSpmCount).toBe(0);
		expect(summary.eligibleCount).toBe(0);
		expect(summary.score).toBeNull();
		expect(summary.weightedContribution).toBeNull();
		expect(summary.status).toBe("incomplete");
	});
});

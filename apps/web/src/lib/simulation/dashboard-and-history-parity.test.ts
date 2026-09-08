import { describe, expect, it } from "vitest";
import { calculateIkpa, default2026RuleSet } from "@simulator-ikpa/ikpa-engine";
import {
	CANONICAL_INDICATOR_KEYS,
	resolveIndicatorRoute,
} from "../indicator-routes";
import {
	mockOperatorDashboardNormal,
	mockOperatorDashboardIncomplete,
} from "../../mocks/operator-dashboard";

describe("Dashboard & Indicator Canonical Routes Mapping", () => {
	it("resolves all 8 canonical indicator routes with correct labels and paths", () => {
		for (const key of CANONICAL_INDICATOR_KEYS) {
			const routeInfo = resolveIndicatorRoute(key);
			expect(routeInfo).not.toBeNull();
			expect(routeInfo?.label).toBeDefined();
			expect(routeInfo?.route).toBeDefined();
			expect(routeInfo?.route.startsWith("/operator/")).toBe(true);
		}
	});

	it("correctly routes Belanja Kontraktual and Penyelesaian Tagihan with dedicated tabs", () => {
		const contractRoute = resolveIndicatorRoute("contractual");
		expect(contractRoute?.label).toBe("Belanja Kontraktual");
		expect(contractRoute?.route).toBe("/operator/data/contracts-invoices?tab=contracts");

		const invoiceRoute = resolveIndicatorRoute("invoice_timeliness");
		expect(invoiceRoute?.label).toBe("Penyelesaian Tagihan");
		expect(invoiceRoute?.route).toBe("/operator/data/contracts-invoices?tab=invoices");
	});

	it("resolves legacy and alternate keys gracefully", () => {
		expect(resolveIndicatorRoute("rpd_deviation")?.label).toBe("Deviasi Halaman III");
		expect(resolveIndicatorRoute("spm_dispensasi")?.label).toBe("Dispensasi SPM");
		expect(resolveIndicatorRoute("revisi_dipa")?.label).toBe("Revisi DIPA");
		expect(resolveIndicatorRoute("penyerapan")?.label).toBe("Penyerapan Anggaran");
	});

	it("returns null for unknown keys without throwing", () => {
		expect(resolveIndicatorRoute("unknown_indicator_xyz")).toBeNull();
		expect(resolveIndicatorRoute("")).toBeNull();
		expect(resolveIndicatorRoute(null)).toBeNull();
		expect(resolveIndicatorRoute(undefined)).toBeNull();
	});
});

describe("Dashboard Data Parity & State Integrity", () => {
	it("calculates total IKPA as sum of weighted scores minus dispensation deduction", () => {
		const data = mockOperatorDashboardNormal;
		const normalIndicators = data.indicators.filter((i) => !i.isDeduction);
		const deductionIndicator = data.indicators.find((i) => i.isDeduction);

		const sumWeighted = normalIndicators.reduce((acc, i) => acc + i.weightedScore, 0);
		const deduction = deductionIndicator ? (deductionIndicator.rawScore ?? 0) : 0;
		const calculatedTotal = sumWeighted - deduction;

		expect(calculatedTotal).toBeCloseTo(data.totalScore ?? 0, 1);
	});

	it("displays null/incomplete state properly without falling back to demo numbers", () => {
		const incompleteData = mockOperatorDashboardIncomplete;
		expect(incompleteData.totalScore).toBeNull();
		expect(incompleteData.dataStatus).toBe("incomplete");
		expect(incompleteData.gapScore).toBeNull();
	});

	it("ensures recommendations have proper human-readable labels and canonical routes", () => {
		const data = mockOperatorDashboardNormal;
		for (const act of data.priorityActions) {
			expect(act.domainLabel).toBeDefined();
			expect(act.domainLabel).not.toBe("");
			expect(act.route).toBeDefined();
			expect(act.route.startsWith("/operator/")).toBe(true);
			// Must not expose raw keys like "invoice_timeliness" or "output_achievement"
			expect(act.domainLabel).not.toMatch(/^[a-z_]+$/);
		}
	});

	it("assigns Priority 1 badge to the highest impact indicator", () => {
		const data = mockOperatorDashboardNormal;
		const priority1Indicator = data.indicators.find((i) => i.isPriority1);
		expect(priority1Indicator).toBeDefined();
		expect(priority1Indicator?.name).toBe("Penyerapan Anggaran");
	});

	it("calculates complete IKPA scores for July, August, and September without missing data", () => {
		for (const m of [6, 7, 8, 9]) {
			const engineInput = {
				ruleSetId: "123e4567-e89b-12d3-a456-426614174000",
				ruleSetVersion: 1,
				organizationId: "123e4567-e89b-12d3-a456-426614174001",
				fiscalYear: 2026,
				period: { kind: "month" as const, value: m },
				isBlu: false,
				targetScore: "95.00",
				simulationType: "actual" as const,
				dipaRevision: {
					semester1Revisions: 2,
					semester2Revisions: m > 6 ? 1 : 0,
					hasBudgetChange: [false, false],
				},
				rpdDeviation: {
					months: Array.from({ length: Math.min(m, 11) }, (_, i) => ({
						month: i + 1,
						planned: { "51": "100000000", "52": "66666666", "53": "41666666", "57": "0" },
						realized: { "51": "98000000", "52": "65000000", "53": "40500000", "57": "0" },
					})),
					budgetByType: { "51": "1200000000", "52": "800000000", "53": "500000000", "57": "0" },
				},
				absorption: {
					quarters: Array.from({ length: Math.ceil(m / 3) }, (_, i) => ({
						quarter: (i + 1) as 1 | 2 | 3 | 4,
						budget: { "51": "1200000000", "52": "800000000", "53": "500000000", "57": "0" },
						realized: {
							"51": String((i + 1) * 3 * 98000000),
							"52": String((i + 1) * 3 * 65000000),
							"53": String((i + 1) * 3 * 40500000),
							"57": "0",
						},
					})),
				},
				contractual: {
					contracts: [
						{
							id: "c1",
							contractNumber: "KTR-001",
							accountCode: "53",
							amount: "150000000",
							signedDate: "2026-01-10",
							paymentType: "sekaligus" as const,
							sp2dDate: "2026-01-22",
							isEarlyProcurement: true,
						},
						{
							id: "c2",
							contractNumber: "KTR-002",
							accountCode: "53",
							amount: "180000000",
							signedDate: "2026-02-12",
							paymentType: "sekaligus" as const,
							sp2dDate: "2026-02-24",
							isEarlyProcurement: false,
						},
						{
							id: "c3",
							contractNumber: "KTR-003",
							accountCode: "52",
							amount: "80000000",
							signedDate: "2026-05-15",
							paymentType: "sekaligus" as const,
							sp2dDate: "2026-05-28",
							isEarlyProcurement: false,
						},
					],
					accelerations53: [],
					fiscalYear: 2026,
				},
				invoiceTimeliness: {
					invoices: [
						{ id: "i1", bastDate: "2026-01-12", spmDate: "2026-01-18", isContractual: true, isPegawai: false },
						{ id: "i2", bastDate: "2026-02-15", spmDate: "2026-02-20", isContractual: true, isPegawai: false },
						{ id: "i3", bastDate: "2026-05-18", spmDate: "2026-05-24", isContractual: true, isPegawai: false },
					],
					workdayCalendar: { holidays: [], workdays: [] },
				},
				upTup: {
					transactions: [
						{ id: "u1", type: "UP" as const, amount: "50000000", date: "2026-01-08", settlementDate: null, isSettled: false },
						{ id: "u2", type: "GUP" as const, amount: "42000000", date: "2026-02-10", settlementDate: "2026-02-10", isSettled: true },
						{ id: "u3", type: "GUP" as const, amount: "45000000", date: "2026-03-12", settlementDate: "2026-03-12", isSettled: true },
					],
					kkpTransactions: [
						{ id: "k1", amount: "10000000", date: "2026-01-10" },
						{ id: "k2", amount: "10000000", date: "2026-02-10" },
					],
				},
				outputAchievement: {
					reports: [
						{
							id: "r1",
							roCode: "5241.AAA.001",
							period: m,
							rvro: String(m),
							volumeDipa: "12",
							pcro: (m * 8.33).toFixed(2),
							tpcro: (m * 8.33).toFixed(2),
							reportedDate: `2026-0${Math.min(m + 1, 9)}-04`,
							deadlineDate: `2026-0${Math.min(m + 1, 9)}-07`,
							confirmed: true,
						},
					],
					evalPeriod: m,
				},
				spmDispensation: { dispensationCount: 0, totalSpmQ4: 0 },
			};

			const result = calculateIkpa(engineInput, default2026RuleSet);
			expect(result.totalScore).not.toBeNull();
			const scoreNum = parseFloat(result.totalScore!);
			expect(scoreNum).toBeGreaterThan(90);
			expect(scoreNum).toBeLessThanOrEqual(105);
			expect(result.missingData).toHaveLength(0);

			for (const ind of result.indicators) {
				expect(ind.status).toBe("complete");
				expect(ind.score).not.toBeNull();
			}
		}
	});
});

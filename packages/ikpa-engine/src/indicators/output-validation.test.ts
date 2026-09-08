import { describe, expect, it } from "vitest";
import {
	evaluateOutputAnomaly,
	hasBlockingValidation,
	hasConfirmationRequiredValidation,
	validateOutputRecord,
} from "./output-validation";

describe("Output Validation Engine 00–08 & Anomaly Detection", () => {
	it("VAL-00: Semua data konsisten -> 00 valid passed", () => {
		const res = validateOutputRecord({
			roCode: "001",
			month: 7,
			volumeDipa: 100,
			rvroCumulative: 70,
			pcroCumulative: 70,
			tpcroCumulative: 70,
			ppaCumulative: 70,
		});

		expect(res.some((r) => r.code === "00" && r.status === "passed")).toBe(true);
		expect(hasBlockingValidation(res)).toBe(false);
	});

	it("VAL-01: PPA > 0 dan PCRO = 0 -> Blocker, Kirim tidak aktif", () => {
		const res = validateOutputRecord({
			roCode: "001",
			month: 7,
			volumeDipa: 100,
			rvroCumulative: 0,
			pcroCumulative: 0,
			tpcroCumulative: 50,
			ppaCumulative: 10,
		});

		const r01 = res.find((r) => r.code === "01");
		expect(r01).toBeDefined();
		expect(r01?.severity).toBe("blocking");
		expect(r01?.status).toBe("failed");
		expect(hasBlockingValidation(res)).toBe(true);
	});

	it("VAL-02: PPA 64, PCRO 55 -> Confirmation required dan alasan wajib", () => {
		const res = validateOutputRecord({
			roCode: "001",
			month: 7,
			volumeDipa: 100,
			rvroCumulative: 55,
			pcroCumulative: 55,
			tpcroCumulative: 60,
			ppaCumulative: 64,
		});

		const r02 = res.find((r) => r.code === "02");
		expect(r02).toBeDefined();
		expect(r02?.severity).toBe("confirmation_required");
		expect(r02?.requiresOperatorNote).toBe(true);
		expect(hasConfirmationRequiredValidation(res)).toBe(true);
	});

	it("VAL-03: PCRO 100, RVRO 0 -> Correctable warning", () => {
		const res = validateOutputRecord({
			roCode: "001",
			month: 7,
			volumeDipa: 100,
			rvroCumulative: 0,
			pcroCumulative: 100,
			tpcroCumulative: 100,
			ppaCumulative: 100,
		});

		const r03 = res.find((r) => r.code === "03");
		expect(r03).toBeDefined();
		expect(r03?.severity).toBe("correctable");
	});

	it("VAL-04: PCRO 100, RVRO < volumeDipa -> Blocker", () => {
		const res = validateOutputRecord({
			roCode: "001",
			month: 7,
			volumeDipa: 100,
			rvroCumulative: 80,
			pcroCumulative: 100,
			tpcroCumulative: 100,
			ppaCumulative: 100,
		});

		const r04 = res.find((r) => r.code === "04");
		expect(r04).toBeDefined();
		expect(r04?.severity).toBe("blocking");
		expect(hasBlockingValidation(res)).toBe(true);
	});

	it("VAL-05: RVRO > 0, PPA = 0 -> Confirmation required", () => {
		const res = validateOutputRecord({
			roCode: "001",
			month: 7,
			volumeDipa: 100,
			rvroCumulative: 20,
			pcroCumulative: 20,
			tpcroCumulative: 20,
			ppaCumulative: 0,
		});

		const r05 = res.find((r) => r.code === "05");
		expect(r05).toBeDefined();
		expect(r05?.severity).toBe("confirmation_required");
		expect(r05?.requiresEvidence).toBe(true);
	});

	it("VAL-06: RVRO desimal pada satuan integer only -> Correctable", () => {
		const res = validateOutputRecord({
			roCode: "001",
			month: 7,
			unit: "Siswa",
			unitAllowsDecimal: false,
			volumeDipa: 100,
			rvroCumulative: 50.5,
			pcroCumulative: 50,
			tpcroCumulative: 50,
			ppaCumulative: 50,
		});

		const r06 = res.find((r) => r.code === "06");
		expect(r06).toBeDefined();
		expect(r06?.severity).toBe("correctable");
	});

	it("VAL-07: RVRO > volumeDipa -> Confirmation required; skor F2 cap 100", () => {
		const res = validateOutputRecord({
			roCode: "001",
			month: 7,
			volumeDipa: 100,
			rvroCumulative: 120,
			pcroCumulative: 100,
			tpcroCumulative: 100,
			ppaCumulative: 100,
		});

		const r07 = res.find((r) => r.code === "07");
		expect(r07).toBeDefined();
		expect(r07?.severity).toBe("confirmation_required");
		expect(r07?.requiresOperatorNote).toBe(true);
	});

	it("VAL-08: RVRO >= volumeDipa, PCRO < 100 -> Confirmation required", () => {
		const res = validateOutputRecord({
			roCode: "001",
			month: 7,
			volumeDipa: 100,
			rvroCumulative: 100,
			pcroCumulative: 90,
			tpcroCumulative: 90,
			ppaCumulative: 90,
		});

		const r08 = res.find((r) => r.code === "08");
		expect(r08).toBeDefined();
		expect(r08?.severity).toBe("confirmation_required");
	});

	it("VAL-09: PPA per RO belum tersedia -> not_evaluable", () => {
		const res = validateOutputRecord({
			roCode: "001",
			month: 7,
			volumeDipa: 100,
			rvroCumulative: 50,
			pcroCumulative: 50,
			tpcroCumulative: 50,
			ppaCumulative: null,
		});

		const r01 = res.find((r) => r.code === "01");
		expect(r01?.status).toBe("not_evaluable");
		const r02 = res.find((r) => r.code === "02");
		expect(r02?.status).toBe("not_evaluable");
		const r05 = res.find((r) => r.code === "05");
		expect(r05?.status).toBe("not_evaluable");
	});

	it("ANOM-01: RO Prioritas Nasional PCRO 72, PPA 66 -> Anomali tinggi +6 poin", () => {
		const anomaly = evaluateOutputAnomaly({
			roCode: "001",
			month: 7,
			isPriorityNational: true,
			volumeDipa: 100,
			rvroCumulative: 72,
			pcroCumulative: 72,
			tpcroCumulative: 70,
			ppaCumulative: 66,
		});

		expect(anomaly.hasAnomaly).toBe(true);
		expect(anomaly.anomalyType).toBe("ANOMALI_CAPAIAN_TERLALU_TINGGI");
		expect(anomaly.gap).toBe(6);
	});

	it("ANOM-02: RO Non-PN PCRO 40, PPA 80 -> Anomali rendah -40 poin", () => {
		const anomaly = evaluateOutputAnomaly({
			roCode: "002",
			month: 7,
			isPriorityNational: false,
			volumeDipa: 100,
			rvroCumulative: 40,
			pcroCumulative: 40,
			tpcroCumulative: 80,
			ppaCumulative: 80,
		});

		expect(anomaly.hasAnomaly).toBe(true);
		expect(anomaly.anomalyType).toBe("ANOMALI_CAPAIAN_TERLALU_RENDAH");
		expect(anomaly.gap).toBe(-40);
	});
});

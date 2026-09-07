import { describe, expect, it } from "vitest";
import {
	buildUpTupEngineInput,
	calcGupPreview,
	calcTanggalMaksimal,
	DEFAULT_UP_TUP_ASSUMPTIONS,
	maxHariSP2DAgar100,
} from "./up-tup-assumptions";

describe("calcTanggalMaksimal", () => {
	it("hari yang sama bulan depan", () => {
		expect(calcTanggalMaksimal("2026-05-05")).toBe("2026-06-05");
	});
});

describe("calcGupPreview golden workbook", () => {
	it("contoh default: UP 18jt, GUP 11jt, 5 Mei -> 25 Mei = 94.72 Tepat Waktu", () => {
		const p = calcGupPreview(DEFAULT_UP_TUP_ASSUMPTIONS);
		expect(p.isValid).toBe(true);
		expect(p.persentaseGUP).toBeCloseTo(11 / 18, 6);
		expect(p.hariDisebulankan).toBe(31);
		expect(p.hariSP2D).toBe(20);
		expect(p.tanggalMaksimal).toBe("2026-06-05");
		expect(p.status).toBe("Tepat Waktu");
		expect(p.nilaiRaw).toBeCloseTo(94.7222, 2);
		expect(p.nilaiCapped).toBeCloseTo(94.7222, 2);
		expect(p.isCapped).toBe(false);
		expect(p.formulaTrace.length).toBe(4);
	});
	it("kasus gambar: UP 18jt, GUP 1jt, 5 Mei -> 25 Mei = 8.61 Tepat Waktu + saran UBAH", () => {
		const p = calcGupPreview({
			...DEFAULT_UP_TUP_ASSUMPTIONS,
			nilaiRencanaGUP: "1000000",
		});
		expect(p.isValid).toBe(true);
		expect(p.persentaseGUP).toBeCloseTo(1 / 18, 6);
		expect(p.hariDisebulankan).toBe(31);
		expect(p.hariSP2D).toBe(20);
		expect(p.tanggalMaksimal).toBe("2026-06-05");
		expect(p.status).toBe("Tepat Waktu");
		expect(p.nilaiRaw).toBeCloseTo(8.6111, 2);
		expect(p.nilaiCapped).toBeCloseTo(8.6111, 2);
		expect(p.isCapped).toBe(false);
		expect(p.saran).toMatch(/TAMBAHKAN Nilai Rencana GUP/);
	});
	it("cap 100 bila lebih cepat / nominal besar", () => {
		const p = calcGupPreview({
			...DEFAULT_UP_TUP_ASSUMPTIONS,
			nilaiRencanaGUP: "18000000",
			tanggalRencanaGUP: "2026-05-15",
		});
		expect(p.nilaiRaw).toBeGreaterThan(100);
		expect(p.nilaiCapped).toBe(100);
		expect(p.isCapped).toBe(true);
		expect(p.saran).toMatch(/OKE/);
	});
	it("terlambat bila lewat tanggal maksimal", () => {
		const p = calcGupPreview({
			...DEFAULT_UP_TUP_ASSUMPTIONS,
			tanggalRencanaGUP: "2026-06-10",
		});
		expect(p.status).toBe("Terlambat");
	});
	it("invalid bila UP 0", () => {
		const p = calcGupPreview({ ...DEFAULT_UP_TUP_ASSUMPTIONS, nilaiUP: "0" });
		expect(p.isValid).toBe(false);
	});
});

describe("maxHariSP2DAgar100", () => {
	it("50% x 28 hari = 14", () => {
		expect(maxHariSP2DAgar100(0.5, 28)).toBe(14);
	});
	it("tabel acuan: 100% x 28/30/31 = 28/30/31; 55% x 30 = 16", () => {
		expect(maxHariSP2DAgar100(1, 28)).toBe(28);
		expect(maxHariSP2DAgar100(1, 30)).toBe(30);
		expect(maxHariSP2DAgar100(1, 31)).toBe(31);
		expect(maxHariSP2DAgar100(0.55, 30)).toBe(16);
	});
});

describe("buildUpTupEngineInput", () => {
	it("selalu hasilkan 1 transaksi UP rencana GUP", () => {
		const { transactions, kkpTransactions } = buildUpTupEngineInput(
			DEFAULT_UP_TUP_ASSUMPTIONS,
		);
		expect(transactions.length).toBe(1);
		expect(transactions[0].type).toBe("UP");
		expect(transactions[0].date).toBe("2026-05-05");
		expect(transactions[0].settlementDate).toBe("2026-05-25");
		expect(kkpTransactions.length).toBe(0);
	});
	it("TUP/KKP opsional ikut terkonversi", () => {
		const { transactions, kkpTransactions } = buildUpTupEngineInput({
			...DEFAULT_UP_TUP_ASSUMPTIONS,
			tupTepat: 1,
			tupTerlambat: 1,
			kkpNominal: "500000",
			kkpTanggal: "2026-05-15",
		});
		expect(transactions.length).toBe(3);
		expect(kkpTransactions.length).toBe(1);
	});
});

describe("analyzeGupPlan - 6 Specification Scenarios (Section 11)", () => {
	it("Skenario 1 - Optimal: UP 10M, GUP 5.1M, 1 Jan -> 15 Jan 2026", () => {
		const res = calcGupPreview({
			...DEFAULT_UP_TUP_ASSUMPTIONS,
			nilaiUP: "10000000",
			nilaiRencanaGUP: "5100000",
			tanggalGUPSebelumnya: "2026-01-01",
			tanggalRencanaGUP: "2026-01-15",
		}).analysis!;

		expect(res.isValid).toBe(true);
		expect(res.rawGupPercent).toBeCloseTo(51, 2);
		expect(res.intervalDays).toBe(14);
		expect(res.referenceMonthDays).toBe(31);
		expect(res.annualizedGupPercent).toBeCloseTo(112.92857, 2);
		expect(res.isOnTime).toBe(true);
		expect(res.isMinimumAmountMet).toBe(true);
		expect(res.isProportional).toBe(true);
		expect(res.submissionStatus).toBe("ELIGIBLE_OPTIMAL");
		expect(res.ikpaQualityStatus).toBe("OPTIMAL");
		expect(res.actions[0].type).toBe("maintain");
	});

	it("Skenario 2 - Tidak Proporsional: UP 10M, GUP 6M, 1 Jan -> 25 Jan 2026", () => {
		const res = calcGupPreview({
			...DEFAULT_UP_TUP_ASSUMPTIONS,
			nilaiUP: "10000000",
			nilaiRencanaGUP: "6000000",
			tanggalGUPSebelumnya: "2026-01-01",
			tanggalRencanaGUP: "2026-01-25",
		}).analysis!;

		expect(res.isValid).toBe(true);
		expect(res.rawGupPercent).toBeCloseTo(60, 2);
		expect(res.intervalDays).toBe(24);
		expect(res.referenceMonthDays).toBe(31);
		expect(res.annualizedGupPercent).toBeCloseTo(77.5, 2);
		expect(res.isOnTime).toBe(true);
		expect(res.isMinimumAmountMet).toBe(true);
		expect(res.isProportional).toBe(false);
		expect(res.submissionStatus).toBe("NOT_PROPORTIONAL");
		expect(res.ikpaQualityStatus).toBe("BELOW_OPTIMAL");
		// Rekomendasi nominal minimum optimal dibulatkan ke atas = 7.741.936
		expect(res.minimumAmountForOptimalAtPlannedDate).toBe(7741936);
		// Rekomendasi tanggal optimal untuk 6M = 1 Jan + 18 hari = 19 Jan 2026
		expect(res.latestOptimalDateForCurrentAmount).toBe("2026-01-19");
	});

	it("Skenario 3 - Terlambat: UP 10M, GUP 10M, 1 Jan -> 2 Feb 2026", () => {
		const res = calcGupPreview({
			...DEFAULT_UP_TUP_ASSUMPTIONS,
			nilaiUP: "10000000",
			nilaiRencanaGUP: "10000000",
			tanggalGUPSebelumnya: "2026-01-01",
			tanggalRencanaGUP: "2026-02-02",
		}).analysis!;

		expect(res.isValid).toBe(true);
		expect(res.rawGupPercent).toBeCloseTo(100, 2);
		expect(res.intervalDays).toBe(32);
		expect(res.referenceMonthDays).toBe(31);
		expect(res.annualizedGupPercent).toBeCloseTo(96.875, 2);
		expect(res.isOnTime).toBe(false);
		expect(res.lateDays).toBe(1);
		expect(res.submissionStatus).toBe("LATE");
		expect(res.ikpaQualityStatus).toBe("LATE_NOT_OPTIMAL");
		expect(res.actions[0].type).toBe("adjust_date");
		expect(res.actions[0].description).toMatch(/2026-02-01|1 Februari 2026/);
	});

	it("Skenario 4 - Di bawah Minimum: UP 10M, GUP 1M, 1 Jan -> 23 Jan 2026", () => {
		const res = calcGupPreview({
			...DEFAULT_UP_TUP_ASSUMPTIONS,
			nilaiUP: "10000000",
			nilaiRencanaGUP: "1000000",
			tanggalGUPSebelumnya: "2026-01-01",
			tanggalRencanaGUP: "2026-01-23",
		}).analysis!;

		expect(res.isValid).toBe(true);
		expect(res.isMinimumAmountMet).toBe(false);
		expect(res.minGupAmount).toBe(5000000);
		expect(res.submissionStatus).toBe("BELOW_MINIMUM");
		// Tanggal batas untuk GUP 50% = 1 Jan + 15 hari = 16 Jan 2026
		expect(res.maxIntervalForMinimumAmount).toBe(15);
		expect(res.latestOptimalDateForMinimumAmount).toBe("2026-01-16");
	});

	it("Skenario 5 - Data Default Screenshot: UP 18M, GUP 11M, 5 Mei -> 25 Mei 2026", () => {
		const res = calcGupPreview({
			...DEFAULT_UP_TUP_ASSUMPTIONS,
			nilaiUP: "18000000",
			nilaiRencanaGUP: "11000000",
			tanggalGUPSebelumnya: "2026-05-05",
			tanggalRencanaGUP: "2026-05-25",
		}).analysis!;

		expect(res.isValid).toBe(true);
		expect(res.rawGupPercent).toBeCloseTo(61.111, 2);
		expect(res.intervalDays).toBe(20);
		expect(res.referenceMonthDays).toBe(31);
		expect(res.annualizedGupPercent).toBeCloseTo(94.7222, 2);
		expect(res.isOnTime).toBe(true);
		expect(res.isMinimumAmountMet).toBe(true);
		expect(res.isProportional).toBe(false);
		expect(res.submissionStatus).toBe("NOT_PROPORTIONAL");
		// Rekomendasi nominal minimum optimal = 11.612.904
		expect(res.minimumAmountForOptimalAtPlannedDate).toBe(11612904);
		// Rekomendasi tanggal optimal untuk 11M = 5 Mei + 18 hari = 23 Mei 2026
		expect(res.latestOptimalDateForCurrentAmount).toBe("2026-05-23");
	});

	it("Skenario 6 - Februari Kabisat: UP 10M, GUP 5M, 1 Feb -> 15 Feb 2028", () => {
		const res = calcGupPreview({
			...DEFAULT_UP_TUP_ASSUMPTIONS,
			nilaiUP: "10000000",
			nilaiRencanaGUP: "5000000",
			tanggalGUPSebelumnya: "2028-02-01",
			tanggalRencanaGUP: "2028-02-15",
		}).analysis!;

		expect(res.isValid).toBe(true);
		expect(res.referenceMonthDays).toBe(29);
		expect(res.intervalDays).toBe(14);
		expect(res.annualizedGupPercent).toBeCloseTo(103.5714, 2);
		expect(res.isOnTime).toBe(true);
		expect(res.isMinimumAmountMet).toBe(true);
		expect(res.submissionStatus).toBe("ELIGIBLE_OPTIMAL");
		expect(res.ikpaQualityStatus).toBe("OPTIMAL");
	});

	describe("Edge Cases & Validations", () => {
		it("error jika rencana <= tanggal sebelumnya", () => {
			const res = calcGupPreview({
				...DEFAULT_UP_TUP_ASSUMPTIONS,
				tanggalGUPSebelumnya: "2026-05-05",
				tanggalRencanaGUP: "2026-05-05",
			}).analysis!;
			expect(res.isValid).toBe(false);
			expect(res.validationMessage).toMatch(/setelah/);
		});

		it("error jika GUP > UP", () => {
			const res = calcGupPreview({
				...DEFAULT_UP_TUP_ASSUMPTIONS,
				nilaiUP: "10000000",
				nilaiRencanaGUP: "15000000",
			}).analysis!;
			expect(res.isValid).toBe(false);
			expect(res.validationMessage).toMatch(/melebihi/);
		});
	});
});

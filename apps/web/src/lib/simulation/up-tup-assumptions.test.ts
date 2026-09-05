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

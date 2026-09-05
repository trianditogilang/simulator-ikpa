import { describe, expect, it } from "vitest";
import {
	addWorkdaysMonFri,
	buildOutputSummary,
	buildSpmReminders,
	countWorkdaysMonFri,
	outputDeadline,
	tagihanAdvice,
} from "./tagihan-output-reminder";

describe("countWorkdaysMonFri", () => {
	it("Senin–Jumat start-exclusive end-inclusive, lewati akhir pekan", () => {
		expect(countWorkdaysMonFri("2026-05-04", "2026-05-05")).toBe(1);
		expect(countWorkdaysMonFri("2026-05-08", "2026-05-11")).toBe(1);
		expect(countWorkdaysMonFri("2026-05-04", "2026-05-04")).toBe(0);
		expect(countWorkdaysMonFri("buruk", "2026-05-05")).toBeNull();
	});
});

describe("addWorkdaysMonFri", () => {
	it("tambah hari kerja lewati akhir pekan", () => {
		expect(addWorkdaysMonFri("2026-05-08", 1)).toBe("2026-05-11");
		expect(addWorkdaysMonFri("2026-05-29", 5)).toBe("2026-06-05");
	});
});

describe("buildSpmReminders", () => {
	it("H+17 tepat vs terlambat", () => {
		const list = buildSpmReminders([
			{ id: "1", referenceNumber: "SPM-1", bastBappDate: "2026-05-04", receivedAtKppn: "2026-05-11", isPegawai: false },
			{ id: "2", referenceNumber: "SPM-2", bastBappDate: "2026-05-04", receivedAtKppn: "2026-06-10", isPegawai: false },
		]);
		expect(list[0].status).toBe("Tepat Waktu");
		expect(list[1].status).toBe("Terlambat");
		expect(list[1].elapsedWorkdays).toBeGreaterThan(17);
	});

	it("saran kontekstual menyebut berkas terlambat", () => {
		const advice = tagihanAdvice(
			buildSpmReminders([
				{ id: "1", referenceNumber: "SPM-9", bastBappDate: "2026-05-04", receivedAtKppn: "2026-06-10", isPegawai: false },
			]),
		);
		expect(advice).toContain("SPM-9");
		expect(advice).toContain("H+17");
	});

	it("kosong tetap tampilkan aturan H+17", () => {
		expect(tagihanAdvice([])).toContain("H+17");
	});
});

describe("outputDeadline", () => {
	it("5 hari kerja setelah akhir bulan", () => {
		expect(outputDeadline(2026, 5)).toBe("2026-06-05");
		expect(outputDeadline(2026, 1)).toBe("2026-02-06");
	});
});

describe("buildOutputSummary", () => {
	it("tepat, terlambat, belum", () => {
		const s = buildOutputSummary(
			[
				{ roCode: "RO-1", reportedAt: "2026-06-02", confirmed: true },
				{ roCode: "RO-2", reportedAt: "2026-06-10", confirmed: true },
				{ roCode: "RO-3", reportedAt: null, confirmed: false },
			],
			2026,
			5,
			"2026-06-03",
		);
		expect(s.deadline).toBe("2026-06-05");
		expect(s.tepat).toBe(1);
		expect(s.terlambat).toBe(1);
		expect(s.belum).toBe(1);
		expect(s.advice).toContain("2026-06-05");
	});

	it("kosong tetap tampilkan aturan 5 hari kerja", () => {
		const s = buildOutputSummary([], 2026, 5);
		expect(s.advice).toContain("5 hari kerja");
	});
});

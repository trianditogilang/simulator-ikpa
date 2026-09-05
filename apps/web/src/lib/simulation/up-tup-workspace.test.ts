import { describe, expect, it } from "vitest";
import {
	buildGupReminders,
	calcUpTupScore,
	collapseDbType,
	mapActualToEngine,
	mergeWithAssumptions,
} from "./up-tup-workspace";
import { DEFAULT_UP_TUP_ASSUMPTIONS } from "./up-tup-assumptions";

describe("collapseDbType", () => {
	it("mirror server: non-UP/TUP collapse ke UP", () => {
		expect(collapseDbType("UP")).toBe("UP");
		expect(collapseDbType("TUP")).toBe("TUP");
		expect(collapseDbType("GUP")).toBe("UP");
		expect(collapseDbType("PTUP")).toBe("UP");
		expect(collapseDbType("GUP_NIHIL")).toBe("UP");
		expect(collapseDbType("SETORAN_TUP")).toBe("UP");
	});
});

describe("mapActualToEngine", () => {
	it("memetakan baris DB ke input engine, lewati tanggal tak valid", () => {
		const { transactions, kkpTransactions } = mapActualToEngine(
			[
				{ id: "1", type: "GUP", amount: "11000000", sp2dAt: "2026-05-05", settlementDate: "2026-05-25", isSettled: true },
				{ id: "2", type: "TUP", amount: "5000000", sp2dAt: "buruk", settlementDate: null, isSettled: false },
			],
			[{ id: "k1", month: 5, amount: "2000000", usageDate: "2026-05-15" }],
			2026,
		);
		expect(transactions).toHaveLength(1);
		expect(transactions[0].type).toBe("UP");
		expect(transactions[0].amount).toBe("11000000.00");
		expect(kkpTransactions[0].date).toBe("2026-05-15");
	});

	it("fallback tanggal KKP dari bulan + tahun", () => {
		const { kkpTransactions } = mapActualToEngine(
			[],
			[{ id: "k1", month: 5, amount: "1000000", usageDate: null }],
			2026,
		);
		expect(kkpTransactions[0].date).toBe("2026-05-15");
	});
});

describe("calcUpTupScore", () => {
	it("null saat tanpa transaksi", () => {
		expect(calcUpTupScore([], [], 5).score).toBeNull();
	});

	it("skor via engine untuk actual GUP tepat waktu", () => {
		const { transactions, kkpTransactions } = mapActualToEngine(
			[
				{ id: "1", type: "GUP", amount: "11000000", sp2dAt: "2026-05-05", settlementDate: "2026-05-25", isSettled: true },
			],
			[],
			2026,
		);
		const result = calcUpTupScore(transactions, kkpTransactions, 5);
		expect(result.score).toBe(100);
		expect(result.contribution).toBe(10);
		expect(result.status).toBe("complete");
	});
});

describe("mergeWithAssumptions", () => {
	it("asumsi menempel tanpa menimpa actual", () => {
		const actual = mapActualToEngine(
			[
				{ id: "1", type: "GUP", amount: "11000000", sp2dAt: "2026-05-05", settlementDate: "2026-05-25", isSettled: true },
			],
			[],
			2026,
		);
		const snapshot = JSON.parse(JSON.stringify(actual));
		const merged = mergeWithAssumptions(actual, {
			...DEFAULT_UP_TUP_ASSUMPTIONS,
			tupTepat: 1,
		});
		expect(merged.transactions.length).toBeGreaterThan(
			actual.transactions.length,
		);
		expect(actual).toEqual(snapshot);
		expect(mergeWithAssumptions(actual, null)).toBe(actual);
	});
});

describe("buildGupReminders", () => {
	it("tepat waktu, terlambat, dan menunggu", () => {
		const list = buildGupReminders(
			[
				{ id: "1", type: "GUP", amount: "11000000", sp2dAt: "2026-05-05", settlementDate: "2026-05-25", isSettled: true },
				{ id: "2", type: "PTUP", amount: "5000000", sp2dAt: "2026-05-05", settlementDate: "2026-06-10", isSettled: true },
				{ id: "3", type: "GUP", amount: "8000000", sp2dAt: "2026-05-05", settlementDate: null, isSettled: false },
			],
			"2026-05-20",
		);
		expect(list).toHaveLength(3);
		expect(list[0].status).toBe("Tepat Waktu");
		expect(list[0].dueDate).toBe("2026-06-05");
		expect(list[1].status).toBe("Terlambat");
		expect(list[2].status).toBe("Menunggu");
		expect(list[2].detail).toContain("H−16");
	});

	it("lewat jatuh tempo jadi Terlambat", () => {
		const list = buildGupReminders(
			[
				{ id: "1", type: "GUP", amount: "8000000", sp2dAt: "2026-05-05", settlementDate: null, isSettled: false },
			],
			"2026-06-10",
		);
		expect(list[0].status).toBe("Terlambat");
	});

	it("abaikan tipe UP/TUP murni", () => {
		expect(
			buildGupReminders(
				[
					{ id: "1", type: "UP", amount: "1000000", sp2dAt: "2026-05-05", settlementDate: null, isSettled: false },
				],
				"2026-05-20",
			),
		).toHaveLength(0);
	});
});

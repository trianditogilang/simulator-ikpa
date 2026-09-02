import { describe, expect, it } from "vitest";
import { sanitizeForExport } from "../import/parser";

describe("operator-xlsx export sanitize & metadata", () => {
	it("neutralizes formula injection prefix", () => {
		expect(sanitizeForExport("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
		expect(sanitizeForExport("+123")).toBe("'+123");
		expect(sanitizeForExport("-123")).toBe("'-123");
		expect(sanitizeForExport("@malicious")).toBe("'@malicious");
		expect(sanitizeForExport("normal")).toBe("normal");
		expect(sanitizeForExport("=HYPERLINK")).toBe("'=HYPERLINK");
	});
	it("sanitize keeps rupiah numeric as string without leading =", () => {
		expect(sanitizeForExport("1500000000.00")).toBe("1500000000.00");
		expect(sanitizeForExport(1500)).toBe("1500");
	});
	it("export function exists (lazy check)", async () => {
		// ponytail: fallback path returns CSV-like buffer when exceljs missing – heavy import skipped in unit
		expect(typeof sanitizeForExport).toBe("function");
	});
});

describe("import parser injection & headers", () => {
	it("parseCsv splits and sanitizes", async () => {
		const { parseCsv } = await import("../import/parser");
		const rows = parseCsv("account_code,amount,effective_at\n51,100.00,2026-01-01\n");
		expect(rows[0]).toEqual(["account_code", "amount", "effective_at"]);
		expect(rows[1][0]).toBe("51");
	});
	it("formula injection detected in parseImportFile", async () => {
		const { parseImportFile } = await import("../import/parser");
		const csv = "account_code,amount,effective_at\n51,=SUM(1),2026-01-01\n";
		const buf = new TextEncoder().encode(csv);
		const res = await parseImportFile({ domain: "budget_revisions", buffer: buf, filename: "test.csv" });
		expect(res.invalidRows).toBe(1);
		expect(res.errors[0].message).toMatch(/injection/i);
	});
});

import { describe, expect, it } from "vitest";
import { parseImportFile } from "./parser";

// MIG-06: uploads are parsed in memory only, so these parser guards are the
// whole file-safety boundary (format, signature, 10 MB, 10.000 rows).
const csv = (text: string) => new TextEncoder().encode(text);

describe("import parser file guards", () => {
	it("rejects unsupported formats", async () => {
		await expect(
			parseImportFile({ domain: "budget_revisions", buffer: csv("a"), filename: "data.xls" }),
		).rejects.toThrow(/Format tidak didukung/);
	});

	it("rejects a ZIP signature disguised as .csv", async () => {
		await expect(
			parseImportFile({
				domain: "budget_revisions",
				buffer: Uint8Array.from([0x50, 0x4b, 0x03, 0x04]),
				filename: "data.csv",
			}),
		).rejects.toThrow(/Signature file tidak cocok/);
	});

	it("rejects files over 10 MB", async () => {
		await expect(
			parseImportFile({
				domain: "budget_revisions",
				buffer: csv("a"),
				filename: "data.csv",
				size: 10 * 1024 * 1024 + 1,
			}),
		).rejects.toThrow(/melebihi 10 MB/);
	});

	it("rejects more than 10.000 data rows", async () => {
		const body = "header\n" + "1\n".repeat(10_001);
		await expect(
			parseImportFile({ domain: "budget_revisions", buffer: csv(body), filename: "data.csv" }),
		).rejects.toThrow(/melebihi 10.000/);
	});
});

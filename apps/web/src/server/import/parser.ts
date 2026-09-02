import { z } from "zod";

// ponytail: naive CSV split + dynamic exceljs; ceiling = quoted commas/newlines & streaming 10k rows
// upgrade path: exceljs streaming reader + papaparse for CSV

export type ImportDomain =
	| "budget_revisions"
	| "rpd_realization"
	| "contracts_invoices"
	| "up_tup_kkp"
	| "output_achievement"
	| "spm_dispensation";

export interface ParseError {
	row: number; // 1-indexed Excel row (1=header)
	column?: string;
	message: string;
	rawValue?: string;
}

export interface ParseResult {
	domain: ImportDomain;
	headers: string[];
	totalRows: number;
	validRows: unknown[];
	invalidRows: number;
	errors: ParseError[];
	preview: unknown[]; // first 5 valid
}

const MAX_ROWS = 10_000;
const MAX_BYTES = 10 * 1024 * 1024;
const ERROR_CAP = 100;

const dec182 = z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/, "Decimal 18,2 invalid");
const dec84 = z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d{1,4})?$/, "Decimal 8,4/18,4 invalid");

function isFormulaInjection(v: string): boolean {
	return /^[=+\-@\t\r]/.test(v);
}
function sanitizeCell(raw: string): string {
	// trim and strip surrounding quotes, keep inner value
	return raw.trim().replace(/^"(.*)"$/, "$1");
}

// ponytail: simple CSV parser, does not handle multiline quoted fields
export function parseCsv(text: string): string[][] {
	const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
	return lines.map((line) => {
		// split respecting quoted commas minimally
		const cells: string[] = [];
		let cur = "";
		let inQ = false;
		for (let i = 0; i < line.length; i++) {
			const ch = line[i];
			if (ch === '"' && (i === 0 || line[i - 1] !== "\\")) {
				inQ = !inQ;
				cur += ch;
			} else if (ch === "," && !inQ) {
				cells.push(sanitizeCell(cur));
				cur = "";
			} else {
				cur += ch;
			}
		}
		cells.push(sanitizeCell(cur));
		return cells.map((c) => c.replace(/^"(.*)"$/, "$1").trim());
	});
}

export async function parseXlsx(buffer: Uint8Array): Promise<string[][]> {
	// dynamic import so typecheck/build passes without exceljs installed – ponytail fallback
	let ExcelJS: unknown;
	try {
		// @ts-ignore – optional dep, vite-ignore via Function to avoid bundler resolve
		ExcelJS = await (Function("m", "return import(m)") as (m: string) => Promise<unknown>)("exceljs");
	} catch {
		throw new Error("XLSX parsing requires 'exceljs'. Jalankan: npm install exceljs --workspace @simulator-ikpa/web");
	}
	const Workbook = (ExcelJS as { Workbook: new () => { xlsx: { load: (b: Uint8Array) => Promise<void> }; getWorksheet: (n: number) => { eachRow: (cb: (row: { eachCell: (cb: (c: { text: string }) => void) => void }) => void) => void } | undefined } }).Workbook;
	const wb = new Workbook();
	await wb.xlsx.load(buffer);
	const ws = wb.getWorksheet(1);
	if (!ws) return [];
	const out: string[][] = [];
	ws.eachRow((row) => {
		const cells: string[] = [];
		row.eachCell((c) => cells.push(sanitizeCell(String(c.text ?? ""))));
		// only push non-empty rows
		if (cells.some((v) => v !== "")) out.push(cells);
	});
	return out;
}

const DOMAIN_HEADERS: Record<ImportDomain, string[][]> = {
	budget_revisions: [["account_code", "amount", "effective_at"]],
	rpd_realization: [["month", "account_code", "amount"]],
	contracts_invoices: [
		["contract_number", "account_code", "value", "signed_at", "payment_type"],
		["contract_number", "reference_number", "bast_date", "received_at"],
	],
	up_tup_kkp: [
		["type", "amount", "sp2d_at"],
		["month", "amount", "usage_date"],
	],
	output_achievement: [["ro_code", "month", "rvro", "volume_dipa", "pcro", "tpcro"]],
	spm_dispensation: [["reference_number", "issued_at", "is_dispensasi"]],
};

function normalizeHeader(h: string): string {
	return h.trim().toLowerCase().replace(/\s+/g, "_");
}

function validateHeaders(domain: ImportDomain, headers: string[]): ParseError | null {
	const norms = headers.map(normalizeHeader);
	const allowedSets = DOMAIN_HEADERS[domain];
	const ok = allowedSets.some((set) => set.every((col, i) => norms[i] === col) || (norms.length >= set.length && set.every((c) => norms.includes(c))));
	if (!ok) {
		return { row: 1, message: `Header tidak valid untuk ${domain}. Expected: ${allowedSets.map((s) => s.join(",")).join(" | ")} | got: ${norms.join(",")}` };
	}
	return null;
}

function makeError(row: number, col: string | undefined, msg: string, raw?: string, list: ParseError[] = []): void {
	if (list.length < ERROR_CAP) list.push({ row, column: col, message: msg, rawValue: raw?.slice(0, 200) });
}

function parseBoolean(v: string): boolean | null {
	const t = v.trim().toLowerCase();
	if (["true", "1", "ya", "y"].includes(t)) return true;
	if (["false", "0", "tidak", "n"].includes(t)) return false;
	return null;
}

export async function parseImportFile(args: {
	domain: ImportDomain;
	buffer: Uint8Array;
	filename: string;
	mimeType?: string;
	size?: number;
}): Promise<ParseResult> {
	const { domain, buffer, filename } = args;
	const size = args.size ?? buffer.byteLength;
	if (size > MAX_BYTES) throw new Error(`File melebihi 10 MB (${(size / 1024 / 1024).toFixed(2)} MB)`);
	const ext = filename.toLowerCase().split(".").pop();
	const mime = (args.mimeType ?? "").toLowerCase();
	const isXlsx = ext === "xlsx" || mime.includes("spreadsheetml") || mime.includes("officedocument");
	const isCsv = ext === "csv" || mime.includes("csv") || mime.includes("text/plain");
	if (!isXlsx && !isCsv) throw new Error("Format tidak didukung. Hanya .xlsx dan .csv (ditolak: .xls/.xlsm/macro)");
	// signature sniff: csv should not start with PK zip header
	if (isCsv && buffer[0] === 0x50 && buffer[1] === 0x4b) throw new Error("Signature file tidak cocok dengan ekstensi .csv (terdeteksi ZIP)");
	if (isXlsx && !(buffer[0] === 0x50 && buffer[1] === 0x4b)) {
		// still allow but warn – exceljs will error if not zip
	}

	let rows: string[][];
	if (isXlsx) rows = await parseXlsx(buffer);
	else rows = parseCsv(new TextDecoder().decode(buffer));

	if (rows.length === 0) throw new Error("File kosong atau header tidak ditemukan");
	if (rows.length - 1 > MAX_ROWS) throw new Error(`Baris data melebihi 10.000 (got ${rows.length - 1})`);
	if (rows.length - 1 === 0) return { domain, headers: rows[0] ?? [], totalRows: 0, validRows: [], invalidRows: 0, errors: [], preview: [] };

	const headers = rows[0];
	const dataRows = rows.slice(1);
	const headerErr = validateHeaders(domain, headers);
	const errors: ParseError[] = [];
	if (headerErr) errors.push(headerErr);

	const norms = headers.map(normalizeHeader);
	const idx = (name: string) => norms.indexOf(name);
	const get = (row: string[], name: string) => {
		const i = idx(name);
		return i >= 0 ? (row[i] ?? "").trim() : "";
	};

	const validRows: unknown[] = [];
	let invalidRows = 0;

	// helpers to check injection per row
	const rowHasInjection = (row: string[]) => row.some(isFormulaInjection);

	for (let r = 0; r < dataRows.length; r++) {
		const row = dataRows[r];
		const excelRow = r + 2;
		// column count check
		if (row.length !== headers.length && row.join("").trim() !== "") {
			makeError(excelRow, undefined, `Jumlah kolom tidak sesuai header (expected ${headers.length}, got ${row.length})`, row.join(","), errors);
			invalidRows++;
			continue;
		}
		// injection defense: any cell starts with =+-@
		if (rowHasInjection(row)) {
			const colIdx = row.findIndex(isFormulaInjection);
			makeError(excelRow, headers[colIdx], "Formula injection terdeteksi (awalan = + - @ tidak diperbolehkan)", row[colIdx], errors);
			invalidRows++;
			continue;
		}
		// empty row skip
		if (row.every((c) => c === "")) continue;

		const pushValid = (obj: unknown) => validRows.push(obj);
		const markInvalid = (col: string | undefined, msg: string, raw?: string) => {
			makeError(excelRow, col, msg, raw, errors);
			invalidRows++;
		};

		try {
			if (domain === "budget_revisions") {
				// detect revision vs budget by presence of revision_code header
				if (norms.includes("revision_code")) {
					const revision_date = get(row, "revision_date");
					const revision_code = get(row, "revision_code");
					const pagu_before = get(row, "pagu_before");
					const pagu_after = get(row, "pagu_after");
					if (!revision_date) throw new Error("revision_date wajib");
					if (!/^\d{4}-\d{2}-\d{2}$/.test(revision_date)) throw new Error("revision_date format YYYY-MM-DD");
					if (!revision_code) throw new Error("revision_code wajib");
					if (dec182.safeParse(pagu_before).success === false) throw new Error("pagu_before decimal 18,2 invalid");
					if (dec182.safeParse(pagu_after).success === false) throw new Error("pagu_after decimal 18,2 invalid");
					pushValid({ revisionDate: revision_date, revisionCode: revision_code, paguBefore: pagu_before, paguAfter: pagu_after });
				} else {
					const account_code = get(row, "account_code");
					const amount = get(row, "amount");
					const effective_at = get(row, "effective_at");
					if (!["51", "52", "53", "57"].includes(account_code)) throw new Error("account_code harus 51/52/53/57");
					if (dec182.safeParse(amount).success === false) throw new Error("amount decimal 18,2 invalid");
					if (!/^\d{4}-\d{2}-\d{2}$/.test(effective_at)) throw new Error("effective_at YYYY-MM-DD");
					pushValid({ accountCode: account_code, amount, effectiveAt: effective_at });
				}
			} else if (domain === "rpd_realization") {
				const month = get(row, "month");
				const account_code = get(row, "account_code");
				const amount = get(row, "amount");
				const target = (get(row, "target") || "rpd").toLowerCase();
				const m = Number(month);
				if (!Number.isInteger(m) || m < 1 || m > 12) throw new Error("month 1..12");
				if (!["51", "52", "53", "57"].includes(account_code)) throw new Error("account_code 51/52/53/57");
				if (dec182.safeParse(amount).success === false) throw new Error("amount decimal 18,2 invalid");
				if (!["rpd", "realization"].includes(target)) throw new Error("target rpd|realization");
				pushValid({ month: m, accountCode: account_code, amount, target });
			} else if (domain === "contracts_invoices") {
				if (norms.includes("reference_number") && norms.includes("bast_date")) {
					// spm_ls
					const contract_number = get(row, "contract_number");
					const reference_number = get(row, "reference_number");
					const bast_date = get(row, "bast_date");
					const received_at = get(row, "received_at");
					if (!contract_number) throw new Error("contract_number wajib");
					if (!reference_number) throw new Error("reference_number wajib");
					if (!/^\d{4}-\d{2}-\d{2}$/.test(bast_date)) throw new Error("bast_date YYYY-MM-DD");
					if (!/^\d{4}-\d{2}-\d{2}$/.test(received_at)) throw new Error("received_at YYYY-MM-DD");
					pushValid({ contractNumber: contract_number, referenceNumber: reference_number, bastBappDate: bast_date, receivedAtKppn: received_at });
				} else {
					const contract_number = get(row, "contract_number");
					const account_code = get(row, "account_code");
					const value = get(row, "value");
					const signed_at = get(row, "signed_at");
					const payment_type = get(row, "payment_type");
					if (!contract_number) throw new Error("contract_number wajib");
					if (!["51", "52", "53"].includes(account_code)) throw new Error("account_code 51/52/53");
					if (dec182.safeParse(value).success === false) throw new Error("value decimal 18,2 invalid");
					if (!/^\d{4}-\d{2}-\d{2}$/.test(signed_at)) throw new Error("signed_at YYYY-MM-DD");
					if (!["sekaligus", "termin"].includes(payment_type)) throw new Error("payment_type sekaligus|termin");
					pushValid({ contractNumber: contract_number, accountCode: account_code, value, signedAt: signed_at, paymentType: payment_type });
				}
			} else if (domain === "up_tup_kkp") {
				if (norms.includes("type")) {
					const type = get(row, "type");
					const amount = get(row, "amount");
					const sp2d_at = get(row, "sp2d_at");
					if (!["UP", "TUP", "GUP", "GUP_NIHIL", "PTUP", "SETORAN_TUP"].includes(type)) throw new Error("type UP/TUP/GUP/GUP_NIHIL/PTUP/SETORAN_TUP");
					if (dec182.safeParse(amount).success === false) throw new Error("amount decimal 18,2 invalid");
					if (!/^\d{4}-\d{2}-\d{2}$/.test(sp2d_at)) throw new Error("sp2d_at YYYY-MM-DD");
					if ((type === "GUP" || type === "PTUP") && !get(row, "reference_sp2d_at")) throw new Error("GUP/PTUP wajib reference_sp2d_at");
					pushValid({ type, amount, sp2dAt: sp2d_at, referenceSp2dAt: get(row, "reference_sp2d_at") || null });
				} else {
					const month = get(row, "month");
					const amount = get(row, "amount");
					const m = Number(month);
					if (!Number.isInteger(m) || m < 1 || m > 12) throw new Error("month 1..12");
					if (dec182.safeParse(amount).success === false) throw new Error("amount decimal 18,2 invalid");
					pushValid({ month: m, amount, usageDate: get(row, "usage_date") || null });
				}
			} else if (domain === "output_achievement") {
				const ro_code = get(row, "ro_code");
				const month = get(row, "month");
				const rvro = get(row, "rvro");
				const volume_dipa = get(row, "volume_dipa");
				const pcro = get(row, "pcro");
				const tpcro = get(row, "tpcro");
				const m = Number(month);
				if (!ro_code) throw new Error("ro_code wajib");
				if (!Number.isInteger(m) || m < 1 || m > 12) throw new Error("month 1..12");
				if (dec84.safeParse(rvro).success === false) throw new Error("rvro decimal 18,4 invalid");
				if (dec84.safeParse(volume_dipa).success === false) throw new Error("volume_dipa decimal 18,4 invalid");
				if (dec84.safeParse(pcro).success === false) throw new Error("pcro 0..100 decimal 8,4");
				if (dec84.safeParse(tpcro).success === false) throw new Error("tpcro 0..100 decimal 8,4");
				const rv = parseFloat(rvro), vol = parseFloat(volume_dipa);
				if (rv < 0 || rv > vol) throw new Error("rvro harus 0..volume_dipa");
				if (parseFloat(pcro) < 0 || parseFloat(pcro) > 100) throw new Error("pcro 0..100");
				if (parseFloat(tpcro) < 0 || parseFloat(tpcro) > 100) throw new Error("tpcro 0..100");
				pushValid({ roCode: ro_code, month: m, rvro, volumeDipa: volume_dipa, pcro, tpcro });
			} else if (domain === "spm_dispensation") {
				const reference_number = get(row, "reference_number");
				const issued_at = get(row, "issued_at");
				const is_dispensasi = get(row, "is_dispensasi");
				if (!reference_number) throw new Error("reference_number wajib");
				if (!/^\d{4}-\d{2}-\d{2}$/.test(issued_at)) throw new Error("issued_at YYYY-MM-DD");
				const mm = new Date(issued_at).getMonth() + 1;
				if (mm < 10 || mm > 12) throw new Error("SPM Q4 hanya Okt-Des (10-12)");
				let bool: boolean | null = null;
				if (is_dispensasi !== "") {
					bool = parseBoolean(is_dispensasi);
					if (bool === null) throw new Error("is_dispensasi boolean true/false/1/0");
				}
				pushValid({ referenceNumber: reference_number, issuedAt: issued_at, isDispensasi: bool ?? false });
			}
		} catch (e) {
			const msg = (e as Error).message;
			markInvalid(undefined, msg, row.join(","));
		}
	}

	const preview = validRows.slice(0, 5);
	return {
		domain,
		headers,
		totalRows: dataRows.filter((r) => r.some((c) => c !== "")).length,
		validRows,
		invalidRows,
		errors: errors.slice(0, ERROR_CAP),
		preview,
	};
}

// helper for export injection defense: prefix dangerous cells with `'`
export function sanitizeForExport(value: unknown): string {
	const s = String(value ?? "");
	if (/^[=+\-@\t\r]/.test(s)) return `'${s}`;
	return s;
}

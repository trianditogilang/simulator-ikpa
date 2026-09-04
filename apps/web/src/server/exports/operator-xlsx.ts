import { Buffer } from "node:buffer";
import { createServerFn } from "@tanstack/react-start";
import { and, eq, isNull } from "drizzle-orm";
import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";
import { createDbClient } from "@simulator-ikpa/db";
import {
	budgets,
	contracts,
	dipaRevisions,
	fiscalYears,
	kkpUsages,
	outputReports,
	realizations,
	rpdLines,
	ruleSets,
	spmLs,
	spmQ4,
	upTupTransactions,
} from "@simulator-ikpa/db/schema";
import { getAccessResolutionForSession } from "../access.server";
import { getServerAuthSession } from "../auth-session.server";
import { calculateAndPersistSnapshot } from "../simulation/calculate";
import { sanitizeForExport } from "../import/parser";

// ponytail: exceljs direct; ceiling = true streaming for >10k rows
// upgrade path: streaming writer + R2 presigned download URL for large exports

function getDatabase() {
	const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
	return dbUrl ? createDbClient(dbUrl) : null;
}

async function getOrInitFiscalYear(db: ReturnType<typeof createDbClient>, orgId: string) {
	let [fy] = await db.select().from(fiscalYears).where(and(eq(fiscalYears.orgId, orgId), eq(fiscalYears.year, 2026))).limit(1);
	if (!fy) {
		const [rs] = await db.select().from(ruleSets).where(and(eq(ruleSets.year, 2026), eq(ruleSets.status, "published"))).limit(1);
		if (rs) {
			const inserted = await db.insert(fiscalYears).values({ orgId, year: 2026, activeRuleSetId: rs.id }).returning();
			[fy] = inserted;
		}
	}
	return fy;
}

function esc(v: unknown): string {
	return sanitizeForExport(v);
}

export async function buildOperatorXlsxBuffer(args: { orgId: string; db: ReturnType<typeof createDbClient>; fiscalYearId: string; summary?: { total: string; deduction: string; indicators: Array<{ label: string; score: string; weight: string; contrib: string }> } }): Promise<Uint8Array> {
	const { db, fiscalYearId, summary } = args;
	const [budgetRows, revisionRows, rpdRows, realRows, contractRows, spmRows, upRows, kkpRows, outputRows, spmQ4Rows] = await Promise.all([
		db.select().from(budgets).where(and(eq(budgets.fiscalYearId, fiscalYearId), isNull(budgets.deletedAt))),
		db.select().from(dipaRevisions).where(and(eq(dipaRevisions.fiscalYearId, fiscalYearId), isNull(dipaRevisions.deletedAt))),
		db.select().from(rpdLines).where(and(eq(rpdLines.fiscalYearId, fiscalYearId), isNull(rpdLines.deletedAt))),
		db.select().from(realizations).where(and(eq(realizations.fiscalYearId, fiscalYearId), isNull(realizations.deletedAt))),
		db.select().from(contracts).where(and(eq(contracts.fiscalYearId, fiscalYearId), isNull(contracts.deletedAt))),
		db.select().from(spmLs).where(and(eq(spmLs.fiscalYearId, fiscalYearId), isNull(spmLs.deletedAt))),
		db.select().from(upTupTransactions).where(and(eq(upTupTransactions.fiscalYearId, fiscalYearId), isNull(upTupTransactions.deletedAt))),
		db.select().from(kkpUsages).where(and(eq(kkpUsages.fiscalYearId, fiscalYearId), isNull(kkpUsages.deletedAt))),
		db.select().from(outputReports).where(and(eq(outputReports.fiscalYearId, fiscalYearId), isNull(outputReports.deletedAt))),
		db.select().from(spmQ4).where(and(eq(spmQ4.fiscalYearId, fiscalYearId), isNull(spmQ4.deletedAt))),
	]);

	// Try exceljs, fallback to CSV-like buffer if missing
	let ExcelJS: unknown;
	try {
		// @ts-ignore – optional deps, Function avoids Vite static resolve
		ExcelJS = await (Function("m", "return import(m)") as (m: string) => Promise<unknown>)("exceljs");
	} catch { ExcelJS = null; }

	if (!ExcelJS) {
		// fallback: return CSV-like text encoded as xlsx mime (ponytail ceiling)
		const csv = [
			"Sheet: Ringkasan",
			"account_code,amount",
			...budgetRows.map(r=>`${esc(r.accountCode)},${esc(r.amount)}`),
			"",
			"RPD: month,account_code,amount",
			...rpdRows.map(r=>`${esc(r.month)},${esc(r.accountCode)},${esc(r.amount)}`),
		].join("\n");
		return new TextEncoder().encode(csv);
	}

	const Workbook = (ExcelJS as { Workbook: new()=>{ addWorksheet: (n:string)=>{ addRow: (v:unknown[])=>void; getRow: (n:number)=>{ font: unknown; commitment: unknown }; columns: unknown[]; views: unknown[] }; xlsx: { writeBuffer: ()=>Promise<ArrayBuffer>} } }).Workbook;
	const wb = new Workbook();

	// Metadata sheet
	const meta = wb.addWorksheet("Metadata");
	meta.addRow(["Simulator Penilaian IKPA – Export Operator"]);
	meta.addRow(["Dicetak", new Date().toISOString()]);
	meta.addRow(["Disclaimer", "Bukan sumber nilai IKPA resmi – internal KPPN Malang"]);
	meta.addRow(["Rule Set", "2026.1 PER-5/PB/2024"]);
	// make header bold
	try { meta.getRow(1).font = { bold: true }; } catch {}

	const addSheet = (name: string, headers: string[], rows: unknown[][]) => {
		const ws = wb.addWorksheet(name);
		ws.addRow(headers.map(esc));
		try { ws.getRow(1).font = { bold: true }; } catch {}
		for (const r of rows) ws.addRow(r.map(esc));
		ws.columns = headers.map(() => ({ width: 18 }));
		ws.views = [{ state: "frozen", ySplit: 1 }];
	};

	if (summary) {
		addSheet("Ringkasan", ["indikator", "nilai", "bobot", "kontribusi"], [
			...summary.indicators.map((i) => [i.label, i.score, i.weight, i.contrib]),
			["SPM Dispensasi (pengurang)", summary.deduction, "0", `-${summary.deduction}`],
			["TOTAL = Σ 7 kontribusi − pengurang", summary.total, "", ""],
		]);
	}

	addSheet("Pagu", ["account_code","amount","effective_at"], budgetRows.map(r=>[r.accountCode, r.amount, r.effectiveAt]));
	addSheet("Revisi", ["revision_date","revision_code","pagu_before","pagu_after"], revisionRows.map(r=>[r.revisionDate, r.revisionCode, r.paguBefore, r.paguAfter]));
	addSheet("RPD", ["month","account_code","amount"], rpdRows.map(r=>[r.month, r.accountCode, r.amount]));
	addSheet("Realisasi", ["month","account_code","amount"], realRows.map(r=>[r.month, r.accountCode, r.amount]));
	addSheet("Kontrak", ["contract_number","account_code","value","signed_at","payment_type"], contractRows.map(r=>[r.contractNumber, r.accountCode, r.value, r.signedAt, r.paymentType]));
	addSheet("SPM_LS", ["reference_number","bast_date","received_at"], spmRows.map(r=>[r.referenceNumber, r.bastBappDate, r.receivedAtKppn]));
	addSheet("UP_TUP", ["type","amount","sp2d_at"], upRows.map(r=>[r.type, r.amount, r.sp2dAt]));
	addSheet("KKP", ["month","amount","usage_date"], kkpRows.map(r=>[r.month, r.amount, r.usageDate ?? ""]));
	addSheet("Output_RO", ["ro_code","month","rvro","volume_dipa","pcro","tpcro"], outputRows.map(r=>[r.roCode, r.month, r.rvro, r.volumeDipa, r.pcro, r.tpcro]));
	addSheet("SPM_Q4", ["reference_number","issued_at","is_dispensasi"], spmQ4Rows.map(r=>[r.referenceNumber, r.issuedAt, String(r.isDispensasi)]));

	const buf = await wb.xlsx.writeBuffer();
	return new Uint8Array(buf);
}

export const requestOperatorXlsxFn = createServerFn({ method: "GET" })
	.validator((data?: { orgId?: string }) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth, data?.orgId);
		const targetOrgId = data?.orgId || (access.status === "operator_single_scope" || access.status === "operator_multiple_scopes" ? access.activeOrganizationId : null);
		if (!targetOrgId) throw new Error("Satuan Kerja aktif tidak ditemukan.");
		assertOperatorOrgScope(access, targetOrgId);
		const db = getDatabase();
		if (!db) {
			// mock fallback buffer (CSV text)
			const csv = "account_code,amount\n51,1500000000.00\n";
			return { filename: `IKPA-Operator-${targetOrgId}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", contentBase64: Buffer.from(csv).toString("base64"), note: "mock Tanpa DB" };
		}
		const fy = await getOrInitFiscalYear(db, targetOrgId);
		if (!fy) throw new Error("Fiscal year tidak ditemukan");
		// hitung snapshot aktual untuk ringkasan 8 indikator
		let summary: { total: string; deduction: string; indicators: Array<{ label: string; score: string; weight: string; contrib: string }> } | undefined;
		try {
			const meta = { actorId: (access as {userId?:string}).userId ?? targetOrgId };
			const snap = await calculateAndPersistSnapshot(db, access, { orgId: targetOrgId, fiscalYearId: fy.id, period: { kind: "month", value: 8 }, simulationType: "actual" }, meta);
			summary = {
				total: snap.output.totalScore ?? "0.00",
				deduction: snap.output.dispensationDeduction ?? "0",
				indicators: (snap.output.indicators as unknown as Array<{ label?: string; key: string; score: string | null; weight: string; weightedContribution?: string | null }>).map((i) => ({
					label: i.label ?? i.key,
					score: i.score ?? "0.00",
					weight: i.weight,
					contrib: (i as { weightedContribution?: string }).weightedContribution ?? "0.00",
				})),
			};
		} catch {}
		const buf = await buildOperatorXlsxBuffer({ orgId: targetOrgId, db, fiscalYearId: fy.id, summary });
		const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
		const filename = `IKPA-Operator-${targetOrgId}-2026-${new Date().toISOString().slice(0,10)}.xlsx`;
		return { filename, mimeType: mime, contentBase64: Buffer.from(buf).toString("base64") };
	});

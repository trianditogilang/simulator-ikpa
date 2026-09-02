import { Buffer } from "node:buffer";
import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";
import { createDbClient } from "@simulator-ikpa/db";
import { fiscalYears, organizations, ruleSets } from "@simulator-ikpa/db/schema";
import { getAccessResolutionForSession } from "../access.server";
import { getServerAuthSession } from "../auth-session.server";
import { calculateAndPersistSnapshot } from "../simulation/calculate";

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

// ponytail: @react-pdf via dynamic import, fallback to HTML-to-text buffer if missing
// ceiling = chart images & custom fonts; upgrade when laporan butuh chart png

async function renderPdfBuffer(args: { title: string; orgName: string; orgCode: string; period: string; totalScore: string; indicators: Array<{ label: string; score: string; weight: string }>; disclaimer: string }): Promise<Uint8Array> {
	let ReactPdf: unknown;
	try {
		// @ts-ignore – optional, Function avoids Vite static resolve
		ReactPdf = await (Function("m", "return import(m)") as (m: string) => Promise<unknown>)("@react-pdf/renderer");
	} catch { ReactPdf = null; }
	if (!ReactPdf) {
		const text = `IKPA Report ${args.orgCode} ${args.period}\nScore ${args.totalScore}\n${args.indicators.map(i=>`${i.label}: ${i.score} (${i.weight}%)`).join("\n")}\n${args.disclaimer}\n`;
		return new TextEncoder().encode(text);
	}
	const { Document, Page, Text, View, StyleSheet, pdf } = ReactPdf as {
		Document: unknown; Page: unknown; Text: unknown; View: unknown; StyleSheet: { create: (o: unknown)=>unknown }; pdf: (doc: unknown)=>{ toBuffer: ()=>Promise<Uint8Array> }
	};
	// need React
	let React: unknown;
	try {
		// @ts-ignore
		React = await (Function("m", "return import(m)") as (m: string) => Promise<unknown>)("react");
	} catch { return new TextEncoder().encode("PDF fallback"); }
	const h = (React as { createElement: (...a: unknown[])=>unknown }).createElement;
	const styles = (StyleSheet as { create: (o: Record<string, unknown>)=> Record<string, unknown> }).create({
		page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
		h1: { fontSize: 16, marginBottom: 8, fontWeight: 700 },
		meta: { fontSize: 8, color: "#666", marginBottom: 12 },
		tableHead: { flexDirection: "row", backgroundColor: "#f1f5f9", padding: 6, fontWeight: 700 },
		row: { flexDirection: "row", borderBottom: "1px solid #e2e8f0", padding: 6 },
		cell: { flex: 1 },
		disclaimer: { marginTop: 16, fontSize: 7, color: "#64748b", borderTop: "1px solid #e2e8f0", paddingTop: 8 },
	});
	const doc = h(Document, null,
		h(Page as never, { size: "A4", style: styles.page },
			h(View as never, null,
				h(Text as never, { style: styles.h1 }, args.title),
				h(Text as never, { style: styles.meta }, `${args.orgName} (${args.orgCode}) • Periode ${args.period} • Skor ${args.totalScore}`),
				h(View as never, { style: styles.tableHead },
					h(Text as never, { style: styles.cell }, "Indikator"),
					h(Text as never, { style: styles.cell }, "Nilai"),
					h(Text as never, { style: styles.cell }, "Bobot"),
				),
				...args.indicators.map((ind) => h(View as never, { key: ind.label, style: styles.row },
					h(Text as never, { style: styles.cell }, ind.label),
					h(Text as never, { style: styles.cell }, ind.score),
					h(Text as never, { style: styles.cell }, `${ind.weight}%`),
				)),
				h(Text as never, { style: styles.disclaimer }, args.disclaimer),
			)
		)
	);
	const buf = await (pdf(doc) as { toBuffer: ()=>Promise<Uint8Array> }).toBuffer();
	return buf instanceof Uint8Array ? buf : new Uint8Array(buf as unknown as ArrayBuffer);
}

export const requestOperatorPdfFn = createServerFn({ method: "GET" })
	.validator((data?: { orgId?: string; periodMonth?: number }) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth, data?.orgId);
		const targetOrgId = data?.orgId || (access.status === "operator_single_scope" || access.status === "operator_multiple_scopes" ? access.activeOrganizationId : null);
		if (!targetOrgId) throw new Error("Satuan Kerja aktif tidak ditemukan.");
		assertOperatorOrgScope(access, targetOrgId);
		const db = getDatabase();
		const periodMonth = data?.periodMonth ?? 8;
		const periodLabel = `Bulan ${periodMonth}/2026`;
		if (!db) {
			const mockIndicators = [
				{ label: "Revisi DIPA", score: "100.00", weight: "10.00" },
				{ label: "Deviasi Hal III", score: "92.50", weight: "15.00" },
			];
			const buf = await renderPdfBuffer({ title: "Laporan Eksekutif IKPA", orgName: "Satker Contoh", orgCode: "411782", period: periodLabel, totalScore: "94.20", indicators: mockIndicators, disclaimer: "Bukan sumber nilai IKPA resmi – internal KPPN Malang. Rule set 2026.1 PER-5/PB/2024." });
			return { filename: `IKPA-Executive-${targetOrgId}.pdf`, mimeType: "application/pdf", contentBase64: Buffer.from(buf).toString("base64") };
		}
		const fy = await getOrInitFiscalYear(db, targetOrgId);
		if (!fy) throw new Error("Fiscal year tidak ditemukan");
		const [org] = await db.select().from(organizations).where(eq(organizations.id, targetOrgId)).limit(1);
		const [rs] = await db.select().from(ruleSets).where(eq(ruleSets.id, fy.activeRuleSetId)).limit(1);
		let indicators: Array<{ label: string; score: string; weight: string }> = [];
		let totalScore = "0.00";
		try {
			const snap = await calculateAndPersistSnapshot(db, access, { orgId: targetOrgId, fiscalYearId: fy.id, period: { kind: "month", value: periodMonth }, simulationType: "actual" }, { actorId: (access as {userId?:string}).userId ?? targetOrgId });
			indicators = (snap.output.indicators as unknown as Array<{ label?: string; key: string; score: string | null; weight: string }>).map((i)=>({ label: i.label ?? i.key, score: i.score ?? "0.00", weight: i.weight }));
			totalScore = snap.output.totalScore ?? "0.00";
		} catch {
			indicators = [{ label: "Revisi DIPA", score: "0.00", weight: "10.00" }];
		}
		const buf = await renderPdfBuffer({
			title: "Laporan Eksekutif Simulasi IKPA Satker",
			orgName: org?.name ?? "Satker",
			orgCode: (org as unknown as { kodeSatker?: string })?.kodeSatker ?? targetOrgId.slice(0,8),
			period: periodLabel,
			totalScore,
			indicators,
			disclaimer: `Dicetak ${new Date().toLocaleString("id-ID")} WIB • Disclaimer: Bukan sumber nilai IKPA resmi. Rule set ${rs?.version ?? "2026.1"} ${rs?.sourceRegulation ?? "PER-5/PB/2024"} – internal KPPN Malang.`,
		});
		return { filename: `IKPA-Executive-${targetOrgId}-${periodMonth}-2026.pdf`, mimeType: "application/pdf", contentBase64: Buffer.from(buf).toString("base64") };
	});

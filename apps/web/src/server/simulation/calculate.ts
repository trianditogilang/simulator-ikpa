import { createHash } from "node:crypto";
import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";
import type { AccessResolution } from "@simulator-ikpa/contracts";
import type { DbClient } from "@simulator-ikpa/db";
import {
	budgets,
	contracts,
	dipaRevisions,
	fiscalYears,
	kkpUsages,
	organizations,
	outputReports,
	realizations,
	rpdLines,
	ruleSets,
	scoreSnapshots,
	simulations,
	spmLs,
	spmQ4,
	upTupTransactions,
	workdays,
} from "@simulator-ikpa/db/schema";
import type { EngineInput } from "@simulator-ikpa/ikpa-engine";
import { calculateIkpa, parseRuleSet } from "@simulator-ikpa/ikpa-engine";
import { and, eq, isNull } from "drizzle-orm";

export interface UpTupAssumptionInput {
	nilaiUP: string;
	nilaiRencanaGUP: string;
	tanggalGUPSebelumnya: string;
	tanggalRencanaGUP: string;
	tupTepat?: number;
	tupTerlambat?: number;
	ptupTepat?: number;
	gupNihilCount?: number;
	setoranTepat?: number;
	kkpNominal?: string;
	kkpTanggal?: string;
}

export interface CalculateParams {
	orgId: string;
	fiscalYearId: string;
	period: { kind: "month" | "quarter" | "semester" | "year"; value: number };
	simulationType: "actual" | "forecast" | "scenario";
	targetScore?: string;
	overrides?: Record<string, string>;
	assumptions?: {
		upTup?: UpTupAssumptionInput | null;
		dispensasi?: { dispensationCount: number; totalSpmQ4: number } | null;
	};
	simulationName?: string;
	requestId?: string | null;
}

function hashInput(input: unknown): string {
	return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export async function calculateAndPersistSnapshot(
	db: DbClient,
	access: AccessResolution,
	params: CalculateParams,
	meta: { actorId: string },
) {
	const { orgId } = assertOperatorOrgScope(access, params.orgId);

	const [fy] = await db
		.select()
		.from(fiscalYears)
		.where(eq(fiscalYears.id, params.fiscalYearId))
		.limit(1);
	if (!fy || fy.orgId !== orgId) throw new Error("Fiscal year tidak valid.");

	const [org] = await db
		.select()
		.from(organizations)
		.where(eq(organizations.id, orgId))
		.limit(1);
	if (!org) throw new Error("Organisasi tidak ditemukan.");

	const [ruleSetRow] = await db
		.select()
		.from(ruleSets)
		.where(eq(ruleSets.id, fy.activeRuleSetId))
		.limit(1);
	if (!ruleSetRow) throw new Error("Rule set aktif tidak ditemukan.");
	const ruleSetConfig = parseRuleSet(ruleSetRow.configJson);

	// Load domain data (scoped)
	const [
		rpdRows,
		realRows,
		budgetRows,
		revisionRows,
		contractRows,
		spmLsRows,
		upTupRows,
		kkpRows,
		outputRows,
		spmQ4Rows,
		workdayRows,
	] = await Promise.all([
		db
			.select()
			.from(rpdLines)
			.where(and(eq(rpdLines.fiscalYearId, fy.id), isNull(rpdLines.deletedAt))),
		db
			.select()
			.from(realizations)
			.where(
				and(
					eq(realizations.fiscalYearId, fy.id),
					isNull(realizations.deletedAt),
				),
			),
		db
			.select()
			.from(budgets)
			.where(and(eq(budgets.fiscalYearId, fy.id), isNull(budgets.deletedAt))),
		db
			.select()
			.from(dipaRevisions)
			.where(
				and(
					eq(dipaRevisions.fiscalYearId, fy.id),
					isNull(dipaRevisions.deletedAt),
				),
			),
		db
			.select()
			.from(contracts)
			.where(
				and(eq(contracts.fiscalYearId, fy.id), isNull(contracts.deletedAt)),
			),
		db
			.select()
			.from(spmLs)
			.where(and(eq(spmLs.fiscalYearId, fy.id), isNull(spmLs.deletedAt))),
		db
			.select()
			.from(upTupTransactions)
			.where(
				and(
					eq(upTupTransactions.fiscalYearId, fy.id),
					isNull(upTupTransactions.deletedAt),
				),
			),
		db
			.select()
			.from(kkpUsages)
			.where(
				and(eq(kkpUsages.fiscalYearId, fy.id), isNull(kkpUsages.deletedAt)),
			),
		db
			.select()
			.from(outputReports)
			.where(
				and(
					eq(outputReports.fiscalYearId, fy.id),
					isNull(outputReports.deletedAt),
				),
			),
		db
			.select()
			.from(spmQ4)
			.where(and(eq(spmQ4.fiscalYearId, fy.id), isNull(spmQ4.deletedAt))),
		db.select().from(workdays).where(eq(workdays.year, fy.year)),
	]);

	// Build EngineInput (ponytail: minimal mapping, missing fields default to 0/empty; engine handles incomplete)
	const holidays = workdayRows
		.filter((w) => w.isHoliday)
		.map((w) => w.date as string);
	const workdayOverrides = workdayRows
		.filter((w) => !w.isHoliday)
		.map((w) => w.date as string);

	// rpdDeviation: group by month 1..11
	const rpdMonths = Array.from({ length: 11 }, (_, i) => {
		const month = i + 1;
		const planned: Record<string, string> = {
			"51": "0",
			"52": "0",
			"53": "0",
			"57": "0",
		};
		const realized: Record<string, string> = {
			"51": "0",
			"52": "0",
			"53": "0",
			"57": "0",
		};
		for (const r of rpdRows.filter((r) => r.month === month)) {
			planned[r.accountCode] = r.amount as string;
		}
		for (const r of realRows.filter((r) => r.month === month)) {
			realized[r.accountCode] = r.amount as string;
		}
		return { month, planned, realized };
	});

	const budgetByType: Record<string, string> = {
		"51": "0",
		"52": "0",
		"53": "0",
		"57": "0",
	};
	for (const b of budgetRows) {
		budgetByType[b.accountCode] = b.amount as string;
	}

	// absorption quarters: aggregate per quarter 1..4
	const quarters = [1, 2, 3, 4].map((q) => {
		const months =
			q === 1
				? [1, 2, 3]
				: q === 2
					? [4, 5, 6]
					: q === 3
						? [7, 8, 9]
						: [10, 11, 12];
		const realized: Record<string, string> = {
			"51": "0",
			"52": "0",
			"53": "0",
			"57": "0",
		};
		const budget: Record<string, string> = { ...budgetByType };
		// sum realizations for quarter
		for (const acc of ["51", "52", "53", "57"] as const) {
			let sum = 0;
			for (const m of months) {
				const row = realRows.find(
					(r) => r.month === m && r.accountCode === acc,
				);
				if (row) sum += parseFloat(row.amount as string);
			}
			realized[acc] = sum.toFixed(2);
		}
		return { quarter: q, realized, budget };
	});

	const baseUpTup = upTupRows.map((u) => ({
		id: u.id,
		type: (u.type === "UP" || u.type === "TUP" ? u.type : "UP") as
			| "UP"
			| "TUP",
		amount: u.amount as string,
		date: u.sp2dAt as string,
		settlementDate: (u.settlementDate as string) ?? null,
		isSettled: u.isSettled ?? false,
	}));
	const baseKkp = kkpRows.map((k) => ({
		id: k.id,
		amount: k.amount as string,
		date:
			(k.usageDate as string) ??
			`${fy.year}-${String(k.month).padStart(2, "0")}-15`,
	}));

	// Asumsi operasional (forecast/scenario saja; actual selalu data tersimpan)
	const assumptionUpTup = params.assumptions?.upTup;
	const useAssumptions = params.simulationType !== "actual" && Boolean(assumptionUpTup);
	if (useAssumptions && assumptionUpTup) {
		const base = assumptionUpTup.tanggalGUPSebelumnya || `${fy.year}-05-05`;
		const rencana = assumptionUpTup.tanggalRencanaGUP || base;
		const addDays = (iso: string, days: number): string => {
			const d = new Date(`${iso}T00:00:00Z`);
			if (Number.isNaN(d.getTime())) return iso;
			return new Date(d.getTime() + days * 86400000).toISOString().slice(0, 10);
		};
		const count = (n: unknown): number =>
			typeof n === "number" && Number.isFinite(n)
				? Math.min(Math.max(Math.floor(n), 0), 20)
				: 0;
		baseUpTup.push({
			id: "asumsi-gup-1",
			type: "UP",
			amount: String(Number(assumptionUpTup.nilaiRencanaGUP) || 0),
			date: base,
			settlementDate: rencana,
			isSettled: true,
		});
		for (let i = 0; i < count(assumptionUpTup.tupTepat); i++)
			baseUpTup.push({ id: `asumsi-tup-${i}`, type: "TUP", amount: "1000000", date: base, settlementDate: addDays(base, 20), isSettled: true });
		for (let i = 0; i < count(assumptionUpTup.tupTerlambat); i++)
			baseUpTup.push({ id: `asumsi-tup-lambat-${i}`, type: "TUP", amount: "1000000", date: base, settlementDate: addDays(base, 35), isSettled: true });
		for (let i = 0; i < count(assumptionUpTup.ptupTepat); i++)
			baseUpTup.push({ id: `asumsi-ptup-${i}`, type: "TUP", amount: "1000000", date: base, settlementDate: addDays(base, 20), isSettled: true });
		for (let i = 0; i < count(assumptionUpTup.gupNihilCount); i++)
			baseUpTup.push({ id: `asumsi-nihil-${i}`, type: "UP", amount: "0", date: base, settlementDate: addDays(base, 10), isSettled: true });
		for (let i = 0; i < count(assumptionUpTup.setoranTepat); i++)
			baseUpTup.push({ id: `asumsi-setoran-${i}`, type: "TUP", amount: "1000000", date: base, settlementDate: addDays(base, 20), isSettled: true });
		const kkpNum = Number(assumptionUpTup.kkpNominal);
		if (Number.isFinite(kkpNum) && kkpNum > 0)
			baseKkp.push({ id: "asumsi-kkp-1", amount: String(kkpNum), date: assumptionUpTup.kkpTanggal || base });
	}

	const assumptionDisp = params.assumptions?.dispensasi;
	const useDisp = params.simulationType !== "actual" && Boolean(assumptionDisp);

	const engineInput: EngineInput = {
		ruleSetId: ruleSetRow.id,
		ruleSetVersion:
			parseInt(ruleSetRow.version.split(".").join("") || "1", 10) || 1,
		organizationId: orgId,
		fiscalYear: fy.year,
		period: params.period as EngineInput["period"],
		isBlu: org.isBlu ?? false,
		targetScore: params.targetScore ?? "95.00",
		simulationType: params.simulationType,
		dipaRevision: {
			semester1Revisions: revisionRows.filter(
				(r) => new Date(r.revisionDate).getMonth() < 6,
			).length,
			semester2Revisions: revisionRows.filter(
				(r) => new Date(r.revisionDate).getMonth() >= 6,
			).length,
			hasBudgetChange: revisionRows.map(() => true),
		},
		rpdDeviation: {
			months: rpdMonths as never,
			budgetByType: budgetByType as never,
		},
		absorption: { quarters: quarters as never },
		contractual: {
			contracts: contractRows.map((c) => ({
				id: c.id,
				amount: c.value as string,
				signedDate: c.signedAt as string,
				submittedDate: (c.sp2dAt as string) ?? (c.signedAt as string),
				isEarlyProcurement: false,
			})),
			accelerations53: [],
		},
		invoiceTimeliness: {
			invoices: spmLsRows.map((s) => ({
				id: s.id,
				bastDate: s.bastBappDate as string,
				spmDate: s.receivedAtKppn as string,
			})),
			workdayCalendar: { holidays, workdays: workdayOverrides },
		},
		upTup: {
			transactions: baseUpTup,
			kkpTransactions: baseKkp,
		},
		outputAchievement: {
			reports: outputRows.map((o) => ({
				id: o.id,
				period: o.month,
				target: o.volumeDipa as string,
				realized: o.rvro as string,
				reportedDate: (o.reportedAt
					? new Date(o.reportedAt).toISOString().slice(0, 10)
					: `${fy.year}-${String(o.month).padStart(2, "0")}-05`) as string,
				deadlineDate:
					`${fy.year}-${String(o.month).padStart(2, "0")}-05` as string,
			})),
		},
		spmDispensation: useDisp && assumptionDisp
			? {
					dispensationCount: Math.max(0, Math.floor(assumptionDisp.dispensationCount)),
					totalSpmQ4: Math.max(0, Math.floor(assumptionDisp.totalSpmQ4)),
				}
			: {
					dispensationCount: spmQ4Rows.filter((r) => r.isDispensasi).length,
					totalSpmQ4: spmQ4Rows.length,
				},
		overrides: params.overrides as never,
	};

	const output = calculateIkpa(engineInput, ruleSetConfig);
	const inputHash = hashInput(engineInput);
	const periodEnd = `${fy.year}-${String(params.period.value).padStart(2, "0")}-01`;

	// ponytail: neon-http driver does not support transactions (throws "No transactions support in neon-http driver");
	// sequential inserts are sufficient for dashboard read path; use Pool driver only if strict atomicity needed
	const doPersist = async (tx: DbClient) => {
		const [simulation] = await tx
			.insert(simulations)
			.values({
				fiscalYearId: fy.id,
				name: params.simulationName ?? `${params.simulationType}-${Date.now()}`,
				type: params.simulationType,
				targetScore: params.targetScore ?? null,
				createdBy: meta.actorId,
			})
			.returning();

		if (params.overrides) {
			const { simulationOverrides } = await import("@simulator-ikpa/db/schema");
			for (const [k, v] of Object.entries(params.overrides)) {
				await tx.insert(simulationOverrides).values({
					simulationId: simulation.id,
					entityType: k,
					patchJson: { value: v },
				});
			}
		}

		if (params.assumptions) {
			const { simulationOverrides } = await import("@simulator-ikpa/db/schema");
			await tx.insert(simulationOverrides).values({
				simulationId: simulation.id,
				entityType: "assumptions",
				patchJson: params.assumptions as never,
			});
		}

		const [snapshot] = await tx
			.insert(scoreSnapshots)
			.values({
				simulationId: simulation.id,
				periodEnd,
				totalScore: output.totalScore,
				breakdownJson: output as never,
				ruleSetVersion: ruleSetRow.version,
				ruleSetId: ruleSetRow.id,
				inputHash,
				createdBy: meta.actorId,
			})
			.returning();

		return { simulation, snapshot, output, inputHash };
	};

	return doPersist(db as DbClient);
}

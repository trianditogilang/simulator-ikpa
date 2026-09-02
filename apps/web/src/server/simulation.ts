import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";
import { createDbClient } from "@simulator-ikpa/db";
import {
	fiscalYears,
	ruleSets,
	scoreSnapshots,
	simulations,
} from "@simulator-ikpa/db/schema";
import { getAccessResolutionForSession } from "./access.server";
import { getServerAuthSession } from "./auth-session.server";
import { calculateAndPersistSnapshot } from "./simulation/calculate";

function getDatabase() {
	const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
	if (!dbUrl) {
		return null;
	}
	return createDbClient(dbUrl);
}

async function getOrInitFiscalYear(
	db: ReturnType<typeof createDbClient>,
	orgId: string,
	year = 2026,
) {
	let [fy] = await db
		.select()
		.from(fiscalYears)
		.where(and(eq(fiscalYears.orgId, orgId), eq(fiscalYears.year, year)))
		.limit(1);

	if (!fy) {
		const [ruleSet] = await db
			.select()
			.from(ruleSets)
			.where(
				and(eq(ruleSets.year, year), eq(ruleSets.status, "published")),
			)
			.limit(1);

		if (ruleSet) {
			[fy] = await db
				.insert(fiscalYears)
				.values({
					orgId,
					year,
					activeRuleSetId: ruleSet.id,
				})
				.returning();
		}
	}

	return fy;
}

export const runSimulationFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			orgId?: string;
			period?: {
				kind: "month" | "quarter" | "semester" | "year";
				value: number;
			};
			simulationType?: "actual" | "forecast" | "scenario";
			targetScore?: string;
			overrides?: Record<string, string>;
			simulationName?: string;
		}) => data,
	)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth, data.orgId);

		const targetOrgId =
			data.orgId ||
			(access.status === "operator_single_scope" ||
			access.status === "operator_multiple_scopes"
				? access.activeOrganizationId
				: null);

		if (!targetOrgId) {
			throw new Error("Satuan Kerja aktif tidak ditemukan.");
		}

		assertOperatorOrgScope(access, targetOrgId);

		const db = getDatabase();
		if (!db) {
			return {
				totalScore: "94.85",
				category: "Sangat Baik",
				indicators: [
					{
						code: "REVISI_DIPA",
						name: "Revisi DIPA",
						score: "100.00",
						weight: "10.00",
						weightedScore: "10.00",
					},
					{
						code: "DEV_HAL_III",
						name: "Deviasi Halaman III DIPA",
						score: "92.50",
						weight: "15.00",
						weightedScore: "13.88",
					},
					{
						code: "PENYERAPAN",
						name: "Penyerapan Anggaran",
						score: "95.00",
						weight: "20.00",
						weightedScore: "19.00",
					},
					{
						code: "BELANJA_KONTRAKTUAL",
						name: "Belanja Kontraktual",
						score: "90.00",
						weight: "10.00",
						weightedScore: "9.00",
					},
					{
						code: "UP_TUP",
						name: "Pengelolaan UP dan TUP",
						score: "98.00",
						weight: "10.00",
						weightedScore: "9.80",
					},
					{
						code: "TAGIHAN",
						name: "Penyelesaian Tagihan",
						score: "96.00",
						weight: "10.00",
						weightedScore: "9.60",
					},
					{
						code: "CAPAIAN_OUTPUT",
						name: "Capaian Output",
						score: "94.00",
						weight: "25.00",
						weightedScore: "23.50",
					},
				],
				deductions: [],
			};
		}

		const fy = await getOrInitFiscalYear(db, targetOrgId, 2026);
		if (!fy) {
			throw new Error("Tahun anggaran 2026 tidak ditemukan.");
		}

		const meta = {
			actorId:
				access.status === "operator_single_scope" ||
				access.status === "operator_multiple_scopes"
					? access.userId
					: targetOrgId,
		};

		const result = await calculateAndPersistSnapshot(
			db,
			access,
			{
				orgId: targetOrgId,
				fiscalYearId: fy.id,
				period: data.period ?? { kind: "month", value: 8 },
				simulationType: data.simulationType ?? "scenario",
				targetScore: data.targetScore,
				overrides: data.overrides,
				simulationName: data.simulationName,
			},
			meta,
		);

		return {
			simulationId: result.simulation.id,
			snapshotId: result.snapshot.id,
			totalScore: result.output.totalScore,
			output: result.output,
		};
	});

export const listSnapshotsFn = createServerFn({ method: "GET" })
	.validator((data?: { orgId?: string }) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth, data?.orgId);

		const targetOrgId =
			data?.orgId ||
			(access.status === "operator_single_scope" ||
			access.status === "operator_multiple_scopes"
				? access.activeOrganizationId
				: null);

		if (!targetOrgId) {
			throw new Error("Satuan Kerja aktif tidak ditemukan.");
		}

		assertOperatorOrgScope(access, targetOrgId);

		const db = getDatabase();
		if (!db) {
			return { snapshots: [] };
		}

		const fy = await getOrInitFiscalYear(db, targetOrgId, 2026);
		if (!fy) {
			return { snapshots: [] };
		}

		const rows = await db
			.select({
				id: scoreSnapshots.id,
				simulationId: scoreSnapshots.simulationId,
				simulationName: simulations.name,
				simulationType: simulations.type,
				periodEnd: scoreSnapshots.periodEnd,
				totalScore: scoreSnapshots.totalScore,
				createdAt: scoreSnapshots.createdAt,
			})
			.from(scoreSnapshots)
			.innerJoin(simulations, eq(scoreSnapshots.simulationId, simulations.id))
			.where(eq(simulations.fiscalYearId, fy.id))
			.orderBy(desc(scoreSnapshots.createdAt))
			.limit(20);

		return {
			snapshots: rows.map((r) => ({
				id: r.id,
				simulationId: r.simulationId,
				simulationName: r.simulationName,
				simulationType: r.simulationType,
				periodEnd: r.periodEnd,
				totalScore: r.totalScore,
				createdAt: r.createdAt.toISOString(),
			})),
		};
	});

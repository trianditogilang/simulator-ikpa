import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";
import { createDbClient } from "@simulator-ikpa/db";
import {
	fiscalYears,
	ruleSets,
	scoreSnapshots,
	simulationOverrides,
	simulations,
	users,
} from "@simulator-ikpa/db/schema";
import { getAccessResolutionForSession } from "./access.server";
import { getServerAuthSession } from "./auth-session.server";
import { writeAudit } from "./audit/write-audit";
import { calculateAndPersistSnapshot } from "./simulation/calculate";
import { failIfProduction } from "./runtime-guards";

function getDatabase() {
	const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
	if (!dbUrl) {
		failIfProduction(true, "Production database is not configured for simulation.");
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

export interface ScenarioOverrideItem {
	entityType: string;
	patchJson: Record<string, any>;
}

export interface ActualSnapshotItem {
	id: string;
	simulationId: string;
	simulationName: string;
	periodEnd: string;
	month: number;
	totalScore: number | null;
	targetScore: number;
	gapScore: number | null;
	dataStatus: "complete" | "incomplete" | "estimated";
	ruleSetVersion: string;
	createdByName: string;
	createdAt: string;
	breakdownJson: any;
}

export interface SavedScenarioItem {
	id: string;
	simulationId: string;
	snapshotId: string;
	name: string;
	periodEnd: string;
	month: number;
	totalScore: number | null;
	targetScore: number;
	parentSnapshotId?: string | null;
	baselineScore?: number | null;
	deltaFromBaseline?: number | null;
	ruleSetVersion: string;
	createdByName: string;
	createdAt: string;
	overridesCount: number;
	overrides: ScenarioOverrideItem[];
	impactedIndicators: string[];
	breakdownJson: any;
}

export interface HistoryPageData {
	actualSnapshots: ActualSnapshotItem[];
	savedScenarios: SavedScenarioItem[];
	snapshots: any[]; // backward compatibility
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
			parentSnapshotId?: string;
			overrides?: Record<string, string>;
			assumptions?: {
				upTup?: {
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
				} | null;
				dispensasi?: { dispensationCount: number; totalSpmQ4: number } | null;
			};
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
				simulationId: "mock-sim-id",
				snapshotId: "mock-snap-id",
				totalScore: "94.85",
				output: {
					totalScore: "94.85",
					indicators: [],
					recommendations: [],
				},
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
				assumptions: data.assumptions,
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
	.validator((data?: { orgId?: string; year?: number }) => data)
	.handler(async ({ data }): Promise<HistoryPageData> => {
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
			return { actualSnapshots: [], savedScenarios: [], snapshots: [] };
		}

		const targetYear = data?.year ?? 2026;
		const fy = await getOrInitFiscalYear(db, targetOrgId, targetYear);
		if (!fy) {
			return { actualSnapshots: [], savedScenarios: [], snapshots: [] };
		}

		// 1. Query simulations and score snapshots
		const rows = await db
			.select({
				snapshotId: scoreSnapshots.id,
				simulationId: simulations.id,
				simulationName: simulations.name,
				simulationType: simulations.type,
				targetScore: simulations.targetScore,
				parentSnapshotId: simulations.parentSnapshotId,
				periodEnd: scoreSnapshots.periodEnd,
				totalScore: scoreSnapshots.totalScore,
				breakdownJson: scoreSnapshots.breakdownJson,
				ruleSetVersion: scoreSnapshots.ruleSetVersion,
				createdAt: scoreSnapshots.createdAt,
				createdById: simulations.createdBy,
				creatorName: users.name,
			})
			.from(scoreSnapshots)
			.innerJoin(simulations, eq(scoreSnapshots.simulationId, simulations.id))
			.leftJoin(users, eq(simulations.createdBy, users.id))
			.where(
				and(
					eq(simulations.fiscalYearId, fy.id),
					isNull(simulations.deletedAt),
				),
			)
			.orderBy(desc(scoreSnapshots.createdAt));

		// 2. Query overrides for scenarios
		const simulationIds = rows
			.filter((r) => r.simulationType === "scenario")
			.map((r) => r.simulationId);

		const allOverrides =
			simulationIds.length > 0
				? await db
						.select()
						.from(simulationOverrides)
						.where(inArray(simulationOverrides.simulationId, simulationIds))
						.catch(() => [])
				: [];

		// Sanitize breakdown to keep payload ultra-lightweight (omits heavy internal traces)
		const sanitizeBreakdown = (b: unknown) => {
			if (!b || typeof b !== "object") return null;
			const obj = b as {
				indicators?: Array<{
					key: string;
					label?: string;
					weight: string;
					score?: string | null;
					weightedContribution?: string | null;
					status: string;
				}>;
				dispensationDeduction?: string | null;
			};
			return {
				indicators: Array.isArray(obj.indicators)
					? obj.indicators.map((ind) => ({
							key: ind.key,
							label: ind.label,
							weight: ind.weight,
							score: ind.score,
							weightedContribution: ind.weightedContribution,
							status: ind.status,
						}))
					: [],
				dispensationDeduction: obj.dispensationDeduction ?? "0",
			};
		};

		// Map actual snapshots
		const actualSnapshots: ActualSnapshotItem[] = rows
			.filter((r) => r.simulationType === "actual")
			.map((r) => {
				const parts = r.periodEnd.split("-");
				const month = parseInt(parts[1], 10) || 1;
				const score = r.totalScore ? parseFloat(r.totalScore) : null;
				const target = r.targetScore ? parseFloat(r.targetScore) : 95.0;

				return {
					id: r.snapshotId,
					simulationId: r.simulationId,
					simulationName: r.simulationName,
					periodEnd: r.periodEnd,
					month,
					totalScore: score,
					targetScore: target,
					gapScore: score !== null ? score - target : null,
					dataStatus: score !== null ? "complete" : "incomplete",
					ruleSetVersion: r.ruleSetVersion,
					createdByName: r.creatorName || "Sistem / Operator",
					createdAt: r.createdAt.toISOString(),
					breakdownJson: sanitizeBreakdown(r.breakdownJson),
				};
			});

		// Map saved scenarios
		const savedScenarios: SavedScenarioItem[] = rows
			.filter((r) => r.simulationType === "scenario")
			.map((r) => {
				const parts = r.periodEnd.split("-");
				const month = parseInt(parts[1], 10) || 1;
				const score = r.totalScore ? parseFloat(r.totalScore) : null;
				const target = r.targetScore ? parseFloat(r.targetScore) : 95.0;

				// Find baseline snapshot if parentSnapshotId exists
				const parentSnap = r.parentSnapshotId
					? rows.find((pr) => pr.snapshotId === r.parentSnapshotId)
					: null;
				const baselineScore = parentSnap?.totalScore
					? parseFloat(parentSnap.totalScore)
					: null;
				const deltaFromBaseline =
					score !== null && baselineScore !== null
						? score - baselineScore
						: null;

				const overrides = allOverrides
					.filter((o) => o.simulationId === r.simulationId)
					.map((o) => ({
						entityType: o.entityType,
						patchJson: (o.patchJson as Record<string, unknown>) || {},
					}));

				const impactedIndicators = Array.from(
					new Set(overrides.map((o) => o.entityType)),
				);

				return {
					id: r.simulationId,
					simulationId: r.simulationId,
					snapshotId: r.snapshotId,
					name: r.simulationName,
					periodEnd: r.periodEnd,
					month,
					totalScore: score,
					targetScore: target,
					parentSnapshotId: r.parentSnapshotId,
					baselineScore,
					deltaFromBaseline,
					ruleSetVersion: r.ruleSetVersion,
					createdByName: r.creatorName || "Operator Satker",
					createdAt: r.createdAt.toISOString(),
					overridesCount: overrides.length || 1,
					overrides,
					impactedIndicators,
					breakdownJson: sanitizeBreakdown(r.breakdownJson),
				};
			});

		return {
			actualSnapshots,
			savedScenarios,
			snapshots: [],
		};
	});

export const deleteScenarioFn = createServerFn({ method: "POST" })
	.validator((data: { scenarioId: string; orgId?: string }) => data)
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
			return { success: true };
		}

		const [before] = await db
			.select()
			.from(simulations)
			.where(
				and(
					eq(simulations.id, data.scenarioId),
					isNull(simulations.deletedAt),
				),
			)
			.limit(1);

		if (!before) {
			throw new Error("Skenario tidak ditemukan.");
		}

		await db
			.update(simulations)
			.set({
				deletedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(simulations.id, data.scenarioId));

		await writeAudit(db, {
			actorId:
				access.status === "operator_single_scope" ||
				access.status === "operator_multiple_scopes" ||
				access.status === "admin"
					? access.userId
					: targetOrgId,
			actorAccessType: "operator_satker",
			entityType: "simulations",
			entityId: data.scenarioId,
			action: "delete_scenario",
			beforeJson: before,
			afterJson: { deletedAt: new Date() },
			orgId: targetOrgId,
		});

		return { success: true };
	});

export const updateScenarioFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			scenarioId: string;
			name?: string;
			targetScore?: string;
			indicatorScores?: Record<string, number>;
			orgId?: string;
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
			return { success: true };
		}

		const [before] = await db
			.select()
			.from(simulations)
			.where(
				and(
					eq(simulations.id, data.scenarioId),
					isNull(simulations.deletedAt),
				),
			)
			.limit(1);

		if (!before) {
			throw new Error("Skenario tidak ditemukan.");
		}

		const updates: Record<string, unknown> = {
			updatedAt: new Date(),
		};
		if (data.name !== undefined) updates.name = data.name.trim();
		if (data.targetScore !== undefined) updates.targetScore = data.targetScore;

		const [after] = await db
			.update(simulations)
			.set(updates)
			.where(eq(simulations.id, data.scenarioId))
			.returning();

		// If indicatorScores provided, recalculate breakdown and update scoreSnapshots!
		if (data.indicatorScores && Object.keys(data.indicatorScores).length > 0) {
			const weights: Record<string, { weight: number; label: string }> = {
				dipa_revision: { weight: 10, label: "Revisi DIPA" },
				rpd_deviation: { weight: 15, label: "Deviasi Halaman III DIPA" },
				absorption: { weight: 10, label: "Penyerapan Anggaran" },
				contractual: { weight: 10, label: "Belanja Kontraktual" },
				invoice_timeliness: { weight: 10, label: "Penyelesaian Tagihan" },
				up_tup: { weight: 10, label: "Pengelolaan UP dan TUP" },
				output_achievement: { weight: 25, label: "Capaian Output" },
				spm_dispensation: { weight: 10, label: "Dispensasi SPM" },
			};

			let totalWeighted = 0;
			const indicators = Object.entries(weights).map(([key, meta]) => {
				const rawScore = Math.min(
					Math.max(Number(data.indicatorScores?.[key] ?? 100), 0),
					100,
				);
				const contrib = (rawScore * meta.weight) / 100;
				totalWeighted += contrib;
				return {
					key,
					label: meta.label,
					weight: `${meta.weight}.00`,
					score: rawScore.toFixed(2),
					weightedContribution: contrib.toFixed(2),
					status: "simulated",
				};
			});

			const formattedTotal = totalWeighted.toFixed(2);
			const breakdownJson = {
				totalScore: formattedTotal,
				indicators,
				dispensationDeduction: "0",
			};

			const [existingSnap] = await db
				.select()
				.from(scoreSnapshots)
				.where(eq(scoreSnapshots.simulationId, data.scenarioId))
				.limit(1);

			if (existingSnap) {
				await db
					.update(scoreSnapshots)
					.set({
						totalScore: formattedTotal,
						breakdownJson: breakdownJson as never,
					})
					.where(eq(scoreSnapshots.id, existingSnap.id));
			}
		}

		await writeAudit(db, {
			actorId:
				access.status === "operator_single_scope" ||
				access.status === "operator_multiple_scopes" ||
				access.status === "admin"
					? access.userId
					: targetOrgId,
			actorAccessType: "operator_satker",
			entityType: "simulations",
			entityId: data.scenarioId,
			action: "update_scenario",
			beforeJson: before,
			afterJson: after,
			orgId: targetOrgId,
		});

		return { success: true, scenario: after };
	});

export const duplicateScenarioFn = createServerFn({ method: "POST" })
	.validator((data: { scenarioId: string; newName?: string; orgId?: string }) => data)
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
			return { success: true, newSimulationId: "mock-new-id" };
		}

		const [sourceSim] = await db
			.select()
			.from(simulations)
			.where(
				and(
					eq(simulations.id, data.scenarioId),
					isNull(simulations.deletedAt),
				),
			)
			.limit(1);

		if (!sourceSim) {
			throw new Error("Skenario asal tidak ditemukan.");
		}

		const actorId =
			access.status === "operator_single_scope" ||
			access.status === "operator_multiple_scopes" ||
			access.status === "admin"
				? access.userId
				: targetOrgId;

		const [newSim] = await db
			.insert(simulations)
			.values({
				fiscalYearId: sourceSim.fiscalYearId,
				name: data.newName || `Salinan ${sourceSim.name}`,
				type: "scenario",
				targetScore: sourceSim.targetScore,
				parentSnapshotId: sourceSim.parentSnapshotId,
				createdBy: actorId,
			})
			.returning();

		// Copy overrides
		const overrides = await db
			.select()
			.from(simulationOverrides)
			.where(eq(simulationOverrides.simulationId, sourceSim.id));

		for (const o of overrides) {
			await db.insert(simulationOverrides).values({
				simulationId: newSim.id,
				entityType: o.entityType,
				entityId: o.entityId,
				patchJson: o.patchJson,
			});
		}

		// Copy latest snapshot
		const [sourceSnap] = await db
			.select()
			.from(scoreSnapshots)
			.where(eq(scoreSnapshots.simulationId, sourceSim.id))
			.orderBy(desc(scoreSnapshots.createdAt))
			.limit(1);

		if (sourceSnap) {
			await db.insert(scoreSnapshots).values({
				simulationId: newSim.id,
				periodEnd: sourceSnap.periodEnd,
				totalScore: sourceSnap.totalScore,
				breakdownJson: sourceSnap.breakdownJson,
				ruleSetVersion: sourceSnap.ruleSetVersion,
				ruleSetId: sourceSnap.ruleSetId,
				inputHash: sourceSnap.inputHash,
				createdBy: actorId,
			});
		}

		await writeAudit(db, {
			actorId,
			actorAccessType: "operator_satker",
			entityType: "simulations",
			entityId: newSim.id,
			action: "duplicate_scenario",
			beforeJson: { sourceSimulationId: sourceSim.id },
			afterJson: { newSimulationId: newSim.id },
			orgId: targetOrgId,
		});

		return { success: true, newSimulationId: newSim.id };
	});

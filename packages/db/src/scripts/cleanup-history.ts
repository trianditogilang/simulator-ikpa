import * as dotenv from "dotenv";
import { eq, and, sql } from "drizzle-orm";
import { createPoolDbClient } from "../client";
import {
	fiscalYears,
	organizations,
	ruleSets,
	scoreSnapshots,
	simulations,
	simulationOverrides,
	users,
} from "../schema/index";

import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

async function run() {
	const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
	if (!dbUrl) {
		console.error("❌ DATABASE_URL / DIRECT_URL not set.");
		process.exit(1);
	}

	console.log("🔌 Connecting to DB...");
	const db = createPoolDbClient(dbUrl);

	// 1. Check current counts
	const [snapCount] = await db
		.select({ count: sql<number>`count(*)` })
		.from(scoreSnapshots);
	const [simCount] = await db
		.select({ count: sql<number>`count(*)` })
		.from(simulations);

	console.log(`📊 Current DB state:`);
	console.log(`   score_snapshots: ${snapCount.count} rows`);
	console.log(`   simulations: ${simCount.count} rows`);

	// Find the active organization and fiscal year
	const [org] = await db
		.select()
		.from(organizations)
		.where(eq(organizations.kodeSatker, "411782"))
		.limit(1);

	if (!org) {
		console.error("❌ Satker 411782 not found.");
		process.exit(1);
	}

	const [fy] = await db
		.select()
		.from(fiscalYears)
		.where(and(eq(fiscalYears.orgId, org.id), eq(fiscalYears.year, 2026)))
		.limit(1);

	const [ruleSet] = await db
		.select()
		.from(ruleSets)
		.where(eq(ruleSets.year, 2026))
		.limit(1);

	const [user] = await db.select().from(users).limit(1);

	console.log(`🏢 Organization ID: ${org.id}`);
	console.log(`📅 Fiscal Year ID: ${fy?.id}`);
	console.log(`📜 Rule Set ID: ${ruleSet?.id} (${ruleSet?.version})`);

	// 2. Clean all existing score_snapshots, simulation_overrides, and simulations
	console.log("🧹 Cleaning up old duplicate snapshots and simulations...");
	await db.delete(scoreSnapshots);
	await db.delete(simulationOverrides);
	await db.delete(simulations);

	console.log("✅ All old snapshots and simulations cleaned.");

	// 3. Seed 12 clean monthly actual evaluations (Jan - Des 2026)
	console.log("🌱 Seeding 12 clean monthly actual evaluations (Jan - Des 2026)...");

	// Realistic progressive cumulative score progression for 12 months
	const monthlyActuals = [
		{ month: 1, score: "93.40", dipa: "10.00", deviasi: "14.20", serap: "8.50", kontrak: "9.80", spmLs: "9.70", upTup: "9.20", capOutput: "24.00", disp: "10.00" },
		{ month: 2, score: "94.10", dipa: "10.00", deviasi: "14.50", serap: "8.80", kontrak: "9.90", spmLs: "9.80", upTup: "9.40", capOutput: "24.20", disp: "10.00" },
		{ month: 3, score: "94.85", dipa: "10.00", deviasi: "14.70", serap: "9.20", kontrak: "9.95", spmLs: "9.85", upTup: "9.50", capOutput: "24.50", disp: "10.00" },
		{ month: 4, score: "95.20", dipa: "10.00", deviasi: "14.80", serap: "9.30", kontrak: "10.00", spmLs: "9.90", upTup: "9.60", capOutput: "24.60", disp: "10.00" },
		{ month: 5, score: "95.60", dipa: "10.00", deviasi: "14.90", serap: "9.50", kontrak: "10.00", spmLs: "9.90", upTup: "9.70", capOutput: "24.70", disp: "10.00" },
		{ month: 6, score: "96.10", dipa: "10.00", deviasi: "15.00", serap: "9.60", kontrak: "10.00", spmLs: "9.95", upTup: "9.75", capOutput: "24.80", disp: "10.00" },
		{ month: 7, score: "96.40", dipa: "10.00", deviasi: "15.00", serap: "9.70", kontrak: "10.00", spmLs: "9.95", upTup: "9.80", capOutput: "24.90", disp: "10.00" },
		{ month: 8, score: "96.80", dipa: "10.00", deviasi: "15.00", serap: "9.80", kontrak: "10.00", spmLs: "10.00", upTup: "9.85", capOutput: "24.95", disp: "10.00" },
		{ month: 9, score: "97.10", dipa: "10.00", deviasi: "15.00", serap: "9.85", kontrak: "10.00", spmLs: "10.00", upTup: "9.90", capOutput: "25.00", disp: "10.00" },
		{ month: 10, score: "97.40", dipa: "10.00", deviasi: "15.00", serap: "9.90", kontrak: "10.00", spmLs: "10.00", upTup: "9.90", capOutput: "25.00", disp: "10.00" },
		{ month: 11, score: "97.80", dipa: "10.00", deviasi: "15.00", serap: "9.95", kontrak: "10.00", spmLs: "10.00", upTup: "9.95", capOutput: "25.00", disp: "10.00" },
		{ month: 12, score: "98.20", dipa: "10.00", deviasi: "15.00", serap: "10.00", kontrak: "10.00", spmLs: "10.00", upTup: "10.00", capOutput: "25.00", disp: "10.00" },
	];

	for (const m of monthlyActuals) {
		const monthStr = String(m.month).padStart(2, "0");
		const periodEnd = `2026-${monthStr}-01`;

		const [sim] = await db
			.insert(simulations)
			.values({
				fiscalYearId: fy.id,
				name: `Evaluasi Kinerja Aktual Bulan ${m.month}`,
				type: "actual",
				targetScore: "95.0000",
				createdBy: user?.id,
			})
			.returning();

		const breakdownJson = {
			totalScore: m.score,
			indicators: [
				{ key: "dipa_revision", label: "Revisi DIPA", weight: "10.00", score: "100.00", weightedContribution: m.dipa, status: "calculated" },
				{ key: "rpd_deviation", label: "Deviasi Halaman III DIPA", weight: "15.00", score: "98.00", weightedContribution: m.deviasi, status: "calculated" },
				{ key: "absorption", label: "Penyerapan Anggaran", weight: "10.00", score: "96.00", weightedContribution: m.serap, status: "calculated" },
				{ key: "contractual", label: "Belanja Kontraktual", weight: "10.00", score: "100.00", weightedContribution: m.kontrak, status: "calculated" },
				{ key: "invoice_timeliness", label: "Penyelesaian Tagihan", weight: "10.00", score: "99.00", weightedContribution: m.spmLs, status: "calculated" },
				{ key: "up_tup", label: "Pengelolaan UP dan TUP", weight: "10.00", score: "98.00", weightedContribution: m.upTup, status: "calculated" },
				{ key: "output_achievement", label: "Capaian Output", weight: "25.00", score: "99.50", weightedContribution: m.capOutput, status: "calculated" },
				{ key: "spm_dispensation", label: "Dispensasi SPM", weight: "10.00", score: "100.00", weightedContribution: m.disp, status: "calculated" },
			],
			dispensationDeduction: "0",
		};

		await db.insert(scoreSnapshots).values({
			simulationId: sim.id,
			periodEnd,
			totalScore: m.score,
			breakdownJson,
			ruleSetVersion: ruleSet?.version || "PER-5/PB/2024",
			ruleSetId: ruleSet.id,
			inputHash: `seed-actual-2026-m${m.month}`,
			createdBy: user?.id,
		});
	}

	console.log("✅ 12 monthly actual evaluations seeded.");

	// 4. Seed exactly 3 dummy What-If scenarios: Skenario A, Skenario B, Skenario C
	console.log("🌱 Seeding 3 editable What-If scenarios (Slot A, B, C)...");

	// Skenario A: Optimalisasi RPD Deviasi Hal III (Agustus 2026)
	const [simA] = await db
		.insert(simulations)
		.values({
			fiscalYearId: fy.id,
			name: "Skenario A: Optimalisasi RPD Halaman III DIPA",
			type: "scenario",
			targetScore: "95.0000",
			createdBy: user?.id,
		})
		.returning();

	await db.insert(simulationOverrides).values([
		{
			simulationId: simA.id,
			entityType: "deviasi_halaman_iii",
			patchJson: {
				label: "Penyesuaian RPD Bulan 8 s.d. 11",
				targetDeviation: "4.5%",
				estimatedScore: "99.00",
			},
		},
	]);

	await db.insert(scoreSnapshots).values({
		simulationId: simA.id,
		periodEnd: "2026-08-01",
		totalScore: "97.45",
		breakdownJson: {
			totalScore: "97.45",
			indicators: [
				{ key: "dipa_revision", label: "Revisi DIPA", weight: "10.00", score: "100.00", weightedContribution: "10.00", status: "calculated" },
				{ key: "rpd_deviation", label: "Deviasi Halaman III DIPA", weight: "15.00", score: "99.00", weightedContribution: "14.85", status: "simulated" },
				{ key: "absorption", label: "Penyerapan Anggaran", weight: "10.00", score: "98.00", weightedContribution: "9.80", status: "calculated" },
				{ key: "contractual", label: "Belanja Kontraktual", weight: "10.00", score: "100.00", weightedContribution: "10.00", status: "calculated" },
				{ key: "invoice_timeliness", label: "Penyelesaian Tagihan", weight: "10.00", score: "100.00", weightedContribution: "10.00", status: "calculated" },
				{ key: "up_tup", label: "Pengelolaan UP dan TUP", weight: "10.00", score: "98.50", weightedContribution: "9.85", status: "calculated" },
				{ key: "output_achievement", label: "Capaian Output", weight: "25.00", score: "99.80", weightedContribution: "24.95", status: "calculated" },
				{ key: "spm_dispensation", label: "Dispensasi SPM", weight: "10.00", score: "100.00", weightedContribution: "10.00", status: "calculated" },
			],
			dispensationDeduction: "0",
		},
		ruleSetVersion: ruleSet?.version || "PER-5/PB/2024",
		ruleSetId: ruleSet.id,
		inputHash: "seed-scenario-a",
		createdBy: user?.id,
	});

	// Skenario B: Akselerasi Penyerapan Belanja Modal & Barang (Agustus 2026)
	const [simB] = await db
		.insert(simulations)
		.values({
			fiscalYearId: fy.id,
			name: "Skenario B: Akselerasi Penyerapan Belanja Modal Q3",
			type: "scenario",
			targetScore: "95.0000",
			createdBy: user?.id,
		})
		.returning();

	await db.insert(simulationOverrides).values([
		{
			simulationId: simB.id,
			entityType: "penyerapan_anggaran",
			patchJson: {
				label: "Akselerasi Realisasi Akun 53 Modal",
				targetAbsorptionQ3: "75.0%",
				estimatedScore: "98.50",
			},
		},
	]);

	await db.insert(scoreSnapshots).values({
		simulationId: simB.id,
		periodEnd: "2026-08-01",
		totalScore: "97.80",
		breakdownJson: {
			totalScore: "97.80",
			indicators: [
				{ key: "dipa_revision", label: "Revisi DIPA", weight: "10.00", score: "100.00", weightedContribution: "10.00", status: "calculated" },
				{ key: "rpd_deviation", label: "Deviasi Halaman III DIPA", weight: "15.00", score: "99.00", weightedContribution: "14.85", status: "calculated" },
				{ key: "absorption", label: "Penyerapan Anggaran", weight: "10.00", score: "100.00", weightedContribution: "10.00", status: "simulated" },
				{ key: "contractual", label: "Belanja Kontraktual", weight: "10.00", score: "100.00", weightedContribution: "10.00", status: "calculated" },
				{ key: "invoice_timeliness", label: "Penyelesaian Tagihan", weight: "10.00", score: "100.00", weightedContribution: "10.00", status: "calculated" },
				{ key: "up_tup", label: "Pengelolaan UP dan TUP", weight: "10.00", score: "100.00", weightedContribution: "10.00", status: "calculated" },
				{ key: "output_achievement", label: "Capaian Output", weight: "25.00", score: "99.80", weightedContribution: "24.95", status: "calculated" },
				{ key: "spm_dispensation", label: "Dispensasi SPM", weight: "10.00", score: "100.00", weightedContribution: "10.00", status: "calculated" },
			],
			dispensationDeduction: "0",
		},
		ruleSetVersion: ruleSet?.version || "PER-5/PB/2024",
		ruleSetId: ruleSet.id,
		inputHash: "seed-scenario-b",
		createdBy: user?.id,
	});

	// Skenario C: Peningkatan Capaian Output & Transaksi KKP (Agustus 2026)
	const [simC] = await db
		.insert(simulations)
		.values({
			fiscalYearId: fy.id,
			name: "Skenario C: Peningkatan Capaian Output & Porsi KKP",
			type: "scenario",
			targetScore: "95.0000",
			createdBy: user?.id,
		})
		.returning();

	await db.insert(simulationOverrides).values([
		{
			simulationId: simC.id,
			entityType: "capaian_output",
			patchJson: {
				label: "Pelaporan PCRO 100% pada seluruh Rincian Output",
				targetOutputScore: "100.00",
			},
		},
		{
			simulationId: simC.id,
			entityType: "pengelolaan_up_tup",
			patchJson: {
				label: "Peningkatan transaksi KKP hingga 5% UP",
				targetKkpRatio: "5.0%",
			},
		},
	]);

	await db.insert(scoreSnapshots).values({
		simulationId: simC.id,
		periodEnd: "2026-08-01",
		totalScore: "98.50",
		breakdownJson: {
			totalScore: "98.50",
			indicators: [
				{ key: "dipa_revision", label: "Revisi DIPA", weight: "10.00", score: "100.00", weightedContribution: "10.00", status: "calculated" },
				{ key: "rpd_deviation", label: "Deviasi Halaman III DIPA", weight: "15.00", score: "100.00", weightedContribution: "15.00", status: "calculated" },
				{ key: "absorption", label: "Penyerapan Anggaran", weight: "10.00", score: "99.00", weightedContribution: "9.90", status: "calculated" },
				{ key: "contractual", label: "Belanja Kontraktual", weight: "10.00", score: "100.00", weightedContribution: "10.00", status: "calculated" },
				{ key: "invoice_timeliness", label: "Penyelesaian Tagihan", weight: "10.00", score: "100.00", weightedContribution: "10.00", status: "calculated" },
				{ key: "up_tup", label: "Pengelolaan UP dan TUP", weight: "10.00", score: "100.00", weightedContribution: "10.00", status: "simulated" },
				{ key: "output_achievement", label: "Capaian Output", weight: "25.00", score: "100.00", weightedContribution: "25.00", status: "simulated" },
				{ key: "spm_dispensation", label: "Dispensasi SPM", weight: "10.00", score: "100.00", weightedContribution: "10.00", status: "calculated" },
			],
			dispensationDeduction: "0",
		},
		ruleSetVersion: ruleSet?.version || "PER-5/PB/2024",
		ruleSetId: ruleSet.id,
		inputHash: "seed-scenario-c",
		createdBy: user?.id,
	});

	console.log("✅ 3 editable What-If scenarios seeded.");

	// 5. Final check
	const [finalSnapCount] = await db
		.select({ count: sql<number>`count(*)` })
		.from(scoreSnapshots);
	const [finalSimCount] = await db
		.select({ count: sql<number>`count(*)` })
		.from(simulations);

	console.log(`\n🎉 Cleanup and seed completed!`);
	console.log(`   score_snapshots: ${finalSnapCount.count} rows (12 actuals + 3 scenarios)`);
	console.log(`   simulations: ${finalSimCount.count} rows (12 actuals + 3 scenarios: A, B, C)`);
}

run()
	.catch((err) => {
		console.error("❌ Fatal error:", err);
		process.exit(1);
	})
	.finally(() => {
		process.exit(0);
	});

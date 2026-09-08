import { pathToFileURL } from "node:url";
import { default2026RuleSet } from "@simulator-ikpa/ikpa-engine";
import * as dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { createPoolDbClient } from "./client";
import {
	assessmentExclusionPolicies,
	budgets,
	contracts,
	dipaRevisions,
	fiscalYears,
	kkpUsages,
	kppnScopes,
	organizations,
	orgReminderConfigs,
	outputReports,
	outputTargetPlans,
	realizations,
	reminderPolicies,
	roBudgetRealizations,
	rpdLines,
	ruleSets,
	spmLs,
	targetUpdateWindows,
	upTupTransactions,
	userAccesses,
	users,
	workdays,
} from "./schema/index";

dotenv.config({ path: "../../.env" });

export async function seed() {
	console.log("🌱 Starting database seed for Simulator IKPA 2026...");

	const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
	if (!dbUrl) {
		console.warn(
			"⚠️ DATABASE_URL / DIRECT_URL is not set. Seed script completed in dry-run mode.",
		);
		return;
	}

	const db = createPoolDbClient(dbUrl);

	// 1. KPPN Scope (KPPN-032 Malang – feedback /admin-kppn/access gilangrahmadian24@gmail.com 032)
	console.log("  -> Seeding KPPN scopes...");
	// legacy cleanup: remove old bare "032" if exists before inserting prefixed form
	try {
		await db.delete(kppnScopes).where(eq(kppnScopes.code, "032"));
	} catch {}
	try {
		await db.delete(kppnScopes).where(eq(kppnScopes.code, "KPPN-089"));
	} catch {}
	const [scope] = await db
		.insert(kppnScopes)
		.values({
			code: "KPPN-032",
			name: "KPPN Malang",
		})
		.onConflictDoUpdate({
			target: kppnScopes.code,
			set: { name: "KPPN Malang", updatedAt: new Date() },
		})
		.returning();

	// 2. Organization (Satker)
	console.log("  -> Seeding organization (Satker)...");
	const [org] = await db
		.insert(organizations)
		.values({
			kppnScopeId: scope.id,
			kodeSatker: "411782",
			name: "Kantor Pelayanan Perbendaharaan Satker Contoh",
			kppnName: "KPPN Malang",
			isBlu: false,
			timezone: "Asia/Jakarta",
		})
		.onConflictDoUpdate({
			target: organizations.kodeSatker,
			set: {
				name: "Kantor Pelayanan Perbendaharaan Satker Contoh",
				kppnScopeId: scope.id,
				kppnName: "KPPN Malang",
				updatedAt: new Date(),
			},
		})
		.returning();

	// 3. Users (2 Admin KPPN + 1 Operator Satker)
	console.log("  -> Seeding users...");
	const [admin1] = await db
		.insert(users)
		.values({
			clerkUserId: "user_3IjPY3A3GQs6zNzUosQYErI9Z9j",
			email: "gilangrahmadian24@gmail.com",
			name: "Admin KPPN 032",
		})
		.onConflictDoUpdate({
			target: users.email,
			set: { name: "Admin KPPN 032", updatedAt: new Date() },
		})
		.returning();

	const [admin2] = await db
		.insert(users)
		.values({
			clerkUserId: "user_3IjQCSAXvbPFxqd85YbemGUlLjT",
			email: "trianditogilang@gmail.com",
			name: "Admin KPPN 032 Pendamping",
		})
		.onConflictDoUpdate({
			target: users.email,
			set: { name: "Admin KPPN 032 Pendamping", updatedAt: new Date() },
		})
		.returning();

	const [operator1] = await db
		.insert(users)
		.values({
			clerkUserId: "user_3Il6leCEkkMQCuU4c3hIAPXBPlB",
			email: "officialtgrid@gmail.com",
			name: "Operator Satker 411782",
		})
		.onConflictDoUpdate({
			target: users.email,
			set: {
				clerkUserId: "user_3Il6leCEkkMQCuU4c3hIAPXBPlB",
				name: "Operator Satker 411782",
				updatedAt: new Date(),
			},
		})
		.returning();

	// 4. User Accesses
	console.log("  -> Seeding user accesses...");
	// Clean up stale duplicate mappings
	await db.delete(userAccesses);

	await db.insert(userAccesses).values([
		{
			userId: admin1.id,
			accessType: "admin_kppn",
			kppnScopeId: scope.id,
			orgId: null,
			active: true,
			createdBy: admin1.id,
		},
		{
			userId: admin2.id,
			accessType: "admin_kppn",
			kppnScopeId: scope.id,
			orgId: null,
			active: true,
			createdBy: admin1.id,
		},
		{
			userId: operator1.id,
			accessType: "operator_satker",
			orgId: org.id,
			kppnScopeId: null,
			active: true,
			createdBy: admin1.id,
		},
	]);

	// 5. Rule Set 2026.1
	console.log("  -> Seeding Rule Set 2026.1...");
	const [ruleSet2026] = await db
		.insert(ruleSets)
		.values({
			year: 2026,
			version: "2026.1",
			effectiveFrom: new Date("2026-01-01T00:00:00Z"),
			status: "published",
			sourceRegulation:
				"PER-5/PB/2024 tentang Petunjuk Teknis Penilaian IKPA K/L TA 2026",
			changeNotes:
				"Konfigurasi standar IKPA TA 2026 dengan 7 indikator berbobot dan dispensasi SPM.",
			configJson: default2026RuleSet,
			createdBy: admin1.id,
			publishedAt: new Date("2026-01-01T00:00:00Z"),
		})
		.onConflictDoUpdate({
			target: [ruleSets.year, ruleSets.version],
			set: {
				configJson: default2026RuleSet,
				status: "published",
				updatedAt: new Date(),
			},
		})
		.returning();

	// 6. Reminder Policies for 2026.1
	console.log("  -> Seeding reminder policies...");
	const policyDefinitions = [
		{
			ruleSetId: ruleSet2026.id,
			eventType: "dipa_revision_quarterly",
			indicatorKey: "dipa_revision",
			category: "mandatory" as const,
			deadlineFormula: {
				type: "quarterly_deadline",
				description: "Batas revisi DIPA triwulanan",
			},
			dayType: "calendar_day" as const,
			minLeadDays: 0,
			maxLeadDays: 20,
			defaultScheduleJson: { leadDays: [14, 7, 3, 0], sendHour: 9 },
			requiredRecipientsJson: ["ppk", "kpa"],
			allowDisable: false,
			allowRecipientOverride: true,
			isActive: true,
		},
		{
			ruleSetId: ruleSet2026.id,
			eventType: "spm_ls_contract_17d",
			indicatorKey: "invoice_timeliness",
			category: "mandatory" as const,
			deadlineFormula: {
				type: "workdays_after_bast",
				workdays: 17,
				description: "Batas penyampaian SPM-LS H+17 hari kerja sejak BAST/BAPP",
			},
			dayType: "workday" as const,
			minLeadDays: 0,
			maxLeadDays: 20,
			defaultScheduleJson: { leadDays: [17, 10, 5, 0], sendHour: 8 },
			requiredRecipientsJson: ["ppk", "bendahara"],
			allowDisable: false,
			allowRecipientOverride: true,
			isActive: true,
		},
		{
			ruleSetId: ruleSet2026.id,
			eventType: "up_tup_revolving_monthly",
			indicatorKey: "up_tup",
			category: "mandatory" as const,
			deadlineFormula: {
				type: "monthly_revolving",
				days: 30,
				description: "Batas revolving GUP minimal 1 bulan sekali",
			},
			dayType: "calendar_day" as const,
			minLeadDays: 0,
			maxLeadDays: 20,
			defaultScheduleJson: { leadDays: [15, 7, 3, 0], sendHour: 9 },
			requiredRecipientsJson: ["bendahara", "kpa"],
			allowDisable: false,
			allowRecipientOverride: true,
			isActive: true,
		},
		{
			ruleSetId: ruleSet2026.id,
			eventType: "output_target_update_due",
			indicatorKey: "output_achievement",
			category: "mandatory" as const,
			deadlineFormula: {
				type: "target_window_close",
				description:
					"Batas pemutakhiran target capaian output (10 hari kerja di awal triwulan: TW I & II s.d. 30 April 2026, TW III s.d. 14 Juli 2026, TW IV s.d. 14 Oktober 2026)",
			},
			dayType: "workday" as const,
			minLeadDays: 0,
			maxLeadDays: 20,
			defaultScheduleJson: { leadDays: [10, 3, 0], sendHour: 9 },
			requiredRecipientsJson: ["ppk", "kpa", "operator_sakun"],
			allowDisable: false,
			allowRecipientOverride: true,
			isActive: true,
		},
		{
			ruleSetId: ruleSet2026.id,
			eventType: "output_report_monthly",
			indicatorKey: "output_achievement",
			category: "mandatory" as const,
			deadlineFormula: {
				type: "workdays_after_month_end",
				workdays: 5,
				description: "Batas pelaporan realisasi capaian output H+5 hari kerja bulan berikutnya",
			},
			dayType: "workday" as const,
			minLeadDays: 0,
			maxLeadDays: 20,
			defaultScheduleJson: { leadDays: [4, 2, 0], sendHour: 8 },
			requiredRecipientsJson: ["operator_sakun", "ppk"],
			allowDisable: false,
			allowRecipientOverride: true,
			isActive: true,
		},
		{
			ruleSetId: ruleSet2026.id,
			eventType: "spm_dispensation_q4",
			indicatorKey: "spm_dispensation",
			category: "recommended" as const,
			deadlineFormula: {
				type: "end_of_year_schedule",
				description: "Batas pengajuan SPM akhir tahun TW IV",
			},
			dayType: "calendar_day" as const,
			minLeadDays: 0,
			maxLeadDays: 20,
			defaultScheduleJson: { leadDays: [20, 14, 7, 0], sendHour: 8 },
			requiredRecipientsJson: ["kpa", "ppk", "bendahara"],
			allowDisable: true,
			allowRecipientOverride: true,
			isActive: true,
		},
	];

	for (const p of policyDefinitions) {
		await db
			.insert(reminderPolicies)
			.values(p)
			.onConflictDoUpdate({
				target: [reminderPolicies.ruleSetId, reminderPolicies.eventType],
				set: {
					category: p.category,
					minLeadDays: p.minLeadDays,
					maxLeadDays: p.maxLeadDays,
					allowDisable: p.allowDisable,
					deadlineFormula: p.deadlineFormula,
					defaultScheduleJson: p.defaultScheduleJson,
					updatedAt: new Date(),
				},
			});
	}

	// 7. Workday Calendar 2026
	console.log("  -> Seeding 2026 national holidays and workdays...");
	const holidays2026 = [
		{ date: "2026-01-01", description: "Tahun Baru 2026 Masehi" },
		{ date: "2026-01-16", description: "Isra Mikraj Nabi Muhammad SAW" },
		{ date: "2026-02-17", description: "Tahun Baru Imlek 2577 Kongzili" },
		{ date: "2026-03-20", description: "Hari Raya Idul Fitri 1447 H" },
		{ date: "2026-03-21", description: "Hari Suci Nyepi / Cuti Idul Fitri" },
		{ date: "2026-04-03", description: "Wafat Yesus Kristus" },
		{ date: "2026-04-05", description: "Hari Paskah" },
		{ date: "2026-05-01", description: "Hari Buruh Internasional" },
		{ date: "2026-05-14", description: "Kenaikan Yesus Kristus" },
		{ date: "2026-05-27", description: "Hari Raya Idul Adha 1447 H" },
		{ date: "2026-05-31", description: "Hari Raya Waisak 2570 BE" },
		{ date: "2026-06-01", description: "Hari Lahir Pancasila" },
		{ date: "2026-06-16", description: "Tahun Baru Islam 1448 H" },
		{ date: "2026-08-17", description: "Hari Kemerdekaan Republik Indonesia" },
		{ date: "2026-08-25", description: "Maulid Nabi Muhammad SAW" },
		{ date: "2026-12-25", description: "Hari Raya Natal" },
	];

	for (const h of holidays2026) {
		await db
			.insert(workdays)
			.values({
				year: 2026,
				date: h.date,
				isHoliday: true,
				description: h.description,
				createdBy: admin1.id,
			})
			.onConflictDoUpdate({
				target: [workdays.year, workdays.date],
				set: {
					isHoliday: true,
					description: h.description,
					updatedAt: new Date(),
				},
			});
	}

	// 8. Fiscal Year 2026 for Satker
	console.log("  -> Seeding Fiscal Year 2026...");
	const [fy2026] = await db
		.insert(fiscalYears)
		.values({
			orgId: org.id,
			year: 2026,
			activeRuleSetId: ruleSet2026.id,
		})
		.onConflictDoUpdate({
			target: [fiscalYears.orgId, fiscalYears.year],
			set: {
				activeRuleSetId: ruleSet2026.id,
				updatedAt: new Date(),
			},
		})
		.returning();

	// 9. Initial Satker Reminder Configs
	console.log("  -> Seeding Satker reminder configurations...");
	const policies = await db
		.select()
		.from(reminderPolicies)
		.where(eq(reminderPolicies.ruleSetId, ruleSet2026.id));

	for (const policy of policies) {
		await db
			.insert(orgReminderConfigs)
			.values({
				orgId: org.id,
				fiscalYearId: fy2026.id,
				reminderPolicyId: policy.id,
				enabled: true,
				scheduleJson: policy.defaultScheduleJson,
				additionalRecipientsJson: [],
				timezone: "Asia/Jakarta",
				updatedBy: operator1.id,
			})
			.onConflictDoNothing();
	}

	// 10. Default Fairness Treatment Policy (RO Khusus FAN.ZZ1 TA 2026)
	console.log("  -> Seeding Fairness Treatment Policy (FAN.ZZ1)...");
	await db
		.insert(assessmentExclusionPolicies)
		.values({
			ruleSetId: ruleSet2026.id,
			name: "Fairness RO Khusus FAN.ZZ1 TA 2026",
			indicatorKey: "output_achievement",
			action: "exclude_from_assessment",
			category: "ro_khusus",
			matchType: "exact",
			roMatchValue: ["FAN.ZZ1"],
			scopeType: "national",
			fiscalYearId: fy2026.id,
			year: 2026,
			effectiveMonthStart: 1,
			effectiveMonthEnd: 12,
			basisReference: "Fairness treatment IKPA TA 2026",
			displayReason:
				"RO Khusus tidak menjadi objek penilaian Indikator Capaian Output",
			allowOperatorProposal: false,
			status: "published",
			version: 1,
			publishedAt: new Date(),
			publishedBy: admin1.id,
			createdBy: admin1.id,
		})
		.onConflictDoNothing();

	// 11. Target Update Windows 2026
	console.log("  -> Seeding Target Update Windows 2026...");
	const windows = [
		{
			fiscalYearId: fy2026.id,
			quarter: 1,
			opensAt: new Date("2026-01-01T00:00:00Z"),
			closesAt: new Date("2026-04-30T23:59:59Z"),
			status: "closed" as const,
			sourceReference: "Periode Pengisian dan Pelaporan s.d. 30 April 2026",
		},
		{
			fiscalYearId: fy2026.id,
			quarter: 2,
			opensAt: new Date("2026-04-01T00:00:00Z"),
			closesAt: new Date("2026-04-30T23:59:59Z"),
			status: "closed" as const,
			sourceReference: "Periode Pengisian dan Pelaporan s.d. 30 April 2026",
		},
		{
			fiscalYearId: fy2026.id,
			quarter: 3,
			opensAt: new Date("2026-07-01T00:00:00Z"),
			closesAt: new Date("2026-07-14T23:59:59Z"),
			status: "closed" as const,
			sourceReference: "Periode Pengisian dan Pelaporan s.d. 14 Juli 2026",
		},
		{
			fiscalYearId: fy2026.id,
			quarter: 4,
			opensAt: new Date("2026-10-01T00:00:00Z"),
			closesAt: new Date("2026-10-14T23:59:59Z"),
			status: "scheduled" as const,
			sourceReference: "Periode Pengisian dan Pelaporan s.d. 14 Oktober 2026",
		},
	];

	for (const w of windows) {
		await db
			.insert(targetUpdateWindows)
			.values({ ...w, createdBy: admin1.id })
			.onConflictDoUpdate({
				target: [targetUpdateWindows.fiscalYearId, targetUpdateWindows.quarter],
				set: {
					opensAt: w.opensAt,
					closesAt: w.closesAt,
					status: w.status,
					sourceReference: w.sourceReference,
					updatedAt: new Date(),
				},
			});
	}

	// 12. Output Target Plans (RO 001, RO 002, RO 003)
	console.log("  -> Seeding Output Target Plans...");
	const ro1Targets = Array.from({ length: 12 }, (_, i) => ({
		month: i + 1,
		targetRvro: 1,
		targetPcro: 8.33,
		cumulativeTargetRvro: i + 1,
		cumulativeTargetPcro: Math.min(100, Math.round((i + 1) * 8.333 * 100) / 100),
	}));
	ro1Targets[11].cumulativeTargetPcro = 100;

	const ro2PcroDist = [5, 5, 10, 10, 10, 15, 10, 10, 10, 10, 5, 0];
	let ro2CumPcro = 0;
	const ro2Targets = Array.from({ length: 12 }, (_, i) => {
		ro2CumPcro += ro2PcroDist[i];
		return {
			month: i + 1,
			targetRvro: i === 11 ? 1 : 0,
			targetPcro: ro2PcroDist[i],
			cumulativeTargetRvro: i === 11 ? 1 : 0,
			cumulativeTargetPcro: Math.min(100, ro2CumPcro),
		};
	});

	const ro3Targets = Array.from({ length: 12 }, (_, i) => {
		const isQEnd = (i + 1) % 3 === 0;
		return {
			month: i + 1,
			targetRvro: isQEnd ? 1 : 0,
			targetPcro: isQEnd ? 25 : 0,
			cumulativeTargetRvro: Math.floor((i + 1) / 3),
			cumulativeTargetPcro: Math.floor((i + 1) / 3) * 25,
		};
	});

	const targetPlansData = [
		{
			organizationId: org.id,
			fiscalYearId: fy2026.id,
			roCode: "5241.AAA.001",
			roName: "Layanan Perkantoran dan Operasional Satker",
			volumeDipa: "12",
			unit: "Layanan",
			unitAllowsDecimal: false,
			isPriorityNational: false,
			version: 1,
			status: "active" as const,
			monthlyTargetsJson: ro1Targets,
			submittedAt: new Date("2026-01-15T08:00:00Z"),
			createdBy: operator1.id,
		},
		{
			organizationId: org.id,
			fiscalYearId: fy2026.id,
			roCode: "5241.BBA.002",
			roName: "Pembangunan Fasilitas Sarana Gedung Kantor",
			volumeDipa: "1",
			unit: "Gedung",
			unitAllowsDecimal: false,
			isPriorityNational: true,
			version: 1,
			status: "active" as const,
			monthlyTargetsJson: ro2Targets,
			submittedAt: new Date("2026-01-15T08:00:00Z"),
			createdBy: operator1.id,
		},
		{
			organizationId: org.id,
			fiscalYearId: fy2026.id,
			roCode: "5241.CCA.003",
			roName: "Pengelolaan Data dan Evaluasi Kinerja Anggaran",
			volumeDipa: "4",
			unit: "Laporan",
			unitAllowsDecimal: false,
			isPriorityNational: false,
			version: 1,
			status: "active" as const,
			monthlyTargetsJson: ro3Targets,
			submittedAt: new Date("2026-01-15T08:00:00Z"),
			createdBy: operator1.id,
		},
	];

	for (const tp of targetPlansData) {
		await db
			.insert(outputTargetPlans)
			.values(tp)
			.onConflictDoNothing();
	}

	// 13. RO Budget Realizations (PPA Level RO - Jan to Sep 2026)
	console.log("  -> Seeding RO Budget Realizations (PPA Jan - Sep 2026)...");
	const budgetRealizationsData: Array<{
		organizationId: string;
		fiscalYearId: string;
		roCode: string;
		month: number;
		budgetAmountRo: string;
		realizedAmountMonthly: string;
		ppaMonthly: string;
		realizedAmountCumulative: string;
		ppaCumulative: string;
		sourceType: string;
		verificationStatus: string;
	}> = [];

	for (let m = 1; m <= 9; m++) {
		// RO 1: Layanan Perkantoran (Total Pagu: 120jt)
		const ro1RealMonthly = 10000000;
		const ro1RealCum = ro1RealMonthly * m;
		const ro1PpaMonthly = (10000000 / 120000000) * 100;
		const ro1PpaCum = (ro1RealCum / 120000000) * 100;

		budgetRealizationsData.push({
			organizationId: org.id,
			fiscalYearId: fy2026.id,
			roCode: "5241.AAA.001",
			month: m,
			budgetAmountRo: "120000000",
			realizedAmountMonthly: ro1RealMonthly.toString(),
			ppaMonthly: ro1PpaMonthly.toFixed(4),
			realizedAmountCumulative: ro1RealCum.toString(),
			ppaCumulative: ro1PpaCum.toFixed(4),
			sourceType: "import_omspan",
			verificationStatus: "verified",
		});

		// RO 2: Pembangunan Gedung (Total Pagu: 500jt)
		const ro2TargetPercent = ro2PcroDist[m - 1];
		const ro2RealMonthly = (ro2TargetPercent / 100) * 500000000;
		let ro2CumPcroVal = 0;
		for (let i = 0; i < m; i++) ro2CumPcroVal += ro2PcroDist[i];
		const ro2RealCum = (ro2CumPcroVal / 100) * 500000000;

		budgetRealizationsData.push({
			organizationId: org.id,
			fiscalYearId: fy2026.id,
			roCode: "5241.BBA.002",
			month: m,
			budgetAmountRo: "500000000",
			realizedAmountMonthly: ro2RealMonthly.toString(),
			ppaMonthly: ro2TargetPercent.toFixed(4),
			realizedAmountCumulative: ro2RealCum.toString(),
			ppaCumulative: ro2CumPcroVal.toFixed(4),
			sourceType: "import_omspan",
			verificationStatus: "verified",
		});

		// RO 3: Pengelolaan Data (Total Pagu: 60jt)
		const isQEnd = m % 3 === 0;
		const ro3RealMonthly = isQEnd ? 15000000 : 0;
		const ro3RealCum = Math.floor(m / 3) * 15000000;
		const ro3PpaMonthly = isQEnd ? 25.0 : 0.0;
		const ro3PpaCum = Math.floor(m / 3) * 25.0;

		budgetRealizationsData.push({
			organizationId: org.id,
			fiscalYearId: fy2026.id,
			roCode: "5241.CCA.003",
			month: m,
			budgetAmountRo: "60000000",
			realizedAmountMonthly: ro3RealMonthly.toString(),
			ppaMonthly: ro3PpaMonthly.toFixed(4),
			realizedAmountCumulative: ro3RealCum.toString(),
			ppaCumulative: ro3PpaCum.toFixed(4),
			sourceType: "import_omspan",
			verificationStatus: "verified",
		});
	}

	for (const br of budgetRealizationsData) {
		await db
			.insert(roBudgetRealizations)
			.values(br)
			.onConflictDoUpdate({
				target: [
					roBudgetRealizations.fiscalYearId,
					roBudgetRealizations.roCode,
					roBudgetRealizations.month,
				],
				set: {
					budgetAmountRo: br.budgetAmountRo,
					realizedAmountMonthly: br.realizedAmountMonthly,
					ppaMonthly: br.ppaMonthly,
					realizedAmountCumulative: br.realizedAmountCumulative,
					ppaCumulative: br.ppaCumulative,
					sourceType: br.sourceType,
					verificationStatus: br.verificationStatus,
					updatedAt: new Date(),
				},
			});
	}

	// 14. Monthly Output Reports (Realisasi Kinerja Jan - Sep 2026)
	console.log("  -> Seeding Output Reports (Realisasi Jan - Sep 2026)...");
	await db.delete(outputReports).where(eq(outputReports.fiscalYearId, fy2026.id));
	const outputReportsData: Array<{
		organizationId: string;
		fiscalYearId: string;
		roCode: string;
		roName: string;
		month: number;
		volumeDipa: string;
		rvro: string;
		pcro: string;
		tpcro: string;
		rvroIncremental: string;
		pcroIncremental: string;
		reportedAt: Date;
		confirmed: boolean;
		confirmedAt?: Date;
		status: "confirmed" | "submitted";
		evidenceDocumentUrl?: string;
		achievementReference?: string;
		createdBy: string;
	}> = [];

	for (let m = 1; m <= 9; m++) {
		const reportMonthIso = String(m + 1).padStart(2, "0");
		const reportDate = new Date(`2026-${reportMonthIso}-04T08:30:00Z`);

		// RO 1
		const ro1CumPcro = Math.min(100, Math.round(m * 8.333 * 100) / 100);
		outputReportsData.push({
			organizationId: org.id,
			fiscalYearId: fy2026.id,
			roCode: "5241.AAA.001",
			roName: "Layanan Perkantoran dan Operasional Satker",
			month: m,
			volumeDipa: "12",
			rvro: String(m),
			pcro: ro1CumPcro.toFixed(2),
			tpcro: ro1CumPcro.toFixed(2),
			rvroIncremental: "1",
			pcroIncremental: "8.33",
			reportedAt: reportDate,
			confirmed: true,
			confirmedAt: reportDate,
			status: "confirmed" as const,
			evidenceDocumentUrl: `https://drive.google.com/sample-bast-ro1-m${m}`,
			achievementReference: `BAST No. 00${m}/LP/0${m}/2026`,
			createdBy: operator1.id,
		});

		// RO 2 (Priority National)
		let ro2CumPcroVal = 0;
		for (let i = 0; i < m; i++) ro2CumPcroVal += ro2PcroDist[i];
		outputReportsData.push({
			organizationId: org.id,
			fiscalYearId: fy2026.id,
			roCode: "5241.BBA.002",
			roName: "Pembangunan Fasilitas Sarana Gedung Kantor",
			month: m,
			volumeDipa: "1",
			rvro: m === 12 ? "1" : "0",
			pcro: ro2CumPcroVal.toFixed(2),
			tpcro: ro2CumPcroVal.toFixed(2),
			rvroIncremental: "0",
			pcroIncremental: ro2PcroDist[m - 1].toFixed(2),
			reportedAt: reportDate,
			confirmed: true,
			confirmedAt: reportDate,
			status: "confirmed" as const,
			evidenceDocumentUrl: `https://drive.google.com/sample-bast-ro2-m${m}`,
			achievementReference: `Laporan Kemajuan Fisik Gedung Bulan ${m}`,
			createdBy: operator1.id,
		});

		// RO 3
		const ro3CumPcro = Math.floor(m / 3) * 25;
		const ro3CumRvro = Math.floor(m / 3);
		const isQEnd = m % 3 === 0;
		outputReportsData.push({
			organizationId: org.id,
			fiscalYearId: fy2026.id,
			roCode: "5241.CCA.003",
			roName: "Pengelolaan Data dan Evaluasi Kinerja Anggaran",
			month: m,
			volumeDipa: "4",
			rvro: String(ro3CumRvro),
			pcro: ro3CumPcro.toFixed(2),
			tpcro: ro3CumPcro.toFixed(2),
			rvroIncremental: isQEnd ? "1" : "0",
			pcroIncremental: isQEnd ? "25.00" : "0.00",
			reportedAt: reportDate,
			confirmed: true,
			confirmedAt: reportDate,
			status: "confirmed" as const,
			evidenceDocumentUrl: `https://drive.google.com/sample-laporan-m${m}`,
			achievementReference: `Laporan Pengelolaan Data Bulan ${m}`,
			createdBy: operator1.id,
		});
	}

	for (const rep of outputReportsData) {
		await db
			.insert(outputReports)
			.values(rep)
			.onConflictDoNothing();
	}

	// 15. Budgets (Pagu DIPA 51, 52, 53)
	console.log("  -> Seeding Budgets (Pagu DIPA)...");
	await db.delete(budgets).where(eq(budgets.fiscalYearId, fy2026.id));
	await db.insert(budgets).values([
		{
			fiscalYearId: fy2026.id,
			accountCode: "51",
			amount: "1200000000", // 1.2 Milyar
			effectiveAt: "2026-01-01",
			createdBy: operator1.id,
		},
		{
			fiscalYearId: fy2026.id,
			accountCode: "52",
			amount: "800000000", // 800 Juta
			effectiveAt: "2026-01-01",
			createdBy: operator1.id,
		},
		{
			fiscalYearId: fy2026.id,
			accountCode: "53",
			amount: "500000000", // 500 Juta
			effectiveAt: "2026-01-01",
			createdBy: operator1.id,
		},
	]);

	// 16. DIPA Revisions
	console.log("  -> Seeding DIPA Revisions...");
	await db.delete(dipaRevisions).where(eq(dipaRevisions.fiscalYearId, fy2026.id));
	await db.insert(dipaRevisions).values([
		{
			fiscalYearId: fy2026.id,
			revisionDate: "2026-02-15",
			revisionCode: "DIPA-01",
			paguBefore: "2500000000",
			paguAfter: "2500000000",
			notes: "Pergeseran pagu operasional internal TW I",
			createdBy: operator1.id,
		},
		{
			fiscalYearId: fy2026.id,
			revisionDate: "2026-05-20",
			revisionCode: "DIPA-02",
			paguBefore: "2500000000",
			paguAfter: "2500000000",
			notes: "Revisi administratif hal III TW II",
			createdBy: operator1.id,
		},
		{
			fiscalYearId: fy2026.id,
			revisionDate: "2026-08-15",
			revisionCode: "DIPA-03",
			paguBefore: "2500000000",
			paguAfter: "2500000000",
			notes: "Revisi administratif hal III TW III",
			createdBy: operator1.id,
		},
	]);

	// 17. RPD Lines & Realizations (12 Months)
	console.log("  -> Seeding RPD Lines & Realizations...");
	await db.delete(rpdLines).where(eq(rpdLines.fiscalYearId, fy2026.id));
	await db.delete(realizations).where(eq(realizations.fiscalYearId, fy2026.id));

	const rpdEntries: Array<{
		fiscalYearId: string;
		month: number;
		accountCode: string;
		amount: string;
		createdBy: string;
	}> = [];
	const realEntries: Array<{
		fiscalYearId: string;
		month: number;
		accountCode: string;
		amount: string;
		createdBy: string;
	}> = [];

	for (let m = 1; m <= 12; m++) {
		// Akun 51: Rp 100jt / bln
		rpdEntries.push({
			fiscalYearId: fy2026.id,
			month: m,
			accountCode: "51",
			amount: "100000000",
			createdBy: operator1.id,
		});
		// Akun 52: Rp 66.6jt / bln
		rpdEntries.push({
			fiscalYearId: fy2026.id,
			month: m,
			accountCode: "52",
			amount: "66666666",
			createdBy: operator1.id,
		});
		// Akun 53: Rp 41.6jt / bln
		rpdEntries.push({
			fiscalYearId: fy2026.id,
			month: m,
			accountCode: "53",
			amount: "41666666",
			createdBy: operator1.id,
		});

		// Realizations for elapsed months (1 to 9)
		if (m <= 9) {
			realEntries.push({
				fiscalYearId: fy2026.id,
				month: m,
				accountCode: "51",
				amount: (98000000 + ((m * 370000) % 3000000)).toString(),
				createdBy: operator1.id,
			});
			realEntries.push({
				fiscalYearId: fy2026.id,
				month: m,
				accountCode: "52",
				amount: (65000000 + ((m * 290000) % 2500000)).toString(),
				createdBy: operator1.id,
			});
			realEntries.push({
				fiscalYearId: fy2026.id,
				month: m,
				accountCode: "53",
				amount: (40500000 + ((m * 410000) % 2000000)).toString(),
				createdBy: operator1.id,
			});
		}
	}

	await db.insert(rpdLines).values(rpdEntries);
	await db.insert(realizations).values(realEntries);

	// 18. Contracts & SPM-LS (Q1 - Q3 2026)
	console.log("  -> Seeding Contracts & SPM-LS (Q1 - Q3 2026)...");
	await db.delete(contracts).where(eq(contracts.fiscalYearId, fy2026.id));
	const seededContracts = await db
		.insert(contracts)
		.values([
			{
				fiscalYearId: fy2026.id,
				contractNumber: "KTR-001/PRA-DIPA/2026",
				accountCode: "53",
				value: "150000000",
				signedAt: "2026-01-10",
				paymentType: "sekaligus" as const,
				sp2dAt: "2026-01-22",
				createdBy: operator1.id,
			},
			{
				fiscalYearId: fy2026.id,
				contractNumber: "KTR-002/MODAL-TW1/2026",
				accountCode: "53",
				value: "180000000",
				signedAt: "2026-02-12",
				paymentType: "sekaligus" as const,
				sp2dAt: "2026-02-24",
				createdBy: operator1.id,
			},
			{
				fiscalYearId: fy2026.id,
				contractNumber: "KTR-003/BARANG-TW2/2026",
				accountCode: "52",
				value: "80000000",
				signedAt: "2026-05-15",
				paymentType: "sekaligus" as const,
				sp2dAt: "2026-05-28",
				createdBy: operator1.id,
			},
			{
				fiscalYearId: fy2026.id,
				contractNumber: "KTR-004/MODAL-TW3/2026",
				accountCode: "53",
				value: "120000000",
				signedAt: "2026-07-10",
				paymentType: "sekaligus" as const,
				sp2dAt: "2026-07-25",
				createdBy: operator1.id,
			},
		])
		.returning();

	await db.delete(spmLs).where(eq(spmLs.fiscalYearId, fy2026.id));
	await db.insert(spmLs).values([
		{
			fiscalYearId: fy2026.id,
			contractId: seededContracts[0].id,
			referenceNumber: "SPM-LS-001/01/2026",
			bastBappDate: "2026-01-12",
			receivedAtKppn: "2026-01-18",
			isPegawai: false,
			createdBy: operator1.id,
		},
		{
			fiscalYearId: fy2026.id,
			contractId: seededContracts[1].id,
			referenceNumber: "SPM-LS-002/02/2026",
			bastBappDate: "2026-02-15",
			receivedAtKppn: "2026-02-20",
			isPegawai: false,
			createdBy: operator1.id,
		},
		{
			fiscalYearId: fy2026.id,
			contractId: seededContracts[2].id,
			referenceNumber: "SPM-LS-003/05/2026",
			bastBappDate: "2026-05-18",
			receivedAtKppn: "2026-05-24",
			isPegawai: false,
			createdBy: operator1.id,
		},
		{
			fiscalYearId: fy2026.id,
			contractId: seededContracts[3].id,
			referenceNumber: "SPM-LS-004/07/2026",
			bastBappDate: "2026-07-15",
			receivedAtKppn: "2026-07-20",
			isPegawai: false,
			createdBy: operator1.id,
		},
	]);

	// 19. UP/TUP Transactions & KKP (Jan - Sep 2026)
	console.log("  -> Seeding UP/TUP & KKP Transactions...");
	await db
		.delete(upTupTransactions)
		.where(eq(upTupTransactions.fiscalYearId, fy2026.id));

	await db.insert(upTupTransactions).values([
		{
			fiscalYearId: fy2026.id,
			type: "UP" as const,
			amount: "50000000",
			sp2dAt: "2026-01-08",
			isSettled: false,
			createdBy: operator1.id,
		},
		{
			fiscalYearId: fy2026.id,
			type: "GUP" as const,
			amount: "42000000",
			sp2dAt: "2026-02-10",
			referenceSp2dAt: "2026-01-08",
			isSettled: true,
			createdBy: operator1.id,
		},
		{
			fiscalYearId: fy2026.id,
			type: "GUP" as const,
			amount: "45000000",
			sp2dAt: "2026-03-12",
			referenceSp2dAt: "2026-02-10",
			isSettled: true,
			createdBy: operator1.id,
		},
		{
			fiscalYearId: fy2026.id,
			type: "GUP" as const,
			amount: "40000000",
			sp2dAt: "2026-04-14",
			referenceSp2dAt: "2026-03-12",
			isSettled: true,
			createdBy: operator1.id,
		},
		{
			fiscalYearId: fy2026.id,
			type: "GUP" as const,
			amount: "43000000",
			sp2dAt: "2026-05-15",
			referenceSp2dAt: "2026-04-14",
			isSettled: true,
			createdBy: operator1.id,
		},
		{
			fiscalYearId: fy2026.id,
			type: "GUP" as const,
			amount: "46000000",
			sp2dAt: "2026-06-16",
			referenceSp2dAt: "2026-05-15",
			isSettled: true,
			createdBy: operator1.id,
		},
		{
			fiscalYearId: fy2026.id,
			type: "GUP" as const,
			amount: "41000000",
			sp2dAt: "2026-07-15",
			referenceSp2dAt: "2026-06-16",
			isSettled: true,
			createdBy: operator1.id,
		},
		{
			fiscalYearId: fy2026.id,
			type: "GUP" as const,
			amount: "44000000",
			sp2dAt: "2026-08-14",
			referenceSp2dAt: "2026-07-15",
			isSettled: true,
			createdBy: operator1.id,
		},
		{
			fiscalYearId: fy2026.id,
			type: "GUP" as const,
			amount: "45000000",
			sp2dAt: "2026-09-15",
			referenceSp2dAt: "2026-08-14",
			isSettled: true,
			createdBy: operator1.id,
		},
	]);

	await db.delete(kkpUsages).where(eq(kkpUsages.fiscalYearId, fy2026.id));
	const kkpEntries = Array.from({ length: 9 }, (_, i) => ({
		fiscalYearId: fy2026.id,
		month: i + 1,
		amount: "10000000",
		usageDate: `2026-0${i + 1}-10`,
		createdBy: operator1.id,
	}));
	await db.insert(kkpUsages).values(kkpEntries);

	console.log("✅ Database seed completed successfully!");
}

// Run if called directly
if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	seed()
		.then(() => process.exit(0))
		.catch((err) => {
			console.error("❌ Seed failed:", err);
			process.exit(1);
		});
}

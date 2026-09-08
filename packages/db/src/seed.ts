import { pathToFileURL } from "node:url";
import { default2026RuleSet } from "@simulator-ikpa/ikpa-engine";
import * as dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { createPoolDbClient } from "./client";
import {
	assessmentExclusionPolicies,
	fiscalYears,
	kppnScopes,
	organizations,
	orgReminderConfigs,
	outputReports,
	outputTargetPlans,
	reminderPolicies,
	roBudgetRealizations,
	ruleSets,
	targetUpdateWindows,
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

	// 13. RO Budget Realizations (PPA Level RO)
	console.log("  -> Seeding RO Budget Realizations (PPA)...");
	const budgetRealizationsData = [
		// RO 1
		{
			organizationId: org.id,
			fiscalYearId: fy2026.id,
			roCode: "5241.AAA.001",
			month: 1,
			budgetAmountRo: "120000000",
			realizedAmountMonthly: "10000000",
			ppaMonthly: "8.3300",
			realizedAmountCumulative: "10000000",
			ppaCumulative: "8.3300",
			sourceType: "import_omspan",
			verificationStatus: "verified",
		},
		{
			organizationId: org.id,
			fiscalYearId: fy2026.id,
			roCode: "5241.AAA.001",
			month: 2,
			budgetAmountRo: "120000000",
			realizedAmountMonthly: "10000000",
			ppaMonthly: "8.3300",
			realizedAmountCumulative: "20000000",
			ppaCumulative: "16.6700",
			sourceType: "import_omspan",
			verificationStatus: "verified",
		},
		{
			organizationId: org.id,
			fiscalYearId: fy2026.id,
			roCode: "5241.AAA.001",
			month: 3,
			budgetAmountRo: "120000000",
			realizedAmountMonthly: "10000000",
			ppaMonthly: "8.3300",
			realizedAmountCumulative: "30000000",
			ppaCumulative: "25.0000",
			sourceType: "import_omspan",
			verificationStatus: "verified",
		},
		// RO 2 (Priority National)
		{
			organizationId: org.id,
			fiscalYearId: fy2026.id,
			roCode: "5241.BBA.002",
			month: 1,
			budgetAmountRo: "500000000",
			realizedAmountMonthly: "25000000",
			ppaMonthly: "5.0000",
			realizedAmountCumulative: "25000000",
			ppaCumulative: "5.0000",
			sourceType: "import_omspan",
			verificationStatus: "verified",
		},
		{
			organizationId: org.id,
			fiscalYearId: fy2026.id,
			roCode: "5241.BBA.002",
			month: 2,
			budgetAmountRo: "500000000",
			realizedAmountMonthly: "25000000",
			ppaMonthly: "5.0000",
			realizedAmountCumulative: "50000000",
			ppaCumulative: "10.0000",
			sourceType: "import_omspan",
			verificationStatus: "verified",
		},
		{
			organizationId: org.id,
			fiscalYearId: fy2026.id,
			roCode: "5241.BBA.002",
			month: 3,
			budgetAmountRo: "500000000",
			realizedAmountMonthly: "50000000",
			ppaMonthly: "10.0000",
			realizedAmountCumulative: "100000000",
			ppaCumulative: "20.0000",
			sourceType: "import_omspan",
			verificationStatus: "verified",
		},
		// RO 3
		{
			organizationId: org.id,
			fiscalYearId: fy2026.id,
			roCode: "5241.CCA.003",
			month: 1,
			budgetAmountRo: "60000000",
			realizedAmountMonthly: "0",
			ppaMonthly: "0.0000",
			realizedAmountCumulative: "0",
			ppaCumulative: "0.0000",
			sourceType: "import_omspan",
			verificationStatus: "verified",
		},
		{
			organizationId: org.id,
			fiscalYearId: fy2026.id,
			roCode: "5241.CCA.003",
			month: 2,
			budgetAmountRo: "60000000",
			realizedAmountMonthly: "0",
			ppaMonthly: "0.0000",
			realizedAmountCumulative: "0",
			ppaCumulative: "0.0000",
			sourceType: "import_omspan",
			verificationStatus: "verified",
		},
		{
			organizationId: org.id,
			fiscalYearId: fy2026.id,
			roCode: "5241.CCA.003",
			month: 3,
			budgetAmountRo: "60000000",
			realizedAmountMonthly: "15000000",
			ppaMonthly: "25.0000",
			realizedAmountCumulative: "15000000",
			ppaCumulative: "25.0000",
			sourceType: "import_omspan",
			verificationStatus: "verified",
		},
	];

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

	// 14. Monthly Output Reports (Realisasi Kinerja)
	console.log("  -> Seeding Output Reports (Realisasi)...");
	const outputReportsData = [
		// RO 1
		{
			organizationId: org.id,
			fiscalYearId: fy2026.id,
			roCode: "5241.AAA.001",
			roName: "Layanan Perkantoran dan Operasional Satker",
			month: 1,
			volumeDipa: "12",
			rvro: "1",
			pcro: "8.33",
			tpcro: "8.33",
			rvroIncremental: "1",
			pcroIncremental: "8.33",
			reportedAt: new Date("2026-02-04T08:30:00Z"),
			confirmed: true,
			confirmedAt: new Date("2026-02-04T09:00:00Z"),
			status: "confirmed" as const,
			evidenceDocumentUrl: "https://drive.google.com/sample-bast-ro1-m1",
			achievementReference: "BAST No. 001/LP/01/2026",
			createdBy: operator1.id,
		},
		{
			organizationId: org.id,
			fiscalYearId: fy2026.id,
			roCode: "5241.AAA.001",
			roName: "Layanan Perkantoran dan Operasional Satker",
			month: 2,
			volumeDipa: "12",
			rvro: "2",
			pcro: "16.67",
			tpcro: "16.67",
			rvroIncremental: "1",
			pcroIncremental: "8.34",
			reportedAt: new Date("2026-03-05T08:30:00Z"),
			confirmed: true,
			confirmedAt: new Date("2026-03-05T09:00:00Z"),
			status: "confirmed" as const,
			evidenceDocumentUrl: "https://drive.google.com/sample-bast-ro1-m2",
			achievementReference: "BAST No. 002/LP/02/2026",
			createdBy: operator1.id,
		},
		{
			organizationId: org.id,
			fiscalYearId: fy2026.id,
			roCode: "5241.AAA.001",
			roName: "Layanan Perkantoran dan Operasional Satker",
			month: 3,
			volumeDipa: "12",
			rvro: "3",
			pcro: "25.00",
			tpcro: "25.00",
			rvroIncremental: "1",
			pcroIncremental: "8.33",
			reportedAt: new Date("2026-04-03T08:30:00Z"),
			confirmed: false,
			status: "submitted" as const,
			evidenceDocumentUrl: "https://drive.google.com/sample-bast-ro1-m3",
			achievementReference: "BAST No. 003/LP/03/2026",
			createdBy: operator1.id,
		},
		// RO 2 (Priority National)
		{
			organizationId: org.id,
			fiscalYearId: fy2026.id,
			roCode: "5241.BBA.002",
			roName: "Pembangunan Fasilitas Sarana Gedung Kantor",
			month: 1,
			volumeDipa: "1",
			rvro: "0",
			pcro: "5.00",
			tpcro: "5.00",
			rvroIncremental: "0",
			pcroIncremental: "5.00",
			reportedAt: new Date("2026-02-05T10:00:00Z"),
			confirmed: true,
			confirmedAt: new Date("2026-02-05T11:00:00Z"),
			status: "confirmed" as const,
			evidenceDocumentUrl: "https://drive.google.com/sample-bast-ro2-m1",
			achievementReference: "Laporan Kemajuan Fisik MK TW1 M1",
			createdBy: operator1.id,
		},
		{
			organizationId: org.id,
			fiscalYearId: fy2026.id,
			roCode: "5241.BBA.002",
			roName: "Pembangunan Fasilitas Sarana Gedung Kantor",
			month: 2,
			volumeDipa: "1",
			rvro: "0",
			pcro: "10.00",
			tpcro: "10.00",
			rvroIncremental: "0",
			pcroIncremental: "5.00",
			reportedAt: new Date("2026-03-06T10:00:00Z"),
			confirmed: true,
			confirmedAt: new Date("2026-03-06T11:00:00Z"),
			status: "confirmed" as const,
			evidenceDocumentUrl: "https://drive.google.com/sample-bast-ro2-m2",
			achievementReference: "Laporan Kemajuan Fisik MK TW1 M2",
			createdBy: operator1.id,
		},
		{
			organizationId: org.id,
			fiscalYearId: fy2026.id,
			roCode: "5241.BBA.002",
			roName: "Pembangunan Fasilitas Sarana Gedung Kantor",
			month: 3,
			volumeDipa: "1",
			rvro: "0",
			pcro: "20.00",
			tpcro: "20.00",
			rvroIncremental: "0",
			pcroIncremental: "10.00",
			reportedAt: new Date("2026-04-06T10:00:00Z"),
			confirmed: false,
			status: "submitted" as const,
			evidenceDocumentUrl: "https://drive.google.com/sample-bast-ro2-m3",
			achievementReference: "Laporan Kemajuan Fisik MK TW1 M3",
			createdBy: operator1.id,
		},
		// RO 3
		{
			organizationId: org.id,
			fiscalYearId: fy2026.id,
			roCode: "5241.CCA.003",
			roName: "Pengelolaan Data dan Evaluasi Kinerja Anggaran",
			month: 1,
			volumeDipa: "4",
			rvro: "0",
			pcro: "0.00",
			tpcro: "0.00",
			rvroIncremental: "0",
			pcroIncremental: "0.00",
			reportedAt: new Date("2026-02-04T11:00:00Z"),
			confirmed: true,
			confirmedAt: new Date("2026-02-04T11:30:00Z"),
			status: "confirmed" as const,
			createdBy: operator1.id,
		},
		{
			organizationId: org.id,
			fiscalYearId: fy2026.id,
			roCode: "5241.CCA.003",
			roName: "Pengelolaan Data dan Evaluasi Kinerja Anggaran",
			month: 2,
			volumeDipa: "4",
			rvro: "0",
			pcro: "0.00",
			tpcro: "0.00",
			rvroIncremental: "0",
			pcroIncremental: "0.00",
			reportedAt: new Date("2026-03-05T11:00:00Z"),
			confirmed: true,
			confirmedAt: new Date("2026-03-05T11:30:00Z"),
			status: "confirmed" as const,
			createdBy: operator1.id,
		},
		{
			organizationId: org.id,
			fiscalYearId: fy2026.id,
			roCode: "5241.CCA.003",
			roName: "Pengelolaan Data dan Evaluasi Kinerja Anggaran",
			month: 3,
			volumeDipa: "4",
			rvro: "1",
			pcro: "25.00",
			tpcro: "25.00",
			rvroIncremental: "1",
			pcroIncremental: "25.00",
			reportedAt: new Date("2026-04-05T11:00:00Z"),
			confirmed: false,
			status: "submitted" as const,
			evidenceDocumentUrl: "https://drive.google.com/sample-laporan-q1",
			achievementReference: "Laporan Capaian Kinerja Triwulan I TA 2026",
			createdBy: operator1.id,
		},
	];

	for (const rep of outputReportsData) {
		await db
			.insert(outputReports)
			.values(rep)
			.onConflictDoNothing();
	}

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

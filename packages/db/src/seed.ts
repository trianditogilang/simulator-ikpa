import { pathToFileURL } from "node:url";
import { default2026RuleSet } from "@simulator-ikpa/ikpa-engine";
import * as dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { createPoolDbClient } from "./client";
import {
	fiscalYears,
	kppnScopes,
	organizations,
	orgReminderConfigs,
	reminderPolicies,
	ruleSets,
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
			minLeadDays: 5,
			maxLeadDays: 14,
			defaultScheduleJson: { leadDays: [14, 7, 3, 1], sendHour: 9 },
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
			minLeadDays: 3,
			maxLeadDays: 10,
			defaultScheduleJson: { leadDays: [10, 5, 2], sendHour: 8 },
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
			minLeadDays: 3,
			maxLeadDays: 7,
			defaultScheduleJson: { leadDays: [7, 3, 1], sendHour: 9 },
			requiredRecipientsJson: ["bendahara", "kpa"],
			allowDisable: false,
			allowRecipientOverride: true,
			isActive: true,
		},
		{
			ruleSetId: ruleSet2026.id,
			eventType: "output_report_monthly",
			indicatorKey: "output_achievement",
			category: "recommended" as const,
			deadlineFormula: {
				type: "workdays_after_month_end",
				workdays: 5,
				description: "Batas pelaporan capaian output H+5 hari kerja",
			},
			dayType: "workday" as const,
			minLeadDays: 2,
			maxLeadDays: 5,
			defaultScheduleJson: { leadDays: [5, 2], sendHour: 9 },
			requiredRecipientsJson: ["operator_sakun"],
			allowDisable: true,
			allowRecipientOverride: true,
			isActive: true,
		},
		{
			ruleSetId: ruleSet2026.id,
			eventType: "spm_dispensation_q4",
			indicatorKey: "spm_dispensation",
			category: "mandatory" as const,
			deadlineFormula: {
				type: "end_of_year_schedule",
				description: "Batas pengajuan SPM akhir tahun TW IV",
			},
			dayType: "calendar_day" as const,
			minLeadDays: 7,
			maxLeadDays: 21,
			defaultScheduleJson: { leadDays: [21, 14, 7, 3, 1], sendHour: 8 },
			requiredRecipientsJson: ["kpa", "ppk", "bendahara"],
			allowDisable: false,
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

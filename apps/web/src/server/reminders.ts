import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";
import { createDbClient } from "@simulator-ikpa/db";
import {
	fiscalYears,
	organizations,
	reminderPolicies,
	ruleSets,
	userAccesses,
	users,
} from "@simulator-ikpa/db/schema";
import { getAccessResolutionForSession } from "./access.server";
import { getServerAuthSession } from "./auth-session.server";
import {
	getActiveReminderEvents,
	getMockActiveReminderEvents,
	getWorkdayCalendar,
	type ActiveReminderEvent,
	type ReminderDeliveryLogItem,
	type ReminderRecipientItem,
} from "./reminders/active-events.queries";
import {
	resetReminderConfigToDefault,
	upsertReminderConfig,
} from "./reminders/config.mutations";
import {
	listReminderConfigs,
	previewReminderSchedule,
} from "./reminders/config.queries";
import { listDeliveriesForOperator } from "./reminders/delivery.queries";
import { failIfProduction } from "./runtime-guards";

function getDatabase() {
	const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
	if (!dbUrl) {
		failIfProduction(true, "Production database is not configured for reminders.");
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

export const POLICY_INDICATOR_LABELS: Record<string, { label: string; title: string }> = {
	spm_ls_contract_17d: {
		label: "Penyelesaian Tagihan",
		title: "Penyelesaian Tagihan SPM-LS (17 Hari Kerja)",
	},
	invoice_timeliness_due: {
		label: "Penyelesaian Tagihan",
		title: "Penyelesaian Tagihan SPM-LS (17 Hari Kerja)",
	},
	early_contract_due: {
		label: "Belanja Kontraktual",
		title: "Penyelesaian Kontrak Dini / Pra-DIPA (TW I)",
	},
	contract_distribution_due: {
		label: "Belanja Kontraktual",
		title: "Distribusi Akselerasi Kontrak s.d. Triwulan II",
	},
	capital_53_contract_due: {
		label: "Belanja Kontraktual",
		title: "Akselerasi Kontrak Belanja Modal 53 Rp50–200 Juta (TW I)",
	},
	output_report_monthly: {
		label: "Capaian Output",
		title: "Pelaporan Capaian Output",
	},
	output_report_due: {
		label: "Capaian Output",
		title: "Pelaporan Capaian Output",
	},
	output_target_update_due: {
		label: "Capaian Output",
		title: "Pemutakhiran Proyeksi Target Output (10 HK Awal Triwulan)",
	},
	up_tup_revolving_monthly: {
		label: "Pengelolaan UP & TUP",
		title: "Batas Revolving GUP (30 Hari Kalender)",
	},
	up_tup_revolving_due: {
		label: "Pengelolaan UP & TUP",
		title: "Batas Revolving GUP (30 Hari Kalender)",
	},
	spm_dispensation_q4: {
		label: "Dispensasi SPM",
		title: "Batas Pengajuan SPM Dispensasi Akhir Tahun (TW IV)",
	},
	spm_dispensation_warning: {
		label: "Dispensasi SPM",
		title: "Peringatan Rasio SPM Dispensasi Triwulan IV",
	},
	dipa_revision_quarterly: {
		label: "Revisi DIPA",
		title: "Batas Akhir Revisi DIPA Triwulanan",
	},
	ikpa_weekly_digest: {
		label: "Semua Indikator",
		title: "Laporan Mingguan Estimasi IKPA Satker",
	},
};

export const listOperatorRemindersFn = createServerFn({ method: "GET" })
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
			const mockEvents = getMockActiveReminderEvents();
			return {
				fiscalYearId: "fy-mock-2026",
				year: 2026,
				organizationName: "Satker Contoh 411782",
				satkerCode: "411782",
				events: mockEvents,
				policies: getMockPolicies(),
				configs: [],
				previews: [],
				recipients: getMockRecipients(),
				deliveries: getMockDeliveries(),
				stats: computeStats(mockEvents, getMockPolicies(), getMockDeliveries()),
				providerStatus: {
					isProductionReady: false,
					mode: "sandbox_pending" as const,
					message:
						"Pengiriman email belum aktif (Mode Sandbox / Pending Provider). Event dan jadwal reminder telah disiapkan secara server-authoritative.",
				},
			};
		}

		const [org] = await db
			.select()
			.from(organizations)
			.where(eq(organizations.id, targetOrgId))
			.limit(1);

		const fy = await getOrInitFiscalYear(db, targetOrgId, 2026);
		if (!fy) {
			throw new Error("Tahun anggaran 2026 tidak ditemukan.");
		}

		// 1. Active Events from DB
		const events = await getActiveReminderEvents(db, targetOrgId, fy.id);

		// 2. Reminder Policies
		const policies = await db
			.select()
			.from(reminderPolicies)
			.where(eq(reminderPolicies.isActive, true));

		// 3. Org configs
		const configs = await listReminderConfigs(db, access, targetOrgId, fy.id);

		// 4. Calendar & Previews
		const calendar = await getWorkdayCalendar(db, 2026);
		const previews = await Promise.all(
			policies.map(async (p) => {
				const cfg = configs.find((c) => c.reminderPolicyId === p.id);
				try {
					const preview = await previewReminderSchedule(
						db,
						access,
						targetOrgId,
						fy.id,
						p.id,
						cfg
							? {
									enabled: cfg.enabled,
									scheduleJson: cfg.scheduleJson,
									additionalRecipientsJson: cfg.additionalRecipientsJson,
								}
							: undefined,
						calendar,
					);
					return {
						policyId: p.id,
						deadline: preview.deadline,
						dayType: preview.dayType,
						scheduled: preview.scheduled,
					};
				} catch {
					return {
						policyId: p.id,
						deadline: "2026-12-31",
						dayType: p.dayType,
						scheduled: [],
					};
				}
			}),
		);

		// 5. Verified Recipients from user_accesses + users + config overrides
		const userAccessRows = await db
			.select({
				userId: users.id,
				name: users.name,
				email: users.email,
				accessType: userAccesses.accessType,
			})
			.from(userAccesses)
			.innerJoin(users, eq(userAccesses.userId, users.id))
			.where(
				and(
					eq(userAccesses.orgId, targetOrgId),
					eq(userAccesses.active, true),
				),
			);

		const recipients: ReminderRecipientItem[] = [];
		for (const u of userAccessRows) {
			recipients.push({
				id: `rec-user-${u.userId}`,
				name: u.name,
				email: u.email,
				role:
					u.accessType === "operator_satker"
						? "Operator Satker"
						: "Pejabat Perbendaharaan Satker",
				isSystemUser: true,
				isVerified: true,
				allocatedPolicies: [
					"Penyelesaian Tagihan (SPM-LS)",
					"Belanja Kontraktual",
					"Capaian Output",
					"Pengelolaan UP & TUP",
					"Dispensasi SPM",
				],
				status: "active",
			});
		}

		// Include configured additional recipients
		for (const cfg of configs) {
			const addRecs = (cfg.additionalRecipientsJson as string[]) ?? [];
			const pol = policies.find((p) => p.id === cfg.reminderPolicyId);
			const polName = pol
				? POLICY_INDICATOR_LABELS[pol.eventType]?.title ?? pol.eventType
				: "Kebijakan Khusus";

			for (const email of addRecs) {
				if (!recipients.some((r) => r.email.toLowerCase() === email.toLowerCase())) {
					recipients.push({
						id: `rec-extra-${email}`,
						name: email.split("@")[0].toUpperCase(),
						email,
						role: "Penerima Tambahan Eksternal",
						isSystemUser: false,
						isVerified: true,
						allocatedPolicies: [polName],
						status: "custom",
					});
				}
			}
		}

		// 6. Deliveries
		const dbDeliveries = await listDeliveriesForOperator(
			db,
			access,
			targetOrgId,
			50,
		);

		let deliveries: ReminderDeliveryLogItem[] = [];
		if (dbDeliveries.length > 0) {
			deliveries = dbDeliveries.map((d) => {
				const pol = policies.find((p) => p.id === d.reminderPolicyId);
				const polInfo = pol
					? POLICY_INDICATOR_LABELS[pol.eventType] ?? {
							label: "Indikator IKPA",
							title: pol.eventType,
						}
					: { label: "Indikator IKPA", title: d.entityType };

				const payload =
					(d.payloadJson as Record<
						string,
						string | number | boolean | null
					>) ?? {};
				const recipientEmail =
					(payload.recipient as string) ??
					(recipients[0]?.email || "operator.satker@kemenkeu.go.id");

				return {
					id: d.id,
					indicatorLabel: polInfo.label,
					eventType: pol?.eventType ?? d.entityType,
					eventTitle: polInfo.title,
					entityNumber: (payload.entityNumber as string) ?? "-",
					recipientName:
						recipients.find((r) => r.email === recipientEmail)?.name ??
						"Operator Satker",
					recipientEmail,
					channel: "email" as const,
					scheduledFor: d.scheduledFor ? new Date(d.scheduledFor).toISOString() : "",
					sentAt: d.sentAt ? new Date(d.sentAt).toISOString() : null,
					status: d.status as ReminderDeliveryLogItem["status"],
					statusLabel:
						d.status === "sent"
							? "Terkirim"
							: d.status === "failed"
								? "Gagal"
								: "Terjadwal (Pending Provider)",
					attemptCount: d.attemptCount ?? 0,
					idempotencyKey: d.idempotencyKey,
					errorMessage: d.errorMessage,
					payloadJson: payload,
				};
			});
		} else {
			failIfProduction(true, "Reminder delivery records are unavailable in production.");
			deliveries = getMockDeliveries();
		}

		const mappedPolicies = policies.map((p) => {
			const info = POLICY_INDICATOR_LABELS[p.eventType] ?? {
				label: "Indikator IKPA",
				title: p.eventType,
			};
			const isOutputReport =
				p.eventType === "output_report_monthly" ||
				p.eventType === "output_report_due";
			const schedule = (p.defaultScheduleJson as { leadDays?: number[] }) ?? {};
			const minLeadDays = 0;
			const maxLeadDays = 20;
			const defaultLeadDays = (schedule.leadDays ?? [7, 3, 0]).slice(0, 4);

			return {
				id: p.id,
				eventType: p.eventType,
				indicatorKey: p.indicatorKey,
				indicatorLabel: info.label,
				category: p.category as "mandatory" | "recommended" | "optional",
				dayType: p.dayType as "workday" | "calendar_day" | "schedule",
				minLeadDays,
				maxLeadDays,
				defaultLeadDays,
				requiredRecipients:
					(p.requiredRecipientsJson as string[]) ?? ["Operator Satker"],
				allowDisable: p.allowDisable,
				allowRecipientOverride: p.allowRecipientOverride,
				isActive: p.isActive,
				description: isOutputReport
					? "Konfirmasi Realisasi Kinerja Capaian Output"
					: info.title,
			};
		});

		const mappedConfigs = configs.map((c) => {
			const sched = (c.scheduleJson as { leadDays?: number[] }) ?? {};
			return {
				id: c.id,
				reminderPolicyId: c.reminderPolicyId,
				enabled: c.enabled,
				scheduleLeadDays: sched.leadDays ?? [7, 3, 1],
				additionalRecipients: (c.additionalRecipientsJson as string[]) ?? [],
				customMessage: c.customMessage,
				timezone: c.timezone,
			};
		});

		failIfProduction(recipients.length === 0, "Reminder recipients are unavailable in production.");

		return {
			fiscalYearId: fy.id,
			year: fy.year,
			organizationName: org?.name ?? "Satker",
			satkerCode: org?.kodeSatker ?? "411782",
			events,
			policies: mappedPolicies,
			configs: mappedConfigs,
			previews,
			recipients: recipients.length > 0 ? recipients : getMockRecipients(),
			deliveries,
			stats: computeStats(events, mappedPolicies, deliveries),
			providerStatus: {
				isProductionReady: false,
				mode: "sandbox_pending" as const,
				message:
					"Pengiriman email belum aktif (Mode Sandbox / Pending Provider). Event dan jadwal reminder telah disiapkan secara server-authoritative.",
			},
		};
	});

export const updateOperatorReminderConfigFn = createServerFn({ method: "POST" })
	.validator(
		(data: {
			orgId?: string;
			reminderPolicyId: string;
			enabled: boolean;
			leadDays?: number[];
			additionalRecipients?: string[];
			customMessage?: string | null;
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

		const fy = await getOrInitFiscalYear(db, targetOrgId, 2026);
		if (!fy) {
			throw new Error("Tahun anggaran 2026 tidak ditemukan.");
		}

		const result = await upsertReminderConfig(
			db,
			access,
			targetOrgId,
			{
				fiscalYearId: fy.id,
				reminderPolicyId: data.reminderPolicyId,
				enabled: data.enabled,
				scheduleJson: { leadDays: data.leadDays ?? [7, 3, 1], sendHour: 8 },
				additionalRecipientsJson: data.additionalRecipients ?? [],
				customMessage: data.customMessage,
				timezone: "Asia/Jakarta",
			},
			{
				actorId:
					access.status === "operator_single_scope" ||
					access.status === "operator_multiple_scopes"
						? access.userId
						: targetOrgId,
			},
		);

		return { success: true, configId: result?.id };
	});

export const resetOperatorReminderConfigFn = createServerFn({ method: "POST" })
	.validator((data: { orgId?: string; configId: string }) => data)
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

		const result = await resetReminderConfigToDefault(
			db,
			access,
			targetOrgId,
			data.configId,
			{
				actorId:
					access.status === "operator_single_scope" ||
					access.status === "operator_multiple_scopes"
						? access.userId
						: targetOrgId,
			},
		);

		return { success: true, configId: result?.id };
	});

function computeStats(
	events: ActiveReminderEvent[],
	policies: Array<{ category: string }>,
	deliveries: ReminderDeliveryLogItem[],
) {
	return {
		totalActiveEvents: events.length,
		urgentEventsCount: events.filter(
			(e) => e.status === "urgent" || e.status === "overdue",
		).length,
		warningEventsCount: events.filter((e) => e.status === "warning").length,
		safeEventsCount: events.filter((e) => e.status === "safe").length,
		completedEventsCount: events.filter((e) => e.status === "completed").length,
		totalPoliciesCount: policies.length,
		mandatoryPoliciesCount: policies.filter((p) => p.category === "mandatory")
			.length,
		activePoliciesCount: policies.length,
		scheduledDeliveriesCount: deliveries.filter(
			(d) => d.status === "scheduled" || d.status === "pending_provider",
		).length,
		sentDeliveriesCount: deliveries.filter((d) => d.status === "sent").length,
		failedDeliveriesCount: deliveries.filter((d) => d.status === "failed")
			.length,
	};
}

function getMockPolicies() {
	return [
		{
			id: "pol-01",
			eventType: "spm_ls_contract_17d",
			indicatorKey: "invoice_timeliness",
			indicatorLabel: "Penyelesaian Tagihan",
			category: "mandatory" as const,
			dayType: "workday" as const,
			minLeadDays: 0,
			maxLeadDays: 20,
			defaultLeadDays: [17, 10, 5, 0],
			requiredRecipients: ["Operator Satker", "PPK Satker"],
			allowDisable: false,
			allowRecipientOverride: true,
			isActive: true,
			description: "Batas 17 Hari Kerja Penerbitan SPM-LS dari BAST/BAPP",
		},
		{
			id: "pol-02",
			eventType: "early_contract_due",
			indicatorKey: "contractual",
			indicatorLabel: "Belanja Kontraktual",
			category: "recommended" as const,
			dayType: "calendar_day" as const,
			minLeadDays: 0,
			maxLeadDays: 20,
			defaultLeadDays: [20, 14, 7, 0],
			requiredRecipients: ["Operator Satker", "PPK Satker"],
			allowDisable: true,
			allowRecipientOverride: true,
			isActive: true,
			description: "Penyelesaian Kontrak Dini / Pra-DIPA (TW I)",
		},
		{
			id: "pol-03",
			eventType: "capital_53_contract_due",
			indicatorKey: "contractual",
			indicatorLabel: "Belanja Kontraktual",
			category: "recommended" as const,
			dayType: "calendar_day" as const,
			minLeadDays: 0,
			maxLeadDays: 20,
			defaultLeadDays: [14, 7, 0],
			requiredRecipients: ["Operator Satker", "PPK Satker"],
			allowDisable: true,
			allowRecipientOverride: true,
			isActive: true,
			description: "Akselerasi Kontrak Belanja Modal 53 Rp50–200 Juta (TW I)",
		},
		{
			id: "pol-04",
			eventType: "output_report_monthly",
			indicatorKey: "output_achievement",
			indicatorLabel: "Capaian Output",
			category: "mandatory" as const,
			dayType: "workday" as const,
			minLeadDays: 0,
			maxLeadDays: 20,
			defaultLeadDays: [4, 2, 0],
			requiredRecipients: ["Operator Satker", "PPK Satker"],
			allowDisable: false,
			allowRecipientOverride: true,
			isActive: true,
			description: "Konfirmasi Realisasi Kinerja Capaian Output",
		},
		{
			id: "pol-05",
			eventType: "output_target_update_due",
			indicatorKey: "output_achievement",
			indicatorLabel: "Capaian Output",
			category: "mandatory" as const,
			dayType: "workday" as const,
			minLeadDays: 0,
			maxLeadDays: 20,
			defaultLeadDays: [10, 3, 0],
			requiredRecipients: ["Operator Satker", "PPK Satker"],
			allowDisable: false,
			allowRecipientOverride: true,
			isActive: true,
			description:
				"Pemutakhiran Proyeksi Target Triwulanan (10 Hari Kerja Awal TW)",
		},
		{
			id: "pol-06",
			eventType: "up_tup_revolving_monthly",
			indicatorKey: "up_tup",
			indicatorLabel: "Pengelolaan UP & TUP",
			category: "mandatory" as const,
			dayType: "calendar_day" as const,
			minLeadDays: 0,
			maxLeadDays: 20,
			defaultLeadDays: [15, 7, 3, 0],
			requiredRecipients: ["Operator Satker", "Bendahara Pengeluaran"],
			allowDisable: false,
			allowRecipientOverride: true,
			isActive: true,
			description: "Batas Revolving GUP Bulanan (30 Hari Kalender)",
		},
		{
			id: "pol-07",
			eventType: "spm_dispensation_q4",
			indicatorKey: "spm_dispensation",
			indicatorLabel: "Dispensasi SPM",
			category: "recommended" as const,
			dayType: "calendar_day" as const,
			minLeadDays: 0,
			maxLeadDays: 20,
			defaultLeadDays: [20, 14, 7, 0],
			requiredRecipients: ["Operator Satker", "PPK Satker"],
			allowDisable: true,
			allowRecipientOverride: true,
			isActive: true,
			description: "Batas Pengajuan SPM Dispensasi Akhir Tahun (TW IV)",
		},
		{
			id: "pol-08",
			eventType: "dipa_revision_quarterly",
			indicatorKey: "dipa_revision",
			indicatorLabel: "Revisi DIPA",
			category: "mandatory" as const,
			dayType: "calendar_day" as const,
			minLeadDays: 0,
			maxLeadDays: 20,
			defaultLeadDays: [14, 7, 3, 0],
			requiredRecipients: ["Operator Satker", "PPK Satker"],
			allowDisable: false,
			allowRecipientOverride: true,
			isActive: true,
			description: "Batas Akhir Revisi DIPA Triwulanan",
		},
	];
}

function getMockRecipients(): ReminderRecipientItem[] {
	return [
		{
			id: "rec-mock-1",
			name: "Triandito Gilang",
			email: "officialtgrid@gmail.com",
			role: "Operator Satker Utama",
			isSystemUser: true,
			isVerified: true,
			allocatedPolicies: [
				"Penyelesaian Tagihan (SPM-LS)",
				"Belanja Kontraktual",
				"Capaian Output",
				"Pengelolaan UP & TUP",
				"Dispensasi SPM",
				"Revisi DIPA",
			],
			status: "active",
		},
		{
			id: "rec-mock-2",
			name: "PPK Satker 411782",
			email: "ppk.satker411782@kemenkeu.go.id",
			role: "Pejabat Pembuat Komitmen (PPK)",
			isSystemUser: true,
			isVerified: true,
			allocatedPolicies: [
				"Penyelesaian Tagihan (SPM-LS)",
				"Belanja Kontraktual",
				"Capaian Output",
				"Dispensasi SPM",
			],
			status: "active",
		},
		{
			id: "rec-mock-3",
			name: "Bendahara Pengeluaran",
			email: "bendahara.411782@kemenkeu.go.id",
			role: "Bendahara Pengeluaran",
			isSystemUser: true,
			isVerified: true,
			allocatedPolicies: ["Pengelolaan UP & TUP", "Penyelesaian Tagihan (SPM-LS)"],
			status: "active",
		},
	];
}

function getMockDeliveries(): ReminderDeliveryLogItem[] {
	return [
		{
			id: "del-mock-01",
			indicatorLabel: "Capaian Output",
			eventType: "output_report_monthly",
			eventTitle: "Pelaporan Capaian Output (Open Period 7 HK)",
			entityNumber: "Realisasi Bulan Agustus 2026",
			recipientName: "Triandito Gilang",
			recipientEmail: "officialtgrid@gmail.com",
			channel: "email",
			scheduledFor: "2026-09-09T01:00:00.000Z",
			sentAt: null,
			status: "pending_provider",
			statusLabel: "Terjadwal (Mode Sandbox)",
			attemptCount: 0,
			idempotencyKey: "411782-output-2026-08-H0-a1b2c3d4",
			errorMessage: null,
			payloadJson: {
				entity: "output_report",
				month: 8,
				deadline: "2026-09-09",
				leadDays: 0,
			},
		},
		{
			id: "del-mock-02",
			indicatorLabel: "Penyelesaian Tagihan",
			eventType: "spm_ls_contract_17d",
			eventTitle: "Penyelesaian Tagihan SPM-LS Kontraktual",
			entityNumber: "SPM-LS/411782/002",
			recipientName: "Triandito Gilang",
			recipientEmail: "officialtgrid@gmail.com",
			channel: "email",
			scheduledFor: "2026-09-04T01:00:00.000Z",
			sentAt: null,
			status: "pending_provider",
			statusLabel: "Terjadwal (Mode Sandbox)",
			attemptCount: 0,
			idempotencyKey: "411782-spm002-2026-09-04-H0-e5f6g7h8",
			errorMessage: null,
			payloadJson: {
				entity: "spm_ls",
				referenceNumber: "SPM-LS/411782/002",
				deadline: "2026-09-04",
				leadDays: 0,
			},
		},
		{
			id: "del-mock-03",
			indicatorLabel: "Pengelolaan UP & TUP",
			eventType: "up_tup_revolving_monthly",
			eventTitle: "Batas Revolving GUP Bulanan",
			entityNumber: "Rekening UP Satker",
			recipientName: "Bendahara Pengeluaran",
			recipientEmail: "bendahara.411782@kemenkeu.go.id",
			channel: "email",
			scheduledFor: "2026-09-11T01:00:00.000Z",
			sentAt: null,
			status: "pending_provider",
			statusLabel: "Terjadwal (Mode Sandbox)",
			attemptCount: 0,
			idempotencyKey: "411782-uptup-2026-09-14-H3-i9j0k1l2",
			errorMessage: null,
			payloadJson: {
				entity: "up_tup",
				deadline: "2026-09-14",
				leadDays: 3,
			},
		},
		{
			id: "del-mock-04",
			indicatorLabel: "Belanja Kontraktual",
			eventType: "early_contract_due",
			eventTitle: "Penyelesaian Kontrak Dini (TW I)",
			entityNumber: "KTR-2026/411782/01",
			recipientName: "Triandito Gilang",
			recipientEmail: "officialtgrid@gmail.com",
			channel: "email",
			scheduledFor: "2026-03-17T01:00:00.000Z",
			sentAt: "2026-03-17T01:00:15.000Z",
			status: "sent",
			statusLabel: "Terkirim",
			attemptCount: 1,
			idempotencyKey: "411782-ktr01-2026-03-31-H14-m3n4o5p6",
			errorMessage: null,
			payloadJson: {
				entity: "contract",
				contractNumber: "KTR-2026/411782/01",
				deadline: "2026-03-31",
				leadDays: 14,
			},
		},
	];
}

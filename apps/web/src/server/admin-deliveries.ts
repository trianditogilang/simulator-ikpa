import { createServerFn } from "@tanstack/react-start";
import { inArray } from "drizzle-orm";
import { createDbClient } from "@simulator-ikpa/db";
import { organizations, reminderPolicies } from "@simulator-ikpa/db/schema";
import { getAccessResolutionForSession } from "./access.server";
import { getServerAuthSession } from "./auth-session.server";
import { POLICY_INDICATOR_LABELS } from "./reminders";
import { listDeliveriesForAdmin } from "./reminders/delivery.queries";
import { retryFailedDelivery } from "./reminders/delivery.mutations";

function getDatabase() {
	const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
	if (!dbUrl) {
		return null;
	}
	return createDbClient(dbUrl);
}

function toIso(v: unknown): string {
	if (v instanceof Date) return v.toISOString();
	return String(v ?? "");
}

export const listAdminDeliveriesFn = createServerFn({ method: "GET" })
	.validator(
		(data?: { status?: string; page?: number; pageSize?: number }) =>
			data as { status?: string; page?: number; pageSize?: number } | undefined,
	)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth);

		const db = getDatabase();
		if (!db) {
			return {
				items: [],
				totalItems: 0,
				page: 1,
				pageSize: 20,
				totalPages: 0,
				stats: { total: 0, sent: 0, scheduled: 0, failed: 0 },
			};
		}

		const page = data?.page ?? 1;
		const pageSize = data?.pageSize ?? 20;
		const [result, sentAgg, scheduledAgg, failedAgg] = await Promise.all([
			listDeliveriesForAdmin(db, access, {
				status: data?.status || undefined,
				page,
				pageSize,
			}),
			listDeliveriesForAdmin(db, access, { status: "sent", page: 1, pageSize: 1 }),
			listDeliveriesForAdmin(db, access, {
				status: "scheduled",
				page: 1,
				pageSize: 1,
			}),
			listDeliveriesForAdmin(db, access, {
				status: "failed",
				page: 1,
				pageSize: 1,
			}),
		]);

		const orgIds = [...new Set(result.items.map((d) => d.orgId))];
		const policyIds = [...new Set(result.items.map((d) => d.reminderPolicyId))];
		const [orgRows, policyRows] = await Promise.all([
			orgIds.length > 0
				? db
						.select({
							id: organizations.id,
							name: organizations.name,
							kodeSatker: organizations.kodeSatker,
						})
						.from(organizations)
						.where(inArray(organizations.id, orgIds))
				: [],
			policyIds.length > 0
				? db
						.select({
							id: reminderPolicies.id,
							eventType: reminderPolicies.eventType,
							category: reminderPolicies.category,
						})
						.from(reminderPolicies)
						.where(inArray(reminderPolicies.id, policyIds))
				: [],
		]);
		const orgMap = new Map(orgRows.map((o) => [o.id, o]));
		const policyMap = new Map(policyRows.map((p) => [p.id, p]));

		return {
			items: result.items.map((d) => {
				const org = orgMap.get(d.orgId);
				const pol = policyMap.get(d.reminderPolicyId);
				const info = (pol && POLICY_INDICATOR_LABELS[pol.eventType]) ?? {
					label: "Indikator IKPA",
					title: pol?.eventType ?? d.entityType,
				};
				const payload =
					(d.payloadJson as Record<string, unknown> | null) ?? {};
				return {
					id: d.id,
					satkerName: org?.name ?? "-",
					satkerCode: org?.kodeSatker ?? "-",
					eventType: pol?.eventType ?? d.entityType,
					eventTitle: info.title,
					indicatorLabel: info.label,
					category: pol?.category ?? "-",
					ruleSetVersion: d.ruleSetVersion,
					entityType: d.entityType,
					scheduledFor: toIso(d.scheduledFor),
					sentAt: d.sentAt ? toIso(d.sentAt) : null,
					status: d.status,
					attemptCount: d.attemptCount ?? 0,
					errorMessage: d.errorMessage,
					recipientEmail:
						(payload.recipient as string | undefined) ?? undefined,
				};
			}),
			totalItems: result.totalItems,
			page: result.page,
			pageSize: result.pageSize,
			totalPages: result.totalPages,
			stats: {
				total: sentAgg.totalItems + scheduledAgg.totalItems + failedAgg.totalItems,
				sent: sentAgg.totalItems,
				scheduled: scheduledAgg.totalItems,
				failed: failedAgg.totalItems,
			},
		};
	});

export const retryAdminDeliveryFn = createServerFn({ method: "POST" })
	.validator((data: { deliveryId: string }) => data as { deliveryId: string })
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth);

		const db = getDatabase();
		if (!db) {
			throw new Error("Database tidak tersedia.");
		}
		const updated = await retryFailedDelivery(db, access, data.deliveryId, {
			actorId: access.status === "admin" ? access.userId : "admin-kppn",
		});
		return {
			id: updated.id,
			status: updated.status,
			attemptCount: updated.attemptCount,
		};
	});

import { assertAdminKppnScope } from "@simulator-ikpa/access-control";
import type { AccessResolution } from "@simulator-ikpa/contracts";
import type { DbClient } from "@simulator-ikpa/db";
import {
	notificationDeliveries,
	organizations,
} from "@simulator-ikpa/db/schema";
import { eq } from "drizzle-orm";
import { writeAudit } from "../audit/write-audit";

export async function retryFailedDelivery(
	db: DbClient,
	access: AccessResolution,
	deliveryId: string,
	meta: { actorId: string; requestId?: string | null },
) {
	const { allowedKppnScopeIds } = assertAdminKppnScope(access);
	const [del] = await db
		.select()
		.from(notificationDeliveries)
		.where(eq(notificationDeliveries.id, deliveryId))
		.limit(1);
	if (!del) throw new Error("Delivery tidak ditemukan.");
	if (del.status !== "failed")
		throw new Error("Hanya delivery dengan status failed yang dapat di-retry.");
	const [org] = await db
		.select()
		.from(organizations)
		.where(eq(organizations.id, del.orgId))
		.limit(1);
	if (!org || !allowedKppnScopeIds.includes(org.kppnScopeId))
		throw new Error("Delivery di luar scope admin.");

	// derived idempotencyKey with attempt suffix
	const nextAttempt = (del.attemptCount ?? 0) + 1;
	const derivedKey = `${del.idempotencyKey}-retry${nextAttempt}`;

	// confirmation data: keep original payload + attempt trace
	const payload = (del.payloadJson as Record<string, unknown>) ?? {};
	const newPayload = {
		...payload,
		_attemptTrace: [
			...((payload._attemptTrace as unknown[]) ?? []),
			{
				attempt: nextAttempt,
				retriedAt: new Date().toISOString(),
				actorId: meta.actorId,
			},
		],
	};

	const [updated] = await db
		.update(notificationDeliveries)
		.set({
			status: "scheduled" as never,
			attemptCount: nextAttempt as never,
			idempotencyKey: derivedKey as never,
			errorMessage: null as never,
			payloadJson: newPayload as never,
			updatedAt: new Date() as never,
		})
		.where(eq(notificationDeliveries.id, deliveryId))
		.returning();

	await writeAudit(db, {
		actorId: meta.actorId,
		actorAccessType: "admin_kppn",
		entityType: "notification_deliveries",
		entityId: deliveryId,
		action: "retry_delivery",
		beforeJson: del,
		afterJson: updated,
		orgId: del.orgId,
		requestId: meta.requestId ?? null,
	});

	return updated;
}

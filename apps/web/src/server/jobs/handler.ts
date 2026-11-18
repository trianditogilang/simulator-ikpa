import { createHash, timingSafeEqual } from "node:crypto";
import type { DbClient } from "@simulator-ikpa/db";
import { notificationDeliveries } from "@simulator-ikpa/db/schema";
import { and, eq, lte } from "drizzle-orm";
import { sendMail } from "../mailer.server";

type DeliveryErrorCode = string;

class DeliveryError extends Error {
	readonly code: DeliveryErrorCode;
	readonly statusCode: number;

	constructor(code: DeliveryErrorCode, message: string, statusCode = 502) {
		super(message);
		this.name = "DeliveryError";
		this.code = code;
		this.statusCode = statusCode;
	}
}

/**
 * Job endpoints are called by the VPS scheduler with
 * `Authorization: Bearer $JOB_SECRET` (ADR-008, MIG-04). Fails closed when the
 * secret is missing or shorter than 32 characters. Both sides are hashed first
 * so the comparison is constant-time regardless of length.
 */
export function verifyJobSecret(headers: Headers): boolean {
	const secret = process.env.JOB_SECRET?.trim();
	if (!secret || secret.length < 32) return false;
	const given = /^Bearer (.+)$/.exec(headers.get("authorization") ?? "")?.[1];
	if (!given) return false;
	const digest = (value: string) => createHash("sha256").update(value).digest();
	return timingSafeEqual(digest(given), digest(secret));
}

export function rejectUnauthorizedJob(headers: Headers): void {
	if (!verifyJobSecret(headers)) {
		throw new DeliveryError("INVALID_JOB_SECRET", "Invalid job secret.", 401);
	}
}

function newRequestId(): string {
	return (
		"req_" +
		Date.now().toString(36) +
		"_" +
		Math.random().toString(36).slice(2, 8)
	);
}

/**
 * True when SMTP delivery is configured. Production fails closed without it;
 * elsewhere an unconfigured provider keeps the existing no-send behaviour.
 */
function isDeliveryConfigured(): boolean {
	const host = process.env.SMTP_HOST?.trim();
	const from = process.env.NOTIFICATION_SENDER_EMAIL?.trim();
	if (host && from) return true;
	if (process.env.NODE_ENV === "production") {
		throw new DeliveryError(
			"DELIVERY_PROVIDER_UNAVAILABLE",
			"Production notification delivery is not configured.",
			503,
		);
	}
	return false;
}

function asPayload(value: unknown): Record<string, unknown> {
	return value && typeof value === "object"
		? (value as Record<string, unknown>)
		: {};
}

function asString(value: unknown): string | null {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getRecipients(payload: Record<string, unknown>): string[] {
	const raw =
		payload.to ??
		payload.recipient ??
		payload.recipientEmail ??
		payload.recipients;
	const candidates = Array.isArray(raw) ? raw : [raw];
	const valid = candidates
		.map(asString)
		.filter((value): value is string => Boolean(value))
		.filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
	return [...new Set(valid)];
}

function escapeHtml(value: string): string {
	return value.replace(
		/[&<>"']/g,
		(character) =>
			({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&#39;",
			})[character] ?? character,
	);
}

type DeliveryRow = {
	id: string;
	entityType: string;
	scheduledFor: Date | string;
	idempotencyKey: string;
	attemptCount: number;
	payloadJson: unknown;
};

/**
 * Sends one notification over SMTP. SMTP errors are reduced to a fixed code so
 * neither the server reply, the body, nor the recipient list can leak through
 * an upstream route or the delivery row.
 */
export async function sendNotificationEmail(
	row: Pick<DeliveryRow, "entityType" | "scheduledFor" | "payloadJson">,
): Promise<string> {
	const payload = asPayload(row.payloadJson);
	const recipients = getRecipients(payload);
	if (recipients.length === 0) {
		throw new DeliveryError(
			"DELIVERY_RECIPIENT_INVALID",
			"Notification recipient is invalid.",
			422,
		);
	}

	const subject =
		asString(payload.subject) ?? "Pengingat IKPA: " + row.entityType;
	const text =
		asString(payload.text) ??
		asString(payload.message) ??
		"Pengingat " +
			row.entityType +
			" untuk jadwal " +
			new Date(row.scheduledFor).toISOString() +
			".";
	const html = asString(payload.html) ?? "<p>" + escapeHtml(text) + "</p>";

	try {
		return await sendMail({ to: recipients, subject, text, html });
	} catch {
		throw new DeliveryError(
			"SMTP_SEND_FAILED",
			"Notification provider rejected the message.",
			502,
		);
	}
}

function safeDeliveryError(error: unknown): string {
	if (error instanceof DeliveryError) return error.code;
	return "DELIVERY_PROVIDER_ERROR";
}

async function processDueDeliveries(
	db: DbClient,
	batchLimit: number,
): Promise<{ sent: number; failed: number }> {
	const now = new Date();
	const rows = (await db
		.select({
			id: notificationDeliveries.id,
			entityType: notificationDeliveries.entityType,
			scheduledFor: notificationDeliveries.scheduledFor,
			idempotencyKey: notificationDeliveries.idempotencyKey,
			attemptCount: notificationDeliveries.attemptCount,
			payloadJson: notificationDeliveries.payloadJson,
		})
		.from(notificationDeliveries)
		.where(
			and(
				eq(notificationDeliveries.status, "scheduled"),
				lte(notificationDeliveries.scheduledFor, now),
			),
		)
		.limit(Math.max(1, Math.min(batchLimit, 100)))) as DeliveryRow[];

	const configured = isDeliveryConfigured();
	let sent = 0;
	let failed = 0;
	for (const row of rows) {
		// SMTP has no idempotency key, so the claim itself must be exclusive: only
		// the run that still sees the attempt count it read may send this row.
		const [claimed] = await db
			.update(notificationDeliveries)
			.set({
				attemptCount: row.attemptCount + 1,
				updatedAt: now as never,
			})
			.where(
				and(
					eq(notificationDeliveries.id, row.id),
					eq(notificationDeliveries.status, "scheduled"),
					eq(notificationDeliveries.attemptCount, row.attemptCount),
				),
			)
			.returning({
				attemptCount: notificationDeliveries.attemptCount,
			});
		if (!claimed) continue;

		try {
			if (configured) {
				await sendNotificationEmail(row);
			}
			await db
				.update(notificationDeliveries)
				.set({
					status: "sent" as never,
					sentAt: now as never,
					updatedAt: new Date() as never,
					errorMessage: null as never,
				})
				.where(eq(notificationDeliveries.id, row.id));
			sent++;
		} catch (error) {
			await db
				.update(notificationDeliveries)
				.set({
					status: "failed" as never,
					errorMessage: safeDeliveryError(error) as never,
					updatedAt: new Date() as never,
				})
				.where(eq(notificationDeliveries.id, row.id));
			failed++;
		}
	}
	return { sent, failed };
}

export async function handleReminderDaily(
	db: DbClient,
	headers: Headers,
): Promise<{ requestId: string; processed: number }> {
	rejectUnauthorizedJob(headers);
	const requestId = headers.get("x-request-id") ?? newRequestId();
	isDeliveryConfigured();
	const result = await processDueDeliveries(db, 50);
	return { requestId, processed: result.sent + result.failed };
}

export async function handleReminderSend(
	db: DbClient,
	headers: Headers,
	opts?: { batchLimit?: number },
): Promise<{ requestId: string; sent: number; failed: number }> {
	rejectUnauthorizedJob(headers);
	const requestId = headers.get("x-request-id") ?? newRequestId();
	isDeliveryConfigured();
	const result = await processDueDeliveries(db, opts?.batchLimit ?? 20);
	return { requestId, ...result };
}

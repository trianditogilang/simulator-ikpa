import { createHash } from "node:crypto";
import { Receiver } from "@upstash/qstash";
import type { DbClient } from "@simulator-ikpa/db";
import { notificationDeliveries } from "@simulator-ikpa/db/schema";
import { and, eq, lte } from "drizzle-orm";

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

function getQStashSignature(headers: Headers): string | null {
	return (
		headers.get("upstash-signature") ??
		headers.get("x-qstash-signature") ??
		headers.get("Upstash-Signature")
	);
}

function firstHeaderValue(headers: Headers, name: string): string | null {
	return headers.get(name)?.split(",", 1)[0]?.trim() || null;
}

/**
 * Resolve the public URL signed by QStash. APP_URL is authoritative for the
 * deployed app; forwarded headers keep this usable behind a proxy in other
 * environments. The route path and query are always normalized exactly.
 */
export function getPublicQStashUrl(
	request: Request,
	pathname: string,
): string {
	const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
	const appUrl = process.env.APP_URL?.trim();
	const requestUrl = new URL(request.url);

	if (appUrl && process.env.NODE_ENV === "production") {
		try {
			const publicUrl = new URL(appUrl);
			if (publicUrl.protocol === "http:" || publicUrl.protocol === "https:") {
				publicUrl.pathname = normalizedPath;
				publicUrl.search = "";
				publicUrl.hash = "";
				return publicUrl.toString();
			}
		} catch {
			// Fall through to proxy/request URL resolution.
		}
	}

	const forwardedHost = firstHeaderValue(request.headers, "x-forwarded-host");
	const forwardedProto = firstHeaderValue(
		request.headers,
		"x-forwarded-proto",
	);
	if (forwardedHost) {
		const protocol = forwardedProto === "http" ? "http:" : "https:";
		try {
			return new URL(`${protocol}//${forwardedHost}${normalizedPath}`).toString();
		} catch {
			// Fall through to the request URL if forwarded values are malformed.
		}
	}

	requestUrl.pathname = normalizedPath;
	requestUrl.search = "";
	requestUrl.hash = "";
	return requestUrl.toString();
}

/**
 * Verify the raw QStash request with the official Receiver implementation.
 * Callers must pass the untouched body returned by request.text().
 */
export async function verifyQStashSignature(
	headers: Headers,
	rawBody: string,
	requestUrl?: string,
): Promise<boolean> {
	const signature = getQStashSignature(headers);
	if (!signature) return false;

	const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim();
	const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY?.trim();
	if (!currentKey && !nextKey) return false;

	try {
		const receiver = new Receiver({
			currentSigningKey: currentKey,
			nextSigningKey: nextKey,
			devMode: false,
		});
		await receiver.verify({
			body: rawBody,
			signature,
			...(requestUrl ? { url: requestUrl } : {}),
			...(firstHeaderValue(headers, "upstash-region")
				? { upstashRegion: firstHeaderValue(headers, "upstash-region")! }
				: {}),
		});
		return true;
	} catch {
		return false;
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

type ProviderConfig = {
	apiKey: string;
	from: string;
};

function getProviderConfig(): ProviderConfig | null {
	const apiKey = process.env.RESEND_API_KEY?.trim();
	const from = process.env.NOTIFICATION_SENDER_EMAIL?.trim();
	if (apiKey && from) return { apiKey, from };
	if (process.env.NODE_ENV === "production") {
		throw new DeliveryError(
			"DELIVERY_PROVIDER_UNAVAILABLE",
			"Production notification delivery is not configured.",
			503,
		);
	}
	return null;
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
 * Sends one notification through Resend. Provider response bodies are never
 * included in thrown errors so an upstream route cannot leak provider details.
 */
export async function sendNotificationWithResend(
	provider: ProviderConfig,
	row: Pick<
		DeliveryRow,
		"entityType" | "scheduledFor" | "idempotencyKey" | "payloadJson"
	>,
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
	const idempotencyKey =
		row.idempotencyKey.length <= 256
			? row.idempotencyKey
			: createHash("sha256").update(row.idempotencyKey).digest("hex");

	let response: Response;
	try {
		response = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				Authorization: "Bearer " + provider.apiKey,
				"Content-Type": "application/json",
				"Idempotency-Key": idempotencyKey,
			},
			body: JSON.stringify({
				from: provider.from,
				to: recipients,
				subject,
				html,
				text,
			}),
		});
	} catch {
		throw new DeliveryError(
			"RESEND_HTTP_503",
			"Notification provider request failed.",
			502,
		);
	}

	if (!response.ok) {
		throw new DeliveryError(
			"RESEND_HTTP_" + response.status,
			"Notification provider rejected the message.",
			502,
		);
	}

	let responseJson: unknown;
	try {
		responseJson = await response.json();
	} catch {
		throw new DeliveryError(
			"RESEND_INVALID_RESPONSE",
			"Notification provider returned an invalid response.",
			502,
		);
	}
	const providerId =
		responseJson &&
		typeof responseJson === "object" &&
		"id" in responseJson &&
		typeof responseJson.id === "string"
			? responseJson.id
			: null;
	if (!providerId) {
		throw new DeliveryError(
			"RESEND_INVALID_RESPONSE",
			"Notification provider response is missing an id.",
			502,
		);
	}
	return providerId;
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

	const provider = getProviderConfig();
	let sent = 0;
	let failed = 0;
	for (const row of rows) {
		// Resend's idempotency key makes concurrent QStash replays safe.
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
				),
			)
			.returning({
				attemptCount: notificationDeliveries.attemptCount,
			});
		if (!claimed) continue;

		try {
			if (provider) {
				await sendNotificationWithResend(provider, row);
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

export async function handleQStashDaily(
	db: DbClient,
	headers: Headers,
	rawBody: string,
	requestUrl?: string,
): Promise<{ requestId: string; processed: number }> {
	if (!(await verifyQStashSignature(headers, rawBody, requestUrl))) {
		throw new DeliveryError(
			"INVALID_SIGNATURE",
			"Invalid QStash signature.",
			401,
		);
	}
	const requestId = headers.get("x-request-id") ?? newRequestId();
	getProviderConfig();
	const result = await processDueDeliveries(db, 50);
	return { requestId, processed: result.sent + result.failed };
}

export async function handleQStashSend(
	db: DbClient,
	headers: Headers,
	rawBody: string,
	opts?: { batchLimit?: number; requestUrl?: string },
): Promise<{ requestId: string; sent: number; failed: number }> {
	if (!(await verifyQStashSignature(headers, rawBody, opts?.requestUrl))) {
		throw new DeliveryError(
			"INVALID_SIGNATURE",
			"Invalid QStash signature.",
			401,
		);
	}
	const requestId = headers.get("x-request-id") ?? newRequestId();
	getProviderConfig();
	const result = await processDueDeliveries(db, opts?.batchLimit ?? 20);
	return { requestId, ...result };
}

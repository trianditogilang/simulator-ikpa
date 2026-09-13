import { createDbClient } from "@simulator-ikpa/db";
import { users } from "@simulator-ikpa/db/schema";
import { claimPendingAccess, syncClerkUser } from "@simulator-ikpa/access-control";
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";

interface ClerkWebhookEvent {
	type: string;
	data: {
		id: string;
		email_addresses?: Array<{
			email_address: string;
			id: string;
			verification?: { status: string };
		}>;
		first_name?: string;
		last_name?: string;
		primary_email_address_id?: string;
	};
}

function getVerifiedEmail(data: ClerkWebhookEvent["data"]): string | null {
	const primary = data.email_addresses?.find(
		(e) => e.id === data.primary_email_address_id,
	);
	if (primary) return primary.email_address;
	const verified = data.email_addresses?.find(
		(e) => e.verification?.status === "verified",
	);
	if (verified) return verified.email_address;
	return data.email_addresses?.[0]?.email_address ?? null;
}

function verifyClerkWebhook(
	body: string,
	headers: Headers,
): ClerkWebhookEvent | null {
	const secret = process.env.CLERK_WEBHOOK_SECRET;
	if (!secret) return null;

	const svixId = headers.get("svix-id");
	const svixTimestamp = headers.get("svix-timestamp");
	const svixSignature = headers.get("svix-signature");

	if (!svixId || !svixTimestamp || !svixSignature) return null;

	const toSign = `${svixId}.${svixTimestamp}.${body}`;
	const secretBytes = new TextEncoder().encode(secret);
	const messageBytes = new TextEncoder().encode(toSign);

	const hmac = createHmac("sha256", secretBytes);
	hmac.update(messageBytes);
	const expectedSignature = hmac.digest("base64");

	const signatures = svixSignature.split(" ");
	for (const sig of signatures) {
		const [version, signature] = sig.split(",", 2);
		if (version !== "v1") continue;
		const sigBytes = Buffer.from(signature, "base64");
		const expectedBytes = Buffer.from(`v1,${expectedSignature}`);
		if (
			sigBytes.length === expectedBytes.length &&
			timingSafeEqual(sigBytes, expectedBytes)
		) {
			try {
				return JSON.parse(body) as ClerkWebhookEvent;
			} catch {
				return null;
			}
		}
	}

	return null;
}

export const Route = createFileRoute("/api/webhooks/clerk")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const rawBody = await request.text();

				const event = verifyClerkWebhook(rawBody, request.headers);
				if (!event) {
					return new Response(
						JSON.stringify({ code: "INVALID_SIGNATURE" }),
						{ status: 401, headers: { "content-type": "application/json" } },
					);
				}

				const dbUrl = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
				if (!dbUrl) {
					return new Response(
						JSON.stringify({ code: "NO_DB" }),
						{ status: 500, headers: { "content-type": "application/json" } },
					);
				}

		const db = createDbClient(dbUrl);

		try {
			// Clerk deletion payloads do not reliably include an email address.
			// Remove the local identity by the immutable Clerk ID and let the
			// database FKs cascade access-owned rows. This is idempotent so a
			// webhook retry after an admin deletion is safe.
			if (event.type === "user.deleted") {
				const deleted = await db
					.delete(users)
					.where(eq(users.clerkUserId, event.data.id))
					.returning({ id: users.id });
				return new Response(
					JSON.stringify({
						processed: true,
						deletedUsers: deleted.length,
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			}

			const email = getVerifiedEmail(event.data);
					if (!email) {
						return new Response(
							JSON.stringify({ code: "NO_EMAIL", processed: false }),
							{ status: 200, headers: { "content-type": "application/json" } },
						);
					}

					const name = [event.data.first_name, event.data.last_name]
						.filter(Boolean)
						.join(" ")
						.trim();

					if (
						event.type === "user.created" ||
						event.type === "user.updated"
					) {
						// Sync user identity
						await syncClerkUser(db, {
							clerkUserId: event.data.id,
							email,
							name: name || null,
						});

						// Claim any pending access for this email
						const claimed = await claimPendingAccess(db, {
							clerkUserId: event.data.id,
							email,
							name: name || null,
						});

						return new Response(
							JSON.stringify({
								processed: true,
								claimedAccesses: claimed?.claimedAccesses ?? 0,
							}),
							{ status: 200, headers: { "content-type": "application/json" } },
						);
					}

					return new Response(
						JSON.stringify({ processed: false, type: event.type }),
						{ status: 200, headers: { "content-type": "application/json" } },
					);
				} catch (err) {
					const error = err as Error & { statusCode?: number; code?: string };
					console.error("Clerk webhook error:", error.message);
					return new Response(
						JSON.stringify({
							code: error.code ?? "WEBHOOK_ERROR",
							message: error.message.slice(0, 200),
						}),
						{
							status: error.statusCode ?? 500,
							headers: { "content-type": "application/json" },
						},
					);
				}
			},
		},
	},
});

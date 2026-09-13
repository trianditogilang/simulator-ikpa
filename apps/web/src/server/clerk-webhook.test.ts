import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { verifyClerkWebhook } from "../routes/api/webhooks/clerk";

const originalSecrets = {
	legacy: process.env.CLERK_WEBHOOK_SECRET,
	signing: process.env.CLERK_WEBHOOK_SIGNING_SECRET,
};

afterEach(() => {
	if (originalSecrets.legacy === undefined) {
		delete process.env.CLERK_WEBHOOK_SECRET;
	} else {
		process.env.CLERK_WEBHOOK_SECRET = originalSecrets.legacy;
	}
	if (originalSecrets.signing === undefined) {
		delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;
	} else {
		process.env.CLERK_WEBHOOK_SIGNING_SECRET = originalSecrets.signing;
	}
});

function signedHeaders(
	secret: string,
	body: string,
	timestamp = Math.floor(Date.now() / 1000),
): Headers {
	const svixId = "msg_f13_06";
	const svixTimestamp = String(timestamp);
	const signingKey = secret.startsWith("whsec_")
		? Buffer.from(secret.slice("whsec_".length), "base64")
		: Buffer.from(secret, "utf8");
	const signature = createHmac("sha256", signingKey)
		.update(`${svixId}.${svixTimestamp}.${body}`)
		.digest("base64");
	return new Headers({
		"svix-id": svixId,
		"svix-timestamp": svixTimestamp,
		"svix-signature": `v1,${signature}`,
	});
}

describe("Clerk webhook verification", () => {
	it("verifies the exact raw body with a whsec signing secret", () => {
		const body = '{"type":"user.updated", "data":{"id":"user_f13_06"}}\n';
		const signingSecret = `whsec_${Buffer.from("f13-06-signing-key").toString("base64")}`;
		delete process.env.CLERK_WEBHOOK_SECRET;
		process.env.CLERK_WEBHOOK_SIGNING_SECRET = signingSecret;

		const event = verifyClerkWebhook(body, signedHeaders(signingSecret, body));

		expect(event).toMatchObject({
			type: "user.updated",
			data: { id: "user_f13_06" },
		});
	});

	it("rejects a tampered body and stale replay", () => {
		const body = '{"type":"user.created","data":{"id":"user_f13_06"}}';
		const legacySecret = "f13-06-legacy-key";
		delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;
		process.env.CLERK_WEBHOOK_SECRET = legacySecret;
		const headers = signedHeaders(legacySecret, body);

		expect(verifyClerkWebhook(`${body} `, headers)).toBeNull();
		expect(
			verifyClerkWebhook(
				body,
				signedHeaders(legacySecret, body, Math.floor(Date.now() / 1000) - 301),
			),
		).toBeNull();
	});

	it("fails closed when the signing secret or required headers are missing", () => {
		delete process.env.CLERK_WEBHOOK_SECRET;
		delete process.env.CLERK_WEBHOOK_SIGNING_SECRET;
		expect(verifyClerkWebhook("{}", new Headers())).toBeNull();

		process.env.CLERK_WEBHOOK_SECRET = "f13-06-key";
		expect(
			verifyClerkWebhook("{}", new Headers({ "svix-id": "msg_f13_06" })),
		).toBeNull();
	});
});

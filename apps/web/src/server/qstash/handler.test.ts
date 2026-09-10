import { createHash, createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	handleQStashDaily,
	handleQStashSend,
	sendNotificationWithResend,
	verifyQStashSignature,
} from "./handler";
import { handleQStashImport } from "../import/process-job";

const envKeys = [
	"NODE_ENV",
	"QSTASH_CURRENT_SIGNING_KEY",
	"QSTASH_NEXT_SIGNING_KEY",
	"RESEND_API_KEY",
	"NOTIFICATION_SENDER_EMAIL",
] as const;
const originalEnv = Object.fromEntries(
	envKeys.map((key) => [key, process.env[key]]),
);

afterEach(() => {
	for (const key of envKeys) {
		const value = originalEnv[key];
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
	vi.restoreAllMocks();
});

function createQStashJwt(
	key: string,
	url: string,
	body: string,
	overrides: Partial<{ exp: number; nbf: number }> = {},
): string {
	const encode = (value: unknown) =>
		Buffer.from(JSON.stringify(value)).toString("base64url");
	const now = Math.floor(Date.now() / 1000);
	const header = encode({ alg: "HS256", typ: "JWT" });
	const claims = encode({
		iss: "Upstash",
		sub: url,
		exp: overrides.exp ?? now + 60,
		nbf: overrides.nbf ?? now - 1,
		body: createHash("sha256").update(body).digest("base64url"),
	});
	const input = header + "." + claims;
	const signature = createHmac("sha256", key)
		.update(input)
		.digest("base64url");
	return input + "." + signature;
}

function signedHeaders(
	key: string,
	url: string,
	body: string,
): Headers {
	return new Headers({
		"upstash-signature": createQStashJwt(key, url, body),
	});
}

describe("QStash production safeguards", () => {
	it("does not accept an unsigned production request", () => {
		process.env.NODE_ENV = "production";
		delete process.env.QSTASH_CURRENT_SIGNING_KEY;
		delete process.env.QSTASH_NEXT_SIGNING_KEY;

		expect(
			verifyQStashSignature(
				new Headers({ "upstash-signature": "demo-signature" }),
				"{}",
			),
		).toBe(false);
	});

	it("keeps the development signature shortcut for local demo mode", () => {
		process.env.NODE_ENV = "test";
		delete process.env.QSTASH_CURRENT_SIGNING_KEY;
		delete process.env.QSTASH_NEXT_SIGNING_KEY;

		expect(
			verifyQStashSignature(
				new Headers({ "upstash-signature": "demo-signature" }),
				"{}",
			),
		).toBe(true);
	});

	it("validates issuer, URL, expiry, body hash, and key rotation", () => {
		process.env.NODE_ENV = "production";
		process.env.QSTASH_CURRENT_SIGNING_KEY = "current-test-key";
		process.env.QSTASH_NEXT_SIGNING_KEY = "next-test-key";
		const url = "https://example.test/api/qstash/send";
		const body = JSON.stringify({ job: "delivery" });

		expect(
			verifyQStashSignature(
				signedHeaders("current-test-key", url, body),
				body,
				url,
			),
		).toBe(true);
		expect(
			verifyQStashSignature(
				signedHeaders("next-test-key", url, body),
				body,
				url,
			),
		).toBe(true);
		expect(
			verifyQStashSignature(
				signedHeaders("current-test-key", url, body),
				"tampered",
				url,
			),
		).toBe(false);
		expect(
			verifyQStashSignature(
				signedHeaders("current-test-key", url, body),
				body,
				url + "/other",
			),
		).toBe(false);
		expect(
			verifyQStashSignature(
				new Headers({
					"upstash-signature": createQStashJwt(
						"current-test-key",
						url,
						body,
						{ exp: Math.floor(Date.now() / 1000) - 1 },
					),
				}),
				body,
				url,
			),
		).toBe(false);
	});

	it("fails closed when production delivery provider is unavailable", async () => {
		process.env.NODE_ENV = "production";
		delete process.env.RESEND_API_KEY;
		delete process.env.NOTIFICATION_SENDER_EMAIL;
		const body = "{}";
		const url = "https://example.test/api/qstash/send";
		process.env.QSTASH_CURRENT_SIGNING_KEY = "current-test-key";

		await expect(
			handleQStashSend(
				{} as never,
				signedHeaders("current-test-key", url, body),
				body,
				{ requestUrl: url },
			),
		).rejects.toMatchObject({
			code: "DELIVERY_PROVIDER_UNAVAILABLE",
			statusCode: 503,
		});
	});

	it("calls Resend with a safe payload and idempotency key", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ id: "re_test_message" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);
		vi.stubGlobal("fetch", fetchMock);

		const providerId = await sendNotificationWithResend(
			{ apiKey: "test-resend-key", from: "IKPA <noreply@example.test>" },
			{
				entityType: "output_report_due",
				scheduledFor: new Date("2026-09-11T01:00:00.000Z"),
				idempotencyKey: "f13-03-idempotency-001",
				payloadJson: {
					recipient: "delivered@resend.dev",
					subject: "Reminder test",
					text: "A <safe> reminder",
				},
			},
		);

		expect(providerId).toBe("re_test_message");
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [
			string,
			RequestInit,
		];
		expect(requestUrl).toBe("https://api.resend.com/emails");
		expect(requestInit.method).toBe("POST");
		expect(
			new Headers(requestInit.headers).get("Idempotency-Key"),
		).toBe("f13-03-idempotency-001");
		const requestBody = JSON.parse(String(requestInit.body)) as {
			from: string;
			to: string[];
			subject: string;
			html: string;
			text: string;
		};
		expect(requestBody).toMatchObject({
			from: "IKPA <noreply@example.test>",
			to: ["delivered@resend.dev"],
			subject: "Reminder test",
			text: "A <safe> reminder",
		});
		expect(requestBody.html).toContain("&lt;safe&gt;");
	});

	it("never exposes a provider response body in delivery errors", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response("peer-secret-response-body", { status: 401 }),
			),
		);

		await expect(
			sendNotificationWithResend(
				{ apiKey: "test-resend-key", from: "noreply@example.test" },
				{
					entityType: "output_report_due",
					scheduledFor: new Date("2026-09-11T01:00:00.000Z"),
					idempotencyKey: "f13-03-idempotency-002",
					payloadJson: { recipient: "delivered@resend.dev" },
				},
			),
		).rejects.toMatchObject({
			code: "RESEND_HTTP_401",
			statusCode: 502,
			message: "Notification provider rejected the message.",
		});
	});

	it("does not turn a missing production import database into a successful no-op", async () => {
		process.env.NODE_ENV = "production";
		process.env.QSTASH_CURRENT_SIGNING_KEY = "current-test-key";
		const body = "{}";
		const url = "https://example.test/api/jobs/import/process";

		await expect(
			handleQStashImport(
				undefined,
				signedHeaders("current-test-key", url, body),
				body,
				url,
			),
		).rejects.toMatchObject({
			code: "DATABASE_UNAVAILABLE",
			statusCode: 503,
		});
	});

	it("rejects unsigned daily execution before touching delivery data", async () => {
		process.env.NODE_ENV = "production";
		process.env.QSTASH_CURRENT_SIGNING_KEY = "current-test-key";

		await expect(
			handleQStashDaily(
				{} as never,
				new Headers({ "upstash-signature": "not-a-jwt" }),
				"{}",
				"https://example.test/api/qstash/daily",
			),
		).rejects.toMatchObject({ code: "INVALID_SIGNATURE", statusCode: 401 });
	});
});

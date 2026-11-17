import { createHash, createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	handleQStashDaily,
	handleQStashSend,
	getPublicQStashUrl,
	sendNotificationEmail,
	verifyQStashSignature,
} from "./handler";
import { handleQStashImport } from "../import/process-job";
import { sendMail } from "../mailer.server";

vi.mock("../mailer.server", () => ({ sendMail: vi.fn() }));

const envKeys = [
	"NODE_ENV",
	"APP_URL",
	"QSTASH_CURRENT_SIGNING_KEY",
	"QSTASH_NEXT_SIGNING_KEY",
	"SMTP_HOST",
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
	it("does not accept an unsigned production request", async () => {
		process.env.NODE_ENV = "production";
		delete process.env.QSTASH_CURRENT_SIGNING_KEY;
		delete process.env.QSTASH_NEXT_SIGNING_KEY;

		expect(
			await verifyQStashSignature(
				new Headers({ "upstash-signature": "demo-signature" }),
				"{}",
			),
		).toBe(false);
	});

	it("fails closed when signing keys are unavailable", async () => {
		process.env.NODE_ENV = "test";
		delete process.env.QSTASH_CURRENT_SIGNING_KEY;
		delete process.env.QSTASH_NEXT_SIGNING_KEY;

		expect(
			await verifyQStashSignature(
				new Headers({ "upstash-signature": "demo-signature" }),
				"{}",
			),
		).toBe(false);
	});

	it("validates issuer, URL, expiry, raw body hash, and key rotation", async () => {
		process.env.NODE_ENV = "production";
		process.env.QSTASH_CURRENT_SIGNING_KEY = "current-test-key";
		process.env.QSTASH_NEXT_SIGNING_KEY = "next-test-key";
		const url = "https://example.test/api/qstash/send";
		const body = '{ "job": "delivery" }\n';

		expect(
			await verifyQStashSignature(
				signedHeaders("current-test-key", url, body),
				body,
				url,
			),
		).toBe(true);
		expect(
			await verifyQStashSignature(
				signedHeaders("next-test-key", url, body),
				body,
				url,
			),
		).toBe(true);
		expect(
			await verifyQStashSignature(
				signedHeaders("current-test-key", url, body),
				"tampered",
				url,
			),
		).toBe(false);
		expect(
			await verifyQStashSignature(
				signedHeaders("current-test-key", url, body),
				body,
				url + "/other",
			),
		).toBe(false);
		expect(
			await verifyQStashSignature(
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

	it("uses the exact public URL from APP_URL or forwarded headers", () => {
		process.env.NODE_ENV = "production";
		process.env.APP_URL =
			"https://simulator-ikpa-web-git-staging-trianditogilang.vercel.app/";
		const appUrlRequest = new Request(
			"http://internal-host/api/qstash/send?trace=ignored",
		);
		expect(getPublicQStashUrl(appUrlRequest, "/api/qstash/send")).toBe(
			"https://simulator-ikpa-web-git-staging-trianditogilang.vercel.app/api/qstash/send",
		);

		delete process.env.APP_URL;
		process.env.NODE_ENV = "test";
		const forwardedRequest = new Request(
			"http://internal-host/api/qstash/send?trace=ignored",
			{
				headers: {
					"x-forwarded-host": "public.example.test",
					"x-forwarded-proto": "https",
				},
			},
		);
		expect(getPublicQStashUrl(forwardedRequest, "/api/qstash/send")).toBe(
			"https://public.example.test/api/qstash/send",
		);
	});

	it("fails closed when production delivery provider is unavailable", async () => {
		process.env.NODE_ENV = "production";
		delete process.env.SMTP_HOST;
		delete process.env.NOTIFICATION_SENDER_EMAIL;
		const body = "{}";
		const url = "https://example.test/api/qstash/send";
		process.env.QSTASH_CURRENT_SIGNING_KEY = "current-test-key";
		process.env.QSTASH_NEXT_SIGNING_KEY = "next-test-key";

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

	it("sends over SMTP with a safe payload", async () => {
		vi.mocked(sendMail).mockResolvedValue("<smtp-test-message>");

		const providerId = await sendNotificationEmail({
			entityType: "output_report_due",
			scheduledFor: new Date("2026-09-11T01:00:00.000Z"),
			payloadJson: {
				recipient: "delivered@example.test",
				subject: "Reminder test",
				text: "A <safe> reminder",
			},
		});

		expect(providerId).toBe("<smtp-test-message>");
		expect(sendMail).toHaveBeenCalledTimes(1);
		const mail = vi.mocked(sendMail).mock.calls[0][0];
		expect(mail).toMatchObject({
			to: ["delivered@example.test"],
			subject: "Reminder test",
			text: "A <safe> reminder",
		});
		expect(mail.html).toContain("&lt;safe&gt;");
	});

	it("never exposes an SMTP server reply in delivery errors", async () => {
		vi.mocked(sendMail).mockRejectedValue(
			new Error("550 peer-secret-response-body"),
		);

		await expect(
			sendNotificationEmail({
				entityType: "output_report_due",
				scheduledFor: new Date("2026-09-11T01:00:00.000Z"),
				payloadJson: { recipient: "delivered@example.test" },
			}),
		).rejects.toMatchObject({
			code: "SMTP_SEND_FAILED",
			statusCode: 502,
			message: "Notification provider rejected the message.",
		});
	});

	it("does not turn a missing production import database into a successful no-op", async () => {
		process.env.NODE_ENV = "production";
		process.env.QSTASH_CURRENT_SIGNING_KEY = "current-test-key";
		process.env.QSTASH_NEXT_SIGNING_KEY = "next-test-key";
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

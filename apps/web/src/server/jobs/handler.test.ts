import { afterEach, describe, expect, it, vi } from "vitest";
import {
	handleReminderDaily,
	handleReminderSend,
	sendNotificationEmail,
	verifyJobSecret,
} from "./handler";
import { handleImportJob } from "../import/process-job";
import { sendMail } from "../mailer.server";

vi.mock("../mailer.server", () => ({ sendMail: vi.fn() }));

const envKeys = [
	"NODE_ENV",
	"JOB_SECRET",
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

const secret = "job-secret-for-unit-tests-0123456789";

function bearer(value: string): Headers {
	return new Headers({ authorization: "Bearer " + value });
}

describe("Job endpoint safeguards", () => {
	it("fails closed when the job secret is missing or too short", () => {
		delete process.env.JOB_SECRET;
		expect(verifyJobSecret(bearer(secret))).toBe(false);

		process.env.JOB_SECRET = "short-secret";
		expect(verifyJobSecret(bearer("short-secret"))).toBe(false);
	});

	it("accepts only the exact bearer secret", () => {
		process.env.JOB_SECRET = secret;

		expect(verifyJobSecret(bearer(secret))).toBe(true);
		expect(verifyJobSecret(bearer(secret + "x"))).toBe(false);
		expect(verifyJobSecret(bearer(secret.slice(1)))).toBe(false);
		expect(verifyJobSecret(new Headers({ authorization: secret }))).toBe(false);
		expect(verifyJobSecret(new Headers())).toBe(false);
	});

	it("fails closed when production delivery provider is unavailable", async () => {
		process.env.NODE_ENV = "production";
		process.env.JOB_SECRET = secret;
		delete process.env.SMTP_HOST;
		delete process.env.NOTIFICATION_SENDER_EMAIL;

		await expect(
			handleReminderSend({} as never, bearer(secret)),
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
		process.env.JOB_SECRET = secret;

		await expect(
			handleImportJob(undefined, bearer(secret)),
		).rejects.toMatchObject({
			code: "DATABASE_UNAVAILABLE",
			statusCode: 503,
		});
	});

	it("rejects an unauthorized job before touching delivery or import data", async () => {
		process.env.NODE_ENV = "production";
		process.env.JOB_SECRET = secret;

		await expect(
			handleReminderDaily({} as never, bearer("wrong-secret")),
		).rejects.toMatchObject({ code: "INVALID_JOB_SECRET", statusCode: 401 });
		await expect(
			handleReminderSend({} as never, new Headers()),
		).rejects.toMatchObject({ code: "INVALID_JOB_SECRET", statusCode: 401 });
		await expect(
			handleImportJob(undefined, new Headers()),
		).rejects.toMatchObject({ code: "INVALID_JOB_SECRET", statusCode: 401 });
	});
});

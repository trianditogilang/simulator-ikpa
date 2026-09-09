import { afterEach, describe, expect, it } from "vitest";
import { handleQStashDaily, handleQStashSend, verifyQStashSignature } from "./handler";
import { handleQStashImport } from "../import/process-job";

const originalNodeEnv = process.env.NODE_ENV;
const originalCurrentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const originalNextKey = process.env.QSTASH_NEXT_SIGNING_KEY;
const originalResendKey = process.env.RESEND_API_KEY;

afterEach(() => {
	process.env.NODE_ENV = originalNodeEnv;
	process.env.QSTASH_CURRENT_SIGNING_KEY = originalCurrentKey;
	process.env.QSTASH_NEXT_SIGNING_KEY = originalNextKey;
	process.env.RESEND_API_KEY = originalResendKey;
});

describe("QStash production safeguards", () => {
	it("does not accept an unsigned production request", () => {
		process.env.NODE_ENV = "production";
		delete process.env.QSTASH_CURRENT_SIGNING_KEY;
		delete process.env.QSTASH_NEXT_SIGNING_KEY;

		expect(verifyQStashSignature(new Headers({ "upstash-signature": "demo-signature" }), "{}")).toBe(false);
	});

	it("keeps the development signature shortcut for local demo mode", () => {
		process.env.NODE_ENV = "test";
		delete process.env.QSTASH_CURRENT_SIGNING_KEY;
		delete process.env.QSTASH_NEXT_SIGNING_KEY;

		expect(verifyQStashSignature(new Headers({ "upstash-signature": "demo-signature" }), "{}")).toBe(true);
	});

	it("fails closed when production delivery provider is unavailable", async () => {
		process.env.NODE_ENV = "production";
		delete process.env.RESEND_API_KEY;

		await expect(
			handleQStashSend({} as never, new Headers(), "{}"),
		).rejects.toMatchObject({ code: "DELIVERY_PROVIDER_UNAVAILABLE" });
	});

	it("does not report production delivery success when the provider is only configured, not implemented", async () => {
		process.env.NODE_ENV = "production";
		process.env.RESEND_API_KEY = "configured-but-not-used";
		process.env.QSTASH_CURRENT_SIGNING_KEY = "qstash-test-key";

		await expect(
			handleQStashSend(
				{} as never,
				new Headers({ "upstash-signature": "qstash-test-key" }),
				"{}",
			),
		).rejects.toMatchObject({ code: "DELIVERY_PROVIDER_UNAVAILABLE", statusCode: 503 });
		await expect(
			handleQStashDaily(
				{} as never,
				new Headers({ "upstash-signature": "qstash-test-key" }),
				"{}",
			),
		).rejects.toMatchObject({ code: "DELIVERY_PROVIDER_UNAVAILABLE", statusCode: 503 });
	});

	it("does not turn a missing production import database into a successful no-op", async () => {
		process.env.NODE_ENV = "production";
		process.env.QSTASH_CURRENT_SIGNING_KEY = "qstash-test-key";

		await expect(
			handleQStashImport(
				undefined,
				new Headers({ "upstash-signature": "qstash-test-key" }),
				"{}",
			),
		).rejects.toMatchObject({ code: "DATABASE_UNAVAILABLE", statusCode: 503 });
	});
});

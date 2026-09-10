import { afterEach, describe, expect, it } from "vitest";
import { assertProductionFileSignature, failIfProduction } from "./runtime-guards";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
	process.env.NODE_ENV = originalNodeEnv;
});

describe("production runtime guards", () => {
	it("rejects unavailable production dependencies", () => {
		process.env.NODE_ENV = "production";

		expect(() => failIfProduction(true, "dependency missing")).toThrowError(
			/dependency missing/,
		);
	});

	it("keeps demo fallback available outside production", () => {
		process.env.NODE_ENV = "test";

		expect(() => failIfProduction(true, "dependency missing")).not.toThrow();
	});

	it("checks file signatures in production", () => {
		process.env.NODE_ENV = "production";

		expect(() =>
			assertProductionFileSignature(
				new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
				new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
				"XLSX",
			),
		).not.toThrow();
		expect(() =>
			assertProductionFileSignature(
				new Uint8Array([0x74, 0x65, 0x78, 0x74]),
				new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
				"XLSX",
			),
		).toThrow(/invalid file signature/);
	});
});

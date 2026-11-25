import { describe, expect, it } from "vitest";
import { hasLetterAndDigit, KODE_SATKER_PATTERN, maskEmailHint } from "./auth-session";

describe("maskEmailHint", () => {
	it("keeps two letters and the domain, or one for short names", () => {
		expect(maskEmailHint("admin@kemenkeu.go.id")).toBe("ad****@kemenkeu.go.id");
		expect(maskEmailHint("ab@x.id")).toBe("a****@x.id");
	});
});

describe("KODE_SATKER_PATTERN", () => {
	it("accepts exactly six digits, so a code that lost its leading zero is refused", () => {
		expect(KODE_SATKER_PATTERN.test("012345")).toBe(true);
		for (const kode of ["12345", "4111012342", "41178A", " 411782"]) {
			expect(KODE_SATKER_PATTERN.test(kode)).toBe(false);
		}
	});
});

describe("hasLetterAndDigit", () => {
	it("accepts a password with letters and digits", () => {
		expect(hasLetterAndDigit("rahasia2026")).toBe(true);
		expect(hasLetterAndDigit("2026-Rahasia!")).toBe(true);
	});

	it("rejects letters only, digits only, and symbols only", () => {
		expect(hasLetterAndDigit("rahasiaaja")).toBe(false);
		expect(hasLetterAndDigit("1234567890")).toBe(false);
		expect(hasLetterAndDigit("!@#$%^&*()")).toBe(false);
	});
});

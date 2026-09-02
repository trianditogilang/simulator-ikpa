import { describe, expect, it } from "vitest";
import {
	NoRuleSetError,
	OverlapError,
	resolveRuleSet,
	validateNoOverlap,
} from "./rule-set-resolver";

const rs2026_1 = {
	id: "1",
	year: 2026,
	version: "2026.1",
	effectiveFrom: "2026-01-01T00:00:00Z",
	status: "published" as const,
};
const rs2026_2 = {
	id: "2",
	year: 2026,
	version: "2026.2",
	effectiveFrom: "2026-07-01T00:00:00Z",
	status: "published" as const,
};
const rsRetired = {
	id: "3",
	year: 2025,
	version: "2025.1",
	effectiveFrom: "2025-01-01T00:00:00Z",
	status: "retired" as const,
};

describe("rule-set-resolver", () => {
	it("resolves by year/effective date latest <= target", () => {
		expect(
			resolveRuleSet([rs2026_1, rs2026_2], 2026, "2026-03-01").version,
		).toBe("2026.1");
		expect(
			resolveRuleSet([rs2026_1, rs2026_2], 2026, "2026-08-01").version,
		).toBe("2026.2");
	});
	it("retired fallback when no published", () => {
		expect(resolveRuleSet([rsRetired], 2025, "2025-06-01").version).toBe(
			"2025.1",
		);
	});
	it("throws NoRuleSetError if none", () => {
		expect(() => resolveRuleSet([rs2026_1], 2026, "2025-12-31")).toThrow(
			NoRuleSetError,
		);
	});
	it("rejects overlap same effectiveFrom", () => {
		const dup = {
			id: "4",
			year: 2026,
			version: "2026.3",
			effectiveFrom: "2026-01-01T00:00:00Z",
			status: "published" as const,
		};
		expect(() => validateNoOverlap([rs2026_1, dup])).toThrow(OverlapError);
	});
	it("allows sequential without overlap", () => {
		expect(() => validateNoOverlap([rs2026_1, rs2026_2])).not.toThrow();
	});
});

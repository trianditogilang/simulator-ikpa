import { expect, test } from "vitest";
import { default2026RuleSet } from "../rule-set";
import type { DipaRevisionInput } from "../types";
import { calculateDipaRevision } from "./dipa-revision";

test("DIPA Revision golden test (S1=2, S2=3 → 75)", () => {
	const input: DipaRevisionInput = {
		semester1Revisions: 2, // score 100
		semester2Revisions: 3, // score 50
		hasBudgetChange: [],
	};

	const result = calculateDipaRevision(input, default2026RuleSet);

	expect(result.status).toBe("complete");
	expect(result.score).toBe("75");
	expect(result.formulaTrace).toHaveLength(4);
});

test("DIPA Revision golden test (S1=1, S2=3 → 80)", () => {
	const input: DipaRevisionInput = {
		semester1Revisions: 1, // score 110
		semester2Revisions: 3, // score 50
		hasBudgetChange: [],
	};

	const result = calculateDipaRevision(input, default2026RuleSet);

	expect(result.status).toBe("complete");
	expect(result.score).toBe("80");
});

test("DIPA Revision capped at 100 (S1=0, S2=0 → 100)", () => {
	const input: DipaRevisionInput = {
		semester1Revisions: 0, // score 110
		semester2Revisions: 0, // score 110
		hasBudgetChange: [],
	};

	const result = calculateDipaRevision(input, default2026RuleSet);

	expect(result.status).toBe("complete");
	expect(result.score).toBe("100");
});

test("DIPA Revision incomplete", () => {
	const input = {
		semester2Revisions: 3,
		hasBudgetChange: [],
	} as unknown as DipaRevisionInput;

	const result = calculateDipaRevision(input, default2026RuleSet);
	expect(result.status).toBe("incomplete");
});

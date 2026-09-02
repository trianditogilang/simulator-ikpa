import { expect, test } from "vitest";
import { default2026RuleSet } from "../rule-set";
import type { DipaRevisionInput } from "../types";
import { calculateDipaRevision } from "./dipa-revision";

test("DIPA Revision golden test", () => {
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

test("DIPA Revision incomplete", () => {
	const input = {
		semester2Revisions: 3,
		hasBudgetChange: [],
	} as unknown as DipaRevisionInput;

	const result = calculateDipaRevision(input, default2026RuleSet);
	expect(result.status).toBe("incomplete");
});

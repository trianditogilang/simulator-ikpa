export interface RuleSetRow {
	id: string;
	year: number;
	version: string;
	effectiveFrom: string | Date;
	status: "draft" | "published" | "retired";
}

export class NoRuleSetError extends Error {
	readonly code = "NO_RULE_SET";
	constructor(year: number, date: string) {
		super(`Tidak ada rule set aktif untuk tahun ${year} pada tanggal ${date}`);
		this.name = "NoRuleSetError";
	}
}
export class OverlapError extends Error {
	readonly code = "OVERLAP";
	constructor(msg: string) {
		super(msg);
		this.name = "OverlapError";
	}
}

function toDate(d: string | Date): Date {
	return d instanceof Date ? d : new Date(d);
}

export function resolveRuleSet(
	rows: RuleSetRow[],
	year: number,
	onDate: string | Date,
): RuleSetRow {
	const target = toDate(onDate);
	const candidates = rows
		.filter((r) => r.year === year && r.status === "published")
		.filter((r) => toDate(r.effectiveFrom) <= target)
		.sort(
			(a, b) =>
				toDate(b.effectiveFrom).getTime() - toDate(a.effectiveFrom).getTime(),
		);

	if (candidates.length > 0) return candidates[0];

	// retired fallback: latest retired with effective <= target
	const retired = rows
		.filter((r) => r.year === year && r.status === "retired")
		.filter((r) => toDate(r.effectiveFrom) <= target)
		.sort(
			(a, b) =>
				toDate(b.effectiveFrom).getTime() - toDate(a.effectiveFrom).getTime(),
		);
	if (retired.length > 0) return retired[0];

	throw new NoRuleSetError(year, target.toISOString().slice(0, 10));
}

export function validateNoOverlap(rows: RuleSetRow[]): void {
	// overlap if same year has two published with same effectiveFrom
	const byYear = new Map<number, RuleSetRow[]>();
	for (const r of rows) {
		if (r.status === "draft") continue;
		if (!byYear.has(r.year)) byYear.set(r.year, []);
		byYear.get(r.year)!.push(r);
	}
	for (const [year, list] of byYear) {
		const sorted = [...list].sort(
			(a, b) =>
				toDate(a.effectiveFrom).getTime() - toDate(b.effectiveFrom).getTime(),
		);
		for (let i = 0; i < sorted.length - 1; i++) {
			const a = sorted[i];
			const b = sorted[i + 1];
			if (
				toDate(a.effectiveFrom).getTime() === toDate(b.effectiveFrom).getTime()
			) {
				throw new OverlapError(
					`Overlap rule set tahun ${year}: ${a.version} dan ${b.version} memiliki effectiveFrom sama ${toDate(a.effectiveFrom).toISOString()}`,
				);
			}
			// if both published, effective ranges overlap? since published are immutable, any two published for same year should be sequential without overlap, but effectiveFrom equality already covers. We treat non-equal as sequential valid.
		}
	}
}

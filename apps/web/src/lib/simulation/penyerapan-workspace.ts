import {
	calculateAbsorption,
	default2026RuleSet,
	type AbsorptionQuarter,
	type AccountType,
	type RuleSetConfig,
} from "@simulator-ikpa/ikpa-engine";

export const PENYERAPAN_ACCOUNTS = ["51", "52", "53", "57"] as const;

export type PenyerapanAccount = (typeof PENYERAPAN_ACCOUNTS)[number];

export type MonthlyAmounts = Partial<
	Record<number, Partial<Record<PenyerapanAccount, number>>>
>;

export type PaguMap = Partial<Record<PenyerapanAccount, number>>;

export function quarterOfMonth(month: number): 1 | 2 | 3 | 4 {
	const m = Number.isFinite(month) ? Math.floor(month) : 1;
	const clamped = Math.min(Math.max(m, 1), 12);
	return Math.ceil(clamped / 3) as 1 | 2 | 3 | 4;
}

export const QUARTER_MONTHS: Record<
	1 | 2 | 3 | 4,
	readonly [number, number, number]
> = {
	1: [1, 2, 3],
	2: [4, 5, 6],
	3: [7, 8, 9],
	4: [10, 11, 12],
};

function decimalString(value: number | undefined): string {
	const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
	return n.toFixed(2);
}

export function buildAbsorptionQuarters(
	pagu: PaguMap,
	actual: MonthlyAmounts,
	plan: MonthlyAmounts,
	currentMonth: number,
): AbsorptionQuarter[] {
	const cur = Number.isFinite(currentMonth)
		? Math.min(Math.max(Math.floor(currentMonth), 1), 12)
		: 12;
	return ([1, 2, 3, 4] as const).map((q) => {
		const realized = {} as Record<AccountType, string>;
		const budget = {} as Record<AccountType, string>;
		for (const acc of PENYERAPAN_ACCOUNTS) {
			budget[acc] = decimalString(pagu[acc]);
			let sum = 0;
			for (const m of QUARTER_MONTHS[q]) {
				const source = m <= cur ? actual : plan;
				const v = source[m]?.[acc];
				if (typeof v === "number" && Number.isFinite(v)) sum += v;
			}
			realized[acc] = decimalString(sum);
		}
		return { quarter: q, realized, budget };
	});
}

export interface PenyerapanScore {
	score: number | null;
	contribution: number | null;
	status: string;
}

export function calcPenyerapanScore(
	quarters: AbsorptionQuarter[],
	isBlu: boolean,
	config: RuleSetConfig = default2026RuleSet,
): PenyerapanScore {
	const result = calculateAbsorption({ quarters }, isBlu, config);
	const score = Number(result.score);
	const contribution = Number(result.weightedContribution);
	return {
		score: Number.isFinite(score) ? score : null,
		contribution: Number.isFinite(contribution) ? contribution : null,
		status: result.status,
	};
}

export function accountQuarterScore(
	realized: number,
	budget: number,
	target: number,
): number {
	if (!(budget > 0) || !(target > 0) || !(realized > 0)) return 0;
	return Math.min(100, (((realized / budget) * 100) / target) * 100);
}

export function quarterTarget(
	config: RuleSetConfig,
	account: PenyerapanAccount,
	quarter: 1 | 2 | 3 | 4,
): number {
	const raw = Number(config.absorptionTargets[account][String(quarter)]);
	return Number.isFinite(raw) ? raw : 0;
}

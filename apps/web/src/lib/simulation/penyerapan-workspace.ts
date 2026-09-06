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
export type QuarterPaguMap = Partial<Record<1 | 2 | 3 | 4, PaguMap>>;

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

export function resolveQuarterlyPaguMap(
	budgets: Array<{ accountCode: string; amount: string; effectiveAt?: string }>,
	year = 2026,
): QuarterPaguMap {
	const cutoffs: Record<1 | 2 | 3 | 4, string> = {
		1: `${year}-02-15`,
		2: `${year}-04-15`,
		3: `${year}-07-15`,
		4: `${year}-12-31`,
	};

	const result: QuarterPaguMap = { 1: {}, 2: {}, 3: {}, 4: {} };

	for (const q of [1, 2, 3, 4] as const) {
		const cutoffDate = cutoffs[q];
		const map: PaguMap = {};
		for (const acc of PENYERAPAN_ACCOUNTS) {
			const matching = budgets
				.filter((b) => b.accountCode === acc)
				.filter((b) => !b.effectiveAt || b.effectiveAt <= cutoffDate)
				.sort((a, b) => (b.effectiveAt ?? "").localeCompare(a.effectiveAt ?? ""));

			if (matching.length > 0) {
				const val = Number(matching[0].amount);
				if (Number.isFinite(val)) map[acc] = val;
			} else {
				// Fallback to any budget row for this account
				const fallback = budgets.find((b) => b.accountCode === acc);
				if (fallback) {
					const val = Number(fallback.amount);
					if (Number.isFinite(val)) map[acc] = val;
				}
			}
		}
		result[q] = map;
	}

	return result;
}

function resolveQuarterPagu(
	paguInput: PaguMap | QuarterPaguMap,
	quarter: 1 | 2 | 3 | 4,
	account: PenyerapanAccount,
): number {
	if (!paguInput) return 0;
	if (
		"1" in paguInput ||
		"2" in paguInput ||
		"3" in paguInput ||
		"4" in paguInput ||
		1 in paguInput ||
		2 in paguInput ||
		3 in paguInput ||
		4 in paguInput
	) {
		const qMap = paguInput as QuarterPaguMap;
		const qPagu = qMap[quarter]?.[account];
		if (typeof qPagu === "number" && Number.isFinite(qPagu)) return qPagu;
	}
	const flatMap = paguInput as PaguMap;
	const val = flatMap[account];
	return typeof val === "number" && Number.isFinite(val) ? val : 0;
}

/**
 * Builds AbsorptionQuarter[] up to maxQuarter.
 * IMPORTANT: Realization is CUMULATIVE from Month 1 through the end of quarter q (months 1 .. q*3).
 */
export function buildAbsorptionQuarters(
	pagu: PaguMap | QuarterPaguMap,
	actual: MonthlyAmounts,
	plan: MonthlyAmounts,
	currentMonth: number,
	maxQuarter?: number,
): AbsorptionQuarter[] {
	const cur = Number.isFinite(currentMonth)
		? Math.min(Math.max(Math.floor(currentMonth), 1), 12)
		: 12;

	let targetMaxQuarter =
		typeof maxQuarter === "number" && maxQuarter >= 1 && maxQuarter <= 4
			? maxQuarter
			: quarterOfMonth(cur);

	if (maxQuarter === undefined) {
		for (let m = cur + 1; m <= 12; m++) {
			const mPlan = plan[m];
			if (mPlan && Object.values(mPlan).some((v) => typeof v === "number" && v > 0)) {
				const q = quarterOfMonth(m);
				if (q > targetMaxQuarter) {
					targetMaxQuarter = q;
				}
			}
		}
	}

	const quarterList: (1 | 2 | 3 | 4)[] = [];
	for (let q = 1; q <= targetMaxQuarter; q++) {
		quarterList.push(q as 1 | 2 | 3 | 4);
	}

	return quarterList.map((q) => {
		const realized = {} as Record<AccountType, string>;
		const budget = {} as Record<AccountType, string>;
		const endMonth = q * 3; // Cumulative up to end of quarter q

		for (const acc of PENYERAPAN_ACCOUNTS) {
			const budgetAmount = resolveQuarterPagu(pagu, q, acc);
			budget[acc] = decimalString(budgetAmount);

			let sum = 0;
			for (let m = 1; m <= endMonth; m++) {
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
	realizedCumulative: number,
	budget: number,
	targetPercent: number,
): number {
	if (!(budget > 0) || !(targetPercent > 0) || !(realizedCumulative > 0)) return 0;
	const targetRp = budget * (targetPercent / 100);
	if (targetRp <= 0) return 0;
	const score = (realizedCumulative / targetRp) * 100;
	return Math.min(100, score);
}

export function quarterTarget(
	config: RuleSetConfig,
	account: PenyerapanAccount,
	quarter: 1 | 2 | 3 | 4,
): number {
	const raw = Number(config.absorptionTargets[account][String(quarter)]);
	return Number.isFinite(raw) ? raw : 0;
}

export interface QuarterAccountDetail {
	acc: PenyerapanAccount;
	pagu: number;
	realizedCumulative: number;
	targetPercent: number;
	targetRp: number;
	penyerapanVsTarget: number; // Max 100
	proporsiPagu: number; // in fraction 0..1 (e.g. 0.5)
	nilaiTertimbang: number; // penyerapanVsTarget * proporsiPagu
	sisaKebutuhan: number; // Math.max(0, targetRp - realizedCumulative)
}

export interface QuarterCalculationResult {
	quarter: 1 | 2 | 3 | 4;
	rows: QuarterAccountDetail[];
	totalPagu: number;
	totalRealized: number;
	totalTargetRp: number;
	nilaiKinerjaQuarter: number;
}

export function calcQuarterDetails(
	quarter: 1 | 2 | 3 | 4,
	pagu: PaguMap | QuarterPaguMap,
	actual: MonthlyAmounts,
	plan: MonthlyAmounts,
	currentMonth: number,
	config: RuleSetConfig = default2026RuleSet,
): QuarterCalculationResult {
	const cur = Number.isFinite(currentMonth)
		? Math.min(Math.max(Math.floor(currentMonth), 1), 12)
		: 12;
	const endMonth = quarter * 3;

	// Calculate total pagu for evaluated accounts (where pagu > 0)
	let totalPagu = 0;
	for (const acc of PENYERAPAN_ACCOUNTS) {
		const budget = resolveQuarterPagu(pagu, quarter, acc);
		if (budget > 0) {
			totalPagu += budget;
		}
	}

	let totalRealized = 0;
	let totalTargetRp = 0;
	let totalWeighted = 0;

	const rows: QuarterAccountDetail[] = PENYERAPAN_ACCOUNTS.map((acc) => {
		const budget = resolveQuarterPagu(pagu, quarter, acc);
		let realizedSum = 0;
		for (let m = 1; m <= endMonth; m++) {
			const source = m <= cur ? actual : plan;
			const v = source[m]?.[acc];
			if (typeof v === "number" && Number.isFinite(v)) {
				realizedSum += v;
			}
		}

		const targetPercent = quarterTarget(config, acc, quarter);
		const targetRp = budget > 0 ? budget * (targetPercent / 100) : 0;
		const pa = accountQuarterScore(realizedSum, budget, targetPercent);
		const proporsi = totalPagu > 0 && budget > 0 ? budget / totalPagu : 0;
		const weighted = pa * proporsi;
		const sisa = Math.max(0, targetRp - realizedSum);

		if (budget > 0) {
			totalRealized += realizedSum;
			totalTargetRp += targetRp;
			totalWeighted += weighted;
		}

		return {
			acc,
			pagu: budget,
			realizedCumulative: realizedSum,
			targetPercent,
			targetRp,
			penyerapanVsTarget: pa,
			proporsiPagu: proporsi,
			nilaiTertimbang: weighted,
			sisaKebutuhan: sisa,
		};
	});

	return {
		quarter,
		rows,
		totalPagu,
		totalRealized,
		totalTargetRp,
		nilaiKinerjaQuarter: totalWeighted,
	};
}


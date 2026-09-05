import {
	calculateRpdDeviation,
	default2026RuleSet,
	type AccountType,
	type RpdDeviationInput,
	type RuleSetConfig,
} from "@simulator-ikpa/ikpa-engine";

export const DEVIASI_ACCOUNTS = ["51", "52", "53", "57"] as const;

export type DeviasiAccount = (typeof DEVIASI_ACCOUNTS)[number];

export type MonthlyAmounts = Partial<
	Record<number, Partial<Record<DeviasiAccount, number>>>
>;

export type PaguMap = Partial<Record<DeviasiAccount, number>>;

function decimalString(value: number | undefined): string {
	const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
	return n.toFixed(2);
}

export function buildDeviationInput(
	pagu: PaguMap,
	rpd: MonthlyAmounts,
	actual: MonthlyAmounts,
	planRpd: MonthlyAmounts,
	planReal: MonthlyAmounts,
	currentMonth: number,
): RpdDeviationInput {
	const cur = Number.isFinite(currentMonth)
		? Math.min(Math.max(Math.floor(currentMonth), 1), 12)
		: 12;
	const budgetByType = {} as Record<AccountType, string>;
	for (const acc of DEVIASI_ACCOUNTS) {
		budgetByType[acc] = decimalString(pagu[acc]);
	}
	const months = [];
	for (let m = 1; m <= 11; m++) {
		const planned = {} as Record<AccountType, string>;
		const realized = {} as Record<AccountType, string>;
		for (const acc of DEVIASI_ACCOUNTS) {
			const rpdSrc = m <= cur ? rpd : planRpd;
			const realSrc = m <= cur ? actual : planReal;
			planned[acc] = decimalString(rpdSrc[m]?.[acc]);
			realized[acc] = decimalString(realSrc[m]?.[acc]);
		}
		months.push({ month: m, planned, realized });
	}
	return { months, budgetByType };
}

export interface DeviasiScore {
	score: number | null;
	contribution: number | null;
	avgDeviation: number | null;
	status: string;
}

export function calcDeviasiScore(
	input: RpdDeviationInput,
	config: RuleSetConfig = default2026RuleSet,
): DeviasiScore {
	const result = calculateRpdDeviation(input, config);
	const score = Number(result.score);
	const contribution = Number(result.weightedContribution);
	const trace = result.formulaTrace.find((s) => s.label === "Rata-rata Deviasi");
	const avg = trace ? Number(trace.result) : null;
	return {
		score: Number.isFinite(score) ? score : null,
		contribution: Number.isFinite(contribution) ? contribution : null,
		avgDeviation: typeof avg === "number" && Number.isFinite(avg) ? avg : null,
		status: result.status,
	};
}

export function deviationOf(planned: number, realized: number): number {
	if (!(planned > 0)) return realized > 0 ? 100 : 0;
	return Math.min(100, (Math.abs(planned - realized) / planned) * 100);
}

export function paguWeights(pagu: PaguMap): Record<DeviasiAccount, number> {
	let total = 0;
	for (const acc of DEVIASI_ACCOUNTS) total += pagu[acc] ?? 0;
	const w = {} as Record<DeviasiAccount, number>;
	for (const acc of DEVIASI_ACCOUNTS) {
		w[acc] = total > 0 ? (pagu[acc] ?? 0) / total : 0;
	}
	return w;
}

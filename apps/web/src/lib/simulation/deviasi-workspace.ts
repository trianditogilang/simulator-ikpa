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

/**
 * Pure function to calculate deviation for a single account:
 * - planned = 0, realized = 0 => 0%
 * - planned = 0, realized > 0 => 100% (cap)
 * - planned > 0 => |realized - planned| / planned * 100 (cap 100%)
 */
export function deviationOf(planned: number, realized: number): number {
	if (!(planned > 0)) return realized > 0 ? 100 : 0;
	return Math.min(100, (Math.abs(planned - realized) / planned) * 100);
}

/**
 * Calculates the proportion of each budget type relative to the total budget (51+52+53+57).
 */
export function paguWeights(pagu: PaguMap): Record<DeviasiAccount, number> {
	let total = 0;
	for (const acc of DEVIASI_ACCOUNTS) total += pagu[acc] ?? 0;
	const w = {} as Record<DeviasiAccount, number>;
	for (const acc of DEVIASI_ACCOUNTS) {
		w[acc] = total > 0 ? (pagu[acc] ?? 0) / total : 0;
	}
	return w;
}

/**
 * Calculates detailed deviations and weighted deviations for a specific month.
 */
export function calcMonthDeviation(
	rpd: Partial<Record<DeviasiAccount, number>> = {},
	real: Partial<Record<DeviasiAccount, number>> = {},
	pagu: PaguMap = {},
): {
	accountDeviations: Record<DeviasiAccount, number>;
	accountWeightedDeviations: Record<DeviasiAccount, number>;
	monthWeightedDeviation: number;
	totalRpd: number;
	totalReal: number;
	hasData: boolean;
} {
	const weights = paguWeights(pagu);
	const accountDeviations = {} as Record<DeviasiAccount, number>;
	const accountWeightedDeviations = {} as Record<DeviasiAccount, number>;
	let monthWeightedDeviation = 0;
	let totalRpd = 0;
	let totalReal = 0;
	let hasData = false;

	for (const acc of DEVIASI_ACCOUNTS) {
		const planned = rpd[acc] ?? 0;
		const realized = real[acc] ?? 0;
		if (planned > 0 || realized > 0) hasData = true;
		totalRpd += planned;
		totalReal += realized;

		const dev = deviationOf(planned, realized);
		const weighted = dev * (weights[acc] ?? 0);
		accountDeviations[acc] = dev;
		accountWeightedDeviations[acc] = weighted;
		monthWeightedDeviation += weighted;
	}

	return {
		accountDeviations,
		accountWeightedDeviations,
		monthWeightedDeviation,
		totalRpd,
		totalReal,
		hasData,
	};
}

/**
 * Builds engine input for RPD deviation:
 * - Evaluates months 1..endMonth (divisor n is dynamic, max 11, December excluded).
 * - If evalMonths is provided, evaluates precisely 1..evalMonths.
 * - Otherwise, automatically includes months 1..currentMonth plus any future plan months with data.
 */
export function buildDeviationInput(
	pagu: PaguMap,
	rpd: MonthlyAmounts,
	actual: MonthlyAmounts,
	planRpd: MonthlyAmounts = {},
	planReal: MonthlyAmounts = {},
	currentMonth: number = 1,
	evalMonths?: number,
): RpdDeviationInput {
	const cur = Number.isFinite(currentMonth)
		? Math.min(Math.max(Math.floor(currentMonth), 1), 11)
		: 1;

	let endMonth = cur;
	if (typeof evalMonths === "number" && Number.isFinite(evalMonths)) {
		endMonth = Math.min(Math.max(Math.floor(evalMonths), 1), 11);
	} else {
		// check if plan has entries beyond cur
		for (let m = cur + 1; m <= 11; m++) {
			const hasRpd = DEVIASI_ACCOUNTS.some((a) => (planRpd[m]?.[a] ?? 0) > 0);
			const hasReal = DEVIASI_ACCOUNTS.some((a) => (planReal[m]?.[a] ?? 0) > 0);
			if (hasRpd || hasReal) {
				endMonth = m;
			}
		}
	}

	const budgetByType = {} as Record<AccountType, string>;
	for (const acc of DEVIASI_ACCOUNTS) {
		budgetByType[acc] = decimalString(pagu[acc]);
	}

	const months = [];
	for (let m = 1; m <= endMonth; m++) {
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
	monthsCount: number;
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
	const monthsCount = input.months ? input.months.length : 0;
	return {
		score: Number.isFinite(score) ? score : null,
		contribution: Number.isFinite(contribution) ? contribution : null,
		avgDeviation: typeof avg === "number" && Number.isFinite(avg) ? avg : null,
		monthsCount,
		status: result.status,
	};
}

export interface MonthTraceRow {
	month: number;
	rpd: Record<DeviasiAccount, number>;
	realized: Record<DeviasiAccount, number>;
	accountDeviations: Record<DeviasiAccount, number>;
	accountWeightedDeviations: Record<DeviasiAccount, number>;
	monthWeightedDev: number;
	cumulativeSum: number;
	cumulativeAvg: number;
	cumulativeScore: number;
	status: "safe" | "warning" | "danger";
}

/**
 * Computes step-by-step month-by-month calculation trace for training / audit transparency.
 */
export function calculateHistoricalTrail(
	pagu: PaguMap,
	rpd: MonthlyAmounts,
	actual: MonthlyAmounts,
	endMonth: number,
): MonthTraceRow[] {
	const last = Math.min(Math.max(endMonth, 1), 11);
	const weights = paguWeights(pagu);
	const rows: MonthTraceRow[] = [];
	let cumulativeSum = 0;

	for (let m = 1; m <= last; m++) {
		const monthRpd = {} as Record<DeviasiAccount, number>;
		const monthReal = {} as Record<DeviasiAccount, number>;
		const accountDeviations = {} as Record<DeviasiAccount, number>;
		const accountWeightedDeviations = {} as Record<DeviasiAccount, number>;
		let monthWeightedDev = 0;

		for (const acc of DEVIASI_ACCOUNTS) {
			const p = rpd[m]?.[acc] ?? 0;
			const r = actual[m]?.[acc] ?? 0;
			monthRpd[acc] = p;
			monthReal[acc] = r;

			const dev = deviationOf(p, r);
			const weighted = dev * (weights[acc] ?? 0);
			accountDeviations[acc] = dev;
			accountWeightedDeviations[acc] = weighted;
			monthWeightedDev += weighted;
		}

		cumulativeSum += monthWeightedDev;
		const cumulativeAvg = cumulativeSum / m;
		const cumulativeScore =
			cumulativeAvg <= 5 ? 100 : Math.max(0, 100 - cumulativeAvg);

		let status: "safe" | "warning" | "danger" = "safe";
		if (cumulativeAvg > 10) status = "danger";
		else if (cumulativeAvg > 5) status = "warning";

		rows.push({
			month: m,
			rpd: monthRpd,
			realized: monthReal,
			accountDeviations,
			accountWeightedDeviations,
			monthWeightedDev,
			cumulativeSum,
			cumulativeAvg,
			cumulativeScore,
			status,
		});
	}

	return rows;
}

export interface TargetAnalysis {
	currentAvg: number;
	currentN: number;
	targetMonth: number;
	remainingMonths: number;
	maxSumAllowed: number;
	currentSum: number;
	remainingAllowance: number;
	targetPerMonth: number;
	isReachable: boolean;
	bestPossibleAvg: number;
	bestPossibleScore: number;
	message: string;
}

/**
 * Calculates target deviation for next month or target month to keep or recover average <= 5.0%.
 */
export function calcNextMonthTarget(
	currentAvg: number,
	currentN: number,
	targetMonth?: number,
): TargetAnalysis {
	const n = Math.min(Math.max(currentN, 1), 11);
	const target = targetMonth
		? Math.min(Math.max(targetMonth, n + 1), 11)
		: Math.min(n + 1, 11);

	const remainingMonths = Math.max(1, target - n);
	const currentSum = currentAvg * n;
	const maxSumAllowed = 5.0 * target;
	const remainingAllowance = maxSumAllowed - currentSum;
	const targetPerMonth = remainingAllowance / remainingMonths;
	const isReachable = remainingAllowance >= 0 && targetPerMonth <= 100;

	const bestPossibleSum = currentSum; // if 0% deviation in all remaining months
	const bestPossibleAvg = bestPossibleSum / target;
	const bestPossibleScore =
		bestPossibleAvg <= 5 ? 100 : Math.max(0, 100 - bestPossibleAvg);

	let message = "";
	if (n >= 11) {
		message = `Periode penilaian selesai (${n} bulan). Nilai akhir Deviasi Hal III adalah ${
			currentAvg <= 5 ? "100" : (100 - currentAvg).toFixed(2)
		} (rata-rata ${currentAvg.toFixed(2)}%).`;
	} else if (isReachable) {
		if (remainingMonths === 1) {
			message = `Rata-rata saat ini ${currentAvg.toFixed(2)}% (n=${n}). Agar nilai tetap 100 di bulan depan (n=${target}), deviasi tertimbang bulan depan maksimal ${targetPerMonth.toFixed(2)}%.`;
		} else {
			message = `Rata-rata saat ini ${currentAvg.toFixed(2)}% (n=${n}). Agar nilai kembali 100 di bulan ke-${target} (n=${target}), rata-rata deviasi ${remainingMonths} bulan ke depan maksimal ${targetPerMonth.toFixed(2)}% per bulan.`;
		}
	} else {
		if (remainingMonths === 1) {
			message = `Rata-rata saat ini ${currentAvg.toFixed(2)}% (n=${n}). Nilai 100 tidak dapat dicapai di bulan depan karena akumulasi deviasi (${currentSum.toFixed(2)}%) sudah melampaui batas toleransi 5% (maks ${maxSumAllowed.toFixed(2)}%). Proyeksi nilai tertinggi jika deviasi 0% adalah ${bestPossibleScore.toFixed(2)} (rata-rata ${bestPossibleAvg.toFixed(2)}%).`;
		} else {
			message = `Rata-rata saat ini ${currentAvg.toFixed(2)}% (n=${n}). Akumulasi deviasi (${currentSum.toFixed(2)}%) melampaui batas maksimal untuk nilai 100 pada bulan ke-${target} (${maxSumAllowed.toFixed(2)}%). Target realistis: jaga deviasi sekecil mungkin, proyeksi nilai terbaik adalah ${bestPossibleScore.toFixed(2)} (rata-rata ${bestPossibleAvg.toFixed(2)}%).`;
		}
	}

	return {
		currentAvg,
		currentN: n,
		targetMonth: target,
		remainingMonths,
		maxSumAllowed,
		currentSum,
		remainingAllowance,
		targetPerMonth,
		isReachable,
		bestPossibleAvg,
		bestPossibleScore,
		message,
	};
}

export interface QuarterlyReminderInfo {
	quarter: 1 | 2 | 3 | 4;
	label: string;
	deadlineNotice: string;
	months: number[];
	monthNames: string;
	isCurrentQuarter: boolean;
	recommendedAction: string;
}

/**
 * Returns policy reminders for quarterly RPD updates:
 * TW1 => H+10 Februari
 * TW2 => H+10 April
 * TW3 => H+10 Juli
 * TW4 => H+10 Oktober
 */
export function getQuarterlyRpdReminders(currentMonth: number): QuarterlyReminderInfo[] {
	const cur = Math.min(Math.max(currentMonth, 1), 12);
	const curQuarter = Math.ceil(cur / 3) as 1 | 2 | 3 | 4;

	return [
		{
			quarter: 1,
			label: "Triwulan I (Jan–Mar)",
			deadlineNotice: "Hari kerja ke-10 Februari",
			months: [1, 2, 3],
			monthNames: "Januari, Februari, Maret",
			isCurrentQuarter: curQuarter === 1,
			recommendedAction:
				"Perbarui RPD Triwulan I sebelum hari kerja ke-10 Februari untuk menyelaraskan rencana kegiatan awal tahun.",
		},
		{
			quarter: 2,
			label: "Triwulan II (Apr–Jun)",
			deadlineNotice: "Hari kerja ke-10 April",
			months: [4, 5, 6],
			monthNames: "April, Mei, Juni",
			isCurrentQuarter: curQuarter === 2,
			recommendedAction:
				"Perbarui RPD Triwulan II sebelum hari kerja ke-10 April sesuai revisi DIPA atau percepatan penyerapan.",
		},
		{
			quarter: 3,
			label: "Triwulan III (Jul–Sep)",
			deadlineNotice: "Hari kerja ke-10 Juli",
			months: [7, 8, 9],
			monthNames: "Juli, Agustus, September",
			isCurrentQuarter: curQuarter === 3,
			recommendedAction:
				"Perbarui RPD Triwulan III sebelum hari kerja ke-10 Juli untuk mengamankan akselerasi semester II.",
		},
		{
			quarter: 4,
			label: "Triwulan IV (Okt–Des)",
			deadlineNotice: "Hari kerja ke-10 Oktober",
			months: [10, 11, 12],
			monthNames: "Oktober, November, Desember",
			isCurrentQuarter: curQuarter === 4,
			recommendedAction:
				"Perbarui RPD Triwulan IV sebelum hari kerja ke-10 Oktober. Catatan: Deviasi skor dinilai s.d. November.",
		},
	];
}

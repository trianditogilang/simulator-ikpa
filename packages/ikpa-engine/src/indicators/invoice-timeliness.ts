import type { RuleSetConfig } from "../rule-set";
import type { IndicatorCalculation, InvoiceTimelinessInput } from "../types";

// A day is a workday if it's NOT in holidays array.
// Count workdays between two dates exclusive of start date.
function countWorkdays(start: string, end: string, holidays: string[]): number {
	const holidaySet = new Set(holidays);
	let count = 0;

	// Use UTC to avoid timezone shifts
	const currentDate = new Date(`${start}T00:00:00Z`);
	const endDate = new Date(`${end}T00:00:00Z`);

	// Advance by 1 day to exclude start date
	currentDate.setUTCDate(currentDate.getUTCDate() + 1);

	while (currentDate <= endDate) {
		const year = currentDate.getUTCFullYear();
		const month = String(currentDate.getUTCMonth() + 1).padStart(2, "0");
		const day = String(currentDate.getUTCDate()).padStart(2, "0");
		const dateString = `${year}-${month}-${day}`;

		if (!holidaySet.has(dateString)) {
			count++;
		}

		currentDate.setUTCDate(currentDate.getUTCDate() + 1);
	}

	return count;
}

export function calculateInvoiceTimeliness(
	input: InvoiceTimelinessInput,
	config: RuleSetConfig,
): IndicatorCalculation {
	const { invoices, workdayCalendar } = input;
	const formulaTrace = [];

	if (invoices.length === 0) {
		return {
			key: "invoice_timeliness",
			label: "Penyelesaian Tagihan",
			weight: config.weights.invoice_timeliness,
			score: null,
			weightedContribution: null,
			status: "incomplete",
			formulaTrace: [],
			warnings: ["Tidak ada data SPM-LS non-pegawai (denominator nol)."],
		};
	}

	let onTimeCount = 0;
	const totalCount = invoices.length;

	for (const invoice of invoices) {
		const workdays = countWorkdays(
			invoice.bastDate,
			invoice.spmDate,
			workdayCalendar.holidays,
		);
		if (workdays <= 17) {
			onTimeCount++;
		}
	}

	const rawScore = (onTimeCount / totalCount) * 100;

	// Truncate/round to fraction digits
	const factor = 10 ** config.rounding.fractionDigits;
	let roundedScore = rawScore;
	if (config.rounding.mode === "half_up") {
		roundedScore = Math.round(rawScore * factor) / factor;
	} else if (config.rounding.mode === "half_down") {
		const ceil = Math.ceil(rawScore * factor);
		const floor = Math.floor(rawScore * factor);
		if (rawScore * factor - floor > 0.5) {
			roundedScore = ceil / factor;
		} else {
			roundedScore = floor / factor;
		}
	} else if (config.rounding.mode === "down") {
		roundedScore = Math.floor(rawScore * factor) / factor;
	} else if (config.rounding.mode === "up") {
		roundedScore = Math.ceil(rawScore * factor) / factor;
	}

	const scoreStr = roundedScore.toFixed(config.rounding.fractionDigits);

	formulaTrace.push({
		step: 1,
		label: "Rasio Penyelesaian Tagihan Tepat Waktu",
		formula: "(onTimeCount / totalCount) * 100",
		inputs: {
			onTimeCount: onTimeCount.toString(),
			totalCount: totalCount.toString(),
		},
		result: scoreStr,
	});

	const weightNum = parseFloat(config.weights.invoice_timeliness);
	const rawContribution = (roundedScore * weightNum) / 100;
	let roundedContribution = rawContribution;
	if (config.rounding.mode === "half_up") {
		roundedContribution = Math.round(rawContribution * factor) / factor;
	} else if (config.rounding.mode === "half_down") {
		const ceil = Math.ceil(rawContribution * factor);
		const floor = Math.floor(rawContribution * factor);
		if (rawContribution * factor - floor > 0.5) {
			roundedContribution = ceil / factor;
		} else {
			roundedContribution = floor / factor;
		}
	} else if (config.rounding.mode === "down") {
		roundedContribution = Math.floor(rawContribution * factor) / factor;
	} else if (config.rounding.mode === "up") {
		roundedContribution = Math.ceil(rawContribution * factor) / factor;
	}

	const contributionStr = roundedContribution.toFixed(
		config.rounding.fractionDigits,
	);

	formulaTrace.push({
		step: 2,
		label: "Nilai Tertimbang",
		formula: "(score * weight) / 100",
		inputs: {
			score: scoreStr,
			weight: config.weights.invoice_timeliness,
		},
		result: contributionStr,
	});

	const warnings = config.assumptionWarnings.filter((w) =>
		w.startsWith("TAG-"),
	);

	return {
		key: "invoice_timeliness",
		label: "Penyelesaian Tagihan",
		weight: config.weights.invoice_timeliness,
		score: scoreStr,
		weightedContribution: contributionStr,
		status: "complete",
		formulaTrace,
		warnings,
	};
}

import type { RuleSetConfig } from "../rule-set";
import type { FormulaStep, IndicatorCalculation, InvoiceTimelinessInput } from "../types";
import { countWorkdays } from "../utils/workday-calendar";

export function calculateInvoiceTimeliness(
	input: InvoiceTimelinessInput,
	config: RuleSetConfig,
): IndicatorCalculation {
	const { invoices, workdayCalendar } = input;
	const formulaTrace: FormulaStep[] = [];
	const warnings: string[] = [];
	let stepCounter = 1;

	// 1. Filter only contractual and non-pegawai invoices
	const eligibleInvoices = invoices.filter(
		(inv) => inv.isPegawai !== true && inv.isContractual !== false,
	);

	const pegawaiCount = invoices.filter((inv) => inv.isPegawai === true).length;
	const nonContractualCount = invoices.filter(
		(inv) => inv.isContractual === false,
	).length;

	if (eligibleInvoices.length === 0) {
		if (pegawaiCount > 0) {
			warnings.push(
				`Terdapat ${pegawaiCount} berkas SPM Belanja Pegawai yang dikecualikan dari penilaian.`,
			);
		}
		if (nonContractualCount > 0) {
			warnings.push(
				`Terdapat ${nonContractualCount} berkas SPM Non-Kontraktual yang dikecualikan dari penilaian.`,
			);
		}
		warnings.push(
			"Tidak ada data SPM-LS kontraktual non-pegawai eligible (denominator nol).",
		);

		return {
			key: "invoice_timeliness",
			label: "Penyelesaian Tagihan",
			weight: config.weights.invoice_timeliness,
			score: null,
			weightedContribution: null,
			status: "incomplete",
			formulaTrace: [],
			warnings,
		};
	}

	// 2. Classify completed vs pending invoices
	const completedInvoices = eligibleInvoices.filter(
		(inv) => inv.spmDate && inv.spmDate.trim() !== "",
	);
	const pendingInvoices = eligibleInvoices.filter(
		(inv) => !inv.spmDate || inv.spmDate.trim() === "",
	);

	if (completedInvoices.length === 0) {
		warnings.push(
			`Seluruh ${pendingInvoices.length} berkas SPM eligible masih menunggu tanggal konversi KPPN.`,
		);
		return {
			key: "invoice_timeliness",
			label: "Penyelesaian Tagihan",
			weight: config.weights.invoice_timeliness,
			score: null,
			weightedContribution: null,
			status: "incomplete",
			formulaTrace: [],
			warnings,
		};
	}

	// 3. Count on-time vs late using canonical workday calendar
	let onTimeCount = 0;
	let lateCount = 0;
	let invalidDateCount = 0;

	for (const inv of completedInvoices) {
		const bast = inv.bastDate.slice(0, 10);
		const spm = inv.spmDate!.slice(0, 10);

		if (spm < bast) {
			invalidDateCount++;
			lateCount++;
			continue;
		}

		try {
			const workdays = countWorkdays(bast, spm, workdayCalendar);
			if (workdays <= 17) {
				onTimeCount++;
			} else {
				lateCount++;
			}
		} catch {
			invalidDateCount++;
			lateCount++;
		}
	}

	const totalEvaluated = completedInvoices.length;
	const rawScore = (onTimeCount / totalEvaluated) * 100;

	// Rounding using config rounding mode
	const fractionDigits = config.rounding?.fractionDigits ?? 2;
	const factor = 10 ** fractionDigits;
	let roundedScore = rawScore;
	const mode = config.rounding?.mode ?? "half_up";

	if (mode === "half_up") {
		roundedScore = Math.round(rawScore * factor) / factor;
	} else if (mode === "half_down") {
		const ceil = Math.ceil(rawScore * factor);
		const floor = Math.floor(rawScore * factor);
		if (rawScore * factor - floor > 0.5) {
			roundedScore = ceil / factor;
		} else {
			roundedScore = floor / factor;
		}
	} else if (mode === "down") {
		roundedScore = Math.floor(rawScore * factor) / factor;
	} else if (mode === "up") {
		roundedScore = Math.ceil(rawScore * factor) / factor;
	}

	const scoreStr = roundedScore.toFixed(fractionDigits);

	// Calculate weighted contribution capped at max weight
	const weightNum = parseFloat(config.weights.invoice_timeliness);
	const rawContribution = (roundedScore * weightNum) / 100;
	const cappedContribution = Math.min(rawContribution, weightNum);
	let roundedContribution = cappedContribution;

	if (mode === "half_up") {
		roundedContribution = Math.round(cappedContribution * factor) / factor;
	} else if (mode === "half_down") {
		const ceil = Math.ceil(cappedContribution * factor);
		const floor = Math.floor(cappedContribution * factor);
		if (cappedContribution * factor - floor > 0.5) {
			roundedContribution = ceil / factor;
		} else {
			roundedContribution = floor / factor;
		}
	} else if (mode === "down") {
		roundedContribution = Math.floor(cappedContribution * factor) / factor;
	} else if (mode === "up") {
		roundedContribution = Math.ceil(cappedContribution * factor) / factor;
	}

	const contributionStr = roundedContribution.toFixed(fractionDigits);

	formulaTrace.push({
		step: stepCounter++,
		label: "Objek Penilaian SPM LS Kontraktual Non-Pegawai",
		formula: "Total SPM - SPM Pegawai - SPM Non-Kontraktual",
		inputs: {
			totalInvoices: invoices.length.toString(),
			pegawaiExcluded: pegawaiCount.toString(),
			eligibleCompleted: totalEvaluated.toString(),
			pendingWaiting: pendingInvoices.length.toString(),
		},
		result: totalEvaluated.toString(),
	});

	formulaTrace.push({
		step: stepCounter++,
		label: "Ketepatan Waktu Penerbitan SPM-LS (Maksimal H+17 Hari Kerja)",
		formula: "(Jumlah SPM Tepat Waktu (≤ 17 HK) / Total SPM Selesai Konversi) * 100",
		inputs: {
			onTimeCount: onTimeCount.toString(),
			lateCount: lateCount.toString(),
			totalEvaluated: totalEvaluated.toString(),
		},
		result: `${scoreStr}%`,
	});

	formulaTrace.push({
		step: stepCounter++,
		label: "Nilai Tertimbang Kontribusi IKPA",
		formula: "min((Nilai Indikator * Bobot) / 100, Bobot)",
		inputs: {
			nilaiIndikator: scoreStr,
			bobot: config.weights.invoice_timeliness,
			kontribusiMaksimal: weightNum.toFixed(fractionDigits),
		},
		result: contributionStr,
	});

	if (pegawaiCount > 0) {
		warnings.push(
			`${pegawaiCount} berkas SPM Belanja Pegawai dikecualikan dari pembilang dan penyebut.`,
		);
	}
	if (pendingInvoices.length > 0) {
		warnings.push(
			`Terdapat ${pendingInvoices.length} berkas SPM berjalan yang belum selesai konversi KPPN (nilai bersifat estimasi).`,
		);
	}
	if (invalidDateCount > 0) {
		warnings.push(
			`Terdapat ${invalidDateCount} berkas SPM dengan tanggal konversi tidak valid / sebelum BAST.`,
		);
	}

	const assumptionWarnings = (config.assumptionWarnings ?? []).filter((w) =>
		w.startsWith("TAG-"),
	);
	for (const w of assumptionWarnings) {
		warnings.push(w);
	}

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

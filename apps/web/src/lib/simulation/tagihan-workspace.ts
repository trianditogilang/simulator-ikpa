import {
	addWorkdays,
	calculateInvoiceTimeliness,
	countWorkdays,
	default2026RuleSet,
} from "@simulator-ikpa/ikpa-engine";
import type { WorkdayCalendarInput } from "@simulator-ikpa/ikpa-engine";
import type { ContractRecord, SpmLsRecord } from "@/services/contracts-invoices-service";

export type SpmEvaluationStatus =
	| "on_time"
	| "late"
	| "pending"
	| "risky"
	| "late_unconverted"
	| "invalid_date"
	| "excluded_pegawai";

export interface SpmEvaluation {
	id: string;
	spmId: string;
	referenceNumber: string;
	contractId: string;
	contractNumber: string;
	contractValue: string;
	accountCode: string;
	isPegawai: boolean;
	bastBappDate: string;
	receivedAtKppn: string | null;
	deadlineH17: string;
	workdaysElapsed: number | null;
	daysRemaining: number | null;
	status: SpmEvaluationStatus;
	badge: {
		label: string;
		variant: "success" | "danger" | "warning" | "info" | "muted";
	};
	impact: string;
}

export interface TagihanSummary {
	totalSpmCount: number;
	pegawaiCount: number;
	eligibleCount: number;
	completedCount: number;
	onTimeCount: number;
	lateCount: number;
	pendingCount: number;
	riskyCount: number;
	invalidDateCount: number;
	score: string | null;
	weightedContribution: string | null;
	weight: "10";
	status: "complete" | "warning" | "incomplete";
	statusLabel: string;
	formulaTrace: Array<{
		step: number;
		label: string;
		formula: string;
		inputs: Record<string, string>;
		result: string;
	}>;
	warnings: string[];
	evaluations: SpmEvaluation[];
	recommendations: string[];
}

export function evaluateSingleSpm(
	spm: SpmLsRecord,
	contracts: ContractRecord[],
	workdayCalendar?: Partial<WorkdayCalendarInput> | null,
	todayStr?: string,
): SpmEvaluation {
	const matchedContract = contracts.find((c) => c.id === spm.contractId);
	const contractNumber = matchedContract?.contractNumber || "Kontrak Tidak Ditemukan";
	const contractValue = matchedContract?.value || "0";
	const accountCode = matchedContract?.accountCode || "-";

	const bastDate = spm.bastBappDate?.slice(0, 10) || "";
	const receivedDate = spm.receivedAtKppn?.slice(0, 10) || null;
	const deadlineH17 = bastDate ? addWorkdays(bastDate, 17, workdayCalendar) : "-";

	// Belanja Pegawai exclusion
	if (spm.isPegawai) {
		return {
			id: spm.id,
			spmId: spm.id,
			referenceNumber: spm.referenceNumber,
			contractId: spm.contractId,
			contractNumber,
			contractValue,
			accountCode,
			isPegawai: true,
			bastBappDate: bastDate,
			receivedAtKppn: receivedDate,
			deadlineH17,
			workdaysElapsed: null,
			daysRemaining: null,
			status: "excluded_pegawai",
			badge: {
				label: "Dikecualikan (Pegawai)",
				variant: "muted",
			},
			impact: "Dikecualikan dari pembilang dan penyebut",
		};
	}

	// Pending conversion SPM
	if (!receivedDate || receivedDate.trim() === "") {
		const today = todayStr || new Date().toISOString().slice(0, 10);
		let workdaysSinceBast = 0;
		if (bastDate && today >= bastDate) {
			try {
				workdaysSinceBast = countWorkdays(bastDate, today, workdayCalendar);
			} catch {
				workdaysSinceBast = 0;
			}
		}

		let daysRemaining: number | null = null;
		if (bastDate && deadlineH17 !== "-") {
			if (today <= deadlineH17) {
				try {
					daysRemaining = countWorkdays(today, deadlineH17, workdayCalendar);
				} catch {
					daysRemaining = 0;
				}
			} else {
				try {
					daysRemaining = -countWorkdays(deadlineH17, today, workdayCalendar);
				} catch {
					daysRemaining = -1;
				}
			}
		}

		let status: SpmEvaluationStatus = "pending";
		let badgeLabel = `Menunggu Konversi (Sisa ${daysRemaining ?? 0} HK)`;
		let variant: "info" | "warning" | "danger" = "info";

		if (daysRemaining !== null && daysRemaining < 0) {
			status = "late_unconverted";
			badgeLabel = `Melewati Batas H+17 (${Math.abs(daysRemaining)} HK Terlambat)`;
			variant = "danger";
		} else if (daysRemaining !== null && daysRemaining <= 2) {
			status = "risky";
			badgeLabel = `Kritis / Berisiko (Sisa ${daysRemaining} HK)`;
			variant = "warning";
		}

		return {
			id: spm.id,
			spmId: spm.id,
			referenceNumber: spm.referenceNumber,
			contractId: spm.contractId,
			contractNumber,
			contractValue,
			accountCode,
			isPegawai: false,
			bastBappDate: bastDate,
			receivedAtKppn: null,
			deadlineH17,
			workdaysElapsed: workdaysSinceBast,
			daysRemaining,
			status,
			badge: {
				label: badgeLabel,
				variant,
			},
			impact: "Belum masuk pembilang/penyebut (Estimasi Berjalan)",
		};
	}

	// Completed conversion SPM
	if (bastDate && receivedDate < bastDate) {
		return {
			id: spm.id,
			spmId: spm.id,
			referenceNumber: spm.referenceNumber,
			contractId: spm.contractId,
			contractNumber,
			contractValue,
			accountCode,
			isPegawai: false,
			bastBappDate: bastDate,
			receivedAtKppn: receivedDate,
			deadlineH17,
			workdaysElapsed: null,
			daysRemaining: null,
			status: "invalid_date",
			badge: {
				label: "Tanggal Invalid (< BAST)",
				variant: "danger",
			},
			impact: "Dihitung Terlambat (Tanggal Sebelum BAST)",
		};
	}

	let workdaysElapsed = 0;
	try {
		workdaysElapsed = countWorkdays(bastDate, receivedDate, workdayCalendar);
	} catch {
		workdaysElapsed = 999;
	}

	const isOnTime = workdaysElapsed <= 17;
	return {
		id: spm.id,
		spmId: spm.id,
		referenceNumber: spm.referenceNumber,
		contractId: spm.contractId,
		contractNumber,
		contractValue,
		accountCode,
		isPegawai: false,
		bastBappDate: bastDate,
		receivedAtKppn: receivedDate,
		deadlineH17,
		workdaysElapsed,
		daysRemaining: null,
		status: isOnTime ? "on_time" : "late",
		badge: {
			label: isOnTime
				? `Tepat Waktu (${workdaysElapsed} HK)`
				: `Terlambat (${workdaysElapsed} HK)`,
			variant: isOnTime ? "success" : "danger",
		},
		impact: isOnTime
			? "Masuk Pembilang & Penyebut (Tepat Waktu)"
			: "Masuk Penyebut Saja (Terlambat)",
	};
}

export function calcTagihanSummary(
	spmLsList: SpmLsRecord[],
	contracts: ContractRecord[],
	workdayCalendar?: Partial<WorkdayCalendarInput> | null,
	todayStr?: string,
): TagihanSummary {
	const evaluations = spmLsList.map((s) =>
		evaluateSingleSpm(s, contracts, workdayCalendar, todayStr),
	);

	const totalSpmCount = spmLsList.length;
	const pegawaiCount = evaluations.filter((e) => e.isPegawai).length;
	const pendingEvaluations = evaluations.filter(
		(e) => !e.isPegawai && (e.receivedAtKppn === null || e.receivedAtKppn === ""),
	);
	const pendingCount = pendingEvaluations.length;
	const riskyCount = pendingEvaluations.filter(
		(e) => e.status === "risky" || e.status === "late_unconverted",
	).length;

	const completedEvaluations = evaluations.filter(
		(e) => !e.isPegawai && e.receivedAtKppn !== null && e.receivedAtKppn !== "",
	);
	const completedCount = completedEvaluations.length;
	const onTimeCount = completedEvaluations.filter((e) => e.status === "on_time").length;
	const lateCount = completedEvaluations.filter(
		(e) => e.status === "late" || e.status === "invalid_date",
	).length;
	const invalidDateCount = completedEvaluations.filter(
		(e) => e.status === "invalid_date",
	).length;

	const eligibleCount = completedCount;

	// Calculate using canonical engine
	const engineInput = {
		invoices: spmLsList.map((s) => ({
			id: s.id,
			referenceNumber: s.referenceNumber,
			contractId: s.contractId,
			bastDate: s.bastBappDate,
			spmDate: s.receivedAtKppn || undefined,
			isPegawai: s.isPegawai,
			isContractual: true,
		})),
		workdayCalendar: {
			holidays: workdayCalendar?.holidays ?? [],
			workdays: workdayCalendar?.workdays ?? [],
		},
	};

	const calc = calculateInvoiceTimeliness(engineInput, default2026RuleSet);

	let status: "complete" | "warning" | "incomplete" = "complete";
	let statusLabel = "Lengkap (Nilai Final)";

	if (eligibleCount === 0) {
		status = "incomplete";
		statusLabel = "Belum dapat dinilai (Denominator Nol)";
	} else if (pendingCount > 0) {
		status = "warning";
		statusLabel = `Estimasi (${pendingCount} SPM Masih Berjalan)`;
	}

	const recommendations: string[] = [];

	if (totalSpmCount === 0) {
		recommendations.push(
			"Belum ada data SPM-LS kontraktual yang dicatat. Daftarkan berkas SPM-LS setelah BAST/BAPP diterbitkan untuk memonitor batas H+17 hari kerja.",
		);
	} else {
		if (riskyCount > 0) {
			recommendations.push(
				`Terdapat ${riskyCount} berkas SPM-LS yang berisiko melewati deadline H+17 hari kerja. Segera lengkapi lampiran dokumen dan kirimkan SPM ke KPPN untuk diproses konversi.`,
			);
		}

		if (lateCount > 0) {
			recommendations.push(
				`Terdapat ${lateCount} berkas SPM-LS yang terlambat (> 17 hari kerja dari BAST/BAPP). Evaluasi alur penerbitan BAST/BAPP dengan PPK/pihak ketiga agar tanggal BAST di SAKTI sesuai tanggal penyelesaian fisik pekerjaan.`,
			);
		}

		if (pendingCount > 0 && riskyCount === 0) {
			recommendations.push(
				`Terdapat ${pendingCount} berkas SPM-LS dalam proses berjalan. Pastikan proses verifikasi PPK dan PPSPM berjalan lancar sebelum batas H+17 hari kerja.`,
			);
		}

		if (pegawaiCount > 0) {
			recommendations.push(
				`Terdapat ${pegawaiCount} berkas SPM Belanja Pegawai yang telah dikecualikan secara otomatis dari pembilang dan penyebut sesuai PER-5/PB/2024.`,
			);
		}

		recommendations.push(
			"Ingat: Batas 17 hari kerja dihitung sejak tanggal BAST/BAPP yang tercatat pada Modul Komitmen SAKTI hingga tanggal diterima KPPN saat konversi (bukan tanggal cetak SPM).",
		);
	}

	return {
		totalSpmCount,
		pegawaiCount,
		eligibleCount,
		completedCount,
		onTimeCount,
		lateCount,
		pendingCount,
		riskyCount,
		invalidDateCount,
		score: calc.score,
		weightedContribution: calc.weightedContribution,
		weight: "10",
		status,
		statusLabel,
		formulaTrace: calc.formulaTrace,
		warnings: calc.warnings,
		evaluations,
		recommendations,
	};
}

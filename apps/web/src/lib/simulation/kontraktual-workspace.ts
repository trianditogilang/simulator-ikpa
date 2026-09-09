import {
	calculateContractual,
	default2026RuleSet,
	parseIsoDate,
} from "@simulator-ikpa/ikpa-engine";
import type { ContractRecord } from "@/services/contracts-invoices-service";

export const CONTRACT_ACCOUNT_OPTIONS = [
	{ code: "53", label: "Belanja Modal (53)" },
	{ code: "52", label: "Belanja Barang (52)" },
	{ code: "51", label: "Belanja Pegawai (51)" },
	{ code: "57", label: "Belanja Bantuan Sosial (57)" },
] as const;

export const ACCOUNT_LABELS: Record<string, string> = {
	"51": "Pegawai (51)",
	"52": "Barang (52)",
	"53": "Modal (53)",
	"57": "Bansos (57)",
};

export interface ContractEvaluation {
	contractId: string;
	contractNumber: string;
	amountNum: number;
	signedDate: string;
	sp2dDate: string | null;
	accountCode: string;
	paymentType: string;
	// DAK
	isDakEligible: boolean;
	isDakSignedQ2: boolean;
	dakBadge: {
		label: string;
		variant: "success" | "warning" | "muted";
	};
	// KD
	isKdEligible: boolean;
	isPraDipa: boolean;
	isKdQ1: boolean;
	kdPoints: number | null;
	kdBadge: {
		label: string;
		variant: "success" | "info" | "muted";
	};
	// AK53
	isAk53Account: boolean;
	isAk53AmountRange: boolean;
	isAk53Sekaligus: boolean;
	hasSp2d: boolean;
	isAk53Completed: boolean;
	ak53Quarter: 1 | 2 | 3 | 4 | null;
	ak53Points: number | null;
	ak53ExclusionReason: string | null;
	ak53Badge: {
		label: string;
		variant: "success" | "info" | "warning" | "muted";
	};
}

export interface KontraktualSummary {
	fiscalYear: number;
	totalContractsCount: number;
	totalContractsAmount: number;
	// DAK Subcomponent
	dak: {
		countQ2: number;
		totalEligible: number;
		ratio: number;
		score: string | null;
		weightedContribution: string | null;
		statusLabel: string;
	};
	// KD Subcomponent
	kd: {
		praDipaCount: number;
		q1Count: number;
		denominatorCount: number;
		totalPoints: number;
		score: string | null;
		weightedContribution: string | null;
		statusLabel: string;
	};
	// AK53 Subcomponent
	ak53: {
		eligibleCount: number;
		completedCount: number;
		tw1Count: number;
		tw2Count: number;
		tw3Count: number;
		tw4Count: number;
		score: string | null;
		weightedContribution: string | null;
		statusLabel: string;
	};
	// Overall Final
	final: {
		score: string | null;
		weightedContribution: string | null;
		weight: "10";
		status: "complete" | "incomplete";
		statusLabel: string;
	};
	evaluations: ContractEvaluation[];
	recommendations: string[];
}

export function evaluateSingleContract(
	contract: ContractRecord,
	fiscalYear = 2026,
): ContractEvaluation {
	const amountNum = parseFloat(contract.value) || 0;
	const isEligibleGeneral = amountNum >= 50000000;
	const signed = parseIsoDate(contract.signedAt);
	const sp2d = parseIsoDate(contract.sp2dAt);
	const acc = contract.accountCode || "53";
	const payType = contract.paymentType || "sekaligus";

	// 1. DAK
	const isDakEligible = isEligibleGeneral;
	const isDakSignedQ2 =
		isDakEligible &&
		signed !== null &&
		(signed.year < fiscalYear ||
			(signed.year === fiscalYear && signed.month <= 6));

	const dakBadge = !isDakEligible
		? { label: "Nilai < Rp50 Juta", variant: "muted" as const }
		: isDakSignedQ2
			? { label: "s.d. TW II (Eligible)", variant: "success" as const }
			: { label: "Setelah TW II", variant: "warning" as const };

	// 2. KD
	let isPraDipa = false;
	let isKdQ1 = false;
	let kdPoints: number | null = null;
	let isKdEligible = false;

	if (isEligibleGeneral && signed) {
		if (signed.year < fiscalYear) {
			isPraDipa = true;
			kdPoints = 120;
			isKdEligible = true;
		} else if (signed.year === fiscalYear && signed.month <= 3) {
			isKdQ1 = true;
			kdPoints = 110;
			isKdEligible = true;
		}
	}

	const kdBadge = !isEligibleGeneral
		? { label: "Nilai < Rp50 Juta", variant: "muted" as const }
		: isPraDipa
			? { label: "Pra-DIPA (120 Pts)", variant: "success" as const }
			: isKdQ1
				? { label: "s.d. 31 Mar (110 Pts)", variant: "info" as const }
				: { label: "Setelah 31 Mar (Non Pra-DIPA)", variant: "muted" as const };

	// 3. AK53
	const isAk53Account = acc === "53";
	const isAk53AmountRange = amountNum >= 50000000 && amountNum <= 200000000;
	const isAk53Sekaligus = payType === "sekaligus";
	const hasSp2d = Boolean(contract.sp2dAt && sp2d);

	let ak53Quarter: 1 | 2 | 3 | 4 | null = null;
	let ak53Points: number | null = null;
	let ak53ExclusionReason: string | null = null;

	if (!isAk53Account) {
		ak53ExclusionReason = `Akun ${acc} (Bukan Akun 53)`;
	} else if (!isAk53AmountRange) {
		ak53ExclusionReason =
			amountNum < 50000000 ? "Nilai < Rp50 Juta" : "Nilai > Rp200 Juta";
	} else if (!isAk53Sekaligus) {
		ak53ExclusionReason = "Tipe Pembayaran Termin";
	} else if (!hasSp2d) {
		ak53ExclusionReason = "SP2D Belum Terbit";
	} else if (sp2d) {
		if (sp2d.year < fiscalYear || (sp2d.year === fiscalYear && sp2d.month <= 3)) {
			ak53Quarter = 1;
			ak53Points = 100;
		} else if (sp2d.year === fiscalYear && sp2d.month <= 6) {
			ak53Quarter = 2;
			ak53Points = 90;
		} else if (sp2d.year === fiscalYear && sp2d.month <= 9) {
			ak53Quarter = 3;
			ak53Points = 80;
		} else {
			ak53Quarter = 4;
			ak53Points = 70;
		}
	}

	const isAk53Completed = ak53Points !== null;

	const ak53Badge = isAk53Completed
		? {
				label: `TW ${ak53Quarter} (${ak53Points} Pts)`,
				variant:
					ak53Quarter === 1
						? ("success" as const)
						: ak53Quarter === 2
							? ("info" as const)
							: ("warning" as const),
			}
		: {
				label: ak53ExclusionReason || "Dikecualikan",
				variant: "muted" as const,
			};

	return {
		contractId: contract.id,
		contractNumber: contract.contractNumber,
		amountNum,
		signedDate: contract.signedAt,
		sp2dDate: contract.sp2dAt ?? null,
		accountCode: acc,
		paymentType: payType,
		isDakEligible,
		isDakSignedQ2,
		dakBadge,
		isKdEligible,
		isPraDipa,
		isKdQ1,
		kdPoints,
		kdBadge,
		isAk53Account,
		isAk53AmountRange,
		isAk53Sekaligus,
		hasSp2d,
		isAk53Completed,
		ak53Quarter,
		ak53Points,
		ak53ExclusionReason,
		ak53Badge,
	};
}

export function calcKontraktualSummary(
	contracts: ContractRecord[],
	fiscalYear = 2026,
): KontraktualSummary {
	const engineInput = {
		contracts: contracts.map((c) => ({
			id: c.id,
			contractNumber: c.contractNumber,
			accountCode: c.accountCode,
			amount: c.value,
			signedDate: c.signedAt,
			paymentType: (c.paymentType as "sekaligus" | "termin") || "sekaligus",
			sp2dDate: c.sp2dAt ?? null,
		})),
		fiscalYear,
	};

	const calc = calculateContractual(engineInput, default2026RuleSet);
	const evaluations = contracts.map((c) =>
		evaluateSingleContract(c, fiscalYear),
	);

	const totalContractsCount = contracts.length;
	const totalContractsAmount = contracts.reduce(
		(sum, c) => sum + (parseFloat(c.value) || 0),
		0,
	);

	// 1. DAK
	const eligibleGeneral = evaluations.filter((e) => e.isDakEligible);
	const countQ2 = evaluations.filter((e) => e.isDakSignedQ2).length;
	const totalEligible = eligibleGeneral.length;
	const ratio = totalEligible > 0 ? (countQ2 / totalEligible) * 100 : 0;
	const dakSub = calc.subComponents?.find((s) => s.key === "distribution");

	// 2. KD
	const kdList = evaluations.filter((e) => e.isKdEligible);
	const praDipaCount = kdList.filter((e) => e.isPraDipa).length;
	const q1Count = kdList.filter((e) => e.isKdQ1).length;
	const totalKdPoints = kdList.reduce((sum, e) => sum + (e.kdPoints || 0), 0);
	const kdSub = calc.subComponents?.find((s) => s.key === "early_procurement");

	// 3. AK53
	const ak53List = evaluations.filter((e) => e.isAk53Completed);
	const tw1Count = ak53List.filter((e) => e.ak53Quarter === 1).length;
	const tw2Count = ak53List.filter((e) => e.ak53Quarter === 2).length;
	const tw3Count = ak53List.filter((e) => e.ak53Quarter === 3).length;
	const tw4Count = ak53List.filter((e) => e.ak53Quarter === 4).length;
	const ak53Sub = calc.subComponents?.find((s) => s.key === "acceleration_53");

	// Recommendations
	const recommendations: string[] = [];

	if (totalEligible === 0) {
		recommendations.push(
			"Belum ada kontrak eligible (nilai ≥ Rp50 Juta). Daftarkan kontrak pengadaan barang/jasa atau modal Anda untuk memperoleh penilaian indikator.",
		);
	} else {
		if (ratio < 75) {
			recommendations.push(
				`Rasio Kontrak sampai Triwulan II saat ini ${ratio.toFixed(1)}% (Nilai Distribusi A.K.: ${dakSub?.score ?? "0"}). Dorong percepatan pendaftaran kontrak sebelum 30 Juni untuk mencapai rasio >75% (Nilai Distribusi A.K. 100).`,
			);
		}

		const postMarchCount = eligibleGeneral.length - kdList.length;
		if (postMarchCount > 0 || praDipaCount === 0) {
			recommendations.push(
				`Terdapat ${postMarchCount} kontrak yang ditandatangani setelah 31 Maret. Untuk tahun anggaran berikutnya, maksimalkan penandatanganan Pra-DIPA (Poin 120) atau paling lambat 31 Maret (Poin 110) guna mendongkrak skor Pra-DIPA.`,
			);
		}

		const modal53WithoutSp2d = evaluations.filter(
			(e) =>
				e.isAk53Account &&
				e.isAk53AmountRange &&
				e.isAk53Sekaligus &&
				!e.hasSp2d,
		);
		const modal53Late = evaluations.filter(
			(e) => e.isAk53Completed && (e.ak53Quarter ?? 1) > 1,
		);

		if (modal53WithoutSp2d.length > 0) {
			recommendations.push(
				`Terdapat ${modal53WithoutSp2d.length} kontrak Belanja Modal 53 (Rp50–200 Juta, sekaligus) yang belum terbit SP2D. Prioritaskan penyelesaian pembayaran dan penerbitan SP2D untuk melengkapi penilaian AK53.`,
			);
		}

		if (modal53Late.length > 0) {
			recommendations.push(
				`Terdapat ${modal53Late.length} kontrak Belanja Modal 53 yang SP2D-nya terbit setelah Triwulan I. Percepat penyelesaian pekerjaan agar SP2D dapat terbit di Triwulan I untuk memperoleh poin maksimal (100).`,
			);
		}
	}

	return {
		fiscalYear,
		totalContractsCount,
		totalContractsAmount,
		dak: {
			countQ2,
			totalEligible,
			ratio,
			score: dakSub?.score ?? null,
			weightedContribution: dakSub?.weightedContribution ?? null,
			statusLabel: dakSub?.score !== null ? "Lengkap" : "Belum dapat dinilai",
		},
		kd: {
			praDipaCount,
			q1Count,
			denominatorCount: kdList.length,
			totalPoints: totalKdPoints,
			score: kdSub?.score ?? null,
			weightedContribution: kdSub?.weightedContribution ?? null,
			statusLabel: kdSub?.score !== null ? "Lengkap" : "Belum dapat dinilai",
		},
		ak53: {
			eligibleCount: evaluations.filter(
				(e) => e.isAk53Account && e.isAk53AmountRange && e.isAk53Sekaligus,
			).length,
			completedCount: ak53List.length,
			tw1Count,
			tw2Count,
			tw3Count,
			tw4Count,
			score: ak53Sub?.score ?? null,
			weightedContribution: ak53Sub?.weightedContribution ?? null,
			statusLabel: ak53Sub?.score !== null ? "Lengkap" : "Belum dapat dinilai",
		},
		final: {
			score: calc.score,
			weightedContribution: calc.weightedContribution,
			weight: "10",
			status: calc.status === "complete" ? "complete" : "incomplete",
			statusLabel:
				calc.status === "complete" ? "Lengkap" : "Belum dapat dinilai",
		},
		evaluations,
		recommendations,
	};
}

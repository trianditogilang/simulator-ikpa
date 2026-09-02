import type { indicatorKeySchema } from "@simulator-ikpa/contracts";
import type { z } from "zod";
import type { RuleSetConfig } from "./rule-set";
import type { IndicatorCalculation, Recommendation } from "./types";
import { DecimalCalc } from "./utils/decimal";

type IndicatorKey = z.infer<typeof indicatorKeySchema>;

export function generateRecommendations(
	indicators: IndicatorCalculation[],
	_targetScore: string,
	_config: RuleSetConfig,
): Recommendation[] {
	const recs: (Recommendation & { _priorityScore: string })[] = [];

	const DEEP_LINK_MAP: Record<string, string> = {
		dipa_revision: "budget-revisions",
		rpd_deviation: "rpd-realization",
		budget_absorption: "rpd-realization",
		contractual: "contracts-invoices",
		invoice_timeliness: "contracts-invoices",
		up_tup: "up-tup-kkp",
		output_achievement: "output-achievement",
	};

	const TITLES: Record<string, string> = {
		dipa_revision: "Kendalikan Revisi DIPA",
		rpd_deviation: "Sesuaikan Deviasi RPD",
		budget_absorption: "Percepat Penyerapan Anggaran",
		contractual: "Selesaikan Proses Kontraktual",
		invoice_timeliness: "Ketepatan Waktu Tagihan",
		up_tup: "Optimalkan Penggunaan UP/TUP",
		output_achievement: "Tingkatkan Capaian Output",
	};

	const DESCRIPTIONS: Record<string, string> = {
		dipa_revision:
			"Hindari revisi DIPA yang terlalu sering untuk menjaga nilai.",
		rpd_deviation:
			"Deviasi RPD terlalu tinggi, selaraskan realisasi dengan rencana.",
		budget_absorption:
			"Tingkatkan penyerapan anggaran sesuai target triwulanan.",
		contractual:
			"Segera selesaikan pendaftaran kontrak untuk menghindari penalti.",
		invoice_timeliness: "Ajukan SPM tagihan tepat waktu sesuai ketentuan.",
		up_tup: "Tingkatkan penggunaan dan penyelesaian UP/TUP serta KKP.",
		output_achievement: "Percepat pelaporan capaian output secara tepat waktu.",
	};

	for (const ind of indicators) {
		if (ind.status === "incomplete") continue;

		const score = ind.score || "0";
		if (
			DecimalCalc.lt(score, "100") ||
			(ind.warnings && ind.warnings.length > 0)
		) {
			const gap = DecimalCalc.sub("100", score);
			const potentialGain = DecimalCalc.mul(
				gap,
				DecimalCalc.div(ind.weight, "100"),
			);

			let urgency: "high" | "medium" | "low" = "low";
			let urgencyMultiplier = "1";

			if (DecimalCalc.gte(gap, "30")) {
				urgency = "high";
				urgencyMultiplier = "3";
			} else if (DecimalCalc.gte(gap, "15")) {
				urgency = "medium";
				urgencyMultiplier = "2";
			}

			const priorityScore = DecimalCalc.mul(
				DecimalCalc.mul(ind.weight, gap),
				urgencyMultiplier,
			);

			recs.push({
				priority: 0,
				indicatorKey: ind.key as IndicatorKey,
				title: TITLES[ind.key] || `Perbaiki ${ind.label}`,
				description:
					DESCRIPTIONS[ind.key] || "Tingkatkan kinerja indikator ini.",
				potentialGain,
				urgency,
				deadline: null,
				deepLinkKey: DEEP_LINK_MAP[ind.key] || "dashboard",
				_priorityScore: priorityScore,
			});
		}
	}

	recs.sort((a, b) => {
		if (DecimalCalc.gt(a._priorityScore, b._priorityScore)) return -1;
		if (DecimalCalc.lt(a._priorityScore, b._priorityScore)) return 1;
		return a.indicatorKey.localeCompare(b.indicatorKey);
	});

	return recs.map((r, idx) => {
		const { _priorityScore, ...rest } = r;
		return {
			...rest,
			priority: idx + 1,
		};
	});
}

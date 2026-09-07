export interface AssessmentEligibilityResult {
	assessmentStatus: "included" | "excluded";
	exclusionPolicyId?: string;
	exclusionCategory?: string;
	exclusionReason?: string;
	policyReference?: string;
	effectiveRange?: { startMonth: number; endMonth: number };
	resolverVersion: string;
}

export interface FairnessPolicyRecord {
	id: string;
	name: string;
	indicatorKey: string;
	action: string;
	category: string;
	matchType: string;
	roMatchValue: unknown;
	scopeType: string;
	scopeId?: string | null;
	fiscalYearId?: string | null;
	year: number;
	effectiveMonthStart: number;
	effectiveMonthEnd: number;
	basisReference: string;
	displayReason: string;
	status: string;
}

export function matchRoCode(
	roCode: string,
	matchType: string,
	roMatchValue: unknown,
): boolean {
	const code = roCode.trim().toUpperCase();
	if (matchType === "exact") {
		if (Array.isArray(roMatchValue)) {
			return roMatchValue.some(
				(v) => String(v).trim().toUpperCase() === code,
			);
		}
		return String(roMatchValue).trim().toUpperCase() === code;
	}
	if (matchType === "list") {
		if (Array.isArray(roMatchValue)) {
			return roMatchValue.some(
				(v) => String(v).trim().toUpperCase() === code,
			);
		}
		const items = String(roMatchValue)
			.split(/[,\s;|]+/)
			.map((s) => s.trim().toUpperCase());
		return items.includes(code);
	}
	if (matchType === "prefix") {
		if (Array.isArray(roMatchValue)) {
			return roMatchValue.some((v) =>
				code.startsWith(String(v).trim().toUpperCase()),
			);
		}
		return code.startsWith(String(roMatchValue).trim().toUpperCase());
	}
	if (matchType === "regex") {
		try {
			const pattern = String(roMatchValue).trim();
			if (pattern.length > 100) return false;
			const reg = new RegExp(pattern, "i");
			return reg.test(roCode);
		} catch {
			return false;
		}
	}
	return false;
}

export interface FairnessProposalRecord {
	id: string;
	organizationId?: string;
	roCode: string;
	month?: number | null;
	category?: string;
	basisReference?: string;
	operatorNote?: string | null;
	status?: string;
}

export function resolveOutputAssessmentEligibility(params: {
	roCode: string;
	periodMonth: number;
	year?: number;
	organizationId?: string;
	kppnScopeId?: string;
	publishedPolicies?: FairnessPolicyRecord[];
	operatorProposals?: FairnessProposalRecord[];
}): AssessmentEligibilityResult {
	const resolverVersion = "2026.1";
	const policies = params.publishedPolicies ?? [];
	const proposals = params.operatorProposals ?? [];
	const targetYear = params.year ?? 2026;
	const uCode = params.roCode.trim().toUpperCase();

	// 1. Evaluate against active operator simulation proposals / satker exclusions
	for (const proposal of proposals) {
		if (proposal.status === "rejected" || proposal.status === "cancelled") {
			continue;
		}
		if (proposal.organizationId && params.organizationId && proposal.organizationId !== params.organizationId) {
			continue;
		}
		if (proposal.roCode.trim().toUpperCase() !== uCode) {
			continue;
		}
		if (proposal.month != null && proposal.month !== params.periodMonth) {
			continue;
		}

		const categoryLabel =
			proposal.category === "ro_khusus"
				? "RO Khusus (Penugasan Khusus)"
				: proposal.category === "keadaan_kahar"
					? "Keadaan Kahar (Force Majeure)"
					: "Kebijakan Khusus Pusat / Kemenkeu";

		return {
			assessmentStatus: "excluded",
			exclusionCategory: proposal.category ?? "ro_khusus",
			exclusionReason:
				proposal.operatorNote?.trim() ||
				`Dikecualikan (Fairness Treatment Satker): ${categoryLabel}`,
			policyReference:
				proposal.basisReference?.trim() || "Fairness Treatment Satker (Simulasi)",
			effectiveRange: {
				startMonth: proposal.month ?? 1,
				endMonth: proposal.month ?? 12,
			},
			resolverVersion,
		};
	}

	// 2. Evaluate against active published policies in descending order
	for (const policy of policies) {
		if (policy.status !== "published") continue;
		if (policy.indicatorKey !== "output_achievement") continue;
		if (policy.year && policy.year !== targetYear) continue;
		if (
			params.periodMonth < policy.effectiveMonthStart ||
			params.periodMonth > policy.effectiveMonthEnd
		) {
			continue;
		}

		// Check scope
		if (policy.scopeType === "kppn") {
			if (policy.scopeId && policy.scopeId !== params.kppnScopeId) {
				continue;
			}
		} else if (policy.scopeType === "organization") {
			if (policy.scopeId && policy.scopeId !== params.organizationId) {
				continue;
			}
		}

		// Match RO code
		if (matchRoCode(params.roCode, policy.matchType, policy.roMatchValue)) {
			return {
				assessmentStatus: "excluded",
				exclusionPolicyId: policy.id,
				exclusionCategory: policy.category,
				exclusionReason: policy.displayReason,
				policyReference: policy.basisReference,
				effectiveRange: {
					startMonth: policy.effectiveMonthStart,
					endMonth: policy.effectiveMonthEnd,
				},
				resolverVersion,
			};
		}
	}

	// 3. Default hardcoded 2026 fallback for RO Khusus FAN.ZZ1 (if DB policy not loaded/mock mode)
	if (uCode === "FAN.ZZ1" || uCode.includes("FAN.ZZ1")) {
		return {
			assessmentStatus: "excluded",
			exclusionCategory: "ro_khusus",
			exclusionReason:
				"RO Khusus tidak menjadi objek penilaian Indikator Capaian Output",
			policyReference: "Fairness treatment IKPA TA 2026",
			effectiveRange: { startMonth: 1, endMonth: 12 },
			resolverVersion,
		};
	}

	// 4. Default: Included
	return {
		assessmentStatus: "included",
		resolverVersion,
	};
}

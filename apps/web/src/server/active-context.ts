import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import { createDbClient } from "@simulator-ikpa/db";
import { fiscalYears, ruleSets } from "@simulator-ikpa/db/schema";
import { getAccessResolutionForSession } from "./access.server";
import { getServerAuthSession } from "./auth-session.server";

function getDatabase() {
	const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
	if (!url) return null;
	return createDbClient(url);
}

// ponytail: header needs live ruleSet, not hardcoded null; ceiling = full fiscalYear context in provider
// add when provider needs full async loader
export const getHeaderRuleSetFn = createServerFn({ method: "GET" })
	.validator((data?: { orgId?: string; year?: number }) => data)
	.handler(async ({ data }) => {
		const auth = await getServerAuthSession();
		const access = await getAccessResolutionForSession(auth, data?.orgId);
		const db = getDatabase();
		if (!db) {
			// dev without DB – mock published 2026.1 so header not empty (matches /admin-kppn/policy/rule-sets mock)
			return {
				ruleSet: {
					id: "44444444-4444-4444-8444-444444444444",
					version: 1,
					status: "published" as const,
					effectiveFrom: "2026-01-01T00:00:00+07:00",
					calendarVersionId: "55555555-5555-4555-8555-555555555555",
				},
				fiscalYear: { id: "55555555-5555-4555-8555-555555555555", year: data?.year ?? 2026 },
			};
		}

		const year = data?.year ?? 2026;

		// operator: try fiscalYear for active org
		const targetOrgId =
			data?.orgId ||
			(access.status === "operator_single_scope" ||
			access.status === "operator_multiple_scopes"
				? access.activeOrganizationId
				: null);

		if (targetOrgId) {
			const [fy] = await db
				.select()
				.from(fiscalYears)
				.where(and(eq(fiscalYears.orgId, targetOrgId), eq(fiscalYears.year, year)))
				.limit(1);
			if (fy?.activeRuleSetId) {
				const [rs] = await db
					.select()
					.from(ruleSets)
					.where(eq(ruleSets.id, fy.activeRuleSetId))
					.limit(1);
				if (rs) {
					return {
						ruleSet: {
							id: rs.id,
							// ponytail: version "2026.1" → 1, not 2026 (year already separate)
							version: Number(String(rs.version).split(".").pop() || "1") || 1,
							status: rs.status as "published" | "retired",
							effectiveFrom: new Date(rs.effectiveFrom).toISOString(),
							calendarVersionId: "55555555-5555-4555-8555-555555555555",
						},
						fiscalYear: { id: fy.id, year: fy.year },
					};
				}
			}
		}

		// admin or fallback: latest published for year
		const [latest] = await db
			.select()
			.from(ruleSets)
			.where(and(eq(ruleSets.year, year), eq(ruleSets.status, "published")))
			.orderBy(desc(ruleSets.effectiveFrom))
			.limit(1);

		if (latest) {
			return {
				ruleSet: {
					id: latest.id,
					// ponytail: version "2026.1" → 1
					version: Number(String(latest.version).split(".").pop() || "1") || 1,
					status: "published" as const,
					effectiveFrom: new Date(latest.effectiveFrom).toISOString(),
					calendarVersionId: "55555555-5555-4555-8555-555555555555",
				},
				fiscalYear: { id: "55555555-5555-4555-8555-555555555555", year },
			};
		}

		return { ruleSet: null, fiscalYear: { id: "55555555-5555-4555-8555-555555555555", year } };
	});

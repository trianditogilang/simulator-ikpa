import { assertOperatorOrgScope } from "@simulator-ikpa/access-control";
import type { AccessResolution } from "@simulator-ikpa/contracts";
import type { DbClient } from "@simulator-ikpa/db";
import { fiscalYears, spmQ4 } from "@simulator-ikpa/db/schema";
import { and, eq, isNull } from "drizzle-orm";

async function assertFy(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	fiscalYearId: string,
) {
	assertOperatorOrgScope(access, orgId);
	const [fy] = await db
		.select()
		.from(fiscalYears)
		.where(eq(fiscalYears.id, fiscalYearId))
		.limit(1);
	if (!fy || fy.orgId !== orgId) throw new Error("Fiscal year tidak valid.");
	return fy;
}

export async function listSpmQ4(
	db: DbClient,
	access: AccessResolution,
	orgId: string,
	fiscalYearId: string,
) {
	await assertFy(db, access, orgId, fiscalYearId);
	return db
		.select()
		.from(spmQ4)
		.where(and(eq(spmQ4.fiscalYearId, fiscalYearId), isNull(spmQ4.deletedAt)));
}

export function previewDispensationRatio(
	dispensationCount: number,
	totalQ4: number,
	buckets: { minRatio: string; maxRatio: string; deduction: string }[],
) {
	if (totalQ4 === 0) return { ratio: "0", deduction: "0" };
	const permil = (dispensationCount / totalQ4) * 1000;
	const bucket = buckets.find(
		(b) => permil >= parseFloat(b.minRatio) && permil <= parseFloat(b.maxRatio),
	);
	return { ratio: permil.toFixed(4), deduction: bucket?.deduction ?? "0" };
}

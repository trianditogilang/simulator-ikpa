import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { toJSONAsync } from "seroval";
import { createDbClient } from "@simulator-ikpa/db";
import {
	assessmentExclusionProposals,
	fiscalYears,
	kppnScopes,
	organizations,
	outputReports,
	outputTargetPlans,
	roBudgetRealizations,
	userAccesses,
	users,
} from "@simulator-ikpa/db/schema";
import { and, eq } from "drizzle-orm";

const baseUrl = process.env.F13_02_HTTP_URL;
const testDatabaseUrl = process.env.DATABASE_URL;
const configuredClerkUserId = process.env.F13_02_CLERK_OPERATOR_USER_ID;
const sessionToken = process.env.F13_02_CLERK_SESSION_TOKEN;
if (!baseUrl || !testDatabaseUrl || !configuredClerkUserId || !sessionToken) {
	throw new Error(
		"F13-02 output achievement HTTP integration requires the isolated database and short-lived Clerk session.",
	);
}

const db = createDbClient(testDatabaseUrl);
const fixtureTag = randomUUID().replaceAll("-", "").slice(0, 12);
const peerScopeCode = `F13-02-OA-SCOPE-${fixtureTag}`;
const peerOrgCode = `F13-02-OA-ORG-${fixtureTag}`;
const ownRoCode = `F13OA${fixtureTag}OWN`;
const peerRoCode = `F13OA${fixtureTag}PEER`;
const ownRoName = `F13-02 output own ${fixtureTag}`;
const peerRoName = `F13-02 output peer ${fixtureTag}`;
const ownOutputReference = `F13-02-OA-OWN-REF-${fixtureTag}`;
const peerOutputReference = `F13-02-OA-PEER-REF-${fixtureTag}`;
const peerOutputNote = `peer-output-note-${fixtureTag}`;
const peerBudgetReference = `F13-02-OA-PEER-BUDGET-${fixtureTag}`;
const peerProposalNote = `peer-proposal-note-${fixtureTag}`;
const deniedPattern = /ditolak|wewenang|unauthorized|forbidden|tidak ditemukan|tidak valid|admin/i;

let operatorUserId = "";
let orgId = "";
let fiscalYearId = "";
let activeRuleSetId = "";
let peerScopeId = "";
let peerOrgId = "";
let peerFiscalYearId = "";
let ownTargetPlanId = "";
let peerTargetPlanId = "";
let ownBudgetId = "";
let peerBudgetId = "";
let ownOutputId = "";
let peerOutputId = "";
let ownProposalId = "";
let peerProposalId = "";

const monthlyTargets = Array.from({ length: 12 }, (_, index) => ({
	month: index + 1,
	targetRvro: 1,
	targetPcro: index === 0 ? 100 : 0,
	targetRvroCumulative: index + 1,
	targetPcroCumulative: 100,
}));

async function findServerFnId(exportName: string): Promise<string> {
	const sourcePath = "/src/server/output-achievement.ts";
	const response = await fetch(`${baseUrl}${sourcePath}`);
	if (!response.ok) throw new Error(`Cannot load ${sourcePath}: HTTP ${response.status}`);
	const source = await response.text();
	const start = source.indexOf(`export const ${exportName} =`);
	if (start < 0) throw new Error(`Cannot find ${exportName} in ${sourcePath}`);
	const nextExport = source.indexOf("\nexport const ", start + 1);
	const match = source
		.slice(start, nextExport < 0 ? undefined : nextExport)
		.match(/createClientRpc\("([^"]+)"\)/);
	if (!match?.[1]) throw new Error(`Cannot resolve server function metadata for ${exportName}`);
	return match[1];
}

async function callServerFn(args: {
	id: string;
	method: "GET" | "POST";
	data: unknown;
}): Promise<{ status: number; body: string }> {
	const payload = JSON.stringify(await toJSONAsync({ data: args.data }));
	const headers = new Headers({
		"x-tsr-serverFn": "true",
		accept: "application/json",
		authorization: `Bearer ${sessionToken}`,
	});
	const init: RequestInit = { method: args.method, headers };
	let url = `${baseUrl}/_serverFn/${encodeURIComponent(args.id)}`;
	if (args.method === "GET") {
		url += `?payload=${encodeURIComponent(payload)}`;
	} else {
		headers.set("content-type", "application/json");
		init.body = payload;
	}
	const response = await fetch(url, init);
	return { status: response.status, body: await response.text() };
}

function expectDenied(result: { status: number; body: string }) {
	expect(result.status).toBe(200);
	expect(deniedPattern.test(result.body)).toBe(true);
	for (const value of [
		peerOrgId,
		peerFiscalYearId,
		peerTargetPlanId,
		peerBudgetId,
		peerOutputId,
		peerProposalId,
		peerRoCode,
		peerRoName,
		peerOutputReference,
		peerOutputNote,
		peerBudgetReference,
		peerProposalNote,
	]) {
		expect(result.body.includes(value)).toBe(false);
	}
}

async function expectPeerUnchanged() {
	const targetPlans = await db
		.select({
			id: outputTargetPlans.id,
			roCode: outputTargetPlans.roCode,
			roName: outputTargetPlans.roName,
			volumeDipa: outputTargetPlans.volumeDipa,
			status: outputTargetPlans.status,
			version: outputTargetPlans.version,
			deletedAt: outputTargetPlans.deletedAt,
		})
		.from(outputTargetPlans)
		.where(eq(outputTargetPlans.fiscalYearId, peerFiscalYearId));
	const budgets = await db
		.select({
			id: roBudgetRealizations.id,
			roCode: roBudgetRealizations.roCode,
			month: roBudgetRealizations.month,
			budgetAmountRo: roBudgetRealizations.budgetAmountRo,
			realizedAmountCumulative: roBudgetRealizations.realizedAmountCumulative,
			ppaCumulative: roBudgetRealizations.ppaCumulative,
			sourceReference: roBudgetRealizations.sourceReference,
		})
		.from(roBudgetRealizations)
		.where(eq(roBudgetRealizations.fiscalYearId, peerFiscalYearId));
	const outputs = await db
		.select({
			id: outputReports.id,
			roCode: outputReports.roCode,
			roName: outputReports.roName,
			month: outputReports.month,
			rvro: outputReports.rvro,
			pcro: outputReports.pcro,
			operatorNote: outputReports.operatorNote,
			achievementReference: outputReports.achievementReference,
			confirmed: outputReports.confirmed,
			status: outputReports.status,
			deletedAt: outputReports.deletedAt,
		})
		.from(outputReports)
		.where(eq(outputReports.fiscalYearId, peerFiscalYearId));
	const proposals = await db
		.select({
			id: assessmentExclusionProposals.id,
			organizationId: assessmentExclusionProposals.organizationId,
			fiscalYearId: assessmentExclusionProposals.fiscalYearId,
			roCode: assessmentExclusionProposals.roCode,
			operatorNote: assessmentExclusionProposals.operatorNote,
			status: assessmentExclusionProposals.status,
		})
		.from(assessmentExclusionProposals)
		.where(eq(assessmentExclusionProposals.fiscalYearId, peerFiscalYearId));

	expect(targetPlans).toEqual([
		{
			id: peerTargetPlanId,
			roCode: peerRoCode,
			roName: peerRoName,
			volumeDipa: "12.0000",
			status: "draft",
			version: 1,
			deletedAt: null,
		},
	]);
	expect(budgets).toEqual([
		{
			id: peerBudgetId,
			roCode: peerRoCode,
			month: 8,
			budgetAmountRo: "1000.00",
			realizedAmountCumulative: "100.00",
			ppaCumulative: "10.0000",
			sourceReference: peerBudgetReference,
		},
	]);
	expect(outputs).toEqual([
		{
			id: peerOutputId,
			roCode: peerRoCode,
			roName: peerRoName,
			month: 8,
			rvro: "2.0000",
			pcro: "10.0000",
			operatorNote: peerOutputNote,
			achievementReference: peerOutputReference,
			confirmed: false,
			status: "draft",
			deletedAt: null,
		},
	]);
	expect(proposals).toEqual([
		{
			id: peerProposalId,
			organizationId: peerOrgId,
			fiscalYearId: peerFiscalYearId,
			roCode: peerRoCode,
			operatorNote: peerProposalNote,
			status: "submitted",
		},
	]);
}

beforeAll(async () => {
	const [operator] = await db
		.select({ id: users.id, orgId: userAccesses.orgId })
		.from(users)
		.innerJoin(userAccesses, eq(userAccesses.userId, users.id))
		.where(
			and(
				eq(userAccesses.accessType, "operator_satker"),
				eq(users.clerkUserId, configuredClerkUserId),
			),
		)
		.limit(1);
	if (!operator?.orgId) {
		throw new Error("Configured Clerk operator is not mapped to an organization.");
	}
	operatorUserId = operator.id;
	orgId = operator.orgId;

	const [fy] = await db
		.select({ id: fiscalYears.id, activeRuleSetId: fiscalYears.activeRuleSetId })
		.from(fiscalYears)
		.where(and(eq(fiscalYears.orgId, orgId), eq(fiscalYears.year, 2026)))
		.limit(1);
	if (!fy) throw new Error("Seeded operator fiscal year is missing.");
	fiscalYearId = fy.id;
	activeRuleSetId = fy.activeRuleSetId;

	const [scope] = await db
		.insert(kppnScopes)
		.values({ code: peerScopeCode, name: "F13-02 Output Achievement HTTP Peer Scope" })
		.returning({ id: kppnScopes.id });
	peerScopeId = scope.id;
	const [peerOrg] = await db
		.insert(organizations)
		.values({
			kppnScopeId: peerScopeId,
			kodeSatker: peerOrgCode,
			name: "F13-02 Output Achievement HTTP Peer Organization",
			kppnName: "F13-02 Output Achievement HTTP Peer Scope",
			isBlu: false,
			timezone: "Asia/Jakarta",
		})
		.returning({ id: organizations.id });
	peerOrgId = peerOrg.id;
	const [peerFy] = await db
		.insert(fiscalYears)
		.values({ orgId: peerOrgId, year: 2026, activeRuleSetId })
		.returning({ id: fiscalYears.id });
	peerFiscalYearId = peerFy.id;

	const [ownTargetPlan] = await db
		.insert(outputTargetPlans)
		.values({
			fiscalYearId,
			organizationId: orgId,
			roCode: ownRoCode,
			roName: ownRoName,
			volumeDipa: "12",
			unit: "Layanan",
			unitAllowsDecimal: false,
			maxDecimalPlaces: 0,
			isPriorityNational: false,
			version: 1,
			status: "draft",
			monthlyTargetsJson: monthlyTargets,
			createdBy: operatorUserId,
		})
		.returning({ id: outputTargetPlans.id });
	ownTargetPlanId = ownTargetPlan.id;
	const [peerTargetPlan] = await db
		.insert(outputTargetPlans)
		.values({
			fiscalYearId: peerFiscalYearId,
			organizationId: peerOrgId,
			roCode: peerRoCode,
			roName: peerRoName,
			volumeDipa: "12",
			unit: "Layanan",
			unitAllowsDecimal: false,
			maxDecimalPlaces: 0,
			isPriorityNational: false,
			version: 1,
			status: "draft",
			monthlyTargetsJson: monthlyTargets,
			createdBy: operatorUserId,
		})
		.returning({ id: outputTargetPlans.id });
	peerTargetPlanId = peerTargetPlan.id;

	const [ownBudget] = await db
		.insert(roBudgetRealizations)
		.values({
			fiscalYearId,
			organizationId: orgId,
			roCode: ownRoCode,
			month: 8,
			budgetAmountRo: "1000.00",
			realizedAmountMonthly: "100.00",
			realizedAmountCumulative: "100.00",
			ppaMonthly: "10.0000",
			ppaCumulative: "10.0000",
			sourceType: "manual",
			sourceReference: `F13-02-OA-OWN-BUDGET-${fixtureTag}`,
			verificationStatus: "verified",
		})
		.returning({ id: roBudgetRealizations.id });
	ownBudgetId = ownBudget.id;
	const [peerBudget] = await db
		.insert(roBudgetRealizations)
		.values({
			fiscalYearId: peerFiscalYearId,
			organizationId: peerOrgId,
			roCode: peerRoCode,
			month: 8,
			budgetAmountRo: "1000.00",
			realizedAmountMonthly: "100.00",
			realizedAmountCumulative: "100.00",
			ppaMonthly: "10.0000",
			ppaCumulative: "10.0000",
			sourceType: "manual",
			sourceReference: peerBudgetReference,
			verificationStatus: "verified",
		})
		.returning({ id: roBudgetRealizations.id });
	peerBudgetId = peerBudget.id;

	const [ownOutput] = await db
		.insert(outputReports)
		.values({
			fiscalYearId,
			organizationId: orgId,
			roCode: ownRoCode,
			roName: ownRoName,
			month: 8,
			rvro: "2",
			volumeDipa: "12",
			pcro: "10",
			tpcro: "10",
			rvroIncremental: "1",
			pcroIncremental: "10",
			achievementReference: ownOutputReference,
			operatorNote: `own-output-note-${fixtureTag}`,
			status: "draft",
			validationResultsJson: [],
			confirmed: false,
			createdBy: operatorUserId,
		})
		.returning({ id: outputReports.id });
	ownOutputId = ownOutput.id;
	const [peerOutput] = await db
		.insert(outputReports)
		.values({
			fiscalYearId: peerFiscalYearId,
			organizationId: peerOrgId,
			roCode: peerRoCode,
			roName: peerRoName,
			month: 8,
			rvro: "2",
			volumeDipa: "12",
			pcro: "10",
			tpcro: "10",
			rvroIncremental: "1",
			pcroIncremental: "10",
			achievementReference: peerOutputReference,
			operatorNote: peerOutputNote,
			status: "draft",
			validationResultsJson: [],
			confirmed: false,
			createdBy: operatorUserId,
		})
		.returning({ id: outputReports.id });
	peerOutputId = peerOutput.id;

	const [ownProposal] = await db
		.insert(assessmentExclusionProposals)
		.values({
			organizationId: orgId,
			fiscalYearId,
			indicatorKey: "output_achievement",
			roCode: ownRoCode,
			month: 8,
			category: "ro_khusus",
			basisReference: ownOutputReference,
			operatorNote: `own-proposal-note-${fixtureTag}`,
			status: "submitted",
		})
		.returning({ id: assessmentExclusionProposals.id });
	ownProposalId = ownProposal.id;
	const [peerProposal] = await db
		.insert(assessmentExclusionProposals)
		.values({
			organizationId: peerOrgId,
			fiscalYearId: peerFiscalYearId,
			indicatorKey: "output_achievement",
			roCode: peerRoCode,
			month: 8,
			category: "ro_khusus",
			basisReference: peerOutputReference,
			operatorNote: peerProposalNote,
			status: "submitted",
		})
		.returning({ id: assessmentExclusionProposals.id });
	peerProposalId = peerProposal.id;
});

afterAll(async () => {
	if (ownProposalId) await db.delete(assessmentExclusionProposals).where(eq(assessmentExclusionProposals.id, ownProposalId));
	if (peerProposalId) await db.delete(assessmentExclusionProposals).where(eq(assessmentExclusionProposals.id, peerProposalId));
	if (ownOutputId) await db.delete(outputReports).where(eq(outputReports.id, ownOutputId));
	if (peerOutputId) await db.delete(outputReports).where(eq(outputReports.id, peerOutputId));
	if (ownBudgetId) await db.delete(roBudgetRealizations).where(eq(roBudgetRealizations.id, ownBudgetId));
	if (peerBudgetId) await db.delete(roBudgetRealizations).where(eq(roBudgetRealizations.id, peerBudgetId));
	if (ownTargetPlanId) await db.delete(outputTargetPlans).where(eq(outputTargetPlans.id, ownTargetPlanId));
	if (peerTargetPlanId) await db.delete(outputTargetPlans).where(eq(outputTargetPlans.id, peerTargetPlanId));
	if (peerOrgId) await db.delete(organizations).where(eq(organizations.id, peerOrgId));
	if (peerScopeId) await db.delete(kppnScopes).where(eq(kppnScopes.id, peerScopeId));
});

describe("F13-02 output achievement authenticated HTTP boundary", () => {
	it("listOutputReportsFn reads own output data and rejects peer data without leakage", async () => {
		const id = await findServerFnId("listOutputReportsFn");
		const own = await callServerFn({ id, method: "GET", data: { orgId } });
		expect(own.status).toBe(200);
		expect(own.body.includes(fiscalYearId)).toBe(true);
		expect(own.body.includes(ownOutputId)).toBe(true);
		expect(own.body.includes(ownRoCode)).toBe(true);
		expect(own.body.includes(ownOutputReference)).toBe(true);
		expect(own.body.includes(peerOutputId)).toBe(false);
		expect(own.body.includes(peerRoCode)).toBe(false);
		expect(own.body.includes(peerOutputReference)).toBe(false);

		const peer = await callServerFn({ id, method: "GET", data: { orgId: peerOrgId } });
		expectDenied(peer);
	});

	it("upsertTargetPlanFn rejects peer mutation and preserves peer target plan", async () => {
		const id = await findServerFnId("upsertTargetPlanFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: {
				orgId: peerOrgId,
				fiscalYearId: peerFiscalYearId,
				roCode: `F13OA${fixtureTag}NEW`,
				roName: `peer target create ${fixtureTag}`,
				unit: "Layanan",
				unitAllowsDecimal: false,
				maxDecimalPlaces: 0,
				isPriorityNational: false,
				volumeDipa: "12",
				monthlyTargets,
				status: "draft",
			},
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("submitTargetPlanFn rejects an own-org request carrying a peer target plan ID", async () => {
		const id = await findServerFnId("submitTargetPlanFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: { orgId, targetPlanId: peerTargetPlanId },
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("upsertTargetUpdateWindowFn rejects the Operator before any peer window mutation", async () => {
		const id = await findServerFnId("upsertTargetUpdateWindowFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: {
				fiscalYearId: peerFiscalYearId,
				quarter: 4,
				opensAt: "2026-10-01T00:00:00Z",
				closesAt: "2026-10-14T23:59:59Z",
				dayType: "workday",
				sourceReference: `peer-window-${fixtureTag}`,
				status: "scheduled",
			},
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("upsertRoBudgetRealizationFn rejects peer mutation and preserves peer budget realization", async () => {
		const id = await findServerFnId("upsertRoBudgetRealizationFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: {
				orgId: peerOrgId,
				fiscalYearId: peerFiscalYearId,
				roCode: `F13OA${fixtureTag}NEW`,
				month: 9,
				budgetAmountRo: "2000.00",
				realizedAmountMonthly: "200.00",
				realizedAmountCumulative: "200.00",
				ppaMonthly: "10.0000",
				ppaCumulative: "20.0000",
				sourceType: "manual",
				sourceReference: `peer-budget-create-${fixtureTag}`,
				verificationStatus: "verified",
			},
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("upsertOutputReportFn rejects peer mutation and preserves peer output", async () => {
		const id = await findServerFnId("upsertOutputReportFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: {
				orgId: peerOrgId,
				fiscalYearId: peerFiscalYearId,
				roCode: `F13OA${fixtureTag}NEW`,
				roName: `peer output create ${fixtureTag}`,
				month: 9,
				rvro: "3",
				volumeDipa: "12",
				pcro: "25",
				tpcro: "25",
				rvroIncremental: "1",
				pcroIncremental: "15",
				evidenceDocumentUrl: `https://example.invalid/peer-${fixtureTag}`,
				achievementReference: `peer-output-create-${fixtureTag}`,
				operatorNote: `peer-output-create-note-${fixtureTag}`,
				confirmed: false,
			},
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("submitOutputReportFn rejects an own-org request carrying a peer output ID", async () => {
		const id = await findServerFnId("submitOutputReportFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: { orgId, outputId: peerOutputId },
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("confirmOutputReportFn rejects an own-org request carrying a peer output ID", async () => {
		const id = await findServerFnId("confirmOutputReportFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: { orgId, outputId: peerOutputId },
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("deleteOutputReportFn rejects an own-org request carrying a peer output ID", async () => {
		const id = await findServerFnId("deleteOutputReportFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: { orgId, outputId: peerOutputId },
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("createFairnessProposalFn rejects peer mutation and preserves the peer proposal", async () => {
		const id = await findServerFnId("createFairnessProposalFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: {
				orgId: peerOrgId,
				fiscalYearId: peerFiscalYearId,
				roCode: `F13OA${fixtureTag}NEW`,
				month: 9,
				category: "ro_khusus",
				basisReference: `peer-proposal-create-${fixtureTag}`,
				operatorNote: `peer-proposal-create-note-${fixtureTag}`,
			},
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("deleteFairnessProposalFn rejects a peer-organization mutation and preserves the peer proposal", async () => {
		const id = await findServerFnId("deleteFairnessProposalFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: { orgId: peerOrgId, proposalId: peerProposalId },
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("listFairnessPoliciesFn rejects the Operator without exposing policy scope data", async () => {
		const id = await findServerFnId("listFairnessPoliciesFn");
		const result = await callServerFn({ id, method: "GET", data: { year: 2026 } });
		expectDenied(result);
	});

	it("listFairnessProposalsFn reads own proposals and rejects peer proposals without leakage", async () => {
		const id = await findServerFnId("listFairnessProposalsFn");
		const own = await callServerFn({ id, method: "GET", data: { orgId } });
		expect(own.status).toBe(200);
		expect(own.body.includes(ownProposalId)).toBe(true);
		expect(own.body.includes(ownRoCode)).toBe(true);
		expect(own.body.includes(peerProposalId)).toBe(false);
		expect(own.body.includes(peerProposalNote)).toBe(false);

		const peer = await callServerFn({ id, method: "GET", data: { orgId: peerOrgId } });
		expectDenied(peer);
	});

	it("upsertFairnessPolicyFn rejects the Operator before peer policy mutation", async () => {
		const id = await findServerFnId("upsertFairnessPolicyFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: {
				name: `peer fairness policy ${fixtureTag}`,
				indicatorKey: "output_achievement",
				action: "exclude_from_assessment",
				category: "ro_khusus",
				matchType: "exact",
				roMatchValue: [peerRoCode],
				scopeType: "organization",
				scopeId: peerOrgId,
				fiscalYearId: peerFiscalYearId,
				year: 2026,
				effectiveMonthStart: 1,
				effectiveMonthEnd: 12,
				basisReference: `peer-policy-${fixtureTag}`,
				displayReason: `peer-policy-reason-${fixtureTag}`,
				allowOperatorProposal: true,
				status: "published",
			},
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("reviewFairnessProposalFn rejects the Operator before peer proposal review", async () => {
		const id = await findServerFnId("reviewFairnessProposalFn");
		const result = await callServerFn({
			id,
			method: "POST",
			data: {
				proposalId: peerProposalId,
				status: "approved",
				reviewNote: `peer-review-${fixtureTag}`,
				createPolicy: true,
			},
		});
		expectDenied(result);
		await expectPeerUnchanged();
	});

	it("listAllFairnessProposalsFn rejects the Operator without exposing peer proposals", async () => {
		const id = await findServerFnId("listAllFairnessProposalsFn");
		const result = await callServerFn({ id, method: "GET", data: undefined });
		expectDenied(result);
	});
});

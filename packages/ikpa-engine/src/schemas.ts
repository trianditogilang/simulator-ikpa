import {
	decimalStringSchema,
	fiscalPeriodSchema,
	indicatorKeySchema,
	isoDateSchema,
	isoDateTimeSchema,
	simulationTypeSchema,
	uuidSchema,
} from "@simulator-ikpa/contracts";
import { z } from "zod";

export const accountTypeSchema = z.enum(["51", "52", "53", "57"]);

export const dipaRevisionInputSchema = z.strictObject({
	semester1Revisions: z.number().int().nonnegative(),
	semester2Revisions: z.number().int().nonnegative(),
	hasBudgetChange: z.array(z.boolean()),
});

export const rpdDeviationMonthSchema = z.strictObject({
	month: z.number().int().min(1).max(11),
	planned: z.record(accountTypeSchema, decimalStringSchema),
	realized: z.record(accountTypeSchema, decimalStringSchema),
});

export const rpdDeviationInputSchema = z.strictObject({
	months: z.array(rpdDeviationMonthSchema),
	budgetByType: z.record(accountTypeSchema, decimalStringSchema),
});

export const absorptionQuarterSchema = z.strictObject({
	quarter: z.number().int().min(1).max(4),
	realized: z.record(accountTypeSchema, decimalStringSchema),
	budget: z.record(accountTypeSchema, decimalStringSchema),
});

export const absorptionInputSchema = z.strictObject({
	quarters: z.array(absorptionQuarterSchema),
});

export const contractInputSchema = z.strictObject({
	id: z.string(),
	amount: decimalStringSchema,
	signedDate: isoDateSchema,
	submittedDate: isoDateSchema,
	isEarlyProcurement: z.boolean(),
});

export const acceleration53InputSchema = z.strictObject({
	id: z.string(),
	amount: decimalStringSchema,
	signedDate: isoDateSchema,
});

export const contractualInputSchema = z.strictObject({
	contracts: z.array(contractInputSchema),
	accelerations53: z.array(acceleration53InputSchema),
});

export const invoiceInputSchema = z.strictObject({
	id: z.string(),
	bastDate: isoDateSchema,
	spmDate: isoDateSchema,
});

export const workdayCalendarSchema = z.strictObject({
	holidays: z.array(isoDateSchema),
	workdays: z.array(isoDateSchema),
});

export const invoiceTimelinessInputSchema = z.strictObject({
	invoices: z.array(invoiceInputSchema),
	workdayCalendar: workdayCalendarSchema,
});

export const upTupTransactionSchema = z.strictObject({
	id: z.string(),
	type: z.enum(["UP", "TUP"]),
	amount: decimalStringSchema,
	date: isoDateSchema,
	settlementDate: isoDateSchema.nullable(),
	isSettled: z.boolean(),
});

export const kkpTransactionSchema = z.strictObject({
	id: z.string(),
	amount: decimalStringSchema,
	date: isoDateSchema,
});

export const upTupInputSchema = z.strictObject({
	transactions: z.array(upTupTransactionSchema),
	kkpTransactions: z.array(kkpTransactionSchema),
});

export const outputReportSchema = z.strictObject({
	id: z.string(),
	period: z.number().int().min(1).max(12),
	target: decimalStringSchema,
	realized: decimalStringSchema,
	reportedDate: isoDateSchema,
	deadlineDate: isoDateSchema,
});

export const outputAchievementInputSchema = z.strictObject({
	reports: z.array(outputReportSchema),
});

export const spmDispensationInputSchema = z.strictObject({
	dispensationCount: z.number().int().nonnegative(),
	totalSpmQ4: z.number().int().nonnegative(),
});

export const engineInputSchema = z.strictObject({
	ruleSetId: uuidSchema,
	ruleSetVersion: z.number().int().positive(),
	organizationId: uuidSchema,
	fiscalYear: z.number().int().min(2020).max(2100),
	period: fiscalPeriodSchema,
	isBlu: z.boolean(),
	targetScore: decimalStringSchema,
	simulationType: simulationTypeSchema,
	dipaRevision: dipaRevisionInputSchema,
	rpdDeviation: rpdDeviationInputSchema,
	absorption: absorptionInputSchema,
	contractual: contractualInputSchema,
	invoiceTimeliness: invoiceTimelinessInputSchema,
	upTup: upTupInputSchema,
	outputAchievement: outputAchievementInputSchema,
	spmDispensation: spmDispensationInputSchema,
	overrides: z.record(indicatorKeySchema, decimalStringSchema).optional(),
});

export const formulaStepSchema = z.strictObject({
	step: z.number().int().positive(),
	label: z.string(),
	formula: z.string(),
	inputs: z.record(z.string(), z.string()),
	result: z.string(),
});

export const subComponentSchema = z.strictObject({
	key: z.string(),
	label: z.string(),
	score: decimalStringSchema.nullable(),
	weight: decimalStringSchema,
	weightedContribution: decimalStringSchema.nullable(),
});

export const indicatorCalculationSchema = z.strictObject({
	key: indicatorKeySchema,
	label: z.string(),
	weight: decimalStringSchema,
	score: decimalStringSchema.nullable(),
	weightedContribution: decimalStringSchema.nullable(),
	status: z.enum(["complete", "warning", "incomplete"]),
	formulaTrace: z.array(formulaStepSchema),
	warnings: z.array(z.string()),
	subComponents: z.array(subComponentSchema).optional(),
});

export const recommendationSchema = z.strictObject({
	priority: z.number().int().positive(),
	indicatorKey: indicatorKeySchema,
	title: z.string(),
	description: z.string(),
	potentialGain: decimalStringSchema,
	urgency: z.enum(["high", "medium", "low"]),
	deadline: isoDateSchema.nullable(),
	deepLinkKey: z.string(),
});

export const engineOutputSchema = z.strictObject({
	totalScore: decimalStringSchema.nullable(),
	indicators: z.array(indicatorCalculationSchema),
	dispensationDeduction: decimalStringSchema,
	recommendations: z.array(recommendationSchema),
	missingData: z.array(z.string()),
	warnings: z.array(z.string()),
	ruleSetId: z.string(),
	ruleSetVersion: z.number().int().positive(),
	calculatedAt: isoDateTimeSchema,
});

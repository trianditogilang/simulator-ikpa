import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const isoDateSchema = z.iso.date();
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export const decimalStringSchema = z
	.string()
	.regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/, "Expected a decimal string");

export const accessTypeSchema = z.enum(["operator_satker", "admin_kppn"]);
export const indicatorKeySchema = z.enum([
	"dipa_revision",
	"rpd_deviation",
	"budget_absorption",
	"contractual",
	"invoice_timeliness",
	"up_tup",
	"output_achievement",
]);

export const organizationSummarySchema = z.strictObject({
	id: uuidSchema,
	code: z.string().min(1).max(32),
	name: z.string().min(1).max(200),
	timezone: z.string().min(1).max(64),
});

export const kppnScopeSummarySchema = z.strictObject({
	id: uuidSchema,
	code: z.string().min(1).max(32),
	name: z.string().min(1).max(200),
});

export const accessResolutionSchema = z.discriminatedUnion("status", [
	z.strictObject({ status: z.literal("unauthenticated") }),
	z.strictObject({
		status: z.literal("unmapped"),
		userId: uuidSchema,
	}),
	z.strictObject({
		status: z.literal("operator_single_scope"),
		userId: uuidSchema,
		accessType: z.literal("operator_satker"),
		organizations: z.array(organizationSummarySchema).length(1),
		activeOrganizationId: uuidSchema,
	}),
	z.strictObject({
		status: z.literal("operator_multiple_scopes"),
		userId: uuidSchema,
		accessType: z.literal("operator_satker"),
		organizations: z.array(organizationSummarySchema).min(2),
		activeOrganizationId: uuidSchema.nullable(),
	}),
	z.strictObject({
		status: z.literal("admin"),
		userId: uuidSchema,
		accessType: z.literal("admin_kppn"),
		kppnScopes: z.array(kppnScopeSummarySchema).min(1),
	}),
	z.strictObject({
		status: z.literal("invalid_conflict"),
		userId: uuidSchema,
		code: z.literal("ACCESS_MAPPING_CONFLICT"),
	}),
]);

export const fiscalPeriodSchema = z.discriminatedUnion("kind", [
	z.strictObject({
		kind: z.literal("month"),
		value: z.number().int().min(1).max(12),
	}),
	z.strictObject({
		kind: z.literal("quarter"),
		value: z.number().int().min(1).max(4),
	}),
	z.strictObject({
		kind: z.literal("semester"),
		value: z.number().int().min(1).max(2),
	}),
	z.strictObject({ kind: z.literal("year"), value: z.literal(1) }),
]);

export const ruleSetRefSchema = z.strictObject({
	id: uuidSchema,
	version: z.number().int().positive(),
	status: z.enum(["published", "retired"]),
	effectiveFrom: isoDateTimeSchema,
	calendarVersionId: uuidSchema,
});

export const globalContextSchema = z.strictObject({
	access: accessResolutionSchema,
	activeOrganization: organizationSummarySchema.nullable(),
	activeKppnScope: kppnScopeSummarySchema.nullable(),
	fiscalYear: z.strictObject({
		id: uuidSchema,
		year: z.number().int().min(2020).max(2100),
	}),
	period: fiscalPeriodSchema,
	ruleSet: ruleSetRefSchema.nullable(),
	timezone: z.string().min(1).max(64),
	generatedAt: isoDateTimeSchema,
});

export const indicatorResultSchema = z.strictObject({
	key: indicatorKeySchema,
	label: z.string().min(1).max(120),
	status: z.enum(["complete", "warning", "incomplete"]),
	score: decimalStringSchema.nullable(),
	weight: decimalStringSchema,
	weightedContribution: decimalStringSchema.nullable(),
	target: decimalStringSchema.nullable(),
	gap: decimalStringSchema.nullable(),
	warnings: z.array(z.string().min(1).max(300)),
});

export const simulationTypeSchema = z.enum(["actual", "forecast", "scenario"]);

export const snapshotSummarySchema = z.strictObject({
	id: uuidSchema,
	simulationId: uuidSchema,
	name: z.string().min(1).max(160),
	type: simulationTypeSchema,
	periodEnd: isoDateSchema,
	totalScore: decimalStringSchema.nullable(),
	ruleSet: ruleSetRefSchema,
	calendarVersionId: uuidSchema,
	createdAt: isoDateTimeSchema,
});

export const snapshotDetailSchema = snapshotSummarySchema.extend({
	indicators: z.array(indicatorResultSchema).length(7),
	dispensationDeduction: decimalStringSchema,
	missingData: z.array(z.string().min(1).max(200)),
	warnings: z.array(z.string().min(1).max(300)),
});

export const policyLockSchema = z.strictObject({
	locked: z.boolean(),
	reason: z.string().min(1).max(300).nullable(),
	fields: z.array(z.string().min(1).max(64)),
});

export const reminderPolicySchema = z.strictObject({
	id: uuidSchema,
	eventType: z.string().min(1).max(64),
	indicatorKey: indicatorKeySchema.nullable(),
	category: z.enum(["mandatory", "recommended", "optional"]),
	dayType: z.enum(["workday", "calendar_day", "event_based", "schedule"]),
	allowedLeadDays: z.array(z.number().int().min(0).max(366)),
	requiredLeadDays: z.array(z.number().int().min(0).max(366)),
	status: z.enum(["draft", "published", "retired"]),
	ruleSet: ruleSetRefSchema,
	lock: policyLockSchema,
});

export const deliverySchema = z.strictObject({
	id: uuidSchema,
	organizationId: uuidSchema,
	eventType: z.string().min(1).max(64),
	status: z.enum([
		"scheduled",
		"processing",
		"sent",
		"failed",
		"skipped",
		"cancelled",
	]),
	scheduledFor: isoDateTimeSchema,
	sentAt: isoDateTimeSchema.nullable(),
	attemptCount: z.number().int().nonnegative(),
	recipientCount: z.number().int().nonnegative(),
	errorCode: z.string().min(1).max(64).nullable(),
	ruleSet: ruleSetRefSchema,
	calendarVersionId: uuidSchema,
	idempotencyKey: z.string().min(1).max(200),
	updatedAt: isoDateTimeSchema,
});

export const paginationRequestSchema = z.strictObject({
	page: z.number().int().positive(),
	pageSize: z.number().int().min(1).max(100),
});

export const pageMetaSchema = paginationRequestSchema.extend({
	totalItems: z.number().int().nonnegative(),
	totalPages: z.number().int().nonnegative(),
});

export const paginatedSchema = <T extends z.ZodType>(itemSchema: T) =>
	z.strictObject({
		items: z.array(itemSchema),
		page: pageMetaSchema,
	});

export const commonListFilterSchema = z.strictObject({
	search: z.string().trim().min(1).max(100).optional(),
	fiscalYear: z.number().int().min(2020).max(2100).optional(),
	period: fiscalPeriodSchema.optional(),
	organizationId: uuidSchema.optional(),
	statuses: z.array(z.string().min(1).max(64)).optional(),
	sortBy: z
		.string()
		.regex(/^[A-Za-z][A-Za-z0-9_]*$/)
		.max(64)
		.optional(),
	sortDirection: z.enum(["asc", "desc"]).optional(),
});

export const apiErrorSchema = z.strictObject({
	code: z
		.string()
		.regex(/^[A-Z][A-Z0-9_]*$/)
		.max(64),
	message: z.string().min(1).max(500),
	fieldErrors: z
		.record(z.string(), z.array(z.string().min(1).max(200)))
		.optional(),
	requestId: z.string().min(1).max(128).optional(),
	retryable: z.boolean().optional(),
});

export type AccessType = z.infer<typeof accessTypeSchema>;
export type AccessResolution = z.infer<typeof accessResolutionSchema>;
export type OrganizationSummary = z.infer<typeof organizationSummarySchema>;
export type KppnScopeSummary = z.infer<typeof kppnScopeSummarySchema>;
export type FiscalPeriod = z.infer<typeof fiscalPeriodSchema>;
export type RuleSetRef = z.infer<typeof ruleSetRefSchema>;
export type GlobalContext = z.infer<typeof globalContextSchema>;
export type IndicatorKey = z.infer<typeof indicatorKeySchema>;
export type IndicatorResult = z.infer<typeof indicatorResultSchema>;
export type SimulationType = z.infer<typeof simulationTypeSchema>;
export type SnapshotSummary = z.infer<typeof snapshotSummarySchema>;
export type SnapshotDetail = z.infer<typeof snapshotDetailSchema>;
export type PolicyLock = z.infer<typeof policyLockSchema>;
export type ReminderPolicy = z.infer<typeof reminderPolicySchema>;
export type Delivery = z.infer<typeof deliverySchema>;
export type PaginationRequest = z.infer<typeof paginationRequestSchema>;
export type PageMeta = z.infer<typeof pageMetaSchema>;
export type CommonListFilter = z.infer<typeof commonListFilterSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;

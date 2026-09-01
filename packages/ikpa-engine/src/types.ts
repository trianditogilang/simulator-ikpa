import type { z } from "zod";
import type * as schemas from "./schemas";

export type AccountType = z.infer<typeof schemas.accountTypeSchema>;
export type DipaRevisionInput = z.infer<typeof schemas.dipaRevisionInputSchema>;
export type RpdDeviationMonth = z.infer<typeof schemas.rpdDeviationMonthSchema>;
export type RpdDeviationInput = z.infer<typeof schemas.rpdDeviationInputSchema>;
export type AbsorptionQuarter = z.infer<typeof schemas.absorptionQuarterSchema>;
export type AbsorptionInput = z.infer<typeof schemas.absorptionInputSchema>;
export type ContractInput = z.infer<typeof schemas.contractInputSchema>;
export type Acceleration53Input = z.infer<
	typeof schemas.acceleration53InputSchema
>;
export type ContractualInput = z.infer<typeof schemas.contractualInputSchema>;
export type InvoiceInput = z.infer<typeof schemas.invoiceInputSchema>;
export type WorkdayCalendar = z.infer<typeof schemas.workdayCalendarSchema>;
export type InvoiceTimelinessInput = z.infer<
	typeof schemas.invoiceTimelinessInputSchema
>;
export type UpTupTransaction = z.infer<typeof schemas.upTupTransactionSchema>;
export type KkpTransaction = z.infer<typeof schemas.kkpTransactionSchema>;
export type UpTupInput = z.infer<typeof schemas.upTupInputSchema>;
export type OutputReport = z.infer<typeof schemas.outputReportSchema>;
export type OutputAchievementInput = z.infer<
	typeof schemas.outputAchievementInputSchema
>;
export type SpmDispensationInput = z.infer<
	typeof schemas.spmDispensationInputSchema
>;
export type EngineInput = z.infer<typeof schemas.engineInputSchema>;

export type FormulaStep = z.infer<typeof schemas.formulaStepSchema>;
export type SubComponent = z.infer<typeof schemas.subComponentSchema>;
export type IndicatorCalculation = z.infer<
	typeof schemas.indicatorCalculationSchema
>;
export type Recommendation = z.infer<typeof schemas.recommendationSchema>;
export type EngineOutput = z.infer<typeof schemas.engineOutputSchema>;

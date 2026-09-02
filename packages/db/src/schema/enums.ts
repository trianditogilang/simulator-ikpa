import { pgEnum } from "drizzle-orm/pg-core";

export const accessTypeEnum = pgEnum("access_type", [
	"operator_satker",
	"admin_kppn",
]);

export const ruleSetStatusEnum = pgEnum("rule_set_status", [
	"draft",
	"published",
	"retired",
]);

export const reminderCategoryEnum = pgEnum("reminder_category", [
	"mandatory",
	"recommended",
	"optional",
]);

export const dayTypeEnum = pgEnum("day_type", [
	"workday",
	"calendar_day",
	"event_based",
	"schedule",
]);

export const paymentTypeEnum = pgEnum("payment_type", ["sekaligus", "termin"]);

export const upTupTypeEnum = pgEnum("up_tup_type", [
	"UP",
	"TUP",
	"GUP",
	"GUP_NIHIL",
	"PTUP",
	"SETORAN_TUP",
]);

export const simulationTypeEnum = pgEnum("simulation_type", [
	"actual",
	"forecast",
	"scenario",
]);

export const deliveryStatusEnum = pgEnum("delivery_status", [
	"scheduled",
	"sent",
	"skipped",
	"failed",
]);

export const importStatusEnum = pgEnum("import_status", [
	"uploaded",
	"validating",
	"validated",
	"committing",
	"completed",
	"failed",
]);

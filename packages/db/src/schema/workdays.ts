import {
	boolean,
	date,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { users } from "./identity";

export const workdays = pgTable(
	"workdays",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		year: integer("year").notNull(),
		date: date("date").notNull(),
		isHoliday: boolean("is_holiday").default(false).notNull(),
		description: text("description"),
		createdBy: uuid("created_by").references(() => users.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("workdays_year_date_idx").on(table.year, table.date),
		index("workdays_date_idx").on(table.date),
		index("workdays_year_idx").on(table.year),
		index("workdays_is_holiday_idx").on(table.isHoliday),
	],
);

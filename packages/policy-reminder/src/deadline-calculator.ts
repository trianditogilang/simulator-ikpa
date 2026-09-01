import { addWorkdays } from "./workday-calendar";
import type { WorkdayCalendar } from "./workday-calendar";

export type DeadlineFormula =
  | { type: "workdays_after_bast"; workdays: number; description?: string }
  | { type: "workdays_after_month_end"; workdays: number; description?: string }
  | { type: "monthly_revolving"; days: number; description?: string }
  | { type: "quarterly_deadline"; description?: string }
  | { type: "end_of_year_schedule"; description?: string }
  | { type: "calendar_day_offset"; days: number; description?: string };

export interface DeadlineContext {
  bastDate?: string; // YYYY-MM-DD
  referenceDate?: string; // for monthly revolving
  month?: number; // 1-12 for monthly
  quarter?: number; // 1-4 for quarterly
  year: number;
}

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 0));
  return d.toISOString().slice(0, 10);
}
function quarterEnd(year: number, quarter: number): string {
  const month = quarter * 3;
  return lastDayOfMonth(year, month);
}
function addCalendarDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

// ponytail: deterministic, bounded, no eval
export function evaluateDeadline(
  formula: DeadlineFormula,
  ctx: DeadlineContext,
  cal: WorkdayCalendar,
): string {
  switch (formula.type) {
    case "workdays_after_bast": {
      if (!ctx.bastDate) throw new Error("bastDate required for workdays_after_bast");
      if (formula.workdays < 0 || formula.workdays > 60) throw new Error("workdays out of bounds 0..60");
      return addWorkdays(ctx.bastDate, formula.workdays, cal);
    }
    case "workdays_after_month_end": {
      const month = ctx.month ?? 12;
      const anchor = lastDayOfMonth(ctx.year, month);
      if (formula.workdays < 0 || formula.workdays > 20) throw new Error("workdays out of bounds");
      return addWorkdays(anchor, formula.workdays, cal);
    }
    case "monthly_revolving": {
      const base = ctx.referenceDate ?? `${ctx.year}-${String(ctx.month ?? 1).padStart(2, "0")}-01`;
      if (formula.days < 1 || formula.days > 60) throw new Error("days out of bounds");
      return addCalendarDays(base, formula.days);
    }
    case "quarterly_deadline": {
      const q = ctx.quarter ?? 1;
      if (q < 1 || q > 4) throw new Error("quarter invalid");
      return quarterEnd(ctx.year, q);
    }
    case "end_of_year_schedule": {
      return `${ctx.year}-12-31`;
    }
    case "calendar_day_offset": {
      const base = ctx.referenceDate ?? `${ctx.year}-01-01`;
      if (formula.days < 0 || formula.days > 366) throw new Error("days out of bounds");
      return addCalendarDays(base, formula.days);
    }
    default:
      throw new Error(`Unknown formula type ${(formula as { type: string }).type}`);
  }
}

// helper to generate all 2026 deadlines for test
export function generate2026Deadlines(cal: WorkdayCalendar): Record<string, string> {
  return {
    // Q1 2026 = 2026-03-31 etc? Quarterly deadline simplified
    dipa_q1: evaluateDeadline({ type: "quarterly_deadline" }, { year: 2026, quarter: 1 }, cal),
    dipa_q2: evaluateDeadline({ type: "quarterly_deadline" }, { year: 2026, quarter: 2 }, cal),
    spm_17: evaluateDeadline({ type: "workdays_after_bast", workdays: 17 }, { year: 2026, bastDate: "2026-01-30" }, cal),
    revolving: evaluateDeadline({ type: "monthly_revolving", days: 30 }, { year: 2026, referenceDate: "2026-01-01" }, cal),
    output_feb: evaluateDeadline({ type: "workdays_after_month_end", workdays: 5 }, { year: 2026, month: 2 }, cal),
    q4_end: evaluateDeadline({ type: "end_of_year_schedule" }, { year: 2026 }, cal),
  };
}

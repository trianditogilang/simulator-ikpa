export interface WorkdayCalendarInput {
	holidays: string[];
	workdays: string[];
	timezone?: string;
}

export function parseIsoDateParts(
	dateStr?: string | null,
): { year: number; month: number; day: number } | null {
	if (!dateStr || typeof dateStr !== "string") return null;
	const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!match) return null;
	const year = parseInt(match[1], 10);
	const month = parseInt(match[2], 10);
	const day = parseInt(match[3], 10);
	if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
		return null;
	}
	return { year, month, day };
}

function toUtcDate(s: string): Date {
	const parts = parseIsoDateParts(s);
	if (!parts) throw new Error(`Invalid ISO date string: ${s}`);
	return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

function toIsoString(d: Date): string {
	const year = d.getUTCFullYear();
	const month = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function isWorkday(
	dateStr: string,
	cal?: Partial<WorkdayCalendarInput> | null,
): boolean {
	const holidays = cal?.holidays ?? [];
	const workdaysList = cal?.workdays ?? [];
	if (workdaysList.includes(dateStr)) return true;
	if (holidays.includes(dateStr)) return false;
	const parts = parseIsoDateParts(dateStr);
	if (!parts) return false;
	const d = toUtcDate(dateStr);
	const dow = d.getUTCDay(); // 0 = Sun, 6 = Sat
	return dow >= 1 && dow <= 5; // Monday to Friday
}

export function addWorkdays(
	startDate: string,
	n: number,
	cal?: Partial<WorkdayCalendarInput> | null,
): string {
	if (n < 0) throw new Error("n must be >= 0");
	if (n === 0) return startDate;
	const cur = toUtcDate(startDate);
	let added = 0;
	let guard = 0;
	while (added < n) {
		if (++guard > 800) throw new Error("addWorkdays bounded exceeded");
		cur.setUTCDate(cur.getUTCDate() + 1);
		const iso = toIsoString(cur);
		if (isWorkday(iso, cal)) added++;
	}
	return toIsoString(cur);
}

export function subtractWorkdays(
	deadline: string,
	n: number,
	cal?: Partial<WorkdayCalendarInput> | null,
): string {
	if (n < 0) throw new Error("n must be >= 0");
	if (n === 0) return deadline;
	const cur = toUtcDate(deadline);
	let sub = 0;
	let guard = 0;
	while (sub < n) {
		if (++guard > 800) throw new Error("subtractWorkdays bounded exceeded");
		cur.setUTCDate(cur.getUTCDate() - 1);
		const iso = toIsoString(cur);
		if (isWorkday(iso, cal)) sub++;
	}
	return toIsoString(cur);
}

export function countWorkdays(
	start: string,
	end: string,
	cal?: Partial<WorkdayCalendarInput> | null,
): number {
	// Start exclusive, end inclusive
	if (start === end) return 0;
	const s = toUtcDate(start);
	const e = toUtcDate(end);
	if (e < s) throw new Error("end date cannot be before start date");
	const cur = new Date(s.getTime());
	let cnt = 0;
	let guard = 0;
	while (true) {
		if (++guard > 800) throw new Error("countWorkdays bounded exceeded");
		cur.setUTCDate(cur.getUTCDate() + 1);
		if (cur > e) break;
		const iso = toIsoString(cur);
		if (isWorkday(iso, cal)) cnt++;
		if (toIsoString(cur) === end) break;
	}
	return cnt;
}

export function calculateFifthWorkingDayOfNextMonth(
	year: number,
	reportingMonth: number,
	cal?: Partial<WorkdayCalendarInput> | null,
): string {
	const anchorDate = new Date(Date.UTC(year, reportingMonth, 0));
	const anchorIso = toIsoString(anchorDate);
	return addWorkdays(anchorIso, 5, cal);
}

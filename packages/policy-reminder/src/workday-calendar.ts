export interface WorkdayCalendar {
  holidays: string[]; // YYYY-MM-DD where isWorkday=false (weekday holiday)
  workdays: string[]; // YYYY-MM-DD where isWorkday=true (weekend override)
  timezone?: string;
}

function toDate(s: string): Date {
  // parse as UTC midnight to avoid TZ shift; LocalDate handling
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fromDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function dayOfWeek(s: string): number {
  return toDate(s).getUTCDay(); // 0 Sun .. 6 Sat
}

export function isWorkday(dateStr: string, cal: WorkdayCalendar): boolean {
  if (cal.workdays.includes(dateStr)) return true;
  if (cal.holidays.includes(dateStr)) return false;
  const dow = dayOfWeek(dateStr);
  return dow >= 1 && dow <= 5; // Mon-Fri
}

// ponytail: bounded loop, 366*2 max to prevent infinite if calendar marks all days holiday
export function addWorkdays(startDate: string, n: number, cal: WorkdayCalendar): string {
  if (n < 0) throw new Error("n must be >=0");
  if (n === 0) return startDate;
  let cur = toDate(startDate);
  let added = 0;
  let guard = 0;
  while (added < n) {
    if (++guard > 800) throw new Error("addWorkdays bounded exceeded");
    cur.setUTCDate(cur.getUTCDate() + 1);
    const iso = fromDate(cur);
    if (isWorkday(iso, cal)) added++;
  }
  return fromDate(cur);
}

export function subtractWorkdays(deadline: string, n: number, cal: WorkdayCalendar): string {
  if (n < 0) throw new Error("n must be >=0");
  if (n === 0) return deadline;
  let cur = toDate(deadline);
  let sub = 0;
  let guard = 0;
  while (sub < n) {
    if (++guard > 800) throw new Error("subtractWorkdays bounded exceeded");
    cur.setUTCDate(cur.getUTCDate() - 1);
    const iso = fromDate(cur);
    if (isWorkday(iso, cal)) sub++;
  }
  return fromDate(cur);
}

export function countWorkdays(start: string, end: string, cal: WorkdayCalendar): number {
  // start exclusive, end inclusive per ADR-001
  if (start === end) return 0;
  const s = toDate(start);
  const e = toDate(end);
  if (e < s) throw new Error("end before start invalid");
  let cur = new Date(s);
  let cnt = 0;
  let guard = 0;
  while (true) {
    if (++guard > 800) throw new Error("countWorkdays bounded exceeded");
    cur.setUTCDate(cur.getUTCDate() + 1);
    if (cur > e) break;
    const iso = fromDate(cur);
    if (isWorkday(iso, cal)) cnt++;
    if (fromDate(cur) === end) break;
  }
  return cnt;
}

export function isHoliday(dateStr: string, cal: WorkdayCalendar): boolean {
  return !isWorkday(dateStr, cal);
}

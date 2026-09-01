import { describe, expect, it } from "vitest";
import { addWorkdays, countWorkdays, isWorkday, subtractWorkdays } from "./workday-calendar";

const calEmpty = { holidays: [], workdays: [] };
const calExampleA = { holidays: [], workdays: [] }; // no holiday

describe("workday-calendar", () => {
  it("isWorkday Mon-Fri true, Sat-Sun false", () => {
    expect(isWorkday("2026-01-30", calEmpty)).toBe(true); // Fri
    expect(isWorkday("2026-01-31", calEmpty)).toBe(false); // Sat
    expect(isWorkday("2026-02-01", calEmpty)).toBe(false); // Sun
    expect(isWorkday("2026-02-02", calEmpty)).toBe(true); // Mon
  });
  it("holiday override weekday false", () => {
    const cal = { holidays: ["2026-02-17"], workdays: [] };
    expect(isWorkday("2026-02-17", cal)).toBe(false);
  });
  it("weekend override true", () => {
    const cal = { holidays: [], workdays: ["2026-02-07"] }; // Sat
    expect(isWorkday("2026-02-07", cal)).toBe(true);
  });
  it("addWorkdays example A BAST 2026-01-30 +17 = 2026-02-24", () => {
    expect(addWorkdays("2026-01-30", 17, calExampleA)).toBe("2026-02-24");
  });
  it("subtractWorkdays H-5 from 2026-02-24 = 2026-02-17", () => {
    expect(subtractWorkdays("2026-02-24", 5, calExampleA)).toBe("2026-02-17");
  });
  it("countWorkdays start exclusive end inclusive", () => {
    expect(countWorkdays("2026-01-30", "2026-02-24", calExampleA)).toBe(17);
    expect(countWorkdays("2026-02-24", "2026-02-24", calExampleA)).toBe(0);
  });
  it("holiday shifts deadline 2026-02-17 holiday => 2026-02-25", () => {
    const cal = { holidays: ["2026-02-17"], workdays: [] };
    expect(addWorkdays("2026-01-30", 17, cal)).toBe("2026-02-25");
  });
  it("weekend workday accelerates deadline", () => {
    const cal = { holidays: [], workdays: ["2026-02-07"] };
    expect(addWorkdays("2026-01-30", 17, cal)).toBe("2026-02-23");
  });
  it("BAST on Sunday 2026-02-01 add 1 => Mon 2026-02-02", () => {
    expect(addWorkdays("2026-02-01", 1, calEmpty)).toBe("2026-02-02");
  });
  it("throws on end before start", () => {
    expect(() => countWorkdays("2026-02-24", "2026-01-30", calEmpty)).toThrow();
  });
});

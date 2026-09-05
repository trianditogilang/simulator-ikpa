import { expect, test } from "vitest";
import { default2026RuleSet } from "@simulator-ikpa/ikpa-engine";
import {
  classifyRevision,
  countObjek,
  previewRevisi,
} from "./revisi-dipa-workspace";

const CODES = default2026RuleSet.revisionEligibilityCodes;
const FY = 2026;

test("golden XYZ: S1=1 S2=3 → 80", async () => {
  const { calcRevisiScore } = await import("./revisi-dipa-workspace");
  const s = calcRevisiScore(1, 3);
  expect(s.nkraS1).toBe(110);
  expect(s.nkraS2).toBe(50);
  expect(s.annual).toBe(80);
  expect(s.contribution).toBe(8);
});

test("kode 212 pagu tetap → objek; 315/325 → bukan; 221 pagu naik → bukan", () => {
  expect(
    classifyRevision(
      { revisionDate: "2026-03-01", revisionCode: "212", paguBefore: "100.00", paguAfter: "100.00" },
      CODES,
      FY,
    ).isObjek,
  ).toBe(true);
  expect(
    classifyRevision(
      { revisionDate: "2026-03-01", revisionCode: "315, 325", paguBefore: "100.00", paguAfter: "100.00" },
      CODES,
      FY,
    ).reason,
  ).toBe("kode-luar");
  expect(
    classifyRevision(
      { revisionDate: "2026-08-01", revisionCode: "221", paguBefore: "100.00", paguAfter: "200.00" },
      CODES,
      FY,
    ).reason,
  ).toBe("pagu-berubah");
});

test("0 objek → 110; DIPA-AWAL saja → 0 objek", () => {
  const empty = countObjek([], CODES, FY);
  expect([empty.s1, empty.s2]).toEqual([0, 0]);
  const awal = countObjek(
    [{ revisionDate: "2026-01-02", revisionCode: "DIPA-AWAL", paguBefore: "1.00", paguAfter: "1.00" }],
    CODES,
    FY,
  );
  expect([awal.s1, awal.s2]).toEqual([0, 0]);
  expect(awal.classified[0].reason).toBe("awal");
});

test("multi-kode + tanggal luar TA diabaikan", () => {
  const p = previewRevisi(
    { revisionDate: "2026-04-01", revisionCode: "999 212", paguBefore: "5.00", paguAfter: "5.00" },
    CODES,
    FY,
  );
  expect(p.isObjek).toBe(true);
  const luar = countObjek(
    [{ revisionDate: "2025-12-01", revisionCode: "212", paguBefore: "5.00", paguAfter: "5.00" }],
    CODES,
    FY,
  );
  expect([luar.s1, luar.s2]).toEqual([0, 0]);
});

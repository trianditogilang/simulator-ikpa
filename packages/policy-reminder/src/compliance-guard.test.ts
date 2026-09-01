import { describe, expect, it } from "vitest";
import { checkCompliance } from "./compliance-guard";

const mandatoryPolicy = {
  id: "p1",
  eventType: "spm_ls_contract_17d",
  category: "mandatory" as const,
  dayType: "workday" as const,
  allowedLeadDays: [10, 5, 2],
  requiredRecipientsJson: ["ppk", "bendahara"],
  allowDisable: false,
  allowRecipientOverride: true,
  isActive: true,
};

describe("compliance-guard", () => {
  it("passes valid config", () => {
    expect(checkCompliance(mandatoryPolicy, { enabled: true, scheduleLeadDays: [10, 5], recipients: ["ppk", "bendahara"] })).toEqual([]);
  });
  it("rejects mandatory disabled", () => {
    const e = checkCompliance(mandatoryPolicy, { enabled: false, recipients: ["ppk", "bendahara"] });
    expect(e.some(x => x.code === "MANDATORY_LOCK")).toBe(true);
  });
  it("rejects lead not allowed", () => {
    const e = checkCompliance(mandatoryPolicy, { enabled: true, scheduleLeadDays: [7], recipients: ["ppk", "bendahara"] });
    expect(e.some(x => x.code === "LEAD_NOT_ALLOWED")).toBe(true);
  });
  it("rejects missing required recipient", () => {
    const e = checkCompliance(mandatoryPolicy, { enabled: true, recipients: ["ppk"] });
    expect(e.some(x => x.code === "REQUIRED_RECIPIENT_MISSING")).toBe(true);
  });
  it("rejects inactive policy enabled", () => {
    expect(checkCompliance({ ...mandatoryPolicy, isActive: false }, { enabled: true, recipients: ["ppk", "bendahara"] }).some(x => x.code === "POLICY_INACTIVE")).toBe(true);
  });
});

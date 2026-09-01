import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReminderEmail, reminderEmailText } from "./reminder-email";

describe("reminder-email", () => {
  const base = {
    eventType: "spm_ls_contract_17d",
    satkerCode: "411782",
    satkerName: "KPPN Jakarta II",
    deadline: "2026-02-24",
    dayType: "workday" as const,
    actionLabel: "Sampaikan SPM-LS sebelum H+17",
    secureLink: "https://simulator-ikpa.vercel.app/operator/data/contracts-invoices",
    sourceRegulation: "PER-5/PB/2024",
    ruleSetVersion: "2026.1",
    leadDays: 2,
  };
  it("renders event, satker, deadline, action, link, source/version", () => {
    const html = renderToStaticMarkup(ReminderEmail(base));
    expect(html).toContain("spm_ls_contract_17d");
    expect(html).toContain("411782");
    expect(html).toContain("2026-02-24");
    expect(html).toContain("workday");
    expect(html).toContain("Sampaikan SPM");
    expect(html).toContain("https://simulator-ikpa.vercel.app");
    expect(html).toContain("PER-5/PB/2024");
    expect(html).toContain("2026.1");
  });
  it("sanitizes custom message", () => {
    const html = renderToStaticMarkup(ReminderEmail({ ...base, customMessage: '<script>alert(1)</script> hello' }));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
  it("text fallback contains required context", () => {
    const txt = reminderEmailText(base);
    expect(txt).toContain("411782");
    expect(txt).toContain("2026-02-24");
  });
});

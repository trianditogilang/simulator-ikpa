function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export interface ReminderEmailProps {
  eventType: string;
  satkerCode: string;
  satkerName: string;
  deadline: string; // YYYY-MM-DD
  dayType: "workday" | "calendar_day" | string;
  actionLabel: string;
  secureLink: string; // must be https
  sourceRegulation: string;
  ruleSetVersion: string;
  customMessage?: string | null;
  leadDays?: number;
}

export function ReminderEmail(props: ReminderEmailProps) {
  const safeCustom = props.customMessage ? escapeHtml(props.customMessage) : null;
  const link = props.secureLink.startsWith("https://") ? props.secureLink : `https://${props.secureLink}`;
  return (
    <html lang="id">
      <body style={{ fontFamily: "Inter, sans-serif", background: "#f8fafc", padding: 24 }}>
        <div style={{ maxWidth: 560, margin: "0 auto", background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 24 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>Pengingat IKPA: {props.eventType}</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>
            Satker {props.satkerCode} — {props.satkerName}
          </p>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <tbody>
              <tr><td style={{ padding: "6px 0", color: "#64748b" }}>Deadline</td><td style={{ padding: "6px 0", fontWeight: 600 }}>{props.deadline} ({props.dayType}) {props.leadDays !== undefined ? `H-${props.leadDays}` : ""}</td></tr>
              <tr><td style={{ padding: "6px 0", color: "#64748b" }}>Aksi</td><td style={{ padding: "6px 0" }}>{props.actionLabel}</td></tr>
              <tr><td style={{ padding: "6px 0", color: "#64748b" }}>Sumber</td><td style={{ padding: "6px 0" }}>{props.sourceRegulation} v{props.ruleSetVersion}</td></tr>
            </tbody>
          </table>
          {safeCustom && (
            <div style={{ marginTop: 16, padding: 12, background: "#f1f5f9", borderRadius: 8, fontSize: 13 }} dangerouslySetInnerHTML={{ __html: safeCustom }} />
          )}
          <a href={link} style={{ display: "inline-block", marginTop: 16, background: "#0f172a", color: "#fff", padding: "10px 18px", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
            Buka Simulator IKPA
          </a>
          <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 16 }}>Link aman akan kadaluarsa dalam 24 jam. Jangan bagikan link ini.</p>
        </div>
      </body>
    </html>
  );
}

// text fallback for email clients that strip html
export function reminderEmailText(props: ReminderEmailProps): string {
  return `Pengingat IKPA: ${props.eventType}\nSatker ${props.satkerCode} - ${props.satkerName}\nDeadline: ${props.deadline} (${props.dayType}) H-${props.leadDays ?? "-"}\nAksi: ${props.actionLabel}\nLink: ${props.secureLink}\nSumber: ${props.sourceRegulation} v${props.ruleSetVersion}\n${props.customMessage ? `Pesan: ${props.customMessage}` : ""}`;
}

export interface DigestItem {
  eventType: string;
  deadline: string;
  priority: "high" | "medium" | "low";
  actionLabel: string;
}
export interface DigestEmailProps {
  satkerCode: string;
  satkerName: string;
  date: string; // YYYY-MM-DD
  items: DigestItem[];
  secureLink: string;
  ruleSetVersion: string;
}

export function DigestEmail(props: DigestEmailProps) {
  const grouped = {
    high: props.items.filter(i => i.priority === "high"),
    medium: props.items.filter(i => i.priority === "medium"),
    low: props.items.filter(i => i.priority === "low"),
  };
  return (
    <html lang="id">
      <body style={{ fontFamily: "Inter, sans-serif", background: "#f8fafc", padding: 24 }}>
        <div style={{ maxWidth: 560, margin: "0 auto", background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 24 }}>
          <h1 style={{ fontSize: 16, fontWeight: 700 }}>Ringkasan Harian IKPA — {props.date}</h1>
          <p style={{ fontSize: 13, color: "#64748b" }}>{props.satkerCode} — {props.satkerName} • v{props.ruleSetVersion}</p>
          {(["high", "medium", "low"] as const).map(prio => grouped[prio].length > 0 && (
            <div key={prio} style={{ marginTop: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", color: prio === "high" ? "#dc2626" : prio === "medium" ? "#d97706" : "#64748b" }}>{prio} priority ({grouped[prio].length})</h3>
              <ul style={{ fontSize: 12, paddingLeft: 16 }}>
                {grouped[prio].map((it, idx) => (
                  <li key={idx}>{it.eventType} — deadline {it.deadline} — {it.actionLabel}</li>
                ))}
              </ul>
            </div>
          ))}
          <a href={props.secureLink} style={{ display: "inline-block", marginTop: 16, background: "#0f172a", color: "#fff", padding: "10px 18px", borderRadius: 8, textDecoration: "none", fontSize: 13 }}>Buka Dashboard</a>
          <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 12 }}>Email diges tidak mengandung data sensitif. Detail lengkap di aplikasi.</p>
        </div>
      </body>
    </html>
  );
}

export function digestEmailText(props: DigestEmailProps): string {
  return `Digest ${props.date} ${props.satkerCode}\n` + props.items.map(i => `${i.priority.toUpperCase()} ${i.eventType} deadline ${i.deadline}`).join("\n") + `\nLink: ${props.secureLink}`;
}

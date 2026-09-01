export interface EscalationEmailProps {
  satkerCode: string;
  satkerName: string;
  eventType: string;
  deadline: string;
  daysOverdue: number;
  riskLabel: string;
  secureLink: string;
  ruleSetVersion: string;
  kppnName: string;
}

export function EscalationEmail(props: EscalationEmailProps) {
  return (
    <html lang="id">
      <body style={{ fontFamily: "Inter, sans-serif", background: "#fef2f2", padding: 24 }}>
        <div style={{ maxWidth: 560, margin: "0 auto", background: "#fff", borderRadius: 12, border: "1px solid #fecaca", padding: 24 }}>
          <h1 style={{ fontSize: 16, fontWeight: 800, color: "#dc2626" }}>Eskalasi — {props.eventType} lewat deadline</h1>
          <p style={{ fontSize: 13, color: "#64748b" }}>{props.satkerCode} — {props.satkerName} • {props.kppnName} • v{props.ruleSetVersion}</p>
          <table style={{ width: "100%", fontSize: 13, marginTop: 12, borderCollapse: "collapse" }}>
            <tbody>
              <tr><td style={{ padding: "6px 0", color: "#64748b" }}>Deadline</td><td style={{ fontWeight: 700 }}>{props.deadline}</td></tr>
              <tr><td style={{ padding: "6px 0", color: "#64748b" }}>Keterlambatan</td><td style={{ fontWeight: 700, color: "#dc2626" }}>{props.daysOverdue} hari</td></tr>
              <tr><td style={{ padding: "6px 0", color: "#64748b" }}>Risiko</td><td>{props.riskLabel}</td></tr>
            </tbody>
          </table>
          <a href={props.secureLink} style={{ display: "inline-block", marginTop: 16, background: "#dc2626", color: "#fff", padding: "10px 18px", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 700 }}>Tindakan Segera</a>
          <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 12 }}>Notifikasi eskalasi hanya untuk penanggung jawab yang berwenang.</p>
        </div>
      </body>
    </html>
  );
}

export function escalationEmailText(props: EscalationEmailProps): string {
  return `Eskalasi ${props.eventType} ${props.satkerCode} deadline ${props.deadline} terlambat ${props.daysOverdue} hari. Link: ${props.secureLink}`;
}

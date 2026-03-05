import { useState, useEffect } from "react";
import ThreatTable from "../components/ThreatTable";
import { MOCK } from "../services/api";

const SEV_STYLE = {
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)" },
  high:     { color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.3)" },
  medium:   { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
  low:      { color: "#6b7280", bg: "rgba(107,114,128,0.12)", border: "rgba(107,114,128,0.3)" },
};

function DetailPanel({ threat, onClose }) {
  if (!threat) return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      color: "#374151", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px",
      gap: "12px",
    }}>
      <div style={{ fontSize: "32px", opacity: 0.3 }}>◇</div>
      <p>Select a threat to inspect</p>
    </div>
  );

  const cfg = SEV_STYLE[threat.severity] || SEV_STYLE.low;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#4b5563" }}>{threat.id}</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", fontSize: "16px" }}>✕</button>
      </div>

      <div style={{
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        borderRadius: "6px", padding: "14px 16px", marginBottom: "16px",
      }}>
        <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "15px", fontWeight: 700, color: cfg.color, margin: "0 0 4px" }}>{threat.type}</p>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: cfg.color, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {threat.severity} severity
        </span>
      </div>

      {[
        ["SOURCE IP", threat.ip, "#00f5c4"],
        ["ENDPOINT", threat.endpoint, "#e5e7eb"],
        ["CONFIDENCE", `${threat.confidence}%`, threat.confidence > 85 ? "#ef4444" : "#f59e0b"],
        ["STATUS", threat.status, "#a78bfa"],
        ["DETECTED", new Date(threat.timestamp).toLocaleString(), "#6b7280"],
      ].map(([label, val, color]) => (
        <div key={label} style={{ marginBottom: "12px" }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#4b5563", letterSpacing: "0.12em", marginBottom: "4px" }}>{label}</p>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color, margin: 0 }}>{val}</p>
        </div>
      ))}

      {/* AI Reasoning */}
      <div style={{ marginTop: "8px" }}>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#4b5563", letterSpacing: "0.12em", marginBottom: "8px" }}>
          ◈ AGENT REASONING
        </p>
        <div style={{
          background: "rgba(0,0,0,0.4)",
          border: "1px solid rgba(0,245,196,0.1)",
          borderRadius: "4px",
          padding: "12px",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "10px",
          color: "#9ca3af",
          lineHeight: 1.7,
        }}>
          {threat.reasoning || "Anomalous request pattern detected. Confidence score derived from behavioral baseline deviation analysis."}
        </div>
      </div>

      {/* Actions */}
      <div style={{ marginTop: "auto", paddingTop: "20px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {[
          ["Block IP", "#ef4444"],
          ["Throttle", "#f97316"],
          ["Dismiss", "#6b7280"],
          ["Resolve", "#00f5c4"],
        ].map(([label, color]) => (
          <button key={label} style={{
            flex: 1, background: `${color}15`,
            border: `1px solid ${color}33`, color,
            borderRadius: "4px", padding: "8px 12px",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "10px", cursor: "pointer", letterSpacing: "0.06em",
            transition: "all 0.2s",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${color}25`; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = `${color}15`; }}
          >{label}</button>
        ))}
      </div>
    </div>
  );
}

export default function ThreatExplorer() {
  const [threats] = useState(() => MOCK.threats());
  const [selected, setSelected] = useState(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "16px" }}>
      <div>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, color: "#e5e7eb", margin: 0 }}>Threat Explorer</h1>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#4b5563", marginTop: "4px" }}>
          {threats.length} total events · click any row to inspect
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "16px", flex: 1, minHeight: 0 }}>
        {/* Table */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "8px", padding: "20px",
          overflow: "auto",
        }}>
          <ThreatTable data={threats} onSelect={setSelected} />
        </div>

        {/* Detail panel */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "8px", padding: "20px",
          overflow: "auto",
        }}>
          <DetailPanel threat={selected} onClose={() => setSelected(null)} />
        </div>
      </div>
    </div>
  );
}

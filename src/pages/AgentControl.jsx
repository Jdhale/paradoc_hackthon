import { useState, useEffect } from "react";
import AgentStatusBadge from "../components/AgentStatusBadge";
import socket from "../services/socket";

const MODES = [
  { id: "active", label: "ACTIVE", desc: "Agent detects and autonomously acts — blocks IPs, throttles, sends alerts." },
  { id: "learning", label: "LEARNING", desc: "Agent observes and learns patterns. No automatic blocking. Alerts only." },
  { id: "passive", label: "PASSIVE", desc: "Agent logs anomalies. No alerts, no actions. Pure monitoring mode." },
];

function Toggle({ label, value, onChange }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#9ca3af" }}>{label}</span>
      <div onClick={() => onChange(!value)} style={{
        width: "40px", height: "20px", borderRadius: "10px",
        background: value ? "rgba(0,245,196,0.3)" : "rgba(255,255,255,0.08)",
        border: `1px solid ${value ? "rgba(0,245,196,0.5)" : "rgba(255,255,255,0.12)"}`,
        cursor: "pointer", position: "relative", transition: "all 0.3s",
      }}>
        <div style={{
          width: "14px", height: "14px", borderRadius: "50%",
          background: value ? "#00f5c4" : "#4b5563",
          position: "absolute", top: "2px",
          left: value ? "22px" : "3px",
          transition: "all 0.3s",
        }} />
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step = 1, unit = "", onChange }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#9ca3af" }}>{label}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#00f5c4" }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#00f5c4", cursor: "pointer" }}
      />
    </div>
  );
}

function DecisionLog({ decisions }) {
  const ACTION_COLOR = { BLOCK_IP: "#ef4444", ALERT: "#f59e0b", THROTTLE: "#f97316", LOG: "#6b7280" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "320px", overflowY: "auto" }}>
      {decisions.map((d, i) => (
        <div key={i} style={{
          display: "grid", gridTemplateColumns: "80px 80px 1fr 60px",
          gap: "12px", alignItems: "center",
          padding: "8px 12px",
          background: "rgba(255,255,255,0.02)",
          borderLeft: `2px solid ${ACTION_COLOR[d.action] || "#6b7280"}`,
          borderRadius: "2px",
          fontFamily: "'JetBrains Mono', monospace", fontSize: "10px",
          animation: i === 0 ? "feedSlide 0.3s ease" : "none",
        }}>
          <span style={{ color: ACTION_COLOR[d.action] || "#6b7280", fontWeight: 700 }}>{d.action}</span>
          <span style={{ color: "#00f5c4" }}>{d.target}</span>
          <span style={{ color: "#4b5563", fontSize: "9px" }}>{new Date(d.timestamp).toLocaleTimeString()}</span>
          <span style={{ color: "#6b7280", textAlign: "right" }}>{d.confidence}%</span>
        </div>
      ))}
      {decisions.length === 0 && (
        <div style={{ color: "#374151", fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", padding: "20px", textAlign: "center" }}>
          No decisions yet...
        </div>
      )}
    </div>
  );
}

export default function AgentControl() {
  const [mode, setMode] = useState("active");
  const [config, setConfig] = useState({
    autoBlock: true,
    alertOnHigh: true,
    alertOnMedium: false,
    logAll: true,
    adaptiveThreshold: true,
    sensitivityScore: 72,
    blockThreshold: 85,
    rateLimit: 500,
    retentionDays: 30,
  });
  const [decisions, setDecisions] = useState([]);
  const [retraining, setRetraining] = useState(false);

  useEffect(() => {
    const unsub = socket.on("agent_decision", (d) => {
      setDecisions((prev) => [d, ...prev].slice(0, 100));
    });
    return unsub;
  }, []);

  const cfg = (key, val) => setConfig((c) => ({ ...c, [key]: val }));

  const handleRetrain = () => {
    setRetraining(true);
    setTimeout(() => setRetraining(false), 3000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, color: "#e5e7eb", margin: 0 }}>Agent Control</h1>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#4b5563", marginTop: "4px" }}>Configure and command the AI agent</p>
        </div>
        <AgentStatusBadge mode={mode} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        {/* Mode selector */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "22px" }}>
          <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#4b5563", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "16px" }}>
            ◈ Agent Mode
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {MODES.map((m) => (
              <div key={m.id} onClick={() => setMode(m.id)} style={{
                background: mode === m.id ? "rgba(0,245,196,0.07)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${mode === m.id ? "rgba(0,245,196,0.3)" : "rgba(255,255,255,0.06)"}`,
                borderRadius: "6px", padding: "14px 16px", cursor: "pointer",
                transition: "all 0.2s",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", fontWeight: 700, color: mode === m.id ? "#00f5c4" : "#9ca3af", letterSpacing: "0.08em" }}>
                    {m.label}
                  </span>
                  {mode === m.id && <span style={{ color: "#00f5c4", fontSize: "12px" }}>✓</span>}
                </div>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#4b5563", margin: 0, lineHeight: 1.6 }}>{m.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "22px" }}>
          <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#4b5563", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "8px" }}>
            ◈ Behaviours
          </h3>
          <Toggle label="Auto-block IPs" value={config.autoBlock} onChange={(v) => cfg("autoBlock", v)} />
          <Toggle label="Alert on High severity" value={config.alertOnHigh} onChange={(v) => cfg("alertOnHigh", v)} />
          <Toggle label="Alert on Medium severity" value={config.alertOnMedium} onChange={(v) => cfg("alertOnMedium", v)} />
          <Toggle label="Log all traffic" value={config.logAll} onChange={(v) => cfg("logAll", v)} />
          <Toggle label="Adaptive thresholds" value={config.adaptiveThreshold} onChange={(v) => cfg("adaptiveThreshold", v)} />
        </div>

        {/* Thresholds */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "22px" }}>
          <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#4b5563", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "16px" }}>
            ◈ Thresholds
          </h3>
          <Slider label="Detection Sensitivity" value={config.sensitivityScore} min={0} max={100} unit="%" onChange={(v) => cfg("sensitivityScore", v)} />
          <Slider label="Auto-block Confidence" value={config.blockThreshold} min={50} max={100} unit="%" onChange={(v) => cfg("blockThreshold", v)} />
          <Slider label="Rate Limit (req/min)" value={config.rateLimit} min={100} max={5000} step={50} unit="" onChange={(v) => cfg("rateLimit", v)} />
          <Slider label="Data Retention (days)" value={config.retentionDays} min={1} max={365} unit="d" onChange={(v) => cfg("retentionDays", v)} />
        </div>

        {/* Retrain */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "22px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#4b5563", letterSpacing: "0.15em", textTransform: "uppercase", margin: 0 }}>
            ◈ Model Management
          </h3>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#6b7280", lineHeight: 1.7 }}>
            Last trained: <span style={{ color: "#9ca3af" }}>2h ago</span><br />
            Training samples: <span style={{ color: "#9ca3af" }}>128,430</span><br />
            Model accuracy: <span style={{ color: "#00f5c4" }}>94.7%</span><br />
            False positive rate: <span style={{ color: "#f59e0b" }}>2.1%</span>
          </div>
          <button onClick={handleRetrain} disabled={retraining} style={{
            background: retraining ? "rgba(0,245,196,0.05)" : "rgba(0,245,196,0.1)",
            border: "1px solid rgba(0,245,196,0.3)",
            color: "#00f5c4", borderRadius: "6px", padding: "10px 20px",
            fontFamily: "'JetBrains Mono', monospace", fontSize: "11px",
            cursor: retraining ? "not-allowed" : "pointer", letterSpacing: "0.08em",
            transition: "all 0.2s",
          }}>
            {retraining ? "⟳ RETRAINING..." : "⟳ TRIGGER RETRAIN"}
          </button>
          {retraining && (
            <div style={{ background: "rgba(0,245,196,0.05)", border: "1px solid rgba(0,245,196,0.1)", borderRadius: "4px", padding: "10px 14px" }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#00f5c4", marginBottom: "6px" }}>Training in progress...</div>
              <div style={{ height: "3px", background: "rgba(0,245,196,0.15)", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{ height: "100%", background: "#00f5c4", animation: "trainProgress 3s ease-out forwards" }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Decision log */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#4b5563", letterSpacing: "0.15em", textTransform: "uppercase", margin: 0 }}>
            ◈ Agent Decision Log
          </h3>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#4b5563" }}>{decisions.length} entries</span>
        </div>
        <DecisionLog decisions={decisions} />
      </div>

      <style>{`
        @keyframes feedSlide { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes trainProgress { from { width:0%; } to { width:100%; } }
      `}</style>
    </div>
  );
}

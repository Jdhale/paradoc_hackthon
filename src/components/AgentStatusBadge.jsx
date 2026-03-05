import { useState, useEffect } from "react";
import socket from "../services/socket";

const MODES = {
  active: { label: "ACTIVE", color: "#00f5c4", pulse: true, icon: "⬡" },
  learning: { label: "LEARNING", color: "#f5c400", pulse: true, icon: "◈" },
  passive: { label: "PASSIVE", color: "#6b7280", pulse: false, icon: "◇" },
  offline: { label: "OFFLINE", color: "#ef4444", pulse: false, icon: "✕" },
};

export default function AgentStatusBadge({ mode = "active", showDetails = false }) {
  const [decision, setDecision] = useState(null);
  const [blip, setBlip] = useState(false);
  const cfg = MODES[mode] || MODES.active;

  useEffect(() => {
    const unsub = socket.on("agent_decision", (d) => {
      setDecision(d);
      setBlip(true);
      setTimeout(() => setBlip(false), 600);
    });
    return unsub;
  }, []);

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
      {/* Core badge */}
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        background: "rgba(0,0,0,0.6)",
        border: `1px solid ${cfg.color}44`,
        borderRadius: "4px",
        padding: "6px 12px",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "11px",
        letterSpacing: "0.15em",
        color: cfg.color,
        transition: "all 0.3s ease",
        boxShadow: blip ? `0 0 20px ${cfg.color}66` : `0 0 8px ${cfg.color}22`,
      }}>
        {/* Pulse dot */}
        <div style={{ position: "relative", width: "8px", height: "8px" }}>
          <div style={{
            width: "8px", height: "8px",
            borderRadius: "50%",
            background: cfg.color,
          }} />
          {cfg.pulse && (
            <div style={{
              position: "absolute", top: "-2px", left: "-2px",
              width: "12px", height: "12px",
              borderRadius: "50%",
              border: `1px solid ${cfg.color}`,
              animation: "agentPulse 2s ease-out infinite",
            }} />
          )}
        </div>

        <span style={{ opacity: 0.5 }}>{cfg.icon}</span>
        <span>AGENT</span>
        <span style={{ opacity: 0.4 }}>|</span>
        <span style={{ fontWeight: 700 }}>{cfg.label}</span>
      </div>

      {/* Last decision chip */}
      {showDetails && decision && (
        <div style={{
          background: "rgba(0,245,196,0.05)",
          border: "1px solid rgba(0,245,196,0.15)",
          borderRadius: "4px",
          padding: "4px 10px",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "10px",
          color: "#6b7280",
          maxWidth: "220px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          <span style={{ color: "#00f5c4", marginRight: "6px" }}>▸</span>
          {decision.action} · {decision.target}
        </div>
      )}

      <style>{`
        @keyframes agentPulse {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

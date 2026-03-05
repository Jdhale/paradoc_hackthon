import { useState, useEffect, useRef } from "react";
import socket from "../services/socket";

const SEV_CONFIG = {
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.1)", label: "CRIT" },
  high:     { color: "#f97316", bg: "rgba(249,115,22,0.1)", label: "HIGH" },
  medium:   { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: " MED" },
  low:      { color: "#6b7280", bg: "rgba(107,114,128,0.1)", label: " LOW" },
};

const ACTION_ICONS = {
  BLOCK_IP: "⊗",
  ALERT: "△",
  THROTTLE: "⊘",
  LOG: "◈",
};

export default function ThreatFeed({ maxItems = 20 }) {
  const [items, setItems] = useState([]);
  const feedRef = useRef(null);
  const isUserScrolling = useRef(false);

  useEffect(() => {
    // Seed with a few initial items
    const seed = Array.from({ length: 5 }, (_, i) => ({
      id: `seed-${i}`,
      type: ["Credential Abuse", "Payload Injection", "Rate Limit Abuse"][i % 3],
      severity: ["critical", "high", "medium", "low"][i % 4],
      ip: "45.142.212.100",
      endpoint: "/api/auth/login",
      timestamp: new Date(Date.now() - i * 30000).toISOString(),
      action: ["BLOCK_IP", "ALERT", "THROTTLE"][i % 3],
    }));
    setItems(seed.reverse());

    const unsubThreat = socket.on("threat_detected", (threat) => {
      setItems((prev) => [{ ...threat, isNew: true }, ...prev].slice(0, maxItems));
    });

    const unsubDecision = socket.on("agent_decision", (dec) => {
      setItems((prev) => prev.map((item, idx) =>
        idx === 0 ? { ...item, action: dec.action, isNew: false } : item
      ));
    });

    return () => { unsubThreat(); unsubDecision(); };
  }, [maxItems]);

  const sev = (s) => SEV_CONFIG[s] || SEV_CONFIG.low;
  const timeAgo = (ts) => {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  return (
    <div
      ref={feedRef}
      style={{
        display: "flex", flexDirection: "column", gap: "2px",
        maxHeight: "100%", overflowY: "auto",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(0,245,196,0.2) transparent",
      }}
    >
      {items.length === 0 && (
        <div style={{ color: "#4b5563", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", padding: "20px", textAlign: "center" }}>
          Awaiting threats...
        </div>
      )}

      {items.map((item, idx) => {
        const cfg = sev(item.severity);
        return (
          <div
            key={item.id || idx}
            style={{
              display: "grid",
              gridTemplateColumns: "42px 1fr auto",
              gap: "10px",
              alignItems: "start",
              padding: "8px 10px",
              background: item.isNew ? cfg.bg : "rgba(255,255,255,0.015)",
              borderLeft: `2px solid ${cfg.color}`,
              borderRadius: "2px",
              transition: "background 1s ease",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "10px",
              animation: item.isNew ? "feedSlide 0.3s ease-out" : "none",
            }}
          >
            {/* Severity badge */}
            <div style={{
              background: cfg.bg,
              color: cfg.color,
              border: `1px solid ${cfg.color}44`,
              borderRadius: "2px",
              padding: "2px 4px",
              fontSize: "9px",
              fontWeight: 700,
              textAlign: "center",
              letterSpacing: "0.05em",
            }}>
              {cfg.label}
            </div>

            {/* Content */}
            <div>
              <div style={{ color: "#e5e7eb", marginBottom: "3px", fontSize: "11px" }}>
                {item.type}
              </div>
              <div style={{ color: "#6b7280" }}>
                <span style={{ color: "#00f5c4" }}>{item.ip}</span>
                <span style={{ margin: "0 6px", opacity: 0.4 }}>→</span>
                <span>{item.endpoint}</span>
              </div>
            </div>

            {/* Right: time + action */}
            <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: "3px", alignItems: "flex-end" }}>
              <span style={{ color: "#4b5563", fontSize: "9px" }}>{timeAgo(item.timestamp)}</span>
              {item.action && (
                <span style={{ color: "#00f5c4", fontSize: "9px", opacity: 0.7 }}>
                  {ACTION_ICONS[item.action] || "◈"} {item.action}
                </span>
              )}
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes feedSlide {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

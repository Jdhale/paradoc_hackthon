import { useState, useEffect } from "react";
import TrafficGraph from "../components/TrafficGraph";
import WorldMap from "../components/WorldMap";
import ThreatFeed from "../components/ThreatFeed";
import AgentStatusBadge from "../components/AgentStatusBadge";
import socket from "../services/socket";

const StatCard = ({ label, value, sub, accent = "#00f5c4", delta }) => (
  <div style={{
    background: "rgba(255,255,255,0.025)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "6px",
    padding: "20px 22px",
    position: "relative",
    overflow: "hidden",
  }}>
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: "1px",
      background: `linear-gradient(90deg, transparent, ${accent}66, transparent)`,
    }} />
    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", letterSpacing: "0.15em", color: "#4b5563", marginBottom: "10px", textTransform: "uppercase" }}>{label}</p>
    <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "28px", fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</p>
    {sub && <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#6b7280", marginTop: "6px" }}>{sub}</p>}
    {delta !== undefined && (
      <span style={{
        position: "absolute", top: "18px", right: "16px",
        fontFamily: "'JetBrains Mono', monospace", fontSize: "10px",
        color: delta > 0 ? "#ef4444" : "#00f5c4",
      }}>{delta > 0 ? "▲" : "▼"} {Math.abs(delta)}%</span>
    )}
  </div>
);

export default function Dashboard() {
  const [stats, setStats] = useState({ rps: 347, blocked: 23, threats: 7, uptime: "99.8%" });
  const [agentMode] = useState("active");

  useEffect(() => {
    const unsub = socket.on("traffic_tick", (tick) => {
      setStats((prev) => ({
        ...prev,
        rps: tick.rps || prev.rps,
        blocked: prev.blocked + (tick.blocked > 60 ? 1 : 0),
      }));
    });
    const unsubT = socket.on("threat_detected", () => {
      setStats((prev) => ({ ...prev, threats: prev.threats + 1 }));
    });
    return () => { unsub(); unsubT(); };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, color: "#e5e7eb", margin: 0 }}>
            Command Center
          </h1>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#4b5563", marginTop: "4px" }}>
            LIVE · {new Date().toUTCString().slice(0, 25)} UTC
          </p>
        </div>
        <AgentStatusBadge mode={agentMode} showDetails />
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
        <StatCard label="Requests / sec" value={stats.rps} sub="last 60s average" accent="#00f5c4" delta={-4} />
        <StatCard label="Threats detected" value={stats.threats} sub="last 24 hours" accent="#ef4444" delta={12} />
        <StatCard label="IPs Blocked" value={stats.blocked} sub="auto-blocked by agent" accent="#f97316" />
        <StatCard label="System Uptime" value={stats.uptime} sub="30-day rolling" accent="#a78bfa" />
      </div>

      {/* Traffic graph */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "8px",
        padding: "20px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "0.15em", color: "#6b7280", textTransform: "uppercase", margin: 0 }}>
            ◈ Live Traffic Monitor
          </h2>
          <div style={{ display: "flex", gap: "16px" }}>
            {[["#00f5c4", "Requests"], ["#ef4444", "Blocked"], ["#f59e0b", "Anomalies"]].map(([c, l]) => (
              <span key={l} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#4b5563", display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: "20px", height: "2px", background: c, display: "inline-block", borderRadius: "2px" }} />
                {l}
              </span>
            ))}
          </div>
        </div>
        <TrafficGraph height={180} />
      </div>

      {/* Map + Feed row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "16px" }}>
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "8px",
          overflow: "hidden",
        }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <h2 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "0.15em", color: "#6b7280", textTransform: "uppercase", margin: 0 }}>
              ◈ Global Attack Origins
            </h2>
          </div>
          <WorldMap />
        </div>

        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "8px",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
            <h2 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "0.15em", color: "#6b7280", textTransform: "uppercase", margin: 0 }}>
              ◈ Live Threat Feed
            </h2>
          </div>
          <div style={{ flex: 1, overflow: "hidden", padding: "8px" }}>
            <ThreatFeed maxItems={15} />
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { MOCK } from "../services/api";

const RISK_CFG = {
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)" },
  high:     { color: "#f97316", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.3)" },
  medium:   { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)" },
  low:      { color: "#00f5c4", bg: "rgba(0,245,196,0.07)", border: "rgba(0,245,196,0.2)" },
};

const METHOD_COLORS = { GET: "#00f5c4", POST: "#f97316", PUT: "#a78bfa", DELETE: "#ef4444", PATCH: "#f59e0b" };

function EndpointCard({ ep, onClick, selected }) {
  const risk = RISK_CFG[ep.risk] || RISK_CFG.low;
  const mColor = METHOD_COLORS[ep.method] || "#6b7280";

  return (
    <div onClick={() => onClick(ep)} style={{
      background: selected ? "rgba(0,245,196,0.04)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${selected ? "rgba(0,245,196,0.25)" : "rgba(255,255,255,0.06)"}`,
      borderLeft: `3px solid ${risk.color}`,
      borderRadius: "6px", padding: "16px 18px",
      cursor: "pointer", transition: "all 0.2s",
    }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = "rgba(255,255,255,0.035)"; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
        <div>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: "9px",
            color: mColor, background: `${mColor}15`,
            border: `1px solid ${mColor}33`, borderRadius: "3px",
            padding: "2px 6px", marginRight: "8px", letterSpacing: "0.06em",
          }}>{ep.method}</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#e5e7eb" }}>{ep.path}</span>
        </div>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: "9px",
          color: risk.color, background: risk.bg,
          border: `1px solid ${risk.border}`, borderRadius: "3px",
          padding: "2px 6px", textTransform: "uppercase", letterSpacing: "0.08em",
        }}>{ep.risk}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
        {[
          ["RPS", ep.rps, "#6b7280"],
          ["Error Rate", `${ep.errorRate}%`, ep.errorRate > 10 ? "#ef4444" : ep.errorRate > 3 ? "#f59e0b" : "#00f5c4"],
          ["24h Calls", ep.calls24h.toLocaleString(), "#9ca3af"],
        ].map(([label, val, color]) => (
          <div key={label}>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "8px", color: "#4b5563", marginBottom: "2px", letterSpacing: "0.1em" }}>{label}</p>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color, margin: 0, fontWeight: 700 }}>{val}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ApiInventory() {
  const [endpoints] = useState(() => MOCK.endpoints());
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? endpoints : endpoints.filter((e) => e.risk === filter);

  const chartData = endpoints.map((e) => ({
    name: e.path.replace("/api/", ""),
    calls: e.calls24h,
    errors: Math.round(e.calls24h * e.errorRate / 100),
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, color: "#e5e7eb", margin: 0 }}>
          API Inventory
        </h1>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#4b5563", marginTop: "4px" }}>
          {endpoints.length} monitored endpoints
        </p>
      </div>

      {/* Charts row */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "8px", padding: "20px",
      }}>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#4b5563", letterSpacing: "0.15em", marginBottom: "14px" }}>
          ◈ 24H CALL VOLUME
        </p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData} barGap={2}>
            <XAxis dataKey="name" tick={{ fill: "#4b5563", fontSize: 9, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#4b5563", fontSize: 9, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#0a0e1a", border: "1px solid rgba(0,245,196,0.2)", borderRadius: "4px", fontFamily: "JetBrains Mono", fontSize: "10px" }}
              labelStyle={{ color: "#6b7280" }}
            />
            <Bar dataKey="calls" fill="#00f5c433" stroke="#00f5c4" strokeWidth={1} radius={[2, 2, 0, 0]} name="Calls" />
            <Bar dataKey="errors" fill="#ef444433" stroke="#ef4444" strokeWidth={1} radius={[2, 2, 0, 0]} name="Errors" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filter pills */}
      <div style={{ display: "flex", gap: "8px" }}>
        {["all", "critical", "high", "medium", "low"].map((r) => {
          const cfg = RISK_CFG[r] || { color: "#00f5c4", bg: "rgba(0,245,196,0.08)", border: "rgba(0,245,196,0.2)" };
          const active = filter === r;
          return (
            <button key={r} onClick={() => setFilter(r)} style={{
              background: active ? cfg.bg : "rgba(255,255,255,0.02)",
              border: `1px solid ${active ? cfg.border : "rgba(255,255,255,0.06)"}`,
              color: active ? cfg.color : "#4b5563",
              borderRadius: "4px", padding: "5px 14px",
              fontFamily: "'JetBrains Mono', monospace", fontSize: "10px",
              cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em",
            }}>{r}</button>
          );
        })}
      </div>

      {/* Endpoint grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "12px" }}>
        {filtered.map((ep) => (
          <EndpointCard key={ep.id} ep={ep} onClick={setSelected} selected={selected?.id === ep.id} />
        ))}
      </div>

      {/* Selected endpoint detail */}
      {selected && (
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(0,245,196,0.15)",
          borderRadius: "8px", padding: "24px",
          animation: "fadeIn 0.2s ease",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
            <h3 style={{ fontFamily: "'JetBrains Mono', monospace", color: "#00f5c4", fontSize: "13px", margin: 0 }}>
              {selected.method} {selected.path}
            </h3>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer" }}>✕</button>
          </div>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#6b7280", lineHeight: 1.7 }}>
            This endpoint has been active for the last 24 hours with <span style={{ color: "#e5e7eb" }}>{selected.calls24h.toLocaleString()} calls</span>.
            Current error rate is <span style={{ color: selected.errorRate > 10 ? "#ef4444" : "#f59e0b" }}>{selected.errorRate}%</span>.
            Risk classification: <span style={{ color: RISK_CFG[selected.risk]?.color }}>{selected.risk.toUpperCase()}</span>.
          </p>
        </div>
      )}
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(4px) } to { opacity:1; transform:translateY(0) } }`}</style>
    </div>
  );
}

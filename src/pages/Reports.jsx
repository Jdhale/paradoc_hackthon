import { useState } from "react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const RANGES = ["24h", "7d", "30d", "90d"];

// Mock data generators
const genTrendData = (days) => Array.from({ length: days }, (_, i) => ({
  day: `Day ${i + 1}`,
  threats: Math.floor(Math.random() * 50 + 10),
  blocked: Math.floor(Math.random() * 40 + 5),
  resolved: Math.floor(Math.random() * 30 + 8),
}));

const pieData = [
  { name: "Credential Abuse", value: 38, color: "#ef4444" },
  { name: "Payload Injection", value: 24, color: "#f97316" },
  { name: "Rate Limit Abuse", value: 19, color: "#f59e0b" },
  { name: "Port Scanning", value: 12, color: "#a78bfa" },
  { name: "Other", value: 7, color: "#6b7280" },
];

const topIPs = [
  { ip: "45.142.212.100", country: "RU", attacks: 342, blocked: true },
  { ip: "103.21.244.0", country: "CN", attacks: 218, blocked: true },
  { ip: "185.220.101.45", country: "DE", attacks: 187, blocked: false },
  { ip: "91.108.4.32", country: "NL", attacks: 134, blocked: true },
  { ip: "198.54.117.200", country: "US", attacks: 98, blocked: false },
];

const CustomTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0a0e1a", border: "1px solid rgba(0,245,196,0.2)", borderRadius: "4px", padding: "10px 14px", fontFamily: "'JetBrains Mono', monospace", fontSize: "10px" }}>
      <p style={{ color: "#4b5563", marginBottom: "6px" }}>{label}</p>
      {payload.map((p) => <p key={p.name} style={{ color: p.color, margin: "2px 0" }}>{p.name}: <strong>{p.value}</strong></p>)}
    </div>
  );
};

function SummaryCard({ label, value, change, accent = "#00f5c4" }) {
  const pos = change >= 0;
  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "20px 22px" }}>
      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#4b5563", letterSpacing: "0.12em", marginBottom: "10px", textTransform: "uppercase" }}>{label}</p>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "26px", fontWeight: 800, color: accent, margin: "0 0 6px" }}>{value}</p>
      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: pos ? "#ef4444" : "#00f5c4", margin: 0 }}>
        {pos ? "▲" : "▼"} {Math.abs(change)}% vs prev period
      </p>
    </div>
  );
}

export default function Reports() {
  const [range, setRange] = useState("7d");
  const days = range === "24h" ? 24 : range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const trendData = genTrendData(Math.min(days, 30));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, color: "#e5e7eb", margin: 0 }}>Reports & Analytics</h1>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#4b5563", marginTop: "4px" }}>Security insights and trend analysis</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "4px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "6px", padding: "4px" }}>
            {RANGES.map((r) => (
              <button key={r} onClick={() => setRange(r)} style={{
                background: range === r ? "rgba(0,245,196,0.15)" : "transparent",
                border: range === r ? "1px solid rgba(0,245,196,0.3)" : "1px solid transparent",
                color: range === r ? "#00f5c4" : "#6b7280",
                borderRadius: "4px", padding: "4px 12px",
                fontFamily: "'JetBrains Mono', monospace", fontSize: "10px",
                cursor: "pointer", transition: "all 0.2s",
              }}>{r}</button>
            ))}
          </div>
          <button style={{
            background: "rgba(0,245,196,0.1)", border: "1px solid rgba(0,245,196,0.3)",
            color: "#00f5c4", borderRadius: "6px", padding: "8px 16px",
            fontFamily: "'JetBrains Mono', monospace", fontSize: "10px",
            cursor: "pointer", letterSpacing: "0.06em",
          }}>↓ Export PDF</button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
        <SummaryCard label="Total Threats" value="1,247" change={18} accent="#ef4444" />
        <SummaryCard label="Auto-blocked" value="892" change={-4} accent="#f97316" />
        <SummaryCard label="Mean Time to Detect" value="1.4s" change={-31} accent="#00f5c4" />
        <SummaryCard label="Agent Accuracy" value="94.7%" change={2} accent="#a78bfa" />
        <SummaryCard label="False Positives" value="26" change={-11} accent="#f59e0b" />
      </div>

      {/* Trend chart */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "22px" }}>
        <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#4b5563", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "16px" }}>
          ◈ Threat Trend · {range}
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="day" tick={{ fill: "#4b5563", fontSize: 9, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} interval={Math.floor(trendData.length / 6)} />
            <YAxis tick={{ fill: "#4b5563", fontSize: 9, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTip />} />
            <Legend wrapperStyle={{ fontFamily: "JetBrains Mono", fontSize: "9px", color: "#6b7280" }} />
            <Line type="monotone" dataKey="threats" stroke="#ef4444" strokeWidth={2} dot={false} name="Threats" />
            <Line type="monotone" dataKey="blocked" stroke="#f97316" strokeWidth={2} dot={false} name="Blocked" />
            <Line type="monotone" dataKey="resolved" stroke="#00f5c4" strokeWidth={2} dot={false} name="Resolved" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Pie + Top IPs row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        {/* Threat breakdown */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "22px" }}>
          <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#4b5563", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "16px" }}>
            ◈ Threat Type Breakdown
          </h3>
          <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} fillOpacity={0.85} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
              {pieData.map((d) => (
                <div key={d.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: d.color }} />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#9ca3af" }}>{d.name}</span>
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: d.color, fontWeight: 700 }}>{d.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top attacker IPs */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "22px" }}>
          <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#4b5563", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "16px" }}>
            ◈ Top Attacking IPs
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {topIPs.map((ip, i) => (
              <div key={ip.ip} style={{
                display: "grid", gridTemplateColumns: "18px 1fr auto 60px",
                gap: "12px", alignItems: "center",
                padding: "10px 12px",
                background: "rgba(255,255,255,0.02)",
                borderRadius: "4px",
                fontFamily: "'JetBrains Mono', monospace", fontSize: "10px",
              }}>
                <span style={{ color: "#374151" }}>#{i + 1}</span>
                <div>
                  <p style={{ color: "#00f5c4", margin: 0 }}>{ip.ip}</p>
                  <p style={{ color: "#4b5563", margin: 0, fontSize: "9px" }}>{ip.country}</p>
                </div>
                <span style={{ color: "#e5e7eb" }}>{ip.attacks} attacks</span>
                <span style={{
                  textAlign: "center",
                  color: ip.blocked ? "#ef4444" : "#6b7280",
                  background: ip.blocked ? "rgba(239,68,68,0.1)" : "rgba(107,114,128,0.1)",
                  border: `1px solid ${ip.blocked ? "rgba(239,68,68,0.3)" : "rgba(107,114,128,0.2)"}`,
                  borderRadius: "3px", padding: "2px 6px", fontSize: "9px",
                }}>
                  {ip.blocked ? "BLOCKED" : "ACTIVE"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

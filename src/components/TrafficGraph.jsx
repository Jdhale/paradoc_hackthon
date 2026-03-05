import { useState, useEffect, useRef } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import socket from "../services/socket";
import { MOCK } from "../services/api";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#0a0e1a",
      border: "1px solid rgba(0,245,196,0.3)",
      borderRadius: "4px",
      padding: "10px 14px",
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: "11px",
    }}>
      <p style={{ color: "#6b7280", marginBottom: "6px" }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color, margin: "2px 0" }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

export default function TrafficGraph({ height = 200 }) {
  const [data, setData] = useState(() => MOCK.trafficTimeSeries().slice(-30));
  const maxPoints = 60;

  useEffect(() => {
    const unsub = socket.on("traffic_tick", (tick) => {
      setData((prev) => {
        const next = [...prev, {
          time: new Date(tick.timestamp).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          requests: tick.requests,
          blocked: tick.blocked,
          anomalies: tick.anomalies,
        }];
        return next.slice(-maxPoints);
      });
    });
    return unsub;
  }, []);

  const formatted = data.map((d) => ({
    ...d,
    time: typeof d.time === "string" && d.time.includes("T")
      ? new Date(d.time).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })
      : d.time,
  }));

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradReq" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00f5c4" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#00f5c4" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradBlocked" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradAnom" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="time"
            tick={{ fill: "#4b5563", fontSize: 9, fontFamily: "JetBrains Mono" }}
            tickLine={false}
            axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
            interval={Math.floor(formatted.length / 6)}
          />
          <YAxis
            tick={{ fill: "#4b5563", fontSize: 9, fontFamily: "JetBrains Mono" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="requests" name="Requests" stroke="#00f5c4" strokeWidth={1.5} fill="url(#gradReq)" dot={false} />
          <Area type="monotone" dataKey="blocked" name="Blocked" stroke="#ef4444" strokeWidth={1.5} fill="url(#gradBlocked)" dot={false} />
          <Area type="monotone" dataKey="anomalies" name="Anomalies" stroke="#f59e0b" strokeWidth={1.5} fill="url(#gradAnom)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

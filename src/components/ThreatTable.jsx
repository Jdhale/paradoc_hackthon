import { useState, useMemo } from "react";

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const SEV_STYLE = {
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)" },
  high:     { color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.3)" },
  medium:   { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
  low:      { color: "#6b7280", bg: "rgba(107,114,128,0.12)", border: "rgba(107,114,128,0.3)" },
};
const STATUS_STYLE = {
  active:        { color: "#ef4444" },
  investigating: { color: "#f59e0b" },
  resolved:      { color: "#00f5c4" },
};

export default function ThreatTable({ data = [], onSelect }) {
  const [sortKey, setSortKey] = useState("timestamp");
  const [sortDir, setSortDir] = useState("desc");
  const [filter, setFilter] = useState({ severity: "all", status: "all", search: "" });
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(0);
  const PER_PAGE = 10;

  const sorted = useMemo(() => {
    let rows = [...data].filter((r) => {
      if (filter.severity !== "all" && r.severity !== filter.severity) return false;
      if (filter.status !== "all" && r.status !== filter.status) return false;
      if (filter.search && !JSON.stringify(r).toLowerCase().includes(filter.search.toLowerCase())) return false;
      return true;
    });
    rows.sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (sortKey === "severity") { va = SEV_ORDER[va] ?? 9; vb = SEV_ORDER[vb] ?? 9; }
      if (sortKey === "timestamp") { va = new Date(va).getTime(); vb = new Date(vb).getTime(); }
      return sortDir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
    return rows;
  }, [data, sortKey, sortDir, filter]);

  const paged = sorted.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.ceil(sorted.length / PER_PAGE);

  const setSort = (key) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
    setPage(0);
  };

  const thStyle = (key) => ({
    padding: "8px 12px",
    textAlign: "left",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "9px",
    letterSpacing: "0.12em",
    color: sortKey === key ? "#00f5c4" : "#4b5563",
    cursor: "pointer",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    userSelect: "none",
    whiteSpace: "nowrap",
  });

  const selectRow = (row) => {
    setSelected(row.id);
    onSelect?.(row);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Filters */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <input
          placeholder="Search threats..."
          value={filter.search}
          onChange={(e) => { setFilter((f) => ({ ...f, search: e.target.value })); setPage(0); }}
          style={{
            flex: 1, minWidth: "160px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "4px",
            padding: "6px 12px",
            color: "#e5e7eb",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "11px",
            outline: "none",
          }}
        />
        {["all", "critical", "high", "medium", "low"].map((s) => (
          <button key={s} onClick={() => { setFilter((f) => ({ ...f, severity: s })); setPage(0); }}
            style={{
              background: filter.severity === s ? "rgba(0,245,196,0.1)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${filter.severity === s ? "rgba(0,245,196,0.4)" : "rgba(255,255,255,0.08)"}`,
              color: filter.severity === s ? "#00f5c4" : "#6b7280",
              borderRadius: "4px", padding: "5px 12px",
              fontFamily: "'JetBrains Mono', monospace", fontSize: "10px",
              cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em",
            }}
          >{s}</button>
        ))}
        {["all", "active", "investigating", "resolved"].map((s) => (
          <button key={s} onClick={() => { setFilter((f) => ({ ...f, status: s })); setPage(0); }}
            style={{
              background: filter.status === s ? "rgba(0,245,196,0.08)" : "rgba(255,255,255,0.02)",
              border: `1px solid ${filter.status === s ? "rgba(0,245,196,0.3)" : "rgba(255,255,255,0.06)"}`,
              color: filter.status === s ? "#00f5c4" : "#4b5563",
              borderRadius: "4px", padding: "5px 12px",
              fontFamily: "'JetBrains Mono', monospace", fontSize: "10px",
              cursor: "pointer",
            }}
          >{s}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.06)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {[["id", "ID"], ["severity", "SEV"], ["type", "TYPE"], ["ip", "SOURCE IP"], ["endpoint", "ENDPOINT"],
                ["confidence", "CONF"], ["status", "STATUS"], ["timestamp", "TIME"]].map(([key, label]) => (
                <th key={key} style={thStyle(key)} onClick={() => setSort(key)}>
                  {label} {sortKey === key ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </th>
              ))}
              <th style={{ ...thStyle("_"), cursor: "default" }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((row) => {
              const sevCfg = SEV_STYLE[row.severity] || SEV_STYLE.low;
              const statCfg = STATUS_STYLE[row.status] || { color: "#6b7280" };
              const isSelected = selected === row.id;
              return (
                <tr key={row.id}
                  onClick={() => selectRow(row)}
                  style={{
                    background: isSelected ? "rgba(0,245,196,0.05)" : "transparent",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => !isSelected && (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={(e) => !isSelected && (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#4b5563" }}>{row.id}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{
                      background: sevCfg.bg, color: sevCfg.color,
                      border: `1px solid ${sevCfg.border}`,
                      borderRadius: "3px", padding: "2px 6px",
                      fontFamily: "'JetBrains Mono', monospace", fontSize: "9px",
                      fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                    }}>{row.severity}</span>
                  </td>
                  <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#d1d5db" }}>{row.type}</td>
                  <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#00f5c4" }}>{row.ip}</td>
                  <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#9ca3af" }}>{row.endpoint}</td>
                  <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: row.confidence > 85 ? "#ef4444" : "#f59e0b" }}>
                    {row.confidence}%
                  </td>
                  <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: statCfg.color, textTransform: "capitalize" }}>
                    {row.status}
                  </td>
                  <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#4b5563" }}>
                    {new Date(row.timestamp).toLocaleTimeString()}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={(e) => { e.stopPropagation(); }} style={actionBtnStyle("#ef4444")}>Block</button>
                      <button onClick={(e) => { e.stopPropagation(); }} style={actionBtnStyle("#6b7280")}>Dismiss</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#4b5563" }}>
          {sorted.length} threats · page {page + 1}/{Math.max(1, totalPages)}
        </span>
        <div style={{ display: "flex", gap: "6px" }}>
          {["← prev", "next →"].map((label, i) => (
            <button key={label}
              onClick={() => setPage((p) => i === 0 ? Math.max(0, p - 1) : Math.min(totalPages - 1, p + 1))}
              disabled={i === 0 ? page === 0 : page >= totalPages - 1}
              style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                color: "#6b7280", borderRadius: "4px", padding: "5px 12px",
                fontFamily: "'JetBrains Mono', monospace", fontSize: "10px",
                cursor: "pointer", opacity: (i === 0 ? page === 0 : page >= totalPages - 1) ? 0.4 : 1,
              }}
            >{label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

const actionBtnStyle = (color) => ({
  background: `${color}15`,
  border: `1px solid ${color}33`,
  color, borderRadius: "3px", padding: "3px 8px",
  fontFamily: "'JetBrains Mono', monospace", fontSize: "9px",
  cursor: "pointer", letterSpacing: "0.05em",
});

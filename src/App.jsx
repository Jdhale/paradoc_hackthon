import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Dashboard from "./pages/Dashboard";
import ThreatExplorer from "./pages/ThreatExplorer";
import ApiInventory from "./pages/ApiInventory";
import AgentControl from "./pages/AgentControl";
import Reports from "./pages/Reports";
import AgentStatusBadge from "./components/AgentStatusBadge";
import socket from "./services/socket";

// ─── Google Fonts ──────────────────────────────────────────────────────────
const FontLoader = () => (
  <link
    href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap"
    rel="stylesheet"
  />
);

// ─── Login Screen ──────────────────────────────────────────────────────────
function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@sentinel.ai");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    const res = await login(email, password);
    if (!res.success) setError(res.error);
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#060a14",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'JetBrains Mono', monospace",
      position: "relative", overflow: "hidden",
    }}>
      {/* Background grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(0,245,196,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,245,196,0.04) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />
      <div style={{
        position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)",
        width: "600px", height: "600px",
        background: "radial-gradient(circle, rgba(0,245,196,0.04) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{
        width: "400px", position: "relative", zIndex: 1,
        background: "rgba(6,10,20,0.9)",
        border: "1px solid rgba(0,245,196,0.15)",
        borderRadius: "12px",
        padding: "40px",
        backdropFilter: "blur(20px)",
        boxShadow: "0 0 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,245,196,0.05)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <div style={{ fontSize: "32px", marginBottom: "10px" }}>⬡</div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 900, color: "#e5e7eb", margin: 0, letterSpacing: "-0.02em" }}>
            SENTINEL AI
          </h1>
          <p style={{ fontSize: "9px", color: "#4b5563", letterSpacing: "0.2em", marginTop: "6px" }}>
            API THREAT INTELLIGENCE PLATFORM
          </p>
        </div>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {[
            { label: "EMAIL", value: email, setter: setEmail, type: "email" },
            { label: "PASSWORD", value: password, setter: setPassword, type: "password" },
          ].map(({ label, value, setter, type }) => (
            <div key={label}>
              <label style={{ fontSize: "9px", color: "#4b5563", letterSpacing: "0.15em", display: "block", marginBottom: "6px" }}>{label}</label>
              <input
                type={type} value={value}
                onChange={(e) => setter(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "6px", padding: "10px 14px",
                  color: "#e5e7eb", fontSize: "12px",
                  fontFamily: "'JetBrains Mono', monospace",
                  outline: "none", transition: "border-color 0.2s",
                }}
                onFocus={(e) => e.target.style.borderColor = "rgba(0,245,196,0.4)"}
                onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
              />
            </div>
          ))}

          {error && <p style={{ color: "#ef4444", fontSize: "10px", margin: 0 }}>{error}</p>}

          <button onClick={handleLogin} disabled={loading} style={{
            marginTop: "8px",
            background: loading ? "rgba(0,245,196,0.05)" : "rgba(0,245,196,0.12)",
            border: "1px solid rgba(0,245,196,0.35)",
            color: "#00f5c4", borderRadius: "6px", padding: "12px",
            fontFamily: "'JetBrains Mono', monospace", fontSize: "11px",
            cursor: loading ? "not-allowed" : "pointer",
            letterSpacing: "0.15em", transition: "all 0.2s",
          }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.background = "rgba(0,245,196,0.2)")}
            onMouseLeave={(e) => !loading && (e.currentTarget.style.background = "rgba(0,245,196,0.12)")}
          >
            {loading ? "AUTHENTICATING..." : "ACCESS SYSTEM"}
          </button>
        </div>

        <p style={{ textAlign: "center", fontSize: "9px", color: "#374151", marginTop: "24px" }}>
          Demo: use any email/password
        </p>
      </div>
    </div>
  );
}

// ─── Nav Item ──────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "◈" },
  { id: "threats", label: "Threats", icon: "△" },
  { id: "inventory", label: "API Inventory", icon: "⊞" },
  { id: "agent", label: "Agent Control", icon: "⬡" },
  { id: "reports", label: "Reports", icon: "▦" },
];

function NavItem({ item, active, onClick, alertCount }) {
  return (
    <button onClick={() => onClick(item.id)} style={{
      display: "flex", alignItems: "center", gap: "10px",
      width: "100%", padding: "9px 14px",
      background: active ? "rgba(0,245,196,0.08)" : "transparent",
      border: `1px solid ${active ? "rgba(0,245,196,0.2)" : "transparent"}`,
      borderRadius: "6px",
      color: active ? "#00f5c4" : "#6b7280",
      fontFamily: "'JetBrains Mono', monospace", fontSize: "11px",
      cursor: "pointer", textAlign: "left",
      transition: "all 0.2s", position: "relative",
    }}
      onMouseEnter={(e) => !active && (e.currentTarget.style.color = "#9ca3af")}
      onMouseLeave={(e) => !active && (e.currentTarget.style.color = "#6b7280")}
    >
      <span style={{ fontSize: "13px", opacity: active ? 1 : 0.7 }}>{item.icon}</span>
      <span>{item.label}</span>
      {alertCount > 0 && (
        <span style={{
          marginLeft: "auto",
          background: "#ef4444", color: "white",
          borderRadius: "10px", padding: "1px 6px",
          fontSize: "8px", fontWeight: 700,
        }}>{alertCount}</span>
      )}
    </button>
  );
}

// ─── Main App Shell ────────────────────────────────────────────────────────
function AppShell() {
  const { user, logout } = useAuth();
  const [page, setPage] = useState("dashboard");
  const [threatCount, setThreatCount] = useState(7);

  useEffect(() => {
    socket.connect(user?.token || "");
    const unsub = socket.on("threat_detected", () => setThreatCount((n) => n + 1));
    return () => { unsub(); socket.disconnect(); };
  }, [user]);

  const PAGES = {
    dashboard: <Dashboard />,
    threats: <ThreatExplorer />,
    inventory: <ApiInventory />,
    agent: <AgentControl />,
    reports: <Reports />,
  };

  return (
    <div style={{
      display: "flex", minHeight: "100vh",
      background: "#060a14", color: "#e5e7eb",
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      {/* Sidebar */}
      <aside style={{
        width: "220px", flexShrink: 0,
        borderRight: "1px solid rgba(255,255,255,0.05)",
        padding: "24px 14px",
        display: "flex", flexDirection: "column",
        background: "rgba(0,0,0,0.2)",
      }}>
        {/* Logo */}
        <div style={{ marginBottom: "32px", padding: "0 4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "28px", height: "28px", borderRadius: "6px",
              background: "rgba(0,245,196,0.12)",
              border: "1px solid rgba(0,245,196,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "14px", color: "#00f5c4",
            }}>⬡</div>
            <div>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "13px", fontWeight: 900, color: "#e5e7eb", margin: 0, letterSpacing: "-0.02em" }}>SENTINEL</p>
              <p style={{ fontSize: "8px", color: "#374151", margin: 0, letterSpacing: "0.15em" }}>AI PLATFORM</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
          <p style={{ fontSize: "8px", color: "#374151", letterSpacing: "0.15em", padding: "0 6px", marginBottom: "6px" }}>NAVIGATION</p>
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.id} item={item}
              active={page === item.id}
              onClick={(id) => { setPage(id); if (id === "threats") setThreatCount(0); }}
              alertCount={item.id === "threats" ? threatCount : 0}
            />
          ))}
        </nav>

        {/* User */}
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.05)",
          paddingTop: "16px", marginTop: "16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
            <div style={{
              width: "30px", height: "30px", borderRadius: "50%",
              background: "rgba(0,245,196,0.15)",
              border: "1px solid rgba(0,245,196,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "12px", fontWeight: 700, color: "#00f5c4",
            }}>{user?.avatar}</div>
            <div>
              <p style={{ fontSize: "11px", color: "#e5e7eb", margin: 0 }}>{user?.name}</p>
              <p style={{ fontSize: "9px", color: "#4b5563", margin: 0 }}>{user?.role}</p>
            </div>
          </div>
          <button onClick={logout} style={{
            width: "100%", background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "#4b5563", borderRadius: "4px", padding: "7px",
            fontFamily: "'JetBrains Mono', monospace", fontSize: "10px",
            cursor: "pointer", letterSpacing: "0.08em",
            transition: "all 0.2s",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#9ca3af"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#4b5563"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
          >SIGN OUT</button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{
        flex: 1, overflow: "auto", padding: "28px 28px 40px",
        scrollbarWidth: "thin", scrollbarColor: "rgba(0,245,196,0.15) transparent",
      }}>
        {PAGES[page] || <Dashboard />}
      </main>
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────
function AuthGate() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#060a14", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#00f5c4", letterSpacing: "0.2em" }}>
        INITIALIZING...
      </div>
    </div>
  );
  return user ? <AppShell /> : <LoginScreen />;
}

export default function App() {
  return (
    <>
      <FontLoader />
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #060a14; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,245,196,0.2); border-radius: 2px; }
        input[type=range] { height: 3px; }
      `}</style>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </>
  );
}

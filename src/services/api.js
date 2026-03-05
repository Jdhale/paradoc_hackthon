const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

const getToken = () => {
  try {
    const user = JSON.parse(localStorage.getItem("sentinel_user") || "{}");
    return user.token || "";
  } catch { return ""; }
};

const request = async (path, options = {}) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);
  return res.json();
};

// ── Traffic ────────────────────────────────────────────────────────────────
export const getTrafficStats = (range = "1h") => request(`/traffic?range=${range}`);
export const getTrafficTimeSeries = (range = "1h") => request(`/traffic/timeseries?range=${range}`);

// ── Threats ────────────────────────────────────────────────────────────────
export const getThreats = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return request(`/threats?${q}`);
};
export const getThreatById = (id) => request(`/threats/${id}`);
export const dismissThreat = (id) => request(`/threats/${id}/dismiss`, { method: "POST" });
export const resolveThreat = (id) => request(`/threats/${id}/resolve`, { method: "POST" });

// ── IP Management ──────────────────────────────────────────────────────────
export const blockIP = (ip, reason) => request("/ip/block", { method: "POST", body: JSON.stringify({ ip, reason }) });
export const unblockIP = (ip) => request(`/ip/${ip}/unblock`, { method: "POST" });
export const getIPReputation = (ip) => request(`/ip/${ip}/reputation`);

// ── API Inventory ──────────────────────────────────────────────────────────
export const getEndpoints = () => request("/endpoints");
export const getEndpointStats = (id) => request(`/endpoints/${id}/stats`);

// ── Agent ──────────────────────────────────────────────────────────────────
export const getAgentStatus = () => request("/agent/status");
export const setAgentMode = (mode) => request("/agent/mode", { method: "POST", body: JSON.stringify({ mode }) });
export const getAgentDecisions = (limit = 50) => request(`/agent/decisions?limit=${limit}`);
export const updateAgentConfig = (cfg) => request("/agent/config", { method: "PUT", body: JSON.stringify(cfg) });
export const triggerRetrain = () => request("/agent/retrain", { method: "POST" });

// ── Reports ────────────────────────────────────────────────────────────────
export const getReportSummary = (range = "7d") => request(`/reports/summary?range=${range}`);
export const exportReport = (format = "pdf") => request(`/reports/export?format=${format}`);

// ── Mock data generators (used as fallback) ────────────────────────────────
export const MOCK = {
  trafficTimeSeries: () => {
    const now = Date.now();
    return Array.from({ length: 60 }, (_, i) => ({
      time: new Date(now - (59 - i) * 60000).toISOString(),
      requests: Math.floor(Math.random() * 800 + 200),
      blocked: Math.floor(Math.random() * 80),
      anomalies: Math.floor(Math.random() * 30),
    }));
  },
  threats: () => {
    const types = ["Credential Abuse", "Payload Injection", "Rate Limit Abuse", "Scanning", "DDoS"];
    const severities = ["critical", "high", "medium", "low"];
    const statuses = ["active", "investigating", "resolved"];
    const ips = ["45.142.212.100", "103.21.244.0", "185.220.101.45", "91.108.4.32", "198.54.117.200"];
    return Array.from({ length: 40 }, (_, i) => ({
      id: `THR-${String(i + 1001).padStart(4, "0")}`,
      type: types[Math.floor(Math.random() * types.length)],
      severity: severities[Math.floor(Math.random() * severities.length)],
      ip: ips[Math.floor(Math.random() * ips.length)],
      endpoint: ["/api/auth/login", "/api/users", "/api/payments", "/api/admin"][Math.floor(Math.random() * 4)],
      confidence: Math.floor(Math.random() * 40 + 60),
      status: statuses[Math.floor(Math.random() * statuses.length)],
      timestamp: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(),
      reasoning: "Detected anomalous request pattern exceeding 3σ from baseline. Multiple failed authentication attempts from geographically dispersed IPs suggest coordinated credential stuffing attack.",
    }));
  },
  endpoints: () => [
    { id: "ep1", path: "/api/auth/login", method: "POST", rps: 342, errorRate: 12.4, risk: "critical", calls24h: 82400 },
    { id: "ep2", path: "/api/users/{id}", method: "GET", rps: 89, errorRate: 0.8, risk: "low", calls24h: 21360 },
    { id: "ep3", path: "/api/payments", method: "POST", rps: 23, errorRate: 3.1, risk: "high", calls24h: 5520 },
    { id: "ep4", path: "/api/admin/config", method: "PUT", rps: 4, errorRate: 8.7, risk: "high", calls24h: 960 },
    { id: "ep5", path: "/api/search", method: "GET", rps: 512, errorRate: 0.2, risk: "low", calls24h: 122880 },
    { id: "ep6", path: "/api/export/data", method: "GET", rps: 7, errorRate: 22.1, risk: "critical", calls24h: 1680 },
  ],
};

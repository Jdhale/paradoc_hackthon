// Socket service — wraps WebSocket with reconnect logic and event emitter
// Replace WS_URL with your real backend WebSocket endpoint

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws";

class SocketService {
  constructor() {
    this.ws = null;
    this.listeners = {};
    this.reconnectDelay = 1000;
    this.maxDelay = 30000;
    this.connected = false;
    this.mockInterval = null;
  }

  connect(token) {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(`${WS_URL}?token=${token}`);

      this.ws.onopen = () => {
        this.connected = true;
        this.reconnectDelay = 1000;
        this._emit("connected", {});
        console.log("[Socket] Connected");
      };

      this.ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          this._emit(data.type, data.payload);
          this._emit("*", data); // wildcard listener
        } catch {}
      };

      this.ws.onclose = () => {
        this.connected = false;
        this._emit("disconnected", {});
        console.log("[Socket] Disconnected, retrying in", this.reconnectDelay, "ms");
        setTimeout(() => {
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxDelay);
          this.connect(token);
        }, this.reconnectDelay);
      };

      this.ws.onerror = () => {
        // Fallback to mock mode if WS unavailable
        this._startMockMode();
      };
    } catch {
      this._startMockMode();
    }
  }

  disconnect() {
    if (this.mockInterval) clearInterval(this.mockInterval);
    this.ws?.close();
    this.ws = null;
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
    }
  }

  _emit(event, data) {
    (this.listeners[event] || []).forEach((cb) => cb(data));
  }

  // Mock mode — generates realistic fake events when WS backend is unavailable
  _startMockMode() {
    if (this.mockInterval) return;
    this.connected = true;
    this._emit("connected", { mock: true });

    const threatTypes = ["Credential Abuse", "Payload Injection", "Rate Limit Abuse", "Port Scanning"];
    const severities = ["critical", "high", "medium", "low"];
    const ips = ["45.142.212.100", "103.21.244.0", "185.220.101.45", "91.108.4.32"];

    this.mockInterval = setInterval(() => {
      // Traffic tick
      this._emit("traffic_tick", {
        timestamp: new Date().toISOString(),
        requests: Math.floor(Math.random() * 800 + 200),
        blocked: Math.floor(Math.random() * 80),
        anomalies: Math.floor(Math.random() * 30),
        rps: Math.floor(Math.random() * 500 + 100),
      });

      // Occasional threat event
      if (Math.random() < 0.3) {
        this._emit("threat_detected", {
          id: `THR-${Math.floor(Math.random() * 9000 + 1000)}`,
          type: threatTypes[Math.floor(Math.random() * threatTypes.length)],
          severity: severities[Math.floor(Math.random() * severities.length)],
          ip: ips[Math.floor(Math.random() * ips.length)],
          confidence: Math.floor(Math.random() * 40 + 60),
          timestamp: new Date().toISOString(),
          endpoint: ["/api/auth/login", "/api/payments", "/api/admin"][Math.floor(Math.random() * 3)],
        });
      }

      // Agent decision
      if (Math.random() < 0.15) {
        this._emit("agent_decision", {
          action: ["BLOCK_IP", "ALERT", "THROTTLE", "LOG"][Math.floor(Math.random() * 4)],
          target: ips[Math.floor(Math.random() * ips.length)],
          confidence: Math.floor(Math.random() * 30 + 70),
          timestamp: new Date().toISOString(),
        });
      }
    }, 2000);
  }
}

export const socket = new SocketService();
export default socket;

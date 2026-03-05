import { useState, useEffect, useRef } from "react";
import socket from "../services/socket";

// Approximate lat/lng → SVG coords for a 800x400 equirectangular projection
const project = (lat, lng, w = 800, h = 400) => ({
  x: ((lng + 180) / 360) * w,
  y: ((90 - lat) / 180) * h,
});

// Known attacker geolocations (mock)
const SEED_ATTACKS = [
  { lat: 55.7558, lng: 37.6173, label: "Moscow", count: 142 },
  { lat: 39.9042, lng: 116.4074, label: "Beijing", count: 89 },
  { lat: 28.6139, lng: 77.2090, label: "Delhi", count: 63 },
  { lat: 37.5665, lng: 126.9780, label: "Seoul", count: 48 },
  { lat: 51.5074, lng: -0.1278, label: "London", count: 31 },
  { lat: 40.7128, lng: -74.0060, label: "New York", count: 28 },
  { lat: -23.5505, lng: -46.6333, label: "São Paulo", count: 22 },
  { lat: 35.6762, lng: 139.6503, label: "Tokyo", count: 19 },
];

const TARGET = { lat: 18.5204, lng: 73.8567 }; // Pune (your server location)

export default function WorldMap() {
  const [attacks, setAttacks] = useState(SEED_ATTACKS);
  const [beams, setBeams] = useState([]);
  const beamId = useRef(0);
  const W = 800, H = 360;
  const target = project(TARGET.lat, TARGET.lng, W, H);

  useEffect(() => {
    const unsub = socket.on("threat_detected", () => {
      const src = SEED_ATTACKS[Math.floor(Math.random() * SEED_ATTACKS.length)];
      const id = ++beamId.current;
      setBeams((prev) => [...prev, { id, src: project(src.lat, src.lng, W, H) }]);
      setTimeout(() => setBeams((prev) => prev.filter((b) => b.id !== id)), 2000);
    });
    return unsub;
  }, []);

  return (
    <div style={{ width: "100%", position: "relative", background: "transparent" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00f5c4" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#00f5c4" stopOpacity="0" />
          </radialGradient>
          <filter id="blur2">
            <feGaussianBlur stdDeviation="2" />
          </filter>
          <filter id="blur1">
            <feGaussianBlur stdDeviation="1" />
          </filter>
          <marker id="arrowhead" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
            <polygon points="0 0, 4 2, 0 4" fill="#ef4444" opacity="0.8" />
          </marker>
        </defs>

        {/* Ocean background */}
        <rect width={W} height={H} fill="#060a14" />

        {/* Simplified continent shapes */}
        {/* North America */}
        <path d="M 80,60 L 200,55 L 220,80 L 200,130 L 170,160 L 140,180 L 100,160 L 70,120 Z"
          fill="#0d1829" stroke="#1a2a4a" strokeWidth="0.5" />
        {/* South America */}
        <path d="M 155,195 L 195,190 L 210,230 L 205,290 L 175,310 L 150,280 L 145,240 Z"
          fill="#0d1829" stroke="#1a2a4a" strokeWidth="0.5" />
        {/* Europe */}
        <path d="M 360,45 L 430,40 L 445,70 L 420,90 L 390,85 L 365,75 Z"
          fill="#0d1829" stroke="#1a2a4a" strokeWidth="0.5" />
        {/* Africa */}
        <path d="M 370,100 L 430,95 L 455,130 L 450,210 L 420,240 L 385,230 L 365,180 L 360,130 Z"
          fill="#0d1829" stroke="#1a2a4a" strokeWidth="0.5" />
        {/* Asia */}
        <path d="M 440,40 L 680,35 L 700,60 L 690,110 L 640,130 L 580,120 L 520,100 L 460,90 L 440,70 Z"
          fill="#0d1829" stroke="#1a2a4a" strokeWidth="0.5" />
        {/* India */}
        <path d="M 555,115 L 590,112 L 600,160 L 575,185 L 555,165 L 548,135 Z"
          fill="#0d1829" stroke="#1a2a4a" strokeWidth="0.5" />
        {/* Southeast Asia */}
        <path d="M 630,130 L 700,120 L 720,150 L 690,165 L 650,155 Z"
          fill="#0d1829" stroke="#1a2a4a" strokeWidth="0.5" />
        {/* Australia */}
        <path d="M 620,220 L 710,215 L 730,270 L 700,295 L 640,285 L 610,255 Z"
          fill="#0d1829" stroke="#1a2a4a" strokeWidth="0.5" />

        {/* Grid lines */}
        {Array.from({ length: 7 }, (_, i) => (
          <line key={`lat${i}`} x1="0" y1={i * 60} x2={W} y2={i * 60}
            stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
        ))}
        {Array.from({ length: 13 }, (_, i) => (
          <line key={`lng${i}`} x1={i * 66} y1="0" x2={i * 66} y2={H}
            stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
        ))}

        {/* Attack beams */}
        {beams.map(({ id, src }) => (
          <g key={id}>
            <line
              x1={src.x} y1={src.y} x2={target.x} y2={target.y}
              stroke="#ef4444" strokeWidth="1" opacity="0.6"
              markerEnd="url(#arrowhead)"
              style={{ animation: "beamFade 2s ease-out forwards" }}
            />
            <circle cx={src.x} cy={src.y} r="6" fill="#ef4444" opacity="0.3" filter="url(#blur2)" />
          </g>
        ))}

        {/* Attack origin dots */}
        {attacks.map((atk) => {
          const pos = project(atk.lat, atk.lng, W, H);
          const size = Math.max(3, Math.log(atk.count) * 1.5);
          return (
            <g key={atk.label}>
              <circle cx={pos.x} cy={pos.y} r={size + 4} fill="#ef4444" opacity="0.1" filter="url(#blur2)" />
              <circle cx={pos.x} cy={pos.y} r={size} fill="#ef4444" opacity="0.8" />
              <circle cx={pos.x} cy={pos.y} r={size * 2} fill="none" stroke="#ef4444" strokeWidth="0.5" opacity="0.4"
                style={{ animation: `ripple 3s ease-out ${Math.random() * 2}s infinite` }} />
            </g>
          );
        })}

        {/* Target (your server) */}
        <circle cx={target.x} cy={target.y} r="12" fill="url(#glow)" />
        <circle cx={target.x} cy={target.y} r="5" fill="#00f5c4" />
        <circle cx={target.x} cy={target.y} r="3" fill="white" />

        <style>{`
          @keyframes beamFade { 0% { opacity: 0.8; } 100% { opacity: 0; } }
          @keyframes ripple { 0% { r: 5; opacity: 0.4; } 100% { r: 20; opacity: 0; } }
        `}</style>
      </svg>

      {/* Legend */}
      <div style={{
        position: "absolute", bottom: "8px", right: "12px",
        fontFamily: "'JetBrains Mono', monospace", fontSize: "9px",
        color: "#4b5563", display: "flex", gap: "16px",
      }}>
        <span><span style={{ color: "#ef4444" }}>●</span> Attack Origin</span>
        <span><span style={{ color: "#00f5c4" }}>●</span> Protected Server</span>
      </div>
    </div>
  );
}

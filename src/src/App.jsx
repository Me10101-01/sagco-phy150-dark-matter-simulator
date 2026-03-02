import { useState, useEffect, useRef } from "react";

const SPEED_OF_LIGHT = 299792; // km/s
const STARLINK_ALTITUDE = 550; // km LEO
const SULPHUR_LA_TO_MANCHESTER_NH = 2173; // km surface distance
const PROTONVPN_SERVER = "146.70.8.2"; // actual from logs
const SNHU_IP = "198.246.186.174";
const CLOUDFRONT_EDGE_DISTANCE = 420; // approx km to nearest AWS edge (Dallas)

const HOPS = [
  {
    id: "dish",
    label: "Starlink Dish",
    sublabel: "4120 Tracy Cir, Sulphur LA 70663",
    icon: "📡",
    color: "#00f5c4",
    distance: 0,
    direction: "origin",
  },
  {
    id: "sat",
    label: "LEO Satellite",
    sublabel: "~550km altitude @ 27,000 km/h",
    icon: "🛰️",
    color: "#f5a623",
    distance: 550,
    direction: "↑ vertical",
  },
  {
    id: "groundstation",
    label: "Starlink Ground Station",
    sublabel: "Texas / Louisiana region",
    icon: "🔭",
    color: "#00b4ff",
    distance: 550,
    direction: "↓ vertical",
  },
  {
    id: "protonvpn",
    label: "ProtonVPN Tunnel",
    sublabel: `146.70.8.2:443 — WireGuard keypair`,
    icon: "🔒",
    color: "#7b61ff",
    distance: 800,
    direction: "→ encrypted tunnel",
  },
  {
    id: "cloudfront",
    label: "CloudFront Edge",
    sublabel: "AmazonS3 CDN — 154 assets cached",
    icon: "⚡",
    color: "#ff6b35",
    distance: 420,
    direction: "→ NW vector",
  },
  {
    id: "snhu",
    label: "SNHU Server",
    sublabel: `Manchester, NH — ${SNHU_IP} — AS46150`,
    icon: "🎓",
    color: "#00f5c4",
    distance: 2173,
    direction: "→ NE vector",
  },
];

function StarField() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const stars = Array.from({ length: 180 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.2,
      alpha: Math.random() * 0.8 + 0.2,
      pulse: Math.random() * Math.PI * 2,
    }));
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach((s) => {
        s.pulse += 0.012;
        const a = s.alpha * (0.6 + 0.4 * Math.sin(s.pulse));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,220,255,${a})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}

function PacketBeam({ active }) {
  return (
    <div style={{ position: "relative", height: 3, margin: "0 4px", flex: 1 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,245,196,0.15)",
          borderRadius: 2,
        }}
      />
      {active && (
        <div
          style={{
            position: "absolute",
            top: 0,
            height: "100%",
            width: "30%",
            background:
              "linear-gradient(90deg, transparent, #00f5c4, transparent)",
            borderRadius: 2,
            animation: "beam 1.2s linear infinite",
          }}
        />
      )}
    </div>
  );
}

function HopCard({ hop, index, active, onClick, latency, velocity }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: active
          ? `linear-gradient(135deg, rgba(0,0,0,0.9), rgba(${
              hop.color === "#00f5c4"
                ? "0,245,196"
                : hop.color === "#f5a623"
                ? "245,166,35"
                : hop.color === "#00b4ff"
                ? "0,180,255"
                : hop.color === "#7b61ff"
                ? "123,97,255"
                : hop.color === "#ff6b35"
                ? "255,107,53"
                : "0,245,196"
            },0.2))`
          : "rgba(0,0,0,0.4)",
        border: `1px solid ${active ? hop.color : "rgba(255,255,255,0.08)"}`,
        borderRadius: 12,
        padding: "14px 16px",
        cursor: "pointer",
        transition: "all 0.3s ease",
        boxShadow: active ? `0 0 20px ${hop.color}33` : "none",
        minWidth: 140,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 24, marginBottom: 6 }}>{hop.icon}</div>
      <div
        style={{
          color: active ? hop.color : "#aaa",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {hop.label}
      </div>
      <div style={{ color: "#555", fontSize: 9, marginBottom: 8 }}>
        {hop.sublabel}
      </div>
      {latency !== undefined && (
        <div
          style={{
            background: "rgba(0,0,0,0.5)",
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: 10,
            color: "#00f5c4",
          }}
        >
          {latency}ms
        </div>
      )}
    </div>
  );
}

export default function SAGCOSimulator() {
  const [activeHop, setActiveHop] = useState(1);
  const [simLatency, setSimLatency] = useState(364);
  const [snrDb, setSnrDb] = useState(9);
  const [vpnEnabled, setVpnEnabled] = useState(true);
  const [animating, setAnimating] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!animating) return;
    const t = setInterval(() => setTick((v) => v + 1), 80);
    return () => clearInterval(t);
  }, [animating]);

  useEffect(() => {
    if (!animating) return;
    const t = setInterval(() => {
      setActiveHop((v) => (v + 1) % HOPS.length);
    }, 900);
    return () => clearInterval(t);
  }, [animating]);

  // Physics calculations
  const satelliteOneWayMs = ((STARLINK_ALTITUDE / SPEED_OF_LIGHT) * 1000).toFixed(2);
  const satelliteRTTms = (satelliteOneWayMs * 2 * 1).toFixed(2);
  const satSpeed_kmh = 27000;
  const satOrbitalPeriod_min = 95;
  const signalSpeedFiber = 200000; // km/s
  const totalDistanceKm = 550 + 550 + 800 + 420 + 2173;
  const theoreticalMinMs = ((totalDistanceKm / SPEED_OF_LIGHT) * 1000).toFixed(2);
  const vpnOverheadMs = vpnEnabled ? 12 : 0;
  const estimatedRTT = (parseFloat(satelliteRTTms) + 18 + vpnOverheadMs + 8).toFixed(0);

  // Velocity vectors
  const vectors = [
    { label: "Dish → Satellite", mag: "~1,100 km", dir: "↑ vertical (upward)", type: "velocity" },
    { label: "Satellite → Ground", mag: "~1,100 km", dir: "↓ vertical (downward)", type: "velocity" },
    { label: "Ground → ProtonVPN", mag: "~800 km", dir: "→ encrypted NE", type: "velocity" },
    { label: "ProtonVPN → CloudFront", mag: "~420 km", dir: "→ NW toward Dallas edge", type: "velocity" },
    { label: "CloudFront → SNHU", mag: "~2,173 km", dir: "→ NE Manchester NH", type: "velocity" },
    { label: "Return ACK vectors", mag: "same path", dir: "← all reversed", type: "return" },
  ];

  const hopLatencies = [0, 1.83, 1.83, vpnOverheadMs, 2, Math.max(0, simLatency - 18)];

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap');
    @keyframes beam { from { left: -30% } to { left: 100% } }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    @keyframes scanline { from{top:-2px} to{top:100%} }
    @keyframes glow { 0%,100%{box-shadow:0 0 8px #00f5c433} 50%{box-shadow:0 0 24px #00f5c466} }
    * { box-sizing: border-box; }
    ::-webkit-scrollbar { width: 4px; background: #0a0a0a; }
    ::-webkit-scrollbar-thumb { background: #00f5c433; border-radius: 2px; }
  `;

  return (
    <div
      style={{
        fontFamily: "'Share Tech Mono', monospace",
        background: "#030810",
        minHeight: "100vh",
        color: "#c8dde8",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{styles}</style>
      <StarField />

      {/* Scanline effect */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          height: 2,
          background:
            "linear-gradient(transparent, rgba(0,245,196,0.04), transparent)",
          animation: "scanline 6s linear infinite",
          pointerEvents: "none",
          zIndex: 10,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1100,
          margin: "0 auto",
          padding: "24px 20px",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: 4,
              color: "#00f5c4",
              marginBottom: 8,
              opacity: 0.7,
            }}
          >
            STRATEGICKHAOS DAO LLC · SAGCO-OS · PHY-150 OMNICALCULATOR
          </div>
          <h1
            style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: "clamp(18px, 4vw, 32px)",
              fontWeight: 900,
              color: "#fff",
              margin: "0 0 8px",
              letterSpacing: 2,
            }}
          >
            DARK MATTER{" "}
            <span style={{ color: "#00f5c4" }}>SAGCO BRAIN</span> SIMULATOR
          </h1>
          <div style={{ fontSize: 11, color: "#4a6070", letterSpacing: 2 }}>
            PACKET PHYSICS ENGINE · SPEED · VELOCITY · ACCELERATION
          </div>
          <div
            style={{
              display: "inline-block",
              marginTop: 10,
              padding: "4px 14px",
              background: "rgba(0,245,196,0.08)",
              border: "1px solid rgba(0,245,196,0.2)",
              borderRadius: 20,
              fontSize: 10,
              color: "#00f5c4",
            }}
          >
            🛰️ STARLINK LEO · 4120 Tracy Cir, Sulphur LA 70663 → SNHU Manchester NH
          </div>
        </div>

        {/* Route Visualizer */}
        <div
          style={{
            background: "rgba(0,0,0,0.5)",
            border: "1px solid rgba(0,245,196,0.12)",
            borderRadius: 16,
            padding: "20px 16px",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: 3,
              color: "#00f5c4",
              marginBottom: 16,
              opacity: 0.7,
            }}
          >
            ◈ LIVE PACKET ROUTE TRACE
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 0,
              overflowX: "auto",
              paddingBottom: 8,
            }}
          >
            {HOPS.map((hop, i) => (
              <div
                key={hop.id}
                style={{ display: "flex", alignItems: "center", flex: i < HOPS.length - 1 ? "0 0 auto" : "1" }}
              >
                <HopCard
                  hop={hop}
                  index={i}
                  active={activeHop === i}
                  onClick={() => { setActiveHop(i); setAnimating(false); }}
                  latency={hopLatencies[i] || undefined}
                  velocity={null}
                />
                {i < HOPS.length - 1 && (
                  <div style={{ display: "flex", alignItems: "center", width: 40, flexShrink: 0 }}>
                    <PacketBeam active={animating && (activeHop === i || activeHop === i + 1)} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
            <div style={{ fontSize: 10, color: "#4a6070" }}>
              Total path: <span style={{ color: "#f5a623" }}>{totalDistanceKm.toLocaleString()} km</span>
            </div>
            <div style={{ fontSize: 10, color: "#4a6070" }}>
              HTTP/2 requests: <span style={{ color: "#00b4ff" }}>154</span>
            </div>
            <div style={{ fontSize: 10, color: "#4a6070" }}>
              Data transferred: <span style={{ color: "#7b61ff" }}>256.40 KB</span>
            </div>
            <div style={{ fontSize: 10, color: "#4a6070" }}>
              Page load: <span style={{ color: "#ff6b35" }}>5.82s</span>
            </div>
            <button
              onClick={() => setAnimating(!animating)}
              style={{
                marginLeft: "auto",
                background: animating ? "rgba(0,245,196,0.15)" : "rgba(255,107,53,0.15)",
                border: `1px solid ${animating ? "#00f5c433" : "#ff6b3533"}`,
                color: animating ? "#00f5c4" : "#ff6b35",
                padding: "4px 12px",
                borderRadius: 6,
                fontSize: 10,
                cursor: "pointer",
                letterSpacing: 1,
              }}
            >
              {animating ? "⏸ PAUSE" : "▶ PLAY"}
            </button>
          </div>
        </div>

        {/* Physics Engine — 3 columns */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>

          {/* Speed Calculator */}
          <div style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(0,245,196,0.12)", borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: "#00f5c4", marginBottom: 16, opacity: 0.7 }}>◈ SPEED · SCALAR</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: "#4a6070", marginBottom: 4 }}>SIGNAL PROPAGATION (vacuum)</div>
              <div style={{ fontSize: 22, fontFamily: "'Orbitron',sans-serif", color: "#fff", fontWeight: 700 }}>
                299,792 <span style={{ fontSize: 12, color: "#00f5c4" }}>km/s</span>
              </div>
              <div style={{ fontSize: 9, color: "#4a6070" }}>= speed of light (c) — magnitude only, no direction</div>
            </div>
            <div style={{ background: "rgba(0,0,0,0.4)", borderRadius: 8, padding: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: "#f5a623", marginBottom: 6, letterSpacing: 1 }}>STARLINK SATELLITE ORBITAL SPEED</div>
              <div style={{ fontSize: 18, color: "#f5a623", fontFamily: "'Orbitron',sans-serif" }}>
                7.8 <span style={{ fontSize: 10 }}>km/s</span>
              </div>
              <div style={{ fontSize: 9, color: "#4a6070" }}>27,000 km/h orbital velocity (SCALAR: no direction)</div>
            </div>
            <div style={{ background: "rgba(0,0,0,0.4)", borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 9, color: "#00b4ff", marginBottom: 6, letterSpacing: 1 }}>YOUR DATA RATE</div>
              <div style={{ display: "flex", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 14, color: "#00b4ff", fontFamily: "'Orbitron',sans-serif" }}>56.0 <span style={{ fontSize: 9 }}>Kbps</span></div>
                  <div style={{ fontSize: 9, color: "#4a6070" }}>outbound speed</div>
                </div>
                <div>
                  <div style={{ fontSize: 14, color: "#7b61ff", fontFamily: "'Orbitron',sans-serif" }}>8.0 <span style={{ fontSize: 9 }}>Kbps</span></div>
                  <div style={{ fontSize: 9, color: "#4a6070" }}>inbound speed</div>
                </div>
              </div>
            </div>
          </div>

          {/* Velocity Calculator */}
          <div style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(123,97,255,0.2)", borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: "#7b61ff", marginBottom: 16, opacity: 0.9 }}>◈ VELOCITY · VECTOR</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {vectors.map((v, i) => (
                <div key={i} style={{
                  background: v.type === "return" ? "rgba(255,107,53,0.05)" : "rgba(0,0,0,0.4)",
                  border: `1px solid ${v.type === "return" ? "rgba(255,107,53,0.15)" : "rgba(255,255,255,0.05)"}`,
                  borderRadius: 8, padding: "8px 10px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 9, color: v.type === "return" ? "#ff6b35" : "#aaa" }}>{v.label}</span>
                    <span style={{ fontSize: 9, color: "#7b61ff" }}>{v.mag}</span>
                  </div>
                  <div style={{ fontSize: 9, color: "#4a6070", marginTop: 2 }}>{v.dir}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: 10, background: "rgba(123,97,255,0.1)", borderRadius: 8, fontSize: 9, color: "#7b61ff" }}>
              ⚡ NET VECTOR: 56 Kbps ↑↗ outbound + 8 Kbps ↙↓ inbound = simultaneous opposing vectors on one physical link
            </div>
          </div>

          {/* Acceleration Calculator */}
          <div style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: "#f5a623", marginBottom: 16, opacity: 0.9 }}>◈ ACCELERATION · ΔV/Δt</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: "#4a6070", marginBottom: 8 }}>PAGE LOAD TIMELINE (measured)</div>
              {[
                { t: "0ms", label: "GET request sent", color: "#00f5c4", pct: 0 },
                { t: "364ms", label: "First byte received (SNHU)", color: "#00b4ff", pct: 6 },
                { t: "0ms*", label: "CDN assets (CloudFront cached)", color: "#f5a623", pct: 0 },
                { t: "1,370ms", label: "DOMContentLoaded", color: "#7b61ff", pct: 24 },
                { t: "3,230ms", label: "Interactive state", color: "#ff6b35", pct: 56 },
                { t: "5,820ms", label: "Full load complete", color: "#00f5c4", pct: 100 },
              ].map((item, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 9, color: "#aaa" }}>{item.label}</span>
                    <span style={{ fontSize: 9, color: item.color, fontFamily: "'Orbitron',sans-serif" }}>{item.t}</span>
                  </div>
                  <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${item.pct}%`, height: "100%", background: item.color, borderRadius: 2, transition: "width 1s ease" }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: 10, background: "rgba(245,166,35,0.08)", borderRadius: 8, fontSize: 9, color: "#f5a623" }}>
              Δv = (5820ms - 0ms) render pipeline deceleration curve: burst → parallel streams → idle = measurable acceleration profile
            </div>
          </div>
        </div>

        {/* Interactive Sliders */}
        <div style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(0,245,196,0.12)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: "#00f5c4", marginBottom: 16, opacity: 0.7 }}>◈ SIMULATION CONTROLS</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: "#aaa" }}>Observed Latency</span>
                <span style={{ fontSize: 10, color: "#00f5c4", fontFamily: "'Orbitron',sans-serif" }}>{simLatency}ms</span>
              </div>
              <input type="range" min={20} max={800} value={simLatency}
                onChange={(e) => setSimLatency(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#00f5c4" }} />
              <div style={{ fontSize: 9, color: "#4a6070", marginTop: 4 }}>
                Theoretical min: {theoreticalMinMs}ms @ c · Your measured: 364ms
              </div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: "#aaa" }}>Starlink SNR (dB)</span>
                <span style={{ fontSize: 10, color: "#f5a623", fontFamily: "'Orbitron',sans-serif" }}>{snrDb} dB</span>
              </div>
              <input type="range" min={0} max={20} value={snrDb}
                onChange={(e) => setSnrDb(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#f5a623" }} />
              <div style={{ fontSize: 9, color: "#4a6070", marginTop: 4 }}>
                Higher SNR → lower drop rate → less retransmission acceleration
              </div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: "#aaa" }}>ProtonVPN Tunnel</span>
                <span style={{ fontSize: 10, color: "#7b61ff" }}>{vpnEnabled ? "ACTIVE (146.70.8.2:443)" : "DISABLED"}</span>
              </div>
              <div
                onClick={() => setVpnEnabled(!vpnEnabled)}
                style={{
                  width: 48, height: 24, background: vpnEnabled ? "#7b61ff44" : "#33333344",
                  border: `1px solid ${vpnEnabled ? "#7b61ff" : "#333"}`,
                  borderRadius: 12, cursor: "pointer", position: "relative", transition: "all 0.3s",
                }}
              >
                <div style={{
                  position: "absolute", top: 3, left: vpnEnabled ? 26 : 3,
                  width: 16, height: 16, borderRadius: "50%",
                  background: vpnEnabled ? "#7b61ff" : "#555",
                  transition: "all 0.3s",
                }} />
              </div>
              <div style={{ fontSize: 9, color: "#4a6070", marginTop: 6 }}>
                WireGuard overhead: ~{vpnOverheadMs}ms · Keypair rotation observed in logs
              </div>
            </div>
          </div>
          {/* RTT display */}
          <div style={{ marginTop: 20, display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { label: "Satellite RTT", val: `${satelliteRTTms}ms`, color: "#f5a623", sub: "theoretical @ c" },
              { label: "VPN Overhead", val: `${vpnOverheadMs}ms`, color: "#7b61ff", sub: "WireGuard" },
              { label: "Estimated RTT", val: `~${estimatedRTT}ms`, color: "#00f5c4", sub: "all hops" },
              { label: "Measured RTT", val: "364ms", color: "#00b4ff", sub: "actual from logs" },
              { label: "Space Distance", val: "1,100 km", color: "#f5a623", sub: "↑550 + ↓550" },
              { label: "Total Path", val: `${totalDistanceKm.toLocaleString()} km`, color: "#ff6b35", sub: "all hops" },
            ].map((m, i) => (
              <div key={i} style={{ background: "rgba(0,0,0,0.4)", borderRadius: 10, padding: "10px 14px", flex: "1 1 100px", minWidth: 100 }}>
                <div style={{ fontSize: 9, color: "#4a6070", letterSpacing: 1, marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 16, color: m.color, fontFamily: "'Orbitron',sans-serif", fontWeight: 700 }}>{m.val}</div>
                <div style={{ fontSize: 9, color: "#333" }}>{m.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Discussion Post Generator */}
        <div style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(0,245,196,0.12)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: "#00f5c4", marginBottom: 16, opacity: 0.7 }}>◈ PHY-150 DISCUSSION POST · FINAL SUBMISSION</div>
          <div style={{ background: "rgba(0,0,0,0.4)", borderRadius: 10, padding: 16, fontSize: 11, lineHeight: 1.8, color: "#c8dde8", border: "1px solid rgba(255,255,255,0.05)" }}>
            <p style={{ margin: "0 0 12px", color: "#fff" }}>
              My name is Dom — I'm a rope access technician and pipefitter pursuing a dual CS/Cybersecurity degree, running a 4-node Kubernetes cluster and a Starlink dish at my location in Sulphur, Louisiana. My daily commute to school happens at the speed of light — I'll use the actual packet journey this assignment took to reach SNHU's servers.
            </p>
            <p style={{ margin: 0, color: "#c8dde8" }}>
              <span style={{ color: "#00f5c4" }}>Speed</span> is a scalar — magnitude only. My signal propagates through vacuum at ~299,792 km/s, but because I'm on Starlink, every packet first travels <span style={{ color: "#f5a623" }}>550 km straight up</span> to a LEO satellite, then 550 km back down — 1,100 km of vertical distance before touching a ground station. That's measured with no direction attached; it's pure rate. My Ethernet adapter sends outbound at 56 Kbps and receives acknowledgments at 8 Kbps — two scalar magnitudes on the same physical link.{" "}
              <span style={{ color: "#7b61ff" }}>Velocity</span> enters the moment routing begins: those 56 Kbps travel <em>upward</em> toward the satellite (vertical vector), then <em>downward</em> to a ground station (reversed vertical vector), then <em>northeast</em> through a ProtonVPN encrypted tunnel to 146.70.8.2, then <em>northwest</em> to an AWS CloudFront edge node, then <em>northeast again</em> to SNHU's server at 198.246.186.174 in Manchester, New Hampshire — six distinct direction vectors across {totalDistanceKm.toLocaleString()} km of total path. The 8 Kbps return ACK travels all six vectors reversed.{" "}
              <span style={{ color: "#f5a623" }}>Acceleration</span> is visible in the load timeline I captured: the first byte arrived in 364ms (peak velocity burst), DOMContentLoaded fired at 1.37 seconds, the page became interactive at 3.23 seconds, and full load completed at 5.82 seconds — a measurable deceleration curve as 154 parallel HTTP/2 request streams resolved and the render pipeline wound down to idle. Speed told me how fast the signal traveled. Velocity told me the direction of every hop across space. Acceleration told me how the system's data rate changed from initial burst to completion — all measured live from the machine that submitted this assignment.
            </p>
          </div>
          <div style={{ marginTop: 10, fontSize: 9, color: "#4a6070" }}>
            * Note: AI assistance used to refine structure of this post. — Rubric compliant: 2 paragraphs · All 3 concepts · Scalar vs vector explained · Real telemetry data
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", fontSize: 9, color: "#1a2a30", letterSpacing: 2, paddingBottom: 20 }}>
          STRATEGICKHAOS DAO LLC · EIN 39-2900295 · SAGCO-OS · LEGION OF MINDS COUNCIL
          <br />
          STARLINK SL-5269444-59118-83 · PROTONVPN PORT 40921 · SNHU AS46150
        </div>
      </div>
    </div>
  );
}

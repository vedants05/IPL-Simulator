"use client";

import { useEffect, useState } from "react";

interface Valuation {
  id: string;
  name: string;
  age: number;
  rating: number;
  potential: number;
  nationality: string;
  role: string;
  isCapped: boolean;
  reputation: number;
  worth: number;
}

interface TeamRetention {
  teamId: string;
  teamName: string;
  purse: number;
  valuations: Valuation[];
  retained: { id: string; name: string }[];
}

const TEAM_COLORS: Record<string, string> = {
  CSK: "#f5a623",
  MI:  "#004ba0",
  RCB: "#d4213d",
  KKR: "#6a1fc2",
  DC:  "#004c97",
  PBKS: "#c8102e",
  RR:  "#e91e8c",
  SRH: "#f26522",
  LSG: "#a4c639",
  GT:  "#1c4f9c",
};

export default function RetentionsPage() {
  const [data, setData] = useState<TeamRetention[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>("KKR");
  const [showAll, setShowAll] = useState(false);

  const fetchData = () => {
    setLoading(true);
    fetch("/api/retentions")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const team = data?.find(t => t.teamId === selected);
  const accentColor = TEAM_COLORS[selected] ?? "#6a1fc2";

  return (
    <div style={{ minHeight: "var(--app-viewport-height)", background: "#0a0a12", color: "#e8e8f0", fontFamily: "'Inter', sans-serif", padding: "0" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #111122 0%, #1a1a2e 100%)", borderBottom: "1px solid #222240", padding: "24px 40px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "26px", fontWeight: 800, letterSpacing: "-0.5px", color: "#fff" }}>
            🏏 IPL Retention Viewer
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#6666aa" }}>AI-decided retentions · Pre-auction valuations</p>
        </div>
        <button
          onClick={fetchData}
          style={{ background: accentColor, border: "none", borderRadius: "10px", color: "#fff", padding: "10px 22px", fontWeight: 700, fontSize: "14px", cursor: "pointer", transition: "opacity 0.2s" }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          {loading ? "Loading…" : "↺ Re-simulate"}
        </button>
      </div>

      {/* Team Tabs */}
      <div style={{ display: "flex", gap: "8px", padding: "20px 40px 0", flexWrap: "wrap" }}>
        {data?.map(t => (
          <button
            key={t.teamId}
            onClick={() => setSelected(t.teamId)}
            style={{
              padding: "8px 18px",
              borderRadius: "20px",
              border: selected === t.teamId ? `2px solid ${TEAM_COLORS[t.teamId] ?? "#6a1fc2"}` : "2px solid #222240",
              background: selected === t.teamId ? (TEAM_COLORS[t.teamId] ?? "#6a1fc2") + "22" : "#111122",
              color: selected === t.teamId ? (TEAM_COLORS[t.teamId] ?? "#fff") : "#888",
              fontWeight: selected === t.teamId ? 700 : 500,
              fontSize: "13px",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {t.teamId}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "80px", color: "#555577" }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>⚙️</div>
          <div>Simulating retentions…</div>
        </div>
      )}

      {team && !loading && (
        <div style={{ padding: "24px 40px" }}>

          {/* Team Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "28px", fontWeight: 800, color: accentColor }}>{team.teamName}</h2>
              <p style={{ margin: "4px 0 0", color: "#6666aa", fontSize: "13px" }}>
                Total Purse: <strong style={{ color: "#fff" }}>₹{team.purse} Cr</strong>
              </p>
            </div>

            {/* Retained Summary */}
            <div style={{ background: "#111122", border: `1px solid ${accentColor}44`, borderRadius: "14px", padding: "16px 24px", minWidth: "260px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: accentColor, letterSpacing: "1.5px", marginBottom: "12px" }}>RETAINED PLAYERS</div>
              {team.retained.length === 0
                ? <div style={{ color: "#555577", fontSize: "13px" }}>No retentions</div>
                : team.retained.map((r, i) => {
                    const v = team.valuations.find(v => v.id === r.id);
                    const slabs = [1800, 1400, 1100, 1800, 1400, 400];
                    return (
                      <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ background: accentColor, color: "#fff", borderRadius: "50%", width: "20px", height: "20px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700 }}>{i + 1}</span>
                          <span style={{ fontSize: "14px", fontWeight: 600 }}>{r.name}</span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "13px", color: "#aaa" }}>Slab: ₹{(slabs[i] / 100).toFixed(0)} Cr</div>
                          {v && <div style={{ fontSize: "11px", color: "#555577" }}>Worth: ₹{v.worth.toFixed(1)} Cr</div>}
                        </div>
                      </div>
                    );
                  })
              }
            </div>
          </div>

          {/* Toggle */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            <button onClick={() => setShowAll(false)} style={{ padding: "7px 16px", borderRadius: "8px", border: !showAll ? `1px solid ${accentColor}` : "1px solid #222240", background: !showAll ? accentColor + "22" : "#111122", color: !showAll ? accentColor : "#555577", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>Top 10</button>
            <button onClick={() => setShowAll(true)} style={{ padding: "7px 16px", borderRadius: "8px", border: showAll ? `1px solid ${accentColor}` : "1px solid #222240", background: showAll ? accentColor + "22" : "#111122", color: showAll ? accentColor : "#555577", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>Full Squad</button>
          </div>

          {/* Valuations Table */}
          <div style={{ background: "#0d0d1a", borderRadius: "16px", border: "1px solid #1a1a30", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#111122", borderBottom: "1px solid #1a1a30" }}>
                  {["#", "Player", "Type", "Age", "RTG", "POT", "Nationality", "Role", "Rep", "Worth"].map(h => (
                    <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "#555577", letterSpacing: "1px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(showAll ? team.valuations : team.valuations.slice(0, 10)).map((v, i) => {
                  const isRetained = team.retained.some(r => r.id === v.id);
                  const retainIdx = team.retained.findIndex(r => r.id === v.id);
                  return (
                    <tr
                      key={v.id}
                      style={{
                        borderBottom: "1px solid #1a1a30",
                        background: isRetained ? accentColor + "12" : i % 2 === 0 ? "#0d0d1a" : "#0f0f1e",
                        transition: "background 0.1s",
                      }}
                    >
                      <td style={{ padding: "12px 16px", fontSize: "13px", color: "#555577" }}>{i + 1}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          {isRetained && (
                            <span style={{ background: accentColor, color: "#fff", borderRadius: "4px", padding: "2px 6px", fontSize: "10px", fontWeight: 700 }}>
                              R{retainIdx + 1}
                            </span>
                          )}
                          <span style={{ fontSize: "14px", fontWeight: 600, color: isRetained ? "#fff" : "#ccc" }}>{v.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: v.isCapped ? "#f5a623" : "#6ad49d", background: v.isCapped ? "#f5a62320" : "#6ad49d20", borderRadius: "4px", padding: "2px 8px" }}>
                          {v.isCapped ? "CAP" : "UNC"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", color: "#aaa" }}>{v.age}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: "14px", fontWeight: 700, color: v.rating >= 86 ? "#f5a623" : v.rating >= 80 ? "#6ad49d" : "#aaa" }}>{v.rating}</span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", color: "#888" }}>{v.potential}</td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", color: v.nationality === "Indian" ? "#4a9eff" : "#cc88ff" }}>{v.nationality}</td>
                      <td style={{ padding: "12px 16px", fontSize: "12px", color: "#777" }}>{v.role}</td>
                      <td style={{ padding: "12px 16px", fontSize: "13px", color: v.reputation >= 10 ? "#f5a623" : v.reputation >= 7 ? "#6ad49d" : "#777" }}>{v.reputation}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ fontSize: "15px", fontWeight: 700, color: v.worth >= 100 ? "#f5a623" : v.worth >= 50 ? "#6ad49d" : "#aaa" }}>
                          ₹{v.worth.toFixed(1)} Cr
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

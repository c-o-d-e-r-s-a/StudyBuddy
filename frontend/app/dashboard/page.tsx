"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Summary = {
  startedAt: number;
  endedAt: number;
  totalMs: number;
  focusedMs: number;
  lookAwayCount: number;
  confusionTriggers: number;
  questionsCount: number;
  questions?: { ts: number; q: string }[];
};

function fmt(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s}s`;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("studybuddy_session_summary");
    if (!raw) return;
    try {
      setSummary(JSON.parse(raw));
    } catch {
      setSummary(null);
    }
  }, []);

  const focusPct = useMemo(() => {
    if (!summary) return 0;
    if (!summary.totalMs) return 0;
    return Math.round((summary.focusedMs / summary.totalMs) * 100);
  }, [summary]);

  if (!summary) {
    return (
      <div style={{ padding: 16, maxWidth: 900 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>Session Dashboard</h1>
        <p style={{ marginTop: 8 }}>No session summary found yet.</p>
        <div style={{ marginTop: 12 }}>
          <Link href="/study">Back to study</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 900 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800 }}>Session Dashboard</h1>

      <div style={{ marginTop: 14, fontSize: 14, color: "#444" }}>
        <div>
          <b>Total:</b> {fmt(summary.totalMs)}{" "}
          <span style={{ marginLeft: 10 }}>
            <b>Focused:</b> {fmt(summary.focusedMs)} ({focusPct}%)
          </span>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 12
        }}
      >
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 12, color: "#666" }}>Total time</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{fmt(summary.totalMs)}</div>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 12, color: "#666" }}>Focused time</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{fmt(summary.focusedMs)}</div>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 12, color: "#666" }}>Look-aways</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{summary.lookAwayCount}</div>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 12, color: "#666" }}>Confusion triggers</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{summary.confusionTriggers}</div>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 12, color: "#666" }}>Questions asked</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{summary.questionsCount}</div>
        </div>
      </div>

      {summary.questions && summary.questions.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Recent questions</div>
          <ul style={{ paddingLeft: 18 }}>
            {summary.questions.slice(-10).map((q) => (
              <li key={q.ts} style={{ marginBottom: 6 }}>
                {q.q}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: 18, display: "flex", gap: 14 }}>
        <Link href="/study">Back to study</Link>

        <button
          onClick={() => {
            localStorage.removeItem("studybuddy_session_summary");
            setSummary(null);
          }}
          style={{ border: "1px solid #333", borderRadius: 10, padding: "8px 10px" }}
        >
          Clear summary
        </button>
      </div>
    </div>
  );
}

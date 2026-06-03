"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import Panel from "@/components/Panel";

type Diagnostic = {
  id: string;
  client_name: string;
  video_title: string;
  format_constant: string;
  idea_constant: string;
  hook_constant: string;
  script_constant: string;
  visual_constant: string;
  twisted_variable: string;
  views: number;
  engagement_status: string;
};

const VARIABLES = ["Format", "Idea", "Hook", "Script", "Visuals"] as const;

export default function DiagnosticsView() {
  const [rows, setRows] = useState<Diagnostic[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientName, setClientName] = useState("Devi");
  const [videoTitle, setVideoTitle] = useState("");
  const [values, setValues] = useState<Record<string, string>>({ Format: "", Idea: "", Hook: "", Script: "", Visuals: "" });
  const [twisted, setTwisted] = useState<(typeof VARIABLES)[number]>("Hook");
  const [views, setViews] = useState("");
  const [status, setStatus] = useState("Testing");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/studio/diagnostics", { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      setRows(payload?.diagnostics || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const clientProgress = useMemo(() => {
    const map = new Map<string, { videos: number; views: number }>();
    for (const row of rows) {
      const key = row.client_name || "Unknown";
      const current = map.get(key) || { videos: 0, views: 0 };
      map.set(key, { videos: current.videos + 1, views: current.views + (row.views || 0) });
    }
    return [...map.entries()].sort((a, b) => b[1].views - a[1].views);
  }, [rows]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!videoTitle.trim()) return;
    const response = await fetch("/api/studio/diagnostics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: clientName,
        video_title: videoTitle,
        twisted_variable: twisted,
        format_constant: twisted === "Format" ? values.Format : values.Format || "Constant",
        idea_constant: twisted === "Idea" ? values.Idea : values.Idea || "Constant",
        hook_constant: twisted === "Hook" ? values.Hook : values.Hook || "Constant",
        script_constant: twisted === "Script" ? values.Script : values.Script || "Constant",
        visual_constant: twisted === "Visuals" ? values.Visuals : values.Visuals || "Constant",
        views: Number(views) || 0,
        engagement_status: status,
      }),
    });
    if (response.ok) {
      setVideoTitle("");
      setViews("");
      void load();
    }
  }

  return (
    <div className="space-y-4">
      <Panel num="01" name="CLIENT VIDEO PROGRESS" bodyClass="p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {clientProgress.length === 0 && <div className="text-sm text-muted">Log videos to track per-client progress.</div>}
          {clientProgress.map(([client, stats]) => {
            const pct = Math.min(100, Math.round((stats.videos / 10) * 100));
            return (
              <div key={client} className="rounded-[8px] border border-line bg-black/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-soft">{client}</span>
                  <span className="font-mono text-[10px] text-muted">{stats.videos} videos · {stats.views.toLocaleString()} views</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/[0.05]">
                  <div className="h-full rounded-full bg-teal/70" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel num="02" name="DIAGNOSTIC ENGINE" bodyClass="p-4">
        <form onSubmit={submit} className="grid gap-3 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-2">
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} className="input-bar w-full px-3 py-2 text-sm" placeholder="Client name" />
            <input value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} className="input-bar w-full px-3 py-2 text-sm" placeholder="Video title" required />
            <div className="grid grid-cols-2 gap-2">
              <input value={views} onChange={(e) => setViews(e.target.value)} className="input-bar px-3 py-2 text-sm" placeholder="Views" inputMode="numeric" />
              <input value={status} onChange={(e) => setStatus(e.target.value)} className="input-bar px-3 py-2 text-sm" placeholder="Engagement status" />
            </div>
          </div>
          <div className="space-y-2">
            {VARIABLES.map((variable) => (
              <div key={variable} className="grid grid-cols-[88px_1fr_auto] items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{variable}</span>
                <input
                  value={values[variable]}
                  onChange={(e) => setValues((current) => ({ ...current, [variable]: e.target.value }))}
                  className="input-bar px-3 py-2 text-sm"
                  placeholder={twisted === variable ? "Twisted variable" : "Constant"}
                />
                <label className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                  <input type="radio" name="twisted" checked={twisted === variable} onChange={() => setTwisted(variable)} />
                  Twist
                </label>
              </div>
            ))}
            <button type="submit" className="glass-button w-full py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-soft hover:text-teal">
              Log Video Diagnostic
            </button>
          </div>
        </form>
      </Panel>

      <Panel num="03" name="HOLD 4 TWIST 1 HISTORY" bodyClass="p-0">
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="sticky top-0 border-b border-line bg-black/90 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              <tr>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Video</th>
                {VARIABLES.map((v) => <th key={v} className="px-3 py-2">{v}</th>)}
                <th className="px-3 py-2">Views</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-muted">Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-muted">No diagnostics yet.</td></tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line/70 hover:bg-white/[0.02]">
                  <td className="px-3 py-2 text-soft">{row.client_name}</td>
                  <td className="px-3 py-2 text-soft">{row.video_title}</td>
                  {VARIABLES.map((v) => {
                    const key = `${v.toLowerCase()}_constant` as keyof Diagnostic;
                    const twistedCol = row.twisted_variable === v;
                    return (
                      <td key={v} className={`px-3 py-2 ${twistedCol ? "bg-teal/10 font-medium text-teal" : "text-muted"}`}>
                        {String(row[key] || "—")}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 font-mono text-soft">{row.views?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

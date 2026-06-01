"use client";

import { type FormEvent, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import Panel from "@/components/Panel";

type Match = {
  id: string;
  text: string;
  source_type: string | null;
  source_id: string | null;
  created_at: string;
  distance?: number;
};

const entityHints = [
  "Business",
  "Products",
  "Content",
  "Legal",
  "OpSec",
  "Personal Admin",
  "Finance",
  "Health",
];

function splitMemoryResponse(raw: string): { matches: Match[]; answer: string } {
  const marker = "\n__ANSWER__\n";
  const markerIndex = raw.indexOf(marker);
  if (!raw.startsWith("__MATCHES__") || markerIndex === -1) return { matches: [], answer: raw };
  const matchesText = raw.slice("__MATCHES__".length, markerIndex);
  const answer = raw.slice(markerIndex + marker.length);
  try {
    return { matches: JSON.parse(matchesText) as Match[], answer };
  } catch {
    return { matches: [], answer };
  }
}

export default function BrainPage() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(event?: FormEvent<HTMLFormElement>, preset?: string) {
    event?.preventDefault();
    const q = (preset || query).trim();
    if (!q) return;
    setQuery(q);
    setLoading(true);
    setError(null);
    setAnswer("");
    setMatches([]);

    try {
      const response = await fetch("/api/memory/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Memory search failed");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        const payload = await response.json();
        setMatches(payload.matches || []);
        setAnswer(payload.answer || "");
        return;
      }

      const decoder = new TextDecoder();
      let raw = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
        const parsed = splitMemoryResponse(raw);
        setMatches(parsed.matches);
        setAnswer(parsed.answer);
      }
      const parsed = splitMemoryResponse(raw);
      setMatches(parsed.matches);
      setAnswer(parsed.answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Memory search failed");
    } finally {
      setLoading(false);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const match of matches) {
      const key = match.source_type || "memory";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(match);
    }
    return Array.from(map.entries());
  }, [matches]);

  return (
    <Shell>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <Panel num="01" name="ASK MY OS" bodyClass="p-5">
            <form onSubmit={ask} className="grid gap-3">
              <textarea
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="input-bar min-h-28 resize-none p-4 text-base text-soft"
                placeholder="Ask about tasks, captures, ideas, meals, journal notes..."
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {["What should I focus on today?", "What did I capture about finance?", "Summarize recent health patterns"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => ask(undefined, preset)}
                      className="rounded-[7px] border border-line bg-black/35 px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted hover:border-teal/40 hover:text-soft"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="glass-button px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-teal disabled:opacity-30"
                >
                  {loading ? "Thinking" : "Ask"}
                </button>
              </div>
            </form>
          </Panel>

          <Panel num="02" name="ANSWER" bodyClass="p-5">
            {error && <div className="rounded-[8px] border border-hot/30 bg-hot/10 p-3 text-sm text-hot">{error}</div>}
            {!error && !answer && !loading && <div className="text-sm text-muted">Ask a question to search your memory layer.</div>}
            {!error && (answer || loading) && (
              <div className="whitespace-pre-wrap text-base leading-7 text-soft">
                {answer || "Searching memory..."}
              </div>
            )}
          </Panel>

          <Panel num="03" name="SOURCE MATCHES" action={<span className="font-mono text-[10px] text-muted">{matches.length}</span>} bodyClass="p-4">
            <div className="grid gap-3 md:grid-cols-2">
              {matches.map((match, index) => (
                <div key={match.id} className="rounded-[8px] border border-line bg-black/30 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                    <span>[{index + 1}] {match.source_type || "memory"}</span>
                    <span>{new Date(match.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="line-clamp-4 text-sm leading-relaxed text-soft">{match.text}</p>
                </div>
              ))}
              {matches.length === 0 && <div className="text-sm text-muted">No matches yet.</div>}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel num="E" name="ENTITY LENSES" bodyClass="p-4">
            <div className="grid gap-2">
              {entityHints.map((hint) => (
                <button
                  key={hint}
                  type="button"
                  onClick={() => ask(undefined, `Show me recent memory and open loops related to ${hint}`)}
                  className="flex items-center justify-between rounded-[8px] border border-line bg-black/25 px-3 py-3 text-left transition hover:border-teal/40"
                >
                  <span className="text-sm text-soft">{hint}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Search</span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel num="M" name="MATCH GROUPS" bodyClass="p-4">
            <div className="space-y-2">
              {grouped.map(([source, list]) => (
                <div key={source} className="flex items-center justify-between rounded-[7px] border border-line bg-black/25 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em]">
                  <span className="text-muted">{source}</span>
                  <span className="text-soft">{list.length}</span>
                </div>
              ))}
              {grouped.length === 0 && <div className="text-sm text-muted">Sources appear after a search.</div>}
            </div>
          </Panel>
        </div>
      </div>
    </Shell>
  );
}

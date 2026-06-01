"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!res.ok) { setError("Wrong password."); return; }
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") || "/";
    window.location.href = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <form onSubmit={onSubmit} className="card w-full max-w-sm">
        <header className="px-3 py-2 border-b border-line">
          <span className="card-head"><span className="text-muted">00</span> <span className="text-dim">//</span> <span className="text-soft">AUTH</span></span>
        </header>
        <div className="p-5 space-y-3">
          <div>
            <div className="font-serif text-xl text-soft">Welcome.</div>
            <p className="text-muted text-xs mt-1">Enter dashboard password.</p>
          </div>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full input-bar rounded px-3 py-2 font-mono text-sm"
            placeholder="••••••••"
          />
          {error && <p className="text-hot text-xs font-mono">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full text-[10px] tracking-wider font-mono text-teal border border-teal/40 hover:bg-teal/10 disabled:opacity-30 py-2"
          >
            {loading ? "…" : "ENTER"}
          </button>
        </div>
      </form>
    </main>
  );
}

"use client";

import { useState } from "react";

export default function LoginPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });

      if (res.ok) {
        window.location.href = "/";
      } else {
        const data = await res.json();
        setError(data.error ?? "Invalid passcode");
      }
    } catch {
      setError("Failed to connect");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg-primary)" }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold mb-4">
            P
          </div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>Pitwall</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Personal finance command center
          </p>
        </div>

        <form onSubmit={handleSubmit} className="finance-card space-y-4">
          <div>
            <label htmlFor="passcode" className="block text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>
              Passcode
            </label>
            <input
              id="passcode"
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter your passcode"
              autoFocus
              required
              className="w-full rounded-xl px-4 py-3 text-sm"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: "var(--accent-red)" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !passcode}
            className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ background: "var(--accent-blue)", color: "#fff" }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

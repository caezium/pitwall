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
    <div className="min-h-screen flex items-center justify-center p-4 bg-base-100">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          {/* Racing-flavored brand gradient — matches sidebar logo */}
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mb-4 shadow-lg"
            style={{
              background: "linear-gradient(135deg, #ff3838 0%, #ff7a45 45%, #ffd23f 100%)",
              boxShadow: "0 6px 18px -6px rgba(255, 56, 56, 0.45)",
            }}
          >
            P
          </div>
          <h1 className="text-2xl font-semibold text-base-content">Pitwall</h1>
          <p className="text-sm mt-1 text-base-content/50">
            Personal finance command center
          </p>
        </div>

        <form onSubmit={handleSubmit} className="finance-card space-y-4">
          <div className="form-control">
            <label htmlFor="passcode" className="label py-1">
              <span className="label-text text-xs font-medium text-base-content/60 uppercase tracking-wider">
                Passcode
              </span>
            </label>
            <input
              id="passcode"
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter your passcode"
              autoFocus
              required
              className="input input-bordered w-full"
            />
          </div>

          {error && (
            <p className="text-sm text-error">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !passcode}
            className="btn btn-primary w-full"
          >
            {loading ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                Signing in…
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

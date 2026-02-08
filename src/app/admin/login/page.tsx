"use client";

import { useState } from "react";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Login failed");
      }

      window.location.href = "/admin";
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to login";
      setError(message);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-16">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
            Admin access
          </p>
          <h1 className="text-3xl font-semibold">Sign in</h1>
          <p className="text-sm text-white/70">
            Use the admin credentials to access the dashboard.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-sm"
        >
          <div className="space-y-4">
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
              Username
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
              Password
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
              />
            </label>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-6 w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

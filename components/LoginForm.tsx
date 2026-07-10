"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export function LoginForm() {
  const [email, setEmail] = useState("shop1@example.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  return (
    <form
      className="mt-8 grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        const supabase = createClient();
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

        if (signInError) {
          setBusy(false);
          setError(signInError.message);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();

        setBusy(false);

        if (profileError || !profile) {
          setError("Signed in, but no app profile was found for this user.");
          return;
        }

        router.push(profile.role === "shop_user" ? "/shop" : "/admin");
        router.refresh();
      }}
    >
      <label className="grid gap-2 text-lg font-bold text-ink">
        Email
        <input className="touch-target rounded-md border border-slate-300 px-4 text-xl" value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label className="grid gap-2 text-lg font-bold text-ink">
        Password
        <input className="touch-target rounded-md border border-slate-300 px-4 text-xl" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      {error ? <p className="rounded-md bg-red-50 p-3 font-bold text-red-700">{error}</p> : null}
      <button className="touch-target rounded-md bg-shop px-6 py-4 text-xl font-black text-ink" disabled={busy}>
        {busy ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}

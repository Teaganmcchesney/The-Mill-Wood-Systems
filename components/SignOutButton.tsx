"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export function SignOutButton({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      disabled={busy}
      data-app-update-blocked={busy}
      className="touch-target inline-flex shrink-0 items-center gap-2 rounded-md bg-ink px-4 py-3 text-lg font-bold text-white"
      onClick={async () => {
        setBusy(true);
        try {
          await createClient().auth.signOut();
          router.push("/login");
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
    </button>
  );
}

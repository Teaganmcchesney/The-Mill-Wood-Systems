"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export function SignOutButton({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <button
      className="touch-target inline-flex shrink-0 items-center gap-2 rounded-md bg-ink px-4 py-3 text-lg font-bold text-white"
      onClick={async () => {
        await createClient().auth.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      {children}
    </button>
  );
}

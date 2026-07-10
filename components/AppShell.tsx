import Link from "next/link";
import { BarChart3, ClipboardList, Factory, FileSearch, LogOut, Users } from "lucide-react";
import type { Profile } from "@/lib/types";
import { SignOutButton } from "@/components/SignOutButton";

export function AppShell({ profile, children }: { profile: Profile | null; children: React.ReactNode }) {
  const canManage = profile?.role === "admin" || profile?.role === "supervisor";

  return (
    <main className="min-h-screen bg-[#f3f5f7]">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/manpower" className="flex items-center gap-3" aria-label="The Mill Wood Systems tracker">
            <img src="/brand/mill-mark.svg" alt="" className="brand-mark" />
            <span className="grid leading-none">
              <span className="text-xl font-black tracking-[0.18em] text-ink">THE MILL</span>
              <span className="text-xs font-black tracking-[0.32em] text-steel">WOOD SYSTEMS</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2 overflow-x-auto">
            <Link className="touch-target inline-flex items-center gap-2 rounded-md px-4 py-3 text-lg font-bold text-ink hover:bg-slate-100" href="/manpower">
              <Users size={24} /> Manpower
            </Link>
            <Link className="touch-target inline-flex items-center gap-2 rounded-md px-4 py-3 text-lg font-bold text-ink hover:bg-slate-100" href="/shop">
              <Factory size={24} /> Shop
            </Link>
            <Link className="touch-target inline-flex items-center gap-2 rounded-md px-4 py-3 text-lg font-bold text-ink hover:bg-slate-100" href="/drawings">
              <FileSearch size={24} /> Drawings
            </Link>
            <Link className="touch-target inline-flex items-center gap-2 rounded-md px-4 py-3 text-lg font-bold text-ink hover:bg-slate-100" href="/dashboard">
              <BarChart3 size={24} /> Dashboard
            </Link>
            {canManage ? (
              <Link className="touch-target inline-flex items-center gap-2 rounded-md px-4 py-3 text-lg font-bold text-ink hover:bg-slate-100" href="/admin">
                <ClipboardList size={24} /> Admin
              </Link>
            ) : null}
            <SignOutButton>
              <LogOut size={22} /> Sign out
            </SignOutButton>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-6">{children}</div>
    </main>
  );
}

import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ShiftStart } from "@/components/ShiftStart";
import { getSessionWithProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase-server";

export default async function ManpowerPage() {
  const { profile } = await getSessionWithProfile();
  if (!profile) redirect("/login");

  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: lines }, { data: shiftManpower }] = await Promise.all([
    supabase.from("production_lines").select("*").order("sort_order"),
    supabase.from("shift_manpower").select("*").eq("shift_date", today)
  ]);

  return (
    <AppShell profile={profile}>
      <ShiftStart lines={lines ?? []} shiftManpower={shiftManpower ?? []} />
    </AppShell>
  );
}

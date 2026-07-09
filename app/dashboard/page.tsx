import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { DashboardCharts } from "@/components/DashboardCharts";
import { getSessionWithProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase-server";

export default async function DashboardPage() {
  const { profile } = await getSessionWithProfile();
  if (!profile) redirect("/login");

  const supabase = createClient();
  const [{ data: completions }, { data: walls }, { data: lines }] = await Promise.all([
    supabase
      .from("completion_logs")
      .select("*, production_lines(name)")
      .gte("completed_at", startOfWeekIso())
      .order("completed_at", { ascending: false }),
    supabase.from("wall_panels").select("wall_type, lineal_feet, status, production_lines(name)"),
    supabase.from("production_lines").select("*").order("sort_order")
  ]);

  return (
    <AppShell profile={profile}>
      <DashboardCharts completions={completions ?? []} walls={walls ?? []} lines={lines ?? []} />
    </AppShell>
  );
}

function startOfWeekIso() {
  const date = new Date();
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

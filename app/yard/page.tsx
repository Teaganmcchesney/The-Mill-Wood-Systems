import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { YardBoard } from "@/components/YardBoard";
import { getSessionWithProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase-server";

export default async function YardPage() {
  const { profile } = await getSessionWithProfile();
  if (!profile) redirect("/login");

  const supabase = createClient();
  const { data: walls } = await supabase
    .from("wall_panels")
    .select("id, wall_id, wall_type, level, lineal_feet, status, yard_status, bundle_label, yard_location, yard_notes, updated_at, projects(id, name, code), production_lines(name)")
    .eq("status", "complete")
    .order("updated_at", { ascending: false });

  return (
    <AppShell profile={profile}>
      <YardBoard walls={walls ?? []} />
    </AppShell>
  );
}

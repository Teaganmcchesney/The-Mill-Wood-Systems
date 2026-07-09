import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AdminPanel } from "@/components/AdminPanel";
import { getReferenceData, getSessionWithProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase-server";

export default async function AdminPage() {
  const { profile } = await getSessionWithProfile();
  if (!profile) redirect("/login");
  if (profile.role === "shop_user") redirect("/shop");

  const supabase = createClient();
  const [{ projects, lines, pages }, { data: walls }] = await Promise.all([
    getReferenceData(),
    supabase.from("wall_panels").select("*").order("sort_order")
  ]);

  return (
    <AppShell profile={profile}>
      <AdminPanel projects={projects} lines={lines} pages={pages} walls={walls ?? []} />
    </AppShell>
  );
}

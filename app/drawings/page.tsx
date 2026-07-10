import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { DrawingBrowser } from "@/components/DrawingBrowser";
import { getSessionWithProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase-server";

export default async function DrawingsPage() {
  const { profile } = await getSessionWithProfile();
  if (!profile) redirect("/login");

  const supabase = createClient();
  const [{ data: lines }, { data: walls }] = await Promise.all([
    supabase.from("production_lines").select("*").order("sort_order"),
    supabase
      .from("wall_panels")
      .select("id, wall_id, wall_type, level, lineal_feet, production_line_id, pdf_pages(page_number, image_url), projects(id, name, code), production_lines(name)")
      .order("wall_id")
  ]);

  return (
    <AppShell profile={profile}>
      <DrawingBrowser walls={walls ?? []} lines={lines ?? []} />
    </AppShell>
  );
}

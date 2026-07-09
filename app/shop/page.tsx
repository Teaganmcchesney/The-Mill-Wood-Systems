import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ShopQueue } from "@/components/ShopQueue";
import { getSessionWithProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase-server";

export default async function ShopPage({
  searchParams
}: {
  searchParams: { line?: string };
}) {
  const { profile } = await getSessionWithProfile();
  if (!profile) redirect("/login");

  const supabase = createClient();
  const { data: lines } = await supabase.from("production_lines").select("*").order("sort_order");
  const activeLineId = searchParams.line ?? profile.production_line_id ?? lines?.[0]?.id;

  const { data: walls } = await supabase
    .from("wall_panels")
    .select("*, production_lines(name), pdf_pages(page_number, image_url), projects(name, code)")
    .eq("production_line_id", activeLineId)
    .neq("status", "complete")
    .order("sort_order");

  return (
    <AppShell profile={profile}>
      <ShopQueue profile={profile} lines={lines ?? []} activeLineId={activeLineId} walls={walls ?? []} />
    </AppShell>
  );
}

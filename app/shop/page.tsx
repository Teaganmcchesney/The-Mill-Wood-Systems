import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ShopQueue } from "@/components/ShopQueue";
import { getSessionWithProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase-server";

export default async function ShopPage({
  searchParams
}: {
  searchParams: { line?: string; project?: string };
}) {
  const { profile } = await getSessionWithProfile();
  if (!profile) redirect("/login");

  const supabase = createClient();
  const [{ data: lines }, { data: projects }] = await Promise.all([
    supabase.from("production_lines").select("*").order("sort_order"),
    supabase.from("projects").select("*").order("code")
  ]);
  const activeLineId = searchParams.line ?? profile.production_line_id ?? lines?.[0]?.id ?? "";
  const activeProjectId = searchParams.project ?? "all";

  if (!activeLineId) {
    return (
      <AppShell profile={profile}>
        <section className="rounded-md bg-white p-10 text-center shadow-touch">
          <h1 className="text-3xl font-black text-ink">No production lines found</h1>
          <p className="mt-2 text-xl text-steel">Add Sheathed and Interior lines in Supabase, then refresh this page.</p>
        </section>
      </AppShell>
    );
  }

  let wallQuery = supabase
    .from("wall_panels")
    .select("*, production_lines(name), pdf_pages(page_number, image_url), projects(name, code)")
    .eq("production_line_id", activeLineId)
    .neq("status", "complete")
    .order("sort_order");

  if (activeProjectId !== "all") {
    wallQuery = wallQuery.eq("project_id", activeProjectId);
  }

  const { data: walls } = await wallQuery;

  return (
    <AppShell profile={profile}>
      <ShopQueue
        profile={profile}
        lines={lines ?? []}
        projects={projects ?? []}
        activeLineId={activeLineId}
        activeProjectId={activeProjectId}
        walls={walls ?? []}
      />
    </AppShell>
  );
}

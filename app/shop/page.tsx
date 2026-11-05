import { sortProductionWalls } from "@/lib/production-queue";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ShopQueue } from "@/components/ShopQueue";
import { getSessionWithProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase-server";

export default async function ShopPage({
  searchParams,
}: {
  searchParams: { line?: string; project?: string };
}) {
  const { profile } = await getSessionWithProfile();
  if (!profile) redirect("/login");

  const supabase = createClient();
  const [{ data: lines }, { data: projects }] = await Promise.all([
    supabase.from("production_lines").select("*").order("sort_order"),
    supabase.from("projects").select("*").order("code"),
  ]);
  const activeLineId =
    searchParams.line ?? profile.production_line_id ?? lines?.[0]?.id ?? "";
  const activeProjectId = searchParams.project ?? "all";

  if (!activeLineId) {
    return (
      <AppShell profile={profile}>
        <section className="rounded-md bg-white p-10 text-center shadow-touch">
          <h1 className="text-3xl font-black text-ink">
            No production lines found
          </h1>
          <p className="mt-2 text-xl text-steel">
            Add Sheathed and Interior lines in Supabase, then refresh this page.
          </p>
        </section>
      </AppShell>
    );
  }

  const wallQuery = supabase
    .rpc("production_queue", {
      p_line: activeLineId,
      p_project: activeProjectId === "all" ? null : activeProjectId,
    })
    .select(
      "*, production_lines(name), pdf_pages(page_number, image_url), projects(name, code), wall_notes(note_text, markup_data), bundle_panels(bundles(id,bundle_id,production_order))",
    );

  let completedWallQuery = supabase
    .from("wall_panels")
    .select(
      "*, production_lines(name), pdf_pages(page_number, image_url), projects(name, code), wall_notes(note_text, markup_data), bundle_panels(bundles(id,bundle_id,production_order))",
    )
    .eq("production_line_id", activeLineId)
    .eq("status", "complete")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (activeProjectId !== "all") {
    completedWallQuery = completedWallQuery.eq("project_id", activeProjectId);
  }

  const [{ data: walls }, { data: completedWalls }] = await Promise.all([
    wallQuery,
    completedWallQuery,
  ]);

  return (
    <AppShell profile={profile}>
      <ShopQueue
        profile={profile}
        lines={lines ?? []}
        projects={projects ?? []}
        activeLineId={activeLineId}
        activeProjectId={activeProjectId}
        walls={sortProductionWalls(walls ?? [])}
        lastCompletedWall={completedWalls?.[0] ?? null}
      />
    </AppShell>
  );
}

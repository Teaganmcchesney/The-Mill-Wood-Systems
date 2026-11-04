import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { BundleYard } from "@/components/BundleYard";
import type { BundleDrawing, QueueHead } from "@/lib/yard-display";
import { getSessionWithProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase-server";
export default async function YardPage({
  searchParams,
}: {
  searchParams: { line?: string; project?: string };
}) {
  const { profile } = await getSessionWithProfile();
  if (!profile) redirect("/login");
  const supabase = createClient();
  const [{ data: lines }, { data: projects }] = await Promise.all([
    supabase
      .from("production_lines")
      .select("id,name,sort_order")
      .order("sort_order"),
    supabase.from("projects").select("id,code,name").order("code"),
  ]);
  const lineList = lines ?? [],
    projectList = projects ?? [];
  const activeLine =
    lineList.find((l) => l.id === searchParams.line)?.id ??
    lineList.find((l) => l.id === profile.production_line_id)?.id ??
    lineList[0]?.id ??
    "";
  const activeProject = projectList.some((p) => p.id === searchParams.project)
    ? searchParams.project!
    : "all";
  let bundleQuery = supabase
    .from("bundles")
    .select(
      "*, projects(code,name), bundle_panels(id,outline,verified_at,wall_panels(id,wall_id,status,lineal_feet,production_line_id,sort_order,updated_at,pdf_pages(page_number)))",
    )
    .order("bundle_id");
  let headQuery = supabase
    .from("wall_panels")
    .select("id,wall_id,project_id,level,production_line_id,sort_order,status")
    .eq("production_line_id", activeLine)
    .neq("status", "complete")
    .order("sort_order")
    .order("id")
    .limit(1);
  if (activeProject !== "all") {
    bundleQuery = bundleQuery.eq("project_id", activeProject);
    headQuery = headQuery.eq("project_id", activeProject);
  }
  const [{ data: bundles, error }, { data: heads }] = await Promise.all([
    bundleQuery,
    activeLine ? headQuery : Promise.resolve({ data: [] }),
  ]);
  return (
    <AppShell profile={profile}>
      {error ? (
        <p
          role="alert"
          className="rounded border border-orange-500 p-5 text-ink"
        >
          The stacking display could not load. Refresh or ask your supervisor to
          check Yard setup.
        </p>
      ) : (
        <BundleYard
          key={activeLine + "|" + activeProject}
          bundles={(bundles ?? []) as BundleDrawing[]}
          lines={lineList}
          projects={projectList.map((p) => ({
            id: p.id,
            name: p.code + " — " + p.name,
          }))}
          activeLine={activeLine}
          activeProject={activeProject}
          head={(heads?.[0] ?? null) as QueueHead | null}
          manager={profile.role !== "shop_user"}
        />
      )}
    </AppShell>
  );
}

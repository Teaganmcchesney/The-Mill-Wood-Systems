import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { BundleOutlineSetup } from "@/components/BundleOutlineSetup";
import { YardBoard } from "@/components/YardBoard";
import { getSessionWithProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase-server";
export default async function YardSetup() {
  const { profile } = await getSessionWithProfile();
  if (!profile) redirect("/login");
  const supabase = createClient();
  const [{ data: bundles, error }, { data: walls }] = await Promise.all([
    supabase
      .from("bundles")
      .select(
        "*, projects(code,name), bundle_panels(id,outline,verified_at,wall_panels(id,wall_id,status,lineal_feet,production_line_id,sort_order,pdf_pages(page_number)))",
      )
      .order("bundle_id"),
    supabase
      .from("wall_panels")
      .select(
        "id,wall_id,wall_type,level,lineal_feet,status,yard_status,bundle_label,yard_location,yard_notes,updated_at,projects(id,name,code),production_lines(name),pdf_pages(page_number,image_url),wall_notes(note_text,markup_data)",
      )
      .eq("status", "complete")
      .order("updated_at", { ascending: false }),
  ]);
  return (
    <AppShell profile={profile}>
      <div className="grid gap-6">
        <Link
          href="/yard"
          className="touch-target inline-flex items-center font-bold text-ink underline"
        >
          Back to stacking display
        </Link>
        {error ? (
          <p role="alert" className="text-ink">
            Bundle setup is unavailable. Refresh and try again.
          </p>
        ) : (
          <BundleOutlineSetup
            bundles={bundles ?? []}
            manager={profile.role !== "shop_user"}
          />
        )}
        <YardBoard walls={walls ?? []} />
      </div>
    </AppShell>
  );
}

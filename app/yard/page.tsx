import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { BundleYard, type BundleDrawing } from "@/components/BundleYard";
import { YardBoard } from "@/components/YardBoard";
import { getSessionWithProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase-server";

export default async function YardPage() {
  const { profile } = await getSessionWithProfile();
  if (!profile) redirect("/login");

  const supabase = createClient();
  const { data: walls } = await supabase
    .from("wall_panels")
    .select(
      "id, wall_id, wall_type, level, lineal_feet, status, yard_status, bundle_label, yard_location, yard_notes, updated_at, projects(id, name, code), production_lines(name), pdf_pages(page_number, image_url), wall_notes(note_text, markup_data)",
    )
    .eq("status", "complete")
    .order("updated_at", { ascending: false });

  const { data: bundles, error: bundleError } = await supabase
    .from("bundles")
    .select(
      "*, projects(code, name), bundle_panels(id, outline, verified_at, wall_panels(id, wall_id, status, lineal_feet))",
    )
    .order("bundle_id");

  return (
    <AppShell profile={profile}>
      {bundleError ? (
        <p role="alert" className="rounded bg-orange-100 text-black p-4">
          Bundle drawings unavailable. The joint-package database update may
          need to be applied. Existing Yard tracking is available below.
        </p>
      ) : (
        <BundleYard
          bundles={(bundles ?? []) as BundleDrawing[]}
          manager={profile.role !== "shop_user"}
        />
      )}
      <YardBoard walls={walls ?? []} />
    </AppShell>
  );
}

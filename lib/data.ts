import { createClient } from "@/lib/supabase-server";

export async function getSessionWithProfile() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, production_line_id")
    .eq("id", user.id)
    .single();

  return { user, profile };
}

export async function getReferenceData() {
  const supabase = createClient();
  const [{ data: projects }, { data: lines }, { data: pages }] = await Promise.all([
    supabase.from("projects").select("*").order("created_at", { ascending: false }),
    supabase.from("production_lines").select("*").order("sort_order"),
    supabase.from("pdf_pages").select("*").order("page_number")
  ]);

  return { projects: projects ?? [], lines: lines ?? [], pages: pages ?? [] };
}

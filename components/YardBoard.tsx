"use client";

import { useMemo, useState } from "react";
import { Save } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

type JoinedProject = { id: string; name: string; code: string } | { id: string; name: string; code: string }[] | null;
type JoinedLine = { name: string } | { name: string }[] | null;

type YardWall = {
  id: string;
  wall_id: string;
  wall_type: string;
  level: string;
  lineal_feet: number;
  status: string;
  yard_status: string | null;
  bundle_label: string | null;
  yard_location: string | null;
  yard_notes: string | null;
  updated_at: string;
  projects: JoinedProject;
  production_lines: JoinedLine;
};

type YardDraft = {
  bundle_label: string;
  yard_location: string;
  yard_status: string;
  yard_notes: string;
};

const YARD_STATUSES = ["Ready", "Bundled", "Staged", "Loaded", "Shipped"];

export function YardBoard({ walls }: { walls: YardWall[] }) {
  const [rows, setRows] = useState(walls);
  const [drafts, setDrafts] = useState<Record<string, YardDraft>>(() => Object.fromEntries(walls.map((wall) => [wall.id, draftFromWall(wall)])));
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const projects = uniqueProjects(rows);
  const [projectKey, setProjectKey] = useState("all");
  const filteredRows = rows.filter((wall) => projectKey === "all" || projectKeyFor(wall.projects) === projectKey);
  const bundles = useMemo(() => groupByBundle(filteredRows, drafts), [filteredRows, drafts]);
  const totalFeet = filteredRows.reduce((sum, wall) => sum + Number(wall.lineal_feet), 0);

  function updateDraft(id: string, patch: Partial<YardDraft>) {
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? emptyDraft()), ...patch } }));
  }

  async function saveWall(wall: YardWall) {
    const draft = drafts[wall.id] ?? emptyDraft();
    setSavingId(wall.id);
    setError("");
    const supabase = createClient();
    const payload = {
      bundle_label: draft.bundle_label.trim() || null,
      yard_location: draft.yard_location.trim() || null,
      yard_status: draft.yard_status || "Ready",
      yard_notes: draft.yard_notes.trim() || null
    };
    const { error: saveError } = await supabase.from("wall_panels").update(payload).eq("id", wall.id);
    setSavingId("");

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setRows((current) => current.map((item) => (item.id === wall.id ? { ...item, ...payload } : item)));
  }

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-lg font-bold text-steel">Yard</p>
        <h1 className="text-4xl font-black text-ink">Completed walls and bundles</h1>
      </div>

      <section className="grid gap-4 rounded-md bg-white p-5 shadow-touch md:grid-cols-[1fr_auto_auto] md:items-end">
        <label className="grid gap-2 text-lg font-bold text-ink">
          Project
          <select className="touch-target rounded-md border border-slate-300 px-4" value={projectKey} onChange={(event) => setProjectKey(event.target.value)}>
            <option value="all">All projects</option>
            {projects.map((project) => <option key={project.key} value={project.key}>{project.label}</option>)}
          </select>
        </label>
        <Metric label="Completed walls" value={String(filteredRows.length)} />
        <Metric label="Lineal feet" value={`${totalFeet.toFixed(1)} LF`} />
      </section>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-lg font-bold text-red-700">{error}</p> : null}

      {bundles.map((bundle) => (
        <section key={bundle.name} className="grid gap-3 rounded-md bg-white p-5 shadow-touch">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase text-steel">Bundle</p>
              <h2 className="text-3xl font-black text-ink">{bundle.name}</h2>
            </div>
            <span className="rounded-md bg-slate-100 px-4 py-3 text-lg font-black text-ink">{bundle.walls.length} walls / {bundle.feet.toFixed(1)} LF</span>
          </div>
          <div className="grid gap-3">
            {bundle.walls.map((wall) => {
              const project = firstJoined(wall.projects);
              const line = firstJoined(wall.production_lines);
              const draft = drafts[wall.id] ?? emptyDraft();
              return (
                <article key={wall.id} className="grid gap-3 rounded-md bg-slate-100 p-4 xl:grid-cols-[1fr_10rem_10rem_10rem_1fr_auto] xl:items-end">
                  <div>
                    <p className="text-base font-bold text-steel">{project?.code} / {wall.level} / {line?.name ?? "Line"}</p>
                    <h3 className="text-3xl font-black text-ink">{wall.wall_id}</h3>
                    <p className="text-lg font-bold text-steel">{wall.wall_type} / {Number(wall.lineal_feet).toFixed(1)} LF</p>
                  </div>
                  <Field label="Bundle" value={draft.bundle_label} onChange={(value) => updateDraft(wall.id, { bundle_label: value })} />
                  <Field label="Location" value={draft.yard_location} onChange={(value) => updateDraft(wall.id, { yard_location: value })} />
                  <label className="grid gap-2 text-base font-bold text-ink">
                    Status
                    <select className="touch-target rounded-md border border-slate-300 px-3" value={draft.yard_status} onChange={(event) => updateDraft(wall.id, { yard_status: event.target.value })}>
                      {YARD_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </label>
                  <Field label="Notes" value={draft.yard_notes} onChange={(value) => updateDraft(wall.id, { yard_notes: value })} />
                  <button
                    onClick={() => void saveWall(wall)}
                    disabled={savingId === wall.id}
                    className="touch-target inline-flex items-center justify-center gap-2 rounded-md bg-ink px-5 py-3 text-lg font-black text-white disabled:opacity-60"
                  >
                    <Save size={22} /> {savingId === wall.id ? "Saving..." : "Save"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {!filteredRows.length ? (
        <section className="rounded-md bg-white p-10 text-center shadow-touch">
          <h2 className="text-3xl font-black text-ink">No completed walls in Yard yet</h2>
          <p className="mt-2 text-xl text-steel">Completed shop walls will show here for bundle and location tracking.</p>
        </section>
      ) : null}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-base font-bold text-ink">
      {label}
      <input className="touch-target rounded-md border border-slate-300 px-3" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-100 p-4">
      <p className="text-sm font-bold uppercase text-steel">{label}</p>
      <p className="text-3xl font-black text-ink">{value}</p>
    </div>
  );
}

function groupByBundle(walls: YardWall[], drafts: Record<string, YardDraft>) {
  const map = new Map<string, YardWall[]>();
  walls.forEach((wall) => {
    const draft = drafts[wall.id] ?? draftFromWall(wall);
    const key = draft.bundle_label.trim() || "Unbundled";
    map.set(key, [...(map.get(key) ?? []), wall]);
  });

  return Array.from(map, ([name, bundleWalls]) => ({
    name,
    walls: bundleWalls,
    feet: bundleWalls.reduce((sum, wall) => sum + Number(wall.lineal_feet), 0)
  })).sort((a, b) => a.name.localeCompare(b.name));
}

function draftFromWall(wall: YardWall): YardDraft {
  return {
    bundle_label: wall.bundle_label ?? "",
    yard_location: wall.yard_location ?? "",
    yard_status: wall.yard_status ?? "Ready",
    yard_notes: wall.yard_notes ?? ""
  };
}

function emptyDraft(): YardDraft {
  return { bundle_label: "", yard_location: "", yard_status: "Ready", yard_notes: "" };
}

function uniqueProjects(walls: YardWall[]) {
  const map = new Map<string, string>();
  walls.forEach((wall) => {
    const project = firstJoined(wall.projects);
    if (project) map.set(project.id, `${project.code} - ${project.name}`);
  });
  return Array.from(map, ([key, label]) => ({ key, label }));
}

function projectKeyFor(project: JoinedProject) {
  return firstJoined(project)?.id ?? "none";
}

function firstJoined<T>(value: T | T[] | null) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

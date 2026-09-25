"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, MoveRight, RotateCcw, ShieldCheck, SkipForward, X } from "lucide-react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { useRouter } from "next/navigation";
import { WallNotesButton } from "@/components/WallNotesButton";
import { ZoomableDrawing } from "@/components/ZoomableDrawing";
import { createClient } from "@/lib/supabase-browser";
import type { ProductionLine, Profile, Project } from "@/lib/types";

type JoinedPage = { page_number: number; image_url: string } | { page_number: number; image_url: string }[] | null;
type JoinedProject = { name: string; code: string } | { name: string; code: string }[] | null;
type JoinedNote = { markup_data: unknown; note_text: string | null } | { markup_data: unknown; note_text: string | null }[] | null;
type QaqcChecks = Record<string, boolean>;

type QueueWall = {
  id: string;
  project_id: string;
  wall_id: string;
  wall_type: string;
  level: string;
  area_sqft: number;
  lineal_feet: number;
  production_line_id: string;
  sort_order: number;
  pdf_pages: JoinedPage;
  projects: JoinedProject;
  wall_notes: JoinedNote;
};

const QAQC_ITEMS = [
  { id: "wall_square", label: "Wall is square" },
  { id: "correct_length", label: "Correct length" },
  { id: "correct_ros", label: "Correct RO's" },
  { id: "sheathing_overhang", label: "Sheathing overhang" },
  { id: "end_sheathing_flush", label: "End sheathing flush" },
  { id: "correct_nail_pattern", label: "Correct nail pattern" },
  { id: "correct_nail_type", label: "Correct nail type" },
  { id: "straight_end_stud", label: "Straight end stud" },
  { id: "wain_down_top_plate", label: "Wain down on top plate" },
  { id: "wain_out_window_sill", label: "Wain out on window sill" },
  { id: "correct_poly_lap", label: "Correct poly lap" },
  { id: "correct_label", label: "Correct label" }
];

export function ShopQueue({
  profile,
  lines,
  projects,
  activeLineId,
  activeProjectId,
  walls,
  lastCompletedWall
}: {
  profile: Profile;
  lines: ProductionLine[];
  projects: Project[];
  activeLineId: string;
  activeProjectId: string;
  walls: QueueWall[];
  lastCompletedWall: QueueWall | null;
}) {
  const activeWall = walls[0] ?? null;
  const nextWalls = walls.slice(1, 6);
  const activeProject = projects.find((project) => project.id === activeProjectId);

  return (
    <div className="grid gap-6">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-lg font-bold text-steel">Production queue</p>
            <h1 className="text-4xl font-black text-ink">Current wall drawing</h1>
          </div>
          <div className="flex gap-2 overflow-x-auto rounded-md bg-white p-2 shadow-touch">
            {lines.map((line) => (
              <Link
                key={line.id}
                href={shopHref(line.id, activeProjectId)}
                className={`touch-target rounded-md px-5 py-3 text-lg font-black ${
                  line.id === activeLineId ? "bg-ink text-white" : "bg-slate-100 text-ink"
                }`}
              >
                {line.name}
              </Link>
            ))}
          </div>
        </div>

        <section className="grid gap-3 rounded-md bg-white p-4 shadow-touch">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase text-steel">Project</p>
              <h2 className="text-2xl font-black text-ink">{activeProject ? `${activeProject.code} - ${activeProject.name}` : "All projects"}</h2>
            </div>
            <span className="rounded-md bg-slate-100 px-4 py-3 text-lg font-black text-ink">{walls.length} waiting</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Link
              href={shopHref(activeLineId, "all")}
              className={`touch-target whitespace-nowrap rounded-md px-5 py-3 text-lg font-black ${
                activeProjectId === "all" ? "bg-ink text-white" : "bg-slate-100 text-ink"
              }`}
            >
              All projects
            </Link>
            {projects.map((project) => (
              <Link
                key={project.id}
                href={shopHref(activeLineId, project.id)}
                className={`touch-target whitespace-nowrap rounded-md px-5 py-3 text-lg font-black ${
                  project.id === activeProjectId ? "bg-ink text-white" : "bg-slate-100 text-ink"
                }`}
              >
                {project.code}
              </Link>
            ))}
          </div>
        </section>
      </div>

      {activeWall ? (
        <>
          <ActiveWall
            wall={activeWall}
            profile={profile}
            remainingCount={walls.length}
            activeProjectId={activeProjectId}
            lastCompletedWall={lastCompletedWall}
          />
          {nextWalls.length ? (
            <section className="rounded-md bg-white p-5 shadow-touch">
              <h2 className="text-2xl font-black text-ink">Coming up next</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {nextWalls.map((wall) => {
                  const project = firstJoined(wall.projects);
                  return (
                    <div key={wall.id} className="rounded-md bg-slate-100 p-4">
                      <p className="text-2xl font-black text-ink">{wall.wall_id}</p>
                      <p className="text-lg font-bold text-steel">{project?.code} / {wall.level}</p>
                      <p className="text-lg font-bold text-steel">{wall.wall_type} / {wall.lineal_feet.toFixed(1)} LF</p>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <section className="rounded-md bg-white p-10 text-center shadow-touch">
          <h2 className="text-3xl font-black text-ink">No walls waiting here</h2>
          <p className="mt-2 text-xl text-steel">Switch project or line to find the next wall drawing.</p>
          {lastCompletedWall ? <UndoWallButton wall={lastCompletedWall} className="mx-auto mt-6 max-w-xl" /> : null}
        </section>
      )}
    </div>
  );
}

function ActiveWall({
  wall,
  profile,
  remainingCount,
  activeProjectId,
  lastCompletedWall
}: {
  wall: QueueWall;
  profile: Profile;
  remainingCount: number;
  activeProjectId: string;
  lastCompletedWall: QueueWall | null;
}) {
  const router = useRouter();
  const x = useMotionValue(0);
  const background = useTransform(x, [0, 220], ["#ffffff", "#dcfce7"]);
  const page = firstJoined(wall.pdf_pages);
  const project = firstJoined(wall.projects);
  const note = firstJoined(wall.wall_notes);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [qaqcOpen, setQaqcOpen] = useState(false);

  useEffect(() => {
    x.set(0);
    setBusy(false);
    setMessage("");
    setQaqcOpen(false);
  }, [wall.id, x]);

  async function completeWall(checks: QaqcChecks) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const { error: checkError } = await supabase.from("wall_qaqc_checks").upsert(
      {
        wall_panel_id: wall.id,
        checklist: checks,
        checked_by: profile.id,
        checked_at: new Date().toISOString()
      },
      { onConflict: "wall_panel_id" }
    );

    if (checkError) {
      setMessage(checkError.message);
      setBusy(false);
      return;
    }

    const { error } = await supabase.rpc("complete_wall_panel", {
      p_wall_panel_id: wall.id,
      p_completed_by: profile.id
    });
    if (error) {
      setMessage(error.message);
      setBusy(false);
      x.set(0);
      return;
    }
    x.set(0);
    setQaqcOpen(false);
    router.refresh();
  }

  function openQaqc() {
    if (busy) return;
    setMessage("");
    setQaqcOpen(true);
    x.set(0);
  }

  async function skipWall() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    let maxQuery = supabase
      .from("wall_panels")
      .select("sort_order")
      .eq("production_line_id", wall.production_line_id)
      .neq("status", "complete")
      .order("sort_order", { ascending: false })
      .limit(1);

    if (activeProjectId !== "all") maxQuery = maxQuery.eq("project_id", wall.project_id);

    const { data: maxRows, error: maxError } = await maxQuery;
    if (maxError) {
      setMessage(maxError.message);
      setBusy(false);
      return;
    }

    const nextSortOrder = Number(maxRows?.[0]?.sort_order ?? wall.sort_order) + 10;
    const { error } = await supabase.from("wall_panels").update({ sort_order: nextSortOrder }).eq("id", wall.id);
    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }

    router.refresh();
  }

  return (
    <>
      <motion.article
        drag={busy ? false : "x"}
        dragConstraints={{ left: 0, right: 260 }}
        style={{ x, background }}
        onDragEnd={(_, info) => {
          if (info.offset.x > 170) openQaqc();
          else x.set(0);
        }}
        className="grid gap-5 overflow-hidden rounded-md border border-slate-200 bg-white p-5 shadow-touch xl:grid-cols-[minmax(0,1fr)_24rem]"
      >
        <ZoomableDrawing imageUrl={page?.image_url} alt={`Drawing page ${page?.page_number ?? ""}`} className="min-h-[62vh]" markupData={note?.markup_data} noteText={note?.note_text} />

        <aside className="grid content-between gap-5">
          <div className="grid gap-4">
            <div>
              <p className="text-xl font-bold text-steel">{project?.code} / {wall.level}</p>
              <h2 className="text-6xl font-black text-ink">{wall.wall_id}</h2>
            </div>
            <span className="w-fit rounded-md bg-shop px-5 py-3 text-2xl font-black text-ink">{wall.wall_type}</span>
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Lineal feet" value={wall.lineal_feet.toFixed(1)} />
              <Metric label="Page" value={page ? String(page.page_number) : "-"} />
              <Metric label="Queue" value={String(remainingCount)} />
            </div>
          </div>

          <div className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-2">
              {lastCompletedWall ? <UndoWallButton wall={lastCompletedWall} /> : null}
              <button
                onClick={skipWall}
                disabled={busy}
                className="touch-target inline-flex w-full items-center justify-center gap-3 rounded-md bg-slate-100 px-6 py-4 text-2xl font-black text-ink disabled:cursor-not-allowed disabled:opacity-60"
              >
                <SkipForward size={30} /> {busy ? "Working..." : "Skip"}
              </button>
            </div>
            <WallNotesButton wallId={wall.id} wallLabel={wall.wall_id} imageUrl={page?.image_url} pageLabel={project ? `${project.code} / ${wall.level}` : wall.level} onSaved={() => router.refresh()} />
            <button
              onClick={openQaqc}
              disabled={busy}
              className="touch-target inline-flex w-full items-center justify-center gap-3 rounded-md bg-pass px-6 py-5 text-3xl font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ShieldCheck size={34} /> {busy ? "Completing..." : "QA/QC First"}
            </button>
            <p className="flex items-center gap-2 text-xl font-bold text-steel">
              <MoveRight size={24} /> Swipe drawing right to open QA/QC. Pinch drawing to zoom.
            </p>
            {message ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-base font-bold text-red-700">{message}</p> : null}
          </div>
        </aside>
      </motion.article>
      {qaqcOpen ? (
        <QaqcModal
          wallLabel={wall.wall_id}
          pageLabel={project ? `${project.code} / ${wall.level}` : wall.level}
          busy={busy}
          error={message}
          onClose={() => setQaqcOpen(false)}
          onComplete={(checks) => void completeWall(checks)}
        />
      ) : null}
    </>
  );
}

function QaqcModal({
  wallLabel,
  pageLabel,
  busy,
  error,
  onClose,
  onComplete
}: {
  wallLabel: string;
  pageLabel: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onComplete: (checks: QaqcChecks) => void;
}) {
  const [checks, setChecks] = useState<QaqcChecks>(() => Object.fromEntries(QAQC_ITEMS.map((item) => [item.id, false])));
  const complete = useMemo(() => QAQC_ITEMS.every((item) => checks[item.id]), [checks]);
  const checkedCount = QAQC_ITEMS.filter((item) => checks[item.id]).length;

  function toggle(id: string) {
    setChecks((current) => ({ ...current, [id]: !current[id] }));
  }

  return (
    <div className="fixed inset-0 z-50 grid bg-black/80 p-4 lg:p-8">
      <section className="m-auto grid max-h-full w-full max-w-5xl gap-5 overflow-auto rounded-md bg-white p-5 shadow-touch">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-steel">{pageLabel}</p>
            <h2 className="text-4xl font-black text-ink">QA/QC for {wallLabel}</h2>
            <p className="mt-1 text-xl font-bold text-steel">{checkedCount} of {QAQC_ITEMS.length} checked</p>
          </div>
          <button onClick={onClose} disabled={busy} className="touch-target rounded-md bg-slate-100 px-4 py-3 text-lg font-black text-ink disabled:opacity-60">
            <X size={26} />
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {QAQC_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
              disabled={busy}
              className={`touch-target flex items-center justify-between gap-4 rounded-md border-2 p-5 text-left text-2xl font-black disabled:opacity-60 ${
                checks[item.id] ? "border-pass bg-green-50 text-ink" : "border-slate-200 bg-slate-100 text-ink"
              }`}
            >
              <span>{item.label}</span>
              <span className={`grid size-11 shrink-0 place-items-center rounded-md border-2 ${checks[item.id] ? "border-pass bg-pass text-white" : "border-slate-300 bg-white text-transparent"}`}>
                <CheckCircle2 size={30} />
              </span>
            </button>
          ))}
        </div>

        {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-lg font-bold text-red-700">{error}</p> : null}

        <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
          <button onClick={onClose} disabled={busy} className="touch-target rounded-md bg-slate-100 px-6 py-5 text-2xl font-black text-ink disabled:opacity-60">
            Back to wall
          </button>
          <button
            onClick={() => onComplete(checks)}
            disabled={busy || !complete}
            className="touch-target inline-flex items-center justify-center gap-3 rounded-md bg-pass px-6 py-5 text-3xl font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-steel"
          >
            <CheckCircle2 size={34} /> {busy ? "Completing..." : complete ? "Complete" : "Check all items first"}
          </button>
        </div>
      </section>
    </div>
  );
}

function UndoWallButton({ wall, className = "" }: { wall: QueueWall; className?: string }) {
  const router = useRouter();
  const project = firstJoined(wall.projects);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function undoWall() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.rpc("undo_wall_completion", {
      p_wall_panel_id: wall.id
    });
    if (!error) {
      router.refresh();
      return;
    }
    setMessage(error.message);
    setBusy(false);
  }

  return (
    <div className={`grid gap-2 ${className}`}>
      <button
        onClick={undoWall}
        disabled={busy}
        className="touch-target inline-flex w-full items-center justify-center gap-3 rounded-md bg-slate-100 px-6 py-4 text-2xl font-black text-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RotateCcw size={30} />
        {busy ? "Restoring..." : `Go back ${project?.code ? `${project.code} / ` : ""}${wall.wall_id}`}
      </button>
      {message ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-base font-bold text-red-700">{message}</p> : null}
    </div>
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

function shopHref(lineId: string, projectId: string) {
  const params = new URLSearchParams({ line: lineId });
  if (projectId !== "all") params.set("project", projectId);
  return `/shop?${params.toString()}`;
}

function firstJoined<T>(value: T | T[] | null) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

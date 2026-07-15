"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, MoveLeft, MoveRight, RotateCcw } from "lucide-react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { ProductionLine, Profile, Project } from "@/lib/types";

type JoinedPage = { page_number: number; image_url: string } | { page_number: number; image_url: string }[] | null;
type JoinedProject = { name: string; code: string } | { name: string; code: string }[] | null;

type QueueWall = {
  id: string;
  wall_id: string;
  wall_type: string;
  level: string;
  area_sqft: number;
  lineal_feet: number;
  production_line_id: string;
  pdf_pages: JoinedPage;
  projects: JoinedProject;
};

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
          <ActiveWall wall={activeWall} profile={profile} remainingCount={walls.length} lastCompletedWall={lastCompletedWall} />
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
  lastCompletedWall
}: {
  wall: QueueWall;
  profile: Profile;
  remainingCount: number;
  lastCompletedWall: QueueWall | null;
}) {
  const router = useRouter();
  const x = useMotionValue(0);
  const background = useTransform(x, [0, 220], ["#ffffff", "#dcfce7"]);
  const page = firstJoined(wall.pdf_pages);
  const project = firstJoined(wall.projects);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    x.set(0);
    setBusy(false);
  }, [wall.id, x]);

  async function completeWall() {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("complete_wall_panel", {
      p_wall_panel_id: wall.id,
      p_completed_by: profile.id
    });
    if (error) {
      setBusy(false);
      x.set(0);
      return;
    }
    x.set(0);
    router.refresh();
  }

  return (
    <motion.article
      drag={busy ? false : "x"}
      dragConstraints={{ left: 0, right: 260 }}
      style={{ x, background }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 170) void completeWall();
        else x.set(0);
      }}
      className="grid gap-5 overflow-hidden rounded-md border border-slate-200 bg-white p-5 shadow-touch xl:grid-cols-[minmax(0,1fr)_24rem]"
    >
      <div className="min-h-[62vh] overflow-hidden rounded-md border border-slate-200 bg-slate-100">
        {page?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={page.image_url} alt={`Drawing page ${page.page_number}`} className="h-full max-h-[78vh] min-h-[62vh] w-full object-contain" />
        ) : (
          <div className="grid h-[62vh] place-items-center p-4 text-center text-2xl font-black text-steel">No drawing attached</div>
        )}
      </div>

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
          {lastCompletedWall ? <UndoWallButton wall={lastCompletedWall} /> : null}
          <button
            onClick={completeWall}
            disabled={busy}
            className="touch-target inline-flex w-full items-center justify-center gap-3 rounded-md bg-pass px-6 py-5 text-3xl font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <CheckCircle2 size={34} /> {busy ? "Completing..." : "Complete"}
          </button>
          <p className="flex items-center gap-2 text-xl font-bold text-steel">
            <MoveRight size={24} /> Swipe drawing right to complete
          </p>
        </div>
      </aside>
    </motion.article>
  );
}

function UndoWallButton({ wall, className = "" }: { wall: QueueWall; className?: string }) {
  const router = useRouter();
  const project = firstJoined(wall.projects);
  const [busy, setBusy] = useState(false);

  async function undoWall() {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("undo_wall_completion", {
      p_wall_panel_id: wall.id
    });
    if (!error) router.refresh();
    else setBusy(false);
  }

  return (
    <button
      onClick={undoWall}
      disabled={busy}
      className={`touch-target inline-flex w-full items-center justify-center gap-3 rounded-md bg-slate-100 px-6 py-4 text-2xl font-black text-ink disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      <RotateCcw size={30} />
      {busy ? "Restoring..." : `Go back to ${project?.code ? `${project.code} / ` : ""}${wall.wall_id}`}
    </button>
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

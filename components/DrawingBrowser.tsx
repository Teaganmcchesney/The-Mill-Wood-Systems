"use client";

import { useMemo, useState } from "react";
import type { ProductionLine } from "@/lib/types";

type JoinedPage = { page_number: number; image_url: string } | { page_number: number; image_url: string }[] | null;
type JoinedProject = { id: string; name: string; code: string } | { id: string; name: string; code: string }[] | null;
type JoinedLine = { name: string } | { name: string }[] | null;

type DrawingWall = {
  id: string;
  wall_id: string;
  wall_type: string;
  level: string;
  lineal_feet: number;
  production_line_id: string;
  pdf_pages: JoinedPage;
  projects: JoinedProject;
  production_lines: JoinedLine;
};

export function DrawingBrowser({ walls, lines }: { walls: DrawingWall[]; lines: ProductionLine[] }) {
  const projects = uniqueProjects(walls);
  const [projectKey, setProjectKey] = useState(projects[0]?.key ?? "all");
  const projectWalls = useMemo(
    () => walls.filter((wall) => projectKey === "all" || projectKeyFor(wall.projects) === projectKey),
    [walls, projectKey]
  );
  const levels = useMemo(() => uniqueLevels(projectWalls), [projectWalls]);
  const [level, setLevel] = useState("all");
  const filteredWalls = projectWalls.filter((wall) => level === "all" || wall.level === level);
  const [activeId, setActiveId] = useState(filteredWalls[0]?.id ?? "");
  const activeWall = filteredWalls.find((wall) => wall.id === activeId) ?? filteredWalls[0] ?? null;
  const page = firstJoined(activeWall?.pdf_pages ?? null);
  const project = firstJoined(activeWall?.projects ?? null);

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-lg font-bold text-steel">Drawing lookup</p>
        <h1 className="text-4xl font-black text-ink">View any wall without changing tracking</h1>
      </div>

      <section className="grid gap-4 rounded-md bg-white p-5 shadow-touch md:grid-cols-3 md:items-end">
        <label className="grid gap-2 text-lg font-bold text-ink">
          Project
          <select className="touch-target rounded-md border border-slate-300 px-4" value={projectKey} onChange={(event) => { setProjectKey(event.target.value); setLevel("all"); setActiveId(""); }}>
            <option value="all">All projects</option>
            {projects.map((projectItem) => <option key={projectItem.key} value={projectItem.key}>{projectItem.label}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-lg font-bold text-ink">
          Level
          <select className="touch-target rounded-md border border-slate-300 px-4" value={level} onChange={(event) => { setLevel(event.target.value); setActiveId(""); }}>
            <option value="all">All levels</option>
            {levels.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-lg font-bold text-ink">
          Wall
          <select className="touch-target rounded-md border border-slate-300 px-4" value={activeWall?.id ?? ""} onChange={(event) => setActiveId(event.target.value)}>
            {filteredWalls.length ? null : <option value="">No walls found</option>}
            {filteredWalls.map((wall) => <option key={wall.id} value={wall.id}>{wall.wall_id} - {wall.wall_type}</option>)}
          </select>
        </label>
      </section>

      {activeWall ? (
        <section className="grid gap-5 rounded-md bg-white p-5 shadow-touch xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-h-[64vh] overflow-hidden rounded-md border border-slate-200 bg-slate-100">
            {page?.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={page.image_url} alt={`Drawing page ${page.page_number}`} className="h-full max-h-[78vh] min-h-[64vh] w-full object-contain" />
            ) : (
              <div className="grid h-[64vh] place-items-center p-4 text-center text-2xl font-black text-steel">No drawing attached</div>
            )}
          </div>
          <aside className="grid content-start gap-4">
            <div>
              <p className="text-xl font-bold text-steel">{project?.code} / {activeWall.level}</p>
              <h2 className="text-6xl font-black text-ink">{activeWall.wall_id}</h2>
            </div>
            <span className="w-fit rounded-md bg-shop px-5 py-3 text-2xl font-black text-ink">{activeWall.wall_type}</span>
            <Metric label="Lineal feet" value={activeWall.lineal_feet.toFixed(1)} />
            <Metric label="Page" value={page ? String(page.page_number) : "-"} />
            <Metric label="Line" value={lineName(activeWall.production_lines, lines, activeWall.production_line_id)} />
          </aside>
        </section>
      ) : (
        <section className="rounded-md bg-white p-10 text-center shadow-touch">
          <h2 className="text-3xl font-black text-ink">No drawings found</h2>
        </section>
      )}
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

function uniqueProjects(walls: DrawingWall[]) {
  const map = new Map<string, string>();
  walls.forEach((wall) => {
    const project = firstJoined(wall.projects);
    if (project) map.set(project.id, `${project.code} - ${project.name}`);
  });
  return Array.from(map, ([key, label]) => ({ key, label }));
}

function uniqueLevels(walls: DrawingWall[]) {
  return Array.from(new Set(walls.map((wall) => wall.level).filter(Boolean))).sort();
}

function projectKeyFor(project: JoinedProject) {
  return firstJoined(project)?.id ?? "none";
}

function lineName(joinedLine: JoinedLine, lines: ProductionLine[], lineId: string) {
  const line = firstJoined(joinedLine);
  return line?.name ?? lines.find((item) => item.id === lineId)?.name ?? "Unassigned";
}

function firstJoined<T>(value: T | T[] | null) {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

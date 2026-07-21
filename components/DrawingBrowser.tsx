"use client";

import { useMemo, useState } from "react";
import { WallNotesButton } from "@/components/WallNotesButton";
import { ZoomableDrawing } from "@/components/ZoomableDrawing";
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

      <section className="grid gap-4 rounded-md bg-white p-5 shadow-touch md:grid-cols-2 md:items-end">
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
      </section>

      {filteredWalls.length ? (
        <section className="rounded-md bg-white p-4 shadow-touch">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black text-ink">Wall drawings</h2>
            <span className="rounded-md bg-slate-100 px-4 py-3 text-lg font-black text-ink">{filteredWalls.length} walls</span>
          </div>
          <div className="flex max-h-64 gap-3 overflow-auto pb-2 md:grid md:max-h-96 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredWalls.map((wall) => {
              const itemProject = firstJoined(wall.projects);
              const itemPage = firstJoined(wall.pdf_pages);
              const active = wall.id === activeWall?.id;
              return (
                <button
                  key={wall.id}
                  onClick={() => setActiveId(wall.id)}
                  className={`min-w-64 rounded-md p-3 text-left shadow-touch ${active ? "bg-ink text-white" : "bg-slate-100 text-ink"}`}
                >
                  <p className="text-sm font-bold uppercase opacity-70">{itemProject?.code} / {wall.level}</p>
                  <p className="text-3xl font-black">{wall.wall_id}</p>
                  <p className="text-lg font-bold opacity-80">{wall.wall_type}</p>
                  <p className="text-base font-bold opacity-80">{wall.lineal_feet.toFixed(1)} LF / Page {itemPage?.page_number ?? "-"}</p>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {activeWall ? (
        <section className="grid gap-5 rounded-md bg-white p-5 shadow-touch xl:grid-cols-[minmax(0,1fr)_22rem]">
          <ZoomableDrawing imageUrl={page?.image_url} alt={`Drawing page ${page?.page_number ?? ""}`} className="min-h-[64vh]" emptyText="No drawing attached" />
          <aside className="grid content-start gap-4">
            <div>
              <p className="text-xl font-bold text-steel">{project?.code} / {activeWall.level}</p>
              <h2 className="text-6xl font-black text-ink">{activeWall.wall_id}</h2>
            </div>
            <span className="w-fit rounded-md bg-shop px-5 py-3 text-2xl font-black text-ink">{activeWall.wall_type}</span>
            <Metric label="Lineal feet" value={activeWall.lineal_feet.toFixed(1)} />
            <Metric label="Page" value={page ? String(page.page_number) : "-"} />
            <Metric label="Line" value={lineName(activeWall.production_lines, lines, activeWall.production_line_id)} />
            <WallNotesButton wallId={activeWall.id} wallLabel={activeWall.wall_id} imageUrl={page?.image_url} pageLabel={project ? `${project.code} / ${activeWall.level}` : activeWall.level} />
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

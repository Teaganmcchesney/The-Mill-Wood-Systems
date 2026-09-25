"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { FileUp, GripVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { WallNotesButton } from "@/components/WallNotesButton";
import { ZoomableDrawing } from "@/components/ZoomableDrawing";
import { createClient } from "@/lib/supabase-browser";
import type { ProductionLine } from "@/lib/types";

type JoinedPage = { page_number: number; image_url: string } | { page_number: number; image_url: string }[] | null;
type JoinedProject = { id: string; name: string; code: string } | { id: string; name: string; code: string }[] | null;
type JoinedLine = { name: string } | { name: string }[] | null;
type JoinedNote = { markup_data: unknown; note_text: string | null } | { markup_data: unknown; note_text: string | null }[] | null;

type DrawingWall = {
  id: string;
  project_id: string;
  wall_id: string;
  wall_type: string;
  level: string;
  lineal_feet: number;
  production_line_id: string;
  pdf_page_id: string | null;
  sort_order: number;
  pdf_pages: JoinedPage;
  projects: JoinedProject;
  production_lines: JoinedLine;
  wall_notes: JoinedNote;
};

export function DrawingBrowser({ walls, lines }: { walls: DrawingWall[]; lines: ProductionLine[] }) {
  const router = useRouter();
  const [wallList, setWallList] = useState(walls);
  const [draggedId, setDraggedId] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => setWallList(walls), [walls]);

  const projects = uniqueProjects(wallList);
  const [projectKey, setProjectKey] = useState(projects[0]?.key ?? "all");
  const projectWalls = useMemo(
    () => wallList.filter((wall) => projectKey === "all" || projectKeyFor(wall.projects) === projectKey),
    [wallList, projectKey]
  );
  const levels = useMemo(() => uniqueLevels(projectWalls), [projectWalls]);
  const [level, setLevel] = useState("all");
  const filteredWalls = projectWalls.filter((wall) => level === "all" || wall.level === level).sort(compareWalls);
  const [activeId, setActiveId] = useState(filteredWalls[0]?.id ?? "");
  const activeWall = filteredWalls.find((wall) => wall.id === activeId) ?? filteredWalls[0] ?? null;
  const page = firstJoined(activeWall?.pdf_pages ?? null);
  const project = firstJoined(activeWall?.projects ?? null);
  const note = firstJoined(activeWall?.wall_notes ?? null);

  async function moveWall(beforeId: string) {
    if (!draggedId || draggedId === beforeId) return;
    const dragged = filteredWalls.find((wall) => wall.id === draggedId);
    if (!dragged) return;

    const reordered = filteredWalls.filter((wall) => wall.id !== draggedId);
    const beforeIndex = reordered.findIndex((wall) => wall.id === beforeId);
    reordered.splice(beforeIndex < 0 ? reordered.length : beforeIndex, 0, dragged);
    const orderMap = new Map(reordered.map((wall, index) => [wall.id, (index + 1) * 10]));

    setWallList((current) => current.map((wall) => (orderMap.has(wall.id) ? { ...wall, sort_order: orderMap.get(wall.id)! } : wall)));
    setBusy("Saving wall order...");
    setError("");

    const supabase = createClient();
    const updates = await Promise.all(
      reordered.map((wall, index) => supabase.from("wall_panels").update({ sort_order: (index + 1) * 10 }).eq("id", wall.id))
    );
    const failed = updates.find((result) => result.error);
    setBusy("");

    if (failed?.error) {
      setError(failed.error.message);
      router.refresh();
      return;
    }

    router.refresh();
  }

  async function replaceDrawing(file: File) {
    if (!activeWall) return;
    setBusy("Replacing drawing...");
    setError("");

    try {
      const blob = await drawingBlobFromFile(file);
      const supabase = createClient();
      const imagePath = `${activeWall.project_id}/replacement-${activeWall.id}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from("drawing-pages").upload(imagePath, blob, {
        contentType: "image/jpeg",
        upsert: true
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("drawing-pages").getPublicUrl(imagePath);
      let pageId = activeWall.pdf_page_id;

      if (pageId) {
        const { error: pageError } = await supabase.from("pdf_pages").update({ image_url: data.publicUrl }).eq("id", pageId);
        if (pageError) throw pageError;
      } else {
        const { data: insertedPage, error: insertError } = await supabase
          .from("pdf_pages")
          .insert({ project_id: activeWall.project_id, page_number: replacementPageNumber(), image_url: data.publicUrl })
          .select("id")
          .single();
        if (insertError) throw insertError;
        pageId = insertedPage?.id ?? null;
        if (pageId) {
          const { error: wallError } = await supabase.from("wall_panels").update({ pdf_page_id: pageId }).eq("id", activeWall.id);
          if (wallError) throw wallError;
        }
      }

      router.refresh();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy("");
    }
  }

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
            <div>
              <h2 className="text-2xl font-black text-ink">Wall drawings</h2>
              <p className="text-base font-bold text-steel">Drag wall cards to change production order.</p>
            </div>
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
                  draggable
                  onDragStart={() => setDraggedId(wall.id)}
                  onDragOver={(event: DragEvent<HTMLButtonElement>) => event.preventDefault()}
                  onDrop={() => void moveWall(wall.id)}
                  onClick={() => setActiveId(wall.id)}
                  className={`min-w-64 rounded-md p-3 text-left shadow-touch ${active ? "bg-ink text-white" : "bg-slate-100 text-ink"}`}
                >
                  <span className="mb-2 inline-flex items-center gap-2 text-sm font-black uppercase opacity-70"><GripVertical size={18} /> Drag</span>
                  <p className="text-sm font-bold uppercase opacity-70">{itemProject?.code} / {wall.level}</p>
                  <p className="text-3xl font-black">{wall.wall_id}</p>
                  <p className="text-lg font-bold opacity-80">{wall.wall_type}</p>
                  <p className="text-base font-bold opacity-80">{wall.lineal_feet.toFixed(1)} LF / Page {itemPage?.page_number ?? "-"}</p>
                </button>
              );
            })}
          </div>
          {busy || error ? (
            <p className={`mt-3 rounded-md p-3 text-base font-bold ${error ? "border border-red-200 bg-red-50 text-red-700" : "bg-slate-100 text-steel"}`}>{error || busy}</p>
          ) : null}
        </section>
      ) : null}

      {activeWall ? (
        <section className="grid gap-5 rounded-md bg-white p-5 shadow-touch xl:grid-cols-[minmax(0,1fr)_22rem]">
          <ZoomableDrawing imageUrl={page?.image_url} alt={`Drawing page ${page?.page_number ?? ""}`} className="min-h-[64vh]" emptyText="No drawing attached" markupData={note?.markup_data} noteText={note?.note_text} />
          <aside className="grid content-start gap-4">
            <div>
              <p className="text-xl font-bold text-steel">{project?.code} / {activeWall.level}</p>
              <h2 className="text-6xl font-black text-ink">{activeWall.wall_id}</h2>
            </div>
            <span className="w-fit rounded-md bg-shop px-5 py-3 text-2xl font-black text-ink">{activeWall.wall_type}</span>
            <Metric label="Lineal feet" value={activeWall.lineal_feet.toFixed(1)} />
            <Metric label="Page" value={page ? String(page.page_number) : "-"} />
            <Metric label="Line" value={lineName(activeWall.production_lines, lines, activeWall.production_line_id)} />
            <label className="touch-target inline-flex cursor-pointer items-center justify-center gap-3 rounded-md bg-slate-100 px-6 py-4 text-2xl font-black text-ink">
              <FileUp size={30} /> Replace drawing
              <input
                className="sr-only"
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                disabled={Boolean(busy)}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void replaceDrawing(file);
                }}
              />
            </label>
            <WallNotesButton wallId={activeWall.id} wallLabel={activeWall.wall_id} imageUrl={page?.image_url} pageLabel={project ? `${project.code} / ${activeWall.level}` : activeWall.level} onSaved={() => router.refresh()} />
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

async function drawingBlobFromFile(file: File) {
  if (file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    const bytes = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: bytes }).promise;
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(1.6, 1800 / Math.max(baseViewport.width, baseViewport.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("The browser could not render this PDF page.");
    await page.render({ canvasContext: context, viewport }).promise;
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error("The browser could not save this drawing.")), "image/jpeg", 0.88);
    });
  }

  if (file.type.startsWith("image/")) return file;
  throw new Error("Upload a PDF or image file for the replacement drawing.");
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

function compareWalls(a: DrawingWall, b: DrawingWall) {
  return Number(a.sort_order) - Number(b.sort_order) || a.wall_id.localeCompare(b.wall_id);
}

function replacementPageNumber() {
  return Math.floor(Date.now() / 1000) % 2000000000;
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) return String(error.message);
  return "Something went wrong while replacing the drawing.";
}

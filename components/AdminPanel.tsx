"use client";

import { useMemo, useState } from "react";
import { FileUp, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { PdfPage, ProductionLine, Project, WallPanel } from "@/lib/types";

type WallType = "Interior" | "Blocked Interior" | "Sheathed" | "Blocked Sheathed";

const LEVELS = ["L1", "L2", "L3", "L4", "Roof"];

type ParsedWall = {
  wallId: string;
  wallType: WallType;
  linealFeet: number;
  isPanelPage: boolean;
  hasSheathing: boolean;
  hasBlocking: boolean;
};

type ParsedPdfPage = {
  pageNumber: number;
  parsed: ParsedWall;
};

export function AdminPanel({
  projects,
  lines,
  pages,
  walls
}: {
  projects: Project[];
  lines: ProductionLine[];
  pages: PdfPage[];
  walls: WallPanel[];
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [level, setLevel] = useState("L1");
  const [projectBusy, setProjectBusy] = useState("");
  const [projectError, setProjectError] = useState("");
  const [newProject, setNewProject] = useState({ code: "", name: "" });
  const selectedProjectId = projectId || projects[0]?.id || "";
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;
  const projectDrawingPages = useMemo(() => pages.filter((page) => page.project_id === selectedProjectId), [pages, selectedProjectId]);
  const selectedProjectWalls = useMemo(
    () => walls.filter((wall) => wall.project_id === selectedProjectId && wall.level === level),
    [walls, selectedProjectId, level]
  );
  const projectLevels = useMemo(() => uniqueLevels(walls.filter((wall) => wall.project_id === selectedProjectId)), [walls, selectedProjectId]);

  async function createProject() {
    if (!newProject.code.trim() || !newProject.name.trim()) {
      setProjectError("Enter a project code and project name.");
      return;
    }

    setProjectBusy("Creating project...");
    setProjectError("");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("projects")
      .insert({ code: newProject.code.trim(), name: newProject.name.trim() })
      .select("id")
      .single();

    setProjectBusy("");
    if (error) {
      setProjectError(error.message);
      return;
    }

    setNewProject({ code: "", name: "" });
    if (data?.id) setProjectId(data.id);
    router.refresh();
  }

  async function deleteProject() {
    if (!selectedProject) {
      setProjectError("Choose a project to delete.");
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedProject.code} - ${selectedProject.name}? This removes its wall cards and drawing pages from the app.`
    );
    if (!confirmed) return;

    setProjectBusy("Deleting project...");
    setProjectError("");
    const supabase = createClient();
    const { error } = await supabase.from("projects").delete().eq("id", selectedProject.id);
    setProjectBusy("");

    if (error) {
      setProjectError(error.message);
      return;
    }

    const nextProject = projects.find((project) => project.id !== selectedProject.id);
    setProjectId(nextProject?.id ?? "");
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-lg font-bold text-steel">Admin workspace</p>
        <h1 className="text-4xl font-black text-ink">Projects, drawing packages, and imported walls</h1>
      </div>

      <section className="grid gap-4 rounded-md bg-white p-5 shadow-touch">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-2xl font-black text-ink">Projects</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <Field label="Project code" value={newProject.code} onChange={(value) => setNewProject({ ...newProject, code: value })} />
          <Field label="Project name" value={newProject.name} onChange={(value) => setNewProject({ ...newProject, name: value })} />
          <button onClick={createProject} className="touch-target inline-flex items-center justify-center gap-2 rounded-md bg-ink px-5 py-3 text-lg font-black text-white">
            <Plus size={22} /> {projectBusy || "Create project"}
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <label className="grid gap-2 text-lg font-bold text-ink">
            Delete project
            <select
              className="touch-target rounded-md border border-slate-300 px-4"
              value={selectedProjectId}
              disabled={!projects.length}
              onChange={(event) => setProjectId(event.target.value)}
            >
              {projects.length ? null : <option value="">No projects</option>}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.code} - {project.name}</option>
              ))}
            </select>
          </label>
          <button
            onClick={deleteProject}
            disabled={!selectedProject || Boolean(projectBusy)}
            className="touch-target inline-flex items-center justify-center gap-2 rounded-md bg-red-700 px-5 py-3 text-lg font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 size={22} /> Delete selected project
          </button>
        </div>
        {projectError ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-lg font-bold text-red-700">{projectError}</p> : null}
      </section>

      <section className="grid gap-4 rounded-md bg-white p-5 shadow-touch">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
          <div>
            <h2 className="text-2xl font-black text-ink">Drawing package</h2>
            <p className="text-base font-bold text-steel">Choose the project and level before uploading. Wall cards are created from the PDF automatically.</p>
          </div>
          <label className="grid gap-2 text-lg font-bold text-ink">
            Project
            <select
              className="touch-target rounded-md border border-slate-300 px-4 text-lg font-bold"
              value={selectedProjectId}
              disabled={!projects.length}
              onChange={(event) => setProjectId(event.target.value)}
            >
              {projects.length ? null : <option value="">Create a project first</option>}
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.code} - {project.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-lg font-bold text-ink">
            Level
            <select className="touch-target rounded-md border border-slate-300 px-4 text-lg font-bold" value={level} onChange={(event) => setLevel(event.target.value)}>
              {Array.from(new Set([...LEVELS, ...projectLevels])).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
        <PdfUploader projectId={selectedProjectId} level={level} lines={lines} onDone={() => router.refresh()} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          {projectDrawingPages.map((page) => (
            <div key={page.id} className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={page.image_url} alt={`Page ${page.page_number}`} className="aspect-[8.5/11] w-full object-cover" />
              <p className="p-2 text-center font-black text-ink">Page {page.page_number}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-ink">Imported wall records</h2>
            <p className="text-lg font-bold text-steel">{selectedProject?.code ?? "Project"} / {level}</p>
          </div>
          <span className="rounded-md bg-white px-4 py-3 text-lg font-black text-ink shadow-touch">{selectedProjectWalls.length} walls</span>
        </div>
        <div className="grid gap-3">
          {selectedProjectWalls.map((wall) => (
            <div key={wall.id} className="grid rounded-md bg-white p-4 text-left shadow-touch md:grid-cols-5 md:items-center">
              <strong className="text-2xl text-ink">{wall.wall_id}</strong>
              <span className="font-bold text-steel">{wall.wall_type}</span>
              <span className="font-bold text-steel">{wall.level}</span>
              <span className="font-bold text-steel">{wall.lineal_feet} LF</span>
              <span className="font-bold text-steel">{wall.status}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="grid gap-2 text-lg font-bold text-ink">
      {label}
      <input className="touch-target rounded-md border border-slate-300 px-4" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function PdfUploader({ projectId, level, lines, onDone }: { projectId: string; level: string; lines: ProductionLine[]; onDone: () => void }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    if (!projectId) {
      setError("Choose or create a project before uploading a PDF.");
      return;
    }
    if (!lines.length) {
      setError("Add production lines before uploading a PDF.");
      return;
    }

    setBusy("Converting PDF pages...");
    setError("");

    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      const supabase = createClient();
      const bytes = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: bytes }).promise;
      const timestamp = Date.now();
      const pdfPath = `${projectId}/package-${timestamp}.pdf`;
      const parsedPages: ParsedPdfPage[] = [];

      setBusy("Reading panel names, lengths, sheathing, and blocking...");
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        parsedPages.push({ pageNumber, parsed: await parsePdfPage(page, pageNumber) });
      }

      const hasPanelPages = parsedPages.some((page) => page.parsed.isPanelPage);
      if (!hasPanelPages) {
        throw new Error("No panel pages were found. The importer needs pages with text like Panel # and Length.");
      }

      const { error: pdfUploadError } = await supabase.storage.from("drawing-packages").upload(pdfPath, file, { upsert: true });
      if (pdfUploadError) throw pdfUploadError;

      const { data: pdfPublic } = supabase.storage.from("drawing-packages").getPublicUrl(pdfPath);
      const { error: projectError } = await supabase.from("projects").update({ drawing_pdf_url: pdfPublic.publicUrl }).eq("id", projectId);
      if (projectError) throw projectError;

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const pageInfo = parsedPages[pageNumber - 1];
        const page = await pdf.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(1.4, 1600 / Math.max(baseViewport.width, baseViewport.height));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("The browser could not create a drawing preview.");

        setBusy(`Rendering page ${pageNumber} of ${pdf.numPages}...`);
        await page.render({ canvasContext: context, viewport }).promise;
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((value) => {
            if (value) resolve(value);
            else reject(new Error("The browser could not save the drawing preview."));
          }, "image/jpeg", 0.82);
        });

        canvas.width = 1;
        canvas.height = 1;

        const imagePath = `${projectId}/page-${pageNumber}-${timestamp}.jpg`;
        const { error: imageUploadError } = await supabase.storage.from("drawing-pages").upload(imagePath, blob, {
          contentType: "image/jpeg",
          upsert: true
        });
        if (imageUploadError) throw imageUploadError;

        const { data } = supabase.storage.from("drawing-pages").getPublicUrl(imagePath);
        const { data: savedPage, error: pageError } = await supabase
          .from("pdf_pages")
          .upsert(
            { project_id: projectId, page_number: pageNumber, image_url: data.publicUrl },
            { onConflict: "project_id,page_number" }
          )
          .select("id")
          .single();
        if (pageError) throw pageError;

        if (!pageInfo.parsed.isPanelPage) continue;

        const wallType = wallTypeForPanel(panelHasSheathing(parsedPages, pageNumber), panelHasBlocking(parsedPages, pageNumber));
        const productionLine = lineForWallType(lines, wallType);
        const wallPayload = {
          wall_type: wallType,
          level,
          area_sqft: 0,
          lineal_feet: pageInfo.parsed.linealFeet,
          pdf_page_id: savedPage?.id ?? null,
          production_line_id: productionLine.id,
          sort_order: pageNumber * 10
        };

        setBusy(`Creating wall card ${pageNumber} of ${pdf.numPages}...`);
        const { data: existingWall, error: existingError } = await supabase
          .from("wall_panels")
          .select("id")
          .eq("project_id", projectId)
          .eq("wall_id", pageInfo.parsed.wallId)
          .maybeSingle();
        if (existingError) throw existingError;

        if (existingWall) {
          const { error: wallUpdateError } = await supabase.from("wall_panels").update(wallPayload).eq("id", existingWall.id);
          if (wallUpdateError) throw wallUpdateError;
        } else {
          const { error: wallError } = await supabase.from("wall_panels").insert({
            project_id: projectId,
            wall_id: pageInfo.parsed.wallId,
            ...wallPayload
          });
          if (wallError) throw wallError;
        }
      }

      onDone();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="grid gap-3">
      <label className="touch-target inline-flex cursor-pointer items-center justify-center gap-3 rounded-md border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-5 text-xl font-black text-ink">
        <FileUp size={28} /> {busy || `Upload ${level} PDF drawing package`}
        <input
          className="sr-only"
          type="file"
          accept="application/pdf"
          disabled={Boolean(busy)}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void handleFile(file);
          }}
        />
      </label>
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-lg font-bold text-red-700">{error}</p>
      ) : null}
    </div>
  );
}

async function parsePdfPage(
  page: { getTextContent: () => Promise<{ items: unknown[] }> },
  pageNumber: number
): Promise<ParsedWall> {
  try {
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => (isTextItem(item) ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return parseWallText(text, pageNumber);
  } catch {
    return fallbackWall(pageNumber);
  }
}

function isTextItem(item: unknown): item is { str: string } {
  return typeof item === "object" && item !== null && "str" in item && typeof (item as { str?: unknown }).str === "string";
}

function parseWallText(text: string, pageNumber: number): ParsedWall {
  const fallback = fallbackWall(pageNumber);
  const panelMatch = text.match(/Panel\s*#\s*([A-Z0-9_.-]+)\s+Length:\s*(.*?)\s+Height:/i);
  const wallId = panelMatch?.[1]?.toUpperCase() ?? findWallId(text) ?? fallback.wallId;
  const linealFeet = panelMatch?.[2] ? parseImperialLength(panelMatch[2]) ?? fallback.linealFeet : findLengthFeet(text) ?? fallback.linealFeet;
  const hasSheathing = hasExteriorSheathing(text);
  const hasBlocking = hasHorizontalBlocking(text);
  const wallType = wallTypeForPanel(hasSheathing, hasBlocking);

  return { wallId, linealFeet, wallType, hasSheathing, hasBlocking, isPanelPage: Boolean(panelMatch) };
}

function fallbackWall(pageNumber: number): ParsedWall {
  return {
    wallId: `PAGE-${String(pageNumber).padStart(3, "0")}`,
    wallType: "Interior",
    linealFeet: 0,
    isPanelPage: false,
    hasSheathing: false,
    hasBlocking: false
  };
}

function panelHasSheathing(pages: ParsedPdfPage[], pageNumber: number) {
  return pageGroup(pages, pageNumber).some((page) => page.parsed.hasSheathing);
}

function panelHasBlocking(pages: ParsedPdfPage[], pageNumber: number) {
  return pageGroup(pages, pageNumber).some((page) => page.parsed.hasBlocking);
}

function pageGroup(pages: ParsedPdfPage[], pageNumber: number) {
  const startIndex = pageNumber - 1;
  const nextPanelIndex = pages.findIndex((page, index) => index > startIndex && page.parsed.isPanelPage);
  return pages.slice(startIndex, nextPanelIndex === -1 ? pages.length : nextPanelIndex);
}

function wallTypeForPanel(hasSheathing: boolean, hasBlocking: boolean): WallType {
  if (hasSheathing && hasBlocking) return "Blocked Sheathed";
  if (hasSheathing) return "Sheathed";
  if (hasBlocking) return "Blocked Interior";
  return "Interior";
}

function findWallId(text: string) {
  const patterns = [
    /(?:panel|wall)\s*(?:name|id|mark|number|#)\s*[:#-]?\s*([A-Z0-9][A-Z0-9_.-]{1,30})/i,
    /(?:^|\s)([A-Z]{1,5}[-_]?[0-9]{1,5}[A-Z]?)\s+(?:length|len\.?)/i,
    /(?:^|\s)([A-Z]{1,5}[0-9]{1,5}[A-Z]?)(?:\s|$)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.replace(/[^A-Z0-9_.-]/gi, "").toUpperCase();
    if (value && !["LENGTH", "PANEL", "WALL", "MATERIAL", "SHEATHING"].includes(value)) return value;
  }

  return null;
}

function findLengthFeet(text: string) {
  const match = text.match(/(?:length|len\.?|wall\s*length)\s*[:=#-]?\s*([^\s]+(?:\s+[^\s]+)?)(?:\s+height|\s|$)/i);
  return match?.[1] ? parseImperialLength(match[1]) : null;
}

function parseImperialLength(value: string) {
  const normalized = value.replace(/[”“]/g, '"').replace(/[‘’]/g, "'").trim();
  let feet = 0;
  let inchText = normalized;
  const feetMatch = normalized.match(/(\d+(?:\.\d+)?)\s*'/);

  if (feetMatch) {
    feet = Number(feetMatch[1]);
    inchText = normalized.slice(feetMatch.index! + feetMatch[0].length).trim();
  }

  const inchMatch = inchText.match(/(\d+(?:\.\d+)?)(?:\s*-\s*(\d+)\/(\d+))?/);
  let inches = 0;
  if (inchMatch) {
    inches = Number(inchMatch[1]);
    if (inchMatch[2] && inchMatch[3]) inches += Number(inchMatch[2]) / Number(inchMatch[3]);
  }

  if (!feetMatch && !inchMatch) return null;
  if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null;
  return Math.round((feet + inches / 12) * 100) / 100;
}

function hasExteriorSheathing(text: string) {
  const lower = text.toLowerCase();
  if (/(no\s+exterior\s+sheath|without\s+exterior\s+sheath|exterior\s+sheath(?:ing)?\s*:\s*(?:none|no|n\/?a|not\s+required))/i.test(lower)) {
    return false;
  }

  if (/exterior\s+sheath(?:ing)?\s*:\s*(?:start|flush|fly|left|right|full|yes|\d)/i.test(lower)) {
    return true;
  }

  if (/(?:ext\.?|exterior)\s+(?:wall\s+)?(?:sheath(?:ing)?|osb|plywood|structural\s+panel)/i.test(lower)) {
    return true;
  }

  return /material\s+list.*(?:exterior|ext\.?)\s+(?:sheath(?:ing)?|osb|plywood)/i.test(lower);
}

function hasHorizontalBlocking(text: string) {
  const lower = text.toLowerCase();
  if (/(?:no|without)\s+(?:horizontal\s+)?(?:block|blocking|blk|blkg)/i.test(lower)) return false;
  return /\b(?:blocking|block|blk|blkg)\b/i.test(lower);
}

function lineForWallType(lines: ProductionLine[], wallType: WallType) {
  const wanted = wallType.includes("Sheathed") ? "sheathed" : "interior";
  const exact = lines.find((line) => normalizeLineName(line.name) === wanted);
  return exact ?? lines.find((line) => normalizeLineName(line.name).includes(wanted)) ?? lines[0];
}

function uniqueLevels(projectWalls: WallPanel[]) {
  return Array.from(new Set(projectWalls.map((wall) => wall.level).filter(Boolean))).sort();
}

function normalizeLineName(value: string) {
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) return String(error.message);
  return "The PDF stopped converting. Try a smaller PDF, or split the drawing package into smaller files.";
}

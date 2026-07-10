"use client";

import { useMemo, useState } from "react";
import { FileUp, Plus, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { PdfPage, ProductionLine, Project, WallPanel } from "@/lib/types";

type WallForm = {
  id?: string;
  project_id: string;
  wall_id: string;
  wall_type: string;
  level: string;
  area_sqft: string;
  lineal_feet: string;
  pdf_page_id: string;
  production_line_id: string;
  sort_order: string;
};

type ParsedWall = {
  wallId: string;
  wallType: "Sheathed" | "Interior";
  linealFeet: number;
  isPanelPage: boolean;
  hasSheathing: boolean;
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
  const [busy, setBusy] = useState("");
  const [projectBusy, setProjectBusy] = useState("");
  const [projectError, setProjectError] = useState("");
  const [draftBusy, setDraftBusy] = useState("");
  const [draftError, setDraftError] = useState("");
  const [newProject, setNewProject] = useState({ code: "", name: "" });
  const [form, setForm] = useState<WallForm>(() => emptyForm(projects[0]?.id ?? "", lines[0]?.id ?? ""));
  const selectedProjectId = projectId || projects[0]?.id || "";
  const projectDrawingPages = useMemo(() => pages.filter((page) => page.project_id === selectedProjectId), [pages, selectedProjectId]);
  const projectWalls = useMemo(() => walls.filter((wall) => wall.project_id === selectedProjectId), [walls, selectedProjectId]);
  const projectPages = useMemo(() => pages.filter((page) => page.project_id === form.project_id), [pages, form.project_id]);

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
    if (data?.id) {
      setProjectId(data.id);
      setForm((current) => ({ ...current, project_id: data.id, pdf_page_id: "" }));
    }
    router.refresh();
  }

  async function createDraftWalls() {
    if (!selectedProjectId) {
      setDraftError("Choose a project first.");
      return;
    }
    if (!lines.length) {
      setDraftError("Add a production line before creating wall cards.");
      return;
    }
    if (!projectDrawingPages.length) {
      setDraftError("Upload a PDF before creating wall cards.");
      return;
    }

    const existingPageIds = new Set(projectWalls.map((wall) => wall.pdf_page_id).filter(Boolean));
    const pagesWithoutWall = projectDrawingPages.filter((page) => !existingPageIds.has(page.id));

    if (!pagesWithoutWall.length) {
      setDraftError("All uploaded pages already have wall cards.");
      return;
    }

    setDraftBusy("Creating wall cards...");
    setDraftError("");
    const defaultLine = lines[0];
    const supabase = createClient();
    const { error } = await supabase.from("wall_panels").insert(
      pagesWithoutWall.map((page) => ({
        project_id: selectedProjectId,
        wall_id: `PAGE-${String(page.page_number).padStart(3, "0")}`,
        wall_type: defaultLine.name === "Interior" ? "Interior" : "Sheathed",
        level: "L1",
        area_sqft: 0,
        lineal_feet: 0,
        pdf_page_id: page.id,
        production_line_id: defaultLine.id,
        sort_order: page.page_number * 10
      }))
    );

    setDraftBusy("");
    if (error) {
      setDraftError(error.message);
      return;
    }

    router.refresh();
  }

  async function saveWall() {
    setBusy("Saving wall...");
    const supabase = createClient();
    const payload = {
      project_id: form.project_id,
      wall_id: form.wall_id,
      wall_type: form.wall_type,
      level: form.level,
      area_sqft: Number(form.area_sqft),
      lineal_feet: Number(form.lineal_feet),
      pdf_page_id: form.pdf_page_id || null,
      production_line_id: form.production_line_id,
      sort_order: Number(form.sort_order || 0)
    };
    const request = form.id
      ? supabase.from("wall_panels").update(payload).eq("id", form.id)
      : supabase.from("wall_panels").insert(payload);
    await request;
    setBusy("");
    setForm(emptyForm(form.project_id, form.production_line_id));
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-lg font-bold text-steel">Admin workspace</p>
        <h1 className="text-4xl font-black text-ink">Projects, drawings, and wall records</h1>
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
        {projectError ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-lg font-bold text-red-700">{projectError}</p> : null}
      </section>

      <section className="grid gap-4 rounded-md bg-white p-5 shadow-touch">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-2xl font-black text-ink">Drawing package</h2>
          <select
            className="touch-target rounded-md border border-slate-300 px-4 text-lg font-bold"
            value={selectedProjectId}
            disabled={!projects.length}
            onChange={(event) => {
              setProjectId(event.target.value);
              setForm({ ...form, project_id: event.target.value, pdf_page_id: "" });
            }}
          >
            {projects.length ? null : <option value="">Create a project first</option>}
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.code} - {project.name}</option>
            ))}
          </select>
        </div>
        <PdfUploader projectId={selectedProjectId} lines={lines} onDone={() => router.refresh()} />
        <p className="text-base font-bold text-steel">
          New uploads read Panel #, Length, and sheathing notes from the PDF text. Each panel becomes one wall card.
        </p>
        <button
          onClick={createDraftWalls}
          disabled={Boolean(draftBusy) || !projectDrawingPages.length}
          className="touch-target inline-flex items-center justify-center gap-3 rounded-md bg-shop px-6 py-4 text-xl font-black text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={24} /> {draftBusy || `Create wall cards from ${projectDrawingPages.length} page${projectDrawingPages.length === 1 ? "" : "s"}`}
        </button>
        {draftError ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-lg font-bold text-red-700">{draftError}</p> : null}
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

      <section className="grid gap-4 rounded-md bg-white p-5 shadow-touch">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-black text-ink">{form.id ? "Edit wall panel" : "Create wall panel"}</h2>
          <button className="touch-target inline-flex items-center gap-2 rounded-md bg-slate-100 px-4 py-3 text-lg font-black text-ink" onClick={() => setForm(emptyForm(projects[0]?.id ?? "", lines[0]?.id ?? ""))}>
            <Plus size={22} /> New
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Wall ID" value={form.wall_id} onChange={(value) => setForm({ ...form, wall_id: value })} />
          <Field label="Wall type" value={form.wall_type} onChange={(value) => setForm({ ...form, wall_type: value })} />
          <Field label="Level" value={form.level} onChange={(value) => setForm({ ...form, level: value })} />
          <Field label="Area" value={form.area_sqft} onChange={(value) => setForm({ ...form, area_sqft: value })} type="number" />
          <Field label="Lineal feet" value={form.lineal_feet} onChange={(value) => setForm({ ...form, lineal_feet: value })} type="number" />
          <Field label="Sort" value={form.sort_order} onChange={(value) => setForm({ ...form, sort_order: value })} type="number" />
          <label className="grid gap-2 text-lg font-bold text-ink">
            Project
            <select className="touch-target rounded-md border border-slate-300 px-4" value={form.project_id} onChange={(event) => setForm({ ...form, project_id: event.target.value, pdf_page_id: "" })}>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.code}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-lg font-bold text-ink">
            Drawing page
            <select className="touch-target rounded-md border border-slate-300 px-4" value={form.pdf_page_id} onChange={(event) => setForm({ ...form, pdf_page_id: event.target.value })}>
              <option value="">No page</option>
              {projectPages.map((page) => <option key={page.id} value={page.id}>Page {page.page_number}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-lg font-bold text-ink">
            Production line
            <select className="touch-target rounded-md border border-slate-300 px-4" value={form.production_line_id} onChange={(event) => setForm({ ...form, production_line_id: event.target.value })}>
              {lines.map((line) => <option key={line.id} value={line.id}>{line.name}</option>)}
            </select>
          </label>
        </div>
        <button onClick={saveWall} className="touch-target inline-flex w-full items-center justify-center gap-3 rounded-md bg-ink px-6 py-4 text-2xl font-black text-white">
          <Save size={28} /> {busy || "Save wall"}
        </button>
      </section>

      <section className="grid gap-3">
        <h2 className="text-2xl font-black text-ink">Wall records</h2>
        <div className="grid gap-3">
          {walls.map((wall) => (
            <button key={wall.id} className="grid rounded-md bg-white p-4 text-left shadow-touch md:grid-cols-6 md:items-center" onClick={() => setForm(toForm(wall))}>
              <strong className="text-2xl text-ink">{wall.wall_id}</strong>
              <span className="font-bold text-steel">{wall.wall_type}</span>
              <span className="font-bold text-steel">{wall.level}</span>
              <span className="font-bold text-steel">{wall.lineal_feet} LF</span>
              <span className="font-bold text-steel">{wall.status}</span>
              <span className="font-bold text-steel">Edit</span>
            </button>
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

function emptyForm(projectId: string, lineId: string): WallForm {
  return {
    project_id: projectId,
    wall_id: "",
    wall_type: "Sheathed",
    level: "L1",
    area_sqft: "",
    lineal_feet: "",
    pdf_page_id: "",
    production_line_id: lineId,
    sort_order: "10"
  };
}

function toForm(wall: WallPanel): WallForm {
  return {
    id: wall.id,
    project_id: wall.project_id,
    wall_id: wall.wall_id,
    wall_type: wall.wall_type,
    level: wall.level,
    area_sqft: String(wall.area_sqft),
    lineal_feet: String(wall.lineal_feet),
    pdf_page_id: wall.pdf_page_id ?? "",
    production_line_id: wall.production_line_id,
    sort_order: String(wall.sort_order)
  };
}

function PdfUploader({ projectId, lines, onDone }: { projectId: string; lines: ProductionLine[]; onDone: () => void }) {
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

      setBusy("Reading panel names and lengths...");
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        parsedPages.push({ pageNumber, parsed: await parsePdfPage(page, pageNumber) });
      }

      const hasPanelPages = parsedPages.some((page) => page.parsed.isPanelPage);
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

        const shouldCreateWall = pageInfo.parsed.isPanelPage || !hasPanelPages;
        if (!shouldCreateWall) continue;

        const wallType = panelHasSheathing(parsedPages, pageNumber) ? "Sheathed" : pageInfo.parsed.wallType;
        const productionLine = lineForWallType(lines, wallType);

        setBusy(`Creating wall card ${pageNumber} of ${pdf.numPages}...`);
        const { data: existingWall, error: existingError } = await supabase
          .from("wall_panels")
          .select("id")
          .eq("project_id", projectId)
          .eq("wall_id", pageInfo.parsed.wallId)
          .maybeSingle();
        if (existingError) throw existingError;

        if (!existingWall) {
          const { error: wallError } = await supabase.from("wall_panels").insert({
            project_id: projectId,
            wall_id: pageInfo.parsed.wallId,
            wall_type: wallType,
            level: "L1",
            area_sqft: 0,
            lineal_feet: pageInfo.parsed.linealFeet,
            pdf_page_id: savedPage?.id ?? null,
            production_line_id: productionLine.id,
            sort_order: pageNumber * 10
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
        <FileUp size={28} /> {busy || "Upload PDF drawing package"}
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
  const wallType = hasSheathing ? "Sheathed" : "Interior";

  return { wallId, linealFeet, wallType, hasSheathing, isPanelPage: Boolean(panelMatch) };
}

function fallbackWall(pageNumber: number): ParsedWall {
  return {
    wallId: `PAGE-${String(pageNumber).padStart(3, "0")}`,
    wallType: "Interior",
    linealFeet: 0,
    isPanelPage: false,
    hasSheathing: false
  };
}

function panelHasSheathing(pages: ParsedPdfPage[], pageNumber: number) {
  const startIndex = pageNumber - 1;
  const nextPanelIndex = pages.findIndex((page, index) => index > startIndex && page.parsed.isPanelPage);
  const group = pages.slice(startIndex, nextPanelIndex === -1 ? pages.length : nextPanelIndex);
  return group.some((page) => page.parsed.hasSheathing);
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
  const sheathingWords = /(exterior\s+sheath|ext\.?\s+sheath|sheathing|\bosb\b|plywood|structural\s+panel)/i.test(lower);
  const interiorOnly = /(no\s+sheath|without\s+sheath|interior\s+only)/i.test(lower);
  return sheathingWords && !interiorOnly;
}

function lineForWallType(lines: ProductionLine[], wallType: ParsedWall["wallType"]) {
  const wanted = wallType === "Sheathed" ? "sheathed" : "interior";
  return lines.find((line) => line.name.toLowerCase().includes(wanted)) ?? lines[0];
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) return String(error.message);
  return "The PDF stopped converting. Try a smaller PDF, or split the drawing package into smaller files.";
}

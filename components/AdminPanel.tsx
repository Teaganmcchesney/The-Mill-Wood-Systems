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
  const [form, setForm] = useState<WallForm>(() => emptyForm(projects[0]?.id ?? "", lines[0]?.id ?? ""));
  const projectPages = useMemo(() => pages.filter((page) => page.project_id === form.project_id), [pages, form.project_id]);

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
          <h2 className="text-2xl font-black text-ink">Drawing package</h2>
          <select className="touch-target rounded-md border border-slate-300 px-4 text-lg font-bold" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.code} - {project.name}</option>
            ))}
          </select>
        </div>
        <PdfUploader projectId={projectId} onDone={() => router.refresh()} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          {pages.filter((page) => page.project_id === projectId).map((page) => (
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

function PdfUploader({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const [busy, setBusy] = useState("");

  async function handleFile(file: File) {
    setBusy("Converting PDF pages...");
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    const supabase = createClient();
    const bytes = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: bytes }).promise;
    const pdfPath = `${projectId}/package-${Date.now()}.pdf`;
    await supabase.storage.from("drawing-packages").upload(pdfPath, file, { upsert: true });
    const { data: pdfPublic } = supabase.storage.from("drawing-packages").getPublicUrl(pdfPath);
    await supabase.from("projects").update({ drawing_pdf_url: pdfPublic.publicUrl }).eq("id", projectId);

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      setBusy(`Rendering page ${pageNumber} of ${pdf.numPages}...`);
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext("2d");
      if (!context) continue;
      await page.render({ canvasContext: context, viewport }).promise;
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!), "image/png"));
      const imagePath = `${projectId}/page-${pageNumber}-${Date.now()}.png`;
      await supabase.storage.from("drawing-pages").upload(imagePath, blob, { contentType: "image/png", upsert: true });
      const { data } = supabase.storage.from("drawing-pages").getPublicUrl(imagePath);
      await supabase.from("pdf_pages").upsert(
        { project_id: projectId, page_number: pageNumber, image_url: data.publicUrl },
        { onConflict: "project_id,page_number" }
      );
    }

    setBusy("");
    onDone();
  }

  return (
    <label className="touch-target inline-flex cursor-pointer items-center justify-center gap-3 rounded-md border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-5 text-xl font-black text-ink">
      <FileUp size={28} /> {busy || "Upload PDF drawing package"}
      <input className="sr-only" type="file" accept="application/pdf" onChange={(event) => event.target.files?.[0] && handleFile(event.target.files[0])} />
    </label>
  );
}

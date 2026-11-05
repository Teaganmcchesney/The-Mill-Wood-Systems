"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { missingBundleSetup, bundleSetupMessage } from "@/lib/bundle-setup";
import { loadPdfJs } from "@/lib/pdf-browser";
import {
  parseProduction,
  parseBundles,
  validatePackageLevels,
} from "@/lib/package-parser";
import type { ProductionLine } from "@/lib/types";
import type { PDFDocumentProxy } from "pdfjs-dist";

async function texts(pdf: PDFDocumentProxy) {
  const result: string[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const t = await page.getTextContent();
    result.push(t.items.map((i) => ("str" in i ? i.str : "")).join(" "));
    page.cleanup();
  }
  return result;
}
async function render(pdf: PDFDocumentProxy, n: number) {
  const page = await pdf.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({
    scale: Math.min(2, 1800 / Math.max(base.width, base.height)),
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw Error("Cannot render drawing.");
  await page.render({ canvasContext: context, viewport }).promise;
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(Error("Cannot save preview."))),
      "image/jpeg",
      0.92,
    ),
  );
  canvas.width = canvas.height = 1;
  page.cleanup();
  return blob;
}
export function JointPackageUploader({
  projectId,
  level,
  lines,
  onDone,
}: {
  projectId: string;
  level: string;
  lines: ProductionLine[];
  onDone: () => void;
}) {
  const [production, setProduction] = useState<File | null>(null),
    [bundles, setBundles] = useState<File | null>(null);
  const [busy, setBusy] = useState(""),
    [message, setMessage] = useState("");
  async function upload() {
    if (!production || !bundles || !projectId || !lines.length) return;
    setBusy("Checking upload setup…");
    setMessage("");
    let p: PDFDocumentProxy | undefined, b: PDFDocumentProxy | undefined;
    try {
      const supabase = createClient();
      const readiness = await supabase.rpc("bundle_import_ready");
      if (readiness.error) {
        if (missingBundleSetup(readiness.error))
          throw Error(bundleSetupMessage);
        throw readiness.error;
      }
      if (!readiness.data) throw Error(bundleSetupMessage);
      setBusy("Reading production walls and bundle membership…");
      const pdfjs = await loadPdfJs();
      p = await pdfjs.getDocument({ data: await production.arrayBuffer() })
        .promise;
      b = await pdfjs.getDocument({ data: await bundles.arrayBuffer() })
        .promise;
      const productionTexts = await texts(p),
        bundleTexts = await texts(b);
      validatePackageLevels(productionTexts, bundleTexts, level);
      const panels = parseProduction(productionTexts);
      const report = parseBundles(bundleTexts, panels);
      const wallRows = panels.map((panel) => {
        const wallType = panel.sheathed
          ? panel.blocked
            ? "Blocked Sheathed"
            : "Sheathed"
          : panel.blocked
            ? "Blocked Interior"
            : "Interior";
        const name = panel.sheathed ? "sheathed" : "interior";
        const line =
          lines.find(
            (l) => l.name.toLowerCase().replace(/[^a-z]/g, "") === name,
          ) ?? lines.find((l) => l.name.toLowerCase().includes(name));
        if (!line) throw Error("No " + name + " production line configured.");
        return { ...panel, wallType, line: line.id };
      });
      const root = projectId + "/" + level + "/" + crypto.randomUUID();
      const { data: existing, error: existingError } = await supabase
        .from("bundles")
        .select("id")
        .eq("project_id", projectId)
        .eq("level", level)
        .limit(1);
      if (existingError)
        throw missingBundleSetup(existingError)
          ? Error(bundleSetupMessage)
          : existingError;
      if (existing?.length)
        throw Error(
          "This level already has a bundle package. Review drawing revisions with a supervisor.",
        );
      const save = async (bucket: string, path: string, file: Blob) => {
        const { error } = await supabase.storage
          .from(bucket)
          .upload(path, file, { contentType: file.type || "application/pdf" });
        if (error) throw error;
        return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      };
      // Uploads use a unique prefix; live records change only in the final database transaction.
      const productionPdfUrl = await save(
        "drawing-packages",
        root + "/production.pdf",
        production,
      );
      const bundlePdfUrl = await save(
        "drawing-packages",
        root + "/bundles.pdf",
        bundles,
      );
      const pages = [];
      for (let n = 1; n <= p.numPages; n++) {
        setBusy("Production preview " + n + " / " + p.numPages);
        pages.push({
          page: n,
          image: await save(
            "drawing-pages",
            root + "/production-" + n + ".jpg",
            await render(p, n),
          ),
        });
      }
      const bundleRows = [];
      for (const item of report) {
        setBusy("Bundle preview " + item.page + " / " + b.numPages);
        bundleRows.push({
          productionPdfUrl,
          bundlePdfUrl,
          id: item.id,
          count: item.count,
          image: await save(
            "drawing-pages",
            root + "/bundle-" + item.page + ".jpg",
            await render(b, item.page),
          ),
        });
      }
      setBusy("Saving matched walls and bundles…");
      const { error } = await supabase.rpc("import_joint_package", {
        p_project: projectId,
        p_level: level,
        p_pages: pages,
        p_walls: wallRows,
        p_bundles: bundleRows,
      });
      if (error) throw error;
      setMessage(
        "Imported " +
          panels.length +
          " walls and " +
          report.length +
          " bundles. Stacking outlines and production order are available in Yard.",
      );
      onDone();
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : typeof e === "object" && e && "message" in e
            ? String(e.message)
            : "Import failed. No partial package was committed.",
      );
    } finally {
      await p?.destroy();
      await b?.destroy();
      setBusy("");
    }
  }
  return (
    <div className="grid gap-3 text-ink rounded-md border-2 border-orange-400 p-4">
      <h3 className="text-xl font-black">Production + bundle drawings</h3>
      <p>
        Production drawings supply wall lengths. The bundle report links walls
        to bundles for completion tracking. Keep this tab open during
        conversion.
      </p>
      <label className="grid gap-2 font-bold">
        Production drawings
        <input
          disabled={!!busy}
          type="file"
          accept="application/pdf"
          onChange={(e) => {
            setProduction(e.target.files?.[0] ?? null);
          }}
        />
      </label>
      <label className="grid gap-2 font-bold">
        Complete Bundle Report
        <input
          disabled={!!busy}
          type="file"
          accept="application/pdf"
          onChange={(e) => {
            setBundles(e.target.files?.[0] ?? null);
          }}
        />
      </label>
      <button
        className="touch-target rounded-md bg-ink p-4 font-black text-white disabled:opacity-50"
        disabled={
          !!busy || !production || !bundles || !projectId || !lines.length
        }
        onClick={() => void upload()}
      >
        {busy || "Import both PDFs"}
      </button>
      <p role="status">{message}</p>
    </div>
  );
}

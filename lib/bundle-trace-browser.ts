"use client";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { loadPdfJs } from "@/lib/pdf-browser";
import {
  extractWallRectangles,
  traceMatchesProduction,
} from "@/lib/bundle-trace";
import type { Point } from "@/lib/package-parser";
type Package = { pdf: PDFDocumentProxy; pages: Map<string, number> };
export type AutoTrace = { outlines: Point[][]; aspect: number };
const packages = new Map<string, Promise<Package>>(),
  traces = new Map<string, Promise<AutoTrace>>();
async function sourcePackage(url: string) {
  if (!packages.has(url))
    packages.set(
      url,
      (async () => {
        const pdfjs = await loadPdfJs(),
          pdf = await pdfjs.getDocument(url).promise,
          pages = new Map<string, number>();
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n),
            content = await page.getTextContent();
          const text = content.items
            .map((i) => ("str" in i ? i.str : ""))
            .join(" ");
          const id = text.match(/\bB\d+-\d+-[A-Z0-9]+\b/i)?.[0].toUpperCase();
          if (id) pages.set(id, n);
          page.cleanup();
        }
        return { pdf, pages };
      })().catch((e) => {
        packages.delete(url);
        throw e;
      }),
    );
  return packages.get(url)!;
}
export async function autoTraceBundle(
  url: string,
  bundleId: string,
  feet: number[],
) {
  const key = url + "|" + bundleId + "|" + feet.join(",");
  if (!traces.has(key))
    traces.set(
      key,
      (async () => {
        const source = await sourcePackage(url),
          n = source.pages.get(bundleId.toUpperCase());
        if (!n) throw Error("Bundle drawing not found.");
        const page = await source.pdf.getPage(n),
          viewport = page.getViewport({ scale: 1 }),
          pdfjs = await loadPdfJs();
        const outlines = extractWallRectangles(
          await page.getOperatorList(),
          pdfjs.OPS,
          viewport,
        );
        page.cleanup();
        if (!traceMatchesProduction(outlines, feet, viewport.width))
          throw Error(
            "This stack layout could not be matched automatically. Adjust its wall shapes in Yard setup.",
          );
        return { outlines, aspect: viewport.width / viewport.height };
      })().catch((e) => {
        traces.delete(key);
        throw e;
      }),
    );
  return traces.get(key)!;
}

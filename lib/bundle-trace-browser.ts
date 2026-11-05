"use client";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { loadPdfJs } from "@/lib/pdf-browser";
import {
  extractWallRectangles,
  traceMatchesProduction,
} from "@/lib/bundle-trace";
import {
  bundleId as readBundleId,
  productionHeightFeet,
  type Point,
} from "@/lib/package-parser";
type Package = { pdf: PDFDocumentProxy; pages: Map<string, number> };
export type AutoTrace = { outlines: Point[][]; aspect: number };
const packages = new Map<string, Promise<Package>>(),
  traces = new Map<string, Promise<AutoTrace>>();
type ProductionSource = { url: string; wallIds: string[] };
const heights = new Map<string, Promise<Map<string, number>>>();
async function sourceHeights(url: string) {
  if (!heights.has(url))
    heights.set(
      url,
      (async () => {
        const pdfjs = await loadPdfJs(),
          pdf = await pdfjs.getDocument(url).promise,
          result = new Map<string, number>();
        try {
          for (let n = 1; n <= pdf.numPages; n++) {
            const page = await pdf.getPage(n),
              content = await page.getTextContent();
            const text = content.items
              .map((i) => ("str" in i ? i.str : ""))
              .join(" ");
            const wall = text
              .match(/Panel\s*#\s*([A-Z0-9_.-]+)\s+Length:/i)?.[1]
              .toUpperCase();
            const bundle = readBundleId(text),
              height = productionHeightFeet(text);
            if (wall && bundle && height && height > 0)
              result.set(bundle + "|" + wall, height);
            page.cleanup();
          }
          return result;
        } finally {
          await pdf.destroy();
        }
      })().catch((e) => {
        heights.delete(url);
        throw e;
      }),
    );
  return heights.get(url)!;
}
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
          const id = readBundleId(text);
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
  production?: ProductionSource,
) {
  const key =
    url +
    "|" +
    bundleId +
    "|" +
    feet.join(",") +
    "|" +
    (production?.url ?? "") +
    "|" +
    (production?.wallIds.join(",") ?? "");
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
        let matched = traceMatchesProduction(outlines, feet, viewport.width);
        if (
          !matched &&
          production?.url &&
          production.wallIds.length === feet.length
        ) {
          const dimensions = await sourceHeights(production.url);
          const alternatives = production.wallIds.map(
            (id) =>
              dimensions.get(bundleId.toUpperCase() + "|" + id.toUpperCase()) ??
              0,
          );
          matched = traceMatchesProduction(
            outlines,
            feet,
            viewport.width,
            alternatives,
          );
        }
        if (!matched)
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

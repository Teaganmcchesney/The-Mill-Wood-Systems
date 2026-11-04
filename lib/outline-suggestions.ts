import type { Point } from "./package-parser";
// Horizontal edges propose panel bands; no proposal establishes wall identity.
export function suggestBands(image: ImageData): Point[][] {
  const { width: w, height: h, data } = image;
  const edgeRows: number[][] = [];
  for (let y = Math.floor(h * 0.35); y < h * 0.95; y++) {
    let run = 0,
      longest = 0;
    for (let x = Math.floor(w * 0.02); x < w * 0.65; x++) {
      const i = (y * w + x) * 4;
      if (Math.max(data[i], data[i + 1], data[i + 2]) < 145) {
        run++;
        longest = Math.max(longest, run);
      } else run = 0;
    }
    if (longest > w * 0.12) {
      const group = edgeRows[edgeRows.length - 1];
      if (group && y - group[group.length - 1] <= 1) group.push(y);
      else edgeRows.push([y]);
    }
  }
  const edges = edgeRows.map((g) => (g[0] + g[g.length - 1]) / 2);
  const result: Point[][] = [];
  for (let n = 1; n < edges.length; n++) {
    const top = edges[n - 1],
      bottom = edges[n];
    if (bottom - top < 2 || bottom - top > h * 0.05) continue;
    let left = w,
      right = 0,
      colored = 0;
    for (let y = Math.ceil(top); y < bottom; y++)
      for (let x = Math.floor(w * 0.02); x < w * 0.65; x++) {
        const i = (y * w + x) * 4;
        const r = data[i],
          g = data[i + 1],
          b = data[i + 2];
        if (
          Math.max(r, g, b) - Math.min(r, g, b) > 35 &&
          Math.min(r, g, b) < 215
        ) {
          left = Math.min(left, x);
          right = Math.max(right, x);
          colored++;
        }
      }
    if (right - left > w * 0.08 && colored > w * 0.015 * (bottom - top)) {
      result.push([
        { x: left / w, y: top / h },
        { x: (right + 1) / w, y: top / h },
        { x: (right + 1) / w, y: bottom / h },
        { x: left / w, y: bottom / h },
      ]);
    }
  }
  return result;
}

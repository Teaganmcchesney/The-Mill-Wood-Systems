import type { Point } from "./package-parser";
type Matrix = [number, number, number, number, number, number];
type Viewport = {
  width: number;
  height: number;
  convertToViewportPoint: (x: number, y: number) => number[];
};
const identity: Matrix = [1, 0, 0, 1, 0, 0];
function multiply(m: Matrix, n: number[]): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}
function numbers(v: unknown): number[] {
  return Array.from(v as ArrayLike<number>);
}
export function extractWallRectangles(
  list: { fnArray: ArrayLike<number>; argsArray: unknown[] },
  ops: Record<string, number>,
  viewport: Viewport,
): Point[][] {
  let matrix: Matrix = [...identity],
    color: number[] = [0, 0, 0],
    pending: Point[][] = [];
  const stack: { matrix: Matrix; color: number[] }[] = [],
    result: Point[][] = [];
  // TrueBuild bundle reports encode wall bodies as brown filled rectangles.
  const wood = () =>
    color.length === 3 &&
    Math.abs(color[0] - 205) < 3 &&
    Math.abs(color[1] - 133) < 3 &&
    Math.abs(color[2] - 63) < 3;
  for (let i = 0; i < list.fnArray.length; i++) {
    const fn = list.fnArray[i],
      args = list.argsArray[i] as unknown[] | null;
    if (fn === ops.save) {
      stack.push({ matrix: [...matrix], color: [...color] });
      continue;
    }
    if (fn === ops.restore) {
      const state = stack.pop();
      if (state) {
        matrix = state.matrix;
        color = state.color;
      }
      continue;
    }
    if (fn === ops.transform && args) {
      matrix = multiply(matrix, numbers(args));
      continue;
    }
    if (fn === ops.setFillRGBColor && args) {
      color = numbers(args);
      continue;
    }
    if (fn === ops.setFillGray && args) {
      color = [
        Number(args[0]) * 255,
        Number(args[0]) * 255,
        Number(args[0]) * 255,
      ];
      continue;
    }
    if (fn === ops.constructPath && args) {
      const commands = numbers(args[0]),
        coords = numbers(args[1]);
      pending = [];
      const polygons: number[][][] = [];
      let cursor = 0,
        polygon: number[][] = [];
      for (const command of commands) {
        if (command === ops.rectangle) {
          const [x, y, w, h] = coords.slice(cursor, cursor + 4);
          cursor += 4;
          polygons.push([
            [x, y],
            [x + w, y],
            [x + w, y + h],
            [x, y + h],
          ]);
        } else if (command === ops.moveTo) {
          polygon = [coords.slice(cursor, cursor + 2)];
          cursor += 2;
        } else if (command === ops.lineTo) {
          polygon.push(coords.slice(cursor, cursor + 2));
          cursor += 2;
        } else if (command === ops.closePath) {
          if (polygon.length === 4) polygons.push(polygon);
          polygon = [];
        } else {
          polygons.length = 0;
          break;
        }
      }
      for (const polygon of polygons) {
        if (
          !polygon.every(
            (p, n) =>
              Math.abs(p[0] - polygon[(n + 1) % 4][0]) < 0.001 ||
              Math.abs(p[1] - polygon[(n + 1) % 4][1]) < 0.001,
          )
        )
          continue;
        const points = polygon.map(([a, b]) => {
          const [px, py] = viewport.convertToViewportPoint(
            matrix[0] * a + matrix[2] * b + matrix[4],
            matrix[1] * a + matrix[3] * b + matrix[5],
          );
          return { x: px / viewport.width, y: py / viewport.height };
        });
        const left = Math.min(...points.map((p) => p.x)),
          right = Math.max(...points.map((p) => p.x)),
          top = Math.min(...points.map((p) => p.y)),
          bottom = Math.max(...points.map((p) => p.y));
        if (
          left >= 0 &&
          right < 0.65 &&
          top > 0.35 &&
          (right - left) * viewport.width > 2 &&
          (bottom - top) * viewport.height > 3 &&
          (bottom - top) * viewport.height < 60
        ) {
          pending.push([
            { x: left, y: top },
            { x: right, y: top },
            { x: right, y: bottom },
            { x: left, y: bottom },
          ]);
        }
      }
    }
    if (
      [
        ops.fill,
        ops.eoFill,
        ops.fillStroke,
        ops.eoFillStroke,
        ops.closeFillStroke,
        ops.closeEOFillStroke,
      ].includes(fn)
    ) {
      if (wood()) result.push(...pending);
      pending = [];
    } else if (
      fn === ops.stroke ||
      fn === ops.closeStroke ||
      fn === ops.endPath
    ) {
      pending = [];
    }
  }
  return result;
}
export function traceMatchesProduction(
  outlines: Point[][],
  feet: number[],
  pageWidth: number,
  rotatedFeet?: number[],
) {
  if (
    !outlines.length ||
    outlines.length !== feet.length ||
    feet.some((f) => !Number.isFinite(f) || f <= 0)
  )
    return false;
  const widths = outlines.map(
    (ps) => Math.max(...ps.map((p) => p.x)) - Math.min(...ps.map((p) => p.x)),
  );
  if (widths.some((w) => !Number.isFinite(w) || w <= 0)) return false;
  const options = feet.map((length, i) => {
    const height = rotatedFeet?.[i];
    return height && Number.isFinite(height) && height > 0
      ? [length, height]
      : [length];
  });
  // A single drawing scale must explain every wall. Rotated panels may use their
  // production height as horizontal span; report footage is never consulted.
  const candidates = options.flatMap((values, i) =>
    values.map((value) => widths[i] / value),
  );
  for (const candidate of candidates) {
    const factors = options
      .map((values, i) => {
        const dimension = values.reduce((a, b) =>
          Math.abs(widths[i] - a * candidate) <=
          Math.abs(widths[i] - b * candidate)
            ? a
            : b,
        );
        return widths[i] / dimension;
      })
      .sort((a, b) => a - b);
    const scale = factors[Math.floor(factors.length / 2)];
    if (
      widths.every((w, i) =>
        options[i].some(
          (value) => Math.abs(w - value * scale) * pageWidth <= 0.75,
        ),
      )
    )
      return true;
  }
  return false;
}

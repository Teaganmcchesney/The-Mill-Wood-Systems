"use client";

import { useRef, useState, type PointerEvent } from "react";

type Point = { x: number; y: number };
type Line = { points: Point[]; color: string; width: number };

type ZoomableDrawingProps = {
  imageUrl?: string | null;
  alt: string;
  emptyText?: string;
  className?: string;
  markupData?: unknown;
};

export function ZoomableDrawing({ imageUrl, alt, emptyText = "No drawing attached", className = "", markupData }: ZoomableDrawingProps) {
  const pointers = useRef(new Map<number, Point>());
  const lastDistance = useRef(0);
  const [scale, setScale] = useState(1);
  const lines = parseLines(markupData);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2) {
      event.currentTarget.setPointerCapture(event.pointerId);
      lastDistance.current = distance(Array.from(pointers.current.values()).slice(0, 2));
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size < 2) return;

    const nextDistance = distance(Array.from(pointers.current.values()).slice(0, 2));
    if (!lastDistance.current) {
      lastDistance.current = nextDistance;
      return;
    }

    const delta = nextDistance / lastDistance.current;
    setScale((current) => Math.max(1, Math.min(4, current * delta)));
    lastDistance.current = nextDistance;
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) lastDistance.current = 0;
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={() => setScale(1)}
      className={`relative grid overflow-hidden rounded-md border border-slate-200 bg-slate-100 touch-none ${className}`}
    >
      {imageUrl ? (
        <div className="relative m-auto h-full max-h-[78vh] min-h-[62vh] w-full transition-transform duration-100" style={{ transform: `scale(${scale})` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={alt} draggable={false} className="absolute inset-0 h-full w-full object-contain" />
          {lines.length ? (
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none">
              {lines.map((line, index) => (
                <polyline
                  key={`${line.points.length}-${index}`}
                  points={line.points.map(pointToString).join(" ")}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={line.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </svg>
          ) : null}
        </div>
      ) : (
        <div className="grid h-[62vh] place-items-center p-4 text-center text-2xl font-black text-steel">{emptyText}</div>
      )}
      {scale > 1 ? (
        <button
          onClick={() => setScale(1)}
          className="absolute right-3 top-3 rounded-md bg-white/90 px-4 py-2 text-base font-black text-ink shadow-touch"
        >
          Reset zoom
        </button>
      ) : null}
    </div>
  );
}

function distance(points: Point[]) {
  const [first, second] = points;
  if (!first || !second) return 0;
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function pointToString(point: Point) {
  return `${point.x},${point.y}`;
}

function parseLines(value: unknown): Line[] {
  if (!value || typeof value !== "object" || !("lines" in value)) return [];
  const lines = (value as { lines?: unknown }).lines;
  if (!Array.isArray(lines)) return [];
  return lines.map(normalizeLine).filter(Boolean) as Line[];
}

function normalizeLine(value: unknown): Line | null {
  if (!value || typeof value !== "object") return null;
  const color = typeof (value as { color?: unknown }).color === "string" ? (value as { color: string }).color : "#f2c94c";
  const width = typeof (value as { width?: unknown }).width === "number" ? (value as { width: number }).width : 7;
  const rawPoints = (value as { points?: unknown }).points;

  if (Array.isArray(rawPoints)) {
    const points = rawPoints.filter(isPoint);
    return points.length ? { points, color, width } : null;
  }

  if (typeof rawPoints === "string") {
    const points = rawPoints
      .split(/\s+/)
      .map((item) => {
        const [x, y] = item.split(",").map(Number);
        return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
      })
      .filter(Boolean) as Point[];
    return points.length ? { points, color, width } : null;
  }

  return null;
}

function isPoint(value: unknown): value is Point {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { x?: unknown }).x === "number" &&
    typeof (value as { y?: unknown }).y === "number"
  );
}

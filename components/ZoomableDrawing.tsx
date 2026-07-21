"use client";

import { useRef, useState } from "react";

type Point = { x: number; y: number };

type ZoomableDrawingProps = {
  imageUrl?: string | null;
  alt: string;
  emptyText?: string;
  className?: string;
};

export function ZoomableDrawing({ imageUrl, alt, emptyText = "No drawing attached", className = "" }: ZoomableDrawingProps) {
  const pointers = useRef(new Map<number, Point>());
  const lastDistance = useRef(0);
  const [scale, setScale] = useState(1);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2) {
      event.currentTarget.setPointerCapture(event.pointerId);
      lastDistance.current = distance(Array.from(pointers.current.values()).slice(0, 2));
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
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

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
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
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={alt}
          draggable={false}
          className="m-auto h-full max-h-[78vh] min-h-[62vh] w-full object-contain transition-transform duration-100"
          style={{ transform: `scale(${scale})` }}
        />
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

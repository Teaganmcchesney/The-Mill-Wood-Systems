"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Eraser, NotebookPen, Save, X } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

type Point = { x: number; y: number };
type Line = { points: Point[]; color: string; width: number };

type WallNotesButtonProps = {
  wallId: string;
  wallLabel: string;
  imageUrl?: string | null;
  pageLabel?: string;
  className?: string;
};

export function WallNotesButton({ wallId, wallLabel, imageUrl, pageLabel, className = "" }: WallNotesButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`touch-target inline-flex items-center justify-center gap-3 rounded-md bg-shop px-6 py-4 text-2xl font-black text-ink ${className}`}
      >
        <NotebookPen size={30} /> Notes
      </button>
      {open ? (
        <WallNotesModal
          wallId={wallId}
          wallLabel={wallLabel}
          imageUrl={imageUrl}
          pageLabel={pageLabel}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function WallNotesModal({
  wallId,
  wallLabel,
  imageUrl,
  pageLabel,
  onClose
}: {
  wallId: string;
  wallLabel: string;
  imageUrl?: string | null;
  pageLabel?: string;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState<Line | null>(null);
  const [busy, setBusy] = useState("Loading notes...");
  const [error, setError] = useState("");
  const drawingRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const draftRef = useRef<Line | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadNote() {
      setBusy("Loading notes...");
      setError("");
      const supabase = createClient();
      const { data, error: loadError } = await supabase
        .from("wall_notes")
        .select("note_text, markup_data")
        .eq("wall_panel_id", wallId)
        .maybeSingle();

      if (cancelled) return;
      if (loadError) {
        setError(loadError.message);
      } else if (data) {
        setNote(data.note_text ?? "");
        setLines(parseLines(data.markup_data));
      } else {
        setNote("");
        setLines([]);
      }
      setBusy("");
    }

    void loadNote();
    return () => {
      cancelled = true;
    };
  }, [wallId]);

  async function saveNote() {
    setBusy("Saving notes...");
    setError("");
    const supabase = createClient();
    const { error: saveError } = await supabase.from("wall_notes").upsert(
      {
        wall_panel_id: wallId,
        note_text: note,
        markup_data: { version: 2, lines }
      },
      { onConflict: "wall_panel_id" }
    );

    if (saveError) {
      setError(saveError.message);
      setBusy("");
      return;
    }

    setBusy("");
    onClose();
  }

  function startLine(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const point = relativePoint(event);
    if (!point) return;
    activePointerId.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    const nextDraft = { points: [point], color: "#f2c94c", width: 7 };
    draftRef.current = nextDraft;
    setDraft(nextDraft);
  }

  function moveLine(event: PointerEvent<HTMLDivElement>) {
    if (activePointerId.current !== event.pointerId || !draftRef.current) return;
    event.preventDefault();
    const point = relativePoint(event);
    if (!point) return;
    const current = draftRef.current;
    const previous = current.points[current.points.length - 1];
    if (previous && Math.abs(previous.x - point.x) < 1 && Math.abs(previous.y - point.y) < 1) return;
    const nextDraft = { ...current, points: [...current.points, point] };
    draftRef.current = nextDraft;
    setDraft(nextDraft);
  }

  function endLine(event?: PointerEvent<HTMLDivElement>) {
    if (event && activePointerId.current !== event.pointerId) return;
    const finished = draftRef.current;
    activePointerId.current = null;
    draftRef.current = null;
    setDraft(null);
    if (!finished || finished.points.length < 2) return;
    setLines((current) => [...current, finished]);
  }

  function relativePoint(event: PointerEvent<HTMLDivElement>) {
    const box = drawingRef.current?.getBoundingClientRect();
    if (!box || !box.width || !box.height) return null;
    const x = ((event.clientX - box.left) / box.width) * 1000;
    const y = ((event.clientY - box.top) / box.height) * 1000;
    return {
      x: Math.max(0, Math.min(1000, Math.round(x))),
      y: Math.max(0, Math.min(1000, Math.round(y)))
    };
  }

  return (
    <div className="fixed inset-0 z-50 grid bg-black/80 p-4 lg:p-8">
      <section className="grid max-h-full gap-4 overflow-hidden rounded-md bg-white p-5 shadow-touch lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid min-h-0 gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-steel">{pageLabel}</p>
              <h2 className="text-3xl font-black text-ink">Notes for {wallLabel}</h2>
            </div>
            <button onClick={onClose} className="touch-target rounded-md bg-slate-100 px-4 py-3 text-lg font-black text-ink">
              <X size={26} />
            </button>
          </div>

          <div
            ref={drawingRef}
            onPointerDown={startLine}
            onPointerMove={moveLine}
            onPointerUp={endLine}
            onPointerCancel={endLine}
            onPointerLeave={endLine}
            className="relative min-h-[58vh] overflow-hidden rounded-md border border-slate-300 bg-slate-100 touch-none select-none"
            style={{ touchAction: "none" }}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={wallLabel} className="absolute inset-0 h-full w-full object-contain" draggable={false} />
            ) : (
              <div className="grid h-full place-items-center text-2xl font-black text-steel">No drawing attached</div>
            )}
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none">
              <rect width="1000" height="1000" fill="transparent" />
              {lines.map((line, index) => (
                <polyline key={`${line.points.length}-${index}`} points={line.points.map(pointToString).join(" ")} fill="none" stroke={line.color} strokeWidth={line.width} strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {draft ? <polyline points={draft.points.map(pointToString).join(" ")} fill="none" stroke={draft.color} strokeWidth={draft.width} strokeLinecap="round" strokeLinejoin="round" /> : null}
            </svg>
          </div>
        </div>

        <aside className="grid content-start gap-3 overflow-auto">
          <label className="grid gap-2 text-lg font-bold text-ink">
            Note
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="min-h-52 rounded-md border border-slate-300 p-4 text-xl font-bold text-ink"
              placeholder="Add build notes, fixes, missing material, or questions here."
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setLines([])} className="touch-target inline-flex items-center justify-center gap-2 rounded-md bg-slate-100 px-5 py-4 text-lg font-black text-ink">
              <Eraser size={24} /> Clear marks
            </button>
            <button onClick={saveNote} disabled={Boolean(busy)} className="touch-target inline-flex items-center justify-center gap-2 rounded-md bg-ink px-5 py-4 text-lg font-black text-white disabled:opacity-60">
              <Save size={24} /> {busy || "Save"}
            </button>
          </div>
          <p className="rounded-md bg-slate-100 p-3 text-base font-bold text-steel">Draw directly on the wall drawing with a stylus, mouse, or finger. Click Save to keep the markup with this wall.</p>
          {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-base font-bold text-red-700">{error}</p> : null}
        </aside>
      </section>
    </div>
  );
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

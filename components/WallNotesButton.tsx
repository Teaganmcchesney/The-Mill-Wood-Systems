"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, NotebookPen, Save, X } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

type Line = { points: string; color: string };

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
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState("Loading notes...");
  const [error, setError] = useState("");
  const drawingRef = useRef<HTMLDivElement | null>(null);

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
        markup_data: { lines }
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

  function startLine(event: React.PointerEvent<HTMLDivElement>) {
    const point = relativePoint(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraft(point);
  }

  function moveLine(event: React.PointerEvent<HTMLDivElement>) {
    if (!draft) return;
    const point = relativePoint(event);
    if (!point) return;
    setDraft((current) => `${current} ${point}`);
  }

  function endLine() {
    if (!draft) return;
    setLines((current) => [...current, { points: draft, color: "#f2c94c" }]);
    setDraft("");
  }

  function relativePoint(event: React.PointerEvent<HTMLDivElement>) {
    const box = drawingRef.current?.getBoundingClientRect();
    if (!box) return null;
    const x = ((event.clientX - box.left) / box.width) * 1000;
    const y = ((event.clientY - box.top) / box.height) * 1000;
    return `${Math.max(0, Math.min(1000, Math.round(x)))},${Math.max(0, Math.min(1000, Math.round(y)))}`;
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
            className="relative min-h-[58vh] overflow-hidden rounded-md border border-slate-300 bg-slate-100 touch-none"
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={wallLabel} className="absolute inset-0 h-full w-full object-contain" draggable={false} />
            ) : (
              <div className="grid h-full place-items-center text-2xl font-black text-steel">No drawing attached</div>
            )}
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none">
              {lines.map((line, index) => (
                <polyline key={`${line.points}-${index}`} points={line.points} fill="none" stroke={line.color} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {draft ? <polyline points={draft} fill="none" stroke="#f2c94c" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" /> : null}
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
          <p className="rounded-md bg-slate-100 p-3 text-base font-bold text-steel">Draw with your finger or stylus on the drawing. Use the note box for longer comments.</p>
          {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-base font-bold text-red-700">{error}</p> : null}
        </aside>
      </section>
    </div>
  );
}

function parseLines(value: unknown): Line[] {
  if (!value || typeof value !== "object" || !("lines" in value)) return [];
  const lines = (value as { lines?: unknown }).lines;
  if (!Array.isArray(lines)) return [];
  return lines.filter(isLine);
}

function isLine(value: unknown): value is Line {
  return (
    typeof value === "object" &&
    value !== null &&
    "points" in value &&
    "color" in value &&
    typeof (value as { points?: unknown }).points === "string" &&
    typeof (value as { color?: unknown }).color === "string"
  );
}

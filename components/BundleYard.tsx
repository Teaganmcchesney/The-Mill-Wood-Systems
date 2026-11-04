"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { suggestBands } from "@/lib/outline-suggestions";
import { createClient } from "@/lib/supabase-browser";
import { validOutline, type Point } from "@/lib/package-parser";
export type BundleDrawing = {
  id: string;
  project_id: string;
  projects: { code: string; name: string } | null;
  level: string;
  bundle_id: string;
  image_url: string;
  production_pdf_url: string;
  bundle_pdf_url: string;
  report_feet: number;
  expected_count: number;
  stacked_at: string | null;
  bundle_panels: {
    id: string;
    outline: Point[];
    verified_at: string | null;
    wall_panels: {
      id: string;
      wall_id: string;
      status: string;
      lineal_feet: number;
    } | null;
  }[];
};
export function BundleYard({
  bundles,
  manager,
}: {
  bundles: BundleDrawing[];
  manager: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 15000);
    return () => clearInterval(timer);
  }, [router]);
  const levels = Array.from(
    new Set(bundles.map((b) => b.project_id + "|" + b.level)),
  );
  return (
    <section className="grid gap-4 text-ink">
      <h2 className="text-3xl font-black">Bundle drawings</h2>
      <p>
        Orange fill means production complete. Physical stacking requires a
        separate supervisor confirmation. Updates every 15 seconds.
      </p>
      <label className="font-bold">
        Project / level{" "}
        <select
          className="touch-target border p-2"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All packages</option>
          {levels.map((l) => (
            <option key={l} value={l}>
              {
                bundles.find((b) => b.project_id + "|" + b.level === l)
                  ?.projects?.code
              }{" "}
              / {l.split("|")[1]}
            </option>
          ))}
        </select>
      </label>
      {bundles
        .filter(
          (b) => filter === "all" || b.project_id + "|" + b.level === filter,
        )
        .map((b) => (
          <BundleCard key={b.id} bundle={b} manager={manager} />
        ))}
      {!bundles.length && (
        <p>
          Import production drawings and the Complete Bundle Report together in
          Admin to see bundle progress.
        </p>
      )}
    </section>
  );
}
function imageBands(img: HTMLImageElement) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];
    ctx.drawImage(img, 0, 0);
    return suggestBands(ctx.getImageData(0, 0, canvas.width, canvas.height));
  } catch {
    return [];
  }
}
function BundleCard({
  bundle: b,
  manager,
}: {
  bundle: BundleDrawing;
  manager: boolean;
}) {
  const [candidates, setCandidates] = useState<Point[][]>([]);
  const [zoom, setZoom] = useState(1);
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth) setCandidates(imageBands(image));
  }, [b.image_url]);
  const router = useRouter();
  const [selected, setSelected] = useState(""),
    [points, setPoints] = useState<Point[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const members = b.bundle_panels;
  const complete = members.filter(
    (p) => p.wall_panels?.status === "complete",
  ).length;
  const all =
    complete === b.expected_count && members.length === b.expected_count;
  const productionFeet = members.reduce(
    (sum, p) => sum + Number(p.wall_panels?.lineal_feet ?? 0),
    0,
  );
  const verified = members.filter((p) => p.verified_at).length;
  const panel = members.find((p) => p.id === selected);
  async function action(kind: "outline" | "stack") {
    setBusy(true);
    setError("");
    try {
      const client = createClient();
      const { error } =
        kind === "outline"
          ? await client.rpc("verify_bundle_outline", {
              p_id: selected,
              p_points: points,
            })
          : await client.rpc("set_bundle_stacked", {
              p_id: b.id,
              p_stacked: !b.stacked_at,
            });
      if (error) throw error;
      setSelected("");
      setPoints([]);
      router.refresh();
    } catch (e) {
      setError(
        typeof e === "object" && e && "message" in e
          ? String(e.message)
          : "Unable to save.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="grid gap-4 rounded-md bg-white p-5 shadow-touch">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h3 className="text-2xl font-black">
            {b.projects?.code} / {b.bundle_id} / {b.level}
          </h3>
          <p>
            {complete} / {b.expected_count} walls production complete ·{" "}
            {productionFeet.toFixed(4)} production LF /{" "}
            {Number(b.report_feet).toFixed(4)} report LF · {verified} outlines
            verified
          </p>
        </div>
        <strong className="rounded-md bg-orange-100 text-black p-3">
          {all ? "Production complete" : "Production in progress"} ·{" "}
          {b.stacked_at ? "Physically stacked" : "Awaiting stacking"}
        </strong>
      </div>
      {b.stacked_at && (
        <div
          className="ml-4 grid max-w-sm gap-1"
          aria-label="Physically stacked bundle"
        >
          {members.map((p) => (
            <div
              key={p.id}
              className={
                "h-5 -skew-x-12 border-2 border-orange-800 " +
                (p.wall_panels?.status === "complete"
                  ? "bg-orange-500"
                  : "bg-white")
              }
            />
          ))}
          <span className="font-bold">
            {all
              ? "Stack confirmed"
              : "Stack confirmed earlier; production status changed — review required"}
          </span>
        </div>
      )}
      <p className="flex gap-4 font-bold underline">
        <a href={b.production_pdf_url} target="_blank" rel="noreferrer">
          Original production PDF
        </a>
        <a href={b.bundle_pdf_url} target="_blank" rel="noreferrer">
          Original bundle PDF
        </a>
      </p>
      <div className="flex items-center gap-3">
        <button
          className="touch-target rounded border p-3"
          disabled={zoom === 1}
          onClick={() => setZoom((z) => Math.max(1, z - 1))}
        >
          Zoom out
        </button>
        <span>{zoom}x</span>
        <button
          className="touch-target rounded border p-3"
          disabled={zoom === 4}
          onClick={() => setZoom((z) => Math.min(4, z + 1))}
        >
          Zoom in
        </button>
      </div>
      <div className="max-h-[75vh] overflow-auto rounded border">
        <div
          className="relative select-none overflow-hidden bg-white"
          style={{ width: zoom * 100 + "%" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            crossOrigin="anonymous"
            ref={imageRef}
            onLoad={(e) => setCandidates(imageBands(e.currentTarget))}
            src={b.image_url}
            alt={"Original bundle drawing " + b.bundle_id}
            className="block h-auto w-full"
            draggable={false}
          />
          <svg
            className={
              "absolute inset-0 h-full w-full " +
              (selected
                ? "cursor-crosshair touch-manipulation"
                : "pointer-events-none")
            }
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
            onClick={(e) => {
              if (!selected || busy) return;
              e.preventDefault();
              const r = e.currentTarget.getBoundingClientRect();
              setPoints((p) => [
                ...p,
                {
                  x: (e.clientX - r.left) / r.width,
                  y: (e.clientY - r.top) / r.height,
                },
              ]);
            }}
          >
            {members
              .filter(
                (p) =>
                  p.verified_at && validOutline(p.outline) && p.id !== selected,
              )
              .map((p) => (
                <polygon
                  key={p.id}
                  points={p.outline
                    .map((q) => q.x * 1000 + "," + q.y * 1000)
                    .join(" ")}
                  fill={
                    p.wall_panels?.status === "complete" ? "#f97316" : "none"
                  }
                  fillOpacity={0.6}
                  stroke="#ea580c"
                  strokeWidth="2"
                >
                  <title>
                    {(p.wall_panels?.wall_id ?? "") +
                      " — " +
                      (p.wall_panels?.status ?? "")}
                  </title>
                </polygon>
              ))}
            {selected && points.length > 0 && (
              <polygon
                points={points
                  .map((q) => q.x * 1000 + "," + q.y * 1000)
                  .join(" ")}
                fill="#fb923c"
                fillOpacity={0.2}
                stroke="#ea580c"
                strokeDasharray="5 3"
                strokeWidth="2"
              />
            )}
          </svg>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {members.map((p) => (
          <button
            disabled={!manager || busy}
            key={p.id}
            className={
              "touch-target rounded-md border-2 p-3 font-bold " +
              (selected === p.id ? "border-ink " : "border-orange-400 ") +
              (p.wall_panels?.status === "complete"
                ? "bg-orange-200 text-black"
                : "bg-white")
            }
            onClick={() => {
              setSelected(p.id);
              setPoints(p.outline ?? []);
              setError("");
            }}
          >
            {p.wall_panels?.wall_id ?? "Missing wall"} ·{" "}
            {p.wall_panels?.status ?? "unmatched"} ·{" "}
            {p.verified_at ? "outline verified" : "position needs review"}
          </button>
        ))}
      </div>
      {panel && (
        <div className="grid gap-3 rounded-md bg-slate-100 p-4">
          <p className="font-bold">
            Verify {panel.wall_panels?.wall_id}: tap around the exact panel
            perimeter on the original drawing in order. Confirm only after
            checking its label and physical position.
          </p>
          <div className="flex flex-wrap gap-2">
            {candidates.map((candidate, index) => (
              <button
                key={index}
                disabled={busy}
                className="touch-target border p-3"
                onClick={() => setPoints(candidate)}
              >
                Try detected band {index + 1}
              </button>
            ))}
          </div>
          <p>
            Detected bands are approximate. Check the label and adjust the
            perimeter before approval.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              className="touch-target border p-3"
              disabled={busy}
              onClick={() => setPoints([])}
            >
              Clear outline
            </button>
            <button
              className="touch-target border p-3"
              disabled={busy}
              onClick={() => setPoints((p) => p.slice(0, -1))}
            >
              Undo point
            </button>
            <button
              className="touch-target rounded bg-ink p-3 text-white disabled:opacity-50"
              disabled={busy || !validOutline(points)}
              onClick={() => void action("outline")}
            >
              Approve panel position
            </button>
            <button
              className="touch-target border p-3"
              onClick={() => setSelected("")}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {manager && (
        <button
          disabled={busy || (!all && !b.stacked_at)}
          className="touch-target rounded-md bg-ink p-4 font-bold text-white disabled:opacity-50"
          onClick={() => void action("stack")}
        >
          {b.stacked_at
            ? "Clear physical stacking confirmation"
            : "Confirm physically stacked in Yard"}
        </button>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
    </article>
  );
}

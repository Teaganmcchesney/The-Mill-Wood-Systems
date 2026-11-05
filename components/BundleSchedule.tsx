"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import {
  orderedUpcoming,
  orderedLayoutMembers,
  type BundleDrawing,
} from "@/lib/yard-display";
import { BundleOutline } from "@/components/BundleOutline";
export function BundleSchedule({
  bundles,
  currentId,
  manager,
}: {
  bundles: BundleDrawing[];
  currentId?: string;
  manager: boolean;
}) {
  const router = useRouter(),
    upcoming = orderedUpcoming(bundles);
  const [busy, setBusy] = useState(false),
    [refreshing, startTransition] = useTransition();
  const [dragged, setDragged] = useState<string | null>(null),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const pending = busy || refreshing;
  async function move(id: string, before: string | null) {
    if (!manager || pending || id === before) return;
    setBusy(true);
    setError("");
    setMessage("");
    setDragged(null);
    try {
      const { error } = await createClient().rpc("move_production_bundle", {
        p_bundle: id,
        p_before: before,
      });
      if (error) throw error;
      setMessage(
        (bundles.find((b) => b.id === id)?.bundle_id ?? "Bundle") +
          " moved. Shop queues now follow this bundle order.",
      );
      startTransition(() => router.refresh());
    } catch (e) {
      setError(
        e && typeof e === "object" && "message" in e
          ? String(e.message)
          : "Could not move the bundle. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="bundle-schedule grid gap-3"
      aria-label="Upcoming production bundles"
      aria-busy={pending}
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-2xl font-black">
            Upcoming bundles · {upcoming.length}
          </h2>
          <p className="text-sm text-steel">
            {manager
              ? "Drag a bundle before another, use Move up / down, or choose Make next."
              : "Bundles run in the order shown."}{" "}
            Walls run from the bottom of each stack upward.
          </p>
        </div>
        <p className="text-sm text-steel">
          One bundle order for both production lines
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded border border-orange-500 p-3">
          {error}
        </p>
      )}
      <p role="status" aria-live="polite" className="text-sm text-steel">
        {pending ? "Saving bundle order…" : message}
      </p>
      <div className="upcoming-grid grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {upcoming.map((b, i) => {
          const ordered = orderedLayoutMembers(b);
          return (
            <article
              key={b.id}
              data-bundle-id={b.id}
              draggable={manager && !pending}
              onDragStart={(e) => {
                if (pending || !manager) {
                  e.preventDefault();
                  return;
                }
                e.dataTransfer.setData("text/plain", b.id);
                e.dataTransfer.effectAllowed = "move";
                setDragged(b.id);
              }}
              onDragEnd={() => setDragged(null)}
              onDragOver={(e) => {
                if (manager && !pending && dragged && dragged !== b.id) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                if (upcoming.some((b) => b.id === id)) void move(id, b.id);
              }}
              className={
                "bundle-schedule-card grid content-start gap-3 rounded-lg border bg-[#090807] p-4 " +
                (currentId === b.id
                  ? "border-orange-500"
                  : "border-[#3A3028]") +
                (dragged === b.id ? " opacity-50" : "")
              }
            >
              <header className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="text-sm text-steel">
                    {i + 1} · {b.projects?.code} / {b.level}
                  </p>
                  <h3 className="text-2xl font-black text-[#f97316]">
                    {b.bundle_id}
                  </h3>
                </div>
                <p className="text-sm font-bold">
                  {
                    ordered.filter((p) => p.wall_panels?.status === "complete")
                      .length
                  }{" "}
                  / {b.expected_count} complete
                  {currentId === b.id && (
                    <span className="block text-[#f97316]">
                      On this line now
                    </span>
                  )}
                </p>
              </header>
              <div className="h-36">
                <BundleOutline bundle={b} compact />
              </div>
              <p className="text-sm text-steel">
                Bottom → top:{" "}
                {ordered.map((p, n) => (
                  <span
                    key={p.id}
                    className={
                      p.wall_panels?.status === "complete"
                        ? "line-through opacity-60"
                        : ""
                    }
                  >
                    {n > 0 ? " → " : ""}
                    {p.wall_panels?.wall_id ?? "Unmatched wall"}
                  </span>
                ))}
              </p>
              {manager && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="touch-target rounded border border-orange-500 px-3 font-bold disabled:opacity-40"
                    disabled={pending || i === 0}
                    onClick={() => void move(b.id, upcoming[0]?.id ?? null)}
                    aria-label={"Make " + b.bundle_id + " next"}
                  >
                    Make next
                  </button>
                  <button
                    type="button"
                    className="touch-target rounded border border-[#3A3028] px-3 disabled:opacity-40"
                    disabled={pending || i === 0}
                    onClick={() => void move(b.id, upcoming[i - 1].id)}
                    aria-label={"Move " + b.bundle_id + " up"}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    className="touch-target rounded border border-[#3A3028] px-3 disabled:opacity-40"
                    disabled={pending || i === upcoming.length - 1}
                    onClick={() => void move(b.id, upcoming[i + 2]?.id ?? null)}
                    aria-label={"Move " + b.bundle_id + " down"}
                  >
                    Move down
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {!upcoming.length && (
        <p className="text-steel">All bundles are production complete.</p>
      )}
    </section>
  );
}

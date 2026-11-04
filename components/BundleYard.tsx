"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BundleOutline } from "@/components/BundleOutline";
import {
  activeBundle,
  orderedCompleted,
  productionComplete,
  type BundleDrawing,
  type QueueHead,
} from "@/lib/yard-display";
export type { BundleDrawing } from "@/lib/yard-display";
type Option = { id: string; name: string };
export function BundleYard({
  bundles,
  lines,
  projects,
  activeLine,
  activeProject,
  head,
  manager,
}: {
  bundles: BundleDrawing[];
  lines: Option[];
  projects: Option[];
  activeLine: string;
  activeProject: string;
  head: QueueHead | null;
  manager: boolean;
}) {
  const router = useRouter(),
    screen = useRef<HTMLElement>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<string | null>(null),
    [fullscreen, setFullscreen] = useState(false),
    [pending, startTransition] = useTransition();
  const current = activeBundle(bundles, head),
    completed = orderedCompleted(bundles);
  const opened = bundles.find((b) => b.id === selected);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const onFullscreen = () =>
      setFullscreen(document.fullscreenElement === screen.current);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [router]);
  useEffect(() => {
    if (opened && !dialog.current?.open) dialog.current?.showModal();
    if (!opened && dialog.current?.open) dialog.current?.close();
  }, [opened?.id]);
  function filter(line: string, project: string) {
    const q = new URLSearchParams({ line, project });
    startTransition(() => router.push("/yard?" + q));
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await screen.current?.requestFullscreen();
    } catch {
      setFullscreen(false);
    }
  }
  return (
    <section
      ref={screen}
      className="yard-screen grid min-h-[calc(100vh-9rem)] grid-rows-[auto_1fr_auto] gap-4 text-ink"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-steel">
            Yard · stacking display
          </p>
          <h1 className="text-3xl font-black">
            {lines.find((l) => l.id === activeLine)?.name ?? "Production line"}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="grid gap-1 text-sm font-bold">
            Line
            <select
              aria-label="Production line"
              disabled={pending}
              value={activeLine}
              onChange={(e) => filter(e.target.value, activeProject)}
              className="touch-target rounded border border-slate-300 px-3"
            >
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Job
            <select
              aria-label="Job"
              disabled={pending}
              value={activeProject}
              onChange={(e) => filter(activeLine, e.target.value)}
              className="touch-target rounded border border-slate-300 px-3"
            >
              <option value="all">All jobs</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {manager && !fullscreen && (
            <Link
              className="touch-target grid place-items-center px-3 text-sm font-bold underline"
              href="/yard/setup"
            >
              Layout setup
            </Link>
          )}
          <button
            className="touch-target rounded border border-orange-500 px-4 font-bold"
            onClick={() => void toggleFullscreen()}
          >
            {fullscreen ? "Exit full screen" : "Full screen"}
          </button>
        </div>
      </header>
      <article className="grid min-h-0 grid-rows-[auto_1fr] overflow-hidden rounded-lg border border-orange-500/40 bg-[#090807] p-4">
        {current ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase text-steel">
                  {current.projects?.code} · {current.level}
                </p>
                <h2 className="text-5xl font-black text-[#f97316]">
                  {current.bundle_id}
                </h2>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black">
                  {
                    current.bundle_panels.filter(
                      (p) => p.wall_panels?.status === "complete",
                    ).length
                  }{" "}
                  / {current.expected_count} complete
                </p>
                <p className="text-lg font-bold text-steel">
                  Current wall {head?.wall_id}
                </p>
              </div>
            </div>
            <div className="min-h-[50vh]">
              <BundleOutline
                key={current.id}
                bundle={current}
                currentWallId={head?.id}
              />
            </div>
          </>
        ) : (
          <div className="grid min-h-[55vh] place-content-center gap-3 text-center">
            <h2 className="text-4xl font-black">
              {head
                ? "Current wall has no bundle layout"
                : "No walls waiting on this line"}
            </h2>
            <p className="text-xl text-steel">
              {head
                ? "Wall " + head.wall_id + " needs a bundle assignment."
                : "Completed bundles are listed below."}
            </p>
          </div>
        )}
      </article>
      <footer className="grid gap-2">
        <div className="flex flex-wrap justify-between gap-2">
          <h2 className="text-lg font-black">Production-complete bundles</h2>
          <p className="text-sm text-steel">
            Orange = production complete · names in bundle-number order
          </p>
        </div>
        <div className="flex max-h-[16vh] flex-wrap gap-2 overflow-auto">
          {completed.map((b) => (
            <button
              key={b.id}
              title={(b.projects?.code ?? "") + " / " + b.level}
              onClick={() => setSelected(b.id)}
              className="touch-target rounded border-2 border-orange-500 px-5 text-xl font-black text-[#f97316]"
            >
              {b.bundle_id}
            </button>
          ))}
        </div>
        {!completed.length && (
          <p className="text-steel">No completed bundles yet.</p>
        )}
      </footer>
      <dialog
        ref={dialog}
        onCancel={() => setSelected(null)}
        onClose={() => setSelected(null)}
        className="yard-outline-dialog w-[96vw] max-w-none rounded-lg border border-orange-500 bg-[#090807] p-5 text-[#fff5e8]"
      >
        {opened && (
          <>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-4xl font-black text-[#f97316]">
                  {opened.bundle_id}
                </h2>
                <p>
                  {productionComplete(opened)
                    ? "Production complete"
                    : "Production completion changed"}{" "}
                  ·{" "}
                  {opened.stacked_at
                    ? "Physical stack confirmed"
                    : "Physical stacking not yet confirmed"}
                </p>
              </div>
              <button
                autoFocus
                className="touch-target rounded border px-5 font-bold"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>
            <div className="h-[70vh]">
              <BundleOutline bundle={opened} />
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}

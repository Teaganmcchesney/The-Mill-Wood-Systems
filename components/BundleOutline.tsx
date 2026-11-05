"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { validOutline } from "@/lib/package-parser";
import {
  outlineScene,
  hasStoredLayout,
  orderedLayoutMembers,
  type BundleDrawing,
} from "@/lib/yard-display";
import { autoTraceBundle, type AutoTrace } from "@/lib/bundle-trace-browser";
const aspects = new Map<string, number>();
export function BundleOutline({
  bundle,
  currentWallId,
  compact = false,
}: {
  bundle: BundleDrawing;
  currentWallId?: string;
  compact?: boolean;
}) {
  const stored = hasStoredLayout(bundle),
    ordered = orderedLayoutMembers(bundle);
  const sourceKey =
    bundle.id +
    "|" +
    bundle.bundle_pdf_url +
    "|" +
    ordered.map((p) => p.id + ":" + p.wall_panels?.lineal_feet).join(",");
  const [trace, setTrace] = useState<{ key: string; value: AutoTrace } | null>(
      null,
    ),
    [failure, setFailure] = useState<{ key: string; message: string } | null>(
      null,
    ),
    [retry, setRetry] = useState(0);
  const [storedAspect, setStoredAspect] = useState(
    aspects.get(bundle.image_url) ?? 1,
  );
  useEffect(() => {
    if (stored) {
      const image = new Image();
      let active = true;
      image.onload = () => {
        if (image.naturalHeight) {
          const value = image.naturalWidth / image.naturalHeight;
          aspects.set(bundle.image_url, value);
          if (active) setStoredAspect(value);
        }
      };
      image.src = bundle.image_url;
      return () => {
        active = false;
        image.onload = null;
      };
    }
    let active = true;
    setFailure(null);
    autoTraceBundle(
      bundle.bundle_pdf_url,
      bundle.bundle_id,
      ordered.map((p) => Number(p.wall_panels?.lineal_feet ?? 0)),
    )
      .then((value) => {
        if (active) setTrace({ key: sourceKey, value });
      })
      .catch((error) => {
        if (active)
          setFailure({
            key: sourceKey,
            message:
              error instanceof Error
                ? error.message
                : "Could not load the stack outline.",
          });
      });
    return () => {
      active = false;
    };
  }, [sourceKey, stored, bundle.image_url, retry]);
  const value = trace?.key === sourceKey ? trace.value : null;
  if (!stored && !value)
    return (
      <div
        className={
          "grid place-content-center gap-3 text-center " +
          (compact ? "min-h-32 p-3 text-sm" : "min-h-[50vh] p-8")
        }
        role="status"
      >
        <h3 className={(compact ? "text-base" : "text-3xl") + " font-black"}>
          {failure?.key === sourceKey
            ? "Stack outline unavailable"
            : "Drawing the stack outline…"}
        </h3>
        {failure?.key === sourceKey && (
          <>
            <p className="text-lg text-steel">{failure.message}</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setRetry((v) => v + 1)}
                className="touch-target rounded border border-orange-500 px-4"
              >
                Retry
              </button>
              <Link
                className="touch-target inline-flex items-center underline"
                href="/yard/setup"
              >
                Edit layout
              </Link>
            </div>
          </>
        )}
      </div>
    );
  const resolved = stored
    ? bundle
    : {
        ...bundle,
        bundle_panels: ordered.map((member, i) => ({
          ...member,
          outline: validOutline(member.outline)
            ? member.outline
            : value!.outlines[i],
        })),
      };
  const scene = outlineScene(resolved, stored ? storedAspect : value!.aspect);
  return (
    <svg
      role="img"
      aria-label={"Stacking outline for " + bundle.bundle_id}
      className={"h-full w-full " + (compact ? "min-h-32" : "min-h-[45vh]")}
      viewBox={scene.viewBox}
      preserveAspectRatio="xMidYMid meet"
    >
      <title>{bundle.bundle_id + " wall stacking layout"}</title>
      {scene.walls.map(({ member, points, left, right, top, bottom }) => {
        const wall = member.wall_panels!,
          done = wall.status === "complete",
          current = wall.id === currentWallId;
        const font = Math.min(
          (bottom - top) * 0.55,
          (right - left) / Math.max(3, wall.wall_id.length * 0.7),
        );
        return (
          <g
            key={member.id}
            data-wall-id={wall.wall_id}
            data-complete={done ? "true" : "false"}
          >
            <polygon
              points={points.map((p) => p.x + "," + p.y).join(" ")}
              fill={done ? "#f97316" : "#090807"}
              stroke="#f97316"
              strokeWidth={current ? 5 : 3}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
            <text
              x={(left + right) / 2}
              y={(top + bottom) / 2}
              dominantBaseline="central"
              textAnchor="middle"
              fill={done ? "#090807" : "#fff5e8"}
              fontSize={font}
              fontWeight="bold"
              fontFamily="Arial, sans-serif"
            >
              {wall.wall_id}
            </text>
            <title>
              {wall.wall_id +
                " — " +
                (done
                  ? "Production complete"
                  : current
                    ? "Current wall"
                    : "Awaiting production")}
            </title>
          </g>
        );
      })}
    </svg>
  );
}

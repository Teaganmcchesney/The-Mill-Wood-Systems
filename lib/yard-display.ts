import { validOutline, type Point } from "./package-parser";
export type BundleMember = {
  id: string;
  outline: Point[];
  verified_at: string | null;
  wall_panels: {
    id: string;
    wall_id: string;
    status: string;
    lineal_feet: number;
    production_line_id: string;
    sort_order: number;
    updated_at?: string;
    pdf_pages?: { page_number: number } | null;
  } | null;
};
export type BundleDrawing = {
  id: string;
  project_id: string;
  projects: { code: string; name: string } | null;
  level: string;
  bundle_id: string;
  image_url: string;
  production_pdf_url: string;
  bundle_pdf_url: string;
  expected_count: number;
  stacked_at: string | null;
  production_order?: number | string;
  bundle_panels: BundleMember[];
};
export type QueueHead = {
  id: string;
  wall_id: string;
  project_id: string;
  level: string;
  production_line_id: string;
  sort_order: number;
  status: string;
};
export function productionComplete(b: BundleDrawing) {
  return (
    b.expected_count > 0 &&
    b.bundle_panels.length === b.expected_count &&
    b.bundle_panels.every((p) => p.wall_panels?.status === "complete")
  );
}
export function hasStoredLayout(b: BundleDrawing) {
  return (
    b.expected_count > 0 &&
    b.bundle_panels.length === b.expected_count &&
    b.bundle_panels.every((p) => p.wall_panels && validOutline(p.outline))
  );
}
export function activeBundle(bundles: BundleDrawing[], head: QueueHead | null) {
  return head
    ? (bundles.find(
        (b) =>
          !productionComplete(b) &&
          b.bundle_panels.some((p) => p.wall_panels?.id === head.id),
      ) ?? null)
    : null;
}
export function orderedCompleted(bundles: BundleDrawing[]) {
  return bundles.filter(productionComplete).sort(
    (a, b) =>
      a.bundle_id.localeCompare(b.bundle_id, undefined, {
        numeric: true,
        sensitivity: "base",
      }) ||
      (a.projects?.code ?? "").localeCompare(
        b.projects?.code ?? "",
        undefined,
        { numeric: true },
      ) ||
      a.level.localeCompare(b.level, undefined, { numeric: true }) ||
      a.id.localeCompare(b.id),
  );
}
export function outlineScene(bundle: BundleDrawing, aspect: number) {
  const ratio = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const walls = bundle.bundle_panels.map((member) => {
    const points = member.outline.map((p) => ({
      x: p.x * 1000 * ratio,
      y: p.y * 1000,
    }));
    const xs = points.map((p) => p.x),
      ys = points.map((p) => p.y);
    return {
      member,
      points,
      left: Math.min(...xs),
      right: Math.max(...xs),
      top: Math.min(...ys),
      bottom: Math.max(...ys),
    };
  });
  const left = Math.min(...walls.map((w) => w.left)),
    right = Math.max(...walls.map((w) => w.right));
  const top = Math.min(...walls.map((w) => w.top)),
    bottom = Math.max(...walls.map((w) => w.bottom));
  const pad = Math.max((right - left) * 0.035, 8);
  return {
    walls,
    viewBox: [
      left - pad,
      top - pad,
      right - left + pad * 2,
      bottom - top + pad * 2,
    ].join(" "),
  };
}

export function orderedLayoutMembers(b: BundleDrawing) {
  return b.bundle_panels
    .slice()
    .sort(
      (a, b) =>
        (a.wall_panels?.pdf_pages?.page_number ??
          a.wall_panels?.sort_order ??
          Infinity) -
          (b.wall_panels?.pdf_pages?.page_number ??
            b.wall_panels?.sort_order ??
            Infinity) || a.id.localeCompare(b.id),
    );
}

export function orderedUpcoming(bundles: BundleDrawing[]) {
  return bundles
    .filter((b) => !productionComplete(b))
    .sort((a, b) => {
      const rank = (bundle: BundleDrawing) =>
        Number(
          bundle.production_order ??
            Math.min(
              ...bundle.bundle_panels.map(
                (p) => p.wall_panels?.sort_order ?? Infinity,
              ),
            ) * 100000,
        );
      return rank(a) - rank(b) || a.id.localeCompare(b.id);
    });
}

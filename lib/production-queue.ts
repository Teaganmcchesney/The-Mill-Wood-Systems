// One persisted bundle priority feeds both Yard and every Shop line.
type Joined<T> = T | T[] | null | undefined;
export type QueueBundle = {
  id: string;
  bundle_id: string;
  production_order: number | string;
};
export type ProductionQueueWall = {
  id: string;
  sort_order: number;
  pdf_pages?: Joined<{ page_number: number }>;
  bundle_panels?: Joined<{ bundles: Joined<QueueBundle> }>;
};
function first<T>(value: Joined<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}
export function wallBundle(wall: ProductionQueueWall) {
  return first(first(wall.bundle_panels)?.bundles);
}
export function sortProductionWalls<T extends ProductionQueueWall>(
  walls: T[],
): T[] {
  return walls.slice().sort((a, b) => {
    const ab = wallBundle(a),
      bb = wallBundle(b);
    const ap = ab ? Number(ab.production_order) : a.sort_order * 100000;
    const bp = bb ? Number(bb.production_order) : b.sort_order * 100000;
    if (ap !== bp) return ap - bp;
    const au = ab?.id ?? a.id,
      bu = bb?.id ?? b.id;
    if (au !== bu) return au.localeCompare(bu);
    // Original drawing pages are immutable; queue changes must never reverse the stack.
    return (
      (first(a.pdf_pages)?.page_number ?? a.sort_order) -
        (first(b.pdf_pages)?.page_number ?? b.sort_order) ||
      a.id.localeCompare(b.id)
    );
  });
}

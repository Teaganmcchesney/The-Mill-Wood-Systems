export type Panel = {
  wallId: string;
  bundleId: string;
  feet: number;
  page: number;
  pages: number[];
  sheathed: boolean;
  blocked: boolean;
};
export function imperialFeet(value: string): number | null {
  const s = value.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').trim();
  if (!/['"]/.test(s)) return null;
  const m = s.match(
    /^(?:(\d+)\s*'\s*)?(?:(\d+(?:\.\d+)?)(?:[-\s]+(\d+)\/(\d+))?|(?:(\d+)\/(\d+)))?\s*"?$/,
  );
  if (!m || !m.slice(1).some(Boolean)) return null;
  if ((m[4] && +m[4] === 0) || (m[6] && +m[6] === 0)) return null;
  return (
    +(m[1] || 0) +
    (+(m[2] || 0) + (m[3] ? +m[3] / +m[4] : 0) + (m[5] ? +m[5] / +m[6] : 0)) /
      12
  );
}
export function bundleId(text: string) {
  return text.match(/\bB\d+-\d+-[A-Z0-9]+\b/i)?.[0].toUpperCase() ?? null;
}
export function parseProduction(texts: string[]): Panel[] {
  const panels: Panel[] = [];
  const seen = new Set<string>();
  texts.forEach((raw, i) => {
    const text = raw.replace(/\s+/g, " ");
    const m = text.match(
      /Panel\s*#\s*([A-Z0-9_.-]+)\s+Length:\s*(.*?)\s+Height:/i,
    );
    const bid = bundleId(text);
    if (m) {
      const feet = imperialFeet(m[2]);
      const wallId = m[1].toUpperCase();
      if (!bid || feet === null || feet <= 0)
        throw new Error(`Check bundle and length on production page ${i + 1}.`);
      if (seen.has(wallId))
        throw new Error(`Duplicate wall ${wallId}; resolve before importing.`);
      seen.add(wallId);
      panels.push({
        wallId,
        bundleId: bid,
        feet,
        page: i + 1,
        pages: [],
        sheathed: false,
        blocked: false,
      });
    }
    const p = panels.at(-1);
    if (p && bid === p.bundleId) {
      p.pages.push(i + 1);
      p.sheathed ||= /Exterior\s+Sheathing:\s*(?:Start|End)/i.test(text);
      p.blocked ||=
        /Blocking\s*&\s*Letin/i.test(text) &&
        /(?:Inline At|Pieces:)/i.test(text);
    } else if (
      !m &&
      /(?:Components & Subcomponents|Exterior Sheathing:)/i.test(text)
    ) {
      throw new Error(`Unassigned continuation page ${i + 1}.`);
    }
  });
  if (!panels.length) throw new Error("No production wall headers found.");
  return panels;
}
export function parseBundles(texts: string[], panels: Panel[]) {
  const seen = new Set<string>();
  const result = texts.map((raw, i) => {
    const text = raw.replace(/\s+/g, " ");
    const id = bundleId(text);
    const totalText = text.match(/Total:\s*(\d+\s*'[^"\n]*")/i)?.[1];
    const feet = totalText ? imperialFeet(totalText) : null;
    const counts = Array.from(
      text.matchAll(/(?:Unsheathed|Sheathed)\s*\((\d+)\)/gi),
    );
    const count = counts.reduce((s, m) => s + +m[1], 0);
    if (!id || feet === null || !counts.length || seen.has(id))
      throw new Error(
        `Check bundle report page ${i + 1}: ID, count or total is missing/duplicated.`,
      );
    seen.add(id);
    const members = panels.filter((p) => p.bundleId === id);
    const sum = members.reduce((s, p) => s + p.feet, 0);
    if (
      members.length !== count ||
      Math.abs(sum - feet) > count / 192 + 0.000001
    )
      throw new Error(
        `${id}: report has ${count} walls / ${feet.toFixed(4)} LF; production has ${members.length} / ${sum.toFixed(4)} LF. Resolve before importing.`,
      );
    return { id, page: i + 1, feet, count, members, difference: sum - feet };
  });
  if (panels.some((p) => !seen.has(p.bundleId)))
    throw new Error(
      "Some production bundles are missing from the bundle report.",
    );
  return result;
}
export type Point = { x: number; y: number };
export function validOutline(points: Point[]) {
  if (
    points.length < 3 ||
    points.some(
      (p) =>
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        p.x < 0 ||
        p.x > 1 ||
        p.y < 0 ||
        p.y > 1,
    )
  )
    return false;
  return (
    Math.abs(
      points.reduce((s, p, i) => {
        const q = points[(i + 1) % points.length];
        return s + p.x * q.y - q.x * p.y;
      }, 0),
    ) > 0.00001
  );
}

// Prevent a Level 6 package from being imported under the Admin page's default L1.
export function validatePackageLevels(
  production: string[],
  bundles: string[],
  selected: string,
) {
  const levels = (texts: string[]) =>
    Array.from(
      new Set(
        texts.map((t) => t.match(/\bLEVEL\s+(\d+)\b/i)?.[1]).filter(Boolean),
      ),
    );
  const a = levels(production),
    b = levels(bundles);
  if (a.length > 1 || b.length > 1)
    throw Error("Split multi-level reports into one package per level.");
  if (a[0] && b[0] && a[0] !== b[0])
    throw Error("The production and bundle reports are for different levels.");
  const detected = a[0] ?? b[0];
  if (detected && selected.toUpperCase() !== "L" + detected)
    throw Error(
      "These drawings are Level " +
        detected +
        ". Select L" +
        detected +
        " before importing.",
    );
}

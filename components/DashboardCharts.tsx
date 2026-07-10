"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { ProductionLine, ShiftManpower } from "@/lib/types";

const WALL_TYPES = ["Interior", "Blocked Interior", "Sheathed", "Blocked Sheathed"];
const WALL_TYPE_COLORS: Record<string, string> = {
  Interior: "#111827",
  "Blocked Interior": "#f2c94c",
  Sheathed: "#2f855a",
  "Blocked Sheathed": "#c05621"
};
const FILTERS = ["Today", "This Week", "This Month"] as const;

type DateFilter = (typeof FILTERS)[number];
type JoinedLine = { name: string } | { name: string }[] | null;
type JoinedProject = { name: string; code: string } | { name: string; code: string }[] | null;
type JoinedWallPanel = { projects: JoinedProject } | { projects: JoinedProject }[] | null;

type Completion = {
  wall_type: string;
  lineal_feet: number;
  production_line_id: string;
  completed_at: string;
  production_lines: JoinedLine;
  wall_panels: JoinedWallPanel;
};

type WallSummary = {
  wall_type: string;
  lineal_feet: number;
  status: string;
  production_lines: JoinedLine;
  projects: JoinedProject;
};

export function DashboardCharts({
  completions,
  walls,
  lines,
  shiftManpower
}: {
  completions: Completion[];
  walls: WallSummary[];
  lines: ProductionLine[];
  shiftManpower: ShiftManpower[];
}) {
  const [dateFilter, setDateFilter] = useState<DateFilter>("This Week");
  const [projectFilter, setProjectFilter] = useState("all");
  const dateRange = useMemo(() => getDateRange(dateFilter), [dateFilter]);
  const filteredCompletions = useMemo(
    () => completions.filter((item) => {
      const inDateRange = withinRange(new Date(item.completed_at), dateRange.start, dateRange.end);
      const inProject = projectFilter === "all" || projectName(completionProject(item.wall_panels)).key === projectFilter;
      return inDateRange && inProject;
    }),
    [completions, dateRange, projectFilter]
  );
  const projectOptions = useMemo(() => summarizeProjects(walls), [walls]);
  const filteredWalls = useMemo(
    () => walls.filter((wall) => projectFilter === "all" || projectName(wall.projects).key === projectFilter),
    [walls, projectFilter]
  );

  const today = new Date().toDateString();
  const todayFeet = completions
    .filter((item) => {
      const isToday = new Date(item.completed_at).toDateString() === today;
      const inProject = projectFilter === "all" || projectName(completionProject(item.wall_panels)).key === projectFilter;
      return isToday && inProject;
    })
    .reduce((sum, item) => sum + Number(item.lineal_feet), 0);
  const rangeFeet = filteredCompletions.reduce((sum, item) => sum + Number(item.lineal_feet), 0);
  const remainingFeet = filteredWalls.filter((wall) => wall.status !== "complete").reduce((sum, wall) => sum + Number(wall.lineal_feet), 0);
  const byType = allWallTypeTotals(filteredCompletions);
  const byLine = groupBy(filteredCompletions, (item) => lineName(item.production_lines));
  const remainingByLine = groupBy(
    filteredWalls.filter((wall) => wall.status !== "complete"),
    (item) => lineName(item.production_lines)
  );
  const projectSummaries = summarizeProjects(filteredWalls);
  const laborRateMap = new Map<string, number>(
    laborRateByWallType(filteredCompletions, shiftManpower, lines).map((item): [string, number] => [item.name, item.rate])
  );
  const wallTypeStatus = allWallTypeStatus(filteredWalls);
  const wallTypeKpis = wallTypeStatus.map((item) => ({ ...item, laborRate: laborRateMap.get(item.name) ?? 0 }));
  const laborTrend = laborTrendByDate(filteredCompletions, shiftManpower, lines, dateRange);

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-lg font-bold text-steel">Production dashboard</p>
        <h1 className="text-4xl font-black text-ink">Lineal feet completed and remaining</h1>
      </div>

      <section className="grid gap-4 rounded-md bg-white p-5 shadow-touch">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h2 className="text-2xl font-black text-ink">Dashboard filters</h2>
            <p className="text-base font-bold text-steel">Date and project filters change production KPIs, trends, wall totals, and remaining work.</p>
          </div>
          <label className="grid gap-2 text-lg font-bold text-ink">
            Project
            <select
              className="touch-target rounded-md border border-slate-300 px-4 text-lg font-bold"
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
            >
              <option value="all">All projects</option>
              {projectOptions.map((project) => (
                <option key={project.key} value={project.key}>{project.code} - {project.name}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setDateFilter(filter)}
              className={`touch-target rounded-md px-4 py-4 text-lg font-black ${dateFilter === filter ? "bg-ink text-white" : "bg-slate-100 text-ink"}`}
            >
              {filter}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Kpi label="Completed today" value={`${todayFeet.toFixed(1)} LF`} tone="bg-pass text-white" />
        <Kpi label={`Completed ${dateFilter.toLowerCase()}`} value={`${rangeFeet.toFixed(1)} LF`} tone="bg-ink text-white" />
        <Kpi label="Remaining" value={`${remainingFeet.toFixed(1)} LF`} tone="bg-shop text-ink" />
      </section>

      <section className="grid gap-4 rounded-md bg-white p-5 shadow-touch">
        <h2 className="text-2xl font-black text-ink">Wall type production KPIs</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {wallTypeKpis.map((item) => (
            <div key={item.name} className="rounded-md bg-slate-100 p-4">
              <p className="text-2xl font-black text-ink">{item.name}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <SmallMetric label="LF/man-hour" value={item.laborRate > 0 ? item.laborRate.toFixed(2) : "0.00"} tone="bg-ink text-white" />
                <SmallMetric label="Done" value={`${item.completedFeet.toFixed(1)} LF`} />
                <SmallMetric label="Left" value={`${item.remainingFeet.toFixed(1)} LF`} />
                <SmallMetric label="Walls" value={`${item.completedWalls}/${item.totalWalls}`} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <TrendPanel data={laborTrend} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projectSummaries.map((project) => (
          <ProjectBox key={project.key} project={project} />
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <ChartPanel title="Completed by wall type" data={byType} dataKey="linealFeet" label="Lineal feet" fill="#2f855a" />
        <ChartPanel title="Completed by production line" data={byLine} dataKey="linealFeet" label="Lineal feet" fill="#2f855a" />
        <ChartPanel title="Remaining by production line" data={remainingByLine} dataKey="linealFeet" label="Lineal feet" fill="#f2c94c" />
      </section>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-md p-6 shadow-touch ${tone}`}>
      <p className="text-lg font-black opacity-80">{label}</p>
      <p className="mt-2 text-5xl font-black">{value}</p>
    </div>
  );
}

function ProjectBox({ project }: { project: ProjectSummary }) {
  const percent = project.totalFeet > 0 ? Math.round((project.completedFeet / project.totalFeet) * 100) : 0;

  return (
    <section className="rounded-md bg-white p-5 shadow-touch">
      <p className="text-lg font-bold text-steel">{project.code}</p>
      <h2 className="text-3xl font-black text-ink">{project.name}</h2>
      <div className="mt-4 h-4 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-pass" style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <SmallMetric label="Done" value={`${project.completedFeet.toFixed(1)} LF`} />
        <SmallMetric label="Left" value={`${project.remainingFeet.toFixed(1)} LF`} />
        <SmallMetric label="Walls" value={`${project.completedWalls}/${project.totalWalls}`} />
      </div>
    </section>
  );
}

function SmallMetric({ label, value, tone = "bg-white text-ink" }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`rounded-md p-3 ${tone}`}>
      <p className="text-xs font-bold uppercase opacity-70">{label}</p>
      <p className="text-xl font-black">{value}</p>
    </div>
  );
}

function TrendPanel({ data }: { data: TrendPoint[] }) {
  return (
    <section className="rounded-md bg-white p-5 shadow-touch">
      <h2 className="text-2xl font-black text-ink">LF per man-hour trend</h2>
      <div className="mt-4 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 14, fontWeight: 700 }} />
            <YAxis tick={{ fontSize: 14, fontWeight: 700 }} />
            <Tooltip />
            <Legend />
            {WALL_TYPES.map((wallType) => (
              <Line
                key={wallType}
                type="monotone"
                dataKey={wallType}
                name={wallType}
                stroke={WALL_TYPE_COLORS[wallType]}
                strokeWidth={3}
                dot={{ r: 4 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function ChartPanel({
  title,
  data,
  dataKey,
  label,
  fill
}: {
  title: string;
  data: { name: string; [key: string]: string | number }[];
  dataKey: string;
  label: string;
  fill: string;
}) {
  return (
    <section className="rounded-md bg-white p-5 shadow-touch">
      <h2 className="text-2xl font-black text-ink">{title}</h2>
      <div className="mt-4 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 14, fontWeight: 700 }} />
            <YAxis tick={{ fontSize: 14, fontWeight: 700 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey={dataKey} name={label} fill={fill} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

type ProjectSummary = {
  key: string;
  code: string;
  name: string;
  totalFeet: number;
  completedFeet: number;
  remainingFeet: number;
  totalWalls: number;
  completedWalls: number;
};

type WallTypeStatus = {
  name: string;
  completedFeet: number;
  remainingFeet: number;
  completedWalls: number;
  totalWalls: number;
};

type TrendPoint = {
  date: string;
  [key: string]: string | number;
};

function summarizeProjects(walls: WallSummary[]) {
  const map = new Map<string, ProjectSummary>();

  walls.forEach((wall) => {
    const project = projectName(wall.projects);
    const current = map.get(project.key) ?? {
      key: project.key,
      code: project.code,
      name: project.name,
      totalFeet: 0,
      completedFeet: 0,
      remainingFeet: 0,
      totalWalls: 0,
      completedWalls: 0
    };

    const feet = Number(wall.lineal_feet);
    current.totalFeet += feet;
    current.totalWalls += 1;
    if (wall.status === "complete") {
      current.completedFeet += feet;
      current.completedWalls += 1;
    } else {
      current.remainingFeet += feet;
    }
    map.set(project.key, current);
  });

  return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
}

function laborRateByWallType(completions: Completion[], shiftManpower: ShiftManpower[], lines: ProductionLine[]) {
  const map = new Map<string, { feet: number; keys: Set<string> }>();
  WALL_TYPES.forEach((wallType) => map.set(wallType, { feet: 0, keys: new Set<string>() }));

  completions.forEach((completion) => {
    const current = map.get(completion.wall_type) ?? { feet: 0, keys: new Set<string>() };
    current.feet += Number(completion.lineal_feet);
    current.keys.add(`${completion.production_line_id}|${completionDate(completion.completed_at)}`);
    map.set(completion.wall_type, current);
  });

  return Array.from(map, ([name, item]) => ({ name, rate: laborRateFor(item.feet, item.keys, shiftManpower, lines) }));
}

function laborTrendByDate(completions: Completion[], shiftManpower: ShiftManpower[], lines: ProductionLine[], range: DateRange) {
  const map = new Map<string, Map<string, { feet: number; keys: Set<string> }>>();
  completions
    .filter((completion) => withinRange(new Date(completion.completed_at), range.start, range.end))
    .forEach((completion) => {
      const date = completionDate(completion.completed_at);
      const dayMap = map.get(date) ?? new Map<string, { feet: number; keys: Set<string> }>();
      const wallType = completion.wall_type;
      const current = dayMap.get(wallType) ?? { feet: 0, keys: new Set<string>() };
      current.feet += Number(completion.lineal_feet);
      current.keys.add(`${completion.production_line_id}|${date}`);
      dayMap.set(wallType, current);
      map.set(date, dayMap);
    });

  return Array.from(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayMap]) => {
      const point: TrendPoint = { date: shortDate(date) };
      WALL_TYPES.forEach((wallType) => {
        const item = dayMap.get(wallType);
        point[wallType] = item ? laborRateFor(item.feet, item.keys, shiftManpower, lines) : 0;
      });
      return point;
    });
}

function laborRateFor(feet: number, keys: Set<string>, shiftManpower: ShiftManpower[], lines: ProductionLine[]) {
  let manHours = 0;
  keys.forEach((key) => {
    const [lineId, date] = key.split("|");
    const shifts = shiftManpower.filter((shift) => shift.production_line_id === lineId && shift.shift_date === date);
    if (shifts.length) {
      manHours += shifts.reduce((sum, shift) => sum + Number(shift.crew_count) * Number(shift.shift_hours), 0);
    } else {
      const line = lines.find((value) => value.id === lineId);
      manHours += Number(line?.crew_count ?? 0) * 8;
    }
  });
  return manHours > 0 ? Math.round((feet / manHours) * 100) / 100 : 0;
}

function allWallTypeStatus(walls: WallSummary[]) {
  const map = new Map<string, WallTypeStatus>();
  WALL_TYPES.forEach((wallType) => {
    map.set(wallType, { name: wallType, completedFeet: 0, remainingFeet: 0, completedWalls: 0, totalWalls: 0 });
  });

  walls.forEach((wall) => {
    const current = map.get(wall.wall_type) ?? {
      name: wall.wall_type,
      completedFeet: 0,
      remainingFeet: 0,
      completedWalls: 0,
      totalWalls: 0
    };
    current.totalWalls += 1;
    if (wall.status === "complete") {
      current.completedFeet += Number(wall.lineal_feet);
      current.completedWalls += 1;
    } else {
      current.remainingFeet += Number(wall.lineal_feet);
    }
    map.set(wall.wall_type, current);
  });

  return Array.from(map.values());
}

function allWallTypeTotals(completions: Completion[]) {
  const map = new Map<string, number>();
  WALL_TYPES.forEach((wallType) => map.set(wallType, 0));
  completions.forEach((completion) => {
    map.set(completion.wall_type, (map.get(completion.wall_type) ?? 0) + Number(completion.lineal_feet));
  });
  return Array.from(map, ([name, linealFeet]) => ({ name, linealFeet }));
}

function groupBy<T>(items: T[], getName: (item: T) => string) {
  const map = new Map<string, number>();
  items.forEach((item) => {
    const key = getName(item);
    map.set(key, (map.get(key) ?? 0) + Number((item as { lineal_feet: number }).lineal_feet));
  });
  return Array.from(map, ([name, linealFeet]) => ({ name, linealFeet }));
}

type DateRange = { start: Date; end: Date };

function getDateRange(filter: DateFilter): DateRange {
  const start = new Date();
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  if (filter === "Today") {
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  if (filter === "This Week") {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function withinRange(date: Date, start: Date, end: Date) {
  return date >= start && date <= end;
}

function completionDate(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function shortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${month}/${day}`;
}

function lineName(line: JoinedLine) {
  if (!line) return "Unassigned";
  return Array.isArray(line) ? line[0]?.name ?? "Unassigned" : line.name;
}

function completionProject(wallPanel: JoinedWallPanel) {
  if (!wallPanel) return null;
  const value = Array.isArray(wallPanel) ? wallPanel[0] ?? null : wallPanel;
  return value?.projects ?? null;
}

function projectName(project: JoinedProject) {
  const value = Array.isArray(project) ? project[0] ?? null : project;
  return {
    key: value?.code ?? "unassigned",
    code: value?.code ?? "No project",
    name: value?.name ?? "Unassigned walls"
  };
}

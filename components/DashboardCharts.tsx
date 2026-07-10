"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ProductionLine, ShiftManpower } from "@/lib/types";

const WALL_TYPES = ["Interior", "Blocked Interior", "Sheathed", "Blocked Sheathed"];

type JoinedLine = { name: string } | { name: string }[] | null;
type JoinedProject = { name: string; code: string } | { name: string; code: string }[] | null;

type Completion = {
  wall_type: string;
  lineal_feet: number;
  production_line_id: string;
  completed_at: string;
  production_lines: JoinedLine;
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
  const today = new Date().toDateString();
  const todayFeet = completions
    .filter((item) => new Date(item.completed_at).toDateString() === today)
    .reduce((sum, item) => sum + Number(item.lineal_feet), 0);
  const weekFeet = completions.reduce((sum, item) => sum + Number(item.lineal_feet), 0);
  const remainingFeet = walls.filter((wall) => wall.status !== "complete").reduce((sum, wall) => sum + Number(wall.lineal_feet), 0);
  const byType = allWallTypeTotals(completions);
  const byLine = groupBy(completions, (item) => lineName(item.production_lines));
  const remainingByLine = groupBy(
    walls.filter((wall) => wall.status !== "complete"),
    (item) => lineName(item.production_lines)
  );
  const projectSummaries = summarizeProjects(walls);
  const laborRateMap = new Map(laborRateByWallType(completions, shiftManpower, lines).map((item) => [item.name, item.rate]));
  const wallTypeStatus = allWallTypeStatus(walls);
  const wallTypeKpis = wallTypeStatus.map((item) => ({ ...item, laborRate: laborRateMap.get(item.name) ?? 0 }));

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-lg font-bold text-steel">Production dashboard</p>
        <h1 className="text-4xl font-black text-ink">Lineal feet completed and remaining</h1>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <Kpi label="Completed today" value={`${todayFeet.toFixed(1)} LF`} tone="bg-pass text-white" />
        <Kpi label="Completed this week" value={`${weekFeet.toFixed(1)} LF`} tone="bg-ink text-white" />
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

  return Array.from(map, ([name, item]) => {
    let manHours = 0;
    item.keys.forEach((key) => {
      const [lineId, date] = key.split("|");
      const shifts = shiftManpower.filter((shift) => shift.production_line_id === lineId && shift.shift_date === date);
      if (shifts.length) {
        manHours += shifts.reduce((sum, shift) => sum + Number(shift.crew_count) * Number(shift.shift_hours), 0);
      } else {
        const line = lines.find((value) => value.id === lineId);
        manHours += Number(line?.crew_count ?? 0) * 8;
      }
    });
    return { name, rate: manHours > 0 ? Math.round((item.feet / manHours) * 100) / 100 : 0 };
  });
}

function allWallTypeStatus(walls: WallSummary[]) {
  const map = new Map(
    WALL_TYPES.map((wallType) => [
      wallType,
      { name: wallType, completedFeet: 0, remainingFeet: 0, completedWalls: 0, totalWalls: 0 }
    ])
  );

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
  const map = new Map(WALL_TYPES.map((wallType) => [wallType, 0]));
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

function completionDate(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function lineName(line: JoinedLine) {
  if (!line) return "Unassigned";
  return Array.isArray(line) ? line[0]?.name ?? "Unassigned" : line.name;
}

function projectName(project: JoinedProject) {
  const value = Array.isArray(project) ? project[0] ?? null : project;
  return {
    key: value?.code ?? "unassigned",
    code: value?.code ?? "No project",
    name: value?.name ?? "Unassigned walls"
  };
}

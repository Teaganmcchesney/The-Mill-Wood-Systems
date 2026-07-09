"use client";

import Link from "next/link";
import { CheckCircle2, MoveRight } from "lucide-react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { ProductionLine, Profile } from "@/lib/types";

type QueueWall = {
  id: string;
  wall_id: string;
  wall_type: string;
  level: string;
  area_sqft: number;
  lineal_feet: number;
  production_line_id: string;
  pdf_pages: { page_number: number; image_url: string } | null;
  projects: { name: string; code: string } | null;
};

export function ShopQueue({
  profile,
  lines,
  activeLineId,
  walls
}: {
  profile: Profile;
  lines: ProductionLine[];
  activeLineId: string;
  walls: QueueWall[];
}) {
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-lg font-bold text-steel">Production queue</p>
          <h1 className="text-4xl font-black text-ink">Walls ready for build</h1>
        </div>
        <div className="flex gap-2 overflow-x-auto rounded-md bg-white p-2 shadow-touch">
          {lines.map((line) => (
            <Link
              key={line.id}
              href={`/shop?line=${line.id}`}
              className={`touch-target rounded-md px-5 py-3 text-lg font-black ${
                line.id === activeLineId ? "bg-ink text-white" : "bg-slate-100 text-ink"
              }`}
            >
              {line.name}
            </Link>
          ))}
        </div>
      </div>

      {walls.length === 0 ? (
        <section className="rounded-md bg-white p-10 text-center shadow-touch">
          <h2 className="text-3xl font-black text-ink">No walls waiting on this line</h2>
          <p className="mt-2 text-xl text-steel">Switch lines or check back after admin assigns more work.</p>
        </section>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {walls.map((wall) => (
            <WallCard key={wall.id} wall={wall} profile={profile} />
          ))}
        </div>
      )}
    </div>
  );
}

function WallCard({ wall, profile }: { wall: QueueWall; profile: Profile }) {
  const router = useRouter();
  const x = useMotionValue(0);
  const background = useTransform(x, [0, 180], ["#ffffff", "#dcfce7"]);

  async function completeWall() {
    const supabase = createClient();
    const { error } = await supabase.rpc("complete_wall_panel", {
      p_wall_panel_id: wall.id,
      p_completed_by: profile.id
    });
    if (!error) router.refresh();
  }

  return (
    <motion.article
      drag="x"
      dragConstraints={{ left: 0, right: 220 }}
      style={{ x, background }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 150) completeWall();
      }}
      className="relative overflow-hidden rounded-md border border-slate-200 p-5 shadow-touch"
    >
      <div className="flex gap-5">
        <div className="aspect-[8.5/11] w-40 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
          {wall.pdf_pages?.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={wall.pdf_pages.image_url} alt={`Drawing page ${wall.pdf_pages.page_number}`} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center p-4 text-center font-bold text-steel">No drawing</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-steel">{wall.projects?.code} / {wall.level}</p>
              <h2 className="text-4xl font-black text-ink">{wall.wall_id}</h2>
            </div>
            <span className="rounded-md bg-shop px-4 py-2 text-lg font-black text-ink">{wall.wall_type}</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Metric label="Lineal feet" value={wall.lineal_feet.toFixed(1)} />
            <Metric label="Area" value={`${wall.area_sqft.toFixed(0)} sf`} />
          </div>
          <button onClick={completeWall} className="touch-target mt-5 inline-flex w-full items-center justify-center gap-3 rounded-md bg-pass px-6 py-4 text-2xl font-black text-white">
            <CheckCircle2 size={30} /> Complete
          </button>
          <p className="mt-3 flex items-center gap-2 text-lg font-bold text-steel">
            <MoveRight size={22} /> Swipe right to complete
          </p>
        </div>
      </div>
    </motion.article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-100 p-4">
      <p className="text-sm font-bold uppercase tracking-wide text-steel">{label}</p>
      <p className="text-3xl font-black text-ink">{value}</p>
    </div>
  );
}

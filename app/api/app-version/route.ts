export const dynamic = "force-dynamic";
export const revalidate = 0;
export function GET() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION;
  return Response.json(
    { version: version ?? null },
    {
      status: version ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
        "CDN-Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "no-store",
      },
    },
  );
}

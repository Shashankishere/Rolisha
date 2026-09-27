import { createFileRoute } from "@tanstack/react-router";
import { listCareers } from "@/lib/catalog.functions";

const SITE_URL = "https://rolisha.in";

const STATIC_URLS = [
  "/",
  "/about",
  "/features",
  "/how-it-works",
  "/pricing",
  "/careers",
  "/contact",
  "/privacy",
  "/terms",
];

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const careers = await listCareers();

        const urls = [...STATIC_URLS, ...careers.map((career) => `/careers/${career.slug}`)];

        const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (path) => `  <url>
    <loc>${escapeXml(`${SITE_URL}${path}`)}</loc>
  </url>`,
  )
  .join("\n")}
</urlset>`;

        return new Response(body, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
          },
        });
      },
    },
  },
});

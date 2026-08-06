// ════════════════════════════════════════════════════════════════
//  api/sitemap-villes.js — Vercel Edge Function  [sitemap-villes-v1]
//  Génère /sitemap-villes.xml : une entrée par commune couverte.
// ════════════════════════════════════════════════════════════════
export const config = { runtime: 'edge' };

const SUPABASE_URL  = 'https://kukathominhssogthplc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a2F0aG9taW5oc3NvZ3RocGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTU2NDMsImV4cCI6MjA5MDQzMTY0M30.nrfnhLWA_N-d5EA0qMvSTgSvbebbqHvWuCwk4PQDxcg';
const SITE_URL      = 'https://lokalist.fr';

const slugify = (s) => String(s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const sbHeaders = { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` };
async function sb(q) {
  try { const r = await fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: sbHeaders }); return r.ok ? await r.json() : []; }
  catch (e) { return []; }
}

async function listSlugs() {
  const [c, a, co, ag, m] = await Promise.all([
    sb('commercants?select=ville&statut=eq.actif'),
    sb('artisans?select=ville&statut=eq.actif&suspendu_plainte=eq.false'),
    sb('courtiers_immo?select=ville&actif=eq.true'),
    sb('agences_immo?select=communes&actif=eq.true'),
    sb('mairies_partenaires?select=ville&statut=eq.actif'),
  ]);
  const set = new Set();
  const add = (v) => { const sl = slugify(v); if (sl) set.add(sl); };
  c.forEach((x) => add(x.ville));
  a.forEach((x) => add(x.ville));
  co.forEach((x) => add(x.ville));
  ag.forEach((x) => (x.communes || []).forEach(add));
  m.forEach((x) => add(x.ville));
  return [...set].sort();
}

export default async function handler() {
  try {
    const slugs = await listSlugs();
    const now = new Date().toISOString().slice(0, 10);
    const urls = slugs.map((s) =>
      `<url><loc>${SITE_URL}/villes/${s}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`
    ).join('');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${SITE_URL}/villes</loc><changefreq>daily</changefreq><priority>0.8</priority></url>
${urls}
</urlset>`;
    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (e) {
    return new Response('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>', {
      status: 200, headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    });
  }
}

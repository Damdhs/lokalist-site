// ----------------------------------------------------------------------------
//  api/sitemap-commercants.js — Vercel Edge Function  [sitemap-commercants-v1]
//  Genere /sitemap-commercants.xml : une entree par couple (categorie, ville)
//  ou il existe AU MOINS un commercant actif. Jamais de page vide.
//  Miroir de api/sitemap-artisans.js. Difference : la categorie commercant est
//  un TEXTE LIBRE (champ `categorie`), pas une table de reference -> on slugifie
//  directement ce champ (meme regle que api/commercant-ville.js).
// ----------------------------------------------------------------------------
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

export default async function handler() {
  try {
    // commercants actifs avec categorie + ville
    const commercants = await sb('commercants?select=categorie,ville&statut=eq.actif&demo=is.false');

    // couples uniques (categorieSlug, villeSlug) reellement peuples
    const couples = new Set();
    (commercants || []).forEach((c) => {
      const cSlug = slugify(c.categorie);   // vide si categorie absente
      const vSlug = slugify(c.ville);
      if (cSlug && vSlug) couples.add(cSlug + '/' + vSlug);
    });

    const now = new Date().toISOString().slice(0, 10);
    const urls = [...couples].sort().map((c) =>
      `<url><loc>${SITE_URL}/commercants/${c}</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`
    ).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
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

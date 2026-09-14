// ----------------------------------------------------------------------------
//  api/sitemap-artisans.js — Vercel Edge Function  [sitemap-artisans-v1]
//  Génère /sitemap-artisans.xml : une entrée par couple (métier, ville)
//  où il existe AU MOINS un artisan actif. Jamais de page vide.
// ----------------------------------------------------------------------------
export const config = { runtime: 'edge' };

const SUPABASE_URL  = 'https://kukathominhssogthplc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a2F0aG9taW5oc3NvZ3RocGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTU2NDMsImV4cCI6MjA5MDQzMTY0M30.nrfnhLWA_N-d5EA0qMvSTgSvbebbqHvWuCwk4PQDxcg';
const SITE_URL      = 'https://lokalist.fr';

// Mêmes métiers "devis" autorisés que api/artisan-ville.js (garder les 2 listes synchro).
const METIERS_AUTORISES = new Set([
  'f637448d-df18-4bfd-a1db-bb25ae18c1aa', // Plomberie
  'd45fee36-8095-43db-89fa-a72c4a7c0b48', // Electricite
  '45e0e67d-596b-418e-85d5-48ec4ebadefc', // Chauffage / Granule & Bois
  'ca352294-e14c-473d-8886-6fcc909a5bea', // Maconnerie
  'd3d10f6d-f122-42bd-9ee2-b93240ea02e0', // Carrelage
  '56210468-4e6c-4f0e-b732-702e2d6f2137', // Menuiserie
  '7ae896d3-b511-4f6c-8686-96203866e0d0', // Peinture
  'daeafa6a-92f4-4624-a2d9-4265ae4f1935', // Serrurerie
  '2fe7d86a-68f6-4f66-be7e-8d37c72850a6', // Jardinage / Paysagiste
  '715963ce-98ec-4740-8af8-7d45aead9e0d', // Multi-services / Bricolage
  'd87cb6cf-7e88-463d-972d-4dac858a7638', // Nettoyage & proprete
  'd6fd74b4-0720-4adc-9236-e9a331993933', // Informatique & telecom
  'e2d3a975-1553-4edb-af8a-13e23d17c197', // Transport & logistique
  '32e706b9-3731-4110-aaf4-b41b20199ebf', // Fournitures & equipement
  '13076082-7429-4d30-8d70-165b979afcda', // Securite & gardiennage
  '546809ac-f69a-455c-a98c-5e0e5e5f8248', // Voirie & espaces publics
  'b6ed378e-6c9a-41a8-b40e-28f8204e1bb5', // Services
  '49f1c029-2e9f-4491-9d79-4839fa19b6a5', // Autres
]);

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
    // 1) métiers autorisés -> map id -> slug (à partir de leur nom)
    const cats = await sb('categories_artisans?select=id,nom');
    const metierSlug = {};
    (cats || []).forEach((c) => { if (METIERS_AUTORISES.has(c.id)) metierSlug[c.id] = slugify(c.nom); });

    // 2) artisans actifs avec métier + ville
    const artisans = await sb('artisans?select=categorie_id,ville&statut=eq.actif&suspendu_plainte=eq.false&demo=is.false');

    // 3) couples uniques (metierSlug, villeSlug) réellement peuplés
    const couples = new Set();
    (artisans || []).forEach((a) => {
      const mSlug = metierSlug[a.categorie_id];      // null si métier non autorisé
      const vSlug = slugify(a.ville);
      if (mSlug && vSlug) couples.add(mSlug + '/' + vSlug);
    });

    const now = new Date().toISOString().slice(0, 10);
    const urls = [...couples].sort().map((c) =>
      `<url><loc>${SITE_URL}/artisans/${c}</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`
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

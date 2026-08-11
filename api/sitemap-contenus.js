// ════════════════════════════════════════════════════════════════
//  api/sitemap-contenus.js — Vercel Edge Function  [sitemap-contenus-v1]
//  Génère /sitemap-contenus.xml : une entrée par contenu indexable
//  (événements, actus, offres, sorties + fiches pros ACTIVES/PUBLIÉES).
//  Ne liste que ce qui renvoie 200 index,follow (jamais de 404).
// ════════════════════════════════════════════════════════════════
export const config = { runtime: 'edge' };

const SUPABASE_URL  = 'https://kukathominhssogthplc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a2F0aG9taW5oc3NvZ3RocGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTU2NDMsImV4cCI6MjA5MDQzMTY0M30.nrfnhLWA_N-d5EA0qMvSTgSvbebbqHvWuCwk4PQDxcg';
const SITE_URL      = 'https://lokalist.fr';

const sbHeaders = { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` };
async function sb(q) {
  try { const r = await fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: sbHeaders }); return r.ok ? await r.json() : []; }
  catch (e) { return []; }
}

// Date au format AAAA-MM-JJ, ou null si invalide
const D10 = (iso) => { if (!iso) return null; const d = new Date(iso); return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10); };

export default async function handler() {
  try {
    const now   = new Date().toISOString().slice(0, 10);
    const nowMs = Date.now();

    const [evs, actus, offres, packs, comm, arti, agences, courtiers] = await Promise.all([
      sb('evenements_mairie?select=id,date_debut,statut'),
      sb('actus_mairie?select=id,created_at&statut=eq.publie'),
      sb('offres?select=id,date_debut,expire_at&statut=eq.active'),
      sb('packs_loisir?select=id&actif=eq.true'),
      sb('commercants?select=id&statut=eq.actif'),
      sb('artisans?select=id&statut=eq.actif&suspendu_plainte=eq.false'),
      sb('agences_immo?select=id&actif=eq.true'),
      sb('courtiers_immo?select=id&actif=eq.true'),
    ]);

    const U = (loc, lastmod, cf, pr) =>
      `<url><loc>${SITE_URL}${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}<changefreq>${cf}</changefreq><priority>${pr}</priority></url>`;

    const parts = [];

    // Événements mairie (page canonique /mairie/:id) — hors annulés
    (evs || []).forEach((e) => { if (e.statut !== 'annule') parts.push(U(`/mairie/${e.id}`, D10(e.date_debut) || now, 'weekly', '0.6')); });
    // Actualités publiées
    (actus || []).forEach((a) => parts.push(U(`/actu/${a.id}`, D10(a.created_at) || now, 'weekly', '0.6')));
    // Offres actives non expirées
    (offres || []).forEach((o) => { if (!o.expire_at || new Date(o.expire_at).getTime() >= nowMs) parts.push(U(`/offre/${o.id}`, D10(o.date_debut) || now, 'daily', '0.6')); });
    // Sorties / packs loisir actifs
    (packs || []).forEach((p) => parts.push(U(`/sortie/${p.id}`, now, 'weekly', '0.6')));
    // Fiches pros actives
    (comm || []).forEach((c) => parts.push(U(`/pro/${c.id}`, now, 'weekly', '0.7')));
    (arti || []).forEach((a) => parts.push(U(`/artisan/${a.id}`, now, 'weekly', '0.7')));
    (agences || []).forEach((a) => parts.push(U(`/agence/${a.id}`, now, 'weekly', '0.7')));
    (courtiers || []).forEach((c) => parts.push(U(`/courtier/${c.id}`, now, 'weekly', '0.7')));

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${parts.join('\n')}
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

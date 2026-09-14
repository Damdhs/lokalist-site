//  api/artisan-ville.js  [artisan-ville-page-v1]
//  Page HTML SSR indexable pour /artisans/:metier/:ville
//  Liste les artisans d'un metier donne dans une commune donnee.
//  Contenu unique (vrais artisans de la base) -> pas de "thin content".
//  Si 0 artisan : page renvoyee en noindex (jamais declaree a Google).

const SUPABASE_URL = 'https://kukathominhssogthplc.supabase.co';
const SUPABASE_ANON  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a2F0aG9taW5oc3NvZ3RocGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTU2NDMsImV4cCI6MjA5MDQzMTY0M30.nrfnhLWA_N-d5EA0qMvSTgSvbebbqHvWuCwk4PQDxcg';
const SITE_URL = 'https://lokalist.fr';

const sbHeaders = { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` };

// Metiers "devis" autorises a avoir une page SEO (categorie_id).
// Pour en ajouter un (ex: Beaute) : ajouter son id ici. Reversible.
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
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const escapeHtml = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

async function sb(pathAndQuery) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, { headers: sbHeaders });
  if (!r.ok) return [];
  return r.json();
}

async function resolveCommune(wantedSlug) {
  const loose = '%' + wantedSlug.split('-').filter(Boolean).join('%') + '%';
  let rows = await sb(`communes_ref?select=nom,code_postal,code_insee,lat,lng&nom=ilike.${encodeURIComponent(loose)}&limit=200`);
  let hit = rows.find((c) => slugify(c.nom) === wantedSlug);
  if (hit) return hit;
  rows = await sb('communes_ref?select=nom,code_postal,code_insee,lat,lng&limit=40000');
  return rows.find((c) => slugify(c.nom) === wantedSlug) || null;
}

async function resolveMetier(wantedSlug) {
  const cats = await sb('categories_artisans?select=id,nom,emoji');
  return (cats || []).find((c) => slugify(c.nom) === wantedSlug) || null;
}

function page({ head, robots, bodyInner }) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5"/>
${robots ? `<meta name="robots" content="${robots}"/>` : ''}
${head}
<link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'DM Sans',system-ui,sans-serif;background:#F7F8F4;color:#1A2E26;line-height:1.6}
  .wrap{max-width:960px;margin:0 auto;padding:28px 20px 80px}
  a{color:inherit}
  .brand{display:inline-flex;align-items:center;gap:8px;text-decoration:none;font-weight:800;font-size:20px;color:#0B1612;margin-bottom:24px}
  .brand span{color:#EF9F27}
  h1{font-size:clamp(24px,4vw,34px);font-weight:800;color:#0B1612;line-height:1.15;margin-bottom:10px}
  .sub{font-size:15.5px;color:#5C7268;margin-bottom:22px;max-width:640px}
  .cta{display:inline-block;background:#1D9E75;color:#fff;font-weight:700;padding:13px 22px;border-radius:12px;text-decoration:none;margin-bottom:30px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;margin-bottom:34px}
  .card{background:#fff;border:1px solid #D8E8E2;border-radius:16px;padding:16px;text-decoration:none;display:block}
  .card .n{font-weight:700;color:#0B1612;margin-bottom:4px}
  .card .m{font-size:13px;color:#5C7268}
  .badge{display:inline-block;font-size:11px;font-weight:700;color:#0F6E56;background:#E1F5EE;padding:2px 8px;border-radius:20px;margin-top:8px}
  h2{font-size:20px;font-weight:800;color:#0B1612;margin:28px 0 14px}
  .chips{display:flex;flex-wrap:wrap;gap:8px}
  .chip{background:#fff;border:1px solid #D8E8E2;border-radius:20px;padding:6px 13px;font-size:13px;text-decoration:none;color:#1A2E26}
  .empty{background:#fff;border:1px solid #D8E8E2;border-radius:16px;padding:26px;text-align:center;color:#5C7268}
</style>
</head>
<body>
<div class="wrap">
<a class="brand" href="${SITE_URL}">Lokali<span>st</span></a>
${bodyInner}
</div>
</body>
</html>`;
}

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const metierSlug = slugify(url.searchParams.get('metier') || '');
    const villeSlug = slugify(url.searchParams.get('ville') || '');
    if (!metierSlug || !villeSlug) {
      return new Response(page({ head: '<title>Page introuvable</title>', robots: 'noindex', bodyInner: '<h1>Page introuvable</h1>' }), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }

    const metier = await resolveMetier(metierSlug);
    // metier inexistant OU non autorise -> 404 noindex
    if (!metier || !METIERS_AUTORISES.has(metier.id)) {
      return new Response(page({ head: '<title>Page introuvable</title>', robots: 'noindex', bodyInner: '<h1>Page introuvable</h1>' }), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }

    const commune = await resolveCommune(villeSlug);
    if (!commune) {
      return new Response(page({ head: '<title>Commune introuvable</title>', robots: 'noindex', bodyInner: '<h1>Commune introuvable</h1>' }), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }

    const ville = commune.nom;
    const cp = commune.code_postal || '';
    const vEnc = encodeURIComponent(ville);
    const canonical = `${SITE_URL}/artisans/${metierSlug}/${villeSlug}`;

    // artisans du metier dans la commune
    const artisans = await sb(`artisans?select=id,nom,nom_entreprise,ville,note_moyenne,nb_avis,certifie_rge,badge_verifie&statut=eq.actif&suspendu_plainte=eq.false&demo=is.false&categorie_id=eq.${metier.id}&ville=ilike.${vEnc}&order=note_moyenne.desc.nullslast`);

    const metierNom = metier.nom;
    const emoji = metier.emoji || '';
    const cpTxt = cp ? ` (${cp})` : '';

    // page VIDE -> noindex (protection anti thin-content)
    const vide = !artisans.length;
    const robots = vide ? 'noindex,follow' : null;

    const title = `${metierNom} à ${ville}${cpTxt} — devis d'artisans locaux | Lokalist`;
    const desc = vide
      ? `Vous cherchez un artisan en ${metierNom.toLowerCase()} à ${ville} ? Déposez votre projet sur Lokalist et recevez des devis d'artisans locaux vérifiés.`
      : `${artisans.length} artisan${artisans.length > 1 ? 's' : ''} en ${metierNom.toLowerCase()} à ${ville}${cpTxt}. Comparez et demandez un devis gratuit à des professionnels locaux vérifiés sur Lokalist.`;

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": title,
      "description": desc,
      "url": canonical,
      "about": { "@type": "Service", "name": `${metierNom} à ${ville}`, "areaServed": { "@type": "City", "name": ville, "addressCountry": "FR" } },
      ...(artisans.length ? {
        "mainEntity": {
          "@type": "ItemList", "numberOfItems": artisans.length,
          "itemListElement": artisans.map((a, i) => ({
            "@type": "ListItem", "position": i + 1,
            "item": { "@type": "HomeAndConstructionBusiness", "name": a.nom_entreprise || a.nom, "url": `${SITE_URL}/artisan/${a.id}`, "address": { "@type": "PostalAddress", "addressLocality": ville, ...(cp ? { "postalCode": cp } : {}), "addressCountry": "FR" } }
          }))
        }
      } : {})
    };

    const head = `<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}"/>
<link rel="canonical" href="${canonical}"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="Lokalist"/>
<meta property="og:title" content="${escapeHtml(title)}"/>
<meta property="og:description" content="${escapeHtml(desc)}"/>
<meta property="og:url" content="${canonical}"/>
<meta property="og:image" content="${SITE_URL}/og-lokalist.png"/>
<meta name="twitter:card" content="summary_large_image"/>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;

    const cards = artisans.map((a) => `<a class="card" href="${SITE_URL}/artisan/${a.id}">
  <div class="n">${escapeHtml(a.nom_entreprise || a.nom)}</div>
  <div class="m">${emoji} ${escapeHtml(metierNom)} · ${escapeHtml(ville)}</div>
  ${a.badge_verifie ? '<span class="badge">✓ Vérifié</span> ' : ''}${a.certifie_rge ? '<span class="badge">RGE</span>' : ''}
</a>`).join('');

    const bodyInner = `
<h1>${emoji} ${escapeHtml(metierNom)} à ${escapeHtml(ville)}${escapeHtml(cpTxt)}</h1>
<p class="sub">${vide
  ? `Aucun artisan en ${escapeHtml(metierNom.toLowerCase())} n'est encore référencé à ${escapeHtml(ville)}. Décrivez votre projet : les professionnels du secteur vous enverront leurs devis.`
  : `Comparez ${artisans.length} artisan${artisans.length > 1 ? 's' : ''} en ${escapeHtml(metierNom.toLowerCase())} à ${escapeHtml(ville)} et demandez un devis gratuit.`}</p>
<a class="cta" href="${SITE_URL}/deposer-projet?ville=${vEnc}">Déposer mon projet — recevoir des devis</a>
${vide
  ? `<div class="empty">Soyez recontacté par des artisans locaux dès qu'ils rejoignent Lokalist.</div>`
  : `<div class="grid">${cards}</div>`}
<h2>Voir aussi à ${escapeHtml(ville)}</h2>
<div class="chips">
  <a class="chip" href="${SITE_URL}/villes/${villeSlug}">Tous les pros de ${escapeHtml(ville)}</a>
  <a class="chip" href="${SITE_URL}/deposer-projet">Déposer un projet</a>
</div>`;

    return new Response(page({ head, robots, bodyInner }), {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=3600' }
    });
  } catch (e) {
    return new Response('Erreur: ' + (e && e.message), { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
}

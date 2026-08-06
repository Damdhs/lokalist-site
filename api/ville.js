// ════════════════════════════════════════════════════════════════
//  api/ville.js — Vercel Edge Function  [ville-page-v1]
//  Page HTML SSR indexable pour /villes/:slug
//  Agrège, pour une commune : commerçants, artisans, agences, courtiers
//  (tous ACTIFS uniquement) + la mairie partenaire.
//  Source de résolution du nom de commune : communes_ref (slug JS).
//  Lecture base en direct (cache s-maxage=300) → reflète la base en continu.
// ════════════════════════════════════════════════════════════════
export const config = { runtime: 'edge' };

const SUPABASE_URL   = 'https://kukathominhssogthplc.supabase.co';
const SUPABASE_ANON  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a2F0aG9taW5oc3NvZ3RocGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTU2NDMsImV4cCI6MjA5MDQzMTY0M30.nrfnhLWA_N-d5EA0qMvSTgSvbebbqHvWuCwk4PQDxcg';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=fr.lokalist.app';
const APP_STORE_URL  = 'https://apps.apple.com/app/lokalist';
const SITE_URL       = 'https://lokalist.fr';

const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

const slugify = (s) => String(s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const sbHeaders = { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` };

async function sb(pathAndQuery) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, { headers: sbHeaders });
    if (!r.ok) return [];
    return await r.json();
  } catch (e) {
    console.error('[ville sb]', pathAndQuery, e);
    return [];
  }
}

const html404 = (msg) => `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Ville introuvable — Lokalist</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#F9F8F6;color:#1A1A2E;padding:60px 20px;text-align:center;line-height:1.6}h1{color:#1D9E75;font-size:26px;margin:20px 0 8px}a{color:#1D9E75;font-weight:600;text-decoration:none}</style>
</head><body>
<div style="font-size:56px">📍</div>
<h1>${escapeHtml(msg)}</h1>
<p style="color:#8A8FA8">Cette commune n'est pas encore couverte par Lokalist.</p>
<p style="margin-top:14px"><a href="${SITE_URL}">← Retour à Lokalist</a></p>
</body></html>`;

const notFound = (msg = 'Commune introuvable') => new Response(html404(msg), {
  status: 404,
  headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, follow' },
});

// Résout le nom canonique de la commune à partir du slug (communes_ref).
async function resolveCommune(wantedSlug) {
  // 1) tentative ciblée (rapide) : ilike large sur les segments du slug
  const loose = '%' + wantedSlug.split('-').filter(Boolean).join('%') + '%';
  let rows = await sb(`communes_ref?select=nom,code_postal,code_insee,lat,lng&nom=ilike.${encodeURIComponent(loose)}&limit=200`);
  let hit = rows.find((c) => slugify(c.nom) === wantedSlug);
  if (hit) return hit;
  // 2) fallback (accents) : chargement complet + match slug JS
  rows = await sb('communes_ref?select=nom,code_postal,code_insee,lat,lng&limit=40000');
  return rows.find((c) => slugify(c.nom) === wantedSlug) || null;
}

const etoiles = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));

// Carte pro générique
function card(href, img, emoji, nom, ville, note, nbAvis, tag) {
  const noteHtml = (note > 0)
    ? `<div class="card-note">${etoiles(note)} <span>${Number(note).toFixed(1)}${nbAvis ? ` · ${nbAvis} avis` : ''}</span></div>`
    : '';
  const media = img
    ? `<img class="card-img" src="${escapeHtml(img)}" alt="${escapeHtml(nom)}" loading="lazy"/>`
    : `<div class="card-img card-img-fb">${emoji}</div>`;
  return `<a class="card" href="${href}">
    ${media}
    <div class="card-body">
      ${tag ? `<span class="card-tag">${tag}</span>` : ''}
      <div class="card-name">${escapeHtml(nom)}</div>
      ${ville ? `<div class="card-city">📍 ${escapeHtml(ville)}</div>` : ''}
      ${noteHtml}
    </div>
  </a>`;
}

function section(titre, emoji, cardsHtml, count) {
  if (!count) return '';
  return `<section class="section">
    <h2>${emoji} ${titre} <span class="count">${count}</span></h2>
    <div class="grid">${cardsHtml}</div>
  </section>`;
}

export default async function handler(req) {
  try {
    const url  = new URL(req.url);
    const raw  = url.searchParams.get('slug') || '';
    const want = slugify(raw);
    if (!want) return notFound('Commune non précisée');

    const commune = await resolveCommune(want);
    if (!commune) return notFound();

    const ville = commune.nom;
    const cp    = commune.code_postal || '';
    const vEnc  = encodeURIComponent(ville);

    // Contenu (tous ACTIFS uniquement) — en parallèle
    const [commercants, artisans, courtiers, agences, mairies] = await Promise.all([
      sb(`commercants?select=id,nom,ville,logo_url,photo_url,note_moyenne,nb_avis&statut=eq.actif&ville=ilike.${vEnc}&order=note_moyenne.desc.nullslast`),
      sb(`artisans?select=id,nom,nom_entreprise,ville,photo_url,note_moyenne,nb_avis,certifie_rge,badge_verifie&statut=eq.actif&suspendu_plainte=eq.false&ville=ilike.${vEnc}&order=note_moyenne.desc.nullslast`),
      sb(`courtiers_immo?select=id,nom,ville,logo_url,note_moyenne,nb_avis&actif=eq.true&ville=ilike.${vEnc}&order=note_moyenne.desc.nullslast`),
      sb(`agences_immo?select=id,nom,communes,logo_url,note_moyenne,nb_avis&actif=eq.true&communes=cs.${encodeURIComponent('{"' + ville + '"}')}&order=note_moyenne.desc.nullslast`),
      sb(`mairies_partenaires?select=*&statut=eq.actif&ville=ilike.${vEnc}&limit=1`),
    ]);

    const mairie = mairies && mairies[0] ? mairies[0] : null;
    const total  = commercants.length + artisans.length + courtiers.length + agences.length;

    // Pas de page vide : rien à montrer ET pas de mairie → 404 (SEO propre)
    if (total === 0 && !mairie) return notFound(`${ville} — bientôt sur Lokalist`);

    // ─── Sections ───
    const secCommercants = section('Commerçants', '🏪',
      commercants.map((c) => card(`/pro/${c.id}`, c.photo_url || c.logo_url, '🏪', c.nom, c.ville, +c.note_moyenne, c.nb_avis)).join(''),
      commercants.length);

    const secArtisans = section('Artisans', '🔧',
      artisans.map((a) => card(`/artisan/${a.id}`, a.photo_url, '🔧',
        a.nom_entreprise || a.nom, a.ville, +a.note_moyenne, a.nb_avis,
        a.certifie_rge ? 'RGE' : (a.badge_verifie ? 'Vérifié' : ''))).join(''),
      artisans.length);

    const secAgences = section('Agences immobilières', '🏠',
      agences.map((ag) => card(`/agence/${ag.id}`, ag.logo_url, '🏠', ag.nom, ville, +ag.note_moyenne, ag.nb_avis)).join(''),
      agences.length);

    const secCourtiers = section('Courtiers', '💶',
      courtiers.map((co) => card(`/courtier/${co.id}`, co.logo_url, '💶', co.nom, co.ville, +co.note_moyenne, co.nb_avis)).join(''),
      courtiers.length);

    // ─── Encart mairie ───
    const mairieHtml = mairie ? `<section class="mairie">
      <div class="mairie-head">
        ${mairie.logo_url ? `<img class="mairie-logo" src="${escapeHtml(mairie.logo_url)}" alt="Mairie de ${escapeHtml(ville)}"/>` : '<div class="mairie-logo mairie-logo-fb">🏛️</div>'}
        <div>
          <div class="mairie-tag">🏛️ Mairie partenaire</div>
          <div class="mairie-nom">${escapeHtml(mairie.nom || ('Mairie de ' + ville))}</div>
        </div>
      </div>
      ${mairie.description ? `<p class="mairie-desc">${escapeHtml(mairie.description)}</p>` : ''}
      <div class="mairie-links">
        ${mairie.url_demarches ? `<a href="${escapeHtml(mairie.url_demarches)}" rel="nofollow">📄 Démarches</a>` : ''}
        ${mairie.url_dechets ? `<a href="${escapeHtml(mairie.url_dechets)}" rel="nofollow">♻️ Déchets</a>` : ''}
        ${mairie.url_transports ? `<a href="${escapeHtml(mairie.url_transports)}" rel="nofollow">🚌 Transports</a>` : ''}
        ${mairie.site_web ? `<a href="${escapeHtml(mairie.site_web)}" rel="nofollow">🌐 Site officiel</a>` : ''}
      </div>
    </section>` : '';

    // ─── SEO ───
    const canonical = `${SITE_URL}/villes/${want}`;
    const nbLabel = [];
    if (commercants.length) nbLabel.push(`${commercants.length} commerçant${commercants.length > 1 ? 's' : ''}`);
    if (artisans.length)    nbLabel.push(`${artisans.length} artisan${artisans.length > 1 ? 's' : ''}`);
    if (agences.length)     nbLabel.push(`${agences.length} agence${agences.length > 1 ? 's' : ''}`);
    if (courtiers.length)   nbLabel.push(`${courtiers.length} courtier${courtiers.length > 1 ? 's' : ''}`);
    const resume = nbLabel.length ? nbLabel.join(', ') : 'la vie locale';
    const title = `Commerçants, artisans et services à ${ville}${cp ? ' (' + cp + ')' : ''} — Lokalist`;
    const desc  = `Découvrez ${resume} à ${ville} sur Lokalist, l'app qui fait vivre l'économie locale. Bons plans, fidélité et commerces de proximité.`;

    const allBiz = [
      ...commercants.map((c) => ({ n: c.nom, u: `${SITE_URL}/pro/${c.id}` })),
      ...artisans.map((a) => ({ n: a.nom_entreprise || a.nom, u: `${SITE_URL}/artisan/${a.id}` })),
      ...agences.map((ag) => ({ n: ag.nom, u: `${SITE_URL}/agence/${ag.id}` })),
      ...courtiers.map((co) => ({ n: co.nom, u: `${SITE_URL}/courtier/${co.id}` })),
    ];
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": title,
      "description": desc,
      "url": canonical,
      "about": {
        "@type": "City", "name": ville, "addressCountry": "FR",
        ...(commune.lat && commune.lng ? { "geo": { "@type": "GeoCoordinates", "latitude": commune.lat, "longitude": commune.lng } } : {}),
      },
      ...(allBiz.length ? {
        "mainEntity": {
          "@type": "ItemList",
          "numberOfItems": allBiz.length,
          "itemListElement": allBiz.map((b, i) => ({ "@type": "ListItem", "position": i + 1, "name": b.n, "url": b.u })),
        }
      } : {}),
    };

    const body = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5"/>
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}"/>
<link rel="canonical" href="${canonical}"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="Lokalist"/>
<meta property="og:title" content="${escapeHtml(title)}"/>
<meta property="og:description" content="${escapeHtml(desc)}"/>
<meta property="og:image" content="${SITE_URL}/images/og-default.jpg"/>
<meta property="og:url" content="${canonical}"/>
<meta property="og:locale" content="fr_FR"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(title)}"/>
<meta name="twitter:description" content="${escapeHtml(desc)}"/>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
<style>
  :root { --primary:#1D9E75;--primary-d:#0F6E56;--primary-l:#E8F8F2;--accent:#EF9F27;--bg:#F9F8F6;--surface:#FFF;--border:#EDEDED;--text:#1A1A2E;--muted:#8A8FA8; }
  * { box-sizing:border-box;margin:0;padding:0; }
  html,body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.55; }
  a { color:inherit;text-decoration:none; }
  .top-bar { background:var(--primary);color:#fff;padding:14px 20px;display:flex;align-items:center;justify-content:space-between; }
  .top-bar .brand { color:#fff;font-weight:800;font-size:18px;letter-spacing:-0.3px; }
  .top-bar .btn-app { background:rgba(0,0,0,0.18);padding:7px 13px;border-radius:18px;font-size:13px;font-weight:600;color:#fff; }
  .container { max-width:1040px;margin:0 auto;padding:0 16px; }
  .crumb { font-size:12.5px;color:var(--muted);padding:14px 2px 0; }
  .crumb a { color:var(--muted); } .crumb a:hover { color:var(--primary); }
  .hero { padding:10px 2px 4px; }
  .hero h1 { font-size:30px;font-weight:800;letter-spacing:-0.6px;line-height:1.15; }
  .hero .sub { color:var(--muted);font-size:15px;margin-top:6px; }
  .mairie { background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px;margin-top:16px;box-shadow:0 2px 8px rgba(0,0,0,0.04); }
  .mairie-head { display:flex;align-items:center;gap:14px; }
  .mairie-logo { width:56px;height:56px;border-radius:12px;object-fit:cover;background:var(--primary-l); }
  .mairie-logo-fb { display:flex;align-items:center;justify-content:center;font-size:30px; }
  .mairie-tag { font-size:12px;font-weight:700;color:var(--primary-d);text-transform:uppercase;letter-spacing:0.5px; }
  .mairie-nom { font-size:19px;font-weight:800;letter-spacing:-0.3px; }
  .mairie-desc { color:var(--text);font-size:14px;margin-top:10px;line-height:1.6;white-space:pre-line; }
  .mairie-links { display:flex;flex-wrap:wrap;gap:8px;margin-top:12px; }
  .mairie-links a { background:var(--primary-l);color:var(--primary-d);font-size:13px;font-weight:600;padding:7px 13px;border-radius:20px; }
  .section { margin-top:26px; }
  .section h2 { font-size:16px;font-weight:800;letter-spacing:-0.2px;display:flex;align-items:center;gap:8px;margin-bottom:12px; }
  .section h2 .count { background:var(--primary-l);color:var(--primary-d);font-size:12px;font-weight:700;padding:2px 9px;border-radius:20px; }
  .grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px; }
  .card { background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04);transition:transform .15s ease,box-shadow .15s ease;display:flex;flex-direction:column; }
  .card:hover { transform:translateY(-3px);box-shadow:0 8px 20px rgba(0,0,0,0.08); }
  .card-img { width:100%;height:130px;object-fit:cover;background:var(--primary-l);display:block; }
  .card-img-fb { display:flex;align-items:center;justify-content:center;font-size:44px; }
  .card-body { padding:12px 14px 14px; }
  .card-tag { display:inline-block;background:var(--accent);color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:12px;margin-bottom:6px; }
  .card-name { font-size:15px;font-weight:700;letter-spacing:-0.2px;line-height:1.3; }
  .card-city { color:var(--muted);font-size:12.5px;margin-top:3px; }
  .card-note { color:var(--accent);font-size:12.5px;margin-top:6px; } .card-note span { color:var(--muted); }
  .cta-block { background:var(--primary);color:#fff;margin:32px 0 30px;border-radius:18px;padding:26px 20px;text-align:center;box-shadow:0 6px 18px rgba(29,158,117,0.25); }
  .cta-block h3 { font-size:19px;font-weight:800;margin-bottom:6px;letter-spacing:-0.3px; }
  .cta-block p { font-size:13.5px;opacity:0.92;margin-bottom:16px;max-width:460px;margin-left:auto;margin-right:auto; }
  .cta-btn { display:inline-block;background:#fff;color:var(--primary);padding:14px 28px;border-radius:12px;font-weight:800;font-size:15px;box-shadow:0 4px 12px rgba(0,0,0,0.1); }
  .cta-btn-2 { display:inline-block;background:rgba(0,0,0,0.15);color:#fff;padding:12px 22px;border-radius:12px;font-weight:600;font-size:13px;margin-left:8px; }
  footer { text-align:center;padding:24px 20px 44px;color:var(--muted);font-size:12px; }
  footer a { color:var(--primary);font-weight:600; }
  @media (max-width:600px){
    .hero h1{font-size:24px;}
    .grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:11px;}
    .card-img{height:104px;}
    .cta-btn-2{display:block;margin:12px auto 0;width:fit-content;}
  }
</style>
</head>
<body>
<header class="top-bar">
  <a class="brand" href="${SITE_URL}">🏡 Lokalist</a>
  <a class="btn-app" href="${PLAY_STORE_URL}" id="btn-download">Télécharger l'app →</a>
</header>

<main class="container">
  <nav class="crumb"><a href="${SITE_URL}">Accueil</a> › ${escapeHtml(ville)}</nav>

  <div class="hero">
    <h1>${escapeHtml(ville)}${cp ? ` <span style="color:var(--muted);font-weight:600;font-size:18px">(${escapeHtml(cp)})</span>` : ''}</h1>
    <div class="sub">Commerçants, artisans et services locaux${total ? ` · ${total} acteur${total > 1 ? 's' : ''} près de chez vous` : ''}</div>
  </div>

  ${mairieHtml}
  ${secCommercants}
  ${secArtisans}
  ${secAgences}
  ${secCourtiers}

  <div class="cta-block">
    <h3>📱 Toute la vie locale de ${escapeHtml(ville)} dans votre poche</h3>
    <p>Bons plans, fidélité, commerces et actus de votre commune. Gratuit pour les habitants.</p>
    <a href="${PLAY_STORE_URL}" class="cta-btn" id="btn-download-2">Télécharger Lokalist</a>
    <a href="${SITE_URL}/mairies" class="cta-btn-2">Vous êtes une mairie ?</a>
  </div>
</main>

<footer>
  <p>© Lokalist · La fidélité locale réinventée</p>
  <p style="margin-top:6px;"><a href="${SITE_URL}">Accueil</a> · <a href="${SITE_URL}/contact">Contact</a> · <a href="${SITE_URL}/mentions-legales">Mentions légales</a></p>
</footer>

<script>
  (function(){
    var ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) {
      ['btn-download','btn-download-2'].forEach(function(id){
        var b = document.getElementById(id); if (b) b.href = '${APP_STORE_URL}';
      });
    }
  })();
</script>
</body>
</html>`;

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-Robots-Tag': 'index, follow',
      },
    });
  } catch (e) {
    console.error('[ville edge]', e);
    return notFound('Erreur serveur');
  }
}

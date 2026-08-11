// ════════════════════════════════════════════════════════════════
//  api/ville.js — Vercel Edge Function  [ville-page-v1]
//  Page HTML SSR indexable pour /villes/:slug
//  Agrège, pour une commune : commerçants, artisans, agences, courtiers
//  (ACTIFS uniquement) + mairie partenaire. Résolution via communes_ref.
//  Lecture base en direct (cache s-maxage=300).
// ════════════════════════════════════════════════════════════════
export const config = { runtime: 'edge' };

const SUPABASE_URL   = 'https://kukathominhssogthplc.supabase.co';
const SUPABASE_ANON  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a2F0aG9taW5oc3NvZ3RocGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTU2NDMsImV4cCI6MjA5MDQzMTY0M30.nrfnhLWA_N-d5EA0qMvSTgSvbebbqHvWuCwk4PQDxcg';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=fr.lokalist.app';
const APP_STORE_URL  = 'https://apps.apple.com/app/lokalist';
const SITE_URL       = 'https://lokalist.fr';
const FB_URL         = 'https://www.facebook.com/profile.php?id=61577501867273';
const IG_URL         = 'https://www.instagram.com/lokalist.fr/';

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
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#F9F8F6;color:#1A1A2E;padding:60px 20px;text-align:center;line-height:1.6}h1{color:#1D9E75;font-size:26px;margin:20px 0 8px}a{color:#1D9E75;font-weight:600;text-decoration:none}  /* LOKALIST_VILLE_SERVICES_V1:CSS:START */
  .serv-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px; }
  .serv-card { background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px 18px 16px;box-shadow:0 2px 10px rgba(16,40,32,.05);transition:transform .18s ease,box-shadow .18s ease;display:flex;flex-direction:column; }
  .serv-card:hover { transform:translateY(-4px);box-shadow:0 14px 30px rgba(16,40,32,.12); }
  .serv-emoji { font-size:30px;line-height:1;margin-bottom:10px; }
  .serv-t { font-weight:800;font-size:16px;letter-spacing:-.3px; }
  .serv-d { color:var(--muted);font-size:13px;margin-top:5px;line-height:1.5; }
  .cta-pros { background:linear-gradient(135deg,#0F6E56,#177a5f); }
  .cta-pros .cta-actions { gap:10px; }
  .cta-pros .cta-btn { padding:13px 22px;font-size:14.5px; }
  /* LOKALIST_VILLE_SERVICES_V1:CSS:END */
  /* LOKALIST_VILLE_COMMERCE_V1:CSS:START */
  .deal-tag { position:absolute;top:10px;right:10px;background:#C0392B;color:#fff;font-size:12px;font-weight:800;padding:4px 11px;border-radius:20px;box-shadow:0 3px 10px rgba(192,57,43,.35); }
  .sec-loisirs .count { background:#FDF2F8;color:#EC4899; }
  .card-tag.pink { background:#EC4899;box-shadow:0 3px 10px rgba(236,72,153,.4); }
  .loisir-price { margin-top:9px;display:flex;align-items:baseline;gap:8px; }
  .loisir-price .now { font-family:var(--disp);font-size:20px;font-weight:800;color:#EC4899;letter-spacing:-.5px; }
  .loisir-price .now small { font-size:12px;font-weight:600;color:var(--muted); }
  .loisir-price .was { font-size:13px;color:var(--muted);text-decoration:line-through; }
  /* LOKALIST_VILLE_COMMERCE_V1:CSS:END */
</style>
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

async function resolveCommune(wantedSlug) {
  const loose = '%' + wantedSlug.split('-').filter(Boolean).join('%') + '%';
  let rows = await sb(`communes_ref?select=nom,code_postal,code_insee,lat,lng&nom=ilike.${encodeURIComponent(loose)}&limit=200`);
  let hit = rows.find((c) => slugify(c.nom) === wantedSlug);
  if (hit) return hit;
  rows = await sb('communes_ref?select=nom,code_postal,code_insee,lat,lng&limit=40000');
  return rows.find((c) => slugify(c.nom) === wantedSlug) || null;
}

const etoiles = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));

function card(href, img, emoji, nom, ville, note, nbAvis, tag) {
  const noteHtml = (note > 0)
    ? `<div class="card-note"><span class="stars">${etoiles(note)}</span> <span class="nt">${Number(note).toFixed(1)}${nbAvis ? ` · ${nbAvis} avis` : ''}</span></div>`
    : '';
  const media = img
    ? `<img class="card-img" src="${escapeHtml(img)}" alt="${escapeHtml(nom)}" loading="lazy"/>`
    : `<div class="card-img card-img-fb">${emoji}</div>`;
  return `<a class="card" href="${href}">
    <div class="card-media">${media}${tag ? `<span class="card-tag">${tag}</span>` : ''}</div>
    <div class="card-body">
      <div class="card-name">${escapeHtml(nom)}</div>
      ${ville ? `<div class="card-city">📍 ${escapeHtml(ville)}</div>` : ''}
      ${noteHtml}
    </div>
  </a>`;
}

function section(titre, emoji, cardsHtml, count) {
  if (!count) return '';
  return `<section class="section">
    <h2><span class="s-emoji">${emoji}</span> ${titre} <span class="count">${count}</span></h2>
    <div class="grid">${cardsHtml}</div>
  </section>`;
}

/* LOKALIST_VILLE_EVENTS_V1:HELPERS:START */
const EVT_TYPE_EMOJI = { evenement:'📅', marche:'🛒', conseil:'🏛️', sport:'⚽', culture:'🎭', autre:'📌' };
const evtDateCourte = (iso) => {
  if (!iso) return '';
  try {
    const t = new Intl.DateTimeFormat('fr-FR', { timeZone:'Europe/Paris', weekday:'short', day:'numeric', month:'short' }).format(new Date(iso));
    return t.charAt(0).toUpperCase() + t.slice(1);
  } catch (e) { const d = new Date(iso); return isNaN(d) ? '' : d.toISOString().slice(0,10); }
};
function eventCard(e) {
  const emoji = EVT_TYPE_EMOJI[e.type] || '📅';
  const media = e.image_url
    ? `<img class="card-img" src="${escapeHtml(e.image_url)}" alt="${escapeHtml(e.titre||'Evenement')}" loading="lazy"/>`
    : `<div class="card-img card-img-fb">${emoji}</div>`;
  const dTxt = evtDateCourte(e.date_debut);
  const tag  = e.statut === 'annule' ? 'Annule' : (e.statut === 'reporte' ? 'Reporte' : (e.gratuit ? 'Gratuit' : ''));
  return `<a class="card" href="/mairie/${e.id}">
    <div class="card-media">${media}${tag ? `<span class="card-tag">${tag}</span>` : ''}</div>
    <div class="card-body">
      <div class="card-name">${escapeHtml(e.titre||'Evenement local')}</div>
      ${dTxt ? `<div class="card-city">🗓️ ${escapeHtml(dTxt)}${e.lieu ? ' · '+escapeHtml(e.lieu) : ''}</div>` : ''}
    </div>
  </a>`;
}
/* LOKALIST_VILLE_EVENTS_V1:HELPERS:END */
/* LOKALIST_VILLE_COMMERCE_V1:HELPERS:START */
function offreCard(o) {
  const c = o.commercants || {};
  const media = o.photo_url
    ? `<img class="card-img" src="${escapeHtml(o.photo_url)}" alt="${escapeHtml(o.titre||'Offre')}" loading="lazy"/>`
    : `<div class="card-img card-img-fb">🏷️</div>`;
  return `<a class="card" href="/offre/${o.id}">
    <div class="card-media">${media}${o.reduction ? `<span class="deal-tag">${escapeHtml(o.reduction)}</span>` : ''}</div>
    <div class="card-body">
      <div class="card-name">${escapeHtml(o.titre||'Bon plan')}</div>
      ${c.nom ? `<div class="card-city">🏪 ${escapeHtml(c.nom)}</div>` : ''}
    </div>
  </a>`;
}
function packCard(p) {
  const media = p.photo_url
    ? `<img class="card-img" src="${escapeHtml(p.photo_url)}" alt="${escapeHtml(p.nom||'Sortie')}" loading="lazy"/>`
    : `<div class="card-img card-img-fb">🎉</div>`;
  const now = p.prix_pack != null ? Number(p.prix_pack).toFixed(0) : null;
  const was = (p.prix_normal != null && p.prix_pack != null && Number(p.prix_normal) > Number(p.prix_pack)) ? Number(p.prix_normal).toFixed(0) : null;
  const reduc = p.reduction_pct > 0 ? `-${p.reduction_pct}%` : '';
  return `<a class="card" href="/sortie/${p.id}">
    <div class="card-media">${media}${reduc ? `<span class="card-tag pink">${reduc}</span>` : ''}</div>
    <div class="card-body">
      <div class="card-name">${escapeHtml(p.nom||'Sortie')}</div>
      ${p.ville ? `<div class="card-city">📍 ${escapeHtml(p.ville)}</div>` : ''}
      ${now ? `<div class="loisir-price"><span class="now">${now}€<small>/pers</small></span>${was ? `<span class="was">${was}€</span>` : ''}</div>` : ''}
    </div>
  </a>`;
}
function sectionLoisirs(titre, emoji, cardsHtml, count) {
  if (!count) return '';
  return `<section class="section sec-loisirs">
    <h2><span class="s-emoji">${emoji}</span> ${titre} <span class="count">${count}</span></h2>
    <div class="grid">${cardsHtml}</div>
  </section>`;
}
/* LOKALIST_VILLE_COMMERCE_V1:HELPERS:END */
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

    const [commercants, artisans, courtiers, agences, mairies] = await Promise.all([
      sb(`commercants?select=id,nom,ville,logo_url,photo_url,note_moyenne,nb_avis&statut=eq.actif&ville=ilike.${vEnc}&order=note_moyenne.desc.nullslast`),
      sb(`artisans?select=id,nom,nom_entreprise,ville,photo_url,note_moyenne,nb_avis,certifie_rge,badge_verifie&statut=eq.actif&suspendu_plainte=eq.false&ville=ilike.${vEnc}&order=note_moyenne.desc.nullslast`),
      sb(`courtiers_immo?select=id,nom,ville,logo_url,note_moyenne,nb_avis&actif=eq.true&ville=ilike.${vEnc}&order=note_moyenne.desc.nullslast`),
      sb(`agences_immo?select=id,nom,communes,logo_url,note_moyenne,nb_avis&actif=eq.true&communes=cs.${encodeURIComponent('{"' + ville + '"}')}&order=note_moyenne.desc.nullslast`),
      sb(`mairies_partenaires?select=*&statut=eq.actif&ville=ilike.${vEnc}&limit=1`),
    ]);

    const mairie = mairies && mairies[0] ? mairies[0] : null;
    /* LOKALIST_VILLE_EVENTS_V1:FETCH:START */
    const nowIso = new Date().toISOString();
    const evenements = await sb(`evenements_mairie?select=id,titre,ville,lieu,type,statut,date_debut,date_fin,image_url,gratuit,prix,description&ville=ilike.${vEnc}&date_debut=gte.${encodeURIComponent(nowIso)}&order=date_debut.asc&limit=8`);
    const secEvenements = section('Agenda & evenements', '📅',
      evenements.map((e) => eventCard(e)).join(''),
      evenements.length);
    /* LOKALIST_VILLE_EVENTS_V1:FETCH:END */
    const total  = commercants.length + artisans.length + courtiers.length + agences.length;
    /* LOKALIST_VILLE_COMMERCE_V1:FETCH:START */
    const [offresV, packsV] = await Promise.all([
      sb(`offres?select=id,titre,reduction,photo_url,type_offre,date_debut,expire_at,commercants!inner(nom,ville)&statut=eq.active&commercants.ville=ilike.${vEnc}&order=date_debut.desc&limit=8`),
      sb(`packs_loisir?select=id,nom,ville,photo_url,prix_pack,prix_normal,reduction_pct,actif&actif=eq.true&ville=ilike.${vEnc}&order=reduction_pct.desc.nullslast&limit=8`),
    ]);
    const nowMs = Date.now();
    const offres = (offresV || []).filter((o) => !o.expire_at || new Date(o.expire_at).getTime() >= nowMs);
    const secBonsPlans = section('Bons plans du moment', '🏷️',
      offres.map((o) => offreCard(o)).join(''), offres.length);
    const secSorties = sectionLoisirs('Idées de sorties', '🎉',
      (packsV || []).map((p) => packCard(p)).join(''), (packsV || []).length);
    /* LOKALIST_VILLE_COMMERCE_V1:FETCH:END */

    if (total === 0 && !mairie) return notFound(`${ville} — bientôt sur Lokalist`);

    const secCommercants = section('Commerçants', '🏪',
      commercants.map((c) => card(`/pro/${c.id}`, c.photo_url || c.logo_url, '🏪', c.nom, c.ville, +c.note_moyenne, c.nb_avis)).join(''),
      commercants.length);

    const secArtisans = section('Artisans', '🔧',
      artisans.map((a) => card(`/artisan/${a.id}`, a.photo_url, '🔧',
        a.nom_entreprise || a.nom, a.ville, +a.note_moyenne, a.nb_avis,
        a.certifie_rge ? 'RGE' : (a.badge_verifie ? '✓ Vérifié' : ''))).join(''),
      artisans.length);

    const secAgences = section('Agences immobilières', '🏠',
      agences.map((ag) => card(`/agence/${ag.id}`, ag.logo_url, '🏠', ag.nom, ville, +ag.note_moyenne, ag.nb_avis)).join(''),
      agences.length);

    const secCourtiers = section('Courtiers', '💶',
      courtiers.map((co) => card(`/courtier/${co.id}`, co.logo_url, '💶', co.nom, co.ville, +co.note_moyenne, co.nb_avis)).join(''),
      courtiers.length);

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

    const pillsHtml = nbLabel.map((p) => `<span class="pill">${p}</span>`).join('');

    /* LOKALIST_VILLE_LB_V1 */
    const allBiz = [
      ...commercants.map((c) => ({ n: c.nom, u: `${SITE_URL}/pro/${c.id}`, t: 'Store' })),
      ...artisans.map((a) => ({ n: a.nom_entreprise || a.nom, u: `${SITE_URL}/artisan/${a.id}`, t: 'HomeAndConstructionBusiness' })),
      ...agences.map((ag) => ({ n: ag.nom, u: `${SITE_URL}/agence/${ag.id}`, t: 'RealEstateAgent' })),
      ...courtiers.map((co) => ({ n: co.nom, u: `${SITE_URL}/courtier/${co.id}`, t: 'FinancialService' })),
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
          "@type": "ItemList", "numberOfItems": allBiz.length,
          "itemListElement": allBiz.map((b, i) => ({ "@type": "ListItem", "position": i + 1, "item": { "@type": b.t || "LocalBusiness", "name": b.n, "url": b.u, "address": { "@type": "PostalAddress", "addressLocality": ville, ...(cp ? { "postalCode": cp } : {}), "addressCountry": "FR" } } })),
        }
      } : {}),
    };

    /* LOKALIST_VILLE_EVENTS_V1:LD:START */
    const eventsLd = evenements.length ? `<script type="application/ld+json">${JSON.stringify(evenements.map((e) => ({
      "@context":"https://schema.org","@type":"Event","name":e.titre||"Evenement local",
      "url":`${SITE_URL}/mairie/${e.id}`,
      ...(e.image_url ? { "image": e.image_url } : {}),
      ...(e.date_debut ? { "startDate": e.date_debut } : {}),
      ...(e.date_fin ? { "endDate": e.date_fin } : {}),
      ...(e.statut === 'annule' ? { "eventStatus":"https://schema.org/EventCancelled" } : {}),
      ...(e.statut === 'reporte' ? { "eventStatus":"https://schema.org/EventPostponed" } : {}),
      "location": { "@type":"Place","name":e.lieu||ville,"address":{ "@type":"PostalAddress","addressLocality":ville,...(cp?{"postalCode":cp}:{}),"addressCountry":"FR" } },
      ...(e.description ? { "description": String(e.description).slice(0,300) } : {}),
      "organizer": { "@type":"Organization","name":`Mairie de ${ville}` }
    })))}</script>` : '';
    /* LOKALIST_VILLE_EVENTS_V1:LD:END */
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
<meta property="og:image" content="${SITE_URL}/og-lokalist.png"/>
<meta property="og:url" content="${canonical}"/>
<meta property="og:locale" content="fr_FR"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(title)}"/>
<meta name="twitter:description" content="${escapeHtml(desc)}"/>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
${eventsLd}
<link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png"/>
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png"/>
<link rel="icon" href="/favicon.ico" sizes="any"/>
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&display=swap" rel="stylesheet">
<style>
  :root { --primary:#1D9E75;--primary-d:#0F6E56;--primary-l:#E8F8F2;--accent:#EF9F27;--bg:#F9F8F6;--surface:#FFF;--border:#ECEFEC;--text:#15231D;--muted:#7C8A83;--disp:'Bricolage Grotesque',system-ui,sans-serif; }
  * { box-sizing:border-box;margin:0;padding:0; }
  html { scroll-behavior:smooth; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.55;-webkit-font-smoothing:antialiased; }
  a { color:inherit;text-decoration:none; }
  .wrap { max-width:1120px;margin:0 auto;padding:0 22px; }

  /* Header */
  .top-bar { position:sticky;top:0;z-index:50;background:rgba(255,255,255,.86);backdrop-filter:saturate(180%) blur(12px);border-bottom:1px solid var(--border); }
  .top-inner { max-width:1120px;margin:0 auto;padding:11px 22px;display:flex;align-items:center;justify-content:space-between; }
  .brand { display:flex;align-items:center;gap:10px;font-family:var(--disp);font-weight:800;font-size:22px;letter-spacing:-0.6px; }
  .brand img { width:30px;height:30px;border-radius:8px;display:block; }
  .brand .n1 { color:var(--primary-d); } .brand .n2 { color:var(--accent); }
  .btn-app { background:var(--primary);padding:9px 17px;border-radius:22px;font-size:13.5px;font-weight:700;color:#fff;box-shadow:0 4px 14px rgba(29,158,117,.28);transition:transform .15s; }
  .btn-app:hover { transform:translateY(-1px); }

  /* Hero */
  .hero { position:relative;overflow:hidden;background:linear-gradient(135deg,#0F6E56 0%,#1D9E75 62%,#25b184 100%);color:#fff; }
  .hero::before { content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px);background-size:44px 44px;mask-image:radial-gradient(ellipse at 30% 0%,#000 30%,transparent 75%); }
  .hero::after { content:'';position:absolute;top:-120px;right:-80px;width:360px;height:360px;background:radial-gradient(circle,rgba(239,159,39,.35),transparent 65%);pointer-events:none; }
  .hero-inner { position:relative;padding:26px 0 40px; }
  .crumb { font-size:13px;color:rgba(255,255,255,.75);margin-bottom:22px; }
  .crumb a { color:rgba(255,255,255,.75); } .crumb a:hover { color:#fff; }
  .hero h1 { font-family:var(--disp);font-weight:800;font-size:clamp(34px,6vw,60px);line-height:1.02;letter-spacing:-1.5px; }
  .hero h1 .cp { font-size:.42em;font-weight:700;color:rgba(255,255,255,.8);letter-spacing:-.5px;margin-left:6px;vertical-align:middle; }
  .hero .lead { font-size:clamp(15px,1.6vw,18px);color:rgba(255,255,255,.92);margin-top:14px;max-width:640px;line-height:1.6; }
  .pills { display:flex;flex-wrap:wrap;gap:9px;margin-top:20px; }
  .pill { background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.22);backdrop-filter:blur(4px);padding:7px 14px;border-radius:22px;font-size:13.5px;font-weight:600; }
  .hero-cta { display:inline-flex;align-items:center;gap:8px;margin-top:26px;background:#fff;color:var(--primary-d);font-weight:800;font-size:15px;padding:14px 26px;border-radius:14px;box-shadow:0 10px 26px rgba(0,0,0,.18);transition:transform .15s; }
  .hero-cta:hover { transform:translateY(-2px); }

  /* Body */
  main.wrap { padding-top:6px;padding-bottom:10px; }
  .mairie { background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:20px 22px;margin-top:-26px;position:relative;z-index:5;box-shadow:0 10px 30px rgba(16,40,32,.08); }
  .mairie-head { display:flex;align-items:center;gap:15px; }
  .mairie-logo { width:60px;height:60px;border-radius:14px;object-fit:cover;background:var(--primary-l);flex-shrink:0; }
  .mairie-logo-fb { display:flex;align-items:center;justify-content:center;font-size:32px; }
  .mairie-tag { font-size:11.5px;font-weight:800;color:var(--primary-d);text-transform:uppercase;letter-spacing:.6px; }
  .mairie-nom { font-family:var(--disp);font-size:21px;font-weight:800;letter-spacing:-.4px;margin-top:1px; }
  .mairie-desc { color:var(--text);font-size:14.5px;margin-top:12px;line-height:1.6;white-space:pre-line; }
  .mairie-links { display:flex;flex-wrap:wrap;gap:9px;margin-top:14px; }
  .mairie-links a { background:var(--primary-l);color:var(--primary-d);font-size:13px;font-weight:700;padding:8px 14px;border-radius:22px;transition:background .15s; }
  .mairie-links a:hover { background:#d5f0e6; }

  .section { margin-top:34px; }
  .section h2 { font-family:var(--disp);font-size:clamp(19px,2.4vw,24px);font-weight:800;letter-spacing:-.5px;display:flex;align-items:center;gap:9px;margin-bottom:16px; }
  .section h2 .s-emoji { font-size:.9em; }
  .section h2 .count { background:var(--primary-l);color:var(--primary-d);font-size:13px;font-weight:800;padding:2px 11px;border-radius:22px; }
  .grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(232px,1fr));gap:18px; }
  .card { background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;box-shadow:0 2px 10px rgba(16,40,32,.05);transition:transform .18s ease,box-shadow .18s ease;display:flex;flex-direction:column; }
  .card:hover { transform:translateY(-5px);box-shadow:0 16px 34px rgba(16,40,32,.13); }
  .card-media { position:relative; }
  .card-img { width:100%;aspect-ratio:16/10;object-fit:cover;background:var(--primary-l);display:block; }
  .card-img-fb { display:flex;align-items:center;justify-content:center;font-size:54px;background:linear-gradient(135deg,var(--primary-l),#d3efe4); }
  .card-tag { position:absolute;top:10px;left:10px;background:var(--accent);color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:20px;box-shadow:0 3px 10px rgba(239,159,39,.4); }
  .card-body { padding:14px 16px 16px; }
  .card-name { font-size:16px;font-weight:700;letter-spacing:-.3px;line-height:1.3; }
  .card-city { color:var(--muted);font-size:13px;margin-top:4px; }
  .card-note { margin-top:8px;font-size:13px; } .card-note .stars { color:var(--accent);letter-spacing:1px; } .card-note .nt { color:var(--muted); }

  .cta-block { background:linear-gradient(135deg,#0F6E56,#1D9E75);color:#fff;margin:44px 0 34px;border-radius:22px;padding:38px 24px;text-align:center;box-shadow:0 14px 34px rgba(29,158,117,.28);position:relative;overflow:hidden; }
  .cta-block::after { content:'';position:absolute;bottom:-100px;left:-60px;width:280px;height:280px;background:radial-gradient(circle,rgba(239,159,39,.28),transparent 65%); }
  .cta-block h3 { font-family:var(--disp);font-size:clamp(20px,2.6vw,26px);font-weight:800;margin-bottom:8px;letter-spacing:-.5px;position:relative; }
  .cta-block p { font-size:14.5px;opacity:.94;margin:0 auto 20px;max-width:500px;position:relative; }
  .cta-actions { display:flex;gap:12px;justify-content:center;flex-wrap:wrap;position:relative; }
  .cta-btn { display:inline-block;background:#fff;color:var(--primary-d);padding:15px 30px;border-radius:14px;font-weight:800;font-size:15px;box-shadow:0 6px 18px rgba(0,0,0,.15);transition:transform .15s; }
  .cta-btn:hover { transform:translateY(-2px); }
  .cta-btn-2 { display:inline-block;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.3);color:#fff;padding:15px 26px;border-radius:14px;font-weight:700;font-size:14px;transition:background .15s; }
  .cta-btn-2:hover { background:rgba(255,255,255,.26); }

  .socials { display:flex;gap:12px;justify-content:center;margin-bottom:16px; }
  .socials a { width:40px;height:40px;border-radius:50%;background:var(--primary-l);color:var(--primary-d);display:flex;align-items:center;justify-content:center;transition:background .15s,transform .15s,color .15s; }
  .socials a:hover { background:var(--primary);color:#fff;transform:translateY(-2px); }
  .socials svg { width:19px;height:19px; }
  footer { text-align:center;padding:26px 20px 48px;color:var(--muted);font-size:12.5px; }
  footer a { color:var(--primary);font-weight:600; }

  @media (max-width:640px){
    .hero-inner{padding:20px 0 34px;} .crumb{margin-bottom:16px;}
    .grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;}
    .card-body{padding:11px 12px 13px;} .card-name{font-size:14.5px;}
    .mairie{margin-top:-18px;padding:16px 16px;}
    .cta-btn,.cta-btn-2{width:100%;}
  }
</style>
</head>
<body>
<header class="top-bar">
  <div class="top-inner">
    <a class="brand" href="${SITE_URL}"><picture><source srcset="/logo.webp" type="image/webp"><img src="/logo.png" alt="Lokalist" width="30" height="30"/></picture><span><span class="n1">Lokal</span><span class="n2">ist</span></span></a>
    <a class="btn-app" href="${PLAY_STORE_URL}" id="btn-download">Télécharger l'app</a>
  </div>
</header>

<section class="hero">
  <div class="wrap hero-inner">
    <nav class="crumb"><a href="${SITE_URL}">Accueil</a> › <a href="${SITE_URL}/villes">Villes</a> › ${escapeHtml(ville)}</nav>
    <h1>${escapeHtml(ville)}${cp ? `<span class="cp">${escapeHtml(cp)}</span>` : ''}</h1>
    <p class="lead">Tous les commerçants, artisans et services de proximité de ${escapeHtml(ville)} réunis au même endroit. Soutenez l'économie locale et profitez des bons plans près de chez vous.</p>
    ${pillsHtml ? `<div class="pills">${pillsHtml}</div>` : ''}
    <a class="hero-cta" href="${PLAY_STORE_URL}" id="btn-download-hero">📱 Télécharger Lokalist</a>
  </div>
</section>

<main class="wrap">
  ${mairieHtml}
  ${secEvenements}
  ${secCommercants}
  ${secArtisans}
  ${secBonsPlans}
  ${secAgences}
  ${secCourtiers}
  ${secSorties}

  <!-- LOKALIST_VILLE_SERVICES_V1:HTML:START -->
  <section class="section">
    <h2><span class="s-emoji">🎉</span> Sortir &amp; bouger à ${escapeHtml(ville)}</h2>
    <div class="serv-grid">
      <a class="serv-card" href="${SITE_URL}/idees-sorties">
        <div class="serv-emoji">🎪</div>
        <div class="serv-t">Idées de sorties</div>
        <div class="serv-d">Activités, loisirs et bons plans près de ${escapeHtml(ville)}</div>
      </a>
      <a class="serv-card" href="${SITE_URL}/proposer-un-evenement">
        <div class="serv-emoji">📣</div>
        <div class="serv-t">Proposer un événement</div>
        <div class="serv-d">Organisateur ? Publiez votre animation locale gratuitement</div>
      </a>
      <a class="serv-card" href="${SITE_URL}/deposer-projet">
        <div class="serv-emoji">🛠️</div>
        <div class="serv-t">Projet de travaux</div>
        <div class="serv-d">Recevez des devis d'artisans de ${escapeHtml(ville)}</div>
      </a>
    </div>
  </section>

  <div class="cta-block cta-pros">
    <h3>Vous êtes un professionnel à ${escapeHtml(ville)} ?</h3>
    <p>Commerçant, artisan, agence immobilière ou courtier : référencez votre activité sur Lokalist et gagnez en visibilité auprès des habitants de ${escapeHtml(ville)}.</p>
    <div class="cta-actions">
      <a href="${SITE_URL}/commercants" class="cta-btn">🏪 Commerçant</a>
      <a href="${SITE_URL}/artisans" class="cta-btn">🔧 Artisan</a>
      <a href="${SITE_URL}/agences" class="cta-btn">🏠 Agence immo</a>
      <a href="${SITE_URL}/courtiers" class="cta-btn">💶 Courtier</a>
    </div>
  </div>
  <!-- LOKALIST_VILLE_SERVICES_V1:HTML:END -->
  <div class="cta-block">
    <h3>Toute la vie locale de ${escapeHtml(ville)} dans votre poche</h3>
    <p>Bons plans, programme de fidélité, commerces et actus de votre commune. 100% gratuit pour les habitants.</p>
    <div class="cta-actions">
      <a href="${PLAY_STORE_URL}" class="cta-btn" id="btn-download-2">Télécharger l'app</a>
      <a href="${SITE_URL}/mairies" class="cta-btn-2">Vous êtes une mairie ?</a>
    </div>
  </div>
</main>

<footer>
  <div class="socials">
    <a href="${FB_URL}" target="_blank" rel="noopener" aria-label="Facebook"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.8 3.7-3.8 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z"/></svg></a>
    <a href="${IG_URL}" target="_blank" rel="noopener" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></svg></a>
  </div>
  <p>© Lokalist · La fidélité locale réinventée</p>
  <p style="margin-top:6px;"><a href="${SITE_URL}">Accueil</a> · <a href="${SITE_URL}/villes">Toutes les villes</a> · <a href="${SITE_URL}/contact">Contact</a> · <a href="${SITE_URL}/mentions-legales">Mentions légales</a></p>
</footer>

<script>
  (function(){
    var ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) {
      ['btn-download','btn-download-hero','btn-download-2'].forEach(function(id){
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

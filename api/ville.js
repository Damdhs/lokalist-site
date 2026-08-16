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
  /* LOKALIST_VILLE_ACTUS_V1:CSS:START */
  .card-date { color:var(--primary-d);font-size:12.5px;font-weight:700;margin-top:4px; }
  .card-excerpt { color:var(--muted);font-size:13px;margin-top:7px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden; }
  .shop-tag { position:absolute;top:10px;left:10px;background:var(--primary-d);color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:20px;box-shadow:0 3px 10px rgba(15,110,86,.35); }
  .shop-btn { display:inline-block;margin-top:10px;background:var(--primary);color:#fff;font-size:13px;font-weight:800;padding:9px 16px;border-radius:11px;transition:background .15s; }
  .card:hover .shop-btn { background:var(--primary-d); }
  /* LOKALIST_VILLE_ACTUS_V1:CSS:END */
  /* LOKALIST_VILLE_ALERTES_V1:CSS:START */
  .alertes { margin-top:26px; }
  .alertes-head { display:flex;align-items:center;gap:9px;margin-bottom:12px; }
  .alertes-head h2 { font-family:var(--disp);font-size:clamp(18px,2.2vw,22px);font-weight:800;letter-spacing:-.5px; }
  .badge-live { background:#C0392B;color:#fff;font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:.5px; }
  .alerte-card { display:flex;gap:13px;align-items:flex-start;background:#FDECEC;border:1px solid #F5C6C0;border-left:4px solid #C0392B;border-radius:14px;padding:14px 16px;margin-bottom:10px; }
  .alerte-emoji { font-size:22px;line-height:1.2;flex-shrink:0; }
  .alerte-t { font-weight:800;font-size:15px;color:#8f2c20; }
  .alerte-d { font-size:13.5px;color:#7a3a33;margin-top:3px;line-height:1.5;white-space:pre-line; }
  .alerte-date { font-size:12px;color:#a56258;margin-top:5px;font-weight:600; }
  /* LOKALIST_VILLE_ALERTES_V1:CSS:END */
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

function card(href, img, emoji, nom, ville, note, nbAvis, tag, cat, catlabel, catemoji) {
  const noteHtml = (note > 0)
    ? `<div class="card-note"><span class="stars">${etoiles(note)}</span> <span class="nt">${Number(note).toFixed(1)}${nbAvis ? ` · ${nbAvis} avis` : ''}</span></div>`
    : '';
  const media = img
    ? `<img class="card-img" src="${escapeHtml(img)}" alt="${escapeHtml(nom)}" loading="lazy"/>`
    : `<div class="card-img card-img-fb">${emoji}</div>`;
  return `<a class="card" href="${href}" data-cat="${cat||''}" data-catlabel="${escapeHtml(catlabel||'')}" data-catemoji="${catemoji||''}" data-name="${escapeHtml(String(nom||'').toLowerCase())}">
    <div class="card-media">${media}${tag ? `<span class="card-tag">${tag}</span>` : ''}</div>
    <div class="card-body">
      <div class="card-name">${escapeHtml(nom)}</div>
      ${ville ? `<div class="card-city">📍 ${escapeHtml(ville)}</div>` : ''}
      ${noteHtml}
    </div>
  </a>`;
}

function slugCat(s) {
  var t = String(s || '').toLowerCase();
  var out = '';
  for (var i = 0; i < t.length; i++) {
    var ch = t[i];
    if (ch >= 'a' && ch <= 'z') { out += ch; continue; }
    if (ch >= '0' && ch <= '9') { out += ch; continue; }
    if ('àâä'.indexOf(ch) !== -1) { out += 'a'; continue; }
    if ('éèêë'.indexOf(ch) !== -1) { out += 'e'; continue; }
    if ('îï'.indexOf(ch) !== -1) { out += 'i'; continue; }
    if ('ôö'.indexOf(ch) !== -1) { out += 'o'; continue; }
    if ('ûüù'.indexOf(ch) !== -1) { out += 'u'; continue; }
    if (ch === 'ç') { out += 'c'; continue; }
    out += '-';
  }
  while (out.indexOf('--') !== -1) out = out.replace('--', '-');
  if (out.charAt(0) === '-') out = out.slice(1);
  if (out.charAt(out.length - 1) === '-') out = out.slice(0, -1);
  return out;
}
var _EMOJI_COMMERCE = { coiffeur:'✂️', coiffure:'✂️', barbier:'✂️', institut:'💅', beaute:'💅', esthetique:'💅', ongle:'💅', restaurant:'🍽️', pizzeria:'🍕', boulangerie:'🥖', patisserie:'🧁', boucherie:'🥩', primeur:'🥬', fleuriste:'💐', opticien:'👓', pharmacie:'💊', fromagerie:'🧀', caviste:'🍷', bijouterie:'💍', chaussure:'👟', vetement:'👗', mode:'👗', tabac:'🚬', presse:'📰', garage:'🔧', auto:'🚗', immobilier:'🏠', banque:'🏦', assurance:'🛡️', tatouage:'🖋️', bar:'🍸', cafe:'☕' };
function emojiCommerce(cat) {
  var s = slugCat(cat);
  for (var k in _EMOJI_COMMERCE) { if (s.indexOf(k) !== -1) return _EMOJI_COMMERCE[k]; }
  return '🏪';
}

function fmtPrix(p) {
  if (p == null || p === '') return '';
  var n = Number(p);
  if (!isFinite(n) || n <= 0) return '';
  return n.toFixed(3).replace('.', ',') + ' €';
}
function carbCard(s) {
  var fuels = [['Gazole', s.prix_gazole], ['SP95', s.prix_sp95], ['SP98', s.prix_sp98], ['E10', s.prix_e10], ['E85', s.prix_e85], ['GPL', s.prix_gpl]];
  var rows = fuels.filter(function(f){ return fmtPrix(f[1]); }).map(function(f){ return `<div class='carb-fuel'><span class='carb-fn'>${f[0]}</span><span class='carb-fp'>${fmtPrix(f[1])}</span></div>`; }).join('');
  if (!rows) return '';
  var lieu = s.adresse ? s.adresse : (s.ville || '');
  var distTxt = (s._dist != null) ? s._dist.toFixed(1).replace('.', ',') + ' km' : '';
  var dDist = (s._dist != null) ? s._dist.toFixed(2) : '999';
  var dPrix = (Number(s.prix_gazole) > 0) ? Number(s.prix_gazole).toFixed(3) : '9.999';
  return `<div class='carb-card' data-dist='${dDist}' data-prix='${dPrix}'>` +
    `<div class='carb-top'><span class='carb-ville'>${escapeHtml(s.ville || '')}</span>${distTxt ? `<span class='carb-dist'>${distTxt}</span>` : ''}</div>` +
    (lieu ? `<div class='carb-adr'>${escapeHtml(lieu)}</div>` : '') +
    `<div class='carb-fuels'>${rows}</div>` +
  `</div>`;
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
/* LOKALIST_VILLE_ACTUS_V1:HELPERS:START */
const ACTU_MOIS = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
function actuDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.getDate() + ' ' + ACTU_MOIS[d.getMonth()] + ' ' + d.getFullYear();
}
function actuCard(a) {
  const media = a.photo_url
    ? `<img class="card-img" src="${escapeHtml(a.photo_url)}" alt="${escapeHtml(a.titre||'Actualite')}" loading="lazy"/>`
    : `<div class="card-img card-img-fb">📰</div>`;
  const raw = a.texte ? String(a.texte).replace(/\s+/g, ' ').trim() : '';
  const ex  = raw.slice(0, 110);
  return `<a class="card" href="/actu/${a.id}">
    <div class="card-media">${media}</div>
    <div class="card-body">
      <div class="card-name">${escapeHtml(a.titre||'Actualité')}</div>
      ${a.created_at ? `<div class="card-date">📅 ${escapeHtml(actuDateShort(a.created_at))}</div>` : ''}
      ${ex ? `<div class="card-excerpt">${escapeHtml(ex)}${raw.length > 110 ? '…' : ''}</div>` : ''}
    </div>
  </a>`;
}
function boutiqueCard(c) {
  const img = c.photo_url || c.logo_url;
  const media = img
    ? `<img class="card-img" src="${escapeHtml(img)}" alt="${escapeHtml(c.nom||'Boutique')}" loading="lazy"/>`
    : `<div class="card-img card-img-fb">🛍️</div>`;
  return `<a class="card" href="/pro/${c.id}">
    <div class="card-media">${media}<span class="shop-tag">🛍️ Click &amp; Collect</span></div>
    <div class="card-body">
      <div class="card-name">${escapeHtml(c.nom||'Boutique')}</div>
      ${c.ville ? `<div class="card-city">📍 ${escapeHtml(c.ville)}</div>` : ''}
      <span class="shop-btn">Commander →</span>
    </div>
  </a>`;
}
/* LOKALIST_VILLE_ACTUS_V1:HELPERS:END */
/* LOKALIST_VILLE_ALERTES_V1:HELPERS:START */
const ALERTE_MOIS = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
function alerteDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.getDate() + ' ' + ALERTE_MOIS[d.getMonth()] + ' ' + d.getFullYear();
}
const ALERTE_EMOJI = { travaux:'🚧', eau:'💧', meteo:'🌊', inondation:'🌊', secheresse:'🌵', circulation:'🚗', securite:'⚠️', sante:'🏥', info:'📢' };
function alerteEmoji(t) { return ALERTE_EMOJI[String(t || '').toLowerCase()] || '⚠️'; }
function alerteCard(a) {
  return `<div class="alerte-card">
    <div class="alerte-emoji">${alerteEmoji(a.type)}</div>
    <div>
      <div class="alerte-t">${escapeHtml(a.titre || 'Alerte')}</div>
      ${a.message ? `<div class="alerte-d">${escapeHtml(a.message)}</div>` : ''}
      ${a.created_at ? `<div class="alerte-date">🗓️ ${escapeHtml(alerteDateShort(a.created_at))}</div>` : ''}
    </div>
  </div>`;
}
function sectionAlertes(list) {
  if (!list || !list.length) return '';
  return `<section class="alertes">
    <div class="alertes-head"><span class="badge-live">● En cours</span><h2>Alertes &amp; infos</h2></div>
    ${list.map((a) => alerteCard(a)).join('')}
  </section>`;
}
/* LOKALIST_VILLE_ALERTES_V1:HELPERS:END */
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
      sb(`commercants?select=id,nom,ville,logo_url,photo_url,note_moyenne,nb_avis,categorie,latitude,longitude&statut=eq.actif&demo=is.false&ville=ilike.${vEnc}&order=note_moyenne.desc.nullslast`),
      sb(`artisans?select=id,nom,nom_entreprise,ville,photo_url,note_moyenne,nb_avis,certifie_rge,badge_verifie,categorie_id,latitude,longitude&statut=eq.actif&suspendu_plainte=eq.false&ville=ilike.${vEnc}&order=note_moyenne.desc.nullslast`),
      sb(`courtiers_immo?select=id,nom,ville,logo_url,note_moyenne,nb_avis&actif=eq.true&ville=ilike.${vEnc}&order=note_moyenne.desc.nullslast`),
      sb(`agences_immo?select=id,nom,communes,logo_url,note_moyenne,nb_avis&actif=eq.true&communes=cs.${encodeURIComponent('{"' + ville + '"}')}&order=note_moyenne.desc.nullslast`),
      sb(`mairies_partenaires?select=*&statut=eq.actif&ville=ilike.${vEnc}&limit=1`),
    ]);

    const mairie = mairies && mairies[0] ? mairies[0] : null;
const metiersRef = await sb('categories_artisans?select=id,nom,emoji');
const metierMap = {};
(metiersRef || []).forEach(function(m){ metierMap[m.id] = m; });
    /* LOKALIST_VILLE_ALERTES_V1:FETCH:START */
    const alertes = (mairie && mairie.id)
      ? await sb(`alertes_mairie?mairie_id=eq.${mairie.id}&statut=eq.active&select=id,titre,message,type,created_at&order=created_at.desc&limit=5`)
      : [];
    const secAlertes = sectionAlertes(alertes || []);
    /* LOKALIST_VILLE_ALERTES_V1:FETCH:END */
    /* LOKALIST_VILLE_ACTUS_V1:FETCH:START */
    const [actus, boutiques] = await Promise.all([
      (mairie && mairie.id)
        ? sb(`actus_mairie?mairie_id=eq.${mairie.id}&statut=eq.publie&select=id,titre,texte,photo_url,created_at&order=created_at.desc&limit=6`)
        : Promise.resolve([]),
      sb(`commercants?select=id,nom,ville,logo_url,photo_url&statut=eq.actif&ville=ilike.${vEnc}&cc_pack_actif=eq.true&demo=is.false&order=note_moyenne.desc.nullslast&limit=8`),
    ]);
    const secActus = section('Actualités de la commune', '📰',
      (actus || []).map((a) => actuCard(a)).join(''), (actus || []).length);
    const secBoutiques = section('Commander en ligne', '🛍️',
      (boutiques || []).map((c) => boutiqueCard(c)).join(''), (boutiques || []).length);
    /* LOKALIST_VILLE_ACTUS_V1:FETCH:END */
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
      commercants.map((c) => card(`/pro/${c.id}`, c.photo_url || c.logo_url, '🏪', c.nom, c.ville, +c.note_moyenne, c.nb_avis, '', slugCat(c.categorie), c.categorie || '', emojiCommerce(c.categorie))).join(''),
      commercants.length);

    const secArtisans = section('Artisans', '🔧',
      artisans.map((a) => { var _m = metierMap[a.categorie_id]; return card(`/artisan/${a.id}`, a.photo_url, '🔧',
        a.nom_entreprise || a.nom, a.ville, +a.note_moyenne, a.nb_avis,
        a.certifie_rge ? 'RGE' : (a.badge_verifie ? '✓ Vérifié' : ''),
        slugCat(_m && _m.nom), (_m && _m.nom) || '', (_m && _m.emoji) || '🔧'); }).join(''),
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
    // Communes voisines avec contenu (maillage SEO)
    let voisines = [];
    try {
      const _dLat = 0.25, _dLng = 0.35;
      const _bbox = `lat=gte.${commune.lat - _dLat}&lat=lte.${commune.lat + _dLat}&lng=gte.${commune.lng - _dLng}&lng=lte.${commune.lng + _dLng}`;
      const [_proche, _cv, _av, _mv] = await Promise.all([
        sb(`communes_ref?select=nom,code_postal,lat,lng&${_bbox}&limit=400`),
        sb(`commercants?select=ville&statut=eq.actif&demo=is.false`),
        sb(`artisans?select=ville&statut=eq.actif&suspendu_plainte=eq.false`),
        sb(`mairies_partenaires?select=ville&statut=eq.actif`),
      ]);
      const _content = {};
      [].concat(_cv || [], _av || [], _mv || []).forEach(function(r){ if (r && r.ville) _content[slugify(r.ville)] = true; });
      const _R = 6371, _toRad = function(d){ return d * Math.PI / 180; };
      voisines = (_proche || [])
        .filter(function(c){ return c && c.nom && c.lat != null && c.lng != null && slugify(c.nom) !== want && _content[slugify(c.nom)]; })
        .map(function(c){
          const _dla = _toRad(c.lat - commune.lat), _dln = _toRad(c.lng - commune.lng);
          const _a = Math.sin(_dla/2)*Math.sin(_dla/2) + Math.cos(_toRad(commune.lat))*Math.cos(_toRad(c.lat))*Math.sin(_dln/2)*Math.sin(_dln/2);
          return { nom: c.nom, cp: c.code_postal, dist: _R * 2 * Math.atan2(Math.sqrt(_a), Math.sqrt(1 - _a)) };
        })
        .sort(function(x, y){ return x.dist - y.dist; })
        .slice(0, 8);
    } catch (e) { console.error('[ville voisines]', e); }
    const secVoisines = voisines.length ? `
    <section class='section'>
      <h2><span class='s-emoji'>📍</span> Communes voisines</h2>
      <div class='voisines-grid'>
        ${voisines.map(function(v){ return `<a class='voisine-chip' href='${SITE_URL}/villes/${slugify(v.nom)}'>${escapeHtml(v.nom)}${v.cp ? ` <span>${escapeHtml(v.cp)}</span>` : ''}</a>`; }).join('')}
      </div>
    </section>` : '';
    // Carburants proches (rayon ~10km)
    let stations = [];
    try {
      const _kLat = 0.09, _kLng = 0.14;
      const _cbbox = `latitude=gte.${commune.lat - _kLat}&latitude=lte.${commune.lat + _kLat}&longitude=gte.${commune.lng - _kLng}&longitude=lte.${commune.lng + _kLng}`;
      const _st = await sb(`stations_carburant?select=id,ville,adresse,code_postal,latitude,longitude,prix_gazole,prix_sp95,prix_sp98,prix_e10,prix_e85,prix_gpl&${_cbbox}&limit=200`);
      const _R3 = 6371, _rad = function(d){ return d * Math.PI / 180; };
      stations = (_st || [])
        .filter(function(s){ return s && s.latitude != null && s.longitude != null && (s.prix_gazole || s.prix_sp95 || s.prix_sp98 || s.prix_e10 || s.prix_e85 || s.prix_gpl); })
        .map(function(s){
          const _dla = _rad(s.latitude - commune.lat), _dln = _rad(s.longitude - commune.lng);
          const _a = Math.sin(_dla/2)*Math.sin(_dla/2) + Math.cos(_rad(commune.lat))*Math.cos(_rad(s.latitude))*Math.sin(_dln/2)*Math.sin(_dln/2);
          s._dist = _R3 * 2 * Math.atan2(Math.sqrt(_a), Math.sqrt(1 - _a));
          return s;
        })
        .sort(function(a, b){ return a._dist - b._dist; })
        .slice(0, 8);
    } catch (e) { console.error('[ville carburants]', e); }
    const secCarburants = stations.length ? `
    <section class='section'>
      <div class='carb-head'>
        <h2><span class='s-emoji'>⛽</span> Carburants près de ${escapeHtml(ville)}</h2>
        <div class='carb-sort'>
          <button type='button' class='carb-sortbtn on' data-sort='dist'>📍 Plus proche</button>
          <button type='button' class='carb-sortbtn' data-sort='prix'>💶 Moins cher</button>
        </div>
      </div>
      <div class='carb-grid' id='carb-grid'>${stations.map(function(s){ return carbCard(s); }).join('')}</div>
      <div class='carb-note'>Prix indicatifs (open data). Le tri « moins cher » se base sur le gazole.</div>
    </section>` : '';
    const secUrgences = `
    <section class='section'>
      <h2><span class='s-emoji'>🚨</span> Numéros d'urgence</h2>
      <a class='urg-112' href='tel:112'><span class='urg-112-n'>112</span><span class='urg-112-s'>Toutes urgences</span></a>
      <div class='urg-grid'>
        <a class='urg-num' href='tel:15'><span class='urg-n'>15</span><span class='urg-s'>SAMU</span></a>
        <a class='urg-num' href='tel:18'><span class='urg-n'>18</span><span class='urg-s'>Pompiers</span></a>
        <a class='urg-num' href='tel:17'><span class='urg-n'>17</span><span class='urg-s'>Police</span></a>
        <a class='urg-num' href='sms:114'><span class='urg-n'>114</span><span class='urg-s'>SMS / sourds</span></a>
      </div>
      <div class='urg-ecoute'>
        <div class='urg-ecoute-h'>Écoute et signalement — lignes nationales gratuites, 24h/24</div>
        <a class='urg-erow' href='tel:3114'><span class='urg-enum'>3114</span><span class='urg-etxt'><strong>Prévention du suicide</strong><em>Professionnels de santé</em></span></a>
        <a class='urg-erow' href='tel:119'><span class='urg-enum'>119</span><span class='urg-etxt'><strong>Enfance en danger</strong><em>Signalement</em></span></a>
        <a class='urg-erow' href='tel:3919'><span class='urg-enum'>3919</span><span class='urg-etxt'><strong>Violences femmes info</strong><em>Écoute et orientation</em></span></a>
        <a class='urg-erow' href='tel:115'><span class='urg-enum'>115</span><span class='urg-etxt'><strong>Hébergement d'urgence</strong><em>SAMU social</em></span></a>
      </div>
      <p class='urg-note'>En cas d'urgence vitale, appelez le 112. Lokalist ne remplace pas les services de secours.</p>
    </section>`;
    // Carte : marqueurs pros + defibrillateurs
    let _markers = [];
    (commercants || []).forEach(function(c){ if (c.latitude && c.longitude) _markers.push({ lat:c.latitude, lng:c.longitude, type:'pro', name:c.nom, url:'/pro/'+c.id }); });
    (artisans || []).forEach(function(a){ if (a.latitude && a.longitude) _markers.push({ lat:a.latitude, lng:a.longitude, type:'pro', name:(a.nom_entreprise||a.nom), url:'/artisan/'+a.id }); });
    try {
      const _mLat = 0.07, _mLng = 0.11;
      const _dbbox = `lat=gte.${commune.lat - _mLat}&lat=lte.${commune.lat + _mLat}&lon=gte.${commune.lng - _mLng}&lon=lte.${commune.lng + _mLng}`;
      const _defs = await sb(`defibrillateurs?select=nom,adresse,commune,lat,lon&commune=ilike.*${encodeURIComponent(ville)}*&limit=300`);
      (_defs || []).forEach(function(d){ if (d.lat && d.lon) _markers.push({ lat:d.lat, lng:d.lon, type:'defib', name:(d.nom || 'Défibrillateur'), url:'' }); });
    } catch (e) { console.error('[ville carte]', e); }
    const secCarte = _markers.length ? `
    <section class='section'>
      <h2><span class='s-emoji'>🗺️</span> Carte de ${escapeHtml(ville)}</h2>
      <div class='ville-map' id='ville-map' data-clat='${commune.lat}' data-clng='${commune.lng}'></div>
      <div class='map-legend'><span class='ml-pro'>● Commerçants & artisans</span><span class='ml-def'>● Défibrillateurs</span></div>
      <div id='map-pts' hidden>${_markers.map(function(m){ return `<span class='map-pt' data-lat='${m.lat}' data-lng='${m.lng}' data-type='${m.type}' data-name='${escapeHtml(String(m.name||''))}' data-url='${m.url}'></span>`; }).join('')}</div>
    </section>` : '';
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
  .hero-mairie { display:inline-flex;align-items:center;gap:9px;margin-top:14px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);padding:6px 14px 6px 6px;border-radius:30px; }
  .hero-mairie img { width:34px;height:34px;border-radius:50%;object-fit:cover;background:#fff;flex-shrink:0; }
  .hero-mairie span { font-size:13px;font-weight:700;color:#fff;letter-spacing:.2px; }
  .mairie-tag { font-size:11.5px;font-weight:800;color:var(--primary-d);text-transform:uppercase;letter-spacing:.6px; }
  .mairie-nom { font-family:var(--disp);font-size:21px;font-weight:800;letter-spacing:-.4px;margin-top:1px; }
  .mairie-desc { color:var(--text);font-size:14.5px;margin-top:12px;line-height:1.6;white-space:pre-line; }
  .mairie-links { display:flex;flex-wrap:wrap;gap:9px;margin-top:14px; }
  .mairie-links a { background:var(--primary-l);color:var(--primary-d);font-size:13px;font-weight:700;padding:8px 14px;border-radius:22px;transition:background .15s; }
  .mairie-links a:hover { background:#d5f0e6; }

  .section { margin-top:34px; }
  .ville-map { height:380px;border-radius:16px;overflow:hidden;border:1px solid var(--border);margin-bottom:8px;z-index:0; }
  .map-legend { display:flex;flex-wrap:wrap;gap:16px;font-size:12px;font-weight:700; }
  .map-legend .ml-pro { color:#1D9E75; }
  .map-legend .ml-def { color:#E24B4A; }
  .urg-112 { display:flex;align-items:center;gap:14px;background:#E24B4A;color:#fff;border-radius:16px;padding:16px 18px;text-decoration:none;margin-bottom:10px; }
  .urg-112-n { font-size:24px;font-weight:800; }
  .urg-112-s { font-size:13px;opacity:.92; }
  .urg-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px; }
  .urg-num { display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 14px;text-decoration:none;color:var(--text); }
  .urg-n { font-size:17px;font-weight:800;color:#E24B4A;min-width:38px; }
  .urg-s { font-size:12px;color:var(--muted);font-weight:600; }
  .urg-ecoute { background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px;margin-top:12px; }
  .urg-ecoute-h { font-size:12.5px;font-weight:700;color:var(--muted);margin-bottom:10px; }
  .urg-erow { display:flex;align-items:center;gap:14px;background:var(--primary-l);border-radius:10px;padding:10px 14px;margin-bottom:8px;text-decoration:none; }
  .urg-enum { font-size:16px;font-weight:800;color:var(--text);min-width:52px; }
  .urg-etxt { display:flex;flex-direction:column; }
  .urg-etxt strong { font-size:13px;color:var(--text);font-weight:700; }
  .urg-etxt em { font-size:11px;color:var(--muted);font-style:normal; }
  .urg-note { font-size:11px;color:var(--muted);margin-top:10px;font-style:italic;text-align:center; }
  .hero-cta-2 { display:inline-flex;align-items:center;gap:8px;margin-top:26px;margin-left:10px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.5);color:#fff;font-weight:700;font-size:14px;padding:13px 22px;border-radius:14px;text-decoration:none;transition:all .15s; }
  .hero-cta-2:hover { background:rgba(255,255,255,.24); }
  .projet-cta { display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;background:linear-gradient(135deg,#FEF3E2,#FDE8CC);border:1px solid #F5D9A8;border-radius:16px;padding:18px 20px;margin-top:34px; }
  .projet-cta-txt { display:flex;flex-direction:column;gap:2px; }
  .projet-cta-txt strong { font-size:16px;color:#8a5a12; }
  .projet-cta-txt span { font-size:13px;color:#9a6a22; }
  .projet-cta-btn { background:var(--accent,#EF9F27);color:#fff;font-weight:800;font-size:14px;padding:12px 22px;border-radius:12px;text-decoration:none;white-space:nowrap; }
  .projet-cta-btn:hover { filter:brightness(1.05); }
  @media (max-width:600px){ .hero-cta-2{margin-left:0;} .projet-cta-btn{width:100%;text-align:center;} }
  .carb-head { display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px; }
  .carb-sort { display:flex;gap:6px; }
  .carb-sortbtn { cursor:pointer;border:1px solid var(--border);background:var(--surface);color:var(--text);padding:7px 12px;border-radius:20px;font-size:12.5px;font-weight:700; }
  .carb-sortbtn.on { background:var(--primary);color:#fff;border-color:var(--primary); }
  .carb-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px; }
  .carb-card { background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px; }
  .carb-top { display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:2px; }
  .carb-ville { font-weight:800;font-size:15px;color:var(--text); }
  .carb-dist { font-size:12px;font-weight:700;color:var(--primary-d);background:var(--primary-l);padding:2px 8px;border-radius:10px;white-space:nowrap; }
  .carb-adr { font-size:12px;color:var(--muted);margin-bottom:8px; }
  .carb-fuels { display:flex;flex-wrap:wrap;gap:6px; }
  .carb-fuel { display:flex;flex-direction:column;background:var(--primary-l);border-radius:8px;padding:6px 10px;min-width:62px; }
  .carb-fn { font-size:10.5px;font-weight:700;color:var(--primary-d);text-transform:uppercase;letter-spacing:.4px; }
  .carb-fp { font-size:14px;font-weight:800;color:var(--text); }
  .carb-note { font-size:11px;color:var(--muted);margin-top:10px;font-style:italic; }
  .voisines-grid { display:flex;flex-wrap:wrap;gap:8px; }
  .voisine-chip { display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border);color:var(--text);padding:9px 14px;border-radius:12px;font-size:13px;font-weight:700;text-decoration:none;transition:all .12s; }
  .voisine-chip:hover { border-color:var(--primary);color:var(--primary-d); }
  .voisine-chip span { font-weight:600;color:var(--muted);font-size:12px; }
  .section h2 { font-family:var(--disp);font-size:clamp(19px,2.4vw,24px);font-weight:800;letter-spacing:-.5px;display:flex;align-items:center;gap:9px;margin-bottom:16px; }
  .section h2 .s-emoji { font-size:.9em; }
  .section h2 .count { background:var(--primary-l);color:var(--primary-d);font-size:13px;font-weight:800;padding:2px 11px;border-radius:22px; }
  .grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(232px,1fr));gap:18px; }
  .filtres { margin:20px 0 6px;display:flex;flex-direction:column;gap:10px; }
  .filtre-search { width:100%;max-width:420px;padding:11px 14px;border:1px solid var(--border);border-radius:12px;font-size:14px;outline:none;background:var(--surface); }
  .filtre-search:focus { border-color:var(--primary); }
  .filtre-pills { display:flex;flex-wrap:wrap;gap:8px; }
  .filtre-pill { cursor:pointer;border:1px solid var(--border);background:var(--surface);color:var(--text);padding:8px 14px;border-radius:20px;font-size:13px;font-weight:700;transition:all .12s; }
  .filtre-pill:hover { border-color:var(--primary); }
  .filtre-pill.on { background:var(--primary);color:#fff;border-color:var(--primary); }
  .filtre-count { font-size:12.5px;color:var(--muted);font-weight:600; }
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
    ${mairie && mairie.logo_url ? `<div class="hero-mairie"><img src="${escapeHtml(mairie.logo_url)}" alt="Mairie de ${escapeHtml(ville)}" loading="lazy"/><span>🏛️ Mairie partenaire</span></div>` : ''}
    <p class="lead">Tous les commerçants, artisans et services de proximité de ${escapeHtml(ville)} réunis au même endroit. Soutenez l'économie locale et profitez des bons plans près de chez vous.</p>
    ${pillsHtml ? `<div class="pills">${pillsHtml}</div>` : ''}
    <a class="hero-cta" href="${PLAY_STORE_URL}" id="btn-download-hero">📱 Télécharger Lokalist</a>
    <a class="hero-cta-2" href="${SITE_URL}/deposer-projet">🛠️ Déposer un projet</a>
  </div>
</section>

<main class="wrap">
  ${mairieHtml}
  ${secCarte}
  ${secAlertes}
  ${secEvenements}
  ${secActus}
  <div class='filtres' id='filtres' hidden>
    <input class='filtre-search' id='filtre-search' type='search' placeholder='Rechercher un commerçant, un artisan...' aria-label='Rechercher un professionnel'/>
    <div class='filtre-pills' id='filtre-pills'></div>
    <div class='filtre-count' id='filtre-count'></div>
  </div>
  ${secCommercants}
  ${secBoutiques}
  <div class='projet-cta'>
    <div class='projet-cta-txt'><strong>🛠️ Un projet de travaux à ${escapeHtml(ville)} ?</strong><span>Décrivez votre besoin, recevez des devis d'artisans locaux — gratuit.</span></div>
    <a class='projet-cta-btn' href='${SITE_URL}/deposer-projet'>Déposer un projet</a>
  </div>
  ${secArtisans}
  ${secBonsPlans}
  ${secAgences}
  ${secCourtiers}
  ${secCarburants}
  ${secSorties}
  ${secVoisines}

  ${secUrgences}
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
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
  var el = document.getElementById('ville-map');
  if (!el || typeof L === 'undefined') return;
  var pts = [].slice.call(document.querySelectorAll('#map-pts .map-pt'));
  if (!pts.length) return;
  var clat = parseFloat(el.getAttribute('data-clat'));
  var clng = parseFloat(el.getAttribute('data-clng'));
  var map = L.map('ville-map', { scrollWheelZoom: false }).setView([clat, clng], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
  var bounds = [];
  pts.forEach(function(p){
    var lat = parseFloat(p.getAttribute('data-lat'));
    var lng = parseFloat(p.getAttribute('data-lng'));
    if (isNaN(lat) || isNaN(lng)) return;
    var type = p.getAttribute('data-type');
    var name = p.getAttribute('data-name') || '';
    var url = p.getAttribute('data-url') || '';
    var color = (type === 'defib') ? '#E24B4A' : '#1D9E75';
    var icon = L.divIcon({ className: '', iconSize: [16,16], iconAnchor: [8,8], html: '<div style="width:16px;height:16px;border-radius:50%;background:' + color + ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>' });
    var mk = L.marker([lat, lng], { icon: icon }).addTo(map);
    if (url) mk.bindPopup('<a href="' + url + '" style="font-weight:700;color:#1D9E75">' + name + '</a>');
    else mk.bindPopup('<strong>' + (type === 'defib' ? '❤️ ' : '') + name + '</strong>');
    bounds.push([lat, lng]);
  });
  if (bounds.length > 1) { try { map.fitBounds(bounds, { padding: [30,30], maxZoom: 16 }); } catch(e){} }
})();
</script>
<script>
(function(){
  var grid = document.getElementById('carb-grid');
  if (!grid) return;
  var btns = document.querySelectorAll('.carb-sortbtn');
  function sortBy(key){
    var attr = (key === 'prix') ? 'data-prix' : 'data-dist';
    var cards = [].slice.call(grid.querySelectorAll('.carb-card'));
    cards.sort(function(a,b){ return parseFloat(a.getAttribute(attr)) - parseFloat(b.getAttribute(attr)); });
    cards.forEach(function(c){ grid.appendChild(c); });
  }
  for (var i=0;i<btns.length;i++){
    btns[i].addEventListener('click', function(){
      var k = this.getAttribute('data-sort');
      for (var j=0;j<btns.length;j++) btns[j].classList.remove('on');
      this.classList.add('on');
      sortBy(k);
    });
  }
})();
</script>

<script>
(function(){
  var box = document.getElementById('filtres');
  if (!box) return;
  var cards = [].slice.call(document.querySelectorAll('.card[data-cat]'));
  if (!cards.length) return;
  var cats = {};
  cards.forEach(function(c){
    var k = c.getAttribute('data-cat');
    if (!k) return;
    if (!cats[k]) cats[k] = { label: c.getAttribute('data-catlabel') || k, emoji: c.getAttribute('data-catemoji') || '', n: 0 };
    cats[k].n++;
  });
  var keys = Object.keys(cats);
  if (keys.length < 2) return;
  box.hidden = false;
  keys.sort(function(a,b){ return cats[b].n - cats[a].n; });
  var pillsWrap = document.getElementById('filtre-pills');
  var searchInp = document.getElementById('filtre-search');
  var countEl = document.getElementById('filtre-count');
  var current = 'all';
  function mkPill(slug, label){
    var b = document.createElement('button');
    b.className = 'filtre-pill';
    b.setAttribute('data-f', slug);
    b.textContent = label;
    b.addEventListener('click', function(){ current = slug; setActive(); apply(); });
    return b;
  }
  pillsWrap.appendChild(mkPill('all', 'Tout'));
  keys.forEach(function(k){ pillsWrap.appendChild(mkPill(k, (cats[k].emoji ? cats[k].emoji + ' ' : '') + cats[k].label)); });
  function setActive(){
    var all = pillsWrap.querySelectorAll('.filtre-pill');
    for (var i=0;i<all.length;i++){
      if (all[i].getAttribute('data-f') === current) all[i].classList.add('on');
      else all[i].classList.remove('on');
    }
  }
  function apply(){
    var q = (searchInp && searchInp.value ? searchInp.value : '').toLowerCase().trim();
    var visible = 0;
    cards.forEach(function(c){
      var okCat = (current === 'all') || (c.getAttribute('data-cat') === current);
      var name = c.getAttribute('data-name') || '';
      var okName = !q || name.indexOf(q) !== -1;
      var show = okCat && okName;
      c.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    var sections = document.querySelectorAll('main .section');
    for (var s=0;s<sections.length;s++){
      var dcards = sections[s].querySelectorAll('.card[data-cat]');
      if (!dcards.length) continue;
      var vis = 0;
      for (var j=0;j<dcards.length;j++){ if (dcards[j].style.display !== 'none') vis++; }
      sections[s].style.display = vis ? '' : 'none';
      var cnt = sections[s].querySelector('.count');
      if (cnt) cnt.textContent = vis;
    }
    if (countEl) countEl.textContent = visible + ' résultat' + (visible > 1 ? 's' : '');
  }
  if (searchInp) searchInp.addEventListener('input', apply);
  setActive();
  apply();
})();
</script>

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

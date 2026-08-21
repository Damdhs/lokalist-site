// ════════════════════════════════════════════════════════════════
//  api/hebergement.js — Vercel Edge Function
//  SENT: [LKL_HEB_LOT1] Page HTML SSR premium pour /hebergement/:slug
//  SENT: [LKL_HEB_LOT2] Galerie photos + multi-tarifs + logo Lokalist
//  SENT: [LKL_HEB_LOT3] Section "A faire dans les environs" auto-geo (packs_loisir)
//        (remplace le renard) + bloc "Comment reserver" + note prix.
//  Hebergeur = commercant (type_pro='hebergeur', resa_type='sejour')
//  - URL SEO: /hebergement/<nom-slug>-<uuid>  (uuid = 36 car.)
//  - Contact COMPLET: telephone / email / site / adresse (+ reseaux)
//  - Galerie via colonne photos (jsonb), tarifs via colonne tarifs (jsonb)
// ════════════════════════════════════════════════════════════════

export const config = { runtime: 'edge' };

const SUPABASE_URL  = 'https://kukathominhssogthplc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a2F0aG9taW5oc3NvZ3RocGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTU2NDMsImV4cCI6MjA5MDQzMTY0M30.nrfnhLWA_N-d5EA0qMvSTgSvbebbqHvWuCwk4PQDxcg';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=fr.lokalist.app';
const APP_STORE_URL  = 'https://apps.apple.com/app/lokalist';
const SITE_URL       = 'https://lokalist.fr';
const LOGO_URL       = `${SITE_URL}/logo.png`;

const HEB_LABELS = {
  hotel:         'Hotel',
  gite:          'Gite',
  meuble:        'Meuble de tourisme',
  chambre_hotes: "Chambre d'hotes",
};

// ─── Helpers ────────────────────────────────────────────────────
const escapeHtml = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const sanitizeRef = (ref) => {
  if (!ref) return '';
  const up = String(ref).toUpperCase().trim();
  return /^LOK-[A-Z0-9]{6}$/.test(up) ? up : '';
};

function normUrl(v) {
  if (!v) return '';
  var u = String(v).trim();
  while (u.charAt(0) === '/') u = u.slice(1);
  var low = u.toLowerCase();
  if (low.indexOf('http://') !== 0 && low.indexOf('https://') !== 0) u = 'https://' + u;
  return u;
}

function socialUrl(kind, v) {
  if (!v) return '';
  var raw = String(v).trim();
  var low = raw.toLowerCase();
  if (low.indexOf('http://') === 0 || low.indexOf('https://') === 0) return raw;
  var handle = raw.charAt(0) === '@' ? raw.slice(1) : raw;
  while (handle.charAt(0) === '/') handle = handle.slice(1);
  if (kind === 'instagram') return 'https://instagram.com/' + handle;
  if (kind === 'tiktok')    return 'https://tiktok.com/@' + handle;
  if (kind === 'facebook')  return 'https://facebook.com/' + handle;
  return normUrl(raw);
}

function slugify(s) {
  var out = String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return (out || 'hebergement').slice(0, 60).replace(/-+$/g, '');
}

var UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
function extractId(raw) {
  if (!raw) return '';
  var m = String(raw).match(UUID_RE);
  return m ? m[0].toLowerCase() : '';
}

const html404 = (msg) => `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Hebergement introuvable — Lokalist</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#F9F8F6;color:#1A1A2E;padding:40px 20px;text-align:center;line-height:1.6}h1{color:#1D9E75;font-size:28px;margin:24px 0 8px}a{color:#1D9E75;font-weight:600;text-decoration:none}</style>
</head><body>
<div style="font-size:64px">🏡</div>
<h1>${escapeHtml(msg)}</h1>
<p style="color:#8A8FA8">Cet hebergement n'existe plus ou a ete retire.</p>
<p><a href="${SITE_URL}">← Retour a Lokalist</a></p>
</body></html>`;

const pageNotFound = (msg = "Hebergement introuvable") => new Response(html404(msg), {
  status: 404,
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
});

// ─── Handler principal ──────────────────────────────────────────
export default async function handler(req) {
  try {
    const url  = new URL(req.url);
    const slug = url.searchParams.get('slug') || url.searchParams.get('id') || '';
    const id   = extractId(slug);
    const ref  = sanitizeRef(url.searchParams.get('ref'));

    if (!id) return pageNotFound("Identifiant invalide");

    const cols = [
      'id','nom','ville','adresse','latitude','longitude','description',
      'photo_url','logo_url','photos','tarifs','note_moyenne','nb_avis','type_pro','actif','demo',
      'telephone','email','site_web','instagram','facebook','tiktok','lien_reservation',
      'resa_type','resa_visible','hebergement_type','prix_indicatif_nuit',
      'capacite','nb_chambres','classement_etoiles','num_enregistrement'
    ].join(',');

    const apiUrl = `${SUPABASE_URL}/rest/v1/commercants?id=eq.${id}&select=${cols}`;
    const r = await fetch(apiUrl, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
    });
    if (!r.ok) return pageNotFound("Erreur lors du chargement");
    const list = await r.json();
    if (!list || !list.length) return pageNotFound();
    const c = list[0];

    if (c.demo === true) return pageNotFound("Fiche non disponible");
    if (c.actif === false) return pageNotFound("Cet hebergement n'est plus actif");
    if (c.type_pro !== 'hebergeur') return pageNotFound("Cette page est reservee aux hebergements");

    // ─── Avis verifies ───
    let avisMoyenne = 0, avisNb = 0, avisListe = [];
    try {
      const avUrl = `${SUPABASE_URL}/rest/v1/avis_public?cible_type=eq.commercant&cible_id=eq.${id}&order=date_publication.desc&limit=20`;
      const agUrl = `${SUPABASE_URL}/rest/v1/avis_agrege?cible_type=eq.commercant&cible_id=eq.${id}`;
      const [avR, agR] = await Promise.all([
        fetch(avUrl, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }),
        fetch(agUrl, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }),
      ]);
      avisListe = avR.ok ? (await avR.json()) : [];
      const agg = agR.ok ? (await agR.json()) : [];
      if (agg && agg[0]) { avisMoyenne = Number(agg[0].note_moyenne) || 0; avisNb = agg[0].nb_avis || 0; }
    } catch (e) { console.error('[heb avis]', e); }

    // ─── A faire dans les environs (idees sorties geolocalisees) ───
    let environs = [];
    try {
      const _hlat = Number(c.latitude), _hlng = Number(c.longitude);
      if (!isNaN(_hlat) && !isNaN(_hlng)) {
        const _eLat = 0.27, _eLng = 0.40; // ~30 km
        const _ebbox = `latitude=gte.${_hlat - _eLat}&latitude=lte.${_hlat + _eLat}&longitude=gte.${_hlng - _eLng}&longitude=lte.${_hlng + _eLng}`;
        const _eUrl = `${SUPABASE_URL}/rest/v1/packs_loisir?select=id,nom,ville,photo_url,prix_pack,prix_normal,reduction_pct,actif,latitude,longitude&actif=eq.true&demo=is.false&${_ebbox}&limit=200`;
        const _eR = await fetch(_eUrl, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } });
        const _packs = _eR.ok ? (await _eR.json()) : [];
        const _R = 6371, _rad = function(d){ return d * Math.PI / 180; };
        environs = (_packs || [])
          .filter(function(p){ return p && p.latitude != null && p.longitude != null; })
          .map(function(p){
            const _dla = _rad(p.latitude - _hlat), _dln = _rad(p.longitude - _hlng);
            const _a = Math.sin(_dla/2)*Math.sin(_dla/2) + Math.cos(_rad(_hlat))*Math.cos(_rad(p.latitude))*Math.sin(_dln/2)*Math.sin(_dln/2);
            p._dist = _R * 2 * Math.atan2(Math.sqrt(_a), Math.sqrt(1 - _a));
            return p;
          })
          .filter(function(p){ return p._dist <= 30; })
          .sort(function(a, b){ return a._dist - b._dist; })
          .slice(0, 6);
      }
    } catch (e) { console.error('[heb environs]', e); }

    const etoiles = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
    const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' }); } catch { return ''; } };
    const avisHtml = (avisListe || []).map((a) => `
      <div class="avis-card">
        <div class="avis-head">
          <div class="avis-auteur">${escapeHtml(a.auteur_nom || 'Voyageur')}</div>
          ${a.verified ? '<span class="avis-verif">✓ Verifie</span>' : ''}
        </div>
        <div class="avis-stars">${etoiles(a.note)}</div>
        ${a.titre ? `<div class="avis-titre">${escapeHtml(a.titre)}</div>` : ''}
        ${a.commentaire ? `<div class="avis-txt">${escapeHtml(a.commentaire)}</div>` : ''}
        <div class="avis-date">${fmtDate(a.date_publication)}</div>
        ${a.reponse ? `<div class="avis-rep"><div class="avis-rep-lab">Reponse de l'hote</div>${escapeHtml(a.reponse)}</div>` : ''}
      </div>`).join('');

    // ─── Photos (galerie) ───
    const photos = Array.isArray(c.photos) ? c.photos.filter((p) => typeof p === 'string' && p.trim()) : [];
    const mainPhoto = photos[0] || c.photo_url || null;
    const photoOg   = mainPhoto || `${SITE_URL}/images/og-default.jpg`;

    // ─── Tarifs (multi) ───
    const tarifs = Array.isArray(c.tarifs)
      ? c.tarifs.filter((t) => t && t.prix !== undefined && t.prix !== null && !isNaN(Number(t.prix)))
      : [];
    const prixIndic = (c.prix_indicatif_nuit !== null && c.prix_indicatif_nuit !== undefined && c.prix_indicatif_nuit !== '')
      ? Math.round(Number(c.prix_indicatif_nuit))
      : (tarifs.length ? Math.min.apply(null, tarifs.map((t) => Number(t.prix))) : null);

    // ─── Donnees ───
    const nom         = c.nom || 'Hebergement local';
    const ville       = c.ville || '';
    const typeLabel   = HEB_LABELS[c.hebergement_type] || 'Hebergement';
    const etos        = Number(c.classement_etoiles) || 0;
    const capacite    = Number(c.capacite) || 0;
    const chambres    = Number(c.nb_chambres) || 0;
    const description = c.description || `${typeLabel}${ville ? ' a ' + ville : ''} — sur Lokalist, l'app de la vie locale`;
    const descShort   = (description.length > 160 ? description.slice(0, 157) + '...' : description);
    const noteAff     = (avisNb > 0) ? avisMoyenne : (Number(c.note_moyenne) || 0);
    const nbAvisAff   = (avisNb > 0) ? avisNb : (Number(c.nb_avis) || 0);
    const peutResa    = (c.resa_visible === true) && (c.resa_type === 'sejour');

    const slugCanon = `${slugify(nom)}-${id}`;
    const canonical = `${SITE_URL}/hebergement/${slugCanon}`;
    const deepLink  = `lokalist://commercant/${id}`;

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "LodgingBusiness",
      "name": nom,
      "description": description,
      "image": photoOg,
      "url": canonical,
      ...(etos > 0 && { "starRating": { "@type": "Rating", "ratingValue": etos } }),
      ...(c.adresse && {
        "address": { "@type": "PostalAddress", "streetAddress": c.adresse, "addressLocality": ville, "addressCountry": "FR" }
      }),
      ...((c.latitude && c.longitude) && {
        "geo": { "@type": "GeoCoordinates", "latitude": Number(c.latitude), "longitude": Number(c.longitude) }
      }),
      ...(prixIndic !== null && { "priceRange": `${prixIndic} EUR / nuit` }),
      ...(noteAff > 0 && {
        "aggregateRating": { "@type": "AggregateRating", "ratingValue": Number(noteAff).toFixed(1), "reviewCount": nbAvisAff || 0 }
      }),
      ...(c.telephone && { telephone: c.telephone }),
      ...(c.email && { email: c.email }),
      ...((c.site_web || c.instagram || c.facebook || c.tiktok) && { sameAs: [
        ...(c.site_web ? [normUrl(c.site_web)] : []),
        ...(c.instagram ? [socialUrl('instagram', c.instagram)] : []),
        ...(c.facebook ? [socialUrl('facebook', c.facebook)] : []),
        ...(c.tiktok ? [socialUrl('tiktok', c.tiktok)] : []),
      ] }),
    };

    // ─── Galerie HTML ───
    const galleryHtml = photos.length
      ? `<div class="main"><img src="${escapeHtml(mainPhoto)}" alt="${escapeHtml(nom)}" loading="eager"/></div>
         ${photos.length > 1 ? `<div class="thumbs">${photos.slice(1, 8).map((p) => `<img src="${escapeHtml(p)}" alt="${escapeHtml(nom)}" loading="lazy"/>`).join('')}</div>` : ''}`
      : (c.photo_url
          ? `<div class="main"><img src="${escapeHtml(c.photo_url)}" alt="${escapeHtml(nom)}" loading="eager"/></div>`
          : `<div class="fallback">🏡</div>`);

    // ─── Faits ───
    const facts = [];
    if (capacite > 0) facts.push(`<div class="fact"><div class="fact-ic">👥</div><div class="fact-v">${capacite} voyageur${capacite>1?'s':''}</div></div>`);
    if (chambres > 0) facts.push(`<div class="fact"><div class="fact-ic">🛏️</div><div class="fact-v">${chambres} chambre${chambres>1?'s':''}</div></div>`);
    if (prixIndic !== null) facts.push(`<div class="fact"><div class="fact-ic">🏷️</div><div class="fact-v">des ${prixIndic} €<span class="fact-u">/nuit</span></div></div>`);
    const factsHtml = facts.length ? `<div class="facts">${facts.join('')}</div>` : '';

    // ─── Tarifs HTML ───
    const tarifsHtml = tarifs.length ? `
      <section class="section">
        <h2>Tarifs</h2>
        <div class="tarifs">
          ${tarifs.map((t) => `<div class="tarif-row"><span class="tarif-lab">${escapeHtml(t.label || '')}${t.unite ? ` <span class="tarif-u">· ${escapeHtml(t.unite)}</span>` : ''}</span><span class="tarif-prix">${Math.round(Number(t.prix))} €</span></div>`).join('')}
        </div>
        <div class="tarif-note">Total calcule selon vos dates, affiche avant paiement (taxe de sejour eventuelle incluse).</div>
      </section>` : '';

    // ─── Contact complet ───
    const contactRows = [];
    if (c.telephone) contactRows.push(`<a class="ct-row" href="tel:${escapeHtml(c.telephone)}"><span class="ct-ic">📞</span><span class="ct-body"><span class="ct-lab">Telephone</span><span class="ct-val">${escapeHtml(c.telephone)}</span></span></a>`);
    if (c.email)     contactRows.push(`<a class="ct-row" href="mailto:${escapeHtml(c.email)}"><span class="ct-ic">✉️</span><span class="ct-body"><span class="ct-lab">Email</span><span class="ct-val">${escapeHtml(c.email)}</span></span></a>`);
    if (c.site_web)  contactRows.push(`<a class="ct-row" href="${escapeHtml(normUrl(c.site_web))}" target="_blank" rel="noopener nofollow"><span class="ct-ic">🌐</span><span class="ct-body"><span class="ct-lab">Site web</span><span class="ct-val ct-link">${escapeHtml(String(c.site_web).replace(/^https?:\/\//,''))}</span></span></a>`);
    if (c.adresse)   contactRows.push(`<div class="ct-row"><span class="ct-ic">📍</span><span class="ct-body"><span class="ct-lab">Adresse</span><span class="ct-val">${escapeHtml(c.adresse)}${ville ? ', ' + escapeHtml(ville) : ''}</span></span></div>`);
    const socialChips = [];
    if (c.instagram) socialChips.push(`<a class="soc" href="${escapeHtml(socialUrl('instagram', c.instagram))}" target="_blank" rel="noopener nofollow">📷 Instagram</a>`);
    if (c.facebook)  socialChips.push(`<a class="soc" href="${escapeHtml(socialUrl('facebook', c.facebook))}" target="_blank" rel="noopener nofollow">👍 Facebook</a>`);
    if (c.tiktok)    socialChips.push(`<a class="soc" href="${escapeHtml(socialUrl('tiktok', c.tiktok))}" target="_blank" rel="noopener nofollow">🎵 TikTok</a>`);
    const contactHtml = (contactRows.length || socialChips.length) ? `
      <section class="section">
        <h2>Contact</h2>
        <div class="ct-list">${contactRows.join('')}</div>
        ${socialChips.length ? `<div class="soc-row">${socialChips.join('')}</div>` : ''}
      </section>` : '';

    // ─── Bloc explicatif "Comment reserver" + notes ───
    const explainHtml = `
      <section class="section">
        <h2>Comment reserver votre sejour</h2>
        <div class="steps">
          <div class="step"><div class="step-n">1</div><div><div class="step-t">Choisissez vos dates</div><div class="step-d">Consultez les disponibilites et selectionnez votre periode.</div></div></div>
          <div class="step"><div class="step-n">2</div><div><div class="step-t">Envoyez votre demande</div><div class="step-d">L'hote recoit votre demande et vous repond rapidement. Sans engagement.</div></div></div>
          <div class="step"><div class="step-n">3</div><div><div class="step-t">Sejour confirme</div><div class="step-d">Reglez en ligne en toute securite (acompte ou total). C'est reserve.</div></div></div>
        </div>
        <div class="notes">
          <div class="note-i"><span class="ni-ic">✅</span><div><b>Verifie Lokalist</b> — hebergeur authentifie sur la plateforme.</div></div>
          <div class="note-i"><span class="ni-ic">⭐</span><div><b>Avis verifies</b> — laisses apres un sejour, via un scan QR sur place.</div></div>
          <div class="note-i"><span class="ni-ic">ℹ️</span><div><b>Prix</b> — total calcule selon vos dates, affiche avant paiement.</div></div>
        </div>
      </section>`;

    const _distTxt = (d) => (d < 1 ? Math.round(d*1000) + ' m' : (d < 10 ? d.toFixed(1) : String(Math.round(d))) + ' km');
    const environsHtml = environs.length ? `
      <section class="section">
        <h2>A faire dans les environs</h2>
        <p class="env-sub">Idees de sorties pres de l'hebergement, selectionnees par Lokalist.</p>
        <div class="env-grid">
          ${environs.map((p) => `<a class="env-card" href="/sortie/${p.id}">
            <div class="env-media">${p.photo_url ? `<img src="${escapeHtml(p.photo_url)}" alt="${escapeHtml(p.nom||'Sortie')}" loading="lazy"/>` : `<div class="env-fb">🎉</div>`}</div>
            <div class="env-body">
              <div class="env-name">${escapeHtml(p.nom || 'Sortie')}</div>
              <div class="env-meta">📍 ${p.ville ? escapeHtml(p.ville) + ' · ' : ''}${_distTxt(p._dist)}</div>
            </div>
          </a>`).join('')}
        </div>
      </section>` : '';

    const body = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5"/>
<title>${escapeHtml(nom)}${ville ? ' — ' + escapeHtml(ville) : ''} — ${escapeHtml(typeLabel)} — Lokalist</title>
<meta name="description" content="${escapeHtml(descShort)}"/>
<link rel="canonical" href="${canonical}"/>

<meta property="og:type" content="website"/>
<meta property="og:site_name" content="Lokalist"/>
<meta property="og:title" content="${escapeHtml(nom)}${ville ? ' — ' + escapeHtml(ville) : ''}"/>
<meta property="og:description" content="${escapeHtml(descShort)}"/>
<meta property="og:image" content="${escapeHtml(photoOg)}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:url" content="${canonical}"/>
<meta property="og:locale" content="fr_FR"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(nom)}${ville ? ' — ' + escapeHtml(ville) : ''}"/>
<meta name="twitter:description" content="${escapeHtml(descShort)}"/>
<meta name="twitter:image" content="${escapeHtml(photoOg)}"/>

<meta name="apple-itunes-app" content="app-argument=${deepLink}"/>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<link rel="icon" href="/favicon.ico"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@500;600;700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet"/>

<style>
  :root{ --primary:#1D9E75;--primary-d:#0F6E56;--primary-l:#E1F5EE;--accent:#EF9F27;--bg:#F7F6F3;--surface:#FFF;--border:#ECE9E4;--text:#17231F;--muted:#8A8F8B;--radius:14px; }
  *{ box-sizing:border-box;margin:0;padding:0; }
  html,body{ font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;-webkit-font-smoothing:antialiased; }
  h1,h2,h3{ font-family:'Syne','DM Sans',sans-serif;letter-spacing:-0.3px; }
  a{ color:inherit; }
  .top-bar{ background:var(--surface);border-bottom:1px solid var(--border);padding:12px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10; }
  .top-bar .brand{ display:flex;align-items:center;gap:7px;font-family:'Syne';font-weight:700;font-size:18px;color:var(--primary-d);text-decoration:none; }
  .top-bar .brand img{ height:22px;width:auto;display:block; }
  .top-bar .verif{ display:flex;align-items:center;gap:6px;font-size:13px;color:var(--primary-d);font-weight:600; }
  .top-bar .verif img{ height:16px;width:auto;display:block; }
  .container{ max-width:720px;margin:0 auto;padding:0 16px; }
  .ref-banner{ background:var(--accent);color:#3A2600;text-align:center;padding:10px 16px;font-size:13px;font-weight:600; }

  .gallery{ margin-top:16px; }
  .gallery .main{ border-radius:16px;overflow:hidden; }
  .gallery .main img{ width:100%;height:320px;object-fit:cover;display:block;background:var(--primary-l); }
  .gallery .fallback{ width:100%;height:260px;border-radius:16px;background:var(--primary-l);display:flex;align-items:center;justify-content:center;font-size:80px; }
  .gallery .thumbs{ display:flex;gap:8px;margin-top:8px;overflow-x:auto;padding-bottom:2px; }
  .gallery .thumbs img{ width:104px;height:74px;object-fit:cover;border-radius:10px;flex:none;background:var(--primary-l); }

  .head{ margin-top:20px; }
  .badges{ display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px; }
  .badge{ background:var(--primary-l);color:var(--primary-d);font-size:12px;font-weight:600;padding:4px 11px;border-radius:20px; }
  .badge-stars{ color:var(--accent);font-size:13px;letter-spacing:1px; }
  .badge-verif{ display:inline-flex;align-items:center;gap:5px;background:#FAEEDA;color:#854F0B;font-size:12px;font-weight:600;padding:4px 11px;border-radius:20px; }
  .badge-verif img{ height:14px;width:auto;display:block; }
  .h-row{ display:flex;align-items:flex-start;justify-content:space-between;gap:14px; }
  .titre{ font-size:26px;font-weight:600;line-height:1.2;margin-bottom:6px; }
  .ville{ color:var(--muted);font-size:14px; }
  .note-pill{ text-align:right;white-space:nowrap; }
  .note-pill .n{ font-size:17px;font-weight:600; }
  .note-pill .n b{ color:var(--accent); }
  .note-pill .s{ font-size:13px;color:var(--muted);text-decoration:underline; }

  .facts{ display:flex;margin-top:18px;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;background:var(--surface); }
  .fact{ flex:1;padding:16px 10px;text-align:center;border-right:1px solid var(--border); }
  .fact:last-child{ border-right:none; }
  .fact-ic{ font-size:20px; }
  .fact-v{ font-size:15px;font-weight:600;margin-top:2px; }
  .fact-u{ font-size:12px;color:var(--muted);font-weight:400; }

  .section{ background:var(--surface);margin-top:16px;border:1px solid var(--border);border-radius:16px;padding:18px 20px; }
  .section h2{ font-size:18px;font-weight:600;margin-bottom:10px; }
  .section p{ font-size:15px;line-height:1.75;color:#374039;white-space:pre-line; }
  .enr{ margin-top:10px;font-size:12px;color:var(--muted); }

  .tarifs{ display:flex;flex-direction:column; }
  .tarif-row{ display:flex;align-items:baseline;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border); }
  .tarif-row:last-child{ border-bottom:none; }
  .tarif-lab{ font-size:14px;color:#374039; }
  .tarif-u{ font-size:12px;color:var(--muted); }
  .tarif-prix{ font-size:15px;font-weight:600; }
  .tarif-note{ margin-top:10px;font-size:12px;color:var(--muted); }
  .env-sub{ font-size:13px;color:var(--muted);margin-bottom:12px; }
  .env-grid{ display:grid;grid-template-columns:repeat(3,1fr);gap:10px; }
  .env-card{ border:1px solid var(--border);border-radius:14px;overflow:hidden;text-decoration:none;display:block;background:var(--surface); }
  .env-media{ height:82px;background:var(--primary-l); }
  .env-media img{ width:100%;height:100%;object-fit:cover;display:block; }
  .env-fb{ width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:30px; }
  .env-body{ padding:9px 11px; }
  .env-name{ font-size:13px;font-weight:600;color:var(--text);line-height:1.3; }
  .env-meta{ font-size:12px;color:var(--muted);margin-top:2px; }
  @media (max-width:600px){ .env-grid{ grid-template-columns:repeat(2,1fr); } }

  .steps{ display:flex;flex-direction:column;gap:14px; }
  .step{ display:flex;gap:12px; }
  .step-n{ flex:none;width:30px;height:30px;border-radius:50%;background:var(--primary);color:#04342C;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:15px;font-family:'Syne'; }
  .step-t{ font-size:15px;font-weight:600; }
  .step-d{ font-size:13px;color:var(--muted);line-height:1.55; }
  .notes{ display:flex;flex-direction:column;gap:8px;margin-top:16px; }
  .note-i{ display:flex;gap:10px;align-items:flex-start;background:var(--primary-l);border-radius:12px;padding:11px 13px;font-size:13px;color:#22332B; }
  .note-i .ni-ic{ flex:none; }
  .note-i b{ font-weight:600; }

  .ct-list{ display:flex;flex-direction:column; }
  .ct-row{ display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--border);text-decoration:none; }
  .ct-row:last-child{ border-bottom:none; }
  .ct-ic{ font-size:17px;width:22px;text-align:center;flex:none; }
  .ct-body{ display:flex;flex-direction:column; }
  .ct-lab{ font-size:11px;color:var(--muted); }
  .ct-val{ font-size:14px;font-weight:600;color:var(--text); }
  .ct-link{ color:var(--primary-d); }
  .soc-row{ display:flex;flex-wrap:wrap;gap:8px;margin-top:12px; }
  .soc{ background:var(--primary-l);color:var(--primary-d);font-size:13px;font-weight:600;padding:8px 13px;border-radius:11px;text-decoration:none; }

  .book{ background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px 20px;margin-top:16px; }
  .book-top{ display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px; }
  .book-price{ font-family:'Syne';font-size:24px;font-weight:700; }
  .book-price span{ font-size:13px;color:var(--muted);font-weight:400;font-family:'DM Sans'; }
  .book-tag{ font-size:13px;color:var(--primary-d);font-weight:600; }
  .btn-resa{ display:block;width:100%;background:var(--primary);color:#04342C;text-align:center;font-family:'Syne';font-weight:700;font-size:15px;padding:14px;border-radius:12px;text-decoration:none; }
  .btn-app-l{ display:block;text-align:center;margin-top:12px;font-size:14px;color:var(--primary-d);font-weight:600;text-decoration:none; }

  .avis-resume{ display:flex;align-items:center;gap:10px;margin-bottom:8px; }
  .avis-resume-note{ font-size:30px;font-weight:700;font-family:'Syne';line-height:1; }
  .avis-resume-stars{ color:var(--accent);font-size:18px;letter-spacing:2px; }
  .avis-card{ padding:14px 0;border-top:1px solid var(--border); }
  .avis-head{ display:flex;align-items:center;justify-content:space-between;margin-bottom:2px; }
  .avis-auteur{ font-weight:600;font-size:14px; }
  .avis-verif{ background:var(--primary-l);color:var(--primary-d);font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px; }
  .avis-stars{ color:var(--accent);font-size:14px;letter-spacing:2px; }
  .avis-titre{ font-weight:600;font-size:14px;margin-top:4px; }
  .avis-txt{ font-size:14px;color:#374039;line-height:1.6;margin-top:2px; }
  .avis-date{ font-size:12px;color:var(--muted);margin-top:6px; }
  .avis-rep{ margin-top:10px;margin-left:10px;padding-left:12px;border-left:2px solid var(--border);font-size:13px;color:#374039; }
  .avis-rep-lab{ font-size:12px;font-weight:600;color:var(--primary-d);margin-bottom:2px; }
  .avis-cta{ display:inline-block;margin-top:16px;background:var(--primary-l);color:var(--primary-d);padding:11px 18px;border-radius:12px;font-weight:600;text-decoration:none;font-size:14px; }

  .cta-block{ background:var(--primary-d);color:#fff;margin-top:20px;margin-bottom:10px;border-radius:18px;padding:24px 20px;text-align:center; }
  .cta-block h3{ font-size:18px;font-weight:700;margin-bottom:6px; }
  .cta-block p{ font-size:13px;opacity:.9;margin-bottom:16px; }
  .cta-btn{ display:inline-block;background:#fff;color:var(--primary-d);padding:13px 26px;border-radius:12px;font-weight:700;text-decoration:none;font-size:15px; }

  footer{ text-align:center;padding:26px 20px 40px;color:var(--muted);font-size:12px; }
  footer a{ color:var(--primary-d);text-decoration:none;font-weight:600; }
  @media (max-width:600px){ .gallery .main img{height:230px;} .titre{font-size:22px;} }
</style>
</head>
<body>

${ref ? `<div class="ref-banner">🎁 Invite par un ami — bienvenue sur Lokalist !</div>` : ''}

<header class="top-bar">
  <a href="${SITE_URL}" class="brand"><img src="${LOGO_URL}" alt="Lokalist"/> Lokalist</a>
  <span class="verif"><img src="${LOGO_URL}" alt=""/> Verifie Lokalist</span>
</header>

<main class="container">

  <div class="gallery">
    ${galleryHtml}
  </div>

  <div class="head">
    <div class="badges">
      <span class="badge">${escapeHtml(typeLabel)}</span>
      ${etos > 0 ? `<span class="badge-stars">${'★'.repeat(etos)}</span>` : ''}
      <span class="badge-verif"><img src="${LOGO_URL}" alt=""/> Verifie Lokalist</span>
    </div>
    <div class="h-row">
      <div>
        <h1 class="titre">${escapeHtml(nom)}</h1>
        ${ville ? `<div class="ville">📍 ${escapeHtml(ville)}</div>` : ''}
      </div>
      ${noteAff > 0 ? `<div class="note-pill"><div class="n"><b>★</b> ${Number(noteAff).toFixed(1)}</div><div class="s">${nbAvisAff} avis</div></div>` : ''}
    </div>
  </div>

  ${factsHtml}

  <section class="section">
    <h2>Le logement</h2>
    <p>${escapeHtml(description)}</p>
    ${c.num_enregistrement ? `<div class="enr">N° d'enregistrement : ${escapeHtml(c.num_enregistrement)}</div>` : ''}
  </section>

  ${environsHtml}

  ${tarifsHtml}

  ${explainHtml}

  ${contactHtml}

  <div class="book">
    <div class="book-top">
      <div class="book-price">${prixIndic !== null ? `des ${prixIndic} €` : 'Sur demande'} <span>${prixIndic !== null ? '/ nuit' : ''}</span></div>
      <span class="book-tag">🛡️ Sejour sur demande</span>
    </div>
    ${peutResa
      ? `<a class="btn-resa" href="${deepLink}">Demander un sejour</a>`
      : `<a class="btn-resa" href="${deepLink}">Voir dans l'app</a>`}
    <a class="btn-app-l" href="${deepLink}">📱 Ouvrir dans l'app Lokalist</a>
  </div>

  <section class="section">
    <h2>Avis${nbAvisAff > 0 ? ` (${nbAvisAff})` : ''}</h2>
    ${noteAff > 0 ? `<div class="avis-resume"><span class="avis-resume-note">${Number(noteAff).toFixed(1)}</span><span class="avis-resume-stars">${etoiles(noteAff)}</span></div>` : ''}
    ${avisHtml || '<p style="color:var(--muted);font-size:14px;">Aucun avis pour le moment. Scannez le QR de l\'hebergement pour partager votre sejour depuis l\'app.</p>'}
    <a href="lokalist://avis?type=commercant&id=${id}" class="avis-cta">✍️ Laisser un avis dans l'app</a>
  </section>

  <div class="cta-block">
    <h3>📱 Reservez et decouvrez ${escapeHtml(nom)} dans l'app</h3>
    <p>Sejours, avis verifies et bons plans locaux, au meme endroit.</p>
    <a href="${deepLink}" class="cta-btn">Ouvrir dans l'app</a>
  </div>
</main>

<footer>
  <p>© Lokalist · L'app hyperlocale de votre region</p>
  <p style="margin-top:6px;"><a href="${SITE_URL}">Accueil</a> · <a href="${SITE_URL}/contact">Contact</a> · <a href="${SITE_URL}/mentions-legales">Mentions legales</a></p>
</footer>

<script>
  (function(){
    try {
      var p = new URLSearchParams(window.location.search);
      var ref = (p.get('ref') || '').toUpperCase().trim();
      if (/^LOK-[A-Z0-9]{6}$/.test(ref)) {
        localStorage.setItem('lokalist_invite_code', ref);
        localStorage.setItem('lokalist_invite_date', new Date().toISOString());
      }
    } catch(e) {}
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
    console.error('[hebergement edge]', e);
    return pageNotFound('Erreur serveur');
  }
}

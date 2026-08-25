// ════════════════════════════════════════════════════════════════
//  api/hebergement.js — Vercel Edge Function
//  SENT: [LKL_HEB_LOT1] Page HTML SSR premium pour /hebergement/:slug
//  SENT: [LKL_HEB_LOT2] Galerie photos + multi-tarifs + logo Lokalist
//  SENT: [LKL_HEB_LOT3] Section "A faire dans les environs" (packs_loisir)
//  SENT: [LKL_HEB_LOT4] Refonte desktop : hero pleine largeur (photo de
//        couverture) + voile d'ambiance saisonnier auto, layout 2 colonnes
//        + carte resa sticky, accents FR, fix filtre packs (pas de colonne demo)
//  SENT: [LKL_HEB_LOT5] Section "Ce que propose le logement" (equipements)
//  SENT: [LKL_HEB_LOT6] Calendrier de disponibilites (lecture, lit /reservations/occupees)
//  SENT: [LKL_HEB_LOT7] Formulaire de reservation web (calendrier selectionnable -> POST /reservations/invite, honeypot)
//  SENT: [LKL_HEB_LOT8] Bouton reserver dans l'app (deep link avec dates pre-selectionnees)
//  SENT: [LKL_HEB_LOT9] Agenda de l'hebergeur sur le mini-site (agenda_commercants, note_privee jamais exposee)
//  SENT: [LKL_HEB_LOT10] Mapping des nouveaux types agenda (animation, portes ouvertes, offre speciale)
//  SENT: [LKL_HEB_LOT11] Lightbox : galerie cliquable -> plein ecran (fleches, Echap)
//  SENT: [LKL_HEB_LOT12] Affichage voyageur : total / acompte / solde selon le mode
//  SENT: [LKL_HEB_LOT13] Partage (Web Share API) + QR code telechargeable (fiche publique)
//  SENT: [LKL_HEB_LOT14] og:image + twitter:image -> carte OG brandee (api/og-hebergement)
//  SENT: [LKL_HEB_LOT15] Bloc Infos pratiques (check-in/out, caution, reglement, rappel animaux/wifi)
//  SENT: [LKL_HEB_LOT16] SEO : titre + meta description (type a ville) + og/twitter alignes
//  Hebergeur = commercant (type_pro='hebergeur', resa_type='sejour')
// ════════════════════════════════════════════════════════════════

export const config = { runtime: 'edge' };

const SUPABASE_URL  = 'https://kukathominhssogthplc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a2F0aG9taW5oc3NvZ3RocGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTU2NDMsImV4cCI6MjA5MDQzMTY0M30.nrfnhLWA_N-d5EA0qMvSTgSvbebbqHvWuCwk4PQDxcg';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=fr.lokalist.app';
const APP_STORE_URL  = 'https://apps.apple.com/fr/app/lokalist/id6778774911';
const SITE_URL       = 'https://lokalist.fr';
const LOGO_URL       = `${SITE_URL}/logo.png`;

const HEB_LABELS = {
  hotel:         'Hôtel',
  gite:          'Gîte',
  meuble:        'Meublé de tourisme',
  chambre_hotes: "Chambre d'hôtes",
};

// Catalogue equipements (cle -> emoji + libelle) — LOT5
const EQUIP_CATALOG = {
  wifi:           { e: '📶', l: 'Wifi' },
  parking:        { e: '🅿️', l: 'Parking' },
  cuisine:        { e: '🍳', l: 'Cuisine équipée' },
  lave_linge:     { e: '🧺', l: 'Lave-linge' },
  lave_vaisselle: { e: '🍽️', l: 'Lave-vaisselle' },
  tv:             { e: '📺', l: 'Télévision' },
  clim:           { e: '❄️', l: 'Climatisation' },
  chauffage:      { e: '🔥', l: 'Chauffage' },
  cheminee:       { e: '🪵', l: 'Cheminée' },
  terrasse:       { e: '🌿', l: 'Terrasse / jardin' },
  piscine:        { e: '🏊', l: 'Piscine' },
  barbecue:       { e: '🍖', l: 'Barbecue' },
  animaux:        { e: '🐾', l: 'Animaux acceptés' },
  pmr:            { e: '♿', l: 'Accès PMR' },
  vue_mer:        { e: '🌊', l: 'Vue mer' },
  petit_dej:      { e: '🥐', l: 'Petit-déjeuner' },
};

// ─── Ambiance saisonniere (calculee cote serveur) ───
function saisonInfo(m) {
  if (m >= 3 && m <= 5)  return { label: 'Printemps', emoji: '🌸', tint: '#63991F', wash: 'rgba(151,196,89,0.30)' };
  if (m >= 6 && m <= 8)  return { label: 'Été',       emoji: '☀️', tint: '#EF9F27', wash: 'rgba(239,159,39,0.30)' };
  if (m >= 9 && m <= 11) return { label: 'Automne',   emoji: '🍂', tint: '#D85A30', wash: 'rgba(216,90,48,0.30)' };
  return { label: 'Hiver', emoji: '❄️', tint: '#185FA5', wash: 'rgba(55,138,221,0.28)' };
}

// ─── Helpers ────────────────────────────────────────────────────
const escapeHtml = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
<title>Hébergement introuvable — Lokalist</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#F9F8F6;color:#1A1A2E;padding:40px 20px;text-align:center;line-height:1.6}h1{color:#1D9E75;font-size:28px;margin:24px 0 8px}a{color:#1D9E75;font-weight:600;text-decoration:none}</style>
</head><body>
<div style="font-size:64px">🏡</div>
<h1>${escapeHtml(msg)}</h1>
<p style="color:#8A8FA8">Cet hébergement n'existe plus ou a été retiré.</p>
<p><a href="${SITE_URL}">← Retour à Lokalist</a></p>
</body></html>`;

const pageNotFound = (msg = "Hébergement introuvable") => new Response(html404(msg), {
  status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' },
});

// ─── Handler ────────────────────────────────────────────────────
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
      'capacite','nb_chambres','classement_etoiles','num_enregistrement',
      'resa_mode','lien_paiement','acompte_montant','checkin_heure','checkout_heure','caution_montant','reglement'
    ].join(',');

    const apiUrl = `${SUPABASE_URL}/rest/v1/commercants?id=eq.${id}&select=${cols}`;
    const r = await fetch(apiUrl, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } });
    if (!r.ok) return pageNotFound("Erreur lors du chargement");
    const list = await r.json();
    if (!list || !list.length) return pageNotFound();
    const c = list[0];
    if (c.demo === true) return pageNotFound("Fiche non disponible");
    if (c.actif === false) return pageNotFound("Cet hébergement n'est plus actif");
    if (c.type_pro !== 'hebergeur') return pageNotFound("Cette page est réservée aux hébergements");

    // ─── Avis ───
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

    // ─── Equipements (colonne equipements jsonb) — requete gardee ───
    let equipements = [];
    try {
      const _eqR = await fetch(`${SUPABASE_URL}/rest/v1/commercants?id=eq.${id}&select=equipements`, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } });
      if (_eqR.ok) { const _eq = await _eqR.json(); if (_eq && _eq[0] && Array.isArray(_eq[0].equipements)) equipements = _eq[0].equipements; }
    } catch (e) { console.error('[heb equipements]', e); }

    const etoiles = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
    const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' }); } catch { return ''; } };
    const avisHtml = (avisListe || []).map((a) => `
      <div class="avis-card">
        <div class="avis-head">
          <div class="avis-auteur">${escapeHtml(a.auteur_nom || 'Voyageur')}</div>
          ${a.verified ? '<span class="avis-verif">✓ Vérifié</span>' : ''}
        </div>
        <div class="avis-stars">${etoiles(a.note)}</div>
        ${a.titre ? `<div class="avis-titre">${escapeHtml(a.titre)}</div>` : ''}
        ${a.commentaire ? `<div class="avis-txt">${escapeHtml(a.commentaire)}</div>` : ''}
        <div class="avis-date">${fmtDate(a.date_publication)}</div>
        ${a.reponse ? `<div class="avis-rep"><div class="avis-rep-lab">Réponse de l'hôte</div>${escapeHtml(a.reponse)}</div>` : ''}
      </div>`).join('');

    // ─── Photos ───
    const photos = Array.isArray(c.photos) ? c.photos.filter((p) => typeof p === 'string' && p.trim()) : [];
    const mainPhoto = photos[0] || c.photo_url || null;
    const photoOg   = mainPhoto || `${SITE_URL}/images/og-default.jpg`;

    // ─── Tarifs ───
    const tarifs = Array.isArray(c.tarifs)
      ? c.tarifs.filter((t) => t && t.prix !== undefined && t.prix !== null && !isNaN(Number(t.prix)))
      : [];
    const prixIndic = (c.prix_indicatif_nuit !== null && c.prix_indicatif_nuit !== undefined && c.prix_indicatif_nuit !== '')
      ? Math.round(Number(c.prix_indicatif_nuit))
      : (tarifs.length ? Math.min.apply(null, tarifs.map((t) => Number(t.prix))) : null);

    // ─── Environs (packs_loisir geolocalises, pas de colonne demo) ───
    let environs = [];
    try {
      const _hlat = Number(c.latitude), _hlng = Number(c.longitude);
      if (!isNaN(_hlat) && !isNaN(_hlng)) {
        const _eLat = 0.27, _eLng = 0.40; // ~30 km
        const _ebbox = `latitude=gte.${_hlat - _eLat}&latitude=lte.${_hlat + _eLat}&longitude=gte.${_hlng - _eLng}&longitude=lte.${_hlng + _eLng}`;
        const _eUrl = `${SUPABASE_URL}/rest/v1/packs_loisir?select=id,nom,ville,photo_url,prix_pack,prix_normal,reduction_pct,actif,latitude,longitude&actif=eq.true&${_ebbox}&limit=200`;
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

    // ─── Agenda de l'hebergeur (agenda_commercants, evenements publics a venir ; note_privee JAMAIS lue) ───
    let agendaEvents = [];
    try {
      const _lb = new Date(Date.now() - 7 * 86400000).toISOString();
      const _agUrl = `${SUPABASE_URL}/rest/v1/agenda_commercants?commercant_id=eq.${id}&select=titre,description,type,date_debut,date_fin,statut&order=date_debut.asc&date_debut=gte.${_lb}&limit=20`;
      const _agR = await fetch(_agUrl, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } });
      if (_agR.ok) {
        const _evs = await _agR.json();
        const _now = Date.now();
        agendaEvents = (_evs || [])
          .filter(function (e) { const st = String(e.statut || '').toLowerCase(); return st !== 'annule' && st !== 'refuse' && st !== 'brouillon'; })
          .filter(function (e) { const fin = e.date_fin ? Date.parse(e.date_fin) : Date.parse(e.date_debut); return isNaN(fin) || fin >= _now; })
          .slice(0, 6);
      }
    } catch (e) { console.error('[heb agenda]', e); }

    // ─── Donnees d'affichage ───
    const nom         = c.nom || 'Hébergement local';
    const ville       = c.ville || '';
    const typeLabel   = HEB_LABELS[c.hebergement_type] || 'Hébergement';
    const etos        = Number(c.classement_etoiles) || 0;
    const capacite    = Number(c.capacite) || 0;
    const chambres    = Number(c.nb_chambres) || 0;
    const description = c.description || `${typeLabel}${ville ? ' à ' + ville : ''} — sur Lokalist, l'app de la vie locale`;
    const descShort   = (description.length > 160 ? description.slice(0, 157) + '...' : description);
    const noteAff     = (avisNb > 0) ? avisMoyenne : (Number(c.note_moyenne) || 0);
    const nbAvisAff   = (avisNb > 0) ? avisNb : (Number(c.nb_avis) || 0);
    const peutResa    = (c.resa_visible === true) && (c.resa_type === 'sejour');
    const S           = saisonInfo(new Date().getMonth() + 1);

    const slugCanon = `${slugify(nom)}-${id}`;
    const canonical = `${SITE_URL}/hebergement/${slugCanon}`;
    const deepLink  = `lokalist://commercant/${id}`;
    const ogImage = `${SITE_URL}/api/og-hebergement?id=${id}`;

    const jsonLd = {
      "@context": "https://schema.org", "@type": "LodgingBusiness",
      "name": nom, "description": description, "image": photoOg, "url": canonical,
      ...(etos > 0 && { "starRating": { "@type": "Rating", "ratingValue": etos } }),
      ...(c.adresse && { "address": { "@type": "PostalAddress", "streetAddress": c.adresse, "addressLocality": ville, "addressCountry": "FR" } }),
      ...((c.latitude && c.longitude) && { "geo": { "@type": "GeoCoordinates", "latitude": Number(c.latitude), "longitude": Number(c.longitude) } }),
      ...(prixIndic !== null && { "priceRange": `${prixIndic} EUR / nuit` }),
      ...(noteAff > 0 && { "aggregateRating": { "@type": "AggregateRating", "ratingValue": Number(noteAff).toFixed(1), "reviewCount": nbAvisAff || 0 } }),
      ...(c.telephone && { telephone: c.telephone }),
      ...(c.email && { email: c.email }),
      ...((c.site_web || c.instagram || c.facebook || c.tiktok) && { sameAs: [
        ...(c.site_web ? [normUrl(c.site_web)] : []),
        ...(c.instagram ? [socialUrl('instagram', c.instagram)] : []),
        ...(c.facebook ? [socialUrl('facebook', c.facebook)] : []),
        ...(c.tiktok ? [socialUrl('tiktok', c.tiktok)] : []),
      ] }),
    };

    // ─── Faits ───
    const facts = [];
    if (capacite > 0) facts.push(`<div class="fact"><div class="fact-ic">👥</div><div class="fact-v">${capacite} voyageur${capacite>1?'s':''}</div></div>`);
    if (chambres > 0) facts.push(`<div class="fact"><div class="fact-ic">🛏️</div><div class="fact-v">${chambres} chambre${chambres>1?'s':''}</div></div>`);
    if (prixIndic !== null) facts.push(`<div class="fact"><div class="fact-ic">🏷️</div><div class="fact-v">dès ${prixIndic} €<span class="fact-u">/nuit</span></div></div>`);
    const factsHtml = facts.length ? `<div class="facts">${facts.join('')}</div>` : '';

    // ─── Miniatures (sous le hero) ───
    const thumbs = photos.slice(1, 9);
    const thumbsHtml = thumbs.length
      ? `<div class="thumbs">${thumbs.map((p, i) => `<img src="${escapeHtml(p)}" alt="${escapeHtml(nom)}" loading="lazy" data-lb="${i + 1}" style="cursor:zoom-in"/>`).join('')}</div>`
      : '';

    // ─── Tarifs ───
    const tarifsHtml = tarifs.length ? `
      <section class="section">
        <h2>Tarifs</h2>
        <div class="tarifs">
          ${tarifs.map((t) => `<div class="tarif-row"><span class="tarif-lab">${escapeHtml(t.label || '')}${t.unite ? ` <span class="tarif-u">· ${escapeHtml(t.unite)}</span>` : ''}</span><span class="tarif-prix">${Math.round(Number(t.prix))} €</span></div>`).join('')}
        </div>
        <div class="tarif-note">Total calculé selon vos dates, affiché avant paiement (taxe de séjour éventuelle incluse).</div>
      </section>` : '';

    // ─── Environs ───
    const _distTxt = (d) => (d < 1 ? Math.round(d*1000) + ' m' : (d < 10 ? d.toFixed(1) : String(Math.round(d))) + ' km');
    const environsHtml = environs.length ? `
      <section class="section">
        <h2>À faire dans les environs</h2>
        <p class="env-sub">Idées de sorties près de l'hébergement, sélectionnées par Lokalist.</p>
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

    // ─── Comment reserver + notes ───
    const explainHtml = `
      <section class="section">
        <h2>Comment réserver votre séjour</h2>
        <div class="steps">
          <div class="step"><div class="step-n">1</div><div><div class="step-t">Choisissez vos dates</div><div class="step-d">Consultez les disponibilités et sélectionnez votre période.</div></div></div>
          <div class="step"><div class="step-n">2</div><div><div class="step-t">Envoyez votre demande</div><div class="step-d">L'hôte reçoit votre demande et vous répond rapidement. Sans engagement.</div></div></div>
          <div class="step"><div class="step-n">3</div><div><div class="step-t">Séjour confirmé</div><div class="step-d">Réglez en ligne en toute sécurité (acompte ou total). C'est réservé.</div></div></div>
        </div>
        <div class="notes">
          <div class="note-i"><span class="ni-ic">✅</span><div><b>Vérifié Lokalist</b> — hébergeur authentifié sur la plateforme.</div></div>
          <div class="note-i"><span class="ni-ic">⭐</span><div><b>Avis vérifiés</b> — laissés après un séjour, via un scan QR sur place.</div></div>
          <div class="note-i"><span class="ni-ic">ℹ️</span><div><b>Prix</b> — total calculé selon vos dates, affiché avant paiement.</div></div>
        </div>
      </section>`;

    // ─── Contact ───
    const contactRows = [];
    if (c.telephone) contactRows.push(`<a class="ct-row" href="tel:${escapeHtml(c.telephone)}"><span class="ct-ic">📞</span><span class="ct-body"><span class="ct-lab">Téléphone</span><span class="ct-val">${escapeHtml(c.telephone)}</span></span></a>`);
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

    // ─── Hero (photo de couverture OU repli teinte saison) ───
    const heroStyle = mainPhoto
      ? `background-image:url('${escapeHtml(mainPhoto)}');background-size:cover;background-position:center;`
      : `background:${S.tint};`;
    const heroFb = mainPhoto ? '' : `<div class="hero-fb">🏡</div>`;

    const equipList = (equipements || []).filter((k) => EQUIP_CATALOG[k]);
    const equipementsHtml = equipList.length ? `
      <section class="section">
        <h2>Ce que propose le logement</h2>
        <div class="equip-grid">
          ${equipList.map((k) => `<div class="equip-item"><span class="equip-ic">${EQUIP_CATALOG[k].e}</span> ${escapeHtml(EQUIP_CATALOG[k].l)}</div>`).join('')}
        </div>
      </section>` : '';

    const dispoHtml = peutResa ? `
      <section class="section" id="resa-web">
        <h2>Réserver votre séjour</h2>
        <div id="rw-cal" class="rw-cal">Chargement…</div>
        <div id="rw-sel" class="rw-sel">Choisissez vos dates dans le calendrier.</div>
        <div id="rw-paie" class="rw-paie"></div>
        <div id="rw-form" class="rw-form">
          <div class="rw-row2">
            <label class="rw-lab">Personnes<input type="number" id="rw-pers" min="1" max="30" value="2"/></label>
            <label class="rw-lab">Logements<input type="number" id="rw-logs" min="1" max="20" value="1"/></label>
          </div>
          <div class="rw-row2">
            <input id="rw-prenom" placeholder="Prénom *"/>
            <input id="rw-nom" placeholder="Nom *"/>
          </div>
          <input id="rw-tel" placeholder="Téléphone *"/>
          <input id="rw-email" type="email" placeholder="Email *"/>
          <textarea id="rw-note" rows="2" placeholder="Note : arrivée tardive, animal… (optionnel)"></textarea>
          <input id="rw-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0"/>
          <button type="button" id="rw-send" class="rw-btn">Envoyer ma demande</button>
          <div id="rw-msg"></div>
        </div>
        <div class="rw-or"><span>ou</span></div>
        <button type="button" id="rw-app" class="rw-app">📱 Réserver dans l'app Lokalist</button>
        <p class="rw-legal">Sans engagement — l'hôte confirme ou refuse, vous recevrez un email. Le paiement est géré directement par l'hôte.</p>
        <script>
        (function(){
          var API='https://lokalist-api-production.up.railway.app';
          var ID=${JSON.stringify(id)};
          var PRIX=${prixIndic || 0};
          var MODE=${JSON.stringify(c.resa_mode || 'demande')};
          var LIEN=${JSON.stringify(c.lien_paiement || '')};
          var ACOMPTE=${Number(c.acompte_montant) || 0};
          var occ=new Set();
          var view=new Date(); view.setDate(1);
          var arr=null, dep=null, sending=false, done=false;
          function pad(n){ return (n<10?'0':'')+n; }
          function iso(y,m,d){ return y+'-'+pad(m+1)+'-'+pad(d); }
          function el(x){ return document.getElementById(x); }
          function nights(){ if(!arr||!dep) return 0; return Math.round((Date.parse(dep+'T00:00:00Z')-Date.parse(arr+'T00:00:00Z'))/86400000); }
          function rangeHasOcc(a,b){ var c=Date.parse(a+'T00:00:00Z'), e=Date.parse(b+'T00:00:00Z'); for(;c<e;c+=86400000){ if(occ.has(new Date(c).toISOString().slice(0,10))) return true; } return false; }
          function pick(s){
            if(!arr || (arr&&dep)){ arr=s; dep=null; }
            else if(arr && !dep){
              if(s<=arr){ arr=s; }
              else if(rangeHasOcc(arr,s)){ arr=s; dep=null; }
              else { dep=s; }
            }
            renderCal(); renderSel();
          }
          function renderCal(){
            var box=el('rw-cal'); if(!box) return;
            var y=view.getFullYear(), m=view.getMonth();
            var first=new Date(y,m,1); var start=(first.getDay()+6)%7;
            var days=new Date(y,m+1,0).getDate();
            var today=new Date().toISOString().slice(0,10);
            var mois=first.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
            var cells='';
            for(var i=0;i<start;i++){ cells+='<div></div>'; }
            for(var d=1;d<=days;d++){
              var s=iso(y,m,d);
              var past=s<today, taken=occ.has(s);
              var inRange = arr && dep && s>=arr && s<dep;
              var cls='rwc';
              if(past){ cls+=' rwc-past'; } else if(taken){ cls+=' rwc-taken'; } else { cls+=' rwc-free'; }
              if(s===arr) cls+=' rwc-arr'; else if(s===dep) cls+=' rwc-dep'; else if(inRange) cls+=' rwc-range';
              var clickable=!past && !taken;
              cells+='<div class="'+cls+'"'+(clickable?' data-d="'+s+'"':'')+'>'+d+'</div>';
            }
            box.innerHTML='<div class="rwc-head"><button type="button" class="rwc-nav" data-n="-1">\u2039</button><span class="rwc-mois">'+mois+'</span><button type="button" class="rwc-nav" data-n="1">\u203A</button></div>'
              +'<div class="rwc-grid rwc-dows"><div>L</div><div>M</div><div>M</div><div>J</div><div>V</div><div>S</div><div>D</div></div>'
              +'<div class="rwc-grid">'+cells+'</div>';
          }
          function fmt(s){ if(!s) return '-'; var p=s.split('-'); return p[2]+'/'+p[1]; }
          function renderSel(){
            var sel=el('rw-sel'); if(!sel) return;
            if(arr&&dep){ var n=nights(); sel.innerHTML='<strong>'+fmt(arr)+'</strong> \u2192 <strong>'+fmt(dep)+'</strong> \u00b7 '+n+' nuit'+(n>1?'s':''); }
            else if(arr){ sel.textContent='Arrivée le '+fmt(arr)+' — choisissez la date de départ.'; }
            else { sel.textContent='Choisissez vos dates dans le calendrier.'; }
            renderPaie();
          }
          function renderPaie(){
            var box=el('rw-paie'); if(!box) return;
            if(!(arr&&dep)){ box.innerHTML=''; return; }
            var n=nights();
            var total = (PRIX>0) ? n*PRIX : 0;
            var hasLien = LIEN && LIEN.length>0;
            var ac = (ACOMPTE>0 && hasLien) ? ACOMPTE : 0;
            var solde = total - ac; if(solde<0) solde=0;
            var h='';
            if(total>0){
              h+='<div class="rw-paie-total">Total : <b>'+total+' \u20AC</b></div>';
              h+='<div class="rw-paie-note">calcul\u00E9 sur le tarif nuit ('+n+' \u00D7 '+PRIX+' \u20AC) \u2014 l\u2019h\u00F4te confirme le montant exact</div>';
            }
            if(ac>0){
              h+='<div class="rw-paie-line"><span>Acompte pour r\u00E9server</span><b>'+ac+' \u20AC</b></div>';
              if(total>0){ h+='<div class="rw-paie-line"><span>Solde sur place</span><b>'+solde+' \u20AC</b></div>'; }
              h+='<div class="rw-paie-msg">'+(MODE==='instantane'
                ? 'R\u00E9servation confirm\u00E9e imm\u00E9diatement : versez l\u2019acompte via le lien de l\u2019h\u00F4te pour bloquer vos dates.'
                : 'Apr\u00E8s validation de l\u2019h\u00F4te, versez l\u2019acompte via son lien. Le solde se r\u00E8gle sur place.')+'</div>';
            } else {
              h+='<div class="rw-paie-msg">\uD83D\uDCB6 Paiement sur place, directement avec l\u2019h\u00E9bergeur.</div>';
            }
            box.innerHTML=h;
          }
          function onClick(e){
            var t=e.target;
            if(t.classList.contains('rwc-nav')){ view.setMonth(view.getMonth()+parseInt(t.getAttribute('data-n'),10)); renderCal(); return; }
            var d=t.getAttribute('data-d'); if(d){ pick(d); }
          }
          function emailOk(v){ var a=v.indexOf('@'); return a>0 && v.indexOf('.',a)>a+1 && v.length>5; }
          function send(){
            if(sending||done) return;
            var msg=el('rw-msg'); msg.textContent=''; msg.className='';
            if(!arr||!dep){ msg.className='rw-err'; msg.textContent='Choisissez vos dates.'; return; }
            var prenom=el('rw-prenom').value.trim(), nom=el('rw-nom').value.trim(), tel=el('rw-tel').value.trim(), email=el('rw-email').value.trim();
            if(!prenom||!nom||!tel||!email){ msg.className='rw-err'; msg.textContent='Prénom, nom, téléphone et email sont obligatoires.'; return; }
            if(!emailOk(email)){ msg.className='rw-err'; msg.textContent='Email invalide.'; return; }
            sending=true; var btn=el('rw-send'); btn.disabled=true; btn.textContent='Envoi…';
            var payload={ commercant_id:ID, date_resa:arr, date_depart:dep,
              nb_personnes:parseInt(el('rw-pers').value,10)||1, nb_logements:parseInt(el('rw-logs').value,10)||1,
              contact_prenom:prenom, contact_nom:nom, contact_tel:tel, contact_email:email,
              note:el('rw-note').value.trim()||null, website:el('rw-hp').value };
            fetch(API+'/reservations/invite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
              .then(function(r){ return r.json().then(function(j){ return {ok:r.ok,j:j}; }); })
              .then(function(x){
                sending=false;
                if(x.ok && x.j && x.j.ok){ done=true; el('rw-form').innerHTML='<div class="rw-done">\u2705 Demande envoyée ! L\u2019hôte va confirmer ou refuser \u2014 vous recevrez un email.</div>'; }
                else { btn.disabled=false; btn.textContent='Envoyer ma demande'; msg.className='rw-err'; msg.textContent=(x.j&&x.j.error)||'Envoi impossible. Réessayez.'; }
              })
              .catch(function(){ sending=false; btn.disabled=false; btn.textContent='Envoyer ma demande'; msg.className='rw-err'; msg.textContent='Erreur réseau. Réessayez.'; });
          }
          function openApp(){
            var u="lokalist://commercant/"+ID; var q=[];
            if(arr) q.push("arrivee="+arr); if(dep) q.push("depart="+dep);
            q.push("personnes="+(el("rw-pers").value||"2")); q.push("logements="+(el("rw-logs").value||"1"));
            window.location.href=u+"?"+q.join("&");
          }
          function init(){
            var box=el('rw-cal'); if(!box) return;
            box.addEventListener('click', onClick);
            var btn=el('rw-send'); if(btn) btn.addEventListener('click', send);
            var appb=el('rw-app'); if(appb) appb.addEventListener('click', openApp);
            renderCal(); renderSel();
          }
          fetch(API+'/reservations/occupees/'+ID).then(function(r){ return r.json(); }).then(function(j){ if(j&&j.occupees){ occ=new Set(j.occupees); } init(); }).catch(function(){ init(); });
        })();
        </script>
      </section>` : '';

    function _evtMeta(t) {
      const s = String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      if (s.indexOf('ferm') > -1) return { e: '🚫', l: 'Fermeture', c: '#B23A2E', bg: '#FBEAE7' };
      if (s.indexOf('promo') > -1) return { e: '🏷️', l: 'Promotion', c: '#0F6E56', bg: '#E7F6F0' };
      if (s.indexOf('horaire') > -1) return { e: '⏰', l: 'Horaire spécial', c: '#B26A00', bg: '#FDF3E2' };
      if (s.indexOf('even') > -1 || s.indexOf('event') > -1) return { e: '🎉', l: 'Événement', c: '#0F6E56', bg: '#E7F6F0' };
      if (s.indexOf('animation') > -1) return { e: '🎪', l: 'Animation', c: '#B83280', bg: '#FCE7F3' };
      if (s.indexOf('porte') > -1) return { e: '🚪', l: 'Portes ouvertes', c: '#0F6E56', bg: '#E7F6F0' };
      if (s.indexOf('offre') > -1) return { e: '💶', l: 'Offre spéciale', c: '#B26A00', bg: '#FDF3E2' };
      return { e: '📅', l: (t ? String(t) : 'À la une'), c: '#374039', bg: '#F1F2F4' };
    }
    const _fmtEvt = (iso) => { try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }); } catch (e) { return ''; } };
    const agendaHtml = agendaEvents.length ? `
      <section class="section">
        <h2>À l'agenda</h2>
        <div class="agenda-list">
          ${agendaEvents.map(function (e) {
            const m = _evtMeta(e.type); const d1 = _fmtEvt(e.date_debut); const d2 = e.date_fin ? _fmtEvt(e.date_fin) : '';
            const per = (d2 && d2 !== d1) ? (d1 + ' → ' + d2) : d1;
            return `<div class="agenda-item">
              <span class="agenda-badge" style="background:${m.bg};color:${m.c}">${m.e} ${escapeHtml(m.l)}</span>
              <div class="agenda-body">
                <div class="agenda-titre">${escapeHtml(e.titre || '')}</div>
                <div class="agenda-date">${escapeHtml(per)}</div>
                ${e.description ? `<div class="agenda-desc">${escapeHtml(e.description)}</div>` : ''}
              </div>
            </div>`;
          }).join('')}
        </div>
      </section>` : '';

    const lightboxHtml = photos.length ? `
      <div id="lb" class="lb" aria-hidden="true">
        <button class="lb-btn lb-x" data-lb-act="close" aria-label="Fermer">×</button>
        <button class="lb-btn lb-prev" data-lb-act="prev" aria-label="Precedent">\u2039</button>
        <img class="lb-img" alt=""/>
        <button class="lb-btn lb-next" data-lb-act="next" aria-label="Suivant">\u203A</button>
        <div class="lb-count"></div>
      </div>
      <script>
      (function(){
        var PH = ${JSON.stringify(photos)};
        if(!PH.length) return;
        var lb=document.getElementById('lb'); if(!lb) return;
        var img=lb.querySelector('.lb-img'), cnt=lb.querySelector('.lb-count');
        var i=0, open=false;
        function show(){ img.src=PH[i]; cnt.textContent=(i+1)+' / '+PH.length; }
        function openAt(n){ i=((n%PH.length)+PH.length)%PH.length; open=true; lb.classList.add('on'); lb.setAttribute('aria-hidden','false'); show(); document.body.style.overflow='hidden'; }
        function close(){ open=false; lb.classList.remove('on'); lb.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }
        function go(d){ i=((i+d)%PH.length+PH.length)%PH.length; show(); }
        document.addEventListener('click', function(e){
          var t=e.target.closest('[data-lb]'); if(t){ e.preventDefault(); openAt(parseInt(t.getAttribute('data-lb'),10)||0); return; }
          var a=e.target.closest('[data-lb-act]'); if(a){ e.stopPropagation(); var act=a.getAttribute('data-lb-act'); if(act==='close')close(); else if(act==='prev')go(-1); else go(1); return; }
          if(open && e.target===lb) close();
        });
        document.addEventListener('keydown', function(e){ if(!open)return; if(e.key==='Escape')close(); else if(e.key==='ArrowLeft')go(-1); else if(e.key==='ArrowRight')go(1); });
      })();
      </script>` : '';

    // --- Infos pratiques (LOT15) ---
    const _checkin   = (c.checkin_heure  || '').trim();
    const _checkout  = (c.checkout_heure || '').trim();
    const _caution   = Number(c.caution_montant) || 0;
    const _reglement = (c.reglement || '').trim();
    const _pAnimaux  = (equipements || []).indexOf('animaux') > -1;
    const _pWifi     = (equipements || []).indexOf('wifi') > -1;
    const _hasPratik = !!(_checkin || _checkout || _caution > 0 || _reglement);
    const _pRows = [];
    if (_checkin)   _pRows.push(`<div class="pratik-row"><span class="pratik-ic">🕓</span><div><div class="pratik-lab">Arrivée</div><div class="pratik-val">${escapeHtml(_checkin)}</div></div></div>`);
    if (_checkout)  _pRows.push(`<div class="pratik-row"><span class="pratik-ic">🕚</span><div><div class="pratik-lab">Départ</div><div class="pratik-val">${escapeHtml(_checkout)}</div></div></div>`);
    if (_hasPratik) _pRows.push(`<div class="pratik-row"><span class="pratik-ic">💶</span><div><div class="pratik-lab">Caution</div><div class="pratik-val">${_caution > 0 ? _caution + ' €' : 'Aucune caution'}</div></div></div>`);
    if (_pAnimaux)  _pRows.push(`<div class="pratik-row"><span class="pratik-ic">🐾</span><div><div class="pratik-lab">Animaux</div><div class="pratik-val">Acceptés</div></div></div>`);
    if (_pWifi)     _pRows.push(`<div class="pratik-row"><span class="pratik-ic">📶</span><div><div class="pratik-lab">Wifi</div><div class="pratik-val">Oui</div></div></div>`);
    const infosHtml = _hasPratik ? `
      <section class="section">
        <h2>Infos pratiques</h2>
        <div class="pratik-grid">${_pRows.join('')}</div>
        ${_reglement ? `<div class="pratik-note"><div class="pratik-lab">Bon à savoir</div><p>${escapeHtml(_reglement)}</p></div>` : ''}
      </section>` : '';
    // --- SEO finition (LOT16) : titre + description type/ville ---
    const _vt = ville ? `${typeLabel} à ${ville}` : typeLabel;
    const titreSocial = `${nom} — ${_vt}`;
    const titreSeo = `${titreSocial} — Lokalist`;
    let metaDesc = descShort;
    if (ville && descShort.toLowerCase().indexOf(ville.toLowerCase()) === -1) {
      metaDesc = `${_vt}. ${descShort}`;
      if (metaDesc.length > 160) metaDesc = metaDesc.slice(0, 159).replace(/\s+\S*$/, '') + '…';
    }
    const body = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5"/>
<title>${escapeHtml(titreSeo)}</title>
<meta name="description" content="${escapeHtml(metaDesc)}"/>
<link rel="canonical" href="${canonical}"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="Lokalist"/>
<meta property="og:title" content="${escapeHtml(titreSocial)}"/>
<meta property="og:description" content="${escapeHtml(metaDesc)}"/>
<meta property="og:image" content="${escapeHtml(ogImage)}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:url" content="${canonical}"/>
<meta property="og:locale" content="fr_FR"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(titreSocial)}"/>
<meta name="twitter:description" content="${escapeHtml(metaDesc)}"/>
<meta name="twitter:image" content="${escapeHtml(ogImage)}"/>
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
  img{ max-width:100%; }
  .wrap{ max-width:1120px;margin:0 auto;padding:0 20px; }

  .top-bar{ background:var(--surface);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:20; }
  .top-bar .in{ max-width:1120px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;justify-content:space-between; }
  .brand{ display:flex;align-items:center;gap:7px;font-family:'Syne';font-weight:700;font-size:18px;color:var(--primary-d);text-decoration:none; }
  .brand img{ height:22px;width:auto;display:block; }
  .verif{ display:flex;align-items:center;gap:6px;font-size:13px;color:var(--primary-d);font-weight:600; }
  .verif img{ height:16px;width:auto;display:block; }
  .ref-banner{ background:var(--accent);color:#3A2600;text-align:center;padding:10px 16px;font-size:13px;font-weight:600; }

  .hero{ position:relative;min-height:420px;display:flex;align-items:stretch; }
  .hero-fb{ position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:96px;opacity:.5; }
  .hero-ov{ position:absolute;inset:0; }
  .hero-in{ position:relative;z-index:2;max-width:1120px;margin:0 auto;width:100%;padding:20px;display:flex;flex-direction:column;justify-content:space-between; }
  .hero-top{ display:flex;align-items:flex-start;justify-content:space-between;gap:12px; }
  .hero-badges{ display:flex;gap:8px;flex-wrap:wrap; }
  .hb{ background:rgba(255,255,255,.92);color:var(--primary-d);font-size:12px;font-weight:600;padding:4px 11px;border-radius:20px; }
  .hb-stars{ color:var(--accent);letter-spacing:1px; }
  .hero-season{ display:inline-flex;align-items:center;gap:6px;color:#fff;font-size:12px;font-weight:600;padding:5px 12px;border-radius:20px; }
  .hero-foot{ display:flex;align-items:flex-end;justify-content:space-between;gap:14px;color:#fff; }
  .hero-title{ font-family:'Syne';font-weight:700;font-size:32px;line-height:1.1;text-shadow:0 2px 12px rgba(0,0,0,.35); }
  .hero-loc{ font-size:14px;opacity:.95;margin-top:6px;text-shadow:0 1px 8px rgba(0,0,0,.35); }
  .hero-note{ text-align:right;white-space:nowrap;text-shadow:0 1px 8px rgba(0,0,0,.35); }
  .hero-note .n{ font-size:17px;font-weight:600; }
  .hero-note .n b{ color:#FAC775; }
  .hero-note .s{ font-size:12px;opacity:.9; }
  .hero-count{ position:absolute;right:20px;bottom:16px;z-index:3;background:rgba(255,255,255,.92);color:var(--text);font-size:12px;font-weight:500;padding:4px 10px;border-radius:20px; }
  .lb{ position:fixed;inset:0;z-index:999;display:none;align-items:center;justify-content:center;background:rgba(15,20,17,.92);padding:20px; }
  .lb.on{ display:flex; }
  .lb-img{ max-width:94vw;max-height:88vh;border-radius:10px;box-shadow:0 12px 60px rgba(0,0,0,.5);object-fit:contain; }
  .lb-btn{ position:absolute;background:rgba(255,255,255,.14);color:#fff;border:none;cursor:pointer; }
  .lb-x{ top:16px;right:18px;width:42px;height:42px;border-radius:50%;font-size:26px;line-height:1; }
  .lb-prev,.lb-next{ top:50%;transform:translateY(-50%);width:48px;height:48px;border-radius:50%;font-size:30px;line-height:1; }
  .lb-prev{ left:16px; } .lb-next{ right:16px; }
  .lb-btn:hover{ background:rgba(255,255,255,.28); }
  .lb-count{ position:absolute;bottom:18px;left:50%;transform:translateX(-50%);color:#fff;font-size:13px;background:rgba(0,0,0,.4);padding:5px 12px;border-radius:20px; }
  @media (max-width:600px){ .lb-prev,.lb-next{ width:40px;height:40px;font-size:24px; } }

  .thumbs{ display:flex;gap:8px;margin-top:14px;overflow-x:auto;padding-bottom:2px; }
  .thumbs img{ width:120px;height:80px;object-fit:cover;border-radius:12px;flex:none;background:var(--primary-l); }

  .layout{ display:grid;grid-template-columns:1.7fr 1fr;gap:22px;align-items:start;margin-top:18px;padding-bottom:10px; }
  .col-main{ display:flex;flex-direction:column;gap:16px;min-width:0; }
  .col-side{ min-width:0; }

  .facts{ display:flex;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;background:var(--surface); }
  .fact{ flex:1;padding:16px 10px;text-align:center;border-right:1px solid var(--border); }
  .fact:last-child{ border-right:none; }
  .fact-ic{ font-size:20px; }
  .fact-v{ font-size:15px;font-weight:600;margin-top:2px; }
  .fact-u{ font-size:12px;color:var(--muted);font-weight:400; }

  .section{ background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px 20px; }
  .section h2{ font-size:19px;font-weight:600;margin-bottom:10px; }
  .section p{ font-size:15px;line-height:1.75;color:#374039;white-space:pre-line; }
  .enr{ margin-top:10px;font-size:12px;color:var(--muted); }

  .tarifs{ display:flex;flex-direction:column; }
  .tarif-row{ display:flex;align-items:baseline;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border); }
  .tarif-row:last-child{ border-bottom:none; }
  .tarif-lab{ font-size:14px;color:#374039; }
  .tarif-u{ font-size:12px;color:var(--muted); }
  .tarif-prix{ font-size:15px;font-weight:600; }
  .tarif-note{ margin-top:10px;font-size:12px;color:var(--muted); }
  .equip-grid{ display:grid;grid-template-columns:1fr 1fr;gap:12px 20px; }
  .equip-item{ display:flex;align-items:center;gap:10px;font-size:15px;color:#374039; }
  .equip-ic{ width:22px;text-align:center;flex:none; }
  @media (max-width:600px){ .equip-grid{ grid-template-columns:1fr; } }
  .dispo-note{ font-size:12px;color:var(--muted);margin-top:10px; }
  .dc-head{ display:flex;align-items:center;justify-content:space-between;margin-bottom:10px; }
  .dc-mois{ font-weight:600;text-transform:capitalize; }
  .dc-nav{ border:1px solid var(--border);background:#fff;border-radius:8px;padding:3px 11px;cursor:pointer;font-size:16px;color:var(--text); }
  .dc-grid{ display:grid;grid-template-columns:repeat(7,1fr);gap:5px; }
  .dc-dows{ font-size:11px;color:var(--muted);text-align:center;margin-bottom:5px; }
  .dc{ aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:8px;font-size:13px;font-weight:600;border:1px solid var(--border); }
  .dc-free{ background:#fff;color:#374039; }
  .dc-taken{ background:#F1F2F4;color:#B6BBB4;text-decoration:line-through; }
  .dc-past{ background:#F7F6F3;color:#CBD0CA; }
  .rw-cal{ max-width:380px; }
  .rwc-head{ display:flex;align-items:center;justify-content:space-between;margin-bottom:10px; }
  .rwc-mois{ font-weight:600;text-transform:capitalize; }
  .rwc-nav{ border:1px solid var(--border);background:#fff;border-radius:8px;padding:3px 11px;cursor:pointer;font-size:16px;color:var(--text); }
  .rwc-grid{ display:grid;grid-template-columns:repeat(7,1fr);gap:5px; }
  .rwc-dows{ font-size:11px;color:var(--muted);text-align:center;margin-bottom:5px; }
  .rwc{ aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:8px;font-size:13px;font-weight:600;border:1px solid var(--border);background:#fff;color:#374039; }
  .rwc-free{ cursor:pointer; }
  .rwc-free:hover{ border-color:var(--primary); }
  .rwc-taken{ background:#F1F2F4;color:#B6BBB4;text-decoration:line-through; }
  .rwc-past{ background:#F7F6F3;color:#CBD0CA; }
  .rwc-range{ background:var(--primary-l);color:var(--primary-d);border-color:var(--primary-l); }
  .rwc-arr,.rwc-dep{ background:var(--primary);color:#04342C;border-color:var(--primary); }
  .rw-sel{ margin-top:12px;font-size:14px;color:#374039; }
  .rw-form{ margin-top:14px;display:flex;flex-direction:column;gap:10px;position:relative;max-width:460px; }
  .rw-row2{ display:flex;gap:10px; }
  .rw-row2>*{ flex:1; }
  .rw-lab{ display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted);font-weight:500; }
  .rw-form input,.rw-form textarea{ width:100%;border:1px solid var(--border);border-radius:10px;padding:11px 12px;font-size:14px;font-family:inherit;color:var(--text);background:#fff; }
  .rw-form input[type=number]{ font-weight:600; }
  .rw-btn{ background:var(--primary);color:#04342C;border:none;font-family:'Syne',sans-serif;font-weight:700;font-size:15px;padding:13px;border-radius:12px;cursor:pointer; }
  .rw-btn:disabled{ opacity:.6;cursor:default; }
  .rw-err{ color:#C0392B;font-size:13px;font-weight:600; }
  .rw-done{ background:var(--primary-l);color:var(--primary-d);border-radius:12px;padding:16px;font-size:15px;font-weight:600;text-align:center; }
  .rw-legal{ font-size:12px;color:var(--muted);margin-top:12px; }
  .rw-paie{ margin-top:12px;max-width:360px; }
  .rw-paie-total{ font-size:16px;color:var(--text); }
  .rw-paie-note{ font-size:11px;color:var(--muted);margin-top:2px;line-height:1.4; }
  .rw-paie-line{ display:flex;justify-content:space-between;gap:16px;font-size:14px;color:#374039;margin-top:6px; }
  .rw-paie-msg{ font-size:12.5px;margin-top:10px;background:var(--primary-l);color:var(--primary-d);padding:9px 11px;border-radius:8px;line-height:1.45; }
  .rw-or{ display:flex;align-items:center;text-align:center;color:var(--muted);font-size:12px;margin:16px 0 10px;max-width:460px; }
  .rw-or::before,.rw-or::after{ content:"";flex:1;height:1px;background:var(--border); }
  .rw-or span{ padding:0 12px; }
  .rw-app{ display:block;width:100%;max-width:460px;background:var(--primary-l);color:var(--primary-d);border:none;font-weight:600;font-size:14px;padding:12px;border-radius:12px;cursor:pointer; }
  .agenda-list{ display:flex;flex-direction:column;gap:12px; }
  .agenda-item{ display:flex;gap:12px;align-items:flex-start; }
  .agenda-badge{ flex:none;font-size:12px;font-weight:600;padding:4px 10px;border-radius:20px;white-space:nowrap; }
  .agenda-titre{ font-size:15px;font-weight:600;color:var(--text); }
  .agenda-date{ font-size:13px;color:var(--muted);margin-top:1px; }
  .agenda-desc{ font-size:14px;color:#374039;margin-top:4px;line-height:1.5; }
  @media (max-width:600px){ .agenda-item{ flex-direction:column;gap:6px; } }

  .env-sub{ font-size:13px;color:var(--muted);margin-bottom:12px; }
  .env-grid{ display:grid;grid-template-columns:repeat(3,1fr);gap:10px; }
  .env-card{ border:1px solid var(--border);border-radius:14px;overflow:hidden;text-decoration:none;display:block;background:var(--surface); }
  .env-media{ height:90px;background:var(--primary-l); }
  .env-media img{ width:100%;height:100%;object-fit:cover;display:block; }
  .env-fb{ width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:30px; }
  .env-body{ padding:9px 11px; }
  .env-name{ font-size:13px;font-weight:600;color:var(--text);line-height:1.3; }
  .env-meta{ font-size:12px;color:var(--muted);margin-top:2px; }

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

  .book{ background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:18px 20px;position:sticky;top:84px; }
  .book-top{ display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px; }
  .book-price{ font-family:'Syne';font-size:24px;font-weight:700; }
  .book-price span{ font-size:13px;color:var(--muted);font-weight:400;font-family:'DM Sans'; }
  .book-tag{ font-size:13px;color:var(--primary-d);font-weight:600; }
  .book-dates{ display:flex;gap:8px;margin-bottom:12px; }
  .book-date{ flex:1;border:1px solid var(--border);border-radius:var(--radius);padding:9px 11px; }
  .book-date .dl{ font-size:11px;color:var(--muted); }
  .book-date .dv{ font-size:14px;font-weight:500; }
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

  .cta-block{ background:var(--primary-d);color:#fff;margin:20px 0 10px;border-radius:18px;padding:26px 20px;text-align:center; }
  .cta-block h3{ font-size:19px;font-weight:700;margin-bottom:6px; }
  .cta-block p{ font-size:14px;opacity:.9;margin-bottom:16px; }
  .cta-btn{ display:inline-block;background:#fff;color:var(--primary-d);padding:13px 26px;border-radius:12px;font-weight:700;text-decoration:none;font-size:15px; }

  /* LKL_HEB_LOT13 : partage + QR */
  .share-bar{ display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:16px 0 4px; }
  .share-btn{ display:inline-flex;align-items:center;gap:8px;cursor:pointer;border:1px solid var(--border);background:var(--surface);color:var(--primary-d);font-family:'Syne';font-weight:600;font-size:14px;padding:10px 16px;border-radius:12px;text-decoration:none;transition:background .15s,border-color .15s; }
  .share-btn:hover{ background:var(--primary-l);border-color:var(--primary-l); }
  .share-btn.primary{ background:var(--primary);color:#04342C;border-color:var(--primary); }
  .share-btn.primary:hover{ background:var(--primary-d);color:#fff; }
  .share-btn .ic{ font-size:16px;line-height:1; }
  .qrm{ position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;background:rgba(4,20,17,.62);padding:20px; }
  .qrm.on{ display:flex; }
  .qrm-card{ position:relative;background:#fff;border-radius:20px;max-width:360px;width:100%;padding:24px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3); }
  .qrm-x{ position:absolute;top:-44px;right:0;font-size:30px;line-height:1;color:#fff;background:none;border:none;cursor:pointer; }
  .qrm-title{ font-family:'Syne';font-weight:700;font-size:18px;color:var(--text);margin-bottom:4px; }
  .qrm-sub{ font-size:13px;color:var(--muted);margin-bottom:16px; }
  .qrm-box{ background:#fff;border:1px solid var(--border);border-radius:16px;padding:14px;display:inline-block;line-height:0; }
  .qrm-box canvas{ width:220px;height:220px;display:block;image-rendering:pixelated; }
  .qrm-dl{ display:inline-flex;align-items:center;gap:8px;margin-top:16px;cursor:pointer;background:var(--primary);color:#04342C;font-family:'Syne';font-weight:700;font-size:14px;padding:11px 20px;border-radius:12px;border:none;text-decoration:none; }
  .qrm-dl:hover{ background:var(--primary-d);color:#fff; }
  .qrm-url{ font-size:12px;color:var(--muted);margin-top:12px;word-break:break-all; }
  .lkl-toast{ position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(20px);background:var(--text);color:#fff;font-size:14px;font-weight:500;padding:12px 20px;border-radius:12px;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;z-index:70; }
  .lkl-toast.on{ opacity:1;transform:translateX(-50%) translateY(0); }
  /* LKL_HEB_LOT15 : infos pratiques */
  .pratik-grid{ display:grid;grid-template-columns:repeat(2,1fr);gap:14px 20px;margin-top:6px; }
  .pratik-row{ display:flex;align-items:flex-start;gap:11px; }
  .pratik-ic{ font-size:22px;line-height:1.2;flex:0 0 auto; }
  .pratik-lab{ font-size:12px;color:var(--muted);font-weight:500; }
  .pratik-val{ font-size:15px;color:var(--text);font-weight:600; }
  .pratik-note{ margin-top:16px;padding:14px 16px;background:var(--primary-l);border-radius:12px; }
  .pratik-note .pratik-lab{ margin-bottom:4px; }
  .pratik-note p{ font-size:14px;color:#374039;line-height:1.6; }
  @media (max-width:600px){ .pratik-grid{ grid-template-columns:1fr; } }
  footer{ text-align:center;padding:30px 20px 44px;color:var(--muted);font-size:12px; }
  footer a{ color:var(--primary-d);text-decoration:none;font-weight:600; }

  @media (max-width:900px){
    .hero{ min-height:300px; }
    .hero-title{ font-size:26px; }
    .layout{ grid-template-columns:1fr;gap:16px; }
    .col-side{ order:-1; }
    .book{ position:static; }
  }
  @media (max-width:600px){
    .hero{ min-height:240px; }
    .hero-title{ font-size:23px; }
    .env-grid{ grid-template-columns:repeat(2,1fr); }
  }
</style>
</head>
<body>

${ref ? `<div class="ref-banner">🎁 Invité par un ami — bienvenue sur Lokalist !</div>` : ''}

<header class="top-bar">
  <div class="in">
    <a href="${SITE_URL}" class="brand"><img src="${LOGO_URL}" alt="Lokalist"/> Lokalist</a>
    <span class="verif"><img src="${LOGO_URL}" alt=""/> Vérifié Lokalist</span>
  </div>
</header>

<section class="hero" style="${heroStyle}">
  ${heroFb}
  <div class="hero-ov" style="background:linear-gradient(180deg, ${S.wash} 0%, rgba(0,0,0,0) 32%, rgba(0,0,0,0.20) 55%, rgba(0,0,0,0.66) 100%);"></div>
  <div class="hero-in">
    <div class="hero-top">
      <div class="hero-badges">
        <span class="hb">${escapeHtml(typeLabel)}</span>
        ${etos > 0 ? `<span class="hb hb-stars">${'★'.repeat(etos)}</span>` : ''}
      </div>
      <span class="hero-season" style="background:${S.tint};">${S.emoji} Ambiance ${S.label.toLowerCase()}</span>
    </div>
    <div class="hero-foot">
      <div>
        <div class="hero-title">${escapeHtml(nom)}</div>
        ${ville ? `<div class="hero-loc">📍 ${escapeHtml(ville)}</div>` : ''}
      </div>
      ${noteAff > 0 ? `<div class="hero-note"><div class="n"><b>★</b> ${Number(noteAff).toFixed(1)}</div><div class="s">${nbAvisAff} avis</div></div>` : ''}
    </div>
  </div>
  ${photos.length > 1 ? `<span class="hero-count" data-lb="0" style="cursor:zoom-in">📷 ${photos.length} photos</span>` : ''}
</section>

<main class="wrap">
  <div class="share-bar">
    <button type="button" class="share-btn primary" id="lkl-share"><span class="ic">🔗</span> Partager</button>
    <button type="button" class="share-btn" id="lkl-qr-open"><span class="ic">🔳</span> QR code</button>
  </div>
  ${thumbsHtml}
  <div class="layout">
    <div class="col-main">
      ${factsHtml}
      <section class="section">
        <h2>Le logement</h2>
        <p>${escapeHtml(description)}</p>
        ${c.num_enregistrement ? `<div class="enr">N° d'enregistrement : ${escapeHtml(c.num_enregistrement)}</div>` : ''}
      </section>
      ${equipementsHtml}
      ${infosHtml}
      ${agendaHtml}
      ${environsHtml}
      ${tarifsHtml}
      ${dispoHtml}
      ${explainHtml}
      ${contactHtml}
      <section class="section">
        <h2>Avis${nbAvisAff > 0 ? ` (${nbAvisAff})` : ''}</h2>
        ${noteAff > 0 ? `<div class="avis-resume"><span class="avis-resume-note">${Number(noteAff).toFixed(1)}</span><span class="avis-resume-stars">${etoiles(noteAff)}</span></div>` : ''}
        ${avisHtml || '<p style="color:var(--muted);font-size:14px;">Aucun avis pour le moment. Scannez le QR de l\'hébergement pour partager votre séjour depuis l\'app.</p>'}
        <a href="lokalist://avis?type=commercant&id=${id}" class="avis-cta">✍️ Laisser un avis dans l'app</a>
      </section>
    </div>

    <aside class="col-side">
      <div class="book">
        <div class="book-top">
          <div class="book-price">${prixIndic !== null ? `dès ${prixIndic} €` : 'Sur demande'} <span>${prixIndic !== null ? '/ nuit' : ''}</span></div>
          <span class="book-tag">🛡️ Séjour sur demande</span>
        </div>
        <div class="book-dates">
          <div class="book-date"><div class="dl">Arrivée</div><div class="dv">— —</div></div>
          <div class="book-date"><div class="dl">Départ</div><div class="dv">— —</div></div>
        </div>
        ${peutResa
          ? `<a class="btn-resa" href="${deepLink}">Demander un séjour</a>`
          : `<a class="btn-resa" href="${deepLink}">Voir dans l'app</a>`}
        <a class="btn-app-l" href="${deepLink}">📱 Ouvrir dans l'app Lokalist</a>
      </div>
    </aside>
  </div>

  <div class="cta-block">
    <h3>📱 Réservez et découvrez ${escapeHtml(nom)} dans l'app</h3>
    <p>Séjours, avis vérifiés et bons plans locaux, au même endroit.</p>
    <a href="${deepLink}" class="cta-btn">Ouvrir dans l'app</a>
  </div>
</main>

<footer>
  <p>© Lokalist · L'app hyperlocale de votre région</p>
  <p style="margin-top:6px;"><a href="${SITE_URL}">Accueil</a> · <a href="${SITE_URL}/contact">Contact</a> · <a href="${SITE_URL}/mentions-legales">Mentions légales</a></p>
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

<!-- LKL_HEB_LOT13_FIX -->
<div id="qrm" class="qrm" aria-hidden="true">
  <button type="button" class="qrm-x" id="qrm-close" aria-label="Fermer">&times;</button>
  <div class="qrm-card">
    <div class="qrm-title">Scannez pour voir la fiche</div>
    <div class="qrm-sub">${escapeHtml(nom)}${ville ? ' \\u00b7 ' + escapeHtml(ville) : ''}</div>
    <div class="qrm-box"><canvas id="qrm-canvas" width="220" height="220"></canvas></div>
    <button type="button" class="qrm-dl" id="qrm-dl"><span>\\u2b07\\ufe0f</span> Telecharger le QR (PNG)</button>
    <div class="qrm-url">${escapeHtml(canonical)}</div>
  </div>
</div>
<div class="lkl-toast" id="lkl-toast"></div>
<script>
(function(){
  if (window.__lklShareInit) return; window.__lklShareInit = true;
  var URL_ = ${JSON.stringify(canonical)};
  var NAME_ = ${JSON.stringify(nom)};
  var SLUG_ = ${JSON.stringify(slugCanon)};
  window.__lklQr = (function(){ var module={exports:{}}, exports=module.exports; var $=(function(){var P=function(x,w){var g=236,l=17,n=x,s=O[w],t=null,r=0,h=null,i=[],v={},_=function(a,f){r=n*4+17,t=(function(e){for(var u=new Array(e),o=0;o<e;o+=1){u[o]=new Array(e);for(var d=0;d<e;d+=1)u[o][d]=null}return u})(r),B(0,0),B(r-7,0),B(0,r-7),E(),T(),m(a,f),n>=7&&N(a),h==null&&(h=ar(n,s,i)),U(h,f)},B=function(a,f){for(var e=-1;e<=7;e+=1)if(!(a+e<=-1||r<=a+e))for(var u=-1;u<=7;u+=1)f+u<=-1||r<=f+u||(0<=e&&e<=6&&(u==0||u==6)||0<=u&&u<=6&&(e==0||e==6)||2<=e&&e<=4&&2<=u&&u<=4?t[a+e][f+u]=!0:t[a+e][f+u]=!1)},y=function(){for(var a=0,f=0,e=0;e<8;e+=1){_(!0,e);var u=k.getLostPoint(v);(e==0||a>u)&&(a=u,f=e)}return f},T=function(){for(var a=8;a<r-8;a+=1)t[a][6]==null&&(t[a][6]=a%2==0);for(var f=8;f<r-8;f+=1)t[6][f]==null&&(t[6][f]=f%2==0)},E=function(){for(var a=k.getPatternPosition(n),f=0;f<a.length;f+=1)for(var e=0;e<a.length;e+=1){var u=a[f],o=a[e];if(t[u][o]==null)for(var d=-2;d<=2;d+=1)for(var c=-2;c<=2;c+=1)d==-2||d==2||c==-2||c==2||d==0&&c==0?t[u+d][o+c]=!0:t[u+d][o+c]=!1}},N=function(a){for(var f=k.getBCHTypeNumber(n),e=0;e<18;e+=1){var u=!a&&(f>>e&1)==1;t[Math.floor(e/3)][e%3+r-8-3]=u}for(var e=0;e<18;e+=1){var u=!a&&(f>>e&1)==1;t[e%3+r-8-3][Math.floor(e/3)]=u}},m=function(a,f){for(var e=s<<3|f,u=k.getBCHTypeInfo(e),o=0;o<15;o+=1){var d=!a&&(u>>o&1)==1;o<6?t[o][8]=d:o<8?t[o+1][8]=d:t[r-15+o][8]=d}for(var o=0;o<15;o+=1){var d=!a&&(u>>o&1)==1;o<8?t[8][r-o-1]=d:o<9?t[8][15-o-1+1]=d:t[8][15-o-1]=d}t[r-8][8]=!a},U=function(a,f){for(var e=-1,u=r-1,o=7,d=0,c=k.getMaskFunction(f),p=r-1;p>0;p-=2)for(p==6&&(p-=1);;){for(var b=0;b<2;b+=1)if(t[u][p-b]==null){var C=!1;d<a.length&&(C=(a[d]>>>o&1)==1);var A=c(u,p-b);A&&(C=!C),t[u][p-b]=C,o-=1,o==-1&&(d+=1,o=7)}if(u+=e,u<0||r<=u){u-=e,e=-e;break}}},H=function(a,f){for(var e=0,u=0,o=0,d=new Array(f.length),c=new Array(f.length),p=0;p<f.length;p+=1){var b=f[p].dataCount,C=f[p].totalCount-b;u=Math.max(u,b),o=Math.max(o,C),d[p]=new Array(b);for(var A=0;A<d[p].length;A+=1)d[p][A]=255&a.getBuffer()[A+e];e+=b;var R=k.getErrorCorrectPolynomial(C),I=K(d[p],R.getLength()-1),S=I.mod(R);c[p]=new Array(R.getLength()-1);for(var A=0;A<c[p].length;A+=1){var X=A+S.getLength()-c[p].length;c[p][A]=X>=0?S.getAt(X):0}}for(var Z=0,A=0;A<f.length;A+=1)Z+=f[A].totalCount;for(var J=new Array(Z),Q=0,A=0;A<u;A+=1)for(var p=0;p<f.length;p+=1)A<d[p].length&&(J[Q]=d[p][A],Q+=1);for(var A=0;A<o;A+=1)for(var p=0;p<f.length;p+=1)A<c[p].length&&(J[Q]=c[p][A],Q+=1);return J},ar=function(a,f,e){for(var u=Y.getRSBlocks(a,f),o=G(),d=0;d<e.length;d+=1){var c=e[d];o.put(c.getMode(),4),o.put(c.getLength(),k.getLengthInBits(c.getMode(),a)),c.write(o)}for(var p=0,d=0;d<u.length;d+=1)p+=u[d].dataCount;if(o.getLengthInBits()>p*8)throw"code length overflow. ("+o.getLengthInBits()+">"+p*8+")";for(o.getLengthInBits()+4<=p*8&&o.put(0,4);o.getLengthInBits()%8!=0;)o.putBit(!1);for(;!(o.getLengthInBits()>=p*8||(o.put(g,8),o.getLengthInBits()>=p*8));)o.put(l,8);return H(o,u)};v.addData=function(a,f){f=f||"Byte";var e=null;switch(f){case"Numeric":e=W(a);break;case"Alphanumeric":e=V(a);break;case"Byte":e=q(a);break;case"Kanji":e=z(a);break;default:throw"mode:"+f}i.push(e),h=null},v.isDark=function(a,f){if(a<0||r<=a||f<0||r<=f)throw a+","+f;return t[a][f]},v.getModuleCount=function(){return r},v.make=function(){if(n<1){for(var a=1;a<40;a++){for(var f=Y.getRSBlocks(a,s),e=G(),u=0;u<i.length;u++){var o=i[u];e.put(o.getMode(),4),e.put(o.getLength(),k.getLengthInBits(o.getMode(),a)),o.write(e)}for(var d=0,u=0;u<f.length;u++)d+=f[u].dataCount;if(e.getLengthInBits()<=d*8)break}n=a}_(!1,y())},v.createTableTag=function(a,f){a=a||2,f=typeof f>"u"?a*4:f;var e="";e+='<table style="',e+=" border-width: 0px; border-style: none;",e+=" border-collapse: collapse;",e+=" padding: 0px; margin: "+f+"px;",e+='">',e+="<tbody>";for(var u=0;u<v.getModuleCount();u+=1){e+="<tr>";for(var o=0;o<v.getModuleCount();o+=1)e+='<td style="',e+=" border-width: 0px; border-style: none;",e+=" border-collapse: collapse;",e+=" padding: 0px; margin: 0px;",e+=" width: "+a+"px;",e+=" height: "+a+"px;",e+=" background-color: ",e+=v.isDark(u,o)?"#000000":"#ffffff",e+=";",e+='"/>';e+="</tr>"}return e+="</tbody>",e+="</table>",e},v.createSvgTag=function(a,f,e,u){var o={};typeof arguments[0]=="object"&&(o=arguments[0],a=o.cellSize,f=o.margin,e=o.alt,u=o.title),a=a||2,f=typeof f>"u"?a*4:f,e=typeof e=="string"?{text:e}:e||{},e.text=e.text||null,e.id=e.text?e.id||"qrcode-description":null,u=typeof u=="string"?{text:u}:u||{},u.text=u.text||null,u.id=u.text?u.id||"qrcode-title":null;var d=v.getModuleCount()*a+f*2,c,p,b,C,A="",R;for(R="l"+a+",0 0,"+a+" -"+a+",0 0,-"+a+"z ",A+='<svg version="1.1" xmlns="http://www.w3.org/2000/svg"',A+=o.scalable?"":' width="'+d+'px" height="'+d+'px"',A+=' viewBox="0 0 '+d+" "+d+'" ',A+=' preserveAspectRatio="xMinYMin meet"',A+=u.text||e.text?' role="img" aria-labelledby="'+F([u.id,e.id].join(" ").trim())+'"':"",A+=">",A+=u.text?'<title id="'+F(u.id)+'">'+F(u.text)+"</title>":"",A+=e.text?'<description id="'+F(e.id)+'">'+F(e.text)+"</description>":"",A+='<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>',A+='<path d="',b=0;b<v.getModuleCount();b+=1)for(C=b*a+f,c=0;c<v.getModuleCount();c+=1)v.isDark(b,c)&&(p=c*a+f,A+="M"+p+","+C+R);return A+='" stroke="transparent" fill="black"/>',A+="</svg>",A},v.createDataURL=function(a,f){a=a||2,f=typeof f>"u"?a*4:f;var e=v.getModuleCount()*a+f*2,u=f,o=e-f;return nr(e,e,function(d,c){if(u<=d&&d<o&&u<=c&&c<o){var p=Math.floor((d-u)/a),b=Math.floor((c-u)/a);return v.isDark(b,p)?0:1}else return 1})},v.createImgTag=function(a,f,e){a=a||2,f=typeof f>"u"?a*4:f;var u=v.getModuleCount()*a+f*2,o="";return o+="<img",o+=' src="',o+=v.createDataURL(a,f),o+='"',o+=' width="',o+=u,o+='"',o+=' height="',o+=u,o+='"',e&&(o+=' alt="',o+=F(e),o+='"'),o+="/>",o};var F=function(a){for(var f="",e=0;e<a.length;e+=1){var u=a.charAt(e);switch(u){case"<":f+="&lt;";break;case">":f+="&gt;";break;case"&":f+="&amp;";break;case'"':f+="&quot;";break;default:f+=u;break}}return f},fr=function(a){var f=1;a=typeof a>"u"?f*2:a;var e=v.getModuleCount()*f+a*2,u=a,o=e-a,d,c,p,b,C,A={"\\u2588\\u2588":"\\u2588","\\u2588 ":"\\u2580"," \\u2588":"\\u2584","  ":" "},R={"\\u2588\\u2588":"\\u2580","\\u2588 ":"\\u2580"," \\u2588":" ","  ":" "},I="";for(d=0;d<e;d+=2){for(p=Math.floor((d-u)/f),b=Math.floor((d+1-u)/f),c=0;c<e;c+=1)C="\\u2588",u<=c&&c<o&&u<=d&&d<o&&v.isDark(p,Math.floor((c-u)/f))&&(C=" "),u<=c&&c<o&&u<=d+1&&d+1<o&&v.isDark(b,Math.floor((c-u)/f))?C+=" ":C+="\\u2588",I+=a<1&&d+1>=o?R[C]:A[C];I+="\\n"}return e%2&&a>0?I.substring(0,I.length-e-1)+Array(e+1).join("\\u2580"):I.substring(0,I.length-1)};return v.createASCII=function(a,f){if(a=a||1,a<2)return fr(f);a-=1,f=typeof f>"u"?a*2:f;var e=v.getModuleCount()*a+f*2,u=f,o=e-f,d,c,p,b,C=Array(a+1).join("\\u2588\\u2588"),A=Array(a+1).join("  "),R="",I="";for(d=0;d<e;d+=1){for(p=Math.floor((d-u)/a),I="",c=0;c<e;c+=1)b=1,u<=c&&c<o&&u<=d&&d<o&&v.isDark(p,Math.floor((c-u)/a))&&(b=0),I+=b?C:A;for(p=0;p<a;p+=1)R+=I+"\\n"}return R.substring(0,R.length-1)},v.renderTo2dContext=function(a,f){f=f||2;for(var e=v.getModuleCount(),u=0;u<e;u++)for(var o=0;o<e;o++)a.fillStyle=v.isDark(u,o)?"black":"white",a.fillRect(o*f,u*f,f,f)},v};P.stringToBytesFuncs={default:function(x){for(var w=[],g=0;g<x.length;g+=1){var l=x.charCodeAt(g);w.push(l&255)}return w}},P.stringToBytes=P.stringToBytesFuncs.default,P.createStringToBytes=function(x,w){var g=(function(){for(var n=tr(x),s=function(){var T=n.read();if(T==-1)throw"eof";return T},t=0,r={};;){var h=n.read();if(h==-1)break;var i=s(),v=s(),_=s(),B=String.fromCharCode(h<<8|i),y=v<<8|_;r[B]=y,t+=1}if(t!=w)throw t+" != "+w;return r})(),l=63;return function(n){for(var s=[],t=0;t<n.length;t+=1){var r=n.charCodeAt(t);if(r<128)s.push(r);else{var h=g[n.charAt(t)];typeof h=="number"?(h&255)==h?s.push(h):(s.push(h>>>8),s.push(h&255)):s.push(l)}}return s}};var D={MODE_NUMBER:1,MODE_ALPHA_NUM:2,MODE_8BIT_BYTE:4,MODE_KANJI:8},O={L:1,M:0,Q:3,H:2},L={PATTERN000:0,PATTERN001:1,PATTERN010:2,PATTERN011:3,PATTERN100:4,PATTERN101:5,PATTERN110:6,PATTERN111:7},k=(function(){var x=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]],w=1335,g=7973,l=21522,n={},s=function(t){for(var r=0;t!=0;)r+=1,t>>>=1;return r};return n.getBCHTypeInfo=function(t){for(var r=t<<10;s(r)-s(w)>=0;)r^=w<<s(r)-s(w);return(t<<10|r)^l},n.getBCHTypeNumber=function(t){for(var r=t<<12;s(r)-s(g)>=0;)r^=g<<s(r)-s(g);return t<<12|r},n.getPatternPosition=function(t){return x[t-1]},n.getMaskFunction=function(t){switch(t){case L.PATTERN000:return function(r,h){return(r+h)%2==0};case L.PATTERN001:return function(r,h){return r%2==0};case L.PATTERN010:return function(r,h){return h%3==0};case L.PATTERN011:return function(r,h){return(r+h)%3==0};case L.PATTERN100:return function(r,h){return(Math.floor(r/2)+Math.floor(h/3))%2==0};case L.PATTERN101:return function(r,h){return r*h%2+r*h%3==0};case L.PATTERN110:return function(r,h){return(r*h%2+r*h%3)%2==0};case L.PATTERN111:return function(r,h){return(r*h%3+(r+h)%2)%2==0};default:throw"bad maskPattern:"+t}},n.getErrorCorrectPolynomial=function(t){for(var r=K([1],0),h=0;h<t;h+=1)r=r.multiply(K([1,M.gexp(h)],0));return r},n.getLengthInBits=function(t,r){if(1<=r&&r<10)switch(t){case D.MODE_NUMBER:return 10;case D.MODE_ALPHA_NUM:return 9;case D.MODE_8BIT_BYTE:return 8;case D.MODE_KANJI:return 8;default:throw"mode:"+t}else if(r<27)switch(t){case D.MODE_NUMBER:return 12;case D.MODE_ALPHA_NUM:return 11;case D.MODE_8BIT_BYTE:return 16;case D.MODE_KANJI:return 10;default:throw"mode:"+t}else if(r<41)switch(t){case D.MODE_NUMBER:return 14;case D.MODE_ALPHA_NUM:return 13;case D.MODE_8BIT_BYTE:return 16;case D.MODE_KANJI:return 12;default:throw"mode:"+t}else throw"type:"+r},n.getLostPoint=function(t){for(var r=t.getModuleCount(),h=0,i=0;i<r;i+=1)for(var v=0;v<r;v+=1){for(var _=0,B=t.isDark(i,v),y=-1;y<=1;y+=1)if(!(i+y<0||r<=i+y))for(var T=-1;T<=1;T+=1)v+T<0||r<=v+T||y==0&&T==0||B==t.isDark(i+y,v+T)&&(_+=1);_>5&&(h+=3+_-5)}for(var i=0;i<r-1;i+=1)for(var v=0;v<r-1;v+=1){var E=0;t.isDark(i,v)&&(E+=1),t.isDark(i+1,v)&&(E+=1),t.isDark(i,v+1)&&(E+=1),t.isDark(i+1,v+1)&&(E+=1),(E==0||E==4)&&(h+=3)}for(var i=0;i<r;i+=1)for(var v=0;v<r-6;v+=1)t.isDark(i,v)&&!t.isDark(i,v+1)&&t.isDark(i,v+2)&&t.isDark(i,v+3)&&t.isDark(i,v+4)&&!t.isDark(i,v+5)&&t.isDark(i,v+6)&&(h+=40);for(var v=0;v<r;v+=1)for(var i=0;i<r-6;i+=1)t.isDark(i,v)&&!t.isDark(i+1,v)&&t.isDark(i+2,v)&&t.isDark(i+3,v)&&t.isDark(i+4,v)&&!t.isDark(i+5,v)&&t.isDark(i+6,v)&&(h+=40);for(var N=0,v=0;v<r;v+=1)for(var i=0;i<r;i+=1)t.isDark(i,v)&&(N+=1);var m=Math.abs(100*N/r/r-50)/5;return h+=m*10,h},n})(),M=(function(){for(var x=new Array(256),w=new Array(256),g=0;g<8;g+=1)x[g]=1<<g;for(var g=8;g<256;g+=1)x[g]=x[g-4]^x[g-5]^x[g-6]^x[g-8];for(var g=0;g<255;g+=1)w[x[g]]=g;var l={};return l.glog=function(n){if(n<1)throw"glog("+n+")";return w[n]},l.gexp=function(n){for(;n<0;)n+=255;for(;n>=256;)n-=255;return x[n]},l})();function K(x,w){if(typeof x.length>"u")throw x.length+"/"+w;var g=(function(){for(var n=0;n<x.length&&x[n]==0;)n+=1;for(var s=new Array(x.length-n+w),t=0;t<x.length-n;t+=1)s[t]=x[t+n];return s})(),l={};return l.getAt=function(n){return g[n]},l.getLength=function(){return g.length},l.multiply=function(n){for(var s=new Array(l.getLength()+n.getLength()-1),t=0;t<l.getLength();t+=1)for(var r=0;r<n.getLength();r+=1)s[t+r]^=M.gexp(M.glog(l.getAt(t))+M.glog(n.getAt(r)));return K(s,0)},l.mod=function(n){if(l.getLength()-n.getLength()<0)return l;for(var s=M.glog(l.getAt(0))-M.glog(n.getAt(0)),t=new Array(l.getLength()),r=0;r<l.getLength();r+=1)t[r]=l.getAt(r);for(var r=0;r<n.getLength();r+=1)t[r]^=M.gexp(M.glog(n.getAt(r))+s);return K(t,0).mod(n)},l}var Y=(function(){var x=[[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],[2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],[4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],[2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],[4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],[3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],[5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],[5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],[1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],[5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],[3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],[3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],[4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],[2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],[4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],[6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],[8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],[10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],[8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],[3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],[7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],[5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],[13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],[17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],[17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],[13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],[12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],[6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],[17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],[4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],[20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],[19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]],w=function(n,s){var t={};return t.totalCount=n,t.dataCount=s,t},g={},l=function(n,s){switch(s){case O.L:return x[(n-1)*4+0];case O.M:return x[(n-1)*4+1];case O.Q:return x[(n-1)*4+2];case O.H:return x[(n-1)*4+3];default:return}};return g.getRSBlocks=function(n,s){var t=l(n,s);if(typeof t>"u")throw"bad rs block @ typeNumber:"+n+"/errorCorrectionLevel:"+s;for(var r=t.length/3,h=[],i=0;i<r;i+=1)for(var v=t[i*3+0],_=t[i*3+1],B=t[i*3+2],y=0;y<v;y+=1)h.push(w(_,B));return h},g})(),G=function(){var x=[],w=0,g={};return g.getBuffer=function(){return x},g.getAt=function(l){var n=Math.floor(l/8);return(x[n]>>>7-l%8&1)==1},g.put=function(l,n){for(var s=0;s<n;s+=1)g.putBit((l>>>n-s-1&1)==1)},g.getLengthInBits=function(){return w},g.putBit=function(l){var n=Math.floor(w/8);x.length<=n&&x.push(0),l&&(x[n]|=128>>>w%8),w+=1},g},W=function(x){var w=D.MODE_NUMBER,g=x,l={};l.getMode=function(){return w},l.getLength=function(t){return g.length},l.write=function(t){for(var r=g,h=0;h+2<r.length;)t.put(n(r.substring(h,h+3)),10),h+=3;h<r.length&&(r.length-h==1?t.put(n(r.substring(h,h+1)),4):r.length-h==2&&t.put(n(r.substring(h,h+2)),7))};var n=function(t){for(var r=0,h=0;h<t.length;h+=1)r=r*10+s(t.charAt(h));return r},s=function(t){if("0"<=t&&t<="9")return t.charCodeAt(0)-48;throw"illegal char :"+t};return l},V=function(x){var w=D.MODE_ALPHA_NUM,g=x,l={};l.getMode=function(){return w},l.getLength=function(s){return g.length},l.write=function(s){for(var t=g,r=0;r+1<t.length;)s.put(n(t.charAt(r))*45+n(t.charAt(r+1)),11),r+=2;r<t.length&&s.put(n(t.charAt(r)),6)};var n=function(s){if("0"<=s&&s<="9")return s.charCodeAt(0)-48;if("A"<=s&&s<="Z")return s.charCodeAt(0)-65+10;switch(s){case" ":return 36;case"$":return 37;case"%":return 38;case"*":return 39;case"+":return 40;case"-":return 41;case".":return 42;case"/":return 43;case":":return 44;default:throw"illegal char :"+s}};return l},q=function(x){var w=D.MODE_8BIT_BYTE,g=x,l=P.stringToBytes(x),n={};return n.getMode=function(){return w},n.getLength=function(s){return l.length},n.write=function(s){for(var t=0;t<l.length;t+=1)s.put(l[t],8)},n},z=function(x){var w=D.MODE_KANJI,g=x,l=P.stringToBytesFuncs.SJIS;if(!l)throw"sjis not supported.";(function(t,r){var h=l(t);if(h.length!=2||(h[0]<<8|h[1])!=r)throw"sjis not supported."})("\\u53CB",38726);var n=l(x),s={};return s.getMode=function(){return w},s.getLength=function(t){return~~(n.length/2)},s.write=function(t){for(var r=n,h=0;h+1<r.length;){var i=(255&r[h])<<8|255&r[h+1];if(33088<=i&&i<=40956)i-=33088;else if(57408<=i&&i<=60351)i-=49472;else throw"illegal char at "+(h+1)+"/"+i;i=(i>>>8&255)*192+(i&255),t.put(i,13),h+=2}if(h<r.length)throw"illegal char at "+(h+1)},s},j=function(){var x=[],w={};return w.writeByte=function(g){x.push(g&255)},w.writeShort=function(g){w.writeByte(g),w.writeByte(g>>>8)},w.writeBytes=function(g,l,n){l=l||0,n=n||g.length;for(var s=0;s<n;s+=1)w.writeByte(g[s+l])},w.writeString=function(g){for(var l=0;l<g.length;l+=1)w.writeByte(g.charCodeAt(l))},w.toByteArray=function(){return x},w.toString=function(){var g="";g+="[";for(var l=0;l<x.length;l+=1)l>0&&(g+=","),g+=x[l];return g+="]",g},w},rr=function(){var x=0,w=0,g=0,l="",n={},s=function(r){l+=String.fromCharCode(t(r&63))},t=function(r){if(!(r<0)){if(r<26)return 65+r;if(r<52)return 97+(r-26);if(r<62)return 48+(r-52);if(r==62)return 43;if(r==63)return 47}throw"n:"+r};return n.writeByte=function(r){for(x=x<<8|r&255,w+=8,g+=1;w>=6;)s(x>>>w-6),w-=6},n.flush=function(){if(w>0&&(s(x<<6-w),x=0,w=0),g%3!=0)for(var r=3-g%3,h=0;h<r;h+=1)l+="="},n.toString=function(){return l},n},tr=function(x){var w=x,g=0,l=0,n=0,s={};s.read=function(){for(;n<8;){if(g>=w.length){if(n==0)return-1;throw"unexpected end of file./"+n}var r=w.charAt(g);if(g+=1,r=="=")return n=0,-1;if(r.match(/^\\s$/))continue;l=l<<6|t(r.charCodeAt(0)),n+=6}var h=l>>>n-8&255;return n-=8,h};var t=function(r){if(65<=r&&r<=90)return r-65;if(97<=r&&r<=122)return r-97+26;if(48<=r&&r<=57)return r-48+52;if(r==43)return 62;if(r==47)return 63;throw"c:"+r};return s},er=function(x,w){var g=x,l=w,n=new Array(x*w),s={};s.setPixel=function(i,v,_){n[v*g+i]=_},s.write=function(i){i.writeString("GIF87a"),i.writeShort(g),i.writeShort(l),i.writeByte(128),i.writeByte(0),i.writeByte(0),i.writeByte(0),i.writeByte(0),i.writeByte(0),i.writeByte(255),i.writeByte(255),i.writeByte(255),i.writeString(","),i.writeShort(0),i.writeShort(0),i.writeShort(g),i.writeShort(l),i.writeByte(0);var v=2,_=r(v);i.writeByte(v);for(var B=0;_.length-B>255;)i.writeByte(255),i.writeBytes(_,B,255),B+=255;i.writeByte(_.length-B),i.writeBytes(_,B,_.length-B),i.writeByte(0),i.writeString(";")};var t=function(i){var v=i,_=0,B=0,y={};return y.write=function(T,E){if(T>>>E)throw"length over";for(;_+E>=8;)v.writeByte(255&(T<<_|B)),E-=8-_,T>>>=8-_,B=0,_=0;B=T<<_|B,_=_+E},y.flush=function(){_>0&&v.writeByte(B)},y},r=function(i){for(var v=1<<i,_=(1<<i)+1,B=i+1,y=h(),T=0;T<v;T+=1)y.add(String.fromCharCode(T));y.add(String.fromCharCode(v)),y.add(String.fromCharCode(_));var E=j(),N=t(E);N.write(v,B);var m=0,U=String.fromCharCode(n[m]);for(m+=1;m<n.length;){var H=String.fromCharCode(n[m]);m+=1,y.contains(U+H)?U=U+H:(N.write(y.indexOf(U),B),y.size()<4095&&(y.size()==1<<B&&(B+=1),y.add(U+H)),U=H)}return N.write(y.indexOf(U),B),N.write(_,B),N.flush(),E.toByteArray()},h=function(){var i={},v=0,_={};return _.add=function(B){if(_.contains(B))throw"dup key:"+B;i[B]=v,v+=1},_.size=function(){return v},_.indexOf=function(B){return i[B]},_.contains=function(B){return typeof i[B]<"u"},_};return s},nr=function(x,w,g){for(var l=er(x,w),n=0;n<w;n+=1)for(var s=0;s<x;s+=1)l.setPixel(s,n,g(s,n));var t=j();l.write(t);for(var r=rr(),h=t.toByteArray(),i=0;i<h.length;i+=1)r.writeByte(h[i]);return r.flush(),"data:image/gif;base64,"+r};return P})();(function(){$.stringToBytesFuncs["UTF-8"]=function(P){function D(O){for(var L=[],k=0;k<O.length;k++){var M=O.charCodeAt(k);M<128?L.push(M):M<2048?L.push(192|M>>6,128|M&63):M<55296||M>=57344?L.push(224|M>>12,128|M>>6&63,128|M&63):(k++,M=65536+((M&1023)<<10|O.charCodeAt(k)&1023),L.push(240|M>>18,128|M>>12&63,128|M>>6&63,128|M&63))}return L}return D(P)}})(),(function(P){typeof define=="function"&&define.amd?define([],P):typeof exports=="object"&&(module.exports=P())})(function(){return $});
; return module.exports; })();
  function el(id){ return document.getElementById(id); }
  function toast(m){ var t=el("lkl-toast"); if(!t) return; t.textContent=m; t.classList.add("on"); setTimeout(function(){ t.classList.remove("on"); },2200); }
  function doShare(){
    var data={ title:NAME_, text:"D\\u00e9couvrez "+NAME_+" sur Lokalist", url:URL_ };
    if(navigator.share){ navigator.share(data).catch(function(){}); return; }
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(URL_).then(function(){ toast("Lien copi\\u00e9 \\u2713"); }).catch(function(){ window.prompt("Copiez le lien :", URL_); }); return; }
    window.prompt("Copiez le lien :", URL_);
  }
  var _mat=null, _n=0;
  function ensureMatrix(){
    if(_mat) return true;
    try{ var qr=window.__lklQr(0,"M"); qr.addData(URL_); qr.make(); _n=qr.getModuleCount(); _mat=[]; for(var r=0;r<_n;r++){ var row=[]; for(var c=0;c<_n;c++){ row.push(qr.isDark(r,c)?1:0); } _mat.push(row);} return true; }catch(e){ return false; }
  }
  function paint(cv, cell){
    var quiet=4, total=_n+quiet*2, size=cell*total; cv.width=size; cv.height=size;
    var ctx=cv.getContext("2d"); ctx.fillStyle="#ffffff"; ctx.fillRect(0,0,size,size); ctx.fillStyle="#0B0B0B";
    for(var r=0;r<_n;r++){ for(var c=0;c<_n;c++){ if(_mat[r][c]){ ctx.fillRect((c+quiet)*cell,(r+quiet)*cell,cell,cell); } } }
  }
  var _shown=false;
  function openQr(){ var m=el("qrm"); if(!m) return; if(!_shown && ensureMatrix()){ var cv=el("qrm-canvas"); var cell=Math.max(3, Math.floor(220/(_n+8))); paint(cv, cell); _shown=true; } m.classList.add("on"); m.setAttribute("aria-hidden","false"); document.body.style.overflow="hidden"; }
  function closeQr(){ var m=el("qrm"); if(!m) return; m.classList.remove("on"); m.setAttribute("aria-hidden","true"); document.body.style.overflow=""; }
  function dlQr(){
    if(!ensureMatrix()){ toast("QR indisponible"); return; }
    try{ var off=document.createElement("canvas"); paint(off, 10); var link=document.createElement("a"); link.download="Lokalist-QR-"+(SLUG_||"hebergement")+".png"; link.href=off.toDataURL("image/png"); document.body.appendChild(link); link.click(); document.body.removeChild(link); }
    catch(e){ toast("T\\u00e9l\\u00e9chargement impossible"); }
  }
  function hit(e,sel){ return e.target && e.target.closest && e.target.closest(sel); }
  document.addEventListener("click", function(e){
    if(hit(e,"#lkl-share")){ doShare(); return; }
    if(hit(e,"#lkl-qr-open")){ openQr(); return; }
    if(hit(e,"#qrm-close")){ closeQr(); return; }
    if(hit(e,"#qrm-dl")){ dlQr(); return; }
    var m=el("qrm"); if(m && m.classList.contains("on") && e.target===m){ closeQr(); }
  });
  document.addEventListener("keydown", function(e){ if(e.key==="Escape"){ var m=el("qrm"); if(m && m.classList.contains("on")) closeQr(); } });
})();
</script>
${lightboxHtml}
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

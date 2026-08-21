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
//  Hebergeur = commercant (type_pro='hebergeur', resa_type='sejour')
// ════════════════════════════════════════════════════════════════

export const config = { runtime: 'edge' };

const SUPABASE_URL  = 'https://kukathominhssogthplc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a2F0aG9taW5oc3NvZ3RocGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTU2NDMsImV4cCI6MjA5MDQzMTY0M30.nrfnhLWA_N-d5EA0qMvSTgSvbebbqHvWuCwk4PQDxcg';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=fr.lokalist.app';
const APP_STORE_URL  = 'https://apps.apple.com/app/lokalist';
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
      'resa_mode','lien_paiement','acompte_montant'
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

// ════════════════════════════════════════════════════════════════
//  api/artisan.js — Vercel Edge Function
//  SENT: [LKL_ART_PREMIUM_V1] Fiche artisan premium
//  Page HTML SSR pour /artisan/:id (hero teinte + medaillon, garanties,
//  contact, localisation, avis). Deep link lokalist://artisan/:id.
// ════════════════════════════════════════════════════════════════

// LKL_SOCIAL_LOGOS_V1
export const config = { runtime: 'edge' };

const SUPABASE_URL  = 'https://kukathominhssogthplc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a2F0aG9taW5oc3NvZ3RocGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTU2NDMsImV4cCI6MjA5MDQzMTY0M30.nrfnhLWA_N-d5EA0qMvSTgSvbebbqHvWuCwk4PQDxcg';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=fr.lokalist.app';
const APP_STORE_URL  = 'https://apps.apple.com/fr/app/lokalist/id6778774911';
const SITE_URL       = 'https://lokalist.fr';
const LOGO_URL       = `${SITE_URL}/logo.png`;

const escapeHtml = (str) => {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
  var raw = String(v).trim(); var low = raw.toLowerCase();
  if (low.indexOf('http://') === 0 || low.indexOf('https://') === 0) return raw;
  var handle = raw.charAt(0) === '@' ? raw.slice(1) : raw;
  while (handle.charAt(0) === '/') handle = handle.slice(1);
  if (kind === 'instagram') return 'https://instagram.com/' + handle;
  if (kind === 'tiktok')    return 'https://tiktok.com/@' + handle;
  if (kind === 'facebook')  return 'https://facebook.com/' + handle;
  return normUrl(raw);
}
const dateValide = (d) => { if (!d) return true; try { return new Date(d) > new Date(); } catch { return true; } };

const html404 = (msg) => `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Page introuvable — Lokalist</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#F7F6F3;color:#17231F;padding:40px 20px;text-align:center;line-height:1.6}h1{color:#1D9E75;font-size:28px;margin:24px 0 8px}a{color:#1D9E75;font-weight:600;text-decoration:none}</style>
</head><body>
<div style="font-size:64px">🛠️</div>
<h1>${escapeHtml(msg)}</h1>
<p style="color:#8A8F8B">Cet artisan n'existe plus ou a été retiré.</p>
<p><a href="${SITE_URL}">← Retour à Lokalist</a></p>
</body></html>`;

const pageNotFound = (msg = "Artisan introuvable") => new Response(html404(msg), { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const id  = url.searchParams.get('id');
    const ref = sanitizeRef(url.searchParams.get('ref'));
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return pageNotFound("Identifiant invalide");

    const cols = 'id,nom,prenom,nom_entreprise,ville,code_postal,description,photo_url,photo_couverture,note_moyenne,nb_avis,rayon_intervention,actif,demo,suspendu_plainte,telephone,email,afficher_email,afficher_telephone,site_web,adresse,adresse_masquee,latitude,longitude,siret,assurance,assurance_valide,certifie_rge,rge_expire,decennale_valide,badge_verifie,badge_top,urgence,disponible,type_clientele,instagram,facebook,tiktok,afficher_gerant,categories_artisans(nom,emoji)';
    const r = await fetch(`${SUPABASE_URL}/rest/v1/artisans?id=eq.${id}&select=${cols}`, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } });
    if (!r.ok) return pageNotFound('Erreur lors du chargement');
    const list = await r.json();
    if (!list || !list.length) return pageNotFound();
    const a = list[0];
    if (a.demo === true) return pageNotFound("Fiche non disponible");
    if (a.actif === false) return pageNotFound("Cet artisan n'est plus actif");
    if (a.suspendu_plainte === true) return pageNotFound("Cet artisan n'est plus disponible");

    // ─── Avis ───
    let avisMoyenne = 0, avisNb = 0, avisListe = [];
    try {
      const avUrl = `${SUPABASE_URL}/rest/v1/avis_public?cible_type=eq.artisan&cible_id=eq.${id}&order=date_publication.desc&limit=20`;
      const agUrl = `${SUPABASE_URL}/rest/v1/avis_agrege?cible_type=eq.artisan&cible_id=eq.${id}`;
      const [avR, agR] = await Promise.all([
        fetch(avUrl, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }),
        fetch(agUrl, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }),
      ]);
      avisListe = avR.ok ? (await avR.json()) : [];
      const agg = agR.ok ? (await agR.json()) : [];
      if (agg && agg[0]) { avisMoyenne = Number(agg[0].note_moyenne) || 0; avisNb = agg[0].nb_avis || 0; }
    } catch (e) { console.error('[artisan avis]', e); }

    const etoiles = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
    const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' }); } catch { return ''; } };
    const avisHtml = (avisListe || []).map((av) => `
      <div class="avis-card">
        <div class="avis-head"><div class="avis-auteur">${escapeHtml(av.auteur_nom || 'Client')}</div>${av.verified ? '<span class="avis-verif">✓ Vérifié</span>' : ''}</div>
        <div class="avis-stars">${etoiles(av.note)}</div>
        ${av.titre ? `<div class="avis-titre">${escapeHtml(av.titre)}</div>` : ''}
        ${av.commentaire ? `<div class="avis-txt">${escapeHtml(av.commentaire)}</div>` : ''}
        <div class="avis-date">${fmtDate(av.date_publication)}</div>
        ${av.reponse ? `<div class="avis-rep"><div class="avis-rep-lab">Réponse du professionnel</div>${escapeHtml(av.reponse)}</div>` : ''}
      </div>`).join('');

    // ─── Données ───
    const cat         = a.categories_artisans || {};
    const catNom      = cat.nom || 'Artisan';
    const catEmoji    = cat.emoji || '🛠️';
    const nom         = a.nom_entreprise || `${a.prenom || ''} ${a.nom || ''}`.trim() || 'Artisan local';
    const ville       = a.ville || '';
    const masque      = a.adresse_masquee === true;
    const description = a.description || `${catNom}${ville ? ' à ' + ville : ''} — sur Lokalist, l'app de la vie locale`;
    const descShort   = (description.length > 160 ? description.slice(0, 157) + '...' : description);
    const photoMain   = a.photo_url || null;
    const photoOg     = photoMain || `${SITE_URL}/images/og-default.jpg`;
    const rge         = a.certifie_rge === true && dateValide(a.rge_expire);
    const gerant      = (a.afficher_gerant === true && a.nom_entreprise) ? `${a.prenom || ''} ${a.nom || ''}`.trim() : '';

    const canonical = `${SITE_URL}/artisan/${id}`;
    const deepLink  = `lokalist://artisan/${id}`;

    const jsonLd = {
      "@context": "https://schema.org", "@type": "LocalBusiness",
      "name": nom, "description": description, "image": photoOg, "url": canonical,
      ...(catNom && { "@type": "HomeAndConstructionBusiness" }),
      ...((!masque && a.adresse) && { "address": { "@type": "PostalAddress", "streetAddress": a.adresse, "addressLocality": ville, "postalCode": a.code_postal || undefined, "addressCountry": "FR" } }),
      ...((!masque && a.latitude && a.longitude) && { "geo": { "@type": "GeoCoordinates", "latitude": Number(a.latitude), "longitude": Number(a.longitude) } }),
      ...(a.note_moyenne > 0 && { "aggregateRating": { "@type": "AggregateRating", "ratingValue": Number(a.note_moyenne).toFixed(1), "reviewCount": a.nb_avis || 0 } }),
      ...(a.telephone && a.afficher_telephone !== false && { telephone: a.telephone }),
      ...(a.email && a.afficher_email !== false && { email: a.email }),
      ...((a.site_web || a.instagram || a.facebook || a.tiktok) && { sameAs: [
        ...(a.site_web ? [normUrl(a.site_web)] : []),
        ...(a.instagram ? [socialUrl('instagram', a.instagram)] : []),
        ...(a.facebook ? [socialUrl('facebook', a.facebook)] : []),
        ...(a.tiktok ? [socialUrl('tiktok', a.tiktok)] : []),
      ] }),
    };

    // ─── Hero (fond teinte + medaillon) ───
    const medaillon = photoMain
      ? `<img class="hero-logo" src="${escapeHtml(photoMain)}" alt="${escapeHtml(nom)}"/>`
      : `<div class="hero-logo hero-logo-fb">${catEmoji}</div>`;
    const heroBadges = [`<span class="hb">${catEmoji} ${escapeHtml(catNom)}</span>`];
    if (rge)             heroBadges.push(`<span class="hb hb-ok">✓ RGE</span>`);
    if (a.badge_verifie) heroBadges.push(`<span class="hb hb-ok">✓ Vérifié</span>`);
    if (a.badge_top)     heroBadges.push(`<span class="hb hb-top">★ Top</span>`);

    // ─── Garanties & confiance ───
    const garRows = [];
    if (rge)                garRows.push(`<div class="gar-row"><span class="gar-ic">✓</span><span><span class="gar-lab">Certifié RGE</span>${a.rge_expire ? `<span class="gar-sub"> · valable jusqu'au ${fmtDate(a.rge_expire)}</span>` : ''}</span></div>`);
    if (a.decennale_valide) garRows.push(`<div class="gar-row"><span class="gar-ic">✓</span><span class="gar-lab">Garantie décennale</span></div>`);
    if (a.assurance_valide || a.assurance) garRows.push(`<div class="gar-row"><span class="gar-ic">✓</span><span><span class="gar-lab">Assurance responsabilité civile</span>${a.assurance ? `<span class="gar-sub"> · ${escapeHtml(a.assurance)}</span>` : ''}</span></div>`);
    if (a.siret)            garRows.push(`<div class="gar-row"><span class="gar-ic">✓</span><span><span class="gar-lab">Entreprise immatriculée</span><span class="gar-sub"> · SIRET ${escapeHtml(a.siret)}</span></span></div>`);
    const garantiesHtml = garRows.length ? `
      <section class="section">
        <h2>Garanties &amp; confiance</h2>
        <div class="garanties">${garRows.join('')}</div>
      </section>` : '';

    // ─── Contact ───
    const contactRows = [];
    if (a.telephone && a.afficher_telephone !== false) contactRows.push(`<a class="ct-row" href="tel:${escapeHtml(a.telephone)}"><span class="ct-ic">📞</span><span class="ct-body"><span class="ct-lab">Téléphone</span><span class="ct-val">${escapeHtml(a.telephone)}</span></span></a>`);
    if (a.email && a.afficher_email !== false) contactRows.push(`<a class="ct-row" href="mailto:${escapeHtml(a.email)}"><span class="ct-ic">✉️</span><span class="ct-body"><span class="ct-lab">Email</span><span class="ct-val">${escapeHtml(a.email)}</span></span></a>`);
    if (!masque && a.adresse) contactRows.push(`<div class="ct-row"><span class="ct-ic">📍</span><span class="ct-body"><span class="ct-lab">Adresse</span><span class="ct-val">${escapeHtml(a.adresse)}${ville ? ', ' + escapeHtml(ville) : ''}</span></span></div>`);
    const SOCIAL_ICONS = {
      site: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 0 20 15.3 15.3 0 0 1 0-20"/></svg>',
      instagram: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><defs><radialGradient id="lklIg" cx="30%" cy="107%" r="135%"><stop offset="0%" stop-color="#fdf497"/><stop offset="5%" stop-color="#fdf497"/><stop offset="45%" stop-color="#fd5949"/><stop offset="60%" stop-color="#d6249f"/><stop offset="90%" stop-color="#285AEB"/></radialGradient></defs><path fill="url(#lklIg)" d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.35-2.62-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.41-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z"/></svg>',
      facebook: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="#1877F2"><path d="M24 12.07C24 5.44 18.63.07 12 .07S0 5.44 0 12.07c0 5.99 4.39 10.95 10.13 11.85v-8.38H7.08v-3.47h3.05V9.43c0-3.01 1.79-4.67 4.53-4.67 1.31 0 2.69.24 2.69.24v2.95h-1.51c-1.49 0-1.96.93-1.96 1.87v2.25h3.33l-.53 3.47h-2.8v8.38C19.61 23.02 24 18.06 24 12.07z"/></svg>',
      tiktok: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="#25F4EE" d="M9.9 8.9v-.9a6.4 6.4 0 0 0-.9-.06A6.35 6.35 0 0 0 5.3 19.3a6.35 6.35 0 0 1 4.6-10.4z"/><path fill="#000" d="M16.7 2h-2.5v10.9a1.86 1.86 0 1 1-1.86-1.86c.2 0 .38.03.56.08V8.5a4.53 4.53 0 0 0-.56-.04A4.6 4.6 0 1 0 17 12.9V7.3a6.2 6.2 0 0 0 3.7 1.2V6a3.5 3.5 0 0 1-2.4-1 3.5 3.5 0 0 1-1.6-3z"/><path fill="#FE2C55" d="M19.3 6v-.5a3.5 3.5 0 0 1-1.9-.5 3.5 3.5 0 0 0 1.9 1zm-8.6 2.9a4.6 4.6 0 0 0-4 8.1 4.6 4.6 0 0 1 6.4-6.3V8.5a4.6 4.6 0 0 0-2.4.4z"/></svg>',
    };
    const socialChips = [];
    if (a.site_web)  socialChips.push(`<a class="soc soc-site" href="${escapeHtml(normUrl(a.site_web))}" target="_blank" rel="noopener nofollow" aria-label="Site web (nouvel onglet)">${SOCIAL_ICONS.site}<span>Site web</span></a>`);
    if (a.instagram) socialChips.push(`<a class="soc soc-ig" href="${escapeHtml(socialUrl('instagram', a.instagram))}" target="_blank" rel="noopener nofollow" aria-label="Instagram (nouvel onglet)">${SOCIAL_ICONS.instagram}<span>Instagram</span></a>`);
    if (a.facebook)  socialChips.push(`<a class="soc soc-fb" href="${escapeHtml(socialUrl('facebook', a.facebook))}" target="_blank" rel="noopener nofollow" aria-label="Facebook (nouvel onglet)">${SOCIAL_ICONS.facebook}<span>Facebook</span></a>`);
    if (a.tiktok)    socialChips.push(`<a class="soc soc-tt" href="${escapeHtml(socialUrl('tiktok', a.tiktok))}" target="_blank" rel="noopener nofollow" aria-label="TikTok (nouvel onglet)">${SOCIAL_ICONS.tiktok}<span>TikTok</span></a>`);
    const contactHtml = (contactRows.length || socialChips.length) ? `
      <section class="section">
        <h2>Contact</h2>
        ${contactRows.length ? `<div class="ct-list">${contactRows.join('')}</div>` : ''}
        ${socialChips.length ? `<div class="soc-row">${socialChips.join('')}</div>` : ''}
      </section>` : '';

    // ─── Localisation (respecte adresse_masquee) ───
    const hasGeo = !masque && !isNaN(Number(a.latitude)) && !isNaN(Number(a.longitude)) && (Number(a.latitude) !== 0 || Number(a.longitude) !== 0);
    const _lat = Number(a.latitude), _lng = Number(a.longitude);
    const mapsLink = hasGeo ? `https://www.google.com/maps/dir/?api=1&destination=${_lat},${_lng}`
      : ((!masque && a.adresse) ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${a.adresse || ''} ${ville}`.trim())}` : '');
    const zone = `${ville ? escapeHtml(ville) : 'sa zone'}${a.rayon_intervention ? ` et ${a.rayon_intervention} km alentour` : ''}`;
    const localHtml = `
      <section class="section">
        <h2>Zone d'intervention</h2>
        ${hasGeo ? `<div class="map-wrap"><iframe class="map-frame" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.openstreetmap.org/export/embed.html?bbox=${_lng-0.02}%2C${_lat-0.015}%2C${_lng+0.02}%2C${_lat+0.015}&layer=mapnik&marker=${_lat}%2C${_lng}" title="Carte de ${escapeHtml(nom)}"></iframe></div>` : ''}
        <div class="zone-txt">📍 Intervient à ${zone}.</div>
        ${mapsLink ? `<a class="map-btn" href="${mapsLink}" target="_blank" rel="noopener">🧭 Itinéraire</a>` : ''}
      </section>`;

    const couv = a.photo_couverture || null;
    const heroCouvStyle = couv ? ` style="background-image:linear-gradient(180deg,rgba(4,20,17,0.30),rgba(4,20,17,0.62)),url('${escapeHtml(couv)}');background-size:cover;background-position:center;"` : '';
    // ─── Certifications (logos) ───
    let certifsHtml = '';
    try {
      const _caUrl = `${SUPABASE_URL}/rest/v1/certifications_artisans?artisan_id=eq.${id}&select=type,numero,statut,date_expiration,valide_at`;
      const _ccUrl = `${SUPABASE_URL}/rest/v1/certifications_catalogue?actif=eq.true&select=code,libelle,logo_url,icon,couleur`;
      const [_caR, _ccR] = await Promise.all([
        fetch(_caUrl, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }),
        fetch(_ccUrl, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } })
      ]);
      const _caList = _caR.ok ? (await _caR.json()) : [];
      const _ccList = _ccR.ok ? (await _ccR.json()) : [];
      const _cat = {};
      (_ccList || []).forEach((c) => { if (c && c.code) _cat[String(c.code).toLowerCase()] = c; });
      const _lk = (t) => _cat[String(t || '').toLowerCase()];
      const _now = Date.now();
      const _valides = (_caList || []).filter((c) => {
        const st = (c.statut || '').toString().toLowerCase();
        const okStatut = st.indexOf('valid') !== -1 || st === 'actif' || st === 'ok' || (!c.statut && c.valide_at);
        const notExpired = !c.date_expiration || (new Date(c.date_expiration).getTime() >= _now);
        return okStatut && notExpired && _lk(c.type);
      });
      if (_valides.length) {
        certifsHtml = `
      <section class="section">
        <h2>Certifications</h2>
        <div class="certifs-grid">
          ${_valides.map((c) => {
            const cc = _lk(c.type) || {};
            const img = cc.logo_url ? `<img src="${escapeHtml(cc.logo_url)}" alt="${escapeHtml(cc.libelle || c.type)}" class="certif-logo"/>` : `<div class="certif-ic">${cc.icon || '📜'}</div>`;
            const sub = c.numero ? `n° ${escapeHtml(c.numero)}` : (c.date_expiration ? `valable jusqu'au ${new Date(c.date_expiration).toLocaleDateString('fr-FR')}` : '');
            return `<div class="certif-card">${img}<div class="certif-lab">${escapeHtml(cc.libelle || c.type)}</div>${sub ? `<div class="certif-sub">${sub}</div>` : ''}</div>`;
          }).join('')}
        </div>
      </section>`;
      }
    } catch (e) { console.error('[artisan certifs]', e); }

    // ─── Agenda public (promos / evenements) ───
    let agendaHtml = '';
    try {
      const _agNow = new Date().toISOString();
      const _agUrl = `${SUPABASE_URL}/rest/v1/agenda_artisans?artisan_id=eq.${id}&statut=eq.publie&date_fin=gte.${_agNow}&order=date_debut.asc&select=type,titre,description,date_debut,date_fin`;
      const _agR = await fetch(_agUrl, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } });
      const _agList = _agR.ok ? (await _agR.json()) : [];
      if (_agList && _agList.length) {
        const _agT = { fermeture:{i:'🚫',l:'Fermeture'}, evenement:{i:'🎉',l:'Événement'}, promo:{i:'🏷️',l:'Promotion'}, horaire_special:{i:'⏰',l:'Horaire spécial'}, animation:{i:'🎪',l:'Animation'}, porte_ouverte:{i:'🚪',l:'Portes ouvertes'}, offre_speciale:{i:'💶',l:'Offre spéciale'} };
        const _agFmt = (d) => { try { return new Date(d).toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' }); } catch (e) { return ''; } };
        const _agHeure = (d) => { try { const dt = new Date(d); return (dt.getHours() || dt.getMinutes()) ? dt.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }) : ''; } catch (e) { return ''; } };
        const _agWhen = (e) => { const d1 = _agFmt(e.date_debut), d2 = e.date_fin ? _agFmt(e.date_fin) : ''; const h1 = _agHeure(e.date_debut); if (d2 && d2 !== d1) return `du ${d1} au ${d2}`; return h1 ? `${d1} à ${h1}` : d1; };
        agendaHtml = `
      <section class="section">
        <h2>📅 Agenda</h2>
        <div class="agenda-list">
          ${_agList.slice(0, 8).map((e) => {
            const t = _agT[e.type] || { i:'📌', l:'' };
            return `<div class="agenda-item">
              <div class="agenda-ic">${t.i}</div>
              <div class="agenda-body">
                <div class="agenda-titre">${escapeHtml(e.titre || '')}</div>
                <div class="agenda-when">${_agWhen(e)}</div>
                ${e.description ? `<div class="agenda-desc">${escapeHtml(e.description)}</div>` : ''}
              </div>
            </div>`;
          }).join('')}
        </div>
      </section>`;
      }
    } catch (e) { console.error('[agenda]', e); }

    const body = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5"/>
<title>${escapeHtml(nom)} — ${escapeHtml(catNom)}${ville ? ' à ' + escapeHtml(ville) : ''} — Lokalist</title>
<meta name="description" content="${escapeHtml(descShort)}"/>
<link rel="canonical" href="${canonical}"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="Lokalist"/>
<meta property="og:title" content="${escapeHtml(nom)} — ${escapeHtml(catNom)}${ville ? ' à ' + escapeHtml(ville) : ''}"/>
<meta property="og:description" content="${escapeHtml(descShort)}"/>
<meta property="og:image" content="${escapeHtml(photoOg)}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:url" content="${canonical}"/>
<meta property="og:locale" content="fr_FR"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(nom)} — ${escapeHtml(catNom)}${ville ? ' à ' + escapeHtml(ville) : ''}"/>
<meta name="twitter:description" content="${escapeHtml(descShort)}"/>
<meta name="twitter:image" content="${escapeHtml(photoOg)}"/>
<meta name="apple-itunes-app" content="app-argument=${deepLink}"/>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<link rel="icon" href="/favicon.ico"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet"/>
<style>
  :root{ --primary:#1D9E75;--primary-d:#0F6E56;--primary-l:#E1F5EE;--accent:#EF9F27;--bg:#F7F6F3;--surface:#FFF;--border:#ECE9E4;--text:#17231F;--muted:#8A8F8B; }
  *{ box-sizing:border-box;margin:0;padding:0; }
  html,body{ font-family:'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;-webkit-font-smoothing:antialiased; }
  h1,h2,h3{ font-family:'Syne','DM Sans',sans-serif;letter-spacing:-0.3px; }
  img{ max-width:100%; }
  .wrap{ max-width:1120px;margin:0 auto;padding:0 20px; }
  .top-bar{ background:var(--surface);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:20; }
  .top-bar .in{ max-width:1120px;margin:0 auto;padding:12px 20px;display:flex;align-items:center;justify-content:space-between; }
  .brand{ display:flex;align-items:center;gap:7px;font-family:'Syne';font-weight:700;font-size:18px;color:var(--primary-d);text-decoration:none; }
  .brand img{ height:22px;width:auto;display:block; }
  .verif{ display:flex;align-items:center;gap:6px;font-size:13px;color:var(--primary-d);font-weight:600; }
  .verif img{ height:16px;width:auto;display:block; }
  .ref-banner{ background:var(--accent);color:#3A2600;text-align:center;padding:10px 16px;font-size:13px;font-weight:600; }

  .hero{ position:relative;min-height:300px;display:flex;background:linear-gradient(135deg,var(--primary) 0%,var(--primary-d) 100%); }
  .hero-ov{ position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 40%,rgba(0,0,0,0.28) 100%); }
  .hero-in{ position:relative;z-index:2;max-width:1120px;margin:0 auto;width:100%;padding:20px;display:flex;flex-direction:column;justify-content:space-between; }
  .hero-top{ display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap; }
  .hb{ display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.92);color:var(--text);font-size:12px;font-weight:600;padding:5px 12px;border-radius:20px; }
  .hb-ok{ background:#fff;color:var(--primary-d); }
  .hb-top{ background:var(--accent);color:#3A2600; }
  .hero-foot{ display:flex;align-items:flex-end;justify-content:space-between;gap:14px;color:#fff; }
  .hero-idn{ display:flex;align-items:flex-end;gap:14px; }
  .hero-logo{ width:76px;height:76px;border-radius:16px;border:2px solid #fff;object-fit:contain;background:#fff;padding:6px;box-shadow:0 4px 14px rgba(0,0,0,.25);flex:0 0 auto; }
  .hero-logo-fb{ display:flex;align-items:center;justify-content:center;font-size:34px;padding:0; }
  .hero-title{ font-family:'Syne';font-weight:700;font-size:30px;line-height:1.1;text-shadow:0 2px 12px rgba(0,0,0,.3); }
  .hero-loc{ font-size:14px;opacity:.95;margin-top:6px; }
  .hero-note{ text-align:right;white-space:nowrap; }
  .hero-note .n{ font-size:17px;font-weight:600; }
  .hero-note .n b{ color:#FAC775; }
  .hero-note .s{ font-size:12px;opacity:.9; }

  .section{ background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:22px;margin-top:16px; }
  .section:first-of-type{ margin-top:20px; }
  .section h2{ font-size:18px;font-weight:700;margin-bottom:12px; }
  .section p{ font-size:15px;color:#2A332E;line-height:1.7;white-space:pre-line; }
  .apropos-meta{ display:flex;flex-direction:column;gap:6px;margin-top:12px; }
  .apropos-meta div{ display:flex;align-items:center;gap:8px;font-size:14px;color:#2A332E; }

  .garanties{ display:flex;flex-direction:column;gap:11px; }
  .gar-row{ display:flex;align-items:center;gap:10px;font-size:14px; }
  .gar-ic{ display:flex;width:24px;height:24px;border-radius:50%;background:var(--primary-l);color:var(--primary-d);align-items:center;justify-content:center;font-size:13px;font-weight:700;flex:0 0 auto; }
  .gar-lab{ font-weight:600; }
  .gar-sub{ color:var(--muted);font-size:13px; }

  .ct-list{ display:flex;flex-direction:column;gap:8px; }
  .ct-row{ display:flex;align-items:center;gap:12px;padding:11px 13px;border:1px solid var(--border);border-radius:12px;text-decoration:none;color:var(--text); }
  .ct-ic{ font-size:18px; }
  .ct-body{ display:flex;flex-direction:column; }
  .ct-lab{ font-size:12px;color:var(--muted); }
  .ct-val{ font-size:14px;font-weight:600; }
  .soc-row{ display:flex;flex-wrap:wrap;gap:8px;margin-top:12px; }
  .soc{ display:inline-flex;align-items:center;gap:7px;min-height:44px;background:#fff;color:var(--text);padding:0 15px;border:1px solid var(--border);border-radius:22px;font-weight:600;text-decoration:none;font-size:13.5px;line-height:1;box-shadow:0 1px 2px rgba(0,0,0,.04);transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease; }
  .soc svg{ width:16px;height:16px;flex:none;display:block; }
  .soc:hover{ transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.09);border-color:#d6d6d6; }
  .soc:focus-visible{ outline:2px solid var(--primary);outline-offset:2px; }
  .soc-site{ color:var(--primary-d); }
  @media (max-width:600px){ .soc{ font-size:13px;padding:0 13px; } .soc-row{ gap:8px; } }

  .map-wrap{ border-radius:14px;overflow:hidden;border:1px solid var(--border);margin-bottom:12px; }
  .map-frame{ width:100%;height:250px;border:0;display:block; }
  .zone-txt{ font-size:14px;color:#2A332E;margin-bottom:12px; }
  .map-btn{ display:inline-flex;align-items:center;gap:8px;background:var(--primary-l);color:var(--primary-d);padding:11px 18px;border-radius:12px;font-weight:600;text-decoration:none;font-size:14px; }

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
  .cta-btn-2{ display:inline-block;background:rgba(255,255,255,.16);color:#fff;padding:12px 22px;border-radius:12px;font-weight:600;text-decoration:none;font-size:14px;margin-left:8px; }

  footer{ text-align:center;padding:30px 20px 44px;color:var(--muted);font-size:12px; }
  footer a{ color:var(--primary-d);text-decoration:none;font-weight:600; }
  @media (max-width:600px){ .hero{ min-height:250px; } .hero-title{ font-size:23px; } .hero-logo{ width:60px;height:60px; } .cta-btn-2{ display:block;margin:12px 0 0; } }
  .agenda-list{ display:flex;flex-direction:column;gap:12px;margin-top:8px; }
  .agenda-item{ display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border:1px solid #E5E7EB;border-radius:14px;background:#fff; }
  .agenda-ic{ font-size:26px;line-height:1;flex-shrink:0; }
  .agenda-body{ flex:1;min-width:0; }
  .agenda-titre{ font-weight:700;font-size:15px;color:#0F172A; }
  .agenda-when{ font-size:12.5px;color:#1D9E75;font-weight:600;margin-top:2px;text-transform:capitalize; }
  .agenda-desc{ font-size:13px;color:#4B5563;margin-top:4px; }
  .certifs-grid{ display:flex;flex-wrap:wrap;gap:14px;margin-top:8px; }
  .certif-card{ display:flex;flex-direction:column;align-items:center;text-align:center;width:120px;padding:12px 10px;border:1px solid #E5E7EB;border-radius:14px;background:#fff; }
  .certif-logo{ width:64px;height:64px;object-fit:contain;margin-bottom:8px; }
  .certif-ic{ font-size:40px;line-height:1;margin-bottom:8px; }
  .certif-lab{ font-weight:700;font-size:13px;color:#0F172A; }
  .certif-sub{ font-size:11px;color:#6B7280;margin-top:2px; }
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

<section class="hero"${heroCouvStyle}>
  <div class="hero-ov"></div>
  <div class="hero-in">
    <div class="hero-top">${heroBadges.join('')}</div>
    <div class="hero-foot">
      <div class="hero-idn">
        ${medaillon}
        <div>
          <div class="hero-title">${escapeHtml(nom)}</div>
          ${ville ? `<div class="hero-loc">📍 ${escapeHtml(ville)}</div>` : ''}
        </div>
      </div>
      ${avisNb > 0 ? `<div class="hero-note"><div class="n"><b>★</b> ${avisMoyenne.toFixed(1)}</div><div class="s">${avisNb} avis</div></div>` : ''}
    </div>
  </div>
</section>

<main class="wrap">
  <section class="section">
    <h2>À propos</h2>
    <p>${escapeHtml(description)}</p>
    <div class="apropos-meta">
      ${a.rayon_intervention ? `<div>📍 Intervient dans un rayon de ${a.rayon_intervention} km</div>` : ''}
      ${gerant ? `<div>👤 Gérant : ${escapeHtml(gerant)}</div>` : ''}
      ${a.urgence === true ? `<div>⚡ Interventions d'urgence possibles</div>` : ''}
    </div>
  </section>

  ${garantiesHtml}
  ${certifsHtml}
  ${agendaHtml}
  ${contactHtml}
  ${localHtml}

  <section class="section">
    <h2>Avis${avisNb > 0 ? ` (${avisNb})` : ''}</h2>
    ${avisNb > 0 ? `<div class="avis-resume"><span class="avis-resume-note">${avisMoyenne.toFixed(1)}</span><span class="avis-resume-stars">${etoiles(avisMoyenne)}</span></div>` : ''}
    ${avisHtml || '<p style="color:var(--muted);font-size:14px;">Aucun avis pour le moment. Soyez le premier à partager votre expérience depuis l\'app.</p>'}
    <a href="lokalist://avis?type=artisan&id=${id}" class="avis-cta">✍️ Laisser un avis dans l'app</a>
  </section>

  <div class="cta-block">
    <h3>📱 Contacte ${escapeHtml(nom)} dans l'app</h3>
    <p>Devis, avis vérifiés, et tous les artisans de confiance près de chez toi.</p>
    <a href="${deepLink}" class="cta-btn">Ouvrir dans l'app</a>
    <a href="${PLAY_STORE_URL}" id="btn-download" class="cta-btn-2">Télécharger</a>
  </div>
</main>

<footer>
  <p>© Lokalist · La fidélité locale réinventée</p>
  <p style="margin-top:6px;"><a href="${SITE_URL}">Accueil</a> · <a href="${SITE_URL}/contact">Contact</a> · <a href="${SITE_URL}/mentions-legales">Mentions légales</a></p>
</footer>

<script>
  (function(){ var ua = navigator.userAgent || ''; if (/iPhone|iPad|iPod/i.test(ua)) { var b = document.getElementById('btn-download'); if (b) b.href = '${APP_STORE_URL}'; } })();
  (function(){ try { var p = new URLSearchParams(window.location.search); var ref = (p.get('ref') || '').toUpperCase().trim(); if (/^LOK-[A-Z0-9]{6}$/.test(ref)) { localStorage.setItem('lokalist_invite_code', ref); localStorage.setItem('lokalist_invite_date', new Date().toISOString()); } } catch(e) {} })();
</script>

</body>
</html>`;

    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', 'X-Robots-Tag': 'index, follow' } });
  } catch (e) {
    console.error('[artisan edge]', e);
    return pageNotFound('Erreur serveur');
  }
}

// LKL_ART_CONTACTPRIV_V1

// LKL_ART_COUV_V1

// LKL_ART_NOCLIENTELE_V1

// LKL_ART_CERTIFS_V1

// LKL_ART_AGENDA_V1

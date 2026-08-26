// ════════════════════════════════════════════════════════════════
//  api/pro.js — Vercel Edge Function
//  SENT: [LKL_PRO_PREMIUM_V1] Fiche pro premium (socle : hero + logo + horaires + contact + avis)
//  Page HTML SSR pour /pro/:id (commerçant / resto / service / loisir)
//  - Méta Open Graph dynamiques  - capture parrain ?ref=  - deep link app
// ════════════════════════════════════════════════════════════════

// LKL_SOCIAL_LOGOS_V1
export const config = { runtime: 'edge' };

const SUPABASE_URL  = 'https://kukathominhssogthplc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a2F0aG9taW5oc3NvZ3RocGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTU2NDMsImV4cCI6MjA5MDQzMTY0M30.nrfnhLWA_N-d5EA0qMvSTgSvbebbqHvWuCwk4PQDxcg';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=fr.lokalist.app';
const APP_STORE_URL  = 'https://apps.apple.com/fr/app/lokalist/id6778774911';
const SITE_URL       = 'https://lokalist.fr';
const LOGO_URL       = `${SITE_URL}/logo.png`;

const TYPE_LABELS = {
  commercant: { label: 'Commerce',   emoji: '🏪', tint: '#1D9E75' },
  restaurant: { label: 'Restaurant', emoji: '🍽️', tint: '#F97316' },
  service:    { label: 'Service',    emoji: '⚙️', tint: '#6366F1' },
  loisir:     { label: 'Loisir',     emoji: '🎭', tint: '#14B8A6' },
};

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
function resaLabel(v) {
  var s = String(v || '').toLowerCase();
  if (s.indexOf('planity') !== -1)   return 'Prendre RDV sur Planity';
  if (s.indexOf('doctolib') !== -1)  return 'Prendre RDV sur Doctolib';
  if (s.indexOf('fresha') !== -1)    return 'Réserver sur Fresha';
  if (s.indexOf('treatwell') !== -1) return 'Réserver sur Treatwell';
  if (s.indexOf('kalendes') !== -1)  return 'Réserver sur Kalendes';
  return 'Prendre rendez-vous';
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

const html404 = (msg) => `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Page introuvable — Lokalist</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#F7F6F3;color:#17231F;padding:40px 20px;text-align:center;line-height:1.6}h1{color:#1D9E75;font-size:28px;margin:24px 0 8px}a{color:#1D9E75;font-weight:600;text-decoration:none}</style>
</head><body>
<div style="font-size:64px">🏪</div>
<h1>${escapeHtml(msg)}</h1>
<p style="color:#8A8F8B">Ce professionnel n'existe plus ou a été retiré.</p>
<p><a href="${SITE_URL}">← Retour à Lokalist</a></p>
</body></html>`;

const pageNotFound = (msg = "Professionnel introuvable") => new Response(html404(msg), {
  status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' },
});

// ─── Handler principal ──────────────────────────────────────────
export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const id  = url.searchParams.get('id');
    const ref = sanitizeRef(url.searchParams.get('ref'));

    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return pageNotFound("Identifiant invalide");

    const cols = 'id,nom,ville,description,photo_url,logo_url,photos,photo_couverture,note_moyenne,nb_avis,type_pro,categorie,adresse,latitude,longitude,points_par_scan,actif,demo,site_web,instagram,facebook,tiktok,lien_reservation,telephone,email,afficher_email,afficher_telephone,horaires,mode_points,points_par_euro,type_recompense,recompense_euros_seuil,recompense_euros_montant,recompense_tampons_seuil,recompense_tampons_libelle';
    const apiUrl = `${SUPABASE_URL}/rest/v1/commercants?id=eq.${id}&select=${cols}`;
    const r = await fetch(apiUrl, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } });
    if (!r.ok) return pageNotFound("Erreur lors du chargement");
    const list = await r.json();
    if (!list || !list.length) return pageNotFound();
    const c = list[0];
    if (c.demo === true) return pageNotFound("Fiche non disponible");
    if (c.actif === false) return pageNotFound("Ce professionnel n'est plus actif");

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
    } catch (e) { console.error('[pro avis]', e); }

    const etoiles = (n) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
    const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' }); } catch { return ''; } };
    const avisHtml = (avisListe || []).map((a) => `
      <div class="avis-card">
        <div class="avis-head">
          <div class="avis-auteur">${escapeHtml(a.auteur_nom || 'Client')}</div>
          ${a.verified ? '<span class="avis-verif">✓ Vérifié</span>' : ''}
        </div>
        <div class="avis-stars">${etoiles(a.note)}</div>
        ${a.titre ? `<div class="avis-titre">${escapeHtml(a.titre)}</div>` : ''}
        ${a.commentaire ? `<div class="avis-txt">${escapeHtml(a.commentaire)}</div>` : ''}
        <div class="avis-date">${fmtDate(a.date_publication)}</div>
        ${a.reponse ? `<div class="avis-rep"><div class="avis-rep-lab">Réponse du professionnel</div>${escapeHtml(a.reponse)}</div>` : ''}
      </div>`).join('');

    // ─── Données d'affichage ───
    const typeInfo    = TYPE_LABELS[c.type_pro] || { label: 'Commerce', emoji: '🏪', tint: '#1D9E75' };
    const nom         = c.nom || 'Professionnel local';
    const ville       = c.ville || '';
    const categorie   = c.categorie || '';
    const description = c.description || `${typeInfo.label}${ville ? ' à ' + ville : ''} — sur Lokalist, l'app de la vie locale`;
    const descShort   = (description.length > 160 ? description.slice(0, 157) + '...' : description);
    const photos      = Array.isArray(c.photos) ? c.photos.filter((p) => typeof p === 'string' && p.trim()) : [];
    const mainPhoto   = c.photo_couverture || photos[0] || c.photo_url || null;
    const photoOg     = mainPhoto || `${SITE_URL}/images/og-default.jpg`;
    const ogImage = `${SITE_URL}/api/og-pro?id=${id}`; // LKL_PRO_OG_V1
    const noteAff     = (avisNb > 0) ? avisMoyenne : (Number(c.note_moyenne) || 0);
    const nbAvisAff   = (avisNb > 0) ? avisNb : (Number(c.nb_avis) || 0);
    const horaires    = (c.horaires || '').trim();

    const canonical = `${SITE_URL}/pro/${id}`;
    const deepLink  = `lokalist://commercant/${id}`;

    const jsonLd = {
      "@context": "https://schema.org", "@type": "LocalBusiness",
      "name": nom, "description": description, "image": photoOg, "url": canonical,
      ...(c.adresse && { "address": { "@type": "PostalAddress", "streetAddress": c.adresse, "addressLocality": ville, "addressCountry": "FR" } }),
      ...((c.latitude && c.longitude) && { "geo": { "@type": "GeoCoordinates", "latitude": Number(c.latitude), "longitude": Number(c.longitude) } }),
      ...(noteAff > 0 && { "aggregateRating": { "@type": "AggregateRating", "ratingValue": Number(noteAff).toFixed(1), "reviewCount": nbAvisAff || 0 } }),
      ...(c.telephone && c.afficher_telephone !== false && { telephone: c.telephone }),
      ...(c.email && c.afficher_email !== false && { email: c.email }),
      ...((c.site_web || c.instagram || c.facebook || c.tiktok) && { sameAs: [
        ...(c.site_web ? [normUrl(c.site_web)] : []),
        ...(c.instagram ? [socialUrl('instagram', c.instagram)] : []),
        ...(c.facebook ? [socialUrl('facebook', c.facebook)] : []),
        ...(c.tiktok ? [socialUrl('tiktok', c.tiktok)] : []),
      ] }),
      ...(c.lien_reservation && { potentialAction: { '@type': 'ReserveAction', target: normUrl(c.lien_reservation), name: resaLabel(c.lien_reservation) } }),
    };

    // ─── Hero ───
    const heroStyle = mainPhoto
      ? `background-image:url('${escapeHtml(mainPhoto)}');background-size:cover;background-position:center;`
      : `background:${typeInfo.tint};`;
    const heroFb = mainPhoto ? '' : `<div class="hero-fb">${typeInfo.emoji}</div>`;
    const logoMedaillon = c.logo_url
      ? `<img class="hero-logo" src="${escapeHtml(c.logo_url)}" alt="${escapeHtml(nom)}"/>`
      : `<div class="hero-logo hero-logo-fb">${typeInfo.emoji}</div>`;

    // ─── Contact ───
    const contactRows = [];
    if (c.telephone && c.afficher_telephone !== false) contactRows.push(`<a class="ct-row" href="tel:${escapeHtml(c.telephone)}"><span class="ct-ic">📞</span><span class="ct-body"><span class="ct-lab">Téléphone</span><span class="ct-val">${escapeHtml(c.telephone)}</span></span></a>`);
    if (c.email && c.afficher_email !== false) contactRows.push(`<a class="ct-row" href="mailto:${escapeHtml(c.email)}"><span class="ct-ic">✉️</span><span class="ct-body"><span class="ct-lab">Email</span><span class="ct-val">${escapeHtml(c.email)}</span></span></a>`);
    if (c.adresse)   contactRows.push(`<div class="ct-row"><span class="ct-ic">📍</span><span class="ct-body"><span class="ct-lab">Adresse</span><span class="ct-val">${escapeHtml(c.adresse)}${ville ? ', ' + escapeHtml(ville) : ''}</span></span></div>`);
    const SOCIAL_ICONS = {
      site: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 0 20 15.3 15.3 0 0 1 0-20"/></svg>',
      instagram: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><defs><radialGradient id="lklIg" cx="30%" cy="107%" r="135%"><stop offset="0%" stop-color="#fdf497"/><stop offset="5%" stop-color="#fdf497"/><stop offset="45%" stop-color="#fd5949"/><stop offset="60%" stop-color="#d6249f"/><stop offset="90%" stop-color="#285AEB"/></radialGradient></defs><path fill="url(#lklIg)" d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.35-2.62-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.41-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z"/></svg>',
      facebook: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="#1877F2"><path d="M24 12.07C24 5.44 18.63.07 12 .07S0 5.44 0 12.07c0 5.99 4.39 10.95 10.13 11.85v-8.38H7.08v-3.47h3.05V9.43c0-3.01 1.79-4.67 4.53-4.67 1.31 0 2.69.24 2.69.24v2.95h-1.51c-1.49 0-1.96.93-1.96 1.87v2.25h3.33l-.53 3.47h-2.8v8.38C19.61 23.02 24 18.06 24 12.07z"/></svg>',
      tiktok: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="#25F4EE" d="M9.9 8.9v-.9a6.4 6.4 0 0 0-.9-.06A6.35 6.35 0 0 0 5.3 19.3a6.35 6.35 0 0 1 4.6-10.4z"/><path fill="#000" d="M16.7 2h-2.5v10.9a1.86 1.86 0 1 1-1.86-1.86c.2 0 .38.03.56.08V8.5a4.53 4.53 0 0 0-.56-.04A4.6 4.6 0 1 0 17 12.9V7.3a6.2 6.2 0 0 0 3.7 1.2V6a3.5 3.5 0 0 1-2.4-1 3.5 3.5 0 0 1-1.6-3z"/><path fill="#FE2C55" d="M19.3 6v-.5a3.5 3.5 0 0 1-1.9-.5 3.5 3.5 0 0 0 1.9 1zm-8.6 2.9a4.6 4.6 0 0 0-4 8.1 4.6 4.6 0 0 1 6.4-6.3V8.5a4.6 4.6 0 0 0-2.4.4z"/></svg>',
    };
    const socialChips = [];
    if (c.site_web)  socialChips.push(`<a class="soc soc-site" href="${escapeHtml(normUrl(c.site_web))}" target="_blank" rel="noopener nofollow" aria-label="Site web (nouvel onglet)">${SOCIAL_ICONS.site}<span>Site web</span></a>`);
    if (c.instagram) socialChips.push(`<a class="soc soc-ig" href="${escapeHtml(socialUrl('instagram', c.instagram))}" target="_blank" rel="noopener nofollow" aria-label="Instagram (nouvel onglet)">${SOCIAL_ICONS.instagram}<span>Instagram</span></a>`);
    if (c.facebook)  socialChips.push(`<a class="soc soc-fb" href="${escapeHtml(socialUrl('facebook', c.facebook))}" target="_blank" rel="noopener nofollow" aria-label="Facebook (nouvel onglet)">${SOCIAL_ICONS.facebook}<span>Facebook</span></a>`);
    if (c.tiktok)    socialChips.push(`<a class="soc soc-tt" href="${escapeHtml(socialUrl('tiktok', c.tiktok))}" target="_blank" rel="noopener nofollow" aria-label="TikTok (nouvel onglet)">${SOCIAL_ICONS.tiktok}<span>TikTok</span></a>`);
    const contactHtml = (c.lien_reservation || contactRows.length || socialChips.length) ? `
      <section class="section">
        <h2>Contact &amp; liens</h2>
        ${c.lien_reservation ? `<a class="resa-btn" href="${escapeHtml(normUrl(c.lien_reservation))}" target="_blank" rel="noopener nofollow">📅 ${escapeHtml(resaLabel(c.lien_reservation))}</a>` : ''}
        ${contactRows.length ? `<div class="ct-list">${contactRows.join('')}</div>` : ''}
        ${socialChips.length ? `<div class="soc-row">${socialChips.join('')}</div>` : ''}
      </section>` : '';

    const horairesHtml = horaires ? `
      <section class="section">
        <h2>Horaires</h2>
        <p class="horaires">${escapeHtml(horaires)}</p>
      </section>` : '';

    // LKL_PRO_ZOOM_V1 : photo du hero zoomable (lightbox, sans galerie)
    const galPhotos = photos.length ? photos : (mainPhoto ? [mainPhoto] : []);
    const lightboxHtml = galPhotos.length ? `
      <div id="lb" class="lb" aria-hidden="true">
        <button class="lb-btn lb-x" data-lb-act="close" aria-label="Fermer">×</button>
        ${galPhotos.length > 1 ? `<button class="lb-btn lb-prev" data-lb-act="prev" aria-label="Precedent">‹</button>` : ''}
        <img class="lb-img" alt=""/>
        ${galPhotos.length > 1 ? `<button class="lb-btn lb-next" data-lb-act="next" aria-label="Suivant">›</button>` : ''}
        <div class="lb-count"></div>
      </div>
      <script>
      (function(){
        var PH = ${JSON.stringify(galPhotos)};
        if(!PH.length) return;
        var lb=document.getElementById('lb'); if(!lb) return;
        var img=lb.querySelector('.lb-img'), cnt=lb.querySelector('.lb-count');
        var i=0, open=false;
        function show(){ img.src=PH[i]; cnt.textContent= PH.length>1 ? (i+1)+' / '+PH.length : ''; }
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
    // LKL_PRO_CARTE_V1 : localisation (carte OSM + itineraire)
    const _lat = Number(c.latitude), _lng = Number(c.longitude);
    const hasGeo = !isNaN(_lat) && !isNaN(_lng) && (_lat !== 0 || _lng !== 0);
    const _mq = encodeURIComponent(`${c.adresse || ''} ${ville}`.trim());
    const mapsLink = hasGeo
      ? `https://www.google.com/maps/dir/?api=1&destination=${_lat},${_lng}`
      : ((c.adresse || ville) ? `https://www.google.com/maps/search/?api=1&query=${_mq}` : '');
    const carteHtml = (hasGeo || c.adresse) ? `
      <section class="section">
        <h2>Où nous trouver</h2>
        ${hasGeo ? `<div class="map-wrap"><iframe class="map-frame" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.openstreetmap.org/export/embed.html?bbox=${_lng-0.004}%2C${_lat-0.003}%2C${_lng+0.004}%2C${_lat+0.003}&layer=mapnik&marker=${_lat}%2C${_lng}" title="Carte de ${escapeHtml(nom)}"></iframe></div>` : ''}
        ${c.adresse ? `<div class="map-adr">📍 ${escapeHtml(c.adresse)}${ville ? ', ' + escapeHtml(ville) : ''}</div>` : ''}
        ${mapsLink ? `<a class="map-btn" href="${mapsLink}" target="_blank" rel="noopener">🧭 Itinéraire</a>` : ''}
      </section>` : '';
    // LKL_PRO_MENU_V1 : carte de menu (restaurant)
    let menuItems = [];
    if (c.type_pro === 'restaurant') {
      try {
        const _mu = `${SUPABASE_URL}/rest/v1/restaurant_menu?commercant_id=eq.${id}&actif=eq.true&order=section.asc,ordre.asc&select=nom,description,prix,section,photo_url,signature`;
        const _mr = await fetch(_mu, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } });
        if (_mr.ok) menuItems = await _mr.json();
      } catch (e) { console.error('[pro menu]', e); }
    }
    const _fmtPrix = (p) => { const n = Number(p); if (isNaN(n)) return ''; return (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ',')) + ' €'; };
    const _menuSecs = [];
    (menuItems || []).forEach((it) => {
      const sec = ((it.section || 'Menu').trim()) || 'Menu';
      let grp = _menuSecs.find((g) => g.sec === sec);
      if (!grp) { grp = { sec, items: [] }; _menuSecs.push(grp); }
      grp.items.push(it);
    });
    const menuHtml = _menuSecs.length ? `
      <section class="section">
        <h2>La carte</h2>
        ${_menuSecs.map((g) => `
          <div class="menu-sec">
            <div class="menu-sec-t">${escapeHtml(g.sec)}</div>
            ${g.items.map((it) => `
              <div class="menu-item">
                ${it.photo_url ? `<img class="menu-img" src="${escapeHtml(it.photo_url)}" alt="${escapeHtml(it.nom || '')}" loading="lazy"/>` : ''}
                <div class="menu-body">
                  <div class="menu-line"><span class="menu-nom">${escapeHtml(it.nom || '')}${it.signature ? ` <span class="menu-sig">⭐ Signature</span>` : ''}</span>${it.prix != null ? `<span class="menu-prix">${_fmtPrix(it.prix)}</span>` : ''}</div>
                  ${it.description ? `<div class="menu-desc">${escapeHtml(it.description)}</div>` : ''}
                </div>
              </div>`).join('')}
          </div>`).join('')}
      </section>` : '';
    // LKL_PRO_SEO_V1 : titre + meta description categorie/type + ville
    const _seoType = categorie || typeInfo.label;
    const _vt = ville ? `${_seoType} à ${ville}` : _seoType;
    const titreSocial = `${nom} — ${_vt}`;
    const titreSeo = `${titreSocial} — Lokalist`;
    let metaDesc = descShort;
    if (ville && descShort.toLowerCase().indexOf(ville.toLowerCase()) === -1) {
      metaDesc = `${_vt}. ${descShort}`;
      if (metaDesc.length > 160) metaDesc = metaDesc.slice(0, 159).replace(/\s+\S*$/, '') + '…';
    }
    // LKL_PRO_FIDELITE_V2 : encart generique programme de fidelite Lokalist
    const fideliteHtml = (Number(c.points_par_scan) > 0) ? `
      <section class="section">
        <h2>Programme de fidélité</h2>
        <div class="fid-reward">🎁 Profitez des points et remises fidélité Lokalist chez vos commerçants partenaires.</div>
        <div class="fid-sub">Cumulez vos points directement dans l'app.</div>
      </section>` : '';
    // ─── Agenda public (promos / evenements) ───
    let agendaHtml = '';
    try {
      const _agNow = new Date().toISOString();
      const _agUrl = `${SUPABASE_URL}/rest/v1/agenda_commercants?commercant_id=eq.${id}&statut=eq.publie&date_fin=gte.${_agNow}&order=date_debut.asc&select=type,titre,description,date_debut,date_fin`;
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

    // ─── Offres actives ───
    let offresHtml = '';
    try {
      const _ofNow = new Date().toISOString();
      const _ofUrl = `${SUPABASE_URL}/rest/v1/offres?commercant_id=eq.${id}&statut=eq.active&expire_at=gt.${_ofNow}&order=expire_at.asc&select=titre,description,type_offre,reduction,photo_url,expire_at`;
      const _ofR = await fetch(_ofUrl, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } });
      const _ofList = _ofR.ok ? (await _ofR.json()) : [];
      if (_ofList && _ofList.length) {
        const _ofT = { reduction:'🏷️', flash:'⚡', evenement:'🎉', nouveaute:'✨' };
        const _ofFin = (d) => { try { return "Jusqu'au " + new Date(d).toLocaleDateString('fr-FR', { day:'numeric', month:'long' }); } catch (e) { return ''; } };
        offresHtml = `
      <section class="section">
        <h2>🏷️ Offres du moment</h2>
        <div class="offres-grid">
          ${_ofList.slice(0, 8).map((o) => {
            const ic = _ofT[o.type_offre] || '🏷️';
            const img = o.photo_url ? `<div class="offre-img" style="background-image:url('${escapeHtml(o.photo_url)}')"></div>` : '';
            return `<div class="offre-card">${img}<div class="offre-in">
              <div class="offre-top">${ic} ${o.reduction ? `<span class="offre-badge">${escapeHtml(o.reduction)}</span>` : ''}</div>
              <div class="offre-titre">${escapeHtml(o.titre || '')}</div>
              ${o.description ? `<div class="offre-desc">${escapeHtml(o.description)}</div>` : ''}
              ${o.expire_at ? `<div class="offre-fin">${_ofFin(o.expire_at)}</div>` : ''}
            </div></div>`;
          }).join('')}
        </div>
      </section>`;
      }
    } catch (e) { console.error('[offres]', e); }

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
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet"/>
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

  .hero{ position:relative;min-height:360px;display:flex;align-items:stretch; }
  .hero-fb{ position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:96px;opacity:.55; }
  .hero-ov{ position:absolute;inset:0; }
  .hero-in{ position:relative;z-index:2;max-width:1120px;margin:0 auto;width:100%;padding:20px;display:flex;flex-direction:column;justify-content:space-between; }
  .hero-top{ display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap; }
  .hb{ display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.92);color:var(--text);font-size:12px;font-weight:600;padding:5px 12px;border-radius:20px; }
  .hero-foot{ display:flex;align-items:flex-end;justify-content:space-between;gap:14px;color:#fff; }
  .hero-idn{ display:flex;align-items:flex-end;gap:14px; }
  .hero-logo{ width:64px;height:64px;border-radius:16px;border:2px solid #fff;object-fit:cover;background:#fff;box-shadow:0 4px 14px rgba(0,0,0,.25);flex:0 0 auto; }
  .hero-logo-fb{ display:flex;align-items:center;justify-content:center;font-size:30px;background:var(--primary-l); }
  .hero-title{ font-family:'Syne';font-weight:700;font-size:32px;line-height:1.1;text-shadow:0 2px 12px rgba(0,0,0,.35); }
  .hero-loc{ font-size:14px;opacity:.95;margin-top:6px;text-shadow:0 1px 8px rgba(0,0,0,.35); }
  .hero-note{ text-align:right;white-space:nowrap;text-shadow:0 1px 8px rgba(0,0,0,.35); }
  .hero-note .n{ font-size:17px;font-weight:600; }
  .hero-note .n b{ color:#FAC775; }
  .hero-note .s{ font-size:12px;opacity:.9; }

  .section{ background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:22px 22px;margin-top:16px; }
  .section:first-of-type{ margin-top:20px; }
  .section h2{ font-size:18px;font-weight:700;margin-bottom:12px; }
  .section p{ font-size:15px;color:#2A332E;line-height:1.7;white-space:pre-line; }
  .horaires{ white-space:pre-line; }
  .points-badge{ display:flex;align-items:center;gap:10px;background:var(--primary-l);border-radius:12px;padding:14px 16px;margin-top:14px;font-size:14px; }
  .points-badge strong{ color:var(--primary-d); }

  .resa-btn{ display:flex;align-items:center;justify-content:center;gap:8px;background:var(--primary);color:#04342C;padding:15px;border-radius:12px;font-family:'Syne';font-weight:700;text-decoration:none;font-size:15px;margin-bottom:14px; }
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

  /* LKL_PRO_ZOOM_V1 : zoom photo hero */
  .hero-zoom{ position:absolute;right:16px;bottom:16px;z-index:3;background:rgba(0,0,0,.5);color:#fff;font-size:16px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:50%;cursor:zoom-in; }
  .lb{ position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:100;display:none;align-items:center;justify-content:center; }
  .lb.on{ display:flex; }
  .lb-img{ max-width:92vw;max-height:86vh;object-fit:contain;border-radius:8px; }
  .lb-btn{ position:absolute;background:rgba(255,255,255,.15);color:#fff;border:none;width:46px;height:46px;border-radius:50%;font-size:24px;line-height:1;cursor:pointer; }
  .lb-x{ top:20px;right:20px; }
  .lb-prev{ left:16px;top:50%;transform:translateY(-50%); }
  .lb-next{ right:16px;top:50%;transform:translateY(-50%); }
  .lb-count{ position:absolute;bottom:20px;left:50%;transform:translateX(-50%);color:#fff;font-size:13px; }
  /* LKL_PRO_CARTE_V1 : localisation */
  .map-wrap{ border-radius:14px;overflow:hidden;border:1px solid var(--border);margin-bottom:12px; }
  .map-frame{ width:100%;height:260px;border:0;display:block; }
  .map-adr{ font-size:14px;color:#2A332E;margin-bottom:12px; }
  .map-btn{ display:inline-flex;align-items:center;gap:8px;background:var(--primary-l);color:var(--primary-d);padding:11px 18px;border-radius:12px;font-weight:600;text-decoration:none;font-size:14px; }
  /* LKL_PRO_MENU_V1 : carte de menu resto */
  .menu-sec{ margin-top:16px; }
  .menu-sec:first-child{ margin-top:2px; }
  .menu-sec-t{ font-family:'Syne';font-weight:700;font-size:13px;color:var(--primary-d);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px; }
  .menu-item{ display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border); }
  .menu-item:last-child{ border-bottom:0; }
  .menu-img{ width:64px;height:64px;object-fit:cover;border-radius:10px;flex:0 0 auto; }
  .menu-body{ flex:1;min-width:0; }
  .menu-line{ display:flex;align-items:baseline;justify-content:space-between;gap:10px; }
  .menu-nom{ font-weight:600;font-size:15px; }
  .menu-sig{ font-size:11px;font-weight:600;color:var(--accent);white-space:nowrap; }
  .menu-prix{ font-family:'Syne';font-weight:700;color:var(--primary-d);white-space:nowrap; }
  .menu-desc{ font-size:13px;color:var(--muted);margin-top:2px;line-height:1.5; }
  /* LKL_PRO_FIDELITE_V1 : programme de fidelite */
  .fid-reward{ display:flex;align-items:center;gap:10px;background:var(--primary-l);border-radius:12px;padding:16px;font-size:16px;font-weight:600;color:var(--primary-d); }
  .fid-sub{ font-size:14px;color:var(--muted);margin-top:10px; }
  footer{ text-align:center;padding:30px 20px 44px;color:var(--muted);font-size:12px; }
  footer a{ color:var(--primary-d);text-decoration:none;font-weight:600; }

  @media (max-width:900px){ .hero{ min-height:300px; } .hero-title{ font-size:26px; } }
  @media (max-width:600px){ .hero{ min-height:260px; } .hero-title{ font-size:22px; } .hero-logo{ width:52px;height:52px; } .cta-btn-2{ display:block;margin:12px 0 0; } }
  .offres-grid{ display:flex;flex-wrap:wrap;gap:14px;margin-top:8px; }
  .offre-card{ display:flex;flex-direction:column;width:220px;border:1px solid #E5E7EB;border-radius:16px;overflow:hidden;background:#fff; }
  .offre-img{ height:120px;background-size:cover;background-position:center; }
  .offre-in{ padding:12px 14px; }
  .offre-top{ display:flex;align-items:center;gap:8px;font-size:18px; }
  .offre-badge{ background:#1D9E75;color:#fff;font-size:12px;font-weight:800;padding:3px 10px;border-radius:999px; }
  .offre-titre{ font-weight:700;font-size:15px;color:#0F172A;margin-top:6px; }
  .offre-desc{ font-size:13px;color:#4B5563;margin-top:4px; }
  .offre-fin{ font-size:11.5px;color:#EF9F27;font-weight:700;margin-top:8px; }
  .agenda-list{ display:flex;flex-direction:column;gap:12px;margin-top:8px; }
  .agenda-item{ display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border:1px solid #E5E7EB;border-radius:14px;background:#fff; }
  .agenda-ic{ font-size:26px;line-height:1;flex-shrink:0; }
  .agenda-body{ flex:1;min-width:0; }
  .agenda-titre{ font-weight:700;font-size:15px;color:#0F172A; }
  .agenda-when{ font-size:12.5px;color:#1D9E75;font-weight:600;margin-top:2px;text-transform:capitalize; }
  .agenda-desc{ font-size:13px;color:#4B5563;margin-top:4px; }
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
  <div class="hero-ov" style="background:linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0) 34%, rgba(0,0,0,0.22) 58%, rgba(0,0,0,0.68) 100%);"></div>
  <div class="hero-in">
    <div class="hero-top">
      <span class="hb">${typeInfo.emoji} ${escapeHtml(typeInfo.label)}</span>
      ${categorie ? `<span class="hb">${escapeHtml(categorie)}</span>` : ''}
    </div>
    <div class="hero-foot">
      <div class="hero-idn">
        ${logoMedaillon}
        <div>
          <div class="hero-title">${escapeHtml(nom)}</div>
          ${ville ? `<div class="hero-loc">📍 ${escapeHtml(ville)}</div>` : ''}
        </div>
      </div>
      ${noteAff > 0 ? `<div class="hero-note"><div class="n"><b>★</b> ${Number(noteAff).toFixed(1)}</div><div class="s">${nbAvisAff} avis</div></div>` : ''}
    </div>
  </div>
  ${mainPhoto ? `<span class="hero-zoom" data-lb="0" title="Agrandir">🔍</span>` : ''}
</section>

<main class="wrap">
  <section class="section">
    <h2>À propos</h2>
    <p>${escapeHtml(description)}</p>
    ${c.points_par_scan > 0 ? `<div class="points-badge">📱 <span>Scanne en boutique et gagne <strong>${c.points_par_scan} pts</strong></span></div>` : ''}
  </section>

  ${offresHtml}
  ${menuHtml}
  ${agendaHtml}
  ${fideliteHtml}
  ${horairesHtml}
  ${contactHtml}
  ${carteHtml}

  <section class="section">
    <h2>Avis${nbAvisAff > 0 ? ` (${nbAvisAff})` : ''}</h2>
    ${noteAff > 0 ? `<div class="avis-resume"><span class="avis-resume-note">${Number(noteAff).toFixed(1)}</span><span class="avis-resume-stars">${etoiles(noteAff)}</span></div>` : ''}
    ${avisHtml || '<p style="color:var(--muted);font-size:14px;">Aucun avis pour le moment. Soyez le premier à partager votre expérience depuis l\'app.</p>'}
    <a href="lokalist://avis?type=commercant&id=${id}" class="avis-cta">✍️ Laisser un avis dans l'app</a>
  </section>

  <div class="cta-block">
    <h3>📱 Découvre ${escapeHtml(nom)} dans l'app</h3>
    <p>Cumule des points, profite des bons plans locaux et soutiens les commerces de ta ville.</p>
    <a href="${deepLink}" class="cta-btn">Ouvrir dans l'app</a>
    <a href="${PLAY_STORE_URL}" id="btn-download" class="cta-btn-2">Télécharger</a>
  </div>
</main>

<footer>
  <p>© Lokalist · La fidélité locale réinventée</p>
  <p style="margin-top:6px;"><a href="${SITE_URL}">Accueil</a> · <a href="${SITE_URL}/contact">Contact</a> · <a href="${SITE_URL}/mentions-legales">Mentions légales</a></p>
</footer>

<script>
  (function(){
    var ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) { var btn = document.getElementById('btn-download'); if (btn) btn.href = '${APP_STORE_URL}'; }
  })();
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
    console.error('[pro edge]', e);
    return pageNotFound('Erreur serveur');
  }
}

// LKL_PRO_CONTACTPRIV_V1

// LKL_PRO_COUV_V1

// LKL_PRO_AGENDA_V1

// LKL_PRO_OFFRES_V1

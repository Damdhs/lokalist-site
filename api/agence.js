// ════════════════════════════════════════════════════════════════
//  api/agence.js — Vercel Edge Function
//  SENT: [LKL_AGENCE_PREMIUM_V1] Fiche agence immo premium
//  Page HTML SSR pour /agence/:id (hero teinte + logo, secteurs, video,
//  contact, localisation, avis). Deep link lokalist://immo/agence/:id.
// ════════════════════════════════════════════════════════════════

export const config = { runtime: 'edge' };

const SUPABASE_URL  = 'https://kukathominhssogthplc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a2F0aG9taW5oc3NvZ3RocGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTU2NDMsImV4cCI6MjA5MDQzMTY0M30.nrfnhLWA_N-d5EA0qMvSTgSvbebbqHvWuCwk4PQDxcg';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=fr.lokalist.app';
const APP_STORE_URL  = 'https://apps.apple.com/app/lokalist';
const SITE_URL       = 'https://lokalist.fr';
const LOGO_URL       = `${SITE_URL}/logo.png`;

const escapeHtml = (str) => {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};
function normUrl(v) {
  if (!v) return '';
  var u = String(v).trim();
  while (u.charAt(0) === '/') u = u.slice(1);
  var low = u.toLowerCase();
  if (low.indexOf('http://') !== 0 && low.indexOf('https://') !== 0) u = 'https://' + u;
  return u;
}
function ytId(u) { const m = String(u || '').match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/); return m ? m[1] : ''; }

const html404 = (msg) => `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Agence introuvable — Lokalist</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#F7F6F3;color:#17231F;padding:40px 20px;text-align:center;line-height:1.6}h1{color:#1D9E75;font-size:28px;margin:24px 0 8px}a{color:#1D9E75;font-weight:600;text-decoration:none}</style>
</head><body>
<div style="font-size:64px">🏢</div>
<h1>${escapeHtml(msg)}</h1>
<p style="color:#8A8F8B">Cette agence n'existe plus ou a été retirée.</p>
<p><a href="${SITE_URL}">← Retour à Lokalist</a></p>
</body></html>`;

const pageNotFound = (msg = 'Agence introuvable') => new Response(html404(msg), { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const id  = url.searchParams.get('id');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return pageNotFound('Identifiant invalide');

    const r = await fetch(`${SUPABASE_URL}/rest/v1/agences_immo?id=eq.${id}&select=*`, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } });
    if (!r.ok) return pageNotFound('Erreur lors du chargement');
    const list = await r.json();
    if (!list || !list.length) return pageNotFound();
    const a = list[0];
    if (a.demo === true) return pageNotFound();
    if (a.actif === false) return pageNotFound("Cette agence n'est plus active");

    // ─── Avis ───
    let avisMoyenne = 0, avisNb = 0, avisListe = [];
    try {
      const avUrl = `${SUPABASE_URL}/rest/v1/avis_public?cible_type=eq.agence&cible_id=eq.${id}&order=date_publication.desc&limit=20`;
      const agUrl = `${SUPABASE_URL}/rest/v1/avis_agrege?cible_type=eq.agence&cible_id=eq.${id}`;
      const [avR, agR] = await Promise.all([
        fetch(avUrl, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }),
        fetch(agUrl, { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }),
      ]);
      avisListe = avR.ok ? (await avR.json()) : [];
      const agg = agR.ok ? (await agR.json()) : [];
      if (agg && agg[0]) { avisMoyenne = Number(agg[0].note_moyenne) || 0; avisNb = agg[0].nb_avis || 0; }
    } catch (e) { console.error('[agence avis]', e); }

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
    const nom         = a.nom || 'Agence immobilière';
    const adresse     = a.adresse || '';
    const communes    = Array.isArray(a.communes) ? a.communes.filter((c) => typeof c === 'string' && c.trim()) : [];
    const villeLieu   = communes[0] || '';
    const description = a.description || `Agence immobilière${villeLieu ? ' à ' + villeLieu : ''} — sur Lokalist, l'app de la vie locale`;
    const descShort   = (description.length > 160 ? description.slice(0, 157) + '...' : description);
    const logo        = a.logo_url || null;
    const photoOg     = logo || `${SITE_URL}/images/og-default.jpg`;

    const canonical = `${SITE_URL}/agence/${id}`;
    const deepLink  = `lokalist://immo/agence/${id}`;

    const jsonLd = {
      "@context": "https://schema.org", "@type": "RealEstateAgent",
      "name": nom, "description": description, "image": photoOg, "url": canonical,
      ...((adresse || villeLieu) && { "address": { "@type": "PostalAddress", "streetAddress": adresse || undefined, "addressLocality": villeLieu || undefined, "addressCountry": "FR" } }),
      ...((a.latitude && a.longitude) && { "geo": { "@type": "GeoCoordinates", "latitude": Number(a.latitude), "longitude": Number(a.longitude) } }),
      ...(avisMoyenne > 0 && { "aggregateRating": { "@type": "AggregateRating", "ratingValue": Number(avisMoyenne).toFixed(1), "reviewCount": avisNb } }),
      ...(a.telephone && a.afficher_telephone !== false && { telephone: a.telephone }),
      ...(a.email && a.afficher_email !== false && { email: a.email }),
      ...((a.site_web || a.facebook_url || a.instagram_url || a.linkedin_url) && { sameAs: [
        ...(a.site_web ? [normUrl(a.site_web)] : []),
        ...(a.facebook_url ? [normUrl(a.facebook_url)] : []),
        ...(a.instagram_url ? [normUrl(a.instagram_url)] : []),
        ...(a.linkedin_url ? [normUrl(a.linkedin_url)] : []),
      ] }),
    };

    // ─── Hero ───
    const medaillon = logo
      ? `<img class="hero-logo" src="${escapeHtml(logo)}" alt="${escapeHtml(nom)}"/>`
      : `<div class="hero-logo hero-logo-fb">🏢</div>`;
    const heroBadges = [`<span class="hb">🏢 Agence immobilière</span>`];
    if (a.badge_premium) heroBadges.push(`<span class="hb hb-top">★ Premium</span>`);

    // ─── Secteurs / À propos meta ───
    const secteursTxt = communes.length
      ? communes.slice(0, 10).map((c) => escapeHtml(c)).join(' · ') + (communes.length > 10 ? ' …' : '')
      : '';

    // ─── Vidéo de présentation ───
    const yt = ytId(a.video_agence_url);
    const videoHtml = a.video_agence_url ? `
      <section class="section">
        <h2>Vidéo de présentation</h2>
        ${yt
          ? `<div class="video-wrap"><iframe class="video-frame" src="https://www.youtube.com/embed/${yt}" title="Vidéo ${escapeHtml(nom)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
          : `<a class="map-btn" href="${escapeHtml(normUrl(a.video_agence_url))}" target="_blank" rel="noopener">▶ Voir la vidéo</a>`
        }
      </section>` : '';

    // ─── Contact ───
    const contactRows = [];
    if (a.telephone && a.afficher_telephone !== false) contactRows.push(`<a class="ct-row" href="tel:${escapeHtml(a.telephone)}"><span class="ct-ic">📞</span><span class="ct-body"><span class="ct-lab">Téléphone</span><span class="ct-val">${escapeHtml(a.telephone)}</span></span></a>`);
    if (a.email && a.afficher_email !== false) contactRows.push(`<a class="ct-row" href="mailto:${escapeHtml(a.email)}"><span class="ct-ic">✉️</span><span class="ct-body"><span class="ct-lab">Email</span><span class="ct-val">${escapeHtml(a.email)}</span></span></a>`);
    if (adresse)     contactRows.push(`<div class="ct-row"><span class="ct-ic">📍</span><span class="ct-body"><span class="ct-lab">Adresse</span><span class="ct-val">${escapeHtml(adresse)}</span></span></div>`);
    const socialChips = [];
    if (a.site_web)      socialChips.push(`<a class="soc" href="${escapeHtml(normUrl(a.site_web))}" target="_blank" rel="noopener nofollow">🌐 Site web</a>`);
    if (a.facebook_url)  socialChips.push(`<a class="soc" href="${escapeHtml(normUrl(a.facebook_url))}" target="_blank" rel="noopener nofollow">👍 Facebook</a>`);
    if (a.instagram_url) socialChips.push(`<a class="soc" href="${escapeHtml(normUrl(a.instagram_url))}" target="_blank" rel="noopener nofollow">📷 Instagram</a>`);
    if (a.linkedin_url)  socialChips.push(`<a class="soc" href="${escapeHtml(normUrl(a.linkedin_url))}" target="_blank" rel="noopener nofollow">💼 LinkedIn</a>`);
    const contactHtml = (contactRows.length || socialChips.length) ? `
      <section class="section">
        <h2>Contact</h2>
        ${contactRows.length ? `<div class="ct-list">${contactRows.join('')}</div>` : ''}
        ${socialChips.length ? `<div class="soc-row">${socialChips.join('')}</div>` : ''}
      </section>` : '';

    // ─── Localisation ───
    const _lat = Number(a.latitude), _lng = Number(a.longitude);
    const hasGeo = !isNaN(_lat) && !isNaN(_lng) && (_lat !== 0 || _lng !== 0);
    const mapsLink = hasGeo ? `https://www.google.com/maps/dir/?api=1&destination=${_lat},${_lng}`
      : (adresse ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}` : '');
    const localHtml = (hasGeo || adresse) ? `
      <section class="section">
        <h2>Où nous trouver</h2>
        ${hasGeo ? `<div class="map-wrap"><iframe class="map-frame" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.openstreetmap.org/export/embed.html?bbox=${_lng-0.004}%2C${_lat-0.003}%2C${_lng+0.004}%2C${_lat+0.003}&layer=mapnik&marker=${_lat}%2C${_lng}" title="Carte de ${escapeHtml(nom)}"></iframe></div>` : ''}
        ${adresse ? `<div class="zone-txt">📍 ${escapeHtml(adresse)}</div>` : ''}
        ${mapsLink ? `<a class="map-btn" href="${mapsLink}" target="_blank" rel="noopener">🧭 Itinéraire</a>` : ''}
      </section>` : '';

    const body = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5"/>
<title>${escapeHtml(nom)} — Agence immobilière${villeLieu ? ' à ' + escapeHtml(villeLieu) : ''} — Lokalist</title>
<meta name="description" content="${escapeHtml(descShort)}"/>
<link rel="canonical" href="${canonical}"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="Lokalist"/>
<meta property="og:title" content="${escapeHtml(nom)} — Agence immobilière"/>
<meta property="og:description" content="${escapeHtml(descShort)}"/>
<meta property="og:image" content="${escapeHtml(photoOg)}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:url" content="${canonical}"/>
<meta property="og:locale" content="fr_FR"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(nom)} — Agence immobilière"/>
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

  .hero{ position:relative;min-height:300px;display:flex;background:linear-gradient(135deg,var(--primary) 0%,var(--primary-d) 100%); }
  .hero-ov{ position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 40%,rgba(0,0,0,0.28) 100%); }
  .hero-in{ position:relative;z-index:2;max-width:1120px;margin:0 auto;width:100%;padding:20px;display:flex;flex-direction:column;justify-content:space-between; }
  .hero-top{ display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap; }
  .hb{ display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.92);color:var(--text);font-size:12px;font-weight:600;padding:5px 12px;border-radius:20px; }
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
  .apropos-meta div{ display:flex;align-items:flex-start;gap:8px;font-size:14px;color:#2A332E; }

  .ct-list{ display:flex;flex-direction:column;gap:8px; }
  .ct-row{ display:flex;align-items:center;gap:12px;padding:11px 13px;border:1px solid var(--border);border-radius:12px;text-decoration:none;color:var(--text); }
  .ct-ic{ font-size:18px; }
  .ct-body{ display:flex;flex-direction:column; }
  .ct-lab{ font-size:12px;color:var(--muted); }
  .ct-val{ font-size:14px;font-weight:600; }
  .soc-row{ display:flex;flex-wrap:wrap;gap:8px;margin-top:12px; }
  .soc{ display:inline-flex;align-items:center;gap:6px;background:var(--primary-l);color:var(--primary-d);padding:9px 14px;border-radius:20px;font-weight:600;text-decoration:none;font-size:13px; }

  .video-wrap{ position:relative;width:100%;aspect-ratio:16/9;border-radius:14px;overflow:hidden;border:1px solid var(--border);background:#000; }
  .video-frame{ position:absolute;inset:0;width:100%;height:100%;border:0; }
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
</style>
</head>
<body>

<header class="top-bar">
  <div class="in">
    <a href="${SITE_URL}" class="brand"><img src="${LOGO_URL}" alt="Lokalist"/> Lokalist</a>
    <span class="verif"><img src="${LOGO_URL}" alt=""/> Vérifié Lokalist</span>
  </div>
</header>

<section class="hero">
  <div class="hero-ov"></div>
  <div class="hero-in">
    <div class="hero-top">${heroBadges.join('')}</div>
    <div class="hero-foot">
      <div class="hero-idn">
        ${medaillon}
        <div>
          <div class="hero-title">${escapeHtml(nom)}</div>
          ${villeLieu ? `<div class="hero-loc">📍 ${escapeHtml(villeLieu)}</div>` : (adresse ? `<div class="hero-loc">📍 ${escapeHtml(adresse)}</div>` : '')}
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
      ${secteursTxt ? `<div>🗺️ <span>Secteurs : ${secteursTxt}</span></div>` : ''}
      ${a.rayon_km ? `<div>📍 Rayon d'action : ${a.rayon_km} km</div>` : ''}
      ${a.siret ? `<div>🏛️ Entreprise immatriculée · SIRET ${escapeHtml(a.siret)}</div>` : ''}
    </div>
  </section>

  ${videoHtml}
  ${contactHtml}
  ${localHtml}

  <section class="section">
    <h2>Avis${avisNb > 0 ? ` (${avisNb})` : ''}</h2>
    ${avisNb > 0 ? `<div class="avis-resume"><span class="avis-resume-note">${avisMoyenne.toFixed(1)}</span><span class="avis-resume-stars">${etoiles(avisMoyenne)}</span></div>` : ''}
    ${avisHtml || '<p style="color:var(--muted);font-size:14px;">Aucun avis pour le moment. Soyez le premier à partager votre expérience depuis l\'app.</p>'}
    <a href="lokalist://avis?type=agence&id=${id}" class="avis-cta">✍️ Laisser un avis dans l'app</a>
  </section>

  <div class="cta-block">
    <h3>📱 Découvre ${escapeHtml(nom)} dans l'app</h3>
    <p>Annonces immobilières, contact direct et alertes près de chez toi.</p>
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
</script>

</body>
</html>`;

    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', 'X-Robots-Tag': 'index, follow' } });
  } catch (e) {
    console.error('[agence edge]', e);
    return pageNotFound('Erreur serveur');
  }
}

// LKL_AGENCE_CONTACTPRIV_V1

// ════════════════════════════════════════════════════════════════
//  api/artisan.js — Vercel Edge Function
//  Page HTML SSR pour /artisan/:id (clone de pro.js adapte artisans)
//  - Open Graph + JSON-LD (LocalBusiness)
//  - Deep link lokalist://artisan/:id (l'ecran existe dans l'app)
//  - Bouton store iOS/Android, capture parrain ?ref=LOK-XXXXXX
// ════════════════════════════════════════════════════════════════
export const config = { runtime: 'edge' };

const SUPABASE_URL  = 'https://kukathominhssogthplc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a2F0aG9taW5oc3NvZ3RocGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTU2NDMsImV4cCI6MjA5MDQzMTY0M30.nrfnhLWA_N-d5EA0qMvSTgSvbebbqHvWuCwk4PQDxcg';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=fr.lokalist.app';
const APP_STORE_URL  = 'https://apps.apple.com/app/lokalist'; // À mettre à jour quand iOS publié
const SITE_URL       = 'https://lokalist.fr';

// ─── Helpers ────────────────────────────────────────────────────
const escapeHtml = (str) => {
  if (!str) return '';
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

const html404 = (msg) => `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Page introuvable — Lokalist</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#F9F8F6;color:#1A1A2E;padding:40px 20px;text-align:center;line-height:1.6}h1{color:#1D9E75;font-size:28px;margin:24px 0 8px}a{color:#1D9E75;font-weight:600;text-decoration:none}  .avis-resume { display:flex;align-items:center;gap:10px;margin-bottom:14px; }
  .avis-resume-note { font-size:34px;font-weight:800;color:var(--text);line-height:1; }
  .avis-resume-stars { color:var(--accent);font-size:20px;letter-spacing:2px; }
  .avis-auteur { font-weight:700;font-size:14px;color:var(--text);margin-bottom:2px; }
  .avis-card { padding:14px 0;border-top:1px solid var(--border); }
  .avis-head { display:flex;align-items:center;justify-content:space-between;margin-bottom:4px; }
  .avis-stars { color:var(--accent);font-size:15px;letter-spacing:2px; }
  .avis-verif { background:var(--primary-l);color:var(--primary-d);font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px; }
  .avis-titre { font-weight:700;font-size:14px;margin-bottom:2px; }
  .avis-txt { font-size:14px;color:var(--text);line-height:1.55; }
  .avis-date { font-size:12px;color:var(--muted);margin-top:6px; }
  .avis-rep { margin-top:10px;margin-left:10px;padding-left:10px;border-left:2px solid var(--border);font-size:13px;color:var(--text); }
  .avis-rep-lab { font-size:12px;font-weight:700;color:var(--primary);margin-bottom:2px; }
  .avis-cta { display:inline-block;margin-top:16px;background:var(--primary);color:#fff;padding:12px 22px;border-radius:12px;font-weight:700;text-decoration:none;font-size:14px; }
</style>
</head><body>
<div style="font-size:64px">🔧</div>
<h1>${escapeHtml(msg)}</h1>
<p style="color:#8A8FA8">Cet artisan n'existe plus ou a été retiré.</p>
<p><a href="${SITE_URL}">← Retour à Lokalist</a></p>
</body></html>`;

const pageNotFound = (msg = 'Artisan introuvable') => new Response(html404(msg), {
  status: 404,
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
});

// ─── Handler principal ──────────────────────────────────────────
export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const id  = url.searchParams.get('id');
    const ref = sanitizeRef(url.searchParams.get('ref'));

    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return pageNotFound('Identifiant invalide');
    }

    const apiUrl = `${SUPABASE_URL}/rest/v1/artisans?id=eq.${id}&select=id,nom,prenom,nom_entreprise,ville,code_postal,description,photo_url,note_moyenne,nb_avis,rayon_intervention,actif,categories_artisans(nom,emoji)`;
    const r = await fetch(apiUrl, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
    });

    if (!r.ok) return pageNotFound('Erreur lors du chargement');
    const list = await r.json();
    if (!list?.length) return pageNotFound();
    const a = list[0];

    // LKL_AVIS_BLOC — Avis verifies (nouveau systeme)
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
    const avisHtml = avisListe.map((av) => `
      <div class="avis-card">
        <div class="avis-auteur">${escapeHtml(av.auteur_nom || 'Client')}</div><div class="avis-head"><span class="avis-stars">${etoiles(av.note)}</span>${av.verified ? '<span class="avis-verif">✓ Vérifié</span>' : ''}</div>
        ${av.titre ? `<div class="avis-titre">${escapeHtml(av.titre)}</div>` : ''}
        ${av.commentaire ? `<div class="avis-txt">${escapeHtml(av.commentaire)}</div>` : ''}
        <div class="avis-date">${fmtDate(av.date_publication)}</div>
        ${av.reponse ? `<div class="avis-rep"><div class="avis-rep-lab">Réponse du professionnel</div>${escapeHtml(av.reponse)}</div>` : ''}
      </div>`).join('');


    if (a.actif === false) return pageNotFound("Cet artisan n'est plus actif");

    const cat         = a.categories_artisans || {};
    const metierNom   = cat.nom || 'Artisan';
    const metierEmoji = cat.emoji || '🔧';
    const nom         = a.nom_entreprise || `${a.prenom || ''} ${a.nom || ''}`.trim() || 'Artisan local';
    const ville       = a.ville || '';
    const villeFull   = ville + (a.code_postal ? ` (${a.code_postal})` : '');
    const description = a.description || `${metierNom} à ${ville} — sur Lokalist, l'app de la vie locale`;
    const descShort   = (description.length > 160 ? description.slice(0, 157) + '...' : description);
    const photoMain   = a.photo_url || `${SITE_URL}/images/og-default.jpg`;

    const canonical = `${SITE_URL}/artisan/${id}`;
    const deepLink  = `lokalist://artisan/${id}`;

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": nom,
      "description": description,
      "image": photoMain,
      "url": canonical,
      ...(ville && {
        "address": { "@type": "PostalAddress", "addressLocality": ville, "postalCode": a.code_postal || undefined, "addressCountry": "FR" }
      }),
      ...(a.note_moyenne > 0 && {
        "aggregateRating": { "@type": "AggregateRating", "ratingValue": Number(a.note_moyenne).toFixed(1), "reviewCount": a.nb_avis || 0 }
      }),
    };

    const body = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5"/>
<title>${escapeHtml(nom)}${ville ? ' — ' + escapeHtml(ville) : ''} — Lokalist</title>
<meta name="description" content="${escapeHtml(descShort)}"/>
<link rel="canonical" href="${canonical}"/>

<!-- Open Graph / Facebook / WhatsApp / LinkedIn -->
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="Lokalist"/>
<meta property="og:title" content="${escapeHtml(nom)}${ville ? ' — ' + escapeHtml(ville) : ''}"/>
<meta property="og:description" content="${escapeHtml(descShort)}"/>
<meta property="og:image" content="${escapeHtml(photoMain)}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:url" content="${canonical}"/>
<meta property="og:locale" content="fr_FR"/>

<!-- Twitter / X Card -->
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(nom)}${ville ? ' — ' + escapeHtml(ville) : ''}"/>
<meta name="twitter:description" content="${escapeHtml(descShort)}"/>
<meta name="twitter:image" content="${escapeHtml(photoMain)}"/>

<meta name="apple-itunes-app" content="app-argument=${deepLink}"/>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<link rel="icon" type="image/svg+xml" href="/favicon.svg"/>

<style>
  :root { --primary:#1D9E75;--primary-d:#0F6E56;--primary-l:#E8F8F2;--accent:#EF9F27;--bg:#F9F8F6;--surface:#FFF;--border:#EDEDED;--text:#1A1A2E;--muted:#8A8FA8; }
  * { box-sizing:border-box;margin:0;padding:0; }
  html,body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.55; }
  .top-bar { background:var(--primary);color:#fff;padding:14px 20px;display:flex;align-items:center;justify-content:space-between; }
  .top-bar a { color:#fff;text-decoration:none;font-weight:700;font-size:18px;letter-spacing:-0.3px; }
  .top-bar .btn-app { background:rgba(0,0,0,0.18);padding:7px 13px;border-radius:18px;font-size:13px;font-weight:600; }
  .container { max-width:960px;margin:0 auto;padding:0 16px; }
  .hero { background:var(--surface);margin-top:12px;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04); }
  .hero-img { width:100%;height:300px;object-fit:cover;background:var(--primary-l);display:block; }
  .hero-img-fallback { width:100%;height:240px;background:var(--primary-l);display:flex;align-items:center;justify-content:center;font-size:80px; }
  .badges { padding:16px 20px 0;display:flex;gap:8px;flex-wrap:wrap; }
  .badge { padding:5px 11px;border-radius:20px;font-size:12px;font-weight:700;background:var(--primary-l);color:var(--primary-d); }
  .head { padding:14px 20px 20px; }
  .titre { font-size:24px;font-weight:800;letter-spacing:-0.5px;line-height:1.25;margin-bottom:8px; }
  .ville { display:flex;align-items:center;gap:6px;color:var(--muted);font-size:14px;margin-bottom:10px; }
  .note { font-size:14px;color:var(--accent);font-weight:600; }
  .section { background:var(--surface);margin-top:12px;border-radius:16px;padding:18px 20px;box-shadow:0 2px 8px rgba(0,0,0,0.04); }
  .section h2 { font-size:14px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px; }
  .section p { color:var(--text);font-size:14px;line-height:1.65;white-space:pre-line; }
  .info-row { display:flex;align-items:center;gap:8px;font-size:14px;color:var(--text);margin-top:8px; }
  .cta-block { background:var(--primary);color:#fff;margin-top:20px;margin-bottom:28px;border-radius:18px;padding:24px 20px;text-align:center;box-shadow:0 6px 18px rgba(29,158,117,0.25); }
  .cta-block h3 { font-size:18px;font-weight:800;margin-bottom:6px;letter-spacing:-0.3px; }
  .cta-block p { font-size:13px;opacity:0.9;margin-bottom:16px; }
  .cta-btn { display:inline-block;background:#fff;color:var(--primary);padding:14px 28px;border-radius:12px;font-weight:800;text-decoration:none;font-size:15px;box-shadow:0 4px 12px rgba(0,0,0,0.1); }
  .cta-btn-secondary { display:inline-block;background:rgba(0,0,0,0.15);color:#fff;padding:12px 22px;border-radius:12px;font-weight:600;text-decoration:none;font-size:13px;margin-left:8px; }
  .ref-banner { background:var(--accent);color:#fff;text-align:center;padding:10px 16px;font-size:13px;font-weight:600; }
  footer { text-align:center;padding:30px 20px 40px;color:var(--muted);font-size:12px; }
  footer a { color:var(--primary);text-decoration:none;font-weight:600; }
  @media (max-width:600px){ .hero-img{height:220px;} .titre{font-size:20px;} .cta-btn-secondary{display:block;margin:12px 0 0;} }
</style>
</head>
<body>

${ref ? `<div class="ref-banner">🎁 Invité par un ami — 50 points offerts à ton inscription !</div>` : ''}

<header class="top-bar">
  <a href="${SITE_URL}">🏡 Lokalist</a>
  <a href="${deepLink}" class="btn-app">Voir dans l'app →</a>
</header>

<main class="container">
  <article class="hero">
    ${a.photo_url
      ? `<img class="hero-img" src="${escapeHtml(photoMain)}" alt="${escapeHtml(nom)}" loading="eager"/>`
      : `<div class="hero-img-fallback">${metierEmoji}</div>`
    }
    <div class="badges">
      <span class="badge">${metierEmoji} ${escapeHtml(metierNom)}</span>
    </div>
    <div class="head">
      <h1 class="titre">${escapeHtml(nom)}</h1>
      ${ville ? `<div class="ville">📍 ${escapeHtml(villeFull)}</div>` : ''}
      ${avisNb > 0 ? `<div class="note">⭐ ${avisMoyenne.toFixed(1)} (${avisNb} avis)</div>` : ''}
    </div>
  </article>

  ${description ? `
  <section class="section">
    <h2>📄 À propos</h2>
    <p>${escapeHtml(description)}</p>
    ${a.rayon_intervention ? `<div class="info-row">📍 Intervient dans un rayon de ${escapeHtml(String(a.rayon_intervention))} km</div>` : ''}
  </section>` : ''}

  <section class="section">
    <h2>⭐ Avis${avisNb > 0 ? ` (${avisNb})` : ''}</h2>
    ${avisNb > 0 ? `<div class="avis-resume"><span class="avis-resume-note">${avisMoyenne.toFixed(1)}</span><span class="avis-resume-stars">${etoiles(avisMoyenne)}</span></div>` : ''}
    ${avisHtml || '<p style="color:var(--muted);font-size:14px;">Aucun avis pour le moment. Soyez le premier à partager votre expérience depuis l\'app.</p>'}
    <a href="lokalist://avis?type=artisan&id=${id}" class="avis-cta">✍️ Laisser un avis dans l\'app</a>
  </section>

  <div class="cta-block">
    <h3>📱 Contacte ${escapeHtml(nom)} dans l'app</h3>
    <p>Devis, avis vérifiés, et tous les artisans de confiance près de chez toi.</p>
    <a href="${deepLink}" class="cta-btn">Ouvrir dans l'app</a>
    <a href="${PLAY_STORE_URL}" id="btn-download" class="cta-btn-secondary">Télécharger</a>
  </div>
</main>

<footer>
  <p>© Lokalist · La fidélité locale réinventée</p>
  <p style="margin-top:6px;"><a href="${SITE_URL}">Accueil</a> · <a href="${SITE_URL}/contact">Contact</a> · <a href="${SITE_URL}/mentions-legales">Mentions légales</a></p>
</footer>

<script>
  // Route le bouton "Telecharger" vers le bon store selon l'OS
  (function(){
    var ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) {
      var btn = document.getElementById('btn-download');
      if (btn) btn.href = '${APP_STORE_URL}';
    }
  })();
  // Capture du code parrain (?ref=LOK-XXXXXX) — même stockage que i.html
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
    return pageNotFound('Erreur serveur');
  }
}

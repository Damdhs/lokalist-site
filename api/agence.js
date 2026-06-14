// ════════════════════════════════════════════════════════════════
//  api/agence.js — Vercel Edge Function
//  Page HTML SSR pour /agence/:id (agence immobiliere)
//  - select=* (robuste : pas de risque de colonne inconnue)
//  - Deep link lokalist://immo/agence/:id (l'ecran existe)
// ════════════════════════════════════════════════════════════════
export const config = { runtime: 'edge' };

const SUPABASE_URL  = 'https://kukathominhssogthplc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a2F0aG9taW5oc3NvZ3RocGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTU2NDMsImV4cCI6MjA5MDQzMTY0M30.nrfnhLWA_N-d5EA0qMvSTgSvbebbqHvWuCwk4PQDxcg';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=fr.lokalist.app';
const APP_STORE_URL  = 'https://apps.apple.com/app/lokalist'; // À mettre à jour quand iOS publié
const SITE_URL       = 'https://lokalist.fr';

const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
};

const html404 = (msg) => `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Agence introuvable — Lokalist</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#F9F8F6;color:#1A1A2E;padding:40px 20px;text-align:center;line-height:1.6}h1{color:#1D9E75;font-size:28px;margin:24px 0 8px}a{color:#1D9E75;font-weight:600;text-decoration:none}</style>
</head><body>
<div style="font-size:64px">🏢</div>
<h1>${escapeHtml(msg)}</h1>
<p style="color:#8A8FA8">Cette agence n'existe plus ou a été retirée.</p>
<p><a href="${SITE_URL}">← Retour à Lokalist</a></p>
</body></html>`;

const pageNotFound = (msg = 'Agence introuvable') => new Response(html404(msg), {
  status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' },
});

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const id  = url.searchParams.get('id');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return pageNotFound('Identifiant invalide');

    const r = await fetch(`${SUPABASE_URL}/rest/v1/agences_immo?id=eq.${id}&select=*`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
    });
    if (!r.ok) return pageNotFound('Erreur lors du chargement');
    const list = await r.json();
    if (!list?.length) return pageNotFound();
    const a = list[0];

    const nom         = a.nom || 'Agence immobilière';
    const ville       = a.ville || '';
    const adresse     = a.adresse || '';
    const photoMain   = a.logo_url || a.photo_url || `${SITE_URL}/images/og-default.jpg`;
    const description = a.description || `Agence immobilière${ville ? ' à ' + ville : ''} — sur Lokalist`;
    const descShort   = (description.length > 160 ? description.slice(0, 157) + '...' : description);
    const note        = Number(a.note_moyenne) || 0;
    const nbAvis      = a.nb_avis || 0;

    const canonical = `${SITE_URL}/agence/${id}`;
    const deepLink  = `lokalist://immo/agence/${id}`;

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "RealEstateAgent",
      "name": nom,
      "description": description,
      "image": photoMain,
      "url": canonical,
      ...(adresse || ville ? { "address": { "@type": "PostalAddress", "streetAddress": adresse || undefined, "addressLocality": ville || undefined, "addressCountry": "FR" } } : {}),
      ...(note > 0 ? { "aggregateRating": { "@type": "AggregateRating", "ratingValue": note.toFixed(1), "reviewCount": nbAvis } } : {}),
    };

    const body = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5"/>
<title>${escapeHtml(nom)}${ville ? ' — ' + escapeHtml(ville) : ''} — Lokalist</title>
<meta name="description" content="${escapeHtml(descShort)}"/>
<link rel="canonical" href="${canonical}"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="Lokalist"/>
<meta property="og:title" content="${escapeHtml(nom)}${ville ? ' — ' + escapeHtml(ville) : ''}"/>
<meta property="og:description" content="${escapeHtml(descShort)}"/>
<meta property="og:image" content="${escapeHtml(photoMain)}"/>
<meta property="og:url" content="${canonical}"/>
<meta property="og:locale" content="fr_FR"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(nom)}"/>
<meta name="twitter:description" content="${escapeHtml(descShort)}"/>
<meta name="twitter:image" content="${escapeHtml(photoMain)}"/>
<meta name="apple-itunes-app" content="app-argument=${deepLink}"/>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
  :root { --primary:#1D9E75;--primary-d:#0F6E56;--primary-l:#E8F8F2;--accent:#EF9F27;--bg:#F9F8F6;--surface:#FFF;--border:#EDEDED;--text:#1A1A2E;--muted:#8A8FA8; }
  * { box-sizing:border-box;margin:0;padding:0; }
  html,body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.55; }
  .top-bar { background:var(--primary);color:#fff;padding:14px 20px;display:flex;align-items:center;justify-content:space-between; }
  .top-bar a { color:#fff;text-decoration:none;font-weight:700;font-size:18px; }
  .top-bar .btn-app { background:rgba(0,0,0,0.18);padding:7px 13px;border-radius:18px;font-size:13px;font-weight:600; }
  .container { max-width:760px;margin:0 auto;padding:0 16px; }
  .hero { background:var(--surface);margin-top:12px;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04); }
  .hero-img { width:100%;height:260px;object-fit:cover;background:var(--primary-l);display:block; }
  .hero-img-fallback { width:100%;height:200px;background:var(--primary-l);display:flex;align-items:center;justify-content:center;font-size:72px; }
  .badges { padding:16px 20px 0;display:flex;gap:8px;flex-wrap:wrap; }
  .badge { padding:5px 11px;border-radius:20px;font-size:12px;font-weight:700;background:var(--primary-l);color:var(--primary-d); }
  .head { padding:14px 20px 20px; }
  .titre { font-size:24px;font-weight:800;letter-spacing:-0.5px;line-height:1.25;margin-bottom:8px; }
  .ville { display:flex;align-items:center;gap:6px;color:var(--muted);font-size:14px;margin-bottom:10px; }
  .note { font-size:14px;color:var(--accent);font-weight:600; }
  .section { background:var(--surface);margin-top:12px;border-radius:16px;padding:18px 20px;box-shadow:0 2px 8px rgba(0,0,0,0.04); }
  .section h2 { font-size:14px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px; }
  .section p { color:var(--text);font-size:14px;line-height:1.65;white-space:pre-line; }
  .cta-block { background:var(--primary);color:#fff;margin-top:20px;margin-bottom:28px;border-radius:18px;padding:24px 20px;text-align:center;box-shadow:0 6px 18px rgba(29,158,117,0.25); }
  .cta-block h3 { font-size:18px;font-weight:800;margin-bottom:6px; }
  .cta-block p { font-size:13px;opacity:0.9;margin-bottom:16px; }
  .cta-btn { display:inline-block;background:#fff;color:var(--primary);padding:14px 28px;border-radius:12px;font-weight:800;text-decoration:none;font-size:15px; }
  .cta-btn-secondary { display:inline-block;background:rgba(0,0,0,0.15);color:#fff;padding:12px 22px;border-radius:12px;font-weight:600;text-decoration:none;font-size:13px;margin-left:8px; }
  footer { text-align:center;padding:30px 20px 40px;color:var(--muted);font-size:12px; }
  footer a { color:var(--primary);text-decoration:none;font-weight:600; }
  @media (max-width:600px){ .hero-img{height:200px;} .titre{font-size:20px;} .cta-btn-secondary{display:block;margin:12px 0 0;} }
</style>
</head>
<body>
<header class="top-bar">
  <a href="${SITE_URL}">🏡 Lokalist</a>
  <a href="${deepLink}" class="btn-app">Voir dans l'app →</a>
</header>
<main class="container">
  <article class="hero">
    ${(a.logo_url || a.photo_url)
      ? `<img class="hero-img" src="${escapeHtml(photoMain)}" alt="${escapeHtml(nom)}" loading="eager"/>`
      : `<div class="hero-img-fallback">🏢</div>`
    }
    <div class="badges"><span class="badge">🏢 Agence immobilière</span></div>
    <div class="head">
      <h1 class="titre">${escapeHtml(nom)}</h1>
      ${(adresse || ville) ? `<div class="ville">📍 ${escapeHtml(adresse || ville)}</div>` : ''}
      ${note > 0 ? `<div class="note">⭐ ${note.toFixed(1)} (${nbAvis} avis)</div>` : ''}
    </div>
  </article>
  ${a.description ? `
  <section class="section">
    <h2>📄 À propos</h2>
    <p>${escapeHtml(a.description)}</p>
  </section>` : ''}
  <div class="cta-block">
    <h3>📱 Découvre ${escapeHtml(nom)} dans l'app</h3>
    <p>Annonces immobilières, contact direct et alertes près de chez toi.</p>
    <a href="${deepLink}" class="cta-btn">Ouvrir dans l'app</a>
    <a href="${PLAY_STORE_URL}" id="btn-download" class="cta-btn-secondary">Télécharger</a>
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
      var btn = document.getElementById('btn-download');
      if (btn) btn.href = '${APP_STORE_URL}';
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
    return pageNotFound('Erreur serveur');
  }
}

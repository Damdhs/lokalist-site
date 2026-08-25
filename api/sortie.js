// ════════════════════════════════════════════════════════════════
//  api/sortie.js — Vercel Edge Function
//  Page HTML SSR pour /sortie/:id (pack loisir)
//  - Méta Open Graph dynamiques (preview WhatsApp/FB/Twitter)
//  - Capture du code parrain ?ref= -> localStorage (modèle i.html)
//  - Deep link lokalist://loisirs (ouvre l'onglet Loisirs)
// ════════════════════════════════════════════════════════════════

export const config = { runtime: 'edge' };

const SUPABASE_URL  = 'https://kukathominhssogthplc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a2F0aG9taW5oc3NvZ3RocGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTU2NDMsImV4cCI6MjA5MDQzMTY0M30.nrfnhLWA_N-d5EA0qMvSTgSvbebbqHvWuCwk4PQDxcg';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=fr.lokalist.app';
const APP_STORE_URL  = 'https://apps.apple.com/fr/app/lokalist/id6778774911'; // À mettre à jour quand iOS publié
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
<title>Sortie introuvable — Lokalist</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#F9F8F6;color:#1A1A2E;padding:40px 20px;text-align:center;line-height:1.6}h1{color:#1D9E75;font-size:28px;margin:24px 0 8px}a{color:#1D9E75;font-weight:600;text-decoration:none}</style>
</head><body>
<div style="font-size:64px">🎉</div>
<h1>${escapeHtml(msg)}</h1>
<p style="color:#8A8FA8">Cette sortie n'existe plus ou n'est plus disponible.</p>
<p><a href="${SITE_URL}">← Retour à Lokalist</a></p>
</body></html>`;

const pageNotFound = (msg = "Sortie introuvable") => new Response(html404(msg), {
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
      return pageNotFound("Identifiant invalide");
    }

    const apiUrl = `${SUPABASE_URL}/rest/v1/packs_loisir?id=eq.${id}&select=id,nom,description,photo_url,ville,prix_pack,prix_normal,reduction_pct,profil_cible,actif`;
    const r = await fetch(apiUrl, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
    });

    if (!r.ok) return pageNotFound("Erreur lors du chargement");
    const list = await r.json();
    if (!list?.length) return pageNotFound();
    const p = list[0];

    if (p.actif === false) return pageNotFound("Cette sortie n'est plus disponible");

    const nom         = p.nom || 'Sortie Lokalist';
    const ville       = p.ville || '';
    const reduc       = p.reduction_pct > 0 ? ` (-${p.reduction_pct}%)` : '';
    const prixTxt     = p.prix_pack != null ? `${Number(p.prix_pack).toFixed(0)}€/pers${reduc}` : '';
    const description = p.description || `Une sortie à petit prix${ville ? ' à ' + ville : ''} — sur Lokalist, l'app de la vie locale`;
    const descShort   = (description.length > 160 ? description.slice(0, 157) + '...' : description);
    const photoMain   = p.photo_url || `${SITE_URL}/images/og-default.jpg`;

    const canonical = `${SITE_URL}/sortie/${id}`;
    const deepLink  = `lokalist://loisirs`;

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": nom,
      "description": description,
      "image": photoMain,
      "url": canonical,
      ...(p.prix_pack != null && {
        "offers": { "@type": "Offer", "price": p.prix_pack, "priceCurrency": "EUR", "availability": "https://schema.org/InStock" }
      }),
    };

    const body = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5"/>
<title>${escapeHtml(nom)}${prixTxt ? ' — ' + escapeHtml(prixTxt) : ''} — Lokalist</title>
<meta name="description" content="${escapeHtml(descShort)}"/>
<link rel="canonical" href="${canonical}"/>

<!-- Open Graph / Facebook / WhatsApp / LinkedIn -->
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="Lokalist"/>
<meta property="og:title" content="${escapeHtml(nom)}${prixTxt ? ' — ' + escapeHtml(prixTxt) : ''}"/>
<meta property="og:description" content="${escapeHtml(descShort)}"/>
<meta property="og:image" content="${escapeHtml(photoMain)}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:url" content="${canonical}"/>
<meta property="og:locale" content="fr_FR"/>

<!-- Twitter / X Card -->
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(nom)}${prixTxt ? ' — ' + escapeHtml(prixTxt) : ''}"/>
<meta name="twitter:description" content="${escapeHtml(descShort)}"/>
<meta name="twitter:image" content="${escapeHtml(photoMain)}"/>

<meta name="apple-itunes-app" content="app-argument=${deepLink}"/>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<link rel="icon" type="image/svg+xml" href="/favicon.svg"/>

<style>
  :root { --primary:#1D9E75;--primary-d:#0F6E56;--primary-l:#E8F8F2;--pink:#EC4899;--pink-l:#FDF2F8;--accent:#EF9F27;--bg:#F9F8F6;--surface:#FFF;--border:#EDEDED;--text:#1A1A2E;--muted:#8A8FA8; }
  * { box-sizing:border-box;margin:0;padding:0; }
  html,body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.55; }
  .top-bar { background:var(--pink);color:#fff;padding:14px 20px;display:flex;align-items:center;justify-content:space-between; }
  .top-bar a { color:#fff;text-decoration:none;font-weight:700;font-size:18px;letter-spacing:-0.3px; }
  .top-bar .btn-app { background:rgba(0,0,0,0.18);padding:7px 13px;border-radius:18px;font-size:13px;font-weight:600; }
  .container { max-width:960px;margin:0 auto;padding:0 16px; }
  .hero { background:var(--surface);margin-top:12px;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04); }
  .hero-img { width:100%;height:300px;object-fit:cover;background:var(--pink-l);display:block; }
  .hero-img-fallback { width:100%;height:240px;background:var(--pink-l);display:flex;align-items:center;justify-content:center;font-size:80px; }
  .badges { padding:16px 20px 0;display:flex;gap:8px;flex-wrap:wrap; }
  .badge { padding:5px 11px;border-radius:20px;font-size:12px;font-weight:700;background:var(--pink-l);color:var(--pink); }
  .badge-reduc { background:var(--pink);color:#fff; }
  .head { padding:14px 20px 20px; }
  .titre { font-size:24px;font-weight:800;letter-spacing:-0.5px;line-height:1.25;margin-bottom:8px; }
  .ville { display:flex;align-items:center;gap:6px;color:var(--muted);font-size:14px;margin-bottom:10px; }
  .prix { font-size:30px;font-weight:900;color:var(--pink);letter-spacing:-1px; }
  .prix-barre { font-size:15px;color:var(--muted);text-decoration:line-through;margin-left:8px;font-weight:400; }
  .section { background:var(--surface);margin-top:12px;border-radius:16px;padding:18px 20px;box-shadow:0 2px 8px rgba(0,0,0,0.04); }
  .section h2 { font-size:14px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px; }
  .section p { color:var(--text);font-size:14px;line-height:1.65;white-space:pre-line; }
  .cta-block { background:var(--pink);color:#fff;margin-top:20px;margin-bottom:28px;border-radius:18px;padding:24px 20px;text-align:center;box-shadow:0 6px 18px rgba(236,72,153,0.25); }
  .cta-block h3 { font-size:18px;font-weight:800;margin-bottom:6px;letter-spacing:-0.3px; }
  .cta-block p { font-size:13px;opacity:0.9;margin-bottom:16px; }
  .cta-btn { display:inline-block;background:#fff;color:var(--pink);padding:14px 28px;border-radius:12px;font-weight:800;text-decoration:none;font-size:15px;box-shadow:0 4px 12px rgba(0,0,0,0.1); }
  .cta-btn-secondary { display:inline-block;background:rgba(0,0,0,0.15);color:#fff;padding:12px 22px;border-radius:12px;font-weight:600;text-decoration:none;font-size:13px;margin-left:8px; }
  .ref-banner { background:var(--accent);color:#fff;text-align:center;padding:10px 16px;font-size:13px;font-weight:600; }
  footer { text-align:center;padding:30px 20px 40px;color:var(--muted);font-size:12px; }
  footer a { color:var(--primary);text-decoration:none;font-weight:600; }
  @media (max-width:600px){ .hero-img{height:220px;} .titre{font-size:20px;} .prix{font-size:26px;} .cta-btn-secondary{display:block;margin:12px 0 0;} }
</style>
</head>
<body>

${ref ? `<div class="ref-banner">🎁 Invité par un ami — bienvenue sur Lokalist, l'app de la vie locale !</div>` : ''}

<header class="top-bar">
  <a href="${SITE_URL}">🎉 Lokalist</a>
  <a href="${deepLink}" class="btn-app">Voir dans l'app →</a>
</header>

<main class="container">
  <article class="hero">
    ${p.photo_url
      ? `<img class="hero-img" src="${escapeHtml(photoMain)}" alt="${escapeHtml(nom)}" loading="eager"/>`
      : `<div class="hero-img-fallback">🎁</div>`
    }
    <div class="badges">
      ${p.reduction_pct > 0 ? `<span class="badge badge-reduc">-${p.reduction_pct}%</span>` : ''}
      <span class="badge">🎉 Sortie</span>
    </div>
    <div class="head">
      <h1 class="titre">${escapeHtml(nom)}</h1>
      ${ville ? `<div class="ville">📍 ${escapeHtml(ville)}</div>` : ''}
      ${p.prix_pack != null ? `<div class="prix">${Number(p.prix_pack).toFixed(0)}€<span style="font-size:14px;font-weight:600;color:var(--muted);">/pers</span>${p.prix_normal > p.prix_pack ? `<span class="prix-barre">${Number(p.prix_normal).toFixed(0)}€</span>` : ''}</div>` : ''}
    </div>
  </article>

  ${description ? `
  <section class="section">
    <h2>🎯 Cette sortie</h2>
    <p>${escapeHtml(description)}</p>
  </section>` : ''}

  <div class="cta-block">
    <h3>📱 Réserve cette sortie dans l'app</h3>
    <p>Réservation, code unique, et plein d'autres bons plans loisirs près de chez toi.</p>
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
      var pr = new URLSearchParams(window.location.search);
      var ref = (pr.get('ref') || '').toUpperCase().trim();
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
    console.error('[sortie edge]', e);
    return pageNotFound('Erreur serveur');
  }
}

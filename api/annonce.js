// ════════════════════════════════════════════════════════════════
//  api/annonce.js — Vercel Edge Function
//  Génère une page HTML SSR pour /annonce/:id avec :
//  - Méta-tags Open Graph dynamiques (preview WhatsApp/FB/Twitter)
//  - JSON-LD Schema.org (rich snippet Google)
//  - Bouton "Voir dans l'app" (deep link lokalist://)
//  - Bouton "Télécharger l'app" (Play Store)
//  - Page responsive (mobile + desktop)
// ════════════════════════════════════════════════════════════════

export const config = { runtime: 'edge' };

const SUPABASE_URL  = 'https://kukathominhssogthplc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a2F0aG9taW5oc3NvZ3RocGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3MTQ0MDksImV4cCI6MjA2MDI5MDQwOX0.nrfnhLWA_N-d5EA0qMvSTgSvbebbqHvWuCwk4PQDxcg';

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

const formatPrix = (p, t) => {
  if (!p) return 'Prix sur demande';
  const suffix = t === 'location' ? '/mois' : '';
  if (p >= 1000000) return `${(p/1000000).toFixed(2).replace('.',',')} M€${suffix}`;
  if (p >= 1000)    return `${Math.floor(p/1000)} k€${suffix}`;
  return `${p} €${suffix}`;
};

const pageNotFound = (msg = "Annonce introuvable") => new Response(html404(msg), {
  status: 404,
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
});

const html404 = (msg) => `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Annonce introuvable — Lokalist</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#F9F8F6;color:#1A1A2E;padding:40px 20px;text-align:center;line-height:1.6}h1{color:#1D9E75;font-size:28px;margin:24px 0 8px}a{color:#1D9E75;font-weight:600;text-decoration:none}</style>
</head><body>
<div style="font-size:64px">🏠</div>
<h1>${escapeHtml(msg)}</h1>
<p style="color:#8A8FA8">Cette annonce n'existe plus ou a été retirée.</p>
<p><a href="${SITE_URL}">← Retour à Lokalist</a></p>
</body></html>`;

// ─── Handler principal ──────────────────────────────────────────
export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const id  = url.searchParams.get('id');

    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return pageNotFound("ID d'annonce invalide");
    }

    // Fetch l'annonce depuis Supabase (REST PostgREST) + agence jointe
    const annonceUrl = `${SUPABASE_URL}/rest/v1/annonces_immo?id=eq.${id}&select=*,agences_immo(nom,telephone,site_web,note_moyenne,nb_avis,badge_premium)`;
    const r = await fetch(annonceUrl, {
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
      },
    });

    if (!r.ok) return pageNotFound("Erreur lors du chargement");
    const list = await r.json();
    if (!list?.length) return pageNotFound();
    const a = list[0];

    if (a.statut !== 'active') return pageNotFound("Cette annonce n'est plus active");

    // Données préparées
    const titre        = a.titre || 'Annonce immobilière';
    const description  = a.description || `${a.type_bien || 'Bien'} à ${a.ville || ''} - Annonce sur Lokalist`;
    const descShort    = (description.length > 160 ? description.slice(0, 157) + '...' : description);
    const prix         = formatPrix(a.prix, a.type_transaction);
    const ville        = a.ville || '';
    const photoMain    = (a.photos && a.photos[0]) || `${SITE_URL}/images/og-default.jpg`;
    const photos       = Array.isArray(a.photos) ? a.photos : [];
    const agenceNom    = a.agences_immo?.nom || 'Agence Lokalist';
    const transaction  = a.type_transaction === 'vente' ? 'Vente' : 'Location';
    const typeLabel    = ({ appartement: 'Appartement', maison: 'Maison', terrain: 'Terrain', local_commercial: 'Local commercial' }[a.type_bien]) || 'Bien';

    // URL canonique
    const canonical = `${SITE_URL}/annonce/${id}`;
    const deepLink  = `lokalist://immo/${id}`;

    // JSON-LD Schema.org (RealEstateListing pour Google)
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": a.type_transaction === 'location' ? "ApartmentComplex" : "Product",
      "name": titre,
      "description": description,
      "image": photoMain,
      "url": canonical,
      ...(a.prix && {
        "offers": {
          "@type": "Offer",
          "price": a.prix,
          "priceCurrency": "EUR",
          "availability": "https://schema.org/InStock",
        }
      }),
      ...(a.latitude && a.longitude && {
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": a.latitude,
          "longitude": a.longitude,
        }
      }),
      "address": {
        "@type": "PostalAddress",
        "addressLocality": ville,
        "postalCode": a.code_postal || '',
        "addressCountry": "FR",
      },
    };

    // Construction du HTML
    const body = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5"/>
<title>${escapeHtml(titre)} — ${prix} — Lokalist</title>
<meta name="description" content="${escapeHtml(descShort)}"/>
<link rel="canonical" href="${canonical}"/>

<!-- Open Graph / Facebook / WhatsApp / LinkedIn -->
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="Lokalist"/>
<meta property="og:title" content="${escapeHtml(titre)} — ${prix}"/>
<meta property="og:description" content="${escapeHtml(descShort)}"/>
<meta property="og:image" content="${escapeHtml(photoMain)}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:url" content="${canonical}"/>
<meta property="og:locale" content="fr_FR"/>

<!-- Twitter / X Card -->
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(titre)} — ${prix}"/>
<meta name="twitter:description" content="${escapeHtml(descShort)}"/>
<meta name="twitter:image" content="${escapeHtml(photoMain)}"/>

<!-- Deep link Apple Smart App Banner -->
<meta name="apple-itunes-app" content="app-argument=${deepLink}"/>

<!-- JSON-LD Schema.org -->
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>

<link rel="icon" type="image/svg+xml" href="/favicon.svg"/>

<style>
  :root {
    --primary: #1D9E75;
    --primary-d: #0F6E56;
    --primary-l: #E8F8F2;
    --accent: #EF9F27;
    --bg: #F9F8F6;
    --surface: #FFFFFF;
    --border: #EDEDED;
    --text: #1A1A2E;
    --muted: #8A8FA8;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.55; }

  .top-bar { background: var(--primary); color: #fff; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; }
  .top-bar a { color: #fff; text-decoration: none; font-weight: 700; font-size: 18px; letter-spacing: -0.3px; }
  .top-bar .btn-app { background: rgba(0,0,0,0.18); padding: 7px 13px; border-radius: 18px; font-size: 13px; font-weight: 600; }

  .container { max-width: 960px; margin: 0 auto; padding: 0 16px; }

  .hero { background: var(--surface); margin-top: 12px; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
  .hero-img { width: 100%; height: 360px; object-fit: cover; background: var(--primary-l); display: block; }
  .hero-img-fallback { width: 100%; height: 360px; background: var(--primary-l); display: flex; align-items: center; justify-content: center; font-size: 80px; }

  .gallery { display: flex; gap: 8px; padding: 10px; overflow-x: auto; background: #fafafa; }
  .gallery img { width: 110px; height: 80px; object-fit: cover; border-radius: 8px; flex-shrink: 0; }

  .badges { padding: 16px 20px 0; display: flex; gap: 8px; flex-wrap: wrap; }
  .badge { padding: 5px 11px; border-radius: 20px; font-size: 12px; font-weight: 700; }
  .badge-transac { background: #DBEAFE; color: #1D4ED8; }
  .badge-location { background: #D1FAE5; color: var(--primary-d); }
  .badge-boost { background: var(--accent); color: #fff; }
  .badge-premium { background: #EDE9FE; color: #6D28D9; }

  .head { padding: 14px 20px 20px; }
  .titre { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.25; margin-bottom: 8px; }
  .ville { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: 14px; margin-bottom: 14px; }
  .prix { font-size: 32px; font-weight: 900; color: var(--primary); letter-spacing: -1px; }

  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; padding: 0 20px 20px; }
  .stat { background: var(--bg); padding: 12px; border-radius: 10px; border: 1px solid var(--border); text-align: center; }
  .stat-val { font-size: 16px; font-weight: 800; color: var(--text); }
  .stat-lbl { font-size: 11px; color: var(--muted); margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }

  .section { background: var(--surface); margin-top: 12px; border-radius: 16px; padding: 18px 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
  .section h2 { font-size: 14px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
  .section p { color: var(--text); font-size: 14px; line-height: 1.65; white-space: pre-line; }

  .agence { display: flex; align-items: center; gap: 14px; }
  .agence-icon { width: 50px; height: 50px; border-radius: 14px; background: var(--primary-l); display: flex; align-items: center; justify-content: center; font-size: 26px; }
  .agence-nom { font-size: 15px; font-weight: 700; }
  .agence-note { font-size: 13px; color: var(--accent); margin-top: 2px; }

  .cta-block { background: var(--primary); color: #fff; margin-top: 20px; margin-bottom: 28px; border-radius: 18px; padding: 24px 20px; text-align: center; box-shadow: 0 6px 18px rgba(29,158,117,0.25); }
  .cta-block h3 { font-size: 18px; font-weight: 800; margin-bottom: 6px; letter-spacing: -0.3px; }
  .cta-block p { font-size: 13px; opacity: 0.9; margin-bottom: 16px; }
  .cta-btn { display: inline-block; background: #fff; color: var(--primary); padding: 14px 28px; border-radius: 12px; font-weight: 800; text-decoration: none; font-size: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
  .cta-btn-secondary { display: inline-block; background: rgba(0,0,0,0.15); color: #fff; padding: 12px 22px; border-radius: 12px; font-weight: 600; text-decoration: none; font-size: 13px; margin-left: 8px; }

  footer { text-align: center; padding: 30px 20px 40px; color: var(--muted); font-size: 12px; }
  footer a { color: var(--primary); text-decoration: none; font-weight: 600; }

  @media (max-width: 600px) {
    .hero-img, .hero-img-fallback { height: 240px; }
    .titre { font-size: 20px; }
    .prix { font-size: 26px; }
    .cta-btn-secondary { display: block; margin: 12px 0 0; }
  }
</style>
</head>
<body>

<header class="top-bar">
  <a href="${SITE_URL}">🏡 Lokalist</a>
  <a href="${deepLink}" class="btn-app">Voir dans l'app →</a>
</header>

<main class="container">

  <article class="hero">
    ${photoMain
      ? `<img class="hero-img" src="${escapeHtml(photoMain)}" alt="${escapeHtml(titre)}" loading="eager"/>`
      : `<div class="hero-img-fallback">🏠</div>`
    }
    ${photos.length > 1 ? `
    <div class="gallery">
      ${photos.slice(0, 8).map(p => `<img src="${escapeHtml(p)}" alt="" loading="lazy"/>`).join('')}
    </div>` : ''}

    <div class="badges">
      <span class="badge ${a.type_transaction === 'vente' ? 'badge-transac' : 'badge-location'}">
        ${a.type_transaction === 'vente' ? '🏷️ Vente' : '🔑 Location'}
      </span>
      <span class="badge" style="background:var(--primary-l);color:var(--primary-d);">${typeLabel}</span>
      ${a.booste ? `<span class="badge badge-boost">⚡ Mise en avant</span>` : ''}
      ${a.agences_immo?.badge_premium ? `<span class="badge badge-premium">⭐ Agence Premium</span>` : ''}
    </div>

    <div class="head">
      <h1 class="titre">${escapeHtml(titre)}</h1>
      <div class="ville">📍 ${escapeHtml(ville)}${a.code_postal ? ` (${a.code_postal})` : ''}</div>
      <div class="prix">${prix}</div>
    </div>

    <div class="stats">
      ${a.surface     ? `<div class="stat"><div class="stat-val">${a.surface} m²</div><div class="stat-lbl">Surface</div></div>` : ''}
      ${a.nb_pieces   ? `<div class="stat"><div class="stat-val">${a.nb_pieces}</div><div class="stat-lbl">Pièces</div></div>` : ''}
      ${a.nb_chambres ? `<div class="stat"><div class="stat-val">${a.nb_chambres}</div><div class="stat-lbl">Chambres</div></div>` : ''}
      ${a.etage != null ? `<div class="stat"><div class="stat-val">${a.etage}</div><div class="stat-lbl">Étage</div></div>` : ''}
      ${a.annee_construction ? `<div class="stat"><div class="stat-val">${a.annee_construction}</div><div class="stat-lbl">Année</div></div>` : ''}
      ${a.ges ? `<div class="stat"><div class="stat-val">${escapeHtml(a.ges)}</div><div class="stat-lbl">DPE</div></div>` : ''}
    </div>
  </article>

  ${description ? `
  <section class="section">
    <h2>📄 Description</h2>
    <p>${escapeHtml(description)}</p>
  </section>` : ''}

  <section class="section">
    <h2>🏢 Présenté par</h2>
    <div class="agence">
      <div class="agence-icon">🏢</div>
      <div>
        <div class="agence-nom">${escapeHtml(agenceNom)}</div>
        ${a.agences_immo?.note_moyenne > 0
          ? `<div class="agence-note">⭐ ${Number(a.agences_immo.note_moyenne).toFixed(1)} (${a.agences_immo.nb_avis || 0} avis)</div>`
          : ''
        }
      </div>
    </div>
  </section>

  ${a.numero_mandat ? `
  <section class="section">
    <h2>📋 Informations légales</h2>
    <p style="font-size:13px;color:var(--muted);">Mandat n° ${escapeHtml(a.numero_mandat)}</p>
    ${a.honoraires ? `<p style="font-size:13px;color:var(--muted);margin-top:4px;">Honoraires : ${escapeHtml(a.honoraires)}</p>` : ''}
  </section>` : ''}

  <div class="cta-block">
    <h3>📱 Voir plus dans l'application</h3>
    <p>Photos, contact direct, financement, alertes nouvelles annonces…</p>
    <a href="${deepLink}" class="cta-btn">Ouvrir dans l'app</a>
    <a href="${PLAY_STORE_URL}" class="cta-btn-secondary">Télécharger</a>
  </div>

</main>

<footer>
  <p>© Lokalist · La fidélité locale réinventée</p>
  <p style="margin-top:6px;"><a href="${SITE_URL}">Retour à l'accueil</a> · <a href="${SITE_URL}/contact">Contact</a> · <a href="${SITE_URL}/mentions-legales">Mentions légales</a></p>
</footer>

<script>
  // Tente d'ouvrir l'app si on est sur mobile (sans bloquer si app pas installée)
  (function() {
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    if (!isMobile) return;
    // Pas de redirection auto agressive — on laisse l'user cliquer.
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
    console.error('[annonce edge]', e);
    return pageNotFound('Erreur serveur');
  }
}

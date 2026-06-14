// ════════════════════════════════════════════════════════════════
//  api/evenement.js — Vercel Edge Function
//  Page HTML SSR pour /evenement/:id (evenement de mairie)
//  - Open Graph + JSON-LD (Event)
//  - Deep link lokalist://agenda (pas de fiche evenement dans l'app)
//  - Bouton store iOS/Android
//  - Commune emettrice, date, lieu, prix, inscription
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

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const formatDateHeure = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const h = d.getHours();
  const min = d.getMinutes();
  const heure = (h || min) ? ` à ${h}h${min ? String(min).padStart(2, '0') : ''}` : '';
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}${heure}`;
};

const html404 = (msg) => `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Événement introuvable — Lokalist</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#F9F8F6;color:#1A1A2E;padding:40px 20px;text-align:center;line-height:1.6}h1{color:#1D9E75;font-size:28px;margin:24px 0 8px}a{color:#1D9E75;font-weight:600;text-decoration:none}</style>
</head><body>
<div style="font-size:64px">📅</div>
<h1>${escapeHtml(msg)}</h1>
<p style="color:#8A8FA8">Cet événement n'est plus disponible.</p>
<p><a href="${SITE_URL}">← Retour à Lokalist</a></p>
</body></html>`;

const pageNotFound = (msg = 'Événement introuvable') => new Response(html404(msg), {
  status: 404,
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
});

async function sbGet(pathAndQuery) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
  });
  if (!r.ok) return null;
  return r.json();
}

// ─── Handler principal ──────────────────────────────────────────
export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const id  = url.searchParams.get('id');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return pageNotFound('Identifiant invalide');

    const rows = await sbGet(
      `evenements_mairie?id=eq.${id}&select=id,titre,description,type,lieu,ville,date_debut,date_fin,gratuit,prix,lien_inscription,sur_reservation,image_url,mairie_id`
    );
    if (!rows || rows.length === 0) return pageNotFound();
    const e = rows[0];

    // Commune emettrice
    let emetteur = e.ville || '';
    if (e.mairie_id) {
      const m = await sbGet(`mairies_partenaires?id=eq.${e.mairie_id}&select=nom,ville`);
      if (m && m.length) emetteur = m[0].nom || m[0].ville || emetteur;
    }

    const titre = e.titre || 'Événement local';
    const description = e.description || '';
    const lieu = e.lieu || '';
    const photoMain = e.image_url || `${SITE_URL}/images/og-default.jpg`;
    const dateDebut = formatDateHeure(e.date_debut);
    const dateFin = e.date_fin ? formatDateHeure(e.date_fin) : '';
    const prixTxt = e.gratuit ? 'Gratuit' : (e.prix ? `${e.prix} €` : '');
    const descShort = (description.replace(/\s+/g, ' ').trim().slice(0, 157)) + (description.length > 157 ? '...' : '')
      || `Événement à ${emetteur} sur Lokalist.`;

    const canonical = `${SITE_URL}/evenement/${id}`;
    const deepLink  = 'lokalist://agenda';

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Event",
      "name": titre,
      "image": photoMain,
      "url": canonical,
      ...(e.date_debut ? { "startDate": e.date_debut } : {}),
      ...(e.date_fin ? { "endDate": e.date_fin } : {}),
      ...(lieu || e.ville ? {
        "location": { "@type": "Place", "name": lieu || e.ville, "address": e.ville || lieu }
      } : {}),
      ...(e.gratuit !== undefined ? {
        "offers": { "@type": "Offer", "price": e.gratuit ? 0 : (e.prix || 0), "priceCurrency": "EUR" }
      } : {}),
    };

    const body = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5"/>
<title>${escapeHtml(titre)} — Lokalist</title>
<meta name="description" content="${escapeHtml(descShort)}"/>
<link rel="canonical" href="${canonical}"/>

<meta property="og:type" content="article"/>
<meta property="og:site_name" content="Lokalist"/>
<meta property="og:title" content="${escapeHtml(titre)}"/>
<meta property="og:description" content="${escapeHtml(descShort)}"/>
<meta property="og:image" content="${escapeHtml(photoMain)}"/>
<meta property="og:url" content="${canonical}"/>
<meta property="og:locale" content="fr_FR"/>

<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(titre)}"/>
<meta name="twitter:description" content="${escapeHtml(descShort)}"/>
<meta name="twitter:image" content="${escapeHtml(photoMain)}"/>

<meta name="apple-itunes-app" content="app-argument=${deepLink}"/>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>

<style>
  :root { --primary:#1D9E75;--primary-d:#0F6E56;--primary-l:#E8F8F2;--accent:#EF9F27;--bg:#F9F8F6;--surface:#FFF;--border:#EDEDED;--text:#1A1A2E;--muted:#8A8FA8; }
  * { box-sizing:border-box;margin:0;padding:0; }
  html,body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.6; }
  .top-bar { background:var(--primary);color:#fff;padding:14px 20px;display:flex;align-items:center;justify-content:space-between; }
  .top-bar a { color:#fff;text-decoration:none;font-weight:700;font-size:18px;letter-spacing:-0.3px; }
  .top-bar .btn-app { background:rgba(0,0,0,0.18);padding:7px 13px;border-radius:18px;font-size:13px;font-weight:600; }
  .container { max-width:760px;margin:0 auto;padding:0 16px; }
  .hero { background:var(--surface);margin-top:12px;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04); }
  .hero-img { width:100%;height:300px;object-fit:cover;background:var(--primary-l);display:block; }
  .hero-img-fallback { width:100%;height:200px;background:var(--primary-l);display:flex;align-items:center;justify-content:center;font-size:72px; }
  .head { padding:18px 20px 20px; }
  .emetteur { display:inline-block;background:var(--primary-l);color:var(--primary-d);font-size:12px;font-weight:700;padding:5px 11px;border-radius:20px;margin-bottom:10px; }
  .titre { font-size:25px;font-weight:800;letter-spacing:-0.5px;line-height:1.3;margin-bottom:12px; }
  .infos { display:flex;flex-direction:column;gap:8px;margin-top:6px; }
  .info-row { display:flex;align-items:center;gap:8px;font-size:14px;color:var(--text); }
  .pills { display:flex;gap:8px;flex-wrap:wrap;margin-top:12px; }
  .pill { padding:5px 11px;border-radius:20px;font-size:12px;font-weight:700;background:var(--primary-l);color:var(--primary-d); }
  .pill-prix { background:var(--accent);color:#fff; }
  .section { background:var(--surface);margin-top:12px;border-radius:16px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.04); }
  .section p { color:var(--text);font-size:15px;line-height:1.7;white-space:pre-line; }
  .inscription-btn { display:inline-block;margin-top:14px;background:var(--primary);color:#fff;padding:12px 22px;border-radius:12px;font-weight:700;text-decoration:none;font-size:14px; }
  .cta-block { background:var(--primary);color:#fff;margin-top:20px;margin-bottom:28px;border-radius:18px;padding:24px 20px;text-align:center;box-shadow:0 6px 18px rgba(29,158,117,0.25); }
  .cta-block h3 { font-size:18px;font-weight:800;margin-bottom:6px;letter-spacing:-0.3px; }
  .cta-block p { font-size:13px;opacity:0.9;margin-bottom:16px; }
  .cta-btn { display:inline-block;background:#fff;color:var(--primary);padding:14px 28px;border-radius:12px;font-weight:800;text-decoration:none;font-size:15px;box-shadow:0 4px 12px rgba(0,0,0,0.1); }
  .cta-btn-secondary { display:inline-block;background:rgba(0,0,0,0.15);color:#fff;padding:12px 22px;border-radius:12px;font-weight:600;text-decoration:none;font-size:13px;margin-left:8px; }
  footer { text-align:center;padding:30px 20px 40px;color:var(--muted);font-size:12px; }
  footer a { color:var(--primary);text-decoration:none;font-weight:600; }
  @media (max-width:600px){ .hero-img{height:210px;} .titre{font-size:21px;} .cta-btn-secondary{display:block;margin:12px 0 0;} }
</style>
</head>
<body>

<header class="top-bar">
  <a href="${SITE_URL}">🏡 Lokalist</a>
  <a href="${deepLink}" class="btn-app">Voir dans l'app →</a>
</header>

<main class="container">
  <article class="hero">
    ${e.image_url
      ? `<img class="hero-img" src="${escapeHtml(photoMain)}" alt="${escapeHtml(titre)}" loading="eager"/>`
      : `<div class="hero-img-fallback">📅</div>`
    }
    <div class="head">
      <span class="emetteur">📍 ${escapeHtml(emetteur)}</span>
      <h1 class="titre">${escapeHtml(titre)}</h1>
      <div class="infos">
        ${dateDebut ? `<div class="info-row">🗓️ ${escapeHtml(dateDebut)}${dateFin ? ` → ${escapeHtml(dateFin)}` : ''}</div>` : ''}
        ${lieu ? `<div class="info-row">📍 ${escapeHtml(lieu)}</div>` : ''}
      </div>
      <div class="pills">
        ${prixTxt ? `<span class="pill ${e.gratuit ? '' : 'pill-prix'}">${escapeHtml(prixTxt)}</span>` : ''}
        ${e.sur_reservation ? `<span class="pill">Sur réservation</span>` : ''}
      </div>
    </div>
  </article>

  ${description ? `
  <section class="section">
    <p>${escapeHtml(description)}</p>
    ${e.lien_inscription ? `<a href="${escapeHtml(e.lien_inscription)}" class="inscription-btn" target="_blank" rel="noopener">S'inscrire / En savoir plus →</a>` : ''}
  </section>` : ''}

  <div class="cta-block">
    <h3>📱 Tous les événements de ta ville dans l'app</h3>
    <p>Agenda local, actus de mairie et bons plans, au même endroit.</p>
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

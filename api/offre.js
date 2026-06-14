// ════════════════════════════════════════════════════════════════
//  api/offre.js — Vercel Edge Function
//  Génère une page HTML SSR pour /offre/:id avec :
//  - Méta-tags Open Graph dynamiques (preview WhatsApp/FB/Twitter)
//  - JSON-LD Schema.org (rich snippet Google)
//  - Bouton "Voir dans l'app" (deep link lokalist://offres)
//  - Bouton "Télécharger l'app" (Play Store / App Store selon OS)
//  - Section offre (titre, réduction, validité, photo) + commerçants participants
//  - Page responsive (mobile + desktop)
// ════════════════════════════════════════════════════════════════
export const config = { runtime: 'edge' };

const SUPABASE_URL  = 'https://kukathominhssogthplc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a2F0aG9taW5oc3NvZ3RocGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTU2NDMsImV4cCI6MjA5MDQzMTY0M30.nrfnhLWA_N-d5EA0qMvSTgSvbebbqHvWuCwk4PQDxcg';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=fr.lokalist.app';
const APP_STORE_URL  = 'https://apps.apple.com/app/lokalist'; // À mettre à jour quand iOS publié
const SITE_URL       = 'https://lokalist.fr';

// Deep link : pas d'écran offre individuel dans l'app -> on ouvre la liste des offres.
const DEEP_LINK = 'lokalist://offres';

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

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
};

const typeOffreLabel = (t) => {
  if (t === 'croisee') return 'Offre croisée';
  return 'Offre';
};

const html404 = (msg) => `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Offre introuvable — Lokalist</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#F9F8F6;color:#1A1A2E;padding:40px 20px;text-align:center;line-height:1.6}h1{color:#1D9E75;font-size:28px;margin:24px 0 8px}a{color:#1D9E75;font-weight:600;text-decoration:none}</style>
</head><body>
<div style="font-size:64px">🎁</div>
<h1>${escapeHtml(msg)}</h1>
<p style="color:#8A8FA8">Cette offre n'est plus disponible ou a expiré.</p>
<p><a href="${SITE_URL}">← Retour à Lokalist</a></p>
</body></html>`;

const pageNotFound = (msg = 'Offre introuvable') => new Response(html404(msg), {
  status: 404,
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
});

// ─── Accès Supabase REST ────────────────────────────────────────
async function sbGet(pathAndQuery) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
    },
  });
  if (!r.ok) return null;
  return r.json();
}

// ─── Handler principal ──────────────────────────────────────────
export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const id = (url.searchParams.get('id') || '').trim();
    if (!id) return pageNotFound('Offre introuvable');

    // 1) L'offre + son commerçant principal
    const offreRows = await sbGet(
      `offres?id=eq.${encodeURIComponent(id)}` +
      `&select=id,titre,description,reduction,photo_url,type_offre,statut,date_debut,expire_at,` +
      `commercants(nom,categorie,ville)`
    );
    if (!offreRows || offreRows.length === 0) return pageNotFound('Offre introuvable');
    const o = offreRows[0];

    // Offre inactive ou expirée -> page "terminée"
    const now = new Date();
    const expiree = o.expire_at && new Date(o.expire_at) < now;
    if (o.statut !== 'active' || expiree) return pageNotFound('Offre terminée');

    // 2) Les commerçants participants (offres croisées)
    const participantsRows = await sbGet(
      `offres_commercants?offre_id=eq.${encodeURIComponent(id)}` +
      `&select=part_texte,prix,commercants(nom,ville)`
    ) || [];

    // ── Champs prêts à l'affichage ──────────────────────────────
    const titre = o.titre || 'Offre Lokalist';
    const description = o.description || '';
    const reduction = o.reduction || '';
    const photoMain = o.photo_url || '';
    const cPrincipal = o.commercants || {};
    const ville = cPrincipal.ville || '';
    const typeLabel = typeOffreLabel(o.type_offre);
    const validite = o.expire_at
      ? `Valable jusqu'au ${formatDate(o.expire_at)}`
      : '';
    const debut = o.date_debut ? `À partir du ${formatDate(o.date_debut)}` : '';

    // Liste des participants (dédoublonnée par nom)
    const vusNoms = new Set();
    const participants = [];
    participantsRows.forEach((p) => {
      const c = p.commercants || {};
      const nom = c.nom || '';
      if (!nom || vusNoms.has(nom)) return;
      vusNoms.add(nom);
      participants.push({ nom, ville: c.ville || '', part: p.part_texte || '' });
    });
    // Si la table de liaison est vide, on retombe sur le commerçant principal
    if (participants.length === 0 && cPrincipal.nom) {
      participants.push({ nom: cPrincipal.nom, ville: cPrincipal.ville || '', part: '' });
    }

    // ── Méta description (Open Graph) ───────────────────────────
    const ogDesc = [reduction, description].filter(Boolean).join(' — ').slice(0, 200)
      || 'Découvrez cette offre locale sur Lokalist.';
    const ogImage = photoMain || `${SITE_URL}/og-default.png`;
    const pageUrl = `${SITE_URL}/offre/${escapeHtml(id)}`;

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Offer',
      name: titre,
      description: ogDesc,
      url: pageUrl,
      ...(photoMain ? { image: photoMain } : {}),
      ...(o.expire_at ? { validThrough: o.expire_at } : {}),
      ...(ville ? { areaServed: ville } : {}),
    };

    // ── HTML ────────────────────────────────────────────────────
    const body = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(titre)} — Lokalist</title>
<meta name="description" content="${escapeHtml(ogDesc)}"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${escapeHtml(titre)} — Lokalist"/>
<meta property="og:description" content="${escapeHtml(ogDesc)}"/>
<meta property="og:url" content="${pageUrl}"/>
<meta property="og:image" content="${escapeHtml(ogImage)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(titre)} — Lokalist"/>
<meta name="twitter:description" content="${escapeHtml(ogDesc)}"/>
<meta name="twitter:image" content="${escapeHtml(ogImage)}"/>
<meta name="apple-itunes-app" content="app-argument=${DEEP_LINK}"/>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
  :root{--primary:#1D9E75;--primary-d:#0F6E56;--primary-l:#E1F5EE;--bg:#F9F8F6;--text:#1A1A2E;--muted:#8A8FA8;--card:#FFFFFF;--border:#ECEAE4;}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.6}
  a{color:var(--primary);text-decoration:none}
  .top-bar{background:var(--primary);color:#fff;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10}
  .top-bar .brand{font-weight:700;font-size:17px;color:#fff}
  .top-bar .btn-app{background:rgba(0,0,0,0.18);padding:7px 13px;border-radius:18px;font-size:13px;color:#fff;font-weight:600}
  .container{max-width:680px;margin:0 auto;padding:16px}
  .hero{background:var(--card);border:1px solid var(--border);border-radius:16px;overflow:hidden;margin-bottom:16px}
  .hero-img{width:100%;height:240px;object-fit:cover;display:block}
  .hero-img-fallback{width:100%;height:160px;display:flex;align-items:center;justify-content:center;font-size:64px;background:var(--primary-l)}
  .hero-body{padding:18px}
  .badges{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
  .badge{font-size:13px;font-weight:600;padding:5px 11px;border-radius:14px;background:var(--primary-l);color:var(--primary-d)}
  .badge-reduc{background:var(--primary);color:#fff}
  h1{font-size:23px;line-height:1.3;margin-bottom:8px}
  .meta{font-size:14px;color:var(--muted);margin-bottom:4px}
  .section{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:18px;margin-bottom:16px}
  .section h2{font-size:16px;margin-bottom:10px;color:var(--primary-d)}
  .section p{font-size:15px}
  .commerce{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--border)}
  .commerce:first-of-type{border-top:none}
  .commerce-icon{width:40px;height:40px;border-radius:10px;background:var(--primary-l);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
  .commerce-nom{font-weight:600;font-size:15px}
  .commerce-sub{font-size:13px;color:var(--muted)}
  .cta-block{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:22px 18px;text-align:center;margin-bottom:16px}
  .cta-block h3{font-size:17px;margin-bottom:6px}
  .cta-block p{font-size:14px;color:var(--muted);margin-bottom:14px}
  .cta-btn{display:inline-block;background:var(--primary);color:#fff;font-weight:600;padding:12px 22px;border-radius:24px;margin:4px}
  .cta-btn-secondary{display:inline-block;background:var(--primary-l);color:var(--primary-d);font-weight:600;padding:12px 22px;border-radius:24px;margin:4px}
  footer{text-align:center;padding:24px 16px;color:var(--muted);font-size:13px}
</style>
</head>
<body>
<header class="top-bar">
  <a href="${SITE_URL}" class="brand">Lokalist</a>
  <a href="${DEEP_LINK}" class="btn-app">Voir dans l'app →</a>
</header>
<main class="container">
  <article class="hero">
    ${photoMain
      ? `<img class="hero-img" src="${escapeHtml(photoMain)}" alt="${escapeHtml(titre)}" loading="eager"/>`
      : `<div class="hero-img-fallback">🎁</div>`
    }
    <div class="hero-body">
      <div class="badges">
        ${reduction ? `<span class="badge badge-reduc">${escapeHtml(reduction)}</span>` : ''}
        <span class="badge">${escapeHtml(typeLabel)}</span>
      </div>
      <h1>${escapeHtml(titre)}</h1>
      ${ville ? `<div class="meta">📍 ${escapeHtml(ville)}</div>` : ''}
      ${debut ? `<div class="meta">🗓️ ${escapeHtml(debut)}</div>` : ''}
      ${validite ? `<div class="meta">⏳ ${escapeHtml(validite)}</div>` : ''}
    </div>
  </article>

  ${description ? `
  <section class="section">
    <h2>📄 En quoi consiste l'offre</h2>
    <p>${escapeHtml(description)}</p>
  </section>` : ''}

  ${participants.length ? `
  <section class="section">
    <h2>🏪 ${participants.length > 1 ? 'Commerçants participants' : 'Proposé par'}</h2>
    ${participants.map((p) => `
    <div class="commerce">
      <div class="commerce-icon">🏪</div>
      <div>
        <div class="commerce-nom">${escapeHtml(p.nom)}</div>
        ${p.ville ? `<div class="commerce-sub">${escapeHtml(p.ville)}</div>` : ''}
        ${p.part ? `<div class="commerce-sub">${escapeHtml(p.part)}</div>` : ''}
      </div>
    </div>`).join('')}
  </section>` : ''}

  <div class="cta-block">
    <h3>📱 Profite de cette offre dans l'app</h3>
    <p>Toutes les offres locales, le scan en boutique, tes points fidélité…</p>
    <a href="${DEEP_LINK}" class="cta-btn">Ouvrir dans l'app</a>
    <a href="${PLAY_STORE_URL}" id="btn-download" class="cta-btn-secondary">Télécharger</a>
  </div>
</main>
<footer>
  <p>© Lokalist · La fidélité locale réinventée</p>
  <p style="margin-top:6px;"><a href="${SITE_URL}">Retour à l'accueil</a> · <a href="${SITE_URL}/contact">Contact</a> · <a href="${SITE_URL}/mentions-legales">Mentions légales</a></p>
</footer>
<script>
  // Route le bouton "Telecharger" vers le bon store selon l'OS
  (function() {
    var ua = navigator.userAgent || '';
    var isIOS = /iPhone|iPad|iPod/i.test(ua);
    var btn = document.getElementById('btn-download');
    if (btn && isIOS) {
      btn.href = '${APP_STORE_URL}';
    }
    // Android et desktop : on garde le lien Play Store par defaut.
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
    return pageNotFound('Offre introuvable');
  }
}

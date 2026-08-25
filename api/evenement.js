// ════════════════════════════════════════════════════════════════
//  api/evenement.js — Vercel Edge Function
//  Page HTML SSR pour /evenement/:id (Idées Sorties — événements grand public)
//  - Méta Open Graph dynamiques (preview WhatsApp/FB/Twitter)
//  - Bouton "Ajouter à mon agenda" (.ics) via /evenement/:id.ics
//  - Capture du code parrain ?ref= -> localStorage
//  - Deep link lokalist://evenement/:id
//  Table source : evenements (RLS lecture publique actif=true)
// ════════════════════════════════════════════════════════════════

export const config = { runtime: 'edge' };

const SUPABASE_URL  = 'https://kukathominhssogthplc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a2F0aG9taW5oc3NvZ3RocGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTU2NDMsImV4cCI6MjA5MDQzMTY0M30.nrfnhLWA_N-d5EA0qMvSTgSvbebbqHvWuCwk4PQDxcg';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=fr.lokalist.app';
const APP_STORE_URL  = 'https://apps.apple.com/fr/app/lokalist/id6778774911'; // à mettre à jour quand iOS publié
const SITE_URL       = 'https://lokalist.fr';

const TYPE_LABELS = {
  concert:    { label: 'Concert',    emoji: '🎵' },
  spectacle:  { label: 'Spectacle',  emoji: '🎭' },
  brocante:   { label: 'Brocante',   emoji: '🛍️' },
  marche:     { label: 'Marché',     emoji: '🛒' },
  sport:      { label: 'Sport',      emoji: '⚽' },
  culture:    { label: 'Culture',    emoji: '🎨' },
  festival:   { label: 'Festival',   emoji: '🎉' },
  atelier:    { label: 'Atelier',    emoji: '🛠️' },
  autre:      { label: 'Sortie',     emoji: '📌' },
};

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

const formatDate = (iso) => {
  if (!iso) return '';
  try {
    const txt = new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  } catch (e) {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toISOString().slice(0, 16).replace('T', ' ');
  }
};

// ── ICS (iCalendar) — pour "Ajouter à mon agenda" ───────────────
const icsEscape = (s) => String(s || '')
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,')
  .replace(/\r?\n/g, '\\n');

const icsDate = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
};

const buildIcs = (e, canonical) => {
  const start = icsDate(e.date_debut);
  let endIso = e.date_fin;
  if (!endIso && e.date_debut) {
    const d = new Date(e.date_debut);
    if (!isNaN(d)) { d.setHours(d.getHours() + 2); endIso = d.toISOString(); }
  }
  const end   = icsDate(endIso);
  const stamp = icsDate(new Date().toISOString());
  const lieu  = [e.lieu, e.ville].filter(Boolean).join(', ');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lokalist//Agenda//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:evt-pub-${e.id}@lokalist.fr`,
    `DTSTAMP:${stamp}`,
    start ? `DTSTART:${start}` : '',
    end ? `DTEND:${end}` : '',
    `SUMMARY:${icsEscape(e.titre || 'Sortie locale')}`,
    e.description ? `DESCRIPTION:${icsEscape(e.description)}` : '',
    lieu ? `LOCATION:${icsEscape(lieu)}` : '',
    `URL:${canonical}`,
    e.statut === 'annule' ? 'STATUS:CANCELLED' : 'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
};

const html404 = (msg) => `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Page introuvable — Lokalist</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;background:#F9F8F6;color:#1A1A2E;padding:40px 20px;text-align:center;line-height:1.6}h1{color:#1D9E75;font-size:28px;margin:24px 0 8px}a{color:#1D9E75;font-weight:600;text-decoration:none}</style>
</head><body>
<div style="font-size:64px">📅</div>
<h1>${escapeHtml(msg)}</h1>
<p style="color:#8A8FA8">Cette sortie n'existe plus ou a été retirée.</p>
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

    const apiUrl = `${SUPABASE_URL}/rest/v1/evenements?id=eq.${id}&select=*`;
    const r = await fetch(apiUrl, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
    });

    if (!r.ok) return pageNotFound("Erreur lors du chargement");
    const list = await r.json();
    if (!list?.length) return pageNotFound();
    const e = list[0];

    const typeInfo    = TYPE_LABELS[e.type] || TYPE_LABELS.autre;
    const titre       = e.titre || 'Sortie locale';
    const ville       = e.ville || '';
    const lieu        = e.lieu || '';
    const orga        = e.organisateur || '';
    const dateTxt     = formatDate(e.date_debut);
    const annule      = e.statut === 'annule';
    const reporte     = e.statut === 'reporte';
    const description = e.description || `${typeInfo.label}${ville ? ' à ' + ville : ''} — sur Lokalist, l'app de la vie locale`;
    const descShort   = (description.length > 160 ? description.slice(0, 157) + '...' : description);
    const photoMain   = e.image_url || `${SITE_URL}/images/og-default.jpg`;

    const canonical = `${SITE_URL}/evenement/${id}`;
    const deepLink  = `lokalist://evenement/${id}`;

    // Variante .ics : "Ajouter à mon agenda"
    if (url.searchParams.get('format') === 'ics') {
      return new Response(buildIcs(e, canonical), {
        status: 200,
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'attachment; filename="lokalist-evenement.ics"',
          'Cache-Control': 'public, s-maxage=300',
        },
      });
    }

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Event",
      "name": titre,
      "description": description,
      "image": photoMain,
      "url": canonical,
      ...(e.date_debut && { "startDate": e.date_debut }),
      ...(e.date_fin && { "endDate": e.date_fin }),
      ...(annule && { "eventStatus": "https://schema.org/EventCancelled" }),
      ...(reporte && { "eventStatus": "https://schema.org/EventPostponed" }),
      ...(orga && { "organizer": { "@type": "Organization", "name": orga } }),
      ...((lieu || ville) && {
        "location": { "@type": "Place", "name": lieu || ville, "address": { "@type": "PostalAddress", "addressLocality": ville, "addressCountry": "FR" } }
      }),
    };

    const body = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5"/>
<title>${escapeHtml(titre)}${ville ? ' — ' + escapeHtml(ville) : ''} — Lokalist</title>
<meta name="description" content="${escapeHtml(descShort)}"/>
<link rel="canonical" href="${canonical}"/>

<!-- Open Graph / Facebook / WhatsApp / LinkedIn -->
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="Lokalist"/>
<meta property="og:title" content="${escapeHtml(titre)}${ville ? ' — ' + escapeHtml(ville) : ''}"/>
<meta property="og:description" content="${escapeHtml(descShort)}"/>
<meta property="og:image" content="${escapeHtml(photoMain)}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:url" content="${canonical}"/>
<meta property="og:locale" content="fr_FR"/>

<!-- Twitter / X Card -->
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(titre)}${ville ? ' — ' + escapeHtml(ville) : ''}"/>
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
  .badge.alert { background:#FDECEC;color:#C0392B; }
  .badge.warn { background:#FDF3E3;color:#B9770E; }
  .head { padding:14px 20px 20px; }
  .titre { font-size:24px;font-weight:800;letter-spacing:-0.5px;line-height:1.25;margin-bottom:8px; }
  .orga { color:var(--muted);font-size:13px;margin-bottom:8px; }
  .ville { display:flex;align-items:center;gap:6px;color:var(--muted);font-size:14px;margin-bottom:6px; }
  .date { display:flex;align-items:center;gap:6px;color:var(--primary-d);font-size:14px;font-weight:600;margin-bottom:6px; }
  .tarif { font-size:14px;color:var(--accent);font-weight:700; }
  .ics-btn { display:inline-flex;align-items:center;gap:8px;margin-top:12px;background:var(--surface);border:1.5px solid var(--primary);color:var(--primary-d);padding:12px 18px;border-radius:14px;font-weight:700;font-size:14px;text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,0.04); }
  .section { background:var(--surface);margin-top:12px;border-radius:16px;padding:18px 20px;box-shadow:0 2px 8px rgba(0,0,0,0.04); }
  .section h2 { font-size:14px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px; }
  .section p { color:var(--text);font-size:14px;line-height:1.65;white-space:pre-line; }
  .info-row { display:flex;align-items:center;gap:8px;font-size:14px;color:var(--text);margin-top:8px; }
  .info-row a { color:var(--primary);text-decoration:none;font-weight:600; }
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

${ref ? `<div class="ref-banner">🎁 Invité par un ami — bienvenue sur Lokalist, l'app de la vie locale !</div>` : ''}

<header class="top-bar">
  <a href="${SITE_URL}">🏡 Lokalist</a>
  <a href="${deepLink}" class="btn-app">Voir dans l'app →</a>
</header>

<main class="container">
  <article class="hero">
    ${e.image_url
      ? `<img class="hero-img" src="${escapeHtml(photoMain)}" alt="${escapeHtml(titre)}" loading="eager"/>`
      : `<div class="hero-img-fallback">${typeInfo.emoji}</div>`
    }
    <div class="badges">
      <span class="badge">${typeInfo.emoji} ${typeInfo.label}</span>
      ${e.en_vedette ? `<span class="badge">⭐ À la une</span>` : ''}
      ${annule ? `<span class="badge alert">Annulé</span>` : ''}
      ${reporte ? `<span class="badge warn">Reporté</span>` : ''}
    </div>
    <div class="head">
      <h1 class="titre">${escapeHtml(titre)}</h1>
      ${orga ? `<div class="orga">Organisé par ${escapeHtml(orga)}</div>` : ''}
      ${dateTxt ? `<div class="date">🗓️ ${escapeHtml(dateTxt)}</div>` : ''}
      ${(lieu || ville) ? `<div class="ville">📍 ${escapeHtml([lieu, ville].filter(Boolean).join(', '))}</div>` : ''}
      <div class="tarif">${e.gratuit ? '🎟️ Gratuit' : (e.prix ? `🎟️ ${Number(e.prix).toFixed(2)} €` : '')}</div>
    </div>
  </article>

  ${!annule ? `<a href="${canonical}.ics" class="ics-btn">🗓️ Ajouter à mon agenda</a>` : ''}

  ${e.description ? `
  <section class="section">
    <h2>📄 À propos</h2>
    <p>${escapeHtml(e.description)}</p>
    ${e.lien_billetterie ? `<div class="info-row">🎫 <a href="${escapeHtml(e.lien_billetterie)}" target="_blank" rel="noopener">Billetterie / réservation</a></div>` : ''}
  </section>` : ''}

  <div class="cta-block">
    <h3>📅 Découvre les sorties près de ${ville ? escapeHtml(ville) : 'chez toi'}</h3>
    <p>Concerts, brocantes, festivals : retrouve toutes les idées sorties locales et soutiens le local avec Lokalist.</p>
    <a href="${deepLink}" class="cta-btn">Ouvrir dans l'app</a>
    <a href="${PLAY_STORE_URL}" id="btn-download" class="cta-btn-secondary">Télécharger</a>
  </div>
</main>

<footer>
  <p>© Lokalist · La vie locale réunie dans une app</p>
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
  // Capture du code parrain (?ref=LOK-XXXXXX)
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
    console.error('[evenement edge]', e);
    return pageNotFound('Erreur serveur');
  }
}

// ════════════════════════════════════════════════════════════════
//  api/villes.js — Vercel Edge Function  [villes-hub-v1]
//  Hub /villes : liste toutes les communes couvertes (>=1 acteur actif).
//  Porte d'entrée + maillage interne SEO.
// ════════════════════════════════════════════════════════════════
export const config = { runtime: 'edge' };

const SUPABASE_URL   = 'https://kukathominhssogthplc.supabase.co';
const SUPABASE_ANON  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a2F0aG9taW5oc3NvZ3RocGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTU2NDMsImV4cCI6MjA5MDQzMTY0M30.nrfnhLWA_N-d5EA0qMvSTgSvbebbqHvWuCwk4PQDxcg';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=fr.lokalist.app';
const APP_STORE_URL  = 'https://apps.apple.com/app/lokalist';
const SITE_URL       = 'https://lokalist.fr';
const FB_URL         = 'https://www.facebook.com/profile.php?id=61577501867273';
const IG_URL         = 'https://www.instagram.com/lokalist.fr/';

const escapeHtml = (str) => !str ? '' : String(str)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const slugify = (s) => String(s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const sbHeaders = { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` };
async function sb(q) {
  try { const r = await fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: sbHeaders }); return r.ok ? await r.json() : []; }
  catch (e) { console.error('[villes sb]', e); return []; }
}

async function listVilles() {
  const [c, a, co, ag, m] = await Promise.all([
    sb('commercants?select=ville&statut=eq.actif'),
    sb('artisans?select=ville&statut=eq.actif&suspendu_plainte=eq.false'),
    sb('courtiers_immo?select=ville&actif=eq.true'),
    sb('agences_immo?select=communes&actif=eq.true'),
    sb('mairies_partenaires?select=ville&statut=eq.actif'),
  ]);
  const map = new Map();
  const add = (nom) => {
    if (!nom) return; const sl = slugify(nom); if (!sl) return;
    const e = map.get(sl) || { nom: String(nom).trim(), count: 0, mairie: false };
    e.count++; map.set(sl, e);
  };
  c.forEach((x) => add(x.ville));
  a.forEach((x) => add(x.ville));
  co.forEach((x) => add(x.ville));
  ag.forEach((x) => (x.communes || []).forEach((v) => add(v)));
  m.forEach((x) => { add(x.ville); const sl = slugify(x.ville); const e = map.get(sl); if (e) e.mairie = true; });
  return [...map.entries()].map(([slug, v]) => ({ slug, ...v }))
    .sort((p, q) => q.count - p.count || p.nom.localeCompare(q.nom, 'fr'));
}

export default async function handler() {
  try {
    const villes = await listVilles();
    const canonical = `${SITE_URL}/villes`;
    const title = 'Toutes les villes — Lokalist';
    const desc  = `Lokalist couvre ${villes.length} commune${villes.length > 1 ? 's' : ''}. Retrouvez les commerçants, artisans et services de proximité près de chez vous.`;

    const cards = villes.map((v) => `<a class="vcard" href="/villes/${v.slug}">
        <div class="vcard-name">${escapeHtml(v.nom)}</div>
        <div class="vcard-meta">${v.mairie ? '🏛️ ' : ''}${v.count} acteur${v.count > 1 ? 's' : ''}</div>
      </a>`).join('');

    const empty = `<p style="color:var(--muted);font-size:15px;margin-top:20px">Les premières communes arrivent bientôt. Vous êtes une mairie ? <a href="${SITE_URL}/mairies" style="color:var(--primary);font-weight:700">Rejoignez Lokalist</a>.</p>`;

    const jsonLd = {
      "@context": "https://schema.org", "@type": "CollectionPage",
      "name": title, "description": desc, "url": canonical,
      ...(villes.length ? { "mainEntity": { "@type": "ItemList", "numberOfItems": villes.length,
        "itemListElement": villes.map((v, i) => ({ "@type": "ListItem", "position": i + 1, "name": v.nom, "url": `${SITE_URL}/villes/${v.slug}` })) } } : {}),
    };

    const body = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5"/>
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}"/>
<link rel="canonical" href="${canonical}"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="Lokalist"/>
<meta property="og:title" content="${escapeHtml(title)}"/>
<meta property="og:description" content="${escapeHtml(desc)}"/>
<meta property="og:image" content="${SITE_URL}/og-lokalist.png"/>
<meta property="og:url" content="${canonical}"/>
<meta property="og:locale" content="fr_FR"/>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png"/>
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png"/>
<link rel="icon" href="/favicon.ico" sizes="any"/>
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&display=swap" rel="stylesheet">
<style>
  :root { --primary:#1D9E75;--primary-d:#0F6E56;--primary-l:#E8F8F2;--accent:#EF9F27;--bg:#F9F8F6;--surface:#FFF;--border:#ECEFEC;--text:#15231D;--muted:#7C8A83;--disp:'Bricolage Grotesque',system-ui,sans-serif; }
  * { box-sizing:border-box;margin:0;padding:0; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.55;-webkit-font-smoothing:antialiased; }
  a { color:inherit;text-decoration:none; }
  .wrap { max-width:1120px;margin:0 auto;padding:0 22px; }
  .top-bar { position:sticky;top:0;z-index:50;background:rgba(255,255,255,.86);backdrop-filter:saturate(180%) blur(12px);border-bottom:1px solid var(--border); }
  .top-inner { max-width:1120px;margin:0 auto;padding:11px 22px;display:flex;align-items:center;justify-content:space-between; }
  .brand { display:flex;align-items:center;gap:10px;font-family:var(--disp);font-weight:800;font-size:22px;letter-spacing:-0.6px; }
  .brand img { width:30px;height:30px;border-radius:8px;display:block; }
  .brand .n1 { color:var(--primary-d); } .brand .n2 { color:var(--accent); }
  .btn-app { background:var(--primary);padding:9px 17px;border-radius:22px;font-size:13.5px;font-weight:700;color:#fff;box-shadow:0 4px 14px rgba(29,158,117,.28); }
  .hero { position:relative;overflow:hidden;background:linear-gradient(135deg,#0F6E56 0%,#1D9E75 62%,#25b184 100%);color:#fff; }
  .hero::before { content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px);background-size:44px 44px;mask-image:radial-gradient(ellipse at 30% 0%,#000 30%,transparent 75%); }
  .hero-inner { position:relative;padding-top:34px;padding-bottom:40px; } /* LOKALIST_HERO_GUTTER_V1 */
  .crumb { font-size:13px;color:rgba(255,255,255,.75);margin-bottom:18px; }
  .crumb a { color:rgba(255,255,255,.75); }
  .hero h1 { font-family:var(--disp);font-weight:800;font-size:clamp(30px,5vw,52px);line-height:1.04;letter-spacing:-1.3px; }
  .hero .lead { font-size:clamp(15px,1.6vw,18px);color:rgba(255,255,255,.92);margin-top:12px;max-width:620px;line-height:1.6; }
  main.wrap { padding-top:30px;padding-bottom:20px; }
  .vgrid { display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px; }
  .vcard { background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px 18px;box-shadow:0 2px 10px rgba(16,40,32,.05);transition:transform .16s,box-shadow .16s,border-color .16s; }
  .vcard:hover { transform:translateY(-4px);box-shadow:0 14px 30px rgba(16,40,32,.12);border-color:var(--primary-l); }
  .vcard-name { font-family:var(--disp);font-size:18px;font-weight:800;letter-spacing:-.4px; }
  .vcard-meta { color:var(--muted);font-size:13px;margin-top:5px; }
  .cta-block { background:linear-gradient(135deg,#0F6E56,#1D9E75);color:#fff;margin:40px 0 34px;border-radius:22px;padding:36px 24px;text-align:center;box-shadow:0 14px 34px rgba(29,158,117,.28); }
  .cta-block h3 { font-family:var(--disp);font-size:clamp(20px,2.6vw,26px);font-weight:800;margin-bottom:8px;letter-spacing:-.5px; }
  .cta-block p { font-size:14.5px;opacity:.94;margin:0 auto 20px;max-width:500px; }
  .cta-btn { display:inline-block;background:#fff;color:var(--primary-d);padding:15px 30px;border-radius:14px;font-weight:800;font-size:15px;box-shadow:0 6px 18px rgba(0,0,0,.15); }
  .socials { display:flex;gap:12px;justify-content:center;margin-bottom:16px; }
  .socials a { width:40px;height:40px;border-radius:50%;background:var(--primary-l);color:var(--primary-d);display:flex;align-items:center;justify-content:center;transition:background .15s,transform .15s,color .15s; }
  .socials a:hover { background:var(--primary);color:#fff;transform:translateY(-2px); }
  .socials svg { width:19px;height:19px; }
  footer { text-align:center;padding:26px 20px 48px;color:var(--muted);font-size:12.5px; }
  footer a { color:var(--primary);font-weight:600; }
  @media (max-width:640px){ .vgrid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:11px;} .hero-inner{padding-top:24px;padding-bottom:32px;} }
</style>
</head>
<body>
<header class="top-bar">
  <div class="top-inner">
    <a class="brand" href="${SITE_URL}"><picture><source srcset="/logo.webp" type="image/webp"><img src="/logo.png" alt="Lokalist" width="30" height="30"/></picture><span><span class="n1">Lokal</span><span class="n2">ist</span></span></a>
    <a class="btn-app" href="${PLAY_STORE_URL}" id="btn-download">Télécharger l'app</a>
  </div>
</header>
<section class="hero">
  <div class="wrap hero-inner">
    <nav class="crumb"><a href="${SITE_URL}">Accueil</a> › Villes</nav>
    <h1>Toutes les villes Lokalist</h1>
    <p class="lead">${villes.length ? `Lokalist fait vivre l'économie locale de ${villes.length} commune${villes.length > 1 ? 's' : ''}. Choisissez la vôtre pour découvrir ses commerçants, artisans et services.` : `Lokalist arrive dans votre commune.`}</p>
  </div>
</section>
<main class="wrap">
  ${villes.length ? `<div class="vgrid">${cards}</div>` : empty}
  <div class="cta-block">
    <h3>Votre commune n'y est pas encore ?</h3>
    <p>Faites venir Lokalist chez vous : commerçants, artisans et mairie réunis dans une seule app locale.</p>
    <a href="${PLAY_STORE_URL}" class="cta-btn" id="btn-download-2">Télécharger l'app</a>
  </div>
</main>
<footer>
  <div class="socials">
    <a href="${FB_URL}" target="_blank" rel="noopener" aria-label="Facebook"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.8 3.7-3.8 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z"/></svg></a>
    <a href="${IG_URL}" target="_blank" rel="noopener" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></svg></a>
  </div>
  <p>© Lokalist · La fidélité locale réinventée</p>
  <p style="margin-top:6px;"><a href="${SITE_URL}">Accueil</a> · <a href="${SITE_URL}/contact">Contact</a> · <a href="${SITE_URL}/mentions-legales">Mentions légales</a></p>
</footer>
<script>
  (function(){ var ua=navigator.userAgent||''; if(/iPhone|iPad|iPod/i.test(ua)){ ['btn-download','btn-download-2'].forEach(function(id){ var b=document.getElementById(id); if(b) b.href='${APP_STORE_URL}'; }); } })();
</script>
</body>
</html>`;

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800',
        'X-Robots-Tag': 'index, follow',
      },
    });
  } catch (e) {
    console.error('[villes hub]', e);
    return new Response('Erreur serveur', { status: 500 });
  }
}

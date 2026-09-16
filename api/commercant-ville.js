//  api/commercant-ville.js  [commercant-ville-page-v1]
//  Page HTML SSR indexable pour /commercants/:categorie/:ville
//  Liste les commercants d'une categorie donnee dans une commune donnee.
//  Contenu unique (vrais commercants de la base) -> pas de "thin content".
//  Si 0 commercant : page renvoyee en noindex (jamais declaree a Google).
//  Miroir de api/artisan-ville.js. Difference : la categorie commercant est un
//  TEXTE LIBRE (champ `categorie`), pas une table de reference. On resout donc
//  la categorie en slugifiant le champ des vrais commercants de la commune.

export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://kukathominhssogthplc.supabase.co';
const SUPABASE_ANON  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a2F0aG9taW5oc3NvZ3RocGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTU2NDMsImV4cCI6MjA5MDQzMTY0M30.nrfnhLWA_N-d5EA0qMvSTgSvbebbqHvWuCwk4PQDxcg';
const SITE_URL = 'https://lokalist.fr';

const sbHeaders = { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` };

const slugify = (s) => String(s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const escapeHtml = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Emoji par categorie de commerce (repris de api/ville.js pour coherence visuelle).
const EMOJI_COMMERCE = {
  coiffeur:'\u2702\uFE0F', coiffure:'\u2702\uFE0F', barbier:'\u2702\uFE0F',
  institut:'\uD83D\uDC85', beaute:'\uD83D\uDC85', esthetique:'\uD83D\uDC85', ongle:'\uD83D\uDC85',
  restaurant:'\uD83C\uDF7D\uFE0F', pizzeria:'\uD83C\uDF55', boulangerie:'\uD83E\uDD56', patisserie:'\uD83E\uDDC1',
  boucherie:'\uD83E\uDD69', primeur:'\uD83E\uDD6C', fleuriste:'\uD83D\uDC90', bijouterie:'\uD83D\uDC8D',
  chaussure:'\uD83D\uDC5F', vetement:'\uD83D\uDC57', mode:'\uD83D\uDC57', tabac:'\uD83D\uDEAC', presse:'\uD83D\uDCF0',
  garage:'\uD83D\uDD27', auto:'\uD83D\uDE97', immobilier:'\uD83C\uDFE0', banque:'\uD83C\uDFE6',
  assurance:'\uD83D\uDEE1\uFE0F', tatouage:'\uD83D\uDD8B\uFE0F', bar:'\uD83C\uDF78', cafe:'\u2615'
};
function emojiCommerce(cat) {
  const s = slugify(cat);
  for (const k in EMOJI_COMMERCE) { if (s.indexOf(k) !== -1) return EMOJI_COMMERCE[k]; }
  return '\uD83C\uDFEA'; // 🏪
}

async function sb(pathAndQuery) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, { headers: sbHeaders });
  if (!r.ok) return [];
  return r.json();
}

async function resolveCommune(wantedSlug) {
  const loose = '%' + wantedSlug.split('-').filter(Boolean).join('%') + '%';
  let rows = await sb(`communes_ref?select=nom,code_postal,code_insee,lat,lng&nom=ilike.${encodeURIComponent(loose)}&limit=200`);
  let hit = rows.find((c) => slugify(c.nom) === wantedSlug);
  if (hit) return hit;
  rows = await sb('communes_ref?select=nom,code_postal,code_insee,lat,lng&limit=40000');
  return rows.find((c) => slugify(c.nom) === wantedSlug) || null;
}

function page({ head, robots, bodyInner }) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5"/>
${robots ? `<meta name="robots" content="${robots}"/>` : ''}
${head}
<link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'DM Sans',system-ui,sans-serif;background:#F7F8F4;color:#1A2E26;line-height:1.6}
  .wrap{max-width:960px;margin:0 auto;padding:28px 20px 80px}
  a{color:inherit}
  .brand{display:inline-block;text-decoration:none;font-weight:800;font-size:22px;letter-spacing:-.5px;margin-bottom:24px}
  .brand .lk-g{color:#1D9E75}
  .brand .lk-o{color:#EF9F27}
  h1{font-size:clamp(24px,4vw,34px);font-weight:800;color:#0B1612;line-height:1.15;margin-bottom:10px}
  .sub{font-size:15.5px;color:#5C7268;margin-bottom:22px;max-width:640px}
  .cta{display:inline-block;background:#1D9E75;color:#fff;font-weight:700;padding:13px 22px;border-radius:12px;text-decoration:none;margin-bottom:30px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;margin-bottom:34px}
  .card{background:#fff;border:1px solid #D8E8E2;border-radius:16px;padding:16px;text-decoration:none;display:block}
  .card .n{font-weight:700;color:#0B1612;margin-bottom:4px}
  .card .m{font-size:13px;color:#5C7268}
  .note{display:inline-block;font-size:12px;font-weight:700;color:#0F6E56;background:#E1F5EE;padding:2px 8px;border-radius:20px;margin-top:8px}
  h2{font-size:20px;font-weight:800;color:#0B1612;margin:28px 0 14px}
  .chips{display:flex;flex-wrap:wrap;gap:8px}
  .chip{background:#fff;border:1px solid #D8E8E2;border-radius:20px;padding:6px 13px;font-size:13px;text-decoration:none;color:#1A2E26}
  .empty{background:#fff;border:1px solid #D8E8E2;border-radius:16px;padding:26px;text-align:center;color:#5C7268}
</style>
</head>
<body>
<div class="wrap">
<a class="brand" href="${SITE_URL}"><span class="lk-g">lokal</span><span class="lk-o">ist</span></a>
${bodyInner}
</div>
</body>
</html>`;
}

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const catSlug = slugify(url.searchParams.get('categorie') || '');
    const villeSlug = slugify(url.searchParams.get('ville') || '');
    if (!catSlug || !villeSlug) {
      return new Response(page({ head: '<title>Page introuvable</title>', robots: 'noindex', bodyInner: '<h1>Page introuvable</h1>' }), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }

    const commune = await resolveCommune(villeSlug);
    if (!commune) {
      return new Response(page({ head: '<title>Commune introuvable</title>', robots: 'noindex', bodyInner: '<h1>Commune introuvable</h1>' }), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }

    const ville = commune.nom;
    const cp = commune.code_postal || '';
    const vEnc = encodeURIComponent(ville);
    const canonical = `${SITE_URL}/commercants/${catSlug}/${villeSlug}`;

    // Tous les commercants actifs de la commune, puis filtrage par categorie (texte libre -> slug)
    const tous = await sb(`commercants?select=id,nom,ville,logo_url,photo_url,note_moyenne,nb_avis,categorie&statut=eq.actif&demo=is.false&ville=ilike.${vEnc}&order=note_moyenne.desc.nullslast`);
    const commercants = (tous || []).filter((c) => slugify(c.categorie || '') === catSlug);

    // Libelle d'affichage de la categorie : le libelle brut le plus frequent parmi les commercants trouves.
    let catNom = '';
    if (commercants.length) {
      const freq = {};
      commercants.forEach((c) => { const k = String(c.categorie || '').trim(); if (k) freq[k] = (freq[k] || 0) + 1; });
      catNom = Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0] || '';
    }
    if (!catNom) catNom = catSlug.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

    const emoji = emojiCommerce(catNom);
    const cpTxt = cp ? ` (${cp})` : '';
    const vide = !commercants.length;
    const robots = vide ? 'noindex,follow' : null;

    const title = `${catNom} \u00e0 ${ville}${cpTxt} \u2014 commerces locaux | Lokalist`;
    const desc = vide
      ? `Vous cherchez ${catNom.toLowerCase()} \u00e0 ${ville} ? D\u00e9couvrez les commerces locaux sur Lokalist et profitez de la fid\u00e9lit\u00e9 et des bons plans pr\u00e8s de chez vous.`
      : `${commercants.length} commerce${commercants.length > 1 ? 's' : ''} en ${catNom.toLowerCase()} \u00e0 ${ville}${cpTxt}. Adresses, avis et bons plans des commerces locaux sur Lokalist.`;

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": title,
      "description": desc,
      "url": canonical,
      "about": { "@type": "Thing", "name": `${catNom} \u00e0 ${ville}` },
      ...(commercants.length ? {
        "mainEntity": {
          "@type": "ItemList", "numberOfItems": commercants.length,
          "itemListElement": commercants.map((c, i) => ({
            "@type": "ListItem", "position": i + 1,
            "item": { "@type": "Store", "name": c.nom, "url": `${SITE_URL}/pro/${c.id}`, "address": { "@type": "PostalAddress", "addressLocality": ville, ...(cp ? { "postalCode": cp } : {}), "addressCountry": "FR" } }
          }))
        }
      } : {})
    };

    const head = `<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}"/>
<link rel="canonical" href="${canonical}"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="Lokalist"/>
<meta property="og:title" content="${escapeHtml(title)}"/>
<meta property="og:description" content="${escapeHtml(desc)}"/>
<meta property="og:url" content="${canonical}"/>
<meta property="og:image" content="${SITE_URL}/og-lokalist.png"/>
<meta name="twitter:card" content="summary_large_image"/>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;

    const cards = commercants.map((c) => {
      const note = (c.note_moyenne && c.nb_avis) ? `<span class="note">\u2605 ${Number(c.note_moyenne).toFixed(1)} (${c.nb_avis})</span>` : '';
      return `<a class="card" href="${SITE_URL}/pro/${c.id}">
  <div class="n">${escapeHtml(c.nom)}</div>
  <div class="m">${emoji} ${escapeHtml(catNom)} \u00b7 ${escapeHtml(ville)}</div>
  ${note}
</a>`;
    }).join('');

    const bodyInner = `
<h1>${emoji} ${escapeHtml(catNom)} \u00e0 ${escapeHtml(ville)}${escapeHtml(cpTxt)}</h1>
<p class="sub">${vide
  ? `Aucun commerce en ${escapeHtml(catNom.toLowerCase())} n'est encore r\u00e9f\u00e9renc\u00e9 \u00e0 ${escapeHtml(ville)}. Installez Lokalist pour d\u00e9couvrir les commerces locaux d\u00e8s qu'ils rejoignent.`
  : `D\u00e9couvrez ${commercants.length} commerce${commercants.length > 1 ? 's' : ''} en ${escapeHtml(catNom.toLowerCase())} \u00e0 ${escapeHtml(ville)}, cumulez des points de fid\u00e9lit\u00e9 et profitez des bons plans.`}</p>
<a class="cta" href="${SITE_URL}/app">T\u00e9l\u00e9charger l'application</a>
${vide
  ? `<div class="empty">Soyez averti d\u00e8s que des commerces de ${escapeHtml(ville)} rejoignent Lokalist.</div>`
  : `<div class="grid">${cards}</div>`}
<h2>Voir aussi \u00e0 ${escapeHtml(ville)}</h2>
<div class="chips">
  <a class="chip" href="${SITE_URL}/villes/${villeSlug}">Tous les commerces de ${escapeHtml(ville)}</a>
  <a class="chip" href="${SITE_URL}/commercants">Inscrire mon commerce</a>
</div>`;

    return new Response(page({ head, robots, bodyInner }), {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=3600' }
    });
  } catch (e) {
    return new Response('Erreur: ' + (e && e.message), { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
}

// api/og-post.js
// ────────────────────────────────────────────────────────────────────────────
//  Generateur d'IMAGE DE POST reseaux Lokalist (Instagram / Facebook / LinkedIn)
//  Calque sur og-hebergement.js : @vercel/og (satori), hyperscript h(),
//  polices locales _fonts/, logo lokalist.fr/logo.png, runtime Node.
//
//  3 formats via ?format= :
//    carre   -> 1080x1080  (Instagram feed + Facebook)      [defaut]
//    paysage -> 1200x630   (LinkedIn + Facebook lien)
//    story   -> 1080x1920  (Instagram / Facebook stories)
//
//  Parametres URL :
//    ?titre=...      (obligatoire) le gros titre du visuel
//    ?ville=...      (optionnel)   affiche une pastille localisee
//    ?sous=...       (optionnel)   petite ligne sous le titre (offre, date...)
//    ?photo=URL      (optionnel)   image de fond ; sinon degrade vert de marque
//    ?format=...     (optionnel)   carre | paysage | story
//
//  Exemples a tester dans le navigateur une fois deploye :
//    https://lokalist.fr/api/og-post?titre=Nouveau%20boulanger%20a%20Fecamp&ville=Fecamp
//    https://lokalist.fr/api/og-post?titre=Marche%20de%20Noel&ville=Yvetot&sous=Samedi%2014%20decembre&format=story
// ────────────────────────────────────────────────────────────────────────────

import { ImageResponse } from '@vercel/og';
import fs from 'fs';

// ── Charte Lokalist (identique a og-hebergement) ──
const P = '#1D9E75', PD = '#0F6E56', ACC = '#EF9F27';
const SITE_URL = 'https://lokalist.fr';
const OG_FALLBACK = `${SITE_URL}/og-lokalist.png`;

// ── Formats supportes ──
const FORMATS = {
  carre:   { w: 1080, h: 1080 },
  paysage: { w: 1200, h: 630 },
  story:   { w: 1080, h: 1920 },
};

// ── hyperscript satori (identique a og-hebergement) ──
const h = (t, p, ...c) => ({ type: t, props: { ...p, children: c.length === 0 ? undefined : (c.length === 1 ? c[0] : c) } });

// ── polices (memoise) ──
let _fonts = null;
function getFonts() {
  if (_fonts) return _fonts;
  _fonts = [
    { name: 'Syne',    data: fs.readFileSync(new URL('./_fonts/Syne-800.ttf',   import.meta.url)), weight: 800, style: 'normal' },
    { name: 'DM Sans', data: fs.readFileSync(new URL('./_fonts/DMSans-400.ttf', import.meta.url)), weight: 400, style: 'normal' },
    { name: 'DM Sans', data: fs.readFileSync(new URL('./_fonts/DMSans-600.ttf', import.meta.url)), weight: 600, style: 'normal' },
  ];
  return _fonts;
}

// ── fetch binaire + data-url (identique a og-hebergement) ──
async function fetchBytes(url, maxBytes) {
  try {
    const r = await fetch(url); if (!r.ok) return null;
    const ab = await r.arrayBuffer();
    if (maxBytes && ab.byteLength > maxBytes) return null;
    return { buf: Buffer.from(ab), ct: r.headers.get('content-type') || '' };
  } catch { return null; }
}
const toDataUrl = (o, fb) => o ? `data:${o.ct || fb};base64,${o.buf.toString('base64')}` : null;

function pngSize(buf) { try { if (buf.length < 24 || buf[0] !== 0x89 || buf[1] !== 0x50) return null; return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }; } catch { return null; } }

// ── logo (memoise) ──
let _logo = null, _logoTried = false;
async function getLogo() {
  if (_logoTried) return _logo; _logoTried = true;
  const o = await fetchBytes(`${SITE_URL}/logo.png`, 2_000_000);
  if (o) { const s = pngSize(o.buf); _logo = { dataUrl: toDataUrl(o, 'image/png'), w: s ? s.w : 0, h: s ? s.h : 0 }; }
  return _logo;
}

// ── pastille de marque (logo ou repli lettre L) ──
function brandPill(logo, scale = 1) {
  const hasLogo = logo && logo.dataUrl && logo.w > 0 && logo.h > 0;
  const wide = hasLogo && (logo.w / logo.h) > 1.9;
  const lh = Math.round(42 * scale);

  const mark = hasLogo
    ? h('img', { src: logo.dataUrl, style: { height: lh + 'px', width: Math.round(lh * logo.w / logo.h) + 'px', objectFit: 'contain' } })
    : h('div', { style: { display: 'flex', width: Math.round(38 * scale) + 'px', height: Math.round(38 * scale) + 'px', borderRadius: '10px', background: PD, alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne', fontWeight: 800, fontSize: Math.round(23 * scale) + 'px', color: '#fff' } }, 'L');

  const wordmark = h('div', { style: { display: 'flex', fontFamily: 'Syne', fontWeight: 800, fontSize: Math.round(28 * scale) + 'px', color: PD } }, 'Lokalist');

  const children = wide ? [mark] : [mark, wordmark];
  const padRight = wide ? '13px' : Math.round(18 * scale) + 'px';

  return h('div', { style: { display: 'flex', alignItems: 'center', gap: Math.round(11 * scale) + 'px', background: 'rgba(255,255,255,0.96)', borderRadius: '999px', padding: `${Math.round(10 * scale)}px ${padRight} ${Math.round(10 * scale)}px ${Math.round(13 * scale)}px` } }, ...children);
}

// ── icone pin (localisation) ──
const IC_PIN = h('svg', { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none' },
  h('path', { d: 'M12 2C7.6 2 4 5.6 4 10c0 5.4 8 12 8 12s8-6.6 8-12c0-4.4-3.6-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z', fill: '#fff' }));

// ── pastille ville ──
function villePill(ville, scale = 1) {
  return h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', background: ACC, borderRadius: '999px', padding: `${Math.round(9 * scale)}px ${Math.round(18 * scale)}px`, fontFamily: 'DM Sans', fontWeight: 600, fontSize: Math.round(26 * scale) + 'px', color: '#fff' } },
    IC_PIN, ville);
}

// ── taille de titre auto selon longueur + format ──
function titleSize(txt, base) {
  const n = (txt || '').length;
  if (n > 60) return Math.round(base * 0.66);
  if (n > 40) return Math.round(base * 0.80);
  if (n > 24) return Math.round(base * 0.90);
  return base;
}

// ── construction de la carte pour un format donne ──
function buildCard({ titre, ville, sous, photoDataUrl, logo, format }) {
  const { w, h: hh } = FORMATS[format];
  const isStory = format === 'story';
  const isPaysage = format === 'paysage';

  // echelles selon format
  const scale = isPaysage ? 1 : (isStory ? 1.25 : 1.15);
  const pad = isPaysage ? 64 : (isStory ? 90 : 80);
  const titleBase = isPaysage ? 74 : (isStory ? 108 : 96);
  const tSize = titleSize(titre, titleBase);

  // fond : photo ou degrade de marque
  const fond = photoDataUrl
    ? h('img', { src: photoDataUrl, style: { position: 'absolute', top: 0, left: 0, width: w + 'px', height: hh + 'px', objectFit: 'cover' } })
    : h('div', { style: { position: 'absolute', top: 0, left: 0, width: w + 'px', height: hh + 'px', display: 'flex', background: `linear-gradient(135deg, ${P} 0%, ${PD} 100%)` } });

  // voile degrade pour lisibilite du texte (bas de l'image)
  const voile = h('div', { style: { position: 'absolute', top: 0, left: 0, width: w + 'px', height: hh + 'px', display: 'flex', background: 'linear-gradient(180deg, rgba(4,20,17,0.15) 0%, rgba(4,20,17,0.0) 28%, rgba(4,20,17,0.45) 62%, rgba(4,20,17,0.90) 100%)' } });

  // bloc bas : ville + titre + sous-texte
  const blocBas = [];
  if (ville) blocBas.push(h('div', { style: { display: 'flex', marginBottom: Math.round(20 * scale) + 'px' } }, villePill(ville, scale)));
  blocBas.push(h('div', { style: { display: 'flex', fontFamily: 'Syne', fontWeight: 800, color: '#fff', fontSize: tSize + 'px', lineHeight: 1.04, letterSpacing: '-1px', maxWidth: (w - pad * 2) + 'px', textShadow: '0 3px 20px rgba(0,0,0,0.45)' } }, titre));
  if (sous) blocBas.push(h('div', { style: { display: 'flex', marginTop: Math.round(18 * scale) + 'px', fontFamily: 'DM Sans', fontWeight: 600, color: 'rgba(255,255,255,0.92)', fontSize: Math.round(34 * scale) + 'px', maxWidth: (w - pad * 2) + 'px', textShadow: '0 2px 12px rgba(0,0,0,0.4)' } }, sous));

  return h('div', { style: { width: w + 'px', height: hh + 'px', display: 'flex', position: 'relative', fontFamily: 'DM Sans' } },
    fond,
    voile,
    // logo en haut a gauche
    h('div', { style: { position: 'absolute', top: pad + 'px', left: pad + 'px', display: 'flex' } }, brandPill(logo, scale)),
    // bloc texte en bas a gauche
    h('div', { style: { position: 'absolute', left: pad + 'px', bottom: pad + 'px', right: pad + 'px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' } }, ...blocBas),
  );
}

// ── repli si erreur : redirige vers l'image OG statique ──
function redirectFallback(res) {
  res.statusCode = 302;
  res.setHeader('Location', OG_FALLBACK);
  return res.end();
}

// ── handler ──
export default async function handler(req, res) {
  try {
    const q = req.query || {};
    const titre = (q.titre || '').toString().trim();
    if (!titre) { res.statusCode = 400; res.setHeader('Content-Type', 'text/plain; charset=utf-8'); return res.end('Parametre "titre" requis'); }

    const ville = (q.ville || '').toString().trim();
    const sous  = (q.sous  || '').toString().trim();
    let format  = (q.format || 'carre').toString().trim().toLowerCase();
    if (!FORMATS[format]) format = 'carre';

    // photo de fond optionnelle (doit etre une URL https)
    let photoDataUrl = null;
    const photo = (q.photo || '').toString().trim();
    if (photo && /^https:\/\//i.test(photo)) {
      const o = await fetchBytes(photo, 8_000_000);
      if (o) photoDataUrl = toDataUrl(o, 'image/jpeg');
    }

    const logo = await getLogo();
    const { w, h: hh } = FORMATS[format];
    const card = buildCard({ titre, ville, sous, photoDataUrl, logo, format });

    const img = new ImageResponse(card, { width: w, height: hh, fonts: getFonts() });
    const buf = Buffer.from(await img.arrayBuffer());
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return res.end(buf);
  } catch (e) {
    console.error('[og-post]', e);
    return redirectFallback(res);
  }
}

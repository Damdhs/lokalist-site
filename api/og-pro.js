// ════════════════════════════════════════════════════════════════
//  api/og-pro.js — Vercel Node Function
//  Carte OpenGraph brandee 1200x630 pour /pro/:id (commerce/resto/service/loisir)
//  Photo en fond + voile + type + nom + ville + note + logo Lokalist.
//  Repli sur og-lokalist.png si donnee/fetch KO. Fonts partagees (./_fonts/).
// ════════════════════════════════════════════════════════════════
import { ImageResponse } from '@vercel/og';
import fs from 'node:fs';

const SUPABASE_URL  = 'https://kukathominhssogthplc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a2F0aG9taW5oc3NvZ3RocGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTU2NDMsImV4cCI6MjA5MDQzMTY0M30.nrfnhLWA_N-d5EA0qMvSTgSvbebbqHvWuCwk4PQDxcg';
const SITE_URL = 'https://lokalist.fr';
const OG_FALLBACK = `${SITE_URL}/og-lokalist.png`;
const P = '#1D9E75', PD = '#0F6E56', ACC = '#EF9F27';

const TYPE_LABELS = {
  commercant: { label: 'Commerce',   tint: '#1D9E75' },
  restaurant: { label: 'Restaurant', tint: '#F97316' },
  service:    { label: 'Service',    tint: '#6366F1' },
  loisir:     { label: 'Loisir',     tint: '#14B8A6' },
};

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

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const extractId = (raw) => { const m = String(raw || '').match(UUID_RE); return m ? m[0].toLowerCase() : ''; };

async function fetchBytes(url, maxBytes) {
  try { const r = await fetch(url); if (!r.ok) return null; const ab = await r.arrayBuffer();
    if (maxBytes && ab.byteLength > maxBytes) return null;
    return { buf: Buffer.from(ab), ct: r.headers.get('content-type') || '' };
  } catch { return null; }
}
const toDataUrl = (o, fb) => o ? `data:${o.ct || fb};base64,${o.buf.toString('base64')}` : null;

let _logo = null, _logoTried = false;
async function getLogo() {
  if (_logoTried) return _logo; _logoTried = true;
  const o = await fetchBytes(`${SITE_URL}/logo.png`, 2_000_000);
  if (o) { const s = pngSize(o.buf); _logo = { dataUrl: toDataUrl(o, 'image/png'), w: s ? s.w : 0, h: s ? s.h : 0 }; }
  return _logo;
}
function pngSize(buf) { try { if (buf.length < 24 || buf[0] !== 0x89 || buf[1] !== 0x50) return null; return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }; } catch { return null; } }
function jpegSize(buf) {
  try {
    if (buf.length < 4 || buf[0] !== 0xFF || buf[1] !== 0xD8) return null;
    let o = 2;
    while (o + 9 < buf.length) {
      if (buf[o] !== 0xFF) { o++; continue; }
      const m = buf[o + 1];
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) { return { h: buf.readUInt16BE(o + 5), w: buf.readUInt16BE(o + 7) }; }
      if (m === 0xD8 || m === 0xD9 || (m >= 0xD0 && m <= 0xD7)) { o += 2; continue; }
      const len = buf.readUInt16BE(o + 2);
      if (len < 2) break;
      o += 2 + len;
    }
  } catch (e) {}
  return null;
}
function imgSize(buf) { return pngSize(buf) || jpegSize(buf); }
// LKL_OGPRO_QUALITY_V1

const h = (t, p, ...c) => ({ type: t, props: { ...p, children: c.length === 0 ? undefined : (c.length === 1 ? c[0] : c) } });
const svg = (w, hh, v, ...pa) => h('svg', { width: w, height: hh, viewBox: '0 0 ' + v + ' ' + v, fill: 'none' }, ...pa);
const p_ = (d, o = {}) => h('path', { d, ...o });
const IC_CHECK = svg(22, 22, 24, p_('M20 6L9 17l-5-5', { stroke: '#fff', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' }));
const IC_PIN   = svg(26, 26, 24, p_('M12 2C7.6 2 4 5.6 4 10c0 5.4 8 12 8 12s8-6.6 8-12c0-4.4-3.6-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z', { fill: '#fff' }));
const IC_STAR  = svg(28, 28, 24, p_('M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', { fill: '#FAC775' }));

function brandPill(logo) {
  const hasLogo = logo && logo.dataUrl && logo.w > 0 && logo.h > 0;
  const wide = hasLogo && (logo.w / logo.h) > 1.9;
  const mark = hasLogo
    ? h('img', { src: logo.dataUrl, style: { height: '42px', width: Math.round(42 * logo.w / logo.h) + 'px', objectFit: 'contain' } })
    : h('div', { style: { display: 'flex', width: '38px', height: '38px', borderRadius: '10px', background: PD, alignItems: 'center', justifyContent: 'center', fontFamily: 'Syne', fontWeight: 800, fontSize: '23px', color: '#fff' } }, 'L');
  const wordmark = h('div', { style: { display: 'flex', fontFamily: 'Syne', fontWeight: 800, fontSize: '28px' } },
    h('span', { style: { display: 'flex', color: PD } }, 'Lokal'), h('span', { style: { display: 'flex', color: ACC } }, 'ist'));
  const children = wide ? [mark] : [mark, wordmark];
  return h('div', { style: { display: 'flex', alignItems: 'center', gap: '11px', background: 'rgba(255,255,255,0.96)', borderRadius: '999px', padding: '10px ' + (wide ? '20px' : '24px') + ' 10px 13px' } }, ...children);
}

function buildCard({ nom, ville, typeLabel, categorie, note, photoDataUrl, logo, tint }) {
  const L = String(nom).length;
  const titleSize = L > 34 ? 44 : L > 26 ? 54 : L > 18 ? 62 : 72;
  const bg = photoDataUrl
    ? h('img', { src: photoDataUrl, style: { position: 'absolute', top: 0, left: 0, width: '1200px', height: '630px', objectFit: 'cover' } })
    : h('div', { style: { position: 'absolute', top: 0, left: 0, width: '1200px', height: '630px', display: 'flex', background: tint } });
  return h('div', { style: { width: '1200px', height: '630px', display: 'flex', position: 'relative', fontFamily: 'DM Sans' } },
    bg,
    h('div', { style: { position: 'absolute', top: 0, left: 0, width: '1200px', height: '630px', display: 'flex', background: 'linear-gradient(180deg, rgba(4,20,17,0.22) 0%, rgba(4,20,17,0.05) 24%, rgba(4,20,17,0.60) 60%, rgba(4,20,17,0.95) 100%)' } }),
    h('div', { style: { position: 'absolute', top: '40px', left: '48px', right: '48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
      brandPill(logo),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(29,158,117,0.94)', color: '#fff', borderRadius: '999px', padding: '10px 20px', fontFamily: 'Syne', fontWeight: 800, fontSize: '20px' } }, IC_CHECK, 'Vérifié')),
    h('div', { style: { position: 'absolute', left: '48px', right: '48px', bottom: '46px', display: 'flex', flexDirection: 'column' } },
      h('div', { style: { display: 'flex', gap: '8px' } },
        h('div', { style: { display: 'flex', background: 'rgba(255,255,255,0.20)', color: '#fff', border: '1px solid rgba(255,255,255,0.55)', borderRadius: '999px', padding: '6px 18px', fontSize: '22px', fontWeight: 600, marginBottom: '16px' } }, typeLabel),
        categorie ? h('div', { style: { display: 'flex', background: 'rgba(255,255,255,0.20)', color: '#fff', border: '1px solid rgba(255,255,255,0.55)', borderRadius: '999px', padding: '6px 18px', fontSize: '22px', fontWeight: 600, marginBottom: '16px' } }, categorie) : h('div', { style: { display: 'none' } })),
      h('div', { style: { display: 'flex', fontFamily: 'Syne', fontWeight: 800, color: '#fff', fontSize: titleSize + 'px', lineHeight: 1.03, letterSpacing: '-1px', maxWidth: '1104px', textShadow: '0 3px 20px rgba(0,0,0,0.45)' } }, nom),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '22px', marginTop: '22px' } },
        ville ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', fontSize: '30px', fontWeight: 500 } }, IC_PIN, ville) : h('div', { style: { display: 'none' } }),
        note > 0 ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', fontSize: '30px', fontWeight: 600 } }, IC_STAR, note.toFixed(1)) : h('div', { style: { display: 'none' } })
      )
    )
  );
}

function redirectFallback(res) { res.statusCode = 302; res.setHeader('Location', OG_FALLBACK); res.setHeader('Cache-Control', 'public, s-maxage=600'); return res.end(); }

export default async function handler(req, res) {
  try {
    const q = req.query || {};
    const id = extractId(q.id || q.slug || '');
    if (!id) return redirectFallback(res);
    const cols = 'nom,ville,photos,photo_url,note_moyenne,nb_avis,type_pro,categorie,logo_url,actif,demo';
    const r = await fetch(`${SUPABASE_URL}/rest/v1/commercants?id=eq.${id}&select=${cols}`, { headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + SUPABASE_ANON } });
    const list = r.ok ? await r.json() : [];
    const c = (list && list[0]) || null;
    if (!c || c.demo === true || c.actif === false) return redirectFallback(res);

    const ti = TYPE_LABELS[c.type_pro] || { label: 'Commerce', tint: '#1D9E75' };
    const nom = c.nom || 'Professionnel local';
    const ville = c.ville || '';
    const categorie = (c.categorie || '').trim();
    const note = Number(c.note_moyenne) || 0;
    const photos = Array.isArray(c.photos) ? c.photos.filter((p) => typeof p === 'string' && p.trim()) : [];
    const mainPhoto = photos[0] || c.photo_url || null;

    const [logo, photoObj] = await Promise.all([ getLogo(), mainPhoto ? fetchBytes(mainPhoto, 8_000_000) : Promise.resolve(null) ]);
    let photoDataUrl = null; if (photoObj) { const _sz = imgSize(photoObj.buf); if (!_sz || _sz.w >= 700) photoDataUrl = toDataUrl(photoObj, 'image/jpeg'); } // LKL_OGPRO_QUALITY_V1

    const card = buildCard({ nom, ville, typeLabel: ti.label, categorie, note, photoDataUrl, logo, tint: ti.tint });
    const img = new ImageResponse(card, { width: 1200, height: 630, fonts: getFonts() });
    const buf = Buffer.from(await img.arrayBuffer());
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return res.end(buf);
  } catch (e) { console.error('[og-pro]', e); return redirectFallback(res); }
}

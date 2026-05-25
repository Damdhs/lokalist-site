/**
 * patch-logo-favicon.js
 * -------------------------------------------------------------
 * Remplace, dans TOUTES les pages .html du repo :
 *   1) chaque logo SVG inline (viewBox="0 0 1024 1024") par <img src="/logo.png">
 *      en conservant la taille d'origine (48px nav, 28px footer, etc.)
 *   2) le bloc favicon par le pack complet (svg + png + ico + apple-touch + theme-color)
 *      et l'ajoute aux pages qui n'en ont pas.
 *
 * - Lit/écrit en UTF-8 strict (ne touche pas à l'encodage existant).
 * - Crée un backup .bak-logo-AAAAMMJJ-HHMMSS de chaque fichier modifié.
 * - Idempotent : relançable sans casse (ne re-remplace pas un <img> déjà posé).
 *
 * Lancement :  node patch-logo-favicon.js
 * -------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');

// ── Horodatage pour les backups ───────────────────────────────
const now = new Date();
const pad = n => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

// ── Nouveau bloc favicon (indenté proprement) ─────────────────
const FAVICON_BLOCK =
`  <!-- Favicon Lokalist -->
  <link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png"/>
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png"/>
  <link rel="icon" href="/favicon.ico" sizes="any"/>
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"/>
  <meta name="theme-color" content="#1D9E75"/>`;

// ── Regex ─────────────────────────────────────────────────────

// 1) Tout bloc <svg ... viewBox="0 0 1024 1024" ...> ... </svg>
//    (insensible au contenu : 1 ou 2 paths, couleurs, opacity, etc.)
const SVG_RE = /<svg\b[^>]*viewBox=["']0 0 1024 1024["'][^>]*>[\s\S]*?<\/svg>/gi;

// 2) Extraire la largeur déclarée sur la balise <svg ...> pour conserver la taille
function getSvgWidth(svgTag) {
  const m = svgTag.match(/\bwidth=["'](\d+)["']/i);
  return m ? parseInt(m[1], 10) : 48; // défaut 48 si absent
}

// 3) Lignes favicon existantes à retirer (svg+xml, shortcut, png icon, apple-touch, theme-color)
//    On enlève les anciennes lignes <link rel="icon"...> / shortcut / apple-touch / theme-color
// Note : on ne consomme QUE les espaces/tabs d'indentation + la balise + le \n de SA PROPRE ligne.
// Pas de \s* gourmand en fin, sinon il mange l'indentation de la ligne suivante et casse le ^ du match suivant.
const OLD_FAVICON_LINE_RE = /^[ \t]*<link[^>]*rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]*>[ \t]*\r?\n/gim;
const OLD_THEME_LINE_RE = /^[ \t]*<meta[^>]*name=["']theme-color["'][^>]*>[ \t]*\r?\n/gim;
const OLD_FAVICON_COMMENT_RE = /^[ \t]*<!--\s*Favicon Lokalist\s*-->[ \t]*\r?\n/gim;

// ── Traitement d'un fichier ───────────────────────────────────
function patchFile(file) {
  const original = fs.readFileSync(file, 'utf8');
  let content = original;
  const report = { file: path.basename(file), svg: 0, favicon: false };

  // --- 1) Remplacer les logos SVG par <img> ---
  content = content.replace(SVG_RE, (match) => {
    const w = getSvgWidth(match);
    report.svg++;
    return `<img src="/logo.png" alt="Lokalist" width="${w}" height="${w}" style="display:block;width:${w}px;height:${w}px;object-fit:contain"/>`;
  });

  // --- 2) Favicon : retirer l'ancien, insérer le nouveau ---
  // a) Nettoyer les anciennes lignes favicon + theme-color + commentaire éventuel
  content = content
    .replace(OLD_FAVICON_COMMENT_RE, '')
    .replace(OLD_FAVICON_LINE_RE, '')
    .replace(OLD_THEME_LINE_RE, '');

  // b) Insérer le nouveau bloc juste avant </head>
  if (/<\/head>/i.test(content)) {
    content = content.replace(/([^\S\r\n]*)<\/head>/i, (m, indent) => {
      report.favicon = true;
      return `${FAVICON_BLOCK}\n${indent}</head>`;
    });
  }

  // --- 3) Écriture si modifié ---
  if (content !== original) {
    const bak = `${file}.bak-logo-${stamp}`;
    fs.writeFileSync(bak, original, 'utf8'); // backup à l'identique
    fs.writeFileSync(file, content, 'utf8'); // écriture UTF-8
  }
  return report;
}

// ── Boucle sur tous les .html du dossier courant ──────────────
const files = fs.readdirSync(process.cwd()).filter(f => f.toLowerCase().endsWith('.html'));

console.log(`\n=== PATCH LOGO + FAVICON — ${files.length} fichiers .html ===\n`);
let totalSvg = 0, totalFav = 0, changed = 0;

for (const f of files) {
  const r = patchFile(path.join(process.cwd(), f));
  const touched = r.svg > 0 || r.favicon;
  if (touched) changed++;
  totalSvg += r.svg;
  if (r.favicon) totalFav++;
  const tag = touched ? 'OK ' : '-- ';
  console.log(`${tag}${r.file.padEnd(24)} | logos remplacés: ${r.svg} | favicon: ${r.favicon ? 'oui' : 'non'}`);
}

console.log(`\n--- RÉSUMÉ ---`);
console.log(`Fichiers modifiés : ${changed}/${files.length}`);
console.log(`Logos SVG → <img> : ${totalSvg}`);
console.log(`Favicons posés    : ${totalFav}`);
console.log(`\nBackups créés avec le suffixe : .bak-logo-${stamp}`);
console.log(`Pour annuler un fichier : restaure son .bak-logo-${stamp}\n`);

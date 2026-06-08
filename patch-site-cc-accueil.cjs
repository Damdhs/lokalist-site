#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * patch-site-cc-accueil.cjs — Section "Click & Collect" sur l'accueil
 * ───────────────────────────────────────────────────────────────────
 * À lancer depuis la RACINE du site :
 *     node patch-site-cc-accueil.cjs
 *
 * Insère une section Click & Collect dans index.html, juste après la
 * section "Comment ça marche" (avant le bloc MAIRIE). Réutilise tes
 * classes existantes (sec-tag / sec-h / sec-p / reveal) et tes couleurs.
 *
 * Ancre ASCII-safe. CRLF-aware. Idempotent. Backup .bak-ccaccueil-<ts>.
 * ═══════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const FILE = path.join(ROOT, 'index.html');

if (!fs.existsSync(FILE)) {
  console.error('❌ index.html introuvable. Lance depuis la racine du site (lokalist-site).');
  process.exit(1);
}

let src = fs.readFileSync(FILE, 'utf8');
const original = src;
const CRLF = src.indexOf('\r\n') !== -1;
console.log('   (fins de ligne : ' + (CRLF ? 'CRLF' : 'LF') + ')');
const eol = (s) => CRLF ? s.replace(/\n/g, '\r\n') : s;

const MARKER = 'id="click-collect"';

// Section C&C — styles inline (ne touche pas au <style> global)
const SECTION = `
<!-- CLICK & COLLECT -->
<section id="click-collect" style="padding:90px 5%;max-width:1200px;margin:0 auto">
  <div style="text-align:center;margin-bottom:52px">
    <p class="sec-tag reveal">Nouveau · Commande locale</p>
    <h2 class="sec-h reveal">Click &amp; Collect</h2>
    <p class="sec-p reveal">Vos commerçants prennent les commandes dans l'app, vos habitants viennent les chercher. Le commerce local, en plus pratique.</p>
  </div>
  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:18px" class="cc-grid">
    <div class="reveal" style="background:var(--surf);border:1px solid var(--bdr);border-radius:22px;padding:34px 30px">
      <div style="font-size:40px;margin-bottom:14px">🛍️</div>
      <h3 style="font-family:'Syne',sans-serif;font-size:21px;font-weight:800;color:var(--text);margin-bottom:10px">Pour les habitants</h3>
      <p style="font-size:14.5px;color:var(--muted);line-height:1.7;font-weight:300;margin-bottom:18px">Commandez chez vos commerçants préférés directement depuis l'app, choisissez votre créneau, et passez récupérer. Soutenez le commerce de votre ville, sans file d'attente.</p>
      <a href="#telecharger" style="display:inline-flex;align-items:center;gap:8px;background:var(--g);color:#fff;font-weight:700;font-size:14px;padding:11px 22px;border-radius:100px;text-decoration:none">Télécharger l'app</a>
    </div>
    <div class="reveal" style="background:linear-gradient(160deg,var(--gl),var(--surf));border:1px solid var(--gm);border-radius:22px;padding:34px 30px">
      <div style="font-size:40px;margin-bottom:14px">🏪</div>
      <h3 style="font-family:'Syne',sans-serif;font-size:21px;font-weight:800;color:var(--text);margin-bottom:10px">Pour les commerçants</h3>
      <p style="font-size:14.5px;color:var(--muted);line-height:1.7;font-weight:300;margin-bottom:18px">Recevez les commandes de vos clients en temps réel, gérez votre carte et vos créneaux. Vous gardez la main sur vos paiements et votre livraison — Lokalist ne prend aucune commission.</p>
      <a href="commercants.html" style="display:inline-flex;align-items:center;gap:8px;background:var(--gd);color:#fff;font-weight:700;font-size:14px;padding:11px 22px;border-radius:100px;text-decoration:none">Découvrir pour mon commerce</a>
    </div>
  </div>
</section>
`;

if (src.includes(MARKER)) {
  console.log('   • section Click & Collect : déjà présente.');
} else {
  const anchor = eol(`</section>\n  \n<!-- MAIRIE -->`);
  const replacement = eol(`</section>\n` + SECTION + `  \n<!-- MAIRIE -->`);
  if (!src.includes(anchor)) {
    console.warn('   ⚠️  ancre (fin section comment + <!-- MAIRIE -->) non trouvée.');
    console.warn('       Colle-moi les lignes autour de "<!-- MAIRIE -->" et j\'ajuste.');
  } else {
    src = src.split(anchor).join(replacement);
    console.log('   ✓ section Click & Collect insérée après "Comment ça marche".');
  }
}

if (src !== original) {
  fs.copyFileSync(FILE, FILE + '.bak-ccaccueil-' + STAMP);
  fs.writeFileSync(FILE, src, 'utf8');
  console.log('\n✅ index.html mis à jour (backup .bak-ccaccueil-' + STAMP + ').');
  console.log('   Ouvre la page en local pour vérifier le rendu, puis commit + push.');
} else {
  console.log('\nℹ️  Rien à modifier.');
}

//  ============================================================
//  api/affichage.js  â€”  Mode affichage kiosque plein ecran
//  ------------------------------------------------------------
//  URL publique : lokalist.fr/affichage/<commune>
//  (rewrite vercel.json : /affichage/:slug -> /api/affichage?slug=:slug)
//
//  Fait defiler en boucle les publications de la commune sur un
//  ecran (TV / totem / borne). Chaque mairie choisit ce qui defile
//  via la colonne mairies_partenaires.affichage_sources (text[]) :
//    - 'agenda'      -> evenements_mairie (a venir, par ville)
//    - 'actualites'  -> actus_mairie (statut=publie)
//    - 'alertes'     -> alertes_mairie (statut=active)
//  Rythme : mairies_partenaires.affichage_duree (secondes/affiche).
//
//  Visuels : logo de la commune (mairies_partenaires.logo_url) en bas,
//  image des actus (actus_mairie.photo_url) et des evenements
//  (evenements_mairie.image_url) a droite de l'affiche.
//
//  La page se recharge seule toutes les 5 min pour rafraichir les
//  donnees sans toucher au boitier.
//  ============================================================

const SUPABASE_URL  = 'https://kukathominhssogthplc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a2F0aG9taW5oc3NvZ3RocGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTU2NDMsImV4cCI6MjA5MDQzMTY0M30.nrfnhLWA_N-d5EA0qMvSTgSvbebbqHvWuCwk4PQDxcg';

const SOURCES_DEFAUT = ['agenda', 'actualites', 'alertes'];
const DUREE_DEFAUT   = 10;   // secondes par affiche
const MAX_PAR_SOURCE = 12;   // securite : on ne fait pas defiler 300 items

// --- helpers ------------------------------------------------

const escapeHtml = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const slugify = (s) => String(s || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const enc = (s) => encodeURIComponent(s);

async function sb(pathAndQuery) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
    });
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j) ? j : [];
  } catch (_e) {
    return [];
  }
}

// Resout le slug commune -> ligne mairies_partenaires (comme ville.js)
async function resolveCommune(want) {
  if (!want) return null;
  const loose = '%' + want.split('-').filter(Boolean).join('%') + '%';
  const cols  = 'id,nom,ville,logo_url,affichage_sources,affichage_duree';
  const rows  = await sb(
    `mairies_partenaires?statut=eq.actif&ville=ilike.${enc(loose)}&select=${cols}&limit=25`
  );
  if (!rows.length) return null;
  return rows.find((c) => slugify(c.ville) === want)
      || rows.find((c) => slugify(c.nom)   === want)
      || rows[0]
      || null;
}

// Formatage date FR courte : "sam. 14 juin - 18h30"
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const jours = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  const mois  = ['janv.', 'fevr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'aout', 'sept.', 'oct.', 'nov.', 'dec.'];
  let out = `${jours[d.getDay()]} ${d.getDate()} ${mois[d.getMonth()]}`;
  const h = d.getHours(), mn = d.getMinutes();
  if (h || mn) out += ` - ${h}h${mn ? String(mn).padStart(2, '0') : ''}`;
  return out;
}

// Statuts d'evenement a NE PAS afficher (liste noire = tolerant aux
// statuts inconnus mais valides)
const EVT_EXCLUS = ['annule', 'annulee', 'refuse', 'refusee', 'rejete', 'rejetee', 'brouillon', 'archive', 'archivee'];

// --- collecte des affiches ----------------------------------

async function collecterSlides(mairie, sources) {
  const slides = [];

  if (sources.includes('alertes') && mairie.id) {
    const rows = await sb(
      `alertes_mairie?mairie_id=eq.${mairie.id}&statut=eq.active` +
      `&select=id,titre,message,type,created_at&order=created_at.desc&limit=${MAX_PAR_SOURCE}`
    );
    rows.forEach((a) => slides.push({
      kind: 'alerte',
      titre: a.titre || 'Alerte',
      corps: a.message || '',
      image: '',
      meta: '',
    }));
  }

  if (sources.includes('agenda') && mairie.ville) {
    const nowIso = new Date(Date.now() - 6 * 3600 * 1000).toISOString(); // marge : garde l'evenement du jour
    const rows = await sb(
      `evenements_mairie?ville=ilike.${enc(mairie.ville)}&date_debut=gte.${enc(nowIso)}` +
      `&select=id,titre,description,lieu,type,statut,date_debut,image_url&order=date_debut.asc&limit=${MAX_PAR_SOURCE}`
    );
    rows.forEach((e) => {
      const st = String(e.statut || '').toLowerCase();
      if (EVT_EXCLUS.includes(st)) return;
      const lieu = e.lieu ? ` - ${e.lieu}` : '';
      slides.push({
        kind: 'agenda',
        titre: e.titre || 'Evenement',
        corps: e.description || '',
        image: e.image_url || '',
        meta: (formatDate(e.date_debut) + lieu).trim(),
      });
    });
  }

  if (sources.includes('actualites') && mairie.id) {
    const rows = await sb(
      `actus_mairie?mairie_id=eq.${mairie.id}&statut=eq.publie` +
      `&select=id,titre,texte,photo_url,created_at&order=created_at.desc&limit=${MAX_PAR_SOURCE}`
    );
    rows.forEach((a) => slides.push({
      kind: 'actu',
      titre: a.titre || 'Actualite',
      corps: a.texte || '',
      image: a.photo_url || '',
      meta: '',
    }));
  }

  return slides;
}

// --- rendu HTML ---------------------------------------------

const LABELS = {
  alerte: { txt: 'Alerte', emoji: '&#9888;&#65039;' },  // warning
  agenda: { txt: 'Agenda', emoji: '&#128197;' },        // calendar
  actu:   { txt: 'Actualite', emoji: '&#128240;' },     // newspaper
};

function renderSlide(s) {
  const lab = LABELS[s.kind] || LABELS.actu;
  const corps = escapeHtml(s.corps || '');
  const hasImg = !!s.image;
  const img = hasImg
    ? `<div class="slide-media"><img src="${escapeHtml(s.image)}" alt=""/></div>`
    : '';
  const meta = s.meta ? `<div class="slide-meta">${escapeHtml(s.meta)}</div>` : '';
  return `
    <section class="slide slide--${s.kind}${hasImg ? ' has-media' : ''}">
      <div class="slide-body">
        <div class="slide-tag"><span class="slide-emoji">${lab.emoji}</span>${lab.txt}</div>
        <h1 class="slide-titre">${escapeHtml(s.titre)}</h1>
        ${meta}
        <div class="slide-texte">${corps}</div>
      </div>
      ${img}
    </section>`;
}

function pageVide(nomCommune) {
  return renderSlide({
    kind: 'actu',
    titre: 'Bienvenue',
    corps: 'Retrouvez toute l\'actualite de ' + nomCommune + ' sur l\'application Lokalist.',
    image: '',
    meta: '',
  });
}

function renderPage(mairie, slides, dureeMs) {
  const nom = mairie.ville || mairie.nom || 'la commune';
  const logo = mairie.logo_url
    ? `<img class="bar-logo" src="${escapeHtml(mairie.logo_url)}" alt=""/>`
    : '';
  const corpsSlides = slides.length
    ? slides.map(renderSlide).join('')
    : pageVide(escapeHtml(nom));

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>Affichage - ${escapeHtml(nom)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap" rel="stylesheet"/>
<style>
  :root{
    --bg:#0f1e2e; --bg2:#16324a; --fg:#ffffff; --muted:#a9c2d6;
    --accent:#2563eb; --alerte:#e11d48; --agenda:#0891b2; --actu:#2563eb;
    --disp:'Segoe UI',system-ui,-apple-system,sans-serif;
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body{height:100%;width:100%;overflow:hidden;background:var(--bg);
    font-family:var(--disp);color:var(--fg);}
  .stage{position:fixed;inset:0;}
  .slide{position:absolute;inset:0;display:flex;flex-direction:column;
    justify-content:center;gap:3vh;padding:7vh 8vw 14vh;opacity:0;
    transition:opacity .6s ease;background:
      radial-gradient(1200px 600px at 80% -10%, var(--bg2), var(--bg));}
  .slide.active{opacity:1;}
  .slide--alerte{background:
      radial-gradient(1200px 600px at 80% -10%, #3a0d1c, #1a0710);}
  .slide-tag{display:inline-flex;align-items:center;gap:.5em;align-self:flex-start;
    font-size:2.4vh;font-weight:800;letter-spacing:.08em;text-transform:uppercase;
    padding:.5em 1em;border-radius:999px;background:rgba(255,255,255,.08);
    color:var(--muted);}
  .slide-emoji{font-size:2.6vh;}
  .slide--alerte .slide-tag{background:var(--alerte);color:#fff;}
  .slide--agenda .slide-tag{background:var(--agenda);color:#fff;}
  .slide--actu   .slide-tag{background:var(--actu);color:#fff;}
  .slide-titre{font-size:7vh;line-height:1.05;font-weight:900;
    max-width:22ch;text-wrap:balance;}
  .slide--alerte .slide-titre{font-size:8vh;}
  .slide-meta{font-size:3.4vh;font-weight:700;color:var(--muted);}
  .slide-texte{font-size:3.4vh;line-height:1.4;color:#e8f1f8;max-width:34ch;
    display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;
    overflow:hidden;}
  .slide.has-media .slide-body{max-width:58vw;}
  .slide-media{position:absolute;right:0;top:0;bottom:14vh;width:38vw;}
  .slide-media img{width:100%;height:100%;object-fit:cover;
    -webkit-mask-image:linear-gradient(90deg,transparent,#000 22%);
    mask-image:linear-gradient(90deg,transparent,#000 22%);}
  .bar{position:fixed;left:0;right:0;bottom:0;height:11vh;display:flex;
    align-items:center;justify-content:space-between;padding:0 5vw;
    background:rgba(0,0,0,.35);backdrop-filter:blur(6px);font-size:3vh;}
  .bar-com{display:flex;align-items:center;gap:.6em;font-weight:800;}
  .bar-logo{height:7vh;width:auto;max-width:16vw;object-fit:contain;
    background:#fff;border-radius:8px;padding:.7vh;}
  .bar-brand{display:flex;align-items:center;gap:.5em;
    font-family:'Syne',var(--disp);font-weight:800;font-size:3.4vh;
    letter-spacing:-.02em;}
  .bar-brand img{height:5.2vh;width:auto;display:block;}
  .bar-brand .lk-v{color:#1D9E75;}
  .bar-brand .lk-j{color:#EF9F27;}
  .bar-clock{font-variant-numeric:tabular-nums;font-weight:800;}
  .prog{position:fixed;left:0;top:0;height:.6vh;background:var(--accent);
    width:0;transition:width linear;z-index:2;}
</style>
</head>
<body>
  <div class="prog" id="prog"></div>
  <div class="stage" id="stage">
    ${corpsSlides}
  </div>
  <div class="bar">
    <div class="bar-com">${logo}${escapeHtml(nom)}</div>
    <div class="bar-clock" id="clock">--:--</div>
    <div class="bar-brand"><img src="/logo.png" alt=""/><span><span class="lk-v">Lokal</span><span class="lk-j">ist</span></span></div>
  </div>
<script>
(function(){
  var DUREE = ${dureeMs};
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var prog = document.getElementById('prog');
  var i = 0;

  function show(n){
    slides.forEach(function(s,k){ s.classList.toggle('active', k===n); });
    prog.style.transition='none'; prog.style.width='0';
    void prog.offsetWidth;
    prog.style.transition='width '+DUREE+'ms linear'; prog.style.width='100%';
  }
  function next(){ i=(i+1)%slides.length; show(i); }

  if(slides.length){ show(0); if(slides.length>1){ setInterval(next, DUREE); } }

  function tick(){
    var d=new Date();
    document.getElementById('clock').textContent =
      String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  }
  tick(); setInterval(tick, 15000);

  setTimeout(function(){ location.reload(); }, 5*60*1000);
})();
</script>
</body>
</html>`;
}

// --- handler -------------------------------------------------

module.exports = async (req, res) => {
  try {
    const url  = new URL(req.url, `https://${req.headers.host || 'lokalist.fr'}`);
    const raw  = (req.query && req.query.slug) || url.searchParams.get('slug') || '';
    const want = slugify(raw);

    const mairie = await resolveCommune(want);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');

    if (!mairie) {
      res.status(404).send(renderPage(
        { ville: 'Commune introuvable', nom: 'Commune introuvable' },
        [{ kind: 'actu', titre: 'Commune introuvable',
           corps: 'Verifiez l\'adresse : lokalist.fr/affichage/<votre-commune>', image: '', meta: '' }],
        DUREE_DEFAUT * 1000
      ));
      return;
    }

    let sources = Array.isArray(mairie.affichage_sources) && mairie.affichage_sources.length
      ? mairie.affichage_sources
      : SOURCES_DEFAUT;
    sources = sources.map((s) => String(s).toLowerCase());

    let duree = parseInt(mairie.affichage_duree, 10);
    if (!duree || duree < 3) duree = DUREE_DEFAUT;
    if (duree > 120) duree = 120;

    const slides = await collecterSlides(mairie, sources);

    res.status(200).send(renderPage(mairie, slides, duree * 1000));
  } catch (e) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(500).send('<!doctype html><meta charset="utf-8"><body style="background:#0f1e2e"></body>');
  }
};

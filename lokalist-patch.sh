#!/usr/bin/env python3
"""
lokalist-patch.py — Applique les 3 patches Lokalist sur tous les fichiers HTML

Usage:
  python3 lokalist-patch.py                    # patch le dossier courant
  python3 lokalist-patch.py /chemin/vers/site  # patch un dossier spécifique

Patches appliqués:
  1. Logo nav : 44px → 52px (div + SVG + texte)
  2. CSS responsive @media(max-width:480px) injecté avant </style>
  3. Meta keywords enrichis (mots-clés SEO additionnels par page)
  4. loisirs.html : boutons CTA → /contact?type=loisirs
"""

import re, os, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else '.'

MOBILE_CSS = """
    /* ═══ MOBILE RENFORCÉ 480px ═══ */
    @media(max-width:480px){
      body{overflow-x:hidden}
      nav{padding:12px 4%}
      .hero,.mairie-grid,.art-in,.immo-in,.strat-grid,.tarif-in,.bons-in,.fid-in,.boost-in,.avis-grid,.tarif-grid{grid-template-columns:1fr!important;gap:24px!important}
      .hero{padding:88px 4% 44px!important}
      .hero h1{font-size:clamp(24px,8.5vw,34px)!important;letter-spacing:-.8px}
      .hero-sub{font-size:14px}
      .hero-btns{flex-direction:column;align-items:stretch}
      .hero-btns a,.hero-btns .btn{text-align:center;justify-content:center;width:100%}
      .hero-trust{gap:12px;flex-wrap:wrap;margin-top:40px}
      .trust-val{font-size:26px}
      .trust-lbl{font-size:10px}
      .hero-badge{font-size:10px;padding:5px 12px}
      .sec-h{font-size:clamp(20px,7vw,28px)!important}
      .sec-p{font-size:14px!important;margin-bottom:24px}
      .cibles-grid,.cibles-row2,.args-grid,.av-grid,.avantages-grid,.conv-in{grid-template-columns:1fr!important}
      .steps{grid-template-columns:1fr!important}
      .phones-section{display:none!important}
      .tarif-cards.cols2,.tarif-cards.cols3{grid-template-columns:1fr!important}
      .cats-grid{grid-template-columns:repeat(2,1fr)!important}
      .profil-grid{grid-template-columns:repeat(2,1fr)!important}
      .kpis,.dash-kpis,.dash-stats,.strat-kpi-row{grid-template-columns:1fr 1fr!important}
      .btn{padding:11px 16px;font-size:13px}
      .cta-strip h2,.cta h2{font-size:clamp(22px,8vw,34px)!important}
      .stores{flex-direction:column;align-items:center;gap:10px}
      .store{width:100%;max-width:260px;justify-content:center}
      .cta-pros{gap:7px;justify-content:center}
      .cta-pro{font-size:12px;padding:7px 12px}
      .foot-top{grid-template-columns:1fr!important;gap:20px}
      .foot-bottom{flex-direction:column;gap:8px;text-align:center}
      .foot-bottom-links,.foot-links{flex-wrap:wrap;gap:10px;justify-content:center}
      .foot-legal{justify-content:center;flex-wrap:wrap;gap:10px}
      .cookie-banner{flex-direction:column;align-items:flex-start;padding:14px 16px;width:calc(100% - 24px);bottom:12px}
      .cookie-btns{width:100%;justify-content:flex-end}
      .social-strip{gap:12px;padding:20px 4%}
      .social-link{font-size:12px}
      .form-row{grid-template-columns:1fr!important}
      .ci-in{grid-template-columns:1fr!important}
      .tarif-card{padding:28px 16px}
      .conviction{padding:44px 4%}
    }
"""

def patch(html, kw='', loisirs=False):
    # Logo 52px
    for old, new in [
        ('style="width:44px;height:44px;flex-shrink:0;display:flex;align-items:center"',
         'style="width:52px;height:52px;flex-shrink:0;display:flex;align-items:center"'),
        ('style="width:44px;height:44px;flex-shrink:0"',
         'style="width:52px;height:52px;flex-shrink:0"'),
        ('style="width:36px;height:36px;flex-shrink:0"',
         'style="width:52px;height:52px;flex-shrink:0"'),
    ]:
        html = html.replace(old, new, 1)
    idx = html.find('<svg xmlns="http://www.w3.org/2000/svg"')
    if idx != -1:
        end = html.find('>', idx) + 1
        tag = (html[idx:end]
               .replace('width="44" height="44"', 'width="52" height="52"')
               .replace('width="36" height="36"', 'width="52" height="52"'))
        html = html[:idx] + tag + html[end:]
    for old, new in [
        ('font-size:23px;font-weight:800;color:#1D9E75;letter-spacing:-.5px',
         'font-size:25px;font-weight:800;color:#1D9E75;letter-spacing:-.5px'),
        ('font-size:20px;font-weight:800;color:#1D9E75;letter-spacing:-.5px',
         'font-size:25px;font-weight:800;color:#1D9E75;letter-spacing:-.5px'),
    ]:
        html = html.replace(old, new, 1)

    # CSS mobile
    head_end = html.find('</head>')
    pos = html.rfind('</style>', 0, head_end if head_end != -1 else len(html))
    if pos != -1:
        html = html[:pos] + MOBILE_CSS + html[pos:]

    # Keywords
    if kw:
        html = re.sub(
            r'(<meta name="keywords" content=")([^"]*)"',
            lambda m: m.group(1) + m.group(2).rstrip() + ', ' + kw + '"',
            html, count=1)

    # Loisirs buttons
    if loisirs:
        for old, new in [
            ('href="/contact" class="btn btn-p">\U0001f3b3 Rejoindre comme partenaire loisirs',
             'href="/contact?type=loisirs" class="btn btn-p">\U0001f3b3 Rejoindre comme partenaire loisirs'),
            ('href="/contact" class="btn-w">\U0001f3b3 Rejoindre comme partenaire loisirs',
             'href="/contact?type=loisirs" class="btn-w">\U0001f3b3 Rejoindre comme partenaire loisirs'),
            ('href="/contact" class="btn btn-p">\U0001f381 Commencer \u2014 3 mois offerts',
             'href="/contact?type=loisirs" class="btn btn-p">\U0001f381 Commencer \u2014 3 mois offerts'),
        ]:
            html = html.replace(old, new)
    return html

CONFIGS = {
    'index.html':       ('app commerce local France, fidélité commerçants, mairie numérique, artisans géolocalisés, bons mairie gratuit, plateforme commerce proximité', False),
    'mairies.html':     ('mairie numérique dashboard, soutien commerçants locaux, distribution bons numériques, gestion marché municipal, politique économique locale, collectivité territoriale numérique', False),
    'commercants.html': ('encaisser bons mairie, programme fidélité QR code, visibilité commerçant local, avis clients vérifiés, dashboard commerçant, commerce de proximité numérique', False),
    'tarifs.html':      ('abonnement Lokalist, commission mairie 45%, tarif artisan mensuel annuel, tarif agence immobilière, tarif loisirs, sans commission ventes', False),
    'contact.html':     ('rejoindre Lokalist, demande partenariat commerce local, inscription mairie Lokalist, contact plateforme locale, formulaire partenaire', False),
    'loisirs.html':     ('loisirs locaux fidélité, bowling programme points, escape game local, cinéma local bons mairie, activités famille commune, yoga local fidélité', True),
    'artisans.html':    ('trouver artisan local, plombier géolocalisé, électricien disponible, artisan urgence, fiche artisan géolocalisation, boost artisan visibilité', False),
}

patched = 0
skipped = 0
for fname, (kw, lo) in CONFIGS.items():
    fpath = os.path.join(SRC, fname)
    if not os.path.exists(fpath):
        print(f'  ⚠ Fichier non trouvé : {fpath}')
        skipped += 1
        continue
    with open(fpath, 'r', encoding='utf-8') as f:
        html = f.read()
    html = patch(html, kw, lo)
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(html)
    logo_ok = 'width:52px;height:52px' in html
    mob_ok  = '@media(max-width:480px)' in html
    print(f'  ✓ {fname} | logo:{logo_ok} | mobile:{mob_ok}')
    patched += 1

print(f'\n{patched} fichier(s) patchés, {skipped} ignorés.')

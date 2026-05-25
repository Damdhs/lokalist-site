# ============================================================
#  LOKI - Corrections : retrait SVG renard + 5 nouvelles sections
#  A coller dans le terminal (C:\Users\dehai\lokalist-site)
# ============================================================
$site   = "C:\Users\dehai\lokalist-site"
$source = "C:\Users\dehai\Desktop"
$enc    = New-Object System.Text.UTF8Encoding($false)

$lt = [char]60; $gt = [char]62
$svgOpen  = $lt + 'svg class="loki__avatar"'
$svgClose = $lt + '/svg' + $gt
$bodyTag  = $lt + '/body' + $gt
$needle   = 'class=' + ([char]34) + 'loki'
$openSec  = $lt + 'section'
$endSec   = $lt + '/section' + $gt
$linkTag  = $lt + 'link rel="stylesheet" href="loki-section.css"' + $gt
$idLoki   = 'id=' + ([char]34) + 'loki' + ([char]34)

Write-Host "`n=== PARTIE 1 : retrait du SVG renard ===" -ForegroundColor Cyan

# Pages qui ont deja une grande section AVEC le SVG a retirer
$pagesAvecSvg = @("index.html","commercants.html","artisans.html","agences.html")

foreach ($p in $pagesAvecSvg) {
  $pp = Join-Path $site $p
  Write-Host "`n--- $p ---" -ForegroundColor Yellow
  if (-not (Test-Path $pp)) { Write-Host "  ABSENTE" -ForegroundColor DarkYellow; continue }

  $h = [System.IO.File]::ReadAllText($pp, $enc)
  $start = $h.IndexOf($svgOpen)
  if ($start -lt 0) { Write-Host "  pas de SVG avatar (rien a faire)" -ForegroundColor DarkGray; continue }

  $end = $h.IndexOf($svgClose, $start)
  if ($end -lt 0) { Write-Host "  balise /svg introuvable (ignore)" -ForegroundColor Red; continue }
  $end += $svgClose.Length

  # backup specifique
  $bk = "$pp.backup-avant-retrait-svg"
  if (-not (Test-Path $bk)) { Copy-Item $pp $bk -Force; Write-Host "  backup cree" -ForegroundColor Gray }

  $h = $h.Substring(0, $start) + $h.Substring($end)
  [System.IO.File]::WriteAllText($pp, $h, $enc)
  Write-Host "  SVG renard retire (emoji du titre conserve)" -ForegroundColor Green
}

Write-Host "`n=== PARTIE 2 : insertion des 5 nouvelles sections ===" -ForegroundColor Cyan

# fichier source LOKI : page cible
$nouv = [ordered]@{
  "loki-mairies.html"       = "mairies.html"
  "loki-idees-sorties.html" = "idees-sorties.html"
  "loki-courtiers.html"     = "courtiers.html"
  "loki-loisirs.html"       = "loisirs.html"
  "loki-tarifs.html"        = "tarifs.html"
}

foreach ($src in $nouv.Keys) {
  $page = $nouv[$src]
  $sp = Join-Path $source $src
  $pp = Join-Path $site $page
  Write-Host "`n--- $page ---" -ForegroundColor Yellow

  if (-not (Test-Path $sp)) { Write-Host "  source $src absente du Bureau" -ForegroundColor DarkYellow; continue }
  if (-not (Test-Path $pp)) { Write-Host "  page absente du site" -ForegroundColor DarkYellow; continue }

  $s = [System.IO.File]::ReadAllText($sp, $enc)
  $pl = $s.IndexOf($needle)
  if ($pl -lt 0) { Write-Host "  marqueur loki absent dans la source" -ForegroundColor Red; continue }
  $si = $s.LastIndexOf($openSec, $pl)
  $ei = $s.IndexOf($endSec, $pl)
  if ($si -lt 0 -or $ei -lt 0) { Write-Host "  balises section incompletes" -ForegroundColor Red; continue }
  $ei += $endSec.Length
  $block = $s.Substring($si, $ei - $si)

  $h = [System.IO.File]::ReadAllText($pp, $enc)
  if ($h.Contains($idLoki)) { Write-Host "  DEJA une section LOKI (rien fait)" -ForegroundColor DarkGray; continue }

  $bk = "$pp.backup-avant-loki"
  if (-not (Test-Path $bk)) { Copy-Item $pp $bk -Force; Write-Host "  backup cree" -ForegroundColor Gray }

  # link CSS avant /head
  if (-not $h.Contains($linkTag)) {
    $headTag = $lt + '/head' + $gt
    $ph = $h.IndexOf($headTag)
    if ($ph -ge 0) { $h = $h.Substring(0,$ph) + "  " + $linkTag + "`r`n" + $h.Substring($ph); Write-Host "  + link CSS" -ForegroundColor Green }
  }

  # section avant /body
  $pb = $h.IndexOf($bodyTag)
  if ($pb -ge 0) { $h = $h.Substring(0,$pb) + $block + "`r`n" + $h.Substring($pb); Write-Host "  + section LOKI inseree" -ForegroundColor Green }
  else { $h = $h + "`r`n" + $block; Write-Host "  + section ajoutee en fin" -ForegroundColor DarkYellow }

  [System.IO.File]::WriteAllText($pp, $h, $enc)
  Write-Host "  ENREGISTRE" -ForegroundColor Green
}

Write-Host "`n=== Termine ! ===" -ForegroundColor Cyan
Write-Host "N'oublie pas de remplacer loki.js (script maj-loki) si pas deja fait." -ForegroundColor White
Write-Host "Teste, puis : git add . ; git commit -m " -NoNewline -ForegroundColor Gray
Write-Host '"LOKI: retrait SVG + sections mairies/sorties/courtiers/loisirs/tarifs" ; git push' -ForegroundColor Gray

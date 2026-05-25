# ============================================================
#  LOKI widget flottant - installation sur les pages choisies
#  A COLLER directement dans le terminal (C:\Users\dehai\lokalist-site)
# ============================================================
$site   = "C:\Users\dehai\lokalist-site"
$source = "C:\Users\dehai\Desktop"
$enc    = New-Object System.Text.UTF8Encoding($false)

# Chevrons construits par code jamais interpretes par PowerShell
$lt = [char]60; $gt = [char]62
$bodyTag   = $lt + '/body' + $gt
$scriptTag = $lt + 'script src="loki.js" defer' + $gt + $lt + '/script' + $gt
$marker    = 'src="loki.js"'

# Liste blanche : SEULES ces pages recoivent le renard
$pages = @(
  "index.html","loisirs.html","idees-sorties.html",
  "commercants.html","artisans.html","agences.html","courtiers.html",
  "mairies.html","tarifs.html","contact.html"
)

Write-Host "`n=== LOKI widget : installation ===" -ForegroundColor Cyan

# 1) Copier loki.js a la racine
$jsSrc = Join-Path $source "loki.js"
if (-not (Test-Path $jsSrc)) { Write-Host "ERREUR : loki.js absent du Bureau" -ForegroundColor Red; return }
Copy-Item $jsSrc (Join-Path $site "loki.js") -Force
Write-Host "OK  loki.js copie a la racine" -ForegroundColor Green

# 2) Ajouter le script sur chaque page autorisee
foreach ($p in $pages) {
  $pp = Join-Path $site $p
  Write-Host "`n--- $p ---" -ForegroundColor Yellow
  if (-not (Test-Path $pp)) { Write-Host "  ABSENTE (ignoree)" -ForegroundColor DarkYellow; continue }

  $h = [System.IO.File]::ReadAllText($pp, $enc)

  if ($h.Contains($marker)) { Write-Host "  DEJA present (rien fait)" -ForegroundColor DarkGray; continue }

  $bk = "$pp.backup-avant-loki-js"
  if (-not (Test-Path $bk)) { Copy-Item $pp $bk -Force; Write-Host "  backup cree" -ForegroundColor Gray }

  $pb = $h.IndexOf($bodyTag)
  if ($pb -ge 0) {
    $h = $h.Substring(0, $pb) + "  " + $scriptTag + "`r`n" + $h.Substring($pb)
    Write-Host "  + script LOKI ajoute avant la fermeture body" -ForegroundColor Green
  } else {
    $h = $h + "`r`n" + $scriptTag
    Write-Host "  ATTENTION : pas de fermeture body, ajoute en fin" -ForegroundColor DarkYellow
  }

  [System.IO.File]::WriteAllText($pp, $h, $enc)
  Write-Host "  ENREGISTRE" -ForegroundColor Green
}

Write-Host "`n=== Termine ! ===" -ForegroundColor Cyan
Write-Host "Teste en local (start index.html), puis :" -ForegroundColor White
Write-Host '  git add . ; git commit -m "Widget flottant LOKI" ; git push' -ForegroundColor Gray

# ============================================================
#  LOKI - Repositionnement des sections (remonter avant l'ancre)
#  A coller dans le terminal (C:\Users\dehai\lokalist-site)
# ============================================================
$site = "C:\Users\dehai\lokalist-site"
$enc  = New-Object System.Text.UTF8Encoding($false)

$lt = [char]60; $gt = [char]62; $q = [char]34; $apos = [char]39
$openSec = $lt + 'section'
$endSec  = $lt + '/section' + $gt
$needleLoki = 'class=' + $q + 'loki'

# Chaque page : ancre + mode.
#  mode "section" = inserer LOKI juste avant la section qui contient l'ancre
#  mode "anchor"  = inserer LOKI juste avant l'ancre elle-meme (utile si l'ancre
#                   est un commentaire place pile avant la section voulue)
$map = @(
  @{ page="index.html";         anchor=('L'+$apos+'app est');                       mode="section" }
  @{ page="mairies.html";       anchor=($lt+'!-- INTERLOCUTEUR --'+$gt);            mode="anchor"  }
  @{ page="commercants.html";   anchor=('class='+$q+'tarif-section');               mode="section" }
  @{ page="artisans.html";      anchor=('class='+$q+'tarif-art');                   mode="section" }
  @{ page="loisirs.html";       anchor=('class='+$q+'tarif-sect');                  mode="section" }
  @{ page="agences.html";       anchor=('class='+$q+'paliers');                     mode="section" }
  @{ page="courtiers.html";     anchor=('class='+$q+'pricing');                     mode="section" }
  @{ page="idees-sorties.html"; anchor=('Tout est dans votre');                     mode="section" }
  @{ page="tarifs.html";        anchor=('Tout ce que vous voulez savoir');          mode="section" }
)

Write-Host "`n=== Repositionnement des sections LOKI ===" -ForegroundColor Cyan

foreach ($item in $map) {
  $page   = $item.page
  $anchor = $item.anchor
  $mode   = $item.mode
  $pp = Join-Path $site $page
  Write-Host "`n--- $page ---" -ForegroundColor Yellow
  if (-not (Test-Path $pp)) { Write-Host "  ABSENTE" -ForegroundColor DarkYellow; continue }

  $h = [System.IO.File]::ReadAllText($pp, $enc)

  # 1) Extraire le bloc LOKI existant
  $pl = $h.IndexOf($needleLoki)
  if ($pl -lt 0) { Write-Host "  pas de section LOKI trouvee (ignore)" -ForegroundColor Red; continue }
  $blockStart = $h.LastIndexOf($openSec, $pl)
  $blockEnd   = $h.IndexOf($endSec, $pl)
  if ($blockStart -lt 0 -or $blockEnd -lt 0) { Write-Host "  balises section LOKI incompletes" -ForegroundColor Red; continue }
  $blockEnd += $endSec.Length
  $block = $h.Substring($blockStart, $blockEnd - $blockStart)

  $bk = "$pp.backup-avant-reposition"
  if (-not (Test-Path $bk)) { Copy-Item $pp $bk -Force; Write-Host "  backup cree" -ForegroundColor Gray }

  # 2) Retirer le bloc de sa position actuelle
  $hSansBloc = $h.Substring(0, $blockStart) + $h.Substring($blockEnd)

  # 3) Trouver l'ancre
  $posAnchor = $hSansBloc.IndexOf($anchor)
  if ($posAnchor -lt 0) {
    Write-Host "  ANCRE introuvable, bloc remis en fin (rien casse)" -ForegroundColor Red
    [System.IO.File]::WriteAllText($pp, $h, $enc)
    continue
  }

  # 4) Determiner le point d'insertion selon le mode
  if ($mode -eq "anchor") {
    $insertAt = $posAnchor
  } else {
    $insertAt = $hSansBloc.LastIndexOf($openSec, $posAnchor)
    if ($insertAt -lt 0) { Write-Host "  pas de section avant l'ancre, ignore" -ForegroundColor Red; [System.IO.File]::WriteAllText($pp,$h,$enc); continue }
  }

  # 5) Inserer
  $nouveau = $hSansBloc.Substring(0, $insertAt) + $block + "`r`n" + $hSansBloc.Substring($insertAt)
  [System.IO.File]::WriteAllText($pp, $nouveau, $enc)
  Write-Host "  Section LOKI remontee (mode $mode)" -ForegroundColor Green
}

Write-Host "`n=== Termine ! ===" -ForegroundColor Cyan
Write-Host "Teste chaque page, puis : git add . ; git commit -m " -NoNewline -ForegroundColor Gray
Write-Host '"LOKI: repositionnement des sections" ; git push' -ForegroundColor Gray
Write-Host "Annuler une page ? Restaure son .backup-avant-reposition" -ForegroundColor DarkGray

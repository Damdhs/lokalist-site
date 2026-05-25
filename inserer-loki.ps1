# ============================================================
#  LOKI - Insertion automatique sur le site Lokalist (v3 .ps1)
#  USAGE : depuis VS Code, dans C:\Users\dehai\lokalist-site
#          .\inserer-loki.ps1
# ============================================================

$site   = "C:\Users\dehai\lokalist-site"
$source = "C:\Users\dehai\Desktop"

$map = [ordered]@{
  "loki-accueil.html"     = "index.html"
  "loki-commercants.html" = "commercants.html"
  "loki-artisans.html"    = "artisans.html"
  "loki-agences.html"     = "agences.html"
}

# UTF-8 sans BOM pour lecture ET ecriture (coherent, evite les accents casses)
$enc = New-Object System.Text.UTF8Encoding($false)
$ErrorActionPreference = "Stop"
$linkTag = '<link rel="stylesheet" href="loki-section.css">'

Write-Host "`n=== LOKI v3 : demarrage ===" -ForegroundColor Cyan

if (-not (Test-Path $site))   { Write-Host "ERREUR : site introuvable -> $site" -ForegroundColor Red; exit 1 }
if (-not (Test-Path $source)) { Write-Host "ERREUR : source introuvable -> $source" -ForegroundColor Red; exit 1 }

# --- CSS ---
$cssSrc = Join-Path $source "loki-section.css"
if (-not (Test-Path $cssSrc)) { Write-Host "ERREUR : loki-section.css absent dans $source" -ForegroundColor Red; exit 1 }
Copy-Item $cssSrc (Join-Path $site "loki-section.css") -Force
Write-Host "OK  CSS copie -> loki-section.css" -ForegroundColor Green

# Chaine recherchee construite sans souci d'echappement
$q = [char]34                      # le caractere "
$needleSection = 'class=' + $q + 'loki'

foreach ($src in $map.Keys) {
  $page     = $map[$src]
  $srcPath  = Join-Path $source $src
  $pagePath = Join-Path $site   $page

  Write-Host "`n--- $page ---" -ForegroundColor Yellow

  if (-not (Test-Path $srcPath))  { Write-Host "  IGNORE : source $src absente" -ForegroundColor DarkYellow; continue }
  if (-not (Test-Path $pagePath)) { Write-Host "  IGNORE : page $page absente" -ForegroundColor DarkYellow; continue }

  # Lecture EXPLICITE en UTF-8 (corrige les accents et garantit le contenu)
  $srcHtml = [System.IO.File]::ReadAllText($srcPath, $enc)

  # Reperage du bloc par indices de chaines (pas de regex fragile)
  $startIdx = $srcHtml.IndexOf('<section ' )
  # securite : on cherche le <section qui contient class="loki
  $posLoki = $srcHtml.IndexOf($needleSection)
  if ($posLoki -lt 0) {
    Write-Host "  ERREUR : 'class=\"loki' introuvable dans $src (taille $($srcHtml.Length))" -ForegroundColor Red
    continue
  }
  # remonter jusqu'au <section qui precede ce class="loki
  $startIdx = $srcHtml.LastIndexOf('<section', $posLoki)
  $endTag   = '</section>'
  $endIdx   = $srcHtml.IndexOf($endTag, $posLoki)
  if ($startIdx -lt 0 -or $endIdx -lt 0) {
    Write-Host "  ERREUR : balises <section>...</section> incompletes dans $src" -ForegroundColor Red
    continue
  }
  $endIdx += $endTag.Length
  $block = $srcHtml.Substring($startIdx, $endIdx - $startIdx)
  Write-Host "  Bloc extrait : $($block.Length) caracteres" -ForegroundColor DarkGray

  # Lecture de la page cible
  $html = [System.IO.File]::ReadAllText($pagePath, $enc)

  # Anti-doublon
  if ($html.Contains('id=' + $q + 'loki' + $q)) {
    Write-Host "  DEJA PRESENT : section LOKI deja dans $page (rien fait)" -ForegroundColor DarkGray
    continue
  }

  # Backup
  $backup = "$pagePath.backup-avant-loki"
  if (-not (Test-Path $backup)) { Copy-Item $pagePath $backup -Force; Write-Host "  Backup -> $page.backup-avant-loki" -ForegroundColor Gray }

  # Inserer le <link> avant </head>
  if (-not $html.Contains($linkTag)) {
    if ($html -match '(?i)</head>') {
      $html = [regex]::Replace($html, '(?i)</head>', "  $linkTag`r`n</head>", 1)
      Write-Host "  + <link> CSS ajoute dans <head>" -ForegroundColor Green
    } else {
      Write-Host "  ATTENTION : pas de </head>, ajoute le <link> a la main" -ForegroundColor DarkYellow
    }
  } else {
    Write-Host "  <link> CSS deja present" -ForegroundColor DarkGray
  }

  # Inserer le bloc avant </body>
  if ($html -match '(?i)</body>') {
    $html = [regex]::Replace($html, '(?i)</body>', "$block`r`n</body>", 1)
    Write-Host "  + Section LOKI inseree avant </body>" -ForegroundColor Green
  } else {
    $html = $html + "`r`n" + $block
    Write-Host "  ATTENTION : pas de </body>, bloc ajoute en fin de fichier" -ForegroundColor DarkYellow
  }

  # Ecriture UTF-8 sans BOM
  [System.IO.File]::WriteAllText($pagePath, $html, $enc)
  Write-Host "  ENREGISTRE : $page" -ForegroundColor Green
}

Write-Host "`n=== Termine ! ===" -ForegroundColor Cyan
Write-Host "Verifie le rendu en local, puis :" -ForegroundColor White
Write-Host '  git add . ; git commit -m "Ajout section LOKI" ; git push' -ForegroundColor Gray
Write-Host "`nAnnuler une page ? Supprime la page modifiee et renomme son .backup-avant-loki" -ForegroundColor DarkGray

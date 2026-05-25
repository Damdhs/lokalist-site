# ============================================================
#  LOKI - Mise a jour du widget (remplace loki.js)
#  A coller dans le terminal (C:\Users\dehai\lokalist-site)
#  Les 10 pages chargent deja loki.js : rien d'autre a toucher.
# ============================================================
$site   = "C:\Users\dehai\lokalist-site"
$source = "C:\Users\dehai\Desktop"

$jsSrc = Join-Path $source "loki.js"
$jsDst = Join-Path $site   "loki.js"

if (-not (Test-Path $jsSrc)) { Write-Host "ERREUR : loki.js absent du Bureau" -ForegroundColor Red; return }

# Backup de l'ancienne version (au cas ou)
if (Test-Path $jsDst) {
  Copy-Item $jsDst "$jsDst.backup" -Force
  Write-Host "Ancienne version sauvegardee : loki.js.backup" -ForegroundColor Gray
}

Copy-Item $jsSrc $jsDst -Force
Write-Host "OK  loki.js mis a jour a la racine du site" -ForegroundColor Green
Write-Host "`nTeste : start index.html (ouvre LOKI, joue la demo, puis tape une question)" -ForegroundColor White
Write-Host 'Puis : git add . ; git commit -m "LOKI : champ texte libre + bouton app stand-by" ; git push' -ForegroundColor Gray

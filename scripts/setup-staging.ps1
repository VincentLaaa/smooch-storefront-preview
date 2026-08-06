<#
.SYNOPSIS
  Deploys the Smooch theme to a Shopify store as a NEW UNPUBLISHED theme and
  records deployment metadata for the QA suite.

.DESCRIPTION
  Safety guarantees:
    - NEVER publishes a theme (no publish flag exists anywhere in this script).
    - NEVER touches the live theme (pushes with --unpublished to a fresh theme,
      or updates the previously created staging theme by ID on rerun).
    - Aborts if Theme Check reports errors.
    - Writes no secrets to disk; auth is held by Shopify CLI's own session.

.USAGE
  pwsh -File scripts/setup-staging.ps1 -Store your-store.myshopify.com
  Optional: -ThemeName "Smooch QA — 2026-08-06"   (default: dated name)
  Rerun-safe: if qa/results/deploy.json exists with a theme id for the same
  store, that unpublished theme is updated in place instead of creating a new one.

  First run requires an interactive Shopify login (browser). If this script is
  run in a non-interactive session and no session exists, it will stop and tell
  you to run the login once from an interactive terminal.
#>
param(
  [Parameter(Mandatory = $true)][string]$Store,
  [string]$ThemeName = ("Smooch QA - " + (Get-Date -Format 'yyyy-MM-dd'))
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

function Fail([string]$msg) { Write-Host "FAIL: $msg" -ForegroundColor Red; exit 1 }
function Step([string]$msg) { Write-Host "== $msg" -ForegroundColor Cyan }

if ($Store -notmatch '^[a-z0-9][a-z0-9-]*\.myshopify\.com$') {
  Fail "Store must be the full *.myshopify.com domain (got: $Store)"
}

Step "1/6 Preconditions"
node --version *> $null; if (-not $?) { Fail 'Node.js is required' }
if (-not (Test-Path (Join-Path $repo 'node_modules/@shopify/cli'))) {
  Step 'Installing local dependencies (npm install)'
  npm install --no-audit --no-fund; if ($LASTEXITCODE -ne 0) { Fail 'npm install failed' }
}

Step "2/6 Theme Check gate (errors block deployment)"
npx shopify theme check -o json 2>$null | Out-File -Encoding utf8 qa/results/theme-check.json
$tc = Get-Content qa/results/theme-check.json -Raw | ConvertFrom-Json
$errors = 0
foreach ($f in $tc) { foreach ($o in $f.offenses) { if ($o.severity -eq 0) { $errors++ ; Write-Host "  ERROR $($f.path): $($o.message)" } } }
if ($errors -gt 0) { Fail "Theme Check reported $errors error(s) - deployment blocked" }
Write-Host "  Theme Check: 0 errors"

Step "3/6 Store inventory (proves what is live BEFORE we touch anything)"
$themesRaw = npx shopify theme list --store $Store --json 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host $themesRaw
  Fail "Could not list themes. If this is an auth prompt, run once interactively: npx shopify theme list --store $Store"
}
$themes = $themesRaw | ConvertFrom-Json
$live = $themes | Where-Object { $_.role -eq 'live' }
Write-Host ("  Live theme: '{0}' (id {1}) - WILL NOT BE TOUCHED" -f $live.name, $live.id)
$inventoryPath = 'qa/results/store-themes-before.json'
$themes | ConvertTo-Json -Depth 5 | Out-File -Encoding utf8 $inventoryPath

Step "4/6 Push as unpublished theme"
$deployPath = 'qa/results/deploy.json'
$existingId = $null
if (Test-Path $deployPath) {
  $prev = Get-Content $deployPath -Raw | ConvertFrom-Json
  if ($prev.store -eq $Store -and $prev.themeId) {
    $stillThere = $themes | Where-Object { $_.id -eq $prev.themeId }
    if ($stillThere -and $stillThere.role -ne 'live') { $existingId = $prev.themeId }
    if ($stillThere -and $stillThere.role -eq 'live') { Fail 'Recorded staging theme is now LIVE - refusing to touch it.' }
  }
}

if ($existingId) {
  Step "  Updating existing unpublished staging theme id $existingId"
  $pushRaw = npx shopify theme push --store $Store --theme $existingId --json 2>&1
} else {
  Step "  Creating NEW unpublished theme '$ThemeName'"
  $pushRaw = npx shopify theme push --store $Store --unpublished --theme $ThemeName --json 2>&1
}
if ($LASTEXITCODE -ne 0) { Write-Host $pushRaw; Fail 'theme push failed' }
$push = ($pushRaw | Out-String) | ConvertFrom-Json

$themeId = $push.theme.id
if (-not $themeId) { Fail "Could not read theme id from push output: $pushRaw" }

Step "5/6 Verifying the deployed theme role is NOT live"
$after = npx shopify theme list --store $Store --json 2>$null | ConvertFrom-Json
$deployed = $after | Where-Object { $_.id -eq $themeId }
if (-not $deployed) { Fail "Deployed theme id $themeId not found in theme list" }
if ($deployed.role -eq 'live') { Fail "SAFETY VIOLATION: deployed theme reports role 'live'. Investigate immediately." }
Write-Host ("  Confirmed: '{0}' (id {1}) role = {2}" -f $deployed.name, $deployed.id, $deployed.role)

Step "6/6 Recording deployment metadata (no secrets)"
$commit = (git rev-parse HEAD).Trim()
$meta = [ordered]@{
  store       = $Store
  themeId     = $themeId
  themeName   = $deployed.name
  themeRole   = $deployed.role
  previewUrl  = "https://$Store/?preview_theme_id=$themeId"
  editorUrl   = "https://$Store/admin/themes/$themeId/editor"
  liveThemeId = $live.id
  liveTheme   = $live.name
  gitCommit   = $commit
  deployedAt  = (Get-Date -Format 'o')
}
$meta | ConvertTo-Json | Out-File -Encoding utf8 $deployPath
Write-Host ""
Write-Host "DEPLOYED (unpublished):" -ForegroundColor Green
Write-Host "  Preview: $($meta.previewUrl)"
Write-Host "  Editor:  $($meta.editorUrl)"
Write-Host "Next: node scripts/seed-store-data.mjs   (requires SHOPIFY_ADMIN_TOKEN)"
Write-Host "Then: pwsh -File scripts/run-storefront-qa.ps1"

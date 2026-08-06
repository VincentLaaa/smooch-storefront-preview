<#
.SYNOPSIS
  Runs the Smooch storefront QA suite (Playwright) against the deployed
  UNPUBLISHED staging theme.

.PREREQS
  1. scripts/setup-staging.ps1 has run (qa/results/deploy.json exists).
  2. scripts/seed-store-data.mjs has run (qa/results/seed.json exists) —
     the suite still runs without it, using default QA handles.
  3. If the storefront is password-protected (dev stores are), set:
       $env:STORE_PASSWORD = '<storefront password>'
     for this shell only. Never commit it.

.SAFETY
  Read-only against the store except for cart adds/clears in the test
  browser session. Never publishes or edits themes.
#>
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

function Fail([string]$msg) { Write-Host "FAIL: $msg" -ForegroundColor Red; exit 1 }

if (-not (Test-Path 'qa/results/deploy.json')) { Fail 'qa/results/deploy.json missing - run scripts/setup-staging.ps1 first.' }
$deploy = Get-Content 'qa/results/deploy.json' -Raw | ConvertFrom-Json
Write-Host "== Target: $($deploy.store) theme $($deploy.themeId) ($($deploy.themeRole))" -ForegroundColor Cyan
if ($deploy.themeRole -eq 'live') { Fail 'SAFETY: recorded theme is live; refusing to run QA that mutates carts against it.' }
if (-not $env:STORE_PASSWORD) {
  Write-Host 'NOTE: STORE_PASSWORD not set. If the storefront is password-protected the suite will fail fast with a clear message.' -ForegroundColor Yellow
}

Write-Host '== Ensuring Playwright chromium is installed'
npx playwright install chromium
if ($LASTEXITCODE -ne 0) { Fail 'playwright install failed' }

New-Item -ItemType Directory -Force qa/screenshots | Out-Null
New-Item -ItemType Directory -Force qa/results | Out-Null

Write-Host '== Running storefront QA suite'
npx playwright test --config qa/playwright.config.mjs
$code = $LASTEXITCODE

Write-Host ''
if ($code -eq 0) { Write-Host 'QA PASSED. Results: qa/results/playwright.json, screenshots: qa/screenshots/' -ForegroundColor Green }
else { Write-Host "QA FINISHED WITH FAILURES (exit $code). Inspect qa/results/html-report/index.html and qa/results/playwright.json." -ForegroundColor Yellow }
exit $code

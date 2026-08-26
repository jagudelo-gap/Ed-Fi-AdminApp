# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

<#
.SYNOPSIS
Report whether upstream fixes now exist for the GHSA IDs ignored in osv-scanner.toml.

.DESCRIPTION
osv-scanner.toml suppresses GHSA IDs from the Scorecard "Vulnerabilities" check because,
as of when each entry was added, none had a reachable fix: some (brace-expansion,
ip-address, tar, undici, as of this writing) are vendored inside the npm CLI package
itself (via semantic-release -> @semantic-release/npm -> npm's bundleDependencies) and
can't be patched by bumping a normal dependency; others (image-size, as of this writing)
have no patched release at all.

This script re-checks that premise on demand. It reads the GHSA IDs directly out of
osv-scanner.toml (nothing is hardcoded here), and for each one:
  1. Queries the GitHub Security Advisories API to find the affected package name and
     its per-major-version-line vulnerable-range/patched-version pairs.
  2. Looks up every place that package resolves to in package-lock.json to determine
     whether it is *only* reachable as a copy bundled inside npm's own package
     (node_modules/npm/node_modules/<pkg>, with no other resolvable copy in the tree)
     or independently resolvable.
  3. For npm-bundled packages, checks the version bundled inside the latest published
     npm CLI release (not the currently locked version) -- that's what "fixed" would
     require. For independently-resolvable packages, checks the latest registry release.
  4. Compares that against the applicable patched version for the *locked* version's
     vulnerable range (matching per-major-line, since a single GHSA ID can list several).

Prints a table and exits non-zero if any entry now has a usable fix, as a nudge to prune
that entry from osv-scanner.toml.

This does not modify osv-scanner.toml, package.json, or package-lock.json -- it's
read-only reporting.

.PARAMETER GitHubToken
Optional GitHub token to use for the advisories API calls (raises the 60/hour
unauthenticated rate limit). Defaults to $env:GITHUB_TOKEN or $env:GH_TOKEN if set.

.EXAMPLE
# Run locally
./eng/helpers/check-ignored-vuln-fixes.ps1

.EXAMPLE
# Run in CI with an explicit token
./eng/helpers/check-ignored-vuln-fixes.ps1 -GitHubToken $env:GITHUB_TOKEN
#>

param(
  [string]$GitHubToken = $(if ($env:GITHUB_TOKEN) { $env:GITHUB_TOKEN } else { $env:GH_TOKEN })
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$osvScannerTomlPath = Join-Path $repoRoot 'osv-scanner.toml'
$packageLockPath = Join-Path $repoRoot 'package-lock.json'

function Get-IgnoredGhsaIds {
  param([Parameter(Mandatory)][string]$TomlPath)

  if (-not (Test-Path $TomlPath)) {
    throw "osv-scanner.toml not found at $TomlPath."
  }

  $ids = @()
  foreach ($line in (Get-Content $TomlPath)) {
    if ($line -match '^\s*id\s*=\s*"(GHSA-[A-Za-z0-9-]+)"\s*$') {
      $ids += $matches[1]
    }
  }
  return $ids
}

function Test-VersionInRange {
  param([Parameter(Mandatory)][string]$Version, [Parameter(Mandatory)][string]$RangeExpression)

  $currentVersion = [version]$Version
  foreach ($condition in ($RangeExpression -split ',' | ForEach-Object { $_.Trim() })) {
    if ($condition -notmatch '^(<=|>=|<|>|=)\s*(.+)$') {
      throw "Unrecognized version-range condition '$condition' in '$RangeExpression'."
    }
    $operator = $matches[1]
    $boundary = [version]$matches[2]
    $conditionMet = switch ($operator) {
      '<' { $currentVersion -lt $boundary }
      '<=' { $currentVersion -le $boundary }
      '>' { $currentVersion -gt $boundary }
      '>=' { $currentVersion -ge $boundary }
      '=' { $currentVersion -eq $boundary }
    }
    if (-not $conditionMet) { return $false }
  }
  return $true
}

function Get-Advisory {
  param([Parameter(Mandatory)][string]$GhsaId)

  $headers = @{ 'User-Agent' = 'Ed-Fi-AdminApp-vuln-check' }
  if ($GitHubToken) { $headers['Authorization'] = "Bearer $GitHubToken" }

  return Invoke-RestMethod -Uri "https://api.github.com/advisories/$GhsaId" -Headers $headers -ErrorAction Stop
}

function Get-PackageLockResolvedPaths {
  # Every place `package-lock.json` resolves the given package to, as node_modules paths.
  param([Parameter(Mandatory)][string]$PackageName)

  if (-not $script:packageLock) {
    if (-not (Test-Path $packageLockPath)) {
      throw "package-lock.json not found at $packageLockPath."
    }
    # -AsHashtable: package-lock.json's root "packages" entry has an empty-string key
    # (the project itself), which ConvertFrom-Json can't represent as a PSObject property.
    $script:packageLock = Get-Content $packageLockPath -Raw | ConvertFrom-Json -AsHashtable
  }

  $suffix = "node_modules/$PackageName"
  return $script:packageLock.packages.Keys |
    Where-Object { $_ -eq $suffix -or $_.EndsWith("/$suffix") }
}

function Find-VulnerableResolvedInstance {
  # A package can resolve to several different versions at different paths in the
  # lockfile (e.g. an already-patched top-level copy alongside a still-vulnerable copy
  # bundled inside npm CLI). Don't just grab "any" resolved path -- find the specific
  # instance(s) whose locked version actually falls in one of this advisory's vulnerable
  # ranges, since that's the one osv-scanner is actually flagging.
  param([Parameter(Mandatory)][string[]]$ResolvedPaths, [Parameter(Mandatory)]$Advisory)

  $instances = foreach ($path in $ResolvedPaths) {
    $version = $script:packageLock.packages[$path]['version']
    $matchingRange = $Advisory.vulnerabilities | Where-Object {
      Test-VersionInRange -Version $version -RangeExpression $_.vulnerable_version_range
    } | Select-Object -First 1
    if ($matchingRange) {
      [PSCustomObject]@{
        Path           = $path
        Version        = $version
        IsBundledInNpm = ($path -match '(^|/)node_modules/npm/node_modules/')
        PatchedVersion = $matchingRange.first_patched_version
      }
    }
  }
  return $instances
}

function Get-BundledNpmDependencyVersion {
  param([Parameter(Mandatory)][string]$PackageName)

  if (-not $script:npmPackExtractDir) {
    $script:npmPackExtractDir = Join-Path ([System.IO.Path]::GetTempPath()) "npm-cli-pack-$([guid]::NewGuid())"
    New-Item -ItemType Directory -Path $script:npmPackExtractDir | Out-Null
    Write-Host 'Downloading latest npm CLI package to inspect its bundled dependencies...' -ForegroundColor Cyan
    Push-Location $script:npmPackExtractDir
    try {
      npm pack npm@latest --silent | Out-Null
      $tarball = Get-ChildItem -Filter 'npm-*.tgz' | Select-Object -First 1
      if (-not $tarball) { throw 'npm pack did not produce a tarball for the npm package.' }
      tar -xzf $tarball.Name
    }
    finally {
      Pop-Location
    }
  }

  $depPackageJson = Join-Path $script:npmPackExtractDir "package\node_modules\$PackageName\package.json"
  if (-not (Test-Path $depPackageJson)) {
    return $null
  }
  return (Get-Content $depPackageJson -Raw | ConvertFrom-Json).version
}

function Get-LatestRegistryVersion {
  param([Parameter(Mandatory)][string]$PackageName)
  return (npm view $PackageName version).Trim()
}

function Test-VersionAtLeast {
  param([string]$Current, [string]$Minimum)
  if (-not $Current -or -not $Minimum) { return $false }
  try {
    return ([version]$Current) -ge ([version]$Minimum)
  }
  catch {
    # Non-strict-semver version string (rare for these packages); treat as unknown/not-fixed.
    return $false
  }
}

$ignoredGhsaIds = Get-IgnoredGhsaIds -TomlPath $osvScannerTomlPath
if (-not $ignoredGhsaIds) {
  Write-Host 'No [[IgnoredVulns]] entries found in osv-scanner.toml. Nothing to check.' -ForegroundColor Green
  exit 0
}

$results = @()
$resolvedPathsCache = @{}
$latestReachableVersionCache = @{}

foreach ($ghsaId in $ignoredGhsaIds) {
  Write-Host "Checking $ghsaId..." -ForegroundColor DarkGray

  $advisory = Get-Advisory -GhsaId $ghsaId
  $packageName = $advisory.vulnerabilities[0].package.name
  if (-not $packageName) {
    $results += [PSCustomObject]@{
      GhsaId = $ghsaId; Package = '(unknown)'; Source = '?'
      Locked = '?'; Patched = '?'; Status = 'CHECK FAILED (advisory has no npm package entry)'
    }
    continue
  }

  if (-not $resolvedPathsCache.ContainsKey($packageName)) {
    $resolvedPathsCache[$packageName] = Get-PackageLockResolvedPaths -PackageName $packageName
  }
  $resolvedPaths = $resolvedPathsCache[$packageName]

  if (-not $resolvedPaths) {
    $results += [PSCustomObject]@{
      GhsaId = $ghsaId; Package = $packageName; Source = '?'
      Locked = '(not found)'; Patched = '?'; Status = 'CHECK FAILED (package not found in package-lock.json)'
    }
    continue
  }

  $vulnerableInstances = Find-VulnerableResolvedInstance -ResolvedPaths $resolvedPaths -Advisory $advisory
  if (-not $vulnerableInstances) {
    $results += [PSCustomObject]@{
      GhsaId = $ghsaId; Package = $packageName; Source = '(multiple copies)'
      Locked = '(none in vulnerable range)'; Patched = '?'
      Status = 'NOT AFFECTED (locked version(s) already outside the vulnerable range)'
    }
    continue
  }

  # In this repo's cases there is exactly one vulnerable instance per GHSA ID; if that
  # ever isn't true, report the worst case: bundled-in-npm (harder to fix) wins.
  $vulnerableInstance = $vulnerableInstances | Sort-Object { -[int]$_.IsBundledInNpm } | Select-Object -First 1
  $isBundledInNpm = $vulnerableInstance.IsBundledInNpm
  $lockedVersion = $vulnerableInstance.Version
  $patchedVersion = $vulnerableInstance.PatchedVersion

  if (-not $latestReachableVersionCache.ContainsKey("$packageName|$isBundledInNpm")) {
    $latestReachableVersionCache["$packageName|$isBundledInNpm"] = if ($isBundledInNpm) {
      Get-BundledNpmDependencyVersion -PackageName $packageName
    }
    else {
      Get-LatestRegistryVersion -PackageName $packageName
    }
  }
  $latestReachableVersion = $latestReachableVersionCache["$packageName|$isBundledInNpm"]

  $fixed = Test-VersionAtLeast -Current $latestReachableVersion -Minimum $patchedVersion

  $status = if ($fixed) {
    'FIX AVAILABLE'
  }
  elseif (-not $patchedVersion) {
    'NO FIX YET'
  }
  elseif ($isBundledInNpm) {
    'BLOCKED (npm CLI has not re-bundled the fix)'
  }
  else {
    'FIX AVAILABLE ELSEWHERE (bump the dependency)'
  }

  $results += [PSCustomObject]@{
    GhsaId  = $ghsaId
    Package = $packageName
    Source  = if ($isBundledInNpm) { 'bundled in npm CLI' } else { 'npm registry' }
    Locked  = $lockedVersion
    Patched = if ($patchedVersion) { $patchedVersion } else { '(none)' }
    Status  = $status
  }
}

# Force a wide render so PowerShell doesn't truncate columns to the runner's
# (often narrow/non-interactive) reported console width.
$results | Format-Table -AutoSize -Wrap | Out-String -Width 4096 | Write-Host

if ($env:GITHUB_STEP_SUMMARY) {
  # The raw Actions log doesn't render tables at all; write a Markdown table to the
  # job summary instead, which GitHub renders nicely on the workflow run page.
  $summary = "### Ignored vulnerability fix check`n`n"
  $summary += "| GHSA ID | Package | Source | Locked | Patched | Status |`n"
  $summary += "|---|---|---|---|---|---|`n"
  foreach ($r in $results) {
    $summary += "| $($r.GhsaId) | $($r.Package) | $($r.Source) | $($r.Locked) | $($r.Patched) | $($r.Status) |`n"
  }
  Add-Content -Path $env:GITHUB_STEP_SUMMARY -Value $summary
}

$fixesAvailable = $results | Where-Object { $_.Status -like 'FIX AVAILABLE*' }
if ($fixesAvailable) {
  Write-Host ''
  Write-Host "$($fixesAvailable.Count) ignored GHSA ID(s) now have a usable fix -- remove them from osv-scanner.toml:" -ForegroundColor Yellow
  $fixesAvailable | ForEach-Object { Write-Host "  - $($_.GhsaId) ($($_.Package))" -ForegroundColor Yellow }
  exit 1
}

Write-Host ''
Write-Host 'All ignored GHSA IDs are still unfixable upstream. No action needed.' -ForegroundColor Green
exit 0

# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

<#
.SYNOPSIS
Run Bruno API E2E tests (all/tag/request) with optional compose start, auth bootstrap, and seed data.

.DESCRIPTION
Orchestrates Bruno test runs with Keycloak token acquisition, optional docker compose services
startup, auth bootstrap, and data seeding. Supports filtered execution by tag or request name.

.PARAMETER Env
Environment to run against ('local' or 'ci'). Defaults to 'local'.

.PARAMETER StartServices
If specified, starts docker compose services before running tests.

.PARAMETER BootstrapAuth
If specified, runs the Keycloak bootstrap script to set up clients and test users.

.PARAMETER SeedData
If specified, seeds test data (teams, memberships) via API.

.PARAMETER TeamId
Team ID to use for tests that require it. Defaults to 1.

.PARAMETER GrantType
OAuth grant type for token acquisition ('client_credentials' or 'password'). Defaults to 'client_credentials'.

.PARAMETER Tag
Run only requests with this tag ('App' or 'Auth'). If not specified, runs all requests.

.PARAMETER Request
Run only the request with this name.

.PARAMETER Collection
Run only requests in this collection/folder.

.EXAMPLE
# Run all tests in local environment with services, bootstrap, and seed
./eng/testing/run-bruno.ps1 -StartServices -BootstrapAuth -SeedData -Env local

# Run only App tag tests
./eng/testing/run-bruno.ps1 -Env local -Tag App

# Run specific request
./eng/testing/run-bruno.ps1 -Env local -Request auth-me
#>

param(
  [string]$Env = 'local',
  [switch]$StartServices,
  [switch]$BootstrapAuth,
  [switch]$SeedData,
  [int]$TeamId = 1,
  [ValidateSet('client_credentials','password')][string]$GrantType = 'client_credentials',
  [ValidateSet('App','Auth')][string]$Tag,
  [string]$Request,
  [string]$Collection
)

# Get-Content .env | Where-Object { $_ -match '=' -and $_ -notmatch '^#' } | ForEach-Object { $name, $value = $_ -split '=', 2; [System.Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim(), 'Process') }

$ErrorActionPreference = 'Stop'
$teamIdProvided = $PSBoundParameters.ContainsKey('TeamId')

function Set-TeamId {
  if ($teamIdProvided) {
    Write-Host "Using explicit TEAM_ID: $TeamId" -ForegroundColor Cyan
    $env:TEAM_ID = "$TeamId"
  }
}

function Resolve-RequestTarget {
  param(
    [Parameter(Mandatory = $true)]
    [string]$WorkspacePath,
    [Parameter(Mandatory = $true)]
    [string]$RequestName,
    [string]$TagFilter
  )

  $normalizedRequest = $RequestName.Trim()
  if (-not $normalizedRequest) {
    throw 'Request name cannot be empty.'
  }

  $relativeCandidates = @()
  if ($normalizedRequest -match '^(?i)(app|auth)-(.+)$') {
    $relativeCandidates += "tests/api/collections/$($Matches[1].ToLowerInvariant())/$($Matches[2]).bru"
  }
  if ($TagFilter) {
    $relativeCandidates += "tests/api/collections/$($TagFilter.ToLowerInvariant())/$normalizedRequest.bru"
  }
  $relativeCandidates += "tests/api/collections/app/$normalizedRequest.bru"
  $relativeCandidates += "tests/api/collections/auth/$normalizedRequest.bru"
  $relativeCandidates += "tests/api/$normalizedRequest.bru"

  foreach ($candidate in ($relativeCandidates | Select-Object -Unique)) {
    $candidatePath = Join-Path $WorkspacePath ($candidate -replace '/', '\')
    if (Test-Path $candidatePath) {
      return $candidatePath.Substring($WorkspacePath.Length + 1)
    }
  }

  $searchFileNames = @("$normalizedRequest.bru")
  if ($normalizedRequest -match '^(?i)(app|auth)-(.+)$') {
    $searchFileNames += "$($Matches[2]).bru"
  }

  foreach ($fileName in ($searchFileNames | Select-Object -Unique)) {
    $requestFile = Get-ChildItem -Path $WorkspacePath -Recurse -Filter $fileName | Select-Object -First 1
    if ($requestFile) {
      return $requestFile.FullName.Substring($WorkspacePath.Length + 1)
    }
  }

  throw "Request '$RequestName' was not found under $WorkspacePath."
}

function Invoke-SeedDataOnly {
  Write-Host "Seeding test data..." -ForegroundColor Cyan
  & (Join-Path $PSScriptRoot '..\helpers\bootstrap-keycloak-for-tests.ps1') -SeedDataOnly
  Set-TeamId
  if (-not $env:TEAM_ID) {
    throw 'Unable to determine TEAM_ID after seeding.'
  }

  Write-Host "Data seeded successfully." -ForegroundColor Green
}

Set-TeamId

# Step 1: Start docker compose services if requested
if ($StartServices) {
  Write-Host "Starting docker compose services..." -ForegroundColor Cyan
  & (Join-Path $PSScriptRoot '..\helpers\start-all-services-test-docker.ps1')
  Write-Host "Services started." -ForegroundColor Green
}

# Step 2: Run Keycloak bootstrap if requested
if ($BootstrapAuth) {
  Write-Host "Running Keycloak bootstrap..." -ForegroundColor Cyan
  & (Join-Path $PSScriptRoot '..\helpers\bootstrap-keycloak-for-tests.ps1')
  Set-TeamId
  Write-Host "Keycloak bootstrap complete." -ForegroundColor Green
}

# Step 3-4: Acquire access token
try {
  $env:ACCESS_TOKEN = & (Join-Path $PSScriptRoot '..\helpers\get-bruno-token.ps1') -Env $Env -GrantType $GrantType -NoFileWrite
} catch {
  Write-Host "Failed to acquire token: $_" -ForegroundColor Red
  Write-Host "Proceeding without token. Tests may fail if authentication is required." -ForegroundColor Yellow
}

# Step 5: Build Bruno command with filters
$workspacePath = Resolve-Path (Join-Path $PSScriptRoot '..\..\tests\api')
$targetPath = '.'
$runRecursive = $true
$isAuthRequest = $false

if ($Tag) {
  switch ($Tag) {
    'App' { $targetPath = 'collections/app' }
    'Auth' {
      $targetPath = 'collections/auth'
      $isAuthRequest = $true
    }
  }
}

if ($Collection) {
  $targetPath = $Collection
  $normalizedCollection = $Collection.Replace('\', '/').Trim('/').ToLowerInvariant()
  if ($normalizedCollection -eq 'collections/auth' -or $normalizedCollection -eq 'auth') {
    $isAuthRequest = $true
  }
}

if ($Request) {
  $targetPath = Resolve-RequestTarget -WorkspacePath $workspacePath.Path -RequestName $Request -TagFilter $Tag
  $normalizedTargetPath = $targetPath.Replace('\', '/').ToLowerInvariant()
  if ($normalizedTargetPath.StartsWith('collections/auth/')) {
    $isAuthRequest = $true
  }
  $runRecursive = $false
}

if (-not $Request -and -not $Collection -and -not $Tag) {
  $isAuthRequest = $true
}

if (-not $env:TEAM_ID -and ($SeedData -or $isAuthRequest)) {
  Invoke-SeedDataOnly
}

$null = New-Item -ItemType Directory -Path "tests/api/test-results" -Force
$bruArgs = @('run', $targetPath, '--env', $Env, '--insecure', '--reporter-html', './test-results/results.html', '--reporter-junit', './test-results/report.xml')
if ($env:ACCESS_TOKEN) {
  $bruArgs += '--env-var'
  $bruArgs += "ACCESS_TOKEN=$env:ACCESS_TOKEN"
}
if ($env:TEAM_ID) {
  $bruArgs += '--env-var'
  $bruArgs += "TEAM_ID=$env:TEAM_ID"
}
if ($runRecursive) {
  $bruArgs += '-r'
}

# Step 6: Run Bruno tests from the workspace directory
Write-Host "Running Bruno tests from $workspacePath..." -ForegroundColor Cyan
Push-Location $workspacePath
& bru @bruArgs
$bruExitCode = $LASTEXITCODE
Pop-Location

if ($bruExitCode -ne 0) { exit $bruExitCode }

Write-Host "Tests completed successfully." -ForegroundColor Green

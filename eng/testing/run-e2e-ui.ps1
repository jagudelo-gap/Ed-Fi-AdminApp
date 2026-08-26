# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

<#
.SYNOPSIS
Runs the Playwright BDD E2E UI test suite against a freshly provisioned stack.

.DESCRIPTION
Downloads the ODS Minimal Template backup (if missing), starts Docker Compose
services (PostgreSQL or SQL Server for the Admin App database), waits for
readiness, creates the local Keycloak test user, and runs the Playwright BDD
suite.

.PARAMETER DbEngine
Admin App database engine: 'pgsql' or 'mssql'. Defaults to 'pgsql'.

.PARAMETER Rebuild
Rebuild Admin App images before starting services.

.PARAMETER StopServices
Stop Docker Compose services after the test run (success or failure).

.EXAMPLE
./eng/testing/run-e2e-ui.ps1 -DbEngine mssql -Rebuild -StopServices
#>

param(
  [ValidateSet('pgsql', 'mssql')]
  [string]$DbEngine = 'pgsql',
  [switch]$Rebuild,
  [switch]$StopServices
)

$ErrorActionPreference = 'Stop'

if ($PSVersionTable.PSVersion.Major -lt 6) {
  Write-Host "ERROR! This script requires PowerShell 7+ (pwsh). You are running PowerShell $($PSVersionTable.PSVersion) ($($PSVersionTable.PSEdition))." -ForegroundColor Red
  Write-Host 'Run this script with pwsh instead, e.g.: pwsh ./eng/testing/run-e2e-ui.ps1' -ForegroundColor Red
  exit 1
}

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

function Test-Prerequisites {
  $missing = @()

  if (-not (Test-Path (Join-Path $repoRoot 'node_modules'))) {
    $missing += 'node_modules not found. Run: npm ci --legacy-peer-deps'
  }

  $playwrightBrowsersPath = if ($env:PLAYWRIGHT_BROWSERS_PATH) {
    $env:PLAYWRIGHT_BROWSERS_PATH
  } else {
    if ($IsWindows) {
      Join-Path $env:LOCALAPPDATA 'ms-playwright'
    } elseif ($IsMacOS) {
      Join-Path $env:HOME 'Library/Caches/ms-playwright'
    } else {
      Join-Path $env:HOME '.cache/ms-playwright'
    }
  }
  $chromiumInstalled = $false
  if (Test-Path $playwrightBrowsersPath) {
    $chromiumInstalled = @(Get-ChildItem -Path $playwrightBrowsersPath -Directory -Filter 'chromium-*' -ErrorAction SilentlyContinue).Count -gt 0
  }
  if (-not $chromiumInstalled) {
    $missing += 'Playwright Chromium browser not found. Run: npx playwright install --with-deps chromium'
  }

  $certPath = Join-Path $repoRoot 'compose/ssl/server.crt'
  if (-not (Test-Path $certPath)) {
    $missing += 'Local TLS certificate not found at compose/ssl/server.crt. Run: bash ./compose/ssl/generate-certificate.sh'
  }

  if ($missing.Count -gt 0) {
    Write-Host 'ERROR! Missing prerequisites:' -ForegroundColor Red
    foreach ($item in $missing) {
      Write-Host "  - $item" -ForegroundColor Red
    }
    exit 1
  }
}

function Get-OdsMinimalTemplateBackup {
  $backupDir = Join-Path $repoRoot 'compose/db-backup'
  $minimalSqlPath = Join-Path $backupDir 'EdFi.Ods.Minimal.Template.sql'
  $populatedSqlPath = Join-Path $backupDir 'EdFi.Ods.Populated.Template.sql'

  if ((Test-Path $minimalSqlPath) -and (Test-Path $populatedSqlPath)) {
    Write-Host 'ODS Minimal Template backup already present, skipping download.' -ForegroundColor Cyan
    return
  }

  $packageName = 'EdFi.Suite3.Ods.Minimal.Template.PostgreSQL.Standard.4.0.0'
  $packageVersion = '7.3.20068'
  $feedUrl = "https://pkgs.dev.azure.com/ed-fi-alliance/Ed-Fi-Alliance-OSS/_packaging/EdFi/nuget/v3/flat2/$packageName/$packageVersion/$packageName.$packageVersion.nupkg"

  New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

  Write-Host "Downloading $packageName v$packageVersion..." -ForegroundColor Cyan
  $nupkgPath = Join-Path $backupDir 'package.nupkg'
  $zipPath = Join-Path $backupDir 'package.zip'
  $pkgDir = Join-Path $backupDir 'pkg'

  try {
    Invoke-WebRequest -Uri $feedUrl -OutFile $nupkgPath
    Copy-Item -Path $nupkgPath -Destination $zipPath -Force
    Expand-Archive -Path $zipPath -DestinationPath $pkgDir -Force

    $srcSql = Get-ChildItem -Path $pkgDir -Filter '*.sql' -Recurse | Select-Object -First 1
    if (-not $srcSql) {
      throw 'ERROR: No .sql file found inside the NuGet package'
    }
    Write-Host "Found: $($srcSql.FullName)" -ForegroundColor Cyan

    Copy-Item -Path $srcSql.FullName -Destination $minimalSqlPath -Force
    Copy-Item -Path $minimalSqlPath -Destination $populatedSqlPath -Force
  }
  finally {
    Remove-Item -Path $nupkgPath, $zipPath -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $pkgDir -Recurse -Force -ErrorAction SilentlyContinue
  }

  Write-Host "Backup files ready in $backupDir" -ForegroundColor Green
}

Test-Prerequisites
Get-OdsMinimalTemplateBackup

function Set-AdminAppEnvFile {
  param(
    [ValidateSet('pgsql', 'mssql')]
    [string]$Engine
  )

  $envExamplePath = Join-Path $repoRoot 'compose/.env.example'
  $envPath = Join-Path $repoRoot 'compose/.env'

  if (Test-Path $envPath) {
    Write-Host "WARNING: compose/.env already exists and is about to be overwritten/regenerated from compose/.env.example. Any local customizations (image tags, secrets, dataset choice) will be lost." -ForegroundColor Yellow
  }

  Copy-Item -Path $envExamplePath -Destination $envPath -Force

  if ($Engine -ne 'mssql') {
    return
  }

  $mssqlPassword = 'YourStrong!Passw0rd'
  $script:mssqlSaPassword = $mssqlPassword
  $content = Get-Content -Path $envPath

  $substitutionsFired = 0

  $content = $content | ForEach-Object {
    switch -Regex ($_) {
      '^DB_ENGINE=pgsql$' { $substitutionsFired++; 'DB_ENGINE=mssql' }
      '^# MSSQL_PORT_EXPOSED=1433$' { $substitutionsFired++; 'MSSQL_PORT_EXPOSED=1433' }
      '^# MSSQL_ACCEPT_EULA=Y$' { $substitutionsFired++; 'MSSQL_ACCEPT_EULA=Y' }
      '^# MSSQL_SA_PASSWORD=.*$' { $substitutionsFired++; "MSSQL_SA_PASSWORD=$mssqlPassword" }
      '^# MSSQL_IMAGE_TAG=2022-latest$' { $substitutionsFired++; 'MSSQL_IMAGE_TAG=2022-latest' }
      '^DB_SECRET_VALUE=\{"DB_HOST".*$' { $substitutionsFired++; "# $_" }
      '^# DB_SECRET_VALUE=\{"MSSQL_DB_HOST".*$' {
        $substitutionsFired++
        ($_ -replace '^# ', '') -replace '"MSSQL_DB_PASSWORD":"[^"]*"', "`"MSSQL_DB_PASSWORD`":`"$mssqlPassword`""
      }
      default { $_ }
    }
  }

  $expectedSubstitutions = 6
  if ($substitutionsFired -lt $expectedSubstitutions) {
    throw "compose/.env.example did not match the expected MSSQL patch patterns: only $substitutionsFired of $expectedSubstitutions substitutions fired. compose/.env.example may have been reformatted; update the regex patterns in Set-AdminAppEnvFile."
  }

  Set-Content -Path $envPath -Value $content
  Write-Host "compose/.env patched for MSSQL (DB_ENGINE=mssql)." -ForegroundColor Cyan
}

Set-AdminAppEnvFile -Engine $DbEngine

function Test-MssqlSbaaDatabaseExists {
  $sqlcmdArgs = @(
    'exec', 'edfiadminapp-mssql',
    '/opt/mssql-tools18/bin/sqlcmd',
    '-S', 'localhost',
    '-U', 'sa',
    '-P', $script:mssqlSaPassword,
    '-C',
    '-Q', "SET NOCOUNT ON; SELECT DB_ID('sbaa')"
  )
  try {
    $output = & docker @sqlcmdArgs 2>$null
    if ($LASTEXITCODE -ne 0) { return $false }
    return ($output -join "`n") -notmatch 'NULL' -and ($output -join "`n") -match '\d'
  } catch {
    return $false
  }
}

function Wait-ForAdminAppReadiness {
  param(
    [ValidateSet('pgsql', 'mssql')]
    [string]$DbEngine
  )

  $apiUrl = 'https://localhost/adminapp-api/api/healthcheck'
  $feUrl = 'https://localhost/adminapp/'
  $keycloakUrl = 'https://localhost/auth/realms/edfi/.well-known/openid-configuration'
  $keycloakLoginUrl = 'https://localhost/auth/realms/edfi/protocol/openid-connect/auth?client_id=edfiadminapp&redirect_uri=https%3A%2F%2Flocalhost%2Fadminapp-api%2Fapi%2Fauth%2Fcallback%2F1&response_type=code&scope=openid%20profile%20email'

  $requiredStableChecks = 3
  $stableChecks = 0
  $checkMssqlDb = ($DbEngine -eq 'mssql')

  $apiOk = $false
  $feOk = $false
  $keycloakOk = $false
  $keycloakLoginOk = $false
  $mssqlDbOk = $false

  for ($i = 1; $i -le 90; $i++) {
    $apiOk = $false
    $feOk = $false
    $keycloakOk = $false
    $keycloakLoginOk = $false
    $mssqlDbOk = $false

    try { if ((Invoke-WebRequest -Uri $apiUrl -SkipCertificateCheck -UseBasicParsing).StatusCode -eq 200) { $apiOk = $true } } catch {}
    try { if ((Invoke-WebRequest -Uri $feUrl -SkipCertificateCheck -UseBasicParsing).StatusCode -eq 200) { $feOk = $true } } catch {}
    try { if ((Invoke-WebRequest -Uri $keycloakUrl -SkipCertificateCheck -UseBasicParsing).StatusCode -eq 200) { $keycloakOk = $true } } catch {}
    try {
      $loginResponse = Invoke-WebRequest -Uri $keycloakLoginUrl -SkipCertificateCheck -UseBasicParsing
      if ($loginResponse.Content -match 'kc-form-login') { $keycloakLoginOk = $true }
    } catch {}

    if ($checkMssqlDb) {
      $mssqlDbOk = Test-MssqlSbaaDatabaseExists
    } else {
      $mssqlDbOk = $true
    }

    if ($apiOk -and $feOk -and $keycloakOk -and $keycloakLoginOk -and $mssqlDbOk) {
      $stableChecks++
      Write-Host "Readiness OK ($stableChecks/$requiredStableChecks)" -ForegroundColor Green
    } else {
      $stableChecks = 0
      $mssqlDbSuffix = if ($checkMssqlDb) { " MSSQL_SBAA_DB=$mssqlDbOk" } else { '' }
      Write-Host "Waiting... API=$apiOk FE=$feOk KEYCLOAK_META=$keycloakOk KEYCLOAK_LOGIN=$keycloakLoginOk$mssqlDbSuffix ($i/90)" -ForegroundColor Yellow
    }

    if ($stableChecks -ge $requiredStableChecks) {
      Write-Host 'Admin App API, FE, and Keycloak metadata/login are stable' -ForegroundColor Green
      return
    }

    Start-Sleep -Seconds 3
  }

  $mssqlDbSuffix = if ($checkMssqlDb) { " MSSQL_SBAA_DB=$mssqlDbOk" } else { '' }
  throw "Timed out waiting for stable Admin App services (last state: API=$apiOk FE=$feOk KEYCLOAK_META=$keycloakOk KEYCLOAK_LOGIN=$keycloakLoginOk$mssqlDbSuffix)"
}

function Show-AdminAppServiceLogs {
  $containers = @('edfiadminapp-api', 'edfiadminapp-fe', 'edfiadminapp-mssql', 'edfiadminapp-postgres', 'edfiadminapp-keycloak')
  Write-Host '--- Container logs (diagnostics for the failure above) ---' -ForegroundColor Magenta
  foreach ($container in $containers) {
    try {
      $exists = docker ps -a --filter "name=^/$container`$" --format '{{.Names}}' 2>$null
      if (-not $exists) { continue }
      Write-Host "--- docker logs $container (last 200 lines) ---" -ForegroundColor Magenta
      docker logs --tail 200 $container 2>&1 | Write-Host
    } catch {
      Write-Host "Could not retrieve logs for $container`: $_" -ForegroundColor Yellow
    }
  }
  Write-Host '--- End container logs ---' -ForegroundColor Magenta
}

$testExitCode = 1
try {
  & (Join-Path $repoRoot 'eng/helpers/start-services-target.ps1') -V6 -OdsV7AdminV2 -IncludeAdminApp -Rebuild:$Rebuild -MSSQL:($DbEngine -eq 'mssql')
  if ($LASTEXITCODE -ne 0) { throw 'Failed to start Docker Compose services.' }

  Wait-ForAdminAppReadiness -DbEngine $DbEngine

  & (Join-Path $repoRoot 'eng/helpers/create-local-user-keycloak.ps1')
  if ($LASTEXITCODE -ne 0) { throw 'Failed to create local Keycloak user.' }

  Push-Location $repoRoot
  try {
    npm run test:e2e:bdd
    $testExitCode = $LASTEXITCODE
  }
  finally {
    Pop-Location
  }
}
catch {
  Write-Host "ERROR: $_" -ForegroundColor Red
  Show-AdminAppServiceLogs
  throw
}
finally {
  if ($StopServices) {
    Write-Host 'Stopping Docker Compose services...' -ForegroundColor Cyan
    & (Join-Path $repoRoot 'compose/stop.ps1')
  }
}

exit $testExitCode

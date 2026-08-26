# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

<#
.SYNOPSIS
Acquire a Keycloak access token and write it into a Bruno environment file.

.DESCRIPTION
Requests an OAuth token from Keycloak (same token-acquisition logic as
run-bruno.ps1) and writes it into the ACCESS_TOKEN var of the given Bruno
environment file under tests/api/environments. Run this once, then use the
Bruno GUI or `bru run` directly against that environment without going
through run-bruno.ps1.

.PARAMETER Env
Bruno environment to update ('local' or 'ci'). Defaults to 'local'.

.PARAMETER GrantType
OAuth grant type for token acquisition ('client_credentials' or 'password'). Defaults to 'client_credentials'.

.PARAMETER NoFileWrite
If specified, skip writing the token into the Bruno environment file. The token is still
written to the pipeline, so callers can capture it (e.g. `$token = ./get-bruno-token.ps1 -NoFileWrite`).

.EXAMPLE
# Get a token and store it in tests/api/environments/local.bru
./eng/helpers/get-bruno-token.ps1

.EXAMPLE
# Get a token via password grant and store it in tests/api/environments/ci.bru
./eng/helpers/get-bruno-token.ps1 -Env ci -GrantType password

.EXAMPLE
# Get a token without touching any file, for use by another script
$token = ./eng/helpers/get-bruno-token.ps1 -NoFileWrite
#>

param(
  [ValidateSet('local', 'ci')][string]$Env = 'local',
  [ValidateSet('client_credentials', 'password')][string]$GrantType = 'client_credentials',
  [switch]$NoFileWrite
)

$ErrorActionPreference = 'Stop'

function Invoke-InsecureRestMethod {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$Parameters
  )

  if ($PSVersionTable.PSVersion.Major -ge 7) {
    return Invoke-RestMethod @Parameters -SkipCertificateCheck
  }

  [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
  return Invoke-RestMethod @Parameters
}

# Set OIDC defaults if not already set
if (-not $env:OIDC_ISSUER) {
  $env:OIDC_ISSUER = 'https://localhost/auth/realms/edfi'
}
if (-not $env:OIDC_CLIENT_ID) {
  $env:OIDC_CLIENT_ID = 'edfiadminapp-machine'
}
if (-not $env:OIDC_CLIENT_SECRET) {
  $env:OIDC_CLIENT_SECRET = 'edfi-machine-secret-456'
}
if (-not $env:OIDC_USERNAME) {
  $env:OIDC_USERNAME = 'edfi-adminapp-test'
}
if (-not $env:OIDC_PASSWORD) {
  $env:OIDC_PASSWORD = '123'
}

# Acquire access token
Write-Host "Acquiring access token from $($env:OIDC_ISSUER)..." -ForegroundColor Cyan
$tokenEndpoint = "$($env:OIDC_ISSUER.TrimEnd('/'))/protocol/openid-connect/token"

$body = if ($GrantType -eq 'client_credentials') {
  @{
    grant_type = 'client_credentials'
    client_id = $env:OIDC_CLIENT_ID
    client_secret = $env:OIDC_CLIENT_SECRET
  }
} else {
  @{
    grant_type = 'password'
    client_id = $env:OIDC_CLIENT_ID
    client_secret = $env:OIDC_CLIENT_SECRET
    username = $env:OIDC_USERNAME
    password = $env:OIDC_PASSWORD
  }
}

$tokenResponse = Invoke-InsecureRestMethod @{
  Method = 'Post'
  Uri = $tokenEndpoint
  Body = $body
  ContentType = 'application/x-www-form-urlencoded'
  ErrorAction = 'Stop'
}
$token = $tokenResponse.access_token
if (-not $token) { throw 'No access token in response.' }
Write-Host "Token acquired successfully with $GrantType grant." -ForegroundColor Green

# Write the token into the Bruno environment file
if (-not $NoFileWrite) {
  $repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
  $envFilePath = Join-Path $repoRoot "tests\api\environments\$Env.bru"
  if (-not (Test-Path $envFilePath)) {
    throw "Bruno environment file not found: $envFilePath"
  }

  $envContent = Get-Content -Path $envFilePath -Raw
  $updatedContent = $envContent -replace '(?m)^(\s*ACCESS_TOKEN:).*$', "`${1} $token"
  if ($updatedContent -eq $envContent) {
    throw "ACCESS_TOKEN var not found in $envFilePath; file format may have changed."
  }

  Set-Content -Path $envFilePath -Value $updatedContent -NoNewline
  Write-Host "ACCESS_TOKEN updated in $envFilePath" -ForegroundColor Green
}

return $token

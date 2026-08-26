# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

<#
.SYNOPSIS
Bootstrap Keycloak realm, clients, and seed test data for Admin App API E2E tests.

.DESCRIPTION
Performs the following idempotent operations:
1. Creates or updates Keycloak realm and client configuration
2. Upserts test users (edfi-admin with default password)
3. Seeds test data (teams, memberships) directly via the database (PostgreSQL or MSSQL)

.PARAMETER Realm
Keycloak realm name. Defaults to 'edfi'.

.PARAMETER ClientId
Keycloak client ID. Defaults to 'edfiadminapp-machine'.

.PARAMETER SeedDataOnly
If specified, skip Keycloak setup and only seed test data via the database.

.EXAMPLE
# Full bootstrap: realm + client + users + database seed
./eng/bootstrap-keycloak-for-tests.ps1

# Database seed data only (assumes Keycloak already set up)
./eng/bootstrap-keycloak-for-tests.ps1 -SeedDataOnly

#>

param(
  [ValidateSet('Keycloak')]
  [string]$Provider = 'Keycloak',
  [string]$Realm = 'edfi',
  [string]$ClientId = 'edfiadminapp-machine',
  [switch]$SeedDataOnly
)

$ErrorActionPreference = 'Stop'

if ($Provider -ne 'Keycloak') {
  throw "Unsupported provider '$Provider'."
}

Write-Host "Bootstrap Keycloak for E2E tests - Realm: $Realm, Client: $ClientId" -ForegroundColor Cyan
$keycloakBaseUrl = 'https://localhost/auth'

# Set up OIDC defaults if not already set
if (-not $env:OIDC_ISSUER) {
  $env:OIDC_ISSUER = 'https://localhost/auth/realms/edfi'
}
if (-not $env:OIDC_ADMIN_USER) {
  $env:OIDC_ADMIN_USER = 'admin'
}
if (-not $env:OIDC_ADMIN_PASSWORD) {
  $env:OIDC_ADMIN_PASSWORD = 'admin'
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
if (-not $env:API_BASE_URL) {
  $env:API_BASE_URL = 'https://localhost/adminapp-api/api'
}

$machineClientConfigPath = Join-Path $PSScriptRoot '..\..\compose\settings\keycloak_edfiadminapp_machine_client.json'
$machineClientConfig = Get-Content $machineClientConfigPath -Raw | ConvertFrom-Json

# Suppress certificate validation for local testing
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

function Invoke-DatabaseSql {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Sql
  )

  $dbEngine = if ($env:DB_ENGINE) { $env:DB_ENGINE } else { 'pgsql' }
  $sqlFile = Join-Path $PSScriptRoot 'seed-machine-user.sql'
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($sqlFile, $Sql, $utf8NoBom)

  try {
    if ($dbEngine -eq 'mssql') {
      $dbName = if ($env:MSSQL_DB) { $env:MSSQL_DB } else { 'sbaa' }
      $saPassword = if ($env:MSSQL_SA_PASSWORD) { $env:MSSQL_SA_PASSWORD } else { 'YourStrong!Passw0rd' }
      $dbContainer = if ($env:MSSQL_DB_HOST) { $env:MSSQL_DB_HOST } else { 'edfiadminapp-mssql' }
      docker cp $sqlFile "${dbContainer}:/tmp/seed-machine-user.sql" | Out-Null
      docker exec $dbContainer /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P $saPassword -d $dbName -i /tmp/seed-machine-user.sql | Out-Null
      docker exec $dbContainer rm /tmp/seed-machine-user.sql | Out-Null
    } else {
      $dbName = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { 'sbaa' }
      $dbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { 'postgres' }
      $dbContainer = if ($env:POSTGRES_HOST) { $env:POSTGRES_HOST } else { 'edfiadminapp-postgres' }
      docker cp $sqlFile "${dbContainer}:/tmp/seed-machine-user.sql" | Out-Null
      docker exec $dbContainer psql -U $dbUser -d $dbName -f /tmp/seed-machine-user.sql | Out-Null
      docker exec $dbContainer rm /tmp/seed-machine-user.sql | Out-Null
    }
  } finally {
    Remove-Item $sqlFile -ErrorAction SilentlyContinue
  }
}

function Invoke-DatabaseScalarSql {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Sql
  )

  $dbEngine = if ($env:DB_ENGINE) { $env:DB_ENGINE } else { 'pgsql' }
  $sqlFile = Join-Path $PSScriptRoot 'seed-machine-user.sql'
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($sqlFile, $Sql, $utf8NoBom)

  try {
    if ($dbEngine -eq 'mssql') {
      $dbName = if ($env:MSSQL_DB) { $env:MSSQL_DB } else { 'sbaa' }
      $saPassword = if ($env:MSSQL_SA_PASSWORD) { $env:MSSQL_SA_PASSWORD } else { 'YourStrong!Passw0rd' }
      $dbContainer = if ($env:MSSQL_DB_HOST) { $env:MSSQL_DB_HOST } else { 'edfiadminapp-mssql' }
      docker cp $sqlFile "${dbContainer}:/tmp/seed-machine-user.sql" | Out-Null
      $output = & docker exec $dbContainer /opt/mssql-tools18/bin/sqlcmd -C -h -1 -W -S localhost -U sa -P $saPassword -d $dbName -i /tmp/seed-machine-user.sql
      docker exec $dbContainer rm /tmp/seed-machine-user.sql | Out-Null
    } else {
      $dbName = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { 'sbaa' }
      $dbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { 'postgres' }
      $dbContainer = if ($env:POSTGRES_HOST) { $env:POSTGRES_HOST } else { 'edfiadminapp-postgres' }
      docker cp $sqlFile "${dbContainer}:/tmp/seed-machine-user.sql" | Out-Null
      $output = & docker exec $dbContainer psql -t -A -U $dbUser -d $dbName -f /tmp/seed-machine-user.sql
      docker exec $dbContainer rm /tmp/seed-machine-user.sql | Out-Null
    }
  } finally {
    Remove-Item $sqlFile -ErrorAction SilentlyContinue
  }

  if ($output -is [array]) {
    $output = ($output | Where-Object { $_ -and $_.Trim() } | Select-Object -First 1)
  }

  if ($null -eq $output) {
    return $null
  }

  return ($output.ToString()).Trim()
}

function Upsert-AppUser {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Username,
    [Parameter(Mandatory = $true)]
    [ValidateSet('human', 'machine')]
    [string]$UserType,
    [string]$ClientId,
    [string]$Description
  )

  $escapedUsername = $Username -replace "'", "''"
  $escapedClientId = if ($ClientId) { "'" + ($ClientId -replace "'", "''") + "'" } else { 'NULL' }
  $escapedDescription = if ($Description) { "'" + ($Description -replace "'", "''") + "'" } else { 'NULL' }
  $userTypeLiteral = if ($UserType -eq 'machine') { 'machine' } else { 'human' }
  $isActiveLiteral = 'true'
  $dbEngine = if ($env:DB_ENGINE) { $env:DB_ENGINE } else { 'pgsql' }
  if ($dbEngine -eq 'mssql') {
    $isActiveLiteral = '1'
  }

  if ($dbEngine -eq 'mssql') {
    $sql = @"
IF EXISTS (SELECT 1 FROM [user] WHERE [username] = N'$escapedUsername')
BEGIN
  UPDATE [user]
  SET [clientId] = $escapedClientId,
      [description] = $escapedDescription,
      [roleId] = 2,
      [isActive] = $isActiveLiteral,
      [userType] = N'$userTypeLiteral'
  WHERE [username] = N'$escapedUsername';
END
ELSE
BEGIN
  INSERT INTO [user] ([username], [givenName], [familyName], [clientId], [description], [roleId], [isActive], [userType])
  VALUES (N'$escapedUsername', NULL, NULL, $escapedClientId, $escapedDescription, 2, $isActiveLiteral, N'$userTypeLiteral');
END
"@
  } else {
    $sql = @"
INSERT INTO "user" ("username", "givenName", "familyName", "clientId", "description", "roleId", "isActive", "userType")
VALUES ('$escapedUsername', NULL, NULL, $escapedClientId, $escapedDescription, 2, $isActiveLiteral, '$userTypeLiteral')
ON CONFLICT ("username") DO UPDATE SET
  "clientId" = EXCLUDED."clientId",
  "description" = EXCLUDED."description",
  "roleId" = EXCLUDED."roleId",
  "isActive" = EXCLUDED."isActive",
  "userType" = EXCLUDED."userType";
"@
  }

  Invoke-DatabaseSql -Sql $sql
}

# Create user in keycloak
& (Join-Path $PSScriptRoot '..\helpers\create-local-user-keycloak.ps1') -Realm $Realm -Username $env:OIDC_USERNAME -Password $env:OIDC_PASSWORD

# Seed the app users needed for machine and human login flows.
Upsert-AppUser -Username $env:OIDC_USERNAME -UserType human
Upsert-AppUser -Username $ClientId -UserType machine -ClientId $ClientId -Description 'Machine-to-Machine Authentication User'

if (-not $SeedDataOnly) {
  Write-Host "Configuring Keycloak machine client from compose/settings..." -ForegroundColor Yellow

  $kcContainer = if ($env:KEYCLOAK_CONTAINER) { $env:KEYCLOAK_CONTAINER } else { 'edfiadminapp-keycloak' }
  $kcadmConfigPath = '/tmp/mykcadm.config'
  $tempMachineClientPath = Join-Path $PSScriptRoot 'machine-client.json'

  try {
    & docker exec $kcContainer /opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080/auth --realm master --user $env:OIDC_ADMIN_USER --password $env:OIDC_ADMIN_PASSWORD --config $kcadmConfigPath
    if ($LASTEXITCODE -ne 0) { throw 'Unable to authenticate to Keycloak with kcadm.' }

    $existingScopesJson = & docker exec $kcContainer /opt/keycloak/bin/kcadm.sh get client-scopes -r $Realm --config $kcadmConfigPath
    if ($LASTEXITCODE -ne 0) { throw 'Unable to query Keycloak client scopes.' }

    $existingScopes = @()
    if ($existingScopesJson) {
      $existingScopes = $existingScopesJson | ConvertFrom-Json
    }

    $loginAppScope = $existingScopes | Where-Object { $_.name -eq 'login:app' } | Select-Object -First 1

    if (-not $loginAppScope) {
      Write-Host "Creating Keycloak client scope 'login:app'..." -ForegroundColor Cyan
      & docker exec $kcContainer /opt/keycloak/bin/kcadm.sh create client-scopes -r $Realm -s name='login:app' -s description='Access to Ed-Fi Admin App API' -s protocol='openid-connect' --config $kcadmConfigPath
      if ($LASTEXITCODE -ne 0) { throw 'Unable to create the login:app client scope.' }
      $existingScopesJson = & docker exec $kcContainer /opt/keycloak/bin/kcadm.sh get client-scopes -r $Realm --config $kcadmConfigPath
      if ($LASTEXITCODE -ne 0) { throw 'Unable to requery the login:app client scope.' }
      $existingScopes = $existingScopesJson | ConvertFrom-Json
      $loginAppScope = $existingScopes | Where-Object { $_.name -eq 'login:app' } | Select-Object -First 1
    }
    $scopeId = $loginAppScope.id
    if (-not $scopeId) { throw 'Unable to resolve the login:app client scope id.' }

    $machineClientConfig.clientId = $ClientId
    $machineClientConfig.secret = $env:OIDC_CLIENT_SECRET
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($tempMachineClientPath, ($machineClientConfig | ConvertTo-Json -Depth 20), $utf8NoBom)
    docker cp $tempMachineClientPath "${kcContainer}:/tmp/machine-client.json" | Out-Null

    $existingClientsJson = & docker exec $kcContainer /opt/keycloak/bin/kcadm.sh get clients -r $Realm -q "clientId=$ClientId" --config $kcadmConfigPath
    if ($LASTEXITCODE -ne 0) { throw 'Unable to query Keycloak clients.' }

    $existingClients = @()
    if ($existingClientsJson) {
      $existingClients = $existingClientsJson | ConvertFrom-Json
    }

    if ($existingClients.Count -gt 0) {
      Write-Host "Client '$ClientId' already exists. Updating E2E machine client configuration." -ForegroundColor Cyan
      & docker exec $kcContainer /opt/keycloak/bin/kcadm.sh delete clients/$($existingClients[0].id) -r $Realm --config $kcadmConfigPath
      if ($LASTEXITCODE -ne 0) { throw 'Unable to delete the existing machine client.' }
      docker cp $tempMachineClientPath "${kcContainer}:/tmp/machine-client.json" | Out-Null
      & docker exec $kcContainer /opt/keycloak/bin/kcadm.sh create clients -r $Realm -f /tmp/machine-client.json --config $kcadmConfigPath
      if ($LASTEXITCODE -ne 0) { throw 'Unable to recreate the machine client.' }
    } else {
      Write-Host "Creating new client '$ClientId'..." -ForegroundColor Cyan
      & docker exec $kcContainer /opt/keycloak/bin/kcadm.sh create clients -r $Realm -f /tmp/machine-client.json --config $kcadmConfigPath
      if ($LASTEXITCODE -ne 0) { throw 'Unable to create the machine client.' }
    }

    $createdClientsJson = & docker exec $kcContainer /opt/keycloak/bin/kcadm.sh get clients -r $Realm -q "clientId=$ClientId" --config $kcadmConfigPath
    if ($LASTEXITCODE -ne 0) { throw 'Unable to requery the machine client.' }
    $createdClients = @()
    if ($createdClientsJson) {
      $createdClients = $createdClientsJson | ConvertFrom-Json
    }
    if ($createdClients.Count -eq 0 -or -not $createdClients[0].id) {
      throw 'Unable to resolve the recreated machine client id.'
    }
    $clientId = $createdClients[0].id

    & docker exec $kcContainer /opt/keycloak/bin/kcadm.sh update clients/$clientId/default-client-scopes/$scopeId -r $Realm --config $kcadmConfigPath
    if ($LASTEXITCODE -ne 0) { throw 'Unable to add the login:app default client scope.' }

    Write-Host "Client '$ClientId' provisioned successfully." -ForegroundColor Green
  } catch {
    Write-Host "Failed to configure Keycloak client: $_" -ForegroundColor Yellow
  } finally {
    Remove-Item $tempMachineClientPath -ErrorAction SilentlyContinue
  }
}

# Step 4: Seed test data directly via SQL
Write-Host "Seeding test data (teams, memberships)..." -ForegroundColor Yellow

$teamName = 'E2E Test Team'
$teamId = $null
$dbEngine = if ($env:DB_ENGINE) { $env:DB_ENGINE } else { 'pgsql' }

if ($dbEngine -eq 'mssql') {
  $teamId = Invoke-DatabaseScalarSql -Sql @"
IF EXISTS (SELECT 1 FROM [team] WHERE [name] = N'$teamName')
  SELECT TOP 1 [id] FROM [team] WHERE [name] = N'$teamName';
ELSE
BEGIN
  DECLARE @Inserted TABLE (id int);
  INSERT INTO [team] ([name]) OUTPUT inserted.[id] INTO @Inserted VALUES (N'$teamName');
  SELECT TOP 1 id FROM @Inserted;
END
"@
  $membershipSql = @"
IF NOT EXISTS (
  SELECT 1
  FROM [user_team_membership]
  WHERE [teamId] = $teamId
    AND [userId] = (SELECT TOP 1 [id] FROM [user] WHERE [username] = N'$($env:OIDC_USERNAME)')
)
BEGIN
  INSERT INTO [user_team_membership] ([teamId], [userId], [roleId])
  VALUES ($teamId, (SELECT TOP 1 [id] FROM [user] WHERE [username] = N'$($env:OIDC_USERNAME)'), 2);
END
ELSE
BEGIN
  UPDATE [user_team_membership]
  SET [roleId] = 2
  WHERE [teamId] = $teamId
    AND [userId] = (SELECT TOP 1 [id] FROM [user] WHERE [username] = N'$($env:OIDC_USERNAME)');
END
"@
} else {
  $teamId = Invoke-DatabaseScalarSql -Sql @"
SELECT id FROM "team" WHERE "name" = '$teamName' LIMIT 1;
INSERT INTO "team" ("name")
SELECT '$teamName'
WHERE NOT EXISTS (SELECT 1 FROM "team" WHERE "name" = '$teamName')
RETURNING id;
"@
  $membershipSql = @"
INSERT INTO "user_team_membership" ("teamId", "userId", "roleId")
VALUES ($teamId, (SELECT id FROM "user" WHERE "username" = '$($env:OIDC_USERNAME)' LIMIT 1), 2)
ON CONFLICT ("teamId", "userId") DO UPDATE SET
  "roleId" = EXCLUDED."roleId";
"@
}

if (-not $teamId) {
  throw 'Unable to seed the test team.'
}

Invoke-DatabaseSql -Sql $membershipSql
$env:TEAM_ID = $teamId
Write-Host "Test team seeded with ID: $teamId" -ForegroundColor Green

Write-Host "Keycloak bootstrap and data seeding complete!" -ForegroundColor Green

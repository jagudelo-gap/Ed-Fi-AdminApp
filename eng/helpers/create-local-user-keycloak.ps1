# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.
<#
.SYNOPSIS 
    Creates or updates a Keycloak user for local testing with the Ed-Fi Admin App.
.DESCRIPTION
    This script uses the Keycloak Admin CLI (kcadm.sh) to create or update a user in the specified realm. 
    By default, it creates a user with the username 'edfi-adminapp-test' and password '123' in the 'edfi' realm.
    The script authenticates to Keycloak using admin credentials provided via environment variables or defaults.
.PARAMETER Realm
    Keycloak realm name. Defaults to 'edfi'.
.PARAMETER Username
    Keycloak test username. Defaults to 'edfi-adminapp-test'.
.PARAMETER Email
    Keycloak test user email. Defaults to 'admin@example.com'.
.PARAMETER Password
    Keycloak test user password. Defaults to '123'.
.PARAMETER ServerUrl
    Keycloak server URL. Defaults to 'http://localhost:8080/auth'.
.EXAMPLE
# Create a user with default settings
./create-local-user-keycloak.ps1
.EXAMPLE
# Create a user in a custom realm with a specific password
./create-local-user-keycloak.ps1 -Realm myrealm -Username testuser -Password Passw0rd! -Email testuser@example.com
#>
param(
  [string]$Realm = 'edfi',
  [string]$Username = 'edfi-adminapp-test',
  [string]$Email = 'admin@example.com',
  [string]$Password = '123',
  [string]$ServerUrl = 'http://localhost:8080/auth'
)

if (-not $env:OIDC_ADMIN_USER) {
  $env:OIDC_ADMIN_USER = 'admin'
}
if (-not $env:OIDC_ADMIN_PASSWORD) {
  $env:OIDC_ADMIN_PASSWORD = 'admin'
}
$kcContainer = if ($env:KEYCLOAK_CONTAINER) { $env:KEYCLOAK_CONTAINER } else { 'edfiadminapp-keycloak' }
$kcadmConfigPath = '/tmp/mykcadm.config'

docker exec $kcContainer /opt/keycloak/bin/kcadm.sh config credentials --server $ServerUrl --realm master --user $env:OIDC_ADMIN_USER --password $env:OIDC_ADMIN_PASSWORD --config $kcadmConfigPath
if ($LASTEXITCODE -ne 0) { throw 'Unable to authenticate to Keycloak with kcadm.' }

$result = & docker exec $kcContainer /opt/keycloak/bin/kcadm.sh get users --server $ServerUrl --realm master --user $env:OIDC_ADMIN_USER --password $env:OIDC_ADMIN_PASSWORD `
    --target-realm $Realm -q exact=true -q username=$Username
if ($LASTEXITCODE -ne 0) { throw 'Error checking for existing user in Keycloak.' }

if ($result -and $result -ne '[ ]') {
    Write-Host "User $Username already exists in realm $Realm." -ForegroundColor Cyan
} else {
    Write-Host "Creating demo user $Username in realm $Realm..." -ForegroundColor Yellow
    & docker exec $kcContainer /opt/keycloak/bin/kcadm.sh create users --server $ServerUrl --realm master --user $env:OIDC_ADMIN_USER --password $env:OIDC_ADMIN_PASSWORD --config $kcadmConfigPath`
        --target-realm $Realm `
        --set username=$Username `
        --set enabled=true `
        --set emailVerified=true `
        --set "email=$Email" `
        --set "firstName=EdFi" `
        --set "lastName=Admin" `
        --output

    Write-Host "Setting demo password for demo-user in realm $Realm..." -ForegroundColor Yellow
    & docker exec $kcContainer /opt/keycloak/bin/kcadm.sh set-password --server $ServerUrl --realm master --user $env:OIDC_ADMIN_USER --password $env:OIDC_ADMIN_PASSWORD --config $kcadmConfigPath`
        --target-realm $Realm `
        --username $Username `
        --new-password $Password `

    Write-Host "Demo user $Username created and password set in realm $Realm" -ForegroundColor Green
}


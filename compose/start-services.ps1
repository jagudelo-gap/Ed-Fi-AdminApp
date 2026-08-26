# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

<#
.SYNOPSIS
    Starts the Docker Compose services.

.EXAMPLE
    ./start-local.ps1
    Starts the Docker Compose services

.EXAMPLE
    ./start-local.ps1 -MSSQL
    Starts the Docker Compose services with SQL Server instead of PostgreSQL

    If the edfiadminapp-network does not exist, it will be created.
    If the -Rebuild switch is provided as $true, it will rebuild the AdminApp images before starting them.
    If the -MSSQL switch is provided, it will use SQL Server instead of PostgreSQL for the Admin App database.
#>

param(
    # Rebuild the images before starting
    [Switch]
    $Rebuild,

    # Use SQL Server instead of PostgreSQL for the Admin App database
    [Switch]
    $MSSQL
)

$networkExists = docker network ls --filter name=edfiadminapp-network --format '{{.Name}}' | Select-String -Pattern 'edfiadminapp-network'
if (-not $networkExists) {
    Write-Host "Creating edfiadminapp-network..." -ForegroundColor Yellow
    docker network create edfiadminapp-network --driver bridge
}

$edfiServicesFile = Join-Path $PSScriptRoot "edfi-services.yml"
$nginxComposeFile = Join-Path $PSScriptRoot "nginx-compose.yml"
$adminAppServicesFile = Join-Path $PSScriptRoot "adminapp-services.yml"

$files = @(
    "-f",
    $edfiServicesFile,
    "-f",
    $nginxComposeFile,
    "-f",
    $adminAppServicesFile
)

$composeProfile = "postgresql"
if ($MSSQL) {
  $composeProfile = "mssql"
}

Write-Host "Starting Docker Compose services with profile $composeProfile, running Admin App..." -ForegroundColor Green
$EnvFile = Join-Path $PSScriptRoot ".env"

# The -MSSQL switch only selects the SQL Server container profile. The API still
# reads DB_ENGINE and DB_SECRET_VALUE from .env, so warn when they do not match the
# selected profile -- otherwise the API silently starts against the wrong database.
$expectedEngine = if ($MSSQL) { "mssql" } else { "pgsql" }
if (Test-Path $EnvFile) {
    $engineLine = Select-String -Path $EnvFile -Pattern '^\s*DB_ENGINE\s*=\s*(\S+)' | Select-Object -First 1
    $configuredEngine = if ($engineLine) { $engineLine.Matches.Groups[1].Value } else { "pgsql" }
    if ($configuredEngine -ne $expectedEngine) {
        Write-Warning "DB_ENGINE in .env is '$configuredEngine' but the selected profile expects '$expectedEngine'. Set DB_ENGINE=$expectedEngine and the matching DB_SECRET_VALUE in .env before starting."
    }
}

docker compose $files --env-file $EnvFile --profile $composeProfile --profile adminapp up -d $(if ($Rebuild) { "--build" })
Write-Host "Services started successfully!" -ForegroundColor Green

# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.

<#
.SYNOPSIS
    Starts Docker Compose for edfi and adminapp supporting services.

.EXAMPLE
    ./start-local-dev.ps1
    Starts the Docker Compose services
    If the edfiadminapp-network does not exist, it will be created.
#>

param(
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

$EnvFile = Join-Path $PSScriptRoot ".env"
Write-Host "Starting Docker Compose services with profile $composeProfile..." -ForegroundColor Green
docker compose $files --env-file $EnvFile --profile $composeProfile up -d
Write-Host "Services started successfully!" -ForegroundColor Green

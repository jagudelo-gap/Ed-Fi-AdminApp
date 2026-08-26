# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.
<#
.SYNOPSIS
    Shuts down the Docker Compose services.
#>

param(
    # Drops existing volumes
    [Switch] $V,

    # Keep Keycloak volume
    [Switch] $KeepKeycloakVolume,

    # Stop only local-dev services
    [Switch] $LocalDev,

    # Stop only main services
    [Switch] $MainServices
)

function Remove-Volumes {
  param (
    [Switch]$KeepKeycloakVolume
  )
  # List all volumes
  $volumes = docker volume ls --format "{{.Name}}"

  # Filter out volumes that do not contain 'keycloak' if needed
  if ($KeepKeycloakVolume) {
      $volumesToRemove = $volumes | Where-Object { $_ -notlike "*keycloak*" }
  } else {
      $volumesToRemove = $volumes
  }

  # Remove the filtered volumes
  if ($volumesToRemove) {
      docker volume rm $volumesToRemove
  } else {
      Write-Host "No volumes to remove." -ForegroundColor Yellow
  }
}

$edfiServicesFile = Join-Path $PSScriptRoot "edfi-services.yml"
$nginxServicesFile = Join-Path $PSScriptRoot "nginx-compose.yml"
$adminAppServicesFile = Join-Path $PSScriptRoot "adminapp-services.yml"

$envFile = Join-Path $PSScriptRoot ".env"

try {
    $files = @(
        "-f", $edfiServicesFile,
        "-f", $nginxServicesFile,
        "-f", $adminAppServicesFile
    )
    docker compose $files --env-file $envFile  --profile "*" down
    if ($V) {
        Remove-Volumes -KeepKeycloakVolume:$KeepKeycloakVolume
    }
    Write-Host "SUCCESS! Services stopped successfully." -ForegroundColor Green
    exit 0
}
catch {
    Write-Host "ERROR! Services failed to stop." -ForegroundColor Red
    exit 1
}

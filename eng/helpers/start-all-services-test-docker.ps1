# SPDX-License-Identifier: Apache-2.0
# Licensed to the Ed-Fi Alliance under one or more agreements.
# The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
# See the LICENSE and NOTICES files in the project root for more information.


if (-not (Test-Path -Path "compose\.env")) {
    Write-Host "File compose\.env does not exist!. Creating..."
    Copy-Item -Path "compose\.env.example" -Destination "compose\.env"
}

./compose/start-services.ps1 -Rebuild
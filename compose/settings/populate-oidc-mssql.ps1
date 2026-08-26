
param(
	[string]$ClientId = "edfiadminapp",
	[string]$ClientSecret = "big-secret-123",
	[string]$Issuer = "https://localhost/auth/realms/edfi",
	[string]$SaPassword = "YourStrong!Passw0rd"
)

$db_name = "edfiadminapp-mssql"
$db = "sbaa"
$sql_file = Join-Path $PSScriptRoot "seed-oidc-dynamic.sql"

# Escape single quotes in input variables to prevent SQL injection
$EscapedClientId = $ClientId -replace "'", "''"
$EscapedClientSecret = $ClientSecret -replace "'", "''"
$EscapedIssuer = $Issuer -replace "'", "''"
$EscapedSaPassword = $SaPassword -replace "'", "''"

# Generate dynamic SQL file
$sqlContent = @"
IF NOT EXISTS (SELECT 1 FROM dbo.oidc WHERE [clientId] = '$EscapedClientId')
    INSERT INTO dbo.oidc (issuer, [clientId], [clientSecret], scope)
    VALUES ('$EscapedIssuer', '$EscapedClientId', '$EscapedClientSecret', '');
SELECT * FROM dbo.oidc;
"@
Set-Content -Path $sql_file -Value $sqlContent

# Copy the SQL file to the container
docker cp $sql_file ${db_name}:/tmp/seed-oidc.sql

# Execute the SQL file
docker exec $db_name /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P $SaPassword -d $db -i /tmp/seed-oidc.sql

# Optional: Clean up the temporary file
docker exec $db_name rm /tmp/seed-oidc.sql
Remove-Item $sql_file

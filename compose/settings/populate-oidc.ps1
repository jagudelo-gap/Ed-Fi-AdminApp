
param(
	[string]$ClientId = "edfiadminapp",
	[string]$ClientSecret = "big-secret-123",
	[string]$Issuer = "https://localhost/auth/realms/edfi",
	[string]$Username = "admin@example.com",
	[int]$RoleId = 2
)

$db_name = "edfiadminapp-postgres"
$db = "sbaa"
$sql_file = Join-Path $PSScriptRoot "seed-oidc-dynamic.sql"

# Generate dynamic SQL file
# Escape single quotes in input variables to prevent SQL injection
$EscapedClientId = $ClientId -replace "'", "''"
$EscapedClientSecret = $ClientSecret -replace "'", "''"
$EscapedIssuer = $Issuer -replace "'", "''"
$EscapedUsername = $Username -replace "'", "''"

# Generate dynamic SQL file with OIDC and user creation
$sqlContent = @"
-- Insert OIDC provider if not exists
INSERT INTO public.oidc(issuer, "clientId", "clientSecret", scope)
SELECT '$EscapedIssuer', '$EscapedClientId', '$EscapedClientSecret', ''
WHERE NOT EXISTS (
	SELECT 1 FROM public.oidc WHERE "clientId" = '$EscapedClientId'
);

-- Insert user if not exists
INSERT INTO public."user"(username, "roleId", "isActive", "userType")
SELECT '$EscapedUsername', $RoleId, true, 'human'
WHERE NOT EXISTS (
	SELECT 1 FROM public."user" WHERE username = '$EscapedUsername'
);

-- Display results
SELECT * FROM public.oidc;
SELECT id, username, "roleId", "isActive" FROM public."user" WHERE username = '$EscapedUsername';
"@
Set-Content -Path $sql_file -Value $sqlContent

# Copy the SQL file to the container
docker cp $sql_file ${db_name}:/tmp/seed-oidc.sql

# Execute the SQL file
docker exec $db_name psql -U postgres -d $db -f /tmp/seed-oidc.sql

# Optional: Clean up the temporary file
docker exec $db_name rm /tmp/seed-oidc.sql
Remove-Item $sql_file

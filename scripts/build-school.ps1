<#
.SYNOPSIS
build-school.ps1
------------------------------------------------------------
Automates the EAS build process for a specific NexSyrus SchoolIMS tenant.

.DESCRIPTION
Usage:
.\scripts\build-school.ps1 -SchoolId <ID> -SchoolCode <CODE> -SchoolName "<NAME>" -Profile <preview|production>
------------------------------------------------------------
#>

param (
    [Parameter(Mandatory=$true)]
    [string]$SchoolId,

    [Parameter(Mandatory=$true)]
    [string]$SchoolCode,

    [Parameter(Mandatory=$true)]
    [string]$SchoolName,

    [Parameter(Mandatory=$true)]
    [ValidateSet("preview", "production")]
    [string]$Profile
)

# 1. Validate environment variables (must be present in the shell)
$globalApiUrl = if ([string]::IsNullOrEmpty($env:API_URL)) { $env:EXPO_PUBLIC_API_URL } else { $env:API_URL }
$globalSupabaseUrl = if ([string]::IsNullOrEmpty($env:SUPABASE_URL)) { $env:EXPO_PUBLIC_SUPABASE_URL } else { $env:SUPABASE_URL }
$globalSupabaseAnonKey = if ([string]::IsNullOrEmpty($env:SUPABASE_ANON_KEY)) { $env:EXPO_PUBLIC_SUPABASE_ANON_KEY } else { $env:SUPABASE_ANON_KEY }

if ([string]::IsNullOrEmpty($globalApiUrl)) {
    Write-Error "ERROR: API_URL environment variable is not set."
    exit 1
}

if ([string]::IsNullOrEmpty($globalSupabaseUrl)) {
    Write-Error "ERROR: SUPABASE_URL environment variable is not set."
    exit 1
}

if ([string]::IsNullOrEmpty($globalSupabaseAnonKey)) {
    Write-Error "ERROR: SUPABASE_ANON_KEY environment variable is not set."
    exit 1
}


Write-Host "======================================================"
Write-Host "Preparing SchoolIMS Build for: $SchoolName ($SchoolCode)"
Write-Host "Profile: $Profile"
Write-Host "======================================================"

# Transform school code to lowercase for bundle IDs and slug
$schoolCodeLower = $SchoolCode.ToLower()

# 2. Write .env file
Write-Host "-> Writing .env file..."
$envContent = @"
EXPO_PUBLIC_SCHOOL_ID=$SchoolId
EXPO_PUBLIC_SCHOOL_CODE=$SchoolCode
EXPO_PUBLIC_SCHOOL_NAME="$SchoolName"
EXPO_PUBLIC_API_URL=$globalApiUrl
EXPO_PUBLIC_SUPABASE_URL=$globalSupabaseUrl
EXPO_PUBLIC_SUPABASE_ANON_KEY=$globalSupabaseAnonKey
"@

Set-Content -Path ".env" -Value $envContent

# 3. Update app.json from template
Write-Host "-> Generating app.json from template..."
if (-Not (Test-Path "app.template.json")) {
    Write-Error "ERROR: app.template.json not found."
    exit 1
}

$templateContent = Get-Content -Path "app.template.json" -Raw
$templateContent = $templateContent -replace '\{\{SCHOOL_NAME\}\}', $SchoolName
$templateContent = $templateContent -replace '\{\{SCHOOL_CODE_LOWER\}\}', $schoolCodeLower
Set-Content -Path "app.json" -Value $templateContent

# Cleanup function to restore app.json on script exit or error
try {
    # 4. Trigger EAS Build
    Write-Host "-> Spawning eas build..."
    # The --non-interactive flag prevents the prompt requiring user input
    eas build --platform android --profile "$Profile" --non-interactive

    Write-Host "======================================================"
    Write-Host "Build command submitted successfully!"
    Write-Host "You can monitor the build status in the terminal or on the Expo dashboard."
    Write-Host "======================================================"
}
finally {
    Write-Host "-> Restoring app.json from backup/template..."
    if (Test-Path "app.template.json") {
        Copy-Item -Path "app.template.json" -Destination "app.json" -Force
    }
}

# Surabhi Loyalty - UAT Migration Script
# This script helps migrate data from Production to UAT

$PROD_PROJECT = "surabhiloyalty"
$UAT_PROJECT = "surabhiloyalty-uat"
$BUCKET_NAME = "$PROD_PROJECT-migration-backup"
$REGION = "asia-south1"

Write-Host "--- Surabhi Loyalty UAT Migration Tool v3 ---" -ForegroundColor Cyan
Write-Host "PRE-FLIGHT CHECK:" -ForegroundColor Yellow
Write-Host "1. Ensure 'Authentication' is ENABLED in UAT project: https://console.firebase.google.com/project/$UAT_PROJECT/authentication"
Write-Host "2. Ensure 'Cloud Firestore' is INITIALIZED in UAT project: https://console.firebase.google.com/project/$UAT_PROJECT/firestore"
Write-Host "3. Get Scrypt parameters from: https://console.firebase.google.com/project/$PROD_PROJECT/authentication/settings"
Write-Host ""

# 1. Check for Firebase CLI
if (!(Get-Command firebase -ErrorAction SilentlyContinue)) {
    Write-Error "Firebase CLI not found. Please install it: npm install -g firebase-tools"
    exit
}

# 2. Get Scrypt Hash Parameters (Mandatory for Password users)
$HASH_KEY = Read-Host "Enter Scrypt HASH KEY from Production"
$SALT_SEP = Read-Host "Enter Scrypt SALT SEPARATOR from Production"
$ROUNDS = Read-Host "Enter Scrypt ROUNDS (default 8)"
if ([string]::IsNullOrWhiteSpace($ROUNDS)) { $ROUNDS = "8" }
$MEM_COST = Read-Host "Enter Scrypt MEMORY COST (default 14)"
if ([string]::IsNullOrWhiteSpace($MEM_COST)) { $MEM_COST = "14" }

if ([string]::IsNullOrWhiteSpace($HASH_KEY) -or [string]::IsNullOrWhiteSpace($SALT_SEP)) {
    Write-Error "Hash Key and Salt Separator are required for Auth migration."
    exit
}

# 3. Migrate Authentication Users
Write-Host "`n[1/4] Migrating Authentication Users..." -ForegroundColor Yellow
Write-Host "Exporting from $PROD_PROJECT..."
firebase auth:export users_export.json --project $PROD_PROJECT

if ($LASTEXITCODE -eq 0) {
    Write-Host "Importing into $UAT_PROJECT..."
    firebase auth:import users_export.json --hash-algo=SCRYPT --hash-key="$HASH_KEY" --salt-separator="$SALT_SEP" --rounds=$ROUNDS --mem-cost=$MEM_COST --project $UAT_PROJECT

    
    Remove-Item users_export.json
} else {
    Write-Error "Auth export failed. Check your login status with 'firebase login'."
}

# 4. Transport Firestore Indexes
Write-Host "`n[2/4] Transporting Firestore Indexes..." -ForegroundColor Yellow
Write-Host "Deploying to $UAT_PROJECT..."
firebase deploy --only firestore:indexes --project $UAT_PROJECT

# 5. Firestore Data Migration Guidance
Write-Host "`n[3/4] Firestore Data Migration (Spark Plan Compatible):" -ForegroundColor Cyan
Write-Host "Because the Spark plan disables 'gcloud firestore export', I have created a custom Node migration script."
Write-Host "Follow these manual steps to copy your database safely:"
Write-Host ""
Write-Host "1. Prod Key: Go to the Production Firebase Console -> Project Settings -> Service Accounts."
Write-Host "   Click 'Generate new private key' and save it exactly as 'scripts\prod-key.json'."
Write-Host "2. UAT Key: Go to the UAT Firebase Console -> Project Settings -> Service Accounts."
Write-Host "   Click 'Generate new private key' and save it exactly as 'scripts\uat-key.json'."
Write-Host "3. Run the migrator:" -ForegroundColor Yellow
Write-Host "   node scripts/migrate-firestore.js"


Write-Host "`n[4/4] Storage Sync Guidance:" -ForegroundColor Yellow
Write-Host "To sync images/files, use:"
Write-Host "gsutil -m rsync -r gs://$PROD_PROJECT.firebasestorage.app gs://$UAT_PROJECT.firebasestorage.app"

Write-Host "`nMigration tool execution finished." -ForegroundColor Green

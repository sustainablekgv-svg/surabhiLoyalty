# deploy-functions-sequentially.ps1
# Automates deploying Cloud Functions one by one to prevent ECONNRESET connection resets.

# 1. Compile functions
Write-Host "Building cloud functions..." -ForegroundColor Cyan
npm --prefix functions run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed. Aborting deployment." -ForegroundColor Red
    exit $LASTEXITCODE
}

# 2. List of functions to deploy
$functions = @(
    "sendPhoneOtp",
    "deleteImageFromR2Http",
    "onCustomerUpdate",
    "razorpayWebhook",
    "verifyPhoneOtp",
    "verifyRazorpayPayment",
    "resetCustomerPassword",
    "onStaffUpdate",
    "checkOjivaBalance",
    "sendCartReminderSms",
    "sendOjivaNotification",
    "createR2UploadUrl"
)

Write-Host "Starting sequential deployment of $($functions.Count) functions..." -ForegroundColor Cyan

$successCount = 0
$failCount = 0
$failedList = @()

foreach ($fn in $functions) {
    Write-Host "----------------------------------------" -ForegroundColor Gray
    Write-Host "Deploying function: $fn..." -ForegroundColor Yellow
    
    # Run firebase deploy for this specific function
    firebase deploy --only "functions:$fn"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Successfully deployed: $fn" -ForegroundColor Green
        $successCount++
    } else {
        Write-Host "Failed to deploy: $fn" -ForegroundColor Red
        $failCount++
        $failedList += $fn
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deployment Summary:" -ForegroundColor Cyan
Write-Host "  Successfully deployed: $successCount" -ForegroundColor Green
if ($failCount -gt 0) {
    Write-Host "  Failed to deploy: $failCount ($($failedList -join ', '))" -ForegroundColor Red
} else {
    Write-Host "  All functions deployed successfully!" -ForegroundColor Green
}

# Builds the live (non-demo) PrepPilot APK on this PC, signed with the EAS key.
#
# Signed with the same key as EAS builds, so it installs over them and Google
# sign-in keeps working (the Android OAuth client is tied to that key's SHA-1).
#
# Needs, once:
#   npx eas-cli credentials -p android   -> "Download credentials from EAS to credentials.json"
#   npx eas-cli env:pull --environment preview
# Both files are git-ignored. Run from anywhere:
#   powershell -ExecutionPolicy Bypass -File apps/mobile/scripts/build-apk-local.ps1

$ErrorActionPreference = 'Stop'
$app = Split-Path $PSScriptRoot -Parent
Set-Location $app

if (-not (Test-Path 'credentials.json')) {
  throw 'credentials.json is missing. Run: npx eas-cli credentials -p android, then choose "Download credentials from EAS to credentials.json".'
}
if (-not (Test-Path '.env.local')) {
  throw '.env.local is missing. Run: npx eas-cli env:pull --environment preview'
}

# Gradle for React Native wants JDK 17; newer ones are not supported yet.
$jdk = Get-ChildItem 'C:\Program Files\Microsoft\jdk-17*', 'C:\Program Files\Eclipse Adoptium\jdk-17*' -Directory -ErrorAction SilentlyContinue |
  Select-Object -First 1
if ($null -eq $jdk) { throw 'JDK 17 not found. Install Microsoft Build of OpenJDK 17.' }
$env:JAVA_HOME = $jdk.FullName
$env:EXPO_PUBLIC_DEMO_MODE = 'false'
$env:NODE_ENV = 'production'

if (-not (Test-Path 'android')) {
  npx expo prebuild -p android --no-install
  if ($LASTEXITCODE -ne 0) { throw 'expo prebuild failed.' }
  # Prebuild rewrites the android/ios scripts in package.json; keep ours.
  git checkout -- package.json
}
if (-not (Test-Path 'android\local.properties')) {
  $sdk = (Join-Path $env:LOCALAPPDATA 'Android\Sdk') -replace '\\', '/'
  Set-Content 'android\local.properties' "sdk.dir=$sdk" -Encoding ascii
}

$credentials = Get-Content 'credentials.json' -Raw | ConvertFrom-Json
$keystore = $credentials.android.keystore
$storeFile = (Resolve-Path $keystore.keystorePath).Path

# The same properties Android Studio passes for "Generate Signed APK"; they
# override whatever signing the generated build.gradle names.
Push-Location 'android'
try {
  & .\gradlew.bat ':app:assembleRelease' '-PreactNativeArchitectures=arm64-v8a' `
    "-Pandroid.injected.signing.store.file=$storeFile" `
    "-Pandroid.injected.signing.store.password=$($keystore.keystorePassword)" `
    "-Pandroid.injected.signing.key.alias=$($keystore.keyAlias)" `
    "-Pandroid.injected.signing.key.password=$($keystore.keyPassword)"
  if ($LASTEXITCODE -ne 0) { throw 'Gradle build failed; see the output above.' }
} finally {
  Pop-Location
}

$apk = 'android\app\build\outputs\apk\release\app-release.apk'
$target = Join-Path $env:USERPROFILE 'Downloads\preppilot-local.apk'
Copy-Item $apk $target -Force
Write-Host ''
Write-Host "Done: $target ($([math]::Round((Get-Item $target).Length / 1MB, 1)) MB)"

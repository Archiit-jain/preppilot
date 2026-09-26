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
# The newest CMake installed, not the 3.22.1 Gradle picks by default: its
# ninja (1.10) loops on Windows with "build.ninja still dirty after 100 tries"
# over Reanimated's CONFIGURE_DEPENDS globs. Install a newer one from Android
# Studio -> SDK Manager -> SDK Tools -> CMake (tick "Show Package Details").
$sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$cmake = Get-ChildItem (Join-Path $sdk 'cmake') -Directory -ErrorAction SilentlyContinue |
  Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
if ($null -eq $cmake -or [version]$cmake.Name -lt [version]'3.30') {
  throw 'Install CMake 3.30 or newer: Android Studio -> SDK Manager -> SDK Tools -> CMake (tick "Show Package Details").'
}
$properties = @("sdk.dir=$($sdk -replace '\\', '/')", "cmake.dir=$($cmake.FullName -replace '\\', '/')")
Set-Content 'android\local.properties' $properties -Encoding ascii
Write-Host "Using CMake $($cmake.Name)"
# CMake 4 refuses projects declaring a minimum below 3.5, and expo-sqlite
# declares 3.4.1. This lets it configure them as 3.5, which they build under.
if ([version]$cmake.Name -ge [version]'4.0') { $env:CMAKE_POLICY_VERSION_MINIMUM = '3.5' }

# Native build folders from an earlier CMake would be reused and fail the same way.
$modules = Get-ChildItem (Join-Path $app '..\..\node_modules') -Directory -ErrorAction SilentlyContinue
$packages = $modules | Where-Object { -not $_.Name.StartsWith('@') }
$scoped = $modules | Where-Object { $_.Name.StartsWith('@') } | Get-ChildItem -Directory
@($packages) + @($scoped) |
  ForEach-Object { Join-Path $_.FullName 'android\.cxx' } |
  Where-Object { Test-Path $_ } |
  ForEach-Object { Remove-Item $_ -Recurse -Force }
if (Test-Path 'android\app\.cxx') { Remove-Item 'android\app\.cxx' -Recurse -Force }

$credentials = Get-Content 'credentials.json' -Raw | ConvertFrom-Json
$keystore = $credentials.android.keystore
$storeFile = (Resolve-Path $keystore.keystorePath).Path

# Opening android/ in Android Studio writes Gradle daemon criteria pinning its
# own JDK (25), which overrides JAVA_HOME. Under 25 the native configure steps
# fail on "A restricted method in java.lang.System has been called"; the
# libraries target 17. Without the file, the daemon runs on JAVA_HOME.
$criteria = 'android\gradle\gradle-daemon-jvm.properties'
if (Test-Path $criteria) {
  Remove-Item $criteria -Force
  Write-Host 'Removed the Gradle daemon JDK pin written by Android Studio.'
}

# The same properties Android Studio passes for "Generate Signed APK"; they
# override whatever signing the generated build.gradle names.
Push-Location 'android'
try {
  # A daemon left running on another JDK would otherwise be reused.
  & .\gradlew.bat --stop | Out-Null
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

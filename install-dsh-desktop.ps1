#requires -Version 5.1
<#
.SYNOPSIS
    Install dsh-rss-monitor into DeepSeek Harness Desktop (Windows).

.DESCRIPTION
    Reproducible installer for dsh-rss-monitor on DSH Desktop.

    What it does:
      1. Clones the repo to a stable location (D:\plugins\dsh-rss-monitor by default)
      2. Cleans any previous partial install (stale junction, stale dependency entry)
      3. Quits any running DSH Desktop processes
      4. Runs `pnpm add link:...` in the desktop profile so the hot-mount
         supervisor (`deepseek-harness-zh_pro`) sees the new dependency on
         next launch
      5. Optionally launches DSH Desktop

    After running this, restart DSH Desktop. Settings should show a new
    "RSS 监控" entry.

.PARAMETER PluginPath
    Where to keep the plugin source on disk. Defaults to D:\plugins\dsh-rss-monitor.

.PARAMETER SkipClone
    If the plugin already exists at -PluginPath, don't re-clone (use for upgrades).

.PARAMETER SkipLaunch
    Don't start DSH Desktop at the end.

.EXAMPLE
    .\install-dsh-desktop.ps1
    .\install-dsh-desktop.ps1 -PluginPath E:\code\dsh-rss-monitor -SkipLaunch
#>

[CmdletBinding()]
param(
    [string]$PluginPath = 'D:\plugins\dsh-rss-monitor',
    [switch]$SkipClone,
    [switch]$SkipLaunch
)

$ErrorActionPreference = 'Stop'
$repoUrl = 'https://github.com/hgl011091/dsh-rss-monitor.git'
$dshProfile = Join-Path $env:USERPROFILE '.dsh\profiles\desktop'

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  [ERR] $msg" -ForegroundColor Red }

# 0. Sanity checks
if (-not (Test-Path $dshProfile)) {
    throw "DSH Desktop profile not found at $dshProfile. Is DSH Desktop installed?"
}
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    throw "pnpm not found on PATH. Open DSH Desktop once so it sets up pnpm."
}

# 1. Clone or skip
if ($SkipClone -and (Test-Path $PluginPath)) {
    Write-Step "Using existing plugin at $PluginPath"
} else {
    if (Test-Path $PluginPath) {
        Write-Warn "Existing directory at $PluginPath; updating instead of re-cloning"
        git -C $PluginPath pull --ff-only
    } else {
        Write-Step "Cloning $repoUrl -> $PluginPath"
        $parent = Split-Path $PluginPath -Parent
        if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        git clone $repoUrl $PluginPath
    }
    Write-Ok "Plugin source ready"
}

# 2. Verify required files (lib/ is prebuilt & self-contained)
foreach ($f in @('lib\index.js','lib\client.js','package.json','cordis.patch.yml')) {
    if (-not (Test-Path (Join-Path $PluginPath $f))) {
        throw "Required file missing: $f (did the clone succeed?)"
    }
}
Write-Ok "All required files present (lib/ prebuilt, self-contained)"

# 3. Clean stale install (junction + dependency entry)
$manifestPath = Join-Path $dshProfile 'package.json'
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
if ($manifest.dependencies.PSObject.Properties.Name -contains 'dsh-rss-monitor') {
    Write-Step "Removing stale 'dsh-rss-monitor' entry from profile/package.json"
    $manifest.dependencies.PSObject.Properties.Remove('dsh-rss-monitor')
    $manifest | ConvertTo-Json -Depth 10 | Set-Content $manifestPath -Encoding utf8NoBOM
}
$junctionPath = Join-Path $dshProfile 'node_modules\dsh-rss-monitor'
if (Test-Path $junctionPath) {
    Write-Step "Removing stale junction $junctionPath"
    cmd /c rmdir $junctionPath 2>&1 | Out-Null
}
Write-Ok "Stale install cleared"

# 4. Quit DSH Desktop (must be done before pnpm add)
$dshProcs = Get-Process -Name 'DSH Desktop','dsh-plugin-desktop' -ErrorAction SilentlyContinue
if ($dshProcs) {
    Write-Step "Quitting DSH Desktop ($($dshProcs.Count) processes)"
    $dshProcs | ForEach-Object { $_.CloseMainWindow() | Out-Null }
    Start-Sleep -Seconds 2
    $stillRunning = Get-Process -Name 'DSH Desktop','dsh-plugin-desktop' -ErrorAction SilentlyContinue
    if ($stillRunning) {
        Write-Warn "Some DSH processes didn't quit gracefully. Forcing kill."
        $stillRunning | Stop-Process -Force
        Start-Sleep -Seconds 1
    }
} else {
    Write-Ok "DSH Desktop not running"
}

# 5. pnpm add link:... — this creates the junction AND records the new
#    dependency in profile/package.json. DSH's hot-mount supervisor detects
#    the manifest change on next launch and generates the include row.
Write-Step "pnpm add link:$PluginPath  (in $dshProfile)"
Push-Location $dshProfile
try {
    & pnpm add "link:$PluginPath" 2>&1 | ForEach-Object { Write-Host "  $_" }
} finally {
    Pop-Location
}
Write-Ok "Install complete"

# 6. Optional launch
if (-not $SkipLaunch) {
    Write-Step "Launching DSH Desktop"
    $dshExe = Join-Path $env:LOCALAPPDATA '..\Local\Programs\dsh-desktop\DSH Desktop.exe'
    $dshExe = (Resolve-Path $dshExe -ErrorAction SilentlyContinue).Path
    if ($dshExe -and (Test-Path $dshExe)) {
        Start-Process $dshExe
        Write-Ok "DSH Desktop started. Open Settings -> look for 'RSS 监控'."
    } else {
        Write-Warn "DSH Desktop.exe not found at $dshExe. Start it manually."
    }
} else {
    Write-Ok "Done. Start DSH Desktop manually, then open Settings -> 'RSS 监控'."
}

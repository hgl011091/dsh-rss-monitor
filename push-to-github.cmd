@echo off
REM ========================================================================
REM  push-to-github.cmd
REM  Pushes the local dsh-rss-monitor 0.2.2 commit to GitHub, creates tag
REM  v0.2.2, and creates the corresponding GitHub Release.
REM
REM  IMPORTANT: This script does NOT hardcode any tokens. The first time
REM  you run it, it will prompt for a GitHub Personal Access Token. The
REM  token is cached in %USERPROFILE%\.dsh-rss-monitor.tokens.
REM ========================================================================

setlocal enabledelayedexpansion

set "REPO_DIR=D:\HarnessProjects\dsh-rss-monitor"
set "TOKEN_FILE=%USERPROFILE%\.dsh-rss-monitor.tokens"
set "BRANCH=master"
set "UPSTREAM=main"
set "TAG=v0.2.2"
set "RELEASE_TITLE=v0.2.2 - allowBuilds fix"
set "RELEASE_NOTES=%REPO_DIR%\RELEASE-v0.2.2.md"

echo.
echo ===== dsh-rss-monitor push script =====
echo.

REM ---- Load or prompt for the GitHub token ------------------------------------
call :load_token "GITHUB_TOKEN"

if defined GITHUB_TOKEN goto :have_token
echo.
echo GitHub Personal Access Token required (with Contents: Read and write).
echo Generate at: https://github.com/settings/tokens?type=beta
echo Required: Contents = Read and write
echo.
set /p "GITHUB_TOKEN=Enter GITHUB_TOKEN: "
if "%GITHUB_TOKEN%" == "" goto :error
call :save_token "GITHUB_TOKEN" "%GITHUB_TOKEN%"
:have_token

echo.
echo ===== dsh-rss-monitor push script =====
echo.

REM ---- Sanity checks -----------------------------------------------------------
if not exist "%REPO_DIR%\.git" (
    echo [ERROR] %REPO_DIR% is not a git repository.
    goto :error
)

cd /d "%REPO_DIR%" || (
    echo [ERROR] Failed to enter %REPO_DIR%.
    goto :error
)

REM Configure git to use openssl (works around Windows schannel issues).
git config http.sslBackend openssl >nul 2>&1

for /f "delims=" %%H in ('git rev-parse HEAD') do set "HEAD_SHA=%%H"
echo Local HEAD: %HEAD_SHA%
git log --oneline -1
if errorlevel 1 (
    echo [ERROR] git log failed.
    goto :error
)
echo.

REM ---- 1. Configure remote with the token in the URL ---------------------------
echo [1/4] Setting remote origin ...
set "AUTH_URL=https://%GITHUB_TOKEN%@github.com/hgl011091/dsh-rss-monitor.git"
git remote remove origin 2>nul
git remote add origin "%AUTH_URL%"
if errorlevel 1 (
    echo [ERROR] Failed to set remote.
    goto :error
)
git remote -v
echo.

REM ---- 2. Push the branch ------------------------------------------------------
echo [2/4] Pushing branch %BRANCH% to %UPSTREAM% ...
git push origin "%BRANCH%:%UPSTREAM%" --force
if errorlevel 1 (
    echo.
    echo [ERROR] git push failed. See the message above.
    echo Common causes:
    echo   1. Token lacks Contents: Read and write permission
    echo   2. Push protection blocking secrets in commits
    echo   3. Network / firewall blocking GitHub
    goto :error
)
echo.

REM ---- 3. Push tag -------------------------------------------------------------
echo [3/4] Pushing tag %TAG% ...
git tag -d %TAG% 2>nul
git tag %TAG%
git push origin %TAG% --force
if errorlevel 1 (
    echo [WARN] git push tag failed. Will still try to create the release.
)
echo.

REM ---- 4. Create GitHub Release via the API ------------------------------------
echo [4/4] Creating GitHub Release %TAG% ...
if not exist "%RELEASE_NOTES%" (
    echo [WARN] Release notes not found: %RELEASE_NOTES%
    echo Skipping release creation.
    goto :success
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ErrorActionPreference = 'Stop';" ^
    "$token = $env:GITHUB_TOKEN;" ^
    "$notesPath = '%RELEASE_NOTES%';" ^
    "$title = '%RELEASE_TITLE%';" ^
    "$tag = '%TAG%';" ^
    "$upstream = '%UPSTREAM%';" ^
    "$notes = [System.IO.File]::ReadAllText($notesPath, [System.Text.UTF8Encoding]::new($false));" ^
    "function E([string]$s) { $s -replace '\\\\','\\\\' -replace '\"','\\\"' -replace \"`r`n\",'\\n' -replace \"`n\",'\\n' -replace \"`t\",'\\t' };" ^
    "$body = E($notes);" ^
    "$titleEsc = E($title);" ^
    "$json = '{""tag_name"":""' + $tag + '"",""target_commitish"":""' + $upstream + '"",""name"":""' + $titleEsc + '"",""body"":""' + $body + '"",""draft"":false,""prerelease"":false}';" ^
    "$tmp = [System.IO.Path]::GetTempFileName();" ^
    "[System.IO.File]::WriteAllText($tmp, $json, [System.Text.UTF8Encoding]::new($false));" ^
    "try {" ^
    "  $r = Invoke-WebRequest -Uri 'https://api.github.com/repos/hgl011091/dsh-rss-monitor/releases' -Method Post -Headers @{ Authorization = \"Bearer $token\"; Accept = 'application/vnd.github+json'; 'X-GitHub-Api-Version' = '2022-11-28'; 'User-Agent' = 'dsh-rss-monitor-publisher' } -InFile $tmp -ContentType 'application/json; charset=utf-8' -UseBasicParsing;" ^
    "  $rel = $r.Content | ConvertFrom-Json;" ^
    "  Write-Host ('OK  Release created: ' + $rel.html_url);" ^
    "} catch {" ^
    "  Write-Host ('ERR ' + $_.Exception.Message);" ^
    "  if ($_.Exception.Response) { $s = $_.Exception.Response.GetResponseStream(); $sr = New-Object System.IO.StreamReader($s); Write-Host ('Body: ' + $sr.ReadToEnd()) };" ^
    "  exit 1" ^
    "} finally {" ^
    "  Remove-Item $tmp -Force -ErrorAction SilentlyContinue" ^
    "}"

if errorlevel 1 (
    echo [ERROR] Release creation failed.
    goto :error
)

:success
echo.
echo ===== Done =====
git ls-remote --tags origin | findstr /R "%TAG%"
echo.
echo Release URL: https://github.com/hgl011091/dsh-rss-monitor/releases/tag/%TAG%
echo.
echo Press any key to close...
pause >nul
exit /b 0

:error
echo.
echo ===== Failed =====
echo Press any key to close...
pause >nul
exit /b 1

REM ---- Helpers -----------------------------------------------------------------
:load_token
set "_NAME=%~1"
if exist "%TOKEN_FILE%" (
    for /f "usebackq tokens=1,* delims==" %%A in ("%TOKEN_FILE%") do (
        if /i "%%A" == "%_NAME%" set "%_NAME%=%%B"
    )
)
goto :eof

:save_token
set "_NAME=%~1"
set "_VAL=%~2"
if not exist "%TOKEN_FILE%" (
    echo.%_NAME%=%_VAL%> "%TOKEN_FILE%"
) else (
    findstr /b /c:"%_NAME%=" "%TOKEN_FILE%" >nul 2>&1
    if errorlevel 1 (
        echo.%_NAME%=%_VAL%>> "%TOKEN_FILE%"
    ) else (
        powershell -NoProfile -Command "$f='%TOKEN_FILE%'; $c=Get-Content $f; $c = $c -replace '^%_NAME%=.*','%_NAME%=%_VAL%'; Set-Content -Path $f -Value $c -Encoding ASCII"
    )
)
icacls "%TOKEN_FILE%" /inheritance:r /grant:r "%USERDOMAIN%\%USERNAME%:(R,W)" >nul 2>&1
goto :eof
# dsh-rss-monitor Push Notes

This directory contains helper scripts to push the local 0.2.2 commit to
GitHub. They prompt for a GitHub Personal Access Token the first time and
cache it to `~/.dsh-rss-monitor.tokens` for reuse; the token is never
hardcoded in the script.

## Current State

- **Local HEAD**: see `git log` after running the script
- **GitHub remote**: not yet pushed
- **NPM**: 0.2.2 published (latest)
- **DSH Desktop**: profile cleared, 0.2.2 not installed

## Usage

### Option 1: double-click `push-to-github.cmd`

1. Open `D:\HarnessProjects\dsh-rss-monitor` in Explorer
2. Double-click `push-to-github.cmd`
3. First run will prompt for a GitHub Personal Access Token (paste it).
   The token is cached in `~/.dsh-rss-monitor.tokens` for next time.
4. Wait for the script to finish. It will pause at the end so you can
   read the output.

### Option 2: PowerShell

```powershell
cd D:\HarnessProjects\dsh-rss-monitor
.\push-to-github.ps1
```

If you get a "running scripts is disabled" error, first run:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\push-to-github.ps1
```

## Required token

Generate a fine-grained PAT at https://github.com/settings/tokens?type=beta
with these settings:

- **Resource owner**: your account
- **Repository access**: `hgl011091/dsh-rss-monitor` (only)
- **Permissions**:
  - **Contents**: `Read and write` (push commits, create tags)
  - **Metadata**: `Read-only` (auto-selected)

## What the script does

1. **Configure remote** with the token in the URL
2. **Push branch** `master -> main` with `--force`
3. **Push tag** `v0.2.2`
4. **Create Release** with body from `RELEASE-v0.2.2.md`

## Verifying the push

After success, visit:

- Code:  https://github.com/hgl011091/dsh-rss-monitor
- Tag:   https://github.com/hgl011091/dsh-rss-monitor/releases/tag/v0.2.2
- List:  https://github.com/hgl011091/dsh-rss-monitor/releases

## DSH Desktop install (after the push succeeds)

```powershell
# 1. Fully exit DSH Desktop (tray -> Exit)

# 2. Install 0.2.2
dsh plugin --profile desktop add -wE dsh-rss-monitor@0.2.2

# 3. Start DSH Desktop
```

If you still see an `allowBuilds` error, edit
`%USERPROFILE%\.dsh\profiles\desktop\.npmrc` and add:

```ini
verify-deps-before-run=false
```

## Cleaning up the token

After the push, you can delete the cached token:

```powershell
Remove-Item $env:USERPROFILE\.dsh-rss-monitor.tokens
```

Or revoke it at https://github.com/settings/tokens (recommended once you no
longer need it).
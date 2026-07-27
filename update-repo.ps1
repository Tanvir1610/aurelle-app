<#
    Aurelle — update your repo and push (Windows / PowerShell).

    Usage, from inside the unzipped aurelle-app folder:

        .\update-repo.ps1 -Repo "C:\Full Stack Developer\Clone E-commerce"

    Or if your clone is elsewhere:

        .\update-repo.ps1 -Repo "C:\path\to\aurelle-app"

    Nothing is committed or pushed until you confirm.
    Safe to run more than once.
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$Repo,

    [string]$Source = $PSScriptRoot
)

$ErrorActionPreference = 'Stop'

function Say  { param($m) Write-Host "`n$m" -ForegroundColor White }
function Ok   { param($m) Write-Host "  [ok] $m" -ForegroundColor Green }
function Warn { param($m) Write-Host "  [!]  $m" -ForegroundColor Yellow }
function Die  { param($m) Write-Host "`nStopped: $m`n" -ForegroundColor Red; exit 1 }

# ------------------------------------------------------------------ checks --
Say "Checking"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Die "git is not installed. Run:  winget install --id Git.Git -e"
}
Ok "git is available"

$Source = (Resolve-Path $Source).Path
if (-not (Test-Path (Join-Path $Source 'server\server.js'))) {
    Die "No server\server.js under '$Source'. Point -Source at the unzipped aurelle-app folder."
}
Ok "source looks like the Aurelle app"

if (-not (Test-Path $Repo)) { Die "'$Repo' does not exist." }
$Repo = (Resolve-Path $Repo).Path
if (-not (Test-Path (Join-Path $Repo '.git'))) {
    Die "'$Repo' is not a git repository. Clone it first:`n  gh repo clone Tanvir1610/aurelle-app"
}
Ok "destination is a git repository"

if ($Source -eq $Repo) { Die "Source and destination are the same folder." }

Push-Location $Repo
try {
    $remote = (git remote get-url origin 2>$null)
    if (-not $remote) { Die "No 'origin' remote is configured in '$Repo'." }
    Ok "remote: $remote"

    $branch = (git rev-parse --abbrev-ref HEAD).Trim()
    Ok "branch: $branch"

    # ------------------------------------------- stop tracking the database --
    Say "Removing the database from version control"

    # A committed data\aurelle.db overwrites the live database on every deploy,
    # which silently reverts whatever the server set up on the previous boot.
    $trackedDb = git ls-files 'data/*.db' 'data/*.db-wal' 'data/*.db-shm'
    if ($trackedDb) {
        foreach ($f in $trackedDb) {
            git rm --cached --quiet -- $f 2>$null
            Warn "untracked: $f"
        }
        Ok "the live database will no longer be overwritten on deploy"
    } else {
        Ok "no database files are tracked"
    }

    # ---------------------------------------------------------- copy files --
    Say "Copying the updated app"

    foreach ($dir in @('server', 'admin', 'assets', 'tools')) {
        $src = Join-Path $Source $dir
        if (Test-Path $src) {
            $dst = Join-Path $Repo $dir
            if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
            Copy-Item $src $dst -Recurse -Force
            Ok "$dir\"
        }
    }

    Get-ChildItem $Source -File |
        Where-Object { $_.Extension -in '.html', '.md', '.json', '.yaml', '.yml', '.sh', '.ps1' `
                       -or $_.Name -in '.gitignore', '.env.example' } |
        ForEach-Object { Copy-Item $_.FullName (Join-Path $Repo $_.Name) -Force }
    Ok "pages, docs and config"

    # Never ship these.
    foreach ($junk in @('node_modules', 'data')) {
        $p = Join-Path $Repo $junk
        if (Test-Path $p) { Remove-Item $p -Recurse -Force }
    }
    New-Item -ItemType Directory -Force -Path (Join-Path $Repo 'data') | Out-Null
    New-Item -ItemType File -Force -Path (Join-Path $Repo 'data\.gitkeep') | Out-Null
    Ok "cleaned node_modules and the local database"

    # Make sure the database can never be committed again.
    $gitignore = Join-Path $Repo '.gitignore'
    $existing = if (Test-Path $gitignore) { Get-Content $gitignore -Raw } else { '' }
    if ($existing -notmatch 'data/\*\.db') {
        Add-Content $gitignore "`n# never commit the live database`ndata/*.db`ndata/*.db-wal`ndata/*.db-shm`n.env"
        Ok ".gitignore updated"
    }

    # -------------------------------------------------------------- commit --
    Say "Staging"

    git add -A
    $staged = git diff --cached --name-only
    if (-not $staged) {
        Say "Nothing changed — your repo is already up to date."
        exit 0
    }

    git --no-pager diff --cached --stat | Select-Object -Last 25
    Write-Host ""

    Say "$($staged.Count) file(s) staged on '$branch'"
    $reply = Read-Host "Commit and push to $remote ? (y/N)"
    if ($reply -notmatch '^(y|Y)') {
        Say "Left staged, nothing pushed. Undo with:  git reset"
        exit 0
    }

    $msg = @"
Admin dashboard: separate login and dashboard pages, dual sign-in

- /admin/ is now the sign-in page only; the dashboard lives at
  /admin/dashboard.html and bounces back when there is no session
- Dashboard accepts password OR Clerk email code, so a Clerk
  misconfiguration can no longer lock the operator out
- Restore the data-loading functions an earlier edit had removed,
  which left every dashboard panel empty
- A wrong password now shows inline instead of a session-rejected screen
- Stop tracking data/*.db, which was overwriting the live database
  on every deploy
"@
    git commit -q -m $msg
    Ok "committed"

    Say "Pushing"
    git push origin $branch

    Say "Done"
    Write-Host "  Render will redeploy automatically."
    Write-Host ""
    Write-Host "  Set these in Render -> Environment:" -ForegroundColor White
    Write-Host "    ADMIN_EMAIL=vhoratanvir1610@gmail.com"
    Write-Host "    ADMIN_PASSWORD=Aurelle@2026"
    Write-Host ""
    Write-Host "  Then sign in at:  $($remote -replace '\.git$','')  ->  /admin/"
    Write-Host ""
}
finally {
    Pop-Location
}

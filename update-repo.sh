#!/usr/bin/env bash
#
# Aurelle — update your repo and push.
#
#   1. Unzip aurelle-app.zip somewhere
#   2. cd into your existing git clone of aurelle-app
#   3. bash /path/to/aurelle-app/update-repo.sh /path/to/aurelle-app
#
# Or from inside the unzipped folder, pointing at your clone:
#   bash update-repo.sh . ~/code/aurelle-app
#
# Safe to run more than once. Nothing is pushed until you confirm.
#
set -euo pipefail

SRC="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
DEST="${2:-$(pwd)}"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[31mStopped:\033[0m %s\n\n' "$*" >&2; exit 1; }

SRC="$(cd "$SRC" && pwd)"
DEST="$(cd "$DEST" && pwd)"

# ---------------------------------------------------------------- checks --
say "Checking"

[ -f "$SRC/server/server.js" ] || die "No server/server.js in $SRC — is that the unzipped folder?"
ok "source looks like the Aurelle app"

[ -d "$DEST/.git" ] || die "$DEST is not a git repository. cd into your clone first."
ok "destination is a git repository"

[ "$SRC" != "$DEST" ] || die "Source and destination are the same folder."

cd "$DEST"
REMOTE="$(git remote get-url origin 2>/dev/null || echo none)"
[ "$REMOTE" != "none" ] || die "No 'origin' remote configured here."
ok "remote: $REMOTE"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
ok "branch: $BRANCH"

if ! git diff --quiet || ! git diff --cached --quiet; then
  warn "you have uncommitted changes — they will be committed along with this update"
fi

# ------------------------------------------------- stop tracking the db --
say "Removing the database from version control"

TRACKED_DB="$(git ls-files 'data/*.db' 'data/*.db-wal' 'data/*.db-shm' 2>/dev/null || true)"
if [ -n "$TRACKED_DB" ]; then
  echo "$TRACKED_DB" | while read -r f; do
    git rm --cached --quiet "$f" 2>/dev/null || true
    warn "untracked: $f"
  done
  ok "the live database will no longer be overwritten on deploy"
else
  ok "no database files are tracked"
fi

# ------------------------------------------------------------ copy files --
say "Copying the updated app"

copy() {
  local rel="$1"
  if [ -e "$SRC/$rel" ]; then
    mkdir -p "$DEST/$(dirname "$rel")"
    cp -R "$SRC/$rel" "$DEST/$(dirname "$rel")/"
    ok "$rel"
  fi
}

# Source and config, but never the local database or secrets.
for d in server admin assets tools; do
  if [ -d "$SRC/$d" ]; then
    rm -rf "${DEST:?}/$d"
    cp -R "$SRC/$d" "$DEST/"
    ok "$d/"
  fi
done

for f in *.html *.md package.json render.yaml .gitignore .env.example; do
  for match in "$SRC"/$f; do
    [ -e "$match" ] || continue
    cp "$match" "$DEST/"
  done
done
ok "pages, docs and config"

# Never ship these.
rm -rf "$DEST/node_modules" "$DEST/data" 2>/dev/null || true
mkdir -p "$DEST/data" && touch "$DEST/data/.gitkeep"
ok "cleaned node_modules and the local database"

# .gitignore must cover the database for good.
if ! grep -q '^data/\*.db$' "$DEST/.gitignore" 2>/dev/null; then
  {
    echo ""
    echo "# never commit the live database"
    echo "data/*.db"
    echo "data/*.db-wal"
    echo "data/*.db-shm"
    echo ".env"
  } >> "$DEST/.gitignore"
  ok ".gitignore updated"
fi

# ---------------------------------------------------------------- commit --
say "Staging"

git add -A
if git diff --cached --quiet; then
  say "Nothing changed — your repo is already up to date."
  exit 0
fi

git --no-pager diff --cached --stat | tail -25
echo

FILES="$(git diff --cached --name-only | wc -l | tr -d ' ')"
say "$FILES file(s) staged for commit on '$BRANCH'"

printf 'Commit and push to %s? [y/N] ' "$REMOTE"
read -r REPLY
case "$REPLY" in
  [yY]*) ;;
  *) say "Left staged, nothing pushed. Undo with: git reset"; exit 0 ;;
esac

git commit -qm "Admin dashboard: dual sign-in, jewellery editor, customers and access panels

- Dashboard accepts password OR Clerk email code, so a Clerk
  misconfiguration can no longer lock the operator out
- Product editor rebuilt for jewellery: artwork picker, occasions,
  finishes and a live storefront preview
- New Customers and Access panels, plus per-order detail
- Stop tracking data/*.db, which was overwriting the live database
  on every deploy"

ok "committed"

say "Pushing"
git push origin "$BRANCH"

say "Done"
echo "  Render will redeploy automatically."
echo
echo "  Then set these in Render → Environment:"
echo "    ADMIN_EMAIL=vhoratanvir1610@gmail.com"
echo "    ADMIN_PASSWORD=Aurelle@2026"
echo
echo "  And sign in at: ${REMOTE%.git}  →  /admin/"
echo

#!/usr/bin/env bash
# À lancer SUR le serveur, à la main :
#   bash ~/domains/<site>/app/releases/<id>/deploy/rollback.sh <site> [release-id]
# Sans release-id : revient à la version active avant la version actuelle (backups/deploys.log).
# Restaure Laravel, le site React et public_html/api ; .env et storage sont partagés, intacts.
# Ne restaure PAS la base de données. Si une migration a tourné, restaurer à la main :
#   gunzip -c ~/domains/<site>/backups/db-<stamp>.sql.gz | mysql <base>
# Retour à l'installation manuelle (avant le premier déploiement) :
#   tar -xzf ~/domains/<site>/backups/public_html-initial-<stamp>.tar.gz -C ~/domains/<site>/public_html
# (l'archive « initial » n'est jamais supprimée ; l'ancien ~/routier237-api est conservé)
set -euo pipefail
umask 022

die() { echo "ERROR: $*" >&2; exit 1; }

SITE="${1:?site}"
[[ "$SITE" =~ ^[a-z0-9.-]+$ ]] || die "bad site name"
ROOT="$HOME/domains/$SITE"; APP="$ROOT/app"; WEB="$ROOT/public_html"; API="$WEB/api"; LOG="$ROOT/backups/deploys.log"
[ -L "$APP/current" ] || die "no active release"
CUR=$(basename "$(dirname "$(readlink "$APP/current")")")

if [ -n "${2:-}" ]; then
  TARGET="$2"
else
  line=$(grep " deploy $CUR " "$LOG" 2>/dev/null | tail -n 1 || true)
  prev=$(sed -n 's/.* prev=\([^ ]*\).*/\1/p' <<<"$line")
  [ -n "$prev" ] && [ "$prev" != "none" ] || die "no previous release recorded for $CUR; pass a release id: $(ls -1 "$APP/releases" | tr '\n' ' ')"
  TARGET=$(basename "$(dirname "$prev")")
fi
[[ "$TARGET" =~ ^[A-Za-z0-9._-]+$ ]] || die "bad release id"
[ "$TARGET" != "$CUR" ] || die "$TARGET is already active"
R="$APP/releases/$TARGET"
[ -f "$R/backend/artisan" ] && [ -f "$R/web/index.html" ] && [ -f "$R/api/index.php" ] \
  || die "release $TARGET not found: $(ls -1 "$APP/releases" | tr '\n' ' ')"

echo "Rollback: $CUR -> $TARGET"
(cd "$R/backend" && php artisan optimize --no-interaction)
ln -sfn "$R/backend" "$APP/current.tmp"
mv -Tf "$APP/current.tmp" "$APP/current"
rsync -a --delete --exclude=/api --exclude=/.well-known --exclude=/.user.ini "$R/web/" "$WEB/"
rsync -a --delete --exclude=/storage --exclude=/.well-known --exclude=/.user.ini "$R/api/" "$API/"
echo "$(date +%Y%m%d-%H%M%S) rollback $CUR -> $TARGET" >> "$LOG"
echo "Done. Database not changed."

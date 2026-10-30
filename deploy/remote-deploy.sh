#!/usr/bin/env bash
# S'exécute SUR le serveur (envoyé par GitHub Actions). N'affiche jamais de secret.
#
#   remote-deploy.sh <site> <release-id> <archive.tgz> <migrations 0|1> <allow-initial 0|1>
#
# Organisation sous ~/domains/<site>/ :
#   public_html/              site React (racine du domaine principal)
#   public_html/api/          index.php + .htaccess (racine du sous-domaine api.)
#   public_html/api/storage   lien -> app/shared/storage/app/public (photos de profil)
#   app/releases/<id>/        {backend, web, api, deploy} de chaque version
#   app/current               lien -> app/releases/<id>/backend (version active)
#   app/shared/.env           réglages en ligne (chmod 600, créé à la main)
#   app/shared/storage/       photos, Firebase, journaux, sessions : jamais supprimé
#   backups/                  db-*.sql.gz, public_html-*.tar.gz, deploys.log
#
# Ordre : contrôles -> décompression -> preflight -> sauvegardes vérifiées -> [migrations]
#         -> optimize -> bascule Laravel -> remplacement de public_html et public_html/api.
# Rien ne change dans public_html avant que les deux sauvegardes soient vérifiées.
# Aucune étape n'a besoin de proc_open (désactivé chez Hostinger) ni de Composer.
set -euo pipefail
umask 022

die() { echo "ERROR: $*" >&2; exit 1; }

SITE="${1:?site}"; RELEASE="${2:?release id}"; ARCHIVE="${3:?archive}"
RUN_MIGRATIONS="${4:-0}"; ALLOW_INITIAL="${5:-0}"
[[ "$SITE" =~ ^[a-z0-9.-]+$ ]] || die "bad site name"
[[ "$RELEASE" =~ ^[A-Za-z0-9._-]+$ ]] || die "bad release id"
[[ "$RUN_MIGRATIONS" =~ ^[01]$ ]] || die "run-migrations must be 0 or 1"
[[ "$ALLOW_INITIAL" =~ ^[01]$ ]] || die "allow-initial must be 0 or 1"

ROOT="$HOME/domains/$SITE"; APP="$ROOT/app"; WEB="$ROOT/public_html"; API="$WEB/api"
SHARED="$APP/shared"; NEW="$APP/releases/$RELEASE"; BK="$ROOT/backups"
STAMP=$(date +%Y%m%d-%H%M%S)

# --- 1. Contrôles (rien n'est encore modifié) --------------------------------
[ -d "$WEB" ] || die "missing $WEB"
[ -f "$SHARED/.env" ] || die "missing $SHARED/.env (create it by hand, chmod 600: deploy/README.md)"
[ "$(stat -c %a "$SHARED/.env")" = "600" ] || die "$SHARED/.env must be chmod 600"
[ -f "$ARCHIVE" ] || die "missing archive $ARCHIVE"
[ -e "$NEW" ] && die "release $RELEASE already exists"
for t in php rsync tar gzip; do command -v "$t" >/dev/null || die "$t is required"; done
DUMP=$(command -v mariadb-dump || command -v mysqldump || true)
[ -n "$DUMP" ] || die "mariadb-dump or mysqldump is required"
php -r 'exit(version_compare(PHP_VERSION,"8.2.0",">=")?0:1);' || die "PHP >= 8.2 required (composer.json)"

INITIAL=0
[ -L "$APP/current" ] || INITIAL=1
if [ "$INITIAL" = "1" ] && [ "$ALLOW_INITIAL" != "1" ]; then
  die "first deploy: public_html and public_html/api (manual install) would be replaced. Re-run with allow-initial=1."
fi

# Place pour : version décompressée + sauvegarde de public_html + dump (Kio, large).
need=$(( $(du -sk "$WEB" | cut -f1) + 3 * $(du -sk "$ARCHIVE" | cut -f1) + 102400 ))
free=$(df -Pk "$ROOT" | awk 'NR==2 {print $4}')
[ "$free" -gt "$need" ] || die "not enough disk space (need ${need} KiB, free ${free} KiB)"

mkdir -p "$APP/releases" \
  "$SHARED/storage/app/public" "$SHARED/storage/app/private" \
  "$SHARED/storage/framework/cache/data" "$SHARED/storage/framework/sessions" \
  "$SHARED/storage/framework/views" "$SHARED/storage/logs"
mkdir -p "$BK" && chmod 700 "$BK"

# --- 2. Décompression hors des chemins en service ----------------------------
# En cas d'échec avant la bascule, la version à moitié faite est supprimée ; après la
# bascule, elle est active et conservée. Le fichier d'options MySQL part toujours.
DEF=""; SWITCHED=0; DB_FILE=""; WEB_FILE=""
on_exit() {
  local s=$?
  [ -n "$DEF" ] && rm -f "$DEF"
  [ -n "$DB_FILE" ] && rm -f "$DB_FILE.part"
  [ -n "$WEB_FILE" ] && rm -f "$WEB_FILE.part"
  [ "$s" -eq 0 ] && return
  if [ "$SWITCHED" = "0" ]; then
    rm -rf "$NEW"; echo "Aborted before the switch: site unchanged." >&2
  else
    echo "Failed AFTER the switch: run deploy/rollback.sh $SITE (backups: $BK)." >&2
  fi
}
trap on_exit EXIT
mkdir -p "$NEW"
tar -xzf "$ARCHIVE" -C "$NEW"
for f in backend/artisan backend/vendor/autoload.php backend/resources/views \
         web/index.html web/.htaccess api/index.php api/.htaccess \
         deploy/preflight.php deploy/mysql-defaults.php deploy/rollback.sh; do
  [ -e "$NEW/$f" ] || die "incomplete package: $f missing"
done
[ -e "$NEW/backend/.env" ] && die "package must not contain backend/.env"
rm -rf "$NEW/backend/storage"
ln -s "$SHARED/storage" "$NEW/backend/storage"
ln -s "$SHARED/.env" "$NEW/backend/.env"
mkdir -p "$NEW/backend/bootstrap/cache"

echo "== Preflight"
php "$NEW/deploy/preflight.php" "$NEW/backend" || die "preflight failed"

# --- 3. Sauvegardes vérifiées (umask 077 : lisibles par le propriétaire seul) -----
echo "== Backups"
DEF=$(mktemp)
( umask 077; php "$NEW/deploy/mysql-defaults.php" "$NEW/backend" cnf > "$DEF" )
DB_NAME=$(php "$NEW/deploy/mysql-defaults.php" "$NEW/backend" name)
DB_FILE="$BK/db-$STAMP.sql.gz"
( umask 077
  "$DUMP" --defaults-extra-file="$DEF" --single-transaction --quick --no-tablespaces \
            --routines --triggers "$DB_NAME" | gzip > "$DB_FILE.part" )
rm -f "$DEF"
gzip -t "$DB_FILE.part" || die "DB backup is corrupt"
zcat "$DB_FILE.part" | tail -n 1 | grep -q "Dump completed" || die "DB backup is incomplete"
mv "$DB_FILE.part" "$DB_FILE"
echo "  DB backup verified: $DB_FILE"

# public_html entier (site + api), sauf api/storage quand c'est déjà notre lien.
# La première (installation manuelle) est nommée « initial » et jamais supprimée.
if [ "$INITIAL" = "1" ]; then WEB_FILE="$BK/public_html-initial-$STAMP.tar.gz"; else WEB_FILE="$BK/public_html-$STAMP.tar.gz"; fi
EXCL=()
[ -L "$API/storage" ] && EXCL=(--exclude=./api/storage)
( umask 077; tar -czf "$WEB_FILE.part" -C "$WEB" "${EXCL[@]}" . )
gzip -t "$WEB_FILE.part" || die "docroot backup is corrupt"
in_tar=$(tar -tzf "$WEB_FILE.part" | grep -vc '^\./$' || true)
if [ -L "$API/storage" ]; then
  on_disk=$(find "$WEB" -mindepth 1 -path "$API/storage" -prune -o -print | wc -l)
else
  on_disk=$(find "$WEB" -mindepth 1 | wc -l)
fi
[ "$in_tar" -eq "$on_disk" ] || die "docroot backup has $in_tar entries, public_html has $on_disk"
mv "$WEB_FILE.part" "$WEB_FILE"
echo "  docroot backup verified: $WEB_FILE ($in_tar entries)"

PREV=$(readlink "$APP/current" 2>/dev/null || echo none)
echo "$STAMP deploy $RELEASE prev=$PREV db=$DB_FILE web=$WEB_FILE migrations=$RUN_MIGRATIONS" >> "$BK/deploys.log"

# --- 4. Migrations : uniquement sur demande explicite ------------------------
cd "$NEW/backend"
if [ "$RUN_MIGRATIONS" = "1" ]; then
  echo "== Migrations"
  php artisan migrate --force --no-interaction
else
  echo "== Migrations skipped (run-migrations=0)"
  php artisan migrate:status --no-interaction >/dev/null \
    || die "migration status unreadable (empty database? the first deploy needs run-migrations=1)"
fi
php artisan optimize --no-interaction

# --- 5. Bascule -------------------------------------------------------------
echo "== Switch"
ln -sfn "$NEW/backend" "$APP/current.tmp"
mv -Tf "$APP/current.tmp" "$APP/current"
SWITCHED=1

# Un vrai dossier api/storage (ancienne installation) est déplacé dans les sauvegardes.
if [ -e "$API/storage" ] && [ ! -L "$API/storage" ]; then
  mv "$API/storage" "$BK/old-api-storage-$STAMP"
  echo "  old public_html/api/storage moved to $BK/old-api-storage-$STAMP"
fi
# Conservés : api/ (géré à part), .well-known (SSL), .user.ini (réglages PHP Hostinger).
rsync -a --delete --exclude=/api --exclude=/.well-known --exclude=/.user.ini "$NEW/web/" "$WEB/"
mkdir -p "$API"
rsync -a --delete --exclude=/storage --exclude=/.well-known --exclude=/.user.ini "$NEW/api/" "$API/"
[ -L "$API/storage" ] || ln -s "$SHARED/storage/app/public" "$API/storage"

# --- 6. Rétention (jamais shared/, jamais la version active ni la précédente) ------
keep_cur=$(basename "$(dirname "$(readlink "$APP/current")")")
keep_prev=$(basename "$(dirname "$PREV")")
find "$APP/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %f\n' | sort -rn | tail -n +6 | cut -d' ' -f2 |
  while read -r old; do
    [ "$old" = "$keep_cur" ] || [ "$old" = "$keep_prev" ] || rm -rf "${APP:?}/releases/$old"
  done
find "$BK" -maxdepth 1 -name 'db-*.sql.gz' -printf '%T@ %p\n' | sort -rn | tail -n +11 | cut -d' ' -f2- | xargs -r rm -f
find "$BK" -maxdepth 1 -name 'public_html-2*.tar.gz' -printf '%T@ %p\n' | sort -rn | tail -n +11 | cut -d' ' -f2- | xargs -r rm -f

echo "Deployed $RELEASE (initial=$INITIAL, migrations=$RUN_MIGRATIONS)"

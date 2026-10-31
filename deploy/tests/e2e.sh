#!/usr/bin/env bash
# Test de bout en bout (CI) des scripts de déploiement, du routage .htaccess des deux
# sous-domaines et de la conservation du stockage, dans des conteneurs (Docker requis).
# Ne touche jamais un vrai serveur.
#   bash deploy/tests/e2e.sh release.tgz
set -euo pipefail

ARCHIVE="$(realpath "${1:?release.tgz}")"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
SITE=routier.test
API_HOST="api.$SITE"
H=/srv/home
ROOT="$H/domains/$SITE"
WEB_PORT=8080
fails=0

pass() { printf '  PASS  %s\n' "$*"; }
fail() { printf '  FAIL  %s\n' "$*"; fails=$((fails + 1)); }
check() { local label="$1"; shift; if "$@"; then pass "$label"; else fail "$label"; fi; }

as_site() { docker exec -u www-data -e HOME="$H" rtweb bash -c "$1"; }
as_root() { docker exec rtweb bash -c "$1"; }

# GET via Apache comme le navigateur derrière le proxy HTTPS de Hostinger.
fetch() { # host path -> CODE, BODY, HEAD
  local tmp; tmp=$(mktemp)
  HEAD=$(curl -s -D - -o "$tmp" -H "Host: $1" -H 'X-Forwarded-Proto: https' "http://127.0.0.1:$WEB_PORT$2")
  CODE=$(printf '%s' "$HEAD" | awk 'NR==1 {print $2}')
  BODY=$(cat "$tmp"); rm -f "$tmp"
}
expect() { # host path code kind(spa|json|text:<extrait>|any)
  fetch "$1" "$2"
  local ok=1
  [ "$CODE" = "$3" ] || ok=0
  case "$4" in
    spa) [[ "$BODY" == *"<title>Routier+237"* ]] || ok=0 ;;
    json) [[ "$HEAD" == *"application/json"* ]] || ok=0 ;;
    text:*) [[ "$BODY" == *"${4#text:}"* ]] || ok=0 ;;
  esac
  check "GET $1$2 -> $3 ($4) [got $CODE]" test "$ok" = 1
}

cleanup() { docker rm -f rtweb rtdb >/dev/null 2>&1 || true; docker network rm rtnet >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

echo "== Containers"
docker build -q -t routier-e2e "$REPO/deploy/tests" >/dev/null
docker network create rtnet >/dev/null
# Identifiants jetables de test (pas des secrets). Le mot de passe contient " et #
# pour prouver l'échappement du fichier d'options MySQL.
docker run -d --name rtdb --network rtnet \
  -e MARIADB_ROOT_PASSWORD=root-ci -e MARIADB_DATABASE=routier \
  -e MARIADB_USER=rt -e 'MARIADB_PASSWORD=ci#pa"ss' mariadb:11 >/dev/null
docker run -d --name rtweb --network rtnet -p "$WEB_PORT:80" \
  -v "$REPO/deploy:/repo/deploy:ro" -v "$ARCHIVE:/repo/release.tgz:ro" routier-e2e >/dev/null
for _ in $(seq 60); do
  docker exec rtdb mariadb -urt -p'ci#pa"ss' -e 'select 1' routier >/dev/null 2>&1 && break; sleep 2
done
as_root 'php -r "exit(function_exists(\"proc_open\") ? 1 : 0);"' && pass "proc_open disabled in the test box" || fail "proc_open still enabled"

echo "== Fake Hostinger account with the current manual install"
KEY=$(as_root 'php -r "echo base64_encode(random_bytes(32));"')
as_root "set -e
mkdir -p $ROOT/public_html/api $ROOT/app/shared
echo '<title>old build</title>' > $ROOT/public_html/index.html
echo old > $ROOT/public_html/old-asset.js
echo '<?php echo \"old api\";' > $ROOT/public_html/api/index.php
echo upload_max_filesize=20M > $ROOT/public_html/.user.ini
cat > $ROOT/app/shared/.env <<'ENV'
APP_NAME=\"Routier+237\"
APP_ENV=staging
APP_KEY=base64:$KEY
APP_DEBUG=false
APP_URL=https://$API_HOST
FRONTEND_URL=https://$SITE
LOG_CHANNEL=single
DB_CONNECTION=mysql
DB_HOST=rtdb
DB_PORT=3306
DB_DATABASE=routier
DB_USERNAME=rt
DB_PASSWORD='ci#pa\"ss'
SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=sync
BROADCAST_CONNECTION=null
MAIL_MAILER=log
PAYMENT_DEFAULT_DRIVER=mock
FCM_ENABLED=false
ENV
chown -R www-data:www-data $H
chmod 600 $ROOT/app/shared/.env
cat > /etc/apache2/sites-available/000-default.conf <<CONF
<Directory $H/domains>
    AllowOverride All
    Require all granted
</Directory>
<VirtualHost *:80>
    ServerName $SITE
    DocumentRoot $ROOT/public_html
</VirtualHost>
<VirtualHost *:80>
    ServerName $API_HOST
    DocumentRoot $ROOT/public_html/api
</VirtualHost>
CONF
apache2ctl -k graceful"
sleep 2

deploy() { # release migrations initial
  as_site "cp /repo/release.tgz /tmp/$1.tgz && bash /repo/deploy/remote-deploy.sh $SITE $1 /tmp/$1.tgz $2 $3; s=\$?; rm -f /tmp/$1.tgz; exit \$s"
}
old_site_intact() { as_site "grep -q 'old build' $ROOT/public_html/index.html && test -f $ROOT/public_html/old-asset.js && grep -q 'old api' $ROOT/public_html/api/index.php"; }

echo "== 1. First deploy refused without allow-initial"
if deploy r0 1 0; then fail "deploy without allow-initial should fail"; else pass "refused"; fi
check "old site untouched" old_site_intact
check "no release left behind" as_site "test ! -e $ROOT/app/releases/r0"

echo "== 2. Initial deploy without migrations aborts on the empty database"
if deploy r0 0 1; then fail "should fail on an empty DB"; else pass "aborted"; fi
check "old site untouched" old_site_intact
check "aborted release removed" as_site "test ! -e $ROOT/app/releases/r0"
check "no app/current" as_site "test ! -e $ROOT/app/current"

echo "== 3. Initial deploy with migrations"
check "deploy r1" deploy r1 1 1
check "DB backup verified and private" as_site "f=\$(ls $ROOT/backups/db-*.sql.gz | tail -n 1); gzip -t \$f && test \$(stat -c %a \$f) = 600"
check "docroot backup holds the old site and old api" as_site "tar -tzf \$(ls -t $ROOT/backups/public_html-*.tar.gz | head -n 1) | grep -q './api/index.php'"
check "initial backup named and kept apart" as_site "ls $ROOT/backups/public_html-initial-*.tar.gz >/dev/null"
check "old build file replaced" as_site "test ! -e $ROOT/public_html/old-asset.js"
check "api/index.php now loads app/current" as_site "grep -q app/current $ROOT/public_html/api/index.php"
check "api/storage is a symlink to shared storage" as_site "test \"\$(readlink $ROOT/public_html/api/storage)\" = $ROOT/app/shared/storage/app/public"
check ".user.ini kept in public_html" as_site "grep -q upload_max_filesize $ROOT/public_html/.user.ini"
check "seed is a separate explicit step" as_site "cd $ROOT/app/current && php artisan db:seed --force --no-interaction >/dev/null"
users=$(docker exec rtdb mariadb -urt -p'ci#pa"ss' -N -e 'select count(*) from users' routier)
check "staging seed: reference data only, no demo account [got $users]" test "$users" = 0
as_site "mkdir -p $ROOT/app/shared/storage/app/public/avatars && echo ci-avatar > $ROOT/app/shared/storage/app/public/avatars/ci-probe.txt"

echo "== Routing"
expect "$SITE" / 200 spa
expect "$SITE" /login 200 spa
expect "$SITE" /agency/login 200 spa
expect "$SITE" /admin/users 200 spa
expect "$SITE" /firebase-messaging-sw.js 200 any
expect "$SITE" /.htaccess 403 any
expect "$SITE" /api/v1/cities 404 any
asset=$(as_site "ls $ROOT/public_html/assets | grep -m1 '\.js$'")
expect "$SITE" "/assets/$asset" 200 any
expect "$SITE" /assets/ancien-build-ABC123.js 404 any
expect "$API_HOST" /up 200 any
expect "$API_HOST" /api/v1/cities 200 json
check "cities seeded" grep -q '"slug":"bertoua"' <<<"$BODY"
expect "$API_HOST" /api/v1/route-inexistante 404 json
expect "$API_HOST" /api/v1/account/reservations 401 json
expect "$API_HOST" /storage/avatars/ci-probe.txt 200 text:ci-avatar
expect "$API_HOST" /.env 403 any
code=$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $SITE" "http://127.0.0.1:$WEB_PORT/search")
check "plain http redirects to https [got $code]" test "$code" = 301

echo "== 4. Second deploy keeps storage"
check "deploy r2" deploy r2 0 0
check "storage survived" as_site "grep -q ci-avatar $ROOT/app/shared/storage/app/public/avatars/ci-probe.txt"
check "initial backup not rotated" as_site "ls $ROOT/backups/public_html-initial-*.tar.gz >/dev/null"
expect "$API_HOST" /storage/avatars/ci-probe.txt 200 text:ci-avatar
check "current is r2" as_site "readlink $ROOT/app/current | grep -q /r2/"

echo "== 5. Rollback"
check "rollback.sh" as_site "bash $ROOT/app/releases/r2/deploy/rollback.sh $SITE"
check "current is r1" as_site "readlink $ROOT/app/current | grep -q /r1/"
expect "$API_HOST" /api/v1/cities 200 json
expect "$SITE" / 200 spa

echo "== 6. Cron commands run without proc_open"
for c in "reservations:expire" "trips:complete-past" "sanctum:prune-expired --hours=24"; do
  check "php artisan $c" as_site "cd $ROOT/app/current && php artisan $c --no-interaction >/dev/null"
done

echo
if [ "$fails" -gt 0 ]; then
  echo "$fails check(s) failed"; docker logs rtweb 2>&1 | tail -n 30
  as_root "tail -n 40 $ROOT/app/shared/storage/logs/laravel.log 2>/dev/null" || true
  exit 1
fi
echo "All e2e checks passed"

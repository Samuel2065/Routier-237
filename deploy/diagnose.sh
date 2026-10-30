#!/usr/bin/env bash
# Diagnostic Hostinger en lecture seule : ne modifie rien, n'affiche aucun secret (ne lit jamais .env).
# Seuls effets : un dossier temporaire dans /tmp pour le test des liens (supprimé aussitôt)
# et quelques requêtes GET vers le site.
# Depuis Windows, retirer les CR pour un dépôt extrait en CRLF :
#   tr -d '\r' < deploy/diagnose.sh | ssh -p 65002 u133979320@<hôte> 'bash -s -- routier237.artischools.com'
SITE="${1:-routier237.artischools.com}"
ROOT="$HOME/domains/$SITE"
ok() { printf '  [OK]  %s\n' "$*"; }
ko() { printf '  [!!]  %s\n' "$*"; }

echo "== PHP CLI ($(command -v php))"
php -v | head -n 1
php -r 'exit(version_compare(PHP_VERSION,"8.2.0",">=")?0:1);' \
  && ok "PHP >= 8.2 (composer.json)" || ko "PHP < 8.2: choose 8.3 in hPanel"
for m in pdo_mysql mbstring openssl tokenizer xml ctype fileinfo curl; do
  php -m | grep -qix "$m" && ok "ext $m" || ko "ext $m missing"
done
php -r 'echo "  memory_limit=",ini_get("memory_limit")," upload_max_filesize=",ini_get("upload_max_filesize")," post_max_size=",ini_get("post_max_size"),PHP_EOL;'
php -r 'echo "  disabled_functions=",ini_get("disabled_functions") ?: "(none)",PHP_EOL;'

echo "== PHP binaries for cron (cron may not use the same php as SSH)"
for p in /usr/bin/php /usr/local/bin/php /opt/alt/php83/usr/bin/php; do
  [ -x "$p" ] && echo "  $p -> $("$p" -r 'echo PHP_VERSION;' 2>/dev/null)"
done

echo "== Tools"
for t in git tar gzip rsync mariadb-dump mysqldump mysql; do
  command -v "$t" >/dev/null && ok "$t: $("$t" --version 2>&1 | head -n 1)" || ko "$t absent"
done

echo "== Site layout"
[ -d "$ROOT/public_html" ] && ok "public_html: $(find "$ROOT/public_html" -mindepth 1 | wc -l) entries, $(du -sh "$ROOT/public_html" | cut -f1)"
[ -f "$ROOT/public_html/api/index.php" ] && {
  grep -q 'app/current' "$ROOT/public_html/api/index.php" \
    && ok "public_html/api/index.php uses app/current" \
    || echo "  public_html/api/index.php: manual install (replaced by the first deploy)"
}
[ -e "$ROOT/public_html/api/storage" ] && { [ -L "$ROOT/public_html/api/storage" ] && echo "  public_html/api/storage is a symlink" || ko "public_html/api/storage is a real folder (moved to backups, not deleted)"; }
[ -d "$HOME/routier237-api" ] && echo "  old install ~/routier237-api present (kept, not used after the first deploy)"
[ -f "$ROOT/public_html/.user.ini" ] && echo "  public_html/.user.ini present (kept by deploys)"
[ -d "$ROOT/public_html/.well-known" ] && echo "  public_html/.well-known present (kept by deploys)"
[ -L "$ROOT/app/current" ] && ok "app/current -> $(readlink "$ROOT/app/current")" || echo "  app/current absent: first deploy needs allow_initial"
if [ -f "$ROOT/app/shared/.env" ]; then
  [ "$(stat -c %a "$ROOT/app/shared/.env")" = "600" ] && ok "shared/.env exists, chmod 600 (content not read)" || ko "shared/.env is not chmod 600"
else
  echo "  shared/.env not created yet (deploy/README.md)"
fi
[ -f "$ROOT/app/shared/storage/app/private/firebase-credentials.json" ] && echo "  Firebase file present in shared storage (content not read)"
[ -d "$ROOT/backups" ] && echo "  backups: $(find "$ROOT/backups" -maxdepth 1 -type f | wc -l) files"

echo "== Symlinks"
t=$(mktemp -d) && ln -s "$t" "$t/l" && [ -L "$t/l" ] && ok "ln -s works"; rm -rf "$t"

echo "== HTTP"
curl -s -o /dev/null -w "  https://$SITE/ -> %{http_code}\n" "https://$SITE/"
for p in /up /api/v1/cities; do
  curl -s -o /dev/null -w "  https://api.$SITE$p -> %{http_code}\n" "https://api.$SITE$p"
done

echo "== Cron"
echo "  crontab -l (hPanel jobs may not appear here, see deploy/README.md):"
crontab -l 2>/dev/null | sed 's/^/    /' || echo "    (empty or not readable)"
L="$ROOT/app/shared/storage/logs/cron.log"
[ -f "$L" ] && echo "  cron.log last written: $(date -r "$L" '+%Y-%m-%d %H:%M')" || echo "  cron.log absent (the cron jobs have not run yet)"

echo "== Disk"
df -h "$HOME" | tail -n 1 | sed 's/^/  /'

#!/usr/bin/env bash
# Tests deploy/ssh-setup.sh with throwaway values (no real host, no secret).
#   bash deploy/tests/ssh-setup-test.sh
set -euo pipefail
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fails=0
pass() { echo "PASS  $*"; }
fail() { echo "FAIL  $*"; fails=$((fails + 1)); }

ssh-keygen -q -t ed25519 -N '' -C ci-dummy -f "$T/key"
HOSTKEY=$(cut -d' ' -f1,2 "$T/key.pub")
base_env() {
  export SSH_HOST=203.0.113.10 SSH_PORT=65002 SSH_USER=u000000000
  SSH_PRIVATE_KEY=$(cat "$T/key"); export SSH_PRIVATE_KEY
  export SSH_KNOWN_HOSTS="[203.0.113.10]:65002 $HOSTKEY"
}
run() { SSH_DIR="$T/$1" bash "$REPO/deploy/ssh-setup.sh" >"$T/$1.log" 2>&1; }

base_env
if run good; then pass "valid values accepted"; else fail "valid values rejected"; cat "$T/good.log"; fi
grep -qx '  StrictHostKeyChecking yes' "$T/good/config" && pass "config line: StrictHostKeyChecking yes" || fail "StrictHostKeyChecking line"
grep -qx '  BatchMode yes' "$T/good/config" && pass "config line: BatchMode yes" || fail "BatchMode line"
if [ "$(uname -s)" = Linux ]; then   # NTFS (Git Bash) has no Unix modes
  [ "$(stat -c %a "$T/good/deploy_key")" = 600 ] && pass "key file 600" || fail "key file mode"
else
  echo "SKIP  key file mode (not Linux)"
fi
if grep -q "$SSH_USER\|203.0.113.10\|PRIVATE" "$T/good.log"; then fail "log prints a value"; else pass "log prints no value"; fi

base_env; export SSH_PORT=22x
if run badport; then fail "bad port accepted"; else pass "bad port rejected"; fi
base_env; export SSH_KNOWN_HOSTS="[198.51.100.1]:65002 $HOSTKEY"
if run nohost; then fail "unpinned host accepted"; else pass "unpinned host rejected"; fi
base_env; export SSH_PRIVATE_KEY=not-a-key
if run badkey; then fail "bad key accepted"; else pass "bad key rejected"; fi
base_env; export SSH_USER=""
if run nouser; then fail "empty user accepted"; else pass "empty user rejected"; fi
base_env; SSH_PRIVATE_KEY=$(sed 's/$/\r/' "$T/key"); export SSH_PRIVATE_KEY
if run crlf; then pass "CRLF key accepted (CR stripped)"; else fail "CRLF key rejected"; cat "$T/crlf.log"; fi

[ "$fails" -eq 0 ] && echo "All ssh-setup checks passed" || { echo "$fails failed"; exit 1; }

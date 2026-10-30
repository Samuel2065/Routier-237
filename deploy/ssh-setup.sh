#!/usr/bin/env bash
# Writes the SSH client files for the deploy job and validates them WITHOUT
# connecting and without printing any value (only OK/FAIL labels).
# Input (environment): SSH_HOST SSH_PORT SSH_USER SSH_PRIVATE_KEY SSH_KNOWN_HOSTS
# Optional: SSH_DIR (default ~/.ssh). Result: `ssh target` uses the pinned host key.
set -euo pipefail
umask 077

die() { echo "  [FAIL] $*" >&2; exit 1; }
ok() { echo "  [OK]   $*"; }

D="${SSH_DIR:-$HOME/.ssh}"
for v in SSH_HOST SSH_PORT SSH_USER SSH_PRIVATE_KEY SSH_KNOWN_HOSTS; do
  [ -n "${!v:-}" ] || die "$v is empty"
done
[[ "$SSH_PORT" =~ ^[0-9]{1,5}$ ]] || die "SSH_PORT is not a number"
[[ "$SSH_HOST" =~ ^[A-Za-z0-9.:-]+$ ]] || die "SSH_HOST has unexpected characters"
[[ "$SSH_USER" =~ ^[A-Za-z0-9._-]+$ ]] || die "SSH_USER has unexpected characters"

mkdir -p "$D" && chmod 700 "$D"
printf '%s\n' "$SSH_PRIVATE_KEY" | tr -d '\r' > "$D/deploy_key"
printf '%s\n' "$SSH_KNOWN_HOSTS" | tr -d '\r' > "$D/known_hosts"
{
  echo "Host target"
  echo "  HostName $SSH_HOST"
  echo "  Port $SSH_PORT"
  echo "  User $SSH_USER"
  echo "  IdentityFile $D/deploy_key"
  echo "  IdentitiesOnly yes"
  echo "  UserKnownHostsFile $D/known_hosts"
  echo "  StrictHostKeyChecking yes"
  echo "  BatchMode yes"
  echo "  ConnectTimeout 20"
} > "$D/config"
chmod 600 "$D/deploy_key" "$D/known_hosts" "$D/config"

# Validate what ssh will really use (`ssh -G` parses the config, no connection).
G=$(ssh -G -F "$D/config" target)
want() { grep -qix "$1" <<<"$G" || die "ssh option: $2"; ok "ssh option: $2"; }
want "hostname $SSH_HOST" "HostName"
want "port $SSH_PORT" "Port"
want "user $SSH_USER" "User"
want "stricthostkeychecking true" "StrictHostKeyChecking yes"
want "batchmode yes" "BatchMode yes"
want "identitiesonly yes" "IdentitiesOnly yes"
grep -qi "^identityfile .*deploy_key$" <<<"$G" || die "ssh option: IdentityFile"; ok "ssh option: IdentityFile"

ssh-keygen -y -f "$D/deploy_key" >/dev/null 2>&1 || die "private key unreadable (or has a passphrase)"
ok "private key readable"
if [ "$SSH_PORT" = "22" ]; then hk="$SSH_HOST"; else hk="[$SSH_HOST]:$SSH_PORT"; fi
ssh-keygen -F "$hk" -f "$D/known_hosts" >/dev/null || die "known_hosts has no key for the host and port"
ok "host key pinned for the host and port"

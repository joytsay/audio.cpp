#!/bin/sh
set -eu

fail() { printf '%s\n' "$1" >&2; exit 1; }
# Values are written as data, never evaluated as shell commands.
check_value() {
    case "$1" in
        *'
'*|*"$(printf '\r')"*|*'#'*) fail "Invalid $2: newline and # are not supported" ;;
    esac
}
check_value "${COTURN_LISTEN_IP:-}" COTURN_LISTEN_IP
check_value "${COTURN_RELAY_IP:-}" COTURN_RELAY_IP
check_value "${COTURN_EXTERNAL_IP:-}" COTURN_EXTERNAL_IP
check_value "${COTURN_PORT:-}" COTURN_PORT
check_value "${COTURN_REALM:-}" COTURN_REALM
check_value "${COTURN_USERNAME:-}" COTURN_USERNAME
check_value "${COTURN_PASSWORD:-}" COTURN_PASSWORD
check_value "${COTURN_MIN_PORT:-}" COTURN_MIN_PORT
check_value "${COTURN_MAX_PORT:-}" COTURN_MAX_PORT
: "${COTURN_LISTEN_IP:?Set COTURN_LISTEN_IP}"
: "${COTURN_USERNAME:?Set COTURN_USERNAME}"
: "${COTURN_PASSWORD:?Set COTURN_PASSWORD}"
[ "$COTURN_PASSWORD" != REPLACE_WITH_TURN_PASSWORD ] || fail 'Replace the COTURN_PASSWORD placeholder'
case "$COTURN_USERNAME" in *[!a-zA-Z0-9_.-]*) fail 'Invalid COTURN_USERNAME' ;; esac
case "${COTURN_REALM:-ivrtts}" in *[!a-zA-Z0-9_.-]*) fail 'Invalid COTURN_REALM' ;; esac
# Coturn validates the IP addresses when it starts.
COTURN_RELAY_IP=${COTURN_RELAY_IP:-$COTURN_LISTEN_IP}
COTURN_PORT=${COTURN_PORT:-3478}
COTURN_MIN_PORT=${COTURN_MIN_PORT:-49160}
COTURN_MAX_PORT=${COTURN_MAX_PORT:-49200}
for value in "$COTURN_PORT" "$COTURN_MIN_PORT" "$COTURN_MAX_PORT"; do
    case "$value" in ''|*[!0-9]*) fail 'Coturn ports must be integers' ;; esac
    [ "${#value}" -le 5 ] && [ "$value" -ge 1 ] && [ "$value" -le 65535 ] || fail 'Coturn ports must be between 1 and 65535'
done
[ "$COTURN_MIN_PORT" -le "$COTURN_MAX_PORT" ] || fail 'Coturn minimum relay port exceeds maximum'
if [ "$COTURN_PORT" -ge "$COTURN_MIN_PORT" ] && [ "$COTURN_PORT" -le "$COTURN_MAX_PORT" ]; then
    fail 'Coturn listening port overlaps its relay port range'
fi
case "${COTURN_VERBOSE:-0}" in 0|1) ;; *) fail 'COTURN_VERBOSE must be 0 or 1' ;; esac
umask 077
config=$(mktemp /tmp/coturn.XXXXXX)
{
    printf 'listening-ip=%s\nrelay-ip=%s\n' "$COTURN_LISTEN_IP" "$COTURN_RELAY_IP"
    printf 'listening-port=%s\nmin-port=%s\nmax-port=%s\n' "$COTURN_PORT" "$COTURN_MIN_PORT" "$COTURN_MAX_PORT"
    printf 'realm=%s\nuser=%s:%s\n' "${COTURN_REALM:-ivrtts}" "$COTURN_USERNAME" "$COTURN_PASSWORD"
    [ -z "${COTURN_EXTERNAL_IP:-}" ] || printf 'external-ip=%s\n' "$COTURN_EXTERNAL_IP"
    # Coturn 4.18 disables CLI and DTLS by default; their old negative flags
    # are deprecated or rejected. Keep plain TURN and disable TLS explicitly.
    [ "${COTURN_VERBOSE:-0}" = 0 ] || printf '%s\n' verbose
    printf '%s\n' lt-cred-mech fingerprint no-tls no-multicast-peers no-software-attribute log-file=stdout simple-log pidfile=/tmp/coturn.pid
} > "$config"
# Credentials stay in the private tmpfs config, rather than process arguments.
exec turnserver -c "$config"

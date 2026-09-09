#!/bin/sh
set -eu
PATH="/usr/bin:$PATH"
export PATH
APP_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$APP_DIR"
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev >>/tmp/app-startup.log 2>&1 &
# Windows command sessions own their child process lifetime. Keep the session
# attached when explicitly requested; the platform restart remains non-blocking.
if [ "${XRAY_STARTUP_WAIT:-0}" = "1" ]; then
  wait "$!"
fi

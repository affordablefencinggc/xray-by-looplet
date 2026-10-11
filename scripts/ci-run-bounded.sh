#!/usr/bin/env bash
# GNU timeout contains the build process group; preserve its real failure code.
set -euo pipefail
if (( $# < 2 )); then
  echo "usage: ci-run-bounded.sh <duration> <command> [args...]" >&2
  exit 2
fi
duration=$1
shift
timeout --kill-after=30s "$duration" "$@" &
build_pid=$!
(
  sleep_pid=''
  trap 'if [[ -n "$sleep_pid" ]]; then kill "$sleep_pid" 2>/dev/null || true; wait "$sleep_pid" 2>/dev/null || true; fi' EXIT
  trap 'exit 0' INT TERM
  while kill -0 "$build_pid" 2>/dev/null; do
    echo "NATIVE_BUILD_HEARTBEAT $(date -u +%FT%TZ) owner=$build_pid"
    ps -eo pid,ppid,etimes,pcpu,pmem,stat,wchan:24,comm --sort=-pcpu 2>/dev/null | head -12 || true
    if [[ -d src-tauri/target/release/bundle ]]; then
      find src-tauri/target/release/bundle -maxdepth 2 -type f -printf '%s %p\n' 2>/dev/null | head -12 || true
    fi
    sleep 30 &
    sleep_pid=$!
    wait "$sleep_pid" || true
    sleep_pid=''
  done
) &
monitor_pid=$!
cleanup() {
  kill "$monitor_pid" 2>/dev/null || true
  if kill -0 "$build_pid" 2>/dev/null; then
    kill -TERM -- "-$build_pid" 2>/dev/null || true
  fi
  wait "$monitor_pid" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
set +e
wait "$build_pid"
result=$?
set -e
echo "NATIVE_BUILD_EXIT=$result"
exit "$result"
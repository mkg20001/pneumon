#!/bin/bash

set -eE

run_test() {
  TEST_NAME="$1"
  TEST_DISPLAY="$2"
  # TODO: isolate set -e, get res
  echo
  echo " -> Running '$TEST_DISPLAY'"
  echo
  "$1"
  echo
  echo " -* '$TEST_DISPLAY' PASSED"
  echo
}

fail_test() {
  echo
  echo " -* '$TEST_DISPLAY' FAILED"
  echo
  exit 2
}

trap fail_test ERR

SRC=$(dirname $(dirname $(readlink -f $0)))
TEST=$(dirname $(readlink -f $0))
TMP="$TEST/tmp"
APP="$TMP/run/app.js"
export DEBUG='pneumon*'

cd "$TEST"

get_ver() {
  nc localhost 3779 < /dev/null
}

app_ver() {
  cat "$TEST/test-app.js" | sed "s|#VERSION#|$1|g"
}

clean() {
  rm -rf "$TMP"
  if [ -e "/tmp/pn-ht.pid" ]; then
    kill "$(cat /tmp/pn-ht.pid)" || echo "Couldn't kill"
    rm "/tmp/pn-ht.pid"
  fi
  sudo -E node "$TEST/test-app.js" "uninstall"
}

prepare() {
  clean

  mkdir "$TMP"
  mkdir "$TMP/run"
  mkdir "$TMP/dl"

  app_ver v1 > "$TMP/run/app.js"
  app_ver v2 > "$TMP/dl/app.js"
  node "$SRC/src/bin.js" --hash --version v2 --file "$TMP/dl/app.js" --out "$TMP/dl/app.json"
  http-server -p 3778 "$TMP/dl" &
  echo $! > "/tmp/pn-ht.pid"
}

install_app() {
  sudo -E node "$APP" "install"

  sleep 2s

  if [ "$(get_ver)" != "v1" ]; then
    echo "Wrong version"
    exit 2
  fi
}

update_app() {
  echo "Wait for auto-update to trigger..."
  sleep 5s

  echo "Check..."
  if [ "$(get_ver)" != "v2" ]; then
    echo "Wrong version"
    exit 2
  fi
}

uninstall_app() {
  sudo -E node "$APP" uninstall ; :

  if get_ver; then
    echo "Still running, failed"
    exit 2
  fi
}

full_run() {
  run_test prepare "Prepare tests"
  run_test install_app "Install app"
  run_test update_app "Verify auto-update works"
  run_test uninstall_app "Uninstall app"
  run_test clean "Cleanup"
}

full_run

# TODO: add wrapper script tests
# export WRAPPER_SCRIPT=""
# full_run

# TODO: add pkg test

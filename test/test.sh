#!/bin/bash

set -eE

run_test() {
  TEST_NAME="$1"
  TEST_DISPLAY="$2"
  # TODO: isolate set -e, get res
  echo
  echo " > $CAT -> Running '$TEST_DISPLAY'"
  echo
  "$1"
  echo
  echo " > $CAT -* '$TEST_DISPLAY' PASSED"
  echo
}

fail_test() {
  echo
  echo " > $CAT -* '$TEST_DISPLAY' FAILED"
  echo
  exit 2
}

trap fail_test ERR

SRC=$(dirname $(dirname $(readlink -f $0)))
TEST=$(dirname $(readlink -f $0))
TMP="$TEST/tmp"
export DEBUG='pneumon*'

cd "$TEST"

get_ver() {
  nc localhost 3779 < /dev/null
}

app_ver() {
  cat "$TEST/test-app.js" | sed "s|#VERSION#|$1|g" | sed "s|#WRAPPER#|$WRAPPER_SCRIPT|g"
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

  build_app
  http-server -p 3778 "$TMP/dl" &
  echo $! > "/tmp/pn-ht.pid"
}

install_app() {
  "${APP_CMD[@]}" "install"

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
  "${APP_CMD[@]}" uninstall ; :

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

build_app() {
  app_ver v1 > "$TMP/run/app.js"
  app_ver v2 > "$TMP/dl/app.js"
  node "$SRC/src/bin.js" --hash --version v2 --file "$TMP/dl/app.js" --out "$TMP/dl/app.json"
}
APP="$TMP/run/app.js"
APP_CMD=(sudo -E node "$APP")

# normal tests
CAT="normal"
full_run

# wrapper script tests
CAT="wrapper"
WRAPPER_SCRIPT="$TMP/wrapper.sh"
full_run
WRAPPER_SCRIPT=

build_app() {
  app_ver v1 > "$TMP/run/app.js"
  pkg -t node10-linux -o "$TMP/run/app" "$TMP/run/app.js"
  app_ver v2 > "$TMP/dl/app.js"
  pkg -t node10-linux -o "$TMP/dl/app" "$TMP/dl/app.js"
  node "$SRC/src/bin.js" --hash --version v2 --file "$TMP/dl/app" --out "$TMP/dl/app.json"
}
APP="$TMP/run/app"
APP_CMD=(sudo -E "$APP")

# pkg tests
CAT="pkg"
full_run

CAT="pkg-wrapper"
WRAPPER_SCRIPT="$TMP/wrapper.sh"
full_run
WRAPPER_SCRIPT=

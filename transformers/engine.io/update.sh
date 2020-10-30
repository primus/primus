#!/usr/bin/env bash

set -e

DESTDIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TEMPDIR=$(mktemp -d 2> /dev/null || mktemp -d -t 'tmp')

cleanup () {
  [ -d "$TEMPDIR" ] && rm -rf "$TEMPDIR"
}

trap cleanup INT TERM EXIT

git clone https://github.com/socketio/engine.io-client.git "$TEMPDIR"
cd "$TEMPDIR"
git checkout "$(git rev-list --tags --max-count=1)"
NODE_ENV=production npm install
"$DESTDIR"/update_tools/globalify.sh "$TEMPDIR"
cd "$DESTDIR"
find patches -name '*.patch' -exec patch -i {} \;

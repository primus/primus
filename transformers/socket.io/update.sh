#!/usr/bin/env bash

set -e

CURRENTDIR=$(pwd)
DESTDIR=$(cd $(dirname ${BASH_SOURCE[0]}) && pwd)
TEMPDIR=$(mktemp -d 2> /dev/null || mktemp -d -t 'tmp')

cleanup () {
  cd $CURRENTDIR
  [ -d $TEMPDIR ] && rm -rf $TEMPDIR
}

trap cleanup INT TERM EXIT

git clone https://github.com/Automattic/socket.io-client.git $TEMPDIR
cd $TEMPDIR
git checkout $(git tag | grep "0\.9" | sort -n -t "." -k 3 | tail -n 1)
NODE_ENV=production npm install && make build
mv dist/socket.io.js $DESTDIR/library.js
cd $DESTDIR
find patches -name *.patch -exec patch -i {} \;

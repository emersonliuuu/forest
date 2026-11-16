#!/bin/sh
# usage: tools/run.sh out.png w h "query" "js"
cd /home/user/forest/source && node build.mjs >/dev/null && cd .. && NODE_PATH=$(npm root -g) timeout 1500 node tools/shot.mjs "$@" 2>&1 | grep -v "Error while parsing" | cut -c1-700 | head -40

#!/bin/sh
# tools/explore.sh <name> <w> <h> <js...>  -> scratch/<name>_i.png
SP=/tmp/claude-0/-home-user-forest/bc5cc237-fd74-52c0-aed8-8c0a7064baee/scratchpad
n=$1; w=$2; h=$3; shift 3
cd /home/user/forest/source && node build.mjs && cd .. && NODE_PATH=$(npm root -g) node tools/poses.mjs $SP/$n $w $h "seed=3" "$@" 2>&1 | cut -c1-400

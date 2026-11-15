#!/bin/sh
# full-resolution critic stills -> verify/zone_N.png
cd /home/user/forest/source && node build.mjs && cd .. && mkdir -p verify && NODE_PATH=$(npm root -g) node tools/poses.mjs verify/zone ${1:-2560} ${2:-1440} "seed=3" "__t.pose(0)" "__t.pose(1)" "__t.pose(2)" "__t.pose(3)" "__t.pose(4)" "__t.pose(5)" 2>&1 | cut -c1-300

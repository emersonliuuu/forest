#!/bin/sh
# render the six zone poses at $1 x $2 into scratch/z_*.png and build montages
SP=/tmp/claude-0/-home-user-forest/bc5cc237-fd74-52c0-aed8-8c0a7064baee/scratchpad
cd /home/user/forest/source && node build.mjs && cd .. && NODE_PATH=$(npm root -g) node tools/poses.mjs $SP/z ${1:-960} ${2:-540} "seed=3&${3}" "__t.pose(0)" "__t.pose(1)" "__t.pose(2)" "__t.pose(3)" "__t.pose(4)" "__t.pose(5)" 2>&1 | cut -c1-600
cd $SP && convert z_0.png z_1.png +append r1.png && convert z_2.png z_3.png +append r2.png && convert z_4.png z_5.png +append r3.png

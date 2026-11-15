# Verification report

**Status: neither "done" gate has passed.** The visual critic still reports defects above "minor" after three rounds, and the performance target could not be measured because the build environment has no GPU.

## Bundle

`index.html`: **90,141 bytes minified (88.0 KB), 35.6 KB gzipped.** Single self-contained file, no external requests.

## Visual critic

Each round a fresh subagent was given only images (never code or reasoning):

- six fixed poses, one per zone, rendered at 2560×1440 (`zone_0.jpg` … `zone_5.jpg` are compressed copies), plus 1:1 crops;
- 12 stations along the scripted climb (`climb.jpg`);
- three bursts of five consecutive frames at 1/30 s with difference images, in the lowland, cloud forest and fir zones.

These were rendered by Chrome's software WebGPU adapter (SwiftShader), not GPU-accelerated Chrome, because the container has no GPU. The image content is the same; only speed differs.

| Round | Critical | Major | Moderate | Outcome |
|---|---|---|---|---|
| 1 | 3 | 8 | 8 | failed |
| 2 | 0 | 5 | 6 | failed |
| 3 | 0 | 6 | 7 | failed |

### Final review (round 3), items above minor

Major:

1. Conifer foliage reads as flat, lobed cards on plank-like branches; zones 3 and 4 look like nearly the same tree.
2. Fir zone lacks its identifiers: snags are not distinguishable from pale live trunks, no cane-meadow clearing in the pose.
3. Hemlock/spruce pose looks up into trunks, so the cane floor is barely visible.
4. Blocky shadow edges and small light dot clusters on trunks in the zone 3 pose.
5. Rock faces and distant slopes are flat grey with fine noise and evenly sprinkled boulders; possible shimmer there.
6. Far view: a bare smooth hill beside a tree-covered one (tree draw cut-off), a ruler-straight cloud-sea horizon, and one climb station that looks into an empty grey void.

Moderate:

7. Lowland limbs look like sawn logs; banyan aerial roots are stiff sticks, buttresses barely visible.
8. Trunk bark is low-detail and stretched at 1:1.
9. Laurel-zone floor is oversaturated orange with a visibly repeating leaf pattern; ferns are flat comb shapes.
10. Cloud-forest moss reads as dark painted blotches; no hanging moss.
11. Alpine ground is a blurry yellow-green smear; rhododendron stems are straight spikes; no scree in the pose.
12. No visible light shafts outside the cloud belt; no humid haze in zones 0 and 1.
13. Shadowed areas crush toward black.

What the critic accepted:

- Cloud forest (zone 2) and alpine (zone 5) are recognisable, clearly distinct and "good".
- Lowland is recognisable; laurel–oak partly; zones 3 and 4 are weak and poorly separated.
- No hard vegetation bands along the climb. The lower half blends smoothly; the upper half is not well demonstrated by the stations.
- No popping or flicker found in any burst. Fine shimmer could not be ruled out, because 0.6 m of movement per frame makes the difference images light up everywhere.

## Performance

Target: RTX 5070 Ti, 2560×1440, GPU frame time ≤ 11 ms average, no frame > 16.7 ms over the scripted 60 s walk.

**Not measured on the target.** The harness is built in and runs end to end:

```bash
# on the target machine, in Chrome
index.html?bench=1&seed=3
```

It walks a fixed route for 60 s (about 117 m/s, 6.5× sprint speed), records GPU timestamp-query durations and frame intervals into preallocated arrays, and prints average, 99th percentile and maximum on screen and as `BENCH {...}` in the console.

The only run so far is on the software rasteriser, at 320×180, and its numbers say nothing about the target:

| | n | avg | p99 | max |
|---|---|---|---|---|
| Route altitude | | 329 m → 3,753 m (all six zones) | | |
| GPU timestamp span (ms) | 5 | 10,536 | 10,852 | 10,852 |
| Frame interval (ms) | 3,580 | 17.4 | 16.8 | 2,217 |

- The GPU figure is SwiftShader working through a backlog of queued frames on 4 CPU cores; only 5 samples came back.
- The frame-interval figure is the JavaScript side ticking at the headless 60 Hz timer while the software GPU falls behind. It shows the per-frame script work is light, with one 2.2 s hitch at start-up (pipeline compilation).

## Other limits of this verification

- The page was only driven headlessly. Pointer-lock mouse look, keyboard walking and normal on-screen presentation in a real browser were not exercised.
- Set pieces seen in test renders: suspension bridge, sacred tree with fence, summit marker. The railway rails were seen only partly, through ferns.
- Animals seen in test renders: deer, butterflies, macaques. Pheasants, bird flocks, fireflies, pollen and falling leaves are generated (instance counts were read back from the GPU) but were not confirmed on screen.
- "Zero per-frame JS allocations" was implemented by construction (preallocated typed arrays and pass descriptors, prebuilt HUD strings) and not profiled. WebGPU itself returns new handles each frame (command encoder, passes, swap-chain view). In bench mode the timestamp readback also allocates.

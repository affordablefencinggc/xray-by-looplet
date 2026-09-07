# First-person arm asset

Acquired from the creator's publicly offered free download, with no payment, login or paywall bypass. [Drillimpact's PSX First Person Arms](https://drillimpact.itch.io/psx-first-person-arms-free) page lists version1.1.0 and explicitly releases the asset under CC0. [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) permits copying, adaptation and redistribution, including commercial use. The ZIP has no standalone licence file, so the public asset directory includes a record of the creator's declaration and both source and licence links.

The older anonymous signed URL had expired; fresh anonymous access through the creator's normal free-download form succeeded. The ordinary download-button endpoint then supplied the ZIP. ZIP names and declared uncompressed sizes were checked before decompression: no absolute/parent paths, entries over50MB or total over100MB. Only root `arms_rig.glb` was extracted for the application; Blender, FBX, old-version files and alternative textures were excluded.

| File | Bytes | SHA256 |
| --- | ---: | --- |
| Creator ZIP | 4,013,463 | `13689348acce167599db2b7190214aa4dbe914f5547f74e1877ff61361fc8cb8` |
| `public/assets/walkthrough/arms.glb` | 1,099,832 | `407d6be3cfee18d8d47318d307a6e759f94ed3a1c27e2ab30dd860862b94172b` |
| `public/assets/walkthrough/LICENSE.txt` | See manifest | `5f8a2cf2d594379a64f61253287bc8b36224e2b927b190e5a2cbf37fd14d12bc` |

The shipped GLB is byte-identical to root `arms_rig.glb` in the ZIP. GLB2 validation passed, with one skinned mesh (`ArmsMesh`), rig root `ArmsRig`, one material and one embedded bare-hands PNG (`arms_01`). There are no external buffer or image URIs. Material uses metallic0 and a base-colour texture; 758 position vertices. No model editing or texture transformation was performed.

Inspection artifacts: `asset-acquisition/zip-entries.json`, `gltf.json`, `rig-summary.json`, `pose-summary.json`, and `asset-manifest.json`. THREE's actual GLTFLoader and AnimationMixer parsed and sampled an inspection-only in-memory copy with texture decoding omitted; shipped GLB remained unchanged. These samples verify rig/animation geometry, not final app visual quality.

Integration observations:

- Y-up, metre-sized rig: root y1.4657 and authored eye helper approximately y1.743155. Default geometry bounds x±0.83872, y1.169798–1.657695, z−0.141288–0.037175.
- Motion reaches toward model+Z; right arm is model−X. A camera child wrapper rotated PI aroundY maps this to camera−Z and camera+X. An initial y offset−1.743155 aligns the authored eye; final visual tuning belongs to the application owner.
- The helper named `camera` is a bone, not an exported glTF camera. Its quaternion's local−Z points approximately−X; do not copy it as a render-camera orientation.
- GLTFLoader sanitizes dotted bone names (`hand.R` becomes `handR`, `forearm.R` becomes `forearmR`). Clip names remain `grab.R`, `push.R`, etc.
- `grab.R` duration0.733333s; midpoint right hand[−0.071872,1.627162,0.335392]. `push.R` duration0.8s; midpoint right hand[−0.062277,1.606238,0.364649]. `relax`2s, `rest`0.066667s. Samples begin at0.033333s. Full18-clip list is retained in rig-summary; the application should select only the relevant grab/push action.

No runtime/UI claim is made here; the root agent owns camera attachment, lifecycle, door-progress timing and screenshots of the new body-based arm.

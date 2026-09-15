# City interactions

All clients should reload the updated game. These features use the existing
`codex/jjs-loader-potato-streaming` branch; its Apps Script BASE stays the same.

| Interaction | Controls and behavior |
| --- | --- |
| Random TNT drops | One appears at a random supported map location every 12 seconds, up to six. Approach and press E or the pickup button. |
| Carry and throw | While holding TNT or a bin, M1/left click throws it. Normal punches resume after throwing. X drops it. An on-screen throw button is also available. |
| TNT | A stylized game pickup. After throwing, it bursts on collision or after 1.6 seconds and knocks nearby characters into a temporary ragdoll. Solid walls block the burst. |
| Trash bins | The map's 19 bins can be picked up and thrown at characters. Their original graphics and collision disappear while carried. A used bin returns after 35 seconds. |
| Ladders | Face a ladder and hold W to start climbing; W/S move up/down and Space jumps away. An M1 strike or heavy impact breaks the whole ladder immediately. Climbers fall. Broken ladders reset with the map. |
| Tower screens | Reach the existing control machine behind either screen and press E. Select a PNG/JPEG/WebP photo or paste an HTTPS MP4/WebM file URL. Stop clears the broadcast. |
| Gojo awakening | White hair separates into wider, loose locks during awakening. The normal hairstyle returns afterward. The same look is used for remote players and bots. |

Throwables knock characters down without reducing their health. The room host
owns pickup claims, projectiles, impacts and ladder destruction. Repeated state
packets repair missed updates, and repeated hits cannot restart a ragdoll.

Photos are resized to at most 512 pixels and compressed before transfer in
8 KB chunks, with a 48 KB payload limit. Players joining later can request the
current photo. Video URLs must point directly to HTTPS `.mp4` or `.webm` files
whose server permits cross-origin playback; ordinary website/YouTube page URLs
are not video files. Videos loop silently, share playback progress, and pause
when far away or when the tab is hidden. No remote video upload service is
required. Source photos are not saved to the repository.

The 12 ladders, 19 bins and two screen/control pairs are generated from the
original Studio snapshot by `tools/build-interaction-data.cjs`. Regenerate
`interaction-data.js` after replacing/reordering the map export.

Validation uses real exported map collision and triangle ownership, Three
objects, actual ragdoll code and simulated room delivery:

```sh
node tools/build-interaction-data.cjs
node tools/test-world-items.cjs
node tools/test-gojo-hair.cjs
node tools/test-train.cjs
node tools/test-potato-streaming.cjs
node tools/build-jujutsu.js
node --experimental-vm-modules tools/test-jjs-loader.cjs
```

Live browser/relay playtesting remains necessary for camera feel, visual
presentation and the chosen video server's cross-origin/autoplay behavior.

# Illustrated opening: Signal / City / Sorcerers

The opening runs for **48 seconds**, with **23 camera shots**, nine generated
art assets and **44 character animation cels**. Press **G** at any time, or use
**SKIP OPENING · G**, to return immediately to the menu. **WATCH OPENING** replays
it before entering a match. Skipping does not start a match or trigger awakening.

The running sheets change at 12 frames per second; casting, eye acting and the
upperkick have timed pose sequences. Camera tracking, foreground architecture,
rain, particles, speed trails and wind continue moving between pose changes.
Short lower-third captions introduce fighters, and the title arrives at the end.

| Time | Sequence |
| --- | --- |
| 0–6 s | Moonlit city establishing shot and rooftop tracking run |
| 6–12 s | Street-level sprint, passing foreground and close tracking shot |
| 12–18 s | Gojo eye acting, camera push and full-body casting |
| 18–24 s | Yuji sprint with alternating framing and fast foreground motion |
| 24–30 s | Naoya run, close tracking and timed afterimages |
| 30–38 s | Domain plaza, Gojo and Sukuna casting, opposing barrier effects |
| 38–44 s | White-wind upperkick with animated skirt, scarf and twin tails |
| 44–48 s | Moving fighter lineup and final game title |

The secret character's name is shown only after her existing unlock. The opening
does not change unlock storage. Her wind effects remain white.

**SOUND: OFF** enables the original synthesized instrumental score. The opening
starts silently for browser autoplay compatibility. Background-tab playback pauses;
reduced-motion preferences slow camera/particle movement and cel playback and
remove rapid wipes.

## Artwork and build

Final assets are in `jujutsu/opening-art/`. `PROMPTS.json` records the complete
prompt set and the generation tool. The built-in image tool was used; it did not
expose a model selector, so GPT Image 2.5 could not be selected or verified.
Three painted backgrounds, five eight-frame body-animation sheets and one
four-frame close-up sheet were generated. WebP format preserves transparent
sprite backgrounds and keeps the complete asset set around 1.74 MB.

`tools/opening-art.cjs` reads and validates the manifest and images.
`tools/build-jujutsu.js` embeds them into both the standalone HTML and split
module as data URLs, keeping local-file and Apps Script loading self-contained.
There are no separate image requests. Run `node tools/build-jujutsu.js` after
changing artwork, the manifest, or the director.

`opening-film.js` loads the images and renders the illustrated sequence;
`opening.js` owns the lifecycle, sound, accessible controls, focus and G input.
The existing vector art remains a fallback if image decoding fails. Artwork
preparation waits at most six seconds, and G remains active during that wait.
The existing game loop pauses behind the opening. Canvas draw failures release
the menu rather than leaving it covered.

## Verification

- `node --experimental-vm-modules tools/test-opening.cjs`
- `node tools/test-opening-film.cjs`

The checks cover all 44 cels and 23 shots, changing running poses, embedded
assets, GitHub upload size budget, natural completion, every chapter's skip, input and focus restoration,
hidden tabs, reduced motion, decoding failures/timeouts, and audio-resume races.
Existing browser fixtures dismiss the opening before gameplay checks.

For real Canvas rendering, install `skia-canvas` or set `OPENING_CANVAS_MODULE`
to its module path, then run `node tools/test-opening-film.cjs --render`.
Twelve full-size shot samples and eight consecutive running frames are written
to ignored `work/opening-film/`. These were rendered and inspected locally.
A live browser audio/input playtest remains outstanding in this environment.

# Documents A + B → Document C — vector step animation

A dependency-free, five-step animated explainer: two documents are split into
segments, matching segments are linked and grouped, the layout is planned, and
the groups are fitted into a new Document C.

By default the page is **scroll-driven**: the animation is pinned (sticky) and
scrolling through a tall track plays the five steps in order. Add
`?mode=widget` for the fixed step player with Prev / Next / Play.

The target document is called **Document C** by default; open the page with
`?target=New%20Platform` (or change `TARGET_NAME`) to relabel it as
“New Platform” everywhere.

The canvas is deliberately compact and near-square (560 × 700 user units), so a
phone shows the whole animation at once — no sideways panning, every step
centred.

Artwork is **SVG**, all motion is **CSS**, and ~150 lines of **JavaScript** only
decide *where* each element sits per step.

```
index.html      markup + inline SVG canvas, caption, controls
styles.css      all motion (durations / easings / transitions), controls, a11y
animation.js    geometry, step choreography, step controls
```

Open `index.html` directly, or serve the folder (e.g. `npx serve .`).

## The five steps

| Stage | Caption | What moves |
| --- | --- | --- |
| 0 | Two separate documents | two intact document sheets; three dotted cuts sweep across each and stay as the split marks |
| 1 | Split into segments | the sheets fade into their four segments, which fan apart |
| 2 | Match and group segments | curved links draw A → B, the light segments slide onto their partners, dashed group outlines appear |
| 3 | Plan the new layout | groups stack above a ghosted Document C; four curved connectors link each group to its slot |
| 4 | Document C is assembled | groups drop into the slots, the target document fills in |

Deep link to any step: `index.html?step=4` (in scroll mode the page scrolls to
that step on load). Combine with the target name:
`index.html?target=New%20Platform&step=5`.

## Scroll mode (default)

```
.scrolly        tall track — 6.2 viewports, so each step gets ~104vh of scroll
  .scrolly__sticky   position: sticky; 100svh — the animation stays in view
    .demo           caption + SVG stage + progress dots
```

- `body.mode-scroll` stretches the track; scroll progress (0–1) is mapped across
  the five stages with a small hysteresis band, so a step fires when its section
  is reached and plays its normal CSS choreography.
- The caption and the dots update per step; the “Scroll to play” hint fades as
  soon as you scroll, and the thin bar at the top of the pinned viewport tracks
  raw scroll progress continuously.
- Step animations are deliberately short (700 ms moves, ~1.4–2.3 s per step) so
  they finish before the next section boundary at normal scrolling speed.
- Clicking a dot (or pressing ← / →) scrolls smoothly to that step.
- `?step=N` works in scroll mode too — it positions the page at that step.
- `?mode=widget` keeps the one-screen version with Prev / Next / Play.
- Scroll length is one CSS value: `body.mode-scroll .scrolly { height: 620svh }`
  in `styles.css`. The step mapping is in `stageFromScroll()` (`animation.js`).

This is *step-triggered* playback: crossing a section boundary plays that step’s
transitions. If you need the timeline itself to scrub 1:1 with the scrollbar
(frame-accurate seeks), swap the state machine for GSAP `ScrollTrigger` (or CSS
scroll-driven animations) — the SVG and CSS classes stay the same.

## Why SVG + CSS (+ a little JS)

This diagram is a good fit for SVG because everything is rectangles, paths and
text: it scales losslessly, stays crisp on retina, is searchable/inspectable,
and needs no image assets. All values can live in CSS variables.

CSS handles the motion well here because every transition is either a
translation, an opacity change, or a `stroke-dashoffset` draw-on — the three
cheapest things a browser can animate (no layout, no paint-heavy filters).

Only the *sequencing* is in JS, because step switching with staggered delays,
draw-on connectors, and a rewind/backwards mode is where pure CSS keyframes gets
painful:

- each step is one `applyStage(n)` call (no keyframe bookkeeping),
- “Previous” is the same transitions played backwards,
- connectors can be re-drawn deterministically,
- deep links and autoplay come for free.

If you ever need scrubbing / timeline seeking / choreographed eases, swap the
small timeline in `animation.js` for a GSAP timeline (`gsap.timeline({paused:true})`,
`.seek()`, `.progress()`) — the SVG markup and CSS classes stay the same. If a
designer wants to author the motion in After Effects, a Lottie export
(`lottie-web`) is the other mainstream option for vector animation.

### How the motion is wired

- **Segments** are `<g class="segment">` elements positioned with
  `style.transform = translate(x,y)`; `styles.css` owns easing/duration, JS only
  supplies per-step coordinates and `transition-delay` for staggering.
- **Links** are cubic Béziers created in JS. Their dash pattern equals
  `path.getTotalLength()`, so animating `stroke-dashoffset` to `0` “draws” them.
  Arrowheads are attached only after a line has finished drawing.
- **Timings** live in CSS custom properties on the SVG (`--dur-move`,
  `--dur-link`, `--dur-fade`, `--dur-frame`). JS reads them once so its delays
  stay in sync; change a duration in one place.
- **Camera** — each step has a small `{x, y}` offset (`CAMERA` in
  `animation.js`) applied to the `<g id="scene">` wrapper, so the *drawn*
  content is centred inside the 560 × 700 canvas for every step.
- **Step 1 sheets** are two `#pages` rectangles drawn above the segments; the
  three `#cuts` per sheet are dotted `<line>`s revealed left-to-right with a
  `clip-path` transition, staggered so they read as three cuts.
- **First paint** is committed with transitions disabled (`.is-instant`), so
  nothing flies in from the origin on page load or when a deep link opens on a
  later step.

## Customising

- Geometry (columns, rows, Document C frame, slot positions) and the pairing
  order `MAP` are constants at the top of `animation.js`.
- The target document name is `TARGET_NAME` (`animation.js`), overridable with
  `?target=New%20Platform`. It is used for the label under the document, the
  Step 4/5 captions, the SVG `<title>`/`<desc>` and the browser title.
- Colours, easing and durations are custom properties at the top of
  `styles.css` (`--seg-a` dark gray, `--seg-b` light gray, `--doc-c` off-white,
  `--ease`, `--dur-*`).
- Per-step framing lives in `CAMERA` (`animation.js`) — an `{x, y}` nudge of the
  whole scene so each step’s content stays centred in the canvas.
- Step 4 (the dashed slots plan) uses `STEP4_LINKS` (`{from, to, side, bulge}`) in
  `animation.js` to decide which group connects to which slot and how far the
  curve swings around the outside.
- Autoplay cadence: `STEP_MS` in `animation.js`.
- Copy (step titles/descriptions): the `STEPS` array in `animation.js`.

`MAP` must stay a permutation of `0..COUNT-1` without fixed points (each
Document A segment pairs with a Document B one, and the links cross).

## Using it in a website

1. Copy `index.html`, `styles.css` and `animation.js` into your page/project.
   For the scroll version use the whole `.scrolly` → `.scrolly__sticky` →
   `.demo` block (it needs a scrollable document); for the fixed widget copy
   just `<main class="demo">…</main>`. All styles are scoped under those classes,
   so they will not leak into your site.
2. Or embed it untouched: `<iframe src="/path/to/index.html?target=New%20Platform" title="How the new document is assembled" style="width:100%;border:0;aspect-ratio:560/700"></iframe>`
   (drop `aspect-ratio` for the scroll version and give the iframe a height).
3. Control it from the host page:

```js
documentMerge.showStep(4);   // jump to a step (1–5)
documentMerge.play();        // autoplay
documentMerge.pause();
```

   Inside an iframe, call the same methods on the iframe’s `contentWindow`.

4. Start on a particular step with `?step=1…5` — useful for linking from docs.

## Accessibility & responsiveness

- The SVG exposes `<title>`/`<desc>` and `role="img"`; the caption is
  `aria-live="polite"`, so step changes are announced.
- Prev / Next / Play and the step dots are real buttons with labels,
  `aria-pressed` and `aria-current`; ← / → also work. In scroll mode the dots
  remain and scroll to a step; the autoplay buttons are hidden.
- `prefers-reduced-motion: reduce` sets every duration to `0ms`: states change
  instantly and nothing sweeps across the screen.
- The 560 × 700 canvas scales down to phone widths (about 0.64× on a 390 px
  screen) with no horizontal scrolling; the SVG is capped at 640 px wide on
  larger screens so it never becomes a wide banner. For a bespoke mobile
  version, change the viewBox plus the geometry and `CAMERA` in `animation.js`.

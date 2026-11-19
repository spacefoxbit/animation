/* =========================================================
   Document-merge animation — choreography and step controls.
   Artwork: SVG. Motion: CSS (see styles.css). This file only
   decides where each element sits on each of the five steps.
   ========================================================= */
(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';

  /* ---------------- geometry (SVG user units) ---------------- */

  const COUNT = 4;                       // segments per document
  const SEG_W = 132;                     // one segment = a quarter of a page
  const SEG_H = 44;
  const CARD_GAP = 4;                    // gap between a paired A + B segment
  const CARD_W = SEG_W * 2 + CARD_GAP;
  const FRAME_PAD = 4;                   // padding of the grouping outline

  const PAGE_W = SEG_W;
  const PAGE_H = SEG_H * COUNT;          // 176 → portrait document sheet
  const PAGE_TOP = 210;
  const CUT_OVER = 0;                    // cut marks span the sheet width

  const A_X = 146;                       // document A column (pair stays centred)
  const B_X = 346;                       // document B column
  const stackY = (i) => PAGE_TOP + i * SEG_H;   // step 1: quarters of the sheet
  const splitY = (i) => PAGE_TOP + i * 72;      // step 2: segments pulled apart

  const GROUP_X = 146;                   // step 4: staging column (centred)
  const groupY = (i) => 70 + i * 64;

  const DOC_C = { x: 112, y: 318, w: 336, h: 308 };
  const INSIDE_X = DOC_C.x + (DOC_C.w - CARD_W) / 2;
  const insideY = (i) => DOC_C.y + 36 + i * 64;  // step 5: slots inside Document C

  /* Per-step camera: centres the drawn content (both axes) inside the
     560 x 700 canvas, so each step sits between caption and controls. */
  const CAMERA = [
    { x: -32, y: 27 },
    { x: -32, y: -15 },
    { x: 0, y: -13 },
    { x: 0, y: -22 },
    { x: 0, y: -148 }
  ];

  /* A[i] is matched with B[MAP[i]], so the step-3 links cross. */
  const MAP = [1, 3, 0, 2];
  const B_ROW = [];                      // inverse map: B[j] sits in row B_ROW[j]
  MAP.forEach((bIndex, row) => { B_ROW[bIndex] = row; });

  /* ---------------- timing (single source: styles.css) ---------------- */

  const svg = document.querySelector('.stage__svg');

  /* Target document name — "Document C" by default. Change the constant, or
     open the page with ?target=New%20Platform, to call it something else. */
  const params = new URLSearchParams(window.location.search);
  const TARGET_NAME = (params.get('target') || 'Document C').trim() || 'Document C';

  const readMs = (name, fallback) => {
    const raw = getComputedStyle(svg).getPropertyValue(name).trim();
    if (!raw) return fallback;
    const value = parseFloat(raw);
    if (Number.isNaN(value)) return fallback;
    return raw.endsWith('ms') ? value : value * 1000;
  };

  const T = {
    move: readMs('--dur-move', 850),
    link: readMs('--dur-link', 650),
    fade: readMs('--dur-fade', 400),
    frame: readMs('--dur-frame', 500)
  };

  const LINK_START = 100;
  const LINK_STAGGER = 100;
  const LINKS_DONE = LINK_START + T.link + (COUNT - 1) * LINK_STAGGER;
  const GREEN_START = LINKS_DONE + 60;   // greens travel after the links are drawn
  const GREEN_STAGGER = 110;
  const ARROW_START = 1000;
  const ARROW_STAGGER = 90;
  const STEP_MS = 3000;                  // autoplay cadence

  /* ---------------- helpers ---------------- */

  const make = (tag, attrs = {}) => {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    return el;
  };

  const layers = {
    slots: document.getElementById('slots'),
    links: document.getElementById('links'),
    arrows: document.getElementById('arrows'),
    frames: document.getElementById('frames'),
    segments: document.getElementById('segments'),
    pages: document.getElementById('pages'),
    cuts: document.getElementById('cuts')
  };

  const scene = document.getElementById('scene');

  /* ---------------- the 4 + 4 segments ---------------- */

  const segs = { A: [], B: [] };

  ['A', 'B'].forEach((doc) => {
    for (let i = 0; i < COUNT; i++) {
      const group = make('g', { class: `segment segment--${doc.toLowerCase()}` });
      group.appendChild(make('rect', {
        class: 'segment__box',
        width: SEG_W,
        height: SEG_H,
        rx: 2
      }));
      layers.segments.appendChild(group);
      segs[doc].push(group);
    }
  });

  /* ---------------- grouping outlines ---------------- */

  const frames = Array.from({ length: COUNT }, () => {
    const rect = make('rect', {
      class: 'pair-frame',
      width: CARD_W + FRAME_PAD * 2,
      height: SEG_H + FRAME_PAD * 2,
      rx: 6
    });
    layers.frames.appendChild(rect);
    return rect;
  });

  /* ---------------- planned slots inside Document C (step 4) ---------------- */

  const slots = Array.from({ length: COUNT }, (_, i) => {
    const rect = make('rect', {
      class: 'doc-c__slot',
      x: INSIDE_X,
      y: insideY(i),
      width: CARD_W,
      height: SEG_H,
      rx: 4
    });
    layers.slots.appendChild(rect);
    return rect;
  });

  /* ---------------- step 1: intact sheets + dotted cuts ---------------- */

  const pages = ['A', 'B'].map((doc) => {
    const rect = make('rect', {
      class: `page page--${doc.toLowerCase()}`,
      x: doc === 'A' ? A_X : B_X,
      y: PAGE_TOP,
      width: PAGE_W,
      height: PAGE_H,
      rx: 2
    });
    layers.pages.appendChild(rect);
    return rect;
  });

  /* Three dotted cuts per sheet → four segments. */
  const cuts = [];

  for (let i = 1; i < COUNT; i++) {
    const y = PAGE_TOP + i * SEG_H;
    [A_X, B_X].forEach((x, docIndex) => {
      const line = make('line', {
        class: `cut cut--${docIndex === 0 ? 'a' : 'b'}`,
        x1: x - CUT_OVER,
        x2: x + PAGE_W + CUT_OVER,
        y1: y,
        y2: y
      });
      layers.cuts.appendChild(line);
      cuts.push(line);
    });
  }

  /* ---------------- correspondence links (step 3) ---------------- */

  const links = [];

  for (let row = 0; row < COUNT; row++) {
    const fromX = A_X + SEG_W;
    const fromY = splitY(row) + SEG_H / 2;
    const toX = B_X - 4;
    const toY = splitY(MAP[row]) + SEG_H / 2;
    const d = `M ${fromX} ${fromY} ` +
      `C ${fromX + 30} ${fromY}, ${toX - 30} ${toY}, ${toX} ${toY}`;
    const path = make('path', { class: 'link', d });
    layers.links.appendChild(path);
    links.push(path);
  }

  /* ---------------- layout connectors (step 4) ---------------- */

  /* Each staged group is linked to the slot it will occupy. The curves leave
     the group from the outside edge and swing around Document C, exactly like
     the correspondence links in step 3. */
  const STEP4_LINKS = [
    { from: 0, to: 2, side: 'right', bulge: 100 },
    { from: 1, to: 1, side: 'left', bulge: 85 },
    { from: 2, to: 3, side: 'left', bulge: 105 },
    { from: 3, to: 0, side: 'right', bulge: 55 }
  ];

  const arrows = STEP4_LINKS.map(({ from, to, side, bulge }) => {
    const y1 = groupY(from) + SEG_H / 2;
    const y2 = insideY(to) + SEG_H / 2;
    const dir = side === 'right' ? 1 : -1;
    const x1 = side === 'right' ? GROUP_X + CARD_W + FRAME_PAD : GROUP_X - FRAME_PAD;
    const x2 = side === 'right' ? INSIDE_X + CARD_W : INSIDE_X;
    const c1 = x1 + dir * bulge;
    const c2 = x1 + dir * (bulge + 16);
    const d = `M ${x1} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${x2} ${y2}`;
    const path = make('path', { class: 'arrow', d });
    layers.arrows.appendChild(path);
    return path;
  });

  /* Draw-on animation: dash pattern equal to the path length. */
  [...links, ...arrows].forEach((path) => {
    const length = path.getTotalLength();
    path.dataset.len = String(length);
    path.style.strokeDasharray = `${length} ${length}`;
    path.style.strokeDashoffset = `${length}`;
  });

  const docC = {
    ghost: document.getElementById('doc-c-ghost'),
    fill: document.getElementById('doc-c-fill'),
    label: document.getElementById('doc-c-label')
  };

  const labels = {
    a: document.getElementById('label-a'),
    b: document.getElementById('label-b')
  };

  /* ---------------- state ---------------- */

  const state = { stage: 0 };
  const timers = new Set();

  const schedule = (fn, delay) => {
    if (delay <= 0) { fn(); return; }
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, delay);
    timers.add(id);
  };

  const clearTimers = () => {
    timers.forEach((id) => window.clearTimeout(id));
    timers.clear();
  };

  const place = (el, x, y, delay) => {
    el.style.transitionDelay = `${delay}ms`;
    el.style.transform = `translate(${x}px, ${y}px)`;
  };

  const pairAnchor = (stage, i) => {
    if (stage === 2) return { x: A_X, y: splitY(i) };
    if (stage === 3) return { x: GROUP_X, y: groupY(i) };
    return { x: INSIDE_X, y: insideY(i) };
  };

  /* Show / hide a connector, optionally drawing it in. */
  const showLine = (path, visible, delay, instant) => {
    const length = Number(path.dataset.len);

    if (!visible) {
      path.classList.remove('is-on', 'is-headed');
      path.style.transitionDelay = '0ms, 0ms';
      path.style.strokeDashoffset = '0px';
      return;
    }

    if (instant) {                      // walking backwards: show it already drawn
      path.classList.add('is-instant');
      path.classList.remove('is-on', 'is-headed');
      path.style.strokeDashoffset = '0px';
      void path.getBoundingClientRect();
      path.classList.remove('is-instant');
      path.style.transitionDelay = '0ms, 0ms';
      path.classList.add('is-on', 'is-headed');
      return;
    }

    /* rewind without animating, then draw the line in */
    path.classList.add('is-instant');
    path.classList.remove('is-on', 'is-headed');
    path.style.strokeDashoffset = `${length}px`;
    void path.getBoundingClientRect();
    path.classList.remove('is-instant');

    path.style.transitionDelay = `${delay}ms, ${delay}ms`;
    path.style.strokeDashoffset = '0px';
    path.classList.add('is-on');
    schedule(() => path.classList.add('is-headed'), delay + T.link);
  };

  /* ---------------- one step -> one layout ---------------- */

  function applyStage(stage) {
    clearTimers();

    const back = stage < state.stage;
    state.stage = stage;

    /* Collapse delays when playing backwards or reducing motion. */
    const D = (delay) => (back || T.move === 0 ? 0 : delay);

    /* --- segment destinations --- */
    const posA = new Array(COUNT);
    const posB = new Array(COUNT);

    if (stage <= 1) {
      for (let i = 0; i < COUNT; i++) {
        const y = stage === 0 ? stackY(i) : splitY(i);
        posA[i] = { x: A_X, y };
        posB[i] = { x: B_X, y };
      }
    } else {
      for (let i = 0; i < COUNT; i++) {
        const anchor = pairAnchor(stage, i);
        posA[i] = anchor;
        posB[MAP[i]] = { x: anchor.x + SEG_W + CARD_GAP, y: anchor.y };
      }
    }

    const delayA = (i) => {
      if (stage === 1) return i * 70;   // Document A fans out
      if (stage === 3) return i * 80;   // groups travel to the staging column
      if (stage === 4) return i * 90;   // groups drop into Document C
      return 0;
    };

    const delayB = (i) => {
      if (stage === 1) return i * 70;
      if (stage === 2) return GREEN_START + B_ROW[i] * GREEN_STAGGER;
      if (stage === 3) return B_ROW[i] * 80;
      if (stage === 4) return B_ROW[i] * 90;
      return 0;
    };

    for (let i = 0; i < COUNT; i++) {
      place(segs.A[i], posA[i].x, posA[i].y, D(delayA(i)));
      place(segs.B[i], posB[i].x, posB[i].y, D(delayB(i)));
    }

    /* --- step 1: intact sheets, then three dotted cuts per sheet --- */
    const sheetsOn = stage === 0;
    pages.forEach((page) => page.classList.toggle('is-on', sheetsOn));
    layers.segments.classList.toggle('is-unsplit', sheetsOn);

    cuts.forEach((line) => {
      line.classList.add('is-instant');
      line.classList.remove('is-on', 'is-wiping');
      line.style.transitionDelay = '0ms, 0ms';
    });
    void svg.getBoundingClientRect();
    cuts.forEach((line) => line.classList.remove('is-instant'));

    if (sheetsOn) {
      cuts.forEach((line, index) => {
        const delay = T.move === 0
          ? 0
          : 380 + Math.floor(index / 2) * 220 + (index % 2) * 60;
        schedule(() => line.classList.add('is-on', 'is-wiping'), delay);
      });
    }

    /* --- grouping outlines follow their pair --- */
    const framesOn = stage === 2 || stage === 3;

    for (let i = 0; i < COUNT; i++) {
      const anchor = stage <= 1 ? { x: A_X, y: splitY(i) } : pairAnchor(stage, i);
      let delay = 0;
      if (stage === 2) {
        delay = GREEN_START + i * GREEN_STAGGER + Math.round(T.move * 0.55);
      } else if (stage === 3) {
        delay = i * 80;
      }

      place(frames[i], anchor.x - FRAME_PAD, anchor.y - FRAME_PAD, D(delay));
      frames[i].classList.toggle('is-on', framesOn);
    }

    /* --- planned slots inside Document C --- */
    slots.forEach((rect, i) => {
      rect.style.transitionDelay = `${D(180 + i * 60)}ms`;
      rect.classList.toggle('is-on', stage === 3);
    });

    /* --- links (step 3) and layout arrows (step 4) --- */
    links.forEach((path, row) => {
      showLine(path, stage === 2, D(LINK_START + row * LINK_STAGGER), back);
    });

    /* Once every pair is formed the correspondence links have done their
       job and would otherwise sit underneath the segments. */
    if (stage === 2) {
      const fadeAt = back
        ? 900
        : GREEN_START + (COUNT - 1) * GREEN_STAGGER + T.move + 260;

      schedule(() => {
        links.forEach((path) => {
          path.classList.remove('is-on', 'is-headed');
          path.style.strokeDashoffset = '0px';
        });
      }, fadeAt);
    }

    arrows.forEach((path, i) => {
      showLine(path, stage === 3, D(ARROW_START + i * ARROW_STAGGER), back);
    });

    /* --- target document --- */
    docC.ghost.classList.toggle('is-on', stage >= 3);
    docC.label.classList.toggle('is-on', stage >= 3);
    docC.label.style.transitionDelay = `${D(160)}ms`;
    docC.fill.classList.toggle('is-on', stage >= 4);
    docC.fill.style.transitionDelay = `${stage >= 4 && !back ? 240 : 0}ms`;

    /* --- "Document A" / "Document B" labels --- */
    const labelY = (stage === 0 ? stackY(COUNT - 1) : splitY(COUNT - 1)) + SEG_H + 44;
    const labelDelay = D(stage === 1 ? (COUNT - 1) * 70 : 0);
    place(labels.a, A_X + SEG_W / 2, labelY, labelDelay);
    place(labels.b, B_X + SEG_W / 2, labelY, labelDelay);
    labels.a.classList.toggle('is-off', stage >= 3);
    labels.b.classList.toggle('is-off', stage >= 3);

    /* --- camera: keep the drawing centred between caption and controls --- */
    const camera = CAMERA[stage];
    scene.style.transform = `translate(${camera.x}px, ${camera.y}px)`;
  }

  /* ---------------- captions & controls ---------------- */

  const STEPS = [
    {
      step: 'Step 1',
      title: 'Two separate documents',
      desc: 'Document A and Document B arrive as independent files, each marked into four segments.'
    },
    {
      step: 'Step 2',
      title: 'Split into segments',
      desc: 'Each document is broken into its parts, so the pieces can be compared and moved individually.'
    },
    {
      step: 'Step 3',
      title: 'Match and group segments',
      desc: 'Related segments are linked across the two documents, then grouped into pairs.'
    },
    {
      step: 'Step 4',
      title: 'Plan the new layout',
      desc: `The groups are arranged in the order they will take inside ${TARGET_NAME}.`
    },
    {
      step: 'Step 5',
      title: `${TARGET_NAME} is assembled`,
      desc: `The grouped parts from A and B are fitted into ${TARGET_NAME} and become a single file.`
    }
  ];

  const caption = document.querySelector('.caption');
  const captionStep = document.getElementById('caption-step');
  const captionTitle = document.getElementById('caption-title');
  const captionDesc = document.getElementById('caption-desc');
  const dots = Array.from(document.querySelectorAll('[data-dot]'));
  const prevBtn = document.getElementById('btn-prev');
  const nextBtn = document.getElementById('btn-next');
  const playBtn = document.getElementById('btn-play');

  /* ---------------- scroll-driven mode ---------------- */

  const scrollMode = params.get('mode') !== 'widget';
  const track = document.getElementById('scrolly');
  const sticky = document.querySelector('.scrolly__sticky');
  const scrollHint = document.getElementById('scroll-hint');
  const progressSegments = Array.from(document.querySelectorAll('.scrolly__progress span'));

  document.body.classList.toggle('mode-scroll', scrollMode);

  let scrollEnabled = false;
  let scrollTick = false;

  const scrollRange = () => Math.max(1, track.offsetHeight - sticky.offsetHeight);

  const currentProgress = () => Math.min(1, Math.max(0, -track.getBoundingClientRect().top / scrollRange()));

  /* Map scroll progress (0–1) to a step, with a small hysteresis band so the
     stage does not flicker at a boundary. */
  const stageFromScroll = () => {
    const raw = currentProgress() * STEPS.length;
    let stage = state.stage;
    while (stage < STEPS.length - 1 && raw >= stage + 1 + 0.02) stage += 1;
    while (stage > 0 && raw < stage - 0.02) stage -= 1;
    return stage;
  };

  const scrollToStage = (stage, smooth) => {
    const top = track.getBoundingClientRect().top + window.scrollY;
    const target = top + ((stage + 0.5) / STEPS.length) * scrollRange();
    window.scrollTo({ top: Math.round(target), behavior: smooth ? 'smooth' : 'auto' });
  };

  const syncFromScroll = () => {
    if (!scrollMode || !scrollEnabled) return;
    const progress = currentProgress();

    /* Fill the five segments one after another as the scroll advances. */
    const scaled = progress * progressSegments.length;
    progressSegments.forEach((segment, index) => {
      const fill = Math.min(1, Math.max(0, scaled - index));
      segment.style.setProperty('--fill', fill.toFixed(3));
    });

    const stage = stageFromScroll();
    if (stage !== state.stage) goTo(stage);
    if (scrollHint) scrollHint.classList.toggle('is-hidden', progress > 0.006);
  };

  function updateUI(stage, animateCaption = true) {
    const data = STEPS[stage];
    captionStep.textContent = data.step;
    captionTitle.textContent = data.title;
    captionDesc.textContent = data.desc;

    if (animateCaption) {
      caption.classList.remove('is-anim');
      void caption.offsetWidth;
      caption.classList.add('is-anim');
    }

    dots.forEach((dot, index) => {
      const active = index === stage;
      dot.classList.toggle('is-active', active);
      if (active) dot.setAttribute('aria-current', 'step');
      else dot.removeAttribute('aria-current');
    });

    prevBtn.disabled = stage === 0;
    nextBtn.disabled = stage === STEPS.length - 1;
  }

  let playTimer = null;

  function stopPlay() {
    if (playTimer === null) return;
    window.clearInterval(playTimer);
    playTimer = null;
    playBtn.textContent = 'Play';
    playBtn.setAttribute('aria-pressed', 'false');
  }

  function startPlay() {
    if (state.stage === STEPS.length - 1) {
      applyStage(0);
      updateUI(0);
    }

    playBtn.textContent = 'Pause';
    playBtn.setAttribute('aria-pressed', 'true');

    playTimer = window.setInterval(() => {
      if (state.stage >= STEPS.length - 1) {
        stopPlay();
        return;
      }
      goTo(state.stage + 1, { keepPlaying: true });
    }, STEP_MS);
  }

  function goTo(stage, options = {}) {
    const next = Math.max(0, Math.min(STEPS.length - 1, stage));
    if (next === state.stage) return;
    applyStage(next);
    updateUI(next);
    if (!options.keepPlaying || next === STEPS.length - 1) stopPlay();
  }

  prevBtn.addEventListener('click', () => goTo(state.stage - 1));
  nextBtn.addEventListener('click', () => goTo(state.stage + 1));
  playBtn.addEventListener('click', () => {
    if (playTimer === null) startPlay();
    else stopPlay();
  });
  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      if (scrollMode) scrollToStage(index, true);
      else goTo(index);
    });
  });

  document.addEventListener('keydown', (event) => {
    const inside = event.target instanceof Element && event.target.closest('.demo');
    if (!inside && event.target !== document.body) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (scrollMode) scrollToStage(Math.min(STEPS.length - 1, state.stage + 1), true);
      else goTo(state.stage + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (scrollMode) scrollToStage(Math.max(0, state.stage - 1), true);
      else goTo(state.stage - 1);
    }
  });

  /* Small public API — handy when the animation is embedded in a page. */
  window.documentMerge = {
    showStep(stepNumber) {
      const stage = Math.min(STEPS.length - 1, Math.max(0, Number(stepNumber) - 1));
      if (Number.isNaN(stage)) return;
      if (scrollMode) scrollToStage(stage, true);
      else goTo(stage);
    },
    play: startPlay,
    pause: stopPlay
  };

  /* ---------------- initial paint ---------------- */

  /* Optional deep link: index.html?step=4 opens on that step. */
  const requested = Number(params.get('step'));
  const startStage = Number.isInteger(requested)
    ? Math.min(STEPS.length, Math.max(1, requested)) - 1
    : 0;

  /* Apply the configurable target-document name to the SVG label, captions,
     accessible title/description and the page title. */
  const docLabel = document.getElementById('doc-c-label');
  if (docLabel) docLabel.textContent = TARGET_NAME;

  const svgTitle = document.getElementById('svg-title');
  const svgDesc = document.getElementById('svg-desc');
  if (svgTitle) svgTitle.textContent = `How ${TARGET_NAME} is assembled`;
  if (svgDesc) {
    svgDesc.textContent = 'Animated diagram: documents A and B are split into segments, ' +
      'corresponding segments are linked and grouped, and the groups are fitted into ' +
      `${TARGET_NAME}.`;
  }
  document.title = `${TARGET_NAME} — document merge animation`;

  if (scrollMode) {
    history.scrollRestoration = 'manual';
    if (startStage > 0) scrollToStage(startStage, false);

    window.addEventListener('scroll', () => {
      if (!scrollEnabled || scrollTick) return;
      scrollTick = true;
      requestAnimationFrame(() => {
        scrollTick = false;
        syncFromScroll();
      });
    }, { passive: true });

    window.addEventListener('resize', syncFromScroll);
  }

  /* Commit the first layout with transitions suppressed, so nothing
     animates from the origin when the page loads. */
  svg.classList.add('is-instant');
  applyStage(startStage);
  updateUI(startStage, false);
  void svg.getBoundingClientRect();
  svg.classList.remove('is-instant');

  /* Enable transitions on the next painted frame. */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      svg.classList.add('is-ready');
      if (scrollMode) {
        scrollEnabled = true;
        syncFromScroll();
      }
    });
  });
})();

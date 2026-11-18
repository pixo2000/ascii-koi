/*
 * ASCII Koi: a koi pond drawn in character cells.
 *
 * Each koi is a chain of spine nodes that trails its head, plus a travelling
 * body wave. Every character cell is sampled against the nearest point on the
 * spine (with sub-samples for soft edges), classified as body, fin, eye or
 * barbel, coloured by the fish's markings, and shaded by a light from the
 * upper left: light skin gets sparse glyphs, shadowed skin dense ones. Koi cast
 * a shadow on the pond floor and leave a short wake.
 *
 * Middle click: a black cat paw reaches in from the nearer edge, dips, hooks the
 * water back in two tugs and flicks out with a spray of drops. The koi scatter;
 * a moment later the curious ones swim back to look.
 * Left click (or a long press): a handful of fish food. The pellets land with
 * small rings and float; the hungry koi rise and race over to eat them.
 *
 * A host can ask for swimmers (opts.swimmers, one or two): girls in bikinis,
 * seen from above and drawn in the same cells, who swim breaststroke across the
 * pond, float on their backs for a while on the way, and leave it again for a
 * time. The koi give them room.
 *
 * The simulation only moves forward in fixed steps from time, so the same
 * events give the same pond. A page runs it live (start); a film seeks it to
 * any time (seek) and gets the same frame every time.
 *
 * Technique informed by stackedlol/ascii-sharks (MIT) and daoho.dev; the code
 * is written for this project. MIT licence.
 */
(function (global) {
  "use strict";

  /* ── small maths ── */
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
  const lerp = (a, b, e) => a + (b - a) * e;
  const h2 = (a, b) => { let x = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1); x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
  const noise = (x, y, seed) => {
    const xi = Math.floor(x), yi = Math.floor(y), u = sstep(0, 1, x - xi), v = sstep(0, 1, y - yi);
    const a = h2(xi + seed * 131, yi), b = h2(xi + 1 + seed * 131, yi), c = h2(xi + seed * 131, yi + 1), d = h2(xi + 1 + seed * 131, yi + 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  };
  const rgb = hex => { const m = String(hex).trim().match(/^#?([0-9a-f]{6})$/i); const n = m ? parseInt(m[1], 16) : 0; return [n >> 16, (n >> 8) & 255, n & 255]; };
  const mixC = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
  const pack = c => (clamp(c[0] | 0, 0, 255) << 16) | (clamp(c[1] | 0, 0, 255) << 8) | clamp(c[2] | 0, 0, 255);
  const css = n => `rgb(${n >> 16},${(n >> 8) & 255},${n & 255})`;
  const MONO = `"Geist Mono", ui-monospace, Menlo, monospace`;

  /* Deterministic randomness, so the pond looks the same on every load. */
  function seeded(str) {
    let h = 2166136261;
    for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  }

  /* ── koi body, as fractions of length: s runs from snout (0) to tail tip (1) ── */
  const BODY_END = 0.76;
  const halfW = s => s < 0.1 ? 0.118 * Math.pow(Math.sin(s / 0.1 * Math.PI / 2), 0.6)
    : s < 0.3 ? 0.118 + 0.02 * sstep(0.1, 0.3, s)
    : 0.03 + 0.108 * (1 - sstep(0.3, BODY_END, s));
  const tailW = s => 0.028 + 0.165 * Math.pow(sstep(0.72, 1, s), 0.85);
  const hit = { kind: 0, across: 0, rs: 1, ra: 0 };
  /* fin: an ellipse leaning back from a root on the body's edge */
  function fin(s, a, rootS, angle, reach, width) {
    const ra = halfW(rootS) * 0.85, ca = Math.cos(angle), sa = Math.sin(angle);
    const ds = s - rootS, da = a - ra;
    const along = ds * ca + da * sa - reach, perp = -ds * sa + da * ca;
    if ((along / reach) ** 2 + (perp / width) ** 2 > 1) return false;
    hit.kind = 2; hit.rs = ds; hit.ra = da;
    return true;
  }
  /* 1 body, 2 fin, 3 eye, 4 ridge, 5 barbel */
  function classify(s, a, past, flare, ahead, lateral) {
    hit.kind = 0; hit.across = 1; hit.rs = 1; hit.ra = 0;
    if (ahead > 0) {
      if (ahead < 0.05 && Math.abs(lateral - (0.042 + ahead * 0.75)) < 0.015) { hit.kind = 5; return true; }
      return false;
    }
    const w = halfW(s);
    if (s <= BODY_END && a <= w) {
      hit.across = a / w;
      hit.kind = s > 0.056 && s < 0.084 && hit.across > 0.5 && hit.across < 0.78 ? 3 : s > 0.3 && s < 0.6 && hit.across < 0.13 ? 4 : 1;
      return true;
    }
    if (s > 0.7 && past <= 0) {
      const tw = tailW(s) * flare;
      if (a <= tw && s <= 0.88 + 0.12 * (a / tw)) { hit.kind = 2; hit.rs = 1; hit.ra = (a / tw) * 0.8; return true; }
    }
    return fin(s, a, 0.2, 0.9 + 0.45 * (flare - 1), 0.07 * flare, 0.038) || fin(s, a, 0.47, 0.75, 0.038, 0.019);
  }

  /* ── markings: kohaku (red saddles), sanke (plus black spots), tancho (red crown) ── */
  function markings(variety, seed) {
    const r = j => h2(seed, j);
    if (variety === "tancho") return { red: [{ s: 0.1, v: 0, rs: 0.052, rv: 0.06 }], black: [] };
    const red = [];
    if (r(1) < 0.85) red.push({ s: 0.09, v: (r(2) - 0.5) * 0.03, rs: 0.05 + r(3) * 0.03, rv: 0.1 });
    /* Saddles of uneven length step from side to side, with white between them and on the flanks, so no koi reads as one solid colour or as stripes. */
    const n = r(4) < 0.25 ? 3 : 2, GAP = 0.05, w = [];
    for (let j = 0; j < n; j++) w.push(0.5 + r(30 + j));
    const unit = (0.45 - GAP * (n - 1)) / w.reduce((a, b) => a + b);
    let at = 0.23;
    for (let j = 0; j < n; j++) {
      const rs = unit * w[j] / 2;
      red.push({ s: at + rs, v: (j % 2 ? 1 : -1) * (0.022 + r(20 + j) * 0.018), rs: rs * 0.95, rv: 0.065 + rs * 0.3 + r(40 + j) * 0.02 });
      at += rs * 2 + GAP;
    }
    const black = [];
    if (variety === "sanke") for (let j = 0; j < 4 + Math.floor(r(50) * 3); j++) black.push({ s: 0.25 + r(60 + j) * 0.42, v: (r(70 + j) - 0.5) * 0.15, rs: 0.021, rv: 0.025 });
    return { red, black };
  }
  const inPatch = (m, s, vn, wob) => ((s - m.s) / m.rs) ** 2 + ((vn - m.v) / m.rv) ** 2 < 1 + wob;
  function skin(f, s, vn, across) {
    if (across > 0.9 || s > 0.74) return 0;
    const wob = (noise(s * 13 + f.seed, vn * 28, f.seed) - 0.5) * 0.65;
    for (const m of f.marks.black) if (inPatch(m, s, vn, wob)) return 2;
    for (const m of f.marks.red) if (inPatch(m, s, vn, wob)) return 1;
    return 0;
  }

  /*
   * Fourteen koi, each in one of four colour schemes taken in turn: orange,
   * vermilion, gold and sakura. All patterned: kohaku and sanke, with one tancho.
   */
  const VARIETY = ["kohaku", "sanke", "kohaku", "sanke", "kohaku", "sanke", "kohaku", "sanke", "kohaku", "tancho", "sanke", "kohaku", "sanke", "kohaku"];
  const COLOURS = ["course", "vermilion", "gold", "sakura"];
  /* the most one joint of a koi turns from the one in front of it, in radians */
  const BEND = 0.42;
  /* More koi in a bigger pond, by width or by area, up to `most` (opts.most; fourteen unless a host asks for more). */
  const room = (w, h, most) => clamp(Math.max(w / 210, w * h / 85000), 3, most);
  /* the i-th koi's variety: the fourteen above, then kohaku and sanke in turn (still one tancho) */
  const varietyOf = i => i < VARIETY.length ? VARIETY[i] : (i % 2 ? "sanke" : "kohaku");

  /*
   * The paw's keyframes [time, value, ease into it]: o eases out, i eases in,
   * l is linear, anything else eases both ways.
   */
  const EASE = { o: u => 1 - (1 - u) ** 2.2, i: u => u ** 2.2, l: u => u };
  function track(a, keys) {
    if (a <= keys[0][0]) return keys[0][1];
    for (let j = 1; j < keys.length; j++) {
      const [t1, v1, e] = keys[j];
      if (a > t1) continue;
      const [t0, v0] = keys[j - 1], u = (a - t0) / (t1 - t0);
      return v0 + (v1 - v0) * (EASE[e] || (x => x * x * (3 - 2 * x)))(u);
    }
    return keys[keys.length - 1][1];
  }
  const DIP = 0.24, PULL = 0.42, FLICK = 0.72, SHAKE = 0.78, END = 1.25, RING_LIFE = 2.6, DROP_LIFE = 1.2;
  /* The whole catch, channel by channel (time in seconds): in a little past the spot, dip, curl, tug, tug, flick, away. */
  const BACK = [[0, 70], [0.17, -4, "o"], [DIP, 0], [PULL, 0, "l"], [0.52, 13], [0.57, 12], [0.68, 27], [FLICK, 29], [END, 84, "i"]];
  const HIGH = [[0, 0.5], [0.17, 0.15, "o"], [DIP, 0, "i"], [FLICK - 0.02, 0, "l"], [0.86, 0.6, "o"], [END, 1.05]];
  const SWAY = [[0, 0.06], [0.17, -0.02, "o"], [0.3, 0], [0.52, 0.03], [0.68, -0.03], [FLICK, 0], [END, 0]];
  const CURL = [[0, 0], [0.27, 0.05], [0.38, 1, "o"], [0.52, 1, "l"], [0.56, 0.75], [0.6, 1], [FLICK, 1, "l"], [0.95, 0.5], [END, 0.3]];
  const SINK = [[0.2, 0], [0.3, 1, "o"], [0.68, 1, "l"], [FLICK + 0.04, 0, "o"]];
  const SQUASH = [[0, -0.12], [0.17, -0.18, "l"], [0.22, 0.2, "o"], [0.3, 0], [0.44, 0.12], [0.52, -0.1], [0.58, 0.1], [0.68, -0.12], [FLICK, -0.2], [0.86, 0.05], [END, 0]];
  const SEEN = [[0, 0], [0.06, 1, "o"], [1.1, 1, "l"], [END, 0]];
  /* the leg's radius, the round hand's radius, and where the four toes sit around its tip (radians) */
  const LEG = 8.4, HAND = 10, TOES = [-1.12, -0.38, 0.38, 1.12];
  /*
   * A swimmer, seen from above, swims breaststroke: glide, pull, tuck, kick.
   * In body units (she is about a hundred long) al runs from the centre of her
   * head toward her hands and sd across. Her right elbow, hand, knee and foot
   * are keyed over one stroke as [phase, al, sd, ease into it]; the left side
   * mirrors them. SWIM is a body unit in koi units, STROKE one stroke in seconds,
   * WAIST how far behind her head the middle she turns about lies, and ROLL the
   * seconds she takes to roll onto her back.
   */
  const SWIM = 1.65, STROKE = 1.9, WAIST = 40, ROLL = 1.3;
  const joint = keys => [keys.map(k => [k[0], k[1], k[3]]), keys.map(k => [k[0], k[2], k[3]])];
  const ELBOW = joint([[0, 0, 7], [0.28, 0, 7], [0.48, -3, 21, "i"], [0.6, -13, 23, "l"], [0.72, -21, 16, "o"], [0.92, 0, 7], [1, 0, 7]]);
  const PALM = joint([[0, 19, 2], [0.28, 19, 2], [0.48, 13, 30, "i"], [0.6, -2, 27, "l"], [0.72, -16, 5, "o"], [0.92, 19, 2], [1, 19, 2]]);
  /* together her legs touch all the way down, so no water shows between them */
  const KNEE = joint([[0, -70, 3.9], [0.56, -70, 3.9], [0.76, -58, 14], [0.85, -62, 13, "l"], [0.97, -70, 3.9, "o"], [1, -70, 3.9]]);
  const FOOT = joint([[0, -97, 2.3], [0.56, -97, 2.3], [0.76, -69, 9], [0.85, -82, 25, "o"], [0.97, -97, 2.3], [1, -97, 2.3]]);
  /* where the same four joints lie as she floats on her back, arms and legs spread, as [al, sd] */
  const ADRIFT = { elbow: [-8, 23.5], palm: [-2, 41], knee: [-68, 14], foot: [-93, 24] };
  /* how fast she moves through the stroke: she surges on the kick, glides, and all but stops as she tucks */
  const SURGE = [[0, 1.2], [0.28, 0.72, "o"], [0.5, 0.9], [0.62, 0.95, "l"], [0.76, 0.4], [0.9, 1.45], [1, 1.2]];
  /* half the width of her back: the round of the shoulders (from al -6.5), in at the waist, out again to the hips (al -49) */
  const backW = al => al > -13 ? 10.6 * Math.sqrt(Math.max(0, 1 - ((al + 13) / 6.5) ** 2))
    : al > -32 ? lerp(7.4, 10.6, sstep(-32, -15, al))
    : lerp(7.4, 9.6, sstep(-32, -43, al));
  /* Fish food: how long a pellet floats before it sinks out of sight, and how long it takes to sink. */
  const FLOAT = 16, SINKING = 2.5;
  const STEP = 1 / 60;

  /*
   * createPond({ canvas, palette, width?, height?, dpr?, dim?, reduce?, most?, swimmers? })
   * palette() returns the colours: { water, ink, accent, koiLight, koiDark, dark }
   * dim() returns the title's box in canvas pixels, or null: the koi fade under it, and the letters take on their colour.
   * swimmers: how many girls swim through the pond, 1 or 2 (true is 2); without it the pond is the koi's alone.
   */
  function createPond(opts) {
    const canvas = opts.canvas, ctx = canvas.getContext("2d");
    const reduce = !!opts.reduce;
    const MOST = Math.max(3, Math.round(opts.most || VARIETY.length));
    const GIRLS = clamp(opts.swimmers === true ? 2 : Math.round(+opts.swimmers || 0), 0, 2);
    const N = 10, RAMP = " .:-=+*#%@", SUB = [0.25, 0.25, 0.75, 0.25, 0.25, 0.75, 0.75, 0.75];
    let vw = 0, vh = 0, dpr = 1, cw = 10, ch = 13, cols = 0, rows = 0, K = 1.85;
    let t = 0, simT = 0, paused = false;
    let P = null;
    let tileRGB, tileA, glyphRGB, glyphA, glyphCode, shade, wake, wakeTmp, tintRGB, tintA;
    const touched = [];
    let fish = [], swimmers = [];
    const paws = [], rings = [], drops = [], food = [], bubbles = [];
    /* events for a film: { at, fn } run when the simulation passes them */
    const plan = [];
    let planAt = 0;
    /* Caustics: two drifting noise fields; where they meet, light gathers in a thin moving net, as on a pool floor. */
    const caus = (x, y) => 1 - Math.min(1, Math.abs(noise(x / 46 + t * 0.21, y / 46 - t * 0.13, 7) - noise(x / 39 - t * 0.17, y / 52 + t * 0.19, 11)) * 5.5);

    function makeFish() {
      fish = Array.from({ length: MOST }, (_, i) => varietyOf(i)).map((variety, i) => {
        const r = seeded("koi" + i);
        const right = i % 2 === 0, a = right ? (r() - 0.5) * 0.3 : Math.PI + (r() - 0.5) * 0.3;
        const L0 = 128 + r() * 52, seg = L0 / (N - 1);
        const nodes = new Float32Array(N * 2);
        for (let j = 0; j < N; j++) { nodes[j * 2] = -Math.cos(a) * seg * j; nodes[j * 2 + 1] = -Math.sin(a) * seg * j; }
        const seed = i * 97 + 13;
        return {
          variety, colour: COLOURS[i % 4], seen: 1, seed, marks: markings(variety, seed), a, nodes, seg, L0,
          cruise: 24 + r() * 12, nx: (i * 0.38 + 0.15) % 1, ny: 0.22 + r() * 0.56, depth: 0.35 + r() * 0.65, phase: r() * 6.28,
          beat: 0.5, turn: 0, flee: 0, fleeA: 0, seekX: 0, seekY: 0, seekFrom: 0, seekUntil: 0,
          /* feeding: how keen, how far it notices food, when it may eat again, how close to the surface */
          appetite: h2(seed, 5), fullUntil: 0, rise: 0, kick: 0, meal: null
        };
      });
    }

    function size(w, h) {
      dpr = opts.dpr ? opts.dpr() : Math.min(4, global.devicePixelRatio || 1);
      vw = w; vh = h;
      cw = clamp(Math.round(vw / 150), 7, 10); ch = cw + 3; K = 1.85 * clamp(vw / 1000, 0.62, 1);
      canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
      cols = Math.ceil(vw / cw); rows = Math.ceil(vh / ch);
      const n = cols * rows;
      tileRGB = new Uint32Array(n); tileA = new Float32Array(n); glyphRGB = new Uint32Array(n); glyphA = new Float32Array(n);
      glyphCode = new Uint16Array(n); shade = new Float32Array(n); wake = new Float32Array(n); wakeTmp = new Float32Array(n);
      tintRGB = new Uint32Array(n); tintA = new Float32Array(n);
      touched.length = 0;
    }
    const count = () => Math.round(room(vw, vh, MOST));
    const headX = f => f.nx * vw, headY = f => f.ny * vh;

    function stamp(x, y, rad, amt) {
      const c = Math.floor(x / cw), r = Math.floor(y / ch);
      for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
        const cc = c + dc, rr = r + dr, d = Math.hypot(dc, dr * ch / cw);
        if (cc < 0 || rr < 0 || cc >= cols || rr >= rows || d > rad) continue;
        wake[rr * cols + cc] = Math.min(1, wake[rr * cols + cc] + amt * (1 - d / (rad + 1)));
      }
    }

    /* The nearest pellet this koi can see; pellets other koi already chose count as farther, so the shoal spreads out over the food. */
    function mealFor(f, list, hx, hy) {
      if (f.appetite < 0.18 || t < f.fullUntil) return null;
      let best = null, bd = (240 + 320 * f.appetite) * K;
      for (const p of list) {
        const d = Math.hypot(p.x - hx, p.y - hy) + p.claim * 60 * K;
        if (d < bd) { bd = d; best = p; }
      }
      if (best) best.claim++;
      return best;
    }

    function eat(p, f) {
      p.eaten = t;
      f.fullUntil = t + 0.3 + 0.5 * h2(f.seed, Math.round(t * 10));
      f.kick = 1;
      rings.push({ x: p.x, y: p.y, born: t, k: K * 0.7, small: true });
      stamp(p.x, p.y, 1, 0.6);
      for (let j = 0; j < 3; j++) bubbles.push({ x: p.x + (h2(p.seed, j) - 0.5) * 14 * K, y: p.y + (h2(p.seed, j + 9) - 0.5) * 10 * K, born: t + j * 0.09 });
    }

    function step(dt) {
      const zw = Math.max(1, vw), zh = Math.max(1, vh), k = K;
      const maxTilt = 1.0, yLo = 0.14, yHi = 1 - yLo;
      const menu = food.filter(p => p.eaten < 0 && t > p.land - 0.25 && t - p.land < FLOAT);
      for (const p of menu) p.claim = 0;
      for (const g of swimmers) stepSwimmer(g, dt);
      const n = count();
      fish.forEach((f, i) => {
        /* A koi that comes or goes as the window is resized fades over half a second. */
        const want = i < n ? 1 : 0;
        f.seen = clamp(f.seen + Math.sign(want - f.seen) * dt * 2, Math.min(f.seen, want), Math.max(f.seen, want));
        const right = Math.cos(f.a) > 0, base = right ? 0 : Math.PI;
        f.beat = 0.5 + 0.5 * Math.sin(t * 0.45 + f.seed);
        let turn = Math.sin(t * 0.29 + f.seed) * 0.32 + Math.sin(t * 0.11 + f.seed * 1.7) * 0.22;
        if (f.ny < yLo) turn += right ? 0.7 : -0.7;
        if (f.ny > yHi) turn += right ? -0.7 : 0.7;
        const tilt = Math.atan2(Math.sin(f.a - base), Math.cos(f.a - base));
        if (Math.abs(tilt) > maxTilt) turn -= Math.sign(tilt) * 1.4;
        f.turn = lerp(f.turn, turn, Math.min(1, dt * 2));
        const hx = headX(f), hy = headY(f);
        /* Koi give a swimmer room: the nearer she is, the harder they turn away. */
        for (const g of swimmers) {
          if (g.away) continue;
          const d = Math.hypot(hx - g.x, hy - g.y), R = 150 * k;
          if (d < R) {
            const away = Math.atan2(hy - g.y, hx - g.x), da = Math.atan2(Math.sin(away - f.a), Math.cos(away - f.a));
            f.turn = lerp(f.turn, clamp(da * 2.2, -2, 2), Math.min(1, dt * 4 * (1 - d / R)));
          }
        }
        /* A paw hit the water: dart away from it. Food: rise and race to it. Later the curious ones swim back to look. */
        let hurry = 1;
        f.meal = null;
        if (f.flee > 0.02) {
          const d = Math.atan2(Math.sin(f.fleeA - f.a), Math.cos(f.fleeA - f.a));
          f.turn = lerp(f.turn, clamp(d * 5, -4, 4), Math.min(1, dt * 8 * f.flee));
          hurry = 1 + 2.6 * f.flee;
          f.flee *= Math.exp(-1.3 * dt);
        } else if (menu.length && (f.meal = mealFor(f, menu, hx, hy))) {
          const p = f.meal, dist = Math.hypot(p.x - hx, p.y - hy);
          const d = Math.atan2(Math.sin(Math.atan2(p.y - hy, p.x - hx) - f.a), Math.cos(Math.atan2(p.y - hy, p.x - hx) - f.a));
          f.turn = lerp(f.turn, clamp(d * 3.6, -3.4, 3.4), Math.min(1, dt * 7));
          /* fast from afar, slower close in so it can turn onto the pellet */
          hurry = 1.2 + 1.3 * clamp(dist / (150 * k), 0, 1) * (Math.abs(d) < 1.1 ? 1 : 0.45);
          f.rise = Math.min(1, f.rise + dt * 1.6);
        } else if (t > f.seekFrom && t < f.seekUntil) {
          if (Math.hypot(f.seekX - hx, f.seekY - hy) < 26 * k) f.seekUntil = 0;
          else {
            const d = Math.atan2(Math.sin(Math.atan2(f.seekY - hy, f.seekX - hx) - f.a), Math.cos(Math.atan2(f.seekY - hy, f.seekX - hx) - f.a));
            f.turn = lerp(f.turn, clamp(d * 2.6, -2.4, 2.4), Math.min(1, dt * 3));
            hurry = 1.4;
          }
        }
        if (!f.meal) f.rise = Math.max(0, f.rise - dt * 0.3);
        hurry *= 1 + 0.9 * f.kick;
        f.kick *= Math.exp(-3.5 * dt);
        f.a += f.turn * dt;
        const speed = f.cruise * (0.65 + 0.7 * f.beat) * hurry;
        const dx = Math.cos(f.a) * speed * dt, dy = Math.sin(f.a) * speed * dt;
        f.nx += dx * k / zw;
        f.ny += dy * k / zh;
        /*
         * The head stays at the origin; the rest of the chain trails it. No joint
         * bends further than BEND, so a startled koi curls into a C and the tail
         * swings round after the head instead of folding the body over itself.
         */
        const nd = f.nodes;
        for (let j = 1; j < N; j++) { nd[j * 2] -= dx; nd[j * 2 + 1] -= dy; }
        let bx = -Math.cos(f.a), by = -Math.sin(f.a);
        for (let j = 1; j < N; j++) {
          const px = nd[(j - 1) * 2], py = nd[(j - 1) * 2 + 1];
          let vx = nd[j * 2] - px, vy = nd[j * 2 + 1] - py;
          const d = Math.hypot(vx, vy) || 1; vx /= d; vy /= d;
          const bend = Math.atan2(bx * vy - by * vx, bx * vx + by * vy);
          if (Math.abs(bend) > BEND) { const r = Math.sign(bend) * BEND, c = Math.cos(r), s = Math.sin(r); vx = bx * c - by * s; vy = bx * s + by * c; }
          nd[j * 2] = px + vx * f.seg; nd[j * 2 + 1] = py + vy * f.seg;
          bx = vx; by = vy;
        }
        f.phase += dt * (2.6 + 5 * f.beat) * (1 + 0.6 * f.kick);
        const m = (f.L0 * k * 1.45) / zw;
        if (f.nx > 1 + m) f.nx = -m;
        if (f.nx < -m) f.nx = 1 + m;
        /* the mouth reaches the pellet: one gulp */
        if (f.meal && Math.hypot(f.meal.x - headX(f), f.meal.y - headY(f)) < 14 * k) eat(f.meal, f);
        /* wake from the tail */
        if (f.seen > 0) {
          const tc = Math.floor((headX(f) + nd[(N - 1) * 2] * k) / cw), tr = Math.floor((headY(f) + nd[(N - 1) * 2 + 1] * k) / ch);
          if (tc >= 0 && tr >= 0 && tc < cols && tr < rows) wake[tr * cols + tc] = Math.min(1, wake[tr * cols + tc] + 0.18 * f.beat * dt * 30);
        }
      });
      /* wake: spreads a little and fades, the edge cells too: a neighbour beyond the edge counts as the cell
         itself, so a wake left by a koi passing the edge fades like any other instead of piling up there */
      const fade = Math.exp(-dt * 1.4);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c, w = wake[i];
        const n = (c > 0 ? wake[i - 1] : w) + (c < cols - 1 ? wake[i + 1] : w) + (r > 0 ? wake[i - cols] : w) + (r < rows - 1 ? wake[i + cols] : w);
        wakeTmp[i] = (w * 0.84 + n * 0.04) * fade;
      }
      [wake, wakeTmp] = [wakeTmp, wake];
    }

    /* ── rasterising one koi into the cell buffers ── */
    const spine = new Float32Array(N * 2), arc = new Float32Array(N);
    let arcTotal = 1, S = 0, V = 0, D = 0, TX = 1, TY = 0, SEG = 0;
    function sample(px, py, L, flareL, flareR, from = 0, to = N - 2) {
      let best = Infinity, bs = 0, sign = 1, past = 0, ahead = 0, lateral = 0;
      for (let n = from; n <= to; n++) {
        const ax = spine[n * 2], ay = spine[n * 2 + 1], sx = spine[n * 2 + 2] - ax, sy = spine[n * 2 + 3] - ay;
        const len2 = sx * sx + sy * sy || 1, raw = ((px - ax) * sx + (py - ay) * sy) / len2, u = clamp(raw, 0, 1);
        const d2 = (px - ax - sx * u) ** 2 + (py - ay - sy * u) ** 2;
        if (d2 < best) {
          const len = Math.sqrt(len2), cross = sx * (py - ay) - sy * (px - ax);
          best = d2; bs = (arc[n] + u * len) / arcTotal; sign = cross >= 0 ? 1 : -1;
          past = n === N - 2 ? Math.max(0, raw - 1) * len : 0;
          ahead = n === 0 ? Math.max(0, -raw) * len : 0;
          lateral = Math.abs(cross) / len; TX = sx / len; TY = sy / len; SEG = n;
        }
      }
      D = Math.sqrt(best); S = bs; V = D * sign;
      return classify(bs, D / L, past / L, sign > 0 ? flareL : flareR, ahead / L, lateral / L);
    }
    const lineGlyph = (dx, dy) => { const d = Math.hypot(dx, dy) || 1; return Math.abs(dy) < 0.38 * d ? "-" : Math.abs(dx) < 0.38 * d ? "|" : dx * dy > 0 ? "\\" : "/"; };

    function rasterize(f, dimAt) {
      const k = K, hx = headX(f), hy = headY(f), L = f.L0 * k;
      const swim = 0.25 + 0.9 * f.beat;
      for (let n = 0; n < N; n++) {
        const s = n / (N - 1), a = Math.max(0, n - 1), b = Math.min(N - 1, n + 1);
        let tx = f.nodes[a * 2] - f.nodes[b * 2], ty = f.nodes[a * 2 + 1] - f.nodes[b * 2 + 1];
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const off = L * 0.045 * (0.05 + 0.95 * Math.pow(s, 2.2)) * swim * Math.sin(f.phase - s * 4.6);
        spine[n * 2] = hx + f.nodes[n * 2] * k - ty * off;
        spine[n * 2 + 1] = hy + f.nodes[n * 2 + 1] * k + tx * off;
      }
      arc[0] = 0;
      for (let n = 1; n < N; n++) arc[n] = arc[n - 1] + Math.hypot(spine[n * 2] - spine[n * 2 - 2], spine[n * 2 + 1] - spine[n * 2 - 1]);
      arcTotal = arc[N - 1] || 1;
      const bank = clamp(f.turn * 0.5, -0.3, 0.3), scull = 0.15 * (1 - f.beat) * Math.sin(f.phase * 0.5);
      const flareL = 1 + scull - bank, flareR = 1 - scull + bank;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let n = 0; n < N; n++) { x0 = Math.min(x0, spine[n * 2]); x1 = Math.max(x1, spine[n * 2]); y0 = Math.min(y0, spine[n * 2 + 1]); y1 = Math.max(y1, spine[n * 2 + 1]); }
      const reach = L * 0.27;
      const c0 = Math.max(0, Math.floor(Math.max(x0 - reach, 0) / cw)), c1 = Math.min(cols - 1, Math.floor(Math.min(x1 + reach, vw) / cw));
      const r0 = Math.max(0, Math.floor(Math.max(y0 - reach, 0) / ch)), r1 = Math.min(rows - 1, Math.floor(Math.min(y1 + reach, vh) / ch));
      if (c0 > c1 || r0 > r1) return;
      const diag = Math.hypot(cw, ch);
      /* A koi rising for food comes up toward the surface: brighter, its shadow further below it. */
      const depth = lerp(f.depth, 1, f.rise * 0.85);
      const Kc = P.koi[f.colour], alphaBase = (P.dark ? 0.82 : 0.9) * (0.55 + 0.45 * depth) * f.seen;
      const sdc = 1 + Math.round(depth * 2), sdr = 1 + Math.round(depth);
      const lx = -0.6, ly = -0.8;
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const x = c * cw, y = r * ch;
          const got = sample(x + cw / 2, y + ch / 2, L, flareL, flareR);
          if (!got && D > L * (S > 0.4 && S < 0.62 ? 0.15 : 0.26) + diag) { c += Math.max(0, Math.floor((D - L * 0.26 - diag) / cw)); continue; }
          let kind = hit.kind, across = hit.across, rs = hit.rs, ra = hit.ra, s = S, v = V, tx = TX, ty = TY;
          const from = Math.max(0, SEG - 2), to = Math.min(N - 2, SEG + 2);
          let hits = got ? 1 : 0;
          const deep = got && kind === 1 && s > 0.05 && s < 0.7 && halfW(s) * L - D > diag * 0.4;
          if (deep) hits = 5;
          for (let q = 0; !deep && q < SUB.length; q += 2) {
            if (!sample(x + SUB[q] * cw, y + SUB[q + 1] * ch, L, flareL, flareR, from, to)) continue;
            if (hits === 0) { kind = hit.kind; across = hit.across; rs = hit.rs; ra = hit.ra; s = S; v = V; tx = TX; ty = TY; }
            hits++;
          }
          if (!hits) continue;
          const cover = hits / 5, i = r * cols + c, dim = dimAt(x + cw / 2, y + ch / 2);
          const side = v >= 0 ? 1 : -1;
          let tile = null, tA = 0, g = " ", gC = null, gA = 0;
          if (kind === 5) {
            g = lineGlyph(tx, ty); gC = Kc.fin; gA = 0.7 * alphaBase;
          } else if (kind === 2) {
            /* Fins and tail: see-through tiles with a ray glyph */
            const nx = -ty * side, ny = tx * side;
            g = lineGlyph(rs * tx + ra * nx, rs * ty + ra * ny);
            tile = Kc.fin; tA = (P.dark ? 0.26 : 0.42) * cover * alphaBase;
            gC = mul(Kc.fin, P.dark ? 1.1 : 0.8); gA = (P.dark ? 0.55 : 0.6) * alphaBase;
          } else {
            const nz = Math.sqrt(Math.max(0, 1 - across * across));
            const nxs = -ty * side * across, nys = tx * side * across;
            /* where the caustic net crosses a koi's back, its scales glint */
            const gl = sstep(0.62, 0.96, caus(x + cw / 2, y + ch / 2)) * nz;
            const lit = clamp(0.76 + 0.26 * nz + 0.2 * (nxs * lx + nys * ly) + 0.3 * gl, 0.62, 1.34);
            const sk = kind === 3 ? null : skin(f, s, v / L, across);
            const base = kind === 3 ? P.eye : sk === 1 ? Kc.red : sk === 2 ? Kc.black : Kc.white;
            tile = mul(base, lit); tA = (cover >= 0.6 ? 1 : cover * 1.4) * alphaBase;
            /* The koi's back as the title takes it on, before the dimming under the title: the red saddles most, then white or black by the theme. */
            if (kind !== 3) { tintRGB[i] = pack(tile); tintA[i] = tA * (sk === 1 ? 1 : sk === 2 ? (P.dark ? 0.4 : 0.6) : (P.dark ? 0.7 : 0.25)) * (1 + 0.6 * gl); }
            if (kind === 3) { g = "o"; gC = Kc.white; gA = 0.95 * alphaBase; }
            else {
              const idx = clamp(1 + Math.round((1.08 - lit) / 0.46 * 6) + (kind === 4 ? 2 : 0), 1, RAMP.length - 1);
              g = RAMP[idx]; gC = mul(base, P.dark ? (sk === 0 ? 0.55 : 1.35) : 0.5); gA = 0.62 * alphaBase;
              if (gl > 0.5 && kind !== 4) { g = "*"; gC = mixC(base, [255, 255, 255], 0.75); gA = (0.45 + 0.4 * gl) * alphaBase; }
            }
            if (cover >= 0.6) {
              const si = (r + sdr) * cols + (c + sdc);
              if (r + sdr < rows && c + sdc < cols) shade[si] = Math.max(shade[si], (P.dark ? 0.55 : 0.22) * (0.5 + 0.5 * depth) * dim * f.seen);
            }
          }
          if (!tileA[i] && !glyphA[i]) touched.push(i);
          if (tile) { tileRGB[i] = pack(tile); tileA[i] = tA * dim; }
          if (gC) { glyphRGB[i] = pack(gC); glyphA[i] = gA * dim; glyphCode[i] = g.charCodeAt(0); }
        }
      }
    }

    /* ── the swimmers ── */
    /* She comes in at one bank, hands first, and swims across on a line of her own. Most times she stops on the way to float. */
    function enter(g) {
      const r = j => h2(g.seed, g.trip * 11 + j), first = g.trip === 0;
      const out = (WAIST + 24) * SWIM * K / Math.max(1, vw);
      g.right = first ? g.id % 2 === 0 : r(1) < 0.5;
      /* the first time each keeps clear of a title: one swims below it, one above */
      g.lane = first ? (g.id ? 0.2 : 0.78) : 0.18 + 0.64 * r(2);
      /* and clear of a swimmer who is already in the pond */
      for (const o of swimmers) if (o !== g && !o.away && Math.abs(o.ny - g.lane) < 0.3) g.lane = o.ny < 0.5 ? o.ny + 0.32 : o.ny - 0.32;
      /* the first one is already a little way in when the pond opens */
      g.nx = first && !g.id ? 0.1 : g.right ? -out : 1 + out;
      g.ny = g.lane;
      g.a = (g.right ? 0 : Math.PI) + (r(3) - 0.5) * 0.3;
      /* the first time she floats near the middle of the pond, later wherever she likes, or not at all */
      g.rest = first ? 0.45 : r(4) < 0.6 ? 0.3 + 0.4 * r(5) : -1;
      g.turn = 0; g.fl = 0; g.floating = false; g.away = false; g.trip++;
    }
    function stepSwimmer(g, dt) {
      if (g.away) { if (t < g.back) return; enter(g); }
      const k = SWIM * K, zw = Math.max(1, vw), zh = Math.max(1, vh);
      /* Past the spot she chose, at the start of a glide, she rolls onto her back and floats; after a while she rolls over and swims on. */
      if (!g.floating && g.rest >= 0 && (g.right ? g.nx > g.rest : g.nx < g.rest) && g.phase < 0.2 && g.ny > 0.14 && g.ny < 0.86) {
        g.floating = true; g.rest = -1; g.floatUntil = t + 9 + 8 * h2(g.seed, g.trip + 40);
      }
      if (g.floating && t > g.floatUntil) g.floating = false;
      const was = g.fl;
      g.fl = clamp(g.fl + (g.floating ? dt : -dt) / ROLL, 0, 1);
      const e = sstep(0, 1, g.fl), x0 = g.nx * vw, y0 = g.ny * vh;
      /* the roll leaves a ring on the water */
      if ((was < 0.5) !== (g.fl < 0.5)) { rings.push({ x: x0, y: y0, born: t, k: K * 0.9, small: true }); stamp(x0, y0, 2, 0.5); }
      /* Her course: back toward her line across the pond, wandering a little about it, and round the other swimmer. */
      let off = clamp((g.lane - g.ny) * 2.2, -0.45, 0.45) + 0.2 * Math.sin(t * 0.17 + g.seed) + 0.1 * Math.sin(t * 0.071 + g.seed * 1.7);
      for (const o of swimmers) {
        if (o === g || o.away) continue;
        const d = Math.hypot(o.x - x0, o.y - y0), R = 190 * k;
        if (d < R) off += (y0 === o.y ? (g.id < o.id ? -1 : 1) : Math.sign(y0 - o.y)) * 0.6 * (1 - d / R);
      }
      const want = g.right ? off : Math.PI - off, da = Math.atan2(Math.sin(want - g.a), Math.cos(want - g.a));
      g.turn = lerp(g.turn, clamp(da * 0.8, -0.24, 0.24), Math.min(1, dt * 1.5));
      if (g.fl === 0) g.phase = (g.phase + dt / g.stroke) % 1;
      const u = g.phase, surge = track(u, SURGE);
      /* She turns about her middle and only as fast as she moves, so her feet never swing round her head. Afloat she turns as idly as she drifts. */
      g.a += lerp(g.turn * surge, 0.05 * Math.sin(t * 0.13 + g.seed), e) * dt;
      const ux = Math.cos(g.a), uy = Math.sin(g.a), speed = lerp(30 * surge, 3, e) * K * dt;
      g.nx += ux * speed / zw;
      g.ny += uy * speed / zh;
      /* her middle: what the koi and the other swimmer keep clear of */
      const x = g.x = g.nx * vw, y = g.y = g.ny * vh;
      /* Out of sight past a bank, she stays away for a while. */
      const M = (WAIST + 26) * k;
      if (x < -M || x > vw + M || y < -M || y > vh + M) { g.away = true; g.back = t + 12 + 28 * h2(g.seed, g.trip + 20); return; }
      /* her ponytail floats behind her and swings out as she turns */
      g.sway = lerp(g.sway, clamp(g.turn * surge * 12, -5, 5) + Math.sin(t * 2.1 + g.seed) * 0.8, Math.min(1, dt * 2.5));
      /* the pull stirs the water at her hands, the kick at her feet */
      const pull = sstep(0.3, 0.42, u) * (1 - sstep(0.6, 0.7, u)), kick = sstep(0.76, 0.84, u) * (1 - sstep(0.93, 1, u));
      const hx = x + ux * WAIST * k, hy = y + uy * WAIST * k;
      for (const side of [1, -1]) {
        for (const [J, amt] of [[PALM, 4 * pull], [FOOT, 9 * kick]]) {
          if (amt < 0.2 || e > 0) continue;
          const al = track(u, J[0]), sd = track(u, J[1]) * side;
          stamp(hx + (ux * al - uy * sd) * k, hy + (uy * al + ux * sd) * k, 1, amt * dt);
        }
      }
    }
    /* Her ponytail and her limbs as tapered capsules in body units: al, sd and radius at one joint, then at the next. Rolling onto her back, they ease from the stroke to where they lie afloat, and there they bob a little. */
    const caps = new Float32Array(9 * 6);
    function pose(g) {
      const u = g.phase, e = sstep(0, 1, g.fl);
      let j = 0;
      const cap = (a0, s0, a1, s1, r0, r1) => { caps[j++] = a0; caps[j++] = s0; caps[j++] = a1; caps[j++] = s1; caps[j++] = r0; caps[j++] = r1; };
      const at = (J, rest, n) => lerp(track(u, J[n]), rest[n], e);
      const ea = at(ELBOW, ADRIFT.elbow, 0), es = at(ELBOW, ADRIFT.elbow, 1), pa = at(PALM, ADRIFT.palm, 0), ps = at(PALM, ADRIFT.palm, 1);
      const ka = at(KNEE, ADRIFT.knee, 0), ks = at(KNEE, ADRIFT.knee, 1), fa = at(FOOT, ADRIFT.foot, 0), fs = at(FOOT, ADRIFT.foot, 1);
      cap(-4.5, 0, -21, g.sway, 3, 1.7);
      for (const side of [1, -1]) {
        const bob = Math.sin(t * 0.8 + g.seed + side) * e;
        cap(-13, 9.5 * side, ea, es * side, 3.3, 2.9);
        cap(ea, es * side, pa + 2.2 * bob, ps * side, 2.8, 2.1);
        cap(-46, 4.8 * side, ka, ks * side, 5.1, 4);
        cap(ka, ks * side, fa, (fs + 1.6 * bob) * side, 3.8, 2.4);
      }
    }
    /* what bodyAt found: how far across the part the point is, which way its surface leans, how deep under water, and whether it is on her spine */
    const B = { across: 0, na: 0, ns: 0, wet: 0, ridge: false };
    /* for the swimmer being drawn: whether she lies on her back, and where the moving edge of her spread hair is */
    let UP = false, FAN = 0;
    function capAt(al, sd, n) {
      const j = n * 6, a0 = caps[j], s0 = caps[j + 1], da = caps[j + 2] - a0, ds = caps[j + 3] - s0;
      const u = clamp(((al - a0) * da + (sd - s0) * ds) / (da * da + ds * ds || 1), 0, 1);
      const ea = al - a0 - da * u, es = sd - s0 - ds * u, d = Math.hypot(ea, es), r = lerp(caps[j + 4], caps[j + 5], u);
      if (d > r) return false;
      B.across = d / r; B.na = d ? ea / d : 0; B.ns = d ? es / d : 0;
      return true;
    }
    /*
     * The part of her over a point, the topmost first: 4 ponytail, 3 hair, 2 bikini, 1 skin, 0 water.
     * Swimming, we see her back: the ponytail lies on it, her arms and legs under it, a little under water.
     * Floating, we see her face with her hair spread on the water round it.
     */
    function bodyAt(al, sd) {
      B.wet = 0; B.ridge = false;
      if (UP) {
        const fd = Math.hypot((al - 0.6) / 5.6, sd / 5);
        if (fd <= 1) { B.across = fd; B.na = fd ? (al - 0.6) / 5.6 / fd : 0; B.ns = fd ? sd / 5 / fd : 0; return 1; }
      } else if (capAt(al, sd, 0)) return 4;
      const hd = Math.hypot(al / 6.9, sd / 6.2);
      if (hd <= 1) { B.across = hd; B.na = hd ? al / 6.9 / hd : 0; B.ns = hd ? sd / 6.2 / hd : 0; return 3; }
      if (al < -6.5 && al > -49) {
        const w = backW(al), across = Math.abs(sd) / w;
        if (across <= 1) {
          B.across = across; B.na = 0; B.ns = sd < 0 ? -1 : 1;
          /* the top, a strap across her back and a band in front, and the bottoms, cut a little higher on the hips */
          if ((al < (UP ? -16.5 : -17.5) && al > (UP ? -22.5 : -22)) || al < -41.5 + 2 * across) return 2;
          B.ridge = !UP && across < 0.1 && al < -24 && al > -38;
          return 1;
        }
      }
      if (UP) {
        const th = Math.atan2(sd, al - 2), d = Math.hypot(al - 2, sd), R = 11 + 1.5 * Math.sin(3 * th + FAN) + Math.sin(5 * th - FAN * 0.7);
        if (d <= R) { B.across = d / R; B.na = d ? (al - 2) / d : 0; B.ns = d ? sd / d : 0; B.wet = 0.1; return 3; }
      }
      for (let n = 1; n < 9; n++) if (capAt(al, sd, n)) { B.wet = UP ? 0.04 : (n - 1) % 4 < 2 ? 0.1 : 0.18; return 1; }
      return 0;
    }
    /* the glyph on a tile: darker than a light tile, lighter than a dark one, so black hair still shows its strands */
    const lum = c => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
    const inkOn = c => { const l = lum(c); return l < 80 ? mixC(c, [226, 210, 255], P.dark ? 0.42 : 0.3) : mul(c, P.dark ? (l > 165 ? 0.6 : 1.35) : 0.5); };
    /* Drawn as the koi are: tiles shaded by the light from the upper left with a glyph for the shade, soft at the edges, and a shadow on the pond floor. */
    function rasterSwimmer(g, dimAt) {
      const k = SWIM * K, ux = Math.cos(g.a), uy = Math.sin(g.a);
      /* the centre of her head, ahead of the middle she turns about */
      const cx = g.nx * vw + ux * WAIST * k, cy = g.ny * vh + uy * WAIST * k;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const al of [-101, 24]) for (const sd of [-45, 45]) {
        const x = cx + (ux * al - uy * sd) * k, y = cy + (uy * al + ux * sd) * k;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      const c0 = Math.max(0, Math.floor(x0 / cw)), c1 = Math.min(cols - 1, Math.floor(x1 / cw));
      const r0 = Math.max(0, Math.floor(y0 / ch)), r1 = Math.min(rows - 1, Math.floor(y1 / ch));
      if (c0 > c1 || r0 > r1) return;
      pose(g);
      UP = g.fl > 0.5; FAN = t * 0.5 + g.seed;
      /* rolling over, she is seen edge on for a moment: narrower across */
      const q = k * (1 - 0.4 * Math.sin(Math.PI * g.fl));
      const C = P.swim[g.id % P.swim.length], alphaBase = P.dark ? 0.82 : 0.9, lx = -0.6, ly = -0.8;
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const x = c * cw, y = r * ch;
        /* the cell's centre, then its four sub-samples */
        let hits = 0, kind = 0, across = 0, na = 0, ns = 0, wet = 0, ridge = false;
        for (let s = -2; s < SUB.length; s += 2) {
          const px = x + (s < 0 ? 0.5 : SUB[s]) * cw - cx, py = y + (s < 0 ? 0.5 : SUB[s + 1]) * ch - cy;
          const got = bodyAt((px * ux + py * uy) / k, (py * ux - px * uy) / q);
          if (!got) continue;
          if (!hits) { kind = got; across = B.across; na = B.na; ns = B.ns; wet = B.wet; ridge = B.ridge; }
          hits++;
        }
        if (!hits) continue;
        const cover = hits / 5, i = r * cols + c, dim = dimAt(x + cw / 2, y + ch / 2);
        const nz = Math.sqrt(Math.max(0, 1 - across * across));
        const nxs = (na * ux - ns * uy) * across, nys = (na * uy + ns * ux) * across;
        /* the caustic net glints on her back as it does on a koi's */
        const gl = sstep(0.62, 0.96, caus(x + cw / 2, y + ch / 2)) * nz * (1 - 2 * wet);
        const lit = clamp(0.76 + 0.26 * nz + 0.2 * (nxs * lx + nys * ly) + 0.3 * gl, 0.62, 1.34);
        const hair = kind >= 3, suit = kind === 2, cloth = hair ? C.hair : suit ? C.suit : C.skin, black = lum(cloth) < 80;
        const base = wet ? mixC(cloth, P.water, wet) : cloth;
        let tile = mul(base, lit);
        /* on dark water black hair and a black bikini catch a little light along their edge, as the cat's paw does */
        if (black && P.dark) tile = mixC(tile, [140, 126, 176], 0.3 * sstep(0.55, 1, across));
        const tA = (cover >= 0.6 ? 1 : cover * 1.4) * alphaBase;
        /* a cell she only brushes keeps the koi that is under it */
        if (cover < 0.6 && tileA[i] > tA * dim) continue;
        let gch, gC, gA = 0.62 * alphaBase;
        if (hair) {
          /* hair is drawn in strokes along its strands: straight back on her head, along the ponytail behind it, outward where it lies spread on the water */
          const da = kind === 4 ? caps[2] - caps[0] : UP ? na : 1, ds = kind === 4 ? caps[3] - caps[1] : UP ? ns : 0;
          gch = lineGlyph(da * ux - ds * uy, da * uy + ds * ux); gC = inkOn(base);
        } else {
          gch = RAMP[clamp(1 + Math.round((1.08 - lit) / 0.46 * 6) + (ridge ? 2 : 0), 1, RAMP.length - 1)];
          gC = inkOn(base);
          if (gl > 0.5 && !ridge) { gch = "*"; gC = mixC(base, [255, 255, 255], 0.75); gA = (0.45 + 0.4 * gl) * alphaBase; }
        }
        if (cover >= 0.6) {
          const si = (r + 2) * cols + (c + 3);
          if (r + 2 < rows && c + 3 < cols) shade[si] = Math.max(shade[si], (P.dark ? 0.55 : 0.22) * dim);
        }
        if (!tileA[i] && !glyphA[i]) touched.push(i);
        tileRGB[i] = pack(tile); tileA[i] = tA * dim;
        glyphRGB[i] = pack(gC); glyphA[i] = gA * dim; glyphCode[i] = gch.charCodeAt(0);
        /* the title takes on her colours as it does a koi's: a coloured bikini or hair most, black least */
        tintRGB[i] = pack(tile); tintA[i] = tA * (black ? (P.dark ? 0.4 : 0.6) : hair || suit ? 1 : (P.dark ? 0.7 : 0.25)) * (1 + 0.6 * gl);
      }
      /* afloat her eyes are closed: two short strokes across her face */
      if (UP) for (const side of [1, -1]) {
        const x = cx + ux * 1.6 * k - uy * 2.4 * side * q, y = cy + uy * 1.6 * k + ux * 2.4 * side * q;
        const c = Math.floor(x / cw), r = Math.floor(y / ch), i = r * cols + c;
        if (c < 0 || r < 0 || c >= cols || r >= rows || !(tileA[i] > 0)) continue;
        glyphRGB[i] = pack(mul(C.skin, 0.36)); glyphA[i] = 0.85 * alphaBase * dimAt(x, y); glyphCode[i] = lineGlyph(-uy, ux).charCodeAt(0);
      }
    }

    /* ── the cat's paw ── */
    const water = (x, y) => !paused && !reduce && x >= 0 && x <= vw && y >= 0 && y <= vh;
    /* A paw at (x, y): straight in from the nearer edge, top or bottom. */
    function poke(x, y) {
      if (paws.length >= 3 || !water(x, y)) return false;
      const k = K, fromTop = y <= vh - y;
      const ex = x, ey = fromTop ? -46 * k : vh + 46 * k;
      /* which way it sways and shakes is left to chance */
      paws.push({ x, y, k, ex, ey, leg: 30, side: h2(Math.round(x), Math.round(y)) < 0.5 ? -1 : 1, born: t, hit: false, flung: false, drips: 0 });
      return true;
    }
    /* Where a paw is in its catch: how far it is drawn back, how high, how it sways, how curled and how deep its toes are. */
    function pawState(p) {
      const a = t - p.born;
      /* two quick wet shakes as it leaves, turning the paw */
      const u = (a - SHAKE) / 0.3, shake = u > 0 && u < 1 ? 0.14 * Math.sin(u * 4 * Math.PI) * (1 - u) : 0;
      return { back: track(a, BACK), h: track(a, HIGH), swing: (track(a, SWAY) + shake) * p.side, curl: track(a, CURL), sink: track(a, SINK), squash: track(a, SQUASH), seen: track(a, SEEN) };
    }
    /* How far the tip reaches in paw units: curled toes fold under, so the paw gets shorter. */
    const tipOf = s => 5 - 4 * s.curl + HAND * 1.08;
    /* The paw on screen: the leg turns about a shoulder beyond the edge. Centre, axis u toward the toes, v across, size k; high up it looks bigger. */
    function pawPose(p) {
      const s = pawState(p), Kp = p.k * 1.9, arm = 120;
      let ux = p.x - p.ex, uy = p.y - p.ey;
      const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
      const c = Math.cos(s.swing), n = Math.sin(s.swing), dx = ux * c - uy * n, dy = ux * n + uy * c;
      const sx = p.x - ux * arm * Kp, sy = p.y - uy * arm * Kp, r = (arm - s.back) * Kp;
      return { ...s, ux: dx, uy: dy, vx: -dy, vy: dx, cx: sx + dx * r, cy: sy + dy * r, k: Kp * (1 + 0.5 * s.h) };
    }
    function splash(p) {
      p.hit = true;
      const s = pawPose(p), tip = tipOf(s) - 3, x = s.cx + s.ux * tip * s.k, y = s.cy + s.uy * tip * s.k;
      rings.push({ x, y, born: t, k: p.k, small: false });
      stamp(x, y, 4, 0.9);
      const reach = 280 * p.k;
      const near = fish.slice(0, count()).map(f => ({ f, d: Math.hypot(headX(f) - x, headY(f) - y), hx: headX(f), hy: headY(f) })).sort((a, b) => a.d - b.d);
      near.forEach(({ f, d, hx, hy }, i) => {
        if (d < reach) { f.flee = Math.max(f.flee, 1 - d / reach * 0.7); f.fleeA = Math.atan2(hy - y, hx - x); }
        /* the two curious ones come to look from either side, not at the same spot */
        if (i < 2) { const o = (i ? 1 : -1) * 34 * p.k; f.seekX = x - s.vx * o; f.seekY = y - s.vy * o; f.seekFrom = t + 1.3 + i * 0.5; f.seekUntil = f.seekFrom + 3.5; }
      });
    }
    /* The tugs stir the water in front of the curled toes. */
    function stir(p, dt) {
      const s = pawPose(p), tip = tipOf(s) + 2;
      stamp(s.cx + s.ux * tip * s.k, s.cy + s.uy * tip * s.k, 2, 4 * dt);
    }
    /* Flicking out of the water, the paw throws a few drops back toward the cat. */
    function fling(p) {
      p.flung = true;
      const s = pawPose(p), seed = Math.round(p.born * 1000);
      for (let j = 0; j < 5; j++) {
        const side = (j - 2) / 2, d = (30 + 36 * h2(j, seed)) * p.k;
        const x0 = s.cx + (s.ux * tipOf(s) + s.vx * side * 8) * s.k, y0 = s.cy + (s.uy * tipOf(s) + s.vy * side * 8) * s.k;
        drops.push({ x0, y0, x1: x0 - s.ux * d + s.vx * side * 18 * p.k, y1: y0 - s.uy * d + s.vy * side * 18 * p.k, born: t + j * 0.035, dur: 0.34 + 0.14 * h2(j + 7, seed), k: p.k });
      }
    }
    /* Each shake throws a drop off the side of the tip it swings toward. */
    function drip(p, dir) {
      const s = pawPose(p), a0 = tipOf(s) - 4, s0 = dir * 8, seed = Math.round(p.born * 1000) + p.drips;
      const x = s.cx + (s.ux * a0 + s.vx * s0) * s.k, y = s.cy + (s.uy * a0 + s.vy * s0) * s.k, d = (26 + 20 * h2(seed, 3)) * p.k;
      drops.push({ x0: x, y0: y, x1: x + s.vx * dir * d - s.ux * 8 * p.k, y1: y + s.vy * dir * d - s.uy * 8 * p.k, born: t, dur: 0.3, k: p.k });
    }
    /*
     * The paw is drawn the way the cat is: in cells half the pond's size, black
     * fur edged with ':' and a little '#%' texture. In paw units al runs toward
     * the toes and sd across: a round little hand on a round leg, its four toes
     * only drawn as four faint arcs along the tip.
     */
    function drawPaw(p) {
      const pose = pawPose(p), { ux, uy, vx, vy, cx, cy, k, h, sink, curl, squash, seen } = pose;
      /* squashed as it pushes in, stretched as it shoots and flicks: shorter and wider, or longer and narrower */
      const ka = k * (1 - 0.16 * squash), ks = k * (1 + 0.16 * squash);
      /* Curled toes fold under the tip, and their knuckles stand out a little more. */
      const cb = tipOf(pose) - HAND * 1.08, toe = 2.5 + 0.3 * curl, ring = HAND - toe - 1.1;
      const smin = (a, b, m) => { const q = Math.max(m - Math.abs(a - b), 0) / m; return Math.min(a, b) - q * q * m / 4; };
      let dist = 0;
      const part = (al, sd) => {
        /* a round little hand on a round leg, melted together */
        const leg = (al > cb ? Math.hypot(al - cb, sd) : Math.abs(sd)) - LEG, hand = Math.hypot((al - cb) / 1.08, sd) - HAND;
        dist = smin(leg, hand, 6);
        return dist > 0 ? -1 : al < -6 ? 0 : 1;
      };
      const fw = cw / 2, fh = ch / 2;
      /* the box the paw and its foreleg can cover */
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const al of [-p.leg - 1, 16]) for (const sd of [-11.5, 11.5]) {
        const x = cx + ux * al * ka + vx * sd * ks, y = cy + uy * al * ka + vy * sd * ks;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      const i0 = Math.max(0, Math.floor(x0 / fw)), i1 = Math.min(Math.ceil(vw / fw), Math.ceil(x1 / fw));
      const j0 = Math.max(0, Math.floor(y0 / fh)), j1 = Math.min(Math.ceil(vh / fh), Math.ceil(y1 / fh));
      const nc = i1 - i0 + 1, nr = j1 - j0 + 1;
      if (nc <= 0 || nr <= 0) return;
      /* Each cell takes the part under its samples; a cell only partly covered is drawn fainter, so the toes stay round. */
      const g = new Int8Array(nc * nr).fill(-1), A = new Float32Array(nc * nr), C = new Float32Array(nc * nr);
      const reachCell = 0.6 * Math.hypot(fw, fh) / Math.min(ka, ks) + 0.3;
      const alOf = (x, y) => ((x - cx) * ux + (y - cy) * uy) / ka, sdOf = (x, y) => ((x - cx) * vx + (y - cy) * vy) / ks;
      for (let j = 0; j < nr; j++) for (let i = 0; i < nc; i++) {
        const x = (i0 + i) * fw, y = (j0 + j) * fh, ac = alOf(x + fw / 2, y + fh / 2);
        A[j * nc + i] = ac;
        if (ac < -p.leg - 1 || ac > 17 || Math.abs(sdOf(x + fw / 2, y + fh / 2)) > 13) continue;
        /* a cell well inside or outside needs no more samples than its centre */
        const vc = part(ac, sdOf(x + fw / 2, y + fh / 2));
        if (Math.abs(dist) > reachCell) { g[j * nc + i] = vc; C[j * nc + i] = vc >= 0 ? 1 : 0; continue; }
        let n = 0, top = -1;
        for (let q = 1; q < 6; q += 2) for (let r = 1; r < 6; r += 2) {
          const sx = x + q / 6 * fw, sy = y + r / 6 * fh, v = part(alOf(sx, sy), sdOf(sx, sy));
          if (v >= 0) { n++; if (top < 0 || v > 1) top = v; }
        }
        g[j * nc + i] = n >= 5 ? top : n ? -2 : -1;
        C[j * nc + i] = n / 9;
      }
      const at = (i, j) => i < 0 || j < 0 || i >= nc || j >= nr ? -1 : Math.max(-1, g[j * nc + i]);
      const wl = sink > 0 ? tipOf(pose) + 2 - 8 * sink : Infinity, halfU = 0.5 * (Math.abs(ux) * fw + Math.abs(uy) * fh) / ka;
      /* the foreleg fades out toward the bank the cat sits on */
      const fade = al => al < -8 ? Math.max(0, 1 - (-8 - al) / (p.leg - 8)) ** 1.5 : 1;
      /* The shadow falls on the water, offset more while the paw is high. */
      const sx = fw * (2 + Math.round(h * 8)), sy = fh * (2 + Math.round(h * 6));
      ctx.globalAlpha = (P.dark ? 0.5 : 0.24) * (1 - 0.5 * h) * seen;
      ctx.fillStyle = P.dark ? "#000" : css(pack(mul(P.water, 0.55)));
      ctx.beginPath();
      for (let j = 0; j < nr; j++) for (let i = 0; i < nc; i++) {
        const v = g[j * nc + i], al = A[j * nc + i];
        if (v >= 0 && fade(al) > 0.4 && al < wl) ctx.rect((i0 + i) * fw + sx, (j0 + j) * fh + sy, fw, fh);
      }
      ctx.fill();
      const fur = P.dark ? [16, 18, 21] : [16, 15, 14], tex = P.dark ? [44, 49, 54] : [54, 50, 46], rim = P.dark ? [150, 160, 166] : [85, 80, 74];
      /* On dark water the fur catches a little light along its edge, or the paw would vanish. Toes under the surface are seen through the water. */
      const lit = P.dark ? mixC(fur, rim, 0.22) : fur;
      const wet = [fur, rim, lit].map(c => css(pack(mixC(c, P.water, 0.3)))), dry = [fur, rim, lit].map(c => css(pack(c)));
      const texC = css(pack(tex)), dot = css(pack(P.dot));
      /* cell edges on whole device pixels, so faint cells do not overlap into a grid */
      const px = (n, s) => Math.round(n * s * dpr) / dpr;
      ctx.font = `600 ${(fh * 0.8).toFixed(1)}px ${MONO}`;
      /* The plain fur goes down first in one fill; the cells around it and their glyphs follow. */
      const solid = new Path2D(), marks = [];
      for (let j = 0; j < nr; j++) for (let i = 0; i < nc; i++) {
        const v = g[j * nc + i], al = A[j * nc + i], under = al > wl, f = fade(al);
        if (v === -1 || f <= 0) continue;
        const x = px(i0 + i, fw), y = px(j0 + j, fh), w = px(i0 + i + 1, fw) - x, hh = px(j0 + j + 1, fh) - y;
        const [furC, rimC, litC] = under ? wet : dry;
        const ns = [at(i - 1, j), at(i + 1, j), at(i, j - 1), at(i, j + 1)];
        const edge = ns.some(n => n < 0);
        if (v === -2) { ctx.globalAlpha = C[j * nc + i] * 1.3 * f * seen; ctx.fillStyle = furC; ctx.fillRect(x, y, w, hh); continue; }
        if (!under && f === 1 && !edge) solid.rect(x, y, w, hh);
        else { ctx.globalAlpha = (under ? 0.8 : 1) * f * seen; ctx.fillStyle = edge ? litC : furC; ctx.fillRect(x, y, w, hh); }
        const gx = x + fw / 2, gy = y + fh / 2;
        if (sink > 0 && Math.abs(al - wl) < halfU) marks.push(0.7, dot, "~", gx, gy);
        else if (edge) marks.push((P.dark ? 0.9 : 0.55) * f, rimC, ":", gx, gy);
        else if (!under && ((i0 + i) * 7 + (j0 + j) * 13) % 4 === 0) marks.push(0.45 * f, texC, (i0 + i + j0 + j) % 3 ? "#" : "%", gx, gy);
      }
      ctx.globalAlpha = seen; ctx.fillStyle = dry[0]; ctx.fill(solid);
      for (let m = 0; m < marks.length; m += 5) { ctx.globalAlpha = marks[m] * seen; ctx.fillStyle = marks[m + 1]; ctx.fillText(marks[m + 2], marks[m + 3], marks[m + 4]); }
      /* The four toes are only four faint arcs along the tip. */
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(0.8, 0.11 * k);
      ctx.strokeStyle = dry[1];
      for (const th of TOES) {
        const c = Math.cos(th), n = Math.sin(th), al = cb + ring * c * 1.08, sd = ring * n;
        const x = cx + ux * al * ka + vx * sd * ks, y = cy + uy * al * ka + vy * sd * ks, phi = Math.atan2(uy * c + vy * n, ux * c + vx * n);
        ctx.globalAlpha = (al + toe > wl ? 0.3 : 0.5) * seen;
        ctx.beginPath(); ctx.arc(x, y, toe * k, phi - 1.05, phi + 1.05); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    /* Drops in flight: the shadow parts from the drop and closes in again as it lands. */
    function rasterDrops() {
      for (const d of drops) {
        const u = (t - d.born) / d.dur;
        if (u < 0 || u >= 1) continue;
        const x = lerp(d.x0, d.x1, u), y = lerp(d.y0, d.y1, u), hh = 4 * u * (1 - u);
        const c = Math.floor(x / cw), r = Math.floor(y / ch), i = r * cols + c;
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
        if (!tileA[i] && !glyphA[i]) touched.push(i);
        glyphRGB[i] = pack(P.dot); glyphA[i] = 0.9; glyphCode[i] = (hh > 0.4 ? "o" : ".").charCodeAt(0);
        const sc = Math.round(hh * 3), sr = Math.round(hh * 2), si = (r + sr) * cols + (c + sc);
        if ((sc || sr) && r + sr < rows && c + sc < cols) shade[si] = Math.max(shade[si], P.dark ? 0.35 : 0.18);
      }
    }
    /* Rings spreading from the dip: the first drawn with glyphs along the ring, a fainter second one behind it. A landing drop or pellet makes one small ring. */
    function ringAt(px, py) {
      let best = null;
      for (const g of rings) {
        const age = t - g.born, life = 1 - age / (g.tiny ? 0.7 : g.small ? DROP_LIFE : RING_LIFE);
        if (life <= 0 || age < 0) continue;
        const dx = px - g.x, dy = py - g.y, d = Math.hypot(dx, dy);
        for (let j = 0; j < (g.small ? 1 : 2); j++) {
          const ag = age - j * 0.38;
          if (ag <= 0) continue;
          const R = (g.small ? ag * 34 + 4 : ag * 74 + 26) * g.k;
          if (Math.abs(d - R) > cw * 0.62) continue;
          const a = life ** 1.5 * (j ? 0.32 : g.tiny ? 0.28 : g.small ? 0.45 : 0.62);
          if (!best || a > best.a) best = { a, g: j || g.tiny ? "·" : lineGlyph(-dy, dx) };
        }
      }
      return best;
    }

    /* ── fish food ── */
    /* A handful tossed at (x, y): ten or so pellets spray out from the hand and land around it. */
    function feed(x, y) {
      if (!water(x, y)) return false;
      const k = K, seed = (Math.round(t * 1000) * 7919) ^ (Math.round(x) * 31 + Math.round(y) * 17);
      const n = 10 + Math.floor(h2(seed, 1) * 5);
      for (let j = 0; j < n; j++) {
        const a = h2(seed, j * 3 + 2) * Math.PI * 2, d = (12 + 46 * Math.sqrt(h2(seed, j * 3 + 3))) * k;
        const tx = clamp(x + Math.cos(a) * d, 6, vw - 6), ty = clamp(y + Math.sin(a) * d * 0.8, 6, vh - 6);
        const born = t + j * 0.012, dur = 0.28 + 0.2 * h2(seed, j * 3 + 4);
        food.push({ x0: x, y0: y, x: tx, y: ty, born, land: born + dur, seed: seed + j * 131, landed: false, eaten: -1, claim: 0 });
      }
      while (food.length > 90) food.shift();
      return true;
    }
    function stepFood(dt) {
      for (const p of food) {
        if (!p.landed && t >= p.land) { p.landed = true; rings.push({ x: p.x, y: p.y, born: t, k: K * 0.45, small: true, tiny: true }); stamp(p.x, p.y, 1, 0.25); }
        /* a floating pellet drifts a little on the surface */
        if (p.landed && p.eaten < 0) { p.x += Math.sin(t * 0.6 + p.seed) * 2.4 * K * dt; p.y += Math.cos(t * 0.45 + p.seed * 1.3) * 1.6 * K * dt; }
      }
      for (let j = food.length - 1; j >= 0; j--) {
        const p = food[j];
        if ((p.eaten >= 0 && t - p.eaten > 0.05) || (p.landed && t - p.land > FLOAT + SINKING)) food.splice(j, 1);
      }
      for (let j = bubbles.length - 1; j >= 0; j--) if (t - bubbles[j].born > 0.75) bubbles.splice(j, 1);
    }
    /* A pellet is a small warm-brown block with a lighter top edge and a shadow on the water. In the air it is bigger and its shadow lags behind. */
    function drawFood() {
      if (!food.length && !bubbles.length) return;
      const px = v => Math.round(v * dpr) / dpr;
      const body = css(pack(P.food)), top = css(pack(mixC(P.food, [255, 236, 200], 0.35))), shadow = P.dark ? "#000" : css(pack(mul(P.water, 0.5)));
      const pw = cw * 0.62, ph = ch * 0.48;
      for (const p of food) {
        if (t < p.born || p.eaten >= 0) continue;
        let x = p.x, y = p.y, hh = 0, a = 1, big = 1;
        if (!p.landed) { const u = clamp((t - p.born) / (p.land - p.born), 0, 1); x = lerp(p.x0, p.x, u); y = lerp(p.y0, p.y, u); hh = 4 * u * (1 - u); big = 1 + 0.9 * (1 - u); }
        else {
          const age = t - p.land;
          a = 1 - clamp((age - FLOAT) / SINKING, 0, 1);
          /* bobs as it lands */
          hh = age < 0.3 ? 0.25 * Math.sin(age / 0.3 * Math.PI) : 0;
        }
        const w = pw * big, h = ph * big, X = px(x - w / 2), Y = px(y - h / 2);
        ctx.globalAlpha = a * (P.dark ? 0.55 : 0.28);
        ctx.fillStyle = shadow;
        ctx.fillRect(px(X + pw * (0.7 + hh * 5)), px(Y + ph * (0.8 + hh * 4)), px(w), px(h));
        ctx.globalAlpha = a * (p.landed && t - p.land > FLOAT * 0.6 ? 0.85 : 1);
        ctx.fillStyle = body;
        ctx.fillRect(X, Y, px(w), px(h));
        ctx.fillStyle = top;
        ctx.fillRect(X, Y, px(w), px(Math.max(1, h * 0.34)));
      }
      /* a gulp leaves bubbles: o, then °, then a dot */
      if (bubbles.length) {
        ctx.font = `600 ${Math.round(ch * 0.74)}px ${MONO}`;
        ctx.fillStyle = css(pack(P.dot));
        for (const b of bubbles) {
          const u = (t - b.born) / 0.75;
          if (u < 0 || u >= 1) continue;
          ctx.globalAlpha = 0.85 * (1 - u * u);
          ctx.fillText(u < 0.35 ? "o" : u < 0.7 ? "°" : "·", b.x, b.y - u * ch * 0.8);
        }
      }
      ctx.globalAlpha = 1;
    }

    /* Moves the paws, drops, rings and food on by one step. */
    function stepPaws(dt) {
      for (const p of paws) {
        const a = t - p.born;
        if (!p.hit && a >= DIP) splash(p);
        if (a > PULL && a < FLICK - 0.02) stir(p, dt);
        if (!p.flung && a >= FLICK) fling(p);
        /* each shake throws a drop at its widest swing */
        if (p.drips < 3 && a >= SHAKE + 0.3 * (0.12 + p.drips * 0.25)) drip(p, (p.drips++ % 2 ? -1 : 1) * p.side);
      }
      for (let j = paws.length - 1; j >= 0; j--) if (t - paws[j].born >= END) paws.splice(j, 1);
      for (let j = drops.length - 1; j >= 0; j--) {
        const d = drops[j];
        if (t - d.born < d.dur) continue;
        rings.push({ x: d.x1, y: d.y1, born: t, k: d.k, small: true });
        stamp(d.x1, d.y1, 1, 0.5);
        drops.splice(j, 1);
      }
      for (let j = rings.length - 1; j >= 0; j--) if (t - rings[j].born >= (rings[j].tiny ? 0.7 : rings[j].small ? DROP_LIFE : RING_LIFE)) rings.splice(j, 1);
    }

    /* One fixed step of the whole pond. */
    function advance(dt) {
      t += dt;
      step(dt);
      stepPaws(dt);
      stepFood(dt);
    }

    /* ── colours ── */
    function colors() {
      const c = opts.palette();
      const dark = !!c.dark, water = rgb(c.water), accent = rgb(c.accent), light = rgb(c.koiLight), black = rgb(c.koiDark), ink = rgb(c.ink);
      P = {
        dark, water, ink,
        white: dark ? light : mixC(light, [255, 255, 255], 0.4),
        red: dark ? mixC(accent, [232, 92, 52], 0.5) : mixC(accent, [214, 72, 34], 0.7),
        black: dark ? mixC(black, [0, 0, 0], 0.2) : black,
        eye: dark ? [16, 15, 14] : [30, 27, 24],
        /* fins read by value, as grey sharks do: lighter than dark water, darker than light water */
        fin: dark ? mixC(light, water, 0.25) : mixC(water, black, 0.34),
        dot: dark ? light : ink,
        food: dark ? [206, 142, 74] : [150, 92, 40]
      };
      const scheme = (red, white, black) => ({ red, white, black, fin: dark ? mixC(white, water, 0.25) : P.fin });
      P.koi = {
        course: scheme(P.red, P.white, P.black),
        vermilion: scheme([214, 58, 36], [246, 242, 234], [24, 22, 20]),
        gold: scheme([230, 164, 52], [222, 228, 232], [98, 74, 42]),
        sakura: scheme([238, 132, 128], [250, 240, 228], [66, 60, 70])
      };
      /* the swimmers share a skin; one has black hair and a black bikini with a purple cast, the other pale lilac hair and a light blue bikini */
      const skin = dark ? [240, 198, 164] : [226, 176, 138];
      P.swim = [
        { skin, hair: dark ? [44, 37, 58] : [34, 28, 46], suit: dark ? [40, 34, 54] : [32, 27, 44] },
        { skin, hair: dark ? [206, 180, 240] : [184, 152, 222], suit: dark ? [128, 198, 246] : [112, 176, 232] }
      ];
    }

    function render() {
      for (const i of touched) { tileA[i] = 0; glyphA[i] = 0; tintA[i] = 0; }
      touched.length = 0;
      shade.fill(0);
      /* Koi fade under the title and ease back in around it: a clear space for the clock, and the letters take on their colour. */
      const box = opts.dim ? opts.dim() : null, pad = cw * 8;
      const dimAt = box ? (x, y) => {
        const d = Math.hypot(Math.max(box.left - x, 0, x - box.right), Math.max(box.top - y, 0, y - box.bottom));
        return 0.1 + 0.9 * sstep(0, pad, d);
      } : () => 1;
      const order = fish.filter(f => f.seen > 0).sort((a, b) => a.depth - b.depth);
      for (const f of order) rasterize(f, dimAt);
      /* they swim at the surface, over every koi */
      for (const g of swimmers) if (!g.away) rasterSwimmer(g, dimAt);
      rasterDrops();

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = css(pack(P.water));
      ctx.fillRect(0, 0, vw, vh);
      ctx.font = `600 ${Math.round(ch * 0.74)}px ${MONO}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const dot = css(pack(P.dot)), shadeFill = P.dark ? "#000" : css(pack(mul(P.water, 0.55)));
      /* cell edges land on whole device pixels, so tiles stay crisp at any zoom */
      const snap = v => Math.round(v * dpr) / dpr, gap = cw * 0.05, spark = 0.022;
      /*
       * Every rectangle first, then every glyph. Each glyph stays inside its own cell, so the picture is the
       * same as drawing cell by cell, but the GPU gets a few long runs of one kind instead of thousands of switches.
       */
      ctx.fillStyle = shadeFill;
      for (let i = 0; i < shade.length; i++) {
        if (!(shade[i] > 0)) continue;
        const x = (i % cols) * cw, y = ((i / cols) | 0) * ch;
        ctx.globalAlpha = shade[i]; ctx.fillRect(snap(x), snap(y), snap(x + cw) - snap(x), snap(y + ch) - snap(y));
      }
      let fill = -1;
      for (const i of touched) {
        if (!(tileA[i] > 0)) continue;
        const x = (i % cols) * cw, y = ((i / cols) | 0) * ch, x0 = snap(x + gap), y0 = snap(y + gap);
        if (tileRGB[i] !== fill) { fill = tileRGB[i]; ctx.fillStyle = css(fill); }
        ctx.globalAlpha = tileA[i]; ctx.fillRect(x0, y0, snap(x + cw - gap) - x0, snap(y + ch - gap) - y0);
      }
      ctx.fillStyle = dot;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c, x = c * cw + cw / 2, y = r * ch + ch / 2;
          if (tileA[i] > 0 || glyphA[i] > 0) continue;
          if (rings.length) { const g = ringAt(x, y); if (g) { ctx.globalAlpha = g.a; ctx.fillText(g.g, x, y); continue; } }
          const w = wake[i];
          if (w > 0.03) { ctx.globalAlpha = Math.min(0.5, w * 1.2); ctx.fillText(w > 0.25 ? ":" : "·", x, y); continue; }
          /* the caustic net on open water, as faint strokes that drift and fold */
          const cl = caus(x, y);
          if (cl > 0.8) { ctx.globalAlpha = (cl - 0.8) * 1.3; ctx.fillText(cl > 0.94 ? "~" : cl > 0.87 ? "-" : "·", x, y); continue; }
          const h = h2(c, r);
          if (h < spark) { ctx.globalAlpha = 0.1 + 0.12 * (0.5 + 0.5 * Math.sin(t * 0.9 + h * 900)); ctx.fillText("·", x, y); }
        }
      }
      fill = -1;
      for (const i of touched) {
        if (!(glyphA[i] > 0) || glyphCode[i] === 32) continue;
        if (glyphRGB[i] !== fill) { fill = glyphRGB[i]; ctx.fillStyle = css(fill); }
        ctx.globalAlpha = glyphA[i]; ctx.fillText(String.fromCharCode(glyphCode[i]), (i % cols) * cw + cw / 2, ((i / cols) | 0) * ch + ch / 2);
      }
      drawFood();
      for (const p of paws) drawPaw(p);
      ctx.globalAlpha = 1;
    }

    /* From scratch: the shoal, then a few seconds of swimming so it starts in natural curves. */
    function reset() {
      makeFish();
      /* The first swimmer sets out as the pond opens, the second a little later; each differs a little in her stroke. */
      swimmers = Array.from({ length: GIRLS }, (_, i) => ({
        id: i, seed: 211 + i * 57, stroke: STROKE * (1 + 0.08 * i), phase: 0, trip: 0, away: true, back: i * 18,
        nx: -1, ny: 0.5, x: -1e5, y: -1e5, a: 0, turn: 0, lane: 0.5, right: true, sway: 0,
        /* floating: where on her way she will stop to, whether she does now, until when, and how far she has rolled onto her back */
        rest: -1, floating: false, floatUntil: 0, fl: 0
      }));
      paws.length = rings.length = drops.length = food.length = bubbles.length = 0;
      wake.fill(0); wakeTmp.fill(0);
      t = 0;
      const n = count();
      fish.forEach((f, i) => { f.seen = i < n ? 1 : 0; });
      for (let j = 0; j < 90; j++) { t += 1 / 30; step(1 / 30); }
      simT = 0; planAt = 0;
    }

    /* Film mode: the pond at film time T, stepped forward in fixed steps; the same T always gives the same frame. draw = false only steps it. */
    function seek(T, draw = true) {
      if (!fish.length || T < simT - 1e-6) reset();
      while (simT + STEP <= T + 1e-6) {
        simT += STEP;
        while (planAt < plan.length && plan[planAt].at <= simT + 1e-6) plan[planAt++].fn();
        advance(STEP);
      }
      if (draw) render();
    }

    /*
     * Live mode: one animation frame. The pond moves at the display's rate and
     * draws a frame at most every 12 ms: a 60 Hz screen gets every frame, a
     * 120 Hz screen every other one. A slow machine simply gets fewer frames
     * from the browser; the time a draw call takes is no guide, as it includes
     * waiting for the GPU to finish the frame before.
     */
    let last = 0, drawn = 0, running = false, dirty = true;
    function frame(now) {
      if (!running) return;
      requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      const moving = !paused && !reduce;
      if (moving && dt > 0) advance(dt);
      if (!moving && !dirty) return;
      if (now - drawn < 12 && !dirty) return;
      dirty = false;
      drawn = now;
      render();
    }

    return {
      size(w, h) { size(w, h); colors(); dirty = true; },
      colors() { colors(); dirty = true; },
      reset,
      start() {
        reset();
        running = true;
        requestAnimationFrame(now => { last = now; frame(now); });
      },
      stop() { running = false; },
      seek,
      /* film events: at simulation time `at`, run fn */
      at(at, fn) { plan.push({ at, fn }); plan.sort((a, b) => a.at - b.at); return this; },
      paw: (x, y) => poke(x, y),
      feed: (x, y) => feed(x, y),
      pause(v) { paused = v === undefined ? !paused : !!v; dirty = true; return paused; },
      get paused() { return paused; },
      get time() { return t; },
      /* for tests: the koi, the food and the swimmers (those with away set are out of the pond) */
      get fish() { return fish; },
      get food() { return food; },
      get swimmers() { return swimmers; },
      render() { render(); },
      /* The colour of the koi under canvas point (x, y), as [r, g, b, weight], or null: the title takes it on. */
      tint(x, y) {
        const c = Math.floor(x / cw), r = Math.floor(y / ch), i = r * cols + c;
        if (c < 0 || r < 0 || c >= cols || r >= rows || !(tintA[i] > 0)) return null;
        const n = tintRGB[i];
        return [n >> 16, (n >> 8) & 255, n & 255, tintA[i]];
      },
      /* The water's light at canvas point (x, y), 0 to 1, from the caustic net: the title catches it as it plays over. */
      light: (x, y) => caus(x, y)
    };
  }

  /*
   * A word drawn in character cells like the koi. The letters are sampled from
   * the real font outline. A cell the outline crosses gets a stroke along it
   * (| / - \, from the coverage gradient), moved a little toward the ink, so
   * the contour reads as one clean line; a cell inside a stroke is a tile with
   * a glyph pressed into it in the water's colour. A koi passing under takes
   * the cell to its colour, and where the caustic net crosses, the cell
   * brightens. A blurred glow canvas behind the letters carries that light.
   * A new word is unveiled from left to right: each cell flickers through
   * random glyphs, settles, and lands with a short flash. When the text changes
   * (the clock ticks), a wave runs down the word and only the cells that
   * changed are redrawn; until it reaches them they keep the old letter.
   *
   * spec() returns { text, font, cw, ch, maxW, tone, edge, glow, fixed, beat }.
   * fixed gives every digit a slot as wide as the widest, so a clock keeps its
   * grid from minute to minute; beat is a character that pulses with the
   * seconds (a clock's colon). look.tint(x, y)
   * and look.light(x, y) give the koi colour and the water's light under a cell
   * centre, in viewport pixels (a full-window pond's own). The colours are read from CSS:
   * --title-from, --title-to (left to right), --title-glow and --pond.
   */
  function AsciiMark(canvas, spec, look = {}) {
    const ctx = canvas.getContext("2d");
    const NOISE = "/\\|=+*%#@", EDGE = " |/-\\";
    let cols = 0, rows = 0, cw = 6, ch = 8, born = null;
    /* the word as it is, and as it was before the last change: coverage, outline strokes and their offsets */
    let cur = null, was = null;
    /* the columns of the beating character, and until when cells are still settling */
    let beat = null, busyUntil = 0;
    let tone = 1, glowK = 0, ready = false, dpr = 1, glow = null, gctx = null, gimg = null;
    /* the glyphs of one frame, drawn after the tiles */
    const Q = { g: [], x: [], y: [], a: [], f: [] };
    async function build(now) {
      const o = spec();
      cw = o.cw; ch = o.ch; tone = o.tone || 1; glowK = o.glow || 0;
      try { await document.fonts.load(o.font, o.text); } catch (e) { /* draw with the fallback font */ }
      const m = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
      m.font = o.font;
      /* where each character starts: as the font sets them, or with every digit centred in a slot of one width */
      const chars = [...o.text], at = [];
      const slot = o.fixed ? Math.max(...[..."0123456789"].map(d => m.measureText(d).width)) : 0;
      let run = 0;
      for (const c of chars) { const w = m.measureText(c).width, a = slot && c >= "0" && c <= "9" ? slot : w; at.push(run + (a - w) / 2); run += a; }
      /* fixed digits are measured against all ten, so the height does not change with the time either */
      const met = m.measureText(o.fixed ? "0123456789" + o.text : o.text);
      const asc = Math.ceil(met.actualBoundingBoxAscent), desc = Math.ceil(met.actualBoundingBoxDescent);
      const left = o.fixed ? 0 : Math.ceil(met.actualBoundingBoxLeft), tw = o.fixed ? Math.ceil(run) : Math.ceil(met.actualBoundingBoxLeft + met.actualBoundingBoxRight);
      const pad = Math.ceil(asc * (o.fixed ? 0.08 : 0.05)), mw = Math.max(1, tw + pad * 2), mh = Math.max(1, asc + desc + pad * 2);
      m.canvas.width = mw; m.canvas.height = mh;
      m.font = o.font; m.fillStyle = "#000";
      if (o.fixed) chars.forEach((c, j) => m.fillText(c, pad + at[j], pad + asc));
      else m.fillText(o.text, pad + left, pad + asc);
      const data = m.getImageData(0, 0, mw, mh).data;
      const s = Math.min(1, o.maxW / mw);
      const nc = Math.ceil(mw * s / cw), nr = Math.ceil(mh * s / ch);
      /* a window with no width yet (a hidden or prerendered tab): nothing to draw until it is resized */
      if (!nc || !nr) { ready = false; return; }
      const bi = o.beat ? chars.indexOf(o.beat) : -1;
      if (bi >= 0) {
        const x0 = pad + left + (o.fixed ? at[bi] : m.measureText(chars.slice(0, bi).join("")).width);
        beat = [Math.round(x0 * s / cw), Math.round((x0 + m.measureText(o.beat).width) * s / cw) - 1];
      } else beat = null;
      const next = new Float32Array(nc * nr);
      for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
        let a = 0;
        for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
          const px = Math.min(mw - 1, ((c + (i + 0.5) / 3) * cw / s) | 0), py = Math.min(mh - 1, ((r + (j + 0.5) / 3) * ch / s) | 0);
          a += data[(py * mw + px) * 4 + 3];
        }
        next[r * nc + c] = a / (9 * 255);
      }
      if (cur && nc === cols && nr === rows) {
        /* the same grid: only cells that changed settle again, as a wave runs down the word; until then they show the old letter */
        was = cur;
        for (let i = 0; i < next.length; i++) if (Math.abs(next[i] - cur.cov[i]) > 0.08) born[i] = now + ((i / nc) | 0) / nr * 0.4 + h2(i, 5) * 0.1;
      } else {
        /* a new word is unveiled from left to right */
        was = null;
        born = new Float32Array(nc * nr);
        for (let i = 0; i < born.length; i++) born[i] = now + (i % nc) / nc * 0.55 + h2(i, 5) * 0.25;
      }
      busyUntil = now + 2;
      cols = nc; rows = nr;
      const cov = next;
      /* the outline: a stroke by the direction of the coverage gradient; thin serif hairlines keep theirs down to 6 % coverage */
      let edge = null, ex = null, ey = null;
      if (o.edge) {
        edge = new Uint8Array(cols * rows); ex = new Float32Array(cols * rows); ey = new Float32Array(cols * rows);
        const at = (c, r) => c < 0 || r < 0 || c >= cols || r >= rows ? 0 : cov[r * cols + c];
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const i = r * cols + c, v = cov[i];
          if (v < 0.06 || v >= 0.62) continue;
          const gx = (at(c + 1, r - 1) + 2 * at(c + 1, r) + at(c + 1, r + 1) - at(c - 1, r - 1) - 2 * at(c - 1, r) - at(c - 1, r + 1)) / cw;
          const gy = (at(c - 1, r + 1) + 2 * at(c, r + 1) + at(c + 1, r + 1) - at(c - 1, r - 1) - 2 * at(c, r - 1) - at(c + 1, r - 1)) / ch;
          const n = Math.hypot(gx, gy);
          if (n * Math.min(cw, ch) < 0.4) continue;
          let a = Math.atan2(gy, gx) * 180 / Math.PI;
          if (a < 0) a += 180;
          edge[i] = a < 22.5 || a >= 157.5 ? 1 : a < 67.5 ? 2 : a < 112.5 ? 3 : 4;
          const k = (0.5 - v) * 0.7;
          ex[i] = gx / n * k * cw; ey[i] = gy / n * k * ch;
        }
      }
      cur = { cov, edge, ex, ey };
      dpr = Math.min(4, global.devicePixelRatio || 1);
      /* Setting a canvas's size clears it, even to the size it has: only when it changes, or every tick of the clock would blank the word until the next draw. */
      const W = Math.round(cols * cw * dpr), H = Math.round(rows * ch * dpr);
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      canvas.style.width = cols * cw + "px"; canvas.style.height = rows * ch + "px";
      /* the glow: one pixel per cell in the light the letters take on; CSS blurs it behind them */
      if (glowK && !glow) {
        glow = document.createElement("canvas");
        glow.className = "mark-glow"; glow.setAttribute("aria-hidden", "true");
        canvas.before(glow);
        gctx = glow.getContext("2d");
      }
      if (glow) {
        if (glow.width !== cols || glow.height !== rows || !gimg) { glow.width = cols; glow.height = rows; gimg = gctx.createImageData(cols, rows); }
        glow.style.width = cols * cw + "px"; glow.style.height = rows * ch + "px";
      }
      ready = true;
      /* the new word at once, so no frame shows the canvas as its new size left it */
      draw(now);
    }
    function draw(now) {
      if (!ready) return;
      const cs = getComputedStyle(canvas);
      const from = rgb(cs.getPropertyValue("--title-from")), to = rgb(cs.getPropertyValue("--title-to")), water = cs.getPropertyValue("--pond").trim();
      const gv = parseFloat(cs.getPropertyValue("--title-glow")), gk = glowK * (isNaN(gv) ? 1 : gv);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cols * cw, rows * ch);
      if (glow) { glow.style.left = canvas.offsetLeft + "px"; glow.style.top = canvas.offsetTop + "px"; gimg.data.fill(0); }
      ctx.font = `700 ${(ch * (cur.edge ? 0.95 : 1.1)).toFixed(1)}px ${MONO}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const snap = v => Math.round(v * dpr) / dpr, gap = cw * 0.06, G = gimg ? gimg.data : null, tick = Math.floor(now * 24);
      /* the beat: brightest on the second, fading between */
      const pulse = beat ? 0.6 + 0.4 * (0.5 + 0.5 * Math.cos(Date.now() % 1000 / 1000 * 2 * Math.PI)) : 1;
      /* where each cell is on screen, to find the koi under it */
      const box = look.tint || look.light ? canvas.getBoundingClientRect() : null, sx = box ? box.width / (cols * cw) : 1, sy = box ? box.height / (rows * ch) : 1;
      /* the tiles are drawn as they come and the glyphs queued, then drawn in one run (as in the pond) */
      let n = 0;
      const glyph = (g, x, y, a, fill) => { Q.g[n] = g; Q.x[n] = x; Q.y[n] = y; Q.a[n] = a; Q.f[n] = fill; n++; };
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c, h = h2(c + 7, r + 3), x = c / cols, age = now - born[i], settle = 0.18 + h * 0.3;
        /* a cell the wave has not reached yet still shows the old letter, or nothing in a new word */
        if (age < 0 && !was) continue;
        const w0 = age < 0 ? was : cur, v = w0.cov[i], e = w0.edge ? w0.edge[i] : 0, none = v < (e ? 0.06 : 0.12);
        if (age >= 0 && age < settle) {
          /* settling: a cell that takes ink flickers up to it, one that loses its ink flickers out */
          if (none && !(was && was.cov[i] >= 0.12)) continue;
          const u = age / settle;
          glyph(NOISE[(h2(i, tick) * NOISE.length) | 0], c * cw + cw / 2, r * ch + ch / 2, tone * (none ? 0.6 * (1 - u) : 0.25 + 0.5 * u), css(pack(mixC(from, to, x))));
          continue;
        }
        if (none) continue;
        /* just settled, a cell flashes in the title's strongest colour and its glow swells */
        const F = age >= settle ? clamp(1 - (age - settle) / 0.4, 0, 1) ** 2 : 0;
        const tn = tone * (beat && c >= beat[0] && c <= beat[1] ? pulse : 1);
        const px = box ? box.left + (c + 0.5) * cw * sx : 0, py = box ? box.top + (r + 0.5) * ch * sy : 0;
        const k = look.tint && look.tint(px, py), w = k ? Math.min(1, k[3] * 1.15) : 0;
        const l = look.light ? clamp((look.light(px, py) - 0.72) / 0.28, 0, 1) : 0, L = l * l * (3 - 2 * l);
        const col = from.map((f, j) => {
          let n = f + (to[j] - f) * x;
          if (k) n += (k[j] - n) * w;
          n += (255 - n) * 0.45 * L;
          return n + (f - n) * 0.75 * F;
        });
        const fill = css(pack(col));
        if (e) glyph(EDGE[e], c * cw + cw / 2 + w0.ex[i], r * ch + ch / 2 + w0.ey[i], tn * Math.min(1, 0.5 + v + 0.3 * L + 0.3 * F), fill);
        else if (v >= 0.62) {
          /* inside a stroke: a tile like the koi's, with a glyph pressed into it in the water's colour */
          ctx.globalAlpha = tn * Math.min(1, 0.68 + 0.27 * Math.min(1, (v - 0.62) / 0.3) + 0.1 * w + 0.12 * L + 0.2 * F);
          ctx.fillStyle = fill;
          const x0 = snap(c * cw + gap), y0 = snap(r * ch + gap);
          ctx.fillRect(x0, y0, snap((c + 1) * cw - gap) - x0, snap((r + 1) * ch - gap) - y0);
          glyph(v > 0.9 ? (h < 0.5 ? "#" : "@") : "%", c * cw + cw / 2, r * ch + ch / 2, 0.24 * tn, water);
        } else glyph(v > 0.32 ? "+" : ":", c * cw + cw / 2, r * ch + ch / 2, tn * 0.85, fill);
        if (G) {
          const q = i * 4, ga = gk * tn * (v >= 0.62 ? 1 : v) * (0.16 + 0.6 * w + 0.32 * L + 0.7 * F);
          G[q] = col[0]; G[q + 1] = col[1]; G[q + 2] = col[2]; G[q + 3] = Math.min(255, ga * 255);
        }
      }
      let fill = "";
      for (let j = 0; j < n; j++) {
        if (Q.f[j] !== fill) { fill = Q.f[j]; ctx.fillStyle = fill; }
        ctx.globalAlpha = Q.a[j]; ctx.fillText(Q.g[j], Q.x[j], Q.y[j]);
      }
      ctx.globalAlpha = 1;
      if (glow) gctx.putImageData(gimg, 0, 0);
    }
    /* busy(now): cells are still settling, so the word wants drawing more often than a settled one */
    return { build, draw, busy: now => now < busyUntil, get glow() { return glow; }, get size() { return { w: cols * cw, h: rows * ch }; } };
  }

  global.AsciiKoi = { createPond, AsciiMark, seeded };
})(typeof window !== "undefined" ? window : globalThis);

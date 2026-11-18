/*
 * The page around the pond: the clock and the day (or your own words) in
 * character cells, the date under them, the three waters, and the controls.
 *
 *   ?theme=pond|black|light    the water (remembered when you switch)
 *   ?title=One%20Page&tag=is%20all%20you%20need   your own words instead of the clock
 *   ?ui=0                       no controls (for a wallpaper or a recording)
 *   ?swimmers=0                 the koi alone, without the girls who swim through the pond (1: only one of them)
 *   ?fact=0                     no line of the day under the date
 *   ?key=…                      an API Ninjas key: kept in this browser, and the line takes turns between a fact and a quote (?key= forgets it)
 *   config.js                   the same key kept in a file of your own instead (see config.example.js)
 *   keys: 1 2 3 or T for the water, space to pause
 */
(() => {
  "use strict";
  const { createPond, AsciiMark } = window.AsciiKoi;
  const root = document.documentElement;
  const q = new URLSearchParams(location.search);
  const THEMES = ["pond", "black", "light"];
  const KEY = "ascii-koi-theme";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private window: not remembered */ } }
  };

  /* the water: the URL, then a page that fixes it (light.html …), then the last one chosen, then the pond */
  const fixed = root.dataset.lock;
  const first = [q.get("theme"), fixed, store.get(), "pond"].find(v => THEMES.includes(v));
  root.dataset.theme = first;

  const pondCanvas = document.getElementById("pond");
  const box = document.getElementById("intro-box");
  const titleCanvas = document.getElementById("wordmark");
  const tagCanvas = document.getElementById("wordmark-tag");
  const srTitle = document.getElementById("sr-title");
  const dateLine = document.getElementById("intro-date");
  const factLine = document.getElementById("intro-fact");
  const ui = document.getElementById("ui");
  if (q.get("ui") === "0") ui.hidden = true;
  if (location.protocol === "chrome-extension:") document.getElementById("gh")?.remove();

  const cssVar = n => getComputedStyle(root).getPropertyValue(n).trim();
  const palette = () => ({
    water: cssVar("--pond"), ink: cssVar("--ink"), accent: cssVar("--accent"),
    koiLight: cssVar("--koi-light"), koiDark: cssVar("--koi-dark"),
    dark: cssVar("color-scheme").includes("dark")
  });

  const pond = createPond({
    canvas: pondCanvas, palette, reduce, swimmers: q.has("swimmers") ? q.get("swimmers") : 2,
    /* the box of the title, and of the fact under it, in pond pixels: the koi fade under it, so the letters can wear their colour */
    dim: () => {
      const r = box.getBoundingClientRect();
      if (!r.width) return null;
      const f = factLine && factLine.childElementCount ? factLine.getBoundingClientRect() : null;
      return f && f.height ? { left: Math.min(r.left, f.left), right: Math.max(r.right, f.right), top: r.top, bottom: Math.max(r.bottom, f.bottom) } : r;
    }
  });
  pond.size(innerWidth, innerHeight);
  window.AsciiKoi.pond = pond;

  /* ── the words: the time as the title, the day under it, then the date, all in German ── */
  const own = q.get("title");
  const narrow = () => innerWidth < 720;
  const words = () => {
    const now = new Date();
    const date = now.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
    if (own) return { title: own, tag: q.get("tag") || "", date };
    const time = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", hour12: false });
    return { title: time, tag: now.toLocaleDateString("de-DE", { weekday: "long" }), date };
  };
  let current = words();
  const serif = `"Noto Serif Display", "Iowan Old Style", Georgia, serif`;
  /* the words take on the koi colour and the water's light in the pond under them */
  const look = { tint: pond.tint, light: pond.light };
  /* the clock's digits keep their places, so a minute only redraws the digit that changed, and its colon beats with the seconds */
  const title = AsciiMark(titleCanvas, () => ({
    text: current.title, font: `700 ${narrow() ? 120 : own ? 170 : 230}px ${serif}`,
    cw: narrow() ? 4 : 7, ch: narrow() ? 5 : 9, maxW: Math.min(innerWidth * (narrow() ? 0.9 : 0.8), own ? 700 : 820), edge: true, glow: 1,
    fixed: !own, beat: own || reduce ? null : ":"
  }), look);
  /* the day, drawn the same way as the clock, smaller and a little fainter */
  const tag = AsciiMark(tagCanvas, () => ({
    text: current.tag || " ", font: `700 ${narrow() ? 64 : 84}px ${serif}`,
    cw: narrow() ? 3 : 4, ch: narrow() ? 4 : 5, maxW: Math.min(innerWidth * (narrow() ? 0.66 : 0.42), 420), tone: 0.88, edge: !narrow(), glow: 0.7
  }), look);
  const clock = () => performance.now() / 1000;
  const buildWords = () => {
    dateLine.textContent = current.date;
    return Promise.all([title.build(clock()), tag.build(clock() + 0.35)]);
  };
  srTitle.textContent = own ? `${current.title} ${current.tag}` : "ASCII Koi";

  /*
   * A line a day under the date. Without a key it is a fun fact in German (uselessfacts). With an
   * API Ninjas key it takes turns with a quote, one day each; the quotes come in English, from life,
   * wisdom and success, one of them a day. The key is given once in the URL (?key=…): it is kept in
   * this browser and taken out of the address bar, so a new tab finds it too; ?key= with nothing
   * forgets it. One request a day, and the answer is kept for the day; a key the API turns down gives
   * the fact instead. Offline, or with ?fact=0 or your own words, the line simply stays away. The text
   * is broken into lines here, so each line is an element of its own that the change of water can redraw.
   */
  const LINE_KEY = "ascii-koi-fact", NINJAS_KEY = "ascii-koi-ninjas-key";
  const FACT_URL = "https://uselessfacts.jsph.pl/api/v2/facts/today?language=de";
  const QUOTE_URL = "https://api.api-ninjas.com/v2/randomquotes?categories=", QUOTE_TOPICS = ["life", "wisdom", "success"];
  const kept = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* private window: not kept */ } }
  };
  if (q.has("key")) {
    kept.set(NINJAS_KEY, q.get("key").trim().slice(0, 128));
    q.delete("key");
    const rest = q.toString();
    history.replaceState(history.state, "", location.pathname + (rest ? "?" + rest : "") + location.hash);
  }
  const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  /* days counted from 1970 in local time, for taking turns */
  const dayNo = () => { const d = new Date(); return Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 864e5); };
  let shown = null;
  function showLine(text, by) {
    shown = { text, by };
    const width = narrow() ? 34 : 60, lines = [];
    for (const w of text.replace(/\s+/g, " ").trim().split(" ")) {
      const last = lines.length - 1;
      if (last >= 0 && (lines[last] + " " + w).length <= width) lines[last] += " " + w;
      else lines.push(w);
    }
    if (lines.length > 4) { lines.length = 4; lines[3] = lines[3].slice(0, width - 1).trimEnd() + "…"; }
    if (by) lines.push("— " + by);
    factLine.replaceChildren(...lines.map(l => { const s = document.createElement("span"); s.textContent = l; return s; }));
    factLine.classList.add("show");
  }
  async function getJSON(url, headers) {
    const res = await fetch(url, { headers, credentials: "omit", referrerPolicy: "no-referrer", signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  async function loadLine() {
    if (!factLine || own || q.get("fact") === "0") return;
    /* the key from config.js (your own file, never committed) first, then the one this browser kept from ?key= */
    const conf = window.ASCII_KOI_CONFIG || {}, confKey = typeof conf.ninjasKey === "string" ? conf.ninjasKey.trim() : "";
    const day = dayKey(), n = dayNo(), key = confKey || kept.get(NINJAS_KEY);
    const kind = key && n % 2 === 0 ? "quote" : "fact";
    let last = null;
    try { last = JSON.parse(kept.get(LINE_KEY)); } catch (e) { /* nothing kept */ }
    if (last && last.day === day && last.kind === kind && typeof last.text === "string" && last.text) { showLine(last.text, last.by || ""); return; }
    let line = null;
    if (kind === "quote") {
      try {
        const [one] = await getJSON(QUOTE_URL + QUOTE_TOPICS[n % QUOTE_TOPICS.length], { "X-Api-Key": key });
        const text = String((one && one.quote) || "").trim();
        if (text) line = { text: `“${text}”`, by: String(one.author || "").trim() };
      } catch (e) { /* a key the API turns down, or its quota used up: the fact instead */ }
    }
    if (!line) {
      try {
        const text = String((await getJSON(FACT_URL)).text || "").trim();
        if (text) line = { text, by: "" };
      } catch (e) { /* offline or blocked: no line today */ }
    }
    if (!line) return;
    kept.set(LINE_KEY, JSON.stringify({ day, kind, ...line }));
    showLine(line.text, line.by);
  }

  let lastWords = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    /* the words redraw at about 15 fps, like a sign, and twice as often while their cells are settling; the koi under them move at full rate */
    const s = now / 1000;
    if (now - lastWords < (title.busy(s) || tag.busy(s) ? 30 : 66)) return;
    lastWords = now;
    title.draw(s); tag.draw(s);
    if (!own) {
      const w = words();
      if (w.title !== current.title || w.tag !== current.tag || w.date !== current.date) {
        const newDay = w.date !== current.date;
        current = w; buildWords();
        if (newDay) loadLine();
      }
    }
  }

  /* ── the waters ── */
  const snap = document.getElementById("snap");
  const picks = [...document.querySelectorAll("[data-theme-pick]")];
  function mark() {
    for (const b of picks) b.setAttribute("aria-checked", String(b.dataset.themePick === root.dataset.theme));
  }
  /*
   * A new water spreads like a ripple from where you chose it: the old frame
   * (pond, words and their glow) is kept on a canvas on top, and a widening
   * hole in it shows the new water underneath.
   */
  function setTheme(name, at) {
    if (!THEMES.includes(name) || name === root.dataset.theme) return;
    const dpr = pondCanvas.width / innerWidth;
    if (!reduce) {
      snap.width = pondCanvas.width; snap.height = pondCanvas.height;
      const s = snap.getContext("2d");
      s.drawImage(pondCanvas, 0, 0);
      for (const m of [title, tag]) {
        for (const c of [m.glow, m === title ? titleCanvas : tagCanvas]) {
          const r = c && c.getBoundingClientRect();
          if (!r || !r.width || !c.width) continue;
          s.filter = c === m.glow ? `blur(${14 * dpr}px)` : "none";
          s.drawImage(c, r.left * dpr, r.top * dpr, r.width * dpr, r.height * dpr);
        }
      }
      s.filter = "none";
      /* the date and the lines of the fact, as they stand on the page */
      s.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.textBaseline = "middle";
      for (const el of [dateLine, ...(factLine ? factLine.children : [])]) {
        const r = el.getBoundingClientRect(), ds = getComputedStyle(el);
        if (!r.width) continue;
        s.font = `${ds.fontWeight} ${ds.fontSize} ${ds.fontFamily}`; s.letterSpacing = ds.letterSpacing;
        s.fillStyle = ds.color; s.globalAlpha = +ds.opacity;
        s.fillText(ds.textTransform === "uppercase" ? el.textContent.toUpperCase() : el.textContent, r.left, r.top + r.height / 2);
      }
      s.setTransform(1, 0, 0, 1, 0, 0); s.globalAlpha = 1;
      const x = at ? at.x : innerWidth / 2, y = at ? at.y : innerHeight / 2;
      snap.style.setProperty("--x", x + "px");
      snap.style.setProperty("--y", y + "px");
      snap.classList.remove("wipe");
      snap.classList.add("show");
      void snap.offsetWidth;
      snap.classList.add("wipe");
    }
    root.dataset.theme = name;
    if (!fixed) store.set(name);
    pond.colors();
    mark();
  }
  snap.addEventListener("transitionend", () => snap.classList.remove("show", "wipe"));
  for (const b of picks) b.addEventListener("click", e => {
    const r = b.getBoundingClientRect();
    setTheme(b.dataset.themePick, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    e.stopPropagation();
  });
  mark();

  /* ── the hands ── */
  const onUi = e => e.target.closest && e.target.closest(".ui");
  let held = null, fedAt = 0;
  const feedAt = (x, y) => { const now = performance.now(); if (now - fedAt < 500) return; fedAt = now; pond.feed(x, y); };
  addEventListener("pointerdown", e => {
    if (onUi(e)) return;
    /* a tap is a paw, a long press or left click is food */
    if (e.pointerType === "touch" || e.pointerType === "pen") {
      if (e.button !== 0) return;
      clearTimeout(held?.timer);
      held = { x: e.clientX, y: e.clientY, at: performance.now(), timer: setTimeout(() => { if (held) { feedAt(held.x, held.y); held = null; } }, 450) };
      return;
    }
    if (e.button === 0) feedAt(e.clientX, e.clientY);
    else if (e.button === 1) { e.preventDefault(); pond.paw(e.clientX, e.clientY); }
  });
  addEventListener("pointermove", e => { if (held && Math.hypot(e.clientX - held.x, e.clientY - held.y) > 14) { clearTimeout(held.timer); held = null; } });
  addEventListener("pointerup", () => { if (held) { clearTimeout(held.timer); pond.paw(held.x, held.y); held = null; } });
  addEventListener("pointercancel", () => { if (held) clearTimeout(held.timer); held = null; });
  addEventListener("contextmenu", e => {
    if (onUi(e)) return;
    e.preventDefault();
    if (held) { clearTimeout(held.timer); held = null; }
  });
  addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.("input, textarea")) return;
    const n = "123".indexOf(e.key);
    if (n >= 0) setTheme(THEMES[n]);
    else if (e.key === "t" || e.key === "T") setTheme(THEMES[(THEMES.indexOf(root.dataset.theme) + 1) % 3]);
    else if (e.key === " ") { e.preventDefault(); const p = pond.pause(); document.getElementById("pause-state").textContent = p ? "pausiert" : ""; }
  });

  /* the controls fade out while you leave the mouse alone */
  let idle = 0;
  const wake = () => { ui.classList.remove("idle"); clearTimeout(idle); idle = setTimeout(() => ui.classList.add("idle"), 3500); };
  addEventListener("pointermove", wake);
  addEventListener("keydown", wake);
  wake();

  let resizeTimer = 0;
  addEventListener("resize", () => {
    pond.size(innerWidth, innerHeight);
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { buildWords(); if (shown) showLine(shown.text, shown.by); }, 120);
  });

  pond.start();
  buildWords().then(() => { box.classList.add("go"); requestAnimationFrame(frame); });
  loadLine();
  /* canvas text cannot trigger a webfont load; redraw once the mono face is in */
  document.fonts?.load(`600 12px "Geist Mono"`).then(() => pond.colors());
})();

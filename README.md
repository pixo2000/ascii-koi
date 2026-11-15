# ASCII Koi

**Your new tab is a koi pond.** Up to fourteen koi, drawn entirely in text characters, swimming under a clock made of the same characters. Poke the water with a cat paw. Feed the fish. Watch them race for it.

<p align="center">
  <a href="https://pursurer.github.io/ascii-koi/"><img src="media/hero.gif" alt="ASCII Koi: koi drawn in text characters swim under an ASCII clock; a cat paw scoops the water and the koi race for food" width="100%"></a>
</p>

<p align="center">
  <a href="https://pursurer.github.io/ascii-koi/"><b>▶ Open the live pond</b></a> &nbsp;·&nbsp;
  <a href="#the-film">Watch the film (19 s, 60 fps)</a> &nbsp;·&nbsp;
  <a href="#make-it-your-new-tab">Install as your new tab (30 seconds)</a>
</p>

<!-- family-nav:start -->
<p align="center"><sub>Part of the <a href="#the-ascii-koi-family">ASCII Koi family</a>: <b>ASCII Koi</b> · <a href="https://github.com/pursurer/codex-koi">Codex Koi</a> · <a href="https://github.com/pursurer/claude-koi-backdrop">Koi Backdrop</a> · <a href="https://github.com/pursurer/one-page-is-all-you-need">One Page</a></sub></p>
<!-- family-nav:end -->

## What you can do

| | |
|---|---|
| **Left click** | A black cat paw reaches in from the edge, hooks the water back in two tugs and flicks out a spray of drops. The koi bolt. A moment later the curious ones swim back to look. |
| **Right click** | A handful of fish food. Every pellet lands with its own ring, the hungry koi rise to the surface and race each other to eat. |
| **Tap / hold** | The same on a phone or tablet: tap for the paw, hold for food. |
| **`1` `2` `3` or `T`** | Three waters: **pond** (deep lake teal), **black** and **light**. The new water spreads out like a ripple from where you chose it. |
| **`Space`** | Freeze the pond. |

The clock is not a font. It is the outline of Noto Serif Display sampled into character cells: the contour becomes `| / - \` strokes, the strokes become solid tiles, and every koi that swims underneath tints the digits in its own colours while a caustic light net plays across them.

## The film

https://github.com/user-attachments/assets/1d073920-703d-48bf-ae64-af4edabd486a

19 seconds at 60 fps, rendered frame by frame from `pond.js` itself: the paw, the feeding and the three waters. The full-quality file is in the [latest release](https://github.com/pursurer/ascii-koi/releases/latest).

## Make it your new tab

Chrome, Edge, Brave, Arc and every other Chromium browser:

1. Get the folder: `git clone https://github.com/pursurer/ascii-koi.git` (or **Code → Download ZIP** and unzip it).
2. Open `chrome://extensions` and switch on **Developer mode**.
3. Click **Load unpacked** and pick the `ascii-koi` folder.

Open a new tab. You have a pond.

Any other browser: set your home page to **https://pursurer.github.io/ascii-koi/**.

## Make it yours

| URL | What it does |
|---|---|
| `?theme=pond` · `black` · `light` | Start in that water (your last choice is remembered) |
| `themes/light.html` | A page locked to one water |
| `?title=One%20Page&tag=is%20all%20you%20need` | Your own words instead of the clock |
| `?ui=0` | No controls: a wallpaper, a second screen, a stream background |

## How it works

- **Koi.** Each fish is a chain of ten spine nodes trailing its head, with a travelling body wave. Every character cell is sampled against the nearest point on the spine (plus sub-samples for soft edges), classified as body, fin, eye or barbel, coloured by the fish's own markings (kohaku, sanke, tancho) and shaded by a light from the upper left: lit skin gets sparse glyphs, shadowed skin dense ones. Each koi casts a shadow on the pond floor and leaves a wake.
- **Water.** Two drifting noise fields; where they meet, light gathers in a thin moving net of `· - ~`, and the scales glint `*` where it crosses a back.
- **Deterministic.** For a recording the simulation steps forward in fixed 1/60 s steps, so the same events always give the same frame. The film above was rendered frame by frame from this exact engine with [huashu-motion](https://github.com/alchaincyf/huashu-motion); nothing in it is mocked up.
- **More koi elsewhere.** `createPond({ most })` raises the cap of fourteen for a host that wants a fuller shoal; Codex Koi uses 24.
- **Small.** Vanilla JavaScript, no build step, no dependencies: `pond.js` (the engine) and `app.js` (the page) are about 1,200 lines together, plus two web fonts (37 KB).

<!-- family:start -->
## The ASCII Koi family

One design in four places: koi drawn in text characters, letters that take a koi's colours as it swims under them, a black cat in character tiles, and black water (`#0d1315` water, `#ebe6dc` ink, `#e8784f` accent). Codex Koi and Koi Backdrop run ASCII Koi's `pond.js` byte for byte; the pond and the cat began in One Page.

<table>
<tr>
<td width="50%" valign="top"><a href="https://github.com/pursurer/ascii-koi"><img src="https://raw.githubusercontent.com/pursurer/ascii-koi/main/media/family/ascii-koi.png" alt="ASCII Koi: koi in text characters swim around the title ASCII Koi on dark teal water" width="100%"></a><br><b>ASCII Koi</b> (this repository) · the design<br>The pond itself: your new tab, under a clock made of the same characters.</td>
<td width="50%" valign="top"><a href="https://github.com/pursurer/codex-koi"><img src="https://raw.githubusercontent.com/pursurer/ascii-koi/main/media/family/codex-koi.png" alt="Codex Koi: koi swim under the heading of Codex's new-chat page in black water" width="100%"></a><br><b><a href="https://github.com/pursurer/codex-koi">Codex Koi</a></b> · in Codex<br>The pond behind the Codex desktop app's new-chat page, and the black cat as your Codex pet.</td>
</tr>
<tr>
<td width="50%" valign="top"><a href="https://github.com/pursurer/claude-koi-backdrop"><img src="https://raw.githubusercontent.com/pursurer/ascii-koi/main/media/family/koi-backdrop.png" alt="Koi Backdrop: koi swim behind a chat in the Claude desktop app" width="100%"></a><br><b><a href="https://github.com/pursurer/claude-koi-backdrop">Koi Backdrop</a></b> · in Claude<br>The pond behind your conversations in the Claude desktop app, as a plugin with a <code>/koi</code> command.</td>
<td width="50%" valign="top"><a href="https://github.com/pursurer/one-page-is-all-you-need"><img src="https://raw.githubusercontent.com/pursurer/ascii-koi/main/media/family/one-page.png" alt="One Page is all you need: the title drawn in character cells over the koi pond" width="100%"></a><br><b><a href="https://github.com/pursurer/one-page-is-all-you-need">One Page is all you need</a></b> · in your morning<br>A one-page briefing that an n8n agent writes every day, opening on the pond. Where the koi and the cat began.</td>
</tr>
</table>

Every repository in the family has the topic [`ascii-koi`](https://github.com/topics/ascii-koi).
<!-- family:end -->

## Credits

- Technique informed by [stackedlol/ascii-sharks](https://github.com/stackedlol/ascii-sharks) (MIT) and [daoho.dev](https://daoho.dev); all code here is written for this project.
- Fonts: [Noto Serif Display](https://fonts.google.com/noto/specimen/Noto+Serif+Display) and [Geist Mono](https://github.com/vercel/geist-font), both under the SIL Open Font License (see `fonts/`).
- Film: made with [huashu-motion](https://github.com/alchaincyf/huashu-motion).

## License

MIT. Fork it, theme it, put it on your stream. If the pond made you smile, **⭐ star the repo** so the next person finds it too.

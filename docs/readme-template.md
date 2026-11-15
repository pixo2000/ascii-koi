# README template for the ASCII Koi family

Every family repository uses this shape, so the four projects read as one series. The first screen answers three questions: what it is (one bold sentence), what it looks like (a moving image from the real thing) and what to click next (one row of links).

```markdown
# <Product name>

**<One sentence: what it does for you, in plain words.>** <One or two sentences on what you see: text characters, the same pond, the black cat.>

<p align="center">
  <a href="<live demo, or #the-film>"><img src="media/<preview>.gif" alt="<What the image shows, frame by frame if it moves>" width="100%"></a>
</p>

<p align="center"><a href="<live demo or #install>"><b>▶ <Main action></b></a> &nbsp;·&nbsp; <a href="#the-film">Watch the film (<N> s, sound on)</a> &nbsp;·&nbsp; <a href="#install">Install</a></p>

<!-- family-nav:start -->
<!-- family-nav:end -->

## What you can do
<A table: what you do, and what happens.>

## The film

<the film's https://github.com/user-attachments/assets/... URL, alone on its line>

<One sentence: length, sound, what it shows.>

## Install
<Copy-paste commands, one per code block. Then the one step that makes it appear. A product may use its own word: "Make it your new tab", "Run it yourself".>

## How it works
<Which original code it reuses, and how.>

## Files
<A table: file, and its role.>

<!-- family:start -->
<!-- family:end -->

## Credits
<Code, techniques, fonts and sounds by others, with their licences.>

## License

MIT.
```

- **Family blocks.** Keep both pairs of markers. `node scripts/family.mjs` (in ascii-koi) fills them from `docs/family-nav.md` and `docs/family.md` in every family repository checked out on this Mac (the paths are in the script); `--check` only reports. Change the family text in those two files only. The 2 × 2 table stays readable at phone width; its thumbnails are 480 × 270 PNGs in ascii-koi's `media/family/`.
- **The hero.** One moving image, the opening seconds of the film as a looping GIF, 720 px wide, under 8 MB. No badge row: these are small visual projects, and the GIF is the one thing to look at.
- **The film.** GitHub plays a video only when it is uploaded as an attachment (drop the file into any comment box and copy the URL it writes; up to 10 MB). A link to an MP4 in the repository shows "can't show files that are this big", and a release asset downloads.
- **Repository name.** The product's own name in kebab case: `codex-koi`, `one-page-is-all-you-need`.
- **Description.** One plain sentence about what the user gets, no emoji.
- **Topics.** Always `ascii-koi` and `ascii-art`, then what the product runs on, for example `codex`, `claude-code`, `n8n`.
- **Social preview.** 1280 × 640, the film's title or end card.
- **Media.** Rendered from the real code, never mocked up. Keep the black water (`#0d1315`) as the background.

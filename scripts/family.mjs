// Copies the family blocks into the README of every family repository checked out on this Mac.
//   docs/family-nav.md  one line of family links under the README's opening, between <!-- family-nav:start --> and <!-- family-nav:end -->
//   docs/family.md      the family section near the end, between <!-- family:start --> and <!-- family:end -->
// In each README the repository's own name is shown in bold and not linked.
//   node scripts/family.mjs           update the READMEs
//   node scripts/family.mjs --check   only report, exit 1 if one is out of date
import { readFileSync, writeFileSync, existsSync } from "node:fs";

// repository → its checkout, relative to the folder that holds ascii-koi
const REPOS = {
  "ascii-koi": "ascii-koi",
  "codex-koi": "codex-koi",
  "claude-koi-backdrop": "claude-koi/koi-backdrop",
  "one-page-is-all-you-need": "one-page-is-all-you-need",
};
const BLOCKS = [
  { src: "family-nav.md", start: "<!-- family-nav:start -->", end: "<!-- family-nav:end -->" },
  { src: "family.md", start: "<!-- family:start -->", end: "<!-- family:end -->" },
];
const check = process.argv.includes("--check");
const read = (name) => readFileSync(new URL(`../docs/${name}`, import.meta.url), "utf8").trim();

// the repository's own entry: its bold linked name becomes "<b>Name</b> (this repository)", a plain link becomes bold text
const own = (block, repo) => {
  const href = `href="https://github.com/pursurer/${repo}"`;
  const bold = `<b><a ${href}>`;
  if (block.includes(bold)) {
    const a = block.indexOf(bold), b = block.indexOf("</a></b>", a);
    return block.slice(0, a) + `<b>${block.slice(a + bold.length, b)}</b> (this repository)` + block.slice(b + 8);
  }
  const link = `<a ${href}>`;
  const a = block.indexOf(link);
  if (a < 0) return block;
  const b = block.indexOf("</a>", a);
  return block.slice(0, a) + `<b>${block.slice(a + link.length, b)}</b>` + block.slice(b + 4);
};

let stale = 0;
for (const [repo, dir] of Object.entries(REPOS)) {
  const file = new URL(`../../${dir}/README.md`, import.meta.url);
  if (!existsSync(file)) { console.log(`${repo}: no checkout at ../${dir}, skipped`); continue; }
  const text = readFileSync(file, "utf8");
  let next = text;
  for (const { src, start, end } of BLOCKS) {
    const a = next.indexOf(start), b = next.indexOf(end);
    if (a < 0 || b < a) { console.log(`${repo}: no ${start} marker, that block skipped`); continue; }
    next = next.slice(0, a) + `${start}\n${own(read(src), repo)}\n${end}` + next.slice(b + end.length);
  }
  if (next === text) { console.log(`${repo}: up to date`); continue; }
  stale++;
  if (check) console.log(`${repo}: out of date`);
  else { writeFileSync(file, next); console.log(`${repo}: updated`); }
}
if (check && stale) process.exit(1);

# PVP Quiz — notes for Claude

Pokemon GO Battle League "who wins?" quiz. Vanilla HTML/CSS/JS ES modules, no build step, hosted on GitHub Pages. Owner is technically literate but not a programmer: prefer simple, working fixes over new frameworks or tooling.

## Data (all live, nothing hand-maintained)
- PvPoke `gamemaster.json` and `rankings/{cup}/overall/rankings-{cp}.json` from raw.githubusercontent.com. The meta updates itself; don't hardcode rankings, movesets or matchups.
- In rankings, `matchups` and `counters` ratings are from the ranked Pokemon's point of view (>500 win, <500 loss). Counters are losses, so the opponent's rating is `1000 - rating`.
- `moveset` holds move IDs; resolve names/types via `gamemaster.moves`.
- `gamemaster.formats` lists featured cups (`title`, `cup`, `cp`, `showFormat`, `hideRankings`).
- Artwork: PokeAPI official artwork. Forms map through generated `js/form-map.js` — regenerate with `node tools/build-form-map.mjs`, never hand-edit.

## Layout
- `js/data.js` fetch + IndexedDB cache (24h) · `js/quiz.js` pairing, winner, explanation data · `js/ui.js` rendering · `js/app.js` flow · `sw.js` offline caching.

## Checks before committing
- Serve with `python3 -m http.server` and play a round in Great, Master and one cup.
- Bump `CACHE_VERSION` in `sw.js` when adding or renaming app-shell files (and add them to `APP_SHELL`).

## Design
- "Sunny route day": sky-blue backdrop, white sticker cards with 3px ink outlines and hard drop shadows, sunshine-yellow actions and VS burst. Tokens live at the top of `css/styles.css`.
- Fonts: Lilita One (display) + Nunito (body) from Google Fonts, cached by the service worker.
- Each Pokemon's image sits on a spotlight tinted by its primary type (`--stage`, set in `ui.js`).
- Original decorations only (sparkles, starburst). Don't draw Nintendo designs such as Poké Balls or game UI icons; Pokemon art comes from PokeAPI.

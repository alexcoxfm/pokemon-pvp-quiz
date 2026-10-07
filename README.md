# PVP Quiz - Pokemon GO

A mobile-first Progressive Web App to practice Pokemon GO PVP Battle League matchup knowledge. The app shows two Pokemon and asks "who wins?" — then explains why based on actual PVP meta data.

## Features

- **Three leagues**: Great League (CP 1500), Ultra League (CP 2500), Master League (no limit)
- **Special cups**: Dynamically loaded from PVPoke's gamemaster data when active
- **Real matchups only**: Every pair has a published PvPoke head-to-head result
- **Detailed explanations**: How each side's recommended moves hit the other's typing, battle ratings, both movesets, and PvPoke's meta notes on the winner
- **Team ideas**: Balanced 3-Pokemon teams for each league, built live from PvPoke rankings and head-to-head results, with roles, movesets, what each member beats and what to watch out for
- **Works offline**: Full PWA with service worker caching
- **Mobile-first**: Designed for touch with dark theme

## Data Sources

| Source | Purpose |
|--------|---------|
| [PVPoke](https://pvpoke.com) (open source) | Pokemon stats, types, moves, PVP rankings, head-to-head matchups |
| [PokeAPI](https://pokeapi.co) | Pokemon official artwork sprites |

Data is cached in IndexedDB and refreshed every 24 hours, so the meta tracks PvPoke automatically — no code changes needed when rankings or moves change. The home screen shows the date of the PvPoke data in use.

## How It Works

1. Select a league
2. Two meta-relevant Pokemon are shown (top 100 from PVPoke rankings) that PvPoke has a head-to-head result for
3. Tap who you think wins the matchup
4. See the result with type analysis, battle ratings, and recommended moveset
5. Complete 10 rounds and see your score

Winner determination uses PVPoke's head-to-head battle ratings (0–1000, 500 = even) from each Pokemon's `matchups` and `counters` lists. Ratings are from that Pokemon's point of view, so a counter's rating is the *loser's* score.

## Tech Stack

- Vanilla HTML/CSS/JS — no framework, no build step
- ES modules
- IndexedDB for data caching
- Service Worker for offline support
- Hosted on GitHub Pages

## Development

Just serve the directory with any static server:

```bash
# Python
python3 -m http.server 8000

# Node
npx serve .
```

### Updating Form Map

If new alternate forms (Galarian, Origin, Mega, etc.) show up with the wrong artwork, regenerate the form-to-PokeAPI-ID mapping (Node 18+):

```bash
node tools/build-form-map.mjs
```

This rewrites `js/form-map.js` directly by matching every PvPoke species ID to a PokeAPI entry by name.

### Shipping changes

The service worker serves app files network-first, so deploys reach installed copies on next launch. Still bump `CACHE_VERSION` in `sw.js` when you add or rename app-shell files.

## League Rotation

PVPoke's gamemaster includes a `formats` array listing currently featured cups. The app shows each one PvPoke lists (skipping hidden ones and the Custom placeholder) and drops any whose rankings aren't published. Data refreshes automatically within 24 hours.

## Attribution

- Pokemon data and rankings from [PVPoke](https://pvpoke.com) — open source Pokemon GO PVP resource
- Pokemon artwork from [PokeAPI](https://pokeapi.co) — open source Pokemon API
- Pokemon is a trademark of The Pokemon Company. This app is not affiliated with or endorsed by The Pokemon Company, Niantic, or Nintendo.

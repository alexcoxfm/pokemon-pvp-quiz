# PVP Quiz - Pokemon GO

A mobile-first Progressive Web App to practice Pokemon GO PVP Battle League matchup knowledge. The app shows two Pokemon and asks "who wins?" — then explains why based on actual PVP meta data.

## Features

- **Three leagues**: Great League (CP 1500), Ultra League (CP 2500), Master League (no limit)
- **Special cups**: Dynamically loaded from PVPoke's gamemaster data when active
- **Smart matchups**: Pairs Pokemon using actual head-to-head data from PVPoke rankings
- **Detailed explanations**: Type advantages, battle ratings, recommended movesets, matchup dominance
- **Works offline**: Full PWA with service worker caching
- **Mobile-first**: Designed for touch with dark theme

## Data Sources

| Source | Purpose |
|--------|---------|
| [PVPoke](https://pvpoke.com) (open source) | Pokemon stats, types, moves, PVP rankings, head-to-head matchups |
| [PokeAPI](https://pokeapi.co) | Pokemon official artwork sprites |

Data is cached in IndexedDB and refreshed every 24 hours via stale-while-revalidate strategy.

## How It Works

1. Select a league
2. Two meta-relevant Pokemon are shown (top 100 from PVPoke rankings)
3. Tap who you think wins the matchup
4. See the result with type analysis, battle ratings, and recommended moveset
5. Complete 10 rounds and see your score

Winner determination uses PVPoke's head-to-head matchup data, which simulates actual GO Battle League fights with optimal shielding.

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

If new alternate forms (Alolan, Galarian, Mega, etc.) are added to Pokemon GO, regenerate the form-to-PokeAPI-ID mapping:

```bash
node tools/build-form-map.js
```

Copy the output into `js/pokemon-mapper.js` as the `FORM_ID_MAP` object.

## League Rotation

PVPoke's gamemaster includes a `formats` array listing currently active special cups and formats. The app reads this on startup to dynamically show available cups. Data refreshes automatically within 24 hours.

## Attribution

- Pokemon data and rankings from [PVPoke](https://pvpoke.com) — open source Pokemon GO PVP resource
- Pokemon artwork from [PokeAPI](https://pokeapi.co) — open source Pokemon API
- Pokemon is a trademark of The Pokemon Company. This app is not affiliated with or endorsed by The Pokemon Company, Niantic, or Nintendo.

#!/usr/bin/env node

/**
 * build-form-map.js — One-time helper to generate FORM_ID_MAP
 *
 * Cross-references PVPoke gamemaster speciesIds with PokeAPI to find
 * the correct PokeAPI IDs for alternate forms (Alolan, Galarian, Mega, etc.)
 *
 * Usage:
 *   node tools/build-form-map.js
 *
 * Output: Prints a JavaScript object mapping PVPoke speciesId -> PokeAPI dex ID
 *
 * The output should be copied into pokemon-mapper.js as FORM_ID_MAP.
 * This only needs to be re-run when new alternate forms are added to the game.
 */

const GAMEMASTER_URL = 'https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json';
const POKEAPI_BASE = 'https://pokeapi.co/api/v2';

// Suffixes that indicate alternate forms (not base forms)
const FORM_SUFFIXES = [
  '_alolan', '_galarian', '_hisuian', '_paldean',
  '_mega', '_mega_x', '_mega_y', '_primal',
  '_attack', '_defense', '_speed', '_origin',
  '_therian', '_sky', '_zen', '_sunny', '_rainy', '_snowy',
  '_black', '_white', '_resolute', '_pirouette',
  '_blade', '_crowned', '_rapid_strike',
  '_ice', '_midnight', '_dusk', '_school',
  '_pom_pom', '_pau', '_sensu', '_female',
  '_unbound', '_combat', '_blaze', '_aqua',
  '_wellspring', '_hearthflame', '_cornerstone',
  '_family_of_three', '_three_segment', '_roaming',
  '_hero', '_droopy', '_stretchy',
  '_blue', '_yellow', '_white',
  '_small', '_large', '_super',
  '_sandy', '_trash',
  '_blue_striped',
];

// PVPoke suffix -> PokeAPI form name mapping
const SUFFIX_TO_POKEAPI = {
  '_alolan': '-alola',
  '_galarian': '-galar',
  '_hisuian': '-hisui',
  '_paldean': '-paldea',
  '_mega': '-mega',
  '_mega_x': '-mega-x',
  '_mega_y': '-mega-y',
  '_primal': '-primal',
  '_attack': '-attack',
  '_defense': '-defense',
  '_speed': '-speed',
  '_origin': '-origin',
  '_therian': '-therian',
  '_sky': '-sky',
  '_zen': '-zen',
  '_sunny': '-sunny',
  '_rainy': '-rainy',
  '_snowy': '-snowy',
  '_black': '-black',
  '_white': '-white',
  '_resolute': '-resolute',
  '_pirouette': '-pirouette',
  '_blade': '-blade',
  '_crowned': '-crowned-sword',
  '_rapid_strike': '-rapid-strike',
  '_midnight': '-midnight',
  '_dusk': '-dusk',
  '_school': '-school',
  '_unbound': '-unbound',
  '_female': '-female',
};

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function main() {
  console.log('Fetching PVPoke gamemaster...');
  const gamemaster = await fetchJSON(GAMEMASTER_URL);

  // Find all alternate form speciesIds
  const altForms = [];
  for (const pokemon of gamemaster.pokemon) {
    const id = pokemon.speciesId;
    // Skip shadows
    if (id.endsWith('_shadow')) continue;

    for (const suffix of FORM_SUFFIXES) {
      if (id.endsWith(suffix) || id.includes(suffix + '_')) {
        altForms.push({ speciesId: id, dex: pokemon.dex, suffix });
        break;
      }
    }
  }

  console.log(`Found ${altForms.length} alternate forms`);
  console.log('Querying PokeAPI for form IDs...');

  const formMap = {};
  let found = 0;
  let notFound = 0;

  for (const form of altForms) {
    // Try to find the PokeAPI form ID
    const baseName = form.speciesId
      .replace(/_shadow$/, '')
      .replace(/_/g, '-');

    // Try direct lookup
    try {
      const data = await fetchJSON(`${POKEAPI_BASE}/pokemon/${baseName}`);
      formMap[form.speciesId] = data.id;
      found++;
      continue;
    } catch { /* try next */ }

    // Try with suffix mapping
    const pokeapiSuffix = SUFFIX_TO_POKEAPI[form.suffix];
    if (pokeapiSuffix) {
      const baseWithoutSuffix = form.speciesId.replace(form.suffix, '').replace(/_/g, '-');
      try {
        const data = await fetchJSON(`${POKEAPI_BASE}/pokemon/${baseWithoutSuffix}${pokeapiSuffix}`);
        formMap[form.speciesId] = data.id;
        found++;
        continue;
      } catch { /* try next */ }
    }

    console.warn(`  Not found: ${form.speciesId} (dex: ${form.dex})`);
    notFound++;
  }

  console.log(`\nResults: ${found} found, ${notFound} not found`);
  console.log('\n// FORM_ID_MAP for pokemon-mapper.js:');
  console.log('const FORM_ID_MAP = {');
  for (const [key, value] of Object.entries(formMap).sort()) {
    console.log(`  '${key}': ${value},`);
  }
  console.log('};');
}

main().catch(console.error);

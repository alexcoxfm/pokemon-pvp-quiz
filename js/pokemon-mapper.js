// pokemon-mapper.js — speciesId -> image URL / display name

import { FORM_ID_MAP } from './form-map.js';

const ARTWORK_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';

/**
 * Get the PokeAPI artwork URL for a PvPoke speciesId.
 * Alternate forms come from the generated FORM_ID_MAP (see tools/build-form-map.mjs);
 * everything else uses the National Dex number from the gamemaster.
 * @param {string} speciesId - PvPoke species ID (e.g., "stunfisk_galarian", "sableye_shadow")
 * @param {Map} pokemonMap - Map of speciesId -> gamemaster data
 * @returns {string} URL to the official artwork PNG, or '' if unknown
 */
export function getImageUrl(speciesId, pokemonMap) {
  // Shadow forms use the same artwork
  const cleanId = speciesId.replace(/_shadow$/, '');

  if (FORM_ID_MAP[cleanId]) {
    return `${ARTWORK_BASE}/${FORM_ID_MAP[cleanId]}.png`;
  }

  const pokeData = pokemonMap?.get(speciesId) || pokemonMap?.get(cleanId);
  if (pokeData?.dex) {
    return `${ARTWORK_BASE}/${pokeData.dex}.png`;
  }

  return '';
}

/**
 * Get display name from speciesId
 */
export function getDisplayName(speciesId, pokemonMap) {
  const pokeData = pokemonMap?.get(speciesId);
  if (pokeData && pokeData.speciesName) {
    return pokeData.speciesName;
  }
  // Fallback: format the speciesId nicely
  return speciesId
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

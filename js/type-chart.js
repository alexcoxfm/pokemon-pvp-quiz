// type-chart.js — Pokemon GO type effectiveness table
// Pokemon GO uses 1.6x (super effective), 0.625x (not very effective), 0.390625x (double not very effective / immune in MSG)

const TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
  'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'
];

// Effectiveness multipliers: attacker type -> defender type
// 1.6 = super effective, 0.625 = not very effective, 0.390625 = "immune" (double resist)
// Only non-1.0 values are stored
const EFFECTIVENESS = {
  normal:   { rock: 0.625, ghost: 0.390625, steel: 0.625 },
  fire:     { fire: 0.625, water: 0.625, grass: 1.6, ice: 1.6, bug: 1.6, rock: 0.625, dragon: 0.625, steel: 1.6 },
  water:    { fire: 1.6, water: 0.625, grass: 0.625, ground: 1.6, rock: 1.6, dragon: 0.625 },
  electric: { water: 1.6, electric: 0.625, grass: 0.625, ground: 0.390625, flying: 1.6, dragon: 0.625 },
  grass:    { fire: 0.625, water: 1.6, grass: 0.625, poison: 0.625, ground: 1.6, flying: 0.625, bug: 0.625, rock: 1.6, dragon: 0.625, steel: 0.625 },
  ice:      { fire: 0.625, water: 0.625, grass: 1.6, ice: 0.625, ground: 1.6, flying: 1.6, dragon: 1.6, steel: 0.625 },
  fighting: { normal: 1.6, ice: 1.6, poison: 0.625, flying: 0.625, psychic: 0.625, bug: 0.625, rock: 1.6, ghost: 0.390625, dark: 1.6, steel: 1.6, fairy: 0.625 },
  poison:   { grass: 1.6, poison: 0.625, ground: 0.625, rock: 0.625, ghost: 0.625, steel: 0.390625, fairy: 1.6 },
  ground:   { fire: 1.6, electric: 1.6, grass: 0.625, poison: 1.6, flying: 0.390625, bug: 0.625, rock: 1.6, steel: 1.6 },
  flying:   { electric: 0.625, grass: 1.6, fighting: 1.6, bug: 1.6, rock: 0.625, steel: 0.625 },
  psychic:  { fighting: 1.6, poison: 1.6, psychic: 0.625, dark: 0.390625, steel: 0.625 },
  bug:      { fire: 0.625, grass: 1.6, fighting: 0.625, poison: 0.625, flying: 0.625, psychic: 1.6, ghost: 0.625, dark: 1.6, steel: 0.625, fairy: 0.625 },
  rock:     { fire: 1.6, ice: 1.6, fighting: 0.625, ground: 0.625, flying: 1.6, bug: 1.6, steel: 0.625 },
  ghost:    { normal: 0.390625, psychic: 1.6, ghost: 1.6, dark: 0.625 },
  dragon:   { dragon: 1.6, steel: 0.625, fairy: 0.390625 },
  dark:     { fighting: 0.625, psychic: 1.6, ghost: 1.6, dark: 0.625, fairy: 0.625 },
  steel:    { fire: 0.625, water: 0.625, electric: 0.625, ice: 1.6, rock: 1.6, steel: 0.625, fairy: 1.6 },
  fairy:    { fire: 0.625, poison: 0.625, dragon: 1.6, dark: 1.6, steel: 0.625, fighting: 1.6 },
};

/**
 * Get type effectiveness multiplier for an attacking type against a defending type.
 */
export function getEffectiveness(attackType, defendType) {
  const atkLower = attackType.toLowerCase();
  const defLower = defendType.toLowerCase();
  return EFFECTIVENESS[atkLower]?.[defLower] ?? 1.0;
}

/**
 * Get combined effectiveness of an attacking type against a Pokemon with 1-2 types.
 */
export function getTypeMatchup(attackType, defenderTypes) {
  let multiplier = 1.0;
  for (const defType of defenderTypes) {
    multiplier *= getEffectiveness(attackType, defType);
  }
  return multiplier;
}

/**
 * Analyze type advantages between two Pokemon.
 * Returns an object with advantages and disadvantages for each side.
 */
export function analyzeTypeMatchup(typesA, typesB) {
  const advantages = [];
  const disadvantages = [];

  // Check A's types attacking B
  for (const atkType of typesA) {
    const mult = getTypeMatchup(atkType, typesB);
    if (mult > 1.0) {
      advantages.push({ type: atkType, multiplier: mult, side: 'A' });
    } else if (mult < 1.0) {
      disadvantages.push({ type: atkType, multiplier: mult, side: 'A' });
    }
  }

  // Check B's types attacking A
  for (const atkType of typesB) {
    const mult = getTypeMatchup(atkType, typesA);
    if (mult > 1.0) {
      advantages.push({ type: atkType, multiplier: mult, side: 'B' });
    } else if (mult < 1.0) {
      disadvantages.push({ type: atkType, multiplier: mult, side: 'B' });
    }
  }

  return { advantages, disadvantages };
}

export { TYPES };

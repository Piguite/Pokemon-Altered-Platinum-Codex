import type {
  ChangelogEntry,
  EventsDoc,
  EvolutionsDoc,
  ItemsDoc,
  MetaDoc,
  MiscDoc,
  MovesDoc,
  PokemonChange,
  SearchRecord,
  SinnohanForm,
  StatBlock,
  TrainersDoc,
  TypeChangesDoc,
  WildDoc,
} from "../types/data"

/**
 * Hand-written fallback fixtures.
 *
 * They are used ONLY when the matching JSON file in `public/data/` cannot be
 * fetched (the data pipeline runs independently of this app). Whenever a real
 * file is present it always wins.
 */

function s(hp: number, atk: number, def: number, spa: number, spd: number, spe: number): StatBlock {
  return { hp, atk, def, spa, spd, spe, bst: hp + atk + def + spa + spd + spe }
}

export const FIXTURE_META: MetaDoc = {
  hack: 'Pokémon Altered Platinum',
  version: 'r1.0.5',
  originalAuthor: 'Drayano',
  generatedAt: '1970-01-01T00:00:00.000Z',
  documents: [
    {
      id: 'pokemon-changes',
      title: 'Pokémon Changes',
      file: 'PokemonChanges.txt',
      version: 'r1.0.5',
      summary:
        'Types, base stats, abilities, learnsets and form variants for every changed Pokémon.',
      entryCount: 497,
      generalNotes: [
        {
          title: 'General Changes',
          lines: [
            'The Fairy-type has been added to the game, replacing the almost unused ???-type.',
            'All Pokémon have had their base stats updated to match Ultra Sun and Ultra Moon.',
            'All Pokémon have had their types updated to match Ultra Sun and Ultra Moon.',
          ],
        },
        {
          title: 'Effort Value Removal',
          lines: [
            'Effort Values are completely gone. Just entirely absent.',
            'The difficulty of this hack is intended to be based on tactical decisions and teambuilding.',
          ],
        },
      ],
      route: '#/pokemon',
    },
    {
      id: 'type-changes',
      title: 'Type Changes',
      file: 'TypeChanges.txt',
      version: 'r1.0.5',
      summary: 'The Ice type-chart rework and the 69 Pokémon type changes, with justifications.',
      entryCount: 69,
      generalNotes: [
        {
          title: 'General Changes',
          lines: [
            'Fairy-type is now in the game, replacing what was previously the ??? type.',
            'As in Generation VI games and onward, Steel takes 1x damage from Dark and Ghost attacks.',
          ],
        },
      ],
      route: '#/types',
    },
    {
      id: 'sinnohan-forms',
      title: 'Sinnohan Forms',
      file: 'SinnohanForms.txt',
      version: 'r1.0.5',
      summary: 'New regional forms with their own types, abilities, stats and learnsets.',
      entryCount: 65,
      generalNotes: [
        {
          title: 'General Notes',
          lines: [
            'Sinnohan Forms are new regional variants with the same general concept as Alolan Forms.',
            'Unlike Alolan Forms they totally replace the originals, due to engine limitations.',
            'They also cannot breed.',
          ],
        },
      ],
      route: '#/sinnohan',
    },
  ],
  enrichment: {
    source: 'PokeAPI (version group: platinum)',
    url: 'https://pokeapi.co/api/v2/pokemon/',
    fetchedAt: '1970-01-01T00:00:00.000Z',
    statsFilled: 264,
    tmFilled: 412,
    tutorFilled: 301,
    levelUpFilled: 140,
  },
  counts: {
    documents: 13,
    pokemon: 497,
    pokemonWithTypeChange: 69,
    pokemonWithStatChange: 497,
    pokemonWithAbilityChange: 380,
    sinnohan: 65,
    typeChangeEntries: 69,
    typeChartChanges: 4,
    moveReplacements: 29,
    newMoves: 10,
    moveModifications: 88,
    costChanges: 34,
    trainerAreas: 92,
    trainers: 780,
    wildAreas: 71,
    events: 42,
    trades: 4,
    faq: 14,
  },
}

export const FIXTURE_POKEMON: PokemonChange[] = [
  {
    dex: 6,
    name: 'Charizard',
    slug: 'charizard',
    isSinnohan: false,
    changeKinds: ['type', 'stats', 'ability', 'moves', 'learnset'],
    type: { old: ['Fire', 'Flying'], new: ['Fire', 'Dragon'] },
    stats: { old: s(78, 84, 78, 109, 85, 100), new: s(78, 84, 78, 110, 85, 110) },
    baseStats: s(78, 84, 78, 110, 85, 110),
    baseStatsSource: 'documented',
    ability: { old: ['Blaze'], new: ['Levitate', 'Determined'] },
    moves: [
      { text: 'Now compatible with TM88, Hurricane.', isNew: true },
      { text: 'Now compatible with Draco Meteor from the Move Tutor.', isNew: true },
    ],
    learnset: {
      levelUp: [
        { level: 1, move: 'Dragon Claw', isNew: false },
        { level: 1, move: 'Shadow Claw', isNew: false },
        { level: 1, move: 'Dual Wingbeat', isNew: false, source: 'PLA' },
        { level: 1, move: 'Scratch', isNew: false },
        { level: 5, move: 'Ember', isNew: false },
        { level: 8, move: 'Smokescreen', isNew: false },
        { level: 11, move: 'Metal Claw', isNew: false },
        { level: 14, move: 'Bite', isNew: false },
        { level: 16, move: 'Dragon Breath', isNew: false },
        { level: 18, move: 'Dragon Rage', isNew: false },
        { level: 22, move: 'Fire Fang', isNew: false },
        { level: 26, move: 'Slash', isNew: false },
        { level: 30, move: 'Flamethrower', isNew: false },
        { level: 34, move: 'Scary Face', isNew: false },
        { level: 36, move: 'Air Slash', isNew: false },
        { level: 39, move: 'Crunch', isNew: false },
        { level: 44, move: 'Dragon Pulse', isNew: false },
        { level: 49, move: 'Fire Spin', isNew: false },
        { level: 54, move: 'Belly Drum', isNew: true },
        { level: 59, move: 'Flare Blitz', isNew: false },
      ],
      tm: [
        { num: '02', move: 'Dragon Claw' },
        { num: '05', move: 'Roar' },
        { num: '06', move: 'Toxic' },
        { num: '10', move: 'Hidden Power' },
        { num: '11', move: 'Sunny Day' },
        { num: '15', move: 'Hyper Beam' },
        { num: '17', move: 'Protect' },
        { num: '26', move: 'Earthquake' },
        { num: '35', move: 'Flamethrower' },
        { num: '38', move: 'Fire Blast' },
        { num: '40', move: 'Aerial Ace' },
        { num: '47', move: 'Steel Wing' },
        { num: '50', move: 'Overheat' },
        { num: '51', move: 'Roost' },
        { num: '59', move: 'Dragon Pulse' },
        { num: '61', move: 'Will-O-Wisp' },
        { num: '88', move: 'Hurricane', isNew: true },
        { num: 'HM02', move: 'Fly' },
      ],
      tutor: [
        { move: 'Draco Meteor', isNew: true },
        { move: 'Air Cutter' },
        { move: 'Ominous Wind' },
        { move: 'Snore' },
        { move: 'Tailwind' },
      ],
      includesBaseline: true,
    },
    evolution: [],
    heldItem: 'None',
    baseHappiness: '70',
    forms: [
      {
        form: 'Mega Charizard X',
        ability: { old: ['Tough Claws'], new: ['Tough Claws'] },
        stats: { old: s(78, 130, 111, 130, 85, 100), new: s(78, 130, 111, 130, 85, 100) },
      },
    ],
    sections: [
      {
        title: 'Ability',
        lines: ['Old     Blaze', 'New     Levitate / Determined'],
      },
      {
        title: 'Base Stats',
        lines: [
          'Old     78 HP / 84 Atk / 78 Def / 109 SAtk / 85 SDef / 100 Spd / 534 BST',
          'New     78 HP / 84 Atk / 78 Def / 110 SAtk / 85 SDef / 110 Spd / 545 BST',
        ],
      },
      {
        title: 'Moves',
        lines: [
          'Now compatible with TM88, Hurricane. (!!)',
          'Now compatible with Draco Meteor from the Move Tutor. (!!)',
        ],
      },
      { title: 'Type', lines: ['Old     Fire / Flying', 'New     Fire / Dragon'] },
    ],
  },
  {
    dex: 7,
    name: 'Squirtle',
    slug: 'squirtle',
    isSinnohan: false,
    changeKinds: ['stats', 'ability', 'moves', 'learnset'],
    stats: { old: s(44, 48, 65, 50, 64, 43), new: s(44, 48, 65, 55, 64, 50) },
    baseStats: s(44, 48, 65, 55, 64, 50),
    baseStatsSource: 'documented',
    ability: { old: ['Torrent'], new: ['Rain Dish', 'Torrent'] },
    moves: [{ text: 'Now compatible with TM41, Hydro Pump.', isNew: false }],
    learnset: {
      levelUp: [
        { level: 1, move: 'Tackle', isNew: false },
        { level: 1, move: 'Tail Whip', isNew: false },
        { level: 5, move: 'Water Gun', isNew: false },
        { level: 8, move: 'Withdraw', isNew: false },
        { level: 11, move: 'Bubble', isNew: false },
        { level: 14, move: 'Bite', isNew: false },
        { level: 17, move: 'Rapid Spin', isNew: false },
        { level: 20, move: 'Water Pulse', isNew: false },
        { level: 23, move: 'Protect', isNew: false },
        { level: 26, move: 'Muddy Water', isNew: false },
        { level: 29, move: 'Iron Defense', isNew: false },
        { level: 32, move: 'Recover', isNew: true },
        { level: 35, move: 'Aqua Tail', isNew: false },
        { level: 38, move: 'Rain Dance', isNew: false },
        { level: 41, move: 'Hydro Pump', isNew: false },
        { level: 44, move: 'Water Spout', isNew: false },
      ],
      tm: [
        { num: '03', move: 'Water Pulse' },
        { num: '06', move: 'Toxic' },
        { num: '07', move: 'Hail' },
        { num: '10', move: 'Hidden Power' },
        { num: '13', move: 'Ice Beam' },
        { num: '14', move: 'Blizzard' },
        { num: '17', move: 'Protect' },
        { num: '18', move: 'Rain Dance' },
        { num: '27', move: 'Return' },
        { num: '28', move: 'Dig' },
        { num: '32', move: 'Double Team' },
        { num: '42', move: 'Facade' },
        { num: '44', move: 'Rest' },
        { num: '45', move: 'Attract' },
        { num: '55', move: 'Brine' },
        { num: '56', move: 'Fling' },
        { num: '58', move: 'Endure' },
        { num: '74', move: 'Gyro Ball' },
        { num: '78', move: 'Captivate' },
        { num: '83', move: 'Hyper Voice', isNew: true },
        { num: 'HM03', move: 'Surf' },
        { num: 'HM07', move: 'Waterfall' },
      ],
      tutor: [
        { move: 'Ice Punch' },
        { move: 'Icy Wind' },
        { move: 'Aqua Tail' },
        { move: 'Snore' },
        { move: 'Zen Headbutt' },
      ],
      includesBaseline: true,
    },
    evolution: [
      'Squirtle evolves into Wartortle at Level 16.',
      'Wartortle evolves into Blastoise at Level 36.',
    ],
    heldItem: 'None',
    baseHappiness: '70',
    forms: [],
    sections: [
      { title: 'Ability', lines: ['Old     Torrent', 'New     Rain Dish / Torrent'] },
      { title: 'Moves', lines: ['Now compatible with TM41, Hydro Pump.'] },
    ],
  },
  {
    dex: 26,
    name: 'Raichu',
    slug: 'raichu',
    isSinnohan: false,
    changeKinds: ['stats', 'ability', 'learnset'],
    stats: { old: s(60, 90, 55, 90, 80, 100), new: s(60, 90, 55, 95, 80, 110) },
    baseStats: s(60, 90, 55, 95, 80, 110),
    baseStatsSource: 'documented',
    ability: { old: ['Static'], new: ['Static', 'Lightning Rod'] },
    moves: [],
    learnset: {
      levelUp: [
        { level: 1, move: 'Thunder Shock', isNew: false },
        { level: 1, move: 'Tail Whip', isNew: false },
        { level: 1, move: 'Quick Attack', isNew: false },
        { level: 1, move: 'Thunderbolt', isNew: false },
        { level: 1, move: 'Volt Switch', isNew: true },
      ],
      tm: [
        { num: '06', move: 'Toxic' },
        { num: '10', move: 'Hidden Power' },
        { num: '15', move: 'Hyper Beam' },
        { num: '24', move: 'Thunderbolt' },
        { num: '25', move: 'Thunder' },
        { num: '34', move: 'Shock Wave' },
        { num: '43', move: 'Secret Power' },
        { num: '45', move: 'Attract' },
        { num: '57', move: 'Charge Beam' },
        { num: '68', move: 'Giga Impact' },
      ],
      tutor: [
        { move: 'Thunder Punch' },
        { move: 'Signal Beam' },
        { move: 'Magnet Rise' },
        { move: 'Snore' },
      ],
      includesBaseline: true,
    },
    evolution: ['Pikachu evolves into Raichu by using a Thunderstone.'],
    forms: [],
    sections: [{ title: 'Base Stats', lines: ['Old     60 HP / 90 Atk / 55 Def / 90 SAtk / 80 SDef / 100 Spd / 475 BST'] }],
  },
  {
    // Exercises the `baseStatsSource: 'baseline'` path: the documents record no
    // stat change for this entry, so the spread comes from vanilla Platinum.
    dex: 479,
    name: 'Rotom',
    slug: 'rotom',
    isSinnohan: false,
    changeKinds: ['type', 'stats', 'ability', 'moves'],
    type: { old: ['Electric', 'Ghost'], new: ['Electric', 'Ghost'] },
    stats: { old: s(50, 50, 77, 95, 77, 91), new: s(50, 50, 77, 95, 77, 91) },
    baseStats: s(50, 50, 77, 95, 77, 91),
    baseStatsSource: 'baseline',
    ability: { old: ['Levitate'], new: ['Levitate'] },
    moves: [{ text: 'All Rotom forms can now learn Thunderbolt by level up.', isNew: true }],
    learnset: {
      levelUp: [
        { level: 1, move: 'Thunder Shock', isNew: false },
        { level: 1, move: 'Confuse Ray', isNew: false },
        { level: 8, move: 'Uproar', isNew: false },
        { level: 15, move: 'Double Team', isNew: false },
        { level: 22, move: 'Shock Wave', isNew: false },
        { level: 29, move: 'Ominous Wind', isNew: false },
        { level: 36, move: 'Substitute', isNew: false },
        { level: 43, move: 'Thunderbolt', isNew: true },
        { level: 50, move: 'Charge Beam', isNew: false },
        { level: 57, move: 'Discharge', isNew: false },
      ],
      tm: [
        { num: '06', move: 'Toxic' },
        { num: '10', move: 'Hidden Power' },
        { num: '16', move: 'Light Screen' },
        { num: '18', move: 'Rain Dance' },
        { num: '24', move: 'Thunderbolt' },
        { num: '25', move: 'Thunder' },
        { num: '30', move: 'Shadow Ball' },
        { num: '33', move: 'Reflect' },
        { num: '34', move: 'Shock Wave' },
        { num: '57', move: 'Charge Beam' },
      ],
      tutor: [
        { move: 'Sucker Punch' },
        { move: 'Snore' },
        { move: 'Pain Split' },
        { move: 'Trick' },
        { move: 'Signal Beam' },
      ],
      includesBaseline: true,
    },
    evolution: [],
    forms: [
      {
        form: 'Heat Rotom',
        ability: { old: ['Levitate'], new: ['Levitate'] },
        stats: { old: s(50, 65, 107, 105, 107, 86), new: s(50, 65, 107, 105, 107, 86) },
        moves: [{ text: 'Now Electric / Fire. Retains Levitate.', isNew: true }],
      },
      {
        form: 'Wash Rotom',
        ability: { old: ['Levitate'], new: ['Levitate'] },
        stats: { old: s(50, 65, 107, 105, 107, 86), new: s(50, 65, 107, 105, 107, 86) },
        moves: [{ text: 'Now Electric / Water. Retains Levitate.', isNew: true }],
      },
    ],
    sections: [
      {
        title: 'Form Changes',
        lines: [
          'Rotom’s five alternate forms take the secondary type they have in Gen V onwards.',
          'They are not Ghost-type like in the normal Platinum.',
        ],
      },
    ],
  },
  {
    dex: 359,
    name: 'Sinnohan Absol',
    slug: 'sinnohan-absol',
    isSinnohan: true,
    changeKinds: ['form', 'type', 'stats', 'ability', 'item'],
    type: { old: ['Dark'], new: ['Dark', 'Fairy'] },
    stats: { old: s(65, 130, 60, 75, 60, 75), new: s(65, 120, 70, 110, 70, 100) },
    baseStats: s(65, 120, 70, 110, 70, 100),
    baseStatsSource: 'documented',
    ability: { old: ['Pressure', 'Super Luck'], new: ['Super Luck', 'Pixilate'] },
    moves: [{ text: 'Now learns Play Rough by level up.', isNew: true }],
    learnset: {
      levelUp: [
        { level: 1, move: 'Scratch', isNew: false },
        { level: 1, move: 'Feint', isNew: false },
        { level: 5, move: 'Leer', isNew: false },
        { level: 10, move: 'Quick Attack', isNew: false },
        { level: 15, move: 'Pursuit', isNew: false },
        { level: 20, move: 'Bite', isNew: false },
        { level: 25, move: 'Double Team', isNew: false },
        { level: 30, move: 'Slash', isNew: false },
        { level: 35, move: 'Future Sight', isNew: false },
        { level: 40, move: 'Sucker Punch', isNew: false },
        { level: 45, move: 'Play Rough', isNew: true },
        { level: 50, move: 'Detect', isNew: false },
        { level: 55, move: 'Night Slash', isNew: false },
        { level: 60, move: 'Psycho Cut', isNew: false },
      ],
      tm: [
        { num: '04', move: 'Calm Mind' },
        { num: '06', move: 'Toxic' },
        { num: '11', move: 'Sunny Day' },
        { num: '12', move: 'Taunt' },
        { num: '14', move: 'Blizzard' },
        { num: '30', move: 'Shadow Ball' },
        { num: '40', move: 'Aerial Ace' },
        { num: '46', move: 'Thief' },
        { num: '49', move: 'Snatch' },
        { num: '61', move: 'Will-O-Wisp' },
      ],
      tutor: [
        { move: 'Sucker Punch' },
        { move: 'Zen Headbutt' },
        { move: 'Bounce' },
        { move: 'Snore' },
      ],
      includesBaseline: true,
    },
    evolution: [],
    heldItem: '5% Life Orb',
    genderRatio: '50% Male / 50% Female',
    forms: [],
    sections: [
      {
        title: 'Held Item',
        lines: ['Old     Life Orb', 'New     5% Life Orb'],
      },
    ],
  },
  {
    // Exercises `LearnEntry.replaces` — the `LEVEL - Old >> New` form the source
    // uses for Wormadam's cloak learnsets.
    //
    // rev 4: Plant Cloak is Wormadam's *default* form, so the pipeline promotes
    // its scoped sections to the species level and drops it from `forms[]`.
    // Sandy and Trash Cloak remain genuine alternates.
    dex: 413,
    name: 'Wormadam',
    slug: 'wormadam',
    isSinnohan: false,
    changeKinds: ['learnset', 'moves'],
    moves: [{ text: 'Each cloak now has its own level-up learnset.', isNew: false }],
    // No baseline enrichment for this entry: its learnsets are entirely
    // cloak-scoped, so `includesBaseline` stays absent.
    learnset: {
      levelUp: [
        { level: 1, move: 'Heat Wave', isNew: true },
        { level: 20, move: 'Amnesia', isNew: false, replaces: 'Bug Bite' },
        { level: 38, move: 'Leaf Storm', isNew: false },
      ],
      tm: [],
      tutor: [],
    },
    evolution: [],
    forms: [
      {
        form: 'Sandy Cloak',
        levelUp: [
          { level: 1, move: 'Power Gem', isNew: true },
          { level: 20, move: 'Amnesia', isNew: false, replaces: 'Bug Bite' },
          { level: 38, move: 'Earth Power', isNew: false },
        ],
      },
      {
        form: 'Trash Cloak',
        levelUp: [
          { level: 1, move: 'Sludge Bomb', isNew: true },
          { level: 20, move: 'Amnesia', isNew: false, replaces: 'Bug Bite' },
          { level: 38, move: 'Gunk Shot', isNew: false },
        ],
      },
    ],
    sections: [
      {
        title: 'Level Up (Plant Cloak)',
        lines: ['20 - Bug Bite >> Amnesia'],
      },
    ],
  },
]

export const FIXTURE_SINNOHAN: SinnohanForm[] = [
  {
    dex: 12,
    name: 'Sinnohan Butterfree',
    baseName: 'Butterfree',
    slug: 'sinnohan-butterfree',
    types: ['Bug', 'Fairy'],
    replacedTypes: ['Bug', 'Flying'],
    replacedStats: s(60, 45, 50, 80, 80, 70),
    abilities: ['Tinted Lens', 'Magic Guard'],
    stats: s(80, 40, 90, 100, 130, 95),
    evolution: [
      'Sinnohan Caterpie evolves into Sinnohan Metapod at Level 7.',
      'Sinnohan Metapod evolves into Sinnohan Butterfree at Level 10.',
    ],
    learnset: {
      levelUp: [
        { level: 1, move: 'Calm Mind', isNew: false },
        { level: 1, move: 'Yawn', isNew: false },
        { level: 1, move: 'Wish', isNew: false },
        { level: 22, move: 'Gust', isNew: false },
        { level: 24, move: 'Poison Powder', isNew: false },
        { level: 24, move: 'Sleep Powder', isNew: false },
        { level: 24, move: 'Stun Spore', isNew: false },
        { level: 26, move: 'Silver Wind', isNew: false },
        { level: 28, move: 'Air Cutter', isNew: false },
        { level: 30, move: 'Draining Kiss', isNew: true },
        { level: 32, move: 'Supersonic', isNew: false },
        { level: 34, move: 'Air Slash', isNew: false },
        { level: 37, move: 'Safeguard', isNew: false },
        { level: 40, move: 'Bug Buzz', isNew: false },
        { level: 43, move: 'Roost', isNew: false },
        { level: 46, move: 'Moonblast', isNew: true },
        { level: 49, move: 'Whirlwind', isNew: false },
        { level: 52, move: 'Tailwind', isNew: false },
        { level: 55, move: 'Psychic', isNew: false },
        { level: 58, move: 'Hurricane', isNew: false },
      ],
      tm: [
        { num: '04', move: 'Calm Mind' },
        { num: '06', move: 'Toxic' },
        { num: '10', move: 'Hidden Power' },
        { num: '11', move: 'Sunny Day' },
        { num: '15', move: 'Hyper Beam' },
        { num: '16', move: 'Light Screen' },
        { num: '17', move: 'Protect' },
        { num: '19', move: 'Giga Drain' },
        { num: '20', move: 'Safeguard' },
        { num: '22', move: 'Solar Beam' },
        { num: '29', move: 'Psychic' },
        { num: '30', move: 'Shadow Ball' },
        { num: '33', move: 'Reflect' },
        { num: '40', move: 'Aerial Ace' },
        { num: '42', move: 'Facade' },
        { num: '43', move: 'Secret Power' },
        { num: '44', move: 'Rest' },
        { num: '48', move: 'Skill Swap' },
        { num: '51', move: 'Roost' },
        { num: '53', move: 'Energy Ball' },
        { num: '62', move: 'Bug Buzz' },
        { num: '68', move: 'Giga Impact' },
        { num: '85', move: 'Dazzling Gleam', isNew: true },
      ],
      tutor: [
        { move: 'Air Cutter' },
        { move: 'Ominous Wind' },
        { move: 'Signal Beam' },
        { move: 'Snore' },
        { move: 'Tailwind' },
        { move: 'Draco Meteor', isNew: true },
      ],
      includesBaseline: true,
    },
    sections: [
      { title: 'Type', lines: ['Bug/Fairy'] },
      { title: 'Ability', lines: ['Tinted Lens/Magic Guard'] },
      {
        title: 'Stats',
        lines: ['80 HP / 40 Atk / 90 Def / 100 SAtk / 130 SDef / 95 Spd / 535 BST'],
      },
    ],
  },
  {
    // Deliberately left without `replacedTypes`/`replacedStats`: the UI must
    // fall back to showing the final typing alone when enrichment is absent.
    dex: 309,
    name: 'Sinnohan Electrike',
    baseName: 'Electrike',
    slug: 'sinnohan-electrike',
    types: ['Electric', 'Dark'],
    abilities: ['Intimidate', 'Lightning Rod'],
    stats: s(40, 45, 50, 75, 50, 75),
    evolution: ['Sinnohan Electrike evolves into Sinnohan Manectric at Level 26.'],
    learnset: {
      levelUp: [
        { level: 1, move: 'Tackle', isNew: false },
        { level: 1, move: 'Thunder Wave', isNew: false },
        { level: 4, move: 'Leer', isNew: false },
        { level: 8, move: 'Howl', isNew: false },
        { level: 12, move: 'Quick Attack', isNew: false },
        { level: 16, move: 'Shock Wave', isNew: false },
        { level: 20, move: 'Bite', isNew: false },
        { level: 24, move: 'Thunder Fang', isNew: false },
        { level: 28, move: 'Roar', isNew: false },
        { level: 32, move: 'Discharge', isNew: false },
        { level: 36, move: 'Crunch', isNew: true },
        { level: 40, move: 'Thunderbolt', isNew: false },
      ],
      tm: [
        { num: '05', move: 'Roar' },
        { num: '06', move: 'Toxic' },
        { num: '10', move: 'Hidden Power' },
        { num: '17', move: 'Protect' },
        { num: '24', move: 'Thunderbolt' },
        { num: '25', move: 'Thunder' },
        { num: '34', move: 'Shock Wave' },
        { num: '46', move: 'Thief' },
        { num: '57', move: 'Charge Beam' },
      ],
      tutor: [
        { move: 'Thunder Punch' },
        { move: 'Sucker Punch' },
        { move: 'Snore' },
        { move: 'Magnet Rise' },
      ],
    },
    sections: [
      { title: 'Type', lines: ['Electric/Dark'] },
      { title: 'Ability', lines: ['Intimidate/Lightning Rod'] },
      { title: 'Stats', lines: ['40 HP / 45 Atk / 50 Def / 75 SAtk / 50 SDef / 75 Spd / 335 BST'] },
    ],
  },
]

export const FIXTURE_TYPE_CHANGES: TypeChangesDoc = {
  generalNotes: [
    'Fairy-type is now in the game, replacing what was previously the ??? type.',
    'All Pokémon that are Fairy-type in Gen VI onwards are also Fairy-type in Altered Platinum.',
    'As in Generation VI games and onward, Steel takes 1x damage from Dark and Ghost attacks.',
  ],
  iceTypeNotes: [
    'Ice is the only type which has had its relations changed from vanilla — Ice is a grossly underpowered type.',
    'The changes were chosen both for thematic and gameplay reasons.',
    'Ice is still weak to the common Fire and Fighting, plus Steel, but its key resistances to popular attacking types give Ice a real chance to take on a defensive role.',
  ],
  chartChanges: [
    {
      attacker: 'Ground',
      defender: 'Ice',
      oldMultiplier: 1,
      newMultiplier: 0.5,
      note: 'It is weak to Ice.',
    },
    {
      attacker: 'Rock',
      defender: 'Ice',
      oldMultiplier: 2,
      newMultiplier: 1,
      note: "To remove Ice's crippling weakness to Stealth Rock. Ice remains 1x against Rock offensively.",
    },
    {
      attacker: 'Water',
      defender: 'Ice',
      oldMultiplier: 1,
      newMultiplier: 0.5,
      note: 'Ice is solidified water, giving it an elemental relation to Water.',
    },
    {
      attacker: 'Dragon',
      defender: 'Ice',
      oldMultiplier: 1,
      newMultiplier: 0.5,
      note: "This resistance is coveted for any type that has it — it makes Ice a real answer to Dragon.",
    },
  ],
  pokemonChanges: [
    {
      dex: 6,
      name: 'Charizard',
      oldTypes: ['Fire', 'Flying'],
      newTypes: ['Fire', 'Dragon'],
      justification: 'Inherited from Mega form; draconic appearance.',
    },
    {
      dex: 19,
      name: 'Rattata',
      oldTypes: ['Normal'],
      newTypes: ['Normal', 'Dark'],
      justification: "Honestly shouldn't need an Alola form to justify a Dark type.",
    },
    {
      dex: 130,
      name: 'Gyarados',
      oldTypes: ['Water', 'Flying'],
      newTypes: ['Water', 'Dragon'],
      justification: 'Inherited from Mega form; more thematically coherent.',
    },
  ],
  rationales: [
    { type: 'Ground', text: 'It is weak to Ice.' },
    {
      type: 'Rock',
      text: "To remove Ice's crippling weakness to Stealth Rock. Also, ice is often responsible for erosion alongside water.",
    },
    { type: 'Water', text: 'Ice is solidified water, giving it an elemental relation to Water.' },
    { type: 'Dragon', text: 'It is weak to Ice. As well, many Dragon-types can use Fire moves.' },
  ],
}

export const FIXTURE_MOVES: MovesDoc = {
  generalNotes: [
    'The numbers of all moves (power, accuracy, PP, effect chance, priority) are updated to match Ultra Sun and Ultra Moon.',
    'Curse is now a Ghost-type move as in Ultra Sun and Ultra Moon.',
    'Charm, Moonlight and Sweet Kiss are now Fairy-type as in Ultra Sun and Ultra Moon.',
  ],
  replacements: [
    { oldMove: 'Barrage', newMove: 'Draining Kiss', isNew: false },
    { oldMove: 'Brine', newMove: 'Scald', isNew: false },
    { oldMove: 'Constrict', newMove: 'Icicle Crash', isNew: false },
    { oldMove: 'Lunar Dance', newMove: 'Moonblast', isNew: false },
    { oldMove: 'Steel Wing', newMove: 'Steel Feathers', isNew: true },
    { oldMove: 'Fissure', newMove: 'Roughhouse', isNew: true },
    { oldMove: 'Guillotine', newMove: 'Gem Flash', isNew: true },
    { oldMove: 'Smelling Salts', newMove: 'Vampire Fangs', isNew: true },
  ],
  newMoves: [
    {
      name: 'Gem Flash',
      type: 'Rock',
      class: "Special, Opponent's side of field",
      power: 50,
      pp: 15,
      accuracy: 100,
      effect: "70% chance to raise user's Special Attack 1 stage.",
      description:
        'The user builds crystal power, then unleashes it. It may also raise the user’s Sp. Atk stat.',
    },
    {
      name: 'Cosmic Void',
      type: 'Ghost',
      class: "Special, Opponent's side of field",
      power: 100,
      pp: 5,
      accuracy: 90,
      effect: '30% chance to lower the target’s Special Defense 1 stage.',
      description: 'The user tears open a hole into space. It may also lower the target’s Sp. Def stat.',
    },
    {
      name: 'Sekai Slam',
      type: 'Fighting',
      class: 'Physical, single target',
      power: 120,
      pp: 10,
      accuracy: 85,
      effect: 'No additional effect.',
      description: 'The user slams the target with world-shattering force.',
    },
  ],
  modifications: [
    {
      label: 'Absorb',
      moves: ['Absorb'],
      changes: [
        { label: 'Power', from: '20', to: '40' },
        { label: 'PP', from: '25', to: '30' },
      ],
      exceptions: [],
    },
    {
      label: 'Mega Drain',
      moves: ['Mega Drain'],
      changes: [
        { label: 'Power', from: '40', to: '50' },
        { label: 'PP', from: '15', to: '20' },
      ],
      exceptions: [],
    },
    {
      label: 'Flamethrower',
      moves: ['Flamethrower'],
      changes: [
        { label: 'Power', from: '95', to: '90' },
        { label: 'Burn chance', from: '10%', to: '10%' },
      ],
      exceptions: [],
    },
    {
      label: 'Knock Off',
      moves: ['Knock Off'],
      changes: [
        { label: 'Power', from: '20', to: '65' },
        { label: 'Effect', from: 'Removes held item', to: 'Removes held item; 1.5x power if it does' },
      ],
      exceptions: [],
    },
  ],
  /*
   * The grouped section: numeric changes shared by six moves, plus one effect
   * that only concerns Hurricane. `exceptions` is what keeps the UI from
   * attributing that effect to the other five.
   */
  groupModifications: [
    {
      label: 'Fire Blast / Thunder / Blizzard / Hydro Pump / Focus Blast / Hurricane',
      moves: ['Fire Blast', 'Thunder', 'Blizzard', 'Hydro Pump', 'Focus Blast', 'Hurricane'],
      changes: [
        { label: 'Power', from: '110', to: '110' },
        { label: 'Accuracy', from: '85%', to: '85%' },
        { label: 'PP', from: '5', to: '5' },
      ],
      exceptions: [
        {
          moves: ['Hurricane'],
          label: 'Effect',
          from: 'Confusion (30%)',
          to: 'No Effect (Engine limitation)',
        },
      ],
    },
    {
      label: 'Curse / Charm / Moonlight / Sweet Kiss',
      moves: ['Curse', 'Charm', 'Moonlight', 'Sweet Kiss'],
      changes: [{ label: 'Type', from: 'Normal / Ghost', to: 'Ghost / Fairy' }],
      exceptions: [],
    },
  ],
  groupNotes: ['Batch changes made to multiple similar moves.'],
  noteSections: [
    {
      title: 'Move Type Changes',
      lines: ['Curse is now Ghost-type.', 'Charm, Moonlight and Sweet Kiss are now Fairy-type.'],
    },
  ],
}

export const FIXTURE_ITEMS: ItemsDoc = {
  generalNotes: ['The following items now have a "Use" option like evolutionary stones.'],
  usableItems: ['Deep Sea Scale', 'Deep Sea Tooth', 'Dragon Scale', 'Dubious Disc', 'Electirizer', 'King’s Rock', 'Magmarizer', 'Metal Coat', 'Protector', 'Reaper Cloth', 'Up-Grade'],
  costChanges: [
    { item: 'Poké Ball', oldPrice: 200, newPrice: 50, raw: 'Poké Ball     ($200 >> $50)' },
    { item: 'Great Ball', oldPrice: 600, newPrice: 150, raw: 'Great Ball    ($600 >> $150)' },
    { item: 'Ultra Ball', oldPrice: 1200, newPrice: 300, raw: 'Ultra Ball    ($1200 >> $300)' },
    { item: 'Max Elixir', oldPrice: 4500, newPrice: 2000, raw: 'Max Elixir    ($4500 >> $2000)' },
    { item: 'PP Up', oldPrice: 9800, newPrice: 400, raw: 'PP Up\t\t\t($9800 >> $400)' },
    { item: 'Focus Sash', oldPrice: 200, newPrice: 20, raw: 'Focus Sash    ($200 >> $20)' },
    { item: 'Choice Band', oldPrice: 100, newPrice: 1000, raw: 'Choice Band   ($100 >> $1000)' },
    { item: 'Leftovers', oldPrice: 200, newPrice: 1000, raw: 'Leftovers     ($200 >> $1000)' },
    { item: 'Life Orb', oldPrice: 200, newPrice: 1000, raw: 'Life Orb      ($200 >> $1000)' },
    { item: 'Expert Belt', oldPrice: 200, newPrice: 800, raw: 'Expert Belt   ($200 >> $800)' },
    { item: 'Toxic Orb', oldPrice: 100, newPrice: 800, raw: 'Toxic Orb     ($100 >> $800)' },
    { item: 'Black Sludge', oldPrice: 200, newPrice: 400, raw: 'Black Sludge  ($200 >> $400)' },
    { item: 'All TMs', oldPrice: 9800, newPrice: 0, raw: 'All TMs ($0, unsellable)' },
  ],
  tmChanges: [
    { tm: 'TM88', move: 'Hurricane' },
    { tm: 'TM41', move: 'Hydro Pump' },
    { tm: 'TM85', move: 'Dazzling Gleam' },
  ],
  martChanges: [
    'Jubilife City Mart: Potion, Poké Ball, Antidote, Parlyz Heal, Awakening, Burn Heal, Ice Heal',
    'Oreburgh City Mart: Poké Ball, Potion, Super Potion, Escape Rope, Repel',
  ],
  deptStoreStock: [
    '2F: TM10, TM27, TM44 ...',
    '3F: Great Ball, Super Potion, Super Repel',
    '4F: Protein, Iron, Carbos, Calcium, Zinc, HP Up',
  ],
  itemLocations: [
    { item: 'Ice Beam (TM13)', locations: 'Route 216 — Snowbound area, behind the two rock smashers.' },
    { item: 'Leftovers', locations: 'Route 209 — Lost Tower 4F, south-east corner.' },
    { item: 'Choice Specs', locations: 'Celestic Town — house north of the ruins.' },
  ],
  tmLocations: [
    { tm: 'TM13', move: 'Ice Beam', location: 'Route 216', obtained: 'Item Ball', changed: true },
    { tm: 'TM24', move: 'Thunderbolt', location: 'Valley Windworks', obtained: 'Item Ball', changed: false },
    { tm: 'TM88', move: 'Hurricane', location: 'Pastoria City', obtained: 'NPC Gift', changed: true },
  ],
  vitaminReplacements: ['Protein → Muscle Band', 'Iron → Wise Glasses'],
  plateLocations: ['Fist Plate — Oreburgh Gate', 'Mind Plate — Route 210'],
  replacedItems: [
    { oldItem: 'Bicycle', newItem: 'Mach Bike', note: 'Same effect, new name.' },
    { oldItem: 'Old Rod', newItem: 'Worm Lure', note: 'Changes what you encounter instead of the level.' },
  ],
  noteSections: [
    { title: 'Modified Items', lines: ['All TMs now cost $0 and are thus unsellable.'] },
  ],
}

export const FIXTURE_EVOLUTIONS: EvolutionsDoc = {
  sections: [
    {
      title: 'Item Interaction Changes',
      lines: [
        '"Using" in this context means the item can be used exactly like an evolution stone.',
        'Poliwhirl: Now able to evolve into Politoed by using a King’s Rock.',
      ],
      entries: [
        { pokemon: 'Poliwhirl', text: 'Poliwhirl: Now able to evolve into Politoed by using a King’s Rock.' },
        { pokemon: 'Onix', text: 'Onix: Now able to evolve into Steelix by using a Metal Coat.' },
        { pokemon: 'Rhydon', text: 'Rhydon: Now able to evolve into Rhyperior by using a Protector.' },
        { pokemon: 'Seadra', text: 'Seadra: Now able to evolve into Kingdra by using a Dragon Scale.' },
        { pokemon: 'Scyther(S)', text: 'Scyther(S): Now able to evolve into Scizor(S) by using a Metal Coat.' },
        { pokemon: 'Feebas', text: 'Feebas: Now able to evolve into Milotic by using a Prism Scale.' },
      ],
    },
    {
      title: 'Level Changes',
      lines: ['Ponyta(S): Now evolves into Rapidash(S) at Level 35.'],
      entries: [
        { pokemon: 'Ponyta(S)', text: 'Ponyta(S): Now evolves into Rapidash(S) at Level 35.' },
        { pokemon: 'Slowpoke', text: 'Slowpoke: Now evolves into Slowbro at Level 33.' },
        { pokemon: 'Grimer', text: 'Grimer: Now evolves into Muk at Level 35.' },
        { pokemon: 'Wailmer', text: 'Wailmer: Now evolves into Wailord at Level 36.' },
      ],
    },
    {
      title: 'Method Changes',
      lines: ['Now evolves by level up instead of by trade.'],
      entries: [
        { pokemon: 'Kadabra', text: 'Kadabra: Now evolves into Alakazam at Level 40 instead of by trade.' },
        { pokemon: 'Machoke', text: 'Machoke: Now evolves into Machamp at Level 42 instead of by trade.' },
      ],
    },
  ],
}

export const FIXTURE_TRAINERS: TrainersDoc = {
  generalNotes: [
    'Trainer rosters in every area have been modified.',
    'Gym Leaders have been totally reworked — they have a new set of themes based on a central mechanic.',
    'Sinnohan Forms are marked by an (S) after the Pokémon’s name.',
  ],
  levelCaps: [
    'Roark, Lv. 16',
    'Mars, Lv. 18',
    'Gardenia, Lv. 26',
    'Jupiter, Lv. 27',
    'Aaron, Lv. 32',
    'Fantina, Lv. 33',
    'Elite Four/Cynthia, Lv. 78',
  ],
  areas: [
    {
      area: 'Route 201',
      trainers: [
        {
          name: 'PKMN Trainer Barry',
          markers: [],
          team: [{ species: 'Chimchar', level: 5, isSinnohan: false }],
          raw: 'PKMN Trainer Barry          Chimchar Lv. 5',
        },
        {
          name: 'PKMN Trainer Barry',
          markers: [],
          team: [{ species: 'Piplup', level: 5, isSinnohan: false }],
          raw: 'PKMN Trainer Barry          Piplup Lv. 5',
        },
      ],
      rematches: [],
      bosses: [],
    },
    {
      area: 'Oreburgh City Gym',
      trainers: [
        {
          name: 'Youngster Jonathon',
          markers: [],
          team: [
            { species: 'Geodude', level: 12, isSinnohan: false },
            { species: 'Onix', level: 12, isSinnohan: false },
          ],
          raw: 'Youngster Jonathon          Geodude Lv. 12, Onix Lv. 12',
        },
        {
          name: 'Rocker Dave',
          markers: ['!'],
          team: [{ species: 'Bonsly', level: 13, isSinnohan: false }],
          raw: 'Rocker Dave (!)              Bonsly Lv. 13',
        },
      ],
      rematches: [
        {
          name: 'Youngster Jonathon',
          markers: [],
          team: [
            { species: 'Golem', level: 48, isSinnohan: false },
            { species: 'Rampardos', level: 50, isSinnohan: false },
          ],
          raw: 'Youngster Jonathon          Golem Lv. 48, Rampardos Lv. 50',
        },
      ],
      bosses: [
        {
          name: 'Leader Roark',
          team: [
            {
              species: 'Nosepass',
              level: 14,
              isSinnohan: false,
              item: 'Sitrus Berry',
              ability: 'Sturdy',
              moves: ['Thunder Wave', 'Rock Throw', 'Stealth Rock', 'Protect'],
            },
            {
              species: 'Onix',
              level: 14,
              isSinnohan: false,
              item: 'Occa Berry',
              ability: 'Rock Head',
              moves: ['Rock Slide', 'Earthquake', 'Iron Tail', 'Screech'],
            },
            {
              species: 'Cranidos',
              level: 16,
              isSinnohan: false,
              item: 'Expert Belt',
              ability: 'Mold Breaker',
              moves: ['Head Smash', 'Zen Headbutt', 'Crunch', 'Fire Punch'],
            },
          ],
        },
      ],
    },
  ],
}

export const FIXTURE_WILD: WildDoc = {
  generalNotes: [
    'The Wild Pokémon in each area have been modified.',
    'The levels listed for an area are the minimum and maximum levels you may encounter.',
    'The different rods have been replaced by Lures.',
  ],
  areas: [
    {
      area: 'Route 201',
      levels: '4 - 5 (Walking)',
      methods: [
        {
          method: 'Morning',
          slots: [
            { species: 'Starly', percent: 30, isSinnohan: false },
            { species: 'Bidoof', percent: 30, isSinnohan: false },
            { species: 'Pidgey', percent: 10, isSinnohan: false },
            { species: 'Kricketot', percent: 10, isSinnohan: false },
            { species: 'Nidoran♂', percent: 10, isSinnohan: false },
            { species: 'Nidoran♀', percent: 10, isSinnohan: false },
          ],
        },
        {
          method: 'Night',
          slots: [
            { species: 'Starly', percent: 30, isSinnohan: false },
            { species: 'Bidoof', percent: 30, isSinnohan: false },
            { species: 'Hoothoot', percent: 10, isSinnohan: true },
            { species: 'Kricketot', percent: 10, isSinnohan: false },
          ],
        },
        {
          method: 'Poké Radar',
          slots: [{ species: 'Doduo', percent: 22, isSinnohan: false }],
        },
      ],
    },
    {
      area: 'Lake Verity',
      levels: '4 - 5 (Walking/Fishing), 20 - 40 (Surfing)',
      methods: [
        {
          method: 'Surf',
          slots: [
            { species: 'Psyduck', percent: 90, isSinnohan: false },
            { species: 'Golduck', percent: 10, isSinnohan: false },
          ],
        },
        {
          method: 'Worm Lure',
          slots: [
            { species: 'Magikarp', percent: 60, isSinnohan: false },
            { species: 'Feebas', percent: 30, isSinnohan: false },
            { species: 'Poliwag', percent: 10, isSinnohan: false },
          ],
        },
        {
          method: 'Honey Tree',
          slots: [
            { species: 'Burmy', percent: 40, isSinnohan: false },
            { species: 'Cherubi', percent: 30, isSinnohan: false },
            { species: 'Munchlax', percent: 1, isSinnohan: false },
          ],
        },
      ],
    },
  ],
}

export const FIXTURE_EVENTS: EventsDoc = {
  generalNotes: ['All Pokémon here have the normal chance to be shiny. There are no shiny locks.'],
  sections: [
    {
      title: 'Gift Pokémon',
      items: [
        {
          title: 'Baby Pokémon Egg Gift',
          location: 'Jubilife City Trainer School',
          level: '1',
          lines: [
            'Talk to the Cowgirl in the Jubilife School to receive an Egg.',
            'The Egg will hatch into one of the following Pokémon at random:',
            'Pichu, Cleffa, Igglybuff, Togepi, Tyrogue, Smoochum, Elekid, Magby, Azurill, Wynaut, Budew, Chingling, Bonsly, Mime Jr., Happiny, Munchlax, Riolu, Mantyke.',
          ],
        },
        {
          title: '#1 Bulbasaur, #4 Charmander, #7 Squirtle',
          location: 'Jubilife City Pokémon Center',
          level: '5',
          lines: [
            'Talk to the Interviewer at the top left.',
            'Answer her questions correctly and win the battle.',
          ],
        },
      ],
    },
    {
      title: 'Static Encounters',
      items: [
        {
          title: '#480 Uxie',
          location: 'Lake Acuity',
          level: '50',
          lines: ['Requires the Galactic Bomb event to be complete.'],
        },
      ],
    },
  ],
}

export const FIXTURE_MISC: MiscDoc = {
  npc: [
    {
      title: 'Move Relearner',
      lines: [
        'The Move Relearner in Pastoria City now also teaches the Move Tutor moves for Heart Scales.',
      ],
    },
    {
      title: 'Name Rater',
      lines: ['Now located in Jubilife City instead of Eterna City.'],
    },
  ],
  trades: [
    {
      city: 'Oreburgh City',
      request: 'You will be asked for a Ponyta in exchange for a Spheal.',
      givenName: 'Gaeia the Spheal',
      species: 'Spheal',
      item: 'Never-Melt Ice',
      ivs: '31 HP / 31 Atk / 15 Def / 31 SAtk / 15 SDef / 15 Spd',
      nature: 'Quiet',
      lines: ['Item: Never-Melt Ice', 'Nature: Quiet'],
    },
    {
      city: 'Floaroma Town',
      request: 'You will be asked for a Cherubi in exchange for a Skorupi.',
      givenName: 'Spike the Skorupi',
      species: 'Skorupi',
      item: 'Poison Barb',
      ivs: '15 HP / 31 Atk / 31 Def / 15 SAtk / 15 SDef / 31 Spd',
      nature: 'Jolly',
      lines: ['Item: Poison Barb', 'Nature: Jolly'],
    },
  ],
  tradeNotes: [
    'Each of the four trades has been modified to accept different Pokémon.',
    'The trade that was previously in Snowpoint City has been moved to Floaroma Town.',
  ],
  levelCaps: ['Roark, Lv. 16', 'Mars, Lv. 18', 'Gardenia, Lv. 26', 'Elite Four/Cynthia, Lv. 78'],
  faq: [
    {
      question: 'How do I evolve trade evolutions?',
      answer: [
        'Trade evolutions now evolve by using their held item, exactly like an evolution stone.',
        'This includes Politoed, Slowking, Steelix, Rhyperior, Kingdra, Scizor, Electivire, Magmortar, Porygon2, Porygon-Z, Milotic, Dusknoir, Huntail and Gorebyss.',
      ],
      subsections: [],
    },
    {
      question: 'Where can I find Heart Scales?',
      answer: ['Heart Scales can be found on wild Luvdisc and by using the Poké Radar.'],
      subsections: [
        { title: 'Note', lines: ['The Move Relearner charges one Heart Scale per move.'] },
      ],
    },
  ],
  actionReplay: [
    {
      title: 'Max Money',
      lines: ['94000130 FCFF0000', 'B21C4D28 00000000', 'B0000004 00000000', '00000090 000F423F', 'D2000000 00000000'],
    },
    {
      title: 'All Badges',
      lines: ['94000130 FCFF0000', 'B21C4D28 00000000', 'B0000004 00000000', '2000008C 000000FF', 'D2000000 00000000'],
    },
  ],
}

export const FIXTURE_CHANGELOG: ChangelogEntry[] = [
  {
    version: 'r1.0.5',
    date: '2024-07-29',
    lines: [
      'Fixed an issue where Sinnohan Manectric could learn an unusable TM.',
      'Adjusted some trainer levels in the postgame.',
    ],
  },
  {
    version: 'r1.0.4',
    date: '2022-11-16',
    lines: ['Added the Level Caps list.', 'Various text fixes.'],
  },
]

export const FIXTURE_SEARCH: SearchRecord[] = [
  {
    id: 'pokemon-6',
    kind: 'pokemon',
    title: 'Charizard',
    subtitle: '#006 · Fire / Dragon',
    body: 'type stats ability moves learnset levitate determined draco meteor hurricane',
    route: '#/pokemon/charizard',
    badges: ['Fire', 'Dragon'],
  },
  {
    id: 'sinnohan-12',
    kind: 'sinnohan',
    title: 'Sinnohan Butterfree',
    subtitle: '#012 · Bug / Fairy',
    body: 'sinnohan regional form tinted lens magic guard moonblast',
    route: '#/sinnohan/sinnohan-butterfree',
    badges: ['Bug', 'Fairy'],
  },
  {
    id: 'item-life-orb',
    kind: 'item',
    title: 'Life Orb',
    subtitle: '200 → 1000',
    body: 'price cost item market',
    route: '#/items',
    badges: ['Item'],
  },
  {
    // Area-level records carry no `?area=` in the pipeline output: the UI has to
    // derive a target that actually opens the area (see `searchTarget`).
    id: 'wild-area-route-201',
    kind: 'wild',
    title: 'Route 201',
    subtitle: '4 - 5 (Walking)',
    body: 'Route 201 Morning: Starly 30%, Bidoof 30%, Pidgey 10%, Kricketot 10%',
    route: '#/wild',
    badges: ['Morning', 'Night'],
  },
  {
    id: 'trainer-area-route-201',
    kind: 'trainer',
    title: 'Route 201',
    subtitle: '3 trainers',
    body: 'Route 201 PKMN Trainer Barry : Chimchar Lv.5',
    route: '#/trainers',
    badges: [],
  },
  {
    id: 'move-new-gem-flash',
    kind: 'move',
    title: 'Gem Flash',
    subtitle: 'New move · Rock',
    body: 'new move Rock power 50 pp 15',
    route: '#/moves',
    badges: ['Rock'],
  },
  {
    id: 'doc-type-changes',
    kind: 'doc',
    title: 'Type Changes',
    subtitle: 'TypeChanges.txt',
    body: 'type chart ice ground rock water dragon fairy',
    route: '#/types',
    badges: ['Document'],
  },
  {
    id: 'faq-trade-evolutions',
    kind: 'faq',
    title: 'How do I evolve trade evolutions?',
    subtitle: 'FAQ',
    body: 'trade evolution king s rock metal coat protector',
    route: '#/guides/faq',
    badges: ['FAQ'],
  },
  {
    id: 'guide-level-caps',
    kind: 'guide',
    title: 'Level Caps',
    subtitle: '21 entries',
    body: 'level cap badge roark gardenia cynthia',
    route: '#/guides/level-caps',
    badges: ['Guide'],
  },
]

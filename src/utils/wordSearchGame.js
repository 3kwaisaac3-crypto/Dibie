// Préparation d'une partie de mots mêlés à partir du vocabulaire Dibiè.
// Le générateur (wordSearchGenerator.js) n'est pas modifié : ce module choisit
// les mots en amont (décision 5 du 2026-10-05 : « les mots sont choisis en amont
// selon la taille de la grille »), puis appelle generateWordSearch.

import {
  generateWordSearch,
  normalizeWord,
  createRandom,
  GRID_SIZES_BY_LEVEL
} from './wordSearchGenerator.js'

const MIN_WORD_LENGTH = 3 // même seuil que le générateur (décision 4)
const MAX_SEED = 4294967295 // 2^32 - 1, borne du générateur

// Réglages par niveau.
// - Taille : GRID_SIZES_BY_LEVEL (Claude.md du projet, l. 35 ; décision 3).
// - Directions : → et ↓ seulement, à tous les niveaux. La diagonale (↘) est
//   prévue « au niveau avancé (CE2 à l'aise) » mais reste à valider par un
//   enseignant (décision 2) : elle n'est pas activée ici.
// - Nombre de mots : CHOIX PROVISOIRE du developer, à valider par Isaac
//   (l'avis de l'educator évoque 6 à 8 mots en 10x10, hypothèse à valider en classe).
export const WORD_SEARCH_SETTINGS = Object.freeze({
  'SIL-CP': Object.freeze({ size: GRID_SIZES_BY_LEVEL['SIL-CP'].default, wordCount: 5, directions: Object.freeze(['across', 'down']) }),
  'CE1-CE2': Object.freeze({ size: GRID_SIZES_BY_LEVEL['CE1-CE2'].default, wordCount: 7, directions: Object.freeze(['across', 'down']) }),
  'CM1-CM2': Object.freeze({ size: GRID_SIZES_BY_LEVEL['CM1-CM2'].default, wordCount: 9, directions: Object.freeze(['across', 'down']) })
})

export const WORD_SEARCH_LEVELS = Object.freeze(Object.keys(WORD_SEARCH_SETTINGS))

// Mots interdits (décision 9) : la liste doit être établie par Isaac et un
// enseignant. ELLE N'EXISTE PAS ENCORE : aucune liste n'est inventée ici.
// Tant qu'elle est vide, RIEN ne protège la grille : les lettres de remplissage
// peuvent former par hasard un mot inapproprié, et l'application n'a aucun
// contrôle de l'enseignant avant affichage. Risque accepté par Isaac le
// 2026-10-06 en mode démonstration uniquement : ne pas mettre ce jeu devant
// des élèves réels avant d'avoir établi la liste avec un enseignant.
export const BLOCKED_WORDS = Object.freeze([])
export const BLOCKED_WORDS_VERSION = null

// Graine aléatoire (entier 0 à 2^32-1).
export function newSeed() {
  return Math.floor(Math.random() * (MAX_SEED + 1))
}

// Vrai si le texte est une graine acceptée par le générateur.
export function isValidSeed(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_SEED
}

// Choisit les mots d'une partie : entrées actives du niveau, mot simple
// (lettres seulement, ni espace, ni tiret, ni apostrophe), de 3 lettres à la
// taille de la grille ; un mot par forme de grille ; aucun mot contenu dans un
// autre mot choisi (décision 7). Tirage au hasard selon la graine : même
// graine et même vocabulaire, même liste.
// Renvoie des objets { affichage, grille } : affichage = mot_fr tel quel,
// grille = mot_fr (aucun article à retirer : mot_fr n'en contient pas).
export function selectWords(vocabulary, level, seed) {
  const settings = WORD_SEARCH_SETTINGS[level]
  if (!settings) throw new RangeError(`selectWords : niveau inconnu (${level})`)

  const byGridWord = new Map()
  const eligible = vocabulary
    .filter(v => v && v.niveau_fr === level && v.actif !== false && typeof v.mot_fr === 'string')
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
  for (const v of eligible) {
    const word = normalizeWord(v.mot_fr)
    if (word.length < MIN_WORD_LENGTH || word.length > settings.size) continue
    if (!byGridWord.has(word)) byGridWord.set(word, v)
  }

  const random = createRandom(seed)
  const pool = [...byGridWord.entries()]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }

  const chosen = []
  for (const [word, v] of pool) {
    if (chosen.length >= settings.wordCount) break
    if (chosen.some(c => c.word.includes(word) || word.includes(c.word))) continue
    chosen.push({ word, entry: v })
  }
  return chosen.map(({ entry }) => ({ id: entry.id, affichage: entry.mot_fr, grille: entry.mot_fr }))
}

// Prépare une partie complète. Le résultat du générateur est renvoyé tel quel
// (champ result) ; l'interface élève n'en affiche que grid et
// placements[].affichage, et seulement si result.status === 'ok'.
export function createWordSearchGame(vocabulary, level, seed) {
  const settings = WORD_SEARCH_SETTINGS[level]
  if (!settings) throw new RangeError(`createWordSearchGame : niveau inconnu (${level})`)
  if (!isValidSeed(seed)) throw new RangeError('createWordSearchGame : graine invalide')
  const words = selectWords(vocabulary, level, seed)
  const result = generateWordSearch(
    words.map(({ affichage, grille }) => ({ affichage, grille })),
    {
      level,
      size: settings.size,
      seed,
      directions: [...settings.directions],
      blockedWords: [...BLOCKED_WORDS],
      blockedWordsVersion: BLOCKED_WORDS_VERSION
    }
  )
  return { level, seed, wordIds: words.map(w => w.id), result }
}

// Cases d'une sélection (début, fin) si elles forment un segment dans une
// direction autorisée ; l'ordre des deux clics n'importe pas. Renvoie null
// sinon. Les cases sont lues dans le sens de lecture (jamais à l'envers).
export function cellsBetween(start, end, directions) {
  let [a, b] = [start, end]
  if (b.row < a.row || (b.row === a.row && b.col < a.col)) [a, b] = [b, a]
  const dr = b.row - a.row
  const dc = b.col - a.col
  let direction = null
  if (dr === 0 && dc > 0) direction = 'across'
  else if (dc === 0 && dr > 0) direction = 'down'
  else if (dr > 0 && dr === dc) direction = 'diagonal'
  if (direction === null || !directions.includes(direction)) return null
  const length = Math.max(dr, dc) + 1
  const cells = Array.from({ length }, (_, i) => ({
    row: a.row + Math.sign(dr) * i,
    col: a.col + Math.sign(dc) * i
  }))
  return { row: a.row, col: a.col, direction, length, cells }
}

const STEPS = { across: [0, 1], down: [1, 0], diagonal: [1, 1] }

// Cases occupées par un mot placé.
export function placementCells(placement) {
  const [dr, dc] = STEPS[placement.direction]
  return Array.from({ length: placement.word.length }, (_, i) => ({
    row: placement.row + dr * i,
    col: placement.col + dc * i
  }))
}

// Indice du mot placé qui correspond exactement à la sélection, sinon -1.
export function findPlacement(placements, selection) {
  if (!selection) return -1
  return placements.findIndex(p =>
    p.row === selection.row && p.col === selection.col &&
    p.direction === selection.direction && p.word.length === selection.length
  )
}

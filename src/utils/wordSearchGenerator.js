// Générateur de grilles de mots mêlés pour Dibiè.
// Aucune dépendance externe : JavaScript standard (navigateur et Node.js).
//
// Applique les dix décisions d'Isaac du 2026-10-05 (MEMORY/dibie/DECISIONS.md
// du dépôt JARVIS ; détail : avis-educator.md du prototype, hors de ce dépôt :
// Documents/Dibie app/prototypes/mots-meles/) :
// 1. grille sans accents (É -> E, Œ -> OE) ; la liste affichée utilise
//    placements[].affichage (= original), jamais word ;
// 2. directions → et ↓ par défaut, ↘ ('diagonal') activable ; jamais à l'envers ;
// 3. formats par niveau (GRID_SIZES_BY_LEVEL) ; bornes 4 à 20 = validation technique ;
// 4. longueur minimale 3 lettres ;
// 5. mot trop long écarté et signalé, la grille n'est jamais agrandie ;
// 6. mots composés exclus ; entrée en chaînes ou en objets { affichage, grille },
//    l'article n'est jamais retiré par programme ;
// 7. un mot contenu dans un autre mot de la liste est rejeté (motif 'contained') ;
// 8. grille reproductible par graine ; le résultat expose graine, liste,
//    version du générateur et version de la liste de mots interdits ;
// 9. option blockedWords : contrôle de la liste et de la grille finale,
//    régénération limitée, aucune grille si la limite est atteinte.
//
// Choix du developer, validés par Isaac le 2026-10-06 (voir README du prototype) :
// - dans un couple CHAT / CHATON, le mot le plus long est gardé ;
// - la grille finale est contrôlée contre les mots interdits sur les 4 axes
//   (→, ↓, ↘, ↙) dans les deux sens, quelles que soient les directions activées ;
// - un mot de la liste est rejeté ('blocked') s'il CONTIENT un mot interdit,
//   à l'endroit ou à l'envers, dans sa forme de grille ou dans son affichage ;
// - un objet dont la grille n'est pas exactement l'un des mots de l'affichage
//   est rejeté ('mismatch') : « le chat » / CHAT accepté, « arc-en-ciel » /
//   ARCENCIEL refusé ;
// - 20 essais au plus (MAX_GENERATION_ATTEMPTS) ;
// - placement par retour arrière (backtracking) borné, positions tirées au
//   hasard selon une graine : même graine, même grille.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const MIN_SIZE = 4
const MAX_SIZE = 20
const MIN_WORD_LENGTH = 3
const MAX_SEED = 4294967295 // 2^32 - 1
const MAX_BACKTRACK_STEPS = 2000
const MAX_GENERATION_ATTEMPTS = 20

// Version de l'algorithme : si elle change, une même graine peut donner une
// autre grille. 3.0.0 = application des décisions du 2026-10-05 (la version
// précédente est sauvegardée hors de ce dépôt, dans
// Documents/Dibie app/prototypes/mots-meles-v2-avant-decisions/).
export const GENERATOR_VERSION = '3.0.0'

export const DEFAULT_SIZE = 10

// Pas (ligne, colonne) de chaque direction de lecture autorisée. Aucune
// direction à l'envers n'existe (décision 2).
const DIRECTION_STEPS = {
  across: [0, 1], // →
  down: [1, 0], // ↓
  diagonal: [1, 1] // ↘
}
export const DIRECTIONS = Object.freeze(Object.keys(DIRECTION_STEPS))
export const DEFAULT_DIRECTIONS = Object.freeze(['across', 'down'])

// Axes parcourus pour chercher les mots interdits (lus aussi à l'envers) :
// →, ↓, ↘ et ↙ ; avec les mots retournés, cela couvre les 8 sens.
const SCAN_STEPS = [[0, 1], [1, 0], [1, 1], [1, -1]]

// Formats par niveau : Claude.md du projet Dibiè, l. 35 (8x8 SIL-CP,
// 10x10 CE1-CE2, 12x12 CM1-CM2, pas 15x15) ; 8x8 accepté au niveau de base
// CE1-CE2 (décision 3, à valider par un enseignant).
export const GRID_SIZES_BY_LEVEL = Object.freeze({
  'SIL-CP': Object.freeze({ default: 8, allowed: Object.freeze([8]) }),
  'CE1-CE2': Object.freeze({ default: 10, allowed: Object.freeze([10, 8]) }),
  'CM1-CM2': Object.freeze({ default: 12, allowed: Object.freeze([12]) })
})

// Générateur pseudo-aléatoire déterministe (mulberry32) : même graine,
// même grille. Permet de reproduire une grille (impression, correction).
export function createRandom(seed) {
  let state = seed >>> 0
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Majuscules sans accents, ligatures développées (Œ -> OE).
function toGridLetters(text) {
  return text
    .replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/æ/g, 'ae').replace(/Æ/g, 'AE')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

// Normalise un mot pour la grille : majuscules, sans accents, ligatures
// développées (Œ -> OE). Retourne '' si le mot contient autre chose que
// des lettres (espace, tiret, apostrophe, chiffre...).
export function normalizeWord(text) {
  if (typeof text !== 'string') return ''
  const s = toGridLetters(text.trim())
  return /^[A-Z]+$/.test(s) ? s : ''
}

const reverse = text => [...text].reverse().join('')

function shuffle(items, random) {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Vrai si un mot de longueur len, partant de (row, col) avec le pas
// [dr, dc], tient entièrement dans la grille.
function fitsInGrid(size, row, col, [dr, dc], len) {
  const endRow = row + dr * (len - 1)
  const endCol = col + dc * (len - 1)
  return row >= 0 && col >= 0 && row < size && col < size &&
    endRow >= 0 && endCol >= 0 && endRow < size && endCol < size
}

function cellAt(grid, row, col, [dr, dc], i) {
  return grid[row + dr * i][col + dc * i]
}

function matchesAt(grid, row, col, step, word) {
  for (let i = 0; i < word.length; i++) {
    if (cellAt(grid, row, col, step, i) !== word[i]) return false
  }
  return true
}

function countInString(text, word) {
  let count = 0
  for (let i = 0; i + word.length <= text.length; i++) {
    if (text.startsWith(word, i)) count++
  }
  return count
}

// Compte les apparitions d'un mot dans la grille, dans le sens de lecture
// des directions indiquées (par défaut → et ↓). Les cases vides (null) ne
// correspondent à rien.
export function countOccurrences(grid, word, directions = DEFAULT_DIRECTIONS) {
  const size = grid.length
  let count = 0
  for (const direction of directions) {
    const step = DIRECTION_STEPS[direction]
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (fitsInGrid(size, row, col, step, word.length) && matchesAt(grid, row, col, step, word)) count++
      }
    }
  }
  return count
}

// Nombre d'apparitions attendues d'un mot : une par mot placé qui le
// contient, y compris lui-même. Depuis la décision 7 (motif 'contained'),
// aucun mot placé n'en contient un autre : la valeur attendue est 1 ; le
// calcul général est gardé comme filet de sécurité.
function expectedCount(placements, word) {
  return placements.reduce((n, p) => n + countInString(p.word, word), 0)
}

// Vrai si un des mots de la liste apparaît plus souvent que prévu
// (ex. ABC et DEF côte à côte forment CDE : CDE serait trouvable deux fois).
function hasExtraOccurrence(grid, placements, words, directions) {
  return words.some(w => countOccurrences(grid, w, directions) > expectedCount(placements, w))
}

// Liste toutes les positions où le mot peut être placé : croisement
// autorisé seulement sur une lettre identique, et au moins une case
// nouvelle (un mot ne doit pas être caché sur les lettres d'un autre).
function findPositions(grid, word, directions) {
  const size = grid.length
  const positions = []
  for (const direction of directions) {
    const step = DIRECTION_STEPS[direction]
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (!fitsInGrid(size, row, col, step, word.length)) continue
        let fits = true
        let usesEmptyCell = false
        for (let i = 0; i < word.length && fits; i++) {
          const cell = cellAt(grid, row, col, step, i)
          if (cell === null) usesEmptyCell = true
          else if (cell !== word[i]) fits = false
        }
        if (fits && usesEmptyCell) positions.push({ row, col, direction })
      }
    }
  }
  return positions
}

// Écrit le mot ; renvoie les cases réellement remplies (pour pouvoir annuler).
function writeWord(grid, word, { row, col, direction }) {
  const [dr, dc] = DIRECTION_STEPS[direction]
  const written = []
  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i
    const c = col + dc * i
    if (grid[r][c] === null) {
      grid[r][c] = word[i]
      written.push([r, c])
    }
  }
  return written
}

function eraseCells(grid, cells) {
  for (const [r, c] of cells) grid[r][c] = null
}

const emptyGrid = size => Array.from({ length: size }, () => Array(size).fill(null))

// Essai 1 : retour arrière borné, pour placer TOUS les mots si possible.
function placeAllWithBacktracking(candidates, size, directions, random) {
  const grid = emptyGrid(size)
  const placements = []
  const allWords = candidates.map(c => c.word)
  let steps = MAX_BACKTRACK_STEPS

  function solve(index) {
    if (index === candidates.length) return true
    const { word, original } = candidates[index]
    for (const position of shuffle(findPositions(grid, word, directions), random)) {
      if (steps-- <= 0) return false
      const written = writeWord(grid, word, position)
      placements.push({ word, original, affichage: original, ...position })
      if (!hasExtraOccurrence(grid, placements, allWords, directions) && solve(index + 1)) return true
      placements.pop()
      eraseCells(grid, written)
    }
    return false
  }

  return solve(0) ? { grid, placements } : null
}

// Essai 2 (repli) : placement mot par mot ; un mot sans position
// convenable est écarté et signalé.
function placeGreedily(candidates, size, directions, random, rejected) {
  const grid = emptyGrid(size)
  const placements = []
  const allWords = candidates.map(c => c.word)
  for (const { word, original, input } of candidates) {
    const positions = findPositions(grid, word, directions)
    if (positions.length === 0) {
      rejected.push({ original: input, reason: 'no_space' })
      continue
    }
    let placed = false
    for (const position of shuffle(positions, random)) {
      const written = writeWord(grid, word, position)
      placements.push({ word, original, affichage: original, ...position })
      if (!hasExtraOccurrence(grid, placements, allWords, directions)) {
        placed = true
        break
      }
      placements.pop()
      eraseCells(grid, written)
    }
    // Toutes les positions géométriques créent un doublon : mot ambigu
    if (!placed) rejected.push({ original: input, reason: 'ambiguous' })
  }
  return { grid, placements }
}

// Vrai si la case (row, col) complète une suite de lettres égale à l'un
// des motifs, sur l'un des pas indiqués.
function completesPattern(grid, row, col, patterns, steps) {
  const size = grid.length
  return patterns.some(word => steps.some(step => {
    for (let i = 0; i < word.length; i++) {
      const r0 = row - step[0] * i
      const c0 = col - step[1] * i
      if (fitsInGrid(size, r0, c0, step, word.length) && matchesAt(grid, r0, c0, step, word)) return true
    }
    return false
  }))
}

// Remplit les cases vides au hasard en refusant toute lettre qui formerait
// un des mots placés (directions activées) ou un mot interdit (4 axes,
// dans les deux sens).
function fillEmptyCells(grid, placements, directions, blocked, random) {
  const size = grid.length
  const words = placements.map(p => p.word)
  const wordSteps = directions.map(d => DIRECTION_STEPS[d])
  const blockedPatterns = [...new Set([...blocked, ...blocked.map(reverse)])]
  const createsWord = (row, col) =>
    completesPattern(grid, row, col, words, wordSteps) ||
    completesPattern(grid, row, col, blockedPatterns, SCAN_STEPS)
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (grid[row][col] !== null) continue
      let chosen = null
      for (const letter of shuffle(ALPHABET, random)) {
        grid[row][col] = letter
        if (!createsWord(row, col)) {
          chosen = letter
          break
        }
      }
      // Cas extrême (les 26 lettres interdites) : lettre au hasard ; la
      // validation finale écartera le mot ambigu ou fera régénérer la grille.
      if (chosen === null) grid[row][col] = ALPHABET[Math.floor(random() * ALPHABET.length)]
    }
  }
}

// Toutes les lignes de la grille sur les 4 axes (→, ↓, ↘, ↙), en chaînes.
// Implémentation indépendante de matchesAt, pour le contrôle final.
function gridLines(grid) {
  const size = grid.length
  const lines = []
  for (let i = 0; i < size; i++) {
    lines.push(grid[i].join(''))
    lines.push(grid.map(row => row[i]).join(''))
  }
  for (let d = -(size - 1); d <= size - 1; d++) {
    let down = ''
    let up = ''
    for (let r = 0; r < size; r++) {
      const c1 = r + d
      if (c1 >= 0 && c1 < size) down += grid[r][c1]
      const c2 = size - 1 - r + d
      if (c2 >= 0 && c2 < size) up += grid[r][c2]
    }
    lines.push(down, up)
  }
  return lines
}

// Vrai si un mot interdit apparaît dans la grille, à l'endroit ou à l'envers.
export function containsBlockedWord(grid, blocked) {
  const lines = gridLines(grid)
  return blocked.some(b => {
    const r = reverse(b)
    return lines.some(line => line.includes(b) || line.includes(r))
  })
}

// Lettres d'un mot interdit : majuscules sans accents, tout autre signe retiré
// (dans une grille, les lettres sont contiguës).
function normalizeBlockedWord(text) {
  if (typeof text !== 'string') {
    throw new TypeError('generateWordSearch : "blockedWords" doit être un tableau de chaînes')
  }
  const s = toGridLetters(text).replace(/[^A-Z]/g, '')
  if (s === '') {
    throw new RangeError(`generateWordSearch : mot interdit sans lettre A-Z (${JSON.stringify(text)})`)
  }
  return s
}

// Lit une entrée de la liste : chaîne (affichage = chaîne, grille = chaîne
// normalisée) ou objet { affichage, grille }. Renvoie null si l'entrée est
// mal formée. L'article n'est jamais retiré : sans champ grille, un objet
// est mal formé.
function readEntry(item) {
  if (typeof item === 'string') return { affichage: item, word: normalizeWord(item) }
  if (item === null || typeof item !== 'object' || Array.isArray(item)) return null
  const { affichage, grille } = item
  if (typeof affichage !== 'string' || affichage.trim() === '' || typeof grille !== 'string') return null
  return { affichage, word: normalizeWord(grille) }
}

// Mots (suites de lettres) d'un affichage, en lettres de grille.
const affichageTokens = affichage => toGridLetters(affichage).split(/[^A-Z]+/).filter(Boolean)

function isBlockedEntry(word, affichage, blocked) {
  const texts = [word, ...affichageTokens(affichage)]
  return blocked.some(b => {
    const r = reverse(b)
    return texts.some(t => t.includes(b) || t.includes(r))
  })
}

function validateOptions(options) {
  const {
    size: givenSize,
    seed: givenSeed,
    level = null,
    directions = DEFAULT_DIRECTIONS,
    blockedWords = [],
    blockedWordsVersion = null
  } = options ?? {}

  if (level !== null && !Object.hasOwn(GRID_SIZES_BY_LEVEL, level)) {
    throw new RangeError(`generateWordSearch : "level" doit être l'un de ${Object.keys(GRID_SIZES_BY_LEVEL).join(', ')}`)
  }
  // (size: null reste une erreur, comme dans la version précédente)
  const size = givenSize !== undefined ? givenSize : (level !== null ? GRID_SIZES_BY_LEVEL[level].default : DEFAULT_SIZE)
  if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) {
    throw new RangeError(`generateWordSearch : "size" doit être un entier entre ${MIN_SIZE} et ${MAX_SIZE}`)
  }
  if (level !== null && !GRID_SIZES_BY_LEVEL[level].allowed.includes(size)) {
    throw new RangeError(`generateWordSearch : taille ${size} non prévue pour le niveau ${level} (${GRID_SIZES_BY_LEVEL[level].allowed.join(', ')})`)
  }
  if (givenSeed !== undefined && (!Number.isInteger(givenSeed) || givenSeed < 0 || givenSeed > MAX_SEED)) {
    throw new RangeError(`generateWordSearch : "seed" doit être un entier entre 0 et ${MAX_SEED}`)
  }
  if (!Array.isArray(directions) || directions.length === 0 ||
      directions.some(d => !DIRECTIONS.includes(d)) || new Set(directions).size !== directions.length) {
    throw new RangeError(`generateWordSearch : "directions" doit être un tableau non vide, sans doublon, de ${DIRECTIONS.join(', ')}`)
  }
  if (!Array.isArray(blockedWords)) {
    throw new TypeError('generateWordSearch : "blockedWords" doit être un tableau de chaînes')
  }
  if (blockedWordsVersion !== null && typeof blockedWordsVersion !== 'string') {
    throw new TypeError('generateWordSearch : "blockedWordsVersion" doit être une chaîne')
  }
  const blocked = [...new Set(blockedWords.map(normalizeBlockedWord))]
  return { size, givenSeed, level, directions: [...directions], blocked, blockedWordsVersion }
}

// Une tentative complète (placement, remplissage, validation) avec une graine.
function buildGrid(candidates, size, directions, blocked, seed) {
  const random = createRandom(seed)
  const rejected = []
  const { grid, placements } =
    placeAllWithBacktracking(candidates, size, directions, random) ??
    placeGreedily(candidates, size, directions, random, rejected)

  fillEmptyCells(grid, placements, directions, blocked, random)

  // Validation finale (filet de sécurité) : un mot trouvable plus d'une
  // fois est retiré de la liste à chercher et signalé.
  const isInvalid = p => countOccurrences(grid, p.word, directions) !== expectedCount(placements, p.word)
  let invalid = placements.find(isInvalid)
  while (invalid) {
    placements.splice(placements.indexOf(invalid), 1)
    const { input } = candidates.find(c => c.word === invalid.word)
    rejected.push({ original: input, reason: 'ambiguous' })
    invalid = placements.find(isInvalid)
  }
  return { grid, placements, rejected }
}

/**
 * Génère une grille de mots mêlés. Ne lève d'erreur que pour des
 * paramètres incorrects ; un mot impossible à placer est signalé dans
 * `rejected`, jamais par une exception.
 *
 * @param {(string|{affichage: string, grille: string})[]} words
 *   liste de mots (ex. ['élève', { affichage: 'le chat', grille: 'chat' }])
 * @param {object} [options]
 * @param {number} [options.size]  côté de la grille (4 à 20 ; défaut : format du niveau, sinon 10)
 * @param {'SIL-CP'|'CE1-CE2'|'CM1-CM2'} [options.level]  impose une taille de GRID_SIZES_BY_LEVEL
 * @param {number} [options.seed]  graine entière de 0 à 2^32-1, pour reproduire la même grille
 * @param {('across'|'down'|'diagonal')[]} [options.directions=['across','down']]
 * @param {string[]} [options.blockedWords]  mots interdits (liste établie par Isaac et un enseignant)
 * @param {string} [options.blockedWordsVersion]  version de cette liste, recopiée dans le résultat
 * @returns {{
 *   status: 'ok'|'blocked_word_limit',
 *   message: string|null,
 *   generatorVersion: string,
 *   blockedWordsVersion: string|null,
 *   level: string|null,
 *   size: number,
 *   directions: string[],
 *   requestedSeed: number,
 *   seed: number|null,
 *   attempts: number,
 *   words: any[],
 *   grid: string[][]|null,
 *   placements: { word: string, original: string, affichage: string, row: number, col: number, direction: string }[],
 *   rejected: { original: any, reason: 'invalid'|'mismatch'|'blocked'|'too_short'|'too_long'|'duplicate'|'contained'|'no_space'|'ambiguous', containedIn?: string }[]
 * }}
 */
export function generateWordSearch(words, options) {
  if (!Array.isArray(words)) {
    throw new TypeError('generateWordSearch : "words" doit être un tableau')
  }
  const { size, givenSeed, level, directions, blocked, blockedWordsVersion } = validateOptions(options)
  const requestedSeed = givenSeed ?? Math.floor(Math.random() * (MAX_SEED + 1))

  // 1. Contrôle de la liste, mot par mot
  const rejected = []
  let candidates = []
  const seen = new Set()
  for (const input of words) {
    const entry = readEntry(input)
    if (entry === null || entry.word === '') rejected.push({ original: input, reason: 'invalid' })
    // La grille doit être exactement l'un des mots de l'affichage : « le chat » /
    // CHAT accepté ; « arc-en-ciel » / ARCENCIEL refusé (mot composé, décision 6).
    else if (!affichageTokens(entry.affichage).includes(entry.word)) rejected.push({ original: input, reason: 'mismatch' })
    else if (isBlockedEntry(entry.word, entry.affichage, blocked)) rejected.push({ original: input, reason: 'blocked' })
    else if (entry.word.length < MIN_WORD_LENGTH) rejected.push({ original: input, reason: 'too_short' })
    else if (entry.word.length > size) rejected.push({ original: input, reason: 'too_long' })
    else if (seen.has(entry.word)) rejected.push({ original: input, reason: 'duplicate' })
    else {
      seen.add(entry.word)
      candidates.push({ word: entry.word, original: entry.affichage, input })
    }
  }

  // 2. Mot contenu dans un autre mot de la liste (CHAT / CHATON) : le plus
  //    court est rejeté (choix validé par Isaac), l'auteur peut retirer l'autre.
  const kept = []
  for (const c of candidates) {
    const container = candidates.find(o => o !== c && o.word.includes(c.word))
    if (container) rejected.push({ original: c.input, reason: 'contained', containedIn: container.original })
    else kept.push(c)
  }
  candidates = kept

  // 3. Placement : mots les plus longs d'abord ; régénération avec une
  //    autre graine (dérivée de la graine demandée) si un mot interdit
  //    apparaît dans la grille.
  candidates.sort((a, b) => b.word.length - a.word.length)
  const nextSeed = createRandom(requestedSeed ^ 0x9e3779b9)
  const base = {
    generatorVersion: GENERATOR_VERSION,
    blockedWordsVersion,
    level,
    size,
    directions,
    requestedSeed,
    words: words.map(w => (w !== null && typeof w === 'object' && !Array.isArray(w) ? { ...w } : w))
  }
  let seed = requestedSeed
  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    const built = buildGrid(candidates, size, directions, blocked, seed)
    if (!containsBlockedWord(built.grid, blocked)) {
      return {
        status: 'ok',
        message: null,
        ...base,
        seed,
        attempts: attempt,
        grid: built.grid,
        placements: built.placements,
        rejected: [...rejected, ...built.rejected]
      }
    }
    seed = Math.floor(nextSeed() * (MAX_SEED + 1))
  }

  // 4. Limite atteinte : aucune grille n'est renvoyée, l'auteur est averti.
  return {
    status: 'blocked_word_limit',
    message: `Aucune grille sans mot interdit après ${MAX_GENERATION_ATTEMPTS} essais : aucune grille n'est fournie. Modifier la liste de mots ou la taille.`,
    ...base,
    seed: null,
    attempts: MAX_GENERATION_ATTEMPTS,
    grid: null,
    placements: [],
    rejected
  }
}

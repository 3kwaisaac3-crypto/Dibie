// Préparation d'une partie d'anagrammes (moteur B, fiche L1 du catalogue des
// jeux v0.2 ; plan de migration §5.4). Module pur : aucun accès au stockage ni
// à l'interface. Même modèle que wordSearchGame.js : graine reproductible,
// mots dans la langue de l'interface au lancement, même normalisation.
//
// Décisions d'Isaac appliquées (D9, D10 du 2026-10-11 ; 2026-11-02) :
// - 3 lettres minimum (D9, 2026-10-11) ;
// - indice par défaut = définition (def_fr ou def_en selon la langue) ;
// - toutes les anagrammes réelles sont acceptées : toute entrée active du
//   vocabulaire, même niveau et même langue, dont le mot normalisé a
//   exactement les mêmes lettres est une bonne réponse. LIMITE : le jeu ne
//   connaît pas d'autre dictionnaire que le vocabulaire Dibiè ; un vrai mot
//   absent du vocabulaire (ex. NICHE pour CHIEN, s'il n'y figure pas) est
//   refusé ;
// - normalisation identique aux mots mêlés (normalizeWord ; anglais : forme
//   avant « / », formes composées exclues) ;
// - l'orthographe exacte (avec accents) est rendue dans `display`, pour être
//   montrée après chaque mot trouvé ;
// - définition qui ne donne pas la réponse (2026-11-02, « aussi dérivées ») :
//   un mot dont la définition affichée contient le mot lui-même ou un mot qui
//   commence par lui (pluriel, conjugaison : FAMILLE / « familles ») est écarté.
//   vocabulaire.json n'est pas modifié.

import { normalizeWord, createRandom } from './wordSearchGenerator.js'
import { BLOCKED_WORDS, entryText, newSeed, isValidSeed } from './wordSearchGame.js'

export { newSeed, isValidSeed }

export const MIN_WORD_LENGTH = 3 // décision D9 d'Isaac (2026-10-11)
export const POINTS_PER_WORD = 10 // décision d'Isaac, comme les autres jeux
export const TRIES_BEFORE_SOLUTION = 3 // CHOIX PROVISOIRE (catalogue L1, « [proposition] »)

// Réglages par niveau. CHOIX PROVISOIRES, hypothèses du catalogue L1
// (« [HYPOTHÈSE — À VÉRIFIER] »), à valider par un enseignant :
// - longueur des mots : 3-5 (SIL-CP), 4-7 (CE1-CE2), 6-10 (CM1-CM2) ;
// - première lettre déjà placée en SIL-CP seulement ;
// - 5 mots par partie à tous les niveaux.
export const ANAGRAM_SETTINGS = Object.freeze({
  'SIL-CP': Object.freeze({ minLength: 3, maxLength: 5, wordCount: 5, firstLetterGiven: true }),
  'CE1-CE2': Object.freeze({ minLength: 4, maxLength: 7, wordCount: 5, firstLetterGiven: false }),
  'CM1-CM2': Object.freeze({ minLength: 6, maxLength: 10, wordCount: 5, firstLetterGiven: false })
})

export const ANAGRAM_LEVELS = Object.freeze(Object.keys(ANAGRAM_SETTINGS))

// Nombre de mélanges tirés au hasard avant l'examen exhaustif (déterministe)
const RANDOM_TRIES = 50
// Plafond de l'examen exhaustif des ordres possibles : au-delà, le mot est écarté
const MAX_PERMUTATIONS = 50000

// Lettres triées : deux mots ont la même clé s'ils ont exactement les mêmes lettres
export const letterKey = (word) => [...word].sort().join('')

// Liste de mots interdits normalisée (même normalisation que les mots).
// La liste des mots mêlés (BLOCKED_WORDS) est réutilisée ; ELLE EST VIDE à ce
// jour : le jeu reste en démonstration, comme les mots mêlés.
function normalizeBlocked(blockedWords) {
  return [...new Set(blockedWords.map(normalizeWord).filter(Boolean))]
}

const containsBlocked = (text, blocked) => blocked.some(b => text.includes(b))

// Mots d'un texte en lettres de grille (majuscules sans accents, ligatures
// développées), comme toGridLetters de wordSearchGenerator.js (non exportée)
export function gridTokens(text) {
  return String(text)
    .replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/æ/g, 'ae').replace(/Æ/g, 'AE')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean)
}

// Vrai si la définition donne la réponse : un de ses mots est le mot lui-même
// ou commence par lui (« familles » pour FAMILLE, « s'arrête » pour ARRET)
export function definitionRevealsWord(definition, word) {
  return gridTokens(definition).some(token => token.startsWith(word))
}

// Toutes les bonnes réponses d'un niveau et d'une langue, regroupées par clé
// de lettres : entrées actives, mot simple de 3 lettres ou plus, une seule
// fois par mot normalisé (la première par id ; NDOLÉ et NDOLÈ donnent NDOLE).
export function buildAnswerIndex(vocabulary, level, language = 'fr') {
  const index = new Map()
  const entries = vocabulary
    .filter(v => v && v.niveau_fr === level && v.actif !== false && typeof entryText(v, language) === 'string')
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
  for (const v of entries) {
    const display = entryText(v, language)
    const word = normalizeWord(display)
    if (word.length < MIN_WORD_LENGTH) continue
    const key = letterKey(word)
    if (!index.has(key)) index.set(key, [])
    const answers = index.get(key)
    if (!answers.some(a => a.word === word)) answers.push({ id: v.id, word, display })
  }
  return index
}

// Ordre affiché sûr : différent de toutes les bonnes réponses, sans mot
// interdit (ni dans les tuiles seules, ni avec la première lettre déjà placée).
function isSafeOrder(letters, firstLetter, answerWords, blocked) {
  const tiles = letters.join('')
  const shown = (firstLetter ?? '') + tiles
  if (answerWords.has(shown)) return false
  return !containsBlocked(shown, blocked) && !containsBlocked(tiles, blocked)
}

function shuffled(items, random) {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Permutation suivante dans l'ordre lexicographique (indices), ou null
function nextPermutation(a) {
  const p = [...a]
  let i = p.length - 2
  while (i >= 0 && p[i] >= p[i + 1]) i--
  if (i < 0) return null
  let j = p.length - 1
  while (p[j] <= p[i]) j--
  ;[p[i], p[j]] = [p[j], p[i]]
  let k = i + 1, l = p.length - 1
  while (k < l) { [p[k], p[l]] = [p[l], p[k]]; k++; l-- }
  return p
}

// Ordre sûr des tuiles (tableau d'indices dans `letters`), ou null s'il n'en
// existe aucun. `avoid` : ordre de lettres à éviter si possible (mélange
// précédent), pour que « Mélanger à nouveau » change vraiment l'affichage.
function findSafeOrder(letters, firstLetter, answerWords, blocked, random, avoid = null) {
  const safe = (order) => isSafeOrder(order.map(i => letters[i]), firstLetter, answerWords, blocked)
  const differs = (order) => avoid === null || order.map(i => letters[i]).join('') !== avoid
  const identity = letters.map((_, i) => i)
  let fallback = null
  for (let t = 0; t < RANDOM_TRIES; t++) {
    const order = shuffled(identity, random)
    if (!safe(order)) continue
    if (differs(order)) return order
    fallback ??= order
  }
  // Examen exhaustif sur les lettres triées (ordres distincts seulement)
  const sorted = [...identity].sort((a, b) => letters[a].localeCompare(letters[b]) || a - b)
  let perm = sorted.map(i => letters[i])
  for (let n = 0; perm && n < MAX_PERMUTATIONS; n++) {
    const used = new Set()
    const order = perm.map(l => {
      const i = identity.find(k => letters[k] === l && !used.has(k))
      used.add(i)
      return i
    })
    if (safe(order)) {
      if (differs(order)) return order
      fallback ??= order
    }
    perm = nextLetterPermutation(perm)
  }
  return fallback
}

// Permutation suivante d'un tableau de lettres (doublons traités une seule fois)
function nextLetterPermutation(letters) {
  const codes = letters.map(l => l.charCodeAt(0))
  const next = nextPermutation(codes)
  return next ? next.map(c => String.fromCharCode(c)) : null
}

// Mélange les lettres d'un mot. Renvoie { firstLetter, tiles } ou null si le
// mot doit être écarté : toutes ses lettres identiques, ou aucun ordre
// différent des bonnes réponses et sans mot interdit.
// firstLetterGiven : la première lettre est déjà placée et ne fait pas partie
// des tuiles.
export function scrambleWord(word, answerWords, random, { firstLetterGiven = false, blockedWords = BLOCKED_WORDS } = {}) {
  const blocked = normalizeBlocked(blockedWords)
  const answers = new Set(answerWords)
  answers.add(word)
  if (new Set(word).size === 1) return null
  const firstLetter = firstLetterGiven ? word[0] : null
  const letters = [...(firstLetterGiven ? word.slice(1) : word)]
  const order = findSafeOrder(letters, firstLetter, answers, blocked, random)
  if (order === null) return null
  return { firstLetter, tiles: order.map(i => letters[i]) }
}

// Graine dérivée pour « Mélanger à nouveau » : reproductible (même partie,
// même mot, même nombre de clics, même mélange).
export function reshuffleSeed(seed, wordIndex, round) {
  return (seed ^ Math.imul(wordIndex + 1, 0x9e3779b1) ^ Math.imul(round + 1, 0x85ebca6b)) >>> 0
}

// « Mélanger à nouveau » : nouvel ordre des tuiles actuelles (tableau
// d'indices), soumis aux mêmes règles que le premier mélange, et différent de
// l'ordre actuel lorsque c'est possible.
export function reshuffleOrder(item, currentTiles, seed, wordIndex, round, { blockedWords = BLOCKED_WORDS } = {}) {
  const blocked = normalizeBlocked(blockedWords)
  const answers = new Set(item.answers.map(a => a.word))
  const random = createRandom(reshuffleSeed(seed, wordIndex, round))
  const order = findSafeOrder(currentTiles, item.firstLetter, answers, blocked, random, currentTiles.join(''))
  return order ?? currentTiles.map((_, i) => i)
}

// Prépare une partie : entrées actives du niveau, mot simple dans la langue de
// la partie, longueur du niveau, définition non vide dans cette langue ; un
// mot par groupe de mêmes lettres (deux anagrammes l'une de l'autre ne sont
// jamais dans la même partie) ; mot sans mot interdit ; mélange sûr.
// Même graine + même niveau + même langue + même vocabulaire = même partie.
export function createAnagramGame(vocabulary, level, seed, language = 'fr', { blockedWords = BLOCKED_WORDS } = {}) {
  const settings = ANAGRAM_SETTINGS[level]
  if (!settings) throw new RangeError(`createAnagramGame : niveau inconnu (${level})`)
  if (!isValidSeed(seed)) throw new RangeError('createAnagramGame : graine invalide')
  const blocked = normalizeBlocked(blockedWords)
  const definitionField = language === 'en' ? 'def_en' : 'def_fr'
  const index = buildAnswerIndex(vocabulary, level, language)

  // Candidats : un par mot normalisé (le premier par id), parmi les bonnes réponses
  const candidates = []
  const seen = new Set()
  const entries = vocabulary
    .filter(v => v && v.niveau_fr === level && v.actif !== false && typeof entryText(v, language) === 'string')
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
  for (const v of entries) {
    const display = entryText(v, language)
    const word = normalizeWord(display)
    if (word.length < Math.max(MIN_WORD_LENGTH, settings.minLength) || word.length > settings.maxLength) continue
    const definition = typeof v[definitionField] === 'string' ? v[definitionField].trim() : ''
    if (definition === '' || seen.has(word)) continue
    if (definitionRevealsWord(definition, word)) continue
    seen.add(word)
    candidates.push({ id: v.id, word, display, definition })
  }

  const random = createRandom(seed)
  const pool = shuffled(candidates, random)
  const items = []
  const usedKeys = new Set()
  for (const c of pool) {
    if (items.length >= settings.wordCount) break
    const key = letterKey(c.word)
    if (usedKeys.has(key)) continue
    if (containsBlocked(c.word, blocked)) continue
    const answers = index.get(key)
    const scramble = scrambleWord(c.word, answers.map(a => a.word), random, {
      firstLetterGiven: settings.firstLetterGiven,
      blockedWords: blocked
    })
    if (scramble === null) continue
    usedKeys.add(key)
    // Le mot proposé garde son id et son orthographe (NDOLÉ / NDOLÈ) ; avec une
    // lettre déjà placée, seules les anagrammes qui commencent par elle comptent
    const accepted = answers
      .map(a => (a.word === c.word ? { id: c.id, word: c.word, display: c.display } : a))
      .filter(a => scramble.firstLetter === null || a.word[0] === scramble.firstLetter)
    items.push({ ...c, answers: accepted, firstLetter: scramble.firstLetter, tiles: scramble.tiles })
  }
  return { level, language, seed, items }
}

// Bonne réponse correspondant au mot écrit (normalisé), ou null
export function findAnswer(item, typed) {
  const word = normalizeWord(typed)
  return item.answers.find(a => a.word === word) ?? null
}

// Nombre de lettres bien placées par l'élève : la meilleure correspondance
// parmi les bonnes réponses (une autre anagramme réelle compte aussi). La
// lettre déjà placée (SIL-CP) n'est pas comptée : seules les cases remplies
// par l'élève le sont.
export function correctPositions(item, typed) {
  const word = normalizeWord(typed)
  const start = item.firstLetter ? 1 : 0
  return Math.max(...item.answers.map(a =>
    [...a.word].filter((l, i) => i >= start && word[i] === l).length))
}

// Indice « première lettre » (CHOIX PROVISOIRE) : la première lettre du mot ;
// en SIL-CP, où elle est déjà placée, les deux premières. Prises dans
// l'orthographe exacte (accent conservé : « É » pour ÉPICES), compté en
// lettres de grille : une ligature (Œ = O + E) est écrite avec les lettres
// des tuiles, et jamais plus de lettres que prévu (« O » pour ŒUF, « BO »
// pour BŒUF en SIL-CP).
export function firstLettersHint(item) {
  const count = item.firstLetter ? 2 : 1
  let hint = ''
  let used = 0
  for (const ch of item.display) {
    if (used >= count) break
    const letters = normalizeWord(ch)
    if (letters.length === 0) continue
    if (letters.length === 1) {
      hint += ch
      used += 1
    } else {
      const part = letters.slice(0, count - used)
      hint += part
      used += part.length
    }
  }
  return hint
}

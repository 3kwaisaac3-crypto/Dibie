// Tests du placement et de la numérotation des mots croisés — lancer avec : node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  generateCrossword,
  sanitizeWord,
  normalizeTypedLetter,
  selectCrosswordWords,
  countPlacedWords,
  isPlayableCrossword,
  crosswordSubjects,
  defaultCrosswordSubject,
  MIN_PLACED_WORDS,
  VOCAB_PER_GAME,
  GRID_SIZE,
  MAX_WORD_LENGTH,
  MAX_WORDS
} from './crosswordLayout.js'

const STEP = { across: [0, 1], down: [1, 0] }
const LEVELS = ['SIL-CP', 'CE1-CE2', 'CM1-CM2']
const TYPES = ['Bilingue', 'Français', 'Anglais']

// Oracle indépendant de selectCrosswordWords : 10 mots au plus,
// mots vides ou trop longs ignorés, bilingue = alternance FR / EN.
function wordsFor(entries, puzzleType) {
  const texts = []
  for (let idx = 0; idx < entries.length && texts.length < MAX_WORDS; idx++) {
    const w = entries[idx]
    let text
    if (puzzleType === 'Français') text = sanitizeWord(w.mot_fr)
    else if (puzzleType === 'Anglais') text = sanitizeWord(w.mot_en)
    else text = sanitizeWord(idx % 2 === 0 ? w.mot_fr : w.mot_en)
    if (!text || text.length > MAX_WORD_LENGTH) continue
    texts.push(text)
  }
  return texts
}

const VOCAB = JSON.parse(readFileSync(new URL('../data/vocabulaire.json', import.meta.url), 'utf8'))

// Toutes les combinaisons niveau x sujet x type, avec les 12 premières
// entrées actives du sujet (comme CrosswordGame.jsx)
function allCombinations() {
  const combos = []
  for (const level of LEVELS) {
    const active = VOCAB.filter(v => v.niveau_fr === level && v.actif !== false)
    for (const subject of new Set(active.map(v => v.sujet))) {
      const entries = active.filter(v => v.sujet === subject).slice(0, 12)
      for (const type of TYPES) combos.push({ level, subject, type, entries })
    }
  }
  return combos
}

// Toutes les grilles réellement proposées dans le jeu (niveau x sujet x type),
// avec le vrai vocabulaire et la même sélection que CrosswordGame.jsx (12 mots).
function realPuzzles() {
  const vocab = VOCAB
  const puzzles = []
  for (const level of LEVELS) {
    const active = vocab.filter(v => v.niveau_fr === level && v.actif !== false)
    for (const subject of new Set(active.map(v => v.sujet))) {
      const entries = active.filter(v => v.sujet === subject).slice(0, 12)
      for (const type of TYPES) {
        const words = wordsFor(entries, type)
        if (words.length >= 2) puzzles.push({ name: `${level} / ${subject} / ${type}`, words })
      }
    }
  }
  return puzzles
}

// Vérifie les invariants d'une grille de mots croisés
function assertValidCrossword(words, { grid, placements }, name = '') {
  const at = (r, c) => (r < 0 || c < 0 || r >= GRID_SIZE || c >= GRID_SIZE ? null : grid[r][c])

  // Chaque mot placé est lisible entièrement, sans lettre collée avant ou après
  const covered = new Set()
  for (const p of placements) {
    const [dr, dc] = STEP[p.dir]
    assert.equal(p.word, words[p.wordIdx], `${name} : wordIdx de ${p.word}`)
    assert.equal(p.cells.length, p.word.length, `${name} : cases de ${p.word}`)
    p.cells.forEach(([r, c], i) => {
      assert.deepEqual([r, c], [p.row + dr * i, p.col + dc * i], `${name} : case ${i} de ${p.word}`)
      assert.equal(grid[r][c], p.word[i], `${name} : lettre ${i} de ${p.word}`)
      covered.add(`${r}-${c}`)
    })
    assert.equal(at(p.row - dr, p.col - dc), null, `${name} : case avant ${p.word}`)
    assert.equal(at(p.row + dr * p.word.length, p.col + dc * p.word.length), null, `${name} : case après ${p.word}`)
  }

  // Aucune lettre hors d'un mot placé
  grid.forEach((row, r) => row.forEach((letter, c) => {
    if (letter) assert.ok(covered.has(`${r}-${c}`), `${name} : lettre orpheline ${letter} en ${r},${c}`)
  }))

  // Toute suite de 2 lettres ou plus dans la grille est un mot placé
  const placedRuns = new Set(placements.map(p => `${p.dir}-${p.row}-${p.col}-${p.word.length}`))
  for (const dir of ['across', 'down']) {
    for (let a = 0; a < GRID_SIZE; a++) {
      let start = -1
      for (let b = 0; b <= GRID_SIZE; b++) {
        const [r, c] = dir === 'across' ? [a, b] : [b, a]
        const letter = b < GRID_SIZE ? grid[r][c] : null
        if (letter && start < 0) start = b
        if (!letter && start >= 0) {
          const [r0, c0] = dir === 'across' ? [a, start] : [start, a]
          if (b - start >= 2) {
            assert.ok(placedRuns.has(`${dir}-${r0}-${c0}-${b - start}`), `${name} : suite de lettres parasite en ${r0},${c0} (${dir})`)
          }
          start = -1
        }
      }
    }
  }

  // Un mot n'est placé qu'une fois
  const idx = placements.map(p => p.wordIdx)
  assert.equal(new Set(idx).size, idx.length, `${name} : mot placé deux fois`)

  // Numéros 1..N sans trou, dans l'ordre de lecture ; case de départ partagée = même numéro
  const numberAt = new Map()
  for (const p of placements) {
    const key = p.row * GRID_SIZE + p.col
    if (numberAt.has(key)) assert.equal(p.clueNum, numberAt.get(key), `${name} : numéro unique par case de départ`)
    numberAt.set(key, p.clueNum)
  }
  const ordered = [...numberAt.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n)
  assert.deepEqual(ordered, ordered.map((n, i) => i + 1), `${name} : numéros 1..N dans l'ordre de lecture`)
}

test('sanitizeWord : accents, ligatures et première alternative', () => {
  assert.equal(sanitizeWord('Bêche'), 'BECHE')
  assert.equal(sanitizeWord('CHŒUR'), 'CHOEUR')
  assert.equal(sanitizeWord('Hallway / Corridor'), 'HALLWAY')
  assert.equal(sanitizeWord(''), '')
  assert.equal(sanitizeWord(undefined), '')
})

test('sanitizeWord : mots composés écartés (décision du 2026-10-05)', () => {
  assert.equal(sanitizeWord('T-SHIRT'), '')
  assert.equal(sanitizeWord('arc-en-ciel'), '')
  assert.equal(sanitizeWord('POMME DE TERRE'), '')
  assert.equal(sanitizeWord('Living room / Lounge'), '')
  assert.equal(sanitizeWord('L’ÉCOLE'), '')
  assert.equal(sanitizeWord("L'ECOLE"), '')
  assert.equal(sanitizeWord('PRISE USB2'), '')
  assert.equal(sanitizeWord('USB 2.0 port'), '')
})

test('normalizeTypedLetter : lettre tapée normalisée, le reste ignoré', () => {
  assert.equal(normalizeTypedLetter('a'), 'A')
  assert.equal(normalizeTypedLetter('é'), 'E')
  assert.equal(normalizeTypedLetter('Ç'), 'C')
  assert.equal(normalizeTypedLetter('ô'), 'O')
  assert.equal(normalizeTypedLetter('Bé'), 'E', 'dernière lettre saisie')
  for (const ignored of ['1', '0', ' ', '-', '’', "'", '?', '', undefined]) {
    assert.equal(normalizeTypedLetter(ignored), '', `${JSON.stringify(ignored)} ignoré`)
  }
})

test('liste vide : grille vide, aucun placement', () => {
  const { grid, placements } = generateCrossword([])
  assert.equal(grid.length, GRID_SIZE)
  assert.equal(placements.length, 0)
})

test('exemple simple : croisements valides et numérotation classique', () => {
  const words = ['CHAT', 'CHIEN', 'TAPIS', 'NATTE']
  const result = generateCrossword(words)
  assertValidCrossword(words, result, 'exemple')
  assert.equal(result.placements.length, 4)
  assert.equal(Math.max(...result.placements.map(p => p.clueNum)) <= 4, true)
})

test('mots sans lettre commune : seul le premier mot est placé', () => {
  const words = ['ABC', 'XYZ']
  const result = generateCrossword(words)
  assertValidCrossword(words, result, 'sans croisement')
  assert.equal(result.placements.length, 1)
})

test('au plus 10 mots placés, numéros jamais au-delà du nombre de cases de départ', () => {
  const words = ['MAISON', 'SALON', 'NATTE', 'TABLE', 'BALAI', 'LAMPE', 'PORTE', 'TOIT', 'MUR', 'SOL', 'LIT', 'OS']
  const result = generateCrossword(words)
  assertValidCrossword(words, result, '12 mots')
  assert.ok(result.placements.length <= MAX_WORDS)
  assert.ok(result.placements.every(p => p.wordIdx < MAX_WORDS))
})

test('grilles du vrai vocabulaire (tous niveaux, sujets, types) : invariants respectés', () => {
  const puzzles = realPuzzles()
  assert.ok(puzzles.length > 100, 'jeu de grilles représentatif')
  for (const { name, words } of puzzles) {
    assertValidCrossword(words, generateCrossword(words), name)
  }
})

test('CE1-CE2 : la grande majorité des mots est placée', () => {
  const puzzles = realPuzzles().filter(p => p.name.startsWith('CE1-CE2'))
  let total = 0, placed = 0
  for (const { words } of puzzles) {
    total += words.length
    placed += generateCrossword(words).placements.length
  }
  // Constat au 2026-10-06, mots composés exclus : 451 / 482 (93,6 %).
  // Seuil volontairement plus bas.
  assert.ok(placed / total >= 0.9, `${placed} / ${total} mots placés`)
})

test('génération déterministe : même liste, même grille', () => {
  const words = ['CHARRUE', 'HOUE', 'BECHE', 'PELLE', 'RATEAU']
  assert.deepEqual(generateCrossword(words), generateCrossword(words))
})

test('selectCrosswordWords : métadonnées et alternance bilingue', () => {
  const entries = [
    { id: 'a', mot_fr: 'Bêche', mot_en: 'Spade', def_fr: 'dfa', def_en: 'dea' },
    { id: 'b', mot_fr: 'Houe', mot_en: 'Hoe', def_fr: 'dfb', def_en: 'deb' },
    { id: 'c', mot_fr: 'arc-en-ciel', mot_en: 'Rainbow', def_fr: 'dfc', def_en: 'dec' }
  ]
  assert.deepEqual(selectCrosswordWords(entries, 'Bilingue'), [
    { text: 'BECHE', definition: 'dfa', wordId: 'a', wordLanguage: 'FR' },
    { text: 'HOE', definition: 'deb', wordId: 'b', wordLanguage: 'EN' }
  ])
  assert.deepEqual(selectCrosswordWords(entries, 'Anglais').map(d => d.text), ['SPADE', 'HOE', 'RAINBOW'])
  assert.deepEqual(selectCrosswordWords(entries, 'Français').map(d => d.wordId), ['a', 'b'])
})

test('selectCrosswordWords = oracle sur tout le vrai vocabulaire', () => {
  for (const { level, subject, type, entries } of allCombinations()) {
    assert.deepEqual(selectCrosswordWords(entries, type).map(d => d.text), wordsFor(entries, type), `${level} / ${subject} / ${type}`)
  }
})

test('sujet jouable = au moins 2 mots placés dans la grille qui sera proposée', () => {
  for (const { level, subject, type, entries } of allCombinations()) {
    const name = `${level} / ${subject} / ${type}`
    const words = wordsFor(entries, type)
    const placed = words.length < 2 ? 0 : generateCrossword(words).placements.length
    assert.equal(countPlacedWords(entries, type), placed, name)
    assert.equal(isPlayableCrossword(entries, type), placed >= MIN_PLACED_WORDS, name)
  }
  assert.equal(isPlayableCrossword([], 'Bilingue'), false)
})

test('sujets grisés connus (constat du 2026-10-06) et sujet jouable', () => {
  const entriesOf = (level, subject) => VOCAB
    .filter(v => v.niveau_fr === level && v.sujet === subject && v.actif !== false).slice(0, 12)
  // 1 seul mot placé sur 2 : « Terminer » serait affiché dès le départ
  for (const type of TYPES) assert.equal(isPlayableCrossword(entriesOf('CE1-CE2', 'Logiciels'), type), false, `Logiciels ${type}`)
  // moins de 2 mots après exclusion des mots composés
  for (const type of TYPES) assert.equal(isPlayableCrossword(entriesOf('SIL-CP', 'Lessive'), type), false, `Lessive ${type}`)
  for (const type of TYPES) assert.equal(isPlayableCrossword(entriesOf('CE1-CE2', 'Agriculture'), type), true, `Agriculture ${type}`)
})

test('crosswordSubjects : sujets du niveau seulement, triés, jouables comme isPlayableCrossword', () => {
  for (const level of LEVELS) {
    const levelEntries = VOCAB.filter(v => v.niveau_fr === level)
    const expected = [...new Set(levelEntries.filter(v => v.actif !== false).map(v => v.sujet))].sort()
    for (const type of TYPES) {
      const list = crosswordSubjects(levelEntries, type)
      assert.deepEqual(list.map(s => s.subject), expected, `${level} / ${type} : sujets du niveau`)
      for (const { subject, playable } of list) {
        const entries = levelEntries.filter(v => v.sujet === subject && v.actif !== false).slice(0, VOCAB_PER_GAME)
        assert.equal(playable, isPlayableCrossword(entries, type), `${level} / ${subject} / ${type}`)
      }
    }
  }
})

test('crosswordSubjects : entrée inactive ignorée, sujet sans entrée active absent', () => {
  const entries = [
    { id: '1', sujet: 'Ferme', mot_fr: 'VACHE', mot_en: 'COW', actif: true },
    { id: '2', sujet: 'Ferme', mot_fr: 'CHEVAL', mot_en: 'HORSE' },
    { id: '3', sujet: 'Cachée', mot_fr: 'POULE', mot_en: 'HEN', actif: false }
  ]
  assert.deepEqual(crosswordSubjects(entries, 'Français'), [{ subject: 'Ferme', playable: true }])
})

test('defaultCrosswordSubject : sujet courant gardé s\'il reste jouable, sinon premier jouable', () => {
  const list = [
    { subject: 'A', playable: false },
    { subject: 'B', playable: true },
    { subject: 'C', playable: true }
  ]
  assert.equal(defaultCrosswordSubject(list, ''), 'B', 'premier affichage')
  assert.equal(defaultCrosswordSubject(list, 'C'), 'C', 'sujet courant jouable gardé')
  assert.equal(defaultCrosswordSubject(list, 'A'), 'B', 'sujet courant grisé remplacé')
  assert.equal(defaultCrosswordSubject(list, 'Z'), 'B', 'sujet absent du niveau remplacé')
  assert.equal(defaultCrosswordSubject([{ subject: 'A', playable: false }], 'A'), '', 'aucun sujet jouable')
  assert.equal(defaultCrosswordSubject([], ''), '')
})

test('vrai vocabulaire : un sujet par défaut jouable pour chaque niveau et type', () => {
  for (const level of LEVELS) {
    for (const type of TYPES) {
      const list = crosswordSubjects(VOCAB.filter(v => v.niveau_fr === level), type)
      const chosen = defaultCrosswordSubject(list, '')
      assert.ok(list.some(s => s.subject === chosen && s.playable), `${level} / ${type} : ${chosen}`)
    }
  }
})

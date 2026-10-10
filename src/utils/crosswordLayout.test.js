// Tests du placement et de la numérotation des mots croisés — lancer avec : node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  generateCrossword,
  sanitizeWord,
  normalizeTypedLetter,
  selectCrosswordWords,
  isPlayableCrossword,
  createCrosswordGame,
  domainWords,
  matchesDomain,
  PLAYABILITY_SEED,
  MAX_GRID_ATTEMPTS,
  crosswordSubjects,
  defaultCrosswordSubject,
  backspaceAction,
  letterCountLabel,
  isWordComplete,
  answerChanges,
  MIN_WORD_LENGTH,
  MIN_PLACED_WORDS,
  GRID_SIZE,
  MAX_WORD_LENGTH,
  MAX_WORDS
} from './crosswordLayout.js'

const STEP = { across: [0, 1], down: [1, 0] }
const LEVELS = ['SIL-CP', 'CE1-CE2', 'CM1-CM2']
const TYPES = ['Bilingue', 'Français', 'Anglais']

// Forme de grille simple d'un texte (oracle) : majuscules sans accents
const plain = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '')

// Oracle indépendant de selectCrosswordWords : 10 mots au plus, 3 lettres
// minimum, sans doublon, ni mot identique (au pluriel S, X, AL/AUX près) à un mot du
// domaine de son entrée ; mots vides ou trop longs ignorés, bilingue =
// alternance FR / EN.
function wordsFor(entries, puzzleType) {
  const texts = []
  for (let idx = 0; idx < entries.length && texts.length < MAX_WORDS; idx++) {
    const w = entries[idx]
    let text
    if (puzzleType === 'Français') text = sanitizeWord(w.mot_fr)
    else if (puzzleType === 'Anglais') text = sanitizeWord(w.mot_en)
    else text = sanitizeWord(idx % 2 === 0 ? w.mot_fr : w.mot_en)
    if (!text || text.length < 3 || text.length > MAX_WORD_LENGTH || texts.includes(text)) continue
    const domain = String(w.sujet || '').split(/[/\s'’-]+/).map(plain).filter(d => d.length >= 3)
    const plural = (a, b) => b === a + 'S' || b === a + 'X' || (a.endsWith('AL') && b === a.slice(0, -2) + 'AUX')
    if (domain.some(d => d === text || plural(text, d) || plural(d, text))) continue
    texts.push(text)
  }
  return texts
}

const VOCAB = JSON.parse(readFileSync(new URL('../data/vocabulaire.json', import.meta.url), 'utf8'))

// Toutes les combinaisons niveau x sujet x type, avec toutes les entrées
// actives du sujet (comme CrosswordGame.jsx)
function allCombinations() {
  const combos = []
  for (const level of LEVELS) {
    const active = VOCAB.filter(v => v.niveau_fr === level && v.actif !== false)
    for (const subject of new Set(active.map(v => v.sujet))) {
      const entries = active.filter(v => v.sujet === subject)
      for (const type of TYPES) combos.push({ level, subject, type, entries })
    }
  }
  return combos
}

// Grilles réellement proposées dans le jeu (niveau x sujet x type), pour
// quelques graines, avec le vrai vocabulaire (createCrosswordGame).
const PUZZLE_SEEDS = [0, 1, 2, 123456789, 4294967295]
function realPuzzles() {
  const puzzles = []
  for (const { level, subject, type, entries } of allCombinations()) {
    for (const seed of PUZZLE_SEEDS) {
      const game = createCrosswordGame(entries, type, seed)
      if (game) puzzles.push({ name: `${level} / ${subject} / ${type} / graine ${seed}`, words: game.wordsData.map(d => d.text), game })
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
  for (const { name, words, game } of puzzles) {
    assertValidCrossword(words, game, name)
    assert.deepEqual(game.placements, generateCrossword(words).placements, `${name} : grille = placement des mots tirés`)
  }
})

test('CE1-CE2 : la grande majorité des mots est placée', () => {
  const puzzles = realPuzzles().filter(p => p.name.startsWith('CE1-CE2'))
  let total = 0, placed = 0
  for (const { words } of puzzles) {
    total += words.length
    placed += generateCrossword(words).placements.length
  }
  // Constat au 2026-10-07 (tirage par graine, 5 graines) : environ 94 %.
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

test('sujet jouable = une grille d\'au moins 2 mots pour la graine de contrôle', () => {
  for (const { level, subject, type, entries } of allCombinations()) {
    const name = `${level} / ${subject} / ${type}`
    const game = createCrosswordGame(entries, type, PLAYABILITY_SEED)
    assert.equal(isPlayableCrossword(entries, type), game !== null, name)
    if (game) assert.ok(game.placements.length >= MIN_PLACED_WORDS, name)
  }
  assert.equal(isPlayableCrossword([], 'Bilingue'), false)
})

test('sujets grisés connus (constat du 2026-10-09, complément v0.5 intégré) et sujets jouables', () => {
  const entriesOf = (level, subject) => VOCAB
    .filter(v => v.niveau_fr === level && v.sujet === subject && v.actif !== false)
  // toujours grisés : un seul mot utilisable (INFORMATION et LANGUE écartés par la règle du titre)
  for (const type of TYPES) assert.equal(isPlayableCrossword(entriesOf('CE1-CE2', 'Information'), type), false, `Information ${type}`)
  assert.equal(isPlayableCrossword(entriesOf('CM1-CM2', 'Langue / Culture'), 'Français'), false, 'Langue / Culture Français')
  // grisés avant le complément, jouables après
  for (const type of TYPES) assert.equal(isPlayableCrossword(entriesOf('CE1-CE2', 'Logiciels'), type), true, `Logiciels ${type}`)
  for (const type of TYPES) assert.equal(isPlayableCrossword(entriesOf('SIL-CP', 'Lessive'), type), true, `Lessive ${type}`)
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
        const entries = levelEntries.filter(v => v.sujet === subject && v.actif !== false)
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

test('backspaceAction : Retour arrière comme dans un mots croisés', () => {
  // Grille : CHAT horizontal, croisé sur sa 2e lettre (H) par HIBOU vertical
  const words = ['CHAT', 'HIBOU']
  const { grid, placements } = generateCrossword(words)
  const chat = placements.find(p => p.word === 'CHAT')
  const hibou = placements.find(p => p.word === 'HIBOU')
  assert.ok(chat && hibou, 'les deux mots sont placés')
  const [c0, c1, c2] = chat.cells
  const answers = { [c0.join('-')]: 'C', [c1.join('-')]: 'H' }

  // case remplie : effacée, la sélection ne bouge pas
  assert.deepEqual(backspaceAction(grid, answers, ...c1, 'across'), { clear: c1, select: null })
  // case vide : recule d'une case dans le sens du mot et l'efface
  assert.deepEqual(backspaceAction(grid, answers, ...c2, 'across'), { clear: c1, select: c1 })
  // début de mot vide : rien
  assert.deepEqual(backspaceAction(grid, {}, ...c0, 'across'), { clear: null, select: null })
  // sens vertical : recule vers le haut, y compris sur la case de croisement
  const [h0, h1] = hibou.cells
  assert.deepEqual(backspaceAction(grid, { [h0.join('-')]: 'H' }, ...h1, 'down'), { clear: h0, select: h0 })
  // début du mot vertical vide : rien (la case au-dessus est hors mot)
  assert.deepEqual(backspaceAction(grid, {}, ...h0, 'down'), { clear: null, select: null })
})

test('selectCrosswordWords : 3 lettres minimum (décision du 2026-10-05)', () => {
  assert.equal(MIN_WORD_LENGTH, 3)
  const entries = [
    { id: 'pi', mot_fr: 'PI', mot_en: 'Pi', def_fr: 'Nombre pi', def_en: 'Pi' },
    { id: 'axe', mot_fr: 'AXE', mot_en: 'Axis', def_fr: 'Droite', def_en: 'Line' },
    { id: 'rayon', mot_fr: 'RAYON', mot_en: 'Radius', def_fr: 'Segment', def_en: 'Segment' }
  ]
  assert.deepEqual(selectCrosswordWords(entries, 'Français').map(d => d.text), ['AXE', 'RAYON'])
  // vrai vocabulaire : « PI » (CM1-CM2 / Cercle) n'est plus retenu
  const cercle = VOCAB.filter(v => v.niveau_fr === 'CM1-CM2' && v.sujet === 'Cercle' && v.actif !== false).slice(0, 12)
  for (const type of TYPES) {
    assert.ok(selectCrosswordWords(cercle, type).every(d => d.text.length >= 3), `Cercle ${type}`)
  }
})

test('selectCrosswordWords : pas de mot en double, la 2e occurrence est écartée', () => {
  const entries = [
    { id: 'a', mot_fr: 'Ballon', mot_en: 'Ball', def_fr: 'df a', def_en: 'de a' },
    { id: 'b', mot_fr: 'Poupée', mot_en: 'Doll', def_fr: 'df b', def_en: 'de b' },
    { id: 'c', mot_fr: 'Balle', mot_en: 'BALL', def_fr: 'df c', def_en: 'de c' }
  ]
  assert.deepEqual(selectCrosswordWords(entries, 'Anglais').map(d => d.wordId), ['a', 'b'])
  // doublon après normalisation (accents)
  const accents = [
    { id: 'x', mot_fr: 'Été', mot_en: 'Summer' },
    { id: 'y', mot_fr: 'ETE', mot_en: 'Summer' }
  ]
  assert.deepEqual(selectCrosswordWords(accents, 'Français').map(d => d.wordId), ['x'])
  // vrai vocabulaire : aucune grille ne contient deux fois le même mot
  for (const { level, subject, type, entries: e } of allCombinations()) {
    const texts = selectCrosswordWords(e, type).map(d => d.text)
    assert.equal(new Set(texts).size, texts.length, `${level} / ${subject} / ${type}`)
  }
})

test('letterCountLabel : le nombre seul entre parenthèses, « (7) »', () => {
  assert.equal(letterCountLabel(7), '(7)')
  assert.equal(letterCountLabel(3), '(3)')
  assert.equal(letterCountLabel(12), '(12)')
})

test('answerChanges : mot trouvé, puis lettre effacée (croisement : deux mots perdus)', () => {
  const { placements } = generateCrossword(['CHAT', 'HIBOU'])
  const chat = placements.find(p => p.word === 'CHAT')
  const hibou = placements.find(p => p.word === 'HIBOU')
  const fill = (p, answers) => p.cells.forEach(([r, c], i) => { answers[`${r}-${c}`] = p.word[i] })
  const full = {}
  fill(chat, full); fill(hibou, full)
  assert.ok(isWordComplete(chat, full) && isWordComplete(hibou, full))

  // dernière lettre de CHAT tapée : CHAT trouvé
  const [lr, lc] = chat.cells[3]
  const before = { ...full, [`${lr}-${lc}`]: '' }
  assert.deepEqual(answerChanges(placements, before, full, lr, lc).found.map(p => p.word), ['CHAT'])

  // lettre propre à CHAT effacée : seul CHAT est perdu
  const erased = { ...full, [`${lr}-${lc}`]: '' }
  const r1 = answerChanges(placements, full, erased, lr, lc)
  assert.deepEqual(r1.lost.map(p => p.word), ['CHAT'])
  assert.deepEqual(r1.found, [])

  // lettre de croisement (H) effacée : les deux mots sont perdus
  const [xr, xc] = chat.cells[1]
  const r2 = answerChanges(placements, full, { ...full, [`${xr}-${xc}`]: '' }, xr, xc)
  assert.deepEqual(r2.lost.map(p => p.word).sort(), ['CHAT', 'HIBOU'])

  // lettre remplacée par une autre : perdu aussi
  const r3 = answerChanges(placements, full, { ...full, [`${lr}-${lc}`]: 'X' }, lr, lc)
  assert.deepEqual(r3.lost.map(p => p.word), ['CHAT'])
})

test('createCrosswordGame : même graine, même grille ; graine affichée rejouable', () => {
  const entries = VOCAB.filter(v => v.niveau_fr === 'CE1-CE2' && v.sujet === 'Maison' && v.actif !== false)
  for (const seed of [0, 7, 99999, 4294967295]) {
    const a = createCrosswordGame(entries, 'Bilingue', seed)
    const b = createCrosswordGame(entries, 'Bilingue', seed)
    assert.deepEqual(a, b, `graine ${seed}`)
    // la graine finale (affichée « Grille n° ») redonne la même grille
    const again = createCrosswordGame(entries, 'Bilingue', a.seed)
    assert.deepEqual(again.placements, a.placements)
    assert.equal(again.seed, a.seed)
    assert.equal(again.attempts, 1)
  }
  // l'ordre des données ne change pas la grille (tri par id avant tirage)
  assert.deepEqual(createCrosswordGame([...entries].reverse(), 'Français', 42), createCrosswordGame(entries, 'Français', 42))
})

test('createCrosswordGame : variété entre graines et toutes les entrées atteignables', () => {
  // grand sujet : CE1-CE2 / Maison (28 entrées)
  const entries = VOCAB.filter(v => v.niveau_fr === 'CE1-CE2' && v.sujet === 'Maison' && v.actif !== false)
  assert.ok(entries.length > MAX_WORDS, 'sujet plus grand qu\'une grille')
  const grids = new Set()
  const reached = new Set()
  for (let seed = 0; seed < 200; seed++) {
    const game = createCrosswordGame(entries, 'Français', seed)
    grids.add(game.placements.map(p => p.word).sort().join(','))
    game.placements.forEach(p => reached.add(game.wordsData[p.wordIdx].wordId))
  }
  assert.ok(grids.size >= 150, `${grids.size} grilles différentes sur 200 graines`)
  // toute entrée qui donne un mot utilisable apparaît dans au moins une grille
  const usable = entries.filter(e => selectCrosswordWords([e], 'Français').length === 1).map(e => e.id)
  assert.deepEqual(usable.filter(id => !reached.has(id)), [], 'entrées jamais tirées')
})

test('grisage vrai : sujet jouable -> grille d\'au moins 2 mots pour toute graine essayée ; sujet grisé -> aucune', () => {
  const seeds = Array.from({ length: 8 }, (_, i) => (i * 2654435761) >>> 0)
  for (const { level, subject, type, entries } of allCombinations()) {
    const name = `${level} / ${subject} / ${type}`
    const playable = isPlayableCrossword(entries, type)
    for (const seed of seeds) {
      const game = createCrosswordGame(entries, type, seed)
      if (playable) assert.ok(game && game.placements.length >= MIN_PLACED_WORDS, `${name} graine ${seed}`)
      else assert.equal(game, null, `${name} graine ${seed}`)
    }
  }
  assert.equal(MAX_GRID_ATTEMPTS, 20)
})

test('mot identique au domaine du titre écarté (décision du 2026-10-07)', () => {
  assert.deepEqual(domainWords('Matière / Mélanges'), ['MATIERE', 'MELANGES'])
  assert.deepEqual(domainWords('Résolution de problèmes'), ['RESOLUTION', 'PROBLEMES'])
  assert.deepEqual(domainWords('Utilisation de l’ordinateur'), ['UTILISATION', 'ORDINATEUR'])
  assert.equal(matchesDomain('MAISON', 'Maison'), true)
  assert.equal(matchesDomain('MELANGE', 'Matière / Mélanges'), true, 'singulier / pluriel')
  assert.equal(matchesDomain('FRACTIONS', 'Fraction'), true, 'pluriel / singulier')
  assert.equal(matchesDomain('CULTURE', 'Musique / Culture'), true, 'sujet double')
  assert.equal(matchesDomain('JARDIN', 'Jardinage'), false, 'début de mot seulement')
  assert.equal(matchesDomain('TABLE', 'Maison'), false)
  const entries = [
    { id: '1', sujet: 'Maison', mot_fr: 'Maison', mot_en: 'House' },
    { id: '2', sujet: 'Maison', mot_fr: 'Table', mot_en: 'Table' },
    { id: '3', sujet: 'Maison', mot_fr: 'Porte', mot_en: 'Door' }
  ]
  assert.deepEqual(selectCrosswordWords(entries, 'Français').map(d => d.text), ['TABLE', 'PORTE'])
  assert.deepEqual(selectCrosswordWords(entries, 'Anglais').map(d => d.text), ['HOUSE', 'TABLE', 'DOOR'])
  // vrai vocabulaire : aucun mot retenu n'est identique à son domaine
  for (const { level, subject, type, entries: e } of allCombinations()) {
    for (const d of selectCrosswordWords(e, type)) {
      assert.equal(matchesDomain(d.text, subject), false, `${level} / ${subject} / ${type} : ${d.text}`)
    }
  }
})

test('mot identique au domaine : pluriels en -X et -AUX (décision du 2026-10-09)', () => {
  assert.equal(matchesDomain('JEU', 'Jeux'), true)
  assert.equal(matchesDomain('JEUX', 'Jeu'), true, 'dans les deux sens')
  assert.equal(matchesDomain('DECIMAL', 'Nombres décimaux'), true)
  assert.equal(matchesDomain('ANIMAL', 'Animaux'), true)
  assert.equal(matchesDomain('CHEVAUX', 'Cheval'), true, 'dans les deux sens')
  // pas de faux positif sur des mots seulement proches
  assert.equal(matchesDomain('JEUNE', 'Jeux'), false)
  assert.equal(matchesDomain('ANIMATION', 'Animaux'), false)
  assert.equal(matchesDomain('DECIMALE', 'Nombres décimaux'), false)
  assert.equal(matchesDomain('AUX', 'Jeux'), false)
  // vrai vocabulaire : JEU (SIL-CP / Jeux) et DECIMAL (CM1-CM2 / Nombres décimaux) ne sont plus retenus
  const words = (level, subject) => VOCAB.filter(v => v.niveau_fr === level && v.sujet === subject && v.actif !== false)
  for (const type of TYPES) {
    assert.ok(!selectCrosswordWords(words('SIL-CP', 'Jeux'), type).some(d => d.text === 'JEU'), `Jeux ${type}`)
    assert.ok(!selectCrosswordWords(words('CM1-CM2', 'Nombres décimaux'), type).some(d => d.text === 'DECIMAL'), `Nombres décimaux ${type}`)
  }
})

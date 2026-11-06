// Tests de la mémoire (cartes face cachée) du moteur C « Paires » : L6 (mémoire
// FR ↔ EN) et M7 (mémoire des tables), lot B de la phase 4 — lancer avec : npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  pairKey,
  createMemoryBoard,
  createMemoryState,
  flipCard,
  closeMismatch,
  isFaceUp,
  isFinished,
  pairsScore,
  foundCount,
  colorIndex,
  memoryPairCount,
  memorySubjects,
  translationSubjects,
  createVocabularyMemoryGame,
  createTranslationGame,
  multiplicationCandidate,
  multiplicationCandidates,
  multiplicationSetup,
  multiplicationGuaranteed,
  singleTableOptions,
  createMultiplicationMemoryGame,
  memoryPairText,
  MEMORY_SETTINGS,
  MEMORY_LEVELS,
  MEMORY_SIDES,
  MULTIPLICATION_SIDES,
  MULTIPLICATION_FACTORS,
  MAX_TRIVIAL_OPERATIONS,
  MAX_SAME_WORD_PAIRS,
  MISMATCH_DELAY_MS,
  POINTS_PER_PAIR,
  GAME_TYPE_TRANSLATION,
  GAME_TYPE_MEMORY,
  GAME_TYPE_MULTIPLICATION
} from './pairsGame.js'
import { MATH_CLASSES } from '../data/reglages-maths.js'

const vocabulaire = JSON.parse(readFileSync(new URL('../data/vocabulaire.json', import.meta.url), 'utf8'))
const SEEDS = 20 // graines de contrôle par sujet (L6)
const MATH_SEEDS = 200 // graines de contrôle par réglage (M7, calcul rapide)

const levelEntries = (level) => vocabulaire.filter(v => v.niveau_fr === level)
const subjectEntries = (level, subject) => vocabulaire.filter(v => v.niveau_fr === level && v.sujet === subject && v.actif !== false)

// Joue toute une partie sans erreur : renvoie l'état final et les résultats
function playPerfect(game) {
  let state = createMemoryState()
  const results = []
  for (const pair of game.pairs) {
    for (const card of game.cards.filter(c => c.pairId === pair.id)) {
      const r = flipCard(state, card)
      state = r.state
      results.push(r.result)
    }
  }
  return { state, results }
}

// Clés de comparaison des cartes d'une partie. Les deux cartes d'une paire
// « mot identique » (P11 b, au plus une par partie : TOTAL / TOTAL) comptent
// pour une seule clé : elles sont distinguées par l'étiquette de langue.
const cardKeys = (game) => {
  const keys = []
  for (const p of game.pairs) {
    const own = [...new Set(Object.values(p.sides).map(side => pairKey(side.text)))]
    if (!p.restricted) assert.equal(own.length, 2, `${p.id} : cartes identiques hors paire restreinte`)
    keys.push(...own)
  }
  return keys
}
// Textes affichés tels quels (M7 : « 2 × 4 » et « 24 » sont différents)
const cardTexts = (game) => game.cards.map(c => game.pairs.find(p => p.id === c.pairId).sides[c.side].text)

test('Réglages : 4 / 6 / 6 paires (P3), 10 points, gameType séparés, délai, opérations triviales', () => {
  assert.deepEqual(MEMORY_LEVELS, ['SIL-CP', 'CE1-CE2', 'CM1-CM2'])
  assert.deepEqual(MEMORY_LEVELS.map(memoryPairCount), [4, 6, 6])
  assert.equal(MEMORY_SETTINGS['SIL-CP'].pairCount, 4)
  assert.throws(() => memoryPairCount('CM3'), RangeError)
  assert.equal(POINTS_PER_PAIR, 10)
  assert.equal(GAME_TYPE_MEMORY, 'pairsMemory')
  assert.equal(GAME_TYPE_MULTIPLICATION, 'pairsMultiplication')
  assert.notEqual(GAME_TYPE_MEMORY, GAME_TYPE_TRANSLATION)
  assert.equal(MAX_TRIVIAL_OPERATIONS, 1)
  assert.ok(MISMATCH_DELAY_MS > 0 && MISMATCH_DELAY_MS <= 2000)
  assert.deepEqual([...MULTIPLICATION_FACTORS], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
})

test('Plateau : deux cartes par paire, clés uniques, même graine = même plateau, paramètres contrôlés', () => {
  const candidates = ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, keys: [`k:${id}`], restricted: false }))
  const board = createMemoryBoard(candidates, 4, 123, ['x', 'y'])
  assert.equal(board.pairs.length, 4)
  assert.equal(board.cards.length, 8)
  assert.equal(new Set(board.cards.map(c => c.key)).size, 8)
  for (const p of board.pairs) {
    assert.deepEqual(board.cards.filter(c => c.pairId === p.id).map(c => c.side).sort(), ['x', 'y'])
  }
  assert.deepEqual(createMemoryBoard(candidates, 4, 123, ['x', 'y']), board)
  // Une autre graine change au moins une partie sur 20
  const others = Array.from({ length: 20 }, (_, i) => JSON.stringify(createMemoryBoard(candidates, 4, i, ['x', 'y']).cards))
  assert.ok(new Set(others).size > 1)
  assert.equal(createMemoryBoard(candidates, 6, 1, ['x', 'y']), null)
  assert.throws(() => createMemoryBoard(candidates, 4, -1, ['x', 'y']), RangeError)
  assert.throws(() => createMemoryBoard(candidates, 0, 1, ['x', 'y']), RangeError)
  assert.throws(() => createMemoryBoard(candidates, 4, 1, ['x', 'x']), RangeError)
})

test('Retournement : première carte, paire trouvée, mauvaise paire refermée, coups, points, sans pénalité', () => {
  const candidates = ['a', 'b', 'c'].map(id => ({ id, keys: [`k:${id}`], restricted: false }))
  const game = createMemoryBoard(candidates, 3, 7, ['x', 'y'])
  const card = (pairId, side) => game.cards.find(c => c.pairId === pairId && c.side === side)
  let s = createMemoryState()
  assert.deepEqual({ open: s.open, moves: s.moves, resolved: s.resolved }, { open: [], moves: 0, resolved: [] })

  // Première carte
  let r = flipCard(s, card('a', 'x'))
  assert.equal(r.result, 'first')
  s = r.state
  assert.equal(isFaceUp(s, card('a', 'x')), true)
  assert.equal(isFaceUp(s, card('a', 'y')), false)
  // Même carte touchée à nouveau : rien
  assert.equal(flipCard(s, card('a', 'x')).result, 'ignored')
  // Mauvaise paire : deux cartes ouvertes, un coup, 0 point
  r = flipCard(s, card('b', 'y'))
  assert.equal(r.result, 'mismatch')
  s = r.state
  assert.equal(s.moves, 1)
  assert.equal(s.open.length, 2)
  assert.equal(pairsScore(s), 0)
  // Délai écoulé : elles se referment (l'interface appelle closeMismatch)
  assert.deepEqual(closeMismatch(s).open, [])
  assert.equal(closeMismatch(closeMismatch(s)).open.length, 0)
  // Toucher une des deux cartes ouvertes les referme plus tôt (pas un coup)
  r = flipCard(s, card('b', 'y'))
  assert.equal(r.result, 'closed')
  assert.deepEqual(r.state.open, [])
  assert.equal(r.state.moves, 1)
  // Toucher une autre carte : les deux se referment et celle-ci s'ouvre
  r = flipCard(s, card('c', 'x'))
  assert.equal(r.result, 'first')
  assert.deepEqual(r.state.open.map(o => o.key), [card('c', 'x').key])
  s = r.state
  // Paire trouvée : 10 points, cartes ouvertes définitivement, couleur 0
  r = flipCard(s, card('c', 'y'))
  assert.equal(r.result, 'match')
  s = r.state
  assert.equal(s.moves, 2)
  assert.equal(pairsScore(s), 10)
  assert.equal(colorIndex(s, 'c'), 0)
  assert.equal(isFaceUp(s, card('c', 'x')), true)
  assert.equal(flipCard(s, card('c', 'y')).result, 'ignored')
  assert.equal(isFinished(game, s), false)
})

test('Fin de partie : toutes les paires, score = 10 × paires, plus aucun retournement (une seule sauvegarde)', () => {
  const game = createVocabularyMemoryGame(subjectEntries('SIL-CP', 'Fruits'), 'SIL-CP', 555, 'fr')
  const { state, results } = playPerfect(game)
  assert.equal(isFinished(game, state), true)
  assert.equal(foundCount(state), 4)
  assert.equal(pairsScore(state), 40)
  assert.equal(state.moves, 4)
  // Exactement un « match » par paire : la dernière paire n'est signalée qu'une fois
  assert.equal(results.filter(r => r === 'match').length, 4)
  // Partie finie : toute carte est ignorée, aucun nouvel événement « match »
  for (const c of game.cards) assert.equal(flipCard(state, c).result, 'ignored')
})

test('L6 : mêmes sujets que L3 au même nombre de paires ; sujet injouable = null', () => {
  for (const level of MEMORY_LEVELS) {
    const entries = levelEntries(level)
    const mem = memorySubjects(entries, level)
    const l3 = translationSubjects(entries, level)
    assert.deepEqual(mem.map(s => s.subject), l3.map(s => s.subject))
    // Même nombre garanti (mêmes candidats, mêmes règles), seuil différent
    assert.deepEqual(mem.map(s => s.usable), l3.map(s => s.usable))
    for (const s of mem) assert.equal(s.playable, s.usable >= memoryPairCount(level))
    const injouable = mem.find(s => !s.playable)
    if (injouable) assert.equal(createVocabularyMemoryGame(subjectEntries(level, injouable.subject), level, 1), null)
  }
})

test('L6 : chaque sujet jouable, 20 graines : partie complète, cartes de textes tous différents, au plus 1 paire FR = EN', () => {
  let games = 0
  for (const level of MEMORY_LEVELS) {
    const count = memoryPairCount(level)
    for (const { subject, playable } of memorySubjects(levelEntries(level), level)) {
      if (!playable) continue
      const entries = subjectEntries(level, subject)
      for (let seed = 0; seed < SEEDS; seed++) {
        const g = createVocabularyMemoryGame(entries, level, seed, 'fr')
        assert.ok(g, `${level} ${subject} ${seed}`)
        assert.equal(g.pairs.length, count)
        assert.equal(g.cards.length, 2 * count)
        const keys = cardKeys(g)
        assert.equal(new Set(keys).size, keys.length, `${level} ${subject} ${seed} : deux cartes de même texte`)
        assert.ok(g.pairs.filter(p => p.restricted).length <= MAX_SAME_WORD_PAIRS)
        games++
      }
    }
  }
  assert.ok(games > 1000)
})

test('L6 : même numéro = mêmes cartes aux mêmes places en français et en anglais ; carte de l\'interface mise en avant', () => {
  const entries = subjectEntries('CE1-CE2', 'Commerce')
  const fr = createVocabularyMemoryGame(entries, 'CE1-CE2', 4242, 'fr')
  const en = createVocabularyMemoryGame(entries, 'CE1-CE2', 4242, 'en')
  assert.deepEqual(en.cards, fr.cards)
  assert.deepEqual(en.pairs, fr.pairs)
  assert.deepEqual([...MEMORY_SIDES], ['fr', 'en'])
  assert.equal(fr.primarySide, 'fr')
  assert.equal(en.primarySide, 'en')
  assert.deepEqual(en.sideOrder, ['en', 'fr'])
  const p = fr.pairs[0]
  assert.equal(memoryPairText(fr, p), `${p.sides.fr.text} = ${p.sides.en.text}`)
  assert.equal(memoryPairText(en, p), `${p.sides.en.text} = ${p.sides.fr.text}`)
  // P8 : majuscules, accents et espaces gardés
  for (const pair of fr.pairs) {
    for (const side of MEMORY_SIDES) assert.equal(pair.sides[side].text, pair.sides[side].text.toLocaleUpperCase('fr-FR'))
  }
  // Mêmes paires que L3 n'est pas exigé (nombre de paires différent), mais même candidat = même texte
  const l3 = createTranslationGame(entries, 'CE1-CE2', 4242, 'fr')
  for (const pair of l3.pairs) {
    const same = fr.pairs.find(x => x.id === pair.id)
    if (same) assert.equal(same.sides.fr.text, pair.left.text)
  }
})

test('M7 : tables par classe (SIL inclus, Class 1-2 sans table), table de 1 hors de l\'option « une seule table »', () => {
  assert.deepEqual(multiplicationSetup({ className: 'SIL', subsystem: 'fr' }).tables, [1, 2])
  assert.deepEqual(multiplicationSetup({ className: 'CP', subsystem: 'fr' }).tables, [1, 2, 4, 5])
  assert.deepEqual(multiplicationSetup({ className: 'Class 3', subsystem: 'en' }).tables, [1, 2, 3, 4, 5, 6, 7])
  assert.equal(multiplicationSetup({ className: 'SIL', subsystem: 'fr' }).count, 4)
  assert.equal(multiplicationSetup({ className: 'CE1', subsystem: 'fr' }).count, 6)
  for (const c of ['Class 1', 'Class 2']) {
    assert.equal(multiplicationSetup({ className: c, subsystem: 'en' }).status, 'no-table')
    assert.equal(createMultiplicationMemoryGame({ className: c, subsystem: 'en', seed: 1 }), null)
  }
  assert.deepEqual(singleTableOptions([1, 2]), [2])
  assert.deepEqual(singleTableOptions([1, 2, 4, 5]), [2, 4, 5])
  assert.throws(() => multiplicationSetup({ className: 'SIL', subsystem: 'fr', table: 1 }), RangeError)
  assert.throws(() => multiplicationSetup({ className: 'SIL', subsystem: 'fr', table: 3 }), RangeError)
  assert.throws(() => multiplicationSetup({ className: 'CM3', subsystem: 'fr' }), RangeError)
  const c = multiplicationCandidate(3, 4)
  assert.deepEqual({ id: c.id, operation: c.operation, result: c.result, keys: c.keys, restricted: c.restricted },
    { id: '3×4', operation: '3 × 4', result: '12', keys: ['p:12'], restricted: false })
  assert.equal(multiplicationCandidate(1, 7).restricted, true)
  assert.equal(multiplicationCandidate(7, 1).restricted, true)
  assert.equal(multiplicationCandidates([2, 1, 2]).length, 20)
})

test('M7 : chaque classe, toutes les tables et chaque table seule, 200 graines : produits distincts, au plus 1 opération triviale', () => {
  let games = 0
  for (const subsystem of Object.keys(MATH_CLASSES)) {
    for (const cls of MATH_CLASSES[subsystem]) {
      if (cls.tables.length === 0) continue
      const choices = [null, ...singleTableOptions(cls.tables)]
      for (const table of choices) {
        const setup = multiplicationSetup({ className: cls.className, subsystem, table })
        assert.ok(multiplicationGuaranteed(setup) >= setup.count, `${cls.className} ${table}`)
        for (let seed = 0; seed < MATH_SEEDS; seed++) {
          const g = createMultiplicationMemoryGame({ className: cls.className, subsystem, table, seed })
          assert.ok(g, `${cls.className} ${table} ${seed}`)
          assert.equal(g.pairs.length, memoryPairCount(cls.level))
          assert.equal(g.level, cls.level)
          const products = g.pairs.map(p => p.product)
          assert.equal(new Set(products).size, products.length, `${cls.className} ${table} ${seed} : produits égaux`)
          const texts = cardTexts(g)
          assert.equal(new Set(texts).size, texts.length)
          assert.ok(g.pairs.filter(p => p.restricted).length <= MAX_TRIVIAL_OPERATIONS)
          for (const p of g.pairs) {
            assert.ok(g.tables.includes(p.table))
            assert.ok(p.factor >= 1 && p.factor <= 10)
            assert.equal(p.sides.op.text, `${p.table} × ${p.factor}`)
            assert.equal(p.sides.res.text, String(p.table * p.factor))
            assert.equal(p.id, `${p.table}×${p.factor}`)
          }
          if (table !== null) assert.ok(g.pairs.every(p => p.table === table))
          games++
        }
      }
    }
  }
  assert.ok(games > 5000)
})

test('M7 : même numéro = même partie ; partie complète jouée', () => {
  const a = createMultiplicationMemoryGame({ className: 'CE1', subsystem: 'fr', seed: 2024 })
  const b = createMultiplicationMemoryGame({ className: 'CE1', subsystem: 'fr', seed: 2024 })
  assert.deepEqual(a, b)
  assert.deepEqual([...MULTIPLICATION_SIDES], ['op', 'res'])
  assert.deepEqual(a.sideOrder, ['op', 'res'])
  assert.deepEqual(a.tables, [1, 2, 3, 4, 5])
  assert.equal(a.table, null)
  const { state } = playPerfect(a)
  assert.equal(isFinished(a, state), true)
  assert.equal(pairsScore(state), 60)
  assert.equal(state.moves, 6)
  const p = a.pairs[0]
  assert.equal(memoryPairText(a, p), `${p.table} × ${p.factor} = ${p.product}`)
  // SIL, tables 1 et 2 mêlées : la table de 1 au plus une fois
  for (let seed = 0; seed < 50; seed++) {
    const g = createMultiplicationMemoryGame({ className: 'SIL', subsystem: 'fr', seed })
    assert.ok(g.pairs.filter(x => x.table === 1).length <= 1)
  }
})

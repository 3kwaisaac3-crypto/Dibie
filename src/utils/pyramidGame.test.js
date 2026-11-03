// Tests des pyramides additives et multiplicatives et des réglages de calcul
// par classe — lancer avec : npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createPyramidGame,
  buildPyramid,
  solvePyramid,
  cellHint,
  cellCount,
  cellIndex,
  cellPosition,
  pyramidSettings,
  availableOperations,
  multiplicativeBases,
  pyramidCellId,
  maxDigits,
  digitGroups,
  pyramidScore,
  canShowAnswer,
  TRIES_BEFORE_ANSWER,
  POINTS_PER_CELL,
  PYRAMID_SETTINGS,
  PYRAMIDS_PER_GAME,
  MAX_ONES,
  MIN_ADD_BASE
} from './pyramidGame.js'
import { MATH_CLASSES, MATH_SUBSYSTEMS, mathClassSettings, resolveMathClass } from '../data/reglages-maths.js'
import { classesOf, PROFILE_LEVELS } from '../db/index.js'

const SEEDS = 250

// Toutes les combinaisons proposées : classe, sous-système, opération
const CONFIGS = MATH_SUBSYSTEMS.flatMap(subsystem => MATH_CLASSES[subsystem].flatMap(c =>
  availableOperations(c.className, subsystem).map(operation => ({ className: c.className, subsystem, operation }))))

// Rang d'une matrice (élimination de Gauss, petits entiers)
function rank(matrix) {
  const m = matrix.map(r => [...r])
  let rk = 0
  const cols = m[0]?.length ?? 0
  for (let c = 0; c < cols && rk < m.length; c++) {
    let pivot = m.findIndex((r, i) => i >= rk && Math.abs(r[c]) > 1e-9)
    if (pivot === -1) continue
    ;[m[rk], m[pivot]] = [m[pivot], m[rk]]
    for (let i = 0; i < m.length; i++) {
      if (i === rk) continue
      const f = m[i][c] / m[rk][c]
      for (let j = c; j < cols; j++) m[i][j] -= f * m[rk][j]
    }
    rk++
  }
  return rk
}

// Coefficients de chaque case en fonction de la base : une case vaut la somme
// (additive) des cases de la base pondérées par ces coefficients, ou leur
// produit avec ces exposants (multiplicative, par logarithme). Les deux
// pyramides ont donc la même matrice.
function coefficients(floors) {
  const rows = []
  for (let i = 0; i < cellCount(floors); i++) {
    const base = Array.from({ length: floors }, (_, k) => {
      const unit = Array(floors).fill(0)
      unit[k] = 1
      return buildPyramid(unit, 'add')[i]
    })
    rows.push(base)
  }
  return rows
}

// Unicité indépendante du solveur : les cases données déterminent toute la
// base si et seulement si leur matrice de coefficients est de rang plein
const uniqueByRank = (floors, givenIndices) =>
  rank(givenIndices.map(i => coefficients(floors)[i])) === floors

test('R1 — réglages : une entrée par classe des profils, bornes et tables positives, sources citées', () => {
  for (const subsystem of MATH_SUBSYSTEMS) {
    for (const level of PROFILE_LEVELS) {
      const expected = classesOf(level, subsystem)
      const actual = MATH_CLASSES[subsystem].filter(c => c.level === level).map(c => c.className)
      assert.deepEqual(actual, expected, `${subsystem} ${level}`)
    }
    for (const c of MATH_CLASSES[subsystem]) {
      assert.ok(Number.isInteger(c.maxNumber) && c.maxNumber > 0)
      assert.ok(c.tables.every(n => Number.isInteger(n) && n > 0))
      assert.match(c.source, /programmes v0\.2 §2\.[12] et §5/)
    }
  }
  // Bornes reprises des programmes (§2 et §5) : un changement doit être voulu
  const bornes = Object.fromEntries(MATH_SUBSYSTEMS.flatMap(s => MATH_CLASSES[s].map(c => [c.className, c.maxNumber])))
  assert.deepEqual(bornes, {
    SIL: 20, CP: 100, CE1: 1000, CE2: 10000, CM1: 1000000, CM2: 1000000000,
    'Class 1': 100, 'Class 2': 200, 'Class 3': 500, 'Class 4': 5000, 'Class 5': 100000, 'Class 6': 1000000
  })
})

test('R2 — classe utilisée : celle du profil, sinon la première de la tranche ; sous-système inconnu : francophone', () => {
  assert.deepEqual(resolveMathClass({ level: 'CE1-CE2', className: 'CE2', subsystem: 'fr' }),
    { settings: mathClassSettings('CE2', 'fr'), isDefault: false, reason: null })
  assert.deepEqual(resolveMathClass({ level: 'CE1-CE2', className: 'Class 4', subsystem: 'en' }),
    { settings: mathClassSettings('Class 4', 'en'), isDefault: false, reason: null })
  // Sans classe : la plus prudente de la tranche
  assert.equal(resolveMathClass({ level: 'CM1-CM2', className: null, subsystem: 'fr' }).settings.className, 'CM1')
  assert.equal(resolveMathClass({ level: 'CM1-CM2', subsystem: 'en' }).settings.className, 'Class 5')
  assert.equal(resolveMathClass({ level: 'SIL-CP', className: null, subsystem: 'en' }).isDefault, true)
  assert.equal(resolveMathClass({ level: 'SIL-CP', className: null, subsystem: 'en' }).reason, 'no-class')
  assert.equal(resolveMathClass({ level: 'SIL-CP', className: '', subsystem: 'fr' }).reason, 'no-class')
  // Raison signalée à l'élève : classe qui ne correspond pas au profil
  assert.equal(resolveMathClass({ level: 'SIL-CP', className: 'CE2', subsystem: 'fr' }).reason, 'mismatch')
  // Classe d'une autre tranche ou d'un autre sous-système : ignorée
  assert.equal(resolveMathClass({ level: 'SIL-CP', className: 'CE2', subsystem: 'fr' }).settings.className, 'SIL')
  assert.equal(resolveMathClass({ level: 'SIL-CP', className: 'CP', subsystem: 'en' }).settings.className, 'Class 1')
  // Ancien profil sans sous-système
  assert.equal(resolveMathClass({ level: 'CE1-CE2', className: 'CE1', subsystem: undefined }).settings.className, 'CE1')
  assert.equal(resolveMathClass({ level: 'CE1-CE2', className: 'CE1', subsystem: 'xx' }).settings.subsystem, 'fr')
})

test('R3 — opérations proposées : pas de multiplication en SIL-CP / Class 1-2, addition partout', () => {
  for (const subsystem of MATH_SUBSYSTEMS) {
    for (const c of MATH_CLASSES[subsystem]) {
      const ops = availableOperations(c.className, subsystem)
      assert.ok(ops.includes('add'), c.className)
      assert.equal(ops.includes('mul'), c.level !== 'SIL-CP', c.className)
    }
  }
  assert.equal(pyramidSettings('CE1', 'fr', 'div'), null)
  assert.equal(pyramidSettings('Inconnue', 'fr', 'add'), null)
  assert.throws(() => createPyramidGame({ className: 'CP', subsystem: 'fr', operation: 'mul', seed: 1 }), RangeError)
  assert.throws(() => createPyramidGame({ className: 'CE1', subsystem: 'fr', operation: 'add', seed: -1 }), RangeError)
  assert.throws(() => createPyramidGame({ className: 'CE1', subsystem: 'fr', operation: 'add', seed: 1.5 }), RangeError)
})

test('P1 — longues séries de graines, chaque classe, sous-système et opération : bornes, entiers positifs, sommet calculé, nombre de cases', () => {
  for (const { className, subsystem, operation } of CONFIGS) {
    const settings = pyramidSettings(className, subsystem, operation)
    const cls = mathClassSettings(className, subsystem)
    assert.ok(settings.maxTop <= cls.maxNumber)
    const total = cellCount(settings.floors)
    const baseStart = cellIndex(settings.floors - 1, 0)
    for (let seed = 0; seed < SEEDS; seed++) {
      const game = createPyramidGame({ className, subsystem, operation, seed })
      const where = `${subsystem} ${className} ${operation} graine ${seed}`
      assert.equal(game.pyramids.length, PYRAMIDS_PER_GAME, where)
      assert.equal(game.level, cls.level)
      const bases = new Set()
      for (const p of game.pyramids) {
        const base = p.values.slice(baseStart)
        bases.add(base.join(','))
        // Toutes les cases recalculées depuis la base
        assert.deepEqual(p.values, buildPyramid(base, operation), where)
        // Entiers positifs, aucun négatif, aucun décimal, pas de 0
        for (const v of p.values) assert.ok(Number.isSafeInteger(v) && v >= 1, `${where} : ${v}`)
        // Sommet = la plus grande case, dans la limite de la classe
        assert.equal(p.top, p.values[0])
        assert.equal(p.top, Math.max(...p.values))
        assert.ok(p.top <= settings.maxTop, `${where} : sommet ${p.top} > ${settings.maxTop}`)
        if (operation === 'add') assert.ok(base.every(v => v >= MIN_ADD_BASE))
        // Exactement autant de cases données que de cases à la base
        const given = p.given.flatMap((g, i) => (g ? [i] : []))
        assert.equal(given.length, settings.floors, where)
        assert.equal(p.hidden.length, total - settings.floors, where)
        assert.deepEqual([...p.hidden, ...given].sort((a, b) => a - b), [...Array(total).keys()])
        const hiddenInBase = p.hidden.filter(i => i >= baseStart).length
        assert.ok(hiddenInBase >= settings.hiddenBase[0] && hiddenInBase <= settings.hiddenBase[1], `${where} : ${hiddenInBase} cachée(s) en bas`)
      }
      // Pas deux fois la même pyramide dans une partie
      assert.equal(bases.size, game.pyramids.length, where)
    }
  }
})

test('P2 — une seule solution : résolution complète, rang plein, et chaque case donnée est nécessaire', () => {
  for (const { className, subsystem, operation } of CONFIGS) {
    const settings = pyramidSettings(className, subsystem, operation)
    for (let seed = 0; seed < SEEDS; seed++) {
      const game = createPyramidGame({ className, subsystem, operation, seed })
      for (const p of game.pyramids) {
        const where = `${subsystem} ${className} ${operation} graine ${seed}`
        const known = p.values.map((v, i) => (p.given[i] ? v : null))
        const solved = solvePyramid(settings.floors, operation, known, { maxOperand: settings.maxOperand })
        assert.ok(solved, where)
        assert.deepEqual(solved.values, p.values, where)
        const given = p.given.flatMap((g, i) => (g ? [i] : []))
        // Contrôle indépendant du solveur
        assert.ok(uniqueByRank(settings.floors, given), `${where} : plusieurs solutions possibles`)
        // Aucune case donnée inutile : sans elle, plus de solution unique
        for (const g of given) {
          const fewer = given.filter(i => i !== g)
          assert.ok(!uniqueByRank(settings.floors, fewer), `${where} : case ${g} superflue`)
          const k2 = known.map((v, i) => (i === g ? null : v))
          assert.equal(solvePyramid(settings.floors, operation, k2, {}), null, `${where} : case ${g} superflue`)
        }
      }
    }
  }
})

test('P3 — calculs à faire : opérations de la classe, soustractions positives, divisions exactes, cases du haut seulement en SIL-CP', () => {
  for (const { className, subsystem, operation } of CONFIGS) {
    const settings = pyramidSettings(className, subsystem, operation)
    const cls = mathClassSettings(className, subsystem)
    const baseStart = cellIndex(settings.floors - 1, 0)
    for (let seed = 0; seed < SEEDS; seed++) {
      for (const p of createPyramidGame({ className, subsystem, operation, seed }).pyramids) {
        const where = `${subsystem} ${className} ${operation} graine ${seed}`
        assert.equal(p.steps.length, p.hidden.length)
        for (const s of p.steps) {
          assert.equal(s.value, p.values[s.cell], where)
          assert.ok(Number.isSafeInteger(s.value) && s.value >= 1, where)
          if (operation === 'add') assert.ok(['+', '−'].includes(s.op), where)
          if (operation === 'mul') {
            assert.ok(['×', '÷'].includes(s.op), where)
            if (s.op === '÷') assert.equal(s.a % s.b, 0, `${where} : division non exacte`)
            const operand = s.op === '÷' ? s.b : Math.min(s.a, s.b)
            if (cls.maxOperand !== null) assert.ok(operand <= cls.maxOperand, `${where} : ${s.a} ${s.op} ${s.b}`)
          }
          if (s.op === '−') assert.ok(s.a - s.b >= 0)
        }
        if (cls.level === 'SIL-CP') {
          assert.ok(p.hidden.every(i => i < baseStart), `${where} : case du bas cachée en SIL-CP`)
          assert.ok(p.steps.every(s => s.op === '+'))
        } else {
          assert.ok(p.hidden.some(i => i >= baseStart), `${where} : aucune case du bas cachée`)
        }
      }
    }
  }
})

test('P4 — multiplicatif : pas de 0, au plus un 1, facteurs pris dans les tables de la classe', () => {
  for (const { className, subsystem, operation } of CONFIGS.filter(c => c.operation === 'mul')) {
    const settings = pyramidSettings(className, subsystem, operation)
    const tables = mathClassSettings(className, subsystem).tables
    const baseStart = cellIndex(settings.floors - 1, 0)
    assert.ok(multiplicativeBases(settings).length > 0)
    for (let seed = 0; seed < SEEDS; seed++) {
      for (const p of createPyramidGame({ className, subsystem, operation, seed }).pyramids) {
        const base = p.values.slice(baseStart)
        assert.ok(!p.values.includes(0))
        assert.ok(base.filter(v => v === 1).length <= MAX_ONES, base.join(','))
        assert.ok(base.every(v => tables.includes(v)), `${className} : ${base.join(',')}`)
      }
    }
  }
})

test('P5 — reproductibilité : même graine, même classe, même opération = même partie', () => {
  for (const config of CONFIGS) {
    for (const seed of [0, 1, 42, 12345, 4294967295]) {
      assert.deepEqual(createPyramidGame({ ...config, seed }), createPyramidGame({ ...config, seed }))
    }
    // Des graines différentes donnent des parties différentes (sur 50 graines)
    const shapes = new Set()
    for (let seed = 0; seed < 50; seed++) {
      shapes.add(JSON.stringify(createPyramidGame({ ...config, seed }).pyramids.map(p => [p.values, p.given])))
    }
    assert.ok(shapes.size > 25, `${config.subsystem} ${config.className} ${config.operation} : ${shapes.size} parties distinctes`)
  }
})

test('P6 — aide sur une case fausse : les deux cases dont elle dépend et le calcul', () => {
  // Base 1-2-3 : 3, 5 puis 8
  const add = { values: [8, 3, 5, 1, 2, 3], given: [false, false, false, true, true, true], steps: solvePyramid(3, 'add', [null, null, null, 1, 2, 3]).steps }
  const all = (cells) => add.values.map((_, i) => cells.includes(i))
  assert.deepEqual(cellHint(add, 0, all([1, 2, 3, 4, 5]), { floors: 3, operation: 'add' }),
    { op: '+', inputs: [1, 2], a: 3, b: 5, known: true })
  // Cases du dessous pas encore trouvées : calcul de la résolution, à faire après
  assert.deepEqual(cellHint(add, 0, all([3, 4, 5]), { floors: 3, operation: 'add' }),
    { op: '+', inputs: [1, 2], a: 3, b: 5, known: false })
  // Case du bas : soustraction avec la case du dessus et la voisine
  assert.deepEqual(cellHint(add, 3, all([1, 4]), { floors: 3, operation: 'add' }),
    { op: '−', inputs: [1, 4], a: 3, b: 2, known: true })

  // Base 2-3-4 : 6, 12 puis 72
  const mul = { values: [72, 6, 12, 2, 3, 4], given: [], steps: solvePyramid(3, 'mul', [null, null, null, 2, 3, 4]).steps }
  const shownMul = (cells) => mul.values.map((_, i) => cells.includes(i))
  assert.deepEqual(cellHint(mul, 1, shownMul([3, 4]), { floors: 3, operation: 'mul' }),
    { op: '×', inputs: [3, 4], a: 2, b: 3, known: true })
  assert.deepEqual(cellHint(mul, 5, shownMul([2, 4]), { floors: 3, operation: 'mul' }),
    { op: '÷', inputs: [2, 4], a: 12, b: 3, known: true })
  // Division par un nombre trop grand pour la classe : pas proposée
  assert.equal(cellHint(mul, 2, shownMul([0, 1]), { floors: 3, operation: 'mul', maxOperand: 5 }).known, false)
  assert.deepEqual(cellHint(mul, 2, shownMul([0, 1]), { floors: 3, operation: 'mul', maxOperand: 9 }),
    { op: '÷', inputs: [0, 1], a: 72, b: 6, known: true })
})

test('P7 — résolution : rien de deviné, pas de résultat négatif, pas de division non exacte', () => {
  // Deux cases données seulement à 3 étages : pas de solution unique
  assert.equal(solvePyramid(3, 'add', [8, null, null, 1, null, null]), null)
  // Données incohérentes : soustraction négative refusée
  assert.equal(solvePyramid(3, 'add', [null, 2, null, 5, null, 1]), null)
  // Division non exacte refusée
  assert.equal(solvePyramid(3, 'mul', [null, 7, null, 2, null, 3]), null)
  // Géométrie
  for (let i = 0; i < cellCount(5); i++) {
    const { row, col } = cellPosition(i)
    assert.equal(cellIndex(row, col), i)
  }
})

test('P8 — identifiant de case et taille du pavé', () => {
  const game = createPyramidGame({ className: 'Class 3', subsystem: 'en', operation: 'add', seed: 7 })
  assert.equal(pyramidCellId(game, 2, 4), 'add:en:Class 3:7:2:4')
  assert.equal(maxDigits(game), 3)
  assert.equal(maxDigits(createPyramidGame({ className: 'CM2', subsystem: 'fr', operation: 'add', seed: 7 })), 10)
  // Réglages par tranche figés (provisoires) : 3 tranches, mul absent en SIL-CP
  assert.deepEqual(Object.keys(PYRAMID_SETTINGS), PROFILE_LEVELS)
  assert.equal(PYRAMID_SETTINGS['SIL-CP'].mul, null)
  assert.deepEqual(PYRAMID_SETTINGS['CM1-CM2'].add.hiddenBase, [2, 3])
  assert.deepEqual(PYRAMID_SETTINGS['CM1-CM2'].mul.hiddenBase, [2, 2])
})

test('P9 — points et « Voir la réponse » (décision d\'Isaac du 2026-11-03)', () => {
  assert.equal(POINTS_PER_CELL, 10)
  assert.equal(TRIES_BEFORE_ANSWER, 3)
  // Seules les cases trouvées par l'élève comptent : une case montrée ne rapporte rien
  assert.equal(pyramidScore(0), 0)
  assert.equal(pyramidScore(7), 70)
  assert.equal(canShowAnswer(0), false)
  assert.equal(canShowAnswer(2), false)
  assert.equal(canShowAnswer(3), true)
  assert.equal(canShowAnswer(5), true)
})

test('P10 — groupes de trois chiffres pour l\'affichage par milliers', () => {
  assert.deepEqual(digitGroups(7), ['7'])
  assert.deepEqual(digitGroups(1000), ['1', '000'])
  assert.deepEqual(digitGroups('38035'), ['38', '035'])
  assert.deepEqual(digitGroups(380359238), ['380', '359', '238'])
  assert.deepEqual(digitGroups(1000000000), ['1', '000', '000', '000'])
  assert.deepEqual(digitGroups(''), [])
  for (const n of [1, 12, 123, 1234, 98765, 123456789]) assert.equal(digitGroups(n).join(''), String(n))
})

// Tests des nombres croisés (fiche M1, phase 5, lot A : générateur et
// vérificateur sans interface ; lot C : niveau 3 et BODMAS, N18 à N21) — lancer avec : npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createCrossNumberGame,
  verifyCrossNumberGame,
  crossNumberSettings,
  crossNumberClasses,
  isCrossNumberPlayable,
  fillTemplate,
  filledGridText,
  emptyGridText,
  cellNumbers,
  CrossNumberError,
  classSeed,
  CROSS_NUMBER_TEMPLATES,
  CROSS_NUMBER_SETTINGS,
  MAX_ATTEMPTS,
  MAX_DIVISION_SHARE,
  MAX_TWO_DIGIT_DIVISIONS,
  MAX_TWO_DIGIT_MULTIPLICAND,
  MAX_POW10_PER_GRID,
  pickWeighted,
  planRequirements
} from './crossNumberGame.js'
import {
  analyzeTemplate,
  templateEntries,
  applySymmetry,
  distinctSymmetries,
  SYMMETRY_COUNT
} from './crossNumberGrid.js'
import {
  evaluateDefinition,
  checkDefinition,
  definitionContext,
  definitionOptions,
  definitionText,
  formatNumber,
  canDefine,
  DEFINITION_TYPES,
  DEFAULT_OPERAND_CAP,
  isTableProduct,
  NEXT_MIN_DIGITS,
  DECOMPOSITION_MAX_PARTS
} from './crossNumberDefinitions.js'
import { createRandom } from './wordSearchGenerator.js'
import { MATH_CLASSES, MATH_SUBSYSTEMS, mathClassSettings } from '../data/reglages-maths.js'

const SEEDS = 200

// Toutes les classes où le jeu est proposé
const CLASSES = MATH_SUBSYSTEMS.flatMap(subsystem => crossNumberClasses(subsystem).map(className => ({ className, subsystem })))

const clone = (game) => structuredClone(game)

// Soustraction valide pour n : nombre retiré ≥ 10, aucun opérande égal à une
// réponse de la grille ni contenant n
function safeSub(n, answers, maxNumber) {
  for (let b = 10; n + b <= maxNumber; b++) {
    const a = n + b
    if (!answers.includes(a) && !answers.includes(b) && !String(a).includes(String(n)) && !String(b).includes(String(n))) {
      return { type: 'sub', operands: [a, b] }
    }
  }
  throw new Error(`aucune soustraction pour ${n}`)
}
const codes = (result) => result.errors.map(e => e.code)

test('N1 — classes proposées : CP / Class 2 à CM2 / Class 6 ; SIL et Class 1 refusés proprement (P2 a)', () => {
  assert.deepEqual(crossNumberClasses('fr'), ['CP', 'CE1', 'CE2', 'CM1', 'CM2'])
  assert.deepEqual(crossNumberClasses('en'), ['Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6'])
  for (const { className, subsystem } of CLASSES) assert.equal(isCrossNumberPlayable(className, subsystem), true, className)
  for (const [className, subsystem] of [['SIL', 'fr'], ['Class 1', 'en'], ['CP', 'en'], ['Class 2', 'fr'], ['Inconnue', 'fr'], ['CP', 'xx']]) {
    assert.equal(crossNumberSettings(className, subsystem), null, `${className} ${subsystem}`)
    assert.throws(() => createCrossNumberGame({ className, subsystem, seed: 1 }),
      (e) => e instanceof CrossNumberError && e.code === 'not-playable', `${className} ${subsystem}`)
  }
  // Graine invalide : erreur explicite, aucune grille
  for (const seed of [-1, 1.5, 2 ** 32, '12', null]) {
    assert.throws(() => createCrossNumberGame({ className: 'CP', subsystem: 'fr', seed }),
      (e) => e instanceof CrossNumberError && e.code === 'invalid-seed')
  }
})

test('N2 — réglages : tailles et chiffres du §4.1 (P4 a), opérations du §4.3 (P5 a) dans reglages-maths.js', () => {
  const sizes = Object.fromEntries(CLASSES.map(({ className, subsystem }) => {
    const s = crossNumberSettings(className, subsystem)
    return [className, [s.size, s.minDigits, s.maxDigits]]
  }))
  assert.deepEqual(sizes, {
    CP: [3, 2, 2], CE1: [4, 2, 3], CE2: [5, 2, 4], CM1: [6, 2, 6], CM2: [7, 2, 7],
    'Class 2': [3, 2, 2], 'Class 3': [4, 2, 3], 'Class 4': [5, 2, 4], 'Class 5': [6, 2, 5], 'Class 6': [7, 2, 6]
  })
  // Un changement des opérations permises doit être voulu (provisoires, D4)
  const ops = Object.fromEntries(MATH_SUBSYSTEMS.flatMap(s => MATH_CLASSES[s].map(c => [c.className, c.operations])))
  const ce1 = ['add', 'sub', 'mulTable', 'mul', 'div', 'double', 'half', 'triple', 'third']
  // Lot C : niveau 3 (nombre qui suit / qui précède, décomposition par rang),
  // × / ÷ par 10, 100, 1 000 au CM, BODMAS en Class 4
  const level3 = ['next', 'prev', 'decomposition']
  const pow10 = ['timesPow10', 'divPow10']
  assert.deepEqual(ops, {
    SIL: null,
    CP: ['add', 'sub', 'mulTable', 'placeValue'],
    CE1: ce1,
    CE2: [...ce1, 'quadruple', 'quarter', 'times10'],
    CM1: ['add', 'sub', 'mulTable', 'times5', 'div', ...level3, ...pow10],
    CM2: ['add', 'sub', 'mulTable', 'times5', 'div', 'times11_12', 'times25', ...level3, ...pow10],
    'Class 1': null,
    'Class 2': ['add', 'sub', 'placeValue'],
    'Class 3': ['add', 'sub', 'mulTable'],
    'Class 4': ['add', 'sub', 'mulTable', 'addProduct', 'subProduct'],
    'Class 5': ['add', 'sub', 'mul', 'div', 'mulTable', ...level3],
    'Class 6': ['add', 'sub', 'mul', 'div', 'mulTable', ...level3]
  })
  for (const list of Object.values(ops)) {
    if (list !== null) assert.ok(list.every(t => DEFINITION_TYPES.includes(t)), String(list))
  }
  // Pas de produit en Class 2 tant que ses tables sont vides (§4.3)
  assert.equal(mathClassSettings('Class 2', 'en').tables.length, 0)
  assert.ok(!ops['Class 2'].includes('mulTable'))
  // Chaque classe proposée a au moins deux gabarits valides
  for (const { className, subsystem } of CLASSES) {
    assert.ok(crossNumberSettings(className, subsystem).templates.length >= 2, className)
  }
})

test('N3 — gabarits : analyse (suites ≥ 2, longueur ≤ chiffres permis, chaque nombre croisé, aucune case seule)', () => {
  const ok = analyzeTemplate(['..#', '.#.', '#..'], { maxDigits: 2 })
  assert.deepEqual(ok.errors, [])
  assert.equal(ok.entries.length, 4)
  assert.equal(ok.whiteCount, 6)
  assert.equal(ok.crossedCount, 2)
  // Leçon connue : suite de 4 cases impossible au CE1 (3 chiffres au plus)
  assert.ok(analyzeTemplate(['....', '.#..', '..#.', '...#'], { maxDigits: 3 }).errors.some(e => e.code === 'too-long'))
  // Case blanche dans aucun nombre
  assert.ok(analyzeTemplate(['.#.', '#..', '...'], { maxDigits: 3 }).errors.some(e => e.code === 'cell-alone'))
  // Nombre qui ne croise aucun autre
  assert.ok(analyzeTemplate(['..#', '###', '..#'], { maxDigits: 2 }).errors.some(e => e.code === 'not-crossed'))
  // Gabarit sans nombre
  assert.ok(analyzeTemplate(['.#', '#.'], {}).errors.some(e => e.code === 'no-entry'))
  assert.throws(() => analyzeTemplate(['..', '...']), TypeError)
  // Chaque gabarit déclaré : carré de la bonne taille, valide pour au moins une classe
  const used = new Set(CLASSES.flatMap(({ className, subsystem }) => crossNumberSettings(className, subsystem).templates.map(t => t.id)))
  for (const [size, list] of Object.entries(CROSS_NUMBER_TEMPLATES)) {
    for (const t of list) {
      assert.equal(t.rows.length, Number(size), t.id)
      assert.ok(used.has(t.id), `${t.id} n'est utilisé par aucune classe`)
    }
  }
})

test('N4 — numérotation dans l\'ordre de lecture ; symétries : mêmes longueurs, gabarit toujours valide', () => {
  const entries = templateEntries(['#...', '..#.', '...#', '.#..'])
  assert.deepEqual(entries.map(e => e.id), ['1A', '3A', '4A', '6A', '1D', '2D', '3D', '5D'])
  assert.deepEqual(entries.map(e => e.length), [3, 2, 3, 2, 3, 2, 3, 2])
  // Horizontal et vertical qui partent de la même case : même numéro
  const corner = templateEntries(['..#', '..#', '###'])
  assert.deepEqual(corner.map(e => e.id), ['1A', '3A', '1D', '2D'])
  assert.deepEqual(corner.find(e => e.id === '1D').cells, [[0, 0], [1, 0]])
  for (const list of Object.values(CROSS_NUMBER_TEMPLATES)) {
    for (const t of list) {
      const lengths = templateEntries(t.rows).map(e => e.length).sort().join(',')
      for (let k = 0; k < SYMMETRY_COUNT; k++) {
        const rows = applySymmetry(t.rows, k)
        assert.equal(templateEntries(rows).map(e => e.length).sort().join(','), lengths, `${t.id} symétrie ${k}`)
      }
      assert.ok(distinctSymmetries(t.rows).length >= 2, t.id)
    }
  }
  assert.deepEqual(applySymmetry(['..#', '.#.', '#..'], 0), ['..#', '.#.', '#..'])
})

test('N5 — chaque gabarit est rempli pour chaque classe et chaque symétrie, sur des séries de graines (validation par programme)', () => {
  for (const { className, subsystem } of CLASSES) {
    const settings = crossNumberSettings(className, subsystem)
    for (const t of settings.templates) {
      for (let k = 0; k < SYMMETRY_COUNT; k++) {
        const rows = applySymmetry(t.rows, k)
        let filled = 0
        for (let seed = 0; seed < 10; seed++) {
          if (fillTemplate(rows, settings, createRandom(seed)).digits) filled++
        }
        assert.ok(filled >= 1, `${className} ${t.id} symétrie ${k} : aucune grille sur 10 graines`)
      }
    }
  }
})

test(`N6 — ${SEEDS} graines par classe : grille rendue, vérifiée par programme, règles du §5`, () => {
  for (const { className, subsystem } of CLASSES) {
    const settings = crossNumberSettings(className, subsystem)
    const ctx = definitionContext(settings)
    const typesSeen = new Set()
    const shapes = new Set()
    for (let seed = 0; seed < SEEDS; seed++) {
      const game = createCrossNumberGame({ className, subsystem, seed })
      const result = verifyCrossNumberGame(game)
      assert.ok(result.ok, `${className} graine ${seed} : ${JSON.stringify(result.errors)}`)
      assert.equal(game.size, settings.size)
      assert.equal(game.rows.length, settings.size)
      assert.ok(game.stats.attempts <= MAX_ATTEMPTS)
      shapes.add(game.rows.join('/'))
      const answers = new Set()
      for (const e of game.entries) {
        // Règle 1 : nombre entier recalculé depuis la structure de sa définition
        assert.equal(evaluateDefinition(e.definition), e.answer)
        assert.equal(Number(e.cells.map(([r, c]) => game.cells[r][c]).join('')), e.answer)
        // Règle 2 : pas de 0 en tête
        assert.notEqual(game.cells[e.cells[0][0]][e.cells[0][1]], 0)
        // Règles 4 et 5
        assert.ok(e.answer <= settings.maxNumber)
        assert.ok(e.length >= settings.minDigits && e.length <= settings.maxDigits)
        assert.equal(String(e.answer).length, e.length)
        // Règles 3, 4, 6
        assert.deepEqual(checkDefinition(e.definition, e.answer, ctx), [])
        assert.ok(settings.operations.includes(e.definition.type))
        // Textes FR et EN présents
        assert.ok(e.text.fr.length > 0 && e.text.en.length > 0)
        assert.ok(!answers.has(e.answer), 'nombre en double')
        answers.add(e.answer)
        typesSeen.add(e.definition.type)
        // Corrections d'Isaac du 2026-11-08
        const [a, b] = e.definition.operands
        if (e.definition.type === 'add') assert.ok(a >= settings.minTerm && b >= settings.minTerm, `${className} ${e.text.fr}`)
        if (e.definition.type === 'sub') assert.ok(b >= settings.minTerm, `${className} ${e.text.fr}`)
        if (e.definition.type === 'div' && settings.maxQuotientDigits !== null) assert.ok(String(e.answer).length <= settings.maxQuotientDigits)
        if (e.definition.type === 'mul' && b >= 10) assert.ok(a <= MAX_TWO_DIGIT_MULTIPLICAND)
      }
      // Aucun opérande égal à la réponse d'un autre nombre
      for (const e of game.entries) {
        for (const x of e.definition.operands) assert.ok(!game.entries.some(o => o !== e && o.answer === x), `${className} ${seed} ${e.text.fr}`)
      }
      const count = (pred) => game.entries.filter(pred).length
      assert.ok(count(e => e.definition.type === 'div') <= Math.floor(MAX_DIVISION_SHARE * game.entries.length), `${className} ${seed} divisions`)
      assert.ok(count(e => e.definition.type === 'div' && e.definition.operands[1] >= 10) <= MAX_TWO_DIGIT_DIVISIONS)
      // Produits des tables : toute multiplication de deux facteurs de 2 à 10
      const tables = count(e => isTableProduct(e.definition))
      assert.ok(tables >= settings.minTables, `${className} ${seed} : ${tables} produits des tables`)
      if (settings.maxTables !== null) assert.ok(tables <= settings.maxTables, `${className} ${seed} : ${tables} produits des tables`)
      // Mélange des types : au moins deux types dans une grille de 4 nombres ou plus
      if (game.entries.length >= 4) assert.ok(new Set(game.entries.map(e => e.definition.type)).size >= 2, `${className} ${seed}`)
    }
    // Tous les types permis apparaissent sur la série
    assert.deepEqual([...typesSeen].sort(), [...settings.operations].sort(), className)
    // Les symétries et les gabarits donnent plusieurs formes
    assert.ok(shapes.size >= 4, `${className} : ${shapes.size} formes`)
  }
})

test('N7 — déterminisme (P12 a) : même graine + même classe + même sous-système = même grille ; la langue ne change que le texte', () => {
  for (const { className, subsystem } of CLASSES) {
    for (const seed of [0, 1, 42, 123456, 4294967295]) {
      const a = createCrossNumberGame({ className, subsystem, seed })
      const b = createCrossNumberGame({ className, subsystem, seed })
      assert.deepEqual(a, b, `${className} ${seed}`)
      // Les deux textes viennent de la même structure
      for (const e of a.entries) {
        assert.equal(e.text.fr, definitionText(e.definition, 'fr'))
        assert.equal(e.text.en, definitionText(e.definition, 'en'))
      }
    }
    // Des graines différentes donnent des grilles différentes
    const grids = new Set()
    for (let seed = 0; seed < 50; seed++) grids.add(filledGridText(createCrossNumberGame({ className, subsystem, seed })))
    assert.ok(grids.size >= 45, `${className} : ${grids.size} grilles sur 50`)
  }
  // Le numéro de partie est mêlé à la classe : tirages différents d'une classe à l'autre
  const salted = new Set(CLASSES.map(({ className, subsystem }) => classSeed(1, className, subsystem)))
  assert.equal(salted.size, CLASSES.length)
  for (const v of salted) assert.ok(Number.isInteger(v) && v >= 0 && v <= 4294967295)
  assert.equal(classSeed(1, 'CP', 'fr'), classSeed(1, 'CP', 'fr'))
  // CP et Class 2 ont la même taille mais des réglages différents
  const cp = createCrossNumberGame({ className: 'CP', subsystem: 'fr', seed: 7 })
  const c2 = createCrossNumberGame({ className: 'Class 2', subsystem: 'en', seed: 7 })
  assert.ok(c2.entries.every(e => e.definition.type !== 'mulTable'))
  assert.equal(cp.className, 'CP')
})

test('N8 — échec de génération : aucune grille rendue, erreur explicite (§5 règle 8)', () => {
  assert.throws(() => createCrossNumberGame({ className: 'CM2', subsystem: 'fr', seed: 3, maxNodes: 1 }),
    (e) => e instanceof CrossNumberError && e.code === 'generation-failed' && /après 20 essais/.test(e.message))
  const settings = crossNumberSettings('CE1', 'fr')
  assert.equal(fillTemplate(settings.templates[0].rows, settings, createRandom(1), { maxNodes: 3 }).digits, null)
})

test('N9 — le vérificateur rejette les grilles fausses', () => {
  const base = createCrossNumberGame({ className: 'CE1', subsystem: 'fr', seed: 11 })
  assert.ok(verifyCrossNumberGame(base).ok)
  const first = base.entries[0]

  // Chiffre changé dans la grille : les réponses ne correspondent plus
  let g = clone(base)
  const [r0, c0] = first.cells[first.cells.length - 1]
  g.cells[r0][c0] = (g.cells[r0][c0] + 1) % 10
  assert.ok(codes(verifyCrossNumberGame(g)).includes('answer'))

  // Réponse et définition fausses ensemble (grille inchangée)
  g = clone(base)
  g.entries[0].answer += 1
  assert.ok(codes(verifyCrossNumberGame(g)).includes('answer'))

  // Définition dont le calcul ne donne pas le nombre
  g = clone(base)
  g.entries[0].definition = { type: 'add', operands: [first.answer, 1] }
  g.entries[0].text = { fr: definitionText(g.entries[0].definition, 'fr'), en: definitionText(g.entries[0].definition, 'en') }
  assert.ok(codes(verifyCrossNumberGame(g)).includes('definition'))

  // Définition triviale (+ 0) et définition qui contient sa réponse
  for (const operands of [[first.answer, 0], [0, first.answer]]) {
    g = clone(base)
    g.entries[0].definition = { type: 'add', operands }
    g.entries[0].text = { fr: definitionText(g.entries[0].definition, 'fr'), en: definitionText(g.entries[0].definition, 'en') }
    const d = verifyCrossNumberGame(g).errors.find(e => e.code === 'definition')
    assert.ok(d && d.detail.includes('trivial') && d.detail.includes('reveals-answer'))
  }

  // Type non permis dans la classe (placeValue n'est pas au CE1)
  g = clone(base)
  const v = first.answer
  g.entries[0].definition = { type: 'placeValue', operands: [Math.floor(v / 100), Math.floor(v / 10) % 10, v % 10] }
  g.entries[0].text = { fr: definitionText(g.entries[0].definition, 'fr'), en: definitionText(g.entries[0].definition, 'en') }
  assert.ok(verifyCrossNumberGame(g).errors.find(e => e.code === 'definition').detail.includes('type-not-allowed'))

  // Texte absent ou différent de la structure
  g = clone(base)
  g.entries[0].text = { fr: g.entries[0].text.fr, en: '' }
  assert.ok(codes(verifyCrossNumberGame(g)).includes('text'))
  g = clone(base)
  g.entries[0].text = { ...g.entries[0].text, fr: '1 + 1' }
  assert.ok(codes(verifyCrossNumberGame(g)).includes('text'))

  // Case noire remplie, case blanche vide
  g = clone(base)
  const black = g.rows.flatMap((row, r) => [...row].map((ch, c) => (ch === '#' ? [r, c] : null))).find(Boolean)
  g.cells[black[0]][black[1]] = 5
  assert.ok(codes(verifyCrossNumberGame(g)).includes('cells'))

  // Gabarit modifié : nombres différents de ceux du gabarit
  g = clone(base)
  g.entries = g.entries.slice(1)
  assert.ok(codes(verifyCrossNumberGame(g)).includes('entries'))

  // Classe changée : SIL refusé ; taille différente
  g = clone(base)
  g.className = 'SIL'
  assert.deepEqual(codes(verifyCrossNumberGame(g)), ['not-playable'])
  g = clone(base)
  g.className = 'CE2'
  assert.ok(codes(verifyCrossNumberGame(g)).includes('bad-size'))

  // Une seule sorte de définition dans une grille de 4 nombres ou plus
  g = clone(base)
  const all = g.entries.map(e => e.answer)
  for (const e of g.entries) {
    e.definition = safeSub(e.answer, all, 1000)
    e.text = { fr: definitionText(e.definition, 'fr'), en: definitionText(e.definition, 'en') }
  }
  assert.deepEqual(codes(verifyCrossNumberGame(g)), ['single-type'])
})

test('N10 — vérificateur : 0 en tête, nombre trop grand, nombre en double, suite trop longue', () => {
  // Grille fabriquée à la main (Class 3 : 3 chiffres, nombres ≤ 500)
  const make = (rows, cells, className = 'Class 3', subsystem = 'en') => {
    // Produits des tables pour les deux premiers nombres qui s'y prêtent
    // (Class 3 : au moins 2), soustractions sinon
    const shapes = templateEntries(rows)
    const answers = shapes.map(e => Number(e.cells.map(([r, c]) => cells[r][c]).join('')))
    let tables = 0
    const entries = shapes.map((e, i) => {
      const answer = answers[i]
      let definition = null
      for (let t = 2; t <= 7 && tables < 2 && !definition; t++) {
        if (answer % t === 0 && answer / t >= 2 && answer / t <= 10) { definition = { type: 'mulTable', operands: [t, answer / t] }; tables++ }
      }
      definition ??= safeSub(answer, answers, 10 ** 9)
      return { ...e, answer, definition, text: { fr: definitionText(definition, 'fr'), en: definitionText(definition, 'en') } }
    })
    return { seed: 0, className, subsystem, size: rows.length, rows, cells, entries }
  }
  const rows = ['#...', '..#.', '...#', '.#..']
  const good = make(rows, [[null, 1, 2, 3], [4, 5, null, 6], [1, 7, 8, null], [9, null, 3, 4]])
  assert.deepEqual(verifyCrossNumberGame(good).errors, [])
  // 0 en tête d'un nombre vertical qui commence au milieu d'un horizontal
  const zero = make(rows, [[null, 1, 2, 3], [4, 5, null, 6], [1, 7, 0, null], [9, null, 3, 4]])
  assert.ok(codes(verifyCrossNumberGame(zero)).includes('leading-zero'))
  // Nombre > 500 en Class 3
  const big = make(rows, [[null, 9, 2, 3], [4, 5, null, 6], [1, 7, 8, null], [9, null, 3, 4]])
  assert.ok(codes(verifyCrossNumberGame(big)).includes('max-number'))
  // Même nombre deux fois
  const dup = make(['..#', '..#', '###'], [[1, 2, null], [2, 4, null], [null, null, null]], 'CP', 'fr')
  assert.ok(codes(verifyCrossNumberGame(dup)).includes('duplicate'))
  // Suite de 4 chiffres au CE1 : gabarit refusé
  const long = make(['....', '.#..', '..#.', '...#'], [[1, 2, 3, 4], [5, null, 1, 2], [6, 7, null, 3], [1, 8, 9, null]], 'CE1', 'fr')
  assert.ok(verifyCrossNumberGame(long).errors.some(e => e.code === 'template' && e.detail.code === 'too-long'))
})

test('N11 — définitions : calcul, règles du programme, textes FR et EN', () => {
  const ce1 = definitionContext(mathClassSettings('CE1', 'fr'))
  const cp = definitionContext(mathClassSettings('CP', 'fr'))
  const c5 = definitionContext(mathClassSettings('Class 5', 'en'))
  assert.equal(evaluateDefinition({ type: 'add', operands: [23, 45] }), 68)
  assert.equal(evaluateDefinition({ type: 'div', operands: [56, 5] }), NaN)
  assert.equal(evaluateDefinition({ type: 'half', operands: [45] }), NaN)
  assert.equal(evaluateDefinition({ type: 'placeValue', operands: [0, 6, 3] }), 63)
  assert.equal(evaluateDefinition({ type: 'inconnu', operands: [1] }), NaN)
  // Valides
  assert.deepEqual(checkDefinition({ type: 'mulTable', operands: [4, 7] }, 28, cp), [])
  assert.deepEqual(checkDefinition({ type: 'mulTable', operands: [7, 4] }, 28, cp), [])
  assert.deepEqual(checkDefinition({ type: 'div', operands: [56, 7] }, 8, ce1), [])
  assert.deepEqual(checkDefinition({ type: 'half', operands: [46] }, 23, ce1), [])
  // Hors programme : table de 3 au CP, diviseur à 2 chiffres au CE1, résultat > maxNumber, soustraction négative
  assert.ok(checkDefinition({ type: 'mulTable', operands: [3, 7] }, 21, cp).includes('not-in-programme'))
  assert.ok(checkDefinition({ type: 'mulTable', operands: [4, 11] }, 44, cp).includes('not-in-programme'))
  assert.ok(checkDefinition({ type: 'div', operands: [96, 12] }, 8, ce1).includes('not-in-programme'))
  assert.ok(checkDefinition({ type: 'add', operands: [60, 50] }, 110, cp).includes('out-of-range'))
  assert.ok(checkDefinition({ type: 'sub', operands: [3, 5] }, -2, ce1).includes('out-of-range'))
  assert.ok(checkDefinition({ type: 'div', operands: [57, 5] }, 11, ce1).includes('wrong-value'))
  // Triviales
  assert.ok(checkDefinition({ type: 'mul', operands: [45, 1] }, 45, ce1).includes('trivial'))
  assert.ok(checkDefinition({ type: 'div', operands: [45, 1] }, 45, ce1).includes('trivial'))
  assert.ok(checkDefinition({ type: 'sub', operands: [45, 0] }, 45, ce1).includes('trivial'))
  // Contient la réponse en chiffres
  assert.ok(checkDefinition({ type: 'sub', operands: [145, 100] }, 45, ce1).includes('reveals-answer'))
  assert.ok(checkDefinition({ type: 'div', operands: [125, 5] }, 25, ce1).includes('reveals-answer'))
  // Diviseur sans limite écrite : DEFAULT_OPERAND_CAP
  assert.equal(c5.operandCap, DEFAULT_OPERAND_CAP)
  assert.ok(checkDefinition({ type: 'div', operands: [200 * 100, 100] }, 200, c5).includes('not-in-programme'))
  // Options : toujours valides, tirées de la même façon pour une même graine
  const random = createRandom(5)
  for (const type of ce1.operations) {
    for (const def of definitionOptions(type, 48, ce1, random)) assert.deepEqual(checkDefinition(def, 48, ce1), [], type)
  }
  // CM1 : quotient d'au plus 4 chiffres, mais l'addition rend tout nombre possible
  const cm1 = definitionContext(crossNumberSettings('CM1', 'fr'))
  assert.equal(definitionOptions('div', 12345, cm1).length, 0)
  assert.ok(definitionOptions('div', 1234, cm1).length > 0)
  assert.equal(canDefine(700001, cm1), true)
  // Sans addition ni soustraction (contexte d'essai), un grand nombre impair peut être indéfinissable
  assert.equal(canDefine(700001, { ...cm1, operations: ['mulTable', 'times5', 'div'] }), false)
  // Textes
  assert.equal(definitionText({ type: 'add', operands: [23, 45] }, 'fr'), '23 + 45')
  assert.equal(definitionText({ type: 'sub', operands: [68, 23] }, 'en'), '68 − 23')
  assert.equal(definitionText({ type: 'double', operands: [23] }, 'fr'), 'le double de 23')
  assert.equal(definitionText({ type: 'double', operands: [23] }, 'en'), 'twice 23')
  assert.equal(definitionText({ type: 'half', operands: [68] }, 'en'), 'half of 68')
  assert.equal(definitionText({ type: 'placeValue', operands: [0, 6, 3] }, 'fr'), '6 dizaines et 3 unités')
  assert.equal(definitionText({ type: 'placeValue', operands: [1, 1, 1] }, 'fr'), '1 centaine, 1 dizaine et 1 unité')
  assert.equal(definitionText({ type: 'placeValue', operands: [0, 6, 0] }, 'en'), '6 tens')
  assert.equal(definitionText({ type: 'placeValue', operands: [0, 1, 4] }, 'en'), '1 ten and 4 units')
  assert.equal(definitionText({ type: 'times5', operands: [2469, 500] }, 'fr'), '2 469 × 500')
  assert.equal(definitionText({ type: 'div', operands: [467830, 2] }, 'en'), '467,830 ÷ 2')
  assert.equal(formatNumber(999, 'fr'), '999')
  assert.equal(formatNumber(1234567, 'fr'), '1 234 567')
})

test('N12 — affichage texte : grille remplie, grille vide numérotée', () => {
  const game = createCrossNumberGame({ className: 'CP', subsystem: 'fr', seed: 1 })
  const filled = filledGridText(game).split('\n')
  assert.equal(filled.length, 3)
  assert.ok(filled.every(l => l.split(' ').length === 3))
  const nums = cellNumbers(game)
  for (const e of game.entries) assert.equal(nums[e.cells[0][0]][e.cells[0][1]], e.number)
  const empty = emptyGridText(game)
  assert.equal(empty.split('\n').length, 7)
  assert.equal((empty.match(/####/g) ?? []).length, game.rows.join('').split('#').length - 1)
  assert.equal(Object.keys(CROSS_NUMBER_SETTINGS.fr).length, 5)
})

test('N13 — corrections du 2026-11-08 : réglages par classe', () => {
  const pick = (c, s) => {
    const x = crossNumberSettings(c, s)
    return [x.minTerm, x.maxQuotientDigits, x.minTables, x.maxTables, x.featureTimes50]
  }
  assert.deepEqual(Object.fromEntries(CLASSES.map(({ className, subsystem }) => [className, pick(className, subsystem)])), {
    CP: [1, null, 0, null, false],
    CE1: [10, null, 0, null, false],
    CE2: [10, null, 0, null, false],
    CM1: [10, 4, 0, 2, true],
    CM2: [10, 5, 0, 2, true],
    'Class 2': [1, null, 0, null, false],
    'Class 3': [10, null, 2, null, false],
    'Class 4': [10, null, 2, null, false],
    'Class 5': [10, 4, 0, 2, false],
    'Class 6': [10, 5, 0, 2, false]
  })
  assert.equal(MAX_DIVISION_SHARE, 0.4)
  assert.equal(MAX_TWO_DIGIT_DIVISIONS, 3)
  assert.equal(MAX_TWO_DIGIT_MULTIPLICAND, 9999)
  // Contexte des définitions : termes ≥ 10, quotient, multiplicande
  const ce1 = definitionContext(crossNumberSettings('CE1', 'fr'))
  assert.ok(checkDefinition({ type: 'add', operands: [9, 4] }, 13, ce1).includes('too-small'))
  assert.ok(checkDefinition({ type: 'add', operands: [6, 20] }, 26, ce1).includes('too-small'))
  assert.ok(checkDefinition({ type: 'sub', operands: [35, 9] }, 26, ce1).includes('too-small'))
  assert.deepEqual(checkDefinition({ type: 'add', operands: [16, 10] }, 26, ce1), [])
  assert.deepEqual(checkDefinition({ type: 'add', operands: [9, 4] }, 13, definitionContext(crossNumberSettings('CP', 'fr'))), [])
  assert.equal(definitionOptions('add', 19, ce1).length, 0) // 19 < 10 + 10
  const cm1 = definitionContext(crossNumberSettings('CM1', 'fr'))
  assert.ok(checkDefinition({ type: 'div', operands: [24690, 2] }, 12345, cm1).includes('not-in-programme'))
  assert.deepEqual(checkDefinition({ type: 'div', operands: [2468, 2] }, 1234, cm1), [])
  const c6 = definitionContext(crossNumberSettings('Class 6', 'en'))
  assert.deepEqual(checkDefinition({ type: 'div', operands: [24690, 2] }, 12345, c6), [])
  assert.ok(checkDefinition({ type: 'div', operands: [246912, 2] }, 123456, c6).includes('not-in-programme'))
  assert.ok(checkDefinition({ type: 'mul', operands: [12345, 12] }, 148140, c6).includes('not-in-programme'))
  assert.deepEqual(checkDefinition({ type: 'mul', operands: [1234, 12] }, 14808, c6), [])
  assert.deepEqual(checkDefinition({ type: 'mul', operands: [12345, 8] }, 98760, c6), [])
  // exclude : opérandes interdits
  for (const d of definitionOptions('add', 60, ce1, createRandom(1), new Set([30, 20]))) assert.ok(!d.operands.includes(30) && !d.operands.includes(20))
})

test('N14 — × 50 / × 500 au CM : sur la plupart des grilles ; produits des tables imposés en Class 3-4', () => {
  for (const className of ['CM1', 'CM2']) {
    let withFifty = 0
    for (let seed = 0; seed < SEEDS; seed++) {
      const game = createCrossNumberGame({ className, subsystem: 'fr', seed })
      if (game.entries.some(e => e.definition.type === 'times5' && e.definition.operands[1] >= 50)) withFifty++
    }
    assert.ok(withFifty >= SEEDS * 0.8, `${className} : × 50 / × 500 sur ${withFifty} grilles sur ${SEEDS}`)
  }
  // × 500 apparaît sur la série
  let fiveHundred = 0
  for (let seed = 0; seed < SEEDS; seed++) {
    const game = createCrossNumberGame({ className: 'CM2', subsystem: 'fr', seed })
    fiveHundred += game.entries.filter(e => e.definition.type === 'times5' && e.definition.operands[1] === 500).length
  }
  assert.ok(fiveHundred > 0)
  // Préparation : 2 nombres de 2 chiffres en Class 3 ; un multiple de 50 au CM1
  const c3 = crossNumberSettings('Class 3', 'en')
  const req = planRequirements(c3.templates[0].rows, c3, createRandom(1))
  assert.equal(req.size, 2)
  assert.ok([...req.values()].every(r => r.type === 'mulTable'))
  // Gabarit sans assez de nombres de 2 chiffres : essai impossible
  assert.equal(planRequirements(['...#', '...#', '...#', '####'], c3, createRandom(1)), null)
  const cm1 = crossNumberSettings('CM1', 'fr')
  // Depuis le lot C, un second nombre peut être préparé pour le niveau 3
  const reqCm = [...planRequirements(cm1.templates[0].rows, cm1, createRandom(1)).values()].filter(r => r.type === 'times5')
  assert.equal(reqCm.length, 1)
  assert.ok(reqCm[0].tail.join('') === '00' || reqCm[0].tail.join('') === '50')
})

test('N15 — 3 × 3 : escalier ajouté ; carré et escalier privilégiés (poids 2, 2, 1)', () => {
  assert.deepEqual(analyzeTemplate(['##.', '#..', '..#'], { maxDigits: 2 }).errors, [])
  for (const className of ['CP', 'Class 2']) {
    const sub = className === 'CP' ? 'fr' : 'en'
    const settings = crossNumberSettings(className, sub)
    assert.deepEqual(settings.templates.map(t => [t.id, t.weight]), [['T3-coins', 1], ['T3-carre', 2], ['T3-escalier', 2]])
    const seen = {}
    for (let seed = 0; seed < 1000; seed++) {
      const id = createCrossNumberGame({ className, subsystem: sub, seed }).templateId
      seen[id] = (seen[id] ?? 0) + 1
    }
    // Attendu : 40 % / 40 % / 20 % ; marge large
    assert.ok(seen['T3-carre'] > 320 && seen['T3-escalier'] > 320 && seen['T3-coins'] > 120 && seen['T3-coins'] < 280, JSON.stringify(seen))
  }
  const random = createRandom(3)
  const list = [{ id: 'x', weight: 0 }, { id: 'y' }]
  for (let i = 0; i < 20; i++) assert.equal(pickWeighted(list, random).id, 'y')
})

test('N16 — vérificateur : nouvelles règles et entrées absurdes', () => {
  // Entrées absurdes : ok false, jamais d'exception
  for (const bad of [null, undefined, 5, 'grille', [], {}]) {
    const r = verifyCrossNumberGame(bad)
    assert.equal(r.ok, false)
  }
  const base = createCrossNumberGame({ className: 'CE1', subsystem: 'fr', seed: 11 })
  for (const mutate of [
    g => { g.entries[0] = null },
    g => { g.entries = null },
    g => { g.cells = null },
    g => { g.rows = null },
    g => { g.entries[0].definition = null },
    g => { g.entries[0].definition.operands = null },
    g => { g.entries[0].text = null }
  ]) {
    const g = clone(base)
    mutate(g)
    assert.equal(verifyCrossNumberGame(g).ok, false)
  }
  const setDef = (g, i, definition) => {
    g.entries[i].definition = definition
    g.entries[i].text = { fr: definitionText(definition, 'fr'), en: definitionText(definition, 'en') }
  }
  // Opérande égal à la réponse d'un autre nombre
  let g = clone(base)
  const other = g.entries[1].answer
  const n0 = g.entries[0].answer
  if (n0 > other + 10) {
    setDef(g, 0, { type: 'add', operands: [other, n0 - other] })
  } else {
    setDef(g, 0, { type: 'sub', operands: [n0 + other, other] })
  }
  assert.ok(codes(verifyCrossNumberGame(g)).includes('operand-is-answer'))
  // Terme < 10 au CE1
  g = clone(base)
  setDef(g, 0, { type: 'sub', operands: [g.entries[0].answer + 3, 3] })
  assert.ok(verifyCrossNumberGame(g).errors.some(e => e.code === 'definition' && e.detail.includes('too-small')))
  // Trop de divisions : toutes les définitions possibles en divisions par 2 à 9
  g = clone(base)
  g.entries.forEach((e, i) => { if (i < 5) setDef(g, i, { type: 'div', operands: [e.answer * 2, 2] }) })
  assert.ok(codes(verifyCrossNumberGame(g)).includes('division-share'))
  // Plus de 3 divisions par un nombre de 2 chiffres (CE2 : diviseur jusqu'à 99)
  const ce2 = createCrossNumberGame({ className: 'CE2', subsystem: 'fr', seed: 4 })
  g = clone(ce2)
  let changed = 0
  for (let i = 0; i < g.entries.length && changed < 4; i++) {
    const n = g.entries[i].answer
    if (n * 11 <= 10000) { setDef(g, i, { type: 'div', operands: [n * 11, 11] }); changed++ }
  }
  assert.equal(changed, 4, 'grille d’essai trop petite')
  assert.ok(codes(verifyCrossNumberGame(g)).includes('two-digit-divisions'))
  // Class 3 : moins de 2 produits des tables
  const c3 = createCrossNumberGame({ className: 'Class 3', subsystem: 'en', seed: 2 })
  g = clone(c3)
  g.entries.forEach((e, i) => {
    if (e.definition.type === 'mulTable') setDef(g, i, { type: 'sub', operands: [e.answer + 10 + i, 10 + i] })
  })
  assert.ok(codes(verifyCrossNumberGame(g)).includes('tables-count'))
  // CM1 : plus de 2 produits des tables (première graine dont 3 nombres s'y prêtent)
  const productsOf = (game) => game.entries.flatMap(e => {
    for (let t = 2; t <= 10; t++) if (e.answer % t === 0 && e.answer / t >= 2 && e.answer / t <= 10) return [[e, t]]
    return []
  })
  let seedCm = 0
  while (productsOf(createCrossNumberGame({ className: 'CM1', subsystem: 'fr', seed: seedCm })).length < 3 && seedCm < 200) seedCm++
  g = clone(createCrossNumberGame({ className: 'CM1', subsystem: 'fr', seed: seedCm }))
  const products = productsOf(g).map(([e, t]) => [g.entries.find(x => x.id === e.id), t])
  assert.ok(products.length >= 3, 'grille d’essai sans 3 produits possibles')
  for (const [e, t] of products.slice(0, 3)) setDef(g, g.entries.indexOf(e), { type: 'mulTable', operands: [t, e.answer / t] })
  assert.ok(codes(verifyCrossNumberGame(g)).includes('tables-count'))
})

test('N17 — produits des tables comptés quel que soit le type (mulTable, mul, × 5…)', () => {
  assert.equal(isTableProduct({ type: 'mulTable', operands: [4, 7] }), true)
  assert.equal(isTableProduct({ type: 'times5', operands: [9, 5] }), true)
  assert.equal(isTableProduct({ type: 'mul', operands: [3, 8] }), true)
  assert.equal(isTableProduct({ type: 'mul', operands: [5, 5] }), true)
  assert.equal(isTableProduct({ type: 'times10', operands: [4, 10] }), true)
  assert.equal(isTableProduct({ type: 'mul', operands: [13, 8] }), false)
  assert.equal(isTableProduct({ type: 'times5', operands: [9, 50] }), false)
  assert.equal(isTableProduct({ type: 'add', operands: [3, 8] }), false)
  assert.equal(isTableProduct({ type: 'div', operands: [24, 3] }), false)
  assert.equal(isTableProduct(null), false)
  // Sur des séries de graines : au plus 2 au CM et en Class 5-6, tous types confondus
  let outsideMulTable = 0
  for (const [className, subsystem] of [['CM1', 'fr'], ['CM2', 'fr'], ['Class 5', 'en'], ['Class 6', 'en']]) {
    for (let seed = 0; seed < SEEDS; seed++) {
      const game = createCrossNumberGame({ className, subsystem, seed })
      const products = game.entries.filter(e => isTableProduct(e.definition))
      assert.ok(products.length <= 2, `${className} ${seed} : ${products.map(e => e.text.fr).join(', ')}`)
      outsideMulTable += products.filter(e => e.definition.type !== 'mulTable').length
    }
  }
  assert.ok(outsideMulTable > 0, 'la série doit contenir des produits des tables hors mulTable')
  // Vérificateur : « 9 × 5 » (times5) et « 3 × 8 » (mul) comptent avec les produits mulTable
  let seed = 0
  let game
  const setDef = (g, i, definition) => {
    g.entries[i].definition = definition
    g.entries[i].text = { fr: definitionText(definition, 'fr'), en: definitionText(definition, 'en') }
  }
  // Grille Class 5 avec 3 nombres qui s'écrivent a × b (2 ≤ a, b ≤ 10) sans mulTable
  const factorOf = (n) => { for (let b = 2; b <= 9; b++) if (n % b === 0 && n / b >= 2 && n / b <= 10) return b; return null }
  do {
    game = clone(createCrossNumberGame({ className: 'Class 5', subsystem: 'en', seed }))
    seed++
  } while (game.entries.filter(e => factorOf(e.answer) !== null).length < 3 && seed < 500)
  const targets = game.entries.filter(e => factorOf(e.answer) !== null).slice(0, 3)
  assert.equal(targets.length, 3)
  for (const e of targets) {
    const b = factorOf(e.answer)
    setDef(game, game.entries.indexOf(e), { type: 'mul', operands: [e.answer / b, b] })
  }
  assert.ok(codes(verifyCrossNumberGame(game)).includes('tables-count'))
})

// --- Lot C : niveau 3 (CM1, CM2, Class 5, Class 6) et BODMAS (Class 4) -------

const LOT_C = [['CM1', 'fr'], ['CM2', 'fr'], ['Class 5', 'en'], ['Class 6', 'en']]
const LEVEL3_TYPES = ['next', 'prev', 'decomposition']
const POW10 = ['timesPow10', 'divPow10']

test('N18 — lot C : nouveaux types (qui suit, qui précède, décomposition par rang, × / ÷ par 10, 100, 1 000) : calcul, règles, textes FR et EN', () => {
  const cm1 = definitionContext(crossNumberSettings('CM1', 'fr'))
  const cm2 = definitionContext(crossNumberSettings('CM2', 'fr'))
  const c5 = definitionContext(crossNumberSettings('Class 5', 'en'))
  for (const t of [...LEVEL3_TYPES, ...POW10, 'addProduct', 'subProduct']) assert.ok(DEFINITION_TYPES.includes(t), t)
  // Nombre qui suit / qui précède : réponse ≥ 4 chiffres, avec une retenue
  assert.equal(evaluateDefinition({ type: 'next', operands: [4599] }), 4600)
  assert.equal(evaluateDefinition({ type: 'prev', operands: [4600] }), 4599)
  assert.deepEqual(checkDefinition({ type: 'next', operands: [4599] }, 4600, cm1), [])
  assert.deepEqual(checkDefinition({ type: 'prev', operands: [70980] }, 70979, c5), [])
  assert.ok(checkDefinition({ type: 'next', operands: [4566] }, 4567, cm1).includes('trivial'), 'sans retenue')
  assert.ok(checkDefinition({ type: 'prev', operands: [4567] }, 4566, cm1).includes('trivial'), 'sans retenue')
  assert.ok(checkDefinition({ type: 'next', operands: [399] }, 400, cm1).includes('trivial'), 'moins de 4 chiffres')
  assert.ok(checkDefinition({ type: 'next', operands: [4599] }, 4601, cm1).includes('wrong-value'))
  assert.ok(checkDefinition({ type: 'next', operands: [4599, 1] }, 4600, cm1).includes('bad-structure'))
  assert.ok(checkDefinition({ type: 'prev', operands: [1000000] }, 999999, c5).includes('out-of-range'), 'opérande > maxNumber')
  assert.equal(NEXT_MIN_DIGITS, 4)
  assert.deepEqual(definitionOptions('next', 4600, cm1), [{ type: 'next', operands: [4599] }])
  assert.deepEqual(definitionOptions('next', 4601, cm1), [])
  assert.deepEqual(definitionOptions('prev', 4599, cm1), [{ type: 'prev', operands: [4600] }])
  assert.equal(definitionText({ type: 'next', operands: [4599] }, 'fr'), 'le nombre qui suit 4 599')
  assert.equal(definitionText({ type: 'next', operands: [4599] }, 'en'), 'the number after 4,599')
  assert.equal(definitionText({ type: 'prev', operands: [70980] }, 'fr'), 'le nombre qui précède 70 980')
  assert.equal(definitionText({ type: 'prev', operands: [70980] }, 'en'), 'the number before 70,980')
  // Décomposition par rang : 4 à 9 chiffres, au plus 3 rangs non nuls
  assert.equal(evaluateDefinition({ type: 'decomposition', operands: [4, 0, 0, 0, 0, 3] }), 400003)
  assert.deepEqual(checkDefinition({ type: 'decomposition', operands: [4, 5, 0, 0, 0, 3] }, 450003, cm1), [])
  assert.deepEqual(checkDefinition({ type: 'decomposition', operands: [2, 0, 0, 7] }, 2007, c5), [], 'pas de refus « contient la réponse »')
  assert.ok(checkDefinition({ type: 'decomposition', operands: [4, 5, 1, 2] }, 4512, cm1).includes('too-long'))
  assert.ok(checkDefinition({ type: 'decomposition', operands: [0, 5, 0, 2] }, 502, cm1).includes('bad-structure'), '0 en tête')
  assert.ok(checkDefinition({ type: 'decomposition', operands: [5, 12, 0, 2] }, 6202, cm1).includes('bad-structure'), 'chiffre > 9')
  assert.ok(checkDefinition({ type: 'decomposition', operands: [5, 0, 2] }, 502, cm1).includes('bad-structure'), 'moins de 4 chiffres')
  assert.ok(checkDefinition({ type: 'decomposition', operands: [5, 0, 0, 2] }, 5003, cm1).includes('wrong-value'))
  assert.equal(DECOMPOSITION_MAX_PARTS, 3)
  assert.deepEqual(definitionOptions('decomposition', 4500, cm1), [{ type: 'decomposition', operands: [4, 5, 0, 0] }])
  assert.deepEqual(definitionOptions('decomposition', 4512, cm1), [])
  assert.equal(definitionText({ type: 'decomposition', operands: [4, 5, 0, 0, 0, 3] }, 'fr'), '4 centaines de mille, 5 dizaines de mille et 3 unités')
  assert.equal(definitionText({ type: 'decomposition', operands: [4, 5, 0, 0, 0, 3] }, 'en'), '4 hundred thousands, 5 ten thousands and 3 units')
  assert.equal(definitionText({ type: 'decomposition', operands: [1, 0, 1, 0] }, 'fr'), '1 unité de mille et 1 dizaine')
  assert.equal(definitionText({ type: 'decomposition', operands: [1, 0, 1, 0] }, 'en'), '1 thousand and 1 ten')
  assert.equal(definitionText({ type: 'decomposition', operands: [2, 0, 0, 0, 0, 0, 5] }, 'fr'), '2 millions et 5 unités')
  // × et ÷ par 10, 100, 1 000 (CM seulement)
  assert.deepEqual(checkDefinition({ type: 'timesPow10', operands: [45, 1000] }, 45000, cm1), [])
  assert.ok(checkDefinition({ type: 'timesPow10', operands: [45, 20] }, 900, cm1).includes('not-in-programme'))
  assert.ok(checkDefinition({ type: 'timesPow10', operands: [1, 100] }, 100, cm1).includes('trivial'))
  assert.deepEqual(checkDefinition({ type: 'divPow10', operands: [45000, 100] }, 450, cm1), [], 'le dividende contient le quotient : permis')
  assert.ok(checkDefinition({ type: 'divPow10', operands: [45010, 100] }, 450, cm1).includes('wrong-value'), 'non exacte')
  assert.ok(checkDefinition({ type: 'divPow10', operands: [4500, 50] }, 90, cm1).includes('not-in-programme'))
  assert.ok(checkDefinition({ type: 'divPow10', operands: [45000000, 1000] }, 45000, cm1).includes('out-of-range'), 'dividende > maxNumber')
  assert.deepEqual(checkDefinition({ type: 'divPow10', operands: [45000000, 1000] }, 45000, cm2), [])
  assert.ok(checkDefinition({ type: 'divPow10', operands: [45000, 100] }, 450, c5).includes('type-not-allowed'), 'pas en Class 5')
  assert.deepEqual(definitionOptions('divPow10', 4500, cm1).map(d => d.operands), [[45000, 10], [450000, 100]])
  assert.deepEqual(definitionOptions('timesPow10', 4500, cm1).map(d => d.operands), [[450, 10], [45, 100]])
  assert.equal(definitionText({ type: 'divPow10', operands: [45000, 100] }, 'fr'), '45 000 ÷ 100')
  assert.equal(definitionText({ type: 'timesPow10', operands: [45, 1000] }, 'en'), '45 × 1,000')
  // × 10 par un facteur des tables : compté comme produit des tables
  assert.equal(isTableProduct({ type: 'timesPow10', operands: [7, 10] }), true)
  assert.equal(isTableProduct({ type: 'timesPow10', operands: [7, 100] }), false)
  // Options : toujours valides, textes tirés de la même structure
  for (const [className, subsystem] of LOT_C) {
    const ctx = definitionContext(crossNumberSettings(className, subsystem))
    for (const n of [1010, 4599, 4600, 20070, 99990, 450000]) {
      for (const type of ctx.operations) {
        for (const def of definitionOptions(type, n, ctx, createRandom(n))) {
          assert.deepEqual(checkDefinition(def, n, ctx), [], `${className} ${type} ${n}`)
          assert.ok(definitionText(def, 'fr').length > 0 && definitionText(def, 'en').length > 0)
        }
      }
    }
  }
})

test('N19 — Class 4, BODMAS : a + b × c et a − b × c, multiplication d\'abord, produit des tables, jamais négatif, pas de parenthèses', () => {
  const c4 = definitionContext(crossNumberSettings('Class 4', 'en'))
  // La multiplication d'abord : 13 + 4 × 5 = 33 (et non 85)
  assert.equal(evaluateDefinition({ type: 'addProduct', operands: [13, 4, 5] }), 33)
  assert.equal(evaluateDefinition({ type: 'subProduct', operands: [45, 3, 9] }), 18)
  assert.deepEqual(checkDefinition({ type: 'addProduct', operands: [13, 4, 5] }, 33, c4), [])
  assert.ok(checkDefinition({ type: 'addProduct', operands: [13, 4, 5] }, 85, c4).includes('wrong-value'), '(13 + 4) × 5 refusé')
  assert.ok(checkDefinition({ type: 'subProduct', operands: [45, 3, 9] }, 378, c4).includes('wrong-value'), '(45 − 3) × 9 refusé')
  assert.deepEqual(checkDefinition({ type: 'subProduct', operands: [45, 3, 9] }, 18, c4), [])
  // Aucun résultat négatif
  assert.ok(checkDefinition({ type: 'subProduct', operands: [20, 4, 7] }, -8, c4).includes('out-of-range'))
  // Produit des tables de la classe (2 à 9 en Class 4), facteurs ≥ 2
  assert.ok(checkDefinition({ type: 'addProduct', operands: [13, 11, 12] }, 145, c4).includes('not-in-programme'))
  assert.ok(checkDefinition({ type: 'addProduct', operands: [33, 1, 5] }, 38, c4).includes('trivial'))
  // Premier terme ≥ 10 (minTerm, comme l'addition)
  assert.ok(checkDefinition({ type: 'addProduct', operands: [3, 4, 5] }, 23, c4).includes('too-small'))
  assert.ok(checkDefinition({ type: 'addProduct', operands: [0, 4, 5] }, 20, c4).includes('trivial'))
  // Produit b × c ≥ 10 lui aussi (décision d'Isaac du 2026-11-08, réserve R1)
  assert.ok(checkDefinition({ type: 'addProduct', operands: [10, 3, 2] }, 16, c4).includes('too-small'))
  assert.ok(checkDefinition({ type: 'subProduct', operands: [45, 2, 4] }, 37, c4).includes('too-small'))
  assert.deepEqual(checkDefinition({ type: 'addProduct', operands: [10, 2, 5] }, 20, c4), [])
  for (const type of ['addProduct', 'subProduct']) {
    for (const n of [16, 19, 47, 855, 3170]) {
      for (const d of definitionOptions(type, n, c4)) assert.ok(d.operands[1] * d.operands[2] >= 10, `${type} ${n}`)
    }
  }
  // Grille Class 4 contenant « 10 + 3 × 2 » : refusée par le vérificateur
  {
    let s16 = 0
    let g16
    do g16 = clone(createCrossNumberGame({ className: 'Class 4', subsystem: 'en', seed: s16++ }))
    while (!g16.entries.some(x => x.answer === 16) && s16 < 3000)
    const k16 = g16.entries.findIndex(x => x.answer === 16)
    assert.ok(k16 >= 0, 'une grille Class 4 avec le nombre 16')
    const bad = { type: 'addProduct', operands: [10, 3, 2] }
    g16.entries[k16].definition = bad
    g16.entries[k16].text = { fr: definitionText(bad, 'fr'), en: definitionText(bad, 'en') }
    assert.equal(g16.entries[k16].text.fr, '10 + 3 × 2')
    const r16 = verifyCrossNumberGame(g16)
    assert.equal(r16.ok, false)
    assert.ok(r16.errors.some(x => x.code === 'definition' && x.entry === g16.entries[k16].id && x.detail.includes('too-small')))
  }
  // Dans le programme de Class 4 seulement
  assert.ok(checkDefinition({ type: 'addProduct', operands: [13, 4, 5] }, 33, definitionContext(crossNumberSettings('Class 3', 'en'))).includes('type-not-allowed'))
  assert.ok(checkDefinition({ type: 'addProduct', operands: [13, 4, 5] }, 33, definitionContext(crossNumberSettings('CE2', 'fr'))).includes('type-not-allowed'))
  // Textes (pas de parenthèses ; les deux langues tirées de la même structure)
  assert.equal(definitionText({ type: 'addProduct', operands: [13, 4, 5] }, 'fr'), '13 + 4 × 5')
  assert.equal(definitionText({ type: 'subProduct', operands: [1245, 3, 9] }, 'en'), '1,245 − 3 × 9')
  assert.equal(definitionText({ type: 'subProduct', operands: [1245, 3, 9] }, 'fr'), '1 245 − 3 × 9')
  // Options : toutes valides
  const opts = definitionOptions('addProduct', 33, c4)
  assert.ok(opts.length > 0)
  for (const d of opts) assert.deepEqual(checkDefinition(d, 33, c4), [])
  assert.ok(definitionOptions('subProduct', 4990, c4).every(d => d.operands[0] <= 5000))
  // Le produit d'une expression n'est pas compté comme produit des tables
  assert.equal(isTableProduct({ type: 'addProduct', operands: [13, 4, 5] }), false)
  // Sur 100 graines : expressions présentes, jamais de parenthèses, grilles vérifiées
  let expressions = 0
  for (let seed = 0; seed < 100; seed++) {
    const game = createCrossNumberGame({ className: 'Class 4', subsystem: 'en', seed })
    assert.ok(verifyCrossNumberGame(game).ok, `Class 4 ${seed}`)
    for (const e of game.entries) {
      if (e.definition.type !== 'addProduct' && e.definition.type !== 'subProduct') continue
      expressions++
      const [a, b, c] = e.definition.operands
      assert.equal(e.answer, e.definition.type === 'addProduct' ? a + b * c : a - b * c)
      assert.ok(e.answer >= 0 && a <= 5000)
      assert.ok(!/[()]/.test(e.text.fr) && !/[()]/.test(e.text.en))
    }
  }
  assert.ok(expressions >= 100, `${expressions} expressions sur 100 grilles`)
})

test('N20 — vérificateur, lot C : définitions altérées refusées, limite « × / ÷ par 10, 100, 1 000 », types hors classe', () => {
  const setDef = (g, i, definition) => {
    g.entries[i].definition = definition
    g.entries[i].text = { fr: definitionText(definition, 'fr'), en: definitionText(definition, 'en') }
  }
  // Une grille CM2 avec un nombre « qui suit », « qui précède » ou une décomposition
  let seed = 0
  let base
  do base = createCrossNumberGame({ className: 'CM2', subsystem: 'fr', seed: seed++ })
  while (!base.entries.some(e => LEVEL3_TYPES.includes(e.definition.type)) && seed < 200)
  assert.ok(verifyCrossNumberGame(base).ok)
  const i = base.entries.findIndex(e => LEVEL3_TYPES.includes(e.definition.type))
  assert.ok(i >= 0)
  const e = base.entries[i]
  // Valeur changée sans changer le texte : refusée (définition et texte)
  let g = clone(base)
  const ops = e.definition.operands
  g.entries[i].definition = { type: e.definition.type, operands: e.definition.type === 'decomposition' ? [...ops.slice(0, -1), (ops.at(-1) + 1) % 10] : [ops[0] + 1] }
  assert.ok(codes(verifyCrossNumberGame(g)).includes('definition'))
  assert.ok(codes(verifyCrossNumberGame(g)).includes('text'))
  // Texte d'une autre langue : refusé
  g = clone(base)
  g.entries[i].text = { fr: g.entries[i].text.en, en: g.entries[i].text.en }
  assert.deepEqual(codes(verifyCrossNumberGame(g)), ['text'])
  // Nombre qui suit sans retenue : refusé (trivial)
  const k0 = base.entries.findIndex(x => x.answer >= 1000 && x.answer % 10 !== 0)
  assert.ok(k0 >= 0)
  g = clone(base)
  setDef(g, k0, { type: 'next', operands: [base.entries[k0].answer - 1] })
  assert.ok(verifyCrossNumberGame(g).errors.some(x => x.code === 'definition' && x.detail.includes('trivial')))
  // Plus de 2 « × / ÷ par 10, 100, 1 000 » : refusé
  g = clone(base)
  const answers = g.entries.map(x => x.answer)
  const ctx = definitionContext(crossNumberSettings('CM2', 'fr'))
  let placed = 0
  g.entries.forEach((x, k) => {
    if (placed > MAX_POW10_PER_GRID) return
    const exclude = new Set(answers.filter(a => a !== x.answer))
    const opt = definitionOptions('divPow10', x.answer, ctx, null, exclude)[0]
    if (opt) { setDef(g, k, opt); placed++ }
  })
  assert.equal(placed, MAX_POW10_PER_GRID + 1)
  assert.ok(codes(verifyCrossNumberGame(g)).includes('pow10-count'))
  assert.equal(MAX_POW10_PER_GRID, 2)
  // Type permis au CM mais pas en Class 5 : refusé
  const c5 = clone(createCrossNumberGame({ className: 'Class 5', subsystem: 'en', seed: 3 }))
  const k = c5.entries.findIndex(x => x.answer * 10 <= 100000)
  setDef(c5, k, { type: 'divPow10', operands: [c5.entries[k].answer * 10, 10] })
  assert.ok(verifyCrossNumberGame(c5).errors.some(x => x.code === 'definition' && x.detail.includes('type-not-allowed')))
  // BODMAS calculé de gauche à droite : refusé
  let s4 = 0
  let c4
  do c4 = clone(createCrossNumberGame({ className: 'Class 4', subsystem: 'en', seed: s4++ }))
  while (!c4.entries.some(x => x.definition.type === 'addProduct' || x.definition.type === 'subProduct') && s4 < 50)
  const j = c4.entries.findIndex(x => x.definition.type === 'addProduct' || x.definition.type === 'subProduct')
  assert.ok(j >= 0)
  const [a, b, c] = c4.entries[j].definition.operands
  c4.entries[j].answer = c4.entries[j].definition.type === 'addProduct' ? (a + b) * c : (a - b) * c
  assert.ok(!verifyCrossNumberGame(c4).ok)
})

test('N21 — lot C : 50 graines par classe (CM1, CM2, Class 5, Class 6) : bornes des lots A et B, niveau 3 présent, même graine = même grille', () => {
  for (const [className, subsystem] of LOT_C) {
    const settings = crossNumberSettings(className, subsystem)
    const isCm = subsystem === 'fr'
    const small = ['CM1', 'Class 5'].includes(className)
    let level3Grids = 0
    let pow10Seen = 0
    for (let seed = 0; seed < 50; seed++) {
      const game = createCrossNumberGame({ className, subsystem, seed })
      assert.ok(verifyCrossNumberGame(game).ok, `${className} ${seed}`)
      assert.equal(game.size, small ? 6 : 7)
      // Même graine + même classe = même grille (P12 a)
      assert.deepEqual(createCrossNumberGame({ className, subsystem, seed }), game)
      const defs = game.entries.map(e => e.definition)
      const count = (pred) => defs.filter(pred).length
      // Divisions : au plus 40 % (type div seulement), diviseur ≤ 99, au plus 3 par un nombre de 2 chiffres
      assert.ok(count(d => d.type === 'div') <= Math.floor(0.4 * defs.length))
      assert.ok(count(d => d.type === 'div' && d.operands[1] >= 10) <= 3)
      for (const e of game.entries) {
        const d = e.definition
        if (d.type === 'div') {
          assert.ok(d.operands[1] <= 99, `${className} ${seed} ${e.text.fr}`)
          assert.ok(String(e.answer).length <= (small ? 4 : 5), `${className} ${seed} quotient ${e.text.fr}`)
        }
        if (d.type === 'mul' && d.operands[1] >= 10) assert.ok(d.operands[0] <= 9999)
        if (LEVEL3_TYPES.includes(d.type)) assert.ok(e.answer >= 1000)
        if (!isCm) assert.ok(!POW10.includes(d.type), 'pas de × / ÷ par 10, 100, 1 000 en Class 5-6')
        // Aucun opérande égal à la réponse d'un autre nombre
        for (const x of d.operands) assert.ok(!game.entries.some(o => o !== e && o.answer === x))
      }
      // Produits des tables (tous types) : au plus 2
      assert.ok(count(isTableProduct) <= 2)
      assert.ok(count(d => POW10.includes(d.type)) <= MAX_POW10_PER_GRID)
      pow10Seen += count(d => POW10.includes(d.type))
      if (defs.some(d => LEVEL3_TYPES.includes(d.type))) level3Grids++
      // Aucune définition ouverte (multiples, divisibilité), aucun nombre négatif
      assert.ok(defs.every(d => DEFINITION_TYPES.includes(d.type)))
      assert.ok(game.entries.every(e => e.answer > 0 && e.definition.operands.every(x => x >= 0)))
    }
    // Un nombre préparé pour le niveau 3 sur la plupart des grilles
    assert.ok(level3Grids >= 40, `${className} : niveau 3 sur ${level3Grids} grilles sur 50`)
    if (isCm) assert.ok(pow10Seen > 0, `${className} : × / ÷ par 10, 100, 1 000 absents`)
    assert.equal(settings.featureLevel3, true)
  }
  // Classes des lots A et B : aucun type du lot C (sauf BODMAS en Class 4)
  for (const [className, subsystem] of [['CP', 'fr'], ['CE1', 'fr'], ['CE2', 'fr'], ['Class 2', 'en'], ['Class 3', 'en']]) {
    const ops = crossNumberSettings(className, subsystem).operations
    assert.ok(![...LEVEL3_TYPES, ...POW10, 'addProduct', 'subProduct'].some(t => ops.includes(t)), className)
    assert.equal(crossNumberSettings(className, subsystem).featureLevel3, false)
  }
})

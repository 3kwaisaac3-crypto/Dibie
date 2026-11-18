// Tests des familles du calcul mental (phase 7, lot B ; docs/calcul-mental.md
// §3, §4 et §9) — lancer avec : npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MATH_CLASSES, mathClassSettings } from '../data/reglages-maths.js'
import { MENTAL_MATH_CLASSES } from '../data/calcul-mental.js'
import { FAMILY_IDS, familyName, classFamilies, familyCalcs, calcText, formatNumber } from './mentalMath.js'

const MIN_CALCS_PER_FAMILY = 9 // SIL : C et F comptent 9 calculs (lot 0 §2.3)
const ALL_CLASSES = [...MATH_CLASSES.fr, ...MATH_CLASSES.en]
const settingsOf = (className) => ALL_CLASSES.find(c => c.className === className)

// Spec §3 (vue d'ensemble du lot 0, §2.3)
const EXPECTED_FAMILIES = {
  SIL: 'ABCF', CP: 'ABCDF', CE1: 'ABCDEF', CE2: 'ABCDEFG', CM1: 'ABCDFGHI', CM2: 'ABCDFGHI',
  'Class 1': 'ABC', 'Class 2': 'ABCD', 'Class 3': 'ABCDF', 'Class 4': 'ABCDF', 'Class 5': 'ABCDFI', 'Class 6': 'ABCDFI'
}

test('familles de chaque classe : tableau du spec §3, pour les 12 classes', () => {
  assert.deepEqual(FAMILY_IDS, ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'])
  assert.equal(ALL_CLASSES.length, 12)
  for (const { className } of ALL_CLASSES) {
    assert.ok(MENTAL_MATH_CLASSES[className], className)
    assert.deepEqual(classFamilies(className), EXPECTED_FAMILIES[className].split(''), className)
  }
  assert.deepEqual(classFamilies('X'), [])
  assert.ok(Object.isFrozen(MENTAL_MATH_CLASSES))
})

test('noms des familles en français et en anglais', () => {
  assert.equal(familyName('C', 'fr'), 'Compléments')
  assert.equal(familyName('C', 'en'), 'Number bonds')
  for (const id of FAMILY_IDS) {
    assert.ok(familyName(id, 'fr').length > 0 && familyName(id, 'en').length > 0, id)
  }
})

test('chaque calcul respecte les règles communes (§4) et le plafond de la classe', () => {
  for (const { className } of ALL_CLASSES) {
    const { maxNumber } = settingsOf(className)
    for (const family of classFamilies(className)) {
      const calcs = familyCalcs(className, family)
      const where = `${className} ${family}`
      assert.ok(calcs.length >= MIN_CALCS_PER_FAMILY, `${where} : ${calcs.length} calculs`)
      assert.equal(new Set(calcs.map(c => c.id)).size, calcs.length, `${where} : id répétés`)
      assert.equal(new Set(calcs.map(c => calcText(c, 'fr'))).size, calcs.length, `${where} : textes répétés`)
      for (const c of calcs) {
        assert.equal(c.family, family)
        assert.ok(Number.isInteger(c.answer) && c.answer >= 1, `${where} : ${c.id}`)
        for (const n of c.shown) assert.ok(Number.isInteger(n) && n >= 1 && n <= maxNumber, `${where} : ${c.id} (${n})`)
        if (c.type === 'table') {
          assert.ok(c.b >= 2 && c.b <= 10 && c.a >= 2, `${where} : ${c.id}`)
          assert.equal(c.answer, c.a * c.b)
        }
        if (c.type === 'divPow10') assert.equal(c.a % c.k, 0, `${where} : ${c.id}`)
      }
    }
  }
})

test('SIL et Class 1 : calculs sans aucun mot', () => {
  const symbolsOnly = new RegExp('^[0-9 \\u00A0+\\u2212\\u00D7\\u00F7?=]+$')
  for (const className of ['SIL', 'Class 1']) {
    for (const family of classFamilies(className)) {
      for (const c of familyCalcs(className, family)) {
        assert.match(calcText(c, 'fr'), symbolsOnly, `${className} ${c.id}`)
        assert.match(calcText(c, 'en'), symbolsOnly, `${className} ${c.id}`)
      }
    }
  }
})

const texts = (className, family) => familyCalcs(className, family).map(c => calcText(c, 'fr'))

test('contrôles ponctuels des bornes du lot 0', () => {
  assert.deepEqual(texts('SIL', 'C').sort(), [1, 2, 3, 4, 5, 6, 7, 8, 9].map(a => `${a} + ? = 10`).sort())
  assert.deepEqual(texts('SIL', 'F').sort(), [2, 3, 4, 5, 6, 7, 8, 9, 10].map(a => `2 × ${a} = ?`).sort())
  const halves = familyCalcs('CP', 'D').filter(c => c.type === 'half')
  assert.deepEqual(halves.map(c => c.a).sort((x, y) => x - y), Array.from({ length: 19 }, (_, i) => 4 + 2 * i))
  const thirds = familyCalcs('CE1', 'E').filter(c => c.type === 'third')
  assert.deepEqual(thirds.map(c => c.a).sort((x, y) => x - y), [6, 9, 12, 15, 18, 21, 24, 27, 30])
  for (const c of familyCalcs('CM1', 'I')) {
    assert.equal(c.type, 'missingFactor')
    assert.ok(c.b <= 100 && c.answer >= 2 && c.answer <= 10, c.id)
  }
  const times25 = familyCalcs('CM2', 'H').filter(c => c.type === 'timesK' && c.k === 25)
  assert.deepEqual(times25.map(c => c.a).sort((x, y) => x - y), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  assert.ok(times25.every(c => c.answer <= 300))
  const quotients = familyCalcs('CM1', 'G').filter(c => c.type === 'divPow10')
  assert.ok(quotients.every(c => c.answer >= 2 && c.answer <= 999))
  assert.equal(Math.max(...quotients.map(c => c.answer)), 999)
  assert.ok(familyCalcs('Class 1', 'C').every(c => c.b >= 5 && c.b <= 10 && c.a < c.b))
  assert.equal(familyCalcs('CM1', 'H').filter(c => c.k === 11).length, 0)
})

test('affichage : nombres groupés par trois, formes des calculs', () => {
  assert.equal(formatNumber(4500), '4 500')
  assert.equal(formatNumber(999000), '999 000')
  assert.equal(formatNumber(56), '56')
  const missing = familyCalcs('CM1', 'I').find(c => c.a === 7 && c.b === 56)
  assert.equal(calcText(missing, 'fr'), '7 × ? = 56')
  const half = familyCalcs('CP', 'D').find(c => c.type === 'half' && c.a === 18)
  assert.equal(calcText(half, 'fr'), 'Moitié de 18')
  assert.equal(calcText(half, 'en'), 'Half of 18')
  const sub = familyCalcs('CP', 'B').find(c => c.a === 16 && c.b === 7)
  assert.equal(calcText(sub, 'fr'), '16 − 7 = ?')
  const div = familyCalcs('CM1', 'G').find(c => c.type === 'divPow10' && c.a === 4500 && c.k === 100)
  assert.equal(calcText(div, 'fr'), '4 500 ÷ 100 = ?')
  assert.equal(div.answer, 45)
  assert.equal(mathClassSettings('SIL', 'fr').maxNumber, 20)
})

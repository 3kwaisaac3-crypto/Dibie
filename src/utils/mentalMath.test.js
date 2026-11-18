// Tests des séries, des réponses et des indices du calcul mental (phase 7,
// lot B ; docs/calcul-mental.md §6.2 à §6.4) — lancer avec : npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  GAME_TYPE_MENTAL_MATH, SERIES_LENGTH, POINTS_PER_CALC, HINT_AFTER_ERRORS, REVEAL_AFTER_ERRORS, MIXED,
  classFamilies, familyCalcs, createMentalSeries, maxDigits,
  createMentalState, currentCalc, currentEntry, isResolved, showHint, canReveal,
  submitAnswer, revealAnswer, nextCalc, mentalScore, foundCount, revealedCount, errorCount, calcHint
} from './mentalMath.js'

test('constantes', () => {
  assert.equal(GAME_TYPE_MENTAL_MATH, 'mentalMath')
  assert.equal(SERIES_LENGTH, 10)
  assert.equal(POINTS_PER_CALC, 10)
  assert.equal(HINT_AFTER_ERRORS, 2)
  assert.equal(REVEAL_AFTER_ERRORS, 3)
  assert.equal(MIXED, 'mix')
})

test('séries : même graine, même série ; entrées invalides refusées', () => {
  assert.deepEqual(createMentalSeries('CM1', MIXED, 9), createMentalSeries('CM1', MIXED, 9))
  assert.throws(() => createMentalSeries('CE1', 'A', -1), RangeError)
  assert.throws(() => createMentalSeries('X', 'A', 1), RangeError)
  assert.throws(() => createMentalSeries('SIL', 'G', 1), RangeError)
})

test('série d’une famille : 10 calculs distincts ; 9 pour une famille de 9', () => {
  for (let seed = 0; seed < 20; seed++) {
    const s = createMentalSeries('CE1', 'A', seed)
    assert.equal(s.calcs.length, 10)
    assert.equal(new Set(s.calcs.map(c => c.id)).size, 10)
    assert.ok(s.calcs.every(c => c.family === 'A'))
    assert.equal(createMentalSeries('SIL', 'C', seed).calcs.length, 9)
  }
})

test('mélange de la classe : 10 calculs distincts, chaque famille présente', () => {
  for (const className of ['CM1', 'Class 1', 'SIL']) {
    for (let seed = 0; seed < 100; seed++) {
      const { calcs } = createMentalSeries(className, MIXED, seed)
      assert.equal(calcs.length, 10, className)
      assert.equal(new Set(calcs.map(c => c.id)).size, 10, className)
      for (const f of classFamilies(className)) assert.ok(calcs.some(c => c.family === f), `${className}, graine ${seed} : ${f}`)
    }
  }
})

test('maxDigits : chiffres de la plus grande réponse', () => {
  const s = createMentalSeries('CM1', 'G', 3)
  assert.equal(maxDigits(s), Math.max(...s.calcs.map(c => String(c.answer).length)))
  assert.ok(createMentalSeries('SIL', MIXED, 3).calcs.length > 0)
  assert.ok(maxDigits(createMentalSeries('SIL', MIXED, 3)) <= 2)
})

// Série à une famille, pour piloter les réponses
const series = () => createMentalSeries('CE1', 'F', 11)
const answerOf = (s, st) => currentCalc(s, st).answer

test('juste du premier coup : 10 points ; après 3 erreurs : 10 points aussi', () => {
  const s = series()
  let st = createMentalState(s)
  st = submitAnswer(s, st, answerOf(s, st))
  assert.ok(isResolved(currentEntry(st)))
  assert.equal(mentalScore(st), 10)
  st = nextCalc(s, st)
  for (let i = 0; i < 3; i++) st = submitAnswer(s, st, answerOf(s, st) + 1)
  st = submitAnswer(s, st, answerOf(s, st))
  assert.equal(mentalScore(st), 20)
  assert.equal(errorCount(st), 3)
})

test('indice après 2 erreurs, « Voir la réponse » après 3', () => {
  const s = series()
  let st = createMentalState(s)
  const wrong = () => { st = submitAnswer(s, st, answerOf(s, st) + 1) }
  wrong()
  assert.equal(showHint(currentEntry(st)), false)
  wrong()
  assert.equal(showHint(currentEntry(st)), true)
  assert.equal(canReveal(currentEntry(st)), false)
  assert.equal(revealAnswer(s, st), st)
  wrong()
  assert.equal(canReveal(currentEntry(st)), true)
})

test('réponse vue : 0 point, saisie ensuite sans effet, reprise en fin de série sans points', () => {
  const s = series()
  let st = createMentalState(s)
  for (let i = 0; i < 3; i++) st = submitAnswer(s, st, answerOf(s, st) + 1)
  st = revealAnswer(s, st)
  assert.ok(isResolved(currentEntry(st)))
  assert.equal(revealedCount(st), 1)
  assert.equal(submitAnswer(s, st, answerOf(s, st)), st)
  const revealedId = currentCalc(s, st).id
  for (let i = 1; i < s.calcs.length; i++) {
    st = nextCalc(s, st)
    st = submitAnswer(s, st, answerOf(s, st))
  }
  assert.equal(mentalScore(st), 90)
  st = nextCalc(s, st)
  assert.equal(st.phase, 'retry')
  assert.equal(currentCalc(s, st).id, revealedId)
  st = submitAnswer(s, st, answerOf(s, st))
  assert.equal(mentalScore(st), 90)
  assert.equal(foundCount(st), 9)
  st = nextCalc(s, st)
  assert.equal(st.phase, 'done')
  assert.equal(currentCalc(s, st), null)
})

test('nextCalc sur un calcul non résolu : sans effet', () => {
  const s = series()
  const st = createMentalState(s)
  assert.equal(nextCalc(s, st), st)
})

const find = (className, family, pred) => familyCalcs(className, family).find(pred)

test('indices : textes exacts, avec les nombres du calcul', () => {
  const t = find('CE1', 'F', c => c.a === 5 && c.b === 8)
  assert.equal(calcHint(t, 'fr'), 'Compte de 5 en 5 : 5, 10, 15…')
  assert.equal(calcHint(t, 'en'), 'Count in 5s: 5, 10, 15…')
  const c = find('SIL', 'C', x => x.a === 6)
  assert.equal(calcHint(c, 'fr'), 'Combien faut-il ajouter à 6 pour arriver à 10 ?')
  assert.equal(calcHint(c, 'en'), 'How much do you add to 6 to make 10?')
  const m = find('CM1', 'I', x => x.a === 7 && x.b === 56)
  assert.equal(calcHint(m, 'fr'), 'Récite la table de 7 jusqu\'à trouver 56.')
  const k = find('CM2', 'H', x => x.k === 11 && x.a === 4)
  assert.equal(calcHint(k, 'fr'), '4 × 11, c\'est 4 × 10 + 4.')
})

test('indices : un texte non vide pour chaque calcul de chaque classe, dans les deux langues', () => {
  for (const className of ['SIL', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6']) {
    for (const f of classFamilies(className)) {
      for (const c of familyCalcs(className, f)) {
        assert.ok(calcHint(c, 'fr').length > 0 && calcHint(c, 'en').length > 0, `${className} ${c.id}`)
      }
    }
  }
})

// Tests du moteur C « Paires » et du jeu L3 (mot ↔ traduction) — lancer avec : npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  pairKey,
  textForms,
  displayText,
  guaranteedPairCount,
  selectPairs,
  rightOrder,
  createPairsGame,
  createPairsState,
  tryMatch,
  canHint,
  canShowAnswer,
  showAnswer,
  focusAfterWrong,
  errorCount,
  isFinished,
  pairsScore,
  foundCount,
  colorIndex,
  pairStatus,
  translationCandidate,
  translationCandidates,
  translationSubjects,
  translationPairCount,
  createTranslationGame,
  TRANSLATION_SETTINGS,
  TRANSLATION_LEVELS,
  MAX_SAME_WORD_PAIRS,
  POINTS_PER_PAIR,
  ERRORS_BEFORE_HINT,
  ERRORS_BEFORE_ANSWER,
  GAME_TYPE_TRANSLATION
} from './pairsGame.js'
import { createRandom } from './wordSearchGenerator.js'
import { shuffled } from './anagramGame.js'

const vocabulaire = JSON.parse(readFileSync(new URL('../data/vocabulaire.json', import.meta.url), 'utf8'))
const SEEDS = 20 // graines de contrôle par sujet (durée des tests, cadrage §7)

const entry = (id, fr, en, extra = {}) => ({
  id, mot_fr: fr, mot_en: en, def_fr: `déf ${id}`, def_en: `def ${id}`, niveau_fr: 'SIL-CP', sujet: 'Test', actif: true, ...extra
})

const sharesKey = (a, b) => a.keys.some(k => b.keys.includes(k))

test('Réglages : 3 / 5 / 6 paires (P3), 10 points, aides à 2 et 3 erreurs, gameType', () => {
  assert.deepEqual(TRANSLATION_LEVELS, ['SIL-CP', 'CE1-CE2', 'CM1-CM2'])
  assert.deepEqual(TRANSLATION_LEVELS.map(translationPairCount), [3, 5, 6])
  assert.equal(TRANSLATION_SETTINGS['CM1-CM2'].pairCount, 6)
  assert.equal(POINTS_PER_PAIR, 10)
  assert.equal(ERRORS_BEFORE_HINT, 2)
  assert.equal(ERRORS_BEFORE_ANSWER, 3)
  assert.equal(MAX_SAME_WORD_PAIRS, 1)
  assert.equal(GAME_TYPE_TRANSLATION, 'pairsTranslation')
  assert.throws(() => translationPairCount('CM3'), RangeError)
})

test('Textes : clé de comparaison, formes « A / B », affichage en majuscules avec accents et espaces (P8)', () => {
  assert.equal(pairKey('Mango tree'), 'MANGOTREE')
  assert.equal(pairKey('ÉCOLE'), 'ECOLE')
  assert.equal(pairKey('Œuf'), 'OEUF')
  assert.equal(pairKey('T-shirt'), 'TSHIRT')
  assert.equal(pairKey('USB 2.0 port'), 'USB20PORT')
  assert.equal(pairKey(undefined), '')
  assert.deepEqual(textForms('Axis / Number line'), ['Axis', 'Number line'])
  assert.deepEqual(textForms(' / '), [])
  assert.equal(displayText('Axis / Number line'), 'AXIS')
  assert.equal(displayText('Mango tree'), 'MANGO TREE')
  assert.equal(displayText('Brush one’s teeth'), 'BRUSH ONE’S TEETH')
  assert.equal(displayText('HÔTEL DE VILLE'), 'HÔTEL DE VILLE')
  assert.equal(displayText('crème'), 'CRÈME')
  assert.equal(displayText(''), '')
})

test('Candidat L3 : clés de toutes les formes et des définitions, mot identique dans les deux langues (P11)', () => {
  const c = translationCandidate(entry('a', 'COULOIR', 'Hallway / Corridor'))
  assert.equal(c.fr, 'COULOIR')
  assert.equal(c.en, 'HALLWAY')
  assert.ok(c.keys.includes('w:COULOIR') && c.keys.includes('w:HALLWAY') && c.keys.includes('w:CORRIDOR'))
  assert.ok(c.keys.some(k => k.startsWith('dfr:')) && c.keys.some(k => k.startsWith('den:')))
  assert.equal(c.restricted, false)
  assert.equal(translationCandidate(entry('b', 'TOTAL', 'Total')).restricted, true)
  assert.equal(translationCandidate(entry('c', 'FRACTION', 'Fraction / Part')).restricted, true)
  assert.equal(translationCandidate(entry('d', 'ÉCOLE', 'School')).restricted, false)
  assert.equal(translationCandidate(entry('e', 'X', 'Y', { actif: false })), null)
  assert.equal(translationCandidate(entry('f', 'MOT', '')), null)
  assert.equal(translationCandidate(null), null)
})

test('Vocabulaire réel : 245 entrées actives « identiques » selon la clé du moteur (244 du cadrage + CLIPART / Clip art)', () => {
  const restricted = translationCandidates(vocabulaire).filter(c => c.restricted)
  assert.equal(restricted.length, 245)
  assert.ok(restricted.some(c => c.fr === 'CLIPART'))
})

test('Tirage : collisions écartées, au plus un candidat restreint, borne garantie', () => {
  // ADD partagé par deux entrées ; trois mots identiques FR = EN
  const entries = [
    entry('1', 'ADDITIONNER', 'Add'), entry('2', 'AJOUTER', 'Add / Put in'),
    entry('3', 'TOTAL', 'Total'), entry('4', 'FRACTION', 'Fraction'), entry('5', 'SOMME', 'Sum'),
    entry('6', 'CHIFFRE', 'Digit'), entry('7', 'NOMBRE', 'Number')
  ]
  const candidates = translationCandidates(entries)
  // composantes : {1,2}, {3}r, {4}r, {5}, {6}, {7} -> 4 ouvertes + 1 restreinte
  assert.equal(guaranteedPairCount(candidates, { maxRestricted: 1 }), 5)
  assert.equal(guaranteedPairCount(candidates), 6)
  for (let seed = 0; seed < 200; seed++) {
    const chosen = selectPairs(candidates, 5, createRandom(seed), { maxRestricted: 1 })
    assert.ok(chosen, `graine ${seed}`)
    assert.equal(chosen.length, 5)
    assert.ok(!(chosen.some(c => c.id === '1') && chosen.some(c => c.id === '2')))
    assert.ok(chosen.filter(c => c.restricted).length <= 1)
    assert.equal(selectPairs(candidates, 6, createRandom(seed), { maxRestricted: 1 }), null)
  }
})

test('Tirage : un mot ne peut pas apparaître dans les deux colonnes pour deux paires différentes', () => {
  // FR « COIN » (coin de la pièce) et EN « Coin » (pièce de monnaie)
  const a = translationCandidate(entry('a', 'COIN', 'Corner'))
  const b = translationCandidate(entry('b', 'PIÈCE', 'Coin'))
  assert.ok(sharesKey(a, b))
})

test('Tirage : deux définitions identiques ne vont pas dans la même partie (cadrage §5, règle 2)', () => {
  const a = translationCandidate(entry('a', 'PARALLÉLÉPIPÈDE', 'Cuboid', { def_fr: 'Solide à six faces.' }))
  const b = translationCandidate(entry('b', 'PAVÉ', 'Box', { def_fr: 'Solide à six faces.' }))
  assert.ok(sharesKey(a, b))
})

test("Tirage : repli « non restreints d'abord » quand le premier choix glouton ne suffit pas", () => {
  // TOTAL (restreint) partage TOTAL avec SOMME ; ANGLE seul restreint de sa
  // composante. Ordre TOTAL, ANGLE, SOMME, CARRÉ : le choix glouton prend TOTAL
  // (limite atteinte), écarte ANGLE et SOMME -> 2 paires ; le repli en obtient 3.
  const candidates = translationCandidates([
    entry('1', 'TOTAL', 'Total'), entry('2', 'SOMME', 'Sum / Total'),
    entry('3', 'ANGLE', 'Angle'), entry('4', 'CARRÉ', 'Square')
  ])
  assert.equal(guaranteedPairCount(candidates, { maxRestricted: 1 }), 3)
  let fallbackSeen = false
  for (let seed = 0; seed < 200; seed++) {
    const chosen = selectPairs(candidates, 3, createRandom(seed), { maxRestricted: 1 })
    assert.equal(chosen.length, 3, `graine ${seed}`)
    assert.deepEqual(chosen.map(c => c.id).sort(), ['2', '3', '4'])
    // Même mélange que selectPairs : TOTAL avant ANGLE et SOMME -> le repli a servi
    const ids = shuffled(candidates.map(c => c.id).sort(), createRandom(seed))
    if (ids.indexOf('1') < ids.indexOf('2') && ids.indexOf('1') < ids.indexOf('3')) fallbackSeen = true
  }
  assert.ok(fallbackSeen, "aucune graine ne met le repli à l'épreuve")
})

test('Ordre de droite : permutation des ids, jamais identique à celui de gauche', () => {
  for (let seed = 0; seed < 300; seed++) {
    for (const ids of [['a', 'b'], ['a', 'b', 'c'], ['a', 'b', 'c', 'd', 'e', 'f']]) {
      const order = rightOrder(ids, createRandom(seed))
      assert.deepEqual([...order].sort(), [...ids].sort())
      assert.notDeepEqual(order, ids)
    }
  }
  assert.deepEqual(rightOrder(['a'], createRandom(1)), ['a'])
})

test('createPairsGame : graine et nombre de paires contrôlés', () => {
  const candidates = translationCandidates([entry('1', 'A', 'B'), entry('2', 'C', 'D')])
  assert.throws(() => createPairsGame(candidates, 2, -1), RangeError)
  assert.throws(() => createPairsGame(candidates, 0, 1), RangeError)
  assert.equal(createPairsGame(candidates, 3, 1), null)
  assert.equal(createPairsGame(candidates, 2, 1).pairs.length, 2)
})

test('Partie L3 reproductible : même graine, même partie ; mêmes paires en français et en anglais, colonnes inversées (P5)', () => {
  const entries = vocabulaire.filter(v => v.niveau_fr === 'CE1-CE2' && v.sujet === 'Commerce' && v.actif !== false)
  const fr1 = createTranslationGame(entries, 'CE1-CE2', 4242, 'fr')
  const fr2 = createTranslationGame([...entries].reverse(), 'CE1-CE2', 4242, 'fr')
  assert.deepEqual(fr1, fr2)
  const en = createTranslationGame(entries, 'CE1-CE2', 4242, 'en')
  assert.equal(fr1.language, 'fr')
  assert.equal(en.language, 'en')
  assert.deepEqual(en.leftOrder, fr1.leftOrder)
  assert.deepEqual(en.rightOrder, fr1.rightOrder)
  for (const [i, p] of fr1.pairs.entries()) {
    assert.deepEqual(en.pairs[i].left, p.right)
    assert.deepEqual(en.pairs[i].right, p.left)
    // Indice : définition dans la langue de l'élément
    const source = entries.find(e => e.id === p.id)
    assert.equal(p.left.definition, source.def_fr)
    assert.equal(p.right.definition, source.def_en)
    assert.equal(p.left.lang, 'fr')
  }
  assert.notDeepEqual(createTranslationGame(entries, 'CE1-CE2', 4243, 'fr'), fr1)
})

test('Vocabulaire réel : chaque sujet jouable donne une partie complète et sûre pour toutes les graines de contrôle', () => {
  for (const level of TRANSLATION_LEVELS) {
    const levelEntries = vocabulaire.filter(v => v.niveau_fr === level)
    const count = translationPairCount(level)
    const subjects = translationSubjects(levelEntries, level)
    assert.ok(subjects.length > 0)
    for (const { subject, playable, usable } of subjects) {
      const entries = levelEntries.filter(v => v.sujet === subject && v.actif !== false)
      assert.equal(playable, usable >= count)
      if (!playable) continue
      const byId = new Map(translationCandidates(entries).map(c => [c.id, c]))
      for (let seed = 0; seed < SEEDS; seed++) {
        const game = createTranslationGame(entries, level, seed, 'fr')
        assert.ok(game, `${level} / ${subject} / graine ${seed}`)
        assert.equal(game.pairs.length, count)
        const chosen = game.pairs.map(p => byId.get(p.id))
        for (let i = 0; i < chosen.length; i++) {
          for (let j = i + 1; j < chosen.length; j++) {
            assert.ok(!sharesKey(chosen[i], chosen[j]), `${level} / ${subject} / ${seed} : ${chosen[i].fr} et ${chosen[j].fr}`)
          }
        }
        assert.ok(chosen.filter(c => c.restricted).length <= MAX_SAME_WORD_PAIRS)
        // Textes affichés tous différents
        const texts = game.pairs.flatMap(p => [pairKey(p.left.text), pairKey(p.right.text)])
        const restrictedTexts = game.pairs.filter(p => p.restricted).length
        assert.equal(new Set(texts).size, texts.length - restrictedTexts)
        assert.notDeepEqual(game.rightOrder, game.leftOrder)
      }
    }
  }
})

test('Vocabulaire réel : collisions connues jamais ensemble (SOUSTRAIRE / RETRANCHER / ÔTER, TAXE / IMPÔT)', () => {
  const cases = [
    ['CM1-CM2', 'Soustraction', ['SOUSTRAIRE', 'RETRANCHER', 'ÔTER']],
    ['CM1-CM2', 'Finance', ['TAXE', 'IMPÔT']]
  ]
  for (const [level, subject, words] of cases) {
    const entries = vocabulaire.filter(v => v.niveau_fr === level && v.sujet === subject && v.actif !== false)
    assert.ok(words.every(w => entries.some(e => e.mot_fr === w)), `${subject} : mots absents`)
    for (let seed = 0; seed < 200; seed++) {
      const game = createTranslationGame(entries, level, seed, 'fr')
      if (!game) continue
      const shown = game.pairs.map(p => p.left.text)
      assert.ok(words.filter(w => shown.includes(w)).length <= 1, `${subject} / graine ${seed} : ${shown}`)
    }
  }
})

test('Grisage : sujet trop petit ou réduit par les collisions (modèle crosswordSubjects)', () => {
  const entries = [
    entry('1', 'CHAT', 'Cat', { sujet: 'Petit' }), entry('2', 'CHIEN', 'Dog', { sujet: 'Petit' }),
    entry('3', 'ADDITIONNER', 'Add', { sujet: 'Doublon' }), entry('4', 'AJOUTER', 'Add', { sujet: 'Doublon' }),
    entry('5', 'SOMME', 'Sum', { sujet: 'Doublon' }),
    entry('6', 'POMME', 'Apple', { sujet: 'Fruits' }), entry('7', 'POIRE', 'Pear', { sujet: 'Fruits' }),
    entry('8', 'BANANE', 'Banana', { sujet: 'Fruits' }), entry('9', 'MANGUE', 'Mango', { sujet: 'Fruits', actif: false })
  ]
  assert.deepEqual(translationSubjects(entries, 'SIL-CP'), [
    { subject: 'Doublon', usable: 2, playable: false },
    { subject: 'Fruits', usable: 3, playable: true },
    { subject: 'Petit', usable: 2, playable: false }
  ])
  assert.ok(translationSubjects(entries, 'CE1-CE2').every(s => !s.playable))
  // Un sujet grisé ne donne jamais de partie avec cette graine-là : null plutôt qu'une partie incomplète
  assert.equal(createTranslationGame(entries.filter(e => e.sujet === 'Doublon'), 'SIL-CP', 1), null)
})

test('État : paire trouvée, erreurs par élément, indice à 2 erreurs, réponse à 3, points', () => {
  const game = { pairs: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }
  let state = createPairsState()
  assert.equal(pairsScore(state), 0)

  // Mauvaise paire : une erreur sur chacun des deux éléments, aucune paire résolue
  let r = tryMatch(state, 'a', 'b')
  assert.equal(r.correct, false)
  state = r.state
  assert.equal(errorCount(state, 'left', 'a'), 1)
  assert.equal(errorCount(state, 'right', 'b'), 1)
  assert.equal(errorCount(state, 'left', 'b'), 0)
  assert.equal(state.resolved.length, 0)
  assert.equal(canHint(state, 'left', 'a'), false)

  state = tryMatch(state, 'a', 'c').state
  assert.equal(canHint(state, 'left', 'a'), true)
  assert.equal(canShowAnswer(state, 'left', 'a'), false)
  assert.equal(showAnswer(state, 'a'), state) // trop tôt : rien ne change
  assert.deepEqual(focusAfterWrong(state, 'a', 'c'), { side: 'left', id: 'a' })

  state = tryMatch(state, 'a', 'b').state
  assert.equal(errorCount(state, 'right', 'b'), 2)
  assert.deepEqual(focusAfterWrong(state, 'c', 'b'), { side: 'right', id: 'b' })
  assert.equal(canShowAnswer(state, 'left', 'a'), true)

  // Bonne paire : 10 points
  r = tryMatch(state, 'b', 'b')
  assert.equal(r.correct, true)
  state = r.state
  assert.equal(pairStatus(state, 'b'), 'found')
  assert.equal(pairsScore(state), 10)
  assert.equal(colorIndex(state, 'b'), 0)
  assert.equal(canHint(state, 'right', 'b'), false) // résolue : plus d'aide
  // Élément déjà résolu : essai ignoré
  assert.equal(tryMatch(state, 'b', 'a').ignored, true)

  // Réponse montrée : 0 point
  state = showAnswer(state, 'a')
  assert.equal(pairStatus(state, 'a'), 'shown')
  assert.equal(pairsScore(state), 10)
  assert.equal(foundCount(state), 1)
  assert.equal(colorIndex(state, 'a'), 1)
  assert.equal(isFinished(game, state), false)

  state = tryMatch(state, 'c', 'c').state
  assert.equal(isFinished(game, state), true)
  assert.equal(pairsScore(state), 20)
})

test('État : « Voir la réponse » aussi depuis un élément de droite à 3 erreurs', () => {
  let state = createPairsState()
  for (const left of ['a', 'b', 'c']) state = tryMatch(state, left, 'd').state
  assert.equal(canShowAnswer(state, 'right', 'd'), true)
  assert.equal(pairStatus(showAnswer(state, 'd'), 'd'), 'shown')
})

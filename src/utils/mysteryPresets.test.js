// Tests des parcours préconçus des anagrammes mystères (lot 3, partie 1 :
// jeu 2 « Casse-tête des syllabes », jeu 3 « Phrase secrète » ;
// docs/anagrammes-mysteres.md §13) : données, validation (un cas qui doit
// échouer pour chaque règle propre), moteur — lancer avec : npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PARCOURS_MYSTERES, PRESET_STATUSES } from '../data/parcours-mysteres.js'
import { buildPresetPath, generatePresetPath, availablePresets, validateAllPresets, presetsFor } from './mysteryPresets.js'
import { generateMysteryPath } from './mysteryGenerators.js'
import { validatePath } from './mysteryValidation.js'
import { createRandom, normalizeWord } from './wordSearchGenerator.js'
import { ANAGRAM_SETTINGS, letterKey } from './anagramGame.js'
import {
  createMysteryState,
  startSteps,
  recordStepFound,
  recordStepShown,
  recordStepWrong,
  advance,
  collectedElements,
  recordFinalHint,
  recordFinalWrong,
  recordFinalFound,
  recordFinalShown,
  finalHintLimit,
  hintsUsed,
  starsFor,
  computeScore,
  isValidState,
  checkLabelAnswer,
  solutionLabels,
  correctLabelPositions,
  presetElement,
  presetLengths,
  sentenceLabel,
  wonSyllableIndex,
  POINTS_PER_STEP,
  POINTS_FINAL
} from './mysteryEngine.js'

const vocabulary = JSON.parse(readFileSync(new URL('../data/vocabulaire.json', import.meta.url), 'utf8'))
const clone = (v) => JSON.parse(JSON.stringify(v))
const LEVELS = ['SIL-CP', 'CE1-CE2', 'CM1-CM2']
const LANGUAGES = ['fr', 'en']
const raw = (id) => PARCOURS_MYSTERES.find(p => p.id === id)
const build = (id, seed = 0) => buildPresetPath(raw(id), seed, createRandom(seed), { vocabulary })
const rules = (path, context = { vocabulary }) => validatePath(path, context).map(e => e.rule)
const fails = (path, rule, context) =>
  assert.ok(rules(path, context).includes(rule), `règle ${rule} attendue : ${JSON.stringify(validatePath(path, context ?? { vocabulary }))}`)

// Partie jouée sans aide : chaque étape trouvée avec le mot de l'étape
function playSteps(path) {
  let s = startSteps(createMysteryState(path))
  for (const step of path.steps) {
    s = recordStepFound(s, step.answers.find(a => a.word === step.word))
    s = advance(s)
  }
  return s
}

test('P1 — données : 44 parcours (20 du jeu 2, 24 du jeu 3) au format du §5, répartis comme dans le contenu validé', () => {
  assert.equal(PARCOURS_MYSTERES.length, 44)
  assert.equal(new Set(PARCOURS_MYSTERES.map(p => p.id)).size, 44, 'identifiants uniques')
  const count = (game, language, level) => presetsFor(game, level, language).length
  // Synthèse du §1 du contenu : jeu 2 anglais réduit (2, 3, 3), décision I1
  assert.deepEqual(LEVELS.map(l => count('syllables', 'fr', l)), [4, 4, 4])
  assert.deepEqual(LEVELS.map(l => count('syllables', 'en', l)), [2, 3, 3])
  assert.deepEqual(LEVELS.map(l => count('secretSentence', 'fr', l)), [4, 4, 4])
  assert.deepEqual(LEVELS.map(l => count('secretSentence', 'en', l)), [4, 4, 4])
  for (const p of PARCOURS_MYSTERES) {
    assert.ok(/^(syllabes|phrase-secrete)-(fr|en)-(sil-cp|ce1-ce2|cm1-cm2)-0\d$/.test(p.id), p.id)
    assert.equal(p.status, 'draft', p.id)
    assert.ok(PRESET_STATUSES.includes(p.status))
    assert.ok(LANGUAGES.includes(p.language) && LEVELS.includes(p.level), p.id)
    assert.ok(p.steps.length >= 2, p.id)
    for (const s of p.steps) {
      assert.equal(s.word, normalizeWord(s.display), `${p.id} ${s.display}`)
      assert.ok(typeof s.definition === 'string' && s.definition.trim() !== '', `${p.id} ${s.word}`)
      assert.ok(s.answers.length >= 1 && s.answers[0].word === s.word, `${p.id} ${s.word}`)
      assert.ok(typeof s.secret === 'string' && s.secret !== '')
      if (p.game === 'syllables') {
        assert.equal(normalizeWord(s.syllables.join('')), s.word, `${p.id} ${s.word}`)
        assert.equal(s.syllables[s.syllableRank - 1], s.secret, `${p.id} ${s.word} : rang de la syllabe donnée`)
      }
    }
    assert.equal(p.final.hints.length, 2, `${p.id} : 2 indices (I9)`)
    assert.ok(p.final.acceptedAnswers.length >= 1)
  }
})

test('P2 — validatePath (avec le vocabulaire) : les 44 parcours sont valides, pour plusieurs numéros ; seule anagramme du vocabulaire : LECTEUR', () => {
  for (const seed of [0, 1, 2, 777, 12345]) {
    const report = validateAllPresets(vocabulary, { seed })
    assert.deepEqual(report.filter(r => r.errors.length > 0), [], `numéro ${seed}`)
  }
  // Anagrammes du vocabulaire acceptées (D9) : le contenu n'en annonçait qu'une
  const extra = []
  for (const r of PARCOURS_MYSTERES) {
    for (const s of build(r.id).steps) for (const a of s.answers) if (a.word !== s.word) extra.push(`${s.word}/${a.word}`)
  }
  assert.deepEqual(extra, ['LECTURE/LECTEUR'])
  // Le parcours enregistré (JSON) reste valide sans le vocabulaire (reprise)
  for (const r of PARCOURS_MYSTERES) assert.deepEqual(validatePath(clone(build(r.id, 5))), [], r.id)
})

test('P3 — choix du parcours par le numéro : reproductible, toujours valide, chaque parcours du niveau atteint ; jeu indisponible sans parcours valide', () => {
  for (const game of ['syllables', 'secretSentence']) {
    for (const level of LEVELS) {
      for (const language of LANGUAGES) {
        const seen = new Set()
        for (let seed = 0; seed < 60; seed++) {
          const p = generateMysteryPath(game, vocabulary, level, seed, language)
          assert.ok(p, `${game} ${level} ${language} ${seed}`)
          assert.deepEqual(validatePath(p, { vocabulary }), [])
          assert.deepEqual(p, generatePresetPath(game, vocabulary, level, seed, language), 'même numéro, même parcours')
          assert.equal(p.seed, seed)
          seen.add(p.id)
        }
        assert.equal(seen.size, presetsFor(game, level, language).length, `${game} ${level} ${language} : tous les parcours atteints`)
        assert.equal(availablePresets(game, vocabulary, level, language).length, seen.size)
      }
    }
  }
  // Sans parcours valide (contenu vide, ou parcours cassé) : null, le jeu est indisponible
  assert.equal(generatePresetPath('syllables', vocabulary, 'SIL-CP', 1, 'fr', { presets: [] }), null)
  const broken = clone(raw('syllabes-fr-sil-cp-01'))
  broken.final.syllables = ['LA', 'PAIN']
  assert.equal(generatePresetPath('syllables', vocabulary, 'SIL-CP', 1, 'fr', { presets: [broken] }), null)
  assert.deepEqual(availablePresets('syllables', vocabulary, 'SIL-CP', 'fr', { presets: [broken] }), [])
  assert.throws(() => generatePresetPath('syllables', vocabulary, 'CM3', 1, 'fr'), RangeError)
  assert.throws(() => generatePresetPath('syllables', vocabulary, 'SIL-CP', -1, 'fr'), RangeError)
})

test('P4 — étapes en ordre mélangé (I8) qui ne redonne jamais la solution ; première lettre placée en SIL-CP ; longueurs (I3)', () => {
  const orders = new Set()
  for (let seed = 0; seed < 40; seed++) {
    const p = build('syllabes-fr-ce1-ce2-04', seed)
    orders.add(p.steps.map(s => s.word).join(' '))
    assert.notEqual(normalizeWord(p.steps.map(s => s.secret).join('')), p.final.solution)
  }
  assert.ok(orders.size > 5, 'l\'ordre des étapes varie avec le numéro')
  // Parcours de 2 étapes : seul l'ordre inverse est possible
  assert.deepEqual(build('syllabes-fr-sil-cp-01').steps.map(s => s.secret), ['PIN', 'LA'])
  for (const r of PARCOURS_MYSTERES) {
    const p = build(r.id, 3)
    const lengths = presetLengths(r.game, r.level)
    for (const s of p.steps) {
      assert.equal(s.firstLetter, ANAGRAM_SETTINGS[r.level].firstLetterGiven ? s.word[0] : null)
      assert.ok(s.word.length >= lengths.minLength && s.word.length <= lengths.maxLength, `${r.id} ${s.word}`)
    }
  }
  assert.deepEqual(presetLengths('secretSentence', 'CM1-CM2'), { minLength: 4, maxLength: 10 })
  assert.deepEqual(presetLengths('syllables', 'CM1-CM2'), { minLength: 6, maxLength: 10 })
  assert.deepEqual(presetLengths('secretSentence', 'CE1-CE2'), { minLength: 4, maxLength: 7 })
})

test('P5 — décisions I10 (pas de lien avec un autre sens), I13 (sujet inversé refusé en CE1-CE2, accepté en CM1-CM2), I4 et I5 (mots donnés, étiquettes)', () => {
  const step = (id, word) => build(id).steps.find(s => s.word === word)
  for (const [id, word] of [['phrase-secrete-fr-cm1-cm2-01', 'TABLE'], ['syllabes-fr-ce1-ce2-01', 'COTE'], ['phrase-secrete-fr-ce1-ce2-02', 'GROS'], ['phrase-secrete-en-cm1-cm2-02', 'PLAY']]) {
    const s = step(id, word)
    assert.equal(s.wordId, null, word)
    assert.ok(s.answers.every(a => a.id === null), `${word} : jamais relié à l'entrée d'un autre sens`)
    assert.ok(s.id.startsWith(id), 'id propre au parcours')
  }
  assert.equal(step('syllabes-fr-sil-cp-01', 'PINCE').wordId, 'vocab_0932')
  // I13
  const ce = build('phrase-secrete-fr-ce1-ce2-03')
  assert.equal(checkLabelAnswer(ce, ['DANS', 'LA', 'COUR', 'JOUENT', 'LES', 'ENFANTS']), null)
  assert.equal(checkLabelAnswer(ce, ['DANS', 'LA', 'COUR', 'LES', 'ENFANTS', 'JOUENT']).display, 'Dans la cour, les enfants jouent.')
  const cm = build('phrase-secrete-fr-cm1-cm2-02')
  assert.equal(checkLabelAnswer(cm, ['PENDANT', 'LA', 'SAISON', 'DES', 'PLUIES', 'DÉBORDENT', 'LES', 'RIVIÈRES']).display,
    'Pendant la saison des pluies débordent les rivières.')
  // I4 : mots donnés d'office parmi les étiquettes ; I5 : capitales hors SIL-CP
  assert.deepEqual(ce.final.given, ['LES', 'DANS', 'LA'])
  assert.ok(ce.final.labels.every(l => l === l.toUpperCase()))
  const sil = build('phrase-secrete-fr-sil-cp-02')
  assert.deepEqual([...sil.final.labels].sort(), ['Maman', 'lave', 'le', 'pagne'])
  assert.equal(sentenceLabel('SIL-CP', 'Maman'), 'Maman')
  assert.equal(sentenceLabel('CE1-CE2', 'mûre'), 'MÛRE')
  assert.deepEqual(build('phrase-secrete-en-sil-cp-02').final.given, [], 'aucun mot donné')
})

test('P6 — validation, jeu 2 : syllabe hors du mot (J2), syllabes qui ne forment pas le mot (J2), autre syllabe pour une anagramme (6.1.2), étiquettes dans l\'ordre (6.1.1)', () => {
  const p = build('syllabes-fr-cm1-cm2-02')
  assert.deepEqual(validatePath(p, { vocabulary }), [])
  const position = clone(p)
  position.steps[0].secretIndex += 1
  fails(position, 'J2', {})
  const syllabation = clone(p)
  syllabation.steps[0].syllables = ['XX', ...syllabation.steps[0].syllables.slice(1)]
  fails(syllabation, 'J2', {})
  const concat = clone(p)
  concat.final.syllables = ['É', 'LEC', 'TRI', 'CI', 'TÉ', 'S']
  fails(concat, 'J2', {})
  const slots = clone(p)
  ;[slots.steps[0].slot, slots.steps[1].slot] = [slots.steps[1].slot, slots.steps[0].slot]
  fails(slots, 'J2', {})
  // Une anagramme qui donnerait une autre syllabe (CTELURE n'existe pas, cas de test)
  const other = clone(p)
  const lecture = other.steps.find(s => s.word === 'LECTURE')
  lecture.answers.push({ id: null, word: 'CTELURE', display: 'CTELURE' })
  fails(other, '6.1.2', {})
  // Étiquettes qui redonnent le mot mystère dans l'ordre
  const ordered = clone(p)
  ordered.steps.sort((a, b) => a.slot - b.slot)
  ordered.final.labels = ordered.steps.map(s => s.secret)
  fails(ordered, '6.1.1', {})
  // Mot mystère dans une définition ; plus d'une réponse finale
  const reveal = clone(p)
  reveal.steps[0].definition = 'Il faut de l\'électricité.'
  fails(reveal, '6.1.6', {})
  const accepted = clone(p)
  accepted.final.acceptedAnswers.push({ id: null, word: 'ELECTRICITES', display: 'ÉLECTRICITÉS' })
  fails(accepted, '6.1.5', {})
})

test('P7 — validation, jeu 3 : mots trouvés + mots donnés ≠ phrase (J3), phrase acceptée avec d\'autres mots (J3), étiquettes en minuscules hors SIL-CP (J3), définition qui donne un autre mot (6.1.6), anagramme (6.1.2)', () => {
  const p = build('phrase-secrete-fr-cm1-cm2-01')
  assert.deepEqual(validatePath(p, { vocabulary }), [])
  const given = clone(p)
  given.final.given = given.final.given.slice(1)
  fails(given, 'J3', {})
  const variant = clone(p)
  variant.final.acceptedAnswers.push({ id: null, word: 'LE MENUISIER FABRIQUE UNE TABLE EN BOIS', display: 'Le menuisier fabrique une table en bois.' })
  fails(variant, 'J3', {})
  const slot = clone(p)
  slot.steps[0].slot = (slot.steps[0].slot + 1) % 9
  fails(slot, 'J3', {})
  const lower = clone(p)
  lower.final.labels = lower.final.labels.map(l => l.toLowerCase())
  lower.final.given = lower.final.given.map(l => l.toLowerCase())
  lower.steps.forEach(s => { s.secret = s.secret.toLowerCase() })
  fails(lower, 'J3', {})
  const reveal = clone(p)
  reveal.steps.find(s => s.word === 'MENUISIER').definition = 'Artisan qui fabrique des meubles.'
  fails(reveal, '6.1.6', {})
  const anagram = clone(p)
  anagram.steps.find(s => s.word === 'BOIS').answers.push({ id: null, word: 'SOIB', display: 'SOIB' })
  fails(anagram, '6.1.2', {})
  // Étiquettes dans l'ordre d'une phrase acceptée
  const ordered = clone(p)
  ordered.final.labels = solutionLabels(p)
  fails(ordered, '6.1.1', {})
})

test('P8 — validation commune aux parcours préconçus : longueur (6.3.1), id du vocabulaire (6.3.1), anagramme du vocabulaire non acceptée (D9), mêmes lettres (6.1.3), mots interdits (6.1.7), statut', () => {
  const p = build('syllabes-fr-ce1-ce2-03')
  // CÔTÉ (4 lettres) joué au jeu 2 en CM1-CM2, où le minimum est 6 ; au jeu 3
  // en CM1-CM2, 4 lettres sont admises (I3) : JOUR, BOIS
  fails({ ...clone(build('syllabes-fr-ce1-ce2-01')), level: 'CM1-CM2' }, '6.3.1', {})
  assert.ok(build('phrase-secrete-fr-cm1-cm2-01').steps.some(s => s.word.length === 4))
  // TRIMESTRE (9 lettres) joué en CE1-CE2, où le maximum est 7
  const short = clone(build('syllabes-fr-cm1-cm2-01'))
  short.level = 'CE1-CE2'
  fails(short, '6.3.1', {})
  const id = clone(p)
  id.steps[0].wordId = 'vocab_0001'
  fails(id, '6.3.1')
  const d9 = clone(build('syllabes-fr-cm1-cm2-02'))
  d9.steps.forEach(s => { s.answers = s.answers.filter(a => a.word !== 'LECTEUR') })
  assert.deepEqual(validatePath(d9), [], 'sans vocabulaire, D9 n\'est pas contrôlée')
  fails(d9, 'D9')
  const same = clone(p)
  same.final.solution = [...same.steps[0].word].sort().join('')
  fails(same, '6.1.3', {})
  fails(p, '6.1.7', { blockedWords: ['MEDECIN'] })
  fails(build('phrase-secrete-fr-sil-cp-01'), '6.1.7', { blockedWords: ['CHAT'] })
  fails({ ...clone(p), status: 'generated' }, 'forme', {})
  fails({ ...clone(p), extraction: { rule: 'last' } }, 'forme', {})
  fails({ ...clone(p), final: { ...clone(p).final, kind: 'word' } }, 'forme', {})
  const def = clone(p)
  def.steps[0].definition = ''
  fails(def, '6.3.1', {})
})

test('P9 — moteur, jeu 2 : syllabes gagnées, signalées dans le mot (I11), LECTEUR donne LEC, finale par étiquettes, bien placées, solution', () => {
  const p = build('syllabes-fr-cm1-cm2-02', 4)
  const lecture = p.steps.find(s => s.word === 'LECTURE')
  assert.equal(presetElement({ word: 'LECTEUR' }, lecture, 'syllables'), 'LEC')
  assert.equal(wonSyllableIndex(lecture), 0)
  const liberte = p.steps.find(s => s.word === 'LIBERTE')
  assert.equal(liberte.secret, 'TÉ')
  assert.equal(wonSyllableIndex(liberte), 2)
  const tete = build('syllabes-fr-sil-cp-02').steps.find(s => s.word === 'TETE')
  assert.deepEqual([tete.secret, tete.secretIndex, wonSyllableIndex(tete)], ['TE', 2, 1])
  const s = playSteps(p)
  assert.equal(s.phase, 'final')
  assert.deepEqual(collectedElements(p, s), p.final.labels)
  assert.deepEqual(solutionLabels(p), ['É', 'LEC', 'TRI', 'CI', 'TÉ'])
  assert.equal(checkLabelAnswer(p, solutionLabels(p)).display, 'ÉLECTRICITÉ')
  assert.equal(checkLabelAnswer(p, p.final.labels), null)
  assert.equal(correctLabelPositions(p, ['É', 'LEC', 'CI', 'TRI', 'TÉ']), 3)
  // Anglais : le jour s'affiche avec sa majuscule à la fin (I6)
  const sunday = build('syllabes-en-sil-cp-01')
  assert.equal(checkLabelAnswer(sunday, ['SUN', 'DAY']).display, 'Sunday')
  assert.equal(checkLabelAnswer(sunday, ['DAY', 'SUN']), null)
})

test('P10 — moteur, jeu 3 : mots gagnés, variantes acceptées (I7), phrases refusées, bien placés comparés à la phrase la plus proche', () => {
  const p = build('phrase-secrete-fr-cm1-cm2-01')
  const tokens = (text) => text.replace(/[,.]/g, '').toUpperCase().split(' ')
  for (const a of p.final.acceptedAnswers) {
    const found = checkLabelAnswer(p, tokens(a.display))
    assert.equal(found?.display, a.display, a.display)
  }
  assert.equal(p.final.acceptedAnswers.length, 4)
  // Phrase correcte mais absurde, refusée par le contenu
  assert.equal(checkLabelAnswer(p, tokens('Le menuisier en bois fabrique une table chaque jour.')), null)
  assert.equal(checkLabelAnswer(build('phrase-secrete-fr-sil-cp-02'), ['le', 'pagne', 'lave', 'Maman']), null)
  assert.equal(checkLabelAnswer(build('phrase-secrete-en-cm1-cm2-02'), tokens('The musicians play during the festival the balafon.')), null)
  // Majuscules et ponctuation sans effet sur la comparaison
  assert.ok(checkLabelAnswer(p, tokens('chaque jour le menuisier fabrique une table en bois').map(w => w.toLowerCase())))
  // Bien placés : la variante 2 est plus proche de cet ordre
  assert.equal(correctLabelPositions(p, tokens('Le menuisier fabrique une table en bois jour chaque')), 7)
  // Solution montrée : les étiquettes dans l'ordre de la phrase de référence
  assert.equal(checkLabelAnswer(p, solutionLabels(p)).display, p.final.display)
  const s = playSteps(p)
  assert.deepEqual([...collectedElements(p, s)].sort(), ['BOIS', 'FABRIQUE', 'JOUR', 'MENUISIER', 'TABLE'])
})

test('P11 — indices (I9), étoiles et points : 3 sans aide ; 2 avec un indice ou au 2e essai faux de la finale ; 1 si une solution est montrée ; 10 par anagramme + 10', () => {
  const p = build('phrase-secrete-fr-ce1-ce2-01')
  assert.deepEqual(p.final.hints, ['La phrase commence par Le.', 'Le verbe est mange.'])
  assert.deepEqual(build('syllabes-fr-ce1-ce2-01').final.hints, ['Appareil qui permet de parler avec quelqu\'un qui est loin.', 'Le mot commence par TÉ.'])
  assert.equal(finalHintLimit(p), 2)
  const base = playSteps(p)
  const answer = p.final.acceptedAnswers[0]
  const perfect = recordFinalFound(base, answer)
  assert.equal(starsFor(perfect, p), 3)
  assert.equal(computeScore(perfect), p.steps.length * POINTS_PER_STEP + POINTS_FINAL)
  // Deux indices au plus
  let h = recordFinalHint(base, p)
  h = recordFinalHint(h, p)
  assert.equal(recordFinalHint(h, p), h)
  assert.equal(hintsUsed(recordFinalFound(h, answer), p), 2)
  assert.equal(starsFor(recordFinalFound(recordFinalHint(base, p), answer), p), 2)
  // 1er essai faux : toujours 3 étoiles ; 2e : 2 étoiles
  const once = recordFinalWrong(base, p)
  assert.equal(starsFor(recordFinalFound(once, answer), p), 3)
  const twice = recordFinalWrong(once, p)
  assert.equal(starsFor(recordFinalFound(twice, answer), p), 2)
  // Solution montrée après 3 essais : 1 étoile, sans les 10 points du mystère
  assert.equal(recordFinalShown(twice), twice)
  const shown = recordFinalShown(recordFinalWrong(twice, p))
  assert.equal(starsFor(shown, p), 1)
  assert.equal(computeScore(shown), p.steps.length * POINTS_PER_STEP)
  // Solution d'étape montrée : l'élément est quand même gagné, 1 étoile
  let w = startSteps(createMysteryState(p))
  for (let i = 0; i < 3; i++) w = recordStepWrong(w)
  w = recordStepShown(w)
  assert.equal(collectedElements(p, w)[0], p.steps[0].secret)
})

test('P12 — reprise : état des jeux 2 et 3 contrôlé (indices bornés), parcours enregistré mal formé refusé sans erreur', () => {
  for (const id of ['syllabes-en-ce1-ce2-02', 'phrase-secrete-en-cm1-cm2-04']) {
    const p = build(id)
    let s = playSteps(p)
    s = recordFinalHint(s, p)
    assert.equal(isValidState(clone(s), clone(p)), true)
    assert.equal(isValidState({ ...s, final: { ...s.final, hints: 3 } }, p), false, 'plus d\'indices que prévu')
    assert.equal(isValidState({ ...s, final: { ...s.final, hints: -1 } }, p), false)
    // Parcours lisible mais mal formé : erreurs, jamais d'exception
    const bad = clone(p)
    bad.final.labels = null
    bad.steps[0].syllables = 'XX'
    assert.ok(validatePath(bad).length > 0)
    const worse = clone(p)
    worse.final = { kind: p.final.kind }
    assert.ok(validatePath(worse).length > 0)
  }
  // Jeu 3 sans mot donné : un champ given absent ou qui n'est pas un tableau
  // est refusé (sinon l'écran planterait à la reprise)
  const noGiven = build('phrase-secrete-en-sil-cp-02')
  for (const altered of [undefined, 'x']) {
    const bad = clone(noGiven)
    bad.final.given = altered
    assert.ok(validatePath(bad).some(e => e.rule === 'forme'), String(altered))
  }
  // Mêmes lettres que le mot mystère : jamais deux mots aux mêmes lettres
  for (const r of PARCOURS_MYSTERES.filter(x => x.game === 'syllables')) {
    const keys = r.steps.map(s => letterKey(s.word))
    assert.ok(!keys.includes(letterKey(r.final.solution)), r.id)
  }
})

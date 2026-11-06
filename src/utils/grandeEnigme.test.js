// Tests du jeu 6 « Grande énigme » des anagrammes mystères (lot 3, partie 2 ;
// docs/anagrammes-mysteres.md §14) : données, validation des 18 parcours avec
// le vocabulaire (règle J6 comprise), choix par le numéro, reconstitution,
// comparaison tolérante de la réponse tapée, cas qui doivent échouer, moteur
// (étoiles, indices, reprise) — lancer avec : npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { GRANDE_ENIGME } from '../data/grande-enigme.js'
import { PARCOURS_MYSTERES } from '../data/parcours-mysteres.js'
import { ALL_PRESETS, buildPresetPath, generatePresetPath, availablePresets, validateAllPresets, presetsFor } from './mysteryPresets.js'
import { generateMysteryPath } from './mysteryGenerators.js'
import { validatePath } from './mysteryValidation.js'
import { createRandom, normalizeWord } from './wordSearchGenerator.js'
import {
  MYSTERY_GAMES,
  PRESET_GAMES,
  createMysteryState,
  startSteps,
  recordStepFound,
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
  checkRiddleAnswer,
  riddleKey,
  riddlePieces,
  assembleRiddle,
  riddlePromptAtMission,
  filledProverb,
  presetElement,
  POINTS_PER_STEP,
  POINTS_FINAL
} from './mysteryEngine.js'

const vocabulary = JSON.parse(readFileSync(new URL('../data/vocabulaire.json', import.meta.url), 'utf8'))
const clone = (v) => JSON.parse(JSON.stringify(v))
const LEVELS = ['SIL-CP', 'CE1-CE2', 'CM1-CM2']
const LANGUAGES = ['fr', 'en']
const raw = (id) => GRANDE_ENIGME.find(p => p.id === `grande-enigme-${id}`)
const build = (id, seed = 0) => buildPresetPath(raw(id), seed, createRandom(seed), { vocabulary })
const rules = (path, context = { vocabulary }) => validatePath(path, context).map(e => e.rule)
const fails = (path, rule, context) =>
  assert.ok(rules(path, context).includes(rule), `règle ${rule} attendue : ${JSON.stringify(validatePath(path, context ?? { vocabulary }))}`)

// Synthèse du §1.1 du contenu : id, type, solution reconstituée, nombre d'étapes
const SYNTHESE = [
  ['fr-sil-cp-01', 'heritage', 'LOBE', 4], ['fr-sil-cp-02', 'heritage', 'NDOLE', 5], ['fr-sil-cp-03', 'word', 'DANSE', 5],
  ['fr-ce1-ce2-01', 'person', 'MILLA', 6], ['fr-ce1-ce2-02', 'heritage', 'DJA', 4], ['fr-ce1-ce2-03', 'word', 'BALAFON', 4],
  ['fr-cm1-cm2-01', 'person', 'MBANGO', 5], ['fr-cm1-cm2-02', 'heritage', 'TOGHU', 6], ['fr-cm1-cm2-03', 'proverb', 'PIERRE', 5],
  ['en-sil-cp-01', 'heritage', 'LOBE', 4], ['en-sil-cp-02', 'heritage', 'NDOLE', 5], ['en-sil-cp-03', 'word', 'DANCE', 5],
  ['en-ce1-ce2-01', 'person', 'MILLA', 6], ['en-ce1-ce2-02', 'heritage', 'DJA', 4], ['en-ce1-ce2-03', 'word', 'DRUM', 5],
  ['en-cm1-cm2-01', 'person', 'MBANGO', 7], ['en-cm1-cm2-02', 'heritage', 'TOGHU', 6], ['en-cm1-cm2-03', 'proverb', 'STONE', 6]
]

// Partie jouée sans aide : chaque étape trouvée avec le mot de l'étape
function playSteps(path) {
  let s = startSteps(createMysteryState(path))
  for (const step of path.steps) {
    s = recordStepFound(s, step.answers.find(a => a.word === step.word))
    s = advance(s)
  }
  return s
}

test('R1 — données : 18 parcours du jeu 6 (3 par niveau et par langue), statut draft, types et nombres d\'étapes du contenu, 2 indices, pas de syllabe en anglais', () => {
  assert.equal(GRANDE_ENIGME.length, 18)
  assert.equal(new Set(GRANDE_ENIGME.map(p => p.id)).size, 18)
  assert.equal(ALL_PRESETS.length, PARCOURS_MYSTERES.length + 18)
  assert.equal(PARCOURS_MYSTERES.length, 44, 'jeux 2 et 3 inchangés')
  for (const level of LEVELS) for (const language of LANGUAGES) assert.equal(presetsFor('grandRiddle', level, language).length, 3)
  for (const [id, type, solution, count] of SYNTHESE) {
    const r = raw(id)
    assert.ok(r, id)
    assert.equal(r.game, 'grandRiddle')
    assert.equal(r.status, 'draft', id)
    assert.equal(r.final.kind, type, id)
    assert.equal(normalizeWord(r.final.solution), solution, id)
    assert.equal(r.steps.length, count, id)
    assert.equal(r.final.hints.length, 2, `${id} : 2 indices (E5)`)
    for (const s of r.steps) {
      assert.equal(s.word, normalizeWord(s.display), `${id} ${s.display}`)
      assert.ok(['letter', 'syllable', 'clue'].includes(s.element.type))
      if (r.language === 'en') assert.notEqual(s.element.type, 'syllable', `${id} : pas de syllabe en anglais (E2)`)
    }
  }
  // en-cm1-cm2-01 : 7 étapes, 6 lettres + 1 indice (E2, option b)
  assert.deepEqual(raw('en-cm1-cm2-01').steps.map(s => s.element.type), ['letter', 'letter', 'letter', 'letter', 'letter', 'letter', 'clue'])
  // Le jeu 6 est disponible, à parcours préconçus
  assert.equal(MYSTERY_GAMES.find(g => g.id === 'grandRiddle').available, true)
  assert.ok(PRESET_GAMES.includes('grandRiddle'))
})

test('R2 — validatePath (avec le vocabulaire) : les 18 parcours sont valides pour plusieurs numéros ; aucune autre anagramme du vocabulaire ; parcours enregistré valide sans le vocabulaire', () => {
  for (const seed of [0, 1, 2, 777, 12345]) {
    const report = validateAllPresets(vocabulary, { seed, presets: GRANDE_ENIGME })
    assert.equal(report.length, 18)
    assert.deepEqual(report.filter(r => r.errors.length > 0), [], `numéro ${seed}`)
  }
  for (const r of GRANDE_ENIGME) {
    const p = buildPresetPath(r, 0, createRandom(0), { vocabulary })
    for (const s of p.steps) assert.deepEqual(s.answers.map(a => a.word), [s.word], `${r.id} ${s.word} : seule réponse`)
    assert.deepEqual(validatePath(clone(buildPresetPath(r, 9, createRandom(9), { vocabulary }))), [], r.id)
  }
})

test('R3 — choix du parcours par le numéro : reproductible, toujours valide, chaque parcours atteint ; jeux 2 et 3 choisis comme avant', () => {
  for (const level of LEVELS) {
    for (const language of LANGUAGES) {
      const seen = new Set()
      for (let seed = 0; seed < 60; seed++) {
        const p = generateMysteryPath('grandRiddle', vocabulary, level, seed, language)
        assert.ok(p, `${level} ${language} ${seed}`)
        assert.deepEqual(validatePath(p, { vocabulary }), [])
        assert.deepEqual(p, generatePresetPath('grandRiddle', vocabulary, level, seed, language), 'même numéro, même parcours')
        seen.add(p.id)
      }
      assert.equal(seen.size, 3, `${level} ${language} : tous les parcours atteints`)
      assert.equal(availablePresets('grandRiddle', vocabulary, level, language).length, 3)
    }
  }
  // Jeux 2 et 3 : l'ajout du jeu 6 au contenu ne change pas leurs parcours
  for (const game of ['syllables', 'secretSentence']) {
    for (const seed of [0, 1, 12345]) {
      assert.deepEqual(
        generatePresetPath(game, vocabulary, 'CE1-CE2', seed, 'fr'),
        generatePresetPath(game, vocabulary, 'CE1-CE2', seed, 'fr', { presets: PARCOURS_MYSTERES })
      )
    }
  }
})

test('R4 — reconstitution (J6) : lettres et syllabes, dans l\'ordre, redonnent exactement la solution ; jamais dans l\'ordre gagné ; jamais la 1re lettre en SIL-CP ; indice placé après le mot qu\'il contient', () => {
  for (const [id, , solution] of SYNTHESE) {
    for (let seed = 0; seed < 30; seed++) {
      const p = build(id, seed)
      assert.equal(assembleRiddle(p), solution, `${id} ${seed}`)
      const gained = p.steps.filter(s => s.element.type !== 'clue').map(s => normalizeWord(s.secret)).join('')
      assert.notEqual(gained, solution, `${id} ${seed} : ordre gagné ≠ solution`)
      if (p.level === 'SIL-CP') assert.ok(p.steps.every(s => s.secretIndex > 0), `${id} : jamais la 1re lettre`)
    }
  }
  assert.deepEqual(riddlePieces(build('fr-cm1-cm2-01')).map(s => s.secret), ['M', 'BAN', 'GO'])
  assert.deepEqual(riddlePieces(build('fr-cm1-cm2-03')).map(s => s.secret), ['PIER', 'R', 'E'])
  assert.deepEqual(riddlePieces(build('fr-ce1-ce2-03')).map(s => s.secret), ['BA', 'LA', 'FON'])
  // Rangs de la source : ROBE donne sa 3e lettre ; COUTURE son 1er U (3e lettre)
  assert.equal(build('fr-sil-cp-01').steps.find(s => s.word === 'ROBE').secretIndex, 2)
  assert.equal(build('fr-cm1-cm2-02').steps.find(s => s.word === 'COUTURE').secretIndex, 2)
  assert.equal(build('en-ce1-ce2-01').steps.find(s => s.word === 'WHISTLE').secretIndex, 5)
  // L'indice de PODIUM cite « médaille » : il vient toujours après MÉDAILLE
  for (let seed = 0; seed < 60; seed++) {
    const words = build('fr-cm1-cm2-01', seed).steps.map(s => s.word)
    assert.ok(words.indexOf('MEDAILLE') < words.indexOf('PODIUM'), `numéro ${seed}`)
  }
  // L'ordre des étapes varie avec le numéro (E9, comme I8)
  assert.ok(new Set(Array.from({ length: 20 }, (_, n) => build('en-cm1-cm2-01', n).steps.map(s => s.word).join(' '))).size > 5)
})

test('R5 — finale : comparaison qui ignore casse, accents, espaces, tirets et apostrophes ; variantes acceptées (E6) ; formes refusées', () => {
  const accepted = (id, typed) => checkRiddleAnswer(build(id), typed)
  assert.equal(riddleKey(' Roger  Milla '), 'ROGERMILLA')
  assert.equal(riddleKey('Chutes-de-la-Lobé'), 'CHUTESDELALOBE')
  assert.equal(riddleKey('Françoise'), 'FRANCOISE')
  for (const typed of ['Lobé', 'lobe', ' LOBE ', 'L\'obé', 'chutes de la Lobé', 'Chutes-de-la-lobe']) assert.ok(accepted('fr-sil-cp-01', typed), typed)
  assert.equal(accepted('fr-sil-cp-01', 'Lobé').display, 'LOBÉ')
  for (const typed of ['Lobé', 'lobe falls', 'Lobe-Falls']) assert.ok(accepted('en-sil-cp-01', typed), typed)
  assert.equal(accepted('en-sil-cp-01', 'lobe').display, 'Lobé', 'orthographe affichée de la source')
  for (const typed of ['ndolè', 'Ndolé', 'NDOLE']) assert.ok(accepted('fr-sil-cp-02', typed), typed)
  for (const typed of ['Milla', 'roger milla', 'Roger-Milla', 'Albert Roger Mooh Milla']) assert.ok(accepted('fr-ce1-ce2-01', typed), typed)
  assert.equal(accepted('fr-ce1-ce2-01', 'Miller'), null, 'MILLER non accepté (E6)')
  assert.equal(accepted('fr-ce1-ce2-01', 'Roger'), null)
  for (const typed of ['Mbango', 'Françoise Mbango', 'francoise mbango etone', 'Mbango Etone']) assert.ok(accepted('fr-cm1-cm2-01', typed), typed)
  for (const typed of ['FRANÇOISE MBANGO', 'Francoise Mbango Etone']) assert.ok(accepted('en-cm1-cm2-01', typed), typed)
  assert.ok(accepted('fr-cm1-cm2-02', 'Atoghu'))
  assert.equal(accepted('fr-cm1-cm2-02', 'toguh'), null, 'TOGUH non accepté (E6)')
  for (const typed of ['réserve du Dja', 'Réserve de faune du Dja', 'dja']) assert.ok(accepted('fr-ce1-ce2-02', typed), typed)
  for (const typed of ['Dja Faunal Reserve', 'dja reserve']) assert.ok(accepted('en-ce1-ce2-02', typed), typed)
  assert.equal(accepted('en-ce1-ce2-03', 'drums'), null, 'DRUMS non accepté (E6)')
  // Proverbe : le seul mot manquant ; les autres mots aux mêmes lettres sont refusés
  assert.ok(accepted('fr-cm1-cm2-03', 'pierre'))
  assert.equal(accepted('fr-cm1-cm2-03', 'prière'), null)
  assert.equal(accepted('fr-cm1-cm2-03', 'une pierre'), null)
  assert.ok(accepted('en-cm1-cm2-03', 'Stone'))
  for (const typed of ['notes', 'tones', 'onset']) assert.equal(accepted('en-cm1-cm2-03', typed), null, typed)
  assert.equal(accepted('fr-sil-cp-03', ''), null)
  assert.equal(accepted('fr-sil-cp-03', ' - '), null)
  assert.equal(filledProverb(build('fr-cm1-cm2-03'), 'fr'), 'Avec beaucoup de patience on peut cuire même une pierre.')
  assert.equal(filledProverb(build('en-cm1-cm2-03'), 'en'), 'Patience can cook a stone.')
})

test('R6 — validation, cas qui doivent échouer : lettre au mauvais rang, 1re lettre en SIL-CP, syllabe en anglais, reconstitution, ordre, indice trop tôt, réponses, indices, proverbe, mots interdits, vocabulaire', () => {
  const p = build('fr-cm1-cm2-01')
  assert.deepEqual(validatePath(p, { vocabulary }), [])
  const rank = clone(p)
  rank.steps.find(s => s.word === 'MEDAILLE').element.rank = 2
  fails(rank, 'J6', {})
  // SIL-CP : la lettre secrète sur la lettre placée
  const sil = clone(build('fr-sil-cp-01'))
  const robe = sil.steps.find(s => s.word === 'ROBE')
  Object.assign(robe, { secret: 'R', secretIndex: 0, element: { type: 'letter', value: 'R', rank: 1 } })
  fails(sil, 'J6', {})
  // Syllabe dans un parcours anglais (E2)
  fails({ ...clone(p), language: 'en' }, 'J6', {})
  // Reconstitution : deux rangs échangés ; une lettre qui manque
  const swapped = clone(p)
  const [a, b] = swapped.steps.filter(s => s.slot !== null)
  ;[a.slot, b.slot] = [b.slot, a.slot]
  fails(swapped, 'J6', {})
  const missing = clone(build('fr-ce1-ce2-02'))
  missing.final.solution = 'DJAA'
  missing.final.display = 'DJAA'
  missing.final.acceptedAnswers = [{ id: null, word: 'DJAA', display: 'DJAA' }]
  fails(missing, 'J6', {})
  // Ordre des étapes qui donne la solution dans l'ordre gagné
  const ordered = clone(build('fr-sil-cp-03'))
  ordered.steps.sort((x, y) => x.slot - y.slot)
  fails(ordered, '6.1.1', {})
  // L'indice de PODIUM (médaille) avant l'étape MÉDAILLE
  const early = clone(p)
  const podium = early.steps.findIndex(s => s.word === 'PODIUM')
  const [moved] = early.steps.splice(podium, 1)
  early.steps.unshift(moved)
  fails(early, 'J6', {})
  // Réponses acceptées : clé incohérente, solution absente, doublon
  const key = clone(p)
  key.final.acceptedAnswers[1].word = 'XXX'
  fails(key, '6.1.5', {})
  const absent = clone(p)
  absent.final.acceptedAnswers = absent.final.acceptedAnswers.slice(1)
  fails(absent, '6.1.5', {})
  // Un indice qui donne la solution ; 3 indices ; définition qui donne un autre mot d'étape
  const reveal = clone(p)
  reveal.final.hints[0] = 'Son nom est Mbango.'
  fails(reveal, '6.1.6', {})
  const three = clone(p)
  three.final.hints.push('Encore un indice.')
  fails(three, 'forme', {})
  const def = clone(p)
  def.steps.find(s => s.word === 'VICTOIRE').definition = 'On la fête sur le podium.'
  fails(def, '6.1.6', {})
  // Proverbe sans trou ; proverbe hors d'une énigme proverbe
  const hole = clone(build('fr-cm1-cm2-03'))
  hole.final.proverbText = 'Avec beaucoup de patience on peut cuire même une chose.'
  fails(hole, 'forme', {})
  fails({ ...clone(p), final: { ...clone(p).final, proverbText: 'x ___' } }, 'forme', {})
  // Mêmes lettres que la solution ; mots interdits ; id du vocabulaire de la solution
  const same = clone(build('fr-ce1-ce2-02'))
  same.steps[1] = { ...clone(same.steps[0]), id: 'copie' }
  fails(same, '6.1.3', {})
  fails(p, '6.1.7', { blockedWords: ['MBANGO'] })
  const sid = clone(build('fr-cm1-cm2-02'))
  sid.final.solutionId = 'vocab_0001'
  fails(sid, '6.3.1')
  // Statut et forme
  fails({ ...clone(p), status: 'generated' }, 'forme', {})
  fails({ ...clone(p), extraction: { rule: 'syllable' } }, 'forme', {})
  fails({ ...clone(p), final: { ...clone(p).final, type: 'riddle' } }, 'forme', {})
  // Parcours lisible mais mal formé : des erreurs, jamais d'exception
  const bad = clone(p)
  bad.steps[0].element = null
  assert.ok(validatePath(bad).length > 0)
  const worse = clone(p)
  worse.final = { kind: 'riddle' }
  assert.ok(validatePath(worse).length > 0)
})

test('R7 — moteur : éléments gagnés, consigne montrée dès la mission seulement sans mot d\'étape (F4), étoiles et points comme aux jeux 2 et 3, indices bornés à la reprise', () => {
  // Consigne : contient CHAMPION et OLYMPIC (F4), MUSIQUE, PROVERB → à la finale seulement
  const finaleOnly = SYNTHESE.map(([id]) => id).filter(id => !riddlePromptAtMission(build(id)))
  assert.deepEqual(finaleOnly, ['fr-ce1-ce2-03', 'en-cm1-cm2-01', 'en-cm1-cm2-03'])
  const p = build('fr-ce1-ce2-01')
  const sportif = p.steps.find(s => s.word === 'SPORTIF')
  assert.equal(presetElement({ word: 'SPORTIF' }, sportif, 'grandRiddle'), sportif.secret)
  assert.equal(sportif.element.factRef, 'RM2')
  const base = playSteps(p)
  assert.equal(base.phase, 'final')
  assert.deepEqual(collectedElements(p, base), p.steps.map(s => s.secret))
  assert.equal(finalHintLimit(p), 2)
  const answer = checkRiddleAnswer(p, 'Milla')
  const perfect = recordFinalFound(base, answer)
  assert.equal(starsFor(perfect, p), 3)
  assert.equal(computeScore(perfect), 6 * POINTS_PER_STEP + POINTS_FINAL)
  // 1er essai faux : 3 étoiles ; 2e essai faux : 2 étoiles, sans indice automatique
  const once = recordFinalWrong(base, p)
  assert.equal(starsFor(recordFinalFound(once, answer), p), 3)
  const twice = recordFinalWrong(once, p)
  assert.equal(twice.final.hints, 0)
  assert.equal(starsFor(recordFinalFound(twice, answer), p), 2)
  // Un indice : 2 étoiles ; deux au plus
  let h = recordFinalHint(base, p)
  assert.equal(starsFor(recordFinalFound(h, answer), p), 2)
  h = recordFinalHint(h, p)
  assert.equal(recordFinalHint(h, p), h)
  assert.equal(hintsUsed(recordFinalFound(h, answer), p), 2)
  // Solution montrée après 3 essais faux : 1 étoile, sans les 10 points
  assert.equal(recordFinalShown(twice), twice)
  const shown = recordFinalShown(recordFinalWrong(twice, p))
  assert.equal(starsFor(shown, p), 1)
  assert.equal(computeScore(shown), 6 * POINTS_PER_STEP)
  // Reprise : état contrôlé, indices bornés
  assert.equal(isValidState(clone(h), clone(p)), true)
  assert.equal(isValidState({ ...h, final: { ...h.final, hints: 3 } }, p), false)
})

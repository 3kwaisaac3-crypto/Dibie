// Tests du moteur des anagrammes mystères — lancer avec : npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MYSTERY_FORMAT_VERSION,
  MYSTERY_GAMES,
  POINTS_PER_STEP,
  POINTS_FINAL,
  allowedRules,
  secretIndexFor,
  extractSecret,
  assembleSolution,
  finalTiles,
  finalAsAnagram,
  checkFinalAnswer,
  createMysteryState,
  startSteps,
  recordStepWrong,
  recordStepFound,
  recordStepShown,
  advance,
  collectedElements,
  recordFinalHint,
  nextHintOption,
  recordFinalWrong,
  recordFinalFound,
  recordFinalShown,
  hintsUsed,
  solutionsShown,
  computeStars,
  starsFor,
  computeScore,
  isValidState
} from './mysteryEngine.js'

// Parcours de jeu 1 écrit à la main : mot mystère SEL, règle « dernière lettre »,
// étapes dans l'ordre E, L, S (positions 1, 2, 0 de la solution)
const wordPath = () => ({
  formatVersion: MYSTERY_FORMAT_VERSION,
  id: 'test-word',
  game: 'mysteryWord',
  language: 'fr',
  level: 'CE1-CE2',
  seed: 1,
  theme: null,
  difficulty: 1,
  extraction: { rule: 'last' },
  steps: [
    { id: 'a', word: 'PORTE', display: 'PORTE', definition: 'On l\'ouvre.', answers: [{ id: 'a', word: 'PORTE', display: 'PORTE' }], firstLetter: null, tiles: [...'EOPTR'], secret: 'E', secretIndex: 4, slot: 1 },
    { id: 'b', word: 'BOCAL', display: 'BOCAL', definition: 'Récipient.', answers: [{ id: 'b', word: 'BOCAL', display: 'BOCAL' }], firstLetter: null, tiles: [...'LACOB'], secret: 'L', secretIndex: 4, slot: 2 },
    { id: 'c', word: 'TAPIS', display: 'TAPIS', definition: 'Au sol.', answers: [{ id: 'c', word: 'TAPIS', display: 'TAPIS' }], firstLetter: null, tiles: [...'APSIT'], secret: 'S', secretIndex: 4, slot: 0 }
  ],
  final: {
    kind: 'word',
    prompt: 'Remets les lettres.',
    solution: 'SEL',
    display: 'SEL',
    acceptedAnswers: [{ id: 's', word: 'SEL', display: 'SEL' }],
    hints: ['Il rend salé.']
  },
  status: 'generated'
})

const themePath = () => ({
  ...wordPath(),
  id: 'test-theme',
  game: 'theme',
  extraction: { rule: 'word' },
  steps: wordPath().steps.map(s => ({ ...s, secret: s.display, secretIndex: null, slot: null })),
  final: {
    kind: 'choice',
    prompt: 'Quel thème ?',
    solution: 'La maison',
    display: 'La maison',
    acceptedAnswers: [{ id: null, word: 'LA MAISON', display: 'La maison' }],
    options: ['Le sport', 'La maison', 'Les animaux', 'La musique'],
    hints: ['Le sport', 'La musique']
  }
})

test('E1 — six jeux annoncés, seuls les jeux 1 et 4 disponibles (lot 1)', () => {
  assert.deepEqual(MYSTERY_GAMES.map(g => g.number), [1, 2, 3, 4, 5, 6])
  assert.deepEqual(MYSTERY_GAMES.filter(g => g.available).map(g => g.id), ['mysteryWord', 'theme'])
  for (const g of MYSTERY_GAMES) assert.ok(g.fr && g.en)
})

test('E2 — extraction : first, last, position n, marked ; jamais « first » en SIL-CP', () => {
  assert.equal(secretIndexFor('PORTE', { rule: 'first' }), 0)
  assert.equal(secretIndexFor('PORTE', { rule: 'last' }), 4)
  assert.equal(secretIndexFor('PORTE', { rule: 'position', position: 2 }), 1)
  assert.equal(secretIndexFor('PORTE', { rule: 'position', position: 6 }), null)
  assert.equal(secretIndexFor('PORTE', { rule: 'position', position: 0 }), null)
  assert.equal(secretIndexFor('PORTE', { rule: 'marked' }, 3), 3)
  assert.equal(secretIndexFor('PORTE', { rule: 'marked' }, 9), null)
  assert.equal(secretIndexFor('PORTE', { rule: 'inconnue' }), null)
  const answer = { word: 'PORTE', display: 'PORTE' }
  assert.equal(extractSecret(answer, { rule: 'first' }), 'P')
  assert.equal(extractSecret(answer, { rule: 'last' }), 'E')
  assert.equal(extractSecret(answer, { rule: 'position', position: 3 }), 'R')
  assert.equal(extractSecret(answer, { rule: 'marked' }, 1), 'O')
  assert.equal(extractSecret({ word: 'CEREALE', display: 'CÉRÉALE' }, { rule: 'word' }), 'CÉRÉALE')
  assert.deepEqual(allowedRules('SIL-CP'), ['last', 'marked'])
  assert.ok(!allowedRules('SIL-CP').includes('first'))
  assert.deepEqual(allowedRules('CE1-CE2'), ['first', 'last', 'position', 'marked'])
  assert.deepEqual(allowedRules('CM1-CM2'), ['first', 'last', 'position', 'marked'])
})

test('E3 — assemblage : les lettres gagnées reconstituent le mot mystère ; tuiles de la finale dans l\'ordre des étapes', () => {
  const p = wordPath()
  assert.equal(assembleSolution(p), 'SEL')
  assert.deepEqual(finalTiles(p), ['E', 'L', 'S'])
  const item = finalAsAnagram(p)
  assert.deepEqual(item.tiles, ['E', 'L', 'S'])
  assert.equal(item.firstLetter, null)
  assert.equal(item.word, 'SEL')
  // Position en double ou manquante : pas de solution
  const broken = wordPath()
  broken.steps[0].slot = 0
  assert.equal(assembleSolution(broken), null)
  assert.equal(assembleSolution(themePath()), null)
})

test('E4 — vérification de la réponse finale : mot (accents sans effet) et choix', () => {
  const p = wordPath()
  assert.equal(checkFinalAnswer(p, 'sel').word, 'SEL')
  assert.equal(checkFinalAnswer(p, 'SÉL').word, 'SEL')
  assert.equal(checkFinalAnswer(p, 'LES'), null)
  const th = themePath()
  assert.equal(checkFinalAnswer(th, 'La maison').display, 'La maison')
  assert.equal(checkFinalAnswer(th, 'Le sport'), null)
})

test('E5 — parcours complet sans aide : 3 étoiles, 10 points par anagramme et 10 pour le mystère (D10, M8)', () => {
  const p = wordPath()
  let s = createMysteryState(p)
  assert.equal(s.phase, 'mission')
  assert.equal(s.formatVersion, MYSTERY_FORMAT_VERSION)
  s = startSteps(s)
  assert.equal(s.phase, 'steps')
  assert.deepEqual(collectedElements(p, s), [null, null, null])
  for (let i = 0; i < 3; i++) {
    s = recordStepFound(s, p.steps[i].answers[0])
    assert.equal(collectedElements(p, s)[i], p.steps[i].secret)
    s = advance(s)
  }
  assert.equal(s.phase, 'final')
  s = recordFinalFound(s, p.final.acceptedAnswers[0])
  assert.equal(s.phase, 'done')
  assert.equal(computeScore(s), 3 * POINTS_PER_STEP + POINTS_FINAL)
  assert.equal(POINTS_PER_STEP, 10)
  assert.equal(POINTS_FINAL, 10)
  assert.equal(starsFor(s, p), 3)
  assert.equal(hintsUsed(s, p), 0)
})

test('E6 — étoiles : 2 avec un indice ou la première lettre, 1 si une solution a été montrée', () => {
  const p = wordPath()
  // Indice « première lettre » d'une étape (2e essai faux)
  let s = startSteps(createMysteryState(p))
  s = recordStepWrong(s)
  assert.equal(s.steps[0].hint, false)
  s = recordStepWrong(s)
  assert.equal(s.steps[0].hint, true)
  assert.equal(hintsUsed(s, p), 1)
  assert.equal(starsFor(s, p), 2)
  // Solution montrée seulement après 3 essais ; l'étape ne compte pas, l'élément est donné
  assert.equal(recordStepShown(s), s)
  s = recordStepShown(recordStepWrong(s))
  assert.equal(s.steps[0].status, 'shown')
  assert.equal(collectedElements(p, s)[0], 'E')
  assert.equal(solutionsShown(s), 1)
  assert.equal(starsFor(s, p), 1)
  assert.equal(computeScore(s), 0)
  // Indice de la finale (définition du mot mystère)
  let f = { ...createMysteryState(p), phase: 'final' }
  f = recordFinalHint(f, p)
  assert.equal(f.final.hints, 1)
  assert.equal(recordFinalHint(f, p), f, 'un seul indice de définition')
  assert.equal(starsFor(f, p), 2)
  // Première lettre de la finale au 2e essai faux
  let g = { ...createMysteryState(p), phase: 'final' }
  g = recordFinalWrong(recordFinalWrong(g, p), p)
  assert.equal(hintsUsed(g, p), 1)
  assert.equal(starsFor(g, p), 2)
  assert.equal(recordFinalShown(g), g, 'solution seulement après 3 essais')
  g = recordFinalShown(recordFinalWrong(g, p))
  assert.equal(g.phase, 'done')
  assert.equal(starsFor(g, p), 1)
  assert.equal(computeScore(g), 0)
  assert.equal(computeStars(), 3)
  assert.equal(computeStars({ hints: 1 }), 2)
  assert.equal(computeStars({ hints: 4, shown: 1 }), 1)
})

test('E7 — finale à choix (M6) : indices progressifs qui éliminent, proposition fausse éliminée, dernière proposition donnée', () => {
  const p = themePath()
  let s = { ...createMysteryState(p), phase: 'final' }
  s = recordFinalHint(s, p)
  assert.deepEqual(s.final.eliminated, ['Le sport'])
  s = recordFinalHint(s, p)
  assert.deepEqual(s.final.eliminated, ['Le sport', 'La musique'])
  assert.equal(recordFinalHint(s, p), s, '2 indices au plus')
  assert.equal(starsFor(s, p), 2)
  // Une proposition fausse de plus : il ne reste que la bonne, donnée comme solution
  s = recordFinalWrong(s, p, 'Les animaux')
  assert.equal(s.phase, 'done')
  assert.equal(s.final.status, 'shown')
  assert.equal(starsFor(s, p), 1)
  // Sans indice : 1 erreur garde 3 étoiles, 2 erreurs valent une aide
  let c = { ...createMysteryState(p), phase: 'final' }
  c = recordFinalWrong(c, p, 'Le sport')
  assert.equal(starsFor(c, p), 3)
  c = recordFinalWrong(c, p, 'Le sport')
  assert.deepEqual(c.final.eliminated, ['Le sport'])
  c = recordFinalWrong(c, p, 'Les animaux')
  assert.equal(starsFor(c, p), 2)
  // Indice après le choix de la proposition qu'il aurait éliminée : il en
  // élimine une autre, jamais la même deux fois (relecture du 2026-11-04)
  let h = { ...createMysteryState(p), phase: 'final' }
  h = recordFinalWrong(h, p, 'Le sport')
  assert.equal(nextHintOption(h, p), 'La musique')
  h = recordFinalHint(h, p)
  assert.deepEqual(h.final.eliminated, ['Le sport', 'La musique'])
  assert.equal(nextHintOption(h, p), 'Les animaux')
  h = recordFinalHint(h, p)
  assert.equal(h.final.status, 'shown', 'plus que la bonne proposition : elle est donnée')
  c = recordFinalFound(c, p.final.acceptedAnswers[0])
  assert.equal(c.final.status, 'found')
  assert.equal(computeScore(c), POINTS_FINAL)
})

test('E8 — transitions protégées : rien ne change hors de la bonne phase', () => {
  const p = wordPath()
  const s = createMysteryState(p)
  assert.equal(recordStepWrong(s), s)
  assert.equal(recordStepFound(s, p.steps[0].answers[0]), s)
  assert.equal(advance(s), s)
  assert.equal(recordFinalFound(s, p.final.acceptedAnswers[0]), s)
  const steps = startSteps(s)
  assert.equal(advance(steps), steps, 'pas d\'étape suivante tant que l\'étape n\'est pas terminée')
  const found = recordStepFound(steps, p.steps[0].answers[0])
  assert.equal(recordStepFound(found, p.steps[0].answers[0]), found, 'une étape ne se résout qu\'une fois')
})

test('E9 — état lisible pour la reprise : forme, version, cohérence avec le parcours', () => {
  const p = wordPath()
  const s = startSteps(createMysteryState(p))
  assert.equal(isValidState(s, p), true)
  assert.equal(isValidState(JSON.parse(JSON.stringify(s)), p), true, 'survit à JSON')
  assert.equal(isValidState({ ...s, formatVersion: 99 }, p), false)
  assert.equal(isValidState({ ...s, phase: 'autre' }, p), false)
  assert.equal(isValidState({ ...s, steps: s.steps.slice(1) }, p), false)
  assert.equal(isValidState({ ...s, current: 7 }, p), false)
  assert.equal(isValidState({ ...s, final: null }, p), false)
  assert.equal(isValidState(null, p), false)
  assert.equal(isValidState('texte', p), false)
})

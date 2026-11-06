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
  isValidState,
  GENERATED_GAMES,
  CODE_HINTS,
  codeKey,
  decodeMessage,
  codeLetter,
  initialCodeEntries,
  applyRevealed,
  isRevealedBox,
  fillCodeEntry,
  correctCodeBoxes,
  finalHintLimit,
  nextHintLetter
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

test('E1 — six jeux annoncés, jeux 1 et 4 (lot 1), 5 (lot 2), 2 et 3 (lot 3, parcours préconçus) disponibles', () => {
  assert.deepEqual(MYSTERY_GAMES.map(g => g.number), [1, 2, 3, 4, 5, 6])
  assert.deepEqual(MYSTERY_GAMES.filter(g => g.available).map(g => g.id), ['mysteryWord', 'syllables', 'secretSentence', 'theme', 'codedMessage', 'grandRiddle'])
  assert.deepEqual(MYSTERY_GAMES.filter(g => !g.available).map(g => g.id), [])
  assert.deepEqual([...GENERATED_GAMES], ['mysteryWord', 'theme', 'codedMessage'])
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
  // Message codé : le 2e essai faux coûte une étoile, comme au lot 1
  assert.equal(computeStars({ finalKind: 'code', finalTries: 1 }), 3)
  assert.equal(computeStars({ finalKind: 'code', finalTries: 2 }), 2)
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

// Parcours de jeu 5 écrit à la main : mot codé SALLE (4 lettres différentes,
// L répétée), règle « dernière lettre » ; clé S = 5, A = 9, L = 14, E = 2
const codePath = () => ({
  ...wordPath(),
  id: 'test-code',
  game: 'codedMessage',
  steps: [
    { id: 'a', word: 'PORTE', display: 'PORTE', definition: 'On l\'ouvre.', answers: [{ id: 'a', word: 'PORTE', display: 'PORTE' }], firstLetter: null, tiles: [...'EOPTR'], secret: 'E', secretIndex: 4, slot: null, code: 2 },
    { id: 'b', word: 'BOCAL', display: 'BOCAL', definition: 'Récipient.', answers: [{ id: 'b', word: 'BOCAL', display: 'BOCAL' }], firstLetter: null, tiles: [...'LACOB'], secret: 'L', secretIndex: 4, slot: null, code: 14 },
    { id: 'c', word: 'TAPIS', display: 'TAPIS', definition: 'Au sol.', answers: [{ id: 'c', word: 'TAPIS', display: 'TAPIS' }], firstLetter: null, tiles: [...'APSIT'], secret: 'S', secretIndex: 4, slot: null, code: 5 },
    { id: 'd', word: 'SOFA', display: 'SOFA', definition: 'Siège.', answers: [{ id: 'd', word: 'SOFA', display: 'SOFA' }], firstLetter: null, tiles: [...'FASO'], secret: 'A', secretIndex: 3, slot: null, code: 9 }
  ],
  final: {
    kind: 'code',
    prompt: 'Décode le message.',
    solution: 'SALLE',
    display: 'SALLE',
    message: [5, 9, 14, 14, 2],
    acceptedAnswers: [{ id: 's', word: 'SALLE', display: 'SALLE' }],
    hints: ['L', 'E', 'S', 'A']
  }
})

test('E10 — jeu 5 : clé rangée par nombre, lecture du message, lecture impossible si un nombre a deux lettres ou aucune', () => {
  const p = codePath()
  assert.deepEqual(codeKey(p), [{ number: 2, letter: 'E' }, { number: 5, letter: 'S' }, { number: 9, letter: 'A' }, { number: 14, letter: 'L' }])
  assert.equal(decodeMessage(p), 'SALLE')
  const twice = codePath()
  twice.steps[1].code = 2
  assert.equal(decodeMessage(twice), null)
  const missing = codePath()
  missing.final.message[0] = 26
  assert.equal(decodeMessage(missing), null)
  assert.equal(decodeMessage(wordPath()), null)
  // La seule réponse est le mot codé ; accents sans effet ; pas ses anagrammes
  assert.equal(checkFinalAnswer(p, 'salle').word, 'SALLE')
  assert.equal(checkFinalAnswer(p, 'SALLÉ').word, 'SALLE')
  assert.equal(checkFinalAnswer(p, 'LASLE'), null)
})

test('E11 — jeu 5 : une lettre tapée se reporte sous tous les nombres identiques ; effacer aussi ; cases justes', () => {
  const p = codePath()
  const s = { ...createMysteryState(p), phase: 'final' }
  let entries = initialCodeEntries(p, s)
  assert.deepEqual(entries, ['', '', '', '', ''])
  entries = fillCodeEntry(p, s, entries, 2, 'l')
  assert.deepEqual(entries, ['', '', 'L', 'L', ''], 'L sous les deux 14')
  entries = fillCodeEntry(p, s, entries, 3, '')
  assert.deepEqual(entries, ['', '', '', '', ''], 'effacée sous les deux 14')
  entries = fillCodeEntry(p, s, entries, 4, 'é')
  assert.deepEqual(entries, ['', '', '', '', 'E'], 'lettre sans accent')
  entries = fillCodeEntry(p, s, entries, 0, 'AS')
  assert.equal(entries[0], 'S', 'la dernière lettre tapée compte')
  assert.deepEqual(fillCodeEntry(p, s, entries, 1, '7'), [...entries.slice(0, 1), '', ...entries.slice(2)])
  assert.equal(fillCodeEntry(p, s, entries, 9, 'A'), entries, 'case inexistante : rien ne change')
  assert.equal(codeLetter('œ'), 'E')
  assert.equal(codeLetter(''), '')
  assert.equal(codeLetter(null), '')
  assert.equal(correctCodeBoxes(p, ['S', 'A', 'L', 'E', 'E']), 4)
})

test('E12 — jeu 5 : indice = une lettre du mot révélée partout (2 au plus), jamais une lettre déjà juste, cases verrouillées', () => {
  const p = codePath()
  assert.equal(CODE_HINTS, 2)
  assert.equal(finalHintLimit(p), 2)
  // Mot de 2 lettres différentes : 1 seul indice, il reste une lettre à décoder
  const two = { ...p, final: { ...p.final, solution: 'ELLE', hints: ['E', 'L'] } }
  assert.equal(finalHintLimit(two), 1)
  // Jeux 1 et 4 : limite inchangée (nombre d'indices prévus)
  assert.equal(finalHintLimit(wordPath()), 1)
  assert.equal(finalHintLimit(themePath()), 2)

  let s = { ...createMysteryState(p), phase: 'final' }
  assert.deepEqual(s.final.revealed, [])
  assert.equal(nextHintLetter(s, p), 'L')
  s = recordFinalHint(s, p)
  assert.deepEqual(s.final.revealed, ['L'])
  assert.deepEqual(initialCodeEntries(p, s), ['', '', 'L', 'L', ''])
  assert.equal(isRevealedBox(p, s, 2), true)
  assert.equal(isRevealedBox(p, s, 0), false)
  const entries = applyRevealed(p, s, ['S', '', '', '', 'E'])
  assert.deepEqual(entries, ['S', '', 'L', 'L', 'E'])
  assert.equal(fillCodeEntry(p, s, entries, 3, 'X'), entries, 'case révélée verrouillée')
  // E et S sont déjà justes partout : l'indice suivant révèle A
  assert.equal(nextHintLetter(s, p, entries), 'A')
  assert.equal(nextHintLetter(s, p, ['', '', 'L', 'L', '']), 'E')
  s = recordFinalHint(s, p, entries)
  assert.deepEqual(s.final.revealed, ['L', 'A'])
  assert.equal(recordFinalHint(s, p), s, '2 indices au plus')
  assert.equal(hintsUsed(s, p), 2)
  assert.equal(starsFor(s, p), 2)
  assert.equal(nextHintLetter(s, wordPath()), null)
  // Toutes les lettres prévues déjà justes : la première non révélée
  assert.equal(nextHintLetter({ ...createMysteryState(p), phase: 'final' }, p, ['S', 'A', 'L', 'L', 'E']), 'L')
  // Les états des jeux 1 et 4 restent ceux du lot 1 (pas de champ revealed)
  assert.equal('revealed' in createMysteryState(wordPath()).final, false)
  assert.equal('revealed' in createMysteryState(themePath()).final, false)
})

test('E13 — jeu 5 : parcours sans aide = 3 étoiles et 10 points par ligne de clé + 10 ; 2e essai faux = 2 étoiles ; solution montrée après 3 essais = 1 étoile', () => {
  const p = codePath()
  let s = startSteps(createMysteryState(p))
  for (let i = 0; i < p.steps.length; i++) {
    s = advance(recordStepFound(s, p.steps[i].answers[0]))
  }
  assert.equal(s.phase, 'final')
  assert.deepEqual(collectedElements(p, s), ['E', 'L', 'S', 'A'])
  const found = recordFinalFound(s, p.final.acceptedAnswers[0])
  assert.equal(computeScore(found), 4 * POINTS_PER_STEP + POINTS_FINAL)
  assert.equal(starsFor(found, p), 3)
  // Un essai faux : 3 étoiles ; le 2e essai faux vaut une aide (2 étoiles,
  // comme au lot 1), sans indice automatique au jeu 5
  let w = recordFinalWrong(s, p)
  assert.equal(starsFor(w, p), 3)
  w = recordFinalWrong(w, p)
  assert.equal(hintsUsed(w, p), 0)
  assert.equal(starsFor(w, p), 2)
  assert.equal(recordFinalShown(w), w, 'solution seulement après 3 essais')
  w = recordFinalShown(recordFinalWrong(w, p))
  assert.equal(w.phase, 'done')
  assert.equal(starsFor(w, p), 1)
  assert.equal(computeScore(w), 4 * POINTS_PER_STEP)
})

test('E14 — jeu 5 : état lisible pour la reprise (lettres révélées contrôlées) ; un état mal formé est refusé sans erreur', () => {
  const p = codePath()
  let s = recordFinalHint({ ...createMysteryState(p), phase: 'final', current: p.steps.length }, p)
  assert.equal(isValidState(s, p), true)
  assert.equal(isValidState(JSON.parse(JSON.stringify(s)), p), true, 'survit à JSON')
  const final = (change) => ({ ...s, final: { ...s.final, ...change } })
  assert.equal(isValidState(final({ revealed: undefined }), p), false)
  assert.equal(isValidState(final({ revealed: 'L' }), p), false)
  assert.equal(isValidState(final({ revealed: ['Z'] }), p), false, 'lettre absente du mot')
  assert.equal(isValidState(final({ revealed: ['L', 'L'], hints: 2 }), p), false, 'lettre en double')
  assert.equal(isValidState(final({ revealed: [] }), p), false, 'une lettre par indice')
  assert.equal(isValidState(final({ revealed: ['L', 'E', 'S'], hints: 3 }), p), false, 'plus d\'indices que permis')
  assert.equal(isValidState(final({ revealed: [null] }), p), false)
  assert.equal(isValidState(final({ hints: -1, revealed: [] }), p), false)
  // Un état de jeu 1 (sans revealed) reste valide pour un parcours de jeu 1
  assert.equal(isValidState(startSteps(createMysteryState(wordPath())), wordPath()), true)
  s = { ...createMysteryState(p) }
  assert.equal(isValidState(s, p), true)
})

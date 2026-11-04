// Moteur des anagrammes mystères (famille B du module anagrammes ; lot 1 de
// docs/anagrammes-mysteres.md, architecture validée par Isaac le 2026-11-03).
// Module pur : aucun accès au stockage ni à l'interface.
//
// Un PARCOURS est une suite d'étapes. Chaque étape est une anagramme classique
// (même mélange, mêmes aides que createAnagramGame) qui, une fois résolue,
// donne un ÉLÉMENT SECRET. Une RÉSOLUTION FINALE assemble ces éléments.
//
// Modèle d'un parcours (document de conception §5) :
// {
//   formatVersion, id, game: 'mysteryWord' | 'theme' | 'codedMessage', language, level, seed,
//   theme,              // jeu 4 : id du thème de la liste fixe ; jeux 1 et 5 : null
//   difficulty,         // 1, 2 ou 3 (moyenne arrondie du champ difficulte des étapes)
//   extraction: { rule, position? },  // une seule règle par parcours
//   steps: [{ id, word, display, definition, answers, firstLetter, tiles, secret, secretIndex, slot, code? }],
//   final: { kind: 'word' | 'choice' | 'code', prompt, solution, display, acceptedAnswers, hints, options?, message? },
//   status: 'generated'  // generated | draft | validated
// }
// Jeu 5 (lot 2) : chaque étape porte en plus `code`, le nombre de sa lettre
// (une ligne de la clé : secret ↔ code) ; final.message est la suite des
// nombres du mot codé ; final.hints, les lettres du mot dans l'ordre où les
// indices les révèlent.
//
// Décisions appliquées : étoiles selon les aides (M5) ; 10 points par
// anagramme et 10 pour le mystère final, sans bonus (D10, M8) ; reprise d'une
// partie interrompue (M4) ; jeu 4 par choix parmi 4 propositions (M6) ; jeu 5
// selon les décisions C1 à C5 d'Isaac du 2026-11-04 (§12 du document).

import { normalizeWord } from './wordSearchGenerator.js'
import { POINTS_PER_WORD, TRIES_BEFORE_HINT, TRIES_BEFORE_SOLUTION } from './anagramGame.js'

// Version du format d'un parcours et de son état (reprise) : une donnée
// enregistrée avec une autre version n'est jamais reprise. Inchangée au lot 2 :
// le jeu 5 ajoute des champs à ses propres parcours sans modifier ceux des
// jeux 1 et 4, dont les parties enregistrées restent reprenables.
export const MYSTERY_FORMAT_VERSION = 1

export const POINTS_PER_STEP = POINTS_PER_WORD // 10 points par anagramme (D10)
export const POINTS_FINAL = POINTS_PER_WORD // 10 points pour le mystère final (M8 : pas de bonus)

// Les six jeux de la famille B ; jeux 1 et 4 réalisés au lot 1, jeu 5 au
// lot 2. Les jeux 2, 3 et 6 attendent des contenus rédigés et vérifiés (lot 3).
export const MYSTERY_GAMES = Object.freeze([
  Object.freeze({ id: 'mysteryWord', number: 1, fr: 'Mot mystère', en: 'Mystery word', available: true }),
  Object.freeze({ id: 'syllables', number: 2, fr: 'Casse-tête des syllabes', en: 'Syllable puzzle', available: false }),
  Object.freeze({ id: 'secretSentence', number: 3, fr: 'Phrase secrète', en: 'Secret sentence', available: false }),
  Object.freeze({ id: 'theme', number: 4, fr: 'Mystère des thèmes', en: 'Theme mystery', available: true }),
  Object.freeze({ id: 'codedMessage', number: 5, fr: 'Message codé', en: 'Coded message', available: true }),
  Object.freeze({ id: 'grandRiddle', number: 6, fr: 'Grande énigme', en: 'Great riddle', available: false })
])

export const GENERATED_GAMES = Object.freeze(['mysteryWord', 'theme', 'codedMessage'])

// Jeux dont chaque étape donne une lettre (règles d'extraction du jeu 1)
export const LETTER_GAMES = Object.freeze(['mysteryWord', 'codedMessage'])

// Jeu 5 : nombres de la clé tirés dans 1 à CODE_MAX_NUMBER, sans répétition (C1)
export const CODE_MAX_NUMBER = 26

// Jeu 5 : indices au plus (chacun révèle une lettre du mot, toutes ses
// occurrences). CHOIX PROVISOIRE, à valider par un enseignant. Il reste
// toujours au moins une lettre à décoder (voir finalHintLimit).
export const CODE_HINTS = 2

// Règles d'extraction d'une lettre (jeu 1). 'word' : l'élément gagné est le
// mot lui-même (jeu 4).
export const LETTER_RULES = Object.freeze(['first', 'last', 'position', 'marked'])

// Règles permises par niveau. En SIL-CP, la première lettre est déjà placée :
// « first » donnerait le secret d'emblée (règle 8 du §6.1), elle y est exclue.
export function allowedRules(level) {
  return level === 'SIL-CP' ? ['last', 'marked'] : [...LETTER_RULES]
}

// Position (indice dans le mot) de la lettre secrète selon la règle, ou null
// si la règle ne s'applique pas à ce mot
export function secretIndexFor(word, extraction, markedIndex = null) {
  switch (extraction?.rule) {
    case 'first': return word.length > 0 ? 0 : null
    case 'last': return word.length > 0 ? word.length - 1 : null
    case 'position': {
      const n = extraction.position
      return Number.isInteger(n) && n >= 1 && n <= word.length ? n - 1 : null
    }
    case 'marked':
      return Number.isInteger(markedIndex) && markedIndex >= 0 && markedIndex < word.length ? markedIndex : null
    default: return null
  }
}

// Élément secret donné par une réponse (mot normalisé) à une étape :
// une lettre pour les règles de lettre, l'orthographe exacte du mot pour 'word'
export function extractSecret(answer, extraction, markedIndex = null) {
  if (extraction?.rule === 'word') return answer.display
  const i = secretIndexFor(answer.word, extraction, markedIndex)
  return i === null ? null : answer.word[i]
}

// Mot mystère reconstitué à partir des éléments secrets : chaque étape donne
// la lettre de la position `slot` de la solution
export function assembleSolution(path) {
  if (path.final.kind !== 'word') return null
  const letters = new Array(path.steps.length).fill(null)
  for (const step of path.steps) {
    if (!Number.isInteger(step.slot) || step.slot < 0 || step.slot >= letters.length || letters[step.slot] !== null) return null
    letters[step.slot] = step.secret
  }
  return letters.includes(null) ? null : letters.join('')
}

// Lettres gagnées dans l'ordre des étapes : ce sont les tuiles de la
// résolution finale du jeu 1
export const finalTiles = (path) => path.steps.map(s => s.secret)

// Résolution finale du jeu 1 présentée comme une anagramme (même interface et
// mêmes aides que les étapes)
export function finalAsAnagram(path) {
  return {
    id: 'final',
    word: path.final.solution,
    display: path.final.display,
    definition: path.final.prompt,
    answers: path.final.acceptedAnswers,
    firstLetter: null,
    tiles: finalTiles(path)
  }
}

// Vérifie la réponse finale : réponse acceptée correspondante, ou null.
// Mot : comparaison sur le mot normalisé (accents sans effet). Choix : la
// proposition exacte.
export function checkFinalAnswer(path, typed) {
  const { final } = path
  if (final.kind === 'choice') return final.acceptedAnswers.find(a => a.display === typed) ?? null
  const word = normalizeWord(typed)
  return final.acceptedAnswers.find(a => a.word === word) ?? null
}

// --- Jeu 5 : message codé (C1 à C5) ---
// Chaque étape donne une ligne de la clé : sa lettre secrète et son nombre.
// La seule réponse finale est le mot codé (le décodage) ; ses anagrammes du
// vocabulaire ne sont pas acceptées, contrairement au jeu 1.

// Clé complète du parcours, rangée par nombre : [{ number, letter }]
export const codeKey = (path) =>
  path.steps.map(s => ({ number: s.code, letter: s.secret })).sort((a, b) => a.number - b.number)

// Message lu avec la clé, ou null si un nombre n'a pas exactement une ligne
// de clé (deux lettres pour un même nombre, ou aucune)
export function decodeMessage(path) {
  if (path.final.kind !== 'code' || !Array.isArray(path.final.message)) return null
  const letterOf = new Map()
  for (const step of path.steps) {
    if (letterOf.has(step.code)) return null
    letterOf.set(step.code, step.secret)
  }
  const letters = path.final.message.map(n => letterOf.get(n))
  return letters.some(l => l === undefined) ? null : letters.join('')
}

// Lettre normalisée tapée dans une case ('' si ce n'est pas une lettre) :
// la dernière lettre saisie compte (une case qui en contenait déjà une)
export function codeLetter(text) {
  const letters = normalizeWord(String(text ?? '')).replace(/[^A-Z]/g, '')
  return letters === '' ? '' : letters[letters.length - 1]
}

// Cases de la résolution finale : une par nombre du message, '' si vide.
// Les lettres révélées par un indice sont déjà écrites.
export function initialCodeEntries(path, state) {
  return applyRevealed(path, state, path.final.message.map(() => ''))
}

// Écrit les lettres révélées (indices) sous tous leurs nombres
export function applyRevealed(path, state, entries) {
  const revealed = state.final.revealed ?? []
  return entries.map((e, i) => (revealed.includes(path.final.solution[i]) ? path.final.solution[i] : e))
}

// Vrai si la case est verrouillée : sa lettre a été révélée par un indice
export const isRevealedBox = (path, state, index) =>
  (state.final.revealed ?? []).includes(path.final.solution[index])

// Lettre tapée (ou effacée, '') dans la case `index` : elle est reportée sous
// TOUS les nombres identiques. Une case révélée ne change pas.
export function fillCodeEntry(path, state, entries, index, text) {
  if (!Number.isInteger(index) || index < 0 || index >= entries.length || isRevealedBox(path, state, index)) return entries
  const letter = codeLetter(text)
  const number = path.final.message[index]
  return entries.map((e, i) => (path.final.message[i] === number ? letter : e))
}

// Nombre de cases justes (retour après une réponse fausse, comme « lettres
// bien placées » d'une anagramme ; ce n'est pas une aide)
export const correctCodeBoxes = (path, entries) =>
  entries.filter((e, i) => e === path.final.solution[i]).length

// Nombre d'indices permis pour la finale. Jeu 5 : CODE_HINTS au plus, et
// toujours au moins une lettre du mot à décoder soi-même.
export function finalHintLimit(path) {
  if (path.final.kind !== 'code') return path.final.hints.length
  return Math.max(0, Math.min(CODE_HINTS, path.final.hints.length, new Set(path.final.solution).size - 1))
}

// Jeu 5 : lettre que le prochain indice révèle. La première de l'ordre prévu
// (final.hints) qui n'est ni déjà révélée ni déjà juste dans toutes ses cases
// (un indice ne doit pas être perdu) ; à défaut, la première non révélée.
export function nextHintLetter(state, path, entries = []) {
  if (path.final.kind !== 'code') return null
  const revealed = state.final.revealed ?? []
  const solution = path.final.solution
  const left = path.final.hints.filter(l => !revealed.includes(l))
  const typedRight = (l) => [...solution].every((s, i) => s !== l || entries[i] === l)
  return left.find(l => !typedRight(l)) ?? left[0] ?? null
}

// --- État d'une partie (sérialisable : il est enregistré pour la reprise) ---

// phase : mission | steps | final | done
// steps[i] : { status: 'pending' | 'found' | 'shown', answer, tries, hint }
// final : { status, answer, tries, hints, eliminated, revealed? }
// revealed (jeu 5 seulement) : lettres du mot révélées par les indices. Les
// états des jeux 1 et 4 restent ceux du lot 1.
export function createMysteryState(path) {
  const final = { status: 'pending', answer: null, tries: 0, hints: 0, eliminated: [] }
  return {
    formatVersion: MYSTERY_FORMAT_VERSION,
    phase: 'mission',
    current: 0,
    steps: path.steps.map(() => ({ status: 'pending', answer: null, tries: 0, hint: false })),
    final: path.final.kind === 'code' ? { ...final, revealed: [] } : final
  }
}

const updateStep = (state, index, change) => ({
  ...state,
  steps: state.steps.map((s, i) => (i === index ? { ...s, ...change } : s))
})

export const startSteps = (state) => (state.phase === 'mission' ? { ...state, phase: 'steps' } : state)

// Essai faux sur l'étape en cours : à partir du 2e, l'indice « première
// lettre » est montré par l'interface et compte comme une aide
export function recordStepWrong(state) {
  if (state.phase !== 'steps') return state
  const step = state.steps[state.current]
  const tries = step.tries + 1
  return updateStep(state, state.current, { tries, hint: step.hint || tries >= TRIES_BEFORE_HINT })
}

// Étape résolue : l'élément secret est gagné. answer : { id, word, display }
export function recordStepFound(state, answer) {
  if (state.phase !== 'steps' || state.steps[state.current].status !== 'pending') return state
  return updateStep(state, state.current, { status: 'found', answer: { id: answer.id, word: answer.word, display: answer.display } })
}

// Solution montrée (après 3 essais) : l'élément secret est quand même donné,
// pour que le parcours puisse continuer ; l'étape ne compte pas de points
export function recordStepShown(state) {
  if (state.phase !== 'steps') return state
  const step = state.steps[state.current]
  if (step.status !== 'pending' || step.tries < TRIES_BEFORE_SOLUTION) return state
  return updateStep(state, state.current, { status: 'shown' })
}

// Étape suivante, ou résolution finale quand toutes les étapes sont terminées
export function advance(state) {
  if (state.phase !== 'steps' || state.steps[state.current].status === 'pending') return state
  const next = state.steps.findIndex(s => s.status === 'pending')
  return next === -1 ? { ...state, phase: 'final', current: state.steps.length } : { ...state, current: next }
}

// Éléments déjà gagnés (null pour une étape non terminée), dans l'ordre des étapes
export const collectedElements = (path, state) =>
  path.steps.map((step, i) => (state.steps[i]?.status === 'pending' ? null : step.secret))

const updateFinal = (state, change) => ({ ...state, final: { ...state.final, ...change } })

// Choix : proposition fausse que le prochain indice élimine. La première des
// indices prévus qui n'est pas déjà rayée (l'élève a pu la choisir), sinon une
// autre proposition fausse : chaque indice élimine une NOUVELLE proposition.
export function nextHintOption(state, path) {
  if (path.final.kind !== 'choice') return null
  const out = state.final.eliminated
  const wrong = path.final.options.filter(o => o !== path.final.solution)
  return [...path.final.hints, ...wrong].find(o => !out.includes(o)) ?? null
}

// Indice de la résolution finale. Mot : définition du mot mystère (un seul).
// Choix : élimine une proposition fausse à chaque fois (indices progressifs).
// Code (jeu 5) : révèle une lettre du mot, toutes ses occurrences ; `entries`
// (cases déjà remplies) évite de révéler une lettre déjà juste partout.
export function recordFinalHint(state, path, entries = []) {
  if (state.phase !== 'final' || state.final.status !== 'pending') return state
  if (state.final.hints >= finalHintLimit(path)) return state
  const hints = state.final.hints + 1
  if (path.final.kind === 'code') {
    const letter = nextHintLetter(state, path, entries)
    return letter === null ? state : updateFinal(state, { hints, revealed: [...state.final.revealed, letter] })
  }
  if (path.final.kind !== 'choice') return updateFinal(state, { hints })
  const removed = nextHintOption(state, path)
  const eliminated = removed === null ? state.final.eliminated : [...state.final.eliminated, removed]
  return revealIfLastOption(updateFinal(state, { hints, eliminated }), path)
}

// Choix : quand une seule proposition reste, la réponse est donnée (solution montrée)
function revealIfLastOption(state, path) {
  if (path.final.kind !== 'choice') return state
  const left = path.final.options.filter(o => !state.final.eliminated.includes(o))
  return left.length <= 1 ? { ...updateFinal(state, { status: 'shown' }), phase: 'done' } : state
}

// Réponse finale fausse. Choix : la proposition est éliminée.
export function recordFinalWrong(state, path, choice = null) {
  if (state.phase !== 'final' || state.final.status !== 'pending') return state
  const tries = state.final.tries + 1
  if (path.final.kind !== 'choice') return updateFinal(state, { tries })
  const eliminated = choice === null ? state.final.eliminated : [...new Set([...state.final.eliminated, choice])]
  return revealIfLastOption(updateFinal(state, { tries, eliminated }), path)
}

export function recordFinalFound(state, answer) {
  if (state.phase !== 'final' || state.final.status !== 'pending') return state
  return { ...updateFinal(state, { status: 'found', answer: { id: answer.id ?? null, word: answer.word, display: answer.display } }), phase: 'done' }
}

// Solution montrée pour le mot mystère (après 3 essais)
export function recordFinalShown(state) {
  if (state.phase !== 'final' || state.final.status !== 'pending' || state.final.tries < TRIES_BEFORE_SOLUTION) return state
  return { ...updateFinal(state, { status: 'shown' }), phase: 'done' }
}

// Nombre d'aides utilisées : étapes où l'indice « première lettre » a été
// montré, indices demandés pour la finale, indice « première lettre » de la
// finale (mot, à partir du 2e essai faux)
export function hintsUsed(state, path) {
  const finalFirstLetter = path.final.kind === 'word' && state.final.tries >= TRIES_BEFORE_HINT ? 1 : 0
  return state.steps.filter(s => s.hint).length + state.final.hints + finalFirstLetter
}

export const solutionsShown = (state) =>
  state.steps.filter(s => s.status === 'shown').length + (state.final.status === 'shown' ? 1 : 0)

// Étoiles (M5, sans chronomètre) : 3 sans aide ; 2 avec un indice ou la
// première lettre ; 1 si une solution a été montrée. Pour la finale à choix et
// le message codé, le 2e essai faux vaut une aide (comme le 2e essai faux d'un
// mot, qui montre la première lettre ; décision d'Isaac du 2026-11-04 pour le code).
export function computeStars({ hints = 0, shown = 0, finalTries = 0, finalKind = 'word' } = {}) {
  if (shown > 0) return 1
  if (hints > 0 || ((finalKind === 'choice' || finalKind === 'code') && finalTries >= TRIES_BEFORE_HINT)) return 2
  return 3
}

export const starsFor = (state, path) => computeStars({
  hints: hintsUsed(state, path),
  shown: solutionsShown(state),
  finalTries: state.final.tries,
  finalKind: path.final.kind
})

// Points : 10 par anagramme trouvée, 10 pour le mystère final trouvé (D10, M8)
export function computeScore(state) {
  return state.steps.filter(s => s.status === 'found').length * POINTS_PER_STEP +
    (state.final.status === 'found' ? POINTS_FINAL : 0)
}

// --- Reprise (M4) ---

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

// État cohérent avec le parcours (forme seulement)
export function isValidState(state, path) {
  if (!isObject(state) || state.formatVersion !== MYSTERY_FORMAT_VERSION) return false
  if (!['mission', 'steps', 'final', 'done'].includes(state.phase)) return false
  if (!Array.isArray(state.steps) || state.steps.length !== path.steps.length) return false
  if (!Number.isInteger(state.current) || state.current < 0 || state.current > path.steps.length) return false
  const stepOk = (s) => isObject(s) && ['pending', 'found', 'shown'].includes(s.status) &&
    Number.isInteger(s.tries) && s.tries >= 0 && typeof s.hint === 'boolean'
  if (!state.steps.every(stepOk)) return false
  if (state.phase === 'steps' && (state.current >= path.steps.length)) return false
  const f = state.final
  const finalOk = isObject(f) && ['pending', 'found', 'shown'].includes(f.status) && Number.isInteger(f.tries) &&
    Number.isInteger(f.hints) && f.hints >= 0 && Array.isArray(f.eliminated)
  if (!finalOk) return false
  if (path.final.kind !== 'code') return true
  // Jeu 5 : lettres révélées distinctes, prises dans le mot, une par indice
  const r = f.revealed
  return Array.isArray(r) && r.length === f.hints && f.hints <= finalHintLimit(path) &&
    new Set(r).size === r.length && r.every(l => typeof l === 'string' && l.length === 1 && path.final.solution.includes(l))
}


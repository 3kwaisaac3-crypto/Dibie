// Parcours préconçus des anagrammes mystères (lot 3, partie 1 : jeu 2
// « Casse-tête des syllabes » et jeu 3 « Phrase secrète » ; lot 3, partie 2 :
// jeu 6 « Grande énigme » ; docs/anagrammes-mysteres.md §6.3, §13 et §14).
// Module pur.
//
// Le contenu (mots, syllabes, définitions, phrases, indices) vient UNIQUEMENT
// de src/data/parcours-mysteres.js (jeux 2 et 3) et src/data/grande-enigme.js
// (jeu 6), validés par Isaac le 2026-11-05, à valider par un enseignant. Ce module ne fait qu'assembler un parcours jouable, avec
// la graine : choix du parcours parmi ceux du niveau et de la langue, mélange
// des lettres (createAnagramItem : mêmes règles que les anagrammes classiques),
// ordre des étapes (décision I8) et ordre des étiquettes de la finale.
// Même graine + même jeu + même niveau + même langue + même vocabulaire =
// même parcours. Tout parcours est contrôlé par validatePath (avec le
// vocabulaire) : un parcours invalide n'est jamais renvoyé.

import { normalizeWord, createRandom } from './wordSearchGenerator.js'
import { BLOCKED_WORDS, isValidSeed } from './wordSearchGame.js'
import {
  ANAGRAM_SETTINGS,
  buildAnswerIndex,
  containsBlocked,
  createAnagramItem,
  definitionRevealsWord,
  letterKey,
  normalizeBlocked,
  shuffled
} from './anagramGame.js'
import { MYSTERY_FORMAT_VERSION, PRESET_GAMES, labelWords, riddleKey, sentenceLabel } from './mysteryEngine.js'
import { validatePath } from './mysteryValidation.js'
import { PARCOURS_MYSTERES } from '../data/parcours-mysteres.js'
import { GRANDE_ENIGME } from '../data/grande-enigme.js'

// Tous les parcours préconçus : jeux 2 et 3 (44), jeu 6 (18)
export const ALL_PRESETS = Object.freeze([...PARCOURS_MYSTERES, ...GRANDE_ENIGME])

const FINAL_PROMPTS = {
  syllables: {
    fr: 'Remets les syllabes gagnées dans l\'ordre pour écrire le mot mystère.',
    en: 'Put the syllables you won in the right order to write the mystery word.'
  },
  secretSentence: {
    fr: 'Remets tous les mots dans l\'ordre pour retrouver la phrase secrète.',
    en: 'Put all the words in the right order to find the secret sentence.'
  }
}

// Essais de mélange avant d'abandonner (ordre des étapes, des étiquettes)
const ORDER_TRIES = 50

// Parcours du contenu pour un jeu, un niveau et une langue (ordre du fichier)
export const presetsFor = (game, level, language, presets = ALL_PRESETS) =>
  presets.filter(p => p.game === game && p.level === level && p.language === language)

// Réponses acceptées d'une étape : celles du contenu, puis les anagrammes du
// vocabulaire du niveau et de la langue (D9), sans doublon. La réponse du
// contenu garde son id : un mot de même orthographe mais d'un autre sens
// (décision I10) n'est jamais relié à l'entrée du vocabulaire.
function stepAnswers(step, index) {
  const answers = [...step.answers]
  for (const a of index?.get(letterKey(step.word)) ?? []) {
    if (!answers.some(b => b.word === a.word)) answers.push(a)
  }
  return answers
}

// Position (en lettres de grille) de la syllabe donnée dans le mot : somme
// des syllabes qui la précèdent, d'après son rang dans le contenu (TÊ-TE :
// TE est la 2e ; PAPIER : PA est la 1re)
function syllableIndex(step) {
  const k = step.syllableRank - 1
  if (!Number.isInteger(k) || k < 0 || k >= step.syllables.length) return null
  return step.syllables.slice(0, k).reduce((n, s) => n + normalizeWord(s).length, 0)
}

// Ordre des étapes (décision I8) : les éléments gagnés, dans l'ordre de la
// barre, ne doivent pas redonner la solution (jeu 2 : le mot mystère ; jeu 3 :
// les mots trouvés dans l'ordre de la phrase). Tableau d'indices, ou null.
function stepOrder(count, inOrder, random) {
  const identity = Array.from({ length: count }, (_, i) => i)
  for (let t = 0; t < ORDER_TRIES; t++) {
    const order = shuffled(identity, random)
    if (!inOrder(order)) return order
  }
  return null
}

// Étiquettes du jeu 3 dans un ordre qui ne forme aucune phrase acceptée
function sentenceLabelsOrder(labels, accepted, random) {
  for (let t = 0; t < ORDER_TRIES; t++) {
    const order = shuffled(labels, random)
    if (!accepted.has(labelWords(order))) return order
  }
  return null
}

// Assemble un parcours jouable à partir d'un parcours du contenu. `random` :
// générateur de la graine (consommé dans l'ordre : mélanges des étapes, ordre
// des étapes, ordre des étiquettes). Renvoie null si un mélange sûr manque.
// Le parcours renvoyé n'est PAS encore validé (voir generatePresetPath).
export function buildPresetPath(raw, seed, random, { vocabulary = null, blockedWords = BLOCKED_WORDS } = {}) {
  const settings = ANAGRAM_SETTINGS[raw.level]
  if (!settings || !PRESET_GAMES.includes(raw.game)) return null
  if (raw.game === 'grandRiddle') return buildRiddlePath(raw, seed, random, { vocabulary, blockedWords })
  const blocked = normalizeBlocked(blockedWords)
  const index = vocabulary ? buildAnswerIndex(vocabulary, raw.level, raw.language) : null
  const isSentence = raw.game === 'secretSentence'
  // Jeu 3 : place de chaque mot trouvé dans la phrase de référence
  const sentenceWords = isSentence ? labelWords([raw.final.solution]).split(' ') : []
  const usedPlaces = new Set()

  const built = []
  for (const [n, s] of raw.steps.entries()) {
    const candidate = { id: `${raw.id}-${n + 1}`, word: s.word, display: s.display, definition: s.definition }
    const item = createAnagramItem(candidate, stepAnswers(s, index), random, { firstLetterGiven: settings.firstLetterGiven, blockedWords: blocked })
    if (item === null) return null
    // L'étape garde un id propre au parcours (itemId des progrès) ; le mot du
    // contenu garde l'id du vocabulaire, ou null (wordId des progrès, I10)
    const wordId = s.answers[0]?.id ?? null
    const answers = item.answers.map(a => (a.word === s.word ? { ...a, id: wordId } : a))
    const step = { ...item, answers, wordId }
    if (isSentence) {
      const slot = sentenceWords.findIndex((w, i) => w === s.word && !usedPlaces.has(i))
      usedPlaces.add(slot)
      built.push({ ...step, secret: sentenceLabel(raw.level, s.secret), secretIndex: null, slot })
    } else {
      built.push({ ...step, secret: s.secret, secretIndex: syllableIndex(s), syllables: [...s.syllables], slot: n })
    }
  }

  // Ordre des étapes mélangé (I8), qui ne redonne pas la solution dans l'ordre
  const inOrder = isSentence
    ? (order) => order.every((k, i) => i === 0 || built[order[i - 1]].slot < built[k].slot)
    : (order) => normalizeWord(order.map(k => built[k].secret).join('')) === raw.final.solution
  const order = built.length < 2 ? [0] : stepOrder(built.length, inOrder, random)
  if (order === null) return null
  const steps = order.map(k => built[k])
  const language = raw.language === 'en' ? 'en' : 'fr'

  const base = {
    formatVersion: MYSTERY_FORMAT_VERSION,
    id: raw.id,
    game: raw.game,
    language: raw.language,
    level: raw.level,
    seed,
    theme: null,
    // Pas de champ difficulte dans le contenu préconçu : la progression suit le niveau
    difficulty: null,
    extraction: { rule: isSentence ? 'word' : 'syllable' },
    steps,
    status: raw.status
  }

  if (!isSentence) {
    return {
      ...base,
      final: {
        kind: 'syllables',
        prompt: FINAL_PROMPTS.syllables[language],
        solution: raw.final.solution,
        display: raw.final.display,
        syllables: [...raw.final.syllables],
        acceptedAnswers: raw.final.acceptedAnswers.map(a => ({ ...a })),
        hints: [...raw.final.hints],
        // Étiquettes : les syllabes gagnées, dans l'ordre des étapes
        labels: steps.map(s => s.secret)
      }
    }
  }

  // Jeu 3 : étiquettes = mots trouvés + mots donnés d'office (I4), mélangés
  const given = raw.final.given.map(g => sentenceLabel(raw.level, g))
  const accepted = new Set(raw.final.acceptedAnswers.map(a => a.word))
  const labels = sentenceLabelsOrder([...steps.map(s => s.secret), ...given], accepted, random)
  if (labels === null) return null
  return {
    ...base,
    final: {
      kind: 'sentence',
      prompt: FINAL_PROMPTS.secretSentence[language],
      solution: labelWords([raw.final.solution]),
      display: raw.final.solution,
      given,
      acceptedAnswers: raw.final.acceptedAnswers.map(a => ({ ...a })),
      hints: [...raw.final.hints],
      labels
    }
  }
}

// Jeu 6 : position (en lettres) de l'élément dans le mot. Lettre : son rang
// moins un ; syllabe : somme des syllabes qui la précèdent ; indice : null.
function riddleIndex(element) {
  if (element.type === 'letter') return Number.isInteger(element.rank) ? element.rank - 1 : null
  if (element.type === 'syllable') return syllableIndex({ syllables: element.syllables, syllableRank: element.rank })
  return null
}

// Jeu 6 : assemble un parcours jouable. Même ordre des tirages que les jeux 2
// et 3 : mélanges des étapes (dans l'ordre du contenu), puis ordre des étapes.
// Ordre des étapes (E9, comme I8) : les lettres et syllabes, dans l'ordre où
// elles sont gagnées, ne redonnent jamais la solution ; un indice d'étape qui
// contient un mot d'étape du parcours n'est donné qu'après cette étape (choix
// provisoire, §14 du document : sinon l'indice aiderait à résoudre l'anagramme).
function buildRiddlePath(raw, seed, random, { vocabulary, blockedWords }) {
  const settings = ANAGRAM_SETTINGS[raw.level]
  const blocked = normalizeBlocked(blockedWords)
  const index = vocabulary ? buildAnswerIndex(vocabulary, raw.level, raw.language) : null
  let piece = 0
  const built = []
  for (const [n, s] of raw.steps.entries()) {
    const candidate = { id: `${raw.id}-${n + 1}`, word: s.word, display: s.display, definition: s.definition }
    const item = createAnagramItem(candidate, stepAnswers(s, index), random, { firstLetterGiven: settings.firstLetterGiven, blockedWords: blocked })
    if (item === null) return null
    const wordId = s.answers[0]?.id ?? null
    const answers = item.answers.map(a => (a.word === s.word ? { ...a, id: wordId } : a))
    const element = { ...s.element, ...(s.element.syllables ? { syllables: [...s.element.syllables] } : {}) }
    const isClue = element.type === 'clue'
    const step = {
      ...item,
      answers,
      wordId,
      element,
      secret: isClue ? element.text : element.value,
      secretIndex: riddleIndex(element),
      slot: isClue ? null : piece++
    }
    if (element.type === 'syllable') step.syllables = [...element.syllables]
    built.push(step)
  }

  const solution = normalizeWord(raw.final.solution)
  const inOrder = (order) => normalizeWord(order.map(k => built[k]).filter(st => st.slot !== null).map(st => st.secret).join('')) === solution
  // Un indice qui contient le mot d'une autre étape vient après elle
  const clueTooEarly = (order) => order.some((k, i) =>
    built[k].element.type === 'clue' && order.slice(i + 1).some(j => definitionRevealsWord(built[k].secret, built[j].word)))
  const order = stepOrder(built.length, (o) => inOrder(o) || clueTooEarly(o), random)
  if (order === null) return null
  const steps = order.map(k => built[k])

  const display = raw.final.display ?? raw.final.solution
  // Réponses acceptées : la solution (affichée avec son orthographe montrée),
  // puis les variantes du contenu ; une seule fois par clé de comparaison
  const accepted = []
  for (const text of [display, ...raw.final.acceptedAnswers]) {
    const word = riddleKey(text)
    if (!accepted.some(a => a.word === word)) accepted.push({ id: null, word, display: text })
  }
  const final = {
    kind: 'riddle',
    type: raw.final.kind,
    prompt: raw.final.prompt,
    solution,
    display,
    acceptedAnswers: accepted,
    hints: [...raw.final.hints]
  }
  if (raw.final.proverbText !== undefined) final.proverbText = raw.final.proverbText
  if (raw.final.solutionId !== undefined) final.solutionId = raw.final.solutionId
  return {
    formatVersion: MYSTERY_FORMAT_VERSION,
    id: raw.id,
    game: raw.game,
    language: raw.language,
    level: raw.level,
    seed,
    theme: null,
    difficulty: null,
    extraction: { rule: 'riddle' },
    steps,
    final,
    status: raw.status
  }
}

// Parcours du contenu valides pour un jeu, un niveau et une langue (contrôlés
// avec le vocabulaire, graine 0) : ceux que l'application peut montrer. Un
// parcours qui échoue est simplement écarté.
export function availablePresets(game, vocabulary, level, language = 'fr', { presets = ALL_PRESETS, blockedWords = BLOCKED_WORDS } = {}) {
  return presetsFor(game, level, language, presets).filter(raw => {
    const path = buildPresetPath(raw, 0, createRandom(0), { vocabulary, blockedWords })
    return path !== null && validatePath(path, { vocabulary, blockedWords }).length === 0
  })
}

// Erreurs de validation de chaque parcours du contenu (rapport d'intégration
// et tests) : [{ id, errors }], errors vide si le parcours est valide
export function validateAllPresets(vocabulary, { presets = ALL_PRESETS, blockedWords = BLOCKED_WORDS, seed = 0 } = {}) {
  return presets.map(raw => {
    const path = buildPresetPath(raw, seed, createRandom(seed), { vocabulary, blockedWords })
    return {
      id: raw.id,
      errors: path === null ? [{ rule: 'forme', message: 'aucun mélange sûr' }] : validatePath(path, { vocabulary, blockedWords })
    }
  })
}

// Jeux 2 et 3 : choisit un parcours parmi ceux du niveau et de la langue, avec
// la graine, et l'assemble. Le premier parcours valide dans l'ordre tiré est
// renvoyé ; à défaut (aucun parcours valide), null : le jeu est indisponible.
export function generatePresetPath(game, vocabulary, level, seed, language = 'fr', { presets = ALL_PRESETS, blockedWords = BLOCKED_WORDS } = {}) {
  if (!ANAGRAM_SETTINGS[level]) throw new RangeError(`generatePresetPath : niveau inconnu (${level})`)
  if (!isValidSeed(seed)) throw new RangeError('generatePresetPath : graine invalide')
  const blocked = normalizeBlocked(blockedWords)
  const random = createRandom(seed)
  for (const raw of shuffled(presetsFor(game, level, language, presets), random)) {
    if (raw.steps.some(s => containsBlocked(s.word, blocked))) continue
    const path = buildPresetPath(raw, seed, random, { vocabulary, blockedWords: blocked })
    if (path !== null && validatePath(path, { vocabulary, blockedWords: blocked }).length === 0) return path
  }
  return null
}

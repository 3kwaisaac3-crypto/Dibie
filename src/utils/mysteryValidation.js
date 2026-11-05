// Règles de validation des anagrammes mystères (docs/anagrammes-mysteres.md,
// §6). Un parcours qui échoue à l'une d'elles n'est JAMAIS montré : les
// générateurs le rejettent, l'écran le revérifie avant affichage et à la reprise.
//
// validatePath(path, context) renvoie la liste des erreurs ({ rule, message }),
// vide si le parcours est valide.
// - Sans `vocabulary` : règles communes du §6.1 (forme du parcours). C'est le
//   contrôle fait à la reprise : le parcours enregistré est complet, il ne
//   dépend pas du vocabulaire (un import local peut l'avoir changé depuis).
// - Avec `vocabulary` : en plus, règles des parcours générés du §6.2, ou, pour
//   les parcours préconçus (jeux 2 et 3, §6.3), contrôle des identifiants du
//   vocabulaire et des anagrammes du vocabulaire à accepter (D9).
//
// Parcours préconçus (lot 3, partie 1 ; §13 du document) : règles communes du
// §6.1 et règles propres, nommées ainsi dans les erreurs :
// - '6.3.1' : étape préconçue (id, définition non vide qui ne donne pas le mot,
//   orthographe, longueur du niveau — jeu 3 en CM1-CM2 : 4 à 10 lettres, I3 —,
//   identifiant du vocabulaire) ;
// - 'J2' : jeu 2, la syllabe donnée est une syllabe du mot à sa place, et les
//   syllabes, collées dans l'ordre, forment le mot mystère ;
// - 'J3' : jeu 3, mots trouvés + mots donnés = la phrase ; chaque phrase
//   acceptée utilise exactement les mêmes mots ; étiquettes en capitales hors
//   SIL-CP (I5) ;
// - 'D9' : toute anagramme du vocabulaire (niveau, langue, lettre placée en
//   SIL-CP) est une réponse acceptée de l'étape.

import { normalizeWord } from './wordSearchGenerator.js'
import { BLOCKED_WORDS, entryText } from './wordSearchGame.js'
import {
  ANAGRAM_SETTINGS,
  MIN_WORD_LENGTH,
  buildAnswerIndex,
  containsBlocked,
  definitionRevealsWord,
  gridTokens,
  letterKey,
  normalizeBlocked
} from './anagramGame.js'
import {
  CODE_MAX_NUMBER,
  GENERATED_GAMES,
  LETTER_GAMES,
  PRESET_GAMES,
  allowedRules,
  assembleSolution,
  decodeMessage,
  extractSecret,
  labelWords,
  presetElement,
  presetLengths,
  secretIndexFor,
  finalTiles
} from './mysteryEngine.js'
import { THEMES_MYSTERES, THEME_STATUSES } from '../data/themes-mysteres.js'
import { PRESET_STATUSES } from '../data/parcours-mysteres.js'

// Radicaux d'un nom de thème : mots de 4 lettres ou plus (les articles
// « les », « the » sont ignorés), réduits à leurs 4 ou 5 premières lettres
// (5 au plus, 3 lettres de moins que le mot, 4 au moins). AGRICULTURE → AGRIC
// (agricole, agriculteur), MUSIQUE → MUSI (musicien), ANIMAUX → ANIM (animal),
// ECOLE → ECOL (écolier), FARMING → FARM (farmer). C'est la règle 6 du §6.1
// « étendue au thème », formes dérivées comprises. Elle écarte aussi par
// prudence des mots sans rapport qui commencent de la même façon
// (TRANSPARENT pour TRANSPORTS) : jamais l'inverse.
export function themeStems(label) {
  return gridTokens(label)
    .filter(token => token.length >= 4)
    .map(token => token.slice(0, Math.min(5, Math.max(4, token.length - 3))))
}

// Vrai si un mot d'étape est contenu dans un mot du libellé (4 lettres ou
// plus) : PORT dans « transports », JEU dans « jeux », GAME dans « games ».
// Règle R2 de l'educator, sens inverse de revealsTheme.
export function wordInLabel(word, label) {
  return word.length >= MIN_WORD_LENGTH && gridTokens(label).some(token => token.length >= 4 && token.includes(word))
}

// Vrai si un texte (définition, mot, indice) contient le nom du thème ou une
// forme dérivée
export function revealsTheme(text, label) {
  const stems = themeStems(label)
  return gridTokens(text).some(token => stems.some(stem => token.startsWith(stem)))
}

const err = (rule, message) => ({ rule, message })
const isLetter = (l) => typeof l === 'string' && /^[A-Z]$/.test(l)

// Ordre affiché d'une étape : lettre déjà placée (SIL-CP) puis tuiles
const shownOrder = (step) => (step.firstLetter ?? '') + step.tiles.join('')

export function validatePath(path, { vocabulary = null, themes = THEMES_MYSTERES, blockedWords = BLOCKED_WORDS } = {}) {
  const errors = []
  if (!path || typeof path !== 'object' || !Array.isArray(path.steps) || !path.final || typeof path.final !== 'object') {
    return [err('forme', 'parcours illisible')]
  }
  const settings = ANAGRAM_SETTINGS[path.level]
  if (!settings) errors.push(err('forme', `niveau inconnu : ${path.level}`))
  if (!['fr', 'en'].includes(path.language)) errors.push(err('forme', `langue inconnue : ${path.language}`))
  if (!GENERATED_GAMES.includes(path.game) && !PRESET_GAMES.includes(path.game)) errors.push(err('forme', `jeu non disponible : ${path.game}`))
  if (path.steps.length === 0) errors.push(err('forme', 'aucune étape'))
  if (!['generated', 'draft', 'validated'].includes(path.status)) errors.push(err('forme', `statut inconnu : ${path.status}`))
  if (errors.length > 0) return errors

  const { extraction, final } = path
  const isWordGame = path.game === 'mysteryWord'
  const isCodeGame = path.game === 'codedMessage'
  // Jeux 1 et 5 : chaque étape donne une lettre
  const isLetterGame = LETTER_GAMES.includes(path.game)
  // Jeux 2 et 3 : parcours préconçus (§6.3)
  const isPreset = PRESET_GAMES.includes(path.game)
  const blocked = normalizeBlocked(blockedWords)

  // Une seule règle d'extraction, adaptée au jeu ; règle 8 : jamais « first » en SIL-CP
  if (isLetterGame) {
    if (!allowedRules(path.level).includes(extraction?.rule)) {
      errors.push(err('6.1.8', `règle d'extraction « ${extraction?.rule} » interdite en ${path.level}`))
    }
    if (isWordGame && final.kind !== 'word') errors.push(err('forme', 'le mot mystère se résout par un mot'))
    if (isCodeGame && final.kind !== 'code') errors.push(err('forme', 'le message codé se résout par un décodage'))
  } else if (isPreset) {
    // Jeu 2 : chaque étape donne une syllabe, finale par syllabes ; jeu 3 :
    // chaque étape donne un mot, finale par phrase. La règle 8 (pas de 1re
    // lettre en SIL-CP) n'est pas étendue aux syllabes (décision I14).
    const syllables = path.game === 'syllables'
    if (extraction?.rule !== (syllables ? 'syllable' : 'word')) errors.push(err('forme', 'règle d\'extraction incohérente avec le jeu'))
    if (final.kind !== (syllables ? 'syllables' : 'sentence')) errors.push(err('forme', 'résolution finale incohérente avec le jeu'))
    // Un parcours préconçu est rédigé (draft) ou validé par un enseignant (validated), jamais « generated » (§6.3, règle 3)
    if (!PRESET_STATUSES.includes(path.status)) errors.push(err('forme', `statut d'un parcours préconçu : ${path.status}`))
  } else {
    if (extraction?.rule !== 'word') errors.push(err('forme', 'le mystère des thèmes gagne des mots'))
    if (final.kind !== 'choice') errors.push(err('forme', 'le mystère des thèmes se résout par un choix'))
  }
  if (errors.length > 0) return errors

  const keys = new Set()
  path.steps.forEach((step, n) => {
    const where = `étape ${n + 1}`
    if (!step || typeof step.word !== 'string' || !Array.isArray(step.tiles) || !Array.isArray(step.answers) || step.answers.length === 0) {
      errors.push(err('forme', `${where} illisible`))
      return
    }
    // Règle 1 : mêmes lettres que chaque réponse, mélange différent, 3 lettres minimum
    const shown = shownOrder(step)
    if (step.word.length < MIN_WORD_LENGTH) errors.push(err('6.1.1', `${where} : moins de ${MIN_WORD_LENGTH} lettres`))
    if (!step.tiles.every(isLetter)) errors.push(err('6.1.1', `${where} : tuiles invalides`))
    if (!step.answers.some(a => a.word === step.word)) errors.push(err('6.1.1', `${where} : le mot n'est pas parmi les réponses`))
    for (const a of step.answers) {
      if (letterKey(shown) !== letterKey(a.word)) errors.push(err('6.1.1', `${where} : lettres différentes de ${a.word}`))
      if (shown === a.word) errors.push(err('6.1.1', `${where} : le mélange redonne ${a.word}`))
    }
    const expectedFirst = settings.firstLetterGiven ? step.word[0] : null
    if ((step.firstLetter ?? null) !== expectedFirst) errors.push(err('6.1.1', `${where} : lettre placée incorrecte`))
    if (expectedFirst !== null && step.answers.some(a => a.word[0] !== expectedFirst)) {
      errors.push(err('6.1.1', `${where} : réponse acceptée qui ne commence pas par la lettre placée`))
    }

    // Règle 2 : toutes les réponses acceptées donnent le même élément secret
    if (isLetterGame) {
      const index = secretIndexFor(step.word, extraction, step.secretIndex)
      if (index === null || index !== step.secretIndex) errors.push(err('6.1.2', `${where} : position du secret incohérente avec la règle`))
      // Règle 8 : en SIL-CP, la lettre secrète n'est jamais la lettre déjà placée
      if (settings.firstLetterGiven && step.secretIndex === 0) errors.push(err('6.1.8', `${where} : secret sur la lettre déjà placée`))
    }
    for (const a of step.answers) {
      // Parcours préconçus : syllabe à la même place (jeu 2), mot lui-même (jeu 3)
      const same = isPreset
        ? presetElement(a, step, path.game) === normalizeWord(String(step.secret ?? '')) && normalizeWord(String(step.secret ?? '')) !== ''
        : extractSecret(a, extraction, step.secretIndex) === step.secret
      if (!same) errors.push(err('6.1.2', `${where} : ${a.word} donnerait un autre élément secret`))
    }
    if (isPreset) validatePresetStep(path, step, where, errors)

    // Règle 3 : jamais deux mots aux mêmes lettres
    const key = letterKey(step.word)
    if (keys.has(key)) errors.push(err('6.1.3', `${where} : mêmes lettres qu'une autre étape`))
    keys.add(key)

    // Règle 7 : mots interdits (mélange, tuiles, mot)
    if (containsBlocked(shown, blocked) || containsBlocked(step.tiles.join(''), blocked) || containsBlocked(step.word, blocked)) {
      errors.push(err('6.1.7', `${where} : mot interdit`))
    }
  })
  if (errors.length > 0) return errors

  if (isWordGame) validateWordFinal(path, keys, blocked, errors)
  else if (isCodeGame) validateCodeFinal(path, keys, blocked, errors)
  else if (path.game === 'syllables') validateSyllableFinal(path, keys, blocked, errors)
  else if (path.game === 'secretSentence') validateSentenceFinal(path, blocked, errors)
  else validateChoiceFinal(path, errors)

  if (vocabulary && isPreset) validatePresetVocabulary(path, vocabulary, errors)
  else if (vocabulary) validateGenerated(path, { vocabulary, themes }, errors)
  return errors
}

// --- Parcours préconçus (jeux 2 et 3, §6.3 ; lot 3, partie 1) ---

const isText = (v) => typeof v === 'string' && v.trim() !== ''
const sameList = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())

// Étape préconçue (§6.3, règle 1) : elle porte sa définition et ses réponses ;
// ses mots peuvent être absents du vocabulaire
function validatePresetStep(path, step, where, errors) {
  const lengths = presetLengths(path.game, path.level)
  if (!isText(step.id)) errors.push(err('6.3.1', `${where} : identifiant absent`))
  if (!isText(step.definition)) errors.push(err('6.3.1', `${where} : définition absente`))
  else if (definitionRevealsWord(step.definition, step.word)) errors.push(err('6.1.6', `${where} : la définition donne le mot ${step.word}`))
  if (typeof step.display !== 'string' || normalizeWord(step.display) !== step.word) errors.push(err('6.3.1', `${where} : orthographe incohérente`))
  if (step.word.length < lengths.minLength || step.word.length > lengths.maxLength) {
    errors.push(err('6.3.1', `${where} : ${step.word} hors des longueurs du niveau (${lengths.minLength} à ${lengths.maxLength} lettres)`))
  }
  if (step.wordId !== null && !isText(step.wordId)) errors.push(err('6.3.1', `${where} : identifiant du vocabulaire invalide`))
  if (path.game !== 'syllables') return
  // Jeu 2 : la syllabation redonne le mot, et la syllabe donnée est une de ses
  // syllabes, à la place indiquée par secretIndex
  const syllables = Array.isArray(step.syllables) ? step.syllables : []
  if (syllables.length < 2 || !syllables.every(isText) || normalizeWord(syllables.join('')) !== step.word) {
    errors.push(err('J2', `${where} : syllabation incohérente avec le mot ${step.word}`))
    return
  }
  let start = 0
  const places = syllables.map(s => {
    const place = { start, letters: normalizeWord(s) }
    start += place.letters.length
    return place
  })
  if (!places.some(p => p.start === step.secretIndex && p.letters === normalizeWord(String(step.secret ?? '')))) {
    errors.push(err('J2', `${where} : la syllabe donnée n'est pas une syllabe du mot à cette place`))
  }
}

// Jeu 2 : résolution finale, remettre les syllabes (étiquettes) dans l'ordre
function validateSyllableFinal(path, keys, blocked, errors) {
  const { final, steps } = path
  const solution = final.solution
  if (typeof solution !== 'string' || !/^[A-Z]+$/.test(solution) || solution.length < MIN_WORD_LENGTH) {
    errors.push(err('forme', 'mot mystère invalide'))
    return
  }
  // Règle 3 : le mot mystère n'a pas les mêmes lettres qu'un mot d'étape
  if (keys.has(letterKey(solution))) errors.push(err('6.1.3', 'le mot mystère a les mêmes lettres qu\'un mot d\'étape'))
  // Règle 4 : une étape par syllabe du mot mystère, à un rang distinct
  const slots = steps.map(s => s.slot)
  if (!slots.every(n => Number.isInteger(n) && n >= 0 && n < steps.length) || new Set(slots).size !== slots.length) {
    errors.push(err('6.1.4', 'rangs des syllabes incohérents'))
    return
  }
  // J2 : les syllabes collées dans l'ordre forment le mot mystère
  const ordered = [...steps].sort((a, b) => a.slot - b.slot).map(s => normalizeWord(s.secret))
  if (ordered.join('') !== solution) errors.push(err('J2', 'les syllabes, dans l\'ordre, ne forment pas le mot mystère'))
  if (!Array.isArray(final.syllables) || final.syllables.map(s => normalizeWord(String(s))).join('|') !== ordered.join('|')) {
    errors.push(err('J2', 'syllabation du mot mystère différente des syllabes gagnées'))
  }
  // Étiquettes : les syllabes gagnées, dans l'ordre des étapes, qui ne
  // redonnent pas le mot mystère (règle 1 : mélange différent de la réponse)
  const labels = Array.isArray(final.labels) ? final.labels : []
  if (JSON.stringify(labels) !== JSON.stringify(steps.map(s => s.secret))) errors.push(err('forme', 'étiquettes différentes des syllabes gagnées'))
  if (normalizeWord(labels.join('')) === solution) errors.push(err('6.1.1', 'les syllabes gagnées donnent déjà le mot mystère dans l\'ordre'))
  // Règle 5 : une seule réponse, le mot mystère
  const accepted = Array.isArray(final.acceptedAnswers) ? final.acceptedAnswers : []
  if (accepted.length !== 1 || accepted[0]?.word !== solution || normalizeWord(String(accepted[0]?.display ?? '')) !== solution ||
    normalizeWord(String(final.display ?? '')) !== solution) {
    errors.push(err('6.1.5', 'une seule réponse acceptée : le mot mystère'))
  }
  // Règle 6 : ni définition d'étape ni indice ne donne le mot mystère
  for (const [n, step] of steps.entries()) {
    if (definitionRevealsWord(step.definition, solution)) errors.push(err('6.1.6', `étape ${n + 1} : la définition donne le mot mystère`))
  }
  const hints = Array.isArray(final.hints) ? final.hints : []
  if (hints.length === 0 || !hints.every(isText)) errors.push(err('forme', 'indices de la finale absents'))
  for (const hint of hints) {
    if (definitionRevealsWord(hint, solution)) errors.push(err('6.1.6', 'un indice donne le mot mystère'))
  }
  // Règle 7 : mots interdits dans le mot mystère et dans les syllabes collées
  if (containsBlocked(solution, blocked) || containsBlocked(normalizeWord(labels.join('')), blocked)) errors.push(err('6.1.7', 'mot interdit dans le mot mystère'))
}

// Jeu 3 : résolution finale, remettre les étiquettes de mots dans l'ordre
function validateSentenceFinal(path, blocked, errors) {
  const { final, steps } = path
  const words = typeof final.solution === 'string' ? final.solution.split(' ') : []
  if (words.length === 0 || !words.every(w => /^[A-Z]+$/.test(w)) || typeof final.display !== 'string' || labelWords([final.display]) !== final.solution) {
    errors.push(err('forme', 'phrase de référence invalide'))
    return
  }
  // J3 : chaque mot trouvé est à sa place dans la phrase ; mots trouvés + mots
  // donnés = exactement les mots de la phrase
  const slots = steps.map(s => s.slot)
  if (!slots.every(n => Number.isInteger(n) && n >= 0 && n < words.length) || new Set(slots).size !== slots.length ||
    steps.some(s => words[s.slot] !== s.word)) {
    errors.push(err('J3', 'un mot trouvé n\'est pas à sa place dans la phrase'))
  }
  // Mots donnés : toujours un tableau (éventuellement vide), sinon l'écran
  // planterait à la reprise d'une partie enregistrée altérée
  if (!Array.isArray(final.given)) errors.push(err('forme', 'mots donnés absents'))
  const given = Array.isArray(final.given) ? final.given : []
  if (!given.every(isText) || !sameList([...steps.map(s => s.word), ...given.map(g => normalizeWord(g))], words)) {
    errors.push(err('J3', 'mots trouvés et mots donnés ne forment pas exactement la phrase'))
  }
  // Étiquettes : un mot chacune, les mots trouvés et les mots donnés ; en
  // capitales hors SIL-CP (décision I5)
  const labels = Array.isArray(final.labels) ? final.labels : []
  if (!labels.every(l => typeof l === 'string' && normalizeWord(l) !== '') || !sameList(labels, [...steps.map(s => s.secret), ...given])) {
    errors.push(err('J3', 'étiquettes différentes des mots trouvés et des mots donnés'))
  }
  if (path.level !== 'SIL-CP' && !labels.every(l => typeof l === 'string' && l === l.toLocaleUpperCase('fr-FR'))) {
    errors.push(err('J3', 'étiquettes en capitales attendues (I5)'))
  }
  // J3 et règle 5 : phrases acceptées listées, la phrase de référence comprise,
  // chacune avec exactement les mêmes mots
  const accepted = Array.isArray(final.acceptedAnswers) ? final.acceptedAnswers : []
  if (!accepted.some(a => a?.word === final.solution)) errors.push(err('6.1.5', 'la phrase de référence n\'est pas parmi les phrases acceptées'))
  if (new Set(accepted.map(a => a?.word)).size !== accepted.length) errors.push(err('6.1.5', 'phrase acceptée en double'))
  for (const a of accepted) {
    if (typeof a?.display !== 'string' || a.word !== labelWords([a.display])) {
      errors.push(err('J3', 'phrase acceptée incohérente avec son texte'))
    } else if (!sameList(a.word.split(' '), words)) {
      errors.push(err('J3', `phrase acceptée qui n'utilise pas exactement les mêmes mots : ${a.display}`))
    }
  }
  // Règle 1 : les étiquettes, dans l'ordre affiché, ne forment aucune phrase acceptée
  if (accepted.some(a => a?.word === labelWords(labels))) errors.push(err('6.1.1', 'les étiquettes donnent déjà la phrase dans l\'ordre'))
  // Règle 6 : aucune définition ne contient un autre mot à trouver de la phrase.
  // Les indices du jeu 3 donnent volontairement le premier mot et le verbe (I9).
  for (const [n, step] of steps.entries()) {
    for (const other of steps) {
      if (other !== step && definitionRevealsWord(step.definition, other.word)) {
        errors.push(err('6.1.6', `étape ${n + 1} : la définition donne le mot ${other.word}`))
      }
    }
  }
  const hints = Array.isArray(final.hints) ? final.hints : []
  if (hints.length === 0 || !hints.every(isText)) errors.push(err('forme', 'indices de la finale absents'))
  // Règle 7 : mots interdits dans la phrase
  if (accepted.some(a => typeof a?.word === 'string' && (containsBlocked(a.word.replace(/ /g, ''), blocked) || a.word.split(' ').some(w => containsBlocked(w, blocked))))) {
    errors.push(err('6.1.7', 'mot interdit dans la phrase'))
  }
}

// Parcours préconçus contrôlés avec le vocabulaire : identifiants du
// vocabulaire cohérents (même niveau, même langue, même orthographe) et
// anagrammes du vocabulaire toutes acceptées (D9)
function validatePresetVocabulary(path, vocabulary, errors) {
  const { level, language } = path
  const byId = new Map(vocabulary.filter(v => v && typeof v === 'object').map(v => [v.id, v]))
  const index = buildAnswerIndex(vocabulary, level, language)
  const settings = ANAGRAM_SETTINGS[level]
  const linked = (id, word) => {
    const v = byId.get(id)
    return Boolean(v) && v.niveau_fr === level && v.actif !== false && typeof entryText(v, language) === 'string' &&
      normalizeWord(entryText(v, language)) === word
  }
  for (const [n, step] of path.steps.entries()) {
    const where = `étape ${n + 1}`
    if (step.wordId !== null && !linked(step.wordId, step.word)) {
      errors.push(err('6.3.1', `${where} : ${step.wordId} n'est pas ${step.word} dans le vocabulaire du niveau et de la langue`))
    }
    for (const a of step.answers) {
      if (a.id !== null && a.id !== undefined && !linked(a.id, a.word)) errors.push(err('6.3.1', `${where} : réponse ${a.word} reliée à ${a.id}, incohérent`))
    }
    const missing = (index.get(letterKey(step.word)) ?? [])
      .filter(a => !settings.firstLetterGiven || a.word[0] === step.word[0])
      .filter(a => !step.answers.some(b => b.word === a.word))
    for (const a of missing) errors.push(err('D9', `${where} : anagramme du vocabulaire non acceptée : ${a.word} (${a.id})`))
  }
  if (path.game === 'syllables') {
    const answer = path.final.acceptedAnswers[0]
    if (answer.id !== null && answer.id !== undefined && !linked(answer.id, path.final.solution)) {
      errors.push(err('6.3.1', `mot mystère relié à ${answer.id}, incohérent`))
    }
  }
}

// Jeu 1 : résolution finale par un mot
function validateWordFinal(path, keys, blocked, errors) {
  const { final } = path
  const solution = final.solution
  if (typeof solution !== 'string' || !/^[A-Z]+$/.test(solution) || solution.length < MIN_WORD_LENGTH) {
    errors.push(err('forme', 'mot mystère invalide'))
    return
  }
  // Règle 3 : le mot mystère n'a pas les mêmes lettres qu'un mot d'étape
  if (keys.has(letterKey(solution))) errors.push(err('6.1.3', 'le mot mystère a les mêmes lettres qu\'un mot d\'étape'))
  // Règle 4 : les éléments reconstituent la solution, dans l'ordre défini
  if (path.steps.length !== solution.length) errors.push(err('6.1.4', 'une étape par lettre du mot mystère'))
  if (assembleSolution(path) !== solution) errors.push(err('6.1.4', 'les lettres gagnées ne reconstituent pas le mot mystère'))
  // La résolution finale est elle-même une anagramme : les lettres gagnées,
  // dans l'ordre des étapes, ne donnent aucune bonne réponse
  const collected = finalTiles(path).join('')
  // Règle 5 : solution unique, ou variantes listées
  const accepted = Array.isArray(final.acceptedAnswers) ? final.acceptedAnswers : []
  if (!accepted.some(a => a.word === solution)) errors.push(err('6.1.5', 'la solution n\'est pas parmi les réponses acceptées'))
  for (const a of accepted) {
    if (letterKey(a.word) !== letterKey(solution)) errors.push(err('6.1.5', `réponse acceptée aux lettres différentes : ${a.word}`))
    if (collected === a.word) errors.push(err('6.1.1', 'les lettres gagnées donnent déjà le mot mystère dans l\'ordre'))
  }
  // Règle 6 : ni définition d'étape ni indice ne contient la solution
  for (const [n, step] of path.steps.entries()) {
    for (const a of accepted) {
      if (definitionRevealsWord(step.definition, a.word)) errors.push(err('6.1.6', `étape ${n + 1} : la définition donne le mot mystère`))
    }
  }
  for (const hint of final.hints ?? []) {
    for (const a of accepted) {
      if (definitionRevealsWord(hint, a.word)) errors.push(err('6.1.6', 'un indice donne le mot mystère'))
    }
  }
  // Règle 7 : mots interdits dans la solution et dans le « message » (lettres gagnées)
  if (containsBlocked(solution, blocked) || containsBlocked(collected, blocked)) errors.push(err('6.1.7', 'mot interdit dans le mot mystère'))
}

// Jeu 5 : résolution finale par le décodage d'un mot avec la clé complète (C1 à C4)
function validateCodeFinal(path, keys, blocked, errors) {
  const { final } = path
  const solution = final.solution
  if (typeof solution !== 'string' || !/^[A-Z]+$/.test(solution) || solution.length < MIN_WORD_LENGTH) {
    errors.push(err('forme', 'mot codé invalide (lettres sans accents, 3 au moins)'))
    return
  }
  const letters = [...new Set(solution)]
  if (letters.length < 2) errors.push(err('forme', 'le mot codé doit avoir au moins 2 lettres différentes'))
  // Règle 3 : le mot codé n'a pas les mêmes lettres qu'un mot d'étape
  if (keys.has(letterKey(solution))) errors.push(err('6.1.3', 'le mot codé a les mêmes lettres qu\'un mot d\'étape'))

  // Clé (C1, C3) : une ligne par étape, nombres entiers distincts de 1 à
  // CODE_MAX_NUMBER, lettres distinctes ; une étape par lettre distincte du mot
  const codes = path.steps.map(s => s.code)
  if (!codes.every(n => Number.isInteger(n) && n >= 1 && n <= CODE_MAX_NUMBER)) {
    errors.push(err('6.2.4', `nombres de la clé hors de 1 à ${CODE_MAX_NUMBER}`))
  }
  if (new Set(codes).size !== codes.length) errors.push(err('6.2.4', 'deux lignes de la clé ont le même nombre'))
  const secrets = path.steps.map(s => s.secret)
  if (new Set(secrets).size !== secrets.length) errors.push(err('6.2.4', 'deux lignes de la clé ont la même lettre'))
  // Règle 4 : toutes les lettres du mot ont leur ligne de clé, et seulement elles
  if (path.steps.length !== letters.length || !letters.every(l => secrets.includes(l))) {
    errors.push(err('6.1.4', 'une étape (ligne de clé) par lettre différente du mot codé'))
  }
  // Règle 6.2.4 : une seule lecture du message. Chaque nombre correspond à une
  // seule ligne de la clé, et la lecture redonne le mot codé.
  const message = Array.isArray(final.message) ? final.message : []
  if (message.length !== solution.length) errors.push(err('6.2.4', 'un nombre par lettre du mot codé'))
  if (!message.every(n => codes.filter(c => c === n).length === 1)) errors.push(err('6.2.4', 'un nombre du message n\'a pas exactement une ligne de clé'))
  if (decodeMessage(path) !== solution) errors.push(err('6.2.4', 'le message décodé ne redonne pas le mot codé'))

  // Les lettres gagnées, dans l'ordre des étapes, ne donnent pas le mot
  const collected = secrets.join('')
  if (collected === solution) errors.push(err('6.1.1', 'les lettres gagnées donnent déjà le mot codé dans l\'ordre'))
  // Règle 5 : une seule réponse, le mot codé (pas ses anagrammes)
  const accepted = Array.isArray(final.acceptedAnswers) ? final.acceptedAnswers : []
  if (accepted.length !== 1 || accepted[0]?.word !== solution) errors.push(err('6.1.5', 'une seule réponse acceptée : le mot codé'))
  if (typeof final.display !== 'string' || normalizeWord(final.display) !== solution) errors.push(err('6.1.5', 'orthographe exacte du mot codé incohérente'))
  // Règle 6 : aucune définition d'étape ne donne le mot codé
  for (const [n, step] of path.steps.entries()) {
    if (definitionRevealsWord(step.definition, solution)) errors.push(err('6.1.6', `étape ${n + 1} : la définition donne le mot codé`))
  }
  // Indices : des lettres du mot, distinctes. Le moteur en limite le nombre
  // (finalHintLimit) pour qu'il reste toujours au moins une lettre à décoder.
  if (!Array.isArray(final.hints) || !final.hints.every(h => letters.includes(h)) || new Set(final.hints).size !== final.hints.length) {
    errors.push(err('6.1.6', 'indices : lettres du mot codé, distinctes'))
  }
  // Règle 7 : mots interdits dans le mot codé et dans les lettres gagnées
  if (containsBlocked(solution, blocked) || containsBlocked(collected, blocked)) errors.push(err('6.1.7', 'mot interdit dans le mot codé'))
}

// Jeu 4 : résolution finale par un choix parmi 4 propositions (M6)
function validateChoiceFinal(path, errors) {
  const { final } = path
  const options = Array.isArray(final.options) ? final.options : []
  // Règle 4 : chaque étape donne un élément
  for (const [n, step] of path.steps.entries()) {
    if (typeof step.secret !== 'string' || step.secret === '') errors.push(err('6.1.4', `étape ${n + 1} : aucun élément gagné`))
  }
  // Règle 5 : une seule bonne proposition parmi 4 distinctes
  const normalized = options.map(o => gridTokens(o).join(' '))
  if (options.length !== 4 || new Set(normalized).size !== 4) errors.push(err('6.1.5', '4 propositions distinctes attendues'))
  if (options.filter(o => o === final.solution).length !== 1) errors.push(err('6.1.5', 'la bonne réponse doit figurer une seule fois'))
  if (!Array.isArray(final.acceptedAnswers) || final.acceptedAnswers.length !== 1 || final.acceptedAnswers[0].display !== final.solution) {
    errors.push(err('6.1.5', 'une seule réponse acceptée : le thème'))
  }
  // Règle 6 : ni définition, ni mot d'étape, ni indice ne donne le thème
  for (const [n, step] of path.steps.entries()) {
    if (revealsTheme(step.definition, final.solution)) errors.push(err('6.1.6', `étape ${n + 1} : la définition donne le thème`))
    if (revealsTheme(step.word, final.solution) || wordInLabel(step.word, final.solution)) {
      errors.push(err('6.2.3', `étape ${n + 1} : le mot reprend le nom du thème`))
    }
  }
  // Indices progressifs : propositions fausses à éliminer, jamais la bonne
  for (const hint of final.hints ?? []) {
    if (!options.includes(hint) || hint === final.solution || revealsTheme(hint, final.solution)) {
      errors.push(err('6.1.6', `indice invalide : ${hint}`))
    }
  }
}

// Parcours générés (§6.2) : contrôle contre le vocabulaire
function validateGenerated(path, { vocabulary, themes }, errors) {
  const { level, language } = path
  const definitionField = language === 'en' ? 'def_en' : 'def_fr'
  const byId = new Map(vocabulary.filter(v => v && typeof v === 'object').map(v => [v.id, v]))
  const index = buildAnswerIndex(vocabulary, level, language)
  const settings = ANAGRAM_SETTINGS[level]

  // Règle 1 : chaque mot d'étape est présent et actif, bon niveau, bonne langue,
  // définition qui ne donne pas la réponse ; toutes les anagrammes du
  // vocabulaire sont acceptées (D9)
  for (const [n, step] of path.steps.entries()) {
    const where = `étape ${n + 1}`
    const v = byId.get(step.id)
    if (!v || v.niveau_fr !== level || v.actif === false || typeof entryText(v, language) !== 'string' ||
      normalizeWord(entryText(v, language)) !== step.word) {
      errors.push(err('6.2.1', `${where} : ${step.word} absent du vocabulaire du niveau et de la langue`))
      continue
    }
    const definition = typeof v[definitionField] === 'string' ? v[definitionField].trim() : ''
    if (definition === '' || definition !== step.definition || definitionRevealsWord(definition, step.word)) {
      errors.push(err('6.2.1', `${where} : définition absente, différente ou qui donne la réponse`))
    }
    const expected = (index.get(letterKey(step.word)) ?? [])
      .filter(a => !settings.firstLetterGiven || a.word[0] === step.word[0])
      .map(a => a.word).sort()
    const actual = step.answers.map(a => a.word).sort()
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      errors.push(err('6.2.1', `${where} : réponses acceptées différentes des anagrammes du vocabulaire`))
    }
  }

  if (path.game === 'mysteryWord') {
    // Règle 2 : la solution est un mot du vocabulaire du niveau, différent de
    // chaque réponse ; ses anagrammes du vocabulaire sont toutes acceptées
    const solution = path.final.solution
    const group = index.get(letterKey(solution)) ?? []
    if (!group.some(a => a.word === solution)) errors.push(err('6.2.2', `mot mystère ${solution} absent du vocabulaire du niveau`))
    const accepted = path.final.acceptedAnswers.map(a => a.word).sort()
    if (JSON.stringify(group.map(a => a.word).sort()) !== JSON.stringify(accepted)) {
      errors.push(err('6.1.5', 'les anagrammes du mot mystère dans le vocabulaire ne sont pas toutes acceptées'))
    }
    for (const step of path.steps) {
      if (step.answers.some(a => a.word === solution)) errors.push(err('6.2.2', 'le mot mystère est une réponse d\'étape'))
    }
    return
  }

  if (path.game === 'codedMessage') {
    // Jeu 5 (C4) : le mot codé est un mot du vocabulaire du niveau et de la
    // langue (même entrée, même orthographe), différent de chaque réponse
    const solution = path.final.solution
    const answer = Array.isArray(path.final.acceptedAnswers) ? path.final.acceptedAnswers[0] : null
    const v = byId.get(answer?.id)
    if (!v || v.niveau_fr !== level || v.actif === false || typeof entryText(v, language) !== 'string' ||
      normalizeWord(entryText(v, language)) !== solution || entryText(v, language) !== path.final.display) {
      errors.push(err('6.2.2', `mot codé ${solution} absent du vocabulaire du niveau et de la langue`))
    }
    for (const step of path.steps) {
      if (step.answers.some(a => a.word === solution)) errors.push(err('6.2.2', 'le mot codé est une réponse d\'étape'))
    }
    return
  }

  // Règle 3 (jeu 4) : thème et propositions fausses de la liste fixe ; mots du thème
  const theme = (themes?.[level] ?? []).find(th => th.id === path.theme)
  if (!theme) {
    errors.push(err('6.2.3', `thème ${path.theme} absent de la liste fixe du niveau`))
    return
  }
  if (path.final.solution !== theme.label[language]) errors.push(err('6.2.3', 'nom du thème différent de la liste fixe'))
  const expectedOptions = [theme.label[language], ...theme.distractors.map(d => d[language])].sort()
  if (JSON.stringify([...path.final.options].sort()) !== JSON.stringify(expectedOptions)) {
    errors.push(err('6.2.3', 'propositions différentes de la liste fixe'))
  }
  if (!THEME_STATUSES.includes(theme.status)) errors.push(err('6.2.3', `statut de thème inconnu : ${theme.status}`))
  if (path.themeStatus !== theme.status) errors.push(err('6.2.3', 'statut du thème différent de la liste fixe'))
  // R3 : propositions fausses = libellés d'autres thèmes du même niveau
  const sameLevel = (themes[level] ?? []).filter(th => th.id !== theme.id)
  for (const d of theme.distractors) {
    if (!sameLevel.some(th => th.label.fr === d.fr && th.label.en === d.en)) {
      errors.push(err('6.2.3', `proposition fausse hors des thèmes du niveau : ${d[language]}`))
    }
  }
  const excluded = new Set((theme.excludedWords?.[language] ?? []).map(normalizeWord))
  for (const [n, step] of path.steps.entries()) {
    const v = byId.get(step.id)
    if (v && !theme.sujets.includes(v.sujet)) errors.push(err('6.2.3', `étape ${n + 1} : ${step.word} hors des sujets du thème`))
    if (excluded.has(step.word)) errors.push(err('6.2.3', `étape ${n + 1} : ${step.word} est un mot écarté du thème`))
  }
}

export const isValidPath = (path, context) => validatePath(path, context).length === 0

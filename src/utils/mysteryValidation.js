// Règles de validation des anagrammes mystères (docs/anagrammes-mysteres.md,
// §6). Un parcours qui échoue à l'une d'elles n'est JAMAIS montré : les
// générateurs le rejettent, l'écran le revérifie avant affichage et à la reprise.
//
// validatePath(path, context) renvoie la liste des erreurs ({ rule, message }),
// vide si le parcours est valide.
// - Sans `vocabulary` : règles communes du §6.1 (forme du parcours). C'est le
//   contrôle fait à la reprise : le parcours enregistré est complet, il ne
//   dépend pas du vocabulaire (un import local peut l'avoir changé depuis).
// - Avec `vocabulary` : en plus, règles des parcours générés du §6.2.

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
import { GENERATED_GAMES, allowedRules, assembleSolution, extractSecret, secretIndexFor, finalTiles } from './mysteryEngine.js'
import { THEMES_MYSTERES, THEME_STATUSES } from '../data/themes-mysteres.js'

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
  if (!GENERATED_GAMES.includes(path.game)) errors.push(err('forme', `jeu non disponible : ${path.game}`))
  if (path.steps.length === 0) errors.push(err('forme', 'aucune étape'))
  if (!['generated', 'draft', 'validated'].includes(path.status)) errors.push(err('forme', `statut inconnu : ${path.status}`))
  if (errors.length > 0) return errors

  const { extraction, final } = path
  const isWordGame = path.game === 'mysteryWord'
  const blocked = normalizeBlocked(blockedWords)

  // Une seule règle d'extraction, adaptée au jeu ; règle 8 : jamais « first » en SIL-CP
  if (isWordGame) {
    if (!allowedRules(path.level).includes(extraction?.rule)) {
      errors.push(err('6.1.8', `règle d'extraction « ${extraction?.rule} » interdite en ${path.level}`))
    }
    if (final.kind !== 'word') errors.push(err('forme', 'le mot mystère se résout par un mot'))
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
    if (isWordGame) {
      const index = secretIndexFor(step.word, extraction, step.secretIndex)
      if (index === null || index !== step.secretIndex) errors.push(err('6.1.2', `${where} : position du secret incohérente avec la règle`))
      // Règle 8 : en SIL-CP, la lettre secrète n'est jamais la lettre déjà placée
      if (settings.firstLetterGiven && step.secretIndex === 0) errors.push(err('6.1.8', `${where} : secret sur la lettre déjà placée`))
    }
    for (const a of step.answers) {
      if (extractSecret(a, extraction, step.secretIndex) !== step.secret) {
        errors.push(err('6.1.2', `${where} : ${a.word} donnerait un autre élément secret`))
      }
    }

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
  else validateChoiceFinal(path, errors)

  if (vocabulary) validateGenerated(path, { vocabulary, themes }, errors)
  return errors
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

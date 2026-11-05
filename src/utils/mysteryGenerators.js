// Générateurs des anagrammes mystères (lot 1 : jeu 1 « Mot mystère » et
// jeu 4 « Mystère des thèmes » ; lot 2 : jeu 5 « Message codé » ;
// docs/anagrammes-mysteres.md §3, §5, §6, §12).
// Module pur. Même graine + même niveau + même langue + même vocabulaire (et
// même thème pour le jeu 4) = même parcours. Chaque parcours produit est
// contrôlé par validatePath (avec le vocabulaire) : un parcours invalide n'est
// jamais renvoyé ; à défaut de parcours valide, le générateur renvoie null.
//
// Les étapes réutilisent createAnagramItem : même mélange, mêmes réponses
// acceptées (toutes les anagrammes du vocabulaire, D9), mêmes longueurs de
// mots par niveau que les anagrammes classiques.

import { normalizeWord, createRandom } from './wordSearchGenerator.js'
import { BLOCKED_WORDS, entryText, isValidSeed } from './wordSearchGame.js'
import {
  ANAGRAM_SETTINGS,
  MIN_WORD_LENGTH,
  buildAnswerIndex,
  containsBlocked,
  createAnagramItem,
  definitionRevealsWord,
  gridTokens,
  letterKey,
  listAnagramCandidates,
  normalizeBlocked,
  shuffled
} from './anagramGame.js'
import { MYSTERY_FORMAT_VERSION, CODE_MAX_NUMBER, allowedRules, secretIndexFor } from './mysteryEngine.js'
import { validatePath, revealsTheme, wordInLabel } from './mysteryValidation.js'
import { THEMES_MYSTERES } from '../data/themes-mysteres.js'
import { generatePresetPath } from './mysteryPresets.js'

// Réglages du jeu 1 par niveau. CHOIX PROVISOIRES, à valider par un enseignant :
// longueur du mot mystère (= nombre d'étapes) ; positions possibles pour la
// règle « position » (2e ou 3e lettre). Le jeu 5 reprend les mêmes longueurs
// pour son mot codé (décision C4 du 2026-11-04 ; CHOIX PROVISOIRE aussi).
export const MYSTERY_WORD_SETTINGS = Object.freeze({
  'SIL-CP': Object.freeze({ minLength: 3, maxLength: 5, positions: Object.freeze([2, 3]) }),
  'CE1-CE2': Object.freeze({ minLength: 4, maxLength: 6, positions: Object.freeze([2, 3]) }),
  'CM1-CM2': Object.freeze({ minLength: 5, maxLength: 7, positions: Object.freeze([2, 3]) })
})

// Jeu 4 : nombre d'anagrammes par parcours (CHOIX PROVISOIRE, comme les 5 mots
// d'une partie classique)
export const THEME_STEP_COUNT = 5

// Indices progressifs du jeu 4 : 2 propositions fausses éliminées au plus,
// pour qu'il reste toujours un choix à faire
const THEME_HINTS = 2

const pick = (items, random) => items[Math.floor(random() * items.length)]

const roundedDifficulty = (entries) => {
  const values = entries.map(v => v?.difficulte).filter(d => [1, 2, 3].includes(d))
  if (values.length === 0) return 1
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

const FINAL_PROMPTS = {
  mysteryWord: {
    fr: 'Remets les lettres gagnées dans l\'ordre pour écrire le mot mystère.',
    en: 'Put the letters you won in the right order to write the mystery word.'
  },
  theme: {
    fr: 'Quel thème relie tous les mots trouvés ?',
    en: 'Which theme links all the words you found?'
  },
  codedMessage: {
    fr: 'Avec la clé, écris sous chaque nombre la lettre qui lui correspond.',
    en: 'Using the key, write under each number the letter that goes with it.'
  }
}

// Mots mystères possibles : entrées actives du niveau, mot simple dans la
// langue, longueur du jeu 1, au moins 2 lettres différentes (sinon les lettres
// gagnées redonneraient le mot dans tout ordre), définition non vide qui ne
// donne pas le mot (elle sert d'indice). Un seul par mot normalisé.
export function listSolutionCandidates(vocabulary, level, language = 'fr') {
  const { minLength, maxLength } = MYSTERY_WORD_SETTINGS[level]
  const definitionField = language === 'en' ? 'def_en' : 'def_fr'
  const seen = new Set()
  const result = []
  const entries = vocabulary
    .filter(v => v && v.niveau_fr === level && v.actif !== false && typeof entryText(v, language) === 'string')
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
  for (const v of entries) {
    const display = entryText(v, language)
    const word = normalizeWord(display)
    if (word.length < Math.max(MIN_WORD_LENGTH, minLength) || word.length > maxLength) continue
    if (new Set(word).size < 2 || seen.has(word)) continue
    const definition = typeof v[definitionField] === 'string' ? v[definitionField].trim() : ''
    if (definition === '' || definitionRevealsWord(definition, word)) continue
    seen.add(word)
    result.push({ id: v.id, word, display, definition, difficulte: v.difficulte })
  }
  return result
}

// Positions possibles du secret dans un mot pour une lettre donnée : toutes
// les réponses acceptées doivent porter cette lettre à cette position (§6.1,
// règle 2) ; en SIL-CP, jamais la lettre déjà placée (règle 8)
function secretPositions(word, answers, letter, extraction, firstLetterGiven) {
  const indexes = extraction.rule === 'marked'
    ? [...word].map((_, i) => i)
    : [secretIndexFor(word, extraction)].filter(i => i !== null)
  return indexes.filter(i =>
    !(firstLetterGiven && i === 0) &&
    word[i] === letter &&
    answers.every(a => a.word[i] === letter))
}

// Ordre des étapes : les lettres gagnées, dans cet ordre, ne doivent redonner
// aucune bonne réponse (la résolution finale reste une anagramme) ni contenir
// de mot interdit. Tableau des positions du mot mystère, ou null.
function stepOrder(solution, acceptedWords, blocked, random) {
  const identity = [...solution].map((_, i) => i)
  for (let t = 0; t < 50; t++) {
    const order = shuffled(identity, random)
    const collected = order.map(i => solution[i]).join('')
    if (!acceptedWords.has(collected) && !containsBlocked(collected, blocked)) return order
  }
  return null
}

// Étape qui donne la lettre `letter` selon la règle : premier mot du `pool`
// (déjà mélangé) dont les lettres ne sont pas déjà employées (`usedKeys`, mis à
// jour), dont la définition ne donne aucun des `hiddenWords` (règle 6) et dont
// toutes les réponses acceptées portent la lettre à la même position (règle 2).
// Partagée par les jeux 1 et 5 : les tirages sont consommés dans le même ordre
// qu'avant la mise en commun (empreintes de mysteryGenerators.reference.test.js).
function buildLetterStep({ letter, extraction, pool, index, settings, blocked, random, usedKeys, hiddenWords }) {
  for (const c of pool) {
    const key = letterKey(c.word)
    if (usedKeys.has(key)) continue
    if (hiddenWords.some(w => definitionRevealsWord(c.definition, w))) continue
    const group = index.get(key)
    const accepted = group.filter(a => !settings.firstLetterGiven || a.word[0] === c.word[0])
    const positions = secretPositions(c.word, accepted, letter, extraction, settings.firstLetterGiven)
    if (positions.length === 0) continue
    const item = createAnagramItem(c, group, random, { firstLetterGiven: settings.firstLetterGiven, blockedWords: blocked })
    if (item === null) continue
    const secretIndex = extraction.rule === 'marked' ? pick(positions, random) : positions[0]
    usedKeys.add(key)
    return { ...item, secret: letter, secretIndex }
  }
  return null
}

// Tente de construire un parcours de jeu 1 pour un mot mystère et une règle
function buildMysteryWord({ solution, extraction, pool, index, settings, blocked, random }) {
  const solutionKey = letterKey(solution.word)
  const solutionAnswers = index.get(solutionKey) ?? []
  const usedKeys = new Set([solutionKey])
  // Règle 6 : la définition d'étape ne donne pas le mot mystère (ni ses anagrammes)
  const hiddenWords = solutionAnswers.map(a => a.word)
  const steps = []
  for (const [slot, letter] of [...solution.word].entries()) {
    const step = buildLetterStep({ letter, extraction, pool, index, settings, blocked, random, usedKeys, hiddenWords })
    if (step === null) return null
    steps.push({ ...step, slot })
  }
  const order = stepOrder(solution.word, new Set(solutionAnswers.map(a => a.word)), blocked, random)
  if (order === null) return null
  return { steps: order.map(slot => steps[slot]), solutionAnswers }
}

// Jeu 1 : Mot mystère. Renvoie un parcours valide, ou null.
export function generateMysteryWordPath(vocabulary, level, seed, language = 'fr', { blockedWords = BLOCKED_WORDS } = {}) {
  const settings = ANAGRAM_SETTINGS[level]
  if (!settings) throw new RangeError(`generateMysteryWordPath : niveau inconnu (${level})`)
  if (!isValidSeed(seed)) throw new RangeError('generateMysteryWordPath : graine invalide')
  const blocked = normalizeBlocked(blockedWords)
  const index = buildAnswerIndex(vocabulary, level, language)
  const byId = new Map(vocabulary.filter(Boolean).map(v => [v.id, v]))
  const random = createRandom(seed)

  // Ordre des règles et des mots mystères tiré au hasard ; le premier parcours
  // valide est retenu
  const rules = shuffled(allowedRules(level), random)
  const solutions = shuffled(listSolutionCandidates(vocabulary, level, language), random)
    .filter(s => !containsBlocked(s.word, blocked))
  const candidates = listAnagramCandidates(vocabulary, level, language)
  for (const rule of rules) {
    const extraction = rule === 'position'
      ? { rule, position: pick(MYSTERY_WORD_SETTINGS[level].positions, random) }
      : { rule }
    for (const solution of solutions) {
      const pool = shuffled(candidates, random)
      const built = buildMysteryWord({ solution, extraction, pool, index, settings, blocked, random })
      if (built === null) continue
      const path = {
        formatVersion: MYSTERY_FORMAT_VERSION,
        id: `mysteryWord-${language}-${level}-${seed}`,
        game: 'mysteryWord',
        language,
        level,
        seed,
        theme: null,
        difficulty: roundedDifficulty(built.steps.map(s => byId.get(s.id))),
        extraction,
        steps: built.steps,
        final: {
          kind: 'word',
          prompt: FINAL_PROMPTS.mysteryWord[language === 'en' ? 'en' : 'fr'],
          solution: solution.word,
          display: solution.display,
          // Le mot mystère garde son id et son orthographe ; ses anagrammes du
          // vocabulaire sont aussi acceptées (D9)
          acceptedAnswers: built.solutionAnswers.map(a => (a.word === solution.word ? { id: solution.id, word: solution.word, display: solution.display } : a)),
          hints: [solution.definition]
        },
        status: 'generated'
      }
      if (validatePath(path, { vocabulary, blockedWords: blocked }).length === 0) return path
    }
  }
  return null
}

// Tente de construire un parcours de jeu 5 pour un mot codé et une règle :
// une étape par lettre DISTINCTE du mot (C2), puis les nombres de la clé (C1)
function buildCodedMessage({ solution, extraction, pool, index, settings, blocked, random }) {
  const solutionKey = letterKey(solution.word)
  // Règle 3 : aucun mot d'étape n'a les mêmes lettres que le mot codé ni
  // qu'une de ses anagrammes (elles ont la même clé de lettres)
  const usedKeys = new Set([solutionKey])
  // Règle 6 : la définition d'étape ne donne pas le mot codé
  const hiddenWords = [solution.word]
  const letters = [...new Set(solution.word)]
  const steps = []
  for (const letter of letters) {
    const step = buildLetterStep({ letter, extraction, pool, index, settings, blocked, random, usedKeys, hiddenWords })
    if (step === null) return null
    steps.push(step)
  }
  // Ordre des étapes mélangé, comme au jeu 1 : les lettres gagnées, dans
  // l'ordre de la barre, ne redonnent jamais le mot ni un mot interdit
  const order = stepOrder(letters.join(''), new Set([solution.word]), blocked, random)
  if (order === null) return null
  // C1 : un nombre tiré au hasard par lettre distincte, sans répétition
  const numbers = shuffled(Array.from({ length: CODE_MAX_NUMBER }, (_, i) => i + 1), random).slice(0, letters.length)
  const codeOf = new Map(letters.map((l, i) => [l, numbers[i]]))
  return {
    steps: order.map(i => ({ ...steps[i], slot: null, code: codeOf.get(letters[i]) })),
    message: [...solution.word].map(l => codeOf.get(l)),
    // Ordre dans lequel les indices révèlent les lettres (le nombre d'indices
    // est limité par finalHintLimit du moteur)
    hints: shuffled(letters, random)
  }
}

// Jeu 5 : Message codé. Un mot du vocabulaire du niveau (C4 : pas de phrase),
// codé sans accents ; clé complète à tous les niveaux (C3). Renvoie un
// parcours valide, ou null.
export function generateCodedMessagePath(vocabulary, level, seed, language = 'fr', { blockedWords = BLOCKED_WORDS } = {}) {
  const settings = ANAGRAM_SETTINGS[level]
  if (!settings) throw new RangeError(`generateCodedMessagePath : niveau inconnu (${level})`)
  if (!isValidSeed(seed)) throw new RangeError('generateCodedMessagePath : graine invalide')
  const blocked = normalizeBlocked(blockedWords)
  const index = buildAnswerIndex(vocabulary, level, language)
  const byId = new Map(vocabulary.filter(Boolean).map(v => [v.id, v]))
  const random = createRandom(seed)

  // Même démarche que le jeu 1 : règle et mot tirés au hasard, premier
  // parcours valide retenu. Mots codés : ceux du jeu 1 (au moins 2 lettres
  // différentes, sinon la clé n'aurait qu'une ligne)
  const rules = shuffled(allowedRules(level), random)
  const solutions = shuffled(listSolutionCandidates(vocabulary, level, language), random)
    .filter(s => !containsBlocked(s.word, blocked))
  const candidates = listAnagramCandidates(vocabulary, level, language)
  for (const rule of rules) {
    const extraction = rule === 'position'
      ? { rule, position: pick(MYSTERY_WORD_SETTINGS[level].positions, random) }
      : { rule }
    for (const solution of solutions) {
      const pool = shuffled(candidates, random)
      const built = buildCodedMessage({ solution, extraction, pool, index, settings, blocked, random })
      if (built === null) continue
      const path = {
        formatVersion: MYSTERY_FORMAT_VERSION,
        id: `codedMessage-${language}-${level}-${seed}`,
        game: 'codedMessage',
        language,
        level,
        seed,
        theme: null,
        difficulty: roundedDifficulty(built.steps.map(s => byId.get(s.id))),
        extraction,
        steps: built.steps,
        final: {
          kind: 'code',
          prompt: FINAL_PROMPTS.codedMessage[language === 'en' ? 'en' : 'fr'],
          solution: solution.word,
          display: solution.display,
          message: built.message,
          // Seule réponse : le mot codé (le décodage), montré avec ses accents à la fin
          acceptedAnswers: [{ id: solution.id, word: solution.word, display: solution.display }],
          hints: built.hints
        },
        status: 'generated'
      }
      if (validatePath(path, { vocabulary, blockedWords: blocked }).length === 0) return path
    }
  }
  return null
}

// Mots utilisables pour un thème (jeu 4) : candidats classiques dont le sujet
// est dans le thème, hors mots écartés, sans anagramme dans le vocabulaire
// (l'élément gagné est le mot lui-même : deux réponses donneraient deux
// éléments différents, §6.1 règle 2), et ni le mot ni sa définition ne
// contiennent le nom du thème (§6.1 règle 6, §6.2 règle 3).
export function themeCandidates(vocabulary, level, language, theme) {
  const settings = ANAGRAM_SETTINGS[level]
  const label = theme.label[language]
  const index = buildAnswerIndex(vocabulary, level, language)
  const byId = new Map(vocabulary.filter(Boolean).map(v => [v.id, v]))
  const excluded = new Set((theme.excludedWords?.[language] ?? []).map(normalizeWord))
  return listAnagramCandidates(vocabulary, level, language).filter(c => {
    const v = byId.get(c.id)
    if (!theme.sujets.includes(v.sujet) || excluded.has(c.word)) return false
    const accepted = index.get(letterKey(c.word)).filter(a => !settings.firstLetterGiven || a.word[0] === c.word[0])
    if (accepted.length !== 1) return false
    return !revealsTheme(c.word, label) && !wordInLabel(c.word, label) && !revealsTheme(c.definition, label)
  })
}

// Thèmes de la liste fixe proposés pour un niveau et une langue : seulement
// ceux qui ont assez de mots utilisables
export function availableThemes(vocabulary, level, language = 'fr', { themes = THEMES_MYSTERES } = {}) {
  return (themes[level] ?? []).filter(theme =>
    new Set(themeCandidates(vocabulary, level, language, theme).map(c => letterKey(c.word))).size >= THEME_STEP_COUNT)
}

// Jeu 4 : Mystère des thèmes. Le thème vient UNIQUEMENT de la liste fixe
// (src/data/themes-mysteres.js). Renvoie un parcours valide, ou null.
export function generateThemePath(vocabulary, level, seed, language = 'fr', themeId, { themes = THEMES_MYSTERES, blockedWords = BLOCKED_WORDS } = {}) {
  const settings = ANAGRAM_SETTINGS[level]
  if (!settings) throw new RangeError(`generateThemePath : niveau inconnu (${level})`)
  if (!isValidSeed(seed)) throw new RangeError('generateThemePath : graine invalide')
  const theme = (themes[level] ?? []).find(th => th.id === themeId)
  if (!theme) return null
  const blocked = normalizeBlocked(blockedWords)
  const index = buildAnswerIndex(vocabulary, level, language)
  const byId = new Map(vocabulary.filter(Boolean).map(v => [v.id, v]))
  const random = createRandom(seed)

  const steps = []
  const usedKeys = new Set()
  for (const c of shuffled(themeCandidates(vocabulary, level, language, theme), random)) {
    if (steps.length >= THEME_STEP_COUNT) break
    const key = letterKey(c.word)
    if (usedKeys.has(key)) continue
    const item = createAnagramItem(c, index.get(key), random, { firstLetterGiven: settings.firstLetterGiven, blockedWords: blocked })
    if (item === null) continue
    usedKeys.add(key)
    steps.push({ ...item, secret: item.display, secretIndex: null, slot: null })
  }
  if (steps.length < THEME_STEP_COUNT) return null

  const solution = theme.label[language]
  const wrong = theme.distractors.map(d => d[language])
  const path = {
    formatVersion: MYSTERY_FORMAT_VERSION,
    id: `theme-${language}-${level}-${theme.id}-${seed}`,
    game: 'theme',
    language,
    level,
    seed,
    theme: theme.id,
    themeStatus: theme.status,
    difficulty: roundedDifficulty(steps.map(s => byId.get(s.id))),
    extraction: { rule: 'word' },
    steps,
    final: {
      kind: 'choice',
      prompt: FINAL_PROMPTS.theme[language === 'en' ? 'en' : 'fr'],
      solution,
      display: solution,
      acceptedAnswers: [{ id: null, word: gridTokens(solution).join(' '), display: solution }],
      options: shuffled([solution, ...wrong], random),
      hints: shuffled(wrong, random).slice(0, THEME_HINTS)
    },
    status: 'generated'
  }
  return validatePath(path, { vocabulary, themes, blockedWords: blocked }).length === 0 ? path : null
}

// Point d'entrée commun aux jeux générés (1, 4, 5) et aux jeux à parcours
// préconçus (2, 3 : choix et assemblage d'un parcours du contenu, mysteryPresets.js)
export function generateMysteryPath(game, vocabulary, level, seed, language = 'fr', { themeId = null, themes = THEMES_MYSTERES, blockedWords = BLOCKED_WORDS } = {}) {
  if (game === 'mysteryWord') return generateMysteryWordPath(vocabulary, level, seed, language, { blockedWords })
  if (game === 'theme') return generateThemePath(vocabulary, level, seed, language, themeId, { themes, blockedWords })
  if (game === 'codedMessage') return generateCodedMessagePath(vocabulary, level, seed, language, { blockedWords })
  if (game === 'syllables' || game === 'secretSentence') return generatePresetPath(game, vocabulary, level, seed, language, { blockedWords })
  return null
}

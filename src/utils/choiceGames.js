// Moteur D « Choix » (catalogue des jeux v0.2, §0.4 ; fiche L8 ; phase 7 du
// plan de migration, lot A : docs/quiz.md). Module pur : aucun accès au
// stockage ni à l'interface. Même modèle que les autres jeux : graine
// reproductible (createRandom, newSeed, isValidSeed).
//
// Le moteur est générique : il reçoit une série de questions déjà préparées
//   { id, prompt, options: [{ id, text }], retryOptions, answerId, feedback }
// et suit l'état de la série : un seul essai par question (C3), puis, à la
// fin de la série principale, les questions ratées reviennent une fois, avec
// leurs propositions remélangées (retryOptions), sans points (C3, C4 ; fiche
// L8, educator.md §28). Chaque jeu fournit sa préparation des questions :
// quiz « définition → mot » (lot A, plus bas) ; l'intrus (L9) et les relations
// entre les mots (L14) plus tard.
//
// L'état est immuable : chaque fonction renvoie un nouvel objet, ou le même
// quand rien ne change (React n'affiche alors pas de rendu inutile).

import { createRandom } from './wordSearchGenerator.js'
import { shuffled } from './anagramGame.js'
import { definitionCandidates, guaranteedPairCount, isValidSeed } from './pairsGame.js'

// C4 : 10 points par bonne réponse du premier essai ; pas d'étoiles
export const POINTS_PER_QUESTION = 10

const PHASE_MAIN = 'main'
const PHASE_RETRY = 'retry'
const PHASE_DONE = 'done'

// État de départ d'une série
export function createChoiceState(game) {
  return { phase: game.questions.length > 0 ? PHASE_MAIN : PHASE_DONE, position: 0, retryIds: [], answers: [] }
}

const questionById = (game, id) => game.questions.find(q => q.id === id) ?? null

// Question en cours (null si la série est finie)
export function currentQuestion(game, state) {
  if (state.phase === PHASE_MAIN) return game.questions[state.position] ?? null
  if (state.phase === PHASE_RETRY) return questionById(game, state.retryIds[state.position])
  return null
}

// Propositions affichées pour la question en cours
export function currentOptions(game, state) {
  const question = currentQuestion(game, state)
  if (!question) return []
  return state.phase === PHASE_RETRY ? question.retryOptions : question.options
}

// Réponse déjà donnée à la question en cours, dans la phase en cours
export function currentAnswer(state) {
  if (state.phase === PHASE_DONE) return null
  const { phase, position } = state
  return state.answers.find(a => a.phase === phase && a.position === position) ?? null
}

// Enregistre la réponse à la question en cours (un seul essai). Renvoie le même
// objet si la question a déjà une réponse, si la série est finie, ou si
// optionId n'est pas une proposition affichée.
export function answerQuestion(game, state, optionId) {
  const question = currentQuestion(game, state)
  if (!question || currentAnswer(state)) return state
  if (!currentOptions(game, state).some(o => o.id === optionId)) return state
  const answer = {
    questionId: question.id,
    optionId,
    correct: optionId === question.answerId,
    phase: state.phase,
    position: state.position
  }
  return { ...state, answers: [...state.answers, answer] }
}

// Questions ratées de la série principale, dans l'ordre de la série
export const missedIds = (state) =>
  state.answers.filter(a => a.phase === PHASE_MAIN && !a.correct).map(a => a.questionId)

// Passe à la question suivante (sans effet si la question en cours n'a pas de
// réponse). Fin de la série principale : reprise des ratées, ou fin.
export function nextQuestion(game, state) {
  if (!currentAnswer(state)) return state
  const position = state.position + 1
  if (state.phase === PHASE_MAIN) {
    if (position < game.questions.length) return { ...state, position }
    const retryIds = missedIds(state)
    return { ...state, phase: retryIds.length > 0 ? PHASE_RETRY : PHASE_DONE, position: 0, retryIds }
  }
  if (position < state.retryIds.length) return { ...state, position }
  return { ...state, phase: PHASE_DONE, position: 0 }
}

export const isFinished = (state) => state.phase === PHASE_DONE

// Bonnes réponses du premier essai (série principale seulement)
export const correctCount = (state) => state.answers.filter(a => a.phase === PHASE_MAIN && a.correct).length

export const quizScore = (state) => correctCount(state) * POINTS_PER_QUESTION

// --- Quiz « définition → mot » (fiche L8 ; docs/quiz.md §6 et §7) ----------
//
// Questions préparées à partir du vocabulaire : la définition sert de question,
// les propositions sont des mots du même niveau et du même sujet. Les règles
// contre une deuxième bonne réponse sont celles de L4 (docs/paires.md §15),
// reprises sans recopie : definitionCandidates donne les candidats et leurs
// clés (« w: » formes FR et EN, « d: » définition, « m: » définition qui cite
// un autre mot) ; deux candidats qui partagent une clé ne sont jamais proposés
// ensemble. Langue de l'interface au lancement.

export const GAME_TYPE_QUIZ_DEFINITION = 'quizDefinition'

// C1 et C2 : pas de SIL-CP ; 6 questions et 3 propositions en CE1-CE2, 8 et 4
// en CM1-CM2. [HYPOTHÈSE — À VÉRIFIER] par un enseignant.
export const QUIZ_SETTINGS = Object.freeze({
  'CE1-CE2': Object.freeze({ questionCount: 6, optionCount: 3 }),
  'CM1-CM2': Object.freeze({ questionCount: 8, optionCount: 4 })
})
export const QUIZ_LEVELS = Object.freeze(Object.keys(QUIZ_SETTINGS))

// Réglages d'un niveau (RangeError si niveau absent, SIL-CP compris)
export function quizSettings(level) {
  const settings = QUIZ_SETTINGS[level]
  if (!settings) throw new RangeError(`Quiz : niveau non proposé (${level})`)
  return { questionCount: settings.questionCount, optionCount: settings.optionCount }
}

const DEFINITION_KEY_PREFIX = 'd:'
const definitionKey = (candidate) => candidate.keys.find(k => k.startsWith(DEFINITION_KEY_PREFIX))
const sharesKey = (a, b) => a.keys.some(k => b.keys.includes(k))

// Borne sûre (pour toute graine) : questions = définitions distinctes ; groups
// = groupes sans conflit, dont un candidat de chacun peut toujours être
// proposé avec n'importe quelle bonne réponse
function quizCapacity(candidates) {
  return {
    questions: new Set(candidates.map(definitionKey)).size,
    groups: guaranteedPairCount(candidates)
  }
}

const isPlayable = ({ questions, groups }, { questionCount, optionCount }) =>
  questions >= questionCount && groups >= optionCount

// Sujets de l'écran de choix pour un niveau et une langue, triés comme L4 :
// [{ subject, questions, groups, playable }]
export function quizSubjects(levelEntries, level, language = 'fr') {
  const settings = quizSettings(level)
  const active = levelEntries.filter(v => v && v.actif !== false)
  const subjects = Array.from(new Set(active.map(v => v.sujet))).sort()
  return subjects.map(subject => {
    const capacity = quizCapacity(definitionCandidates(active.filter(v => v.sujet === subject), language))
    return { subject, ...capacity, playable: isPlayable(capacity, settings) }
  })
}

// Propositions d'une question : la bonne réponse, puis, dans l'ordre mélangé,
// chaque candidat sans clé commune avec ceux déjà choisis. Atteint toujours
// optionCount quand groups >= optionCount (le premier candidat rencontré de
// chaque groupe est accepté, ou son groupe est déjà représenté).
function pickOptions(answer, pool, optionCount, random) {
  const chosen = [answer]
  for (const c of shuffled(pool, random)) {
    if (chosen.length >= optionCount) break
    if (c.id === answer.id || chosen.some(o => sharesKey(o, c))) continue
    chosen.push(c)
  }
  return chosen
}

const toOption = (c) => ({ id: c.id, text: c.word })

// Quiz « définition → mot » : entrées d'un sujet et d'un niveau, graine, langue
// de l'interface au lancement. Renvoie { seed, level, language, questions },
// ou null si le sujet n'est pas jouable. RangeError si graine invalide ou
// niveau non proposé.
export function createDefinitionQuiz(entries, level, seed, language = 'fr') {
  const settings = quizSettings(level)
  if (!isValidSeed(seed)) throw new RangeError('createDefinitionQuiz : graine invalide')
  const lang = language === 'en' ? 'en' : 'fr'
  const candidates = definitionCandidates(entries.filter(v => v && v.actif !== false), lang)
  if (!isPlayable(quizCapacity(candidates), settings)) return null
  const random = createRandom(seed)
  // Tri préalable par id : le résultat ne dépend que du contenu et de la graine
  const sorted = candidates.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)))
  const pool = shuffled(sorted, random)
  const answers = []
  const usedDefinitions = new Set()
  for (const c of pool) {
    if (answers.length >= settings.questionCount) break
    const key = definitionKey(c)
    if (usedDefinitions.has(key)) continue
    usedDefinitions.add(key)
    answers.push(c)
  }
  const questions = answers.map(answer => {
    const chosen = pickOptions(answer, pool, settings.optionCount, random)
    return {
      id: answer.id,
      prompt: answer.definition,
      options: shuffled(chosen, random).map(toOption),
      retryOptions: shuffled(chosen, random).map(toOption),
      answerId: answer.id,
      feedback: { word: answer.word, definition: answer.definition }
    }
  })
  return { seed, level, language: lang, questions }
}

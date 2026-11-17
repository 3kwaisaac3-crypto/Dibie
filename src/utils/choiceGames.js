// Moteur D « Choix » (catalogue des jeux v0.2, §0.4 ; fiche L8 ; phase 7 du
// plan de migration, lot A : docs/quiz.md). Module pur : aucun accès au
// stockage ni à l'interface. Même modèle que les autres jeux : graine
// reproductible (createRandom, newSeed, isValidSeed).
//
// Le moteur est générique : il reçoit une série de questions déjà préparées
//   { id, prompt, options: [{ id, text }], retryOptions, answerId, feedback }
// et suit l'état de la série (C3 et C4, validés par Isaac le 2026-11-17) :
// deux essais par question, 10 points au premier, 5 au second ; après deux
// erreurs, la question est ratée. À la fin de la série principale, les
// questions ratées reviennent une fois, avec leurs propositions remélangées
// (retryOptions), deux essais encore, sans points (fiche L8, educator.md §28).
// Chaque jeu fournit sa préparation des questions : quiz « définition → mot »
// (lot A, plus bas) ; l'intrus (L9) et les relations entre les mots (L14) plus
// tard.
//
// L'état est immuable : chaque fonction renvoie un nouvel objet, ou le même
// quand rien ne change (React n'affiche alors pas de rendu inutile).

import { createRandom } from './wordSearchGenerator.js'
import { shuffled } from './anagramGame.js'
import { definitionCandidates, guaranteedPairCount, isValidSeed } from './pairsGame.js'

// C3 et C4 : deux essais ; 10 points au premier, 5 au second ; pas d'étoiles
export const ATTEMPTS_PER_QUESTION = 2
export const POINTS_FIRST_TRY = 10
export const POINTS_SECOND_TRY = 5

const PHASE_MAIN = 'main'
const PHASE_RETRY = 'retry'
const PHASE_DONE = 'done'

// État de départ d'une série. answers : un élément par essai
// { questionId, optionId, correct, attempt, phase, position }.
export function createChoiceState(game) {
  return { phase: game.questions.length > 0 ? PHASE_MAIN : PHASE_DONE, position: 0, retryIds: [], answers: [] }
}

export const isRetryPhase = (state) => state.phase === PHASE_RETRY
export const isFinished = (state) => state.phase === PHASE_DONE

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

// Essais déjà donnés à la question en cours, dans la phase en cours
function currentAttempts(state) {
  if (state.phase === PHASE_DONE) return []
  const { phase, position } = state
  return state.answers.filter(a => a.phase === phase && a.position === position)
}

// Un essai résout la question s'il est juste ou s'il est le dernier permis
const resolves = (a) => a.correct || a.attempt >= ATTEMPTS_PER_QUESTION

// Essai qui a résolu la question en cours (juste, ou deuxième erreur), ou null
// tant qu'un essai reste possible
export function currentAnswer(state) {
  return currentAttempts(state).find(resolves) ?? null
}

// Propositions déjà essayées pour la question en cours
export const triedOptionIds = (state) => currentAttempts(state).map(a => a.optionId)

// Enregistre un essai pour la question en cours. Renvoie le même objet si la
// question est déjà résolue, si la série est finie, si optionId n'est pas une
// proposition affichée ou s'il a déjà été essayé.
export function answerQuestion(game, state, optionId) {
  const question = currentQuestion(game, state)
  if (!question || currentAnswer(state)) return state
  if (!currentOptions(game, state).some(o => o.id === optionId)) return state
  const attempts = currentAttempts(state)
  if (attempts.some(a => a.optionId === optionId)) return state
  const answer = {
    questionId: question.id,
    optionId,
    correct: optionId === question.answerId,
    attempt: attempts.length + 1,
    phase: state.phase,
    position: state.position
  }
  return { ...state, answers: [...state.answers, answer] }
}

// Résolutions de la série principale (un essai décisif par question)
const mainResolutions = (state) => state.answers.filter(a => a.phase === PHASE_MAIN && resolves(a))

// Questions ratées (deux erreurs) de la série principale, dans l'ordre de la série
export const missedIds = (state) => mainResolutions(state).filter(a => !a.correct).map(a => a.questionId)

// Passe à la question suivante (sans effet tant que la question en cours n'est
// pas résolue). Fin de la série principale : reprise des ratées, ou fin.
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

// Bonnes réponses de la série principale : au premier essai, au second, en tout
export const firstTryCount = (state) => mainResolutions(state).filter(a => a.correct && a.attempt === 1).length
export const secondTryCount = (state) => mainResolutions(state).filter(a => a.correct && a.attempt === 2).length
export const correctCount = (state) => firstTryCount(state) + secondTryCount(state)

export const quizScore = (state) => firstTryCount(state) * POINTS_FIRST_TRY + secondTryCount(state) * POINTS_SECOND_TRY

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

// Clés des bonnes réponses d'une série : jamais deux fois la même définition
// (§6.2 règle 2), ni deux fois le même mot affiché (C8, Isaac, 2026-11-17 :
// deux entrées SWAP aux définitions presque identiques feraient la même
// question). Des synonymes (mots différents) restent possibles.
const ANSWER_WORD_KEY_PREFIX = 'a:'
const answerKeys = (candidate) => [definitionKey(candidate), `${ANSWER_WORD_KEY_PREFIX}${candidate.word}`]

// Borne sûre (pour toute graine) :
// - questions = groupes de candidats reliés par une définition ou un mot
//   affiché communs : le tirage des réponses en prend toujours au moins un par
//   groupe (un candidat n'est refusé que si un autre de son groupe est pris) ;
// - groups = groupes sans conflit, dont un candidat de chacun peut toujours
//   être proposé avec n'importe quelle bonne réponse.
function quizCapacity(candidates) {
  return {
    questions: guaranteedPairCount(candidates.map(c => ({ keys: answerKeys(c), restricted: false }))),
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

// Ordre de la reprise (C3, « propositions remélangées ») : mélangé selon la
// graine ; s'il est identique au premier ordre, décalé d'un cran (comme
// rightOrder dans pairsGame.js), pour que l'élève relise au lieu de toucher la
// place retenue.
function retryOrder(order, random) {
  const retry = shuffled(order, random)
  if (retry.length > 1 && retry.every((c, i) => c === order[i])) retry.push(retry.shift())
  return retry
}

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
  const usedAnswerKeys = new Set()
  for (const c of pool) {
    if (answers.length >= settings.questionCount) break
    const keys = answerKeys(c)
    if (keys.some(k => usedAnswerKeys.has(k))) continue
    keys.forEach(k => usedAnswerKeys.add(k))
    answers.push(c)
  }
  const questions = answers.map(answer => {
    const order = shuffled(pickOptions(answer, pool, settings.optionCount, random), random)
    return {
      id: answer.id,
      prompt: answer.definition,
      options: order.map(toOption),
      retryOptions: retryOrder(order, random).map(toOption),
      answerId: answer.id,
      feedback: { word: answer.word, definition: answer.definition }
    }
  })
  return { seed, level, language: lang, questions }
}

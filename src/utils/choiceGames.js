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

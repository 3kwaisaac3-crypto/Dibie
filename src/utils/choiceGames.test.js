// Tests du moteur D « Choix » (phase 7, lot A ; docs/quiz.md §5 et C3 validé
// par Isaac le 2026-11-17 : deux essais, 10 puis 5 points) — lancer avec : npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  POINTS_FIRST_TRY,
  POINTS_SECOND_TRY,
  ATTEMPTS_PER_QUESTION,
  createChoiceState,
  currentQuestion,
  currentOptions,
  currentAnswer,
  triedOptionIds,
  answerQuestion,
  nextQuestion,
  isFinished,
  isRetryPhase,
  correctCount,
  firstTryCount,
  secondTryCount,
  missedIds,
  quizScore
} from './choiceGames.js'

// Série construite à la main : 3 questions, bonne réponse « a »
const options = [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }]
const question = (id) => ({
  id,
  prompt: `question ${id}`,
  options,
  retryOptions: [options[2], options[1], options[0]],
  answerId: 'a',
  feedback: { word: 'A', definition: `question ${id}` }
})
const game = { seed: 1, questions: [question('q1'), question('q2'), question('q3')] }

// Donne une suite de réponses à la question en cours, puis passe à la suite
const play = (state, ...optionIds) =>
  nextQuestion(game, optionIds.reduce((s, id) => answerQuestion(game, s, id), state))

test('réglages : 2 essais, 10 points au premier, 5 au second', () => {
  assert.equal(ATTEMPTS_PER_QUESTION, 2)
  assert.equal(POINTS_FIRST_TRY, 10)
  assert.equal(POINTS_SECOND_TRY, 5)
})

test('createChoiceState : première question de la série principale, sans réponse', () => {
  const s = createChoiceState(game)
  assert.equal(s.phase, 'main')
  assert.equal(isRetryPhase(s), false)
  assert.equal(currentQuestion(game, s).id, 'q1')
  assert.deepEqual(currentOptions(game, s), options)
  assert.equal(currentAnswer(s), null)
  assert.deepEqual(triedOptionIds(s), [])
  assert.equal(isFinished(s), false)
})

test('bonne réponse au premier essai : question résolue, 10 points', () => {
  const s2 = answerQuestion(game, createChoiceState(game), 'a')
  assert.deepEqual(currentAnswer(s2), { questionId: 'q1', optionId: 'a', correct: true, attempt: 1, phase: 'main', position: 0 })
  assert.equal(quizScore(s2), 10)
  assert.equal(firstTryCount(s2), 1)
})

test('première erreur : question non résolue, second essai possible, même proposition refusée', () => {
  const s2 = answerQuestion(game, createChoiceState(game), 'b')
  assert.equal(currentAnswer(s2), null)
  assert.deepEqual(triedOptionIds(s2), ['b'])
  assert.equal(answerQuestion(game, s2, 'b'), s2)
  assert.equal(nextQuestion(game, s2), s2)
})

test('bonne réponse au second essai : 5 points, la question ne revient pas', () => {
  let s = answerQuestion(game, createChoiceState(game), 'b')
  s = answerQuestion(game, s, 'a')
  assert.equal(currentAnswer(s).correct, true)
  assert.equal(currentAnswer(s).attempt, 2)
  assert.equal(quizScore(s), 5)
  assert.equal(secondTryCount(s), 1)
  assert.equal(correctCount(s), 1)
  s = play(s)
  s = play(s, 'a')
  s = play(s, 'a')
  assert.equal(isFinished(s), true)
  assert.deepEqual(missedIds(s), [])
  assert.equal(quizScore(s), 25)
})

test('deux erreurs : question résolue fausse, plus de réponse possible', () => {
  let s = answerQuestion(game, createChoiceState(game), 'b')
  s = answerQuestion(game, s, 'c')
  assert.equal(currentAnswer(s).correct, false)
  assert.equal(currentAnswer(s).attempt, 2)
  assert.equal(answerQuestion(game, s, 'a'), s)
  assert.equal(quizScore(s), 0)
})

test('option inconnue ignorée ; suivant sans réponse sans effet', () => {
  const s = createChoiceState(game)
  assert.equal(answerQuestion(game, s, 'z'), s)
  assert.equal(nextQuestion(game, s), s)
})

test('reprise des questions ratées (deux erreurs), une seule fois, deux essais sans points', () => {
  let s = createChoiceState(game)
  s = play(s, 'a') // q1 juste au premier essai
  s = play(s, 'b', 'c') // q2 ratée
  s = play(s, 'c', 'a') // q3 juste au second essai
  assert.equal(isRetryPhase(s), true)
  assert.deepEqual(s.retryIds, ['q2'])
  assert.equal(currentQuestion(game, s).id, 'q2')
  assert.deepEqual(currentOptions(game, s), game.questions[1].retryOptions)
  assert.equal(currentAnswer(s), null)
  assert.deepEqual(triedOptionIds(s), [])
  s = answerQuestion(game, s, 'c') // erreur en reprise : second essai possible
  assert.equal(currentAnswer(s), null)
  s = play(s, 'a')
  assert.equal(isFinished(s), true)
  assert.equal(firstTryCount(s), 1)
  assert.equal(secondTryCount(s), 1)
  assert.equal(correctCount(s), 2)
  assert.equal(quizScore(s), 15)
  assert.deepEqual(missedIds(s), ['q2'])
})

test('série toute juste : fin directe, sans reprise', () => {
  let s = createChoiceState(game)
  s = play(s, 'a')
  s = play(s, 'a')
  s = answerQuestion(game, s, 'a')
  assert.equal(s.phase, 'main')
  s = nextQuestion(game, s)
  assert.equal(s.phase, 'done')
  assert.equal(quizScore(s), 30)
})

test('série finie : plus de question ni de proposition, réponse ignorée', () => {
  let s = createChoiceState(game)
  for (let i = 0; i < 3; i++) s = play(s, 'a')
  assert.equal(isFinished(s), true)
  assert.equal(currentQuestion(game, s), null)
  assert.deepEqual(currentOptions(game, s), [])
  assert.equal(answerQuestion(game, s, 'a'), s)
  assert.equal(nextQuestion(game, s), s)
})

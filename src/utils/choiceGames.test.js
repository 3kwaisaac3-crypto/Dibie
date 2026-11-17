// Tests du moteur D « Choix » (phase 7, lot A ; docs/quiz.md §5) — lancer avec : npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  POINTS_PER_QUESTION,
  createChoiceState,
  currentQuestion,
  currentOptions,
  currentAnswer,
  answerQuestion,
  nextQuestion,
  isFinished,
  correctCount,
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

// Répond puis passe à la suite
const play = (state, optionId) => nextQuestion(game, answerQuestion(game, state, optionId))

test('POINTS_PER_QUESTION vaut 10', () => {
  assert.equal(POINTS_PER_QUESTION, 10)
})

test('createChoiceState : première question de la série principale, sans réponse', () => {
  const s = createChoiceState(game)
  assert.equal(s.phase, 'main')
  assert.equal(s.position, 0)
  assert.equal(currentQuestion(game, s).id, 'q1')
  assert.deepEqual(currentOptions(game, s), options)
  assert.equal(currentAnswer(s), null)
  assert.equal(isFinished(s), false)
})

test('bonne réponse : enregistrée comme juste, 10 points', () => {
  const s2 = answerQuestion(game, createChoiceState(game), 'a')
  assert.equal(currentAnswer(s2).correct, true)
  assert.equal(currentAnswer(s2).optionId, 'a')
  assert.equal(quizScore(s2), 10)
})

test('réponse ignorée si déjà répondu (un seul essai)', () => {
  const s2 = answerQuestion(game, createChoiceState(game), 'b')
  assert.equal(currentAnswer(s2).correct, false)
  assert.equal(answerQuestion(game, s2, 'a'), s2)
  assert.equal(correctCount(s2), 0)
})

test('option inconnue ignorée', () => {
  const s = createChoiceState(game)
  assert.equal(answerQuestion(game, s, 'z'), s)
})

test('suivant sans réponse : sans effet', () => {
  const s = createChoiceState(game)
  assert.equal(nextQuestion(game, s), s)
})

test('reprise des questions ratées, une seule fois, avec les propositions remélangées', () => {
  let s = createChoiceState(game)
  s = play(s, 'a') // q1 juste
  s = play(s, 'b') // q2 faux
  s = play(s, 'c') // q3 faux
  assert.equal(s.phase, 'retry')
  assert.equal(currentQuestion(game, s).id, 'q2')
  assert.deepEqual(currentOptions(game, s), game.questions[1].retryOptions)
  assert.equal(currentAnswer(s), null)
  s = play(s, 'a') // reprise juste sur q2
  assert.equal(currentQuestion(game, s).id, 'q3')
  s = play(s, 'b') // reprise fausse sur q3
  assert.equal(isFinished(s), true)
  assert.equal(correctCount(s), 1)
  assert.equal(quizScore(s), 10)
  assert.deepEqual(missedIds(s), ['q2', 'q3'])
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
  assert.deepEqual(missedIds(s), [])
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

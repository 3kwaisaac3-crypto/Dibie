import React, { useRef, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { saveScore, saveUserProgress } from '../db/index'
import {
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
} from '../utils/choiceGames'
import { createIntrusGame, intrusPlayableItems, GAME_TYPE_INTRUS, INTRUS_LEVELS, ITEMS_PER_GAME } from '../utils/intrusGame'
import { newSeed, isValidSeed } from '../utils/pairsGame'
import { libelleNiveau } from '../data/niveaux'
import collection from '../data/intrus.json'
import '../styles/AnagramGame.css'
import '../styles/PairsGame.css'
import '../styles/QuizGame.css'
import '../styles/IntrusGame.css'

// L'intrus (fiche L9 du catalogue v0.2 ; phase 7, lot C, moteur D :
// src/utils/choiceGames.js et src/utils/intrusGame.js ; docs/intrus.md).
// L'élève touche le mot qui n'appartient pas au groupe ; en CE1-CE2 la
// consigne donne le critère et la raison est affichée après la réponse (I4) ;
// au CM1-CM2, il choisit ensuite la raison parmi 3 (I5). Règles d'essais et
// de points du quiz (I7). Seuls les items validés par Isaac sont proposés (P6).

// Double toucher sur « Suivant » : même délai que le quiz (C6)
const NEXT_TAP_GUARD_MS = 500

export default function IntrusGame() {
  const { user, language, setCurrentPage } = useAppStore()
  const t = (fr, en) => (language === 'fr' ? fr : en)

  // Élève de SIL-CP : le jeu s'ouvre en CE1-CE2, avec un message (I1)
  const youngLearner = user?.level === 'SIL-CP'
  const [level, setLevel] = useState(INTRUS_LEVELS.includes(user?.level) ? user.level : INTRUS_LEVELS[0])
  const [seedInput, setSeedInput] = useState('')
  const [seedError, setSeedError] = useState(false)
  const [gameState, setGameState] = useState('select') // select | playing | finished
  const [game, setGame] = useState(null)
  const [play, setPlayState] = useState(null) // état du moteur D
  // État courant, lu par les gestionnaires : deux touchers avant le rendu
  // suivant ne comptent qu'une réponse
  const playRef = useRef(null)
  const setPlay = (next) => {
    playRef.current = next
    setPlayState(next)
  }
  const advancedAtRef = useRef(0)
  const tapGuarded = () => Date.now() - advancedAtRef.current < NEXT_TAP_GUARD_MS
  // Partie dont le score est déjà enregistré : un seul saveScore par partie
  const scoreSavedForRef = useRef(null)

  const playableCount = intrusPlayableItems(collection, level, language).length
  const title = t('L\'intrus', 'Odd one out')

  const startGame = (seed) => {
    const g = createIntrusGame(collection, level, seed, language)
    if (!g) return
    setGame(g)
    setPlay(createChoiceState(g))
    setGameState('playing')
  }

  const handleStart = () => {
    const text = seedInput.trim()
    if (text === '') {
      setSeedError(false)
      startGame(newSeed())
      return
    }
    const seed = /^\d+$/.test(text) ? Number(text) : NaN
    if (!isValidSeed(seed)) {
      setSeedError(true)
      return
    }
    setSeedError(false)
    startGame(seed)
  }

  const handleNewGame = () => {
    setSeedInput('')
    startGame(newSeed())
  }

  const handleBackToSelect = () => {
    setGameState('select')
    setGame(null)
  }

  const handleBackToDashboard = () => {
    setGameState('select')
    setGame(null)
    setCurrentPage('studentDashboard')
  }

  const handleAnswer = (optionId) => {
    if (tapGuarded()) return
    const state = playRef.current
    const next = answerQuestion(game, state, optionId)
    if (next === state) return
    setPlay(next)
    const answer = currentAnswer(next)
    if (answer && !isRetryPhase(state)) {
      saveUserProgress(user?.id, answer.questionId, answer.correct, null, {
        gameType: GAME_TYPE_INTRUS, itemId: answer.questionId
      })
    }
  }

  const handleNext = () => {
    const state = playRef.current
    const next = nextQuestion(game, state)
    if (next === state) return
    advancedAtRef.current = Date.now()
    setPlay(next)
    if (!isFinished(next)) return
    if (scoreSavedForRef.current !== game) {
      scoreSavedForRef.current = game
      saveScore(user?.id, GAME_TYPE_INTRUS, quizScore(next), level, {
        seed: game.seed,
        language: game.language,
        itemCount: game.itemCount,
        questionCount: game.questions.length,
        correctCount: correctCount(next),
        firstTryCount: firstTryCount(next),
        secondTryCount: secondTryCount(next)
      }).catch(e => console.error('Erreur:', e))
    }
    setGameState('finished')
  }

  if (gameState === 'select') {
    return (
      <div className="anagram-select pairs-select">
        <div className="anagram-select__container">
          <h1>{title}</h1>
          <p className="anagram-select__intro">
            {t('Parmi quatre mots, touche celui qui n\'appartient pas au groupe.',
              'Among four words, tap the one that does not belong to the group.')}
          </p>
          {youngLearner && (
            <p className="pairs-select__empty" role="status">
              {t('Ce jeu commence au CE1-CE2 : il faut lire des phrases. Tu peux essayer avec un adulte.',
                'This game starts in Class 3-4: you need to read sentences. You can try it with an adult.')}
            </p>
          )}

          <div className="anagram-select__section">
            <span className="anagram-select__label" id="intrus-level-label">{t('Niveau', 'Level')}</span>
            <div className="anagram-select__options" role="group" aria-labelledby="intrus-level-label">
              {INTRUS_LEVELS.map(l => (
                <button
                  key={l}
                  className={`anagram-select__btn ${level === l ? 'active' : ''}`}
                  onClick={() => setLevel(l)}
                  aria-pressed={level === l}
                >
                  {libelleNiveau(l, language)}
                  <span className="anagram-select__size">
                    {t(`${ITEMS_PER_GAME[l]} intrus`, `${ITEMS_PER_GAME[l]} items`)}
                  </span>
                </button>
              ))}
            </div>
            {playableCount === 0 && (
              <p className="pairs-select__empty intrus-empty" role="status">
                {t('Pas encore d\'intrus validés pour ce niveau.', 'No validated odd-one-out items for this level yet.')}
              </p>
            )}
          </div>

          <div className="anagram-select__section">
            <label className="anagram-select__label" htmlFor="intrus-seed">
              {t('Numéro de partie (facultatif)', 'Game number (optional)')}
            </label>
            <input
              id="intrus-seed"
              className="anagram-select__seed"
              type="text"
              inputMode="numeric"
              value={seedInput}
              onChange={e => setSeedInput(e.target.value)}
              placeholder={t('Laisser vide pour une nouvelle partie', 'Leave empty for a new game')}
              aria-describedby="intrus-seed-hint"
            />
            <p id="intrus-seed-hint" className="anagram-select__hint">
              {seedError
                ? t('Numéro invalide : un nombre entier de 0 à 4294967295.', 'Invalid number: a whole number from 0 to 4294967295.')
                : t('Avec la même version de l\'application, le même numéro, le même niveau et la même langue donnent les mêmes intrus.',
                  'With the same version of the app, the same number, level and language give the same items.')}
            </p>
          </div>

          <button className="anagram-select__start" onClick={handleStart} disabled={playableCount === 0}>
            {t('Commencer', 'Start')}
          </button>
          <button className="anagram-select__back" onClick={handleBackToDashboard}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>
    )
  }

  if (!game || !play) return null

  const seedLine = `${t('Partie n°', 'Game no.')} ${game.seed}`

  if (gameState === 'finished') {
    const first = firstTryCount(play)
    const second = secondTryCount(play)
    const missed = new Set(missedIds(play).map(id => game.questions.find(q => q.id === id).itemId))
    const items = game.questions.filter(q => q.kind === 'intrus')
    return (
      <div className="anagram-finished pairs-select">
        <div className="anagram-finished__container">
          <h1>🎉 {t('Partie terminée !', 'Game over!')}</h1>
          <p>
            {t(`Sur ${game.questions.length} questions : ${first} du premier coup, ${second} au deuxième essai.`,
              `Out of ${game.questions.length} questions: ${first} on the first try, ${second} on the second try.`)}
          </p>
          <p className="anagram-finished__score">{quizScore(play)}</p>
          <ul className="quiz-recap">
            {items.map(q => {
              const wasMissed = missed.has(q.itemId)
              return (
                <li key={q.itemId} lang={game.language} className={wasMissed ? 'quiz-recap__item--missed' : 'quiz-recap__item--found'}>
                  <span className="quiz-recap__word">{q.feedback.intrus}</span>
                  <span aria-hidden="true"> : </span>
                  <span className="quiz-recap__definition">{q.feedback.raison}</span>
                  <span className="anagram-sr-only">{wasMissed ? t(' (raté)', ' (missed)') : t(' (juste)', ' (right)')}</span>
                </li>
              )
            })}
          </ul>
          <p className="anagram-game__seed">
            {seedLine} · {libelleNiveau(level, language)}
          </p>
          <button className="anagram-select__start" onClick={handleNewGame}>
            {t('Nouvelle partie', 'New game')}
          </button>
          <button className="anagram-select__back" onClick={handleBackToDashboard}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>
    )
  }

  const question = currentQuestion(game, play)
  if (!question) return null
  const options = currentOptions(game, play)
  const answer = currentAnswer(play)
  const tried = triedOptionIds(play)
  const retry = isRetryPhase(play)
  const total = retry ? play.retryIds.length : game.questions.length
  // La question « intrus » du CM laisse la raison à la question suivante
  const intrusFirstStep = question.kind === 'intrus' && game.level !== INTRUS_LEVELS[0]

  const optionClass = (o) => {
    if (answer && o.id === question.answerId) return 'quiz-option quiz-option--correct'
    if (tried.includes(o.id)) return 'quiz-option quiz-option--wrong'
    return 'quiz-option'
  }

  let feedback = ''
  if (answer && answer.correct) {
    feedback = answer.attempt === 1
      ? t('Bravo !', 'Well done!')
      : t('Bravo, au deuxième essai !', 'Well done, on the second try!')
  } else if (answer && question.kind === 'pourquoi') {
    feedback = t('Voici la bonne raison :', 'Here is the right reason:')
  } else if (answer && intrusFirstStep) {
    feedback = t(`L'intrus était : ${question.feedback.intrus}`, `The odd one out was: ${question.feedback.intrus}`)
  } else if (answer) {
    feedback = t(`La réponse : ${question.feedback.intrus}`, `The answer: ${question.feedback.intrus}`)
  } else if (tried.length > 0) {
    feedback = t('Essaie encore : il te reste un essai.', 'Try again: you have one more try.')
  }
  const reason = answer && !intrusFirstStep ? question.feedback.raison : ''

  return (
    <div className="anagram-game quiz-game">
      <div className="anagram-game__header">
        <h1>{title} - {libelleNiveau(level, language)}</h1>
        <div className="anagram-game__progress">
          <span className="quiz-progress">Question {play.position + 1} / {total}</span>
          {' · '}{quizScore(play)} {t('points', 'points')}
        </div>
        <p className="anagram-game__seed">{seedLine}</p>
      </div>

      <div className="anagram-game__card quiz-board">
        {retry && (
          <p className="quiz-retry" role="status">
            {t('On revoit les questions ratées', 'Let\'s review the missed questions')}
          </p>
        )}
        <p className="quiz-question" lang={game.language}>{question.prompt}</p>
        <ul className={`quiz-options ${question.kind === 'pourquoi' ? 'intrus-reasons' : ''}`} aria-label={t('Propositions', 'Choices')}>
          {options.map(o => (
            <li key={o.id}>
              <button
                className={optionClass(o)}
                lang={game.language}
                onClick={() => handleAnswer(o.id)}
                disabled={answer !== null || tried.includes(o.id)}
              >
                {o.text}
              </button>
            </li>
          ))}
        </ul>

        <p className="quiz-feedback" role="status" aria-live="polite">{feedback}</p>
        <p className="intrus-reason" lang={game.language}>{reason}</p>

        <button className="anagram-select__start quiz-next" onClick={handleNext} disabled={answer === null}>
          {t('Suivant', 'Next')}
        </button>

        <div className="anagram-game__footer">
          <button className="anagram-game__btn anagram-game__btn--secondary" onClick={() => { if (!tapGuarded()) handleNewGame() }}>
            {t('Nouvelle partie', 'New game')}
          </button>
          <button className="anagram-game__btn anagram-game__btn--secondary anagram-game__back" onClick={() => { if (!tapGuarded()) handleBackToSelect() }}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>
    </div>
  )
}

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { getVocabByLevel, saveScore, saveUserProgress } from '../db/index'
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
  quizScore,
  quizSettings,
  quizSubjects,
  createDefinitionQuiz,
  GAME_TYPE_QUIZ_DEFINITION,
  QUIZ_LEVELS
} from '../utils/choiceGames'
import { newSeed, isValidSeed } from '../utils/pairsGame'
import { defaultCrosswordSubject } from '../utils/crosswordLayout'
import { MATIERES, MATIERE_TOUTES, filtrerParMatiere, libelleMatiere, libelleSujet } from '../data/sujets-matieres'
import { libelleNiveau } from '../data/niveaux'
import '../styles/AnagramGame.css'
import '../styles/PairsGame.css'
import '../styles/QuizGame.css'

// Quiz « définition → mot » (fiche L8 du catalogue v0.2 ; phase 7, lot A,
// moteur D : src/utils/choiceGames.js ; docs/quiz.md). L'élève lit une
// définition et touche le mot qui lui correspond, parmi 3 (CE1-CE2) ou 4
// (CM1-CM2) propositions. Deux essais : 10 points au premier, 5 au second
// (C3, C4) ; après deux erreurs, la réponse est montrée et la question revient
// une fois en fin de série, sans points. Écran de choix repris de L4
// (src/pages/DefinitionGame.jsx). En SIL-CP : 3 questions, avec un parent (C1 révisé).

// Double toucher sur « Suivant » : pendant ce délai après le passage à la
// question suivante, les touchers sur les propositions et sur « Nouvelle
// partie » / « Retour » sont ignorés (le second toucher d'un double toucher
// tombe sinon sur la nouvelle mise en page : réponse sans lecture, partie
// quittée). Durée d’un double toucher courant (C6, validé par Isaac le 2026-11-17).
const NEXT_TAP_GUARD_MS = 500

export default function QuizGame() {
  const { user, language, setCurrentPage } = useAppStore()
  const t = (fr, en) => (language === 'fr' ? fr : en)

  // Élève de SIL-CP : le jeu s'ouvre en SIL-CP, avec un message qui demande
  // l'aide d'un parent (C1 révisé, Isaac, 2026-11-26)
  const [level, setLevel] = useState(QUIZ_LEVELS.includes(user?.level) ? user.level : QUIZ_LEVELS[0])
  const [matiere, setMatiere] = useState(MATIERE_TOUTES)
  const [subject, setSubject] = useState('')
  const [levelEntries, setLevelEntries] = useState(null)
  const [entriesLevel, setEntriesLevel] = useState(null)
  const [seedInput, setSeedInput] = useState('')
  const [seedError, setSeedError] = useState(false)
  const [gameState, setGameState] = useState('select') // select | playing | finished | unavailable
  const [game, setGame] = useState(null)
  const [quiz, setQuizState] = useState(null) // état du moteur D
  // État courant, lu par les gestionnaires : deux touchers avant le rendu
  // suivant ne comptent qu'une réponse (un seul saveUserProgress)
  const quizRef = useRef(null)
  const setQuiz = (next) => {
    quizRef.current = next
    setQuizState(next)
  }

  // Heure du dernier passage à la question suivante (NEXT_TAP_GUARD_MS)
  const advancedAtRef = useRef(0)
  const tapGuarded = () => Date.now() - advancedAtRef.current < NEXT_TAP_GUARD_MS

  const busyRef = useRef(false)
  // Série dont le score est déjà enregistré : un seul saveScore par série (C4)
  const scoreSavedForRef = useRef(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      let entries = []
      try {
        entries = await getVocabByLevel(level)
      } catch (e) {
        console.error('Quiz : erreur de chargement', e)
      }
      if (cancelled) return
      setLevelEntries(entries)
      setEntriesLevel(level)
    }
    load()
    return () => { cancelled = true }
  }, [level])

  // Sujets du niveau dans la langue de l'interface, grisés s'ils sont injouables
  const subjectList = useMemo(
    () => (levelEntries && entriesLevel === level ? quizSubjects(levelEntries, level, language) : null),
    [levelEntries, entriesLevel, level, language]
  )

  // Premier affichage, changement de niveau ou de langue : sujet jouable par défaut
  const subjectKeyRef = useRef(null)
  useEffect(() => {
    const key = `${level}|${language}`
    if (!subjectList || subjectKeyRef.current === key) return
    subjectKeyRef.current = key
    setSubject(prev => defaultCrosswordSubject(filtrerParMatiere(subjectList, matiere), prev))
  }, [subjectList, level, language, matiere])

  const chooseMatiere = (id) => {
    setMatiere(id)
    setSubject(prev => defaultCrosswordSubject(filtrerParMatiere(subjectList || [], id), prev))
  }

  const subjectsOfMatiere = subjectList === null ? null : filtrerParMatiere(subjectList, matiere)
  const displayedSubjects = (subjectsOfMatiere || []).slice()
  if (language !== 'fr') {
    displayedSubjects.sort((a, b) => libelleSujet(a.subject, language).localeCompare(libelleSujet(b.subject, language), 'en'))
  }
  const listReady = subjectsOfMatiere !== null
  const emptyMatiere = listReady && subjectsOfMatiere.length === 0
  const noPlayableSubject = listReady && !emptyMatiere && !subjectsOfMatiere.some(s => s.playable)
  const subjectPlayable = listReady && subjectsOfMatiere.some(s => s.subject === subject && s.playable)
  const canStart = subjectPlayable && !generating

  const title = t('Quiz des définitions', 'Definition quiz')

  const startGame = (seed) => {
    if (busyRef.current) return
    busyRef.current = true
    setGenerating(true)
    try {
      const entries = (levelEntries || []).filter(v => v.sujet === subject)
      const g = createDefinitionQuiz(entries, level, seed, language)
      if (!g) {
        console.warn('Quiz : série impossible', { level, subject, seed, language })
        setGame(null)
        setGameState('unavailable')
        return
      }
      setGame(g)
      setQuiz(createChoiceState(g))
      setGameState('playing')
    } catch (e) {
      console.error('Quiz : erreur de préparation', e)
      setGame(null)
      setGameState('unavailable')
    } finally {
      busyRef.current = false
      setGenerating(false)
    }
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

  // Deux essais : une question résolue ou une proposition déjà essayée laisse
  // l'état inchangé. Progrès enregistré une fois par question, quand elle est
  // résolue (juste à l'un des deux essais, ou ratée), en série principale.
  const handleAnswer = (optionId) => {
    if (tapGuarded()) return
    const state = quizRef.current
    const next = answerQuestion(game, state, optionId)
    if (next === state) return
    setQuiz(next)
    const answer = currentAnswer(next)
    if (answer && !isRetryPhase(state)) {
      saveUserProgress(user?.id, answer.questionId, answer.correct, null, {
        gameType: GAME_TYPE_QUIZ_DEFINITION, itemId: answer.questionId
      })
    }
  }

  const handleNext = () => {
    const state = quizRef.current
    const next = nextQuestion(game, state)
    if (next === state) return
    advancedAtRef.current = Date.now()
    setQuiz(next)
    if (!isFinished(next)) return
    // Score enregistré une seule fois, à la fin de la série (reprise comprise)
    if (scoreSavedForRef.current !== game) {
      scoreSavedForRef.current = game
      saveScore(user?.id, GAME_TYPE_QUIZ_DEFINITION, quizScore(next), level, {
        seed: game.seed,
        language: game.language,
        subject,
        questionCount: game.questions.length,
        correctCount: correctCount(next),
        firstTryCount: firstTryCount(next),
        secondTryCount: secondTryCount(next)
      }).catch(e => console.error('Erreur:', e))
    }
    setGameState('finished')
  }

  if (gameState === 'select') {
    const { questionCount } = quizSettings(level)
    return (
      <div className="anagram-select pairs-select">
        <div className="anagram-select__container">
          <h1>{title}</h1>
          <p className="anagram-select__intro">
            {t('Lis la définition, puis touche le mot qui lui correspond.',
              'Read the definition, then tap the matching word.')}
          </p>
          {level === 'SIL-CP' && (
            <p className="pairs-select__empty" role="status">
              {t('En SIL-CP, joue avec un parent : il te lit les définitions.',
                'In Class 1-2, play with a parent: they read the definitions to you.')}
            </p>
          )}

          <div className="anagram-select__section">
            <span className="anagram-select__label" id="quiz-level-label">{t('Niveau', 'Level')}</span>
            <div className="anagram-select__options" role="group" aria-labelledby="quiz-level-label">
              {QUIZ_LEVELS.map(l => (
                <button
                  key={l}
                  className={`anagram-select__btn ${level === l ? 'active' : ''}`}
                  onClick={() => setLevel(l)}
                  aria-pressed={level === l}
                >
                  {libelleNiveau(l, language)}
                  <span className="anagram-select__size">
                    {t(`${quizSettings(l).questionCount} questions`, `${quizSettings(l).questionCount} questions`)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="anagram-select__section">
            <span className="anagram-select__label" id="quiz-matiere-label">{t('Matière', 'Subject area')}</span>
            <div className="anagram-select__options pairs-select__matieres" role="group" aria-labelledby="quiz-matiere-label">
              {MATIERES.map(m => (
                <button
                  key={m.id}
                  className={`anagram-select__btn ${matiere === m.id ? 'active' : ''}`}
                  onClick={() => chooseMatiere(m.id)}
                  aria-pressed={matiere === m.id}
                >
                  {libelleMatiere(m.id, language)}
                </button>
              ))}
            </div>
          </div>

          <div className="anagram-select__section">
            <span className="anagram-select__label" id="quiz-subject-label">{t('Sujet', 'Topic')}</span>
            {emptyMatiere && (
              <p className="pairs-select__empty" role="status">
                {t(`Aucun sujet en ${libelleMatiere(matiere, language)} pour ce niveau. Choisis une autre matière ou un autre niveau.`,
                  `No topics in ${libelleMatiere(matiere, language)} for this level. Choose another subject area or level.`)}
              </p>
            )}
            <div className="pairs-select__grid" role="group" aria-labelledby="quiz-subject-label">
              {displayedSubjects.map(({ subject: s, playable }) => (
                <button
                  key={s}
                  className={`pairs-select__subject ${subject === s ? 'active' : ''}`}
                  onClick={() => setSubject(s)}
                  disabled={!playable}
                  aria-pressed={subject === s}
                >
                  {libelleSujet(s, language)}
                  {!playable && (
                    <span className="pairs-select__soon">{t('pas assez de mots', 'not enough words')}</span>
                  )}
                </button>
              ))}
            </div>
            {noPlayableSubject && (
              <p className="anagram-select__hint">
                {t(`Aucun sujet de cette matière n'a assez de mots pour ${questionCount} questions.`,
                  `No topic in this subject area has enough words for ${questionCount} questions.`)}
              </p>
            )}
          </div>

          <div className="anagram-select__section">
            <label className="anagram-select__label" htmlFor="quiz-seed">
              {t('Numéro de partie (facultatif)', 'Game number (optional)')}
            </label>
            <input
              id="quiz-seed"
              className="anagram-select__seed"
              type="text"
              inputMode="numeric"
              value={seedInput}
              onChange={e => setSeedInput(e.target.value)}
              placeholder={t('Laisser vide pour une nouvelle partie', 'Leave empty for a new game')}
              aria-describedby="quiz-seed-hint"
            />
            <p id="quiz-seed-hint" className="anagram-select__hint">
              {seedError
                ? t('Numéro invalide : un nombre entier de 0 à 4294967295.', 'Invalid number: a whole number from 0 to 4294967295.')
                : t('Avec la même version de l\'application, le même numéro, le même niveau, le même sujet et la même langue donnent les mêmes questions.',
                  'With the same version of the app, the same number, level, topic and language give the same questions.')}
            </p>
          </div>

          <button className="anagram-select__start" onClick={handleStart} disabled={!canStart}>
            {t('Commencer', 'Start')}
          </button>
          <button className="anagram-select__back" onClick={handleBackToDashboard}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>
    )
  }

  if (gameState === 'unavailable') {
    return (
      <div className="anagram-select pairs-select">
        <div className="anagram-select__container">
          <h1>{title}</h1>
          <p className="anagram-select__intro" role="status">
            {t('Cette partie n\'est pas disponible pour le moment. Choisis un autre sujet.',
              'This game is not available right now. Choose another topic.')}
          </p>
          <button className="anagram-select__back" onClick={handleBackToSelect}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>
    )
  }

  if (!game || !quiz) return null

  const seedLine = `${t('Partie n°', 'Game no.')} ${game.seed} · ${libelleSujet(subject, language)}`

  if (gameState === 'finished') {
    const first = firstTryCount(quiz)
    const second = secondTryCount(quiz)
    const missed = missedIds(quiz)
    return (
      <div className="anagram-finished pairs-select">
        <div className="anagram-finished__container">
          <h1>🎉 {t('Partie terminée !', 'Game over!')}</h1>
          <p>
            {t(`Sur ${game.questions.length} questions : ${first} du premier coup, ${second} au deuxième essai.`,
              `Out of ${game.questions.length} questions: ${first} on the first try, ${second} on the second try.`)}
          </p>
          <p className="anagram-finished__score">{quizScore(quiz)}</p>
          <ul className="quiz-recap">
            {game.questions.map(q => {
              const wasMissed = missed.includes(q.id)
              return (
                <li key={q.id} lang={game.language} className={wasMissed ? 'quiz-recap__item--missed' : 'quiz-recap__item--found'}>
                  <span className="quiz-recap__word">{q.feedback.word}</span>
                  <span aria-hidden="true"> : </span>
                  <span className="quiz-recap__definition">{q.feedback.definition}</span>
                  <span className="anagram-sr-only">{wasMissed ? t(' (ratée)', ' (missed)') : t(' (juste)', ' (right)')}</span>
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

  if (gameState !== 'playing') return null

  const question = currentQuestion(game, quiz)
  if (!question) return null
  const options = currentOptions(game, quiz)
  const answer = currentAnswer(quiz)
  const tried = triedOptionIds(quiz)
  const retry = isRetryPhase(quiz)
  const total = retry ? quiz.retryIds.length : game.questions.length

  // Bonne réponse en vert une fois la question résolue ; propositions essayées
  // à tort barrées en rouge (et désactivées)
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
  } else if (answer) {
    feedback = t(`La réponse : ${question.feedback.word} : ${question.feedback.definition}`,
      `The answer: ${question.feedback.word}: ${question.feedback.definition}`)
  } else if (tried.length > 0) {
    feedback = t('Essaie encore : il te reste un essai.', 'Try again: you have one more try.')
  }

  return (
    <div className="anagram-game quiz-game">
      <div className="anagram-game__header">
        <h1>{title} - {libelleNiveau(level, language)}</h1>
        <div className="anagram-game__progress">
          <span className="quiz-progress">Question {quiz.position + 1} / {total}</span>
          {' · '}{quizScore(quiz)} {t('points', 'points')}
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
        <ul className="quiz-options" aria-label={t('Propositions', 'Choices')}>
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

        <p className="quiz-feedback" role="status" aria-live="polite" lang={answer && !answer.correct ? game.language : undefined}>
          {feedback}
        </p>

        {/* Toujours affiché (désactivé avant la réponse) : la rangée du bas
            ne remonte pas sous le doigt après « Suivant » */}
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

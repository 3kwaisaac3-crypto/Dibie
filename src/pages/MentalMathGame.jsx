import React, { useRef, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { saveScore, saveUserProgress } from '../db/index'
import { resolveMathClass } from '../data/reglages-maths'
import NumberPad from '../components/NumberPad'
import {
  GAME_TYPE_MENTAL_MATH, MIXED,
  classFamilies, familyName, calcText, calcHint, solvedText, formatNumber,
  createMentalSeries, maxDigits, createMentalState, currentCalc, currentEntry,
  isResolved, showHint, canReveal, isRetry, isDone, submitAnswer, revealAnswer, nextCalc,
  mentalScore, foundCount, revealedCount, errorCount
} from '../utils/mentalMath'
import { newSeed, isValidSeed } from '../utils/pairsGame'
import '../styles/AnagramGame.css'
import '../styles/PairsGame.css'
import '../styles/QuizGame.css'
import '../styles/MentalMathGame.css'

// Calcul mental (fiche M6 ; phase 7, lot B : src/utils/mentalMath.js,
// src/data/calcul-mental.js ; docs/calcul-mental.md). Réglé sur la classe du
// profil (resolveMathClass, comme les pyramides et les nombres croisés).
// Saisie au pavé ; 10 points par calcul trouvé, même après des erreurs ;
// indice après 2 erreurs ; « Voir la réponse » après 3 (0 point) ; calculs
// dont la réponse a été vue repris une fois, sans points. Pas de chronomètre
// (P11). Calculs générés, bornes provisoires : jeu marqué « démonstration ».

// Double toucher sur « Suivant » : même délai que le quiz (C6)
const NEXT_TAP_GUARD_MS = 500

const SUBSYSTEM_LABEL = {
  fr: { fr: 'sous-système francophone', en: 'French-speaking subsystem' },
  en: { fr: 'sous-système anglophone', en: 'English-speaking subsystem' }
}

export default function MentalMathGame() {
  const { user, language, setCurrentPage } = useAppStore()
  const t = (fr, en) => (language === 'fr' ? fr : en)
  const lang = language === 'fr' ? 'fr' : 'en'

  const { settings: mathClass, isDefault, reason } = resolveMathClass({
    level: user?.level,
    className: user?.class ?? null,
    subsystem: user?.subsystem ?? 'fr'
  })
  const { className, subsystem } = mathClass
  const families = classFamilies(className)

  const [family, setFamily] = useState(MIXED)
  const [seedInput, setSeedInput] = useState('')
  const [seedError, setSeedError] = useState(false)
  const [gameState, setGameState] = useState('select') // select | playing | finished
  const [series, setSeries] = useState(null)
  const [entry, setEntryState] = useState('')
  const [play, setPlayState] = useState(null)
  // Valeurs courantes, lues par les gestionnaires : deux touchers avant le
  // rendu suivant ne comptent qu'une fois
  const playRef = useRef(null)
  const entryRef = useRef('')
  const setPlay = (next) => { playRef.current = next; setPlayState(next) }
  const setEntry = (next) => { entryRef.current = next; setEntryState(next) }
  const advancedAtRef = useRef(0)
  const tapGuarded = () => Date.now() - advancedAtRef.current < NEXT_TAP_GUARD_MS
  const scoreSavedForRef = useRef(null)

  const title = t('Calcul mental', 'Mental maths')

  const classLine = () => {
    const sub = SUBSYSTEM_LABEL[subsystem][lang]
    if (!isDefault) return t(`Réglé pour : ${className} (${sub}).`, `Set for: ${className} (${sub}).`)
    return reason === 'mismatch'
      ? t(`Réglé pour : ${className} (${sub}), classe par défaut : la classe du profil (${user?.class}) ne correspond pas à son niveau ou à son sous-système.`,
        `Set for: ${className} (${sub}), default class: the profile class (${user?.class}) does not match its level or subsystem.`)
      : t(`Réglé pour : ${className} (${sub}), classe par défaut : le profil n'a pas de classe.`,
        `Set for: ${className} (${sub}), default class: the profile has no class.`)
  }

  const startGame = (seed) => {
    const s = createMentalSeries(className, family, seed)
    setSeries(s)
    setPlay(createMentalState(s))
    setEntry('')
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
    setSeries(null)
  }

  const handleBackToDashboard = () => {
    setGameState('select')
    setSeries(null)
    setCurrentPage('studentDashboard')
  }

  // Progrès enregistré une fois par calcul résolu, en série principale
  const recordProgress = (state, next) => {
    const after = currentEntry(next)
    if (isRetry(state) || !isResolved(after)) return
    saveUserProgress(user?.id, after.calcId, after.found, null, { gameType: GAME_TYPE_MENTAL_MATH, itemId: after.calcId })
  }

  const handleDigit = (d) => {
    if (tapGuarded() || isResolved(currentEntry(playRef.current))) return
    if (entryRef.current.length >= maxDigits(series)) return
    setEntry(entryRef.current === '0' ? d : entryRef.current + d)
  }

  const handleDelete = () => {
    if (tapGuarded()) return
    setEntry(entryRef.current.slice(0, -1))
  }

  const handleValidate = () => {
    if (tapGuarded() || entryRef.current === '') return
    const state = playRef.current
    const next = submitAnswer(series, state, Number(entryRef.current))
    if (next === state) return
    setPlay(next)
    if (!currentEntry(next).found) setEntry('')
    recordProgress(state, next)
  }

  const handleReveal = () => {
    const state = playRef.current
    const next = revealAnswer(series, state)
    if (next === state) return
    setPlay(next)
    setEntry('')
    recordProgress(state, next)
  }

  const handleNext = () => {
    const state = playRef.current
    const next = nextCalc(series, state)
    if (next === state) return
    advancedAtRef.current = Date.now()
    setPlay(next)
    setEntry('')
    if (!isDone(next)) return
    if (scoreSavedForRef.current !== series) {
      scoreSavedForRef.current = series
      saveScore(user?.id, GAME_TYPE_MENTAL_MATH, mentalScore(next), user?.level, {
        seed: series.seed,
        className,
        subsystem,
        family: series.family,
        calcCount: series.calcs.length,
        foundCount: foundCount(next),
        revealedCount: revealedCount(next),
        errorCount: errorCount(next)
      }).catch(e => console.error('Erreur:', e))
    }
    setGameState('finished')
  }

  if (gameState === 'select') {
    const choices = [MIXED, ...families]
    return (
      <div className="anagram-select pairs-select">
        <div className="anagram-select__container">
          <h1>{title}</h1>
          <p className="anagram-select__intro">
            {t('Calcule de tête, puis tape la réponse sur le pavé.', 'Work it out in your head, then type the answer on the pad.')}
          </p>
          <p className="anagram-select__hint mm-class-line">{classLine()}</p>
          <p className="pairs-select__empty mm-demo" role="note">
            {t('Démonstration : calculs générés, réglages à valider par un enseignant.',
              'Demo: generated sums, settings to be checked by a teacher.')}
          </p>

          <div className="anagram-select__section">
            <span className="anagram-select__label" id="mm-family-label">{t('Calculs', 'Sums')}</span>
            <div className="anagram-select__options mm-families" role="group" aria-labelledby="mm-family-label">
              {choices.map(f => (
                <button
                  key={f}
                  className={`anagram-select__btn mm-family ${family === f ? 'active' : ''}`}
                  onClick={() => setFamily(f)}
                  aria-pressed={family === f}
                >
                  {f === MIXED ? t('Mélange de la classe', 'Class mix') : familyName(f, lang)}
                </button>
              ))}
            </div>
          </div>

          <div className="anagram-select__section">
            <label className="anagram-select__label" htmlFor="mm-seed">
              {t('Numéro de partie (facultatif)', 'Game number (optional)')}
            </label>
            <input
              id="mm-seed"
              className="anagram-select__seed"
              type="text"
              inputMode="numeric"
              value={seedInput}
              onChange={e => setSeedInput(e.target.value)}
              placeholder={t('Laisser vide pour une nouvelle partie', 'Leave empty for a new game')}
              aria-describedby="mm-seed-hint"
            />
            <p id="mm-seed-hint" className="anagram-select__hint">
              {seedError
                ? t('Numéro invalide : un nombre entier de 0 à 4294967295.', 'Invalid number: a whole number from 0 to 4294967295.')
                : t('Avec la même version de l\'application, le même numéro, la même classe et le même choix de calculs donnent la même série.',
                  'With the same version of the app, the same number, class and choice of sums give the same series.')}
            </p>
          </div>

          <button className="anagram-select__start mm-start" onClick={handleStart}>
            {t('Commencer', 'Start')}
          </button>
          <button className="anagram-select__back" onClick={handleBackToDashboard}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>
    )
  }

  if (!series || !play) return null

  const seedLine = `${t('Partie n°', 'Game no.')} ${series.seed} · ${className}`

  if (gameState === 'finished') {
    const found = foundCount(play)
    const revealed = revealedCount(play)
    return (
      <div className="anagram-finished pairs-select">
        <div className="anagram-finished__container">
          <h1>🎉 {t('Série terminée !', 'Series complete!')}</h1>
          <p>
            {t(`Sur ${series.calcs.length} calculs : ${found} trouvés, ${revealed} réponses vues.`,
              `Out of ${series.calcs.length} sums: ${found} found, ${revealed} answers shown.`)}
          </p>
          <p className="anagram-finished__score mm-score">{mentalScore(play)}</p>
          <ul className="mm-recap">
            {series.calcs.map(c => <li key={c.id}>{solvedText(c, lang)}</li>)}
          </ul>
          <p className="anagram-game__seed">{seedLine}</p>
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

  const calc = currentCalc(series, play)
  if (!calc) return null
  const current = currentEntry(play)
  const resolved = isResolved(current)
  const retry = isRetry(play)
  const total = retry ? play.retryIds.length : series.calcs.length

  let message = ''
  if (current.found) message = t('Bravo !', 'Well done!')
  else if (current.revealed) message = solvedText(calc, lang)
  else if (current.errors > 0) message = t('Ce n\'est pas ça. Essaie encore.', 'Not quite. Try again.')

  return (
    <div className="anagram-game mm-game">
      <div className="anagram-game__header">
        <h1>{title}</h1>
        <div className="anagram-game__progress">
          <span className="mm-progress">{t('Calcul', 'Sum')} {play.position + 1} / {total}</span>
          {' · '}{mentalScore(play)} {t('points', 'points')}
        </div>
        <p className="anagram-game__seed">{seedLine}</p>
      </div>

      <div className="anagram-game__card mm-board">
        {retry && (
          <p className="quiz-retry mm-retry" role="status">
            {t('On revoit les calculs', 'Let\'s review the sums')}
          </p>
        )}
        <p className="mm-calc" lang={lang}>{calcText(calc, lang)}</p>
        <p className={`mm-entry ${current.found ? 'mm-entry--found' : ''}`} aria-live="polite" aria-label={t('Ta réponse', 'Your answer')}>
          {entry === '' ? '' : formatNumber(Number(entry), lang)}
        </p>
        <p className="mm-message" role="status" aria-live="polite">{message}</p>
        {showHint(current) && !resolved && <p className="mm-hint" lang={lang}>{calcHint(calc, lang)}</p>}
        {canReveal(current) && (
          <button className="anagram-game__btn anagram-game__btn--secondary mm-reveal" onClick={handleReveal}>
            {t('Voir la réponse', 'Show the answer')}
          </button>
        )}

        <button className="anagram-select__start mm-next" onClick={handleNext} disabled={!resolved}>
          {t('Suivant', 'Next')}
        </button>

        <NumberPad
          onDigit={handleDigit}
          onDelete={handleDelete}
          onValidate={handleValidate}
          disabled={resolved}
          validateDisabled={entry === ''}
          language={lang}
        />

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

import React, { useRef, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { getVocabByLevel, saveScore, saveUserProgress, saveWordSearchGrid } from '../db/index'
import {
  createWordSearchGame,
  cellsBetween,
  findPlacement,
  placementCells,
  isValidSeed,
  newSeed,
  WORD_SEARCH_LEVELS,
  WORD_SEARCH_SETTINGS
} from '../utils/wordSearchGame'
import '../styles/WordSearchGame.css'

const POINTS_PER_WORD = 10 // comme les mots croisés

// Règle d'affichage (décisions du 2026-10-05) : l'élève ne voit que la grille
// et placements[].affichage, et seulement si result.status === 'ok'.
// words, rejected et message (destinés à l'auteur) ne sont jamais affichés.
export default function WordSearchGame() {
  const { user, language, logout } = useAppStore()
  const t = (fr, en) => (language === 'fr' ? fr : en)

  const [level, setLevel] = useState(WORD_SEARCH_LEVELS.includes(user?.level) ? user.level : WORD_SEARCH_LEVELS[0])
  const [seedInput, setSeedInput] = useState('')
  const [seedError, setSeedError] = useState(false)
  const [gameState, setGameState] = useState('select') // select | playing | finished | unavailable
  const [game, setGame] = useState(null)
  const [found, setFound] = useState([]) // indices dans placements
  const [start, setStart] = useState(null)
  const [feedback, setFeedback] = useState('')

  // Empêche un double clic de lancer deux générations (et deux enregistrements)
  const generatingRef = useRef(false)
  const [generating, setGenerating] = useState(false)

  const startGame = async (seed) => {
    if (generatingRef.current) return
    generatingRef.current = true
    setGenerating(true)
    setStart(null)
    setFound([])
    setFeedback('')
    try {
      const vocabulary = await getVocabByLevel(level)
      const g = createWordSearchGame(vocabulary, level, seed)
      const { result } = g
      if (result.status !== 'ok' || result.placements.length === 0) {
        // Information pour l'auteur (console), jamais montrée à l'élève
        console.warn('Mots mêlés : aucune grille utilisable', { level, seed, status: result.status, message: result.message, rejected: result.rejected })
        setGame(null)
        setGameState('unavailable')
        return
      }
      if (result.rejected.length > 0) {
        console.info('Mots mêlés : mots écartés (auteur)', result.rejected)
      }
      await saveWordSearchGrid({
        userId: user?.id ?? null,
        level,
        requestedSeed: result.requestedSeed,
        seed: result.seed,
        size: result.size,
        directions: result.directions,
        wordIds: g.wordIds,
        words: result.words,
        generatorVersion: result.generatorVersion,
        blockedWordsVersion: result.blockedWordsVersion
      })
      setGame(g)
      setGameState('playing')
    } catch (e) {
      console.error('Mots mêlés : erreur de génération', e)
      setGame(null)
      setGameState('unavailable')
    } finally {
      generatingRef.current = false
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

  const handleNewGrid = () => {
    setSeedInput('')
    startGame(newSeed())
  }

  const handleBackToSelect = () => {
    setGameState('select')
    setGame(null)
  }

  // « Retour » qui quitte l'activité : retour à l'écran de connexion
  // (décision d'Isaac du 2026-10-09). handleBackToSelect (retour interne)
  // ne change pas.
  const handleBackToLogin = () => {
    setGameState('select')
    setGame(null)
    logout()
  }

  const finishGame = async (score) => {
    try {
      await saveScore(user?.id, 'wordsearch', score, level)
    } catch (e) {
      console.error('Erreur:', e)
    }
    setGameState('finished')
  }

  const handleCellClick = (row, col) => {
    if (!game) return
    const { result } = game
    if (start === null) {
      setStart({ row, col })
      setFeedback(t('Touche maintenant la dernière lettre du mot.', 'Now tap the last letter of the word.'))
      return
    }
    if (start.row === row && start.col === col) {
      setStart(null)
      setFeedback(t('Sélection annulée.', 'Selection cancelled.'))
      return
    }
    const selection = cellsBetween(start, { row, col }, result.directions)
    const index = findPlacement(result.placements, selection)
    setStart(null)
    if (index === -1) {
      setFeedback(t('Ce n\'est pas un mot de la liste. Essaie encore !', 'That is not a word from the list. Try again!'))
      return
    }
    if (found.includes(index)) {
      setFeedback(t('Mot déjà trouvé.', 'Word already found.'))
      return
    }
    const placement = result.placements[index]
    const newFound = [...found, index]
    setFound(newFound)
    setFeedback(t(`Bravo ! Tu as trouvé ${placement.affichage}.`, `Well done! You found ${placement.affichage}.`))
    const wordIndex = result.words.findIndex(w => w.affichage === placement.affichage)
    if (wordIndex !== -1) saveUserProgress(user?.id, game.wordIds[wordIndex], true, null)
    if (newFound.length === result.placements.length) finishGame(newFound.length * POINTS_PER_WORD)
  }

  if (gameState === 'select') {
    return (
      <div className="wordsearch-select">
        <div className="wordsearch-select__container">
          <h1>{t('Mots Mêlés', 'Word Search')}</h1>
          <p className="wordsearch-select__intro">
            {t('Retrouve les mots de la liste dans la grille. Ils se lisent de gauche à droite ou de haut en bas.',
              'Find the words of the list in the grid. They read from left to right or from top to bottom.')}
          </p>

          <div className="wordsearch-select__section">
            <span className="wordsearch-select__label" id="wordsearch-level-label">{t('Niveau', 'Level')}</span>
            <div className="wordsearch-select__options" role="group" aria-labelledby="wordsearch-level-label">
              {WORD_SEARCH_LEVELS.map(l => (
                <button
                  key={l}
                  className={`wordsearch-select__btn ${level === l ? 'active' : ''}`}
                  onClick={() => setLevel(l)}
                  aria-pressed={level === l}
                >
                  {l}
                  <span className="wordsearch-select__size">
                    {WORD_SEARCH_SETTINGS[l].size}x{WORD_SEARCH_SETTINGS[l].size}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="wordsearch-select__section">
            <label className="wordsearch-select__label" htmlFor="wordsearch-seed">
              {t('Numéro de grille (facultatif)', 'Grid number (optional)')}
            </label>
            <input
              id="wordsearch-seed"
              className="wordsearch-select__seed"
              type="text"
              inputMode="numeric"
              value={seedInput}
              onChange={e => setSeedInput(e.target.value)}
              placeholder={t('Laisser vide pour une nouvelle grille', 'Leave empty for a new grid')}
              aria-describedby="wordsearch-seed-hint"
            />
            <p id="wordsearch-seed-hint" className="wordsearch-select__hint">
              {seedError
                ? t('Numéro invalide : un nombre entier de 0 à 4294967295.', 'Invalid number: a whole number from 0 to 4294967295.')
                : t('Avec la même version de l\'application, le même numéro et le même niveau donnent la même grille (toute la classe peut jouer la même).',
                  'With the same version of the app, the same number and level give the same grid (the whole class can play the same one).')}
            </p>
          </div>

          <button className="wordsearch-select__start" onClick={handleStart} disabled={generating}>
            {t('Commencer', 'Start')}
          </button>
          <button className="wordsearch-select__back" onClick={handleBackToLogin}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>
    )
  }

  if (gameState === 'unavailable') {
    return (
      <div className="wordsearch-select">
        <div className="wordsearch-select__container">
          <h1>{t('Mots Mêlés', 'Word Search')}</h1>
          <p className="wordsearch-select__intro" role="status">
            {t('Cette grille n\'est pas disponible pour le moment. Essaie une nouvelle grille.',
              'This grid is not available right now. Try a new grid.')}
          </p>
          <button className="wordsearch-select__start" onClick={handleNewGrid}>
            {t('Nouvelle grille', 'New grid')}
          </button>
          <button className="wordsearch-select__back" onClick={handleBackToSelect}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>
    )
  }

  if (gameState === 'finished' && game) {
    return (
      <div className="wordsearch-finished">
        <div className="wordsearch-finished__container">
          <h1>🎉 {t('Bravo !', 'Great!')}</h1>
          <p>{t('Tu as trouvé tous les mots.', 'You found all the words.')}</p>
          <p className="wordsearch-finished__score">{found.length * POINTS_PER_WORD}</p>
          <p className="wordsearch-game__seed">
            {t('Grille n°', 'Grid no.')} {game.result.requestedSeed} · {level}
          </p>
          <button className="wordsearch-select__start" onClick={handleNewGrid}>
            {t('Nouvelle grille', 'New grid')}
          </button>
          <button className="wordsearch-select__back" onClick={handleBackToLogin}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>
    )
  }

  if (gameState !== 'playing' || !game) return null

  const { result } = game
  const cellState = {}
  found.forEach(i => placementCells(result.placements[i]).forEach(c => { cellState[`${c.row}-${c.col}`] = 'found' }))
  if (start) cellState[`${start.row}-${start.col}`] = 'start'

  return (
    <div className="wordsearch-game">
      <div className="wordsearch-game__header">
        <h1>{t('Mots Mêlés', 'Word Search')} - {level}</h1>
        <div className="wordsearch-game__progress">
          {found.length} / {result.placements.length} {t('mots', 'words')}
        </div>
        <p className="wordsearch-game__seed">
          {t('Grille n°', 'Grid no.')} {result.requestedSeed}
        </p>
      </div>

      <div className="wordsearch-game__body">
        <div
          className="wordsearch-grid"
          role="group"
          aria-label={t('Grille de lettres', 'Letter grid')}
          style={{ '--ws-size': result.size }}
        >
          {result.grid.map((line, row) =>
            line.map((letter, col) => {
              const state = cellState[`${row}-${col}`]
              return (
                <button
                  key={`${row}-${col}`}
                  className={`wordsearch-grid__cell ${state ? `wordsearch-grid__cell--${state}` : ''}`}
                  onClick={() => handleCellClick(row, col)}
                  aria-pressed={state === 'start'}
                  aria-label={t(`${letter}, ligne ${row + 1}, colonne ${col + 1}`, `${letter}, row ${row + 1}, column ${col + 1}`)}
                >
                  {letter}
                </button>
              )
            })
          )}
        </div>

        <div className="wordsearch-game__side">
          <h2>{t('Mots à trouver', 'Words to find')}</h2>
          <ul className="wordsearch-words">
            {result.placements.map((p, i) => (
              <li key={p.affichage} className={found.includes(i) ? 'wordsearch-words__item--found' : ''}>
                {found.includes(i) ? <s>{p.affichage}</s> : p.affichage}
                {found.includes(i) && <span className="wordsearch-sr-only">{t(' (trouvé)', ' (found)')}</span>}
              </li>
            ))}
          </ul>
          <p className="wordsearch-game__feedback" role="status" aria-live="polite">{feedback}</p>
          <p className="wordsearch-game__help">
            {t('Touche la première lettre du mot, puis la dernière.', 'Tap the first letter of the word, then the last one.')}
          </p>
          <div className="wordsearch-game__actions">
            <button className="wordsearch-game__btn" onClick={handleNewGrid}>
              {t('Nouvelle grille', 'New grid')}
            </button>
            <button className="wordsearch-game__btn wordsearch-game__btn--secondary" onClick={handleBackToSelect}>
              {t('Retour', 'Back')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

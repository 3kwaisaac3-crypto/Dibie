import React, { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../stores/appStore'
import { getVocabByLevel, getVocabByLevelAndSubject, getAllLevels, saveUserProgress, saveScore } from '../db/index'
import EclipseGrid from '../components/EclipseGrid'
import { crosswordSubjects, defaultCrosswordSubject, createCrosswordGame } from '../utils/crosswordLayout'
import { newSeed, isValidSeed } from '../utils/wordSearchGame'
import '../styles/CrosswordGame.css'

const PUZZLE_TYPES = ['Bilingue', 'Français', 'Anglais']

export default function CrosswordGame() {
  const { user, language, setCurrentPage } = useAppStore()
  const [levels, setLevels] = useState([])
  const [level, setLevel] = useState('')
  const [subject, setSubject] = useState('')
  const [puzzleType, setPuzzleType] = useState('Bilingue')
  const [gameState, setGameState] = useState('select')
  const [vocabulary, setVocabulary] = useState([])
  // Grille en cours (createCrosswordGame) et numéro de grille saisi
  const [game, setGame] = useState(null)
  // Au moins une lettre saisie dans la grille (fourni par EclipseGrid)
  const [hasLetters, setHasLetters] = useState(false)
  // Petite boîte de confirmation avant d'abandonner une partie commencée
  const [confirmNewGrid, setConfirmNewGrid] = useState(false)
  const cancelNewGridRef = useRef(null)
  const [seedInput, setSeedInput] = useState('')
  const [seedError, setSeedError] = useState(false)
  const [score, setScore] = useState(0)
  const [answered, setAnswered] = useState([])
  // Mots réellement placés dans la grille (au plus 10), fournis par EclipseGrid
  const [placedCount, setPlacedCount] = useState(0)
  // Mots déjà comptés, lus et mis à jour immédiatement : une lettre de
  // croisement peut compléter deux mots dans le même événement
  const answeredRef = useRef(new Set())
  // Sujets du niveau choisi : [{ subject, playable }] (playable = au moins
  // 2 mots placés pour le type choisi) ; null tant que le calcul n'est pas fait
  const [subjectList, setSubjectList] = useState(null)
  // Niveau pour lequel le sujet par défaut a déjà été choisi
  const subjectLevelRef = useRef(null)

  // Charger les niveaux disponibles depuis les données
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const lvls = await getAllLevels()
      if (cancelled) return
      setLevels(lvls)
      setLevel(prev => prev || lvls[0] || '')
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (gameState !== 'select') return
    if (!level) return
    if (!subject) {
      setVocabulary([])
      return
    }
    const loadVocab = async () => {
      try {
        const data = await getVocabByLevelAndSubject(level, subject)
        // Toutes les entrées du sujet : les mots de la grille sont tirés au hasard
        setVocabulary((data && data.length > 0) ? data : [])
      } catch (err) {
        console.error('Erreur:', err)
        setVocabulary([])
      }
    }
    loadVocab()
  }, [level, subject, gameState])

  // Sujets du niveau, grisés s'ils sont injouables (voir isPlayableCrossword)
  useEffect(() => {
    if (gameState !== 'select') return
    if (!level) return
    let cancelled = false
    const check = async () => {
      let list = []
      try {
        list = crosswordSubjects(await getVocabByLevel(level), puzzleType)
      } catch (err) {
        console.error('Erreur:', err)
      }
      if (cancelled) return
      setSubjectList(list)
      // Premier affichage ou changement de niveau : sujet jouable par défaut.
      // Changement de type seul : le choix est gardé, même s'il devient grisé.
      if (subjectLevelRef.current !== level) {
        subjectLevelRef.current = level
        setSubject(prev => defaultCrosswordSubject(list, prev))
      }
    }
    check()
    return () => { cancelled = true }
  }, [level, puzzleType, gameState])

  const noPlayableSubject = subjectList !== null && !subjectList.some(s => s.playable)
  const subjectUnavailable = subjectList !== null && subject !== '' &&
    !subjectList.some(s => s.subject === subject && s.playable)
  const canStart = vocabulary.length > 0 && subjectList !== null && subject !== '' && !subjectUnavailable

  // Lance la grille de cette graine ; indisponible (rare) si aucun tirage
  // ne place au moins 2 mots
  const startGame = (seed) => {
    const g = createCrosswordGame(vocabulary, puzzleType, seed)
    setScore(0)
    setAnswered([])
    setPlacedCount(0)
    answeredRef.current = new Set()
    setHasLetters(false)
    setConfirmNewGrid(false)
    setGame(g)
    setGameState(g ? 'playing' : 'unavailable')
  }

  const handleStartGame = () => {
    if (!canStart) return
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

  const startNewGrid = () => {
    setSeedInput('')
    setSeedError(false)
    startGame(newSeed())
  }

  // En cours de partie, avec au moins une lettre saisie ou un mot trouvé :
  // demander confirmation ; partie vide, terminée ou indisponible : directement
  const handleNewGrid = () => {
    if (gameState === 'playing' && (hasLetters || answered.length > 0)) {
      setConfirmNewGrid(true)
      return
    }
    startNewGrid()
  }

  // Focus sur « Non, continuer » à l'ouverture de la boîte (choix le plus sûr)
  useEffect(() => {
    if (confirmNewGrid) cancelNewGridRef.current?.focus()
  }, [confirmNewGrid])

  const handleAnswerCorrect = async (wordId) => {
    if (answeredRef.current.has(wordId)) return
    answeredRef.current.add(wordId)
    setScore(prev => prev + 10)
    setAnswered(prev => [...prev, wordId])
    try {
      await saveUserProgress(user?.id, wordId, true, 30)
    } catch (e) {
      console.error('Erreur:', e)
    }
  }

  // Lettre effacée ou remplacée dans un mot trouvé : le mot n'est plus compté.
  // Limite : l'enregistrement déjà fait par saveUserProgress n'est pas supprimé.
  const handleAnswerRemoved = (wordId) => {
    if (!answeredRef.current.has(wordId)) return
    answeredRef.current.delete(wordId)
    setScore(prev => prev - 10)
    setAnswered(prev => prev.filter(id => id !== wordId))
  }

  const handleFinishGame = async () => {
    try {
      await saveScore(user?.id, 'crossword', score, level, {
        subject,
        puzzleType,
        seed: game?.seed,
        requestedSeed: game?.requestedSeed
      })
    } catch (e) {
      console.error('Erreur:', e)
    }
    setGameState('finished')
  }

  const handleBackToDashboard = () => {
    setGameState('select')
    setCurrentPage('studentDashboard')
  }

  if (gameState === 'select') {
    return (
      <div className="crossword-select">
        <div className="crossword-select__container">
          <h1>{language === 'fr' ? 'Mots croisés' : 'Crossword'}</h1>

          <div className="crossword-select__section">
            <label>{language === 'fr' ? 'Type de Puzzle' : 'Puzzle Type'}</label>
            <div className="crossword-select__options">
              {PUZZLE_TYPES.map(t => (
                <button key={t} className={`crossword-select__btn ${puzzleType === t ? 'active' : ''}`} onClick={() => setPuzzleType(t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="crossword-select__section">
            <label>{language === 'fr' ? 'Niveau' : 'Level'}</label>
            <div className="crossword-select__options">
              {levels.map(l => (
                <button key={l} className={`crossword-select__btn ${level === l ? 'active' : ''}`} onClick={() => setLevel(l)}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="crossword-select__section">
            <label>{language === 'fr' ? 'Sujet' : 'Subject'}</label>
            <div className="crossword-select__grid">
              {(subjectList || []).map(({ subject: s, playable }) => {
                const unavailable = !playable
                return (
                  <button
                    key={s}
                    className={`crossword-select__subject ${subject === s ? 'active' : ''}`}
                    onClick={() => setSubject(s)}
                    disabled={unavailable}
                  >
                    {s}
                    {unavailable && (
                      <span className="crossword-select__soon">
                        {language === 'fr' ? 'bientôt disponible' : 'coming soon'}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="crossword-select__section">
            <label htmlFor="crossword-seed">
              {language === 'fr' ? 'Numéro de grille (facultatif)' : 'Grid number (optional)'}
            </label>
            <input
              id="crossword-seed"
              className="crossword-select__seed"
              type="text"
              inputMode="numeric"
              value={seedInput}
              onChange={e => setSeedInput(e.target.value)}
              placeholder={language === 'fr' ? 'Laisser vide pour une nouvelle grille' : 'Leave empty for a new grid'}
              aria-describedby="crossword-seed-hint"
            />
            <p id="crossword-seed-hint" className="crossword-select__hint">
              {seedError
                ? (language === 'fr' ? 'Numéro invalide : un nombre entier de 0 à 4294967295.' : 'Invalid number: a whole number from 0 to 4294967295.')
                : (language === 'fr'
                    ? 'Avec la même version de l\'application, le même numéro, le même niveau, le même type et le même sujet donnent la même grille.'
                    : 'With the same version of the app, the same number, level, type and subject give the same grid.')}
            </p>
          </div>

          <button className="crossword-select__start" onClick={handleStartGame} disabled={!canStart}>
            {language === 'fr' ? 'Commencer' : 'Start'}
          </button>
          {noPlayableSubject && (
            <p className="crossword-select__hint">
              {language === 'fr'
                ? 'Aucun sujet ne permet encore une grille pour ce niveau et ce type.'
                : 'No subject can make a grid yet for this level and type.'}
            </p>
          )}
          {!noPlayableSubject && subjectUnavailable && (
            <p className="crossword-select__hint">
              {language === 'fr'
                ? 'Pas assez de mots pour une grille sur ce sujet : choisis un autre sujet.'
                : 'Not enough words for a grid on this subject: choose another subject.'}
            </p>
          )}
          {/* Filet de sécurité */}
          {subject !== '' && !subjectUnavailable && subjectList !== null && vocabulary.length === 0 && (
            <p className="crossword-select__hint">
              {language === 'fr' ? 'Aucun mot disponible pour ce niveau/sujet.' : 'No words available for this level/subject.'}
            </p>
          )}
        </div>
      </div>
    )
  }

  if (gameState === 'unavailable') {
    return (
      <div className="crossword-finished">
        <div className="crossword-finished__container">
          <p role="status">
            {language === 'fr'
              ? 'Cette grille n\'est pas disponible pour le moment. Essaie une nouvelle grille.'
              : 'This grid is not available right now. Try a new grid.'}
          </p>
          <button className="crossword-finished__button" onClick={handleNewGrid}>
            {language === 'fr' ? 'Nouvelle grille' : 'New grid'}
          </button>
          <button className="crossword-finished__button" onClick={() => setGameState('select')}>
            {language === 'fr' ? 'Retour' : 'Back'}
          </button>
        </div>
      </div>
    )
  }

  if (gameState === 'playing') {
    return (
      <div className="crossword-game">
        <div className="crossword-game__header">
          <h1>{level} ({puzzleType})</h1>
          <p className="crossword-game__seed">
            {language === 'fr' ? 'Grille n°' : 'Grid no.'} {game?.seed}
          </p>
          <div className="crossword-game__score">Score: <strong>{score}</strong></div>
        </div>
        <div className="crossword-game__container">
          {game ? (
            <>
              <EclipseGrid
                game={game}
                language={language}
                onAnswerCorrect={handleAnswerCorrect}
                onAnswerRemoved={handleAnswerRemoved}
                onBack={() => setGameState('select')}
                onWordsPlaced={setPlacedCount}
                onLettersChange={setHasLetters}
                subject={subject}
              />
              <div className="crossword-game__progress">
                <p>{answered.length} / {placedCount} {language === 'fr' ? 'mots' : 'words'}</p>
                {placedCount > 0 && answered.length >= Math.floor(placedCount * 0.7) && (
                  <button className="crossword-game__finish" onClick={handleFinishGame}>
                    {language === 'fr' ? 'Terminer' : 'Finish'}
                  </button>
                )}
                <button className="crossword-game__new" onClick={handleNewGrid}>
                  {language === 'fr' ? 'Nouvelle grille' : 'New grid'}
                </button>
              </div>
              {confirmNewGrid && (
                <div className="crossword-confirm__overlay">
                  <div
                    className="crossword-confirm"
                    role="alertdialog"
                    aria-modal="true"
                    aria-labelledby="crossword-confirm-text"
                    onKeyDown={e => { if (e.key === 'Escape') setConfirmNewGrid(false) }}
                  >
                    <p id="crossword-confirm-text">
                      {language === 'fr'
                        ? 'Abandonner cette grille et en commencer une nouvelle ? Les mots trouvés ne seront pas comptés.'
                        : 'Leave this grid and start a new one? The words you found will not be counted.'}
                    </p>
                    <div className="crossword-confirm__buttons">
                      <button ref={cancelNewGridRef} className="crossword-confirm__cancel" onClick={() => setConfirmNewGrid(false)}>
                        {language === 'fr' ? 'Non, continuer' : 'No, keep playing'}
                      </button>
                      <button className="crossword-confirm__ok" onClick={startNewGrid}>
                        {language === 'fr' ? 'Oui, nouvelle grille' : 'Yes, new grid'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="crossword-game__loading">
              {language === 'fr' ? 'Aucun mot' : 'No words'}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (gameState === 'finished') {
    return (
      <div className="crossword-finished">
        <div className="crossword-finished__container">
          <h1>🎉 {language === 'fr' ? 'Bravo!' : 'Great!'}</h1>
          <div className="crossword-finished__score">
            <p className="crossword-finished__score-value">{score}</p>
          </div>
          <p className="crossword-game__seed">
            {language === 'fr' ? 'Grille n°' : 'Grid no.'} {game?.seed} · {subject}
          </p>
          <button className="crossword-finished__button" onClick={handleNewGrid}>
            {language === 'fr' ? 'Nouvelle grille' : 'New grid'}
          </button>
          <button className="crossword-finished__button" onClick={handleBackToDashboard}>
            {language === 'fr' ? 'Retour' : 'Back'}
          </button>
        </div>
      </div>
    )
  }
}

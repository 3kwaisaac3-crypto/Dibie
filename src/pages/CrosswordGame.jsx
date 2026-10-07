import React, { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../stores/appStore'
import { getVocabByLevel, getVocabByLevelAndSubject, getAllLevels, saveUserProgress, saveScore } from '../db/index'
import EclipseGrid from '../components/EclipseGrid'
import { crosswordSubjects, defaultCrosswordSubject, VOCAB_PER_GAME } from '../utils/crosswordLayout'
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
        setVocabulary((data && data.length > 0) ? data.slice(0, VOCAB_PER_GAME) : [])
      } catch (err) {
        console.error('Erreur:', err)
        setVocabulary([])
      }
    }
    loadVocab()
  }, [level, subject, gameState])

  // Sujets du niveau, grisés s'ils sont injouables : la grille est déterministe
  // (mêmes entrées, même ordre, même générateur), on calcule donc exactement
  // celle qui serait proposée et on compte ses mots placés.
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

  const handleStartGame = () => {
    if (!canStart) return
    setGameState('playing')
    setScore(0)
    setAnswered([])
    setPlacedCount(0)
    answeredRef.current = new Set()
  }

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

  const handleFinishGame = async () => {
    try {
      await saveScore(user?.id, 'crossword', score, level)
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
          <h1>{language === 'fr' ? 'Mots Croisés' : 'Crossword'}</h1>

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

  if (gameState === 'playing') {
    return (
      <div className="crossword-game">
        <div className="crossword-game__header">
          <h1>{subject} - {level} ({puzzleType})</h1>
          <div className="crossword-game__score">Score: <strong>{score}</strong></div>
        </div>
        <div className="crossword-game__container">
          {vocabulary.length > 0 ? (
            <>
              <EclipseGrid 
                words={vocabulary} 
                language={language} 
                onAnswerCorrect={handleAnswerCorrect}
                onBack={() => setGameState('select')}
                puzzleType={puzzleType} 
                onWordsPlaced={setPlacedCount}
              />
              <div className="crossword-game__progress">
                <p>{answered.length} / {placedCount} {language === 'fr' ? 'mots' : 'words'}</p>
                {placedCount > 0 && answered.length >= Math.floor(placedCount * 0.7) && (
                  <button className="crossword-game__finish" onClick={handleFinishGame}>
                    {language === 'fr' ? 'Terminer' : 'Finish'}
                  </button>
                )}
              </div>
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
          <button className="crossword-finished__button" onClick={handleBackToDashboard}>
            {language === 'fr' ? 'Retour' : 'Back'}
          </button>
        </div>
      </div>
    )
  }
}

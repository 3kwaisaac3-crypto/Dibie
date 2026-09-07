import React, { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { getVocabByLevelAndSubject, saveUserProgress, saveScore } from '../db/index'
import EclipseGrid from '../components/EclipseGrid'
import '../styles/CrosswordGame.css'
const SUBJECTS = ['Maison', 'Transport', 'Alimentation', 'Géométrie', 'Mesures', 'Agriculture', 'Commerce', 'Métiers']
const LEVELS = ['SIL-CP', 'CE1-CE2', 'CM1-CM2']
const PUZZLE_TYPES = ['Bilingue', 'Français', 'Anglais']

export default function CrosswordGame() {
  const { user, language, setCurrentPage } = useAppStore()
  const [level, setLevel] = useState(LEVELS[0])
  const [subject, setSubject] = useState(SUBJECTS[0])
  const [puzzleType, setPuzzleType] = useState('Bilingue')
  const [gameState, setGameState] = useState('select')
  const [vocabulary, setVocabulary] = useState([])
  const [score, setScore] = useState(0)
  const [answered, setAnswered] = useState([])

  useEffect(() => {
    if (gameState !== 'select') return
    const loadVocab = async () => {
      try {
        const data = await getVocabByLevelAndSubject(level, subject)
        if (data && data.length > 0) {
          setVocabulary(data.slice(0, 12))
        } else {
          setVocabulary([])
        }
      } catch (err) {
        console.error('Erreur:', err)
        setVocabulary([])
      }
    }
    loadVocab()
  }, [level, subject, gameState])

  const handleStartGame = () => {
    if (vocabulary.length === 0) return
    setGameState('playing')
    setScore(0)
    setAnswered([])
  }

  const handleAnswerCorrect = async (wordId) => {
    if (answered.includes(wordId)) return
    const newScore = score + 10
    setScore(newScore)
    setAnswered([...answered, wordId])
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
              {LEVELS.map(l => (
                <button key={l} className={`crossword-select__btn ${level === l ? 'active' : ''}`} onClick={() => setLevel(l)}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="crossword-select__section">
            <label>{language === 'fr' ? 'Sujet' : 'Subject'}</label>
            <div className="crossword-select__grid">
              {SUBJECTS.map(s => (
                <button key={s} className={`crossword-select__subject ${subject === s ? 'active' : ''}`} onClick={() => setSubject(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <button className="crossword-select__start" onClick={handleStartGame} disabled={vocabulary.length === 0}>
            {language === 'fr' ? 'Commencer' : 'Start'}
          </button>
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
/>
              <div className="crossword-game__progress">
                <p>{answered.length} / {vocabulary.length} {language === 'fr' ? 'mots' : 'words'}</p>
                {answered.length >= Math.floor(vocabulary.length * 0.7) && (
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
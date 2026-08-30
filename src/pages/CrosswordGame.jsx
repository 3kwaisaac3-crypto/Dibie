import React, { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { getVocabByLevelAndSubject, saveUserProgress, saveScore } from '../db/index'
import CrosswordGrid from '../components/CrosswordGrid'
import '../styles/CrosswordGame.css'

const SUBJECTS = [
  'Maison', 'Transport', 'Alimentation', 'Géométrie', 
  'Mesures', 'Agriculture', 'Commerce', 'Métiers',
  'Musique', 'Informatique', 'Hygiène', 'Sciences'
]

const LEVELS = ['SIL-CP', 'CE1-CE2', 'CM1-CM2']

export default function CrosswordGame() {
  const { user, language, setCurrentPage } = useAppStore()
  const [level, setLevel] = useState(LEVELS[0])
  const [subject, setSubject] = useState(SUBJECTS[0])
  const [gameState, setGameState] = useState('select') // select, playing, finished
  const [vocabulary, setVocabulary] = useState([])
  const [score, setScore] = useState(0)
  const [answered, setAnswered] = useState([])

  // Charger vocabulaire quand niveau/sujet changent
  useEffect(() => {
    if (gameState === 'select') return
    
    const loadVocab = async () => {
      const data = await getVocabByLevelAndSubject(level, subject)
      // Prendre max 5 mots pour la grille
      setVocabulary(data.slice(0, 5))
    }
    
    loadVocab()
  }, [level, subject, gameState])

  const handleStartGame = () => {
    setGameState('playing')
    setScore(0)
    setAnswered([])
  }

  const handleAnswerCorrect = async (wordId) => {
    const newScore = score + 10
    setScore(newScore)
    setAnswered([...answered, wordId])
    
    // Sauvegarder progrès
    await saveUserProgress(user?.id, wordId, true, 30)
  }

  const handleFinishGame = async () => {
    // Sauvegarder score final
    await saveScore(user?.id, 'crossword', score, level)
    setGameState('finished')
  }

  const handleBackToDashboard = () => {
    setGameState('select')
    setCurrentPage('studentDashboard')
  }

  // État de sélection
  if (gameState === 'select') {
    return (
      <div className="crossword-select">
        <div className="crossword-select__container">
          <h1>{language === 'fr' ? 'Mots Croisés' : 'Crossword Puzzle'}</h1>
          
          <div className="crossword-select__section">
            <label>{language === 'fr' ? 'Niveau' : 'Level'}</label>
            <div className="crossword-select__options">
              {LEVELS.map(l => (
                <button
                  key={l}
                  className={`crossword-select__btn ${level === l ? 'active' : ''}`}
                  onClick={() => setLevel(l)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="crossword-select__section">
            <label>{language === 'fr' ? 'Sujet' : 'Subject'}</label>
            <div className="crossword-select__grid">
              {SUBJECTS.map(s => (
                <button
                  key={s}
                  className={`crossword-select__subject ${subject === s ? 'active' : ''}`}
                  onClick={() => setSubject(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <button className="crossword-select__start" onClick={handleStartGame}>
            {language === 'fr' ? 'Commencer' : 'Start'}
          </button>
        </div>
      </div>
    )
  }

  // État du jeu
  if (gameState === 'playing') {
    return (
      <div className="crossword-game">
        <div className="crossword-game__header">
          <h1>{subject} - {level}</h1>
          <div className="crossword-game__score">
            Score: <strong>{score}</strong>
          </div>
        </div>

        <div className="crossword-game__container">
          {vocabulary.length > 0 ? (
            <>
              <CrosswordGrid 
                words={vocabulary}
                language={language}
                onAnswerCorrect={handleAnswerCorrect}
              />
              
              <div className="crossword-game__progress">
                <p>{answered.length} / {vocabulary.length} {language === 'fr' ? 'mots trouvés' : 'words found'}</p>
                {answered.length === vocabulary.length && (
                  <button 
                    className="crossword-game__finish"
                    onClick={handleFinishGame}
                  >
                    {language === 'fr' ? 'Terminer' : 'Finish'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="crossword-game__loading">
              {language === 'fr' ? 'Chargement...' : 'Loading...'}
            </div>
          )}
        </div>
      </div>
    )
  }

  // État finalisé
  if (gameState === 'finished') {
    return (
      <div className="crossword-finished">
        <div className="crossword-finished__container">
          <h1>🎉 {language === 'fr' ? 'Bravo!' : 'Great Job!'}</h1>
          <div className="crossword-finished__score">
            <p className="crossword-finished__score-value">{score}</p>
            <p className="crossword-finished__score-label">
              {language === 'fr' ? 'points' : 'points'}
            </p>
          </div>
          
          <button 
            className="crossword-finished__button"
            onClick={handleBackToDashboard}
          >
            {language === 'fr' ? 'Retour au tableau de bord' : 'Back to dashboard'}
          </button>
        </div>
      </div>
    )
  }
}

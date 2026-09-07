import React, { useState, useEffect } from 'react'
import '../styles/CrosswordGrid.css'

export default function CrosswordGrid({ words, language, onAnswerCorrect }) {
  const [clues, setClues] = useState([])
  const [userAnswers, setUserAnswers] = useState({})

  useEffect(() => {
    if (!words || words.length === 0) return

    // Créer les indices (pas les réponses)
    const cluesList = words.map((word, idx) => {
      const isFrench = idx % 2 === 0
      return {
        id: `clue_${idx}`,
        number: idx + 1,
        text: isFrench ? word.def_fr : word.def_en,
        direction: isFrench ? 'horizontal' : 'vertical',
        answer: isFrench ? word.mot_fr : word.mot_en,
        wordId: word.id,
        language: isFrench ? 'FR' : 'EN'
      }
    })

    setClues(cluesList)
  }, [words])

  const handleInputChange = (clueId, value) => {
    const newAnswers = { ...userAnswers, [clueId]: value.toUpperCase() }
    setUserAnswers(newAnswers)

    // Vérifier la réponse
    const clue = clues.find(c => c.id === clueId)
    if (clue && value.toUpperCase() === clue.answer.toUpperCase()) {
      onAnswerCorrect(clue.wordId)
      // Feedback visuel
      setTimeout(() => {
        const input = document.getElementById(clueId)
        if (input) input.style.backgroundColor = '#90EE90'
      }, 100)
    }
  }

  if (clues.length === 0) {
    return <div style={{padding: '20px', textAlign: 'center'}}>Chargement indices...</div>
  }

  return (
    <div className="crossword-grid">
      <div className="crossword-grid__container">
        {/* Indices horizontaux */}
        <div className="crossword-grid__clues">
          <h3>
            {language === 'fr' ? '📍 Horizontalement (Français)' : '📍 Across (French)'}
          </h3>
          <div className="crossword-grid__clues-list">
            {clues.filter(c => c.language === 'FR').map(clue => (
              <div key={clue.id} className="crossword-grid__clue-item">
                <label className="crossword-grid__clue-number">{clue.number}.</label>
                <div className="crossword-grid__clue-text">{clue.text}</div>
                <input
                  id={clue.id}
                  type="text"
                  placeholder={`${clue.answer.length} ${language === 'fr' ? 'lettres' : 'letters'}`}
                  value={userAnswers[clue.id] || ''}
                  onChange={(e) => handleInputChange(clue.id, e.target.value)}
                  maxLength={clue.answer.length}
                  className="crossword-grid__input"
                />
                <div className="crossword-grid__hint">
                  {clue.answer.length} {language === 'fr' ? 'lettres' : 'letters'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Indices verticaux */}
        <div className="crossword-grid__clues">
          <h3>
            {language === 'fr' ? '📍 Verticalement (Anglais)' : '📍 Down (English)'}
          </h3>
          <div className="crossword-grid__clues-list">
            {clues.filter(c => c.language === 'EN').map(clue => (
              <div key={clue.id} className="crossword-grid__clue-item">
                <label className="crossword-grid__clue-number">{clue.number}.</label>
                <div className="crossword-grid__clue-text">{clue.text}</div>
                <input
                  id={clue.id}
                  type="text"
                  placeholder={`${clue.answer.length} ${language === 'fr' ? 'lettres' : 'letters'}`}
                  value={userAnswers[clue.id] || ''}
                  onChange={(e) => handleInputChange(clue.id, e.target.value)}
                  maxLength={clue.answer.length}
                  className="crossword-grid__input"
                />
                <div className="crossword-grid__hint">
                  {clue.answer.length} {language === 'fr' ? 'lettres' : 'letters'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
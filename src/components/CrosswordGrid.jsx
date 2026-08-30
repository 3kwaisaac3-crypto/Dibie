import React, { useState, useEffect } from 'react'
import '../styles/CrosswordGrid.css'

export default function CrosswordGrid({ words, language, onAnswerCorrect }) {
  const [gridSize, setGridSize] = useState(15)
  const [grid, setGrid] = useState([])
  const [userAnswers, setUserAnswers] = useState({})
  const [clues, setClues] = useState([])

  useEffect(() => {
    generateCrossword()
  }, [words])

  const generateCrossword = () => {
    // Créer une grille simple de mots croisés
    const newGrid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(0))
    const cluesList = []
    
    let wordCount = 0
    
    // Placer les mots dans la grille (simplifié)
    words.forEach((word, idx) => {
      const isFrench = idx % 2 === 0
      const text = isFrench ? word.mot_fr : word.mot_en
      const startRow = idx * 2
      const startCol = idx
      
      if (startRow < gridSize) {
        for (let i = 0; i < text.length && startCol + i < gridSize; i++) {
          newGrid[startRow][startCol + i] = text[i]
        }
        
        cluesList.push({
          id: `${idx}-${isFrench ? 'h' : 'v'}`,
          number: wordCount++,
          text: isFrench ? word.def_fr : word.def_en,
          direction: 'horizontal',
          word: text,
          wordId: word.id
        })
      }
    })
    
    setGrid(newGrid)
    setClues(cluesList)
  }

  const handleInputChange = (clueId, value) => {
    const newAnswers = { ...userAnswers, [clueId]: value.toUpperCase() }
    setUserAnswers(newAnswers)
    
    // Vérifier la réponse
    const clue = clues.find(c => c.id === clueId)
    if (clue && value.toUpperCase() === clue.word.toUpperCase()) {
      onAnswerCorrect(clue.wordId)
    }
  }

  return (
    <div className="crossword-grid">
      <div className="crossword-grid__container">
        {/* Grille visuelle */}
        <div className="crossword-grid__board">
          {grid.map((row, rowIdx) => (
            <div key={rowIdx} className="crossword-grid__row">
              {row.map((cell, colIdx) => (
                <div
                  key={`${rowIdx}-${colIdx}`}
                  className={`crossword-grid__cell ${cell ? 'active' : 'empty'}`}
                >
                  {cell && <span>{cell}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Indices et réponses */}
        <div className="crossword-grid__clues">
          <h3>{language === 'fr' ? 'Horizontalement' : 'Across'}</h3>
          <div className="crossword-grid__clues-list">
            {clues.filter(c => c.direction === 'horizontal').map(clue => (
              <div key={clue.id} className="crossword-grid__clue-item">
                <label>{clue.number}. {clue.text}</label>
                <input
                  type="text"
                  placeholder="..."
                  value={userAnswers[clue.id] || ''}
                  onChange={(e) => handleInputChange(clue.id, e.target.value)}
                  maxLength={clue.word.length}
                />
                <div className="crossword-grid__hint">
                  {language === 'fr' ? `${clue.word.length} lettres` : `${clue.word.length} letters`}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

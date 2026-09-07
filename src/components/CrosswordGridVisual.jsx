import React, { useState, useEffect } from 'react'
import { CrosswordGenerator } from '../utils/crosswordGenerator'
import '../styles/CrosswordGridVisual.css'

const GRID_SIZE = 15

export default function CrosswordGridVisual({ words, language, onAnswerCorrect, onBack, puzzleType }) {
  const [grid, setGrid] = useState([])
  const [placedWords, setPlacedWords] = useState([])
  const [userAnswers, setUserAnswers] = useState({})
  const [solved, setSolved] = useState(new Set())
  const [selectedCell, setSelectedCell] = useState(null)
  const [selectedDirection, setSelectedDirection] = useState('across')

  useEffect(() => {
    if (!words || words.length < 2) return

    const wordsData = words.slice(0, 10).map((w, idx) => {
      let text, definition
      
      if (puzzleType === 'Français') {
        text = w.mot_fr.toUpperCase()
        definition = w.def_fr
      } else if (puzzleType === 'Anglais') {
        text = w.mot_en.toUpperCase()
        definition = w.def_en
      } else {
        const isAcross = idx % 2 === 0
        text = (isAcross ? w.mot_fr : w.mot_en).toUpperCase()
        definition = isAcross ? w.def_fr : w.def_en
      }
      
      return { id: w.id, text, definition }
    })

    const gen = new CrosswordGenerator(wordsData, GRID_SIZE)
    const { grid: g, words: pw } = gen.generate()

    setGrid(g)
    setPlacedWords(pw)
    setUserAnswers({})
    setSolved(new Set())
  }, [words, puzzleType])

  const handleCellInput = (row, col, value) => {
    const letter = value.toUpperCase().slice(-1)
    const key = `${row}-${col}`
    
    const newAnswers = { ...userAnswers, [key]: letter }
    setUserAnswers(newAnswers)

    // Vérifier tous les mots contenant cette cellule
    placedWords.forEach(w => {
      const cellInWord = 
        (w.direction === 'across' && w.row === row && col >= w.col && col < w.col + w.text.length) ||
        (w.direction === 'down' && w.col === col && row >= w.row && row < w.row + w.text.length)
      
      if (!cellInWord) return

      let userWord = ''
      if (w.direction === 'across') {
        for (let c = w.col; c < w.col + w.text.length; c++) {
          userWord += newAnswers[`${w.row}-${c}`] || ''
        }
      } else {
        for (let r = w.row; r < w.row + w.text.length; r++) {
          userWord += newAnswers[`${r}-${w.col}`] || ''
        }
      }

      if (userWord.length === w.text.length && userWord === w.text) {
        if (!solved.has(w.clueNum)) {
          setSolved(prev => new Set([...prev, w.clueNum]))
          onAnswerCorrect(w.id)
        }
      }
    })

    // Auto-move next cell
    if (letter) {
      moveToNextCell(row, col, selectedDirection)
    }
  }

  const moveToNextCell = (row, col, dir) => {
    if (dir === 'across') {
      for (let c = col + 1; c < GRID_SIZE; c++) {
        if (grid[row]?.[c]) { setSelectedCell({ row, col: c }); return }
      }
    } else {
      for (let r = row + 1; r < GRID_SIZE; r++) {
        if (grid[r]?.[col]) { setSelectedCell({ row: r, col }); return }
      }
    }
  }

  const handleCellClick = (row, col) => {
    if (!grid[row]?.[col]) return
    setSelectedCell({ row, col })
    
    // Déterminer direction basée sur le clue
    const wordAtCell = placedWords.find(w => {
      if (w.direction === 'across') return w.row === row && col >= w.col && col < w.col + w.text.length
      return w.col === col && row >= w.row && row < w.row + w.text.length
    })
    
    if (wordAtCell) setSelectedDirection(wordAtCell.direction)
  }

  const handleKeyDown = (e, row, col) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      let c = col + 1
      while (c < GRID_SIZE && !grid[row]?.[c]) c++
      if (c < GRID_SIZE) handleCellClick(row, c)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      let c = col - 1
      while (c >= 0 && !grid[row]?.[c]) c--
      if (c >= 0) handleCellClick(row, c)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      let r = row + 1
      while (r < GRID_SIZE && !grid[r]?.[col]) r++
      if (r < GRID_SIZE) handleCellClick(r, col)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      let r = row - 1
      while (r >= 0 && !grid[r]?.[col]) r--
      if (r >= 0) handleCellClick(r, col)
    }
  }

  if (!grid.length) return <div style={{ padding: '20px' }}>Génération grille...</div>

  const acrossClues = placedWords.filter(w => w.direction === 'across').sort((a, b) => a.clueNum - b.clueNum)
  const downClues = placedWords.filter(w => w.direction === 'down').sort((a, b) => a.clueNum - b.clueNum)

  return (
    <div className="crossword-eclipse">
      <div style={{ marginBottom: '15px' }}>
        <button onClick={onBack} style={{ padding: '10px 20px', backgroundColor: '#667eea', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
          ← {language === 'fr' ? 'Retour' : 'Back'}
        </button>
      </div>

      <div className="crossword-eclipse__main">
        {/* GRILLE */}
        <div className="crossword-eclipse__grid">
          {grid.map((row, r) => (
            <div key={r} className="grid-row">
              {row.map((cell, c) => {
                const key = `${r}-${c}`
                const userL = userAnswers[key] || ''
                const isSelected = selectedCell?.row === r && selectedCell?.col === c
                const isCorrect = userL && userL === cell

                let clueNum = null
                placedWords.forEach(w => {
                  if ((w.direction === 'across' && w.row === r && w.col === c) ||
                      (w.direction === 'down' && w.row === r && w.col === c)) {
                    clueNum = w.clueNum
                  }
                })

                return (
                  <div
                    key={key}
                    className={`grid-cell ${cell ? 'active' : 'empty'} ${isSelected ? 'selected' : ''} ${isCorrect ? 'correct' : ''}`}
                    onClick={() => cell && handleCellClick(r, c)}
                  >
                    {cell && (
                      <>
                        {clueNum && <div className="cell-clue-num">{clueNum}</div>}
                        <input
                          type="text"
                          maxLength="1"
                          value={userL}
                          onChange={(e) => handleCellInput(r, c, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, r, c)}
                          autoFocus={isSelected}
                          className="cell-input-eclipse"
                        />
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* CLUES */}
        <div className="crossword-eclipse__clues">
          <div className="clues-section">
            <h4>{language === 'fr' ? 'Horizontalement' : 'Across'}</h4>
            {acrossClues.map(c => (
              <div key={c.clueNum} className={`clue ${solved.has(c.clueNum) ? 'solved' : ''}`}>
                <strong>{c.clueNum}.</strong> {c.definition}
              </div>
            ))}
          </div>
          <div className="clues-section">
            <h4>{language === 'fr' ? 'Verticalement' : 'Down'}</h4>
            {downClues.map(c => (
              <div key={c.clueNum} className={`clue ${solved.has(c.clueNum) ? 'solved' : ''}`}>
                <strong>{c.clueNum}.</strong> {c.definition}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
import React, { useState, useEffect } from 'react'
import '../styles/EclipseGrid.css'

const GRID_SIZE = 15

class ProGridGenerator {
  constructor(words) {
    this.words = words
    this.grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null))
    this.placements = []
    this.clueNum = 1
  }

  generate() {
    if (this.words.length === 0) return { grid: this.grid, placements: [] }

    // Placer 1er mot au centre horizontal
    const word0 = this.words[0]
    const row0 = Math.floor(GRID_SIZE / 2)
    const col0 = Math.floor((GRID_SIZE - word0.length) / 2)
    
    this.placeWordSafe(word0, row0, col0, 'across', 0)

    // Placer autres mots avec intersections
    for (let i = 1; i < Math.min(this.words.length, 10); i++) {
      this.placeWithIntersection(this.words[i], i)
    }

    return { grid: this.grid, placements: this.placements }
  }

  placeWordSafe(word, row, col, dir, wordIdx) {
    // Vérifier limites
    if (row < 0 || col < 0) return false
    if (dir === 'across' && col + word.length > GRID_SIZE) return false
    if (dir === 'down' && row + word.length > GRID_SIZE) return false

    const placement = {
      wordIdx,
      word,
      row,
      col,
      dir,
      clueNum: this.clueNum++,
      cells: []
    }

    if (dir === 'across') {
      for (let i = 0; i < word.length; i++) {
        const c = col + i
        // Vérifier pas de collision
        if (this.grid[row][c] && this.grid[row][c] !== word[i]) return false
        this.grid[row][c] = word[i]
        placement.cells.push([row, c])
      }
    } else {
      for (let i = 0; i < word.length; i++) {
        const r = row + i
        // Vérifier pas de collision
        if (this.grid[r][col] && this.grid[r][col] !== word[i]) return false
        this.grid[r][col] = word[i]
        placement.cells.push([r, col])
      }
    }

    this.placements.push(placement)
    return true
  }

  placeWithIntersection(word, wordIdx) {
    // Chercher toutes les intersections possibles
    const intersections = []

    for (let pIdx = 0; pIdx < this.placements.length; pIdx++) {
      const placed = this.placements[pIdx]

      for (let pCharIdx = 0; pCharIdx < placed.word.length; pCharIdx++) {
        for (let wCharIdx = 0; wCharIdx < word.length; wCharIdx++) {
          if (word[wCharIdx].toUpperCase() === placed.word[pCharIdx].toUpperCase()) {
            const [pRow, pCol] = placed.cells[pCharIdx]
            const newDir = placed.dir === 'across' ? 'down' : 'across'

            let newRow, newCol

            if (newDir === 'down') {
              newRow = pRow - wCharIdx
              newCol = pCol
            } else {
              newRow = pRow
              newCol = pCol - wCharIdx
            }

            intersections.push({ newRow, newCol, newDir })
          }
        }
      }
    }

    // Essayer chaque intersection
    for (const { newRow, newCol, newDir } of intersections) {
      if (this.placeWordSafe(word, newRow, newCol, newDir, wordIdx)) {
        return true
      }
    }

    return false
  }
}

export default function EclipseGrid({ words, language, onAnswerCorrect, onBack, puzzleType }) {
  const [grid, setGrid] = useState([])
  const [placements, setPlacements] = useState([])
  const [userAnswers, setUserAnswers] = useState({})
  const [solved, setSolved] = useState(new Set())
  const [selectedCell, setSelectedCell] = useState(null)

  useEffect(() => {
    if (!words || words.length < 2) return

    const wordsData = words.slice(0, 10).map((w, idx) => {
      if (puzzleType === 'Français') return w.mot_fr.toUpperCase()
      if (puzzleType === 'Anglais') return w.mot_en.toUpperCase()
      return (idx % 2 === 0 ? w.mot_fr : w.mot_en).toUpperCase()
    })

    const gen = new ProGridGenerator(wordsData)
    const { grid: g, placements: p } = gen.generate()

    setGrid(g)
    setPlacements(p.map((pl, idx) => ({
      ...pl,
      definition: words[pl.wordIdx][language === 'fr' ? 'def_fr' : 'def_en']
    })))
    setUserAnswers({})
    setSolved(new Set())
  }, [words, puzzleType, language])

  const handleCellInput = (row, col, value) => {
    const letter = value.toUpperCase().slice(-1)
    if (!letter) return

    const key = `${row}-${col}`
    const newAnswers = { ...userAnswers, [key]: letter }
    setUserAnswers(newAnswers)

    // Vérifier mots complets
    placements.forEach(p => {
      const inPlace = p.cells.find(c => c[0] === row && c[1] === col)
      if (!inPlace) return

      let ok = true, userWord = ''
      p.cells.forEach(c => {
        const ans = newAnswers[`${c[0]}-${c[1]}`] || ''
        userWord += ans
        if (!ans) ok = false
      })

      if (ok && userWord === p.word) {
        setSolved(prev => new Set([...prev, p.wordIdx]))
        onAnswerCorrect(p.wordIdx)
      }
    })

    // Auto-avance
    if (letter) {
      let moved = false
      for (let c = col + 1; c < GRID_SIZE; c++) {
        if (grid[row]?.[c]) { setSelectedCell([row, c]); moved = true; break }
      }
      if (!moved) {
        for (let r = row + 1; r < GRID_SIZE; r++) {
          if (grid[r]?.[col]) { setSelectedCell([r, col]); moved = true; break }
        }
      }
    }
  }

  const handleKeyDown = (e, row, col) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      let c = col + 1
      while (c < GRID_SIZE && !grid[row]?.[c]) c++
      if (c < GRID_SIZE) setSelectedCell([row, c])
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      let c = col - 1
      while (c >= 0 && !grid[row]?.[c]) c--
      if (c >= 0) setSelectedCell([row, c])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      let r = row + 1
      while (r < GRID_SIZE && !grid[r]?.[col]) r++
      if (r < GRID_SIZE) setSelectedCell([r, col])
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      let r = row - 1
      while (r >= 0 && !grid[r]?.[col]) r--
      if (r >= 0) setSelectedCell([r, col])
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      setUserAnswers({ ...userAnswers, [`${row}-${col}`]: '' })
    }
  }

  if (!grid.length) return <div style={{ padding: '20px', textAlign: 'center', fontSize: '16px' }}>⏳ Génération grille Eclipse...</div>

  const across = placements.filter(p => p.dir === 'across').sort((a, b) => a.clueNum - b.clueNum)
  const down = placements.filter(p => p.dir === 'down').sort((a, b) => a.clueNum - b.clueNum)

  return (
    <div className="eclipse-grid">
      <div className="eclipse-header">
        <button onClick={onBack} className="eclipse-back-btn">
          ← {language === 'fr' ? 'Retour' : 'Back'}
        </button>
        <h2>Eclipse Crossword {puzzleType}</h2>
      </div>

      <div className="eclipse-container">
        {/* GRILLE */}
        <div className="eclipse-board-wrapper">
          <div className="eclipse-board">
            {grid.map((row, r) => (
              <div key={r} className="eclipse-row">
                {row.map((cell, c) => {
                  const key = `${r}-${c}`
                  const isSelected = selectedCell?.[0] === r && selectedCell?.[1] === c
                  const userL = userAnswers[key] || ''
                  const isCorrect = cell && userL === cell

                  let clueNum = null
                  placements.forEach(p => {
                    if (p.cells[0][0] === r && p.cells[0][1] === c) {
                      clueNum = p.clueNum
                    }
                  })

                  return (
                    <div
                      key={key}
                      className={`eclipse-cell ${!cell ? 'empty' : ''} ${isSelected ? 'selected' : ''} ${isCorrect ? 'correct' : ''}`}
                      onClick={() => cell && setSelectedCell([r, c])}
                    >
                      {cell && (
                        <>
                          {clueNum && <div className="eclipse-number">{clueNum}</div>}
                          <input
                            type="text"
                            maxLength="1"
                            value={userL}
                            onChange={(e) => handleCellInput(r, c, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, r, c)}
                            autoFocus={isSelected}
                            className="eclipse-input"
                          />
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* INDICES */}
        <div className="eclipse-clues-wrapper">
          <div className="eclipse-clues">
            <div className="clues-col">
              <h3>➡️ {language === 'fr' ? 'HORIZONTALEMENT' : 'ACROSS'}</h3>
              <div className="clues-list">
                {across.map(p => (
                  <div key={p.clueNum} className={`clue ${solved.has(p.wordIdx) ? 'solved' : ''}`}>
                    <span className="clue-num">{p.clueNum}</span>
                    <span className="clue-text">{p.definition}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="clues-col">
              <h3>⬇️ {language === 'fr' ? 'VERTICALEMENT' : 'DOWN'}</h3>
              <div className="clues-list">
                {down.map(p => (
                  <div key={p.clueNum} className={`clue ${solved.has(p.wordIdx) ? 'solved' : ''}`}>
                    <span className="clue-num">{p.clueNum}</span>
                    <span className="clue-text">{p.definition}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
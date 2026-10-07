import React, { useState, useEffect, useRef } from 'react'
import { GRID_SIZE, selectCrosswordWords, generateCrossword, normalizeTypedLetter } from '../utils/crosswordLayout'
import '../styles/EclipseGrid.css'

export default function EclipseGrid({ words, language, onAnswerCorrect, onBack, puzzleType, onWordsPlaced }) {
  const [grid, setGrid] = useState([])
  const [placements, setPlacements] = useState([])
  const [userAnswers, setUserAnswers] = useState({})
  const [solved, setSolved] = useState(new Set())
  const [selectedCell, setSelectedCell] = useState(null)
  const [direction, setDirection] = useState('across')
  const inputRefs = useRef({})

  // Donner le focus à la case sélectionnée (autoFocus n'agit qu'au montage)
  useEffect(() => {
    if (!selectedCell) return
    inputRefs.current[`${selectedCell[0]}-${selectedCell[1]}`]?.focus()
  }, [selectedCell])

  useEffect(() => {
    if (!words || words.length < 2) return

    // Construire les mots à placer avec leurs métadonnées (texte + définition + id)
    const wordsData = selectCrosswordWords(words, puzzleType)

    // Nouvelle grille : sélection et sens de saisie remis à zéro
    setSelectedCell(null)
    setDirection('across')

    if (wordsData.length < 2) {
      setGrid([])
      setPlacements([])
      onWordsPlaced?.(0)
      return
    }

    const { grid: g, placements: p } = generateCrossword(wordsData.map(d => d.text))

    setGrid(g)
    setPlacements(p.map(pl => ({
      ...pl,
      definition: wordsData[pl.wordIdx].definition,
      wordId: wordsData[pl.wordIdx].wordId,
      wordLanguage: wordsData[pl.wordIdx].wordLanguage
    })))
    setUserAnswers({})
    setSolved(new Set())
    // Nombre de mots réellement placés : base de la progression et de « Terminer »
    onWordsPlaced?.(p.length)
    // onWordsPlaced volontairement hors dépendances : ne pas régénérer la grille
    // si le parent passe une nouvelle fonction
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, puzzleType, language])

  const handleCellInput = (row, col, value) => {
    // Accents retirés, majuscule ; tout ce qui n'est pas A-Z est ignoré
    const letter = normalizeTypedLetter(value)
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
        onAnswerCorrect(p.wordId)
      }
    })

    // Auto-avance : case suivante du mot en cours, dans le sens de saisie
    const [dr, dc] = direction === 'down' ? [1, 0] : [0, 1]
    if (grid[row + dr]?.[col + dc]) setSelectedCell([row + dr, col + dc])
  }

  // Saisie sans touche physique (clavier virtuel). Un caractère refusé
  // (chiffre, signe) est annulé par React ; on resélectionne alors la lettre
  // présente pour que la saisie suivante la remplace (maxLength 1).
  const handleInputEvent = (e, row, col) => {
    const input = e.target
    if (!normalizeTypedLetter(input.value)) {
      requestAnimationFrame(() => input.select())
      return
    }
    handleCellInput(row, col, input.value)
  }

  // Sélectionne une case ; le sens de saisie suit le mot qui passe par cette
  // case (de préférence celui qui y commence ; horizontal d'abord si deux mots
  // y commencent). Un second clic sur une case de croisement change de sens.
  const selectCell = (row, col) => {
    const through = placements.filter(p => p.cells.some(c => c[0] === row && c[1] === col))
    const dirs = through.map(p => p.dir)
    const startDirs = through.filter(p => p.row === row && p.col === col).map(p => p.dir)
    const sameCell = selectedCell?.[0] === row && selectedCell?.[1] === col
    if (sameCell && dirs.length > 1) {
      setDirection(direction === 'across' ? 'down' : 'across')
    } else if (startDirs.length) {
      setDirection(startDirs.includes('across') ? 'across' : 'down')
    } else if (dirs.length && !dirs.includes(direction)) {
      setDirection(dirs[0])
    }
    setSelectedCell([row, col])
  }

  const handleKeyDown = (e, row, col) => {
    // Caractère tapé au clavier : traité ici plutôt que par onChange, qui ne se
    // déclenche pas si la case contient déjà la même lettre (case de croisement).
    // Lettre accentuée normalisée (é -> E) ; chiffres et signes ignorés.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      if (normalizeTypedLetter(e.key)) handleCellInput(row, col, e.key)
      return
    }
    if (e.key.startsWith('Arrow')) {
      setDirection(e.key === 'ArrowUp' || e.key === 'ArrowDown' ? 'down' : 'across')
    }
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

  if (!grid.length) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontSize: '16px' }}>
        {language === 'fr' ? 'Pas assez de mots pour ce sujet.' : 'Not enough words for this subject.'}
      </div>
    )
  }

  const across = placements.filter(p => p.dir === 'across').sort((a, b) => a.clueNum - b.clueNum)
  const down = placements.filter(p => p.dir === 'down').sort((a, b) => a.clueNum - b.clueNum)

  return (
    <div className="eclipse-grid">
      <div className="eclipse-header">
        <button onClick={onBack} className="eclipse-back-btn">
          ← {language === 'fr' ? 'Retour' : 'Back'}
        </button>
        <h2>{language === 'fr' ? 'Mots croisés' : 'Crossword'}</h2>
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
                      onClick={() => cell && selectCell(r, c)}
                    >
                      {cell && (
                        <>
                          {clueNum && <div className="eclipse-number">{clueNum}</div>}
                          <input
                            type="text"
                            maxLength="1"
                            value={userL}
                            // onInput et non onChange : React n'émet pas onChange si la
                            // lettre saisie est identique (clavier virtuel, case de croisement)
                            onInput={(e) => handleInputEvent(e, r, c)}
                            onChange={() => {}}
                            onKeyDown={(e) => handleKeyDown(e, r, c)}
                            // Lettre déjà présente sélectionnée : la saisie la remplace (maxLength 1)
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => e.target.select()}
                            ref={el => { inputRefs.current[key] = el }}
                            className="eclipse-input"
                            aria-label={`Ligne ${r + 1}, colonne ${c + 1}`}
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

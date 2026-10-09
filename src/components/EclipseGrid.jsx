import React, { useState, useEffect, useRef } from 'react'
import { GRID_SIZE, normalizeTypedLetter, backspaceAction, answerChanges, letterCountLabel } from '../utils/crosswordLayout'
import '../styles/EclipseGrid.css'

// game : grille préparée par createCrosswordGame (CrosswordGame.jsx)
export default function EclipseGrid({ game, language, onAnswerCorrect, onAnswerRemoved, onBack, onWordsPlaced, onLettersChange, subject }) {
  const [grid, setGrid] = useState([])
  const [placements, setPlacements] = useState([])
  const [userAnswers, setUserAnswers] = useState({})
  const [solved, setSolved] = useState(new Set())
  const [selectedCell, setSelectedCell] = useState(null)
  const [direction, setDirection] = useState('across')
  const inputRefs = useRef({})

  // Signaler au parent si au moins une lettre est saisie (confirmation de
  // « Nouvelle grille »)
  useEffect(() => {
    onLettersChange?.(Object.values(userAnswers).some(Boolean))
  }, [userAnswers, onLettersChange])

  // Donner le focus à la case sélectionnée (autoFocus n'agit qu'au montage)
  useEffect(() => {
    if (!selectedCell) return
    inputRefs.current[`${selectedCell[0]}-${selectedCell[1]}`]?.focus()
  }, [selectedCell])

  useEffect(() => {
    // Nouvelle grille : sélection et sens de saisie remis à zéro
    setSelectedCell(null)
    setDirection('across')

    if (!game) {
      setGrid([])
      setPlacements([])
      onWordsPlaced?.(0)
      return
    }

    const { wordsData, grid: g, placements: p } = game

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
  }, [game])

  const handleCellInput = (row, col, value) => {
    // Accents retirés, majuscule ; tout ce qui n'est pas A-Z est ignoré
    const letter = normalizeTypedLetter(value)
    if (!letter) return

    updateAnswer(row, col, letter)

    // Auto-avance : case suivante du mot en cours, dans le sens de saisie
    const [dr, dc] = direction === 'down' ? [1, 0] : [0, 1]
    if (grid[row + dr]?.[col + dc]) setSelectedCell([row + dr, col + dc])
  }

  // Écrit (ou efface, letter = '') une case, puis met à jour les mots trouvés :
  // un mot complété est compté, un mot trouvé dont une lettre est effacée ou
  // remplacée redevient « à trouver » (une case de croisement peut en toucher deux).
  const updateAnswer = (row, col, letter) => {
    const newAnswers = { ...userAnswers, [`${row}-${col}`]: letter }
    const { found, lost } = answerChanges(placements, userAnswers, newAnswers, row, col)
    setUserAnswers(newAnswers)
    if (found.length || lost.length) {
      setSolved(prev => {
        const next = new Set(prev)
        found.forEach(p => next.add(p.wordIdx))
        lost.forEach(p => next.delete(p.wordIdx))
        return next
      })
    }
    found.forEach(p => onAnswerCorrect(p.wordId))
    lost.forEach(p => onAnswerRemoved?.(p.wordId))
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
      // Case remplie : effacer ; case vide : reculer dans le sens du mot et effacer
      e.preventDefault()
      const { clear, select } = backspaceAction(grid, userAnswers, row, col, direction)
      if (clear) updateAnswer(clear[0], clear[1], '')
      if (select) setSelectedCell(select)
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
        {/* Titre avec le domaine des mots (décision d'Isaac du 2026-10-07) : « Mots croisés — MAISON » */}
        <h2>
          {language === 'fr' ? 'Mots croisés' : 'Crossword'}
          {subject ? ` — ${subject.toUpperCase()}` : ''}
        </h2>
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
                    <span className="clue-text">{p.definition} {letterCountLabel(p.word.length)}</span>
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
                    <span className="clue-text">{p.definition} {letterCountLabel(p.word.length)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="clues-legend">
            {language === 'fr'
              ? 'Le nombre entre parenthèses indique le nombre de lettres du mot à trouver.'
              : 'The number in brackets is the number of letters in the word to find.'}
          </p>
        </div>
      </div>
    </div>
  )
}

import React, { useEffect, useRef, useState } from 'react'
import {
  createMemoryState,
  flipCard,
  closeMismatch,
  isFaceUp,
  isResolved,
  isFinished,
  pairsScore,
  colorIndex,
  pairById,
  memoryPairText,
  MISMATCH_DELAY_MS
} from '../utils/pairsGame'
import '../styles/AnagramGame.css'
import '../styles/PairsGame.css'
import '../styles/MemoryGame.css'

// Partie de mémoire (cartes face cachée), commune à L6 (FR ↔ EN) et M7
// (opération ↔ résultat) : lot B de la phase 4, moteur C (src/utils/pairsGame.js,
// docs/paires.md). Interface : CHOIX PROVISOIRE, à valider par un enseignant.
// L'élève touche deux cartes ; si elles vont ensemble, elles restent ouvertes,
// prennent la même couleur et le même numéro, et la paire s'ajoute à la liste
// « Paires trouvées » (les deux textes côte à côte, fiche L6). Sinon elles se
// referment après un court délai, ou dès que l'élève touche une carte. Pas
// d'aide, pas de pénalité ; nombre de coups affiché pour information.
//
// Le parent monte un nouveau composant par partie (prop key) : l'état et la
// garde d'enregistrement du score repartent à zéro.
//
// Props :
// - game : partie (createVocabularyMemoryGame ou createMultiplicationMemoryGame) ;
// - title, infoLine : titre et ligne « Partie n° … » ;
// - t, language : textes de l'interface ;
// - sideInfo(side) : { tag, name } (étiquette « FR » et nom de la langue), ou null ;
// - instruction : consigne ;
// - onPairFound(pair) : paire trouvée (saveUserProgress) ;
// - onLastPair(state) : dernière paire trouvée (saveScore, une fois) ;
// - onNewGame, onBackToSelect, onBackToDashboard.
export default function MemoryPlay({
  game, title, infoLine, t, sideInfo = () => null, instruction,
  onPairFound, onLastPair, onNewGame, onBackToSelect, onBackToDashboard
}) {
  const [mem, setMem] = useState(createMemoryState)
  const [phase, setPhase] = useState('playing') // playing | finished
  const [message, setMessage] = useState('')
  const timerRef = useRef(null)
  const scoreSavedRef = useRef(false)

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }
  useEffect(() => clearTimer, [])

  const finished = isFinished(game, mem)
  const score = pairsScore(mem)
  const cardText = (card) => pairById(game, card.pairId).sides[card.side]

  const describeSide = (card) => {
    const info = sideInfo(card.side)
    return info ? ` (${info.name})` : ''
  }

  const handleFlip = (card) => {
    if (finished) return
    const { state: next, result } = flipCard(mem, card)
    if (result === 'ignored') return
    clearTimer()
    setMem(next)
    const side = cardText(card)
    if (result === 'first') {
      setMessage(t(`Carte retournée : ${side.text}${describeSide(card)}.`, `Card turned over: ${side.text}${describeSide(card)}.`))
    } else if (result === 'closed') {
      setMessage(t('Cartes refermées.', 'Cards turned back.'))
    } else if (result === 'mismatch') {
      setMessage(t(`${side.text}${describeSide(card)} : ces deux cartes ne vont pas ensemble. Elles vont se refermer.`,
        `${side.text}${describeSide(card)}: these two cards do not match. They will turn back.`))
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        setMem(s => closeMismatch(s))
      }, MISMATCH_DELAY_MS)
    } else if (result === 'match') {
      const pair = pairById(game, card.pairId)
      const done = isFinished(game, next)
      setMessage(done
        ? t(`Bravo ! ${memoryPairText(game, pair)}. Toutes les paires sont trouvées !`, `Well done! ${memoryPairText(game, pair)}. All pairs found!`)
        : t(`Bravo ! ${memoryPairText(game, pair)}`, `Well done! ${memoryPairText(game, pair)}`))
      onPairFound(pair)
      if (done && !scoreSavedRef.current) {
        // Score enregistré dès la dernière paire, une seule fois par partie
        scoreSavedRef.current = true
        onLastPair(next)
      }
    }
  }

  // Paires trouvées, dans l'ordre où elles l'ont été (couleur = rang)
  const foundList = (className) => (
    <ul className={className}>
      {mem.resolved.map((r, i) => {
        const pair = pairById(game, r.id)
        const [first, second] = game.sideOrder.map(s => pair.sides[s])
        return (
          <li key={r.id} className={`memory-found__item pairs-color-${i % 8}`}>
            <span className="memory-found__badge" aria-hidden="true">{i + 1}</span>
            <span lang={first.lang ?? undefined}>{first.text}</span>
            <span> = </span>
            <span lang={second.lang ?? undefined}>{second.text}</span>
          </li>
        )
      })}
    </ul>
  )

  const movesText = (n) => t(`Coups : ${n}`, `Moves: ${n}`)

  if (phase === 'finished') {
    return (
      <div className="anagram-finished pairs-select memory-play">
        <div className="anagram-finished__container">
          <h1>🎉 {t('Partie terminée !', 'Game over!')}</h1>
          <p>
            {t(`Tu as trouvé les ${game.pairs.length} paires.`, `You found all ${game.pairs.length} pairs.`)}
          </p>
          <p className="anagram-finished__score">{score}</p>
          <p className="memory-finished__moves">{movesText(mem.moves)}</p>
          {foundList('memory-found memory-recap')}
          <p className="anagram-game__seed">{infoLine}</p>
          <button className="anagram-select__start" onClick={onNewGame}>
            {t('Nouvelle partie', 'New game')}
          </button>
          <button className="anagram-select__back" onClick={onBackToDashboard}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>
    )
  }

  const renderCard = (card, index) => {
    const side = cardText(card)
    const resolved = isResolved(mem, card.pairId)
    const faceUp = isFaceUp(mem, card)
    const color = colorIndex(mem, card.pairId)
    const info = sideInfo(card.side)
    const wrong = mem.open.length === 2 && mem.open.some(o => o.key === card.key)
    const classes = ['memory-card']
    if (faceUp) classes.push('memory-card--up')
    else classes.push('memory-card--down')
    if (card.side === game.primarySide) classes.push('memory-card--primary')
    if (resolved) classes.push(`memory-card--found pairs-color-${color % 8}`)
    if (wrong) classes.push('memory-card--wrong')
    if (side.text.length > 12) classes.push('memory-card--long')
    const position = index + 1
    return (
      <li key={card.key}>
        <button
          className={classes.join(' ')}
          onClick={() => handleFlip(card)}
          // aria-disabled (et non disabled) : le focus clavier reste sur la carte trouvée
          aria-disabled={resolved ? 'true' : undefined}
          data-side={card.side}
          data-pair={resolved ? color + 1 : undefined}
        >
          {faceUp ? (
            <>
              <span className="anagram-sr-only">{t(`Carte ${position} : `, `Card ${position}: `)}</span>
              {resolved && <span className="memory-card__badge" aria-hidden="true">{color + 1}</span>}
              {info && <span className="memory-card__tag" aria-hidden="true">{info.tag}</span>}
              <span className="memory-card__text" lang={side.lang ?? undefined}>{side.text}</span>
              <span className="anagram-sr-only">
                {info ? `, ${info.name}` : ''}
                {resolved
                  ? t(`, trouvée, paire ${color + 1}`, `, found, pair ${color + 1}`)
                  : t(', retournée', ', face up')}
              </span>
            </>
          ) : (
            <>
              <span className="memory-card__back" aria-hidden="true">?</span>
              <span className="anagram-sr-only">{t(`Carte ${position}, face cachée`, `Card ${position}, face down`)}</span>
            </>
          )}
        </button>
      </li>
    )
  }

  return (
    <div className="anagram-game pairs-game memory-play">
      <div className="anagram-game__header">
        <h1>{title}</h1>
        <div className="anagram-game__progress">
          {t('Paires', 'Pairs')} {mem.resolved.length} / {game.pairs.length} · {score} {t('points', 'points')} · {movesText(mem.moves)}
        </div>
        <p className="anagram-game__seed">{infoLine}</p>
      </div>

      <div className="anagram-game__card">
        <p className="pairs-game__instruction">{instruction}</p>
        <ul className={`memory-board memory-board--${game.cards.length}`} aria-label={t('Cartes', 'Cards')}>
          {game.cards.map(renderCard)}
        </ul>

        <p className="anagram-game__feedback pairs-game__feedback" role="status" aria-live="polite">{message}</p>

        {mem.resolved.length > 0 && (
          <div className="memory-found__box">
            <h2 className="memory-found__title">{t('Paires trouvées', 'Pairs found')}</h2>
            {foundList('memory-found')}
          </div>
        )}

        {finished && (
          <button className="anagram-select__start" onClick={() => setPhase('finished')}>
            {t('Terminer', 'Finish')}
          </button>
        )}

        <div className="anagram-game__footer">
          <button className="anagram-game__btn anagram-game__btn--secondary" onClick={onNewGame}>
            {t('Nouvelle partie', 'New game')}
          </button>
          <button className="anagram-game__btn anagram-game__btn--secondary anagram-game__back" onClick={onBackToSelect}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>
    </div>
  )
}

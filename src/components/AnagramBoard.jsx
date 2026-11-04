import React, { useState } from 'react'
import {
  reshuffleOrder,
  findAnswer,
  correctPositions,
  firstLettersHint,
  TRIES_BEFORE_HINT,
  TRIES_BEFORE_SOLUTION
} from '../utils/anagramGame'

// Plateau d'UNE anagramme, partagé par les anagrammes classiques
// (src/pages/AnagramGame.jsx) et les anagrammes mystères
// (src/pages/MysteryGame.jsx) : mêmes cases, mêmes tuiles, mêmes aides.
// Extrait de AnagramGame.jsx sans changement de comportement (lot 1 des
// anagrammes mystères). L'élève touche les tuiles dans l'ordre pour remplir
// les cases ; toucher une case remplie rend la lettre. Après une erreur :
// nombre de lettres bien placées, puis indice (première lettre, au 2e essai),
// puis solution disponible après 3 essais.
//
// Le parent remonte le plateau à chaque mot (prop key) : son état repart à zéro.
// - item : { word, display, firstLetter, tiles, answers }
// - seed, wordIndex : graine de « Mélanger à nouveau » (reproductible)
// - initialTries : essais faux déjà faits (reprise d'une partie)
// - markedIndex : position (dans le mot) de la case à lettre secrète, ou null
// - onFound(answer), onWrong(tries), onShowSolution() : événements pour le parent
// - nextLabel, onNext : bouton affiché quand le mot est terminé
// - children : contenu ajouté au résultat (ex. élément secret gagné)

// Tuiles d'un mot : chaque lettre garde un identifiant stable (key), même
// après « Mélanger à nouveau ».
const makeTiles = (letters) => letters.map((letter, key) => ({ key, letter }))

export default function AnagramBoard({
  item,
  seed,
  wordIndex,
  language,
  initialTries = 0,
  markedIndex = null,
  onFound,
  onWrong,
  onShowSolution,
  nextLabel,
  onNext,
  children
}) {
  const t = (fr, en) => (language === 'fr' ? fr : en)

  const [tiles, setTiles] = useState(() => makeTiles(item.tiles)) // ordre affiché des tuiles
  const [slots, setSlots] = useState(() => item.tiles.map(() => null)) // key de la tuile placée dans chaque case, ou null
  const [tries, setTries] = useState(initialTries) // essais faux sur le mot en cours
  const [round, setRound] = useState(0) // nombre de « Mélanger à nouveau » sur ce mot
  const [outcome, setOutcome] = useState(null) // null | { found: true, answer } | { found: false }
  const [feedback, setFeedback] = useState('')

  const used = new Set(slots.filter(k => k !== null))
  const tileByKey = (key) => tiles.find(tile => tile.key === key)
  const typed = (item.firstLetter ?? '') + slots.map(k => (k === null ? '' : tileByKey(k).letter)).join('')
  const full = slots.length > 0 && slots.every(k => k !== null)
  const done = outcome !== null
  const offset = item.firstLetter ? 1 : 0

  const handleTile = (key) => {
    if (done || used.has(key)) return
    const free = slots.indexOf(null)
    if (free === -1) return
    setSlots(slots.map((k, i) => (i === free ? key : k)))
  }

  // Case remplie touchée : la lettre retourne parmi les tuiles
  const handleSlot = (index) => {
    if (done || slots[index] === null) return
    setSlots(slots.map((k, i) => (i === index ? null : k)))
  }

  const handleClear = () => {
    if (done) return
    setSlots(slots.map(() => null))
  }

  // Nouvel ordre des tuiles, soumis aux mêmes règles que le premier mélange ;
  // les lettres déjà placées restent dans leurs cases
  const handleReshuffle = () => {
    if (done) return
    const order = reshuffleOrder(item, tiles.map(tile => tile.letter), seed, wordIndex, round)
    setTiles(order.map(i => tiles[i]))
    setRound(round + 1)
  }

  const handleValidate = () => {
    if (done || !full) return
    const answer = findAnswer(item, typed)
    if (answer) {
      setOutcome({ found: true, answer })
      setFeedback(t('Bravo !', 'Well done!'))
      onFound?.(answer)
      return
    }
    const nextTries = tries + 1
    setTries(nextTries)
    const n = correctPositions(item, typed)
    const parts = [t(
      `Il y a ${n} ${n > 1 ? 'lettres bien placées' : 'lettre bien placée'}.`,
      `${n} ${n > 1 ? 'letters are' : 'letter is'} in the right place.`
    )]
    if (nextTries >= TRIES_BEFORE_HINT) {
      const hint = firstLettersHint(item)
      parts.push(t(`Indice : le mot commence par « ${hint} ».`, `Hint: the word starts with "${hint}".`))
    }
    if (nextTries >= TRIES_BEFORE_SOLUTION) {
      parts.push(t('Tu peux essayer encore ou voir la solution.', 'You can try again or see the answer.'))
    } else {
      parts.push(t('Essaie encore !', 'Try again!'))
    }
    setFeedback(parts.join(' '))
    onWrong?.(nextTries)
  }

  // Solution montrée : le mot n'est pas compté
  const handleShowSolution = () => {
    if (done || tries < TRIES_BEFORE_SOLUTION) return
    setOutcome({ found: false })
    setFeedback('')
    onShowSolution?.()
  }

  const handleNext = () => {
    if (!done) return
    onNext?.()
  }

  return (
    <>
      <div
        className="anagram-slots"
        role="group"
        aria-label={t('Mot à écrire', 'Word to write')}
        style={{ '--an-length': item.word.length }}
      >
        {item.firstLetter && (
          <span className="anagram-slot anagram-slot--given" role="img" aria-label={t(`${item.firstLetter}, lettre donnée`, `${item.firstLetter}, given letter`)}>
            {item.firstLetter}
          </span>
        )}
        {slots.map((key, i) => {
          const letter = key === null ? '' : tileByKey(key).letter
          const position = i + 1 + offset
          // Case de la lettre secrète (anagrammes mystères) : repérée à l'écran
          // et annoncée aux lecteurs d'écran
          const marked = markedIndex === i + offset
          const secret = marked ? t(', case de la lettre secrète', ', secret letter box') : ''
          return (
            <button
              key={i}
              className={`anagram-slot ${key === null ? 'anagram-slot--empty' : ''} ${outcome?.found ? 'anagram-slot--found' : ''} ${marked ? 'anagram-slot--marked' : ''}`}
              onClick={() => handleSlot(i)}
              disabled={done || key === null}
              aria-label={letter
                ? t(`${letter}, case ${position}${secret}, toucher pour rendre la lettre`, `${letter}, box ${position}${secret}, tap to give the letter back`)
                : t(`case ${position} vide${secret}`, `box ${position} empty${secret}`)}
            >
              {letter}
            </button>
          )
        })}
      </div>

      {!done && (
        <div className="anagram-tiles" role="group" aria-label={t('Lettres mélangées', 'Mixed-up letters')}>
          {tiles.map(tile => (
            <button
              key={tile.key}
              className={`anagram-tile ${used.has(tile.key) ? 'anagram-tile--used' : ''}`}
              onClick={() => handleTile(tile.key)}
              disabled={used.has(tile.key)}
              aria-label={tile.letter}
            >
              {used.has(tile.key) ? '' : tile.letter}
            </button>
          ))}
        </div>
      )}

      {!done && (
        <div className="anagram-game__actions">
          <button className="anagram-game__btn anagram-game__btn--secondary" onClick={handleClear} disabled={used.size === 0}>
            {t('Effacer', 'Clear')}
          </button>
          <button className="anagram-game__btn anagram-game__btn--secondary" onClick={handleReshuffle}>
            {t('Mélanger à nouveau', 'Shuffle again')}
          </button>
          <button className="anagram-game__btn anagram-game__btn--validate" onClick={handleValidate} disabled={!full}>
            {t('Valider', 'Check')}
          </button>
        </div>
      )}

      <p className="anagram-game__feedback" role="status" aria-live="polite">{feedback}</p>

      {!done && tries >= TRIES_BEFORE_SOLUTION && (
        <button className="anagram-game__btn anagram-game__btn--solution" onClick={handleShowSolution}>
          {t('Voir la solution', 'Show the answer')}
        </button>
      )}

      {done && (
        <div className="anagram-game__result">
          {/* Orthographe exacte, avec accents, montrée après chaque mot */}
          <p className="anagram-game__answer">
            {outcome.found
              ? t('Tu as trouvé : ', 'You found: ')
              : t('La solution était : ', 'The answer was: ')}
            <strong>{outcome.found ? outcome.answer.display : item.display}</strong>
          </p>
          {outcome.found && outcome.answer.word !== item.word && (
            <p className="anagram-game__other">
              {t(`C'est aussi une bonne réponse. Le mot de la définition : ${item.display}.`,
                `That is also a right answer. The word of the definition: ${item.display}.`)}
            </p>
          )}
          {!outcome.found && (
            <p className="anagram-game__other">{t('Ce mot ne compte pas de points.', 'This word gives no points.')}</p>
          )}
          {children}
          <button className="anagram-game__btn anagram-game__btn--validate" onClick={handleNext}>
            {nextLabel}
          </button>
        </div>
      )}
    </>
  )
}

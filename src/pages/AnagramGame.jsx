import React, { useRef, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { getVocabByLevel, saveScore, saveUserProgress } from '../db/index'
import {
  createAnagramGame,
  reshuffleOrder,
  findAnswer,
  correctPositions,
  firstLettersHint,
  isValidSeed,
  newSeed,
  ANAGRAM_LEVELS,
  ANAGRAM_SETTINGS,
  POINTS_PER_WORD,
  TRIES_BEFORE_SOLUTION
} from '../utils/anagramGame'
import { libelleNiveau } from '../data/niveaux'
import '../styles/AnagramGame.css'

// Anagrammes (fiche L1 du catalogue v0.2 ; plan de migration §5.4).
// Interface : CHOIX PROVISOIRE, à valider par un enseignant. L'élève touche
// les tuiles dans l'ordre pour remplir les cases ; toucher une case remplie
// rend la lettre. Après une erreur : nombre de lettres bien placées, puis
// indice (première lettre), puis solution disponible après 3 essais (le mot
// n'est alors pas compté). Pas de chronomètre (D5).

// Tuiles d'un mot : chaque lettre garde un identifiant stable (key), même
// après « Mélanger à nouveau ».
const makeTiles = (letters) => letters.map((letter, key) => ({ key, letter }))

export default function AnagramGame() {
  const { user, language, setCurrentPage } = useAppStore()
  const t = (fr, en) => (language === 'fr' ? fr : en)

  const [level, setLevel] = useState(ANAGRAM_LEVELS.includes(user?.level) ? user.level : ANAGRAM_LEVELS[0])
  const [seedInput, setSeedInput] = useState('')
  const [seedError, setSeedError] = useState(false)
  const [gameState, setGameState] = useState('select') // select | playing | finished | unavailable
  const [game, setGame] = useState(null)
  const [wordIndex, setWordIndex] = useState(0)
  const [tiles, setTiles] = useState([]) // ordre affiché des tuiles
  const [slots, setSlots] = useState([]) // key de la tuile placée dans chaque case, ou null
  const [tries, setTries] = useState(0) // essais faux sur le mot en cours
  const [round, setRound] = useState(0) // nombre de « Mélanger à nouveau » sur ce mot
  const [outcome, setOutcome] = useState(null) // null | { found: true, answer } | { found: false }
  const [results, setResults] = useState([]) // { item, answer|null } pour chaque mot terminé
  const [feedback, setFeedback] = useState('')

  // Empêche un double clic de lancer deux parties (ou d'enregistrer deux fois)
  const busyRef = useRef(false)
  const [generating, setGenerating] = useState(false)

  const item = game?.items[wordIndex] ?? null
  // Langue des mots de la partie (fixée au lancement), affichée avec le numéro :
  // un même numéro donne une autre partie dans l'autre langue
  const gameLanguage = game?.language === 'en' ? t('anglais', 'English') : t('français', 'French')
  const score = results.filter(r => r.answer).length * POINTS_PER_WORD

  const loadWord = (g, index) => {
    const next = g.items[index]
    setWordIndex(index)
    setTiles(makeTiles(next.tiles))
    setSlots(next.tiles.map(() => null))
    setTries(0)
    setRound(0)
    setOutcome(null)
    setFeedback('')
  }

  const startGame = async (seed) => {
    if (busyRef.current) return
    busyRef.current = true
    setGenerating(true)
    try {
      const vocabulary = await getVocabByLevel(level)
      // Les mots suivent la langue de l'interface au lancement de la partie
      const g = createAnagramGame(vocabulary, level, seed, language)
      if (g.items.length === 0) {
        console.warn('Anagrammes : aucun mot utilisable', { level, seed, language })
        setGame(null)
        setGameState('unavailable')
        return
      }
      setGame(g)
      setResults([])
      loadWord(g, 0)
      setGameState('playing')
    } catch (e) {
      console.error('Anagrammes : erreur de préparation', e)
      setGame(null)
      setGameState('unavailable')
    } finally {
      busyRef.current = false
      setGenerating(false)
    }
  }

  const handleStart = () => {
    const text = seedInput.trim()
    if (text === '') {
      setSeedError(false)
      startGame(newSeed())
      return
    }
    const seed = /^\d+$/.test(text) ? Number(text) : NaN
    if (!isValidSeed(seed)) {
      setSeedError(true)
      return
    }
    setSeedError(false)
    startGame(seed)
  }

  const handleNewGame = () => {
    setSeedInput('')
    startGame(newSeed())
  }

  const handleBackToSelect = () => {
    setGameState('select')
    setGame(null)
  }

  // « Retour » qui quitte l'activité : retour au tableau de bord élève
  // (décision d'Isaac du 2026-11-01, Q2), comme les autres jeux
  const handleBackToDashboard = () => {
    setGameState('select')
    setGame(null)
    setCurrentPage('studentDashboard')
  }

  const used = new Set(slots.filter(k => k !== null))
  const tileByKey = (key) => tiles.find(tile => tile.key === key)
  const typed = (item?.firstLetter ?? '') + slots.map(k => (k === null ? '' : tileByKey(k).letter)).join('')
  const full = slots.length > 0 && slots.every(k => k !== null)
  const done = outcome !== null

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
    const order = reshuffleOrder(item, tiles.map(tile => tile.letter), game.seed, wordIndex, round)
    setTiles(order.map(i => tiles[i]))
    setRound(round + 1)
  }

  const handleValidate = () => {
    if (done || !full) return
    const answer = findAnswer(item, typed)
    if (answer) {
      setOutcome({ found: true, answer })
      setResults([...results, { item, answer }])
      setFeedback(t('Bravo !', 'Well done!'))
      saveUserProgress(user?.id, answer.id, true, null, { gameType: 'anagram', itemId: item.id })
      return
    }
    const nextTries = tries + 1
    setTries(nextTries)
    const n = correctPositions(item, typed)
    const parts = [t(
      `Il y a ${n} ${n > 1 ? 'lettres bien placées' : 'lettre bien placée'}.`,
      `${n} ${n > 1 ? 'letters are' : 'letter is'} in the right place.`
    )]
    if (nextTries >= 2) {
      const hint = firstLettersHint(item)
      parts.push(t(`Indice : le mot commence par « ${hint} ».`, `Hint: the word starts with "${hint}".`))
    }
    if (nextTries >= TRIES_BEFORE_SOLUTION) {
      parts.push(t('Tu peux essayer encore ou voir la solution.', 'You can try again or see the answer.'))
    } else {
      parts.push(t('Essaie encore !', 'Try again!'))
    }
    setFeedback(parts.join(' '))
  }

  // Solution montrée : le mot n'est pas compté
  const handleShowSolution = () => {
    if (done || tries < TRIES_BEFORE_SOLUTION) return
    setOutcome({ found: false })
    setResults([...results, { item, answer: null }])
    setFeedback('')
    saveUserProgress(user?.id, item.id, false, null, { gameType: 'anagram', itemId: item.id })
  }

  const finishGame = async () => {
    if (busyRef.current) return
    busyRef.current = true
    try {
      await saveScore(user?.id, 'anagram', score, level, { seed: game.seed, language: game.language })
    } catch (e) {
      console.error('Erreur:', e)
    } finally {
      busyRef.current = false
    }
    setGameState('finished')
  }

  const handleNext = () => {
    if (!done) return
    if (wordIndex + 1 < game.items.length) loadWord(game, wordIndex + 1)
    else finishGame()
  }

  if (gameState === 'select') {
    return (
      <div className="anagram-select">
        <div className="anagram-select__container">
          <h1>{t('Anagrammes', 'Anagrams')}</h1>
          <p className="anagram-select__intro">
            {t('Lis la définition, puis remets les lettres dans l\'ordre pour écrire le mot.',
              'Read the definition, then put the letters in the right order to write the word.')}
          </p>

          <div className="anagram-select__section">
            <span className="anagram-select__label" id="anagram-level-label">{t('Niveau', 'Level')}</span>
            <div className="anagram-select__options" role="group" aria-labelledby="anagram-level-label">
              {ANAGRAM_LEVELS.map(l => (
                <button
                  key={l}
                  className={`anagram-select__btn ${level === l ? 'active' : ''}`}
                  onClick={() => setLevel(l)}
                  aria-pressed={level === l}
                >
                  {libelleNiveau(l, language)}
                  <span className="anagram-select__size">
                    {t(`${ANAGRAM_SETTINGS[l].minLength} à ${ANAGRAM_SETTINGS[l].maxLength} lettres`,
                      `${ANAGRAM_SETTINGS[l].minLength} to ${ANAGRAM_SETTINGS[l].maxLength} letters`)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="anagram-select__section">
            <label className="anagram-select__label" htmlFor="anagram-seed">
              {t('Numéro de partie (facultatif)', 'Game number (optional)')}
            </label>
            <input
              id="anagram-seed"
              className="anagram-select__seed"
              type="text"
              inputMode="numeric"
              value={seedInput}
              onChange={e => setSeedInput(e.target.value)}
              placeholder={t('Laisser vide pour une nouvelle partie', 'Leave empty for a new game')}
              aria-describedby="anagram-seed-hint"
            />
            <p id="anagram-seed-hint" className="anagram-select__hint">
              {seedError
                ? t('Numéro invalide : un nombre entier de 0 à 4294967295.', 'Invalid number: a whole number from 0 to 4294967295.')
                : t('Avec la même version de l\'application, le même numéro, le même niveau et la même langue donnent la même partie (toute la classe peut jouer la même).',
                  'With the same version of the app, the same number, level and language give the same game (the whole class can play the same one).')}
            </p>
          </div>

          <button className="anagram-select__start" onClick={handleStart} disabled={generating}>
            {t('Commencer', 'Start')}
          </button>
          <button className="anagram-select__back" onClick={handleBackToDashboard}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>
    )
  }

  if (gameState === 'unavailable') {
    return (
      <div className="anagram-select">
        <div className="anagram-select__container">
          <h1>{t('Anagrammes', 'Anagrams')}</h1>
          <p className="anagram-select__intro" role="status">
            {t('Cette partie n\'est pas disponible pour le moment. Essaie une nouvelle partie.',
              'This game is not available right now. Try a new game.')}
          </p>
          <button className="anagram-select__start" onClick={handleNewGame}>
            {t('Nouvelle partie', 'New game')}
          </button>
          <button className="anagram-select__back" onClick={handleBackToSelect}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>
    )
  }

  if (gameState === 'finished' && game) {
    return (
      <div className="anagram-finished">
        <div className="anagram-finished__container">
          <h1>🎉 {t('Partie terminée !', 'Game over!')}</h1>
          <p>
            {t(`Tu as trouvé ${results.filter(r => r.answer).length} mot(s) sur ${game.items.length}.`,
              `You found ${results.filter(r => r.answer).length} word(s) out of ${game.items.length}.`)}
          </p>
          <p className="anagram-finished__score">{score}</p>
          {/* Orthographe exacte (avec accents) de chaque mot */}
          <ul className="anagram-finished__words">
            {results.map(r => (
              <li key={r.item.id} className={r.answer ? 'anagram-finished__word--found' : 'anagram-finished__word--missed'}>
                {r.answer ? r.answer.display : r.item.display}
                <span className="anagram-sr-only">{r.answer ? t(' (trouvé)', ' (found)') : t(' (solution montrée)', ' (answer shown)')}</span>
              </li>
            ))}
          </ul>
          <p className="anagram-game__seed">
            {t('Partie n°', 'Game no.')} {game.seed} · {gameLanguage} · {libelleNiveau(level, language)}
          </p>
          <button className="anagram-select__start" onClick={handleNewGame}>
            {t('Nouvelle partie', 'New game')}
          </button>
          <button className="anagram-select__back" onClick={handleBackToDashboard}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>
    )
  }

  if (gameState !== 'playing' || !item) return null

  const last = wordIndex + 1 === game.items.length

  return (
    <div className="anagram-game">
      <div className="anagram-game__header">
        <h1>{t('Anagrammes', 'Anagrams')} - {libelleNiveau(level, language)}</h1>
        <div className="anagram-game__progress">
          {t('Mot', 'Word')} {wordIndex + 1} / {game.items.length} · {score} {t('points', 'points')}
        </div>
        <p className="anagram-game__seed">{t('Partie n°', 'Game no.')} {game.seed} · {gameLanguage}</p>
      </div>

      <div className="anagram-game__card">
        <h2 className="anagram-game__clue-title">{t('Définition', 'Definition')}</h2>
        <p className="anagram-game__clue">{item.definition}</p>

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
            const position = i + 1 + (item.firstLetter ? 1 : 0)
            return (
              <button
                key={i}
                className={`anagram-slot ${key === null ? 'anagram-slot--empty' : ''} ${outcome?.found ? 'anagram-slot--found' : ''}`}
                onClick={() => handleSlot(i)}
                disabled={done || key === null}
                aria-label={letter
                  ? t(`${letter}, case ${position}, toucher pour rendre la lettre`, `${letter}, box ${position}, tap to give the letter back`)
                  : t(`case ${position} vide`, `box ${position} empty`)}
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
            <button className="anagram-game__btn anagram-game__btn--validate" onClick={handleNext}>
              {last ? t('Terminer', 'Finish') : t('Mot suivant', 'Next word')}
            </button>
          </div>
        )}

        <div className="anagram-game__footer">
          <button className="anagram-game__btn anagram-game__btn--secondary" onClick={handleNewGame}>
            {t('Nouvelle partie', 'New game')}
          </button>
          <button className="anagram-game__btn anagram-game__btn--secondary anagram-game__back" onClick={handleBackToSelect}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>
    </div>
  )
}

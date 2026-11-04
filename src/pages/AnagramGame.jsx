import React, { useRef, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { getVocabByLevel, saveScore, saveUserProgress } from '../db/index'
import {
  createAnagramGame,
  isValidSeed,
  newSeed,
  ANAGRAM_LEVELS,
  ANAGRAM_SETTINGS,
  POINTS_PER_WORD
} from '../utils/anagramGame'
import { libelleNiveau } from '../data/niveaux'
import AnagramBoard from '../components/AnagramBoard'
import '../styles/AnagramGame.css'

// Anagrammes (fiche L1 du catalogue v0.2 ; plan de migration §5.4).
// Interface : CHOIX PROVISOIRE, à valider par un enseignant. L'élève touche
// les tuiles dans l'ordre pour remplir les cases ; toucher une case remplie
// rend la lettre. Après une erreur : nombre de lettres bien placées, puis
// indice (première lettre), puis solution disponible après 3 essais (le mot
// n'est alors pas compté). Pas de chronomètre (D5).
//
// Accueil du module (lot 1 des anagrammes mystères, docs/anagrammes-mysteres.md
// §2) : famille A, anagrammes classiques (le jeu ci-dessous, inchangé) ;
// famille B, anagrammes mystères (src/pages/MysteryGame.jsx). Le plateau d'une
// anagramme (cases, tuiles, aides) est partagé : src/components/AnagramBoard.jsx.

export default function AnagramGame() {
  const { user, language, setCurrentPage } = useAppStore()
  const t = (fr, en) => (language === 'fr' ? fr : en)

  const [level, setLevel] = useState(ANAGRAM_LEVELS.includes(user?.level) ? user.level : ANAGRAM_LEVELS[0])
  const [seedInput, setSeedInput] = useState('')
  const [seedError, setSeedError] = useState(false)
  const [gameState, setGameState] = useState('home') // home | select | playing | finished | unavailable
  const [game, setGame] = useState(null)
  const [wordIndex, setWordIndex] = useState(0)
  const [results, setResults] = useState([]) // { item, answer|null } pour chaque mot terminé

  // Empêche un double clic de lancer deux parties (ou d'enregistrer deux fois)
  const busyRef = useRef(false)
  const [generating, setGenerating] = useState(false)

  const item = game?.items[wordIndex] ?? null
  // Langue des mots de la partie (fixée au lancement), affichée avec le numéro :
  // un même numéro donne une autre partie dans l'autre langue
  const gameLanguage = game?.language === 'en' ? t('anglais', 'English') : t('français', 'French')
  const score = results.filter(r => r.answer).length * POINTS_PER_WORD

  // Le plateau (AnagramBoard) repart à zéro à chaque mot (prop key)
  const loadWord = (index) => {
    setWordIndex(index)
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
      loadWord(0)
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

  const handleFound = (answer) => {
    setResults([...results, { item, answer }])
    saveUserProgress(user?.id, answer.id, true, null, { gameType: 'anagram', itemId: item.id })
  }

  // Solution montrée : le mot n'est pas compté
  const handleShowSolution = () => {
    setResults([...results, { item, answer: null }])
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
    if (wordIndex + 1 < game.items.length) loadWord(wordIndex + 1)
    else finishGame()
  }

  // Accueil du module : les deux familles
  if (gameState === 'home') {
    return (
      <div className="anagram-select">
        <div className="anagram-select__container">
          <h1>{t('Anagrammes', 'Anagrams')}</h1>
          <p className="anagram-select__intro">
            {t('Choisis une famille de jeux.', 'Choose a family of games.')}
          </p>
          <div className="anagram-home__families">
            <button className="anagram-home__family" onClick={() => setGameState('select')}>
              <span className="anagram-home__family-name">{t('Anagrammes classiques', 'Classic anagrams')}</span>
              <span className="anagram-home__family-text">
                {t('Remets les lettres dans l\'ordre pour écrire le mot de la définition.',
                  'Put the letters in order to write the word of the definition.')}
              </span>
            </button>
            <button className="anagram-home__family" onClick={() => setCurrentPage('mysteryGame')}>
              <span className="anagram-home__family-name">{t('Anagrammes mystères', 'Mystery anagrams')}</span>
              <span className="anagram-home__family-text">
                {t('Chaque anagramme résolue te donne un élément secret : assemble-les pour percer le mystère.',
                  'Each anagram you solve gives you a secret clue: put them together to solve the mystery.')}
              </span>
            </button>
          </div>
          <button className="anagram-select__back" onClick={handleBackToDashboard}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>
    )
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
          {/* Retour à l'accueil du module (les deux familles) */}
          <button className="anagram-select__back" onClick={() => setGameState('home')}>
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

        <AnagramBoard
          key={`${game.seed}-${wordIndex}`}
          item={item}
          seed={game.seed}
          wordIndex={wordIndex}
          language={language}
          onFound={handleFound}
          onShowSolution={handleShowSolution}
          nextLabel={last ? t('Terminer', 'Finish') : t('Mot suivant', 'Next word')}
          onNext={handleNext}
        />

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

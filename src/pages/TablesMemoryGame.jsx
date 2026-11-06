import React, { useRef, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { saveScore, saveUserProgress } from '../db/index'
import {
  createMultiplicationMemoryGame,
  multiplicationSetup,
  singleTableOptions,
  pairsScore,
  newSeed,
  isValidSeed,
  GAME_TYPE_MULTIPLICATION
} from '../utils/pairsGame'
import { resolveMathClass } from '../data/reglages-maths'
import { libelleNiveau } from '../data/niveaux'
import MemoryPlay from '../components/MemoryPlay'
import '../styles/AnagramGame.css'
import '../styles/PairsGame.css'
import '../styles/MemoryGame.css'

// Mémoire des tables de multiplication, opération ↔ résultat (fiche M7 du
// catalogue v0.2, limitée à la mémoire en phase 4 : P2 a ; lot B, moteur C :
// src/utils/pairsGame.js ; docs/paires.md). Réglée par la classe et le
// sous-système du profil, comme les pyramides (resolveMathClass, champ tables
// de reglages-maths.js, provisoire D4). Par défaut toutes les tables de la
// classe mêlées ; option « une seule table » (P10 a). Class 1-2 : pas encore de
// table, message affiché (P10 a). Partie : src/components/MemoryPlay.jsx.

const SUBSYSTEM_LABEL = {
  fr: { fr: 'sous-système francophone', en: 'French-speaking subsystem' },
  en: { fr: 'sous-système anglophone', en: 'English-speaking subsystem' }
}

export default function TablesMemoryGame() {
  const { user, language, setCurrentPage } = useAppStore()
  const t = (fr, en) => (language === 'fr' ? fr : en)

  // Classe utilisée pour les réglages (décision Q5, comme les pyramides)
  const { settings: mathClass, isDefault, reason } = resolveMathClass({
    level: user?.level,
    className: user?.class ?? null,
    subsystem: user?.subsystem ?? 'fr'
  })
  const { className, subsystem } = mathClass
  const allSetup = multiplicationSetup({ className, subsystem })
  const tableOptions = allSetup.status === 'ok' ? singleTableOptions(allSetup.tables) : []

  const [mode, setMode] = useState('all') // all | single
  const [table, setTable] = useState(null)
  const [seedInput, setSeedInput] = useState('')
  const [seedError, setSeedError] = useState(false)
  const [gameState, setGameState] = useState('select') // select | playing | unavailable
  const [game, setGame] = useState(null)
  const [round, setRound] = useState(0)
  const [launchLanguage, setLaunchLanguage] = useState(language) // langue de l'interface au lancement
  const busyRef = useRef(false)

  const chosenTable = mode === 'single' ? (tableOptions.includes(table) ? table : tableOptions[0] ?? null) : null
  const canStart = allSetup.status === 'ok' && (mode === 'all' || chosenTable !== null)

  const startGame = (seed) => {
    if (busyRef.current) return
    busyRef.current = true
    try {
      const g = createMultiplicationMemoryGame({ className, subsystem, table: chosenTable, seed })
      if (!g) {
        console.warn('Mémoire des tables : partie impossible', { className, subsystem, table: chosenTable, seed })
        setGame(null)
        setGameState('unavailable')
        return
      }
      setGame(g)
      setLaunchLanguage(language)
      setRound(r => r + 1)
      setGameState('playing')
    } catch (e) {
      console.error('Mémoire des tables : erreur de préparation', e)
      setGame(null)
      setGameState('unavailable')
    } finally {
      busyRef.current = false
    }
  }

  const handleStart = () => {
    if (!canStart) return
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

  const handleBackToDashboard = () => {
    setGameState('select')
    setGame(null)
    setCurrentPage('studentDashboard')
  }

  const title = t('Mémoire des tables', 'Times tables memory')
  const tablesText = (tables) => tables.join(', ')
  const scopeText = (g) => (g.table === null
    ? t(`tables ${tablesText(g.tables)}`, `tables ${tablesText(g.tables)}`)
    : t(`table de ${g.table}`, `${g.table} times table`))

  // Ligne qui rappelle la classe utilisée pour les réglages (comme les pyramides)
  const classLine = () => {
    const sub = SUBSYSTEM_LABEL[subsystem][language === 'fr' ? 'fr' : 'en']
    if (!isDefault) return t(`Réglé pour : ${className} (${sub}).`, `Set for: ${className} (${sub}).`)
    return reason === 'mismatch'
      ? t(`Réglé pour : ${className} (${sub}), classe par défaut : la classe du profil (${user?.class}) ne correspond pas à son niveau ou à son sous-système.`,
        `Set for: ${className} (${sub}), default class: the profile class (${user?.class}) does not match its level or subsystem.`)
      : t(`Réglé pour : ${className} (${sub}), classe par défaut : le profil n'a pas de classe.`,
        `Set for: ${className} (${sub}), default class: the profile has no class.`)
  }

  if (gameState === 'playing' && game) {
    return (
      <MemoryPlay
        key={round}
        game={game}
        title={`${title} - ${game.className}`}
        infoLine={`${t('Partie n°', 'Game no.')} ${game.seed} · ${scopeText(game)} · ${game.className}`}
        t={t}
        instruction={t('Retourne deux cartes : une multiplication et son résultat. Souviens-toi de leur place !',
          'Turn over two cards: a multiplication and its result. Remember where they are!')}
        onPairFound={(pair) => {
          // itemId = le fait (« 3×4 »), pour reproposer plus tard les faits ratés
          saveUserProgress(user?.id, pair.id, true, null, { gameType: GAME_TYPE_MULTIPLICATION, itemId: pair.id })
        }}
        onLastPair={(state) => {
          saveScore(user?.id, GAME_TYPE_MULTIPLICATION, pairsScore(state), game.level, {
            seed: game.seed,
            language: launchLanguage,
            className: game.className,
            subsystem: game.subsystem,
            tables: game.tables,
            table: game.table,
            pairCount: game.pairs.length,
            moves: state.moves
          }).catch(e => console.error('Erreur:', e))
        }}
        onNewGame={handleNewGame}
        onBackToSelect={handleBackToSelect}
        onBackToDashboard={handleBackToDashboard}
      />
    )
  }

  if (gameState === 'unavailable') {
    return (
      <div className="anagram-select pairs-select">
        <div className="anagram-select__container">
          <h1>{title}</h1>
          <p className="anagram-select__intro" role="status">
            {t('Cette partie n\'est pas disponible pour le moment.', 'This game is not available right now.')}
          </p>
          <button className="anagram-select__back" onClick={handleBackToSelect}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="anagram-select pairs-select">
      <div className="anagram-select__container">
        <h1>{title}</h1>
        <p className="anagram-select__intro">
          {t('Les cartes sont face cachée. Retourne-les deux par deux pour retrouver chaque multiplication et son résultat.',
            'The cards are face down. Turn them over two at a time to find each multiplication and its result.')}
        </p>
        <p className="memory-select__class" data-testid="tables-class">
          {libelleNiveau(mathClass.level, language)} · {classLine()}
        </p>

        {allSetup.status !== 'ok' ? (
          <p className="memory-select__notice" role="status" data-testid="tables-none">
            {t(`Pas encore de table de multiplication pour ta classe (${className}). Ce jeu s'ouvrira quand ton programme les prévoira.`,
              `No multiplication table yet for your class (${className}). This game will open when your curriculum includes them.`)}
          </p>
        ) : (
          <>
            <div className="anagram-select__section">
              <span className="anagram-select__label" id="tables-mode-label">{t('Tables', 'Tables')}</span>
              <div className="anagram-select__options" role="group" aria-labelledby="tables-mode-label">
                <button
                  className={`anagram-select__btn ${mode === 'all' ? 'active' : ''}`}
                  onClick={() => setMode('all')}
                  aria-pressed={mode === 'all'}
                >
                  {t('Toutes mes tables', 'All my tables')}
                  <span className="anagram-select__size">{tablesText(allSetup.tables)}</span>
                </button>
                {tableOptions.length > 0 && (
                  <button
                    className={`anagram-select__btn ${mode === 'single' ? 'active' : ''}`}
                    onClick={() => setMode('single')}
                    aria-pressed={mode === 'single'}
                  >
                    {t('Une seule table', 'One table only')}
                  </button>
                )}
              </div>
              <p className="anagram-select__hint">
                {t(`${allSetup.count} paires ; facteurs de 1 à 10 ; jamais deux multiplications de même résultat.`,
                  `${allSetup.count} pairs; factors 1 to 10; never two multiplications with the same result.`)}
              </p>
            </div>

            {mode === 'single' && (
              <div className="anagram-select__section">
                <span className="anagram-select__label" id="tables-table-label">{t('Table', 'Table')}</span>
                <div className="anagram-select__options memory-select__tables" role="group" aria-labelledby="tables-table-label">
                  {tableOptions.map(n => (
                    <button
                      key={n}
                      className={`anagram-select__btn ${chosenTable === n ? 'active' : ''}`}
                      onClick={() => setTable(n)}
                      aria-pressed={chosenTable === n}
                      aria-label={t(`Table de ${n}`, `${n} times table`)}
                    >
                      × {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="anagram-select__section">
              <label className="anagram-select__label" htmlFor="tables-seed">
                {t('Numéro de partie (facultatif)', 'Game number (optional)')}
              </label>
              <input
                id="tables-seed"
                className="anagram-select__seed"
                type="text"
                inputMode="numeric"
                value={seedInput}
                onChange={e => setSeedInput(e.target.value)}
                placeholder={t('Laisser vide pour une nouvelle partie', 'Leave empty for a new game')}
                aria-describedby="tables-seed-hint"
              />
              <p id="tables-seed-hint" className="anagram-select__hint">
                {seedError
                  ? t('Numéro invalide : un nombre entier de 0 à 4294967295.', 'Invalid number: a whole number from 0 to 4294967295.')
                  : t('Avec la même version de l\'application, le même numéro, la même classe et les mêmes tables donnent les mêmes cartes aux mêmes places.',
                    'With the same version of the app, the same number, class and tables give the same cards in the same places.')}
              </p>
            </div>
          </>
        )}

        <button className="anagram-select__start" onClick={handleStart} disabled={!canStart}>
          {t('Commencer', 'Start')}
        </button>
        <button className="anagram-select__back" onClick={handleBackToDashboard}>
          {t('Retour', 'Back')}
        </button>
      </div>
    </div>
  )
}

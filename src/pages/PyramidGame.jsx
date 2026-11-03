import React, { useRef, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { saveScore, saveUserProgress } from '../db/index'
import {
  createPyramidGame,
  availableOperations,
  cellHint,
  cellPosition,
  cellIndex,
  pyramidCellId,
  pyramidSettings,
  maxDigits,
  digitGroups,
  pyramidScore,
  canShowAnswer,
  isValidSeed,
  newSeed
} from '../utils/pyramidGame'
import { resolveMathClass } from '../data/reglages-maths'
import { libelleNiveau } from '../data/niveaux'
import NumberPad from '../components/NumberPad'
import '../styles/PyramidGame.css'

// Pyramides additives et multiplicatives (fiches M2 et M3 du catalogue v0.2 ;
// plan de migration §5.1, phase 3). Réglées selon la classe et le sous-système
// du profil (décision Q5) ; sans classe dans le profil : la première classe de
// la tranche, la plus prudente. Interface : CHOIX PROVISOIRE, à valider par un
// enseignant. L'élève touche une case vide puis écrit le nombre au pavé
// numérique (ou au clavier). Case fausse : les deux cases dont elle dépend
// sont montrées avec le calcul (« 5 + 4 = ? »), puis nouvelle tentative ;
// après 3 essais faux, « Voir la réponse » (case montrée sans points, décision
// d'Isaac du 2026-11-03). Pas de chronomètre (D5).
// Nombres groupés par milliers (« 380 359 238 ») dans les cases, la saisie et
// les aides ; dans une case trop étroite, la coupure se fait entre deux groupes.

const SUBSYSTEM_LABEL = {
  fr: { fr: 'sous-système francophone', en: 'French-speaking subsystem' },
  en: { fr: 'sous-système anglophone', en: 'English-speaking subsystem' }
}

// Nombre d'une case, groupé par milliers. Chaque groupe est insécable ; entre
// deux groupes, une espace fine sécable (français) ou une virgule suivie d'une
// coupure possible (anglais) : un grand nombre ne se coupe qu'entre deux groupes.
function GroupedNumber({ text, language }) {
  const groups = digitGroups(text)
  return groups.map((g, i) => (
    <React.Fragment key={i}>
      {i > 0 && (language === 'fr' ? '\u2009' : <wbr />)}
      <span className="pyramid-num__group">{g}{language !== 'fr' && i < groups.length - 1 ? ',' : ''}</span>
    </React.Fragment>
  ))
}

export default function PyramidGame() {
  const { user, language, setCurrentPage } = useAppStore()
  const t = (fr, en) => (language === 'fr' ? fr : en)
  // Groupement par milliers : espace insécable fine (français), virgule (anglais)
  const formatNumber = (n) => n.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-GB')

  // Classe utilisée pour les réglages (décision Q5)
  const { settings: mathClass, isDefault, reason } = resolveMathClass({
    level: user?.level,
    className: user?.class ?? null,
    subsystem: user?.subsystem ?? 'fr'
  })
  const { className, subsystem } = mathClass
  const operations = availableOperations(className, subsystem)

  const [operation, setOperation] = useState('add')
  const [seedInput, setSeedInput] = useState('')
  const [seedError, setSeedError] = useState(false)
  const [gameState, setGameState] = useState('select') // select | playing | finished | unavailable
  const [game, setGame] = useState(null)
  const [pyramidIndex, setPyramidIndex] = useState(0)
  const [found, setFound] = useState([]) // par case : false, 'found' (trouvée) ou 'shown' (réponse montrée)
  const [tries, setTries] = useState({}) // essais faux par case de la pyramide en cours
  const [selected, setSelected] = useState(null) // case cachée choisie
  const [entry, setEntry] = useState('') // nombre en cours d'écriture
  const [hint, setHint] = useState(null) // aide après une case fausse
  const [feedback, setFeedback] = useState('')
  const [cellsFound, setCellsFound] = useState(0) // cases trouvées dans la partie
  const [errors, setErrors] = useState(0) // réponses fausses dans la partie
  const [cellsShown, setCellsShown] = useState(0) // réponses montrées dans la partie

  // Empêche un double clic de lancer deux parties (ou d'enregistrer deux fois)
  const busyRef = useRef(false)

  const pyramid = game?.pyramids[pyramidIndex] ?? null
  const score = pyramidScore(cellsFound)
  const opName = (op) => (op === 'add'
    ? t('Pyramides additives', 'Addition pyramids')
    : t('Pyramides multiplicatives', 'Multiplication pyramids'))

  const loadPyramid = (g, index) => {
    const p = g.pyramids[index]
    setPyramidIndex(index)
    setFound(p.values.map(() => false))
    setTries({})
    setSelected(p.hidden[0])
    setEntry('')
    setHint(null)
    setFeedback('')
  }

  const startGame = (seed) => {
    if (busyRef.current) return
    busyRef.current = true
    try {
      const g = createPyramidGame({ className, subsystem, operation, seed })
      setGame(g)
      setCellsFound(0)
      setErrors(0)
      setCellsShown(0)
      loadPyramid(g, 0)
      setGameState('playing')
    } catch (e) {
      console.error('Pyramides : erreur de préparation', e)
      setGame(null)
      setGameState('unavailable')
    } finally {
      busyRef.current = false
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

  // « Retour » qui quitte l'activité : retour au tableau de bord élève (Q2)
  const handleBackToDashboard = () => {
    setGameState('select')
    setGame(null)
    setCurrentPage('studentDashboard')
  }

  const done = pyramid !== null && pyramid.hidden.every(i => found[i])
  const isShown = (i) => pyramid.given[i] || Boolean(found[i])

  // Autre case choisie : saisie, aide colorée et message effacés
  const handleSelect = (cell) => {
    if (done || isShown(cell)) return
    if (cell !== selected) {
      setEntry('')
      setHint(null)
      setFeedback('')
    }
    setSelected(cell)
  }

  const handleDigit = (digit) => {
    if (done || selected === null) return
    setEntry(e => {
      const next = e === '0' ? digit : e + digit
      return next.length > maxDigits(game) ? e : next
    })
  }

  const handleDelete = () => {
    if (done) return
    setEntry(e => e.slice(0, -1))
  }

  const finishGame = async () => {
    if (busyRef.current) return
    busyRef.current = true
    try {
      await saveScore(user?.id, 'pyramid', score, game.level, {
        seed: game.seed,
        operation: game.operation,
        className: game.className,
        subsystem: game.subsystem
      })
    } catch (e) {
      console.error('Erreur:', e)
    } finally {
      busyRef.current = false
    }
    setGameState('finished')
  }

  const handleValidate = () => {
    if (done || selected === null || entry === '') return
    const cell = selected
    const itemId = pyramidCellId(game, pyramidIndex, cell)
    const isCorrect = Number(entry) === pyramid.values[cell]
    saveUserProgress(user?.id, null, isCorrect, null, { gameType: 'pyramid', itemId })
    setEntry('')

    if (!isCorrect) {
      setErrors(n => n + 1)
      const wrong = (tries[cell] ?? 0) + 1
      setTries({ ...tries, [cell]: wrong })
      const h = cellHint(pyramid, cell, pyramid.values.map((_, i) => isShown(i)), {
        floors: game.floors,
        operation: game.operation,
        maxOperand: pyramidSettings(game.className, game.subsystem, game.operation).maxOperand
      })
      setHint({ cell, ...h })
      const a = formatNumber(h.a)
      const b = formatNumber(h.b)
      const parts = [h.known
        ? t(`Pas encore. Calcule : ${a} ${h.op} ${b} = ?`, `Not yet. Work out: ${a} ${h.op} ${b} = ?`)
        : t('Pas encore. Cette case se calcule avec les deux cases en couleur : complète d\'abord celles qui sont encore vides.',
          'Not yet. This box comes from the two coloured boxes: first fill in the ones that are still empty.')]
      if (canShowAnswer(wrong)) parts.push(t('Tu peux essayer encore ou voir la réponse.', 'You can try again or see the answer.'))
      setFeedback(parts.join(' '))
      return
    }
    completeCell(cell, 'found')
  }

  // Case terminée : trouvée par l'élève (10 points) ou réponse montrée (aucun point)
  const completeCell = (cell, how) => {
    const nextFound = found.map((f, i) => (i === cell ? how : f))
    setFound(nextFound)
    if (how === 'found') setCellsFound(n => n + 1)
    else setCellsShown(n => n + 1)
    setHint(null)
    // Case suivante : la prochaine case à trouver, dans l'ordre de la résolution
    const next = pyramid.hidden.find(i => !nextFound[i]) ?? null
    setSelected(next)
    const value = formatNumber(pyramid.values[cell])
    const message = how === 'found'
      ? t('Bravo !', 'Well done!')
      : t(`La réponse était ${value}. Cette case ne compte pas de points.`, `The answer was ${value}. This box gives no points.`)
    setFeedback(next === null ? `${message} ${t('Pyramide terminée !', 'Pyramid complete!')}` : message)
  }

  // « Voir la réponse », après 3 essais faux sur la case choisie
  const handleShowAnswer = () => {
    if (done || selected === null || !canShowAnswer(tries[selected] ?? 0)) return
    const itemId = pyramidCellId(game, pyramidIndex, selected)
    saveUserProgress(user?.id, null, false, null, { gameType: 'pyramid', itemId })
    setEntry('')
    completeCell(selected, 'shown')
  }

  const handleNext = () => {
    if (!done) return
    if (pyramidIndex + 1 < game.pyramids.length) loadPyramid(game, pyramidIndex + 1)
    else finishGame()
  }

  // Ligne qui rappelle la classe utilisée pour les réglages
  const classLine = () => {
    const sub = SUBSYSTEM_LABEL[subsystem][language === 'fr' ? 'fr' : 'en']
    if (!isDefault) return t(`Réglé pour : ${className} (${sub}).`, `Set for: ${className} (${sub}).`)
    return reason === 'mismatch'
      ? t(`Réglé pour : ${className} (${sub}), classe par défaut : la classe du profil (${user?.class}) ne correspond pas à son niveau ou à son sous-système.`,
        `Set for: ${className} (${sub}), default class: the profile class (${user?.class}) does not match its level or subsystem.`)
      : t(`Réglé pour : ${className} (${sub}), classe par défaut : le profil n'a pas de classe.`,
        `Set for: ${className} (${sub}), default class: the profile has no class.`)
  }

  if (gameState === 'select') {
    const current = pyramidSettings(className, subsystem, operation)
    return (
      <div className="pyramid-select">
        <div className="pyramid-select__container">
          <h1>{t('Pyramides', 'Pyramids')}</h1>
          <p className="pyramid-select__intro">
            {t('Chaque case est la somme (ou le produit) des deux cases sur lesquelles elle repose. Trouve les cases vides.',
              'Each box is the sum (or the product) of the two boxes it sits on. Find the empty boxes.')}
          </p>
          <p className="pyramid-select__class" data-testid="pyramid-class">
            {libelleNiveau(mathClass.level, language)} · {classLine()}
          </p>

          <div className="pyramid-select__section">
            <span className="pyramid-select__label" id="pyramid-op-label">{t('Opération', 'Operation')}</span>
            <div className="pyramid-select__options" role="group" aria-labelledby="pyramid-op-label">
              {['add', 'mul'].map(op => {
                const available = operations.includes(op)
                const s = available ? pyramidSettings(className, subsystem, op) : null
                return (
                  <button
                    key={op}
                    className={`pyramid-select__btn ${operation === op ? 'active' : ''}`}
                    onClick={() => setOperation(op)}
                    aria-pressed={operation === op}
                    disabled={!available}
                  >
                    {op === 'add' ? t('Addition', 'Addition') : t('Multiplication', 'Multiplication')}
                    <span className="pyramid-select__size">
                      {available
                        ? t(`${s.floors} étages, sommet jusqu'à ${formatNumber(s.maxTop)}`,
                          `${s.floors} rows, top up to ${formatNumber(s.maxTop)}`)
                        : t('pas dans cette classe', 'not in this class')}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="pyramid-select__section">
            <label className="pyramid-select__label" htmlFor="pyramid-seed">
              {t('Numéro de partie (facultatif)', 'Game number (optional)')}
            </label>
            <input
              id="pyramid-seed"
              className="pyramid-select__seed"
              type="text"
              inputMode="numeric"
              value={seedInput}
              onChange={e => setSeedInput(e.target.value)}
              placeholder={t('Laisser vide pour une nouvelle partie', 'Leave empty for a new game')}
              aria-describedby="pyramid-seed-hint"
            />
            <p id="pyramid-seed-hint" className="pyramid-select__hint">
              {seedError
                ? t('Numéro invalide : un nombre entier de 0 à 4294967295.', 'Invalid number: a whole number from 0 to 4294967295.')
                : t('Avec la même version de l\'application, le même numéro, la même classe et la même opération donnent la même partie (toute la classe peut jouer la même).',
                  'With the same version of the app, the same number, class and operation give the same game (the whole class can play the same one).')}
            </p>
          </div>

          <button className="pyramid-select__start" onClick={handleStart} disabled={!current}>
            {t('Commencer', 'Start')}
          </button>
          <button className="pyramid-select__back" onClick={handleBackToDashboard}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>
    )
  }

  if (gameState === 'unavailable') {
    return (
      <div className="pyramid-select">
        <div className="pyramid-select__container">
          <h1>{t('Pyramides', 'Pyramids')}</h1>
          <p className="pyramid-select__intro" role="status">
            {t('Cette partie n\'est pas disponible pour le moment. Essaie une nouvelle partie.',
              'This game is not available right now. Try a new game.')}
          </p>
          <button className="pyramid-select__start" onClick={handleNewGame}>
            {t('Nouvelle partie', 'New game')}
          </button>
          <button className="pyramid-select__back" onClick={handleBackToSelect}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>
    )
  }

  if (gameState === 'finished' && game) {
    return (
      <div className="pyramid-finished">
        <div className="pyramid-finished__container">
          <h1>🎉 {t('Partie terminée !', 'Game over!')}</h1>
          <p>
            {t(`Tu as trouvé ${cellsFound} case(s) dans ${game.pyramids.length} pyramides.`,
              `You found ${cellsFound} box(es) in ${game.pyramids.length} pyramids.`)}
          </p>
          <p className="pyramid-finished__score">{score}</p>
          <p className="pyramid-finished__errors">
            {t(`Réponses fausses pendant la partie : ${errors}`, `Wrong answers during the game: ${errors}`)}
          </p>
          {cellsShown > 0 && (
            <p className="pyramid-finished__errors">
              {t(`Réponses montrées (sans points) : ${cellsShown}`, `Answers shown (no points): ${cellsShown}`)}
            </p>
          )}
          <p className="pyramid-game__seed">
            {t('Partie n°', 'Game no.')} {game.seed} · {game.className} · {opName(game.operation)}
          </p>
          <button className="pyramid-select__start" onClick={handleNewGame}>
            {t('Nouvelle partie', 'New game')}
          </button>
          <button className="pyramid-select__back" onClick={handleBackToDashboard}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>
    )
  }

  if (gameState !== 'playing' || !pyramid) return null

  const last = pyramidIndex + 1 === game.pyramids.length
  const digits = maxDigits(game)
  const sizeClass = digits <= 3 ? '' : digits <= 5 ? 'pyramid--medium' : digits <= 7 ? 'pyramid--large' : 'pyramid--huge'
  const rows = Array.from({ length: game.floors }, (_, row) => Array.from({ length: row + 1 }, (_, col) => cellIndex(row, col)))
  const hintCells = hint && !done ? hint.inputs : []

  const cellLabel = (cell) => {
    const { row, col } = cellPosition(cell)
    const where = t(`rangée ${row + 1}, case ${col + 1}`, `row ${row + 1}, box ${col + 1}`)
    const value = formatNumber(pyramid.values[cell])
    if (pyramid.given[cell]) return `${value}, ${where}`
    if (found[cell] === 'found') return t(`${value}, ${where}, trouvée`, `${value}, ${where}, found`)
    if (found[cell] === 'shown') return t(`${value}, ${where}, réponse montrée`, `${value}, ${where}, answer shown`)
    const typed = cell === selected && entry !== '' ? t(`, saisie ${formatNumber(Number(entry))}`, `, typed ${formatNumber(Number(entry))}`) : ''
    return t(`Case à trouver, ${where}${typed}`, `Box to find, ${where}${typed}`)
  }

  return (
    <div className="pyramid-game">
      <div className="pyramid-game__header">
        <h1>{opName(game.operation)} - {game.className}</h1>
        <div className="pyramid-game__progress">
          {t('Pyramide', 'Pyramid')} {pyramidIndex + 1} / {game.pyramids.length} · {score} {t('points', 'points')}
        </div>
        <p className="pyramid-game__seed">{t('Partie n°', 'Game no.')} {game.seed} · {libelleNiveau(game.level, language)}</p>
      </div>

      <div className="pyramid-game__card">
        <p className="pyramid-game__rule">
          {game.operation === 'add'
            ? t('Chaque case = la somme des deux cases du dessous.', 'Each box = the sum of the two boxes below.')
            : t('Chaque case = le produit des deux cases du dessous.', 'Each box = the product of the two boxes below.')}
        </p>

        <div
          className={`pyramid ${sizeClass}`}
          role="group"
          aria-label={t('Pyramide', 'Pyramid')}
          style={{ '--py-floors': game.floors }}
        >
          {rows.map((cells, row) => (
            <div key={row} className="pyramid__row">
              {cells.map(cell => {
                const highlighted = hintCells.includes(cell)
                if (isShown(cell)) {
                  return (
                    <span
                      key={cell}
                      className={`pyramid-cell ${pyramid.given[cell] ? 'pyramid-cell--given' : found[cell] === 'shown' ? 'pyramid-cell--shown' : 'pyramid-cell--found'} ${highlighted ? 'pyramid-cell--hint' : ''}`}
                      role="img"
                      aria-label={cellLabel(cell)}
                      data-cell={cell}
                    >
                      <GroupedNumber text={pyramid.values[cell]} language={language} />
                    </span>
                  )
                }
                const isSelected = cell === selected
                const isWrong = hint?.cell === cell
                return (
                  <button
                    key={cell}
                    className={`pyramid-cell pyramid-cell--hidden ${isSelected ? 'pyramid-cell--selected' : ''} ${isWrong ? 'pyramid-cell--wrong' : ''} ${highlighted ? 'pyramid-cell--hint' : ''}`}
                    onClick={() => handleSelect(cell)}
                    aria-pressed={isSelected}
                    aria-label={cellLabel(cell)}
                    data-cell={cell}
                    // Case déjà choisie : Entrée y valide la réponse (pavé numérique)
                    data-numberpad-enter={isSelected ? 'true' : undefined}
                  >
                    {isSelected && entry !== '' ? <GroupedNumber text={entry} language={language} /> : ''}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <p className="pyramid-game__feedback" role="status" aria-live="polite">{feedback}</p>

        {!done && selected !== null && canShowAnswer(tries[selected] ?? 0) && (
          <button className="pyramid-game__btn pyramid-game__btn--answer" onClick={handleShowAnswer}>
            {t('Voir la réponse', 'Show the answer')}
          </button>
        )}

        {!done && (
          <NumberPad
            onDigit={handleDigit}
            onDelete={handleDelete}
            onValidate={handleValidate}
            validateDisabled={selected === null || entry === ''}
            language={language}
          />
        )}

        {done && (
          <button className="pyramid-game__btn pyramid-game__btn--validate pyramid-game__next" onClick={handleNext}>
            {last ? t('Terminer', 'Finish') : t('Pyramide suivante', 'Next pyramid')}
          </button>
        )}

        <div className="pyramid-game__footer">
          <button className="pyramid-game__btn pyramid-game__btn--secondary" onClick={handleNewGame}>
            {t('Nouvelle partie', 'New game')}
          </button>
          <button className="pyramid-game__btn pyramid-game__btn--secondary pyramid-game__back" onClick={handleBackToSelect}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>
    </div>
  )
}

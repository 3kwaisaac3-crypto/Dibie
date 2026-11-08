import React, { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { saveScore, saveUserProgress } from '../db/index'
import { createCrossNumberGame, cellNumbers, newSeed, isValidSeed } from '../utils/crossNumberGame'
import { formatNumber } from '../utils/crossNumberDefinitions'
import {
  crossNumberAvailability,
  createPlayState,
  selectCell,
  selectEntry,
  inputDigit,
  deleteDigit,
  canCheck,
  checkEntry,
  canShowAnswer,
  showAnswerResult,
  crossNumberScore,
  isFinished,
  isResolved,
  entryById,
  cellKind,
  visibleArea,
  playSummary,
  crossNumberItemId,
  GAME_TYPE_CROSS_NUMBER
} from '../utils/crossNumberPlay'
import { resolveMathClass } from '../data/reglages-maths'
import { libelleNiveau } from '../data/niveaux'
import NumberPad from '../components/NumberPad'
import '../styles/PyramidGame.css'
import '../styles/CrossNumberGame.css'

// Nombres croisés (fiche M1 du catalogue v0.2, moteur F ; phase 5, lot B :
// interface des niveaux 1 et 2 ; lot C : niveau 3, grilles 6 × 6 et 7 × 7).
// Grille : src/utils/crossNumberGame.js (lot A) ;
// état de la partie : src/utils/crossNumberPlay.js ; docs/nombres-croises.md.
// Décisions d'Isaac du 2026-11-08 (cadrage, P7 à P12 option a) :
// - classe et sous-système du profil (resolveMathClass), comme les pyramides ;
//   jouable en CP, CE1, CE2, CM1, CM2, Class 2 à Class 6 (CM et Class 5-6
//   depuis le lot C) ; SIL et Class 1 : message (P2 a) ;
// - grille de BOUTONS (aucun champ de saisie : le clavier du téléphone ne
//   s'ouvre pas), saisie au pavé numérique ou au clavier physique (P10 a) ;
// - ✓ vérifie le nombre choisi ; nombre juste verrouillé (P7 a) ;
// - chiffre révélé après 2 erreurs sur un nombre ; « Voir la réponse » après
//   3 (0 point, isCorrect: false) (P8 a) ;
// - 10 points par nombre trouvé ; score enregistré une seule fois, dès le
//   dernier nombre résolu (« Retour » ne le fait pas perdre) (P9 a) ;
// - grille, définition courante et pavé fixé en bas ; liste des définitions
//   repliable (P11 a) ;
// - même numéro + même classe = même grille ; la langue ne change que le
//   texte des définitions ; grille non obtenue : message, aucune grille (P12 a).
// Interface : CHOIX PROVISOIRE, à valider par un enseignant. Pas de chronomètre (D5).

const SUBSYSTEM_LABEL = {
  fr: { fr: 'sous-système francophone', en: 'French-speaking subsystem' },
  en: { fr: 'sous-système anglophone', en: 'English-speaking subsystem' }
}

// Première classe où le jeu s'ouvre, par sous-système (message SIL / Class 1)
const FIRST_CLASS = { fr: 'CP', en: 'Class 2' }

export default function CrossNumberGame() {
  const { user, language, setCurrentPage } = useAppStore()
  const t = (fr, en) => (language === 'fr' ? fr : en)
  const lang = language === 'fr' ? 'fr' : 'en'
  const fmt = (n) => formatNumber(n, lang)

  // Classe utilisée pour les réglages (décision Q5, comme les pyramides)
  const { settings: mathClass, isDefault, reason } = resolveMathClass({
    level: user?.level,
    className: user?.class ?? null,
    subsystem: user?.subsystem ?? 'fr'
  })
  const { className, subsystem } = mathClass
  const availability = crossNumberAvailability(className, subsystem)

  const [seedInput, setSeedInput] = useState('')
  const [seedError, setSeedError] = useState(false)
  const [gameState, setGameState] = useState('select') // select | playing | finished | unavailable
  const [game, setGame] = useState(null)
  const [play, setPlay] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [wrongId, setWrongId] = useState(null) // nombre signalé faux (jusqu'à la prochaine action)
  const [listOpen, setListOpen] = useState(false)

  // Empêche un double clic de lancer deux parties
  const busyRef = useRef(false)
  // Partie dont le score est déjà enregistré : un seul saveScore par partie
  const scoreSavedForRef = useRef(null)
  // Bas d'écran fixé (définition, message, pavé) : sa hauteur réserve la même
  // place en bas de la page, pour que rien ne reste caché dessous
  const bottomRef = useRef(null)
  const [bottomHeight, setBottomHeight] = useState(0)
  useEffect(() => {
    const el = bottomRef.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(() => setBottomHeight(el.offsetHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [gameState, game])

  // Lot C (CHOIX PROVISOIRE) : grilles 6 × 6 et 7 × 7 sur petit écran. Sous
  // 768 px, le sélecteur de langue est en haut de la page, dans le flux (App.css) ;
  // à 320 × 640, il repoussait la dernière rangée sous le pavé fixé. À
  // l'ouverture de la partie, la page défile donc jusqu'au haut du jeu (une
  // seule fois par partie, quand la place du bas d'écran est réservée) ; le
  // sélecteur reste accessible en remontant. Grilles plus petites : inchangé.
  const gameRef = useRef(null)
  const scrolledForRef = useRef(null)
  useEffect(() => {
    if (gameState !== 'playing' || !game || game.size < 6 || bottomHeight === 0) return
    if (scrolledForRef.current === game || !gameRef.current) return
    scrolledForRef.current = game
    const top = gameRef.current.getBoundingClientRect().top + window.scrollY
    if (top > 0) window.scrollTo({ top, behavior: 'instant' })
  }, [gameState, game, bottomHeight])

  const title = t('Nombres croisés', 'Number crossword')
  const dirName = (d) => (d === 'across' ? t('horizontal', 'across') : t('vertical', 'down'))
  const entryName = (e) => `${e.number} ${dirName(e.direction)}`

  const startGame = (seed) => {
    if (busyRef.current) return
    busyRef.current = true
    try {
      const g = createCrossNumberGame({ className, subsystem, seed })
      setGame(g)
      setPlay(createPlayState(g))
      setFeedback('')
      setWrongId(null)
      setListOpen(false)
      setGameState('playing')
    } catch (e) {
      // Aucune grille valide (ou classe non proposée) : aucune grille montrée (P12 a)
      console.warn('Nombres croisés : grille non obtenue', { className, subsystem, seed, code: e?.code })
      setGame(null)
      setPlay(null)
      setGameState('unavailable')
    } finally {
      busyRef.current = false
    }
  }

  const handleStart = () => {
    if (availability !== 'playable') return
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
    setPlay(null)
  }

  // « Retour » qui quitte l'activité : retour au tableau de bord élève (Q2)
  const handleBackToDashboard = () => {
    handleBackToSelect()
    setCurrentPage('studentDashboard')
  }

  // Score enregistré dès que le dernier nombre est résolu (trouvé ou montré),
  // une seule fois par partie (leçon du lot A de la phase 4)
  const saveFinalScore = (state) => {
    if (!game || !isFinished(state) || scoreSavedForRef.current === game) return
    scoreSavedForRef.current = game
    saveScore(user?.id, GAME_TYPE_CROSS_NUMBER, crossNumberScore(state), game.level, {
      seed: game.seed,
      className: game.className,
      subsystem: game.subsystem,
      templateId: game.templateId,
      numberCount: game.entries.length,
      // Aides notées (P9 a) : nombres trouvés, montrés, avec un chiffre révélé ; erreurs
      ...playSummary(state)
    }).catch(e => console.error('Erreur:', e))
  }

  const update = (next) => {
    if (next === play) return
    setPlay(next)
    setWrongId(null)
  }

  const handleCell = (r, c) => {
    if (!play || isFinished(play)) return
    const next = selectCell(play, game, r, c)
    if (next !== play) setFeedback('')
    update(next)
  }

  const handleEntry = (id) => {
    if (!play || isFinished(play)) return
    const next = selectEntry(play, game, id)
    if (next !== play) setFeedback('')
    update(next)
  }

  const handleDigit = (d) => {
    if (!play) return
    update(inputDigit(play, game, d))
  }

  const handleDelete = () => {
    if (!play) return
    update(deleteDigit(play, game))
  }

  // Nombres complétés sans l'élève (choix n° 8, décision d'Isaac du
  // 2026-11-08) : montrés d'office, enregistrés faux, 0 point. Renvoie la
  // phrase à ajouter au message ('' s'il n'y en a pas).
  const recordAutoShown = (ids) => {
    for (const id of ids) {
      saveUserProgress(user?.id, null, false, null, { gameType: GAME_TYPE_CROSS_NUMBER, itemId: crossNumberItemId(game, id) })
    }
    if (ids.length === 0) return ''
    const names = ids.map(id => entryName(entryById(game, id))).join(', ')
    return t(`Rempli sans toi (sans points) : ${names}.`, `Filled in without you (no points): ${names}.`)
  }

  const handleCheck = () => {
    if (!play) return
    const { state: next, result, entry, revealedCell, autoShown } = checkEntry(play, game)
    if (result === null) return
    saveUserProgress(user?.id, null, result === 'correct', null, { gameType: GAME_TYPE_CROSS_NUMBER, itemId: crossNumberItemId(game, entry.id) })
    const autoText = recordAutoShown(autoShown)
    setPlay(next)
    if (result === 'correct') {
      setWrongId(null)
      const done = isFinished(next)
      const msg = t(`Bravo ! ${entryName(entry)} : ${fmt(entry.answer)}.`, `Well done! ${entryName(entry)}: ${fmt(entry.answer)}.`)
      setFeedback(done ? `${msg} ${t('Grille terminée !', 'Puzzle complete!')}` : msg)
      saveFinalScore(next)
      return
    }
    setWrongId(entry.id)
    const parts = [t(`Pas encore. ${entryName(entry)} : ${entry.text.fr}. Corrige les chiffres, puis vérifie.`,
      `Not yet. ${entryName(entry)}: ${entry.text.en}. Fix the digits, then check.`)]
    if (revealedCell) parts.push(t('Un chiffre est révélé.', 'One digit is revealed.'))
    if (autoText) parts.push(autoText)
    if (canShowAnswer(next, entry.id)) parts.push(t('Tu peux essayer encore ou voir la réponse.', 'You can try again or see the answer.'))
    if (isFinished(next)) parts.push(t('Grille terminée !', 'Puzzle complete!'))
    setFeedback(parts.join(' '))
    saveFinalScore(next)
  }

  const handleShowAnswer = () => {
    if (!play?.selected || !canShowAnswer(play, play.selected.id)) return
    const { state: next, entry, autoShown } = showAnswerResult(play, game)
    saveUserProgress(user?.id, null, false, null, { gameType: GAME_TYPE_CROSS_NUMBER, itemId: crossNumberItemId(game, entry.id) })
    const autoText = recordAutoShown(autoShown)
    setPlay(next)
    setWrongId(null)
    const parts = [t(`La réponse était ${fmt(entry.answer)}. Ce nombre ne compte pas de points.`,
      `The answer was ${fmt(entry.answer)}. This number gives no points.`)]
    if (autoText) parts.push(autoText)
    if (isFinished(next)) parts.push(t('Grille terminée !', 'Puzzle complete!'))
    setFeedback(parts.join(' '))
    saveFinalScore(next)
  }

  // « Terminer » : récapitulatif, sans réenregistrer le score
  const handleFinish = () => {
    saveFinalScore(play) // filet de sécurité, sans effet si déjà enregistré
    setGameState('finished')
  }

  // Ligne qui rappelle la classe utilisée pour les réglages (comme les pyramides)
  const classLine = () => {
    const sub = SUBSYSTEM_LABEL[subsystem][lang]
    if (!isDefault) return t(`Réglé pour : ${className} (${sub}).`, `Set for: ${className} (${sub}).`)
    return reason === 'mismatch'
      ? t(`Réglé pour : ${className} (${sub}), classe par défaut : la classe du profil (${user?.class}) ne correspond pas à son niveau ou à son sous-système.`,
        `Set for: ${className} (${sub}), default class: the profile class (${user?.class}) does not match its level or subsystem.`)
      : t(`Réglé pour : ${className} (${sub}), classe par défaut : le profil n'a pas de classe.`,
        `Set for: ${className} (${sub}), default class: the profile has no class.`)
  }

  // --- Grille ---------------------------------------------------------------

  const renderGrid = (interactive) => {
    const area = visibleArea(game)
    const numbers = cellNumbers(game)
    const sel = interactive ? play.selected : null
    const selEntry = sel ? entryById(game, sel.id) : null
    const inSel = (r, c) => selEntry !== null && selEntry.cells.some(([a, b]) => a === r && b === c)
    const wrongEntry = wrongId ? entryById(game, wrongId) : null
    const inWrong = (r, c) => wrongEntry !== null && wrongEntry.cells.some(([a, b]) => a === r && b === c)
    const cells = []
    for (let r = area.top; r <= area.bottom; r++) {
      for (let c = area.left; c <= area.right; c++) {
        const key = `${r}-${c}`
        const kind = cellKind(play, game, r, c)
        if (kind === 'black') {
          cells.push(<span key={key} className="cn-cell cn-cell--black" aria-hidden="true" />)
          continue
        }
        const digit = play.values[r][c]
        const isCursor = sel !== null && sel.cell[0] === r && sel.cell[1] === c
        const classes = ['cn-cell', `cn-cell--${kind}`]
        if (inSel(r, c)) classes.push('cn-cell--in-entry')
        if (isCursor) classes.push('cn-cell--cursor')
        if (inWrong(r, c) && kind === 'open') classes.push('cn-cell--wrong')
        const where = t(`ligne ${r - area.top + 1}, colonne ${c - area.left + 1}`, `row ${r - area.top + 1}, column ${c - area.left + 1}`)
        const state = kind === 'found' ? t(', trouvé', ', found')
          : kind === 'shown' ? t(', réponse montrée', ', answer shown')
            : kind === 'revealed' ? t(', chiffre révélé', ', revealed digit') : ''
        const label = `${numbers[r][c] !== null ? `${numbers[r][c]}, ` : ''}${where}, ${digit === null ? t('vide', 'empty') : digit}${state}`
        const content = (
          <>
            {numbers[r][c] !== null && <span className="cn-cell__num" aria-hidden="true">{numbers[r][c]}</span>}
            <span className="cn-cell__digit" aria-hidden="true">{digit ?? ''}</span>
          </>
        )
        if (!interactive) {
          cells.push(<span key={key} className={classes.join(' ')} role="img" aria-label={label} data-cell={key}>{content}</span>)
          continue
        }
        cells.push(
          <button
            key={key}
            type="button"
            className={classes.join(' ')}
            onClick={() => handleCell(r, c)}
            aria-label={label}
            aria-pressed={isCursor}
            data-cell={key}
            // Case du nombre choisi : Entrée y vérifie le nombre (pavé numérique)
            data-numberpad-enter={inSel(r, c) ? 'true' : undefined}
          >
            {content}
          </button>
        )
      }
    }
    return (
      <div
        className={`cn-grid cn-grid--cols-${area.cols}`}
        role="group"
        aria-label={t('Grille', 'Grid')}
        data-testid="cn-grid"
        style={{ '--cn-cols': area.cols, '--cn-rows': area.rows }}
      >
        {cells}
      </div>
    )
  }

  // Liste des définitions (horizontal puis vertical) ; dans la partie, chaque
  // définition non résolue choisit son nombre
  const renderList = (interactive) => (
    <div className="cn-list" data-testid="cn-list">
      {['across', 'down'].map(dir => (
        <div key={dir} className="cn-list__col">
          <h2 className="cn-list__title">{dir === 'across' ? t('Horizontal', 'Across') : t('Vertical', 'Down')}</h2>
          <ul>
            {game.entries.filter(e => e.direction === dir).map(e => {
              const status = play.status[e.id]
              const resolved = isResolved(play, e.id)
              const active = interactive && play.selected?.id === e.id
              const text = (
                <>
                  <span className="cn-list__num">{e.number}.</span> {e.text[lang]}
                  {resolved && (
                    <span className={`cn-list__answer cn-list__answer--${status}`}>
                      {' = '}{fmt(e.answer)}
                      {status === 'shown' ? t(' (réponse montrée)', ' (answer shown)') : ''}
                      {status === 'found' && play.revealed[e.id] ? t(' (chiffre révélé)', ' (revealed digit)') : ''}
                    </span>
                  )}
                </>
              )
              return (
                <li key={e.id}>
                  {interactive ? (
                    <button
                      type="button"
                      className={`cn-list__item ${active ? 'cn-list__item--active' : ''} ${resolved ? 'cn-list__item--resolved' : ''}`}
                      onClick={() => handleEntry(e.id)}
                      disabled={resolved}
                      aria-pressed={active}
                      data-entry={e.id}
                    >
                      {text}
                    </button>
                  ) : (
                    <span className={`cn-list__item cn-list__item--resolved`} data-entry={e.id}>{text}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )

  // --- Écrans ---------------------------------------------------------------

  if (gameState === 'select') {
    return (
      <div className="pyramid-select">
        <div className="pyramid-select__container">
          <h1>{title}</h1>
          <p className="pyramid-select__intro">
            {t('Trouve chaque nombre grâce à sa définition et écris-le dans la grille, un chiffre par case. Les chiffres se croisent : un nombre trouvé aide à trouver les autres.',
              'Find each number from its clue and write it in the grid, one digit per box. The digits cross: a number you find helps with the others.')}
          </p>
          <p className="pyramid-select__class" data-testid="cn-class">
            {libelleNiveau(mathClass.level, language)} · {classLine()}
          </p>

          {availability === 'not-offered' && (
            <p className="cn-notice" role="status" data-testid="cn-not-offered">
              {t(`Pas encore de nombres croisés pour ta classe (${className}) : les nombres étudiés sont encore petits. Ce jeu s'ouvrira à partir de la classe ${FIRST_CLASS[subsystem]}.`,
                `No number crossword yet for your class (${className}): the numbers you study are still small. This game will open from ${FIRST_CLASS[subsystem]}.`)}
            </p>
          )}
          {availability === 'playable' && (
            <div className="pyramid-select__section">
              <label className="pyramid-select__label" htmlFor="cn-seed">
                {t('Numéro de partie (facultatif)', 'Game number (optional)')}
              </label>
              <input
                id="cn-seed"
                className="pyramid-select__seed"
                type="text"
                inputMode="numeric"
                value={seedInput}
                onChange={e => setSeedInput(e.target.value)}
                placeholder={t('Laisser vide pour une nouvelle partie', 'Leave empty for a new game')}
                aria-describedby="cn-seed-hint"
              />
              <p id="cn-seed-hint" className="pyramid-select__hint">
                {seedError
                  ? t('Numéro invalide : un nombre entier de 0 à 4294967295.', 'Invalid number: a whole number from 0 to 4294967295.')
                  : t('Avec la même version de l\'application, le même numéro et la même classe donnent la même grille (toute la classe peut jouer la même) ; la langue ne change que le texte des définitions.',
                    'With the same version of the app, the same number and class give the same grid (the whole class can play the same one); the language only changes the text of the clues.')}
              </p>
            </div>
          )}

          {availability === 'playable' && (
            <button className="pyramid-select__start" onClick={handleStart}>
              {t('Commencer', 'Start')}
            </button>
          )}
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
          <h1>{title}</h1>
          <p className="pyramid-select__intro" role="status" data-testid="cn-unavailable">
            {t('Aucune grille n\'a pu être préparée avec ce numéro. Essaie un autre numéro ou une nouvelle partie.',
              'No grid could be prepared with this number. Try another number or a new game.')}
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

  if (!game || !play) return null

  const score = crossNumberScore(play)
  const seedLine = `${t('Partie n°', 'Game no.')} ${game.seed} · ${game.className} · ${libelleNiveau(game.level, language)}`

  if (gameState === 'finished') {
    const s = playSummary(play)
    return (
      <div className="pyramid-finished cn-finished">
        <div className="pyramid-finished__container">
          <h1>🎉 {t('Partie terminée !', 'Game over!')}</h1>
          <p>
            {t(`Tu as trouvé ${s.found.length} nombre(s) sur ${game.entries.length}.`,
              `You found ${s.found.length} number(s) out of ${game.entries.length}.`)}
          </p>
          <p className="pyramid-finished__score" data-testid="cn-final-score">{score}</p>
          <p className="pyramid-finished__errors">
            {t(`Réponses fausses pendant la partie : ${s.errors}`, `Wrong answers during the game: ${s.errors}`)}
          </p>
          {s.revealed.length > 0 && (
            <p className="pyramid-finished__errors">
              {t(`Nombres avec un chiffre révélé : ${s.revealed.length}`, `Numbers with a revealed digit: ${s.revealed.length}`)}
            </p>
          )}
          {s.shown.length > 0 && (
            <p className="pyramid-finished__errors">
              {t(`Réponses montrées (sans points) : ${s.shown.length}`, `Answers shown (no points): ${s.shown.length}`)}
            </p>
          )}
          {/* Grille complète : nombres montrés distingués des nombres trouvés (cadrage §4.4) */}
          <div className="cn-finished__grid">{renderGrid(false)}</div>
          {renderList(false)}
          <p className="pyramid-game__seed cn-seed-line">{seedLine}</p>
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

  if (gameState !== 'playing') return null

  const finished = isFinished(play)
  const current = play.selected ? entryById(game, play.selected.id) : null
  const answerAvailable = current !== null && canShowAnswer(play, current.id)
  const resolvedCount = game.entries.filter(e => isResolved(play, e.id)).length

  return (
    <div className="pyramid-game cn-game" ref={gameRef} style={{ paddingBottom: bottomHeight + 16 }}>
      <div className="pyramid-game__header cn-header">
        <h1>{title} - {game.className}</h1>
        <div className="pyramid-game__progress" data-testid="cn-progress">
          {t('Nombres', 'Numbers')} {resolvedCount} / {game.entries.length} · {score} {t('points', 'points')}
        </div>
        <p className="pyramid-game__seed" data-testid="cn-seed-line">{seedLine}</p>
      </div>

      <div className="pyramid-game__card cn-card">
        {renderGrid(true)}

        <button
          type="button"
          className="cn-list-toggle"
          onClick={() => setListOpen(o => !o)}
          aria-expanded={listOpen}
          aria-controls="cn-list-panel"
        >
          {listOpen
            ? t('Cacher les définitions', 'Hide the clues')
            : t(`Toutes les définitions (${game.entries.length})`, `All the clues (${game.entries.length})`)}
        </button>
        <div id="cn-list-panel" hidden={!listOpen}>
          {listOpen && renderList(true)}
        </div>

        <div className="pyramid-game__footer">
          <button className="pyramid-game__btn pyramid-game__btn--secondary" onClick={handleNewGame}>
            {t('Nouvelle partie', 'New game')}
          </button>
          <button className="pyramid-game__btn pyramid-game__btn--secondary pyramid-game__back" onClick={handleBackToSelect}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>

      {/* Bas de l'écran, fixé : définition courante, message, pavé (P11 a) */}
      <div className="cn-bottom" data-testid="cn-bottom" ref={bottomRef}>
        {current && (
          <p className="cn-current" data-testid="cn-current">
            <strong>{entryName(current)}</strong>
            {t(' : ', ': ')}
            {current.text[lang]}
          </p>
        )}
        <p className="cn-feedback" role="status" aria-live="polite">{feedback}</p>
        {answerAvailable && (
          <button className="pyramid-game__btn pyramid-game__btn--answer cn-answer" onClick={handleShowAnswer}>
            {t('Voir la réponse', 'Show the answer')}
          </button>
        )}
        {!finished && (
          <NumberPad
            onDigit={handleDigit}
            onDelete={handleDelete}
            onValidate={handleCheck}
            validateDisabled={!canCheck(play, game)}
            language={language}
          />
        )}
        {finished && (
          <button className="pyramid-game__btn pyramid-game__btn--validate pyramid-game__next" onClick={handleFinish}>
            {t('Terminer', 'Finish')}
          </button>
        )}
      </div>
    </div>
  )
}

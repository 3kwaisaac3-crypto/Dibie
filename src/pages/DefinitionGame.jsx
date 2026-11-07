import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { getVocabByLevel, saveScore, saveUserProgress } from '../db/index'
import {
  createPairsState,
  createDefinitionGame,
  definitionSubjects,
  definitionPairCount,
  tryMatch,
  showAnswer,
  canHint,
  canShowAnswer,
  focusAfterWrong,
  isResolved,
  isFinished,
  pairStatus,
  pairsScore,
  foundCount,
  colorIndex,
  pairById,
  newSeed,
  isValidSeed,
  GAME_TYPE_DEFINITION,
  DEFINITION_LEVELS
} from '../utils/pairsGame'
import { defaultCrosswordSubject } from '../utils/crosswordLayout'
import { MATIERES, MATIERE_TOUTES, filtrerParMatiere, libelleMatiere, libelleSujet } from '../data/sujets-matieres'
import { libelleNiveau } from '../data/niveaux'
import '../styles/AnagramGame.css'
import '../styles/PairsGame.css'

// Associations mot ↔ définition (fiche L4 du catalogue v0.2 ; lot C de la
// phase 4, moteur C : src/utils/pairsGame.js ; docs/paires.md §13 à §17).
// Même déroulement que L3 (src/pages/PairsGame.jsx) : l'élève touche un mot
// puis sa définition (ou l'inverse). Mots et définitions dans la langue de
// l'interface au lancement. Mauvaise paire : sans pénalité ; après 2 erreurs
// sur un élément, indice = traduction du mot dans l'autre langue ; après 3,
// « Voir la réponse » (0 point). Pas de L4 en SIL-CP (P3 b).
// Disposition (CHOIX PROVISOIRE) : sur téléphone, les mots en grille de deux
// colonnes au-dessus, les définitions en liste pleine largeur en dessous ; sur
// écran large, mots à gauche (1/3), définitions à droite (2/3).

const OTHER_LANG_NAME = {
  fr: { fr: 'en français', en: 'in French' },
  en: { fr: 'en anglais', en: 'in English' }
}

export default function DefinitionGame() {
  const { user, language, setCurrentPage } = useAppStore()
  const t = (fr, en) => (language === 'fr' ? fr : en)

  // Élève de SIL-CP : le jeu s'ouvre en CE1-CE2, avec un message (CHOIX PROVISOIRE)
  const youngLearner = user?.level === 'SIL-CP'
  const [level, setLevel] = useState(DEFINITION_LEVELS.includes(user?.level) ? user.level : DEFINITION_LEVELS[0])
  const [matiere, setMatiere] = useState(MATIERE_TOUTES)
  const [subject, setSubject] = useState('')
  const [levelEntries, setLevelEntries] = useState(null)
  const [entriesLevel, setEntriesLevel] = useState(null)
  const [seedInput, setSeedInput] = useState('')
  const [seedError, setSeedError] = useState(false)
  const [gameState, setGameState] = useState('select') // select | playing | finished | unavailable
  const [game, setGame] = useState(null)
  const [pairs, setPairs] = useState(createPairsState())
  const [selected, setSelected] = useState(null) // { side, id }
  const [focus, setFocus] = useState(null) // élément dont les aides sont proposées
  const [wrong, setWrong] = useState(null) // { left, right, n } : éléments qui tremblent
  const [message, setMessage] = useState('')

  const busyRef = useRef(false)
  // Partie dont le score est déjà enregistré : un seul saveScore par partie
  const scoreSavedForRef = useRef(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      let entries = []
      try {
        entries = await getVocabByLevel(level)
      } catch (e) {
        console.error('Mot ↔ définition : erreur de chargement', e)
      }
      if (cancelled) return
      setLevelEntries(entries)
      setEntriesLevel(level)
    }
    load()
    return () => { cancelled = true }
  }, [level])

  // Sujets du niveau dans la langue de l'interface (les définitions et les
  // règles de tirage dépendent de la langue), grisés s'ils sont injouables
  const subjectList = useMemo(
    () => (levelEntries && entriesLevel === level ? definitionSubjects(levelEntries, level, language) : null),
    [levelEntries, entriesLevel, level, language]
  )

  // Premier affichage, changement de niveau ou de langue : sujet jouable par défaut
  const subjectKeyRef = useRef(null)
  useEffect(() => {
    const key = `${level}|${language}`
    if (!subjectList || subjectKeyRef.current === key) return
    subjectKeyRef.current = key
    setSubject(prev => defaultCrosswordSubject(filtrerParMatiere(subjectList, matiere), prev))
  }, [subjectList, level, language, matiere])

  const chooseMatiere = (id) => {
    setMatiere(id)
    setSubject(prev => defaultCrosswordSubject(filtrerParMatiere(subjectList || [], id), prev))
  }

  const subjectsOfMatiere = subjectList === null ? null : filtrerParMatiere(subjectList, matiere)
  const displayedSubjects = (subjectsOfMatiere || []).slice()
  if (language !== 'fr') {
    displayedSubjects.sort((a, b) => libelleSujet(a.subject, language).localeCompare(libelleSujet(b.subject, language), 'en'))
  }
  const listReady = subjectsOfMatiere !== null
  const emptyMatiere = listReady && subjectsOfMatiere.length === 0
  const noPlayableSubject = listReady && !emptyMatiere && !subjectsOfMatiere.some(s => s.playable)
  const subjectPlayable = listReady && subjectsOfMatiere.some(s => s.subject === subject && s.playable)
  const canStart = subjectPlayable && !generating

  const score = pairsScore(pairs)
  const title = t('Mot ↔ définition', 'Word ↔ definition')

  const resetPlay = () => {
    setPairs(createPairsState())
    setSelected(null)
    setFocus(null)
    setWrong(null)
    setMessage('')
  }

  const startGame = (seed) => {
    if (busyRef.current) return
    busyRef.current = true
    setGenerating(true)
    try {
      const entries = (levelEntries || []).filter(v => v.sujet === subject)
      const g = createDefinitionGame(entries, level, seed, language)
      if (!g) {
        console.warn('Mot ↔ définition : partie impossible', { level, subject, seed, language })
        setGame(null)
        setGameState('unavailable')
        return
      }
      setGame(g)
      resetPlay()
      setGameState('playing')
    } catch (e) {
      console.error('Mot ↔ définition : erreur de préparation', e)
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

  const handleBackToDashboard = () => {
    setGameState('select')
    setGame(null)
    setCurrentPage('studentDashboard')
  }

  const pairText = (pair) => `${pair.left.text} : ${pair.right.text}`

  const handleTap = (side, id) => {
    if (isResolved(pairs, id) || isFinished(game, pairs)) return
    if (!selected || selected.side === side) {
      const same = selected && selected.id === id
      setSelected(same ? null : { side, id })
      setFocus(same ? null : { side, id })
      setWrong(null)
      setMessage('')
      return
    }
    const leftId = side === 'left' ? id : selected.id
    const rightId = side === 'right' ? id : selected.id
    const { state: next, correct } = tryMatch(pairs, leftId, rightId)
    setPairs(next)
    setSelected(null)
    if (correct) {
      setFocus(null)
      setWrong(null)
      setMessage(t(`Bravo ! ${pairById(game, leftId).left.text}`, `Well done! ${pairById(game, leftId).left.text}`))
      saveUserProgress(user?.id, leftId, true, null, { gameType: GAME_TYPE_DEFINITION, itemId: leftId })
      saveFinalScore(next)
    } else {
      setFocus(focusAfterWrong(next, leftId, rightId))
      setWrong(w => ({ left: leftId, right: rightId, n: (w?.n ?? 0) + 1 }))
      setMessage(t('Ce mot et cette définition ne vont pas ensemble. Essaie encore.', 'This word and this definition do not match. Try again.'))
    }
  }

  const handleShowAnswer = () => {
    if (!focus) return
    const next = showAnswer(pairs, focus.id)
    if (next === pairs) return
    const pair = pairById(game, focus.id)
    setPairs(next)
    setSelected(null)
    setFocus(null)
    setWrong(null)
    setMessage(t(`La réponse : ${pairText(pair)}`, `The answer: ${pairText(pair)}`))
    saveUserProgress(user?.id, pair.id, false, null, { gameType: GAME_TYPE_DEFINITION, itemId: pair.id })
    saveFinalScore(next)
  }

  // Score enregistré une seule fois, dès que la dernière paire est résolue
  const saveFinalScore = (state) => {
    if (!game || !isFinished(game, state) || scoreSavedForRef.current === game) return
    scoreSavedForRef.current = game
    saveScore(user?.id, GAME_TYPE_DEFINITION, pairsScore(state), level, {
      seed: game.seed,
      language: game.language,
      subject,
      pairCount: game.pairs.length
    }).catch(e => console.error('Erreur:', e))
  }

  const finishGame = () => {
    saveFinalScore(pairs) // filet de sécurité, sans effet si déjà enregistré
    setGameState('finished')
  }

  if (gameState === 'select') {
    const count = definitionPairCount(level)
    return (
      <div className="anagram-select pairs-select">
        <div className="anagram-select__container">
          <h1>{title}</h1>
          <p className="anagram-select__intro">
            {t('Relie chaque mot à sa définition : touche un mot, puis la définition qui lui correspond.',
              'Match each word with its definition: tap a word, then the definition that goes with it.')}
          </p>
          {youngLearner && (
            <p className="pairs-select__empty" role="status">
              {t('Ce jeu commence au CE1-CE2 : il faut lire des phrases. Tu peux essayer avec un adulte.',
                'This game starts in Class 3-4: you need to read sentences. You can try it with an adult.')}
            </p>
          )}

          <div className="anagram-select__section">
            <span className="anagram-select__label" id="definition-level-label">{t('Niveau', 'Level')}</span>
            <div className="anagram-select__options" role="group" aria-labelledby="definition-level-label">
              {DEFINITION_LEVELS.map(l => (
                <button
                  key={l}
                  className={`anagram-select__btn ${level === l ? 'active' : ''}`}
                  onClick={() => setLevel(l)}
                  aria-pressed={level === l}
                >
                  {libelleNiveau(l, language)}
                  <span className="anagram-select__size">
                    {t(`${definitionPairCount(l)} paires`, `${definitionPairCount(l)} pairs`)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="anagram-select__section">
            <span className="anagram-select__label" id="definition-matiere-label">{t('Matière', 'Subject area')}</span>
            <div className="anagram-select__options pairs-select__matieres" role="group" aria-labelledby="definition-matiere-label">
              {MATIERES.map(m => (
                <button
                  key={m.id}
                  className={`anagram-select__btn ${matiere === m.id ? 'active' : ''}`}
                  onClick={() => chooseMatiere(m.id)}
                  aria-pressed={matiere === m.id}
                >
                  {libelleMatiere(m.id, language)}
                </button>
              ))}
            </div>
          </div>

          <div className="anagram-select__section">
            <span className="anagram-select__label" id="definition-subject-label">{t('Sujet', 'Topic')}</span>
            {emptyMatiere && (
              <p className="pairs-select__empty" role="status">
                {t(`Aucun sujet en ${libelleMatiere(matiere, language)} pour ce niveau. Choisis une autre matière ou un autre niveau.`,
                  `No topics in ${libelleMatiere(matiere, language)} for this level. Choose another subject area or level.`)}
              </p>
            )}
            <div className="pairs-select__grid" role="group" aria-labelledby="definition-subject-label">
              {displayedSubjects.map(({ subject: s, playable }) => (
                <button
                  key={s}
                  className={`pairs-select__subject ${subject === s ? 'active' : ''}`}
                  onClick={() => setSubject(s)}
                  disabled={!playable}
                  aria-pressed={subject === s}
                >
                  {libelleSujet(s, language)}
                  {!playable && (
                    <span className="pairs-select__soon">{t('pas assez de mots', 'not enough words')}</span>
                  )}
                </button>
              ))}
            </div>
            {noPlayableSubject && (
              <p className="anagram-select__hint">
                {t(`Aucun sujet de cette matière n'a assez de mots pour ${count} paires.`,
                  `No topic in this subject area has enough words for ${count} pairs.`)}
              </p>
            )}
          </div>

          <div className="anagram-select__section">
            <label className="anagram-select__label" htmlFor="definition-seed">
              {t('Numéro de partie (facultatif)', 'Game number (optional)')}
            </label>
            <input
              id="definition-seed"
              className="anagram-select__seed"
              type="text"
              inputMode="numeric"
              value={seedInput}
              onChange={e => setSeedInput(e.target.value)}
              placeholder={t('Laisser vide pour une nouvelle partie', 'Leave empty for a new game')}
              aria-describedby="definition-seed-hint"
            />
            <p id="definition-seed-hint" className="anagram-select__hint">
              {seedError
                ? t('Numéro invalide : un nombre entier de 0 à 4294967295.', 'Invalid number: a whole number from 0 to 4294967295.')
                : t('Avec la même version de l\'application, le même numéro, le même niveau, le même sujet et la même langue donnent les mêmes paires.',
                  'With the same version of the app, the same number, level, topic and language give the same pairs.')}
            </p>
          </div>

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

  if (gameState === 'unavailable') {
    return (
      <div className="anagram-select pairs-select">
        <div className="anagram-select__container">
          <h1>{title}</h1>
          <p className="anagram-select__intro" role="status">
            {t('Cette partie n\'est pas disponible pour le moment. Choisis un autre sujet.',
              'This game is not available right now. Choose another topic.')}
          </p>
          <button className="anagram-select__back" onClick={handleBackToSelect}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>
    )
  }

  if (!game) return null

  const seedLine = `${t('Partie n°', 'Game no.')} ${game.seed} · ${libelleSujet(subject, language)}`

  if (gameState === 'finished') {
    const found = foundCount(pairs)
    return (
      <div className="anagram-finished pairs-select">
        <div className="anagram-finished__container">
          <h1>🎉 {t('Partie terminée !', 'Game over!')}</h1>
          <p>
            {t(`Tu as trouvé ${found} paire(s) sur ${game.pairs.length}.`,
              `You found ${found} pair(s) out of ${game.pairs.length}.`)}
          </p>
          <p className="anagram-finished__score">{score}</p>
          <ul className="pairs-recap pairs-recap--definitions">
            {game.leftOrder.map(id => {
              const pair = pairById(game, id)
              const shown = pairStatus(pairs, id) === 'shown'
              return (
                <li key={id} lang={game.language} className={shown ? 'pairs-recap__item--shown' : 'pairs-recap__item--found'}>
                  <span className="pairs-recap__word">{pair.left.text}</span>
                  <span aria-hidden="true"> : </span>
                  <span className="pairs-recap__definition">{pair.right.text}</span>
                  <span className="anagram-sr-only">{shown ? t(' (réponse montrée)', ' (answer shown)') : t(' (trouvée)', ' (found)')}</span>
                </li>
              )
            })}
          </ul>
          <p className="anagram-game__seed">
            {seedLine} · {libelleNiveau(level, language)}
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

  if (gameState !== 'playing') return null

  const finished = isFinished(game, pairs)
  const focusPair = focus ? pairById(game, focus.id) : null
  const hint = focus && canHint(pairs, focus.side, focus.id)
  const answerAvailable = focus && canShowAnswer(pairs, focus.side, focus.id)
  const otherLangName = focusPair ? OTHER_LANG_NAME[focusPair.left.translationLang][language === 'fr' ? 'fr' : 'en'] : ''

  const renderItem = (side, id) => {
    const pair = pairById(game, id)
    const item = pair[side]
    const resolved = isResolved(pairs, id)
    const color = colorIndex(pairs, id)
    const isSelected = selected?.side === side && selected.id === id
    const shaking = wrong && wrong[side] === id
    const classes = ['pairs-item', side === 'left' ? 'pairs-item--word' : 'pairs-item--definition']
    if (isSelected) classes.push('pairs-item--selected')
    if (resolved) classes.push(`pairs-item--resolved pairs-color-${color % 8}`)
    if (pairStatus(pairs, id) === 'shown') classes.push('pairs-item--shown')
    if (shaking) classes.push('pairs-item--wrong')
    return (
      <li key={id}>
        <button
          key={shaking ? `w${wrong.n}` : 'n'}
          className={classes.join(' ')}
          lang={item.lang}
          onClick={() => handleTap(side, id)}
          disabled={resolved}
          aria-pressed={isSelected}
          data-pair={resolved ? color + 1 : undefined}
        >
          {resolved && <span className="pairs-item__badge" aria-hidden="true">{color + 1}</span>}
          <span className="pairs-item__text">{item.text}</span>
          {resolved && (
            <span className="anagram-sr-only">
              {pairStatus(pairs, id) === 'shown'
                ? t(` (réponse montrée, paire ${color + 1})`, ` (answer shown, pair ${color + 1})`)
                : t(` (trouvé, paire ${color + 1})`, ` (found, pair ${color + 1})`)}
            </span>
          )}
        </button>
      </li>
    )
  }

  return (
    <div className="anagram-game pairs-game">
      <div className="anagram-game__header">
        <h1>{title} - {libelleNiveau(level, language)}</h1>
        <div className="anagram-game__progress">
          {t('Paires', 'Pairs')} {pairs.resolved.length} / {game.pairs.length} · {score} {t('points', 'points')}
        </div>
        <p className="anagram-game__seed">{seedLine}</p>
      </div>

      <div className="anagram-game__card">
        <p className="pairs-game__instruction">
          {t('Touche un mot, puis sa définition.', 'Tap a word, then its definition.')}
        </p>
        <div className="pairs-board pairs-board--definitions">
          <div className="pairs-column pairs-column--words">
            <h2 className="pairs-column__title">{t('Mots', 'Words')}</h2>
            <ul className="pairs-column__list" aria-label={t('Mots', 'Words')}>
              {game.leftOrder.map(id => renderItem('left', id))}
            </ul>
          </div>
          <div className="pairs-column pairs-column--definitions">
            <h2 className="pairs-column__title">{t('Définitions', 'Definitions')}</h2>
            <ul className="pairs-column__list" aria-label={t('Définitions', 'Definitions')}>
              {game.rightOrder.map(id => renderItem('right', id))}
            </ul>
          </div>
        </div>

        <p className="anagram-game__feedback pairs-game__feedback" role="status" aria-live="polite">{message}</p>

        {/* Indice (P6 a) : la traduction du mot dans l'autre langue */}
        <div aria-live="polite">
          {hint && focusPair && (
            <p className="pairs-game__hint">
              {focus.side === 'left' ? (
                <>
                  <strong>{t('Indice pour', 'Hint for')} « <span lang={focusPair.left.lang}>{focusPair.left.text}</span> »</strong>
                  {t(' : ', ': ')}
                  {otherLangName}, « <span lang={focusPair.left.translationLang}>{focusPair.left.translation}</span> »
                </>
              ) : (
                <>
                  <strong>{t('Indice', 'Hint')}</strong>
                  {t(' : le mot de cette définition se dit ', ': the word for this definition is ')}
                  « <span lang={focusPair.left.translationLang}>{focusPair.left.translation}</span> » {otherLangName}.
                </>
              )}
            </p>
          )}
        </div>
        {answerAvailable && (
          <button className="anagram-game__btn anagram-game__btn--solution" onClick={handleShowAnswer}>
            {t('Voir la réponse', 'Show the answer')}
          </button>
        )}
        {finished && (
          <button className="anagram-select__start" onClick={finishGame}>
            {t('Terminer', 'Finish')}
          </button>
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

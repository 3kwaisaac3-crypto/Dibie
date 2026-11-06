import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { getVocabByLevel, saveScore, saveUserProgress } from '../db/index'
import {
  createPairsState,
  createTranslationGame,
  translationSubjects,
  translationPairCount,
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
  GAME_TYPE_TRANSLATION,
  TRANSLATION_LEVELS
} from '../utils/pairsGame'
import { defaultCrosswordSubject } from '../utils/crosswordLayout'
import { MATIERES, MATIERE_TOUTES, filtrerParMatiere, libelleMatiere, libelleSujet } from '../data/sujets-matieres'
import { libelleNiveau } from '../data/niveaux'
import '../styles/AnagramGame.css'
import '../styles/PairsGame.css'

// Associations mot ↔ traduction FR ↔ EN (fiche L3 du catalogue v0.2 ; lot A de
// la phase 4, moteur C : src/utils/pairsGame.js ; docs/paires.md).
// Interface : CHOIX PROVISOIRE, à valider par un enseignant. L'élève touche un
// mot dans une colonne puis sa traduction dans l'autre (dans un sens ou dans
// l'autre). Paire trouvée : les deux mots prennent la même couleur et le même
// numéro. Mauvaise paire : les deux mots tremblent et restent libres, sans
// pénalité ; après 2 erreurs sur un même mot, indice (définition) ; après 3,
// « Voir la réponse » (paire montrée, 0 point). Pas de chronomètre (D5).

const LANG_NAME = {
  fr: { fr: 'Français', en: 'French' },
  en: { fr: 'Anglais', en: 'English' }
}

export default function PairsGame() {
  const { user, language, setCurrentPage } = useAppStore()
  const t = (fr, en) => (language === 'fr' ? fr : en)

  const [level, setLevel] = useState(TRANSLATION_LEVELS.includes(user?.level) ? user.level : TRANSLATION_LEVELS[0])
  const [matiere, setMatiere] = useState(MATIERE_TOUTES)
  const [subject, setSubject] = useState('')
  // Entrées actives du niveau choisi, et niveau auquel elles correspondent
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

  // Empêche un double clic de lancer deux parties (ou d'enregistrer deux fois)
  const busyRef = useRef(false)
  // Partie dont le score est déjà enregistré : un seul saveScore par partie
  const scoreSavedForRef = useRef(null)
  const [generating, setGenerating] = useState(false)

  // Entrées du niveau (le sujet par défaut est choisi à chaque changement de niveau)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      let entries = []
      try {
        entries = await getVocabByLevel(level)
      } catch (e) {
        console.error('Paires : erreur de chargement', e)
      }
      if (cancelled) return
      setLevelEntries(entries)
      setEntriesLevel(level)
    }
    load()
    return () => { cancelled = true }
  }, [level])

  // Sujets du niveau, grisés s'ils ne permettent pas une partie complète
  const subjectList = useMemo(
    () => (levelEntries && entriesLevel === level ? translationSubjects(levelEntries, level) : null),
    [levelEntries, entriesLevel, level]
  )

  // Premier affichage ou changement de niveau : sujet jouable par défaut
  const subjectLevelRef = useRef(null)
  useEffect(() => {
    if (!subjectList || subjectLevelRef.current === level) return
    subjectLevelRef.current = level
    setSubject(prev => defaultCrosswordSubject(filtrerParMatiere(subjectList, matiere), prev))
  }, [subjectList, level, matiere])

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
  const gameLanguageName = (lang) => LANG_NAME[lang][language === 'fr' ? 'fr' : 'en']

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
      // Colonne de gauche dans la langue de l'interface au lancement (P5 a)
      const g = createTranslationGame(entries, level, seed, language)
      if (!g) {
        console.warn('Paires : partie impossible', { level, subject, seed })
        setGame(null)
        setGameState('unavailable')
        return
      }
      setGame(g)
      resetPlay()
      setGameState('playing')
    } catch (e) {
      console.error('Paires : erreur de préparation', e)
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

  const pairText = (pair) => `${pair.left.text} = ${pair.right.text}`

  const handleTap = (side, id) => {
    if (isResolved(pairs, id) || isFinished(game, pairs)) return
    // Premier toucher, ou nouveau choix dans la même colonne
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
      setMessage(t(`Bravo ! ${pairText(pairById(game, leftId))}`, `Well done! ${pairText(pairById(game, leftId))}`))
      saveUserProgress(user?.id, leftId, true, null, { gameType: GAME_TYPE_TRANSLATION, itemId: leftId })
      saveFinalScore(next)
    } else {
      setFocus(focusAfterWrong(next, leftId, rightId))
      setWrong(w => ({ left: leftId, right: rightId, n: (w?.n ?? 0) + 1 }))
      setMessage(t('Ces deux mots ne vont pas ensemble. Essaie encore.', 'These two words do not match. Try again.'))
    }
  }

  // Paire montrée : 0 point, enregistrée comme non trouvée
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
    saveUserProgress(user?.id, pair.id, false, null, { gameType: GAME_TYPE_TRANSLATION, itemId: pair.id })
    saveFinalScore(next)
  }

  // Score enregistré dès que la dernière paire est résolue (trouvée ou
  // montrée) : « Retour » ou « Nouvelle partie » ne le font plus perdre.
  // Une seule fois par partie (scoreSavedForRef).
  const saveFinalScore = (state) => {
    if (!game || !isFinished(game, state) || scoreSavedForRef.current === game) return
    scoreSavedForRef.current = game
    saveScore(user?.id, GAME_TYPE_TRANSLATION, pairsScore(state), level, {
      seed: game.seed,
      language: game.language,
      subject,
      pairCount: game.pairs.length
    }).catch(e => console.error('Erreur:', e))
  }

  // « Terminer » : affiche le récapitulatif, sans réenregistrer le score
  const finishGame = () => {
    saveFinalScore(pairs) // filet de sécurité, sans effet si déjà enregistré
    setGameState('finished')
  }

  if (gameState === 'select') {
    const count = translationPairCount(level)
    return (
      <div className="anagram-select pairs-select">
        <div className="anagram-select__container">
          <h1>{t('Associations FR ↔ EN', 'Matching FR ↔ EN')}</h1>
          <p className="anagram-select__intro">
            {t('Relie chaque mot à sa traduction : touche un mot, puis sa traduction dans l\'autre colonne.',
              'Match each word with its translation: tap a word, then its translation in the other column.')}
          </p>

          <div className="anagram-select__section">
            <span className="anagram-select__label" id="pairs-level-label">{t('Niveau', 'Level')}</span>
            <div className="anagram-select__options" role="group" aria-labelledby="pairs-level-label">
              {TRANSLATION_LEVELS.map(l => (
                <button
                  key={l}
                  className={`anagram-select__btn ${level === l ? 'active' : ''}`}
                  onClick={() => setLevel(l)}
                  aria-pressed={level === l}
                >
                  {libelleNiveau(l, language)}
                  <span className="anagram-select__size">
                    {t(`${translationPairCount(l)} paires`, `${translationPairCount(l)} pairs`)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="anagram-select__section">
            <span className="anagram-select__label" id="pairs-matiere-label">{t('Matière', 'Subject area')}</span>
            <div className="anagram-select__options pairs-select__matieres" role="group" aria-labelledby="pairs-matiere-label">
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
            <span className="anagram-select__label" id="pairs-subject-label">{t('Sujet', 'Topic')}</span>
            {emptyMatiere && (
              <p className="pairs-select__empty" role="status">
                {t(`Aucun sujet en ${libelleMatiere(matiere, language)} pour ce niveau. Choisis une autre matière ou un autre niveau.`,
                  `No topics in ${libelleMatiere(matiere, language)} for this level. Choose another subject area or level.`)}
              </p>
            )}
            <div className="pairs-select__grid" role="group" aria-labelledby="pairs-subject-label">
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
            <label className="anagram-select__label" htmlFor="pairs-seed">
              {t('Numéro de partie (facultatif)', 'Game number (optional)')}
            </label>
            <input
              id="pairs-seed"
              className="anagram-select__seed"
              type="text"
              inputMode="numeric"
              value={seedInput}
              onChange={e => setSeedInput(e.target.value)}
              placeholder={t('Laisser vide pour une nouvelle partie', 'Leave empty for a new game')}
              aria-describedby="pairs-seed-hint"
            />
            <p id="pairs-seed-hint" className="anagram-select__hint">
              {seedError
                ? t('Numéro invalide : un nombre entier de 0 à 4294967295.', 'Invalid number: a whole number from 0 to 4294967295.')
                : t('Avec la même version de l\'application, le même numéro, le même niveau et le même sujet donnent les mêmes paires (toute la classe peut jouer la même partie).',
                  'With the same version of the app, the same number, level and topic give the same pairs (the whole class can play the same game).')}
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
          <h1>{t('Associations FR ↔ EN', 'Matching FR ↔ EN')}</h1>
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
          {/* Récapitulatif des paires (fiche L3) */}
          <ul className="pairs-recap">
            {game.leftOrder.map(id => {
              const pair = pairById(game, id)
              const shown = pairStatus(pairs, id) === 'shown'
              return (
                <li key={id} className={shown ? 'pairs-recap__item--shown' : 'pairs-recap__item--found'}>
                  <span lang={pair.left.lang}>{pair.left.text}</span>
                  <span aria-hidden="true"> = </span>
                  <span lang={pair.right.lang}>{pair.right.text}</span>
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
  const focusSide = focusPair ? focusPair[focus.side] : null
  const hint = focus && canHint(pairs, focus.side, focus.id)
  const answerAvailable = focus && canShowAnswer(pairs, focus.side, focus.id)

  const renderItem = (side, id) => {
    const pair = pairById(game, id)
    const item = pair[side]
    const resolved = isResolved(pairs, id)
    const color = colorIndex(pairs, id)
    const isSelected = selected?.side === side && selected.id === id
    const shaking = wrong && wrong[side] === id
    const classes = ['pairs-item']
    if (isSelected) classes.push('pairs-item--selected')
    if (resolved) classes.push(`pairs-item--resolved pairs-color-${color % 8}`)
    if (pairStatus(pairs, id) === 'shown') classes.push('pairs-item--shown')
    if (shaking) classes.push('pairs-item--wrong')
    return (
      <li key={id}>
        <button
          // La clé change à chaque erreur : l'animation repart même sur le même mot
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

  const leftLang = game.language
  const rightLang = leftLang === 'fr' ? 'en' : 'fr'

  return (
    <div className="anagram-game pairs-game">
      <div className="anagram-game__header">
        <h1>{t('Associations FR ↔ EN', 'Matching FR ↔ EN')} - {libelleNiveau(level, language)}</h1>
        <div className="anagram-game__progress">
          {t('Paires', 'Pairs')} {pairs.resolved.length} / {game.pairs.length} · {score} {t('points', 'points')}
        </div>
        <p className="anagram-game__seed">{seedLine}</p>
      </div>

      <div className="anagram-game__card">
        <p className="pairs-game__instruction">
          {t('Touche un mot, puis sa traduction.', 'Tap a word, then its translation.')}
        </p>
        <div className="pairs-board">
          <div className="pairs-column">
            <h2 className="pairs-column__title">{gameLanguageName(leftLang)}</h2>
            <ul className="pairs-column__list" aria-label={gameLanguageName(leftLang)}>
              {game.leftOrder.map(id => renderItem('left', id))}
            </ul>
          </div>
          <div className="pairs-column">
            <h2 className="pairs-column__title">{gameLanguageName(rightLang)}</h2>
            <ul className="pairs-column__list" aria-label={gameLanguageName(rightLang)}>
              {game.rightOrder.map(id => renderItem('right', id))}
            </ul>
          </div>
        </div>

        <p className="anagram-game__feedback pairs-game__feedback" role="status" aria-live="polite">{message}</p>

        {/* Région toujours présente : l'indice qui apparaît est annoncé */}
        <div aria-live="polite">
          {hint && focusSide && (
            <p className="pairs-game__hint">
              <strong>{t('Indice pour', 'Hint for')} « <span lang={focusSide.lang}>{focusSide.text}</span> »</strong>
              {t(' : ', ': ')}
              <span lang={focusSide.lang}>{focusSide.definition}</span>
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

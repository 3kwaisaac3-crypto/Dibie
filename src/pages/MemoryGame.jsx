import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { getVocabByLevel, saveScore, saveUserProgress } from '../db/index'
import {
  createVocabularyMemoryGame,
  memorySubjects,
  memoryPairCount,
  pairsScore,
  newSeed,
  isValidSeed,
  GAME_TYPE_MEMORY,
  MEMORY_LEVELS
} from '../utils/pairsGame'
import { defaultCrosswordSubject } from '../utils/crosswordLayout'
import { MATIERES, MATIERE_TOUTES, filtrerParMatiere, libelleMatiere, libelleSujet } from '../data/sujets-matieres'
import { libelleNiveau } from '../data/niveaux'
import MemoryPlay from '../components/MemoryPlay'
import '../styles/AnagramGame.css'
import '../styles/PairsGame.css'
import '../styles/MemoryGame.css'

// Mémoire FR ↔ EN (fiche L6 du catalogue v0.2 ; lot B de la phase 4, moteur C :
// src/utils/pairsGame.js ; docs/paires.md). Choix comme L3 : niveau + matière +
// sujet, sujets injouables grisés (P4) ; langue de l'interface au lancement :
// ses cartes sont mises en avant (P5). Partie : src/components/MemoryPlay.jsx.

const LANG_INFO = {
  fr: { tag: 'FR', fr: 'français', en: 'French' },
  en: { tag: 'EN', fr: 'anglais', en: 'English' }
}

export default function MemoryGame() {
  const { user, language, setCurrentPage } = useAppStore()
  const t = (fr, en) => (language === 'fr' ? fr : en)

  const [level, setLevel] = useState(MEMORY_LEVELS.includes(user?.level) ? user.level : MEMORY_LEVELS[0])
  const [matiere, setMatiere] = useState(MATIERE_TOUTES)
  const [subject, setSubject] = useState('')
  const [levelEntries, setLevelEntries] = useState(null)
  const [entriesLevel, setEntriesLevel] = useState(null)
  const [seedInput, setSeedInput] = useState('')
  const [seedError, setSeedError] = useState(false)
  const [gameState, setGameState] = useState('select') // select | playing | unavailable
  const [game, setGame] = useState(null)
  const [round, setRound] = useState(0) // une nouvelle partie remonte MemoryPlay
  const busyRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      let entries = []
      try {
        entries = await getVocabByLevel(level)
      } catch (e) {
        console.error('Mémoire : erreur de chargement', e)
      }
      if (cancelled) return
      setLevelEntries(entries)
      setEntriesLevel(level)
    }
    load()
    return () => { cancelled = true }
  }, [level])

  const subjectList = useMemo(
    () => (levelEntries && entriesLevel === level ? memorySubjects(levelEntries, level) : null),
    [levelEntries, entriesLevel, level]
  )

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

  const startGame = (seed) => {
    if (busyRef.current) return
    busyRef.current = true
    try {
      const entries = (levelEntries || []).filter(v => v.sujet === subject)
      // Cartes de la langue de l'interface au lancement mises en avant (P5 a)
      const g = createVocabularyMemoryGame(entries, level, seed, language)
      if (!g) {
        console.warn('Mémoire : partie impossible', { level, subject, seed })
        setGame(null)
        setGameState('unavailable')
        return
      }
      setGame(g)
      setRound(r => r + 1)
      setGameState('playing')
    } catch (e) {
      console.error('Mémoire : erreur de préparation', e)
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

  const handleBackToDashboard = () => {
    setGameState('select')
    setGame(null)
    setCurrentPage('studentDashboard')
  }

  const title = t('Mémoire FR ↔ EN', 'Memory FR ↔ EN')

  if (gameState === 'playing' && game) {
    const sideInfo = (side) => ({ tag: LANG_INFO[side].tag, name: LANG_INFO[side][language === 'fr' ? 'fr' : 'en'] })
    return (
      <MemoryPlay
        key={round}
        game={game}
        title={`${title} - ${libelleNiveau(game.level, language)}`}
        infoLine={`${t('Partie n°', 'Game no.')} ${game.seed} · ${libelleSujet(subject, language)}`}
        t={t}
        sideInfo={sideInfo}
        instruction={t('Retourne deux cartes : un mot et sa traduction. Souviens-toi de leur place !',
          'Turn over two cards: a word and its translation. Remember where they are!')}
        onPairFound={(pair) => {
          saveUserProgress(user?.id, pair.id, true, null, { gameType: GAME_TYPE_MEMORY, itemId: pair.id })
        }}
        onLastPair={(state) => {
          saveScore(user?.id, GAME_TYPE_MEMORY, pairsScore(state), game.level, {
            seed: game.seed,
            language: game.language,
            subject,
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

  const count = memoryPairCount(level)
  return (
    <div className="anagram-select pairs-select">
      <div className="anagram-select__container">
        <h1>{title}</h1>
        <p className="anagram-select__intro">
          {t('Les cartes sont face cachée. Retourne-les deux par deux pour retrouver chaque mot et sa traduction.',
            'The cards are face down. Turn them over two at a time to find each word and its translation.')}
        </p>

        <div className="anagram-select__section">
          <span className="anagram-select__label" id="memory-level-label">{t('Niveau', 'Level')}</span>
          <div className="anagram-select__options" role="group" aria-labelledby="memory-level-label">
            {MEMORY_LEVELS.map(l => (
              <button
                key={l}
                className={`anagram-select__btn ${level === l ? 'active' : ''}`}
                onClick={() => setLevel(l)}
                aria-pressed={level === l}
              >
                {libelleNiveau(l, language)}
                <span className="anagram-select__size">
                  {t(`${memoryPairCount(l)} paires`, `${memoryPairCount(l)} pairs`)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="anagram-select__section">
          <span className="anagram-select__label" id="memory-matiere-label">{t('Matière', 'Subject area')}</span>
          <div className="anagram-select__options pairs-select__matieres" role="group" aria-labelledby="memory-matiere-label">
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
          <span className="anagram-select__label" id="memory-subject-label">{t('Sujet', 'Topic')}</span>
          {emptyMatiere && (
            <p className="pairs-select__empty" role="status">
              {t(`Aucun sujet en ${libelleMatiere(matiere, language)} pour ce niveau. Choisis une autre matière ou un autre niveau.`,
                `No topics in ${libelleMatiere(matiere, language)} for this level. Choose another subject area or level.`)}
            </p>
          )}
          <div className="pairs-select__grid" role="group" aria-labelledby="memory-subject-label">
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
          <label className="anagram-select__label" htmlFor="memory-seed">
            {t('Numéro de partie (facultatif)', 'Game number (optional)')}
          </label>
          <input
            id="memory-seed"
            className="anagram-select__seed"
            type="text"
            inputMode="numeric"
            value={seedInput}
            onChange={e => setSeedInput(e.target.value)}
            placeholder={t('Laisser vide pour une nouvelle partie', 'Leave empty for a new game')}
            aria-describedby="memory-seed-hint"
          />
          <p id="memory-seed-hint" className="anagram-select__hint">
            {seedError
              ? t('Numéro invalide : un nombre entier de 0 à 4294967295.', 'Invalid number: a whole number from 0 to 4294967295.')
              : t('Avec la même version de l\'application, le même numéro, le même niveau et le même sujet donnent les mêmes cartes aux mêmes places.',
                'With the same version of the app, the same number, level and topic give the same cards in the same places.')}
          </p>
        </div>

        <button className="anagram-select__start" onClick={handleStart} disabled={!subjectPlayable}>
          {t('Commencer', 'Start')}
        </button>
        <button className="anagram-select__back" onClick={handleBackToDashboard}>
          {t('Retour', 'Back')}
        </button>
      </div>
    </div>
  )
}

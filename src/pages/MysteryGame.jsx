import React, { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import {
  getVocabByLevel,
  saveScore,
  saveUserProgress,
  getMysteryInProgress,
  saveMysteryInProgress,
  clearMysteryInProgress
} from '../db/index'
import { isValidSeed, newSeed, ANAGRAM_LEVELS, TRIES_BEFORE_SOLUTION } from '../utils/anagramGame'
import {
  MYSTERY_GAMES,
  MYSTERY_FORMAT_VERSION,
  createMysteryState,
  startSteps,
  recordStepWrong,
  recordStepFound,
  recordStepShown,
  advance,
  collectedElements,
  finalAsAnagram,
  checkFinalAnswer,
  recordFinalHint,
  nextHintOption,
  recordFinalWrong,
  recordFinalFound,
  recordFinalShown,
  computeScore,
  starsFor,
  hintsUsed,
  isValidState,
  LETTER_GAMES,
  codeKey,
  initialCodeEntries,
  applyRevealed,
  fillCodeEntry,
  isRevealedBox,
  correctCodeBoxes,
  finalHintLimit,
  PRESET_GAMES,
  LABEL_KINDS,
  checkLabelAnswer,
  solutionLabels,
  correctLabelPositions,
  wonSyllableIndex
} from '../utils/mysteryEngine'
import { validatePath } from '../utils/mysteryValidation'
import { generateMysteryPath, availableThemes } from '../utils/mysteryGenerators'
import { availablePresets } from '../utils/mysteryPresets'
import { libelleNiveau } from '../data/niveaux'
import AnagramBoard from '../components/AnagramBoard'
import '../styles/AnagramGame.css'
import '../styles/MysteryGame.css'

// Anagrammes mystères (famille B du module anagrammes ; lots 1, 2 et 3 de
// docs/anagrammes-mysteres.md, architecture validée par Isaac le 2026-11-03).
// Jeux disponibles : 1 « Mot mystère », 4 « Mystère des thèmes », 5
// « Message codé » (lot 2), 2 « Casse-tête des syllabes » et 3 « Phrase
// secrète » (lot 3, partie 1) ; le jeu 6 est annoncé « bientôt ». Écrans :
// choix du jeu, du niveau (et du thème), mission, anagrammes avec la barre des
// éléments gagnés, résolution finale, victoire. La langue des mots suit
// l'interface au lancement (§7). Jeux 1, 4, 5 : parcours générés
// automatiquement, marqués « démonstration » (statut generated, M2). Jeux 2
// et 3 : parcours préconçus (src/data/parcours-mysteres.js), choisis avec le
// numéro de partie, marqués « démonstration, brouillon » (statut draft).
// Interface : CHOIX PROVISOIRE, à valider par un enseignant. Pas de
// chronomètre (D5).

const GAME_TYPE = 'anagramMystery'

// Partie interrompue reprise seulement si elle est lisible et cohérente
// (version de format, règles communes du §6.1, état) ; sinon elle est ignorée.
// Une étape déjà terminée mais pas encore quittée passe à la suivante.
// Une donnée lisible mais mal formée qui fait échouer la validation est
// ignorée aussi (sinon l'écran plante à chaque ouverture).
function restore(record) {
  try {
    return restoreChecked(record)
  } catch {
    return null
  }
}

function restoreChecked(record) {
  if (!record || record.formatVersion !== MYSTERY_FORMAT_VERSION) return null
  const { path, state } = record
  if (validatePath(path).length > 0 || !isValidState(state, path)) return null
  if (state.phase === 'done') return null
  if (state.phase === 'steps' && state.steps[state.current].status !== 'pending') return { path, state: advance(state) }
  return { path, state }
}

export default function MysteryGame() {
  const { user, language, setCurrentPage } = useAppStore()
  const t = (fr, en) => (language === 'fr' ? fr : en)

  const [screen, setScreen] = useState('choose') // resume | choose | unavailable | playing
  const [saved, setSaved] = useState(null) // partie interrompue reprenable
  const [gameId, setGameId] = useState('mysteryWord')
  const [level, setLevel] = useState(ANAGRAM_LEVELS.includes(user?.level) ? user.level : ANAGRAM_LEVELS[0])
  const [themeId, setThemeId] = useState(null)
  const [themes, setThemes] = useState([])
  const [seedInput, setSeedInput] = useState('')
  const [seedError, setSeedError] = useState(false)
  const [path, setPath] = useState(null)
  const [mstate, setMstate] = useState(null)
  const [finalFeedback, setFinalFeedback] = useState('')
  const [reviewFinal, setReviewFinal] = useState(false) // résultat de la finale montré avant la victoire
  const [generating, setGenerating] = useState(false)
  // Jeu 5 : lettres écrites sous les nombres (null : cases à préparer depuis
  // l'état, lettres révélées comprises). Non enregistrées pour la reprise,
  // comme les lettres posées d'une anagramme.
  const [codeEntries, setCodeEntries] = useState(null)
  // Jeux 2 et 3 : étiquette posée dans chaque case de la résolution finale
  // (indice dans final.labels, ou null). Non enregistrées, comme les lettres.
  const [labelSlots, setLabelSlots] = useState(null)
  // Jeux 2 et 3 : nombre de parcours valides pour le niveau et la langue
  const [presetCounts, setPresetCounts] = useState({})
  const busyRef = useRef(false)
  const codeRef = useRef(null)

  // Partie interrompue de ce profil (M4)
  useEffect(() => {
    const r = restore(getMysteryInProgress(user?.id))
    if (r) {
      setSaved(r)
      setScreen('resume')
    }
  }, [user?.id])

  // Thèmes proposés : liste fixe, seulement ceux qui ont assez de mots pour
  // ce niveau et la langue de l'interface
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const vocabulary = await getVocabByLevel(level)
      const list = availableThemes(vocabulary, level, language)
      if (cancelled) return
      setThemes(list)
      setThemeId(current => (list.some(th => th.id === current) ? current : list[0]?.id ?? null))
    }
    load()
    return () => { cancelled = true }
  }, [level, language])

  // Jeux 2 et 3 : parcours préconçus valides pour ce niveau et la langue de
  // l'interface ; sans parcours valide, le jeu est indisponible
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const vocabulary = await getVocabByLevel(level)
      const counts = Object.fromEntries(PRESET_GAMES.map(g => [g, availablePresets(g, vocabulary, level, language).length]))
      if (!cancelled) setPresetCounts(counts)
    }
    load()
    return () => { cancelled = true }
  }, [level, language])

  const gameInfo = (id) => MYSTERY_GAMES.find(g => g.id === id)
  const gameName = (id) => gameInfo(id)?.[language === 'fr' ? 'fr' : 'en'] ?? id

  const persist = (p, s) => {
    saveMysteryInProgress(user?.id, { formatVersion: MYSTERY_FORMAT_VERSION, path: p, state: s })
  }

  const update = (s) => {
    setMstate(s)
    persist(path, s)
  }

  const startGame = async (seed, { game = gameId, lvl = level, theme = themeId } = {}) => {
    if (busyRef.current) return
    busyRef.current = true
    setGenerating(true)
    try {
      const vocabulary = await getVocabByLevel(lvl)
      // Les mots suivent la langue de l'interface au lancement de la partie
      const p = generateMysteryPath(game, vocabulary, lvl, seed, language, { themeId: theme })
      // Jamais de parcours invalide à l'écran (§6) : contrôle redoublé
      if (p === null || validatePath(p, { vocabulary }).length > 0) {
        console.warn('Anagrammes mystères : aucun parcours valide', { game, lvl, seed, language, theme })
        setPath(null)
        setScreen('unavailable')
        return
      }
      const s = createMysteryState(p)
      setPath(p)
      setMstate(s)
      setFinalFeedback('')
      setReviewFinal(false)
      setCodeEntries(null)
      setLabelSlots(null)
      persist(p, s)
      setScreen('playing')
    } catch (e) {
      console.error('Anagrammes mystères : erreur de préparation', e)
      setPath(null)
      setScreen('unavailable')
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

  const handleResume = () => {
    setPath(saved.path)
    setMstate(saved.state)
    setFinalFeedback('')
    setReviewFinal(false)
    setCodeEntries(null)
    setLabelSlots(null)
    setScreen('playing')
  }

  // Rejouer : même jeu, même niveau, même thème, nouveau numéro
  const handleReplay = () => {
    setSeedInput('')
    startGame(newSeed(), { game: path.game, lvl: path.level, theme: path.theme })
  }

  const backToChoose = () => {
    setScreen('choose')
    setPath(null)
    setMstate(null)
  }

  const backToModule = () => setCurrentPage('anagramGame')
  const backToDashboard = () => setCurrentPage('studentDashboard')

  // Fin du parcours : score (10 par anagramme, 10 pour le mystère), étoiles,
  // aides ; la partie interrompue est effacée
  const finish = async (s) => {
    if (busyRef.current) return
    busyRef.current = true
    try {
      await saveScore(user?.id, GAME_TYPE, computeScore(s), path.level, {
        game: path.game,
        language: path.language,
        seed: path.seed,
        stars: starsFor(s, path),
        hintsUsed: hintsUsed(s, path)
      })
      clearMysteryInProgress(user?.id)
    } catch (e) {
      console.error('Erreur:', e)
    } finally {
      busyRef.current = false
    }
  }

  // --- Écrans hors partie ---

  if (screen === 'resume' && saved) {
    return (
      <div className="anagram-select">
        <div className="anagram-select__container">
          <h1>{t('Anagrammes mystères', 'Mystery anagrams')}</h1>
          <p className="anagram-select__intro" role="status">
            {t('Tu as un mystère en cours : ', 'You have a mystery in progress: ')}
            <strong>{gameName(saved.path.game)}</strong> · {libelleNiveau(saved.path.level, language)}
          </p>
          <button className="anagram-select__start" onClick={handleResume}>
            {t('Reprendre', 'Resume')}
          </button>
          <button className="anagram-select__back" onClick={() => setScreen('choose')}>
            {t('Nouvelle partie', 'New game')}
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'unavailable') {
    return (
      <div className="anagram-select">
        <div className="anagram-select__container">
          <h1>{t('Anagrammes mystères', 'Mystery anagrams')}</h1>
          <p className="anagram-select__intro" role="status">
            {t('Ce mystère n\'est pas disponible pour le moment. Essaie un autre numéro ou un autre jeu.',
              'This mystery is not available right now. Try another number or another game.')}
          </p>
          <button className="anagram-select__back" onClick={backToChoose}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'choose' || !path || !mstate) {
    const isPresetChoice = PRESET_GAMES.includes(gameId)
    // Jeux 2 et 3 : indisponibles sans parcours valide pour le niveau et la langue
    const noPreset = isPresetChoice && presetCounts[gameId] === 0
    const canStart = !generating && (gameId !== 'theme' || themeId !== null) && !noPreset
    return (
      <div className="anagram-select">
        <div className="anagram-select__container">
          <h1>{t('Anagrammes mystères', 'Mystery anagrams')}</h1>
          <p className="anagram-select__intro">
            {t('Résous des anagrammes pour gagner des éléments secrets, puis perce le mystère !',
              'Solve anagrams to win secret clues, then solve the mystery!')}
          </p>

          <div className="anagram-select__section">
            <span className="anagram-select__label" id="mystery-game-label">{t('Jeu', 'Game')}</span>
            <div className="mystery-games" role="group" aria-labelledby="mystery-game-label">
              {MYSTERY_GAMES.map(g => (
                <button
                  key={g.id}
                  className={`mystery-games__btn ${gameId === g.id ? 'active' : ''}`}
                  onClick={() => g.available && setGameId(g.id)}
                  disabled={!g.available}
                  aria-pressed={g.available ? gameId === g.id : undefined}
                >
                  <span className="mystery-games__name">{g.number}. {g[language === 'fr' ? 'fr' : 'en']}</span>
                  {!g.available && <span className="mystery-games__soon">{t('Bientôt', 'Soon')}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="anagram-select__section">
            <span className="anagram-select__label" id="mystery-level-label">{t('Niveau', 'Level')}</span>
            <div className="anagram-select__options" role="group" aria-labelledby="mystery-level-label">
              {ANAGRAM_LEVELS.map(l => (
                <button
                  key={l}
                  className={`anagram-select__btn ${level === l ? 'active' : ''}`}
                  onClick={() => setLevel(l)}
                  aria-pressed={level === l}
                >
                  {libelleNiveau(l, language)}
                </button>
              ))}
            </div>
          </div>

          {gameId === 'theme' && (
            <div className="anagram-select__section">
              <span className="anagram-select__label" id="mystery-theme-label">{t('Thème', 'Theme')}</span>
              <p className="anagram-select__hint">
                {t('Le thème reste secret : c\'est toi qui devras le deviner. Choisis seulement une série.',
                  'The theme stays secret: you will have to guess it. Just choose a set.')}
              </p>
              {themes.length === 0
                ? <p className="anagram-select__hint" role="status">{t('Aucun thème disponible pour ce niveau.', 'No theme available for this level.')}</p>
                : (
                  <div className="anagram-select__options" role="group" aria-labelledby="mystery-theme-label">
                    {themes.map((th, i) => (
                      <button
                        key={th.id}
                        className={`anagram-select__btn ${themeId === th.id ? 'active' : ''}`}
                        onClick={() => setThemeId(th.id)}
                        aria-pressed={themeId === th.id}
                      >
                        {t(`Série ${i + 1}`, `Set ${i + 1}`)}
                      </button>
                    ))}
                  </div>
                )}
            </div>
          )}

          <div className="anagram-select__section">
            <label className="anagram-select__label" htmlFor="mystery-seed">
              {t('Numéro de partie (facultatif)', 'Game number (optional)')}
            </label>
            <input
              id="mystery-seed"
              className="anagram-select__seed"
              type="text"
              inputMode="numeric"
              value={seedInput}
              onChange={e => setSeedInput(e.target.value)}
              placeholder={t('Laisser vide pour une nouvelle partie', 'Leave empty for a new game')}
              aria-describedby="mystery-seed-hint"
            />
            <p id="mystery-seed-hint" className="anagram-select__hint">
              {seedError
                ? t('Numéro invalide : un nombre entier de 0 à 4294967295.', 'Invalid number: a whole number from 0 to 4294967295.')
                : t('Avec la même version de l\'application, le même numéro, le même jeu, le même niveau et la même langue donnent le même mystère.',
                  'With the same version of the app, the same number, game, level and language give the same mystery.')}
            </p>
          </div>

          {noPreset && (
            <p className="anagram-select__hint" role="status">
              {t('Aucun parcours disponible pour ce niveau dans cette langue.', 'No path available for this level in this language.')}
            </p>
          )}

          <p className="mystery-demo">
            {isPresetChoice
              ? t('Démonstration : parcours rédigés à l\'avance, encore en brouillon, en cours de validation par un enseignant.',
                'Demonstration: paths written in advance, still in draft, being checked by a teacher.')
              : t('Démonstration : mystères créés automatiquement à partir du vocabulaire, en cours de validation par un enseignant.',
                'Demonstration: mysteries made automatically from the vocabulary, being checked by a teacher.')}
          </p>

          <button className="anagram-select__start" onClick={handleStart} disabled={!canStart}>
            {t('Commencer', 'Start')}
          </button>
          <button className="anagram-select__back" onClick={backToModule}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>
    )
  }

  // --- Partie en cours ---

  const isWordGame = path.game === 'mysteryWord'
  const isCodeGame = path.game === 'codedMessage'
  // Jeux 1 et 5 : chaque étape donne une lettre (case marquée ★)
  const isLetterGame = LETTER_GAMES.includes(path.game)
  // Jeux 2 et 3 : parcours préconçus, résolution par étiquettes
  const isSyllableGame = path.game === 'syllables'
  const isSentenceGame = path.game === 'secretSentence'
  const pathLanguage = path.language === 'en' ? t('anglais', 'English') : t('français', 'French')
  // Statut montré à l'adulte : généré (démonstration) ou rédigé, en brouillon
  const statusText = path.status === 'draft'
    ? t('Démonstration (brouillon)', 'Demonstration (draft)')
    : t('Démonstration', 'Demonstration')
  const score = computeScore(mstate)
  const elements = collectedElements(path, mstate)
  const header = (
    <div className="anagram-game__header">
      <h1>{gameName(path.game)} - {libelleNiveau(path.level, language)}</h1>
      <div className="anagram-game__progress">
        {mstate.phase === 'steps'
          ? `${t('Anagramme', 'Anagram')} ${mstate.current + 1} / ${path.steps.length} · `
          : ''}
        {score} {t('points', 'points')}
      </div>
      <p className="anagram-game__seed">
        {t('Partie n°', 'Game no.')} {path.seed} · {pathLanguage} · {statusText}
      </p>
    </div>
  )

  // Barre des éléments gagnés (« ? » pour une étape non résolue). Jeu 5 : les
  // lignes de la clé (« nombre = lettre ») dans l'ordre des étapes, puis
  // rangées par nombre pour la résolution finale.
  const keyLine = (number, letter) => `${number} = ${letter}`
  const elementsBar = isCodeGame && mstate.phase !== 'steps' ? (
    <div className="mystery-elements" role="group" aria-label={t('Clé gagnée', 'Key won')}>
      {codeKey(path).map(line => (
        <span key={line.number} className="mystery-elements__item mystery-elements__item--key">
          {keyLine(line.number, line.letter)}
        </span>
      ))}
    </div>
  ) : (
    <div className="mystery-elements" role="group" aria-label={isCodeGame ? t('Clé gagnée', 'Key won') : t('Éléments gagnés', 'Clues won')}>
      {elements.map((e, i) => (
        <span
          key={i}
          className={`mystery-elements__item ${e === null ? 'mystery-elements__item--hidden' : ''} ${isLetterGame ? '' : 'mystery-elements__item--word'} ${isCodeGame ? 'mystery-elements__item--key' : ''}`}
        >
          {e === null ? '?' : isCodeGame ? keyLine(path.steps[i].code, e) : e}
        </span>
      ))}
    </div>
  )

  // Jeu 3 : mots donnés d'office (décision I4), montrés dès la mission et dans la finale
  const givenWords = isSentenceGame && (path.final.given ?? []).length > 0 && (
    <p className="mystery-given">
      {t('Mots déjà donnés : ', 'Words already given: ')}
      {(path.final.given ?? []).map((g, i) => <span key={i} className="mystery-given__word">{g}</span>)}
    </p>
  )

  // Jeu 5 : le message, suite de nombres
  const codedMessage = isCodeGame && (
    <p className="mystery-code-message" aria-label={t('Message codé', 'Coded message')}>
      {path.final.message.join(' · ')}
    </p>
  )

  const footer = (
    <div className="anagram-game__footer">
      <button className="anagram-game__btn anagram-game__btn--secondary anagram-game__back" onClick={backToChoose}>
        {t('Retour', 'Back')}
      </button>
    </div>
  )

  // Ce que chaque anagramme rapporte, selon la règle d'extraction
  const ruleText = () => {
    const { rule, position } = path.extraction
    if (rule === 'first') return t('sa première lettre', 'its first letter')
    if (rule === 'last') return t('sa dernière lettre', 'its last letter')
    if (rule === 'position') return t(`sa ${position}e lettre`, `its ${position === 2 ? '2nd' : position === 3 ? '3rd' : `${position}th`} letter`)
    return t('la lettre de la case marquée ★', 'the letter in the box marked ★')
  }

  if (mstate.phase === 'mission') {
    return (
      <div className="anagram-game">
        {header}
        <div className="anagram-game__card mystery-mission">
          <h2 className="anagram-game__clue-title">{t('Ta mission', 'Your mission')}</h2>
          {isWordGame && (
            <p className="anagram-game__clue">
              {t(`Résous ${path.steps.length} anagrammes. Chaque mot trouvé te donne ${ruleText()}. Avec ces lettres, écris le mot mystère !`,
                `Solve ${path.steps.length} anagrams. Each word you find gives you ${ruleText()}. With these letters, write the mystery word!`)}
            </p>
          )}
          {isCodeGame && (
            <>
              <p className="anagram-game__clue">
                {t(`Voici un message secret : chaque nombre cache une lettre. Résous ${path.steps.length} anagrammes. Chaque mot trouvé te donne ${ruleText()} et son nombre : une ligne de la clé. Avec la clé, décode le message !`,
                  `Here is a secret message: each number hides a letter. Solve ${path.steps.length} anagrams. Each word you find gives you ${ruleText()} and its number: one line of the key. With the key, decode the message!`)}
              </p>
              {codedMessage}
            </>
          )}
          {path.game === 'theme' && (
            <p className="anagram-game__clue">
              {t(`Résous ${path.steps.length} anagrammes. Tous les mots trouvés ont un point commun : devine le thème qui les relie !`,
                `Solve ${path.steps.length} anagrams. All the words you find have something in common: guess the theme that links them!`)}
            </p>
          )}
          {isSyllableGame && (
            <p className="anagram-game__clue">
              {t(`Résous ${path.steps.length} anagrammes. Chaque mot trouvé te donne une syllabe. Remets les syllabes dans l'ordre pour écrire le mot mystère !`,
                `Solve ${path.steps.length} anagrams. Each word you find gives you a syllable. Put the syllables in the right order to write the mystery word!`)}
            </p>
          )}
          {isSentenceGame && (
            <>
              <p className="anagram-game__clue">
                {t(`Résous ${path.steps.length} anagrammes. Chaque mot trouvé est un mot d'une phrase secrète. Remets ensuite tous les mots dans l'ordre pour retrouver la phrase !`,
                  `Solve ${path.steps.length} anagrams. Each word you find is a word of a secret sentence. Then put all the words in the right order to find the sentence!`)}
              </p>
              {givenWords}
            </>
          )}
          <button className="anagram-select__start" onClick={() => update(startSteps(mstate))}>
            {t('C\'est parti !', 'Let\'s go!')}
          </button>
          {footer}
        </div>
      </div>
    )
  }

  if (mstate.phase === 'steps') {
    const index = mstate.current
    const step = path.steps[index]
    const progress = (isCorrect, wordId) =>
      saveUserProgress(user?.id, wordId, isCorrect, null, { gameType: GAME_TYPE, itemId: step.id })
    // Mot de l'étape pour les progrès quand la solution est montrée : l'entrée
    // du vocabulaire ; pour une étape préconçue, wordId (null si le mot n'est
    // pas relié au vocabulaire, décision I10)
    const shownWordId = PRESET_GAMES.includes(path.game) ? step.wordId : step.id
    // Dernière étape : toutes les autres sont terminées (l'étape en cours peut
    // l'être déjà, quand son résultat est affiché)
    const last = mstate.steps.every((s, i) => i === index || s.status !== 'pending')
    return (
      <div className="anagram-game">
        {header}
        {elementsBar}
        <div className="anagram-game__card">
          <h2 className="anagram-game__clue-title">{t('Définition', 'Definition')}</h2>
          <p className="anagram-game__clue">{step.definition}</p>
          <AnagramBoard
            key={`${path.id}-${index}`}
            item={step}
            seed={path.seed}
            wordIndex={index}
            language={language}
            initialTries={mstate.steps[index].tries}
            markedIndex={isLetterGame ? step.secretIndex : null}
            onFound={(answer) => { update(recordStepFound(mstate, answer)); progress(true, answer.id) }}
            onWrong={() => update(recordStepWrong(mstate))}
            onShowSolution={() => { update(recordStepShown(mstate)); progress(false, shownWordId) }}
            nextLabel={last ? t('Vers le mystère', 'To the mystery') : t('Anagramme suivante', 'Next anagram')}
            onNext={() => update(advance(mstate))}
          >
            <p className="mystery-won" role="status">
              {isWordGame && t('Lettre gagnée : ', 'Letter won: ')}
              {isCodeGame && t('Ligne de la clé gagnée : ', 'Key line won: ')}
              {(path.game === 'theme' || isSentenceGame) && t('Mot gagné : ', 'Word won: ')}
              {isSyllableGame && t('Syllabe gagnée : ', 'Syllable won: ')}
              <strong>{isCodeGame ? keyLine(step.code, step.secret) : step.secret}</strong>
            </p>
            {/* Jeu 2 : la syllabe gagnée est signalée dans le mot trouvé (décision I11),
                sur sa syllabation, comme la case ★ du jeu 1 */}
            {isSyllableGame && (
              <p className="mystery-syllables" aria-label={t(`Syllabes du mot : ${step.syllables.join(', ')}`, `Syllables of the word: ${step.syllables.join(', ')}`)}>
                {step.syllables.map((s, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="mystery-syllables__cut" aria-hidden="true">-</span>}
                    <span className={wonSyllableIndex(step) === i ? 'mystery-syllables__won' : 'mystery-syllables__part'}>{s}</span>
                  </React.Fragment>
                ))}
              </p>
            )}
          </AnagramBoard>
          {footer}
        </div>
      </div>
    )
  }

  const finalDone = mstate.final.status !== 'pending'

  // Victoire (ou fin du parcours si la solution a été montrée)
  if (mstate.phase === 'done' && !reviewFinal) {
    const stars = starsFor(mstate, path)
    const found = mstate.final.status === 'found'
    const encouragement = stars === 3
      ? t('Bravo, sans aucune aide !', 'Well done, without any help!')
      : stars === 2
        ? t('Très bien ! La prochaine fois, essaie sans indice.', 'Very good! Next time, try without a hint.')
        : t('Tu es allé jusqu\'au bout : continue, tu progresses !', 'You went all the way: keep going, you are improving!')
    return (
      <div className="anagram-finished">
        <div className="anagram-finished__container">
          <h1>{found ? t('Mystère résolu !', 'Mystery solved!') : t('Parcours terminé', 'Path completed')}</h1>
          <p className="mystery-victory__solution">
            {isWordGame && t('Le mot mystère : ', 'The mystery word: ')}
            {isCodeGame && t('Le message décodé : ', 'The decoded message: ')}
            {path.game === 'theme' && t('Le thème : ', 'The theme: ')}
            {isSyllableGame && t('Le mot mystère : ', 'The mystery word: ')}
            {isSentenceGame && t('La phrase secrète : ', 'The secret sentence: ')}
            {/* Jeu 3 : la phrase correcte de la variante trouvée (majuscule,
                virgules, point ; décision I6) */}
            <strong>{isSentenceGame && found ? mstate.final.answer?.display ?? path.final.display : path.final.display}</strong>
          </p>
          <p className="mystery-stars" role="img" aria-label={t(`${stars} étoile${stars > 1 ? 's' : ''} sur 3`, `${stars} star${stars > 1 ? 's' : ''} out of 3`)}>
            {'★'.repeat(stars)}{'☆'.repeat(3 - stars)}
          </p>
          <p className="anagram-finished__score">{score}</p>
          <p className="mystery-encouragement">{encouragement}</p>
          <div className="mystery-skills">
            <h2>{t('Compétences travaillées', 'Skills practised')}</h2>
            <ul>
              <li>{t('Vocabulaire : comprendre une définition', 'Vocabulary: understanding a definition')}</li>
              <li>{t('Orthographe : remettre les lettres dans l\'ordre', 'Spelling: putting letters in order')}</li>
              {isWordGame && <li>{t('Logique : assembler des lettres pour former un mot', 'Logic: putting letters together to make a word')}</li>}
              {isCodeGame && <li>{t('Logique : décoder un message avec une clé', 'Logic: decoding a message with a key')}</li>}
              {path.game === 'theme' && <li>{t('Classer : trouver ce qui relie des mots', 'Sorting: finding what links words')}</li>}
              {isSyllableGame && <li>{t('Lecture : assembler des syllabes pour former un mot', 'Reading: putting syllables together to make a word')}</li>}
              {isSentenceGame && <li>{t('Phrase : remettre les mots dans l\'ordre', 'Sentences: putting words in the right order')}</li>}
            </ul>
          </div>
          <p className="anagram-game__seed">
            {t('Partie n°', 'Game no.')} {path.seed} · {pathLanguage} · {libelleNiveau(path.level, language)}
          </p>
          <button className="anagram-select__start" onClick={handleReplay} disabled={generating}>
            {t('Rejouer', 'Play again')}
          </button>
          <button className="anagram-select__back" onClick={backToChoose}>
            {t('Autre mystère', 'Another mystery')}
          </button>
          <button className="anagram-select__back" onClick={backToDashboard}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>
    )
  }

  // --- Résolution finale ---

  const showResult = (
    <button className="anagram-game__btn anagram-game__btn--validate mystery-final__result" onClick={() => setReviewFinal(false)}>
      {t('Voir mon résultat', 'See my result')}
    </button>
  )

  const endFinal = (s) => {
    setMstate(s)
    setReviewFinal(true)
    finish(s)
  }

  // Jeux 2 et 3 : étiquettes à toucher dans l'ordre (fiche L13). Toucher une
  // étiquette la pose dans la première case vide ; toucher une case remplie la
  // rend. Réponse fausse : nombre d'étiquettes bien placées ; le 2e essai faux
  // compte comme une aide (étoiles) ; « Voir la solution » après 3 essais.
  // Indices (décision I9) : jeu 2, définition puis première syllabe ; jeu 3,
  // premier mot puis verbe.
  if (LABEL_KINDS.includes(path.final.kind)) {
    const labels = path.final.labels
    const slots = labelSlots ?? labels.map(() => null)
    const used = new Set(slots.filter(i => i !== null))
    const full = slots.every(i => i !== null)
    const sequence = slots.map(i => (i === null ? '' : labels[i]))
    const hintsLeft = finalHintLimit(path) - mstate.final.hints
    const unit = isSyllableGame
      ? (n) => t(n > 1 ? 'syllabes bien placées' : 'syllabe bien placée', n !== 1 ? 'syllables are in the right place' : 'syllable is in the right place')
      : (n) => t(n > 1 ? 'mots bien placés' : 'mot bien placé', n !== 1 ? 'words are in the right place' : 'word is in the right place')
    const progressFinal = (isCorrect) =>
      saveUserProgress(user?.id, null, isCorrect, null, { gameType: GAME_TYPE, itemId: 'final' })
    const handleLabel = (i) => {
      if (finalDone || used.has(i)) return
      const free = slots.indexOf(null)
      if (free === -1) return
      setLabelSlots(slots.map((k, n) => (n === free ? i : k)))
      setFinalFeedback('')
    }
    const handleSlot = (n) => {
      if (finalDone || slots[n] === null) return
      setLabelSlots(slots.map((k, m) => (m === n ? null : k)))
    }
    const handleLabelValidate = () => {
      if (finalDone || !full) return
      const answer = checkLabelAnswer(path, sequence)
      if (answer) {
        setFinalFeedback(t('Bravo !', 'Well done!'))
        endFinal(recordFinalFound(mstate, answer))
        progressFinal(true)
        return
      }
      const s = recordFinalWrong(mstate, path)
      const n = correctLabelPositions(path, sequence)
      const parts = [t(`Il y a ${n} ${unit(n)}.`, `${n} ${unit(n)}.`)]
      parts.push(s.final.tries >= TRIES_BEFORE_SOLUTION
        ? t('Tu peux essayer encore ou voir la solution.', 'You can try again or see the answer.')
        : t('Essaie encore !', 'Try again!'))
      setFinalFeedback(parts.join(' '))
      update(s)
    }
    const handleLabelShow = () => {
      if (finalDone || mstate.final.tries < TRIES_BEFORE_SOLUTION) return
      // Les étiquettes sont posées dans l'ordre de la solution de référence
      const left = labels.map((_, i) => i)
      setLabelSlots(solutionLabels(path).map(l => left.splice(left.findIndex(i => labels[i] === l), 1)[0]))
      setFinalFeedback('')
      endFinal(recordFinalShown(mstate))
      progressFinal(false)
    }
    const shownAnswer = mstate.final.status === 'found' ? mstate.final.answer?.display : path.final.display
    return (
      <div className="anagram-game">
        {header}
        {elementsBar}
        <div className="anagram-game__card">
          <h2 className="anagram-game__clue-title">
            {isSyllableGame ? t('Le mot mystère', 'The mystery word') : t('La phrase secrète', 'The secret sentence')}
          </h2>
          <p className="anagram-game__clue">{path.final.prompt}</p>
          {givenWords}
          {path.final.hints.slice(0, mstate.final.hints).map((hint, i) => (
            <p key={i} className="mystery-final__hint" role="status">{t('Indice : ', 'Hint: ')}{hint}</p>
          ))}
          <div className="mystery-labels__slots" role="group" aria-label={isSyllableGame ? t('Mot à écrire', 'Word to write') : t('Phrase à écrire', 'Sentence to write')}>
            {slots.map((i, n) => (
              <button
                key={n}
                className={`mystery-labels__slot ${i === null ? 'mystery-labels__slot--empty' : ''} ${mstate.final.status === 'found' ? 'mystery-labels__slot--found' : ''}`}
                onClick={() => handleSlot(n)}
                disabled={finalDone || i === null}
                aria-label={i === null
                  ? t(`case ${n + 1} vide`, `box ${n + 1} empty`)
                  : t(`${labels[i]}, case ${n + 1}, toucher pour rendre l'étiquette`, `${labels[i]}, box ${n + 1}, tap to give the label back`)}
              >
                {i === null ? '' : labels[i]}
              </button>
            ))}
            {/* Jeu 3 : le point final est fixe (fiche L13) */}
            {isSentenceGame && <span className="mystery-labels__point" aria-hidden="true">.</span>}
          </div>
          {!finalDone && (
            <div className="mystery-labels__pool" role="group" aria-label={isSyllableGame ? t('Syllabes gagnées', 'Syllables won') : t('Mots de la phrase', 'Words of the sentence')}>
              {labels.map((label, i) => (
                <button
                  key={i}
                  className={`mystery-labels__label ${used.has(i) ? 'mystery-labels__label--used' : ''}`}
                  onClick={() => handleLabel(i)}
                  disabled={used.has(i)}
                  aria-label={label}
                >
                  {used.has(i) ? '' : label}
                </button>
              ))}
            </div>
          )}
          {!finalDone && (
            <div className="anagram-game__actions">
              <button className="anagram-game__btn anagram-game__btn--secondary" onClick={() => setLabelSlots(labels.map(() => null))} disabled={used.size === 0}>
                {t('Effacer', 'Clear')}
              </button>
              <button className="anagram-game__btn anagram-game__btn--validate" onClick={handleLabelValidate} disabled={!full}>
                {t('Valider', 'Check')}
              </button>
            </div>
          )}
          <p className="anagram-game__feedback" role="status" aria-live="polite">{finalFeedback}</p>
          {!finalDone && hintsLeft > 0 && (
            <button className="anagram-game__btn anagram-game__btn--secondary mystery-final__hint-btn" onClick={() => update(recordFinalHint(mstate, path))}>
              {t(`Indice (encore ${hintsLeft})`, `Hint (${hintsLeft} left)`)}
            </button>
          )}
          {!finalDone && mstate.final.tries >= TRIES_BEFORE_SOLUTION && (
            <button className="anagram-game__btn anagram-game__btn--solution" onClick={handleLabelShow}>
              {t('Voir la solution', 'Show the answer')}
            </button>
          )}
          {finalDone && (
            <div className="anagram-game__result">
              {/* Orthographe exacte ; jeu 3 : la phrase correcte, avec majuscule,
                  virgules et point (décision I6) */}
              <p className="anagram-game__answer">
                {mstate.final.status === 'found' ? t('Tu as trouvé : ', 'You found: ') : t('La solution était : ', 'The answer was: ')}
                <strong>{shownAnswer}</strong>
              </p>
              {mstate.final.status !== 'found' && (
                <p className="anagram-game__other">{t('Le mystère ne compte pas de points.', 'The mystery gives no points.')}</p>
              )}
              {showResult}
            </div>
          )}
          {footer}
        </div>
      </div>
    )
  }

  if (isWordGame) {
    const item = finalAsAnagram(path)
    const hintShown = mstate.final.hints > 0
    return (
      <div className="anagram-game">
        {header}
        {elementsBar}
        <div className="anagram-game__card">
          <h2 className="anagram-game__clue-title">{t('Le mot mystère', 'The mystery word')}</h2>
          <p className="anagram-game__clue">
            {t('Remets les lettres gagnées dans l\'ordre pour écrire le mot mystère.',
              'Put the letters you won in the right order to write the mystery word.')}
          </p>
          {hintShown && (
            <p className="mystery-final__hint" role="status">
              {t('Indice : ', 'Hint: ')}{path.final.hints[0]}
            </p>
          )}
          {!finalDone && !hintShown && (
            <button className="anagram-game__btn anagram-game__btn--secondary mystery-final__hint-btn" onClick={() => update(recordFinalHint(mstate, path))}>
              {t('Indice', 'Hint')}
            </button>
          )}
          <AnagramBoard
            key={`${path.id}-final`}
            item={item}
            seed={path.seed}
            wordIndex={path.steps.length}
            language={language}
            initialTries={mstate.final.tries}
            onFound={(answer) => {
              endFinal(recordFinalFound(mstate, answer))
              saveUserProgress(user?.id, null, true, null, { gameType: GAME_TYPE, itemId: 'final' })
            }}
            onWrong={() => update(recordFinalWrong(mstate, path))}
            onShowSolution={() => {
              endFinal(recordFinalShown(mstate))
              saveUserProgress(user?.id, null, false, null, { gameType: GAME_TYPE, itemId: 'final' })
            }}
            nextLabel={t('Voir mon résultat', 'See my result')}
            onNext={() => setReviewFinal(false)}
          />
          {footer}
        </div>
      </div>
    )
  }

  // Jeu 5 : une case sous chaque nombre (C5). Une lettre écrite dans une case
  // est reportée sous tous les nombres identiques ; un indice révèle une lettre
  // du mot (toutes ses occurrences) ; la clé gagnée reste affichée.
  if (isCodeGame) {
    const entries = codeEntries ?? initialCodeEntries(path, mstate)
    const full = entries.every(e => e !== '')
    const hintsLeft = finalHintLimit(path) - mstate.final.hints
    const progressFinal = (isCorrect) =>
      saveUserProgress(user?.id, null, isCorrect, null, { gameType: GAME_TYPE, itemId: 'final' })
    // Après une lettre, la case vide suivante prend la main
    const focusNextEmpty = (next, from) => {
      const inputs = codeRef.current?.querySelectorAll('input') ?? []
      const after = next.findIndex((e, i) => i > from && e === '')
      const target = after !== -1 ? after : next.indexOf('')
      if (target !== -1) inputs[target]?.focus()
    }
    const handleType = (index, text) => {
      if (finalDone) return
      const next = fillCodeEntry(path, mstate, entries, index, text)
      setCodeEntries(next)
      setFinalFeedback('')
      if (next[index] !== '') focusNextEmpty(next, index)
    }
    const handleCodeValidate = () => {
      if (finalDone || !full) return
      const answer = checkFinalAnswer(path, entries.join(''))
      if (answer) {
        setFinalFeedback(t('Bravo !', 'Well done!'))
        endFinal(recordFinalFound(mstate, answer))
        progressFinal(true)
        return
      }
      const s = recordFinalWrong(mstate, path)
      const n = correctCodeBoxes(path, entries)
      const parts = [t(
        `Il y a ${n} ${n > 1 ? 'cases justes' : 'case juste'}. Vérifie avec la clé.`,
        `${n} ${n > 1 ? 'boxes are' : 'box is'} right. Check with the key.`
      )]
      if (s.final.tries >= TRIES_BEFORE_SOLUTION) parts.push(t('Tu peux essayer encore ou voir la solution.', 'You can try again or see the answer.'))
      setFinalFeedback(parts.join(' '))
      update(s)
    }
    const handleCodeHint = () => {
      if (finalDone || hintsLeft <= 0) return
      const s = recordFinalHint(mstate, path, entries)
      if (s === mstate) return
      const letter = s.final.revealed[s.final.revealed.length - 1]
      setCodeEntries(applyRevealed(path, s, entries))
      setFinalFeedback(t(`Indice : la lettre ${letter} est écrite sous tous ses nombres.`, `Hint: the letter ${letter} is written under all its numbers.`))
      update(s)
    }
    const handleCodeShow = () => {
      if (finalDone || mstate.final.tries < TRIES_BEFORE_SOLUTION) return
      setCodeEntries([...path.final.solution])
      setFinalFeedback('')
      endFinal(recordFinalShown(mstate))
      progressFinal(false)
    }
    return (
      <div className="anagram-game">
        {header}
        {elementsBar}
        <div className="anagram-game__card">
          <h2 className="anagram-game__clue-title">{t('Le message codé', 'The coded message')}</h2>
          <p className="anagram-game__clue">{path.final.prompt}</p>
          <div className="mystery-code" role="group" aria-label={t('Message à décoder', 'Message to decode')} ref={codeRef}>
            {path.final.message.map((number, i) => {
              const revealed = isRevealedBox(path, mstate, i)
              return (
                <label key={i} className={`mystery-code__box ${revealed ? 'mystery-code__box--revealed' : ''}`}>
                  <span className="mystery-code__number">{number}</span>
                  <input
                    className="mystery-code__input"
                    type="text"
                    value={entries[i]}
                    onChange={e => handleType(i, e.target.value)}
                    readOnly={revealed || finalDone}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    aria-label={t(`Lettre du nombre ${number}, case ${i + 1}${revealed ? ', donnée par un indice' : ''}`,
                      `Letter for number ${number}, box ${i + 1}${revealed ? ', given by a hint' : ''}`)}
                  />
                </label>
              )
            })}
          </div>
          {!finalDone && (
            <div className="anagram-game__actions">
              <button className="anagram-game__btn anagram-game__btn--secondary" onClick={() => setCodeEntries(initialCodeEntries(path, mstate))}>
                {t('Effacer', 'Clear')}
              </button>
              <button className="anagram-game__btn anagram-game__btn--validate" onClick={handleCodeValidate} disabled={!full}>
                {t('Valider', 'Check')}
              </button>
            </div>
          )}
          <p className="anagram-game__feedback" role="status" aria-live="polite">{finalFeedback}</p>
          {!finalDone && hintsLeft > 0 && (
            <button className="anagram-game__btn anagram-game__btn--secondary mystery-final__hint-btn" onClick={handleCodeHint}>
              {t(`Indice (encore ${hintsLeft})`, `Hint (${hintsLeft} left)`)}
            </button>
          )}
          {!finalDone && mstate.final.tries >= TRIES_BEFORE_SOLUTION && (
            <button className="anagram-game__btn anagram-game__btn--solution" onClick={handleCodeShow}>
              {t('Voir la solution', 'Show the answer')}
            </button>
          )}
          {finalDone && (
            <div className="anagram-game__result">
              {/* Orthographe exacte, avec accents (C4) */}
              <p className="anagram-game__answer">
                {mstate.final.status === 'found' ? t('Tu as trouvé : ', 'You found: ') : t('Le message était : ', 'The message was: ')}
                <strong>{path.final.display}</strong>
              </p>
              {showResult}
            </div>
          )}
          {footer}
        </div>
      </div>
    )
  }

  // Jeu 4 : choix parmi 4 propositions (M6), indices progressifs
  const eliminated = mstate.final.eliminated
  const handleChoice = (option) => {
    if (finalDone || eliminated.includes(option)) return
    if (checkFinalAnswer(path, option)) {
      setFinalFeedback(t('Bravo !', 'Well done!'))
      endFinal(recordFinalFound(mstate, path.final.acceptedAnswers[0]))
      saveUserProgress(user?.id, null, true, null, { gameType: GAME_TYPE, itemId: 'final' })
      return
    }
    const s = recordFinalWrong(mstate, path, option)
    if (s.phase === 'done') {
      setFinalFeedback('')
      endFinal(s)
      saveUserProgress(user?.id, null, false, null, { gameType: GAME_TYPE, itemId: 'final' })
      return
    }
    setFinalFeedback(t(`Ce n'est pas « ${option} ». Essaie encore !`, `It is not "${option}". Try again!`))
    update(s)
  }
  const handleThemeHint = () => {
    if (finalDone || mstate.final.hints >= path.final.hints.length) return
    const removed = nextHintOption(mstate, path)
    const s = recordFinalHint(mstate, path)
    setFinalFeedback(t(`Indice : ce n'est pas « ${removed} ».`, `Hint: it is not "${removed}".`))
    if (s.phase === 'done') {
      endFinal(s)
      saveUserProgress(user?.id, null, false, null, { gameType: GAME_TYPE, itemId: 'final' })
    } else update(s)
  }

  return (
    <div className="anagram-game">
      {header}
      {elementsBar}
      <div className="anagram-game__card">
        <h2 className="anagram-game__clue-title">{t('Le thème mystère', 'The mystery theme')}</h2>
        <p className="anagram-game__clue">
          {t('Quel thème relie tous les mots trouvés ?', 'Which theme links all the words you found?')}
        </p>
        <div className="mystery-options" role="group" aria-label={t('Propositions', 'Choices')}>
          {path.final.options.map(option => {
            const out = eliminated.includes(option)
            const right = finalDone && option === path.final.solution
            return (
              <button
                key={option}
                className={`mystery-options__btn ${out ? 'mystery-options__btn--out' : ''} ${right ? 'mystery-options__btn--right' : ''}`}
                onClick={() => handleChoice(option)}
                disabled={finalDone || out}
              >
                {option}
              </button>
            )
          })}
        </div>
        <p className="anagram-game__feedback" role="status" aria-live="polite">{finalFeedback}</p>
        {!finalDone && mstate.final.hints < path.final.hints.length && (
          <button className="anagram-game__btn anagram-game__btn--secondary mystery-final__hint-btn" onClick={handleThemeHint}>
            {t('Indice', 'Hint')}
          </button>
        )}
        {finalDone && (
          <div className="anagram-game__result">
            <p className="anagram-game__answer">
              {mstate.final.status === 'found' ? t('Tu as trouvé : ', 'You found: ') : t('Le thème était : ', 'The theme was: ')}
              <strong>{path.final.display}</strong>
            </p>
            {showResult}
          </div>
        )}
        {footer}
      </div>
    </div>
  )
}

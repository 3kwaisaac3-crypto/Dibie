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
import { isValidSeed, newSeed, ANAGRAM_LEVELS } from '../utils/anagramGame'
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
  isValidState
} from '../utils/mysteryEngine'
import { validatePath } from '../utils/mysteryValidation'
import { generateMysteryPath, availableThemes } from '../utils/mysteryGenerators'
import { libelleNiveau } from '../data/niveaux'
import AnagramBoard from '../components/AnagramBoard'
import '../styles/AnagramGame.css'
import '../styles/MysteryGame.css'

// Anagrammes mystères (famille B du module anagrammes ; lot 1 de
// docs/anagrammes-mysteres.md, architecture validée par Isaac le 2026-11-03).
// Jeux disponibles : 1 « Mot mystère » et 4 « Mystère des thèmes » ; les jeux
// 2, 3, 5 et 6 sont annoncés « bientôt ». Écrans : choix du jeu, du niveau (et
// du thème), mission, anagrammes avec la barre des éléments gagnés,
// résolution finale, victoire. La langue des mots suit l'interface au
// lancement (§7). Parcours générés automatiquement, marqués « démonstration »
// (statut generated, M2). Interface : CHOIX PROVISOIRE, à valider par un
// enseignant. Pas de chronomètre (D5).

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
  const busyRef = useRef(false)

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
    const canStart = !generating && (gameId !== 'theme' || themeId !== null)
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

          <p className="mystery-demo">
            {t('Démonstration : mystères créés automatiquement à partir du vocabulaire, en cours de validation par un enseignant.',
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
  const pathLanguage = path.language === 'en' ? t('anglais', 'English') : t('français', 'French')
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
        {t('Partie n°', 'Game no.')} {path.seed} · {pathLanguage} · {t('Démonstration', 'Demonstration')}
      </p>
    </div>
  )

  // Barre des éléments gagnés (« ? » pour une étape non résolue)
  const elementsBar = (
    <div className="mystery-elements" role="group" aria-label={t('Éléments gagnés', 'Clues won')}>
      {elements.map((e, i) => (
        <span
          key={i}
          className={`mystery-elements__item ${e === null ? 'mystery-elements__item--hidden' : ''} ${isWordGame ? '' : 'mystery-elements__item--word'}`}
        >
          {e ?? '?'}
        </span>
      ))}
    </div>
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
          {isWordGame ? (
            <p className="anagram-game__clue">
              {t(`Résous ${path.steps.length} anagrammes. Chaque mot trouvé te donne ${ruleText()}. Avec ces lettres, écris le mot mystère !`,
                `Solve ${path.steps.length} anagrams. Each word you find gives you ${ruleText()}. With these letters, write the mystery word!`)}
            </p>
          ) : (
            <p className="anagram-game__clue">
              {t(`Résous ${path.steps.length} anagrammes. Tous les mots trouvés ont un point commun : devine le thème qui les relie !`,
                `Solve ${path.steps.length} anagrams. All the words you find have something in common: guess the theme that links them!`)}
            </p>
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
            markedIndex={isWordGame ? step.secretIndex : null}
            onFound={(answer) => { update(recordStepFound(mstate, answer)); progress(true, answer.id) }}
            onWrong={() => update(recordStepWrong(mstate))}
            onShowSolution={() => { update(recordStepShown(mstate)); progress(false, step.id) }}
            nextLabel={last ? t('Vers le mystère', 'To the mystery') : t('Anagramme suivante', 'Next anagram')}
            onNext={() => update(advance(mstate))}
          >
            <p className="mystery-won" role="status">
              {isWordGame
                ? t('Lettre gagnée : ', 'Letter won: ')
                : t('Mot gagné : ', 'Word won: ')}
              <strong>{step.secret}</strong>
            </p>
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
            {isWordGame ? t('Le mot mystère : ', 'The mystery word: ') : t('Le thème : ', 'The theme: ')}
            <strong>{path.final.display}</strong>
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
              {isWordGame
                ? <li>{t('Logique : assembler des lettres pour former un mot', 'Logic: putting letters together to make a word')}</li>
                : <li>{t('Classer : trouver ce qui relie des mots', 'Sorting: finding what links words')}</li>}
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

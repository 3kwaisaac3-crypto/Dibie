import React, { useMemo, useRef, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { saveScore, saveUserProgress } from '../db/index'
import EclipseGrid from '../components/EclipseGrid'
import collection from '../data/grilles-maitre.json'
import {
  GAME_TYPE_MASTER_GRID,
  POINTS_PER_WORD,
  masterGridsForLevel,
  matieresOf,
  libelleMatiereGrille,
  libelleLangueGrille,
  toEclipseGame,
  masterGridScore,
  canFinish
} from '../utils/grillesMaitrePlay'
import { libelleNiveau } from '../data/niveaux'
import '../styles/CrosswordGame.css'
import '../styles/MasterGridGame.css'

// Grilles du maître — Préparation aux examens (fiche L16, phase 6, lot B).
// Grilles fixes d'Isaac (src/data/grilles-maitre.json, lot A), affichées par la
// grille des mots croisés (EclipseGrid) rendue de taille variable (P7 a).
// Décisions d'Isaac du 2026-11-09 (cadrage de la phase 6) :
// - carte du tableau de bord élève, élèves seuls (P9 a, D11) ;
// - titre sans nommer d'examen (P11 a) ;
// - comme les mots croisés : mot signalé dès qu'il est juste, 10 points par
//   mot (P10 a) ;
// - `gameType` propre (masterGrid), progression par mot, identifiant = grille
//   + numéro + sens (ex. G017-2V), aucun nouveau badge (P12 a).
// Choix provisoires du developer : docs/grilles-du-maitre.md §8.

const MATIERE_TOUTES = '__toutes__'

export default function MasterGridGame() {
  const { user, language, setCurrentPage } = useAppStore()
  const t = (fr, en) => (language === 'fr' ? fr : en)
  const level = user?.level || ''

  const grids = useMemo(() => masterGridsForLevel(collection, level, language), [level, language])
  const matieres = matieresOf(grids)
  const [matiere, setMatiere] = useState(MATIERE_TOUTES)
  const shown = matiere === MATIERE_TOUTES ? grids : grids.filter(g => g.matiere === matiere)

  const [gameState, setGameState] = useState('select') // select | playing | finished
  const [masterGrid, setMasterGrid] = useState(null)
  const [game, setGame] = useState(null)
  const [answered, setAnswered] = useState([])
  // Mots déjà comptés, lus et mis à jour immédiatement : une lettre de
  // croisement peut compléter deux mots dans le même événement
  const answeredRef = useRef(new Set())
  // Partie dont le score est enregistré : un seul saveScore par partie
  const savedForRef = useRef(null)
  const [saved, setSaved] = useState(false)

  const title = t('Grilles du maître — Préparation aux examens', 'Teacher\'s grids — Exam preparation')
  const wordCount = game?.placements.length || 0
  const score = masterGridScore(answered.length)

  const startGrid = (g) => {
    const eg = toEclipseGame(g)
    if (!eg) return
    answeredRef.current = new Set()
    savedForRef.current = null
    setSaved(false)
    setAnswered([])
    setMasterGrid(g)
    setGame(eg)
    setGameState('playing')
  }

  // Score enregistré une seule fois par partie : au dernier mot trouvé, ou à
  // « Terminer » (leçon du lot A de la phase 4 : « Retour » après la fin ne
  // fait pas perdre le score)
  const saveFinalScore = (foundIds) => {
    if (!game || savedForRef.current === game) return
    savedForRef.current = game
    setSaved(true)
    saveScore(user?.id, GAME_TYPE_MASTER_GRID, masterGridScore(foundIds.length), masterGrid.niveau, {
      gridId: masterGrid.id,
      gridTitle: masterGrid.titre,
      matiere: masterGrid.matiere,
      langue: masterGrid.langue,
      statut: masterGrid.statut,
      wordCount,
      wordsFound: foundIds.length
    }).catch(e => console.error('Erreur:', e))
  }

  const handleAnswerCorrect = (wordId) => {
    if (savedForRef.current === game) return
    if (answeredRef.current.has(wordId)) return
    answeredRef.current.add(wordId)
    const found = [...answeredRef.current]
    setAnswered(found)
    saveUserProgress(user?.id, null, true, null, { gameType: GAME_TYPE_MASTER_GRID, itemId: wordId })
      .catch(e => console.error('Erreur:', e))
    if (found.length === wordCount) saveFinalScore(found)
  }

  // Lettre effacée ou remplacée dans un mot trouvé : le mot n'est plus compté
  // (comme les mots croisés), sauf si le score est déjà enregistré.
  // Limite (comme les mots croisés) : la ligne de progression déjà écrite reste.
  const handleAnswerRemoved = (wordId) => {
    if (savedForRef.current === game) return
    if (!answeredRef.current.has(wordId)) return
    answeredRef.current.delete(wordId)
    setAnswered([...answeredRef.current])
  }

  const handleFinish = () => {
    saveFinalScore([...answeredRef.current])
    setGameState('finished')
  }

  const backToList = () => {
    setGameState('select')
    setGame(null)
    setMasterGrid(null)
  }

  const backToDashboard = () => {
    backToList()
    setCurrentPage('studentDashboard')
  }

  const gridLine = (g) => [
    libelleMatiereGrille(g.matiere, language),
    t(`${g.mots.length} mots`, `${g.mots.length} words`),
    libelleLangueGrille(g.langue, language)
  ].join(' · ')

  if (gameState === 'select') {
    return (
      <div className="crossword-select">
        <div className="crossword-select__container master-grid-select">
          <h1>{title}</h1>
          <p className="master-grid-select__level">
            {t('Niveau', 'Level')} : <strong>{libelleNiveau(level, language)}</strong>
          </p>

          {grids.length === 0 ? (
            <p className="crossword-select__empty" role="status">
              {t('Pas encore de grille pour ton niveau.', 'No grids for your level yet.')}
            </p>
          ) : (
            <>
              <div className="crossword-select__section">
                <label id="master-grid-matiere-label">{t('Matière', 'Subject area')}</label>
                <div className="crossword-select__options master-grid-select__matieres" role="group" aria-labelledby="master-grid-matiere-label">
                  {[MATIERE_TOUTES, ...matieres].map(m => (
                    <button
                      key={m}
                      className={`crossword-select__btn ${matiere === m ? 'active' : ''}`}
                      onClick={() => setMatiere(m)}
                      aria-pressed={matiere === m}
                    >
                      {m === MATIERE_TOUTES ? t('Toutes', 'All') : libelleMatiereGrille(m, language)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="crossword-select__section">
                <label id="master-grid-list-label">{t('Grilles', 'Grids')}</label>
                <ul className="master-grid-list" aria-labelledby="master-grid-list-label">
                  {shown.map(g => (
                    <li key={g.id}>
                      <button className="master-grid-list__item" data-grid={g.id} onClick={() => startGrid(g)}>
                        <span className="master-grid-list__title" lang={g.langue}>{g.titre}</span>
                        <span className="master-grid-list__meta">{gridLine(g)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {grids.some(g => g.langue !== (language === 'fr' ? 'fr' : 'en')) && (
                  <p className="crossword-select__hint">
                    {t('Chaque grille reste dans la langue où son auteur l\'a écrite.',
                      'Each grid stays in the language its author wrote it in.')}
                  </p>
                )}
              </div>
            </>
          )}

          <button className="crossword-select__back" onClick={backToDashboard}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>
    )
  }

  if (gameState === 'finished') {
    return (
      <div className="crossword-finished">
        <div className="crossword-finished__container">
          <h1>🎉 {t('Bravo !', 'Great!')}</h1>
          <div className="crossword-finished__score">
            <p className="crossword-finished__score-value">{score}</p>
          </div>
          <p className="crossword-game__seed" lang={masterGrid?.langue}>{masterGrid?.titre}</p>
          <p className="master-grid-finished__count">
            {t(`${answered.length} mots trouvés sur ${wordCount}`, `${answered.length} of ${wordCount} words found`)}
          </p>
          <button className="crossword-finished__button" onClick={backToList}>
            {t('Autre grille', 'Another grid')}
          </button>
          <button className="crossword-finished__button" onClick={backToDashboard}>
            {t('Retour', 'Back')}
          </button>
        </div>
      </div>
    )
  }

  // gameState === 'playing'
  return (
    <div className="crossword-game master-grid-game">
      <div className="crossword-game__header">
        <h1>{title}</h1>
        <p className="crossword-game__seed">
          {[libelleNiveau(masterGrid.niveau, language), libelleMatiereGrille(masterGrid.matiere, language)].join(' · ')}
        </p>
        <div className="crossword-game__score">{t('Points', 'Points')} : <strong data-testid="mg-score">{score}</strong></div>
      </div>
      <div className="crossword-game__container">
        <EclipseGrid
          game={game}
          language={language}
          onAnswerCorrect={handleAnswerCorrect}
          onAnswerRemoved={handleAnswerRemoved}
          onBack={backToList}
          title={<span lang={masterGrid.langue}>{masterGrid.titre}</span>}
        />
        <div className="crossword-game__progress">
          <p data-testid="mg-progress">{answered.length} / {wordCount} {t('mots', 'words')}</p>
          {saved && (
            <p className="master-grid-game__done" role="status">
              {t(`Grille terminée ! ${score} points enregistrés.`, `Grid complete! ${score} points saved.`)}
            </p>
          )}
          {canFinish(answered.length, wordCount) && (
            <button className="crossword-game__finish" onClick={handleFinish}>
              {t('Terminer', 'Finish')}
            </button>
          )}
          <p className="crossword-select__hint">
            {t(`${POINTS_PER_WORD} points par mot trouvé.`, `${POINTS_PER_WORD} points per word found.`)}
          </p>
        </div>
      </div>
    </div>
  )
}

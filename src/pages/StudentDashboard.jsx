import React, { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { getUserStats } from '../db/index'
import { libelleMatiere } from '../data/sujets-matieres'
import { libelleNiveau } from '../data/niveaux'
import '../styles/StudentDashboard.css'

export default function StudentDashboard() {
  const { user, language, setCurrentPage, openCrossword, logout } = useAppStore()
  const [stats, setStats] = useState({
    score: 0,
    games: 0,
    streak: 0,
    badges: []
  })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const s = await getUserStats(user?.id)
      if (!cancelled) setStats(s)
    }
    load()
    return () => { cancelled = true }
  }, [user?.id])

  const games = [
    { id: 'crossword', name: language === 'fr' ? 'Mots Croisés' : 'Crossword', icon: '⬜', available: true },
    { id: 'wordsearch', name: language === 'fr' ? 'Mots Mêlés' : 'Word Search', icon: '🔍', available: true, page: 'wordSearchGame' },
    { id: 'anagram', name: language === 'fr' ? 'Anagrammes' : 'Anagrams', icon: '🔤', available: true, page: 'anagramGame' },
    { id: 'pyramid', name: language === 'fr' ? 'Pyramides' : 'Pyramids', icon: '🔺', available: true, page: 'pyramidGame' },
    { id: 'pairs', name: language === 'fr' ? 'Associations FR ↔ EN' : 'Matching FR ↔ EN', icon: '🔗', available: true, page: 'pairsGame' },
    // Lot C de la phase 4 : carte visible à tous les niveaux ; en SIL-CP, la page
    // s'ouvre en CE1-CE2 avec un message (pas de L4 en SIL-CP, P3 b), CHOIX PROVISOIRE
    { id: 'pairsDefinition', name: language === 'fr' ? 'Mot ↔ définition' : 'Word ↔ definition', icon: '📖', available: true, page: 'definitionGame' },
    // Lot B de la phase 4 : deux cartes séparées (langue / maths), CHOIX PROVISOIRE (docs/paires.md)
    { id: 'memory', name: language === 'fr' ? 'Mémoire FR ↔ EN' : 'Memory FR ↔ EN', icon: '🃏', available: true, page: 'memoryGame' },
    { id: 'tablesMemory', name: language === 'fr' ? 'Mémoire des tables' : 'Times tables memory', icon: '✖️', available: true, page: 'tablesMemoryGame' },
  ]

  return (
    <div className="student-dashboard">
      {/* Header */}
      <div className="student-dashboard__header">
        <div className="student-dashboard__user">
          <h1>{language === 'fr' ? 'Bonjour' : 'Hello'}, {user?.name || 'Élève'} 👋</h1>
          <p className="student-dashboard__level">
            {[libelleNiveau(user?.level, language), user?.class].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="student-dashboard__actions">
          <button className="student-dashboard__back" onClick={logout} title={language === 'fr' ? 'Changer de profil' : 'Switch profile'}>
            {language === 'fr' ? 'Profil' : 'Profile'}
          </button>
          <button className="student-dashboard__logout" onClick={logout} title={language === 'fr' ? 'Déconnexion' : 'Log out'} aria-label={language === 'fr' ? 'Déconnexion' : 'Log out'}>
            ❌
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="student-dashboard__stats">
        <div className="stat-card">
          <div className="stat-card__value">{stats.score}</div>
          <div className="stat-card__label">
            {language === 'fr' ? 'Points' : 'Points'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">{stats.games}</div>
          <div className="stat-card__label">
            {language === 'fr' ? 'Jeux' : 'Games'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card__value">🔥{stats.streak}</div>
          <div className="stat-card__label">
            {language === 'fr' ? 'Série' : 'Streak'}
          </div>
        </div>
      </div>

      {/* Badges */}
      {stats.badges.length > 0 && (
        <div className="student-dashboard__badges">
          <h2>{language === 'fr' ? 'Badges' : 'Badges'}</h2>
          <div className="badges-grid">
            {stats.badges.map((badge, i) => (
              <div key={i} className="badge">{badge}</div>
            ))}
          </div>
        </div>
      )}

      {/* Accès par matière : ouvre les mots croisés avec le filtre déjà réglé */}
      <div className="student-dashboard__games student-dashboard__matieres">
        <h2>{language === 'fr' ? 'Mots croisés par matière' : 'Crossword by subject area'}</h2>
        <div className="matieres-grid">
          {['maths', 'sciences', 'tic'].map(matiere => (
            <button key={matiere} className="matiere-btn" onClick={() => openCrossword(matiere)}>
              {libelleMatiere(matiere, language)}
            </button>
          ))}
        </div>
      </div>

      {/* Games */}
      <div className="student-dashboard__games">
        <h2>{language === 'fr' ? 'Jeux disponibles' : 'Available Games'}</h2>
        <div className="games-grid">
          {games.map(game => (
            <button
              key={game.id}
              className={`game-card ${!game.available ? 'game-card--disabled' : ''}`}
              onClick={() => {
                if (!game.available) return
                if (game.page) setCurrentPage(game.page)
                else openCrossword()
              }}
              disabled={!game.available}
              title={!game.available ? (language === 'fr' ? 'Bientôt disponible' : 'Coming soon') : ''}
            >
              <div className="game-card__icon">{game.icon}</div>
              <div className="game-card__name">{game.name}</div>
              {!game.available && (
                <div className="game-card__soon">
                  {language === 'fr' ? 'Bientôt' : 'Soon'}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

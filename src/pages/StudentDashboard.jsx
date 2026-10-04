import React, { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { getUserStats } from '../db/index'
import '../styles/StudentDashboard.css'

export default function StudentDashboard() {
  const { user, language, setCurrentPage, setRole, logout } = useAppStore()
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
    { id: 'anagram', name: language === 'fr' ? 'Anagrammes' : 'Anagrams', icon: '🔤', available: false },
  ]

  const handleBackToRoles = () => {
    setRole(null)
    setCurrentPage('roleSelect')
  }

  return (
    <div className="student-dashboard">
      {/* Header */}
      <div className="student-dashboard__header">
        <div className="student-dashboard__user">
          <h1>{language === 'fr' ? 'Bonjour' : 'Hello'}, {user?.name || 'Élève'} 👋</h1>
          <p className="student-dashboard__level">
            {user?.level || 'SIL-CP'}
          </p>
        </div>
        <div className="student-dashboard__actions">
          <button className="student-dashboard__back" onClick={handleBackToRoles} title={language === 'fr' ? 'Changer de profil' : 'Switch profile'}>
            {language === 'fr' ? 'Profil' : 'Profile'}
          </button>
          <button className="student-dashboard__logout" onClick={logout} title={language === 'fr' ? 'Déconnexion' : 'Log out'}>
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

      {/* Games */}
      <div className="student-dashboard__games">
        <h2>{language === 'fr' ? 'Jeux disponibles' : 'Available Games'}</h2>
        <div className="games-grid">
          {games.map(game => (
            <button
              key={game.id}
              className={`game-card ${!game.available ? 'game-card--disabled' : ''}`}
              onClick={() => game.available && setCurrentPage('crosswordGame')}
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

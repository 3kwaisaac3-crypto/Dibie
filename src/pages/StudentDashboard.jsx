import React, { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import '../styles/StudentDashboard.css'

export default function StudentDashboard() {
  const { user, language, setCurrentPage, logout } = useAppStore()
  const [stats, setStats] = useState({
    score: 0,
    games: 0,
    streak: 0,
    badges: []
  })

  useEffect(() => {
    // Charger les stats depuis IndexedDB (À implémenter)
    setStats({
      score: 150,
      games: 5,
      streak: 3,
      badges: ['🌟', '⭐', '👑']
    })
  }, [])

  const games = [
    { id: 'crossword', name: language === 'fr' ? 'Mots Croisés' : 'Crossword', icon: '⬜' },
    { id: 'anagram', name: language === 'fr' ? 'Anagrammes' : 'Anagrams', icon: '🔤' },
  ]

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
        <button className="student-dashboard__logout" onClick={logout}>
          ❌
        </button>
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
              className="game-card"
              onClick={() => setCurrentPage('crosswordGame')}
            >
              <div className="game-card__icon">{game.icon}</div>
              <div className="game-card__name">{game.name}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

import React, { useEffect, useState } from 'react'
import { useAppStore } from './stores/appStore'
import { loadVocabulaire } from './db/index'
import vocabData from './data/vocabulaire.json'

// Pages
import Login from './pages/Login'
import RoleSelect from './pages/RoleSelect'
import StudentDashboard from './pages/StudentDashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import ParentDashboard from './pages/ParentDashboard'
import AdminDashboard from './pages/AdminDashboard'
import CrosswordGame from './pages/CrosswordGame'
import WordSearchGame from './pages/WordSearchGame'

import './App.css'

export default function App() {
  const { currentPage, isAuthenticated, isOnline, language, setLanguage } = useAppStore()
  const [vocabLoaded, setVocabLoaded] = useState(false)

  useEffect(() => {
    // Charger vocabulaire au démarrage - IMPÉRATIF
    const initVocab = async () => {
      try {
        await loadVocabulaire(vocabData)
        setVocabLoaded(true)
        console.log('✅ Vocabulaire OK:', vocabData.length)
      } catch (e) {
        console.error('❌ Vocab error:', e)
      }
    }
    initVocab()
  }, [])

  if (!vocabLoaded && (currentPage === 'crosswordGame' || currentPage === 'wordSearchGame')) {
    return <div style={{padding: '20px', textAlign: 'center'}}>⏳ Chargement jeu...</div>
  }

  return (
    <div className="app">
      {!isOnline && (
        <div className="offline-banner">
          📡 {language === 'fr' ? 'Mode Hors-Ligne Activé' : 'Offline Mode Active'}
        </div>
      )}

      {!isAuthenticated && currentPage === 'login' && <Login />}
      {isAuthenticated && currentPage === 'roleSelect' && <RoleSelect />}
      {isAuthenticated && currentPage === 'studentDashboard' && <StudentDashboard />}
      {isAuthenticated && currentPage === 'teacherDashboard' && <TeacherDashboard />}
      {isAuthenticated && currentPage === 'parentDashboard' && <ParentDashboard />}
      {isAuthenticated && currentPage === 'adminDashboard' && <AdminDashboard />}
      {isAuthenticated && currentPage === 'crosswordGame' && vocabLoaded && <CrosswordGame />}
      {isAuthenticated && currentPage === 'wordSearchGame' && vocabLoaded && <WordSearchGame />}

      {/* Sélecteur de langue global, accessible après connexion */}
      {isAuthenticated && (
        <div className="global-language-toggle">
          <button
            className={`global-lang-btn ${language === 'fr' ? 'active' : ''}`}
            onClick={() => setLanguage('fr')}
            aria-label="Français"
          >
            🇫🇷 FR
          </button>
          <button
            className={`global-lang-btn ${language === 'en' ? 'active' : ''}`}
            onClick={() => setLanguage('en')}
            aria-label="English"
          >
            🇬🇧 EN
          </button>
        </div>
      )}
    </div>
  )
}
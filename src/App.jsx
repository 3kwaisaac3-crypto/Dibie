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

import './App.css'

export default function App() {
  const { currentPage, user, isAuthenticated, isOnline } = useAppStore()
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

  if (!vocabLoaded && (currentPage === 'crosswordGame')) {
    return <div style={{padding: '20px', textAlign: 'center'}}>⏳ Chargement jeu...</div>
  }

  return (
    <div className="app">
      {!isOnline && (
        <div className="offline-banner">
          📡 Mode Hors-Ligne Activé
        </div>
      )}

      {!isAuthenticated && currentPage === 'login' && <Login />}
      {isAuthenticated && currentPage === 'roleSelect' && <RoleSelect />}
      {isAuthenticated && currentPage === 'studentDashboard' && <StudentDashboard />}
      {isAuthenticated && currentPage === 'teacherDashboard' && <TeacherDashboard />}
      {isAuthenticated && currentPage === 'parentDashboard' && <ParentDashboard />}
      {isAuthenticated && currentPage === 'adminDashboard' && <AdminDashboard />}
      {isAuthenticated && currentPage === 'crosswordGame' && vocabLoaded && <CrosswordGame />}
    </div>
  )
}
import React, { useEffect } from 'react'
import { useAppStore } from './stores/appStore'
import { loadVocabulaire, db } from './db/index'
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

  useEffect(() => {
    // Charger vocabulaire au démarrage
    loadVocabulaire(vocabData).catch(e => console.error('Erreur chargement vocabulaire:', e))
  }, [])

  return (
    <div className="app">
      {/* Status bar offline */}
      {!isOnline && (
        <div className="offline-banner">
          📡 Mode Hors-Ligne Activé
        </div>
      )}

      {/* Pages */}
      {!isAuthenticated && currentPage === 'login' && <Login />}
      {!isAuthenticated && currentPage === 'roleSelect' && <RoleSelect />}
      {isAuthenticated && currentPage === 'studentDashboard' && <StudentDashboard />}
      {isAuthenticated && currentPage === 'teacherDashboard' && <TeacherDashboard />}
      {isAuthenticated && currentPage === 'parentDashboard' && <ParentDashboard />}
      {isAuthenticated && currentPage === 'adminDashboard' && <AdminDashboard />}
      {isAuthenticated && currentPage === 'crosswordGame' && <CrosswordGame />}
    </div>
  )
}

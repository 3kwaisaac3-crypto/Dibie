import React, { useEffect, useState } from 'react'
import { useAppStore } from './stores/appStore'
import { getProfile, loadVocabulaire } from './db/index'
import vocabData from './data/vocabulaire.json'

// Pages
import Profiles from './pages/Profiles'
import RoleSelect from './pages/RoleSelect'
import StudentDashboard from './pages/StudentDashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import ParentDashboard from './pages/ParentDashboard'
import AdminDashboard from './pages/AdminDashboard'
import CrosswordGame from './pages/CrosswordGame'
import WordSearchGame from './pages/WordSearchGame'
import AnagramGame from './pages/AnagramGame'
import MysteryGame from './pages/MysteryGame'
import PyramidGame from './pages/PyramidGame'
import PairsGame from './pages/PairsGame'
import DefinitionGame from './pages/DefinitionGame'
import MemoryGame from './pages/MemoryGame'
import TablesMemoryGame from './pages/TablesMemoryGame'

import './App.css'

const STUDENT_PAGES = ['studentDashboard', 'crosswordGame', 'wordSearchGame', 'anagramGame', 'mysteryGame', 'pyramidGame', 'pairsGame', 'definitionGame', 'memoryGame', 'tablesMemoryGame']
const ADULT_PAGES = ['roleSelect', 'teacherDashboard', 'parentDashboard', 'adminDashboard']

export default function App() {
  const { currentPage, isAuthenticated, isOnline, language, setLanguage, user, logout } = useAppStore()
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

  // Une session restaurée dont le profil n'existe plus revient aux profils
  const sessionValid = isAuthenticated && (user?.isAdult === true || getProfile(user?.id) !== null)

  useEffect(() => {
    if (isAuthenticated && !sessionValid) logout()
  }, [isAuthenticated, sessionValid, logout])

  // Page réellement affichée : jamais de page vide, même si la page conservée
  // n'est pas accessible avec cette session
  let page = currentPage
  if (!sessionValid) {
    page = currentPage === 'roleSelect' ? 'roleSelect' : 'profiles'
  } else if (!(user?.isAdult ? ADULT_PAGES : STUDENT_PAGES).includes(currentPage)) {
    page = user?.isAdult ? 'roleSelect' : 'studentDashboard'
  }

  // Changement d'écran : retour en haut. Sur téléphone, l'écran des profils est
  // long, et le tableau de bord s'ouvrait défilé, ses boutons hors de vue.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [page])

  if (!vocabLoaded && (page === 'crosswordGame' || page === 'wordSearchGame' || page === 'anagramGame' || page === 'mysteryGame' || page === 'pairsGame' || page === 'definitionGame' || page === 'memoryGame')) {
    return <div style={{padding: '20px', textAlign: 'center'}}>⏳ Chargement jeu...</div>
  }

  return (
    <div className="app">
      {!isOnline && (
        <div className="offline-banner">
          📡 {language === 'fr' ? 'Mode Hors-Ligne Activé' : 'Offline Mode Active'}
        </div>
      )}

      {page === 'profiles' && <Profiles />}
      {page === 'roleSelect' && <RoleSelect />}
      {page === 'studentDashboard' && <StudentDashboard />}
      {page === 'teacherDashboard' && <TeacherDashboard />}
      {page === 'parentDashboard' && <ParentDashboard />}
      {page === 'adminDashboard' && <AdminDashboard />}
      {page === 'crosswordGame' && vocabLoaded && <CrosswordGame />}
      {page === 'wordSearchGame' && vocabLoaded && <WordSearchGame />}
      {page === 'anagramGame' && vocabLoaded && <AnagramGame />}
      {page === 'mysteryGame' && vocabLoaded && <MysteryGame />}
      {page === 'pairsGame' && vocabLoaded && <PairsGame />}
      {page === 'definitionGame' && vocabLoaded && <DefinitionGame />}
      {page === 'memoryGame' && vocabLoaded && <MemoryGame />}
      {/* Pyramides : nombres générés, sans vocabulaire à attendre */}
      {page === 'pyramidGame' && <PyramidGame />}
      {/* Mémoire des tables : opérations générées, sans vocabulaire à attendre */}
      {page === 'tablesMemoryGame' && <TablesMemoryGame />}

      {/* Sélecteur de langue global ; l'écran des profils a le sien */}
      {page !== 'profiles' && (
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
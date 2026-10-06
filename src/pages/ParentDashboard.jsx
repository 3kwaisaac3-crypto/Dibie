import React from 'react'
import { useAppStore } from '../stores/appStore'

export default function ParentDashboard() {
  const { language, setRole, setCurrentPage, logout } = useAppStore()

  const handleBackToRoles = () => {
    setRole(null)
    setCurrentPage('roleSelect')
  }

  return (
    <div style={{ padding: '20px', minHeight: '100vh', background: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)', color: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>{language === 'fr' ? 'Suivi Parent' : 'Parent Monitoring'}</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleBackToRoles}
            style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', color: 'white', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {language === 'fr' ? 'Profil' : 'Profile'}
          </button>
          <button onClick={logout} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>❌</button>
        </div>
      </div>
      <div style={{ background: 'white', color: '#333', padding: '30px', borderRadius: '8px' }}>
        <p>{language === 'fr' ? 'Suivi des progrès de l\'enfant' : 'Track child progress'}</p>
        <p style={{ color: '#666', marginTop: '10px' }}>
          {language === 'fr'
            ? 'Cette section affichera les scores, le temps passé et les notions maîtrisées de votre enfant.'
            : 'This section will show your child\'s scores, time spent, and mastered topics.'}
        </p>
      </div>
    </div>
  )
}

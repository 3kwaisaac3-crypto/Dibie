import React from 'react'
import { useAppStore } from '../stores/appStore'

export default function ParentDashboard() {
  const { user, language, logout } = useAppStore()

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>{language === 'fr' ? 'Suivi Parent' : 'Parent Monitoring'}</h1>
        <button onClick={logout}>❌</button>
      </div>
      <p>{language === 'fr' ? 'Suivi des progrès de l\'enfant' : 'Track child progress'}</p>
      {/* À implémenter */}
    </div>
  )
}

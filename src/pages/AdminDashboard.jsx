import React, { useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { importLocalVocab } from '../db/index'
import { messageImport } from '../utils/vocabImport'

export default function AdminDashboard() {
  const { language, setRole, setCurrentPage, logout } = useAppStore()
  const [importStatus, setImportStatus] = useState(null)

  const handleBackToRoles = () => {
    setRole(null)
    setCurrentPage('roleSelect')
  }

  const handleImportVocab = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const { added, ignored, total } = importLocalVocab(event.target.result)

        if (total === 0) {
          setImportStatus({ ok: false, message: language === 'fr' ? 'Fichier vide.' : 'Empty file.' })
          return
        }

        setImportStatus({
          ok: true,
          message: messageImport(added, ignored, language)
        })
      } catch (err) {
        setImportStatus({
          ok: false,
          message: (language === 'fr' ? 'Erreur d\'import : ' : 'Import error: ') + (language === 'fr' ? err.message : err.en || err.message)
        })
      }
    }
    reader.onerror = () => {
      setImportStatus({ ok: false, message: language === 'fr' ? 'Impossible de lire le fichier.' : 'Could not read file.' })
    }
    reader.readAsText(file)
    // Permet de choisir à nouveau le même fichier
    e.target.value = ''
  }

  return (
    <div style={{ padding: '20px', minHeight: '100vh', background: 'linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%)', color: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>{language === 'fr' ? 'Administration' : 'Administration'}</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleBackToRoles}
            style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', color: 'white', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {language === 'fr' ? 'Profil' : 'Profile'}
          </button>
          <button onClick={logout} aria-label={language === 'fr' ? 'Déconnexion' : 'Log out'} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>❌</button>
        </div>
      </div>

      <div style={{ marginTop: '20px', background: 'white', color: '#333', padding: '30px', borderRadius: '8px' }}>
        <h2>{language === 'fr' ? 'Importer Vocabulaire' : 'Import Vocabulary'}</h2>
        <p style={{ color: '#666', marginBottom: '15px' }}>
          {language === 'fr'
            ? 'Format CSV : mot_fr;mot_en;def_fr;def_en;niveau;sujet, avec ou sans colonne N° en première position — niveau : SIL-CP, CE1-CE2 ou CM1-CM2. Les mots déjà présents sont ignorés, jamais écrasés.'
            : 'CSV format: mot_fr;mot_en;def_fr;def_en;niveau;sujet, with or without a No. column first — niveau: SIL-CP, CE1-CE2 or CM1-CM2. Words already present are skipped, never overwritten.'}
        </p>
        <p style={{ color: '#8a5a00', marginBottom: '15px' }}>
          {language === 'fr'
            ? 'Attention : les mots importés restent sur cet appareil. Un même numéro de grille peut alors donner une grille différente de celle des autres appareils de la classe.'
            : 'Warning: imported words stay on this device. The same grid number may then give a different grid from the other devices in the class.'}
        </p>
        <input
          type="file"
          accept=".csv"
          aria-label={language === 'fr' ? 'Fichier CSV à importer' : 'CSV file to import'}
          onChange={handleImportVocab}
          style={{ marginBottom: '15px' }}
        />
        {importStatus && (
          <div style={{
            padding: '12px',
            borderRadius: '6px',
            background: importStatus.ok ? '#E8F5E9' : '#FFEBEE',
            color: importStatus.ok ? '#2E7D32' : '#C62828',
            marginTop: '10px'
          }}>
            {importStatus.message}
          </div>
        )}
      </div>
    </div>
  )
}

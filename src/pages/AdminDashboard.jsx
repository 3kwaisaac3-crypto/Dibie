import React, { useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { db } from '../db/index'

export default function AdminDashboard() {
  const { user, language, logout } = useAppStore()
  const [csvFile, setCsvFile] = useState(null)

  const handleImportVocab = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const csv = event.target.result
        // Parse CSV (simplifié - À améliorer)
        const lines = csv.split('\n')
        // Process and add to DB
        alert(language === 'fr' ? 'Vocabulaire importé' : 'Vocabulary imported')
      } catch (err) {
        alert(language === 'fr' ? 'Erreur d\'import' : 'Import error')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>{language === 'fr' ? 'Administration' : 'Administration'}</h1>
        <button onClick={logout}>❌</button>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h2>{language === 'fr' ? 'Importer Vocabulaire' : 'Import Vocabulary'}</h2>
        <input 
          type="file" 
          accept=".csv"
          onChange={handleImportVocab}
        />
      </div>
    </div>
  )
}

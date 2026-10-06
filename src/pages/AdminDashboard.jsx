import React, { useState } from 'react'
import { useAppStore } from '../stores/appStore'

// Correspondance des tranches francophones et anglophones du primaire (curriculum MINEDUB 2018)
const NIVEAU_EN = {
  'SIL-CP': 'Class 1-2',
  'CE1-CE2': 'Class 3-4',
  'CM1-CM2': 'Class 5-6'
}

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
        const csv = event.target.result
        const rows = parseCSV(csv)

        // Ignorer une éventuelle ligne d'en-tête (mot_fr;mot_en;…)
        const hasHeader = rows.length > 0 && (rows[0][0] || '').toLowerCase() === 'mot_fr'
        if (hasHeader) rows.shift()

        if (rows.length === 0) {
          setImportStatus({ ok: false, message: language === 'fr' ? 'Fichier vide.' : 'Empty file.' })
          return
        }

        // Valider et convertir en entrées de vocabulaire
        const entries = rows.map((row, i) => {
          const [mot_fr, mot_en, def_fr, def_en, niveau, sujet] = row
          const ligne = i + (hasHeader ? 2 : 1)
          if (!mot_fr || !mot_en || !def_fr || !def_en) {
            throw new Error(`Ligne ${ligne} incomplète`)
          }
          // Tolérer la casse et les espaces : « cm1 - cm2 » → « CM1-CM2 »
          const niveau_fr = (niveau || 'CM1-CM2').toUpperCase().replace(/\s+/g, '')
          if (!NIVEAU_EN[niveau_fr]) {
            throw new Error(`Ligne ${ligne} : niveau inconnu « ${niveau} » (attendu : SIL-CP, CE1-CE2 ou CM1-CM2)`)
          }
          return {
            id: `import_${Date.now()}_${i}`,
            mot_fr: mot_fr.trim(),
            mot_en: mot_en.trim(),
            def_fr: def_fr.trim(),
            def_en: def_en.trim(),
            niveau_fr,
            niveau_en: NIVEAU_EN[niveau_fr],
            sujet: (sujet || 'Importé').trim(),
            difficulte: 2,
            actif: true
          }
        })

        // Fusionner avec le vocabulaire existant (localStorage)
        const existing = JSON.parse(localStorage.getItem('dibieVocab') || '[]')
        const merged = [...existing, ...entries]
        localStorage.setItem('dibieVocab', JSON.stringify(merged))

        setImportStatus({
          ok: true,
          message: language === 'fr'
            ? `${entries.length} mots importés avec succès.`
            : `${entries.length} words imported successfully.`
        })
      } catch (err) {
        setImportStatus({
          ok: false,
          message: (language === 'fr' ? 'Erreur d\'import : ' : 'Import error: ') + err.message
        })
      }
    }
    reader.onerror = () => {
      setImportStatus({ ok: false, message: language === 'fr' ? 'Impossible de lire le fichier.' : 'Could not read file.' })
    }
    reader.readAsText(file)
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
          <button onClick={logout} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>❌</button>
        </div>
      </div>

      <div style={{ marginTop: '20px', background: 'white', color: '#333', padding: '30px', borderRadius: '8px' }}>
        <h2>{language === 'fr' ? 'Importer Vocabulaire' : 'Import Vocabulary'}</h2>
        <p style={{ color: '#666', marginBottom: '15px' }}>
          {language === 'fr'
            ? 'Format CSV (séparateur ;) : mot_fr;mot_en;def_fr;def_en;niveau;sujet — niveau : SIL-CP, CE1-CE2 ou CM1-CM2'
            : 'CSV format (separator ;) : mot_fr;mot_en;def_fr;def_en;niveau;sujet — niveau: SIL-CP, CE1-CE2 or CM1-CM2'}
        </p>
        <input
          type="file"
          accept=".csv"
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

// Parser CSV simple gérant les séparateurs ";" et les valeurs entre guillemets
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '')
  const rows = []
  for (const line of lines) {
    const cells = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        inQuotes = !inQuotes
      } else if ((ch === ';' || ch === ',') && !inQuotes) {
        cells.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    cells.push(current.trim())
    rows.push(cells)
  }
  return rows
}

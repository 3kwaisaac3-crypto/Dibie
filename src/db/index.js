// Stockage simple en mémoire (fallback rapide)
let vocabulaireCache = []

export const loadVocabulaire = async (vocabData) => {
  if (vocabulaireCache.length > 0) {
    console.log('✅ Vocabulaire déjà en cache')
    return
  }
  
  vocabulaireCache = vocabData
  console.log('✅ Vocabulaire chargé en mémoire:', vocabData.length, 'mots')
  
  // Sauvegarder aussi en localStorage comme backup
  try {
    localStorage.setItem('dibieVocab', JSON.stringify(vocabData))
  } catch {
    console.warn('localStorage plein')
  }
}

// Obtenir vocabulaire par niveau et sujet
export const getVocabByLevelAndSubject = async (niveau, sujet) => {
  if (vocabulaireCache.length === 0) {
    // Charger depuis localStorage si besoin
    const stored = localStorage.getItem('dibieVocab')
    if (stored) {
      vocabulaireCache = JSON.parse(stored)
    } else {
      return []
    }
  }

  return vocabulaireCache.filter(v => 
    v.niveau_fr === niveau && v.sujet === sujet && v.actif !== false
  )
}

// Obtenir le vocabulaire actif d'un niveau, tous sujets confondus
export const getVocabByLevel = async (niveau) => {
  if (vocabulaireCache.length === 0) {
    const stored = localStorage.getItem('dibieVocab')
    if (stored) vocabulaireCache = JSON.parse(stored)
  }
  return vocabulaireCache.filter(v => v.niveau_fr === niveau && v.actif !== false)
}

// Obtenir la liste des sujets disponibles (triée)
export const getAllSubjects = async () => {
  if (vocabulaireCache.length === 0) {
    const stored = localStorage.getItem('dibieVocab')
    if (stored) vocabulaireCache = JSON.parse(stored)
  }
  const subjects = new Set(
    vocabulaireCache.filter(v => v.actif !== false).map(v => v.sujet)
  )
  return Array.from(subjects).sort()
}

// Obtenir la liste des niveaux disponibles (triée)
export const getAllLevels = async () => {
  if (vocabulaireCache.length === 0) {
    const stored = localStorage.getItem('dibieVocab')
    if (stored) vocabulaireCache = JSON.parse(stored)
  }
  const levels = new Set(
    vocabulaireCache.filter(v => v.actif !== false).map(v => v.niveau_fr)
  )
  return Array.from(levels).sort()
}

// Sauvegarder progrès utilisateur (localStorage simple)
export const saveUserProgress = async (userId, wordId, isCorrect, timeTaken) => {
  try {
    const progress = JSON.parse(localStorage.getItem('dibieProgress') || '[]')
    progress.push({
      userId,
      wordId,
      isCorrect,
      timeTaken,
      date: new Date().toISOString()
    })
    localStorage.setItem('dibieProgress', JSON.stringify(progress))
  } catch (e) {
    console.error('Erreur save progress:', e)
  }
}

// Sauvegarder score
// details (facultatif) : informations de la partie, ex. graine de la grille
export const saveScore = async (userId, gameType, score, niveau, details = {}) => {
  try {
    const scores = JSON.parse(localStorage.getItem('dibieScores') || '[]')
    scores.push({
      ...details,
      userId,
      gameType,
      score,
      niveau,
      date: new Date().toISOString()
    })
    localStorage.setItem('dibieScores', JSON.stringify(scores))
    console.log('✅ Score sauvegardé:', score)
  } catch (e) {
    console.error('Erreur save score:', e)
  }
}

// Enregistrer une grille de mots mêlés (graine, liste de mots, versions) pour
// pouvoir la reproduire (décision 8 du 2026-10-05). Seules les 50 dernières
// grilles sont gardées.
export const saveWordSearchGrid = async (entry) => {
  try {
    const grids = JSON.parse(localStorage.getItem('dibieWordSearchGrids') || '[]')
    grids.push({ ...entry, date: new Date().toISOString() })
    localStorage.setItem('dibieWordSearchGrids', JSON.stringify(grids.slice(-50)))
  } catch (e) {
    console.error('Erreur save grille mots mêlés:', e)
  }
}

// Obtenir scores utilisateur
export const getUserScores = async (userId) => {
  try {
    const scores = JSON.parse(localStorage.getItem('dibieScores') || '[]')
    return scores.filter(s => s.userId === userId)
  } catch {
    return []
  }
}

// Obtenir le progrès utilisateur
export const getUserProgress = async (userId) => {
  try {
    const progress = JSON.parse(localStorage.getItem('dibieProgress') || '[]')
    return progress.filter(p => p.userId === userId)
  } catch {
    return []
  }
}

// Calculer les statistiques agrégées d'un utilisateur (points, jeux, série, badges)
export const getUserStats = async (userId) => {
  const scores = await getUserScores(userId)
  const progress = await getUserProgress(userId)

  const totalScore = scores.reduce((sum, s) => sum + (s.score || 0), 0)
  const games = scores.length

  // Série : jours consécutifs avec activité (aujourd'hui inclus)
  const days = new Set(
    [...scores, ...progress].map(entry => {
      const d = new Date(entry.date)
      return d.toISOString().slice(0, 10)
    })
  )
  let streak = 0
  const cursor = new Date()
  // Si aucune activité aujourd'hui, commencer à hier
  const todayKey = cursor.toISOString().slice(0, 10)
  if (!days.has(todayKey)) cursor.setDate(cursor.getDate() - 1)
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  // Badges basés sur le score cumulé
  const badges = []
  if (totalScore >= 50) badges.push('🌟')
  if (totalScore >= 150) badges.push('⭐')
  if (totalScore >= 300) badges.push('👑')
  if (games >= 1) badges.push('🎯')

  return { score: totalScore, games, streak, badges }
}

// Obtenir tous les utilisateurs ayant des scores (pour le dashboard enseignant)
export const getAllUsersWithScores = async () => {
  try {
    const scores = JSON.parse(localStorage.getItem('dibieScores') || '[]')
    const byUser = {}
    scores.forEach(s => {
      if (!byUser[s.userId]) {
        byUser[s.userId] = { userId: s.userId, name: s.userId, score: 0, games: 0 }
      }
      byUser[s.userId].score += s.score || 0
      byUser[s.userId].games += 1
    })
    return Object.values(byUser)
  } catch {
    return []
  }
}
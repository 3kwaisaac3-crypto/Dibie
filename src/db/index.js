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
  } catch (e) {
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
export const saveScore = async (userId, gameType, score, niveau) => {
  try {
    const scores = JSON.parse(localStorage.getItem('dibieScores') || '[]')
    scores.push({
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

// Obtenir scores utilisateur
export const getUserScores = async (userId) => {
  try {
    const scores = JSON.parse(localStorage.getItem('dibieScores') || '[]')
    return scores.filter(s => s.userId === userId)
  } catch (e) {
    return []
  }
}
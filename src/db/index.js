import Dexie from 'dexie'

export const db = new Dexie('DibieDB')

db.version(1).stores({
  vocabulaire: '++id, niveau_fr, sujet, actif',
  users: 'id, role, email',
  userProgress: '++id, userId, wordId, dateCompleted',
  scores: '++id, userId, dateCreated',
  gameSession: '++id, userId, gameType, dateCreated'
})

// Charger vocabulaire au démarrage
export const loadVocabulaire = async (vocabData) => {
  const count = await db.vocabulaire.count()
  if (count === 0) {
    await db.vocabulaire.bulkAdd(vocabData)
  }
}

// Obtenir vocabulaire par niveau et sujet
export const getVocabByLevelAndSubject = async (niveau, sujet) => {
  return db.vocabulaire
    .where('niveau_fr')
    .equals(niveau)
    .filter(v => v.sujet === sujet)
    .toArray()
}

// Sauvegarder progrès utilisateur
export const saveUserProgress = async (userId, wordId, isCorrect, timeTaken) => {
  return db.userProgress.add({
    userId,
    wordId,
    isCorrect,
    timeTaken,
    dateCompleted: new Date()
  })
}

// Obtenir progrès utilisateur
export const getUserProgress = async (userId) => {
  return db.userProgress.where('userId').equals(userId).toArray()
}

// Sauvegarder score
export const saveScore = async (userId, gameType, score, niveau) => {
  return db.scores.add({
    userId,
    gameType,
    score,
    niveau,
    dateCreated: new Date()
  })
}

// Obtenir scores utilisateur
export const getUserScores = async (userId) => {
  return db.scores.where('userId').equals(userId).toArray()
}

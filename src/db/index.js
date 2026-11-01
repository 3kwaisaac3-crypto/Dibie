import { ImportError, mergeVocab, prepareImport } from '../utils/vocabImport.js'

// Stockage simple en mémoire (fallback rapide) : vocabulaire de base + ajouts locaux
let vocabulaireCache = []
let vocabulaireSauvegarde = null

const LOCAL_VOCAB_KEY = 'dibieLocalVocab'
const PROFILES_KEY = 'dibieProfiles'

// Tableau stocké sous cette clé ; tableau vide si absent ou illisible
const lireTableau = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value.filter(e => e !== null && typeof e === 'object' && !Array.isArray(e)) : []
  } catch {
    console.warn(`Données illisibles : ${key}`)
    return []
  }
}

// Tableau brut, pour réécrire une clé en conservant toutes ses entrées, même
// celles que la lecture écarte. Tableau vide si la clé n'existe pas ; null si son
// contenu est illisible ou n'est pas un tableau : il ne faut alors jamais écrire,
// pour ne pas écraser une donnée.
const lireBrut = (key) => {
  const texte = localStorage.getItem(key)
  if (texte === null) return []
  try {
    const value = JSON.parse(texte)
    return Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

// Ajouts locaux lisibles
const lireAjouts = () => lireTableau(LOCAL_VOCAB_KEY).filter(e => typeof e.mot_fr === 'string')

// La fusion est refaite à chaque démarrage. dibieVocab ne contient que la base :
// il est réécrit, c'est pourquoi les ajouts vivent dans dibieLocalVocab.
export const loadVocabulaire = async (vocabData) => {
  vocabulaireCache = mergeVocab(vocabData, lireAjouts())
  console.log('✅ Vocabulaire chargé en mémoire:', vocabulaireCache.length, 'mots')

  // Sauvegarder aussi en localStorage comme backup (une fois par chargement)
  if (vocabulaireSauvegarde === vocabData) return
  try {
    localStorage.setItem('dibieVocab', JSON.stringify(vocabData))
    vocabulaireSauvegarde = vocabData
  } catch {
    console.warn('localStorage plein')
  }
}

// Si loadVocabulaire n'a pas encore tourné : recharger depuis localStorage
const assurerVocabulaire = () => {
  if (vocabulaireCache.length === 0) {
    vocabulaireCache = mergeVocab(lireTableau('dibieVocab'), lireAjouts())
  }
}

// Importe un fichier CSV dans les ajouts locaux, jamais dans la base : les mots
// sont aussitôt utilisables, sans recharger. Rien n'est écrasé.
// Renvoie { added, ignored, total } ; lance une ImportError si le fichier est
// invalide, ou si les mots ne peuvent pas être enregistrés sans rien écraser.
export const importLocalVocab = (csvText) => {
  assurerVocabulaire()
  const { entries, added, ignored, total } = prepareImport(csvText, vocabulaireCache)
  if (added > 0) {
    let ajouts = null
    try {
      ajouts = lireBrut(LOCAL_VOCAB_KEY)
    } catch (e) {
      console.error('Erreur lecture ajouts:', e)
    }
    if (ajouts === null) {
      throw new ImportError(
        'Impossible d\'enregistrer les mots : les ajouts déjà présents sur cet appareil sont illisibles. Rien n\'a été modifié.',
        'Could not save the words: the additions already on this device cannot be read. Nothing was changed.'
      )
    }
    try {
      localStorage.setItem(LOCAL_VOCAB_KEY, JSON.stringify([...ajouts, ...entries]))
    } catch (e) {
      console.error('Erreur save ajouts:', e)
      throw new ImportError(
        'Impossible d\'enregistrer les mots : le stockage de cet appareil est plein ou indisponible. Rien n\'a été ajouté.',
        'Could not save the words: the storage on this device is full or unavailable. Nothing was added.'
      )
    }
    vocabulaireCache = [...vocabulaireCache, ...entries]
  }
  return { added, ignored, total }
}

// Profils locaux à pseudonyme (data-dictionary §2.1). Aucune fonction de
// suppression : un score garde toujours son profil.
export const PROFILE_LEVELS = ['SIL-CP', 'CE1-CE2', 'CM1-CM2']
const CLASSES = {
  fr: { 'SIL-CP': ['SIL', 'CP'], 'CE1-CE2': ['CE1', 'CE2'], 'CM1-CM2': ['CM1', 'CM2'] },
  en: { 'SIL-CP': ['Class 1', 'Class 2'], 'CE1-CE2': ['Class 3', 'Class 4'], 'CM1-CM2': ['Class 5', 'Class 6'] }
}
export const PROFILE_NAME_MAX = 20

// Classes possibles pour un niveau et un sous-système
export const classesOf = (level, subsystem) => CLASSES[subsystem]?.[level] ?? []

export const getProfiles = () => lireTableau(PROFILES_KEY).filter(p => typeof p.id === 'string' && typeof p.name === 'string')

export const getProfile = (id) => getProfiles().find(p => p.id === id) ?? null

// Crée un profil. Renvoie { profile }, ou { error } : 'name-empty', 'name-taken',
// 'invalid' (niveau, classe ou sous-système inconnu), 'storage'.
export const createProfile = ({ name, level, class: className = null, subsystem = 'fr' }) => {
  const pseudo = String(name ?? '').trim().replace(/\s+/g, ' ').slice(0, PROFILE_NAME_MAX)
  if (pseudo === '') return { error: 'name-empty' }
  if (!PROFILE_LEVELS.includes(level) || !CLASSES[subsystem]) return { error: 'invalid' }
  if (className !== null && !classesOf(level, subsystem).includes(className)) return { error: 'invalid' }

  const profiles = getProfiles()
  if (profiles.some(p => p.name.toLowerCase() === pseudo.toLowerCase())) return { error: 'name-taken' }

  let id
  do {
    id = `prof_${Math.random().toString(36).slice(2, 9)}`
  } while (profiles.some(p => p.id === id))

  const profile = { id, name: pseudo, level, class: className, subsystem, createdAt: new Date().toISOString() }
  try {
    const bruts = lireBrut(PROFILES_KEY)
    if (bruts === null) return { error: 'storage' }
    localStorage.setItem(PROFILES_KEY, JSON.stringify([...bruts, profile]))
  } catch (e) {
    console.error('Erreur save profil:', e)
    return { error: 'storage' }
  }
  return { profile }
}

// Obtenir vocabulaire par niveau et sujet
export const getVocabByLevelAndSubject = async (niveau, sujet) => {
  assurerVocabulaire()

  return vocabulaireCache.filter(v => 
    v.niveau_fr === niveau && v.sujet === sujet && v.actif !== false
  )
}

// Obtenir le vocabulaire actif d'un niveau, tous sujets confondus
export const getVocabByLevel = async (niveau) => {
  assurerVocabulaire()
  return vocabulaireCache.filter(v => v.niveau_fr === niveau && v.actif !== false)
}

// Obtenir la liste des sujets disponibles (triée)
export const getAllSubjects = async () => {
  assurerVocabulaire()
  const subjects = new Set(
    vocabulaireCache.filter(v => v.actif !== false).map(v => v.sujet)
  )
  return Array.from(subjects).sort()
}

// Obtenir la liste des niveaux disponibles (triée)
export const getAllLevels = async () => {
  assurerVocabulaire()
  const levels = new Set(
    vocabulaireCache.filter(v => v.actif !== false).map(v => v.niveau_fr)
  )
  return Array.from(levels).sort()
}

// Sauvegarder progrès utilisateur (localStorage simple)
// gameType et itemId (facultatifs) : jeu et élément concernés ; absents des
// anciennes lignes, qui restent lisibles
export const saveUserProgress = async (userId, wordId, isCorrect, timeTaken, { gameType, itemId } = {}) => {
  try {
    const progress = JSON.parse(localStorage.getItem('dibieProgress') || '[]')
    progress.push({
      userId,
      wordId,
      isCorrect,
      timeTaken,
      ...(gameType !== undefined && { gameType }),
      ...(itemId !== undefined && { itemId }),
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
    const profiles = getProfiles()
    const byUser = {}
    scores.forEach(s => {
      if (!byUser[s.userId]) {
        // Score sans profil (anciens identifiants aléatoires) : conservé, sans rattachement
        const profile = profiles.find(p => p.id === s.userId)
        byUser[s.userId] = { userId: s.userId, name: profile ? profile.name : 'Ancien profil', legacy: !profile, score: 0, games: 0 }
      }
      byUser[s.userId].score += s.score || 0
      byUser[s.userId].games += 1
    })
    return Object.values(byUser)
  } catch {
    return []
  }
}
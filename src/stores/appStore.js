import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

// Stockage de la session protégé : stockage plein ou indisponible ne doit jamais
// lancer d'erreur pendant un changement d'état (page vide). La session continue
// alors en mémoire, sans être conservée.
const stockageSession = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch {
      console.warn('Session non conservée : stockage plein ou indisponible')
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch {
      console.warn('Session non retirée : stockage indisponible')
    }
  }
}

// L'accès adulte ne survit pas au rechargement : un appareil rendu à un enfant
// revient aux profils, et l'adulte répond de nouveau à la question. La langue
// est gardée. Vaut aussi pour une session adulte enregistrée avant cette règle.
const sansAccesAdulte = (session) => (session?.user?.isAdult
  ? { ...session, user: null, isAuthenticated: false, role: null, currentPage: 'profiles' }
  : session)

// Session conservée au rechargement (clé dibieSession) : utilisateur, langue,
// rôle et page. isOnline n'est jamais conservé : il suit toujours le navigateur.
export const useAppStore = create(persist((set) => ({
  // Authentification
  user: null,
  isAuthenticated: false,
  role: null, // 'student', 'teacher', 'parent', 'admin'
  
  // Langue
  language: 'fr', // 'fr' ou 'en'
  
  // Navigation
  currentPage: 'profiles', // profiles, roleSelect, dashboard, game, etc
  
  // Actions
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setRole: (role) => set({ role }),
  setLanguage: (lang) => set({ language: lang }),
  setCurrentPage: (page) => set({ currentPage: page }),
  logout: () => set({ user: null, isAuthenticated: false, role: null, currentPage: 'profiles' }),
  
  // Game state
  gameState: {
    currentGame: null,
    score: 0,
    level: 1,
    isPlaying: false
  },
  
  setGameState: (state) => set(s => ({
    gameState: { ...s.gameState, ...state }
  })),
  
  // Offline mode
  isOnline: navigator.onLine,
  setOnline: (status) => set({ isOnline: status })
}), {
  name: 'dibieSession',
  version: 1,
  storage: createJSONStorage(() => stockageSession),
  partialize: (state) => sansAccesAdulte({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    language: state.language,
    role: state.role,
    currentPage: state.currentPage
  }),
  merge: (persisted, current) => ({ ...current, ...sansAccesAdulte(persisted) })
}))

// Listener pour online/offline
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useAppStore.setState({ isOnline: true })
  })
  
  window.addEventListener('offline', () => {
    useAppStore.setState({ isOnline: false })
  })
}

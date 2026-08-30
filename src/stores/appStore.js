import { create } from 'zustand'

export const useAppStore = create((set) => ({
  // Authentification
  user: null,
  isAuthenticated: false,
  role: null, // 'student', 'teacher', 'parent', 'admin'
  
  // Langue
  language: 'fr', // 'fr' ou 'en'
  
  // Navigation
  currentPage: 'login', // login, roleSelect, dashboard, game, etc
  
  // Actions
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setRole: (role) => set({ role }),
  setLanguage: (lang) => set({ language: lang }),
  setCurrentPage: (page) => set({ currentPage: page }),
  logout: () => set({ user: null, isAuthenticated: false, role: null, currentPage: 'login' }),
  
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

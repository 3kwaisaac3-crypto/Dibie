import React, { useState } from 'react'
import { useAppStore } from '../stores/appStore'
import '../styles/Login.css'

export default function Login() {
  const { setUser, setCurrentPage, language, setLanguage } = useAppStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    
    // Mock authentication
    const mockUser = {
      id: Math.random().toString(36).substr(2, 9),
      name: email.split('@')[0],
      email,
      role: null
    }
    
    setUser(mockUser)
    setCurrentPage('roleSelect')
  }

  return (
    <div className="login">
      <div className="login__container">
        {/* Logo */}
        <div className="login__logo">
          <h1>DIBIÈ</h1>
          <p>{language === 'fr' ? 'Jeux Éducatifs Bilingues' : 'Bilingual Educational Games'}</p>
        </div>

        {/* Form */}
        <form className="login__form" onSubmit={handleSubmit}>
          <h2>
            {isSignUp 
              ? (language === 'fr' ? 'Inscription' : 'Sign Up')
              : (language === 'fr' ? 'Connexion' : 'Sign In')
            }
          </h2>

          <div className="login__field">
            <input
              type="email"
              placeholder={language === 'fr' ? 'Email' : 'Email'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="login__field">
            <input
              type="password"
              placeholder={language === 'fr' ? 'Mot de passe' : 'Password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="login__button">
            {isSignUp 
              ? (language === 'fr' ? 'S\'inscrire' : 'Sign Up')
              : (language === 'fr' ? 'Connexion' : 'Sign In')
            }
          </button>
        </form>

        {/* Toggle Sign Up */}
        <p className="login__toggle">
          {isSignUp 
            ? (language === 'fr' ? 'Déjà inscrit?' : 'Already have an account?')
            : (language === 'fr' ? 'Pas de compte?' : 'No account?')
          }
          {' '}
          <button 
            type="button"
            className="login__toggle-btn"
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp 
              ? (language === 'fr' ? 'Connexion' : 'Sign In')
              : (language === 'fr' ? 'S\'inscrire' : 'Sign Up')
            }
          </button>
        </p>

        {/* Language Toggle */}
        <div className="login__language">
          <button 
            className={`lang-btn ${language === 'fr' ? 'active' : ''}`}
            onClick={() => setLanguage('fr')}
          >
            🇫🇷 Français
          </button>
          <button 
            className={`lang-btn ${language === 'en' ? 'active' : ''}`}
            onClick={() => setLanguage('en')}
          >
            🇬🇧 English
          </button>
        </div>
      </div>
    </div>
  )
}

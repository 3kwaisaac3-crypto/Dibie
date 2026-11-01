import React, { useState } from 'react'
import { useAppStore } from '../stores/appStore'
import './RoleSelect.css'

export default function RoleSelect() {
  const { user, setUser, setRole, setCurrentPage, logout, language } = useAppStore()
  // Espace adulte : simple question, déjà franchie si l'adulte est entré
  const [unlocked, setUnlocked] = useState(user?.isAdult === true)
  const [question] = useState(() => ({ a: 12 + Math.floor(Math.random() * 8), b: 3 + Math.floor(Math.random() * 7) }))
  const [answer, setAnswer] = useState('')
  const [wrongAnswer, setWrongAnswer] = useState(false)

  const roles = [
    {
      id: 'teacher',
      title: language === 'fr' ? 'Enseignant' : 'Teacher',
      icon: '👨‍🏫',
      description: language === 'fr' ? 'Suivre les élèves' : 'Monitor students',
      color: '#2196F3'
    },
    {
      id: 'parent',
      title: language === 'fr' ? 'Parent' : 'Parent',
      icon: '👨‍👩‍👧',
      description: language === 'fr' ? 'Voir progrès' : 'View progress',
      color: '#FF9800'
    },
    {
      id: 'admin',
      title: language === 'fr' ? 'Administrateur' : 'Administrator',
      icon: '⚙️',
      description: language === 'fr' ? 'Gérer l\'app' : 'Manage app',
      color: '#9C27B0'
    }
  ]

  const handleSelectRole = (roleId) => {
    if (!user) setUser({ id: 'adulte', name: language === 'fr' ? 'Adulte' : 'Adult', isAdult: true })
    setRole(roleId)
    
    const dashboards = {
      teacher: 'teacherDashboard',
      parent: 'parentDashboard',
      admin: 'adminDashboard'
    }
    
    setCurrentPage(dashboards[roleId])
  }

  const handleSubmitAnswer = (e) => {
    e.preventDefault()
    if (Number(answer.trim()) === question.a * question.b) {
      setUnlocked(true)
    } else {
      setWrongAnswer(true)
      setAnswer('')
    }
  }

  if (!unlocked) {
    return (
      <div className="role-select">
        <div className="role-select__container">
          <h1 className="role-select__title">{language === 'fr' ? 'Espace adulte' : 'Adult area'}</h1>
          <p className="role-select__notice" role="note">
            {language === 'fr'
              ? 'Cette question évite seulement qu\'un jeune enfant entre ici par mégarde. Ce n\'est pas une sécurité réelle.'
              : 'This question only keeps a young child from coming here by accident. It is not real security.'}
          </p>
          <form className="role-select__gate" onSubmit={handleSubmitAnswer}>
            <label htmlFor="role-select-answer">
              {language === 'fr' ? `Combien font ${question.a} × ${question.b} ?` : `What is ${question.a} × ${question.b}?`}
            </label>
            <input
              id="role-select-answer"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              required
            />
            {wrongAnswer && (
              <p className="role-select__error" role="alert">
                {language === 'fr' ? 'Ce n\'est pas la bonne réponse.' : 'That is not the right answer.'}
              </p>
            )}
            <button type="submit" className="role-select__submit">{language === 'fr' ? 'Entrer' : 'Enter'}</button>
          </form>
          <button className="role-select__back" onClick={logout}>
            {language === 'fr' ? 'Retour aux profils' : 'Back to profiles'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="role-select">
      <div className="role-select__container">
        <h1 className="role-select__title">
          {language === 'fr' ? 'Espace adulte' : 'Adult area'}
        </h1>
        <p className="role-select__subtitle">
          {language === 'fr' ? 'Sélectionnez votre rôle' : 'Select your role'}
        </p>
        
        <div className="role-select__grid">
          {roles.map(role => (
            <button
              key={role.id}
              className="role-select__card"
              onClick={() => handleSelectRole(role.id)}
              style={{ borderTop: `4px solid ${role.color}` }}
            >
              <div className="role-select__icon">{role.icon}</div>
              <h2 className="role-select__name">{role.title}</h2>
              <p className="role-select__description">{role.description}</p>
            </button>
          ))}
        </div>
        <button className="role-select__back" onClick={logout}>
          {language === 'fr' ? 'Retour aux profils' : 'Back to profiles'}
        </button>
      </div>
    </div>
  )
}

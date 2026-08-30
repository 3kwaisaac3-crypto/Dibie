import React from 'react'
import { useAppStore } from '../stores/appStore'
import './RoleSelect.css'

export default function RoleSelect() {
  const { setRole, setCurrentPage, language } = useAppStore()

  const roles = [
    {
      id: 'student',
      title: language === 'fr' ? 'Élève' : 'Student',
      icon: '🎓',
      description: language === 'fr' ? 'Jouer et apprendre' : 'Play and learn',
      color: '#4CAF50'
    },
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
    setRole(roleId)
    
    const dashboards = {
      student: 'studentDashboard',
      teacher: 'teacherDashboard',
      parent: 'parentDashboard',
      admin: 'adminDashboard'
    }
    
    setCurrentPage(dashboards[roleId])
  }

  return (
    <div className="role-select">
      <div className="role-select__container">
        <h1 className="role-select__title">
          {language === 'fr' ? 'Bienvenue dans DIBIÈ' : 'Welcome to DIBIÈ'}
        </h1>
        <p className="role-select__subtitle">
          {language === 'fr' ? 'Sélectionnez votre profil' : 'Select your profile'}
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
      </div>
    </div>
  )
}

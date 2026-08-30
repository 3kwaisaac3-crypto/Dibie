import React, { useState } from 'react'
import { useAppStore } from '../stores/appStore'
import '../styles/TeacherDashboard.css'

export default function TeacherDashboard() {
  const { user, language, logout } = useAppStore()
  const [students] = useState([
    { id: 1, name: 'Jean', score: 150, games: 5 },
    { id: 2, name: 'Marie', score: 200, games: 8 },
    { id: 3, name: 'Pierre', score: 120, games: 3 }
  ])

  return (
    <div className="teacher-dashboard">
      <div className="teacher-dashboard__header">
        <h1>{language === 'fr' ? 'Tableau de Bord Enseignant' : 'Teacher Dashboard'}</h1>
        <button className="teacher-dashboard__logout" onClick={logout}>
          ❌
        </button>
      </div>

      <div className="teacher-dashboard__content">
        <h2>{language === 'fr' ? 'Progression des élèves' : 'Student Progress'}</h2>
        
        <table className="teacher-dashboard__table">
          <thead>
            <tr>
              <th>{language === 'fr' ? 'Élève' : 'Student'}</th>
              <th>{language === 'fr' ? 'Points' : 'Score'}</th>
              <th>{language === 'fr' ? 'Jeux joués' : 'Games Played'}</th>
            </tr>
          </thead>
          <tbody>
            {students.map(student => (
              <tr key={student.id}>
                <td>{student.name}</td>
                <td>{student.score}</td>
                <td>{student.games}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

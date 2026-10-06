import React, { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { getAllUsersWithScores } from '../db/index'
import '../styles/TeacherDashboard.css'

export default function TeacherDashboard() {
  const { language, setRole, setCurrentPage, logout } = useAppStore()
  const [students, setStudents] = useState([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const data = await getAllUsersWithScores()
      if (!cancelled) setStudents(data)
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handleBackToRoles = () => {
    setRole(null)
    setCurrentPage('roleSelect')
  }

  return (
    <div className="teacher-dashboard">
      <div className="teacher-dashboard__header">
        <h1>{language === 'fr' ? 'Tableau de Bord Enseignant' : 'Teacher Dashboard'}</h1>
        <div className="teacher-dashboard__actions">
          <button className="teacher-dashboard__back" onClick={handleBackToRoles}>
            {language === 'fr' ? 'Profil' : 'Profile'}
          </button>
          <button className="teacher-dashboard__logout" onClick={logout}>
            ❌
          </button>
        </div>
      </div>

      <div className="teacher-dashboard__content">
        <h2>{language === 'fr' ? 'Progression des élèves' : 'Student Progress'}</h2>

        {students.length === 0 ? (
          <p className="teacher-dashboard__empty">
            {language === 'fr'
              ? 'Aucune donnée pour le moment. Les résultats apparaîtront lorsque les élèves joueront.'
              : 'No data yet. Results will appear once students play.'}
          </p>
        ) : (
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
                <tr key={student.userId}>
                  <td>{student.name}</td>
                  <td>{student.score}</td>
                  <td>{student.games}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

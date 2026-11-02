import React, { useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { classesOf, createProfile, getProfiles, PROFILE_LEVELS, PROFILE_NAME_MAX } from '../db/index'
import { libelleNiveau } from '../data/niveaux'
import '../styles/Profiles.css'

// Entrée de l'application : profils locaux à pseudonyme, sans courriel ni mot
// de passe (décision d'Isaac du 2026-11-01, Q1).
export default function Profiles() {
  const { language, setLanguage, setUser, setRole, setCurrentPage } = useAppStore()
  const t = (fr, en) => (language === 'fr' ? fr : en)

  const [profiles, setProfiles] = useState(getProfiles)
  const [name, setName] = useState('')
  const [level, setLevel] = useState(PROFILE_LEVELS[0])
  const [subsystem, setSubsystem] = useState(language === 'en' ? 'en' : 'fr')
  const [className, setClassName] = useState('')
  const [error, setError] = useState(null)

  const errorMessages = {
    'name-empty': t('Écris un pseudonyme.', 'Write a nickname.'),
    'name-taken': t('Ce pseudonyme existe déjà : touche-le dans la liste.', 'This nickname already exists: tap it in the list.'),
    invalid: t('Choix de classe invalide.', 'Invalid class choice.'),
    storage: t('Impossible d\'enregistrer le profil sur cet appareil.', 'Could not save the profile on this device.')
  }

  const enter = (profile) => {
    setUser(profile)
    setRole('student')
    setCurrentPage('studentDashboard')
  }

  const handleCreate = (e) => {
    e.preventDefault()
    const result = createProfile({ name, level, class: className || null, subsystem })
    if (result.error) {
      setError(result.error)
      setProfiles(getProfiles())
      return
    }
    enter(result.profile)
  }

  const changeLevel = (value) => {
    setLevel(value)
    setClassName('')
  }

  const changeSubsystem = (value) => {
    setSubsystem(value)
    setClassName('')
  }

  return (
    <div className="profiles">
      <div className="profiles__container">
        <div className="profiles__logo">
          <h1>DIBIÈ</h1>
          <p>{t('Jeux Éducatifs Bilingues', 'Bilingual Educational Games')}</p>
        </div>

        <div className="profiles__demo-notice" role="status">
          <strong>{t('Mode démonstration', 'Demo mode')}</strong>
          <p>
            {t('Les profils sont enregistrés seulement sur cet appareil. Choisis un pseudonyme : n’écris pas ton vrai nom ni aucune donnée sensible ou réelle.',
              'Profiles are saved only on this device. Choose a nickname: do not write your real name or any sensitive or real data.')}
          </p>
        </div>

        {profiles.length > 0 && (
          <section className="profiles__section">
            <h2>{t('Qui joue ?', 'Who is playing?')}</h2>
            <div className="profiles__list">
              {profiles.map(profile => (
                <button key={profile.id} className="profiles__card" onClick={() => enter(profile)}>
                  <span className="profiles__card-name">{profile.name}</span>
                  <span className="profiles__card-level">{libelleNiveau(profile.level, language)}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <form className="profiles__section profiles__form" onSubmit={handleCreate}>
          <h2>{t('Nouveau profil', 'New profile')}</h2>

          <label htmlFor="profile-name">{t('Pseudonyme', 'Nickname')}</label>
          <input
            id="profile-name"
            type="text"
            value={name}
            maxLength={PROFILE_NAME_MAX}
            autoComplete="off"
            onChange={(e) => { setName(e.target.value); setError(null) }}
            required
          />

          <label htmlFor="profile-level">{t('Niveau', 'Level')}</label>
          <select id="profile-level" value={level} onChange={(e) => changeLevel(e.target.value)}>
            {PROFILE_LEVELS.map(l => <option key={l} value={l}>{libelleNiveau(l, language)}</option>)}
          </select>

          <label htmlFor="profile-subsystem">{t('Sous-système', 'Subsystem')}</label>
          <select id="profile-subsystem" value={subsystem} onChange={(e) => changeSubsystem(e.target.value)}>
            <option value="fr">{t('Francophone', 'French-speaking')}</option>
            <option value="en">{t('Anglophone', 'English-speaking')}</option>
          </select>

          <label htmlFor="profile-class">{t('Classe (facultatif)', 'Class (optional)')}</label>
          <select id="profile-class" value={className} onChange={(e) => setClassName(e.target.value)}>
            <option value="">{t('Non précisée', 'Not specified')}</option>
            {classesOf(level, subsystem).map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {error && <p className="profiles__error" role="alert">{errorMessages[error]}</p>}

          <button type="submit" className="profiles__create">{t('Créer et jouer', 'Create and play')}</button>
        </form>

        <button className="profiles__adult" onClick={() => setCurrentPage('roleSelect')}>
          {t('Espace adulte', 'Adult area')}
        </button>

        <div className="profiles__language">
          <button className={`profiles__lang-btn ${language === 'fr' ? 'active' : ''}`} onClick={() => setLanguage('fr')}>
            🇫🇷 Français
          </button>
          <button className={`profiles__lang-btn ${language === 'en' ? 'active' : ''}`} onClick={() => setLanguage('en')}>
            🇬🇧 English
          </button>
        </div>
      </div>
    </div>
  )
}

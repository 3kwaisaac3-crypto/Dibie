// Défaut n° 1 de l'audit : le score doit rester rattaché à un profil stable,
// après un retour, un rechargement et un nouveau choix du profil.
import { test, expect } from '@playwright/test'
import { connecterEleve, creerProfil, choisirProfil, ouvrirEspaceAdulte, jouerMotsMeles, totalAffiche, suivreErreurs } from './outils.js'

test('Partie, total au tableau de bord, rechargement, retour aux profils, score conservé', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Etoile', niveau: 'SIL-CP' })
  await expect(page.locator('.student-dashboard__level')).toHaveText('SIL-CP')
  await totalAffiche(page, 0)

  const mots = await jouerMotsMeles(page)
  const points = mots * 10
  await expect(page.locator('.wordsearch-finished__score')).toHaveText(String(points))

  // Q2 : « Retour » de l'écran de fin mène au tableau de bord, profil conservé
  await page.locator('.wordsearch-select__back').click()
  await expect(page.locator('.student-dashboard__user')).toContainText('Etoile')
  await totalAffiche(page, points)

  // Rechargement : session conservée, pas de page vide
  await page.reload()
  await expect(page.locator('.student-dashboard__user')).toContainText('Etoile')
  await totalAffiche(page, points)

  // Retour aux profils par le bouton « Profil », puis même profil
  await page.locator('.student-dashboard__back').click()
  await expect(page.locator('.profiles__card')).toHaveCount(1)
  await choisirProfil(page, 'Etoile')
  await totalAffiche(page, points)

  // Déconnexion, même profil, seconde partie : le total se cumule
  await page.locator('.student-dashboard__logout').click()
  await choisirProfil(page, 'Etoile')
  await jouerMotsMeles(page, '777')
  await page.locator('.wordsearch-select__back').click()
  await totalAffiche(page, points * 2)
  expect(erreurs, erreurs.join('\n')).toEqual([])
})

test('Deux profils : scores séparés ; tableau enseignant avec noms et ancien profil', async ({ page }) => {
  await connecterEleve(page, { pseudo: 'Lune' })
  await jouerMotsMeles(page)
  await page.locator('.wordsearch-select__back').click()
  await page.locator('.student-dashboard__back').click()

  await creerProfil(page, { pseudo: 'Soleil' })
  await expect(page.locator('.student-dashboard__user')).toContainText('Soleil')
  await totalAffiche(page, 0)
  await page.locator('.student-dashboard__back').click()

  // Score d'une version précédente, à identifiant aléatoire : conservé
  await page.evaluate(() => {
    const scores = JSON.parse(localStorage.getItem('dibieScores'))
    scores.push({ userId: 'ancien9x', gameType: 'crossword', score: 20, niveau: 'SIL-CP', date: new Date().toISOString() })
    localStorage.setItem('dibieScores', JSON.stringify(scores))
  })
  await ouvrirEspaceAdulte(page)
  await page.getByRole('button', { name: /Enseignant/ }).click()
  const lignes = page.locator('.teacher-dashboard__table tbody tr')
  await expect(lignes).toHaveCount(2)
  await expect(lignes.filter({ hasText: 'Lune' })).toHaveCount(1)
  await expect(lignes.filter({ hasText: 'Ancien profil' })).toContainText('20')
})

test('Retour de l\'écran de choix : tableau de bord, dans les deux jeux, sans déconnexion', async ({ page }) => {
  await connecterEleve(page, { pseudo: 'Comete', niveau: 'CE1-CE2' })

  await page.getByRole('button', { name: /Mots Croisés/ }).click()
  // Niveau par défaut lu dans le profil
  await expect(page.locator('.crossword-select').getByRole('button', { name: 'CE1-CE2', exact: true })).toHaveClass(/active/)
  await page.locator('.crossword-select__back').click()
  await expect(page.locator('.student-dashboard__user')).toContainText('Comete')

  await page.getByRole('button', { name: /Mots Mêlés/ }).click()
  await expect(page.getByRole('button', { name: /CE1-CE2/ })).toHaveAttribute('aria-pressed', 'true')
  await page.locator('.wordsearch-select__back').click()
  await expect(page.locator('.student-dashboard__user')).toContainText('Comete')
})

test('Rechargement dans un jeu : écran de choix du jeu, pas de page vide', async ({ page }) => {
  await connecterEleve(page, { niveau: 'CM1-CM2' })
  await page.getByRole('button', { name: /Mots Croisés/ }).click()
  await page.reload()
  await expect(page.locator('.crossword-select')).toBeVisible()
  await expect(page.locator('.crossword-select').getByRole('button', { name: 'CM1-CM2', exact: true })).toHaveClass(/active/)
  await expect(page.getByRole('button', { name: 'Commencer' })).toBeEnabled()

  await page.locator('.crossword-select__back').click()
  await page.getByRole('button', { name: /Mots Mêlés/ }).click()
  await page.reload()
  await expect(page.locator('.wordsearch-select')).toBeVisible()
  await page.locator('.wordsearch-select__start').click()
  await expect(page.locator('.wordsearch-game')).toBeVisible()
})

test('Espace adulte perdu au rechargement, langue conservée, question reposée', async ({ page }) => {
  await page.goto('/')
  await ouvrirEspaceAdulte(page)
  await page.getByRole('button', { name: /Administrateur/ }).click()
  await expect(page.getByRole('heading', { name: 'Importer Vocabulaire' })).toBeVisible()
  await page.getByRole('button', { name: 'English' }).click()
  await page.reload()
  await expect(page.locator('.profiles')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Import Vocabulary' })).toHaveCount(0)
  await expect(page.locator('.profiles__adult')).toHaveText('Adult area')
  await page.locator('.profiles__adult').click()
  await expect(page.getByRole('button', { name: /Administrator/ })).toHaveCount(0)
  await expect(page.locator('.role-select__gate')).toBeVisible()
})

test('Session adulte enregistrée avant la règle : retour aux profils au rechargement', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('dibieSession', JSON.stringify({
    state: {
      user: { id: 'adulte', name: 'Adulte', isAdult: true },
      isAuthenticated: true,
      language: 'fr',
      role: 'admin',
      currentPage: 'adminDashboard'
    },
    version: 1
  })))
  await page.reload()
  await expect(page.locator('.profiles')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Administration' })).toHaveCount(0)
})

test('Espace adulte : déconnexion, retour aux profils', async ({ page }) => {
  await page.goto('/')
  await ouvrirEspaceAdulte(page)
  await page.getByRole('button', { name: /Administrateur/ }).click()
  await page.getByRole('button', { name: 'Déconnexion' }).click()
  await expect(page.locator('.profiles')).toBeVisible()
})

test('Session restaurée sans profil, ou illisible : écran des profils, jamais de page vide', async ({ page }) => {
  await connecterEleve(page, { pseudo: 'Disparu' })
  await page.evaluate(() => localStorage.removeItem('dibieProfiles'))
  await page.reload()
  await expect(page.locator('.profiles')).toBeVisible()
  await expect(page.locator('.profiles__card')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('dibieSession')).state.isAuthenticated)).toBe(false)

  await page.evaluate(() => localStorage.setItem('dibieSession', '{illisible'))
  await page.reload()
  await expect(page.locator('.profiles')).toBeVisible()

  // Page conservée inconnue, session valide : tableau de bord
  await creerProfil(page, { pseudo: 'Revenu' })
  await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('dibieSession'))
    session.state.currentPage = 'login'
    localStorage.setItem('dibieSession', JSON.stringify(session))
  })
  await page.reload()
  await expect(page.locator('.student-dashboard')).toBeVisible()
})

test('Page d\'administration conservée : ni un élève ni un non-connecté ne l\'atteint', async ({ page }) => {
  const pageConservee = (authentifie) => page.evaluate(a => {
    const session = JSON.parse(localStorage.getItem('dibieSession'))
    session.state.currentPage = 'adminDashboard'
    session.state.role = 'admin'
    session.state.isAuthenticated = a
    if (!a) session.state.user = null
    localStorage.setItem('dibieSession', JSON.stringify(session))
  }, authentifie)

  await connecterEleve(page, { pseudo: 'Curieux' })
  await pageConservee(true)
  await page.reload()
  await expect(page.locator('.student-dashboard')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Administration' })).toHaveCount(0)

  await pageConservee(false)
  await page.reload()
  await expect(page.locator('.profiles')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Administration' })).toHaveCount(0)
})

test('Stockage plein : pas de page vide, l\'application reste utilisable', async ({ page }) => {
  const erreurs = []
  page.on('pageerror', e => erreurs.push(e.message))
  await page.goto('/')
  // Tout est refusé : langue utilisable, profil refusé avec un message
  await page.evaluate(() => {
    window.setItemOriginal = Storage.prototype.setItem
    Storage.prototype.setItem = () => { throw new DOMException('Stockage plein', 'QuotaExceededError') }
  })
  await page.getByRole('button', { name: /English/ }).click()
  await expect(page.locator('.profiles__demo-notice')).toContainText('Demo mode')
  await page.getByRole('button', { name: /Français/ }).click()
  await page.getByLabel('Pseudonyme').fill('Plein')
  await page.getByRole('button', { name: 'Créer et jouer' }).click()
  await expect(page.locator('.profiles__error')).toBeVisible()

  // Seule la session est refusée : le profil entre quand même
  await page.evaluate(() => {
    Storage.prototype.setItem = function (cle, valeur) {
      if (cle === 'dibieSession') throw new DOMException('Stockage plein', 'QuotaExceededError')
      return window.setItemOriginal.call(this, cle, valeur)
    }
  })
  await page.getByRole('button', { name: 'Créer et jouer' }).click()
  await expect(page.locator('.student-dashboard')).toBeVisible()
  await page.getByRole('button', { name: 'Déconnexion' }).click()
  await expect(page.locator('.profiles')).toBeVisible()
  expect(erreurs, erreurs.join('\n')).toEqual([])
})

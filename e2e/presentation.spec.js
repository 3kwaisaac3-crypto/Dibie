// Présentation sur ordinateur, tablette et téléphone.
import { test, expect } from '@playwright/test'
import { connecterEleve, ouvrirMotsCroises, choisir } from './outils.js'

async function pasDeDefilementHorizontal(page) {
  // .app masque ce qui dépasse : la largeur de la page ne suffit pas, on regarde
  // aussi chaque élément. Le texte réservé aux lecteurs d'écran est exclu.
  const { large, ecran, depassent } = await page.evaluate(() => ({
    large: document.documentElement.scrollWidth,
    ecran: innerWidth,
    depassent: [...document.querySelectorAll('.app *')]
      .filter(e => !e.closest('.wordsearch-sr-only') && e.getBoundingClientRect().right > innerWidth + 1)
      .map(e => e.tagName + '.' + e.className)
      .slice(0, 5)
  }))
  expect(large, `page de ${large} px pour un écran de ${ecran} px`).toBeLessThanOrEqual(ecran + 1)
  expect(depassent, `éléments au-delà de ${ecran} px`).toEqual([])
}

// Anomalie A-02 (audit 2026-10-29), corrigée : sur téléphone et tablette, le
// sélecteur de langue recouvrait le contenu.
async function selecteurSansChevauchement(page, selecteurContenu) {
  const recouverts = await page.evaluate(contenu => {
    const s = document.querySelector('.global-language-toggle').getBoundingClientRect()
    return [...document.querySelectorAll(contenu)]
      .filter(e => {
        const r = e.getBoundingClientRect()
        return r.left < s.right && r.right > s.left && r.top < s.bottom && r.bottom > s.top
      })
      .map(e => e.textContent.trim().slice(0, 40))
  }, selecteurContenu)
  expect(recouverts).toEqual([])
}

test('Connexion et tableau de bord : pas de débordement horizontal', async ({ page }) => {
  await page.goto('/')
  await pasDeDefilementHorizontal(page)
  await page.screenshot({ path: test.info().outputPath('connexion.png'), fullPage: true })
  await connecterEleve(page)
  await pasDeDefilementHorizontal(page)
  await page.screenshot({ path: test.info().outputPath('tableau-de-bord.png'), fullPage: true })
})

test('Écran de choix des mots croisés : pas de débordement horizontal', async ({ page }) => {
  await ouvrirMotsCroises(page)
  await pasDeDefilementHorizontal(page)
  await page.screenshot({ path: test.info().outputPath('choix.png'), fullPage: true })
})

// Anomalie A-01 (audit 2026-10-29), corrigée : sur téléphone, la grille
// dépassait la largeur de l'écran. 320 px : plus petit téléphone courant.
test('Grille de mots croisés entièrement visible en largeur', async ({ page }) => {
  await grilleVisibleEnLargeur(page)
})

test('Grille entièrement visible en largeur sur un petit téléphone (320 px)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await grilleVisibleEnLargeur(page)
})

test('Sélecteur de langue : ne recouvre pas le contenu sur petit écran', async ({ page }, info) => {
  test.skip(info.project.name === 'ordinateur', 'sélecteur fixé dans le coin sur ordinateur, voulu')
  await ouvrirMotsCroises(page)
  await selecteurSansChevauchement(page, '.crossword-select button, .crossword-select input, .crossword-select label')
  await choisir(page, { type: 'Français', niveau: 'CM1-CM2', sujet: 'Digestion' })
  await page.getByRole('button', { name: 'Commencer' }).click()
  await expect(page.locator('.eclipse-board')).toBeVisible()
  await selecteurSansChevauchement(page, '.eclipse-board, .clues-col h3, .clue, .eclipse-back-btn')
})

test('Mots mêlés : pas de débordement horizontal', async ({ page }) => {
  await connecterEleve(page)
  await page.getByRole('button', { name: /Mots Mêlés/ }).click()
  await page.locator('.wordsearch-select__start').click()
  await expect(page.locator('.wordsearch-game')).toBeVisible()
  await pasDeDefilementHorizontal(page)
})

test('Hors ligne : le sélecteur de langue reste utilisable', async ({ page, context }) => {
  await connecterEleve(page)
  await context.setOffline(true)
  await expect(page.locator('.offline-banner')).toBeVisible()
  await page.getByRole('button', { name: 'English' }).click()
  await expect(page.locator('.global-lang-btn.active')).toContainText('EN')
  await context.setOffline(false)
})

// Anomalie A-03 (audit 2026-10-29), corrigée : le bouton était très loin sous
// la liste des sujets.
test('Bouton Commencer visible sans défiler sur petit écran', async ({ page }, info) => {
  test.skip(info.project.name === 'ordinateur', 'bouton sous la liste sur ordinateur, voulu')
  await ouvrirMotsCroises(page)
  const choix = page.locator('.crossword-select')
  await choix.getByRole('button', { name: 'CM1-CM2', exact: true }).click()
  await expect(page.locator('.crossword-select__grid button').first()).toBeVisible()
  const bouton = page.getByRole('button', { name: 'Commencer' })
  await expect(bouton).toBeInViewport({ ratio: 1 })
  await page.evaluate(() => window.scrollTo(0, 400))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await expect(bouton).toBeInViewport({ ratio: 1 })
})

// Anomalie A-04 (audit 2026-10-29), corrigée : pas d'icône, /favicon.ico en 404.
test('Icône du site déclarée et disponible', async ({ page, request }) => {
  await page.goto('/')
  const adresse = await page.locator('link[rel="icon"]').getAttribute('href')
  const reponse = await request.get(adresse)
  expect(reponse.status()).toBe(200)
  // Le serveur de développement répond 200 même pour un fichier absent
  expect(reponse.headers()['content-type']).toContain('image/svg+xml')
  expect(await reponse.text()).toContain('<svg')
})

async function grilleVisibleEnLargeur(page) {
  await ouvrirMotsCroises(page)
  await choisir(page, { type: 'Français', niveau: 'CM1-CM2', sujet: 'Digestion' })
  await page.getByRole('button', { name: 'Commencer' }).click()
  const grille = page.locator('.eclipse-board')
  await expect(grille).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('grille.png'), fullPage: true })
  const { gauche, droite, ecran } = await grille.evaluate(el => {
    const r = el.getBoundingClientRect()
    return { gauche: r.left, droite: r.right, ecran: innerWidth }
  })
  expect(gauche).toBeGreaterThanOrEqual(0)
  expect(droite, `grille jusqu'à ${Math.round(droite)} px pour ${ecran} px`).toBeLessThanOrEqual(ecran)
  await pasDeDefilementHorizontal(page)
}

// Présentation sur ordinateur, tablette et téléphone.
import { test, expect } from '@playwright/test'
import { connecterEleve, ouvrirMotsCroises, choisir } from './outils.js'

async function pasDeDefilementHorizontal(page) {
  // .app masque ce qui dépasse (overflow-x: hidden) : son scrollWidth compte aussi
  const { large, ecran } = await page.evaluate(() => ({
    large: Math.max(document.documentElement.scrollWidth, document.querySelector('.app')?.scrollWidth ?? 0),
    ecran: innerWidth
  }))
  expect(large, `page de ${large} px pour un écran de ${ecran} px`).toBeLessThanOrEqual(ecran + 1)
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

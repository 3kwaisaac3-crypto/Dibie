// Parcours critiques des mots croisés, sur les trois tailles d'écran.
import { test, expect } from '@playwright/test'
import { ouvrirMotsCroises, choisir, controlerGrille, suivreErreurs, TYPES } from './outils.js'

const PARCOURS = [
  { niveau: 'CM1-CM2', sujet: 'Digestion' },
  { niveau: 'CM1-CM2', sujet: 'Comparaison' }
]

for (const { niveau, sujet } of PARCOURS) {
  for (const type of TYPES) {
    test(`${sujet} (${niveau}, ${type}) : grille visible et cohérente`, async ({ page }) => {
      const erreurs = suivreErreurs(page)
      await ouvrirMotsCroises(page)
      await choisir(page, { type, niveau, sujet })
      await page.getByRole('button', { name: 'Commencer' }).click()

      await expect(page.locator('.eclipse-board')).toBeVisible()
      await expect(page.locator('.eclipse-header')).toContainText(`Mots croisés — ${sujet.toUpperCase()}`)
      await expect(page.locator('.crossword-game__header')).toContainText(`${niveau} (${type})`)

      const { mots, anomalies } = await controlerGrille(page, { type, niveau, sujet })
      expect(anomalies, anomalies.join('\n')).toEqual([])
      expect(mots).toBeGreaterThanOrEqual(2)
      await expect(page.locator('.crossword-game__progress')).toContainText(`0 / ${mots}`)
      expect(erreurs, erreurs.join('\n')).toEqual([])
    })
  }
}

test('Saisie : accent retiré, avance automatique, effacement', async ({ page }) => {
  await ouvrirMotsCroises(page)
  await choisir(page, { type: 'Français', niveau: 'CM1-CM2', sujet: 'Digestion' })
  await page.getByRole('button', { name: 'Commencer' }).click()

  const premiere = page.locator('.eclipse-input').first()
  await premiere.click()
  // Frappe à vitesse humaine (voir le rapport d'audit : une rafale de touches
  // sans délai peut perdre des lettres)
  await page.keyboard.type('éb', { delay: 120 })
  const remplies = await page.locator('.eclipse-input').evaluateAll(els => els.filter(e => e.value).map(e => e.value))
  expect(remplies).toEqual(['E', 'B'])

  await page.keyboard.press('Backspace')
  const apres = await page.locator('.eclipse-input').evaluateAll(els => els.filter(e => e.value).map(e => e.value))
  expect(apres).toEqual(['E'])
})

test('Boutons : nouvelle grille avec confirmation, retour au choix', async ({ page }) => {
  await ouvrirMotsCroises(page)
  await choisir(page, { type: 'Bilingue', niveau: 'CM1-CM2', sujet: 'Comparaison' })
  await page.getByRole('button', { name: 'Commencer' }).click()
  const numero1 = await page.locator('.crossword-game__seed').textContent()

  await page.locator('.eclipse-input').first().click()
  await page.keyboard.type('a', { delay: 120 })
  await page.getByRole('button', { name: 'Nouvelle grille' }).click()
  const dialogue = page.getByRole('alertdialog')
  await expect(dialogue).toBeVisible()
  await dialogue.getByRole('button', { name: 'Non, continuer' }).click()
  await expect(dialogue).toBeHidden()
  await expect(page.locator('.crossword-game__seed')).toHaveText(numero1)

  await page.getByRole('button', { name: 'Nouvelle grille' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Oui, nouvelle grille' }).click()
  await expect(page.locator('.crossword-game__seed')).not.toHaveText(numero1)
  expect(await page.locator('.eclipse-input').evaluateAll(els => els.every(e => !e.value))).toBe(true)

  await page.locator('.eclipse-back-btn').click()
  await expect(page.locator('.crossword-select')).toBeVisible()
  await expect(page.locator('.crossword-select__grid button.active')).toHaveText(/^Comparaison/)
})

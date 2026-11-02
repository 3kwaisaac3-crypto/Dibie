// Mots mêlés : les mots à chercher suivent la langue de l'interface (anomalie
// constatée par Isaac sur téléphone le 2026-11-02).
import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { connecterEleve } from './outils.js'

const vocabulaire = JSON.parse(readFileSync(new URL('../src/data/vocabulaire.json', import.meta.url), 'utf8'))
const anglais = new Set(vocabulaire.map(v => v.mot_en.split('/')[0].trim().toUpperCase()))
const francais = new Set(vocabulaire.map(v => v.mot_fr))

async function lancer(page, champ, numero) {
  await page.getByLabel(champ).fill(numero)
  await page.locator('.wordsearch-select__start').click()
  await expect(page.locator('.wordsearch-game')).toBeVisible()
  return page.locator('.wordsearch-words li').allTextContents()
}

test('Interface en anglais : mots à chercher en anglais ; en français : mots en français', async ({ page }) => {
  await connecterEleve(page, { pseudo: 'Bilingue' })
  await page.getByRole('button', { name: /Mots Mêlés/ }).click()

  await page.getByRole('button', { name: 'English' }).click()
  const motsEn = await lancer(page, 'Grid number (optional)', '12345')
  expect(motsEn.length).toBeGreaterThan(0)
  for (const mot of motsEn) expect(anglais.has(mot), mot).toBe(true)
  expect(motsEn.some(mot => !francais.has(mot))).toBe(true)
  await expect(page.locator('.wordsearch-game__help')).toContainText('Tap the first letter')

  await page.locator('.wordsearch-game__btn--secondary').click()
  await page.getByRole('button', { name: 'Français' }).click()
  const motsFr = await lancer(page, 'Numéro de grille (facultatif)', '12345')
  for (const mot of motsFr) expect(francais.has(mot), mot).toBe(true)
  expect(motsFr).not.toEqual(motsEn)
})

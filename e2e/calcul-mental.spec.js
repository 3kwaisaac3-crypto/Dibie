// Calcul mental (phase 7, lot B ; docs/calcul-mental.md) : série complète en
// CE1 (mélange), erreurs, indice, « Voir la réponse » et reprise, élève de
// SIL (calculs sans mots), élève anglophone (Class 4), profil sans classe,
// double toucher sur « Suivant », affichage à 375 et 320 px.
// La série attendue est calculée par le module pur (src/utils/mentalMath.js) :
// l'écran doit montrer la même.
import { test, expect } from '@playwright/test'
import { suivreErreurs } from './outils.js'
import { createMentalSeries, calcText, calcHint, solvedText, MIXED } from '../src/utils/mentalMath.js'

async function creerProfilComplet(page, { pseudo, niveau, sousSysteme = 'fr', classe = '' }) {
  await page.goto('/')
  await page.getByLabel('Pseudonyme').fill(pseudo)
  await page.getByLabel('Niveau').selectOption(niveau)
  await page.getByLabel('Sous-système').selectOption(sousSysteme)
  await page.getByLabel('Classe (facultatif)').selectOption(classe)
  await page.getByRole('button', { name: 'Créer et jouer' }).click()
  await expect(page.getByRole('button', { name: /Calcul mental/ })).toBeVisible()
}

const lireScores = (page) => page.evaluate(() =>
  (JSON.parse(localStorage.getItem('dibieScores')) || []).filter(s => s.gameType === 'mentalMath'))
const deborde = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

async function lancer(page, { numero, famille = null, fr = true }) {
  await page.getByRole('button', { name: fr ? /Calcul mental/ : /Mental maths/ }).click()
  if (famille) await page.locator('.mm-family', { hasText: famille }).click()
  await page.getByLabel(fr ? 'Numéro de partie (facultatif)' : 'Game number (optional)').fill(String(numero))
  await page.locator('.mm-start').click()
  await expect(page.locator('.mm-calc')).toBeVisible()
}

// Juste après « Suivant », les touchers sont ignorés pendant un court délai
async function toucher(cible, effet) {
  await expect(async () => {
    await cible.click()
    await effet()
  }).toPass()
}

const touche = (page, chiffre) => page.locator('.number-pad').getByRole('button', { name: chiffre, exact: true })
async function taper(page, nombre, fr = true) {
  const chiffres = String(nombre).split('')
  await toucher(touche(page, chiffres[0]), () => expect(page.locator('.mm-entry')).toHaveText(chiffres[0], { timeout: 300 }))
  for (const c of chiffres.slice(1)) await touche(page, c).click()
  await page.getByRole('button', { name: fr ? 'Valider' : 'Check' }).click()
}
const suivant = (page, fr = true) => page.getByRole('button', { name: fr ? 'Suivant' : 'Next' }).click()
const ESSAIE = 'Ce n\'est pas ça. Essaie encore.'

test('Série CE1 (mélange), toutes justes : classe rappelée, score enregistré une seule fois', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await creerProfilComplet(page, { pseudo: 'Calcul CE1', niveau: 'CE1-CE2', classe: 'CE1' })
  const numero = 4242
  const serie = createMentalSeries('CE1', MIXED, numero)
  await page.getByRole('button', { name: /Calcul mental/ }).click()
  await expect(page.locator('.mm-class-line')).toHaveText('Réglé pour : CE1 (sous-système francophone).')
  await expect(page.locator('.mm-demo')).toContainText('Démonstration')
  await page.locator('.anagram-select__back').click()
  await lancer(page, { numero })
  for (const [i, c] of serie.calcs.entries()) {
    await expect(page.locator('.mm-progress')).toHaveText(`Calcul ${i + 1} / 10`)
    await expect(page.locator('.mm-calc')).toHaveText(calcText(c, 'fr'))
    await expect(page.locator('.mm-next')).toBeDisabled()
    await taper(page, c.answer)
    await expect(page.locator('.mm-message')).toHaveText('Bravo !')
    await suivant(page)
  }
  await expect(page.locator('.mm-score')).toHaveText('100')
  await expect(page.locator('.mm-recap li')).toHaveCount(10)
  const scores = await lireScores(page)
  expect(scores).toHaveLength(1)
  expect(scores[0]).toMatchObject({ score: 100, className: 'CE1', subsystem: 'fr', family: 'mix', seed: numero, calcCount: 10, foundCount: 10, revealedCount: 0, errorCount: 0 })
  expect(erreurs).toEqual([])
})

test('Erreurs : indice après 2, « Voir la réponse » après 3, reprise sans points', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await creerProfilComplet(page, { pseudo: 'Calcul aides', niveau: 'CE1-CE2', classe: 'CE1' })
  const numero = 77
  const serie = createMentalSeries('CE1', 'F', numero)
  await lancer(page, { numero, famille: 'Tables' })
  const [premier, ...autres] = serie.calcs
  await taper(page, premier.answer + 1)
  await expect(page.locator('.mm-message')).toHaveText(ESSAIE)
  await expect(page.locator('.mm-hint')).toHaveCount(0)
  await taper(page, premier.answer + 1)
  await expect(page.locator('.mm-hint')).toHaveText(calcHint(premier, 'fr'))
  await expect(page.getByRole('button', { name: 'Voir la réponse' })).toHaveCount(0)
  await taper(page, premier.answer + 1)
  await page.getByRole('button', { name: 'Voir la réponse' }).click()
  await expect(page.locator('.mm-message')).toHaveText(solvedText(premier, 'fr'))
  await suivant(page)
  for (const c of autres) {
    await taper(page, c.answer)
    await suivant(page)
  }
  await expect(page.locator('.mm-retry')).toBeVisible()
  await expect(page.locator('.mm-calc')).toHaveText(calcText(premier, 'fr'))
  await taper(page, premier.answer)
  await suivant(page)
  await expect(page.locator('.mm-score')).toHaveText('90')
  expect((await lireScores(page))[0]).toMatchObject({ score: 90, foundCount: 9, revealedCount: 1, errorCount: 3 })
  expect(erreurs).toEqual([])
})

test('Élève de SIL : familles de la classe, calculs sans mots', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await creerProfilComplet(page, { pseudo: 'Calcul SIL', niveau: 'SIL-CP', classe: 'SIL' })
  await page.getByRole('button', { name: /Calcul mental/ }).click()
  await expect(page.locator('.mm-family')).toHaveText(['Mélange de la classe', 'Additions', 'Soustractions', 'Compléments', 'Tables'])
  await page.locator('.anagram-select__back').click()
  const serie = createMentalSeries('SIL', MIXED, 5)
  await lancer(page, { numero: 5 })
  for (const c of serie.calcs) {
    await expect(page.locator('.mm-calc')).toHaveText(calcText(c, 'fr'))
    expect(await page.locator('.mm-calc').textContent()).not.toMatch(/[A-Za-zÀ-ÖØ-öø-ÿ]/) // lettres, sans × (U+00D7) ni ÷ (U+00F7)
    await taper(page, c.answer)
    await suivant(page)
  }
  await expect(page.locator('.mm-score')).toHaveText('100')
  expect(erreurs).toEqual([])
})

test('Élève anglophone (Class 4), interface en anglais', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await creerProfilComplet(page, { pseudo: 'Mental Class 4', niveau: 'CE1-CE2', sousSysteme: 'en', classe: 'Class 4' })
  await page.getByRole('button', { name: 'English' }).click()
  await page.getByRole('button', { name: /Mental maths/ }).click()
  await expect(page.locator('.mm-class-line')).toHaveText('Set for: Class 4 (English-speaking subsystem).')
  await page.locator('.anagram-select__back').click()
  const serie = createMentalSeries('Class 4', 'D', 12)
  await lancer(page, { numero: 12, famille: 'Doubles and halves', fr: false })
  for (const c of serie.calcs) {
    await expect(page.locator('.mm-calc')).toHaveText(calcText(c, 'en'))
    await taper(page, c.answer, false)
    await expect(page.locator('.mm-message')).toHaveText('Well done!')
    await suivant(page, false)
  }
  expect((await lireScores(page))[0]).toMatchObject({ className: 'Class 4', subsystem: 'en', family: 'D' })
  expect(erreurs).toEqual([])
})

test('Profil sans classe : classe par défaut annoncée, le jeu fonctionne', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await creerProfilComplet(page, { pseudo: 'Calcul sans classe', niveau: 'CE1-CE2' })
  await page.getByRole('button', { name: /Calcul mental/ }).click()
  await expect(page.locator('.mm-class-line')).toHaveText('Réglé pour : CE1 (sous-système francophone), classe par défaut : le profil n\'a pas de classe.')
  await page.locator('.anagram-select__back').click()
  const [c] = createMentalSeries('CE1', MIXED, 3).calcs
  await lancer(page, { numero: 3 })
  await taper(page, c.answer)
  await expect(page.locator('.mm-message')).toHaveText('Bravo !')
  expect(erreurs).toEqual([])
})

test('Double toucher sur « Suivant » : le calcul suivant reste sans saisie', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await creerProfilComplet(page, { pseudo: 'Calcul double', niveau: 'CE1-CE2', classe: 'CE1' })
  const [c] = createMentalSeries('CE1', MIXED, 9).calcs
  await lancer(page, { numero: 9 })
  await taper(page, c.answer)
  const boite = await page.locator('.mm-next').boundingBox()
  await page.locator('.mm-next').click()
  await expect(page.locator('.mm-progress')).toHaveText('Calcul 2 / 10')
  for (const fx of [0.15, 0.5, 0.85]) {
    for (const fy of [0.25, 0.75]) await page.mouse.click(boite.x + boite.width * fx, boite.y + boite.height * fy)
  }
  await expect(page.locator('.mm-progress')).toHaveText('Calcul 2 / 10')
  await expect(page.locator('.mm-entry')).toHaveText('')
  await expect(page.locator('.mm-message')).toHaveText('')
  expect(erreurs).toEqual([])
})

for (const largeur of [375, 320]) {
  test(`Téléphone ${largeur} px : grands nombres (CM2, famille G) sans débordement, touches ≥ 44 px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 700 })
    await creerProfilComplet(page, { pseudo: `Tel calcul ${largeur}`, niveau: 'CM1-CM2', classe: 'CM2' })
    const serie = createMentalSeries('CM2', 'G', 1)
    await lancer(page, { numero: 1, famille: '× et ÷' })
    for (const c of serie.calcs) {
      await expect(page.locator('.mm-calc')).toHaveText(calcText(c, 'fr'))
      expect(await deborde(page)).toBe(false)
      const hauteurs = await page.locator('.number-pad__key').evaluateAll(els => els.map(e => e.getBoundingClientRect().height))
      expect(hauteurs.every(h => h >= 44)).toBe(true)
      await taper(page, c.answer)
      expect(await deborde(page)).toBe(false)
      await suivant(page)
    }
    await expect(page.locator('.mm-score')).toBeVisible()
    expect(await deborde(page)).toBe(false)
  })
}

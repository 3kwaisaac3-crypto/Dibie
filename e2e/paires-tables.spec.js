// Mémoire des tables de multiplication (M7, lot B de la phase 4, moteur C
// « Paires ») : partie complète réglée par la classe du profil (toutes les
// tables mêlées), option « une seule table », Class 1-2 sans table (message),
// téléphone 320 px sans débordement.
// La partie attendue est calculée par le module pur (src/utils/pairsGame.js).
import { test, expect } from '@playwright/test'
import { suivreErreurs, totalAffiche } from './outils.js'
import { createMultiplicationMemoryGame } from '../src/utils/pairsGame.js'

const cartes = (page) => page.locator('.memory-card')
const indices = (p, id) => p.cards.map((c, i) => (c.pairId === id ? i : -1)).filter(i => i >= 0)
const deborde = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

// Crée un profil avec sous-système et classe, puis ouvre le tableau de bord
async function creerProfilComplet(page, { pseudo, niveau, sousSysteme = 'fr', classe = '' }) {
  await page.goto('/')
  await page.getByLabel('Pseudonyme').fill(pseudo)
  await page.getByLabel('Niveau').selectOption(niveau)
  await page.getByLabel('Sous-système').selectOption(sousSysteme)
  await page.getByLabel('Classe (facultatif)').selectOption(classe)
  await page.getByRole('button', { name: 'Créer et jouer' }).click()
  await expect(page.getByRole('button', { name: /Mémoire des tables/ })).toBeVisible()
}

async function trouverTout(page, attendue, deja = []) {
  for (const p of attendue.pairs) {
    if (deja.includes(p.id)) continue
    const [a, b] = indices(attendue, p.id)
    await cartes(page).nth(a).click()
    await cartes(page).nth(b).click()
    await expect(cartes(page).nth(a)).toBeDisabled()
  }
}

test('Partie complète en CE1 : toutes les tables de la classe mêlées, produits distincts, score et faits enregistrés', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await creerProfilComplet(page, { pseudo: 'Tables CE1', niveau: 'CE1-CE2', classe: 'CE1' })
  const numero = 2024
  const attendue = createMultiplicationMemoryGame({ className: 'CE1', subsystem: 'fr', seed: numero })
  expect(new Set(attendue.pairs.map(p => p.product)).size).toBe(6)
  await page.getByRole('button', { name: /Mémoire des tables/ }).click()
  await expect(page.getByTestId('tables-class')).toHaveText('CE1-CE2 · Réglé pour : CE1 (sous-système francophone).')
  await expect(page.locator('.anagram-select__btn', { hasText: 'Toutes mes tables' })).toContainText('1, 2, 3, 4, 5')
  await page.getByLabel('Numéro de partie (facultatif)').fill(String(numero))
  await page.locator('.anagram-select__start').click()
  await expect(cartes(page)).toHaveCount(12)
  await expect(page.locator('.anagram-game__seed')).toHaveText(`Partie n° ${numero} · tables 1, 2, 3, 4, 5 · CE1`)

  // Cartes affichées une à une = cartes attendues
  for (let i = 0; i < attendue.cards.length; i += 2) {
    const c1 = attendue.cards[i]
    const c2 = attendue.cards[i + 1]
    await cartes(page).nth(i).click()
    await cartes(page).nth(i + 1).click()
    const t1 = attendue.pairs.find(p => p.id === c1.pairId).sides[c1.side].text
    const t2 = attendue.pairs.find(p => p.id === c2.pairId).sides[c2.side].text
    await expect(cartes(page).nth(i).locator('.memory-card__text')).toHaveText(t1)
    await expect(cartes(page).nth(i + 1).locator('.memory-card__text')).toHaveText(t2)
    // Refermer tout de suite (toucher une des deux) si ce n'est pas une paire
    if (c1.pairId !== c2.pairId) await cartes(page).nth(i).click()
  }
  const dejaTrouvees = []
  for (let i = 0; i < attendue.cards.length; i += 2) {
    if (attendue.cards[i].pairId === attendue.cards[i + 1].pairId) dejaTrouvees.push(attendue.cards[i].pairId)
  }
  await trouverTout(page, attendue, dejaTrouvees)
  // 6 coups de lecture, puis un coup par paire restante
  const coups = 6 + (6 - dejaTrouvees.length)
  await expect(page.locator('.anagram-game__progress')).toHaveText(`Paires 6 / 6 · 60 points · Coups : ${coups}`)
  const p0 = attendue.pairs.find(p => p.id === (dejaTrouvees[0] ?? attendue.pairs[0].id))
  await expect(page.locator('.memory-found')).toContainText(`${p0.table} × ${p0.factor} = ${p0.product}`)
  await page.getByRole('button', { name: 'Terminer' }).click()
  await expect(page.locator('.anagram-finished__score')).toHaveText('60')

  const scores = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieScores')))
  expect(scores.filter(s => s.gameType === 'pairsMultiplication')).toHaveLength(1)
  expect(scores.at(-1)).toMatchObject({
    gameType: 'pairsMultiplication', score: 60, niveau: 'CE1-CE2', seed: numero, language: 'fr',
    className: 'CE1', subsystem: 'fr', tables: [1, 2, 3, 4, 5], table: null, pairCount: 6, moves: coups
  })
  const progres = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieProgress')))
  const lignes = progres.filter(p => p.gameType === 'pairsMultiplication')
  expect(lignes.map(p => p.itemId).sort()).toEqual(attendue.pairs.map(p => p.id).sort())
  expect(lignes.every(p => /^\d+×\d+$/.test(p.itemId) && p.isCorrect === true)).toBe(true)
  // Aucun mélange avec la mémoire FR ↔ EN
  expect(scores.some(s => s.gameType === 'pairsMemory')).toBe(false)

  await page.getByRole('button', { name: 'Retour' }).click()
  await totalAffiche(page, 60)
  expect(erreurs).toEqual([])
})

test('Une seule table (CP) : table de 1 non proposée, cartes de la seule table choisie, en anglais', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await creerProfilComplet(page, { pseudo: 'Tables CP', niveau: 'SIL-CP', classe: 'CP' })
  await page.getByRole('button', { name: 'English' }).click()
  await page.getByRole('button', { name: /Times tables memory/ }).click()
  await page.locator('.anagram-select__btn', { hasText: 'One table only' }).click()
  await expect(page.locator('.memory-select__tables button')).toHaveText(['× 2', '× 4', '× 5'])
  await page.getByRole('button', { name: '5 times table' }).click()
  const numero = 31
  await page.getByLabel('Game number (optional)').fill(String(numero))
  await page.locator('.anagram-select__start').click()
  const attendue = createMultiplicationMemoryGame({ className: 'CP', subsystem: 'fr', table: 5, seed: numero })
  expect(attendue.pairs.every(p => p.table === 5)).toBe(true)
  await expect(cartes(page)).toHaveCount(8)
  await expect(page.locator('.anagram-game__seed')).toHaveText(`Game no. ${numero} · 5 times table · CP`)
  await trouverTout(page, attendue)
  await page.getByRole('button', { name: 'Finish' }).click()
  await expect(page.locator('.anagram-finished__score')).toHaveText('40')
  const scores = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieScores')))
  expect(scores.at(-1)).toMatchObject({ gameType: 'pairsMultiplication', score: 40, niveau: 'SIL-CP', className: 'CP', tables: [5], table: 5, moves: 4, language: 'en' })
  expect(erreurs).toEqual([])
})

test('Class 1 (anglophone) : carte visible, message « pas encore de table », pas de partie', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await creerProfilComplet(page, { pseudo: 'Class one', niveau: 'SIL-CP', sousSysteme: 'en', classe: 'Class 1' })
  await page.getByRole('button', { name: /Mémoire des tables/ }).click()
  await expect(page.getByTestId('tables-class')).toContainText('Réglé pour : Class 1 (sous-système anglophone).')
  await expect(page.getByTestId('tables-none')).toContainText('Pas encore de table de multiplication pour ta classe (Class 1)')
  await expect(page.locator('.anagram-select__start')).toBeDisabled()
  await expect(page.getByLabel('Numéro de partie (facultatif)')).toHaveCount(0)
  await page.locator('.anagram-select__back').click()
  await expect(page.getByRole('button', { name: /Mémoire des tables/ })).toBeVisible()
  expect(erreurs).toEqual([])
})

for (const largeur of [375, 320]) {
  test(`Téléphone ${largeur} px : CM1, 12 cartes, sans débordement, cibles d'au moins 44 px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 700 })
    await creerProfilComplet(page, { pseudo: `Tables ${largeur}`, niveau: 'CM1-CM2', classe: 'CM1' })
    await page.getByRole('button', { name: /Mémoire des tables/ }).click()
    expect(await deborde(page)).toBe(false)
    await page.getByLabel('Numéro de partie (facultatif)').fill('99')
    await page.locator('.anagram-select__start').click()
    const attendue = createMultiplicationMemoryGame({ className: 'CM1', subsystem: 'fr', seed: 99 })
    await expect(cartes(page)).toHaveCount(12)
    expect(await deborde(page)).toBe(false)
    const tailles = await cartes(page).evaluateAll(els => els.map(e => e.getBoundingClientRect()))
    expect(tailles.every(r => r.height >= 44 && r.width >= 44)).toBe(true)
    await trouverTout(page, attendue)
    const mesures = await cartes(page).evaluateAll(els => els.map(e => e.scrollWidth > e.clientWidth + 1))
    expect(mesures.every(d => !d)).toBe(true)
    expect(await deborde(page)).toBe(false)
  })
}
